/**
 * @file cc-discovery-helpers.test.js
 * @description Direct unit tests for the exported helpers in
 * `server/lib/cc-discovery.js`: parseFrontmatter, redactSettings, isUnder,
 * and the MAX_FILE_BYTES constant. The integration tests in
 * cc-config.test.js exercise these indirectly through HTTP routes; this
 * file pins down their behavior at the function level so future refactors
 * surface regressions immediately.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  parseFrontmatter,
  redactSettings,
  isUnder,
  readSkills,
  MAX_FILE_BYTES,
  HOOK_EVENT_TYPES,
} = require("../lib/cc-discovery");

describe("parseFrontmatter", () => {
  it("returns null frontmatter for plain markdown", () => {
    const r = parseFrontmatter("# Just a heading\n\nNo frontmatter here.");
    assert.equal(r.frontmatter, null);
    assert.match(r.body, /Just a heading/);
  });

  it("parses simple key/value frontmatter", () => {
    const r = parseFrontmatter("---\nname: my-skill\ndescription: A simple skill\n---\nbody text");
    assert.equal(r.frontmatter.name, "my-skill");
    assert.equal(r.frontmatter.description, "A simple skill");
    assert.equal(r.body.trim(), "body text");
  });

  it("strips surrounding double quotes from values", () => {
    const r = parseFrontmatter('---\nname: "quoted name"\n---\n');
    assert.equal(r.frontmatter.name, "quoted name");
  });

  it("strips surrounding single quotes from values", () => {
    const r = parseFrontmatter("---\nname: 'single quoted'\n---\n");
    assert.equal(r.frontmatter.name, "single quoted");
  });

  it("preserves quotes inside the value", () => {
    const r = parseFrontmatter('---\ndescription: text with "inner" quotes\n---\n');
    assert.equal(r.frontmatter.description, 'text with "inner" quotes');
  });

  it("supports multiline indented continuation values", () => {
    const r = parseFrontmatter(
      "---\ndescription: line one\n  line two\n  line three\nname: x\n---\n"
    );
    assert.match(r.frontmatter.description, /line one/);
    assert.match(r.frontmatter.description, /line two/);
    assert.match(r.frontmatter.description, /line three/);
    assert.equal(r.frontmatter.name, "x");
  });

  it("returns null frontmatter when --- is present but never closed", () => {
    const r = parseFrontmatter("---\nname: never closed\nbody text below");
    assert.equal(r.frontmatter, null);
    // body falls back to the entire input
    assert.match(r.body, /never closed/);
  });

  it("ignores lines that don't match key:value", () => {
    const r = parseFrontmatter("---\nname: ok\nthis is not a key value\n---\n");
    assert.equal(r.frontmatter.name, "ok");
    assert.equal(r.frontmatter["this is not a key value"], undefined);
  });

  it("handles non-string input gracefully", () => {
    const r1 = parseFrontmatter(null);
    const r2 = parseFrontmatter(undefined);
    const r3 = parseFrontmatter(123);
    for (const r of [r1, r2, r3]) {
      assert.equal(r.frontmatter, null);
      assert.equal(r.body, "");
    }
  });

  it("trims trailing whitespace in values", () => {
    const r = parseFrontmatter("---\nname: trailing-space   \n---\n");
    assert.equal(r.frontmatter.name, "trailing-space");
  });

  it("body preserves its content verbatim after the closing ---", () => {
    const r = parseFrontmatter("---\nname: x\n---\n\n# Heading\n\nParagraph.");
    assert.match(r.body, /^# Heading/);
    assert.match(r.body, /Paragraph\.$/);
  });
});

describe("redactSettings", () => {
  it("redacts string values whose key matches token/secret/password/key/auth", () => {
    const input = {
      apiKey: "sk-abc123",
      authToken: "bearer xyz",
      password: "hunter2",
      secret_key: "shh",
      apiSecret: "private",
      regularField: "stays",
    };
    const out = redactSettings(input);
    assert.equal(out.apiKey, "<redacted>");
    assert.equal(out.authToken, "<redacted>");
    assert.equal(out.password, "<redacted>");
    assert.equal(out.secret_key, "<redacted>");
    assert.equal(out.apiSecret, "<redacted>");
    assert.equal(out.regularField, "stays");
  });

  it("handles api-key and api_key variants", () => {
    const out = redactSettings({ "api-key": "x", api_key: "y", apikey: "z" });
    assert.equal(out["api-key"], "<redacted>");
    assert.equal(out.api_key, "<redacted>");
    assert.equal(out.apikey, "<redacted>");
  });

  it("does not redact non-string values even if key matches", () => {
    // The redactor only swaps STRING values; nested objects/arrays/numbers
    // pass through unchanged so structure is preserved.
    const out = redactSettings({ apiKey: 12345, secrets: { x: "stay" } });
    assert.equal(out.apiKey, 12345);
    assert.deepEqual(out.secrets, { x: "stay" });
  });

  it("recurses into nested objects", () => {
    const out = redactSettings({
      provider: { name: "anthropic", apiKey: "sk-...", endpoint: "https://api" },
    });
    assert.equal(out.provider.apiKey, "<redacted>");
    assert.equal(out.provider.name, "anthropic");
    assert.equal(out.provider.endpoint, "https://api");
  });

  it("recurses into arrays of objects", () => {
    const out = redactSettings({
      mcpServers: [
        { name: "a", apiKey: "sk-1" },
        { name: "b", token: "tok-2" },
      ],
    });
    assert.equal(out.mcpServers[0].apiKey, "<redacted>");
    assert.equal(out.mcpServers[1].token, "<redacted>");
    assert.equal(out.mcpServers[0].name, "a");
  });

  it("passes scalars through unchanged", () => {
    assert.equal(redactSettings(null), null);
    assert.equal(redactSettings(undefined), undefined);
    assert.equal(redactSettings(42), 42);
    assert.equal(redactSettings(true), true);
    assert.equal(redactSettings("plain"), "plain");
  });

  it("is case-insensitive on key match", () => {
    const out = redactSettings({ APIKEY: "x", AuthHeader: "y", ToKeN: "z" });
    assert.equal(out.APIKEY, "<redacted>");
    assert.equal(out.AuthHeader, "<redacted>");
    assert.equal(out.ToKeN, "<redacted>");
  });

  it("does not match keys that contain unrelated substrings", () => {
    // 'kept' contains 'kep' not 'key' - should stay
    const out = redactSettings({ kept: "stays", description: "stays too" });
    assert.equal(out.kept, "stays");
    assert.equal(out.description, "stays too");
  });
});

describe("isUnder", () => {
  it("returns true when target equals root", () => {
    assert.equal(isUnder("/a/b", "/a/b"), true);
  });

  it("returns true when target is inside root", () => {
    assert.equal(isUnder("/a/b", "/a/b/c"), true);
    assert.equal(isUnder("/a/b", "/a/b/c/d/e.txt"), true);
  });

  it("returns false when target is outside root", () => {
    assert.equal(isUnder("/a/b", "/a/c"), false);
    assert.equal(isUnder("/a/b", "/x/y"), false);
  });

  it("rejects sibling paths that share a prefix", () => {
    // /a/b vs /a/bb - bb starts with b but is not under /a/b
    assert.equal(isUnder("/a/b", "/a/bb"), false);
    assert.equal(isUnder("/a/b", "/a/b-extra"), false);
  });

  it("normalises relative segments via path.resolve", () => {
    // .. inside the target gets resolved away
    assert.equal(isUnder("/a/b", "/a/b/c/../d"), true); // /a/b/d
    assert.equal(isUnder("/a/b", "/a/b/../c"), false); // /a/c
  });

  it("returns true regardless of trailing slash", () => {
    assert.equal(isUnder("/a/b/", "/a/b/c"), true);
    assert.equal(isUnder("/a/b", "/a/b/c/"), true);
  });

  it("works with paths produced by path.resolve", () => {
    const root = path.resolve("/tmp/cc-test");
    const inside = path.resolve("/tmp/cc-test/skills/x/SKILL.md");
    const outside = path.resolve("/tmp/elsewhere/file");
    assert.equal(isUnder(root, inside), true);
    assert.equal(isUnder(root, outside), false);
  });
});

describe("readSkills (symlinked skill directories)", () => {
  it("includes a skill directory that is a symlink to a real directory", () => {
    // Dirent.isDirectory() returns false for a symlink even when it points
    // to a directory (Node fs quirk) — readSkillsAt must still follow it.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cc-discovery-symlink-"));
    const realDir = path.join(tmp, "real-skills", "second-brain");
    fs.mkdirSync(realDir, { recursive: true });
    fs.writeFileSync(
      path.join(realDir, "SKILL.md"),
      "---\nname: second-brain\n---\n\nBody text.\n"
    );
    const projectRoot = path.join(tmp, "project");
    const skillsDir = path.join(projectRoot, ".claude", "skills");
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.symlinkSync(realDir, path.join(skillsDir, "second-brain"), "dir");

    const items = readSkills({ scope: "project", cwd: projectRoot });
    const names = items.map((s) => s.name);
    assert.ok(names.includes("second-brain"), `expected symlinked skill in ${names}`);
  });

  it("skips a broken symlink without throwing", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cc-discovery-broken-symlink-"));
    const projectRoot = path.join(tmp, "project");
    const skillsDir = path.join(projectRoot, ".claude", "skills");
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.symlinkSync(path.join(tmp, "does-not-exist"), path.join(skillsDir, "broken"), "dir");

    let items;
    assert.doesNotThrow(() => {
      items = readSkills({ scope: "project", cwd: projectRoot });
    });
    assert.ok(!items.map((s) => s.name).includes("broken"));
  });
});

describe("module exports", () => {
  it("MAX_FILE_BYTES is 256 KB", () => {
    assert.equal(MAX_FILE_BYTES, 256 * 1024);
  });

  it("HOOK_EVENT_TYPES covers all canonical Claude Code events", () => {
    const expected = [
      "SessionStart",
      "SessionEnd",
      "UserPromptSubmit",
      "PreToolUse",
      "PostToolUse",
      "Stop",
      "SubagentStop",
      "Notification",
      "PreCompact",
    ];
    for (const t of expected) assert.ok(HOOK_EVENT_TYPES.includes(t), `missing ${t}`);
  });
});
