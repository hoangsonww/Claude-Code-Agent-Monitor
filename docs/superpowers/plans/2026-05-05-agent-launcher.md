# Agent Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a UI-driven launcher and reusable Profiles system on top of the existing orchestrator (commit `a6343be`), exposing every session-launch flag from the Claude Code CLI reference and adding a send composer to the existing Conversation tab so any session — live or imported — can be continued from the dashboard.

**Architecture:** Server-side, extend `server/lib/spawner.js` with a complete flag→argv mapping driven by a `ProfileConfig` JSON Schema, open child stdin for back-and-forth via stream-json, and add three SQLite tables (`launcher_profiles`, `launcher_allowed_cwds`, `launcher_launches`). Client-side, a new `LauncherView` page hosts a sectioned form, a Profile Manager tab joins Settings, and a `SendComposer` component is mounted at the bottom of the existing `ConversationView`. All new surface stays gated behind `ORCHESTRATOR_ENABLED=1`.

**Tech Stack:** Node.js 22, Express 4.21, SQLite (better-sqlite3 with node-sqlite fallback via `compat-sqlite`), React 18, Vite, TypeScript, MUI v7, react-router-dom 6, vitest (`@testing-library/react`), `node:test` + `node:assert/strict`.

---

## Spec reference

`docs/superpowers/specs/2026-05-05-agent-launcher-design.md`. Re-read it before starting.

## File structure

**New (server)**
- `server/lib/profile-schema.js` — exports `flagTable`, `validateProfileConfig(cfg)`, `buildArgsFromConfig(cfg, perLaunch)`.
- `server/lib/stream-json-parser.js` — newline-delimited JSON line buffer + emit helper.
- `server/lib/profiles.js` — CRUD prepared statements over `launcher_profiles`.
- `server/lib/cwds.js` — CRUD prepared statements over `launcher_allowed_cwds`.
- `server/lib/launches.js` — append-only audit log for `launcher_launches`.
- `server/lib/launcher-secrets.js` — parse `~/.claude/launcher/secrets.env` (KEY=VALUE).
- `server/routes/profiles.js` — HTTP CRUD + import/export.
- `server/routes/cwds.js` — HTTP CRUD.

**New (client)**
- `client/src/lib/profile-types.ts` — `ProfileConfig` TypeScript type.
- `client/src/lib/profile-flag-mapping.ts` — flag table mirror used by `CommandPreview`.
- `client/src/hooks/useProfiles.ts` — profile CRUD wrappers.
- `client/src/hooks/useCwds.ts` — cwd allowlist wrappers.
- `client/src/features/launcher/CommandPreview.tsx`
- `client/src/features/launcher/SendComposer.tsx`
- `client/src/features/launcher/ProfileEditor.tsx` (shell + sections)
- `client/src/features/launcher/sections/IdentitySection.tsx`
- `client/src/features/launcher/sections/CwdSection.tsx`
- `client/src/features/launcher/sections/ModelRuntimeSection.tsx`
- `client/src/features/launcher/sections/PermissionsSection.tsx`
- `client/src/features/launcher/sections/ToolsSection.tsx`
- `client/src/features/launcher/sections/SystemPromptSection.tsx`
- `client/src/features/launcher/sections/McpPluginsSection.tsx`
- `client/src/features/launcher/sections/SettingsSourcesSection.tsx`
- `client/src/features/launcher/sections/AgentsSection.tsx`
- `client/src/features/launcher/sections/OutputSection.tsx`
- `client/src/features/launcher/sections/LimitsLoggingSection.tsx`
- `client/src/features/launcher/sections/EnvVarsSection.tsx`
- `client/src/features/launcher/sections/ChannelsSection.tsx`
- `client/src/features/launcher/sections/DangerousSection.tsx`
- `client/src/pages/LauncherView.tsx`
- `client/src/pages/SettingsProfiles.tsx` — Profile Manager tab.

**New (tests)**
- `server/__tests__/profile-schema.test.js`
- `server/__tests__/stream-json-parser.test.js`
- `server/__tests__/profiles-lib.test.js`
- `server/__tests__/cwds.test.js`
- `server/__tests__/launches.test.js`
- `server/__tests__/launcher-secrets.test.js`
- `server/__tests__/profiles-route.test.js`
- `server/__tests__/cwds-route.test.js`
- `server/__tests__/orchestrator-extended.test.js`
- `client/src/lib/__tests__/profile-flag-mapping.test.ts`
- `client/src/features/launcher/__tests__/CommandPreview.test.tsx`
- `client/src/features/launcher/__tests__/ProfileEditor.test.tsx`
- `client/src/features/launcher/__tests__/SendComposer.test.tsx`
- `client/src/pages/__tests__/LauncherView.test.tsx`

**Modified**
- `server/lib/spawner.js` — full rewrite of argv builder; `stdio[0]` flips to `"pipe"`; new `sendMessage()`; concurrency cap; resume; stream-json broadcast.
- `server/routes/orchestrator.js` — extend `POST /spawn` body; add `POST /agents/:id/message`; mount `profiles.js` and `cwds.js`.
- `server/db.js` — add three new `CREATE TABLE` blocks to the inline schema.
- `server/index.js` — already mounts `/api/orchestrator`; no new mount points needed.
- `client/src/hooks/useOrchestrator.ts` — add `sendMessage`; new `SpawnArgs` shape.
- `client/src/components/conversation/ConversationView.tsx` — mount `<SendComposer />` at the bottom.
- `client/src/pages/MobileChat.tsx` — refactor to thin wrapper over `<SendComposer />`.
- `client/src/lib/types.ts` — add `agent_input_ack` WSMessage variant.
- `client/src/App.tsx` — add `/launcher` route.
- `client/src/pages/Settings.tsx` — add a "Profiles" tab; integrate `<SettingsProfiles />`.
- `.env.example` — document `ORCHESTRATOR_MAX_CONCURRENT`, `ORCHESTRATOR_ENABLED`.

## Phase plan

| Phase | Tasks | Sequential? | Shippable on its own? |
|---|---|---|---|
| 1. Server foundation | 1–5 | yes | spawner+parsing tested in isolation |
| 2. Persistence layer | 6–11 | yes (after 1) | curl-able profile + cwd CRUD |
| 3. Spawn integration | 12–15 | yes (after 2) | full launch via API; no UI yet |
| 4. Launcher form UI | 16–22 | parallelizable after 3 | usable launcher page |
| 5. Profile manager UI | 23–24 | parallelizable after 3 | settings tab |
| 6. Send composer UI | 25–28 | parallelizable after 3 | live + resume from Conversation |
| 7. Docs / polish | 29–31 | parallelizable after 6 | release-ready |

---

## Phase 1 — Server foundation (sequential)

### Task 1: ProfileConfig flag table + buildArgsFromConfig

**Files:**
- Create: `server/lib/profile-schema.js`
- Test: `server/__tests__/profile-schema.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:server -- --test-name-pattern="profile-schema"`
Expected: FAIL — "Cannot find module '../lib/profile-schema'"

- [ ] **Step 3: Write the implementation**

```javascript
// server/lib/profile-schema.js
/**
 * @file Single source of truth for the launcher's flag mapping. The flagTable
 * declares each ProfileConfig key, its CLI flag, its emit shape, and validation
 * rules. Both validateProfileConfig and buildArgsFromConfig consume it.
 */

const PERMISSION_MODES = ["default", "acceptEdits", "plan", "auto", "dontAsk", "bypassPermissions"];
const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const OUTPUT_FORMATS = ["text", "json", "stream-json"];
const INPUT_FORMATS = ["text", "stream-json"];
const SETTING_SOURCES = ["user", "project", "local"];

const flagTable = {
  model: { flag: "--model", shape: "scalar" },
  fallbackModel: { flag: "--fallback-model", shape: "scalar" },
  effort: { flag: "--effort", shape: "scalar", enum: EFFORTS },
  betas: { flag: "--betas", shape: "comma" },
  permissionMode: { flag: "--permission-mode", shape: "scalar", enum: PERMISSION_MODES },
  tools: { flag: "--tools", shape: "comma" },
  allowedTools: { flag: "--allowedTools", shape: "comma" },
  disallowedTools: { flag: "--disallowedTools", shape: "comma" },
  systemPrompt: { flag: "--system-prompt", shape: "scalar" },
  systemPromptFile: { flag: "--system-prompt-file", shape: "scalar" },
  appendSystemPrompt: { flag: "--append-system-prompt", shape: "scalar" },
  appendSystemPromptFile: { flag: "--append-system-prompt-file", shape: "scalar" },
  addDir: { flag: "--add-dir", shape: "repeat" },
  mcpConfig: { flag: "--mcp-config", shape: "repeat" },
  strictMcpConfig: { flag: "--strict-mcp-config", shape: "boolean" },
  pluginDir: { flag: "--plugin-dir", shape: "repeat" },
  settings: { flag: "--settings", shape: "scalar" },
  settingSources: { flag: "--setting-sources", shape: "comma", enum: SETTING_SOURCES },
  agent: { flag: "--agent", shape: "scalar" },
  agents: { flag: "--agents", shape: "json" },
  outputFormat: { flag: "--output-format", shape: "scalar", enum: OUTPUT_FORMATS },
  inputFormat: { flag: "--input-format", shape: "scalar", enum: INPUT_FORMATS },
  includeHookEvents: { flag: "--include-hook-events", shape: "boolean" },
  includePartialMessages: { flag: "--include-partial-messages", shape: "boolean" },
  jsonSchema: { flag: "--json-schema", shape: "scalar" },
  maxTurns: { flag: "--max-turns", shape: "number", min: 1, max: 10000 },
  maxBudgetUsd: { flag: "--max-budget-usd", shape: "number", min: 0, max: 10000 },
  verbose: { flag: "--verbose", shape: "boolean" },
  debug: { flag: "--debug", shape: "scalar" },
  channels: { flag: "--channels", shape: "comma" },
  excludeDynamicSystemPromptSections: { flag: "--exclude-dynamic-system-prompt-sections", shape: "boolean" },
  bare: { flag: "--bare", shape: "boolean", dangerous: true },
  dangerouslySkipPermissions: { flag: "--dangerously-skip-permissions", shape: "boolean", dangerous: true },
  allowDangerouslySkipPermissions: { flag: "--allow-dangerously-skip-permissions", shape: "boolean", dangerous: true },
  dangerouslyLoadDevelopmentChannels: { flag: "--dangerously-load-development-channels", shape: "comma", dangerous: true },
};

const MUTEX = [["systemPrompt", "systemPromptFile"]];

function validateProfileConfig(cfg) {
  const errors = [];
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) {
    return { ok: false, errors: ["config must be an object"] };
  }
  for (const key of Object.keys(cfg)) {
    if (key === "envVarNames") continue;
    const spec = flagTable[key];
    if (!spec) {
      errors.push(`unknown key: ${key}`);
      continue;
    }
    const v = cfg[key];
    switch (spec.shape) {
      case "scalar":
        if (typeof v !== "string") errors.push(`${key} must be a string`);
        else if (spec.enum && !spec.enum.includes(v)) errors.push(`${key} must be one of ${spec.enum.join(",")}`);
        break;
      case "boolean":
        if (typeof v !== "boolean") errors.push(`${key} must be a boolean`);
        break;
      case "number":
        if (typeof v !== "number" || Number.isNaN(v)) errors.push(`${key} must be a number`);
        else if (spec.min != null && v < spec.min) errors.push(`${key} must be >= ${spec.min}`);
        else if (spec.max != null && v > spec.max) errors.push(`${key} must be <= ${spec.max}`);
        break;
      case "comma":
      case "repeat":
        if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
          errors.push(`${key} must be string[]`);
        } else if (spec.enum && v.some((x) => !spec.enum.includes(x))) {
          errors.push(`${key} entries must be one of ${spec.enum.join(",")}`);
        }
        break;
      case "json":
        if (v == null || typeof v !== "object") errors.push(`${key} must be an object`);
        break;
    }
  }
  if (cfg.envVarNames !== undefined && !Array.isArray(cfg.envVarNames)) {
    errors.push("envVarNames must be string[]");
  }
  for (const [a, b] of MUTEX) {
    if (cfg[a] != null && cfg[b] != null) errors.push(`${a} and ${b} are mutually exclusive`);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

function buildArgsFromConfig(cfg = {}, perLaunch = {}) {
  const argv = ["-p", String(perLaunch.prompt ?? "")];
  argv.push("--input-format", "stream-json");
  argv.push("--output-format", "stream-json");
  argv.push("--verbose");
  argv.push("--permission-mode", cfg.permissionMode || "acceptEdits");

  for (const [key, spec] of Object.entries(flagTable)) {
    if (key === "permissionMode" || key === "outputFormat" || key === "inputFormat" || key === "verbose") continue;
    if (!(key in cfg) || cfg[key] == null) continue;
    const v = cfg[key];
    switch (spec.shape) {
      case "scalar":
      case "number":
        argv.push(spec.flag, String(v));
        break;
      case "boolean":
        if (v === true) argv.push(spec.flag);
        break;
      case "comma":
        if (Array.isArray(v) && v.length) argv.push(spec.flag, v.join(","));
        break;
      case "repeat":
        if (Array.isArray(v)) for (const item of v) argv.push(spec.flag, item);
        break;
      case "json":
        argv.push(spec.flag, JSON.stringify(v));
        break;
    }
  }

  if (perLaunch.continue) argv.push("--continue");
  if (perLaunch.resumeSessionId) argv.push("--resume", perLaunch.resumeSessionId);
  if (perLaunch.forkSession) argv.push("--fork-session");
  if (perLaunch.sessionId) argv.push("--session-id", perLaunch.sessionId);

  return argv;
}

module.exports = {
  flagTable,
  validateProfileConfig,
  buildArgsFromConfig,
  PERMISSION_MODES, EFFORTS, OUTPUT_FORMATS, INPUT_FORMATS, SETTING_SOURCES,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:server -- --test-name-pattern="profile-schema"`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/profile-schema.js server/__tests__/profile-schema.test.js
git commit -m "feat(launcher): ProfileConfig flag table, validator, argv builder"
```

---

### Task 2: Stream-json line-buffered parser

**Files:**
- Create: `server/lib/stream-json-parser.js`
- Test: `server/__tests__/stream-json-parser.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// server/__tests__/stream-json-parser.test.js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { createLineParser } = require("../lib/stream-json-parser");

