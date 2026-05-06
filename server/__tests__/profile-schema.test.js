// server/__tests__/profile-schema.test.js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  validateProfileConfig,
  buildArgsFromConfig,
  flagTable,
} = require("../lib/profile-schema");

describe("profile-schema flagTable", () => {
  it("covers the in-scope CLI flags", () => {
    const required = [
      "model", "fallbackModel", "effort", "betas",
      "permissionMode",
      "tools", "allowedTools", "disallowedTools",
      "systemPrompt", "systemPromptFile", "appendSystemPrompt", "appendSystemPromptFile",
      "addDir",
      "mcpConfig", "strictMcpConfig",
      "pluginDir",
      "settings", "settingSources",
      "agent", "agents",
      "outputFormat", "inputFormat", "includeHookEvents", "includePartialMessages", "jsonSchema",
      "maxTurns", "maxBudgetUsd",
      "verbose", "debug",
      "channels",
      "excludeDynamicSystemPromptSections",
      "bare", "dangerouslySkipPermissions", "allowDangerouslySkipPermissions",
      "dangerouslyLoadDevelopmentChannels",
    ];
    for (const k of required) {
      assert.ok(flagTable[k], `flagTable missing ${k}`);
    }
  });
});

describe("validateProfileConfig", () => {
  it("accepts an empty config", () => {
    const r = validateProfileConfig({});
    assert.equal(r.ok, true, JSON.stringify(r.errors));
  });

  it("rejects unknown keys", () => {
    const r = validateProfileConfig({ doesNotExist: 1 });
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /unknown key/);
  });

  it("rejects mutually exclusive system-prompt replace flags", () => {
    const r = validateProfileConfig({ systemPrompt: "a", systemPromptFile: "b" });
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /mutually exclusive/);
  });

  it("rejects bad enums", () => {
    const r = validateProfileConfig({ permissionMode: "nope" });
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /permissionMode/);
  });

  it("rejects negative numeric limits", () => {
    const r = validateProfileConfig({ maxTurns: -1 });
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /maxTurns/);
  });

  it("rejects arrays passed to json-shape keys", () => {
    const r = validateProfileConfig({ agents: ["bad"] });
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /agents/);
  });

  it("accepts envVarNames as string[]", () => {
    const r = validateProfileConfig({ envVarNames: ["GITHUB_TOKEN"] });
    assert.equal(r.ok, true, JSON.stringify(r.errors));
  });

  it("rejects envVarNames with non-string entries", () => {
    const r = validateProfileConfig({ envVarNames: ["A", 1] });
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /envVarNames/);
  });
});

describe("buildArgsFromConfig", () => {
  it("returns deterministic argv for an empty config + prompt", () => {
    const argv = buildArgsFromConfig({}, { prompt: "hi" });
    assert.deepEqual(argv, [
      "-p", "hi",
      "--input-format", "stream-json",
      "--output-format", "stream-json",
      "--verbose",
      "--permission-mode", "acceptEdits",
    ]);
  });

  it("appends scalar string flags", () => {
    const argv = buildArgsFromConfig(
      { model: "claude-sonnet-4-6", effort: "high" },
      { prompt: "go" }
    );
    assert.ok(argv.includes("--model"));
    assert.ok(argv.includes("claude-sonnet-4-6"));
    assert.ok(argv.includes("--effort"));
    assert.ok(argv.includes("high"));
  });

  it("emits comma-joined arrays for tools", () => {
    const argv = buildArgsFromConfig(
      { allowedTools: ["Bash(git log *)", "Read"] },
      { prompt: "x" }
    );
    const i = argv.indexOf("--allowedTools");
    assert.equal(argv[i + 1], "Bash(git log *),Read");
  });

  it("repeats the flag for repeatable arrays (pluginDir)", () => {
    const argv = buildArgsFromConfig(
      { pluginDir: ["./a", "./b"] },
      { prompt: "x" }
    );
    const idxs = argv.reduce((acc, v, i) => (v === "--plugin-dir" ? [...acc, i] : acc), []);
    assert.equal(idxs.length, 2);
    assert.equal(argv[idxs[0] + 1], "./a");
    assert.equal(argv[idxs[1] + 1], "./b");
  });

  it("adds boolean flags only when true", () => {
    const argv = buildArgsFromConfig({ verbose: false }, { prompt: "x" });
    const count = argv.filter((v) => v === "--verbose").length;
    assert.equal(count, 1);
  });

  it("serializes agents as JSON for --agents", () => {
    const argv = buildArgsFromConfig(
      { agents: { rev: { description: "d", prompt: "p" } } },
      { prompt: "x" }
    );
    const i = argv.indexOf("--agents");
    assert.ok(i > -1);
    assert.deepEqual(JSON.parse(argv[i + 1]), { rev: { description: "d", prompt: "p" } });
  });

  it("emits --resume and --fork-session from per-launch toggles", () => {
    const argv = buildArgsFromConfig(
      {},
      { prompt: "x", resumeSessionId: "abc", forkSession: true }
    );
    const r = argv.indexOf("--resume");
    assert.equal(argv[r + 1], "abc");
    assert.ok(argv.includes("--fork-session"));
  });
});
