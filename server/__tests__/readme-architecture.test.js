/**
 * @file readme-architecture.test.js
 * @description Guards the lightweight repository landing README separately
 * from the complete English and localized guide mirror set.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const LANDING_PATH = path.join(ROOT, "README.md");
const FULL_ENGLISH_PATH = path.join(ROOT, "README-EN.md");
const LOCALIZED_GUIDES = ["README-CN.md", "README-VN.md", "README-KO.md", "README-ES.md"];

function read(relativePath) {
  const file = path.join(ROOT, relativePath);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function headingLevels(markdown) {
  return [...markdown.matchAll(/^(#{1,6})\s+/gm)].map((match) => match[1].length);
}

function badgeUrls(markdown) {
  return [...markdown.matchAll(/https:\/\/img\.shields\.io\/[^\s)"]+/g)].map((match) => match[0]);
}

function screenshotSources(markdown) {
  return [...markdown.matchAll(/src="(images\/readme\/[^"]+)"/g)].map((match) => match[1]);
}

function screenshotPairs(markdown) {
  return [...markdown.matchAll(/<a href="([^"]+)"><img src="([^"]+)"/g)].map(
    ([, original, thumbnail]) => [original, thumbnail]
  );
}

function linkTargets(markdown) {
  const targets = [];
  for (const match of markdown.matchAll(/\]\((?:<([^>]+)>|([^\s)]+))/g)) {
    targets.push(match[1] || match[2]);
  }
  for (const match of markdown.matchAll(/(?:href|src)="([^"]+)"/g)) targets.push(match[1]);
  return targets;
}

function headingAnchors(markdown) {
  return new Set(
    [...markdown.matchAll(/^#{1,6}\s+(.+)$/gm)].map(([, heading]) =>
      heading
        .replace(/<[^>]+>/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .trim()
        .replace(/\s+/g, "-")
    )
  );
}

function assertRelativeTargetsResolve(sourceFile, markdown) {
  for (const rawTarget of linkTargets(markdown)) {
    if (/^(?:https?:|mailto:|#|data:)/.test(rawTarget)) continue;
    const [targetPath, anchor] = rawTarget.replace(/\\([()])/g, "$1").split("#", 2);
    if (!targetPath) continue;
    const resolved = path.resolve(path.dirname(path.join(ROOT, sourceFile)), targetPath);
    assert.ok(fs.existsSync(resolved), `${sourceFile} link target is missing: ${rawTarget}`);
    if (anchor && resolved.endsWith(".md")) {
      assert.ok(
        headingAnchors(fs.readFileSync(resolved, "utf8")).has(anchor),
        `${sourceFile} anchor is missing: ${rawTarget}`
      );
    }
  }
}

describe("repository README architecture", () => {
  it("keeps a complete English guide as the full-guide source of truth", () => {
    assert.ok(fs.existsSync(FULL_ENGLISH_PATH), "README-EN.md must preserve the full guide");

    const fullEnglish = read("README-EN.md");
    const englishHeadings = headingLevels(fullEnglish);
    assert.ok(Buffer.byteLength(fullEnglish) > 100_000, "README-EN.md must remain the full guide");
    assert.ok(englishHeadings.length >= 100, "README-EN.md must retain the complete structure");

    for (const localized of LOCALIZED_GUIDES) {
      assert.deepEqual(
        headingLevels(read(localized)),
        englishHeadings,
        `${localized} must mirror README-EN.md heading levels`
      );
      assert.match(read(localized), /README-EN\.md/, `${localized} must link to README-EN.md`);
    }
  });

  it("keeps the root landing page within the mobile rendering budget", () => {
    const landing = read("README.md");
    assert.ok(Buffer.byteLength(landing) <= 45_000, "README.md must stay at or below 45 KB");
    assert.equal((landing.match(/^```mermaid$/gm) || []).length, 0, "README.md must omit Mermaid");
    assert.ok((landing.match(/^\|.*\|$/gm) || []).length <= 20, "README.md tables are too large");
    const fenceLines = (landing.match(/^```/gm) || []).length;
    assert.equal(fenceLines % 2, 0, "README.md has unbalanced code fences");
    assert.ok(fenceLines / 2 <= 8, "README.md has too many fenced code blocks");
    assert.deepEqual(screenshotSources(landing), [
      "images/readme/dashboard.png",
      "images/readme/session-conversation.png",
      "images/readme/workflows.png",
      "images/readme/config.png",
      "images/readme/run.png",
    ]);
    assert.match(landing, /npm run install-hooks/, "README.md must explain manual hook setup");
  });

  it("preserves every badge and links the full guides and primary references", () => {
    const landing = read("README.md");
    const fullEnglish = read("README-EN.md");
    assert.deepEqual(
      badgeUrls(landing),
      badgeUrls(fullEnglish),
      "README.md must preserve all badges"
    );

    const destinations = new Set(linkTargets(landing));
    for (const target of [
      "README-EN.md",
      ...LOCALIZED_GUIDES,
      "docs/README.md",
      "ARCHITECTURE.md",
      "docs/CLI.md",
      "docs/API.md",
      "mcp/README.md",
      "DESKTOP.md",
      "DEPLOYMENT.md",
      ".github/SECURITY.md",
      ".github/CONTRIBUTING.md",
    ]) {
      assert.ok(
        [...destinations].some((destination) => destination.split("#")[0].endsWith(target)),
        `README.md must link to ${target}`
      );
    }

    assert.deepEqual(screenshotPairs(landing), [
      ["images/dashboard.png", "images/readme/dashboard.png"],
      ["images/session-conversation.png", "images/readme/session-conversation.png"],
      ["images/workflows.png", "images/readme/workflows.png"],
      ["images/config.png", "images/readme/config.png"],
      ["images/run.png", "images/readme/run.png"],
    ]);

    for (const guide of ["README.md", "README-EN.md", ...LOCALIZED_GUIDES]) {
      assertRelativeTargetsResolve(guide, read(guide));
    }
  });

  it("documents README-EN.md as the full-guide source in contributor automation", () => {
    assert.match(
      read(".claude/skills/i18n-parity/references/translation-style.md"),
      /same targets as `README-EN\.md`/
    );
    assert.match(read("plugins/README.md"), /`README-EN\.md`/);
  });
});