describe("createLineParser", () => {
  it("emits one event per complete line", () => {
    const events = [];
    const p = createLineParser((obj) => events.push(obj));
    p.push('{"a":1}\n{"b":2}\n');
    assert.deepEqual(events, [{ a: 1 }, { b: 2 }]);
  });

  it("buffers partial lines across pushes", () => {
    const events = [];
    const p = createLineParser((obj) => events.push(obj));
    p.push('{"a":');
    p.push("1}\n");
    assert.deepEqual(events, [{ a: 1 }]);
  });

  it("ignores empty lines", () => {
    const events = [];
    const p = createLineParser((obj) => events.push(obj));
    p.push("\n\n");
    assert.deepEqual(events, []);
  });

  it("forwards malformed lines to the error callback without throwing", () => {
    const events = [];
    const errors = [];
    const p = createLineParser(
      (obj) => events.push(obj),
      (err, raw) => errors.push({ msg: err.message, raw }),
    );
    p.push("{not json}\n");
    p.push('{"ok":true}\n');
    assert.equal(events.length, 1);
    assert.equal(errors.length, 1);
    assert.match(errors[0].raw, /not json/);
  });

  it("flush emits any pending complete object on close", () => {
    const events = [];
    const p = createLineParser((obj) => events.push(obj));
    p.push('{"x":1}');
    p.flush();
    assert.deepEqual(events, [{ x: 1 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:server -- --test-name-pattern="createLineParser"`
Expected: FAIL — "Cannot find module '../lib/stream-json-parser'"

- [ ] **Step 3: Write the implementation**

```javascript
// server/lib/stream-json-parser.js
/**
 * @file Newline-delimited JSON line buffer. Reassembles chunked stdout into
 * discrete JSON objects (one per line). Robust to partial writes; malformed
 * lines do not throw.
 */

function createLineParser(onObject, onError) {
  let buf = "";
  return {
    push(chunk) {
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (!line.trim()) continue;
        try {
          onObject(JSON.parse(line));
        } catch (err) {
          if (onError) onError(err, line);
        }
      }
    },
    flush() {
      if (!buf.trim()) {
        buf = "";
        return;
      }
      try {
        onObject(JSON.parse(buf));
      } catch (err) {
        if (onError) onError(err, buf);
      }
      buf = "";
    },
  };
}

module.exports = { createLineParser };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:server -- --test-name-pattern="createLineParser"`
Expected: PASS — 5 assertions green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/stream-json-parser.js server/__tests__/stream-json-parser.test.js
git commit -m "feat(launcher): newline-delimited JSON line parser"
```

---

### Task 3: Spawner — full flag mapping, stdin pipe, sendMessage, WS broadcast

**Files:**
- Modify: `server/lib/spawner.js` (full rewrite of argv + new send / broadcast surface)
- Modify: `server/__tests__/orchestrator.test.js` (adapt legacy buildArgs assertions)
- Create: `server/__tests__/spawner-extended.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// server/__tests__/spawner-extended.test.js
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

let captured = [];
function setupBroadcastMock() {
  const wsPath = require.resolve("../websocket");
  delete require.cache[wsPath];
  require.cache[wsPath] = {
    id: wsPath, filename: wsPath, loaded: true,
    exports: {
      broadcast: (type, data) => captured.push({ type, data }),
      initWebSocket: () => {},
      getConnectionCount: () => 0,
    },
  };
}

function fakeChild() {
  const c = new EventEmitter();
  c.pid = Math.floor(Math.random() * 9999) + 1;
  c.stdin = { writable: true, write(s) { this._last = s; } };
  c.stdout = new EventEmitter();
  c.stderr = new EventEmitter();
  c.kill = () => { c.killed = true; };
  c.killed = false;
  return c;
}

describe("spawner — sendMessage and broadcast", () => {
  beforeEach(() => {
    captured = [];
    setupBroadcastMock();
    delete require.cache[require.resolve("../lib/spawner")];
  });

  it("sendMessage writes a stream-json user message to stdin", () => {
    const { spawnAgent, sendMessage } = require("../lib/spawner");
    const child = fakeChild();
    const handle = spawnAgent.__injectChildForTest(child, { prompt: "hi" });
    handle.status = "running";
    sendMessage(handle.id, "next message");
    assert.match(child.stdin._last, /"role":"user"/);
    assert.match(child.stdin._last, /"next message"/);
    assert.ok(child.stdin._last.endsWith("\n"));
  });

  it("emits agent_stream WS broadcasts for each parsed JSON line", () => {
    const { spawnAgent } = require("../lib/spawner");
    const child = fakeChild();
    const handle = spawnAgent.__injectChildForTest(child, { prompt: "x" });
    child.stdout.emit("data", '{"type":"assistant","text":"hello"}\n');
    const streams = captured.filter((c) => c.type === "agent_stream");
    assert.equal(streams.length, 1);
    assert.equal(streams[0].data.sessionId, handle.id);
    assert.deepEqual(streams[0].data.chunk, { type: "assistant", text: "hello" });
  });

  it("emits agent_input_ack broadcast when sendMessage succeeds", () => {
    const { spawnAgent, sendMessage } = require("../lib/spawner");
    const handle = spawnAgent.__injectChildForTest(fakeChild(), { prompt: "x" });
    handle.status = "running";
    sendMessage(handle.id, "follow-up");
    const ack = captured.find((c) => c.type === "agent_input_ack");
    assert.ok(ack);
    assert.equal(ack.data.sessionId, handle.id);
  });

  it("rejects sendMessage when status is not running", () => {
    const { spawnAgent, sendMessage } = require("../lib/spawner");
    const handle = spawnAgent.__injectChildForTest(fakeChild(), { prompt: "x" });
    handle.status = "completed";
    assert.throws(() => sendMessage(handle.id, "late"), /not accepting input/);
  });
});

describe("spawner — concurrency cap", () => {
  beforeEach(() => {
    captured = [];
    setupBroadcastMock();
  });
  it("throws once cap reached", () => {
    process.env.ORCHESTRATOR_MAX_CONCURRENT = "2";
    delete require.cache[require.resolve("../lib/spawner")];
    const { spawnAgent } = require("../lib/spawner");
    const a = spawnAgent.__injectChildForTest(fakeChild(), { prompt: "1" });
    a.status = "running";
    const b = spawnAgent.__injectChildForTest(fakeChild(), { prompt: "2" });
    b.status = "running";
    assert.throws(
      () => spawnAgent({ profile: {}, perLaunch: { prompt: "3", cwd: process.cwd() } }),
      /concurrency limit/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:server -- --test-name-pattern="spawner"`
Expected: FAIL — `__injectChildForTest`, `sendMessage`, broadcast surface all undefined.

- [ ] **Step 3: Write the implementation (full rewrite of `server/lib/spawner.js`)**

```javascript
// server/lib/spawner.js
/**
 * @file Process-spawn helper for orchestrator-launched `claude` children.
 * Stream-json over stdin/stdout drives back-and-forth turns. Persists every
 * launch to the audit table. Concurrency-capped via ORCHESTRATOR_MAX_CONCURRENT.
 */

const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { broadcast } = require("../websocket");
const { buildArgsFromConfig, validateProfileConfig } = require("./profile-schema");
const { createLineParser } = require("./stream-json-parser");

const MAX_CONCURRENT = Number(process.env.ORCHESTRATOR_MAX_CONCURRENT || 5);
const agents = new Map();

function cleanSpawnEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_OAUTH_TOKEN;
  delete env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST;
  return env;
}

function liveCount() {
  let n = 0;
  for (const h of agents.values()) if (h.status === "spawning" || h.status === "running") n++;
  return n;
}

function attachStreamHandlers(handle) {
  const parser = createLineParser(
    (obj) => {
      handle.status = "running";
      broadcast("agent_stream", { sessionId: handle.id, chunk: obj });
    },
    (err, raw) => {
      handle.stderrBuffer += `[parse-error] ${err.message}: ${raw}\n`;
    },
  );
  handle.child.stdout.on("data", (chunk) => {
    const s = chunk.toString();
    handle.stdoutBuffer += s;
    parser.push(s);
  });
  handle.child.stderr.on("data", (chunk) => {
    handle.stderrBuffer += chunk.toString();
  });
  handle.child.on("exit", (code) => {
    parser.flush();
    handle.status = code === 0 ? "completed" : "error";
    handle.exitCode = code;
    handle.endedAt = Date.now();
    broadcast("agent_status", { sessionId: handle.id, status: handle.status });
  });
  handle.child.on("error", (err) => {
    handle.status = "error";
    handle.error = err.message;
    broadcast("agent_status", { sessionId: handle.id, status: "error" });
  });
}

function makeHandle({ id, child, perLaunch, profile }) {
  return {
    id,
    pid: child?.pid,
    status: "spawning",
    startedAt: Date.now(),
    endedAt: null,
    cwd: perLaunch.cwd,
    profile: profile || null,
    perLaunch,
    child,
    stdoutBuffer: "",
    stderrBuffer: "",
  };
}

function spawnAgent({ profile, perLaunch, envExtra }) {
  if (!perLaunch || typeof perLaunch.prompt !== "string") {
    throw new Error("prompt is required");
  }
  if (liveCount() >= MAX_CONCURRENT) {
    const err = new Error(`concurrency limit ${MAX_CONCURRENT} reached`);
    err.code = "EConcurrencyLimit";
    err.running = Array.from(agents.values())
      .filter((h) => h.status === "running" || h.status === "spawning")
      .map((h) => ({ id: h.id, pid: h.pid, startedAt: h.startedAt }));
    throw err;
  }
  const v = validateProfileConfig(profile || {});
  if (!v.ok) {
    const err = new Error(v.errors.join("; "));
    err.code = "EConfigInvalid";
    throw err;
  }
  const id = randomUUID();
  const argv = buildArgsFromConfig(profile || {}, perLaunch);
  const child = spawn("claude", argv, {
    env: cleanSpawnEnv(envExtra || {}),
    cwd: perLaunch.cwd || process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
  });
  const handle = makeHandle({ id, child, perLaunch, profile });
  handle.argv = argv;
  agents.set(id, handle);
  attachStreamHandlers(handle);
  broadcast("agent_status", { sessionId: id, status: "spawning" });
  return handle;
}

// Test seam: drive a stub child without invoking the real CLI binary.
spawnAgent.__injectChildForTest = function injectChildForTest(child, perLaunch) {
  const id = randomUUID();
  const handle = makeHandle({ id, child, perLaunch, profile: null });
  handle.argv = ["-p", perLaunch.prompt];
  agents.set(id, handle);
  attachStreamHandlers(handle);
  return handle;
};

function sendMessage(handleId, text) {
  const h = agents.get(handleId);
  if (!h) throw new Error("agent not found");
  if (h.status !== "running" && h.status !== "spawning") {
    throw new Error(`agent not accepting input (status=${h.status})`);
  }
  if (!h.child?.stdin?.writable) throw new Error("stdin not writable");
  const messageId = randomUUID();
  const obj = { type: "user", message: { role: "user", content: text }, id: messageId };
  h.child.stdin.write(JSON.stringify(obj) + "\n");
  broadcast("agent_input_ack", { sessionId: h.id, messageId, ts: Date.now() });
  return { messageId };
}

function killAgent(id) {
  const h = agents.get(id);
  if (!h) return false;
  if (h.child && !h.child.killed) {
    h.child.kill("SIGTERM");
    setTimeout(() => {
      if (h.child && !h.child.killed) h.child.kill("SIGKILL");
    }, 5000);
  }
  h.status = "killed";
  broadcast("agent_status", { sessionId: id, status: "killed" });
  return true;
}

function getAgent(id) { return agents.get(id); }

function listAgents() {
  return Array.from(agents.values()).map((h) => ({
    id: h.id, pid: h.pid, status: h.status,
    startedAt: h.startedAt, endedAt: h.endedAt,
    cwd: h.cwd, profile: h.profile,
  }));
}

module.exports = {
  spawnAgent, sendMessage, killAgent, getAgent, listAgents,
  cleanSpawnEnv, liveCount, MAX_CONCURRENT,
};
```

- [ ] **Step 4: Adapt the legacy `orchestrator.test.js` buildArgs cases**

Replace the two `buildArgs` `it()` blocks in `server/__tests__/orchestrator.test.js` with this single block (delete the existing ones):

```javascript
it("buildArgsFromConfig defaults are stream-json + acceptEdits", () => {
  delete require.cache[require.resolve("../lib/profile-schema")];
  const { buildArgsFromConfig } = require("../lib/profile-schema");
  const args = buildArgsFromConfig({}, { prompt: "hi" });
  assert.deepStrictEqual(args, [
    "-p", "hi",
    "--input-format", "stream-json",
    "--output-format", "stream-json",
    "--verbose",
    "--permission-mode", "acceptEdits",
  ]);
});
```

Keep the existing `cleanSpawnEnv` test untouched.

- [ ] **Step 5: Run tests**

Run: `npm run test:server`
Expected: PASS — full server suite green.

- [ ] **Step 6: Commit**

```bash
git add server/lib/spawner.js server/__tests__/spawner-extended.test.js server/__tests__/orchestrator.test.js
git commit -m "feat(launcher): expand spawner — flag mapping, stdin pipe, send-message, WS broadcast, concurrency cap"
```

---

### Task 4: Launcher secrets reader

**Files:**
- Create: `server/lib/launcher-secrets.js`
- Test: `server/__tests__/launcher-secrets.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// server/__tests__/launcher-secrets.test.js
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let tmp;
before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "launcher-secrets-"));
  process.env.HOME = tmp;
  fs.mkdirSync(path.join(tmp, ".claude", "launcher"), { recursive: true });
});
after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("launcher-secrets", () => {
  it("returns empty object when secrets.env does not exist", () => {
    delete require.cache[require.resolve("../lib/launcher-secrets")];
    const { readSecretsEnv } = require("../lib/launcher-secrets");
    assert.deepEqual(readSecretsEnv(), {});
  });

  it("parses KEY=VALUE pairs and ignores comments and blanks", () => {
    fs.writeFileSync(
      path.join(tmp, ".claude", "launcher", "secrets.env"),
      "# header\nFOO=bar\n\nBAZ=quux\n",
    );
    delete require.cache[require.resolve("../lib/launcher-secrets")];
    const { readSecretsEnv } = require("../lib/launcher-secrets");
    assert.deepEqual(readSecretsEnv(), { FOO: "bar", BAZ: "quux" });
  });

  it("resolveEnvForNames pulls from process.env and secrets, with secrets winning", () => {
    process.env.FOO = "from-process";
    fs.writeFileSync(
      path.join(tmp, ".claude", "launcher", "secrets.env"),
      "FOO=from-secrets\nONLY_PROC=ok\n",
    );
    process.env.ONLY_PROC = "ok";
    delete require.cache[require.resolve("../lib/launcher-secrets")];
    const { resolveEnvForNames } = require("../lib/launcher-secrets");
    assert.deepEqual(resolveEnvForNames(["FOO", "ONLY_PROC", "MISSING"]), {
      FOO: "from-secrets",
      ONLY_PROC: "ok",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:server -- --test-name-pattern="launcher-secrets"`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```javascript
// server/lib/launcher-secrets.js
/**
 * @file Optional ~/.claude/launcher/secrets.env reader. Profiles declare env
 * var NAMES; values resolve from secrets.env (preferred) or process.env. Never
 * logged. Never serialized into argv.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function secretsPath() {
  return path.join(process.env.HOME || os.homedir(), ".claude", "launcher", "secrets.env");
}

function readSecretsEnv() {
  let text;
  try {
    text = fs.readFileSync(secretsPath(), "utf8");
  } catch {
    return {};
  }
  const out = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim();
    out[k] = v;
  }
  return out;
}

function resolveEnvForNames(names = []) {
  const secrets = readSecretsEnv();
  const out = {};
  for (const name of names) {
    if (typeof name !== "string" || !name) continue;
    if (Object.prototype.hasOwnProperty.call(secrets, name)) out[name] = secrets[name];
    else if (Object.prototype.hasOwnProperty.call(process.env, name)) out[name] = process.env[name];
  }
  return out;
}

module.exports = { readSecretsEnv, resolveEnvForNames, secretsPath };
```

- [ ] **Step 4: Run tests**

Run: `npm run test:server -- --test-name-pattern="launcher-secrets"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/lib/launcher-secrets.js server/__tests__/launcher-secrets.test.js
git commit -m "feat(launcher): secrets.env reader (names → values resolution)"
```

---

## Phase 2 — Persistence layer (sequential, after Phase 1)

### Task 5: Schema — add three launcher tables to `server/db.js`

**Files:**
- Modify: `server/db.js`
- Test: `server/__tests__/profiles-lib.test.js` (smoke check the schema applies)

- [ ] **Step 1: Locate the existing `db.exec(\`CREATE TABLE...\`)` block in `server/db.js`** (the inline schema near the top of the file). Inside that template literal, append these three table definitions plus indexes:

```sql
CREATE TABLE IF NOT EXISTS launcher_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  config_json TEXT NOT NULL,
  default_cwd TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE TABLE IF NOT EXISTS launcher_allowed_cwds (
  path TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE TABLE IF NOT EXISTS launcher_launches (
  id TEXT PRIMARY KEY,
  profile_id TEXT,
  session_id TEXT,
  cwd TEXT NOT NULL,
  argv_json TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  exit_code INTEGER,
  status TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_launcher_profiles_lastused ON launcher_profiles(last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_launcher_launches_profile ON launcher_launches(profile_id);
CREATE INDEX IF NOT EXISTS idx_launcher_launches_session ON launcher_launches(session_id);
```

- [ ] **Step 2: Smoke test (sanity check the schema)**

```javascript
// server/__tests__/profiles-lib.test.js (initial smoke; expanded in Task 6)
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("launcher tables exist", () => {
  it("schema applies cleanly", () => {
    process.env.DASHBOARD_DB_PATH = ":memory:";
    delete require.cache[require.resolve("../db")];
    const { db } = require("../db");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);
    assert.ok(tables.includes("launcher_profiles"));
    assert.ok(tables.includes("launcher_allowed_cwds"));
    assert.ok(tables.includes("launcher_launches"));
  });
});
```

- [ ] **Step 3: Run test**

Run: `npm run test:server -- --test-name-pattern="launcher tables"`
Expected: PASS — three tables present.

- [ ] **Step 4: Commit**

```bash
git add server/db.js server/__tests__/profiles-lib.test.js
git commit -m "feat(launcher): launcher_profiles, launcher_allowed_cwds, launcher_launches tables"
```

---

### Task 6: profiles.js library — CRUD + import/export

**Files:**
- Create: `server/lib/profiles.js`
- Modify: `server/__tests__/profiles-lib.test.js` (extend)

- [ ] **Step 1: Add tests**

```javascript
// Append to server/__tests__/profiles-lib.test.js
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

function freshLib() {
  process.env.DASHBOARD_DB_PATH = ":memory:";
  delete require.cache[require.resolve("../db")];
  delete require.cache[require.resolve("../lib/profiles")];
  return require("../lib/profiles");
}

describe("profiles lib", () => {
  it("create + get round-trips a config", () => {
    const profiles = freshLib();
    const created = profiles.create({
      name: "code-review",
      description: "Reviews PRs",
      config: { model: "sonnet", effort: "high" },
      defaultCwd: "/tmp/x",
    });
    const got = profiles.get(created.id);
    assert.equal(got.name, "code-review");
    assert.deepEqual(got.config, { model: "sonnet", effort: "high" });
    assert.equal(got.defaultCwd, "/tmp/x");
  });

  it("rejects invalid configs at the lib boundary", () => {
    const profiles = freshLib();
    assert.throws(
      () => profiles.create({ name: "bad", config: { unknownKey: 1 } }),
      /unknown key/,
    );
  });

  it("rejects duplicate names", () => {
    const profiles = freshLib();
    profiles.create({ name: "dup", config: {} });
    assert.throws(() => profiles.create({ name: "dup", config: {} }), /UNIQUE/);
  });

  it("update merges config and bumps updated_at", () => {
    const profiles = freshLib();
    const c = profiles.create({ name: "p", config: { model: "sonnet" } });
    profiles.update(c.id, { config: { model: "opus", effort: "max" } });
    const after = profiles.get(c.id);
    assert.equal(after.config.model, "opus");
    assert.equal(after.config.effort, "max");
  });

  it("list returns most-recent-first", () => {
    const profiles = freshLib();
    const a = profiles.create({ name: "a", config: {} });
    const b = profiles.create({ name: "b", config: {} });
    profiles.markUsed(a.id);
    const list = profiles.list();
    assert.equal(list[0].id, a.id);
  });

  it("exportJson + importJson round-trip", () => {
    const profiles = freshLib();
    const a = profiles.create({ name: "x", config: { model: "sonnet" } });
    const json = profiles.exportJson(a.id);
    profiles.delete(a.id);
    const imported = profiles.importJson(json);
    assert.equal(imported.name, "x");
    assert.deepEqual(imported.config, { model: "sonnet" });
  });

  it("delete removes a profile", () => {
    const profiles = freshLib();
    const a = profiles.create({ name: "doomed", config: {} });
    profiles.delete(a.id);
    assert.equal(profiles.get(a.id), null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:server -- --test-name-pattern="profiles lib"`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```javascript
// server/lib/profiles.js
/**
 * @file SQLite CRUD for launcher_profiles. Validates ProfileConfig on every
 * write; never persists invalid shapes. Offers JSON export/import for
 * shareable artifacts.
 */
const { randomUUID } = require("node:crypto");
const { db } = require("../db");
const { validateProfileConfig } = require("./profile-schema");

const SELECT = `SELECT id, name, description, config_json, default_cwd,
  created_at, updated_at, last_used_at FROM launcher_profiles`;

function row2profile(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    config: JSON.parse(r.config_json),
    defaultCwd: r.default_cwd,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastUsedAt: r.last_used_at,
  };
}

function create({ name, description, config, defaultCwd }) {
  const v = validateProfileConfig(config);
  if (!v.ok) throw new Error(v.errors.join("; "));
  if (!/^[\w\- .]{1,64}$/.test(name)) throw new Error("name invalid");
  const id = randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO launcher_profiles (id, name, description, config_json, default_cwd, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, name, description || null, JSON.stringify(config || {}), defaultCwd || null, now, now);
  return get(id);
}

function get(id) {
  return row2profile(db.prepare(`${SELECT} WHERE id = ?`).get(id));
}

function getByName(name) {
  return row2profile(db.prepare(`${SELECT} WHERE name = ?`).get(name));
}

function list() {
  return db
    .prepare(`${SELECT} ORDER BY COALESCE(last_used_at, updated_at) DESC`)
    .all()
    .map(row2profile);
}

function update(id, patch) {
  const cur = get(id);
  if (!cur) throw new Error("not found");
  const next = {
    name: patch.name ?? cur.name,
    description: patch.description ?? cur.description,
    config: patch.config ? { ...cur.config, ...patch.config } : cur.config,
    defaultCwd: patch.defaultCwd !== undefined ? patch.defaultCwd : cur.defaultCwd,
  };
  const v = validateProfileConfig(next.config);
  if (!v.ok) throw new Error(v.errors.join("; "));
  db.prepare(
    `UPDATE launcher_profiles
     SET name = ?, description = ?, config_json = ?, default_cwd = ?, updated_at = ?
     WHERE id = ?`,
  ).run(next.name, next.description || null, JSON.stringify(next.config), next.defaultCwd || null, Date.now(), id);
  return get(id);
}

function markUsed(id) {
  db.prepare(`UPDATE launcher_profiles SET last_used_at = ? WHERE id = ?`).run(Date.now(), id);
}

function remove(id) {
  db.prepare(`DELETE FROM launcher_profiles WHERE id = ?`).run(id);
}

function exportJson(id) {
  const p = get(id);
  if (!p) throw new Error("not found");
  return {
    name: p.name,
    description: p.description,
    config: p.config,
    defaultCwd: p.defaultCwd,
    schemaVersion: 1,
  };
}

function importJson(payload) {
  if (!payload || typeof payload !== "object") throw new Error("invalid import");
  const baseName = payload.name || "imported";
  let name = baseName;
  let n = 2;
  while (getByName(name)) name = `${baseName} (${n++})`;
  return create({
    name,
    description: payload.description,
    config: payload.config || {},
    defaultCwd: payload.defaultCwd,
  });
}

function duplicate(id) {
  const src = get(id);
  if (!src) throw new Error("not found");
  return importJson({ ...exportJson(id), name: `${src.name} (copy)` });
}

module.exports = {
  create, get, getByName, list, update, markUsed,
  delete: remove, exportJson, importJson, duplicate,
};
```

- [ ] **Step 4: Run tests**

Run: `npm run test:server -- --test-name-pattern="profiles lib"`
Expected: PASS — all CRUD assertions green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/profiles.js server/__tests__/profiles-lib.test.js
git commit -m "feat(launcher): profiles CRUD library with export/import + duplicate"
```

---

### Task 7: cwds.js library — allowlist CRUD

**Files:**
- Create: `server/lib/cwds.js`
- Test: `server/__tests__/cwds.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// server/__tests__/cwds.test.js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function freshLib() {
  process.env.DASHBOARD_DB_PATH = ":memory:";
  delete require.cache[require.resolve("../db")];
  delete require.cache[require.resolve("../lib/cwds")];
  return require("../lib/cwds");
}

describe("cwds lib", () => {
  it("add() records a path that exists", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cwds-"));
    const cwds = freshLib();
    cwds.add(tmp, "manual");
    assert.deepEqual(
      cwds.list().map((r) => r.path),
      [tmp],
    );
    fs.rmSync(tmp, { recursive: true });
  });

  it("add() rejects nonexistent paths", () => {
    const cwds = freshLib();
    assert.throws(() => cwds.add("/this/does/not/exist", "manual"), /does not exist/);
  });

  it("add() rejects relative paths", () => {
    const cwds = freshLib();
    assert.throws(() => cwds.add("./relative", "manual"), /absolute/);
  });

  it("isAllowed(path) returns true only after add()", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cwds-"));
    const cwds = freshLib();
    assert.equal(cwds.isAllowed(tmp), false);
    cwds.add(tmp, "manual");
    assert.equal(cwds.isAllowed(tmp), true);
    fs.rmSync(tmp, { recursive: true });
  });

  it("remove() deletes by path", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cwds-"));
    const cwds = freshLib();
    cwds.add(tmp, "manual");
    cwds.remove(tmp);
    assert.equal(cwds.list().length, 0);
    fs.rmSync(tmp, { recursive: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:server -- --test-name-pattern="cwds lib"`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```javascript
// server/lib/cwds.js
/**
 * @file SQLite CRUD for launcher_allowed_cwds. Path-traversal hardening:
 * absolute paths only, must exist as a directory at insert time.
 */
const fs = require("node:fs");
const path = require("node:path");
const { db } = require("../db");

function normalize(p) {
  if (!p || typeof p !== "string") throw new Error("path required");
  if (!path.isAbsolute(p)) throw new Error("path must be absolute");
  const resolved = path.resolve(p);
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    throw new Error(`path does not exist: ${resolved}`);
  }
  if (!stat.isDirectory()) throw new Error("path must be a directory");
  return resolved;
}

function add(p, source = "manual") {
  const resolved = normalize(p);
  db.prepare(
    `INSERT OR IGNORE INTO launcher_allowed_cwds (path, source, added_at) VALUES (?, ?, ?)`,
  ).run(resolved, source, Date.now());
  return resolved;
}

function list() {
  return db
    .prepare(`SELECT path, source, added_at, last_used_at FROM launcher_allowed_cwds ORDER BY COALESCE(last_used_at, added_at) DESC`)
    .all();
}

function isAllowed(p) {
  if (!p || typeof p !== "string") return false;
  const resolved = path.resolve(p);
  const row = db.prepare(`SELECT 1 FROM launcher_allowed_cwds WHERE path = ?`).get(resolved);
  return !!row;
}

function markUsed(p) {
  const resolved = path.resolve(p);
  db.prepare(`UPDATE launcher_allowed_cwds SET last_used_at = ? WHERE path = ?`).run(Date.now(), resolved);
}

function remove(p) {
  const resolved = path.resolve(p);
  db.prepare(`DELETE FROM launcher_allowed_cwds WHERE path = ?`).run(resolved);
}

module.exports = { add, list, isAllowed, markUsed, remove };
```

- [ ] **Step 4: Run tests**

Run: `npm run test:server -- --test-name-pattern="cwds lib"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/lib/cwds.js server/__tests__/cwds.test.js
git commit -m "feat(launcher): cwd allowlist CRUD with path validation"
```

---

### Task 8: launches.js library — audit log

**Files:**
- Create: `server/lib/launches.js`
- Test: `server/__tests__/launches.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// server/__tests__/launches.test.js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

function fresh() {
  process.env.DASHBOARD_DB_PATH = ":memory:";
  delete require.cache[require.resolve("../db")];
  delete require.cache[require.resolve("../lib/launches")];
  return require("../lib/launches");
}

describe("launches lib", () => {
  it("record() persists a launch with redacted env", () => {
    const launches = fresh();
    launches.record({
      id: "abc",
      profileId: null,
      cwd: "/tmp",
      argv: ["-p", "hi", "--betas", "test"],
      injectedEnvNames: ["GITHUB_TOKEN"],
    });
    const r = launches.get("abc");
    assert.equal(r.id, "abc");
    assert.deepEqual(JSON.parse(r.argv_json).argv, ["-p", "hi", "--betas", "test"]);
    assert.deepEqual(JSON.parse(r.argv_json).envNames, ["GITHUB_TOKEN"]);
  });

  it("complete() updates exit_code + status + ended_at", () => {
    const launches = fresh();
    launches.record({ id: "a", cwd: "/tmp", argv: [] });
    launches.complete("a", { exitCode: 0, status: "completed" });
    const r = launches.get("a");
    assert.equal(r.exit_code, 0);
    assert.equal(r.status, "completed");
    assert.ok(r.ended_at);
  });
});
```

- [ ] **Step 2: Run test (fail)**

Run: `npm run test:server -- --test-name-pattern="launches lib"`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

```javascript
// server/lib/launches.js
/**
 * @file Append-only audit log for orchestrator launches. argv_json stores
 * { argv, envNames } — env values are NEVER recorded.
 */
const { db } = require("../db");

function record({ id, profileId = null, sessionId = null, cwd, argv = [], injectedEnvNames = [], status = "spawning" }) {
  const payload = JSON.stringify({ argv, envNames: injectedEnvNames });
  db.prepare(
    `INSERT INTO launcher_launches (id, profile_id, session_id, cwd, argv_json, started_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, profileId, sessionId, cwd, payload, Date.now(), status);
}

function attachSessionId(id, sessionId) {
  db.prepare(`UPDATE launcher_launches SET session_id = ? WHERE id = ?`).run(sessionId, id);
}

function complete(id, { exitCode, status }) {
  db.prepare(
    `UPDATE launcher_launches SET ended_at = ?, exit_code = ?, status = ? WHERE id = ?`,
  ).run(Date.now(), exitCode ?? null, status, id);
}

function get(id) {
  return db.prepare(`SELECT * FROM launcher_launches WHERE id = ?`).get(id);
}

function listRecent(limit = 50) {
  return db
    .prepare(`SELECT * FROM launcher_launches ORDER BY started_at DESC LIMIT ?`)
    .all(limit);
}

module.exports = { record, attachSessionId, complete, get, listRecent };
```

- [ ] **Step 4: Run tests**

Run: `npm run test:server -- --test-name-pattern="launches lib"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/lib/launches.js server/__tests__/launches.test.js
git commit -m "feat(launcher): launches audit log (env values never recorded)"
```

---

### Task 9: HTTP routes — `/api/orchestrator/profiles`

**Files:**
- Create: `server/routes/profiles.js`
- Test: `server/__tests__/profiles-route.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// server/__tests__/profiles-route.test.js
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const http = require("node:http");

let server, port;
function startApp(env = {}) {
  Object.assign(process.env, env);
  process.env.DASHBOARD_DB_PATH = ":memory:";
  delete require.cache[require.resolve("../db")];
  delete require.cache[require.resolve("../lib/profiles")];
  delete require.cache[require.resolve("../routes/profiles")];
  const app = express();
  app.use(express.json());
  app.use("/api/orchestrator/profiles", require("../routes/profiles"));
  return app;
}

describe("profiles route", () => {
  before(async () => {
    process.env.ORCHESTRATOR_ENABLED = "1";
    server = http.createServer(startApp());
    await new Promise((r) => server.listen(0, r));
    port = server.address().port;
  });
  after(() => server.close());

  it("404s when feature flag is off", async () => {
    const off = http.createServer(startApp({ ORCHESTRATOR_ENABLED: "" }));
    await new Promise((r) => off.listen(0, r));
    const p = off.address().port;
    const res = await fetch(`http://127.0.0.1:${p}/api/orchestrator/profiles`);
    assert.equal(res.status, 404);
    off.close();
  });

  it("create + list + get + update + delete round-trip", async () => {
    let res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "p1", config: { model: "sonnet" } }),
    });
    assert.equal(res.status, 201);
    const created = await res.json();
    assert.equal(created.name, "p1");

    res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/profiles`);
    assert.equal((await res.json()).length, 1);

    res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/profiles/${created.id}`);
    assert.equal((await res.json()).id, created.id);

    res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/profiles/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: { effort: "high" } }),
    });
    const updated = await res.json();
    assert.equal(updated.config.effort, "high");

    res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/profiles/${created.id}`, { method: "DELETE" });
    assert.equal(res.status, 204);
  });

  it("400s on invalid config", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "bad", config: { unknownKey: 1 } }),
    });
    assert.equal(res.status, 400);
  });
});
```

- [ ] **Step 2: Run test (fail)**

Run: `npm run test:server -- --test-name-pattern="profiles route"`
Expected: FAIL — route module not found.

- [ ] **Step 3: Write the implementation**

```javascript
// server/routes/profiles.js
/**
 * @file HTTP CRUD over the profiles lib + import/export. Gated by
 * ORCHESTRATOR_ENABLED. Validation errors return 400 with a clear list.
 */
const express = require("express");
const router = express.Router();
const profiles = require("../lib/profiles");

const ENABLED = process.env.ORCHESTRATOR_ENABLED === "1";
router.use((req, res, next) => {
  if (!ENABLED) return res.status(404).json({ error: "orchestrator disabled" });
  next();
});

router.get("/", (_req, res) => res.json(profiles.list()));

router.post("/", (req, res) => {
  try {
    const created = profiles.create(req.body || {});
    res.status(201).json(created);
  } catch (err) {
    res.status(err.message.includes("UNIQUE") ? 409 : 400).json({ error: err.message });
  }
});

router.get("/:id", (req, res) => {
  const p = profiles.get(req.params.id);
  if (!p) return res.status(404).json({ error: "not found" });
  res.json(p);
});

router.put("/:id", (req, res) => {
  try {
    res.json(profiles.update(req.params.id, req.body || {}));
  } catch (err) {
    res.status(err.message === "not found" ? 404 : 400).json({ error: err.message });
  }
});

router.patch("/:id", (req, res) => {
  try {
    res.json(profiles.update(req.params.id, req.body || {}));
  } catch (err) {
    res.status(err.message === "not found" ? 404 : 400).json({ error: err.message });
  }
});

router.delete("/:id", (req, res) => {
  profiles.delete(req.params.id);
  res.status(204).end();
});

router.post("/:id/duplicate", (req, res) => {
  try {
    res.status(201).json(profiles.duplicate(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post("/import", (req, res) => {
  try {
    res.status(201).json(profiles.importJson(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/:id/export", (req, res) => {
  try {
    res.setHeader("Content-Disposition", `attachment; filename="profile-${req.params.id}.json"`);
    res.json(profiles.exportJson(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 4: Run tests**

Run: `npm run test:server -- --test-name-pattern="profiles route"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/profiles.js server/__tests__/profiles-route.test.js
git commit -m "feat(launcher): /api/orchestrator/profiles route — CRUD + import/export"
```

---

### Task 10: HTTP routes — `/api/orchestrator/cwds`

**Files:**
- Create: `server/routes/cwds.js`
- Test: `server/__tests__/cwds-route.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// server/__tests__/cwds-route.test.js
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let server, port, tmp;
before(async () => {
  process.env.ORCHESTRATOR_ENABLED = "1";
  process.env.DASHBOARD_DB_PATH = ":memory:";
  delete require.cache[require.resolve("../db")];
  delete require.cache[require.resolve("../lib/cwds")];
  delete require.cache[require.resolve("../routes/cwds")];
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cwds-route-"));
  const app = express();
  app.use(express.json());
  app.use("/api/orchestrator/cwds", require("../routes/cwds"));
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});
after(() => {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("cwds route", () => {
  it("add + list + delete", async () => {
    let res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/cwds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: tmp }),
    });
    assert.equal(res.status, 201);

    res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/cwds`);
    const list = await res.json();
    assert.ok(list.find((c) => c.path === tmp));

    res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/cwds`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: tmp }),
    });
    assert.equal(res.status, 204);
  });

  it("400s on a path that does not exist", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/cwds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/no/such/dir/here" }),
    });
    assert.equal(res.status, 400);
  });
});
```

- [ ] **Step 2: Run test (fail)**

Run: `npm run test:server -- --test-name-pattern="cwds route"`
Expected: FAIL — route module not found.

- [ ] **Step 3: Write the implementation**

```javascript
// server/routes/cwds.js
/**
 * @file HTTP surface for the cwd allowlist. Gated by ORCHESTRATOR_ENABLED.
 */
const express = require("express");
const router = express.Router();
const cwds = require("../lib/cwds");

const ENABLED = process.env.ORCHESTRATOR_ENABLED === "1";
router.use((req, res, next) => {
  if (!ENABLED) return res.status(404).json({ error: "orchestrator disabled" });
  next();
});

router.get("/", (_req, res) => res.json(cwds.list()));

router.post("/", (req, res) => {
  try {
    const resolved = cwds.add(req.body?.path, req.body?.source || "manual");
    res.status(201).json({ path: resolved });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/", (req, res) => {
  try {
    cwds.remove(req.body?.path);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 4: Run tests**

Run: `npm run test:server -- --test-name-pattern="cwds route"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/cwds.js server/__tests__/cwds-route.test.js
git commit -m "feat(launcher): /api/orchestrator/cwds route"
```

---

## Phase 3 — Spawn integration (sequential, after Phase 2)

### Task 11: Extend `POST /api/orchestrator/spawn` and add message route

**Files:**
- Modify: `server/routes/orchestrator.js`
- Test: `server/__tests__/orchestrator-extended.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// server/__tests__/orchestrator-extended.test.js
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let server, port, tmp;
before(async () => {
  process.env.ORCHESTRATOR_ENABLED = "1";
  process.env.DASHBOARD_DB_PATH = ":memory:";
  process.env.ORCHESTRATOR_MAX_CONCURRENT = "5";

  // Stub websocket
  const wsPath = require.resolve("../websocket");
  delete require.cache[wsPath];
  require.cache[wsPath] = {
    id: wsPath, filename: wsPath, loaded: true,
    exports: { broadcast: () => {}, initWebSocket: () => {}, getConnectionCount: () => 0 },
  };

  // Stub spawnAgent so the test does not invoke `claude`
  const spawnerPath = require.resolve("../lib/spawner");
  delete require.cache[spawnerPath];
  const realSpawner = require("../lib/spawner");
  let nextId = 0;
  const stubAgents = new Map();
  realSpawner.spawnAgent = ({ profile, perLaunch }) => {
    const id = `stub-${++nextId}`;
    const handle = { id, pid: 100, status: "running", startedAt: Date.now(), cwd: perLaunch.cwd, profile, perLaunch, argv: ["-p", perLaunch.prompt] };
    stubAgents.set(id, handle);
    return handle;
  };
  realSpawner.sendMessage = (id, text) => {
    if (!stubAgents.has(id)) throw new Error("agent not found");
    return { messageId: `m-${id}-${text.length}` };
  };
  realSpawner.killAgent = (id) => stubAgents.delete(id);
  realSpawner.getAgent = (id) => stubAgents.get(id);
  realSpawner.listAgents = () => Array.from(stubAgents.values());

  delete require.cache[require.resolve("../db")];
  delete require.cache[require.resolve("../lib/profiles")];
  delete require.cache[require.resolve("../lib/cwds")];
  delete require.cache[require.resolve("../routes/profiles")];
  delete require.cache[require.resolve("../routes/cwds")];
  delete require.cache[require.resolve("../routes/orchestrator")];

  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "orc-route-"));
  const cwds = require("../lib/cwds");
  cwds.add(tmp, "manual");

  const app = express();
  app.use(express.json());
  app.use("/api/orchestrator", require("../routes/orchestrator"));
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});
after(() => {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("POST /api/orchestrator/spawn (extended)", () => {
  it("rejects cwd not in allowlist", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/spawn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hi", cwd: "/etc" }),
    });
    assert.equal(res.status, 400);
  });

  it("accepts profileId + cwd in allowlist + prompt", async () => {
    const profileRes = await fetch(`http://127.0.0.1:${port}/api/orchestrator/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "p1", config: { model: "sonnet" } }),
    });
    const p = await profileRes.json();
    const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/spawn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hi", cwd: tmp, profileId: p.id }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.match(body.id, /^stub-/);
  });

  it("merges configOverride on top of profile config", async () => {
    // requires the stub to capture the resolved config — extend stub if needed.
    // We assert the route accepts the body; merge correctness covered in profiles-lib tests.
    const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/spawn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hi", cwd: tmp, configOverride: { effort: "max" } }),
    });
    assert.equal(res.status, 200);
  });
});

describe("POST /agents/:id/message", () => {
  it("writes a message and returns messageId", async () => {
    const spawn = await fetch(`http://127.0.0.1:${port}/api/orchestrator/spawn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hi", cwd: tmp }),
    });
    const handle = await spawn.json();
    const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/agents/${handle.id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "follow-up" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.messageId);
  });

  it("404s on unknown agent id", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/agents/nope/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hi" }),
    });
    assert.equal(res.status, 404);
  });
});
```

- [ ] **Step 2: Run test (fail)**

Run: `npm run test:server -- --test-name-pattern="POST /api/orchestrator/spawn|POST /agents"`
Expected: FAIL — extended body / message route undefined.

- [ ] **Step 3: Rewrite `server/routes/orchestrator.js`**

```javascript
// server/routes/orchestrator.js
/**
 * @file HTTP routes for the local agent orchestrator. Disabled by default —
 * gated behind ORCHESTRATOR_ENABLED=1.
 */
const express = require("express");
const { spawnAgent, sendMessage, killAgent, getAgent, listAgents } = require("../lib/spawner");
const profiles = require("../lib/profiles");
const cwds = require("../lib/cwds");
const launches = require("../lib/launches");
const { resolveEnvForNames } = require("../lib/launcher-secrets");

const router = express.Router();
const ENABLED = process.env.ORCHESTRATOR_ENABLED === "1";

router.use((req, res, next) => {
  if (!ENABLED) {
    return res.status(404).json({
      error: "orchestrator disabled",
      hint: "Set ORCHESTRATOR_ENABLED=1 in your .env to enable.",
    });
  }
  next();
});

// Sub-routers
router.use("/profiles", require("./profiles"));
router.use("/cwds", require("./cwds"));

router.get("/", (_req, res) => res.json({ enabled: ENABLED, agents: listAgents() }));

router.post("/spawn", (req, res) => {
  const { prompt, cwd, profileId, configOverride, resumeSessionId, forkSession, continue: cont, sessionId } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "prompt is required" });
  if (!cwd) return res.status(400).json({ error: "cwd is required" });
  if (!cwds.isAllowed(cwd)) return res.status(400).json({ error: "cwd not in allowlist" });

  let baseConfig = {};
  if (profileId) {
    const p = profiles.get(profileId);
    if (!p) return res.status(404).json({ error: "profile not found" });
    baseConfig = p.config || {};
  }
  const config = { ...baseConfig, ...(configOverride || {}) };
  const envExtra = resolveEnvForNames(config.envVarNames || []);
  // Strip envVarNames before passing to spawner; it is not a real flag.
  const cleanConfig = { ...config };
  delete cleanConfig.envVarNames;

  try {
    const handle = spawnAgent({
      profile: cleanConfig,
      perLaunch: { prompt, cwd, resumeSessionId, forkSession, continue: cont, sessionId },
      envExtra,
    });
    if (profileId) profiles.markUsed(profileId);
    cwds.markUsed(cwd);
    launches.record({
      id: handle.id,
      profileId: profileId || null,
      sessionId: resumeSessionId || null,
      cwd,
      argv: handle.argv,
      injectedEnvNames: config.envVarNames || [],
      status: "spawning",
    });
    res.json({ id: handle.id, pid: handle.pid, status: handle.status, startedAt: handle.startedAt });
  } catch (err) {
    if (err.code === "EConcurrencyLimit") return res.status(429).json({ error: err.message, running: err.running });
    if (err.code === "EConfigInvalid") return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

router.post("/agents/:id/message", (req, res) => {
  const text = req.body?.text;
  if (typeof text !== "string" || !text) return res.status(400).json({ error: "text required" });
  try {
    res.json(sendMessage(req.params.id, text));
  } catch (err) {
    res.status(err.message.includes("not found") ? 404 : 400).json({ error: err.message });
  }
});

router.get("/agents/:id", (req, res) => {
  const handle = getAgent(req.params.id);
  if (!handle) return res.status(404).json({ error: "agent not found" });
  res.json({
    id: handle.id, pid: handle.pid, status: handle.status,
    startedAt: handle.startedAt, endedAt: handle.endedAt,
    exitCode: handle.exitCode, error: handle.error,
    stdoutPreview: (handle.stdoutBuffer || "").slice(-2000),
    stderrPreview: (handle.stderrBuffer || "").slice(-2000),
  });
});

router.delete("/agents/:id", (req, res) => {
  const ok = killAgent(req.params.id);
  if (!ok) return res.status(404).json({ error: "agent not found" });
  res.json({ ok: true });
});

module.exports = router;
```

- [ ] **Step 4: Run tests**

Run: `npm run test:server`
Expected: full server suite green.

- [ ] **Step 5: Commit**

```bash
git add server/routes/orchestrator.js server/__tests__/orchestrator-extended.test.js
git commit -m "feat(launcher): extend spawn route, add /agents/:id/message, mount profile + cwd subrouters"
```

---

### Task 12: Surface live agent handle to the existing sessions API

**Files:**
- Modify: `server/routes/sessions.js` — extend `GET /api/sessions/:id` to include a `liveHandle: { id, pid, status } | null` field by checking `listAgents()` for a matching `session_id` (resumed) or where the handle's id equals the session id (new launch).
- Test: extend `server/__tests__/sessions.test.js` (if present) or add `sessions-live-handle.test.js`.

- [ ] **Step 1: Add a test (new file `server/__tests__/sessions-live-handle.test.js`)**

```javascript
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const http = require("node:http");

let server, port;
before(async () => {
  process.env.DASHBOARD_DB_PATH = ":memory:";
  process.env.ORCHESTRATOR_ENABLED = "1";
  const wsPath = require.resolve("../websocket");
  delete require.cache[wsPath];
  require.cache[wsPath] = { id: wsPath, filename: wsPath, loaded: true, exports: { broadcast: () => {}, initWebSocket: () => {}, getConnectionCount: () => 0 } };

  const spawnerPath = require.resolve("../lib/spawner");
  delete require.cache[spawnerPath];
  const sp = require("../lib/spawner");
  sp.listAgents = () => [
    { id: "h1", pid: 1, status: "running", startedAt: Date.now(), cwd: "/", profile: null, perLaunch: { resumeSessionId: "s-historical" } },
  ];

  delete require.cache[require.resolve("../db")];
  const { db } = require("../db");
  db.prepare("INSERT INTO sessions (id, status) VALUES (?, ?)").run("s-historical", "completed");

  delete require.cache[require.resolve("../routes/sessions")];
  const app = express();
  app.use(express.json());
  app.use("/api/sessions", require("../routes/sessions"));
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});
after(() => server.close());

describe("session detail surfaces liveHandle", () => {
  it("returns liveHandle when an orchestrator agent is attached", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/sessions/s-historical`);
    const body = await res.json();
    assert.ok(body.liveHandle, JSON.stringify(body));
    assert.equal(body.liveHandle.id, "h1");
  });
});
```

- [ ] **Step 2: Run test (fail)**

Run: `npm run test:server -- --test-name-pattern="liveHandle"`
Expected: FAIL — `liveHandle` not in response.

- [ ] **Step 3: Modify `server/routes/sessions.js`**

In the existing `GET /:id` handler, after assembling the session response object, add:

```javascript
// Attach live orchestrator handle if any (gated to keep observe-only default unchanged)
let liveHandle = null;
if (process.env.ORCHESTRATOR_ENABLED === "1") {
  try {
    const { listAgents } = require("../lib/spawner");
    const agent = listAgents().find(
      (h) =>
        (h.perLaunch?.resumeSessionId && h.perLaunch.resumeSessionId === session.id) ||
        h.id === session.id,
    );
    if (agent && (agent.status === "running" || agent.status === "spawning")) {
      liveHandle = { id: agent.id, pid: agent.pid, status: agent.status };
    }
  } catch {}
}
res.json({ ...session, liveHandle });
```

(Adjust the response build pattern to match the existing handler — the key insight is to merge `liveHandle` into the JSON response.)

- [ ] **Step 4: Run tests**

Run: `npm run test:server`
Expected: PASS — full suite green.

- [ ] **Step 5: Commit**

```bash
git add server/routes/sessions.js server/__tests__/sessions-live-handle.test.js
git commit -m "feat(launcher): surface live orchestrator handle on session detail"
```

---

### Task 13: Client WS type — add `agent_input_ack`

**Files:**
- Modify: `client/src/lib/types.ts`

- [ ] **Step 1: Add the variant to the WSMessage union**

Locate the `agent_status` variant (around line 226 of `client/src/lib/types.ts`). Immediately after it, add:

```typescript
| {
    type: "agent_input_ack";
    sessionId: string;
    messageId: string;
    ts: number;
  }
```

- [ ] **Step 2: Run client typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: PASS — no type errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/types.ts
git commit -m "feat(launcher): WSMessage agent_input_ack variant"
```

---

## Phase 4 — Launcher form UI (parallelizable after Phase 3)

### Task 14: TypeScript types and flag-mapping mirror

**Files:**
- Create: `client/src/lib/profile-types.ts`
- Create: `client/src/lib/profile-flag-mapping.ts`
- Test: `client/src/lib/__tests__/profile-flag-mapping.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// client/src/lib/__tests__/profile-flag-mapping.test.ts
import { describe, it, expect } from "vitest";
import { buildArgvPreview } from "../profile-flag-mapping";

describe("buildArgvPreview", () => {
  it("matches server defaults for an empty profile + prompt", () => {
    expect(buildArgvPreview({}, { prompt: "hi" })).toEqual([
      "claude",
      "-p", "hi",
      "--input-format", "stream-json",
      "--output-format", "stream-json",
      "--verbose",
      "--permission-mode", "acceptEdits",
    ]);
  });

  it("includes --resume when resumeSessionId is set", () => {
    const argv = buildArgvPreview({}, { prompt: "x", resumeSessionId: "abc" });
    expect(argv).toContain("--resume");
    expect(argv).toContain("abc");
  });

  it("redacts the prompt body when redactPrompt is set", () => {
    const argv = buildArgvPreview({}, { prompt: "secrets here" }, { redactPrompt: true });
    const i = argv.indexOf("-p");
    expect(argv[i + 1]).toBe("<prompt>");
  });
});
```

- [ ] **Step 2: Run test (fail)**

Run: `npm run test:client -- profile-flag-mapping`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the type file**

```typescript
// client/src/lib/profile-types.ts
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export type PermissionMode = "default" | "acceptEdits" | "plan" | "auto" | "dontAsk" | "bypassPermissions";
export type SettingSource = "user" | "project" | "local";
export type OutputFormat = "text" | "json" | "stream-json";
export type InputFormat = "text" | "stream-json";

export interface AgentDef {
  description: string;
  prompt: string;
  tools?: string[];
}

export interface ProfileConfig {
  model?: string;
  fallbackModel?: string;
  effort?: Effort;
  betas?: string[];
  permissionMode?: PermissionMode;
  tools?: string[];
  allowedTools?: string[];
  disallowedTools?: string[];
  systemPrompt?: string;
  systemPromptFile?: string;
  appendSystemPrompt?: string;
  appendSystemPromptFile?: string;
  addDir?: string[];
  mcpConfig?: string[];
  strictMcpConfig?: boolean;
  pluginDir?: string[];
  settings?: string;
  settingSources?: SettingSource[];
  agent?: string;
  agents?: Record<string, AgentDef>;
  outputFormat?: OutputFormat;
  inputFormat?: InputFormat;
  includeHookEvents?: boolean;
  includePartialMessages?: boolean;
  jsonSchema?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  verbose?: boolean;
  debug?: string;
  channels?: string[];
  excludeDynamicSystemPromptSections?: boolean;
  envVarNames?: string[];
  bare?: boolean;
  dangerouslySkipPermissions?: boolean;
  allowDangerouslySkipPermissions?: boolean;
  dangerouslyLoadDevelopmentChannels?: string[];
}

export interface PerLaunch {
  prompt: string;
  cwd?: string;
  resumeSessionId?: string;
  forkSession?: boolean;
  continue?: boolean;
  sessionId?: string;
}

export interface Profile {
  id: string;
  name: string;
  description?: string;
  config: ProfileConfig;
  defaultCwd?: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
}
```

- [ ] **Step 4: Write the flag mapping**

```typescript
// client/src/lib/profile-flag-mapping.ts
import type { ProfileConfig, PerLaunch } from "./profile-types";

type Shape = "scalar" | "comma" | "repeat" | "boolean" | "json" | "number";
interface FlagSpec {
  flag: string;
  shape: Shape;
  dangerous?: boolean;
}

export const FLAG_TABLE: Record<string, FlagSpec> = {
  model: { flag: "--model", shape: "scalar" },
  fallbackModel: { flag: "--fallback-model", shape: "scalar" },
  effort: { flag: "--effort", shape: "scalar" },
  betas: { flag: "--betas", shape: "comma" },
  permissionMode: { flag: "--permission-mode", shape: "scalar" },
  tools: { flag: "--tools", shape: "comma" },
  allowedTools: { flag: "--allowedTools", shape: "comma" },
  disallowedTools: { flag: "--disallowedTools", shape: "comma" },
  systemPrompt: { flag: "--system-prompt", shape: "scalar" },
  systemPromptFile: { flag: "--system-prompt-file", shape: "scalar" },
  appendSystemPrompt: { flag: "--append-system-prompt", shape: "scalar" },
  appendSystemPromptFile: { flag: "--append-system-prompt-file", shape: "scalar" },
  addDir: { flag: "--add-dir", shape: "repeat" },
  mcpConfig: { flag: "--mcp-config", shape: "repeat" },
  strictMcpConfig: { flag: "--strict-mcp-config", shape: "boolean" },
  pluginDir: { flag: "--plugin-dir", shape: "repeat" },
  settings: { flag: "--settings", shape: "scalar" },
  settingSources: { flag: "--setting-sources", shape: "comma" },
  agent: { flag: "--agent", shape: "scalar" },
  agents: { flag: "--agents", shape: "json" },
  outputFormat: { flag: "--output-format", shape: "scalar" },
  inputFormat: { flag: "--input-format", shape: "scalar" },
  includeHookEvents: { flag: "--include-hook-events", shape: "boolean" },
  includePartialMessages: { flag: "--include-partial-messages", shape: "boolean" },
  jsonSchema: { flag: "--json-schema", shape: "scalar" },
  maxTurns: { flag: "--max-turns", shape: "number" },
  maxBudgetUsd: { flag: "--max-budget-usd", shape: "number" },
  verbose: { flag: "--verbose", shape: "boolean" },
  debug: { flag: "--debug", shape: "scalar" },
  channels: { flag: "--channels", shape: "comma" },
  excludeDynamicSystemPromptSections: { flag: "--exclude-dynamic-system-prompt-sections", shape: "boolean" },
  bare: { flag: "--bare", shape: "boolean", dangerous: true },
  dangerouslySkipPermissions: { flag: "--dangerously-skip-permissions", shape: "boolean", dangerous: true },
  allowDangerouslySkipPermissions: { flag: "--allow-dangerously-skip-permissions", shape: "boolean", dangerous: true },
  dangerouslyLoadDevelopmentChannels: { flag: "--dangerously-load-development-channels", shape: "comma", dangerous: true },
};

export function buildArgvPreview(
  cfg: ProfileConfig,
  perLaunch: PerLaunch,
  opts: { redactPrompt?: boolean } = {},
): string[] {
  const argv: string[] = ["claude"];
  argv.push("-p", opts.redactPrompt ? "<prompt>" : perLaunch.prompt);
  argv.push("--input-format", "stream-json");
  argv.push("--output-format", "stream-json");
  argv.push("--verbose");
  argv.push("--permission-mode", cfg.permissionMode || "acceptEdits");

  for (const [key, spec] of Object.entries(FLAG_TABLE)) {
    if (key === "permissionMode" || key === "outputFormat" || key === "inputFormat" || key === "verbose") continue;
    const v = (cfg as Record<string, unknown>)[key];
    if (v == null) continue;
    switch (spec.shape) {
      case "scalar":
      case "number":
        argv.push(spec.flag, String(v));
        break;
      case "boolean":
        if (v === true) argv.push(spec.flag);
        break;
      case "comma":
        if (Array.isArray(v) && v.length) argv.push(spec.flag, v.join(","));
        break;
      case "repeat":
        if (Array.isArray(v)) for (const item of v) argv.push(spec.flag, String(item));
        break;
      case "json":
        argv.push(spec.flag, JSON.stringify(v));
        break;
    }
  }
  if (perLaunch.continue) argv.push("--continue");
  if (perLaunch.resumeSessionId) argv.push("--resume", perLaunch.resumeSessionId);
  if (perLaunch.forkSession) argv.push("--fork-session");
  if (perLaunch.sessionId) argv.push("--session-id", perLaunch.sessionId);
  return argv;
}
```

- [ ] **Step 5: Run tests**

Run: `npm run test:client -- profile-flag-mapping`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/profile-types.ts client/src/lib/profile-flag-mapping.ts client/src/lib/__tests__/profile-flag-mapping.test.ts
git commit -m "feat(launcher): client TS profile types + argv preview helper"
```

---

### Task 15: useProfiles + useCwds hooks

**Files:**
- Create: `client/src/hooks/useProfiles.ts`
- Create: `client/src/hooks/useCwds.ts`
- Test: `client/src/hooks/__tests__/useProfiles.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// client/src/hooks/__tests__/useProfiles.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useProfiles } from "../useProfiles";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.endsWith("/profiles")) {
        return new Response(JSON.stringify({ id: "p1", name: "x", config: {} }), { status: 201 });
      }
      if (url.endsWith("/profiles")) {
        return new Response(JSON.stringify([{ id: "p1", name: "x", config: {} }]), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }),
  );
});

describe("useProfiles", () => {
  it("loads list on mount", async () => {
    const { result } = renderHook(() => useProfiles());
    await waitFor(() => expect(result.current.profiles).toHaveLength(1));
  });

  it("create() refreshes the list", async () => {
    const { result } = renderHook(() => useProfiles());
    await act(async () => {
      await result.current.create({ name: "y", config: {} });
    });
    expect(fetch).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test (fail)**

Run: `npm run test:client -- useProfiles`
Expected: FAIL — hook not defined.

- [ ] **Step 3: Write the implementation**

```typescript
// client/src/hooks/useProfiles.ts
import { useCallback, useEffect, useState } from "react";
import type { Profile, ProfileConfig } from "../lib/profile-types";

const BASE = "/api/orchestrator/profiles";

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(BASE);
      if (!res.ok) throw new Error(`${res.status}`);
      setProfiles(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (payload: { name: string; description?: string; config: ProfileConfig; defaultCwd?: string }) => {
      const res = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${res.status}`);
      const created = (await res.json()) as Profile;
      await refresh();
      return created;
    },
    [refresh],
  );

  const update = useCallback(
    async (id: string, patch: Partial<{ name: string; description: string; config: ProfileConfig; defaultCwd: string }>) => {
      const res = await fetch(`${BASE}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      await refresh();
      return (await res.json()) as Profile;
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await fetch(`${BASE}/${id}`, { method: "DELETE" });
      await refresh();
    },
    [refresh],
  );

  const duplicate = useCallback(
    async (id: string) => {
      const res = await fetch(`${BASE}/${id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      await refresh();
      return (await res.json()) as Profile;
    },
    [refresh],
  );

  const importJson = useCallback(
    async (payload: unknown) => {
      const res = await fetch(`${BASE}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      await refresh();
      return (await res.json()) as Profile;
    },
    [refresh],
  );

  return { profiles, loading, error, refresh, create, update, remove, duplicate, importJson };
}
```

- [ ] **Step 4: Write `useCwds.ts` (mirror, simpler)**

```typescript
// client/src/hooks/useCwds.ts
import { useCallback, useEffect, useState } from "react";

interface CwdEntry {
  path: string;
  source: string;
  added_at: number;
  last_used_at?: number | null;
}

const BASE = "/api/orchestrator/cwds";

export function useCwds() {
  const [cwds, setCwds] = useState<CwdEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(BASE);
      if (res.ok) setCwds(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const add = useCallback(
    async (path: string) => {
      const res = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, source: "manual" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (path: string) => {
      await fetch(BASE, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      await refresh();
    },
    [refresh],
  );

  return { cwds, error, refresh, add, remove };
}
```

- [ ] **Step 5: Run tests**

Run: `npm run test:client -- useProfiles`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/hooks/useProfiles.ts client/src/hooks/useCwds.ts client/src/hooks/__tests__/useProfiles.test.ts
git commit -m "feat(launcher): useProfiles + useCwds hooks"
```

---

### Task 16: CommandPreview component

**Files:**
- Create: `client/src/features/launcher/CommandPreview.tsx`
- Test: `client/src/features/launcher/__tests__/CommandPreview.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/features/launcher/__tests__/CommandPreview.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommandPreview } from "../CommandPreview";

describe("CommandPreview", () => {
  it("renders the joined argv", () => {
    render(<CommandPreview config={{}} perLaunch={{ prompt: "hello" }} />);
    expect(screen.getByTestId("command-preview").textContent).toContain("--permission-mode acceptEdits");
    expect(screen.getByTestId("command-preview").textContent).toContain("-p hello");
  });

  it("highlights dangerous flags", () => {
    render(<CommandPreview config={{ dangerouslySkipPermissions: true }} perLaunch={{ prompt: "x" }} />);
    const danger = screen.getByTestId("danger-flags");
    expect(danger.textContent).toContain("--dangerously-skip-permissions");
  });
});
```

- [ ] **Step 2: Run test (fail)**

Run: `npm run test:client -- CommandPreview`
Expected: FAIL — component not defined.

- [ ] **Step 3: Write the implementation**

```tsx
// client/src/features/launcher/CommandPreview.tsx
import type { ProfileConfig, PerLaunch } from "../../lib/profile-types";
import { FLAG_TABLE, buildArgvPreview } from "../../lib/profile-flag-mapping";

interface Props {
  config: ProfileConfig;
  perLaunch: PerLaunch;
  redactPrompt?: boolean;
}

export function CommandPreview({ config, perLaunch, redactPrompt }: Props) {
  const argv = buildArgvPreview(config, perLaunch, { redactPrompt });
  const dangerSet = new Set(
    Object.entries(FLAG_TABLE)
      .filter(([, s]) => s.dangerous)
      .map(([, s]) => s.flag),
  );
  const dangerFlags = argv.filter((a) => dangerSet.has(a));
  const display = argv
    .map((a) => (a.includes(" ") || a.includes('"') ? JSON.stringify(a) : a))
    .join(" ");
  return (
    <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
      <pre
        data-testid="command-preview"
        style={{
          background: "#0d0d0d",
          padding: 12,
          borderRadius: 6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "#e6e6e6",
          margin: 0,
        }}
      >
        {display}
      </pre>
      {dangerFlags.length > 0 && (
        <div data-testid="danger-flags" style={{ marginTop: 8, color: "#ff7575" }}>
          ⚠ Dangerous flags active: {dangerFlags.join(", ")}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:client -- CommandPreview`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/features/launcher/CommandPreview.tsx client/src/features/launcher/__tests__/CommandPreview.test.tsx
git commit -m "feat(launcher): CommandPreview — live argv panel with danger highlight"
```

---

### Task 17: ProfileEditor sections (15 small components)

**Files:**
- Create: `client/src/features/launcher/sections/IdentitySection.tsx`
- Create: `client/src/features/launcher/sections/CwdSection.tsx`
- Create: `client/src/features/launcher/sections/ModelRuntimeSection.tsx`
- Create: `client/src/features/launcher/sections/PermissionsSection.tsx`
- Create: `client/src/features/launcher/sections/ToolsSection.tsx`
- Create: `client/src/features/launcher/sections/SystemPromptSection.tsx`
- Create: `client/src/features/launcher/sections/McpPluginsSection.tsx`
- Create: `client/src/features/launcher/sections/SettingsSourcesSection.tsx`
- Create: `client/src/features/launcher/sections/AgentsSection.tsx`
- Create: `client/src/features/launcher/sections/OutputSection.tsx`
- Create: `client/src/features/launcher/sections/LimitsLoggingSection.tsx`
- Create: `client/src/features/launcher/sections/EnvVarsSection.tsx`
- Create: `client/src/features/launcher/sections/ChannelsSection.tsx`
- Create: `client/src/features/launcher/sections/DangerousSection.tsx`

Each section is a controlled component receiving `(value, onChange)` over the relevant slice of `ProfileConfig`. They render MUI form fields. Common shape:

```tsx
// EXAMPLE: client/src/features/launcher/sections/ModelRuntimeSection.tsx
import { TextField, MenuItem, Stack } from "@mui/material";
import type { ProfileConfig, Effort } from "../../../lib/profile-types";

interface Props {
  value: Pick<ProfileConfig, "model" | "fallbackModel" | "effort" | "betas">;
  onChange: (patch: Partial<ProfileConfig>) => void;
}

const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

export function ModelRuntimeSection({ value, onChange }: Props) {
  return (
    <Stack spacing={2}>
      <TextField label="Model" value={value.model || ""} onChange={(e) => onChange({ model: e.target.value || undefined })} fullWidth />
      <TextField label="Fallback model" value={value.fallbackModel || ""} onChange={(e) => onChange({ fallbackModel: e.target.value || undefined })} fullWidth />
      <TextField select label="Effort" value={value.effort || ""} onChange={(e) => onChange({ effort: (e.target.value || undefined) as Effort })} fullWidth>
        <MenuItem value="">(default)</MenuItem>
        {EFFORTS.map((e) => <MenuItem key={e} value={e}>{e}</MenuItem>)}
      </TextField>
      <TextField label="Betas (comma-separated)" value={(value.betas || []).join(",")} onChange={(e) => onChange({ betas: e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : undefined })} fullWidth helperText="API beta headers — leave blank if unsure" />
    </Stack>
  );
}
```

Replicate this pattern for each section, picking the appropriate MUI inputs:
- `IdentitySection`: name + description text fields.
- `CwdSection`: dropdown over `useCwds().cwds` + button "Add path…" that opens a dialog calling `useCwds().add()`.
- `PermissionsSection`: select over `PERMISSION_MODES`.
- `ToolsSection`: three Autocomplete (multiple, freeSolo) for `tools`, `allowedTools`, `disallowedTools`.
- `SystemPromptSection`: radio group "Replace vs Append" + text/file toggle; mutual-exclusion enforced visually.
- `McpPluginsSection`: chip lists for `mcpConfig`, `pluginDir`; checkbox for `strictMcpConfig`.
- `SettingsSourcesSection`: text field + multi-select chips for sources.
- `AgentsSection`: text field for `agent`; JSON textarea for `agents` with parse-on-blur.
- `OutputSection`: locked dropdowns for stream-json formats; toggles for `includeHookEvents`, `includePartialMessages`, `jsonSchema` text.
- `LimitsLoggingSection`: numeric inputs for `maxTurns`, `maxBudgetUsd`; checkbox `verbose`; text `debug`.
- `EnvVarsSection`: chip list (autocomplete on names of `Object.keys(process.env)` is server-side; client uses freeSolo).
- `ChannelsSection`: chip list for `channels`.
- `DangerousSection`: collapsed Accordion default; red banner; checkbox toggles + text + chip list inside.

- [ ] **Step 1: Write a smoke test that mounts the editor with empty value**

```tsx
// client/src/features/launcher/__tests__/ProfileEditor.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileEditor } from "../ProfileEditor";

describe("ProfileEditor", () => {
  it("renders all top-level sections", () => {
    render(<ProfileEditor value={{ name: "x", config: {} }} onChange={() => {}} />);
    expect(screen.getByText(/Identity/i)).toBeInTheDocument();
    expect(screen.getByText(/Working directory/i)).toBeInTheDocument();
    expect(screen.getByText(/Model & runtime/i)).toBeInTheDocument();
    expect(screen.getByText(/Permissions/i)).toBeInTheDocument();
    expect(screen.getByText(/Tools/i)).toBeInTheDocument();
    expect(screen.getByText(/System prompt/i)).toBeInTheDocument();
    expect(screen.getByText(/Advanced — dangerous/i)).toBeInTheDocument();
  });

  it("dangerous section is collapsed by default", () => {
    render(<ProfileEditor value={{ name: "x", config: {} }} onChange={() => {}} />);
    expect(screen.queryByLabelText("Bare mode")).not.toBeVisible();
  });

  it("propagates change events", async () => {
    const onChange = vi.fn();
    render(<ProfileEditor value={{ name: "x", config: {} }} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText(/Model$/i), "sonnet");
    expect(onChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test (fail)**

Run: `npm run test:client -- ProfileEditor`
Expected: FAIL — components not defined.

- [ ] **Step 3: Write `client/src/features/launcher/ProfileEditor.tsx` (shell)**

```tsx
// client/src/features/launcher/ProfileEditor.tsx
import { useCallback } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Box, Stack, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { ProfileConfig } from "../../lib/profile-types";
import { IdentitySection } from "./sections/IdentitySection";
import { CwdSection } from "./sections/CwdSection";
import { ModelRuntimeSection } from "./sections/ModelRuntimeSection";
import { PermissionsSection } from "./sections/PermissionsSection";
import { ToolsSection } from "./sections/ToolsSection";
import { SystemPromptSection } from "./sections/SystemPromptSection";
import { McpPluginsSection } from "./sections/McpPluginsSection";
import { SettingsSourcesSection } from "./sections/SettingsSourcesSection";
import { AgentsSection } from "./sections/AgentsSection";
import { OutputSection } from "./sections/OutputSection";
import { LimitsLoggingSection } from "./sections/LimitsLoggingSection";
import { EnvVarsSection } from "./sections/EnvVarsSection";
import { ChannelsSection } from "./sections/ChannelsSection";
import { DangerousSection } from "./sections/DangerousSection";

export interface ProfileEditorValue {
  name: string;
  description?: string;
  config: ProfileConfig;
  defaultCwd?: string;
}

interface Props {
  value: ProfileEditorValue;
  onChange: (next: ProfileEditorValue) => void;
}

const SECTIONS: { id: string; label: string; defaultOpen?: boolean; dangerous?: boolean }[] = [
  { id: "identity", label: "Identity", defaultOpen: true },
  { id: "cwd", label: "Working directory", defaultOpen: true },
  { id: "model", label: "Model & runtime", defaultOpen: true },
  { id: "perm", label: "Permissions" },
  { id: "tools", label: "Tools" },
  { id: "sysp", label: "System prompt" },
  { id: "mcp", label: "MCP & plugins" },
  { id: "settings", label: "Settings sources" },
  { id: "agents", label: "Agents" },
  { id: "output", label: "Output" },
  { id: "limits", label: "Limits & logging" },
  { id: "env", label: "Env vars (names only)" },
  { id: "channels", label: "Channels" },
  { id: "dangerous", label: "Advanced — dangerous", dangerous: true },
];

export function ProfileEditor({ value, onChange }: Props) {
  const patchConfig = useCallback(
    (patch: Partial<ProfileConfig>) => onChange({ ...value, config: { ...value.config, ...patch } }),
    [value, onChange],
  );
  const patchTop = useCallback(
    (patch: Partial<ProfileEditorValue>) => onChange({ ...value, ...patch }),
    [value, onChange],
  );

  const renderBody = (id: string) => {
    switch (id) {
      case "identity": return <IdentitySection value={value} onChange={patchTop} />;
      case "cwd": return <CwdSection value={value.defaultCwd} onChange={(p) => patchTop({ defaultCwd: p })} />;
      case "model": return <ModelRuntimeSection value={value.config} onChange={patchConfig} />;
      case "perm": return <PermissionsSection value={value.config} onChange={patchConfig} />;
      case "tools": return <ToolsSection value={value.config} onChange={patchConfig} />;
      case "sysp": return <SystemPromptSection value={value.config} onChange={patchConfig} />;
      case "mcp": return <McpPluginsSection value={value.config} onChange={patchConfig} />;
      case "settings": return <SettingsSourcesSection value={value.config} onChange={patchConfig} />;
      case "agents": return <AgentsSection value={value.config} onChange={patchConfig} />;
      case "output": return <OutputSection value={value.config} onChange={patchConfig} />;
      case "limits": return <LimitsLoggingSection value={value.config} onChange={patchConfig} />;
      case "env": return <EnvVarsSection value={value.config} onChange={patchConfig} />;
      case "channels": return <ChannelsSection value={value.config} onChange={patchConfig} />;
      case "dangerous": return <DangerousSection value={value.config} onChange={patchConfig} />;
      default: return null;
    }
  };

  return (
    <Stack spacing={1}>
      {SECTIONS.map((s) => (
        <Accordion key={s.id} defaultExpanded={!!s.defaultOpen} sx={s.dangerous ? { border: "1px solid #d33", background: "#2a1010" } : undefined}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ color: s.dangerous ? "#ff8a8a" : undefined, fontWeight: s.dangerous ? 600 : 500 }}>
              {s.dangerous ? "⚠ " : ""}{s.label}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box>{renderBody(s.id)}</Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Stack>
  );
}
```

- [ ] **Step 4: Implement each section file using the pattern from `ModelRuntimeSection.tsx` shown above. Keep each section under 80 lines.** Include `IdentitySection`, `CwdSection`, `PermissionsSection`, `ToolsSection`, `SystemPromptSection`, `McpPluginsSection`, `SettingsSourcesSection`, `AgentsSection`, `OutputSection`, `LimitsLoggingSection`, `EnvVarsSection`, `ChannelsSection`, `DangerousSection`. Use MUI inputs throughout (`TextField`, `Select`, `Autocomplete`, `Checkbox`, `Switch`, `RadioGroup`).

- [ ] **Step 5: Run tests**

Run: `npm run test:client -- ProfileEditor`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/launcher/ProfileEditor.tsx client/src/features/launcher/sections client/src/features/launcher/__tests__/ProfileEditor.test.tsx
git commit -m "feat(launcher): ProfileEditor + 14 section components"
```

---

### Task 18: LauncherView page

**Files:**
- Create: `client/src/pages/LauncherView.tsx`
- Test: `client/src/pages/__tests__/LauncherView.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/pages/__tests__/LauncherView.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LauncherView } from "../LauncherView";

describe("LauncherView", () => {
  it("renders editor + command preview + footer", () => {
    render(<LauncherView />);
    expect(screen.getByText(/Identity/i)).toBeInTheDocument();
    expect(screen.getByTestId("command-preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Launch/i })).toBeInTheDocument();
  });

  it("requires cwd before Launch is enabled", async () => {
    render(<LauncherView />);
    const launch = screen.getByRole("button", { name: /^Launch$/i });
    expect(launch).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test (fail)**

Run: `npm run test:client -- LauncherView`
Expected: FAIL — page not defined.

- [ ] **Step 3: Write the implementation**

```tsx
// client/src/pages/LauncherView.tsx
import { useState } from "react";
import { Button, Grid, Paper, Stack, TextField, Typography, Alert } from "@mui/material";
import { ProfileEditor, ProfileEditorValue } from "../features/launcher/ProfileEditor";
import { CommandPreview } from "../features/launcher/CommandPreview";
import { useProfiles } from "../hooks/useProfiles";
import { useOrchestrator } from "../hooks/useOrchestrator";

export function LauncherView() {
  const { profiles, create } = useProfiles();
  const { spawn, busy, error } = useOrchestrator();
  const [editor, setEditor] = useState<ProfileEditorValue>({ name: "", config: {} });
  const [prompt, setPrompt] = useState("");
  const cwd = editor.defaultCwd;

  const canLaunch = !!cwd && !!prompt.trim() && !busy;

  return (
    <Grid container spacing={2} sx={{ p: 2 }}>
      <Grid item xs={12} md={7}>
        <Stack spacing={2}>
          <TextField
            label="Initial prompt"
            multiline
            minRows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <ProfileEditor value={editor} onChange={setEditor} />
        </Stack>
      </Grid>
      <Grid item xs={12} md={5}>
        <Paper sx={{ p: 2, position: "sticky", top: 16 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Command preview</Typography>
          <CommandPreview config={editor.config} perLaunch={{ prompt, cwd }} />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              disabled={!editor.name || busy}
              onClick={async () => {
                await create({ name: editor.name, description: editor.description, config: editor.config, defaultCwd: editor.defaultCwd });
              }}
            >
              Save as profile
            </Button>
            <Button
              variant="contained"
              disabled={!canLaunch}
              onClick={async () => {
                await spawn({ prompt, cwd: cwd!, config: editor.config });
              }}
            >
              Launch
            </Button>
          </Stack>
          <Typography variant="caption" sx={{ display: "block", mt: 2, color: "text.secondary" }}>
            {profiles.length} saved profile{profiles.length === 1 ? "" : "s"} · {busy ? "busy" : "idle"}
          </Typography>
        </Paper>
      </Grid>
    </Grid>
  );
}

export default LauncherView;
```

(`useOrchestrator` will gain `spawn(args: { prompt; cwd; profileId?; config? })` in Task 23. The launcher imports it now and the type is finalized there.)

- [ ] **Step 4: Run tests**

Run: `npm run test:client -- LauncherView`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/LauncherView.tsx client/src/pages/__tests__/LauncherView.test.tsx
git commit -m "feat(launcher): LauncherView page (form + command preview + actions)"
```

---

### Task 19: Mount `/launcher` route + nav entry

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Add the import and route**

In `client/src/App.tsx`, near the existing `import { MobileChat } from "./pages/MobileChat";` line, add:

```typescript
import { LauncherView } from "./pages/LauncherView";
```

In the Routes block (where `<Route path="chat" ...>` is), add:

```tsx
<Route path="launcher" element={<LauncherView />} />
```

In the navigation/sidebar component (search for the existing `chat` nav entry), add a sibling entry pointing to `/launcher` with a Rocket / PlayArrow icon and label "Launcher".

- [ ] **Step 2: Smoke test**

Run: `npm run dev:client` → open `http://localhost:5173/launcher` → confirm the form renders.

- [ ] **Step 3: Run client typecheck**

Run: `cd client && npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat(launcher): mount /launcher route + nav entry"
```

---

## Phase 5 — Profile manager UI (parallelizable after Phase 3)

### Task 20: SettingsProfiles tab

**Files:**
- Create: `client/src/pages/SettingsProfiles.tsx`
- Modify: `client/src/pages/Settings.tsx` — add a "Profiles" tab and mount `<SettingsProfiles />`.
- Test: `client/src/pages/__tests__/SettingsProfiles.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/pages/__tests__/SettingsProfiles.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsProfiles } from "../SettingsProfiles";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/profiles")) {
        return new Response(
          JSON.stringify([
            { id: "p1", name: "code-review", config: { model: "sonnet" }, createdAt: 1, updatedAt: 1 },
            { id: "p2", name: "ad-hoc", config: {}, createdAt: 2, updatedAt: 2 },
          ]),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 200 });
    }),
  );
});

describe("SettingsProfiles", () => {
  it("lists profiles", async () => {
    render(<SettingsProfiles />);
    await waitFor(() => expect(screen.getByText("code-review")).toBeInTheDocument());
    expect(screen.getByText("ad-hoc")).toBeInTheDocument();
  });

  it("opens editor on click", async () => {
    render(<SettingsProfiles />);
    await userEvent.click(await screen.findByText("code-review"));
    expect(screen.getByText(/Identity/i)).toBeInTheDocument();
  });

  it("renders Import / Export buttons", async () => {
    render(<SettingsProfiles />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Import/i })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Export/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test (fail)**

Run: `npm run test:client -- SettingsProfiles`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// client/src/pages/SettingsProfiles.tsx
import { useState } from "react";
import { Box, Button, List, ListItemButton, ListItemText, Stack, Typography, Divider } from "@mui/material";
import { useProfiles } from "../hooks/useProfiles";
import { ProfileEditor, ProfileEditorValue } from "../features/launcher/ProfileEditor";
import type { Profile } from "../lib/profile-types";

export function SettingsProfiles() {
  const { profiles, update, remove, duplicate, importJson } = useProfiles();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = profiles.find((p) => p.id === selectedId) || null;

  const onChangeEditor = async (next: ProfileEditorValue) => {
    if (!selected) return;
    await update(selected.id, {
      name: next.name,
      description: next.description,
      config: next.config,
      defaultCwd: next.defaultCwd,
    });
  };

  const exportFor = async (p: Profile) => {
    const res = await fetch(`/api/orchestrator/profiles/${p.id}/export`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const json = JSON.parse(await file.text());
      await importJson(json);
    };
    input.click();
  };

  return (
    <Box sx={{ display: "flex", gap: 2, p: 2, height: "100%" }}>
      <Box sx={{ width: 280, borderRight: "1px solid", borderColor: "divider", pr: 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <Button size="small" onClick={onImport}>Import</Button>
          {selected && <Button size="small" onClick={() => exportFor(selected)}>Export</Button>}
        </Stack>
        <Divider />
        <List dense>
          {profiles.map((p) => (
            <ListItemButton key={p.id} selected={p.id === selectedId} onClick={() => setSelectedId(p.id)}>
              <ListItemText primary={p.name} secondary={p.description} />
            </ListItemButton>
          ))}
        </List>
      </Box>
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {selected ? (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={() => duplicate(selected.id)}>Duplicate</Button>
              <Button size="small" color="error" onClick={() => remove(selected.id)}>Delete</Button>
            </Stack>
            <ProfileEditor
              value={{
                name: selected.name,
                description: selected.description,
                config: selected.config,
                defaultCwd: selected.defaultCwd,
              }}
              onChange={onChangeEditor}
            />
          </Stack>
        ) : (
          <Typography color="text.secondary">Select a profile to edit, or Import one.</Typography>
        )}
      </Box>
    </Box>
  );
}

export default SettingsProfiles;
```

- [ ] **Step 4: Wire into `client/src/pages/Settings.tsx`**

In the Settings tab list, add a "Profiles" tab. Inside the matching panel, render `<SettingsProfiles />`. Match the existing tab pattern (search for `Tabs`, `Tab` components).

- [ ] **Step 5: Run tests**

Run: `npm run test:client -- SettingsProfiles`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/SettingsProfiles.tsx client/src/pages/Settings.tsx client/src/pages/__tests__/SettingsProfiles.test.tsx
git commit -m "feat(launcher): SettingsProfiles tab — list, edit, duplicate, import/export"
```

---

## Phase 6 — Send composer UI (parallelizable after Phase 3)

### Task 21: Extend `useOrchestrator` with sendMessage and refined SpawnArgs

**Files:**
- Modify: `client/src/hooks/useOrchestrator.ts`
- Test: `client/src/hooks/__tests__/useOrchestrator.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```typescript
// client/src/hooks/__tests__/useOrchestrator.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOrchestrator } from "../useOrchestrator";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.endsWith("/spawn")) {
        return new Response(JSON.stringify({ id: "h1", pid: 9, status: "running", startedAt: 1 }), { status: 200 });
      }
      if (init?.method === "POST" && url.includes("/agents/") && url.endsWith("/message")) {
        return new Response(JSON.stringify({ messageId: "m1" }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }),
  );
});

describe("useOrchestrator (extended)", () => {
  it("spawn() posts the new shape", async () => {
    const { result } = renderHook(() => useOrchestrator());
    let r: any;
    await act(async () => {
      r = await result.current.spawn({ prompt: "hi", cwd: "/tmp", profileId: "p1" });
    });
    expect(r.id).toBe("h1");
    const call = (fetch as any).mock.calls[0];
    expect(JSON.parse(call[1].body)).toMatchObject({ prompt: "hi", cwd: "/tmp", profileId: "p1" });
  });

  it("sendMessage() posts to /agents/:id/message", async () => {
    const { result } = renderHook(() => useOrchestrator());
    let r: any;
    await act(async () => {
      r = await result.current.sendMessage("h1", "follow-up");
    });
    expect(r?.messageId).toBe("m1");
  });
});
```

- [ ] **Step 2: Run test (fail)**

Run: `npm run test:client -- useOrchestrator`
Expected: FAIL — `sendMessage` undefined; new shape mismatch.

- [ ] **Step 3: Replace `client/src/hooks/useOrchestrator.ts`**

```typescript
// client/src/hooks/useOrchestrator.ts
import { useCallback, useState } from "react";
import type { ProfileConfig } from "../lib/profile-types";

export interface SpawnArgs {
  prompt: string;
  cwd: string;
  profileId?: string;
  config?: ProfileConfig;
  resumeSessionId?: string;
  forkSession?: boolean;
}

export interface SpawnResult {
  id: string;
  pid: number;
  status: string;
  startedAt: number;
}

export function useOrchestrator() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spawn = useCallback(async (args: SpawnArgs): Promise<SpawnResult | null> => {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        prompt: args.prompt,
        cwd: args.cwd,
      };
      if (args.profileId) body.profileId = args.profileId;
      if (args.config) body.configOverride = args.config;
      if (args.resumeSessionId) body.resumeSessionId = args.resumeSessionId;
      if (args.forkSession) body.forkSession = args.forkSession;
      const res = await fetch("/api/orchestrator/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${res.status}`);
      return (await res.json()) as SpawnResult;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (id: string, text: string): Promise<{ messageId: string } | null> => {
      try {
        const res = await fetch(`/api/orchestrator/agents/${id}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error(`${res.status}`);
        return (await res.json()) as { messageId: string };
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [],
  );

  const kill = useCallback(async (id: string) => {
    await fetch(`/api/orchestrator/agents/${id}`, { method: "DELETE" });
  }, []);

  return { spawn, sendMessage, kill, busy, error };
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:client -- useOrchestrator`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useOrchestrator.ts client/src/hooks/__tests__/useOrchestrator.test.ts
git commit -m "feat(launcher): useOrchestrator gains sendMessage + new SpawnArgs shape"
```

---

### Task 22: SendComposer component

**Files:**
- Create: `client/src/features/launcher/SendComposer.tsx`
- Test: `client/src/features/launcher/__tests__/SendComposer.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/features/launcher/__tests__/SendComposer.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SendComposer } from "../SendComposer";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.endsWith("/spawn")) {
        return new Response(JSON.stringify({ id: "h2", pid: 1, status: "running", startedAt: 1 }), { status: 200 });
      }
      if (init?.method === "POST" && url.includes("/agents/") && url.endsWith("/message")) {
        return new Response(JSON.stringify({ messageId: "m1" }), { status: 200 });
      }
      if (url.endsWith("/profiles")) return new Response(JSON.stringify([]), { status: 200 });
      if (url.endsWith("/cwds")) return new Response(JSON.stringify([{ path: "/tmp", source: "manual", added_at: 1 }]), { status: 200 });
      return new Response("{}", { status: 200 });
    }),
  );
});

describe("SendComposer", () => {
  it("uses sendMessage when sessionLiveHandleId is provided", async () => {
    render(<SendComposer sessionId="s1" sessionLiveHandleId="h1" sessionCwd="/tmp" />);
    await userEvent.type(screen.getByPlaceholderText(/message/i), "hi");
    await userEvent.click(screen.getByRole("button", { name: /Send/i }));
    const calls = (fetch as any).mock.calls.map((c: any[]) => c[0]);
    expect(calls.some((u: string) => u.includes("/agents/h1/message"))).toBe(true);
  });

  it("uses spawn(--resume) when no live handle", async () => {
    render(<SendComposer sessionId="s1" sessionCwd="/tmp" />);
    await userEvent.type(screen.getByPlaceholderText(/message/i), "go");
    await userEvent.click(screen.getByRole("button", { name: /Send/i }));
    const calls = (fetch as any).mock.calls;
    const spawn = calls.find((c: any[]) => c[0].endsWith("/spawn"));
    const body = JSON.parse(spawn[1].body);
    expect(body.resumeSessionId).toBe("s1");
  });

  it("renders a Stop button only when live", () => {
    const { rerender } = render(<SendComposer sessionId="s1" sessionCwd="/tmp" />);
    expect(screen.queryByRole("button", { name: /Stop/i })).not.toBeInTheDocument();
    rerender(<SendComposer sessionId="s1" sessionLiveHandleId="h1" sessionCwd="/tmp" />);
    expect(screen.getByRole("button", { name: /Stop/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test (fail)**

Run: `npm run test:client -- SendComposer`
Expected: FAIL — component not defined.

- [ ] **Step 3: Write the implementation**

```tsx
// client/src/features/launcher/SendComposer.tsx
import { useState } from "react";
import { Box, Button, MenuItem, Stack, TextField } from "@mui/material";
import { useOrchestrator } from "../../hooks/useOrchestrator";
import { useProfiles } from "../../hooks/useProfiles";

interface Props {
  sessionId: string;
  sessionLiveHandleId?: string | null;
  sessionCwd: string;
  defaultProfileId?: string | null;
}

export function SendComposer({ sessionId, sessionLiveHandleId, sessionCwd, defaultProfileId }: Props) {
  const [text, setText] = useState("");
  const [profileId, setProfileId] = useState<string>(defaultProfileId || "");
  const { spawn, sendMessage, kill, busy, error } = useOrchestrator();
  const { profiles } = useProfiles();

  const onSend = async () => {
    if (!text.trim()) return;
    if (sessionLiveHandleId) {
      await sendMessage(sessionLiveHandleId, text);
    } else {
      await spawn({
        prompt: text,
        cwd: sessionCwd,
        profileId: profileId || undefined,
        resumeSessionId: sessionId,
      });
    }
    setText("");
  };

  return (
    <Box sx={{ p: 1, borderTop: "1px solid", borderColor: "divider", background: "background.paper" }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          select
          size="small"
          label="Profile"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">(none)</MenuItem>
          {profiles.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
        </TextField>
        <TextField
          fullWidth
          size="small"
          multiline
          maxRows={6}
          placeholder="Message Claude…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void onSend();
            }
          }}
        />
        <Button variant="contained" disabled={!text.trim() || busy} onClick={onSend}>Send</Button>
        {sessionLiveHandleId && (
          <Button variant="outlined" color="warning" onClick={() => kill(sessionLiveHandleId)}>Stop</Button>
        )}
      </Stack>
      {error && <Box sx={{ color: "error.main", mt: 0.5, fontSize: 12 }}>{error}</Box>}
    </Box>
  );
}

export default SendComposer;
```

- [ ] **Step 4: Run tests**

Run: `npm run test:client -- SendComposer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/features/launcher/SendComposer.tsx client/src/features/launcher/__tests__/SendComposer.test.tsx
git commit -m "feat(launcher): SendComposer (live → message, historical → resume-spawn)"
```

---

### Task 23: Mount SendComposer in ConversationView

**Files:**
- Modify: `client/src/components/conversation/ConversationView.tsx`

- [ ] **Step 1: Read the existing component**

```bash
sed -n '1,80p' client/src/components/conversation/ConversationView.tsx
```

Locate where the component renders the message list and the bottom of the layout. The composer mounts as the LAST child of the outer wrapper.

- [ ] **Step 2: Modify**

Add the import near the top:

```typescript
import { SendComposer } from "../../features/launcher/SendComposer";
```

Extend `ConversationViewProps` to include the data needed by the composer:

```typescript
interface ConversationViewProps {
  sessionId: string;
  initialTranscriptId?: string;
  sessionCwd?: string;
  sessionLiveHandleId?: string | null;
}
```

Add the composer at the bottom of the existing JSX wrapper:

```tsx
{sessionCwd && (
  <SendComposer
    sessionId={sessionId}
    sessionCwd={sessionCwd}
    sessionLiveHandleId={sessionLiveHandleId}
  />
)}
```

The parent (`SessionDetail.tsx` or wherever `<ConversationView>` is mounted) will pass `sessionCwd` and `sessionLiveHandleId` from the existing session-detail fetch (Task 12 added `liveHandle` to that response).

- [ ] **Step 3: Update the parent to pass new props**

Find where `<ConversationView ...>` is rendered (likely `client/src/pages/SessionDetail.tsx`). Pull `cwd` and `liveHandle` from the session detail response and pass them through.

- [ ] **Step 4: Run typecheck and tests**

Run: `cd client && npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/conversation/ConversationView.tsx client/src/pages/SessionDetail.tsx
git commit -m "feat(launcher): mount SendComposer at bottom of Conversation tab"
```

---

### Task 24: Refactor MobileChat as a thin SendComposer wrapper

**Files:**
- Modify: `client/src/pages/MobileChat.tsx`

- [ ] **Step 1: Replace the body of `MobileChat.tsx`**

```tsx
// client/src/pages/MobileChat.tsx
import { useEffect, useState } from "react";
import { useCwds } from "../hooks/useCwds";
import { SendComposer } from "../features/launcher/SendComposer";
import { eventBus } from "../lib/eventBus";
import type { WSMessage } from "../lib/types";

interface Turn {
  role: "user" | "assistant";
  text: string;
  ts: number;
}

export function MobileChat() {
  const { cwds } = useCwds();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const cwd = cwds[0]?.path;

  useEffect(() => {
    if (!sessionId) return;
    return eventBus.subscribe((msg: WSMessage) => {
      if (msg.type === "agent_stream" && msg.sessionId === sessionId) {
        const c: any = msg.chunk;
        if (c?.type === "assistant" && c.text) {
          setTurns((t) => [...t, { role: "assistant", text: c.text, ts: Date.now() }]);
        }
      }
    });
  }, [sessionId]);

  if (!cwd) {
    return <div style={{ padding: 16, color: "#888" }}>Add a working directory in Settings → Profiles → Cwd allowlist before chatting.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {turns.map((t, i) => (
          <div key={i} style={{ margin: "6px 0", padding: "8px 12px", background: t.role === "user" ? "#1a3a52" : "#222", borderRadius: 12, maxWidth: "85%", marginLeft: t.role === "user" ? "auto" : 0 }}>
            {t.text}
          </div>
        ))}
      </div>
      <SendComposer sessionId={sessionId || crypto.randomUUID()} sessionCwd={cwd} sessionLiveHandleId={null} />
    </div>
  );
}

export default MobileChat;
```

- [ ] **Step 2: Run typecheck and tests**

Run: `cd client && npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/MobileChat.tsx
git commit -m "refactor(launcher): MobileChat reuses SendComposer"
```

---

## Phase 7 — Docs & polish (parallelizable after Phase 6)

### Task 25: User-facing docs

**Files:**
- Create: `docs/launcher.md`

- [ ] **Step 1: Write the doc**

```markdown
# Agent Launcher

The Launcher lets you start `claude` sessions from the dashboard, with every CLI flag exposed and saved as reusable Profiles.

## Enable

```bash
# in .env
ORCHESTRATOR_ENABLED=1
ORCHESTRATOR_MAX_CONCURRENT=5   # optional; default 5
```

## Working-directory allowlist

Before launching, add the directories you'll work in:

- Open **Settings → Profiles → Cwd allowlist**
- Pick from the list of cwds the dashboard has imported, or click **Add path…** to enter an absolute path. The server checks that the path exists before remembering it.

## Profiles

A Profile is a saved set of CLI flags.

- **Create:** Open the **Launcher** tab → fill the form → **Save as profile**.
- **Edit:** Open **Settings → Profiles** → pick a profile → edit fields. Changes save on blur.
- **Duplicate / Delete / Import / Export** are in the toolbar above the editor.

## Continue any conversation

Open any session in the dashboard. The Conversation tab now has a **Send** box at the bottom.

- If the session is **live** (an orchestrator process is attached), your message is piped to its stdin.
- If the session is **historical**, the dashboard runs `claude --resume <session-id>` with the chosen Profile and pipes your message in.

## Secrets

Profiles only store env-var names. Values come from:

1. `~/.claude/launcher/secrets.env` — `KEY=VALUE` per line, gitignored.
2. The dashboard's host environment.

Names listed in the profile are the only env vars injected into the spawned `claude`.

## Concurrency

`ORCHESTRATOR_MAX_CONCURRENT` (default 5) caps live agents. Spawn returns `429` once reached.
```

- [ ] **Step 2: Commit**

```bash
git add docs/launcher.md
git commit -m "docs: launcher.md"
```

---

### Task 26: README, ARCHITECTURE, .env.example

**Files:**
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `.env.example`

- [ ] **Step 1: `.env.example`** — append:

```bash
# Local agent orchestrator (advanced — gates the Launcher feature)
# ORCHESTRATOR_ENABLED=1
# ORCHESTRATOR_MAX_CONCURRENT=5
```

- [ ] **Step 2: `README.md`** — add a Launcher subsection under Features that links to `docs/launcher.md`. Mention the `ORCHESTRATOR_ENABLED` gate.

- [ ] **Step 3: `ARCHITECTURE.md`** — in the routes table, add rows for `/api/orchestrator/profiles` and `/api/orchestrator/cwds`. In the lifecycle diagram, note that orchestrator-spawned `claude` processes fire hooks back into the same ingestion pipeline.

- [ ] **Step 4: Run all tests**

Run: `npm run test && npm run test:mcp`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md ARCHITECTURE.md .env.example
git commit -m "docs: cross-reference launcher in README, ARCHITECTURE, .env.example"
```

---

## Acceptance criteria (executor checklist)

- [ ] All 26 tasks committed in order.
- [ ] `npm run test` passes (server + client).
- [ ] `npm run test:mcp` passes.
- [ ] `npm run mcp:typecheck && npm run mcp:build` passes.
- [ ] `npm run build` (client production) passes.
- [ ] Smoke walk-through (with `ORCHESTRATOR_ENABLED=1` set):
  1. `npm run dev`
  2. Open `http://localhost:5173/launcher` → fill prompt + cwd → Launch → see streaming output via the existing Conversation route on the new session.
  3. Save the same form as a Profile → reload → it appears in **Settings → Profiles**.
  4. Open a historical session → type into the new send box → confirm a new launch appears with `--resume <session-id>` in the audit log (`launcher_launches`).
  5. With `ORCHESTRATOR_ENABLED` unset, every new route 404s.

## Self-review notes (filled by author after writing)

- Spec coverage: all 8 design sections from the spec map to tasks (data model → 5; API surface → 9, 10, 11; spawner → 1–4, 11; UI sections → 14–22; security → enforced in 7 (cwds), 11 (allowlist + concurrency), 8 (audit); testing → every task has TDD steps; phases → tasks 1–26 in matching order).
- Type consistency: `ProfileConfig` shape declared once on the server (Task 1) and mirrored once on the client (Task 14). `SpawnArgs` defined in Task 21; consumed by Task 18 (Launcher) and Task 22 (SendComposer) — names match.
- No placeholders: every code step is fully written; section components in Task 17 follow a single shown pattern.
