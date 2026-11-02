/**
 * @file cursor-turn-usage.test.js
 * @description Cursor stop payloads become one generation snapshot, cache
 * tokens are removed from the inclusive input count, and a repeated stop for
 * the same generation does not double the session total.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "cursor-turn-usage-"));
process.env.DASHBOARD_DB_PATH = path.join(ROOT, "dashboard.db");
process.env.DASHBOARD_DATA_DIR = ROOT;
process.env.DASHBOARD_CURSOR_HOME = path.join(ROOT, ".cursor");
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const {
  normalizeCursorTurnUsage,
  normalizeCursorHook,
  isCursorTurnPayload,
  applyCursorTurnUsage,
} = require("../lib/cursor-turn-usage");
const { db, stmts } = require("../db");
const { calculateCursorCost } = require("../routes/pricing");
const { installCursorHooks, getCursorHookStatus } = require("../../scripts/install-cursor-hooks");

describe("Cursor turn usage", () => {
  after(() => {
    try {
      db.close();
    } catch {
      /* already closed */
    }
    fs.rmSync(ROOT, { recursive: true, force: true });
  });

  it("subtracts cache tokens from Cursor's inclusive input count and marks Fast", () => {
    const snap = normalizeCursorTurnUsage({
      generation_id: "gen-1",
      model_id: "grok-4.7",
      model_params: [{ id: "fast", value: "true" }],
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_tokens: 400_000,
      cache_write_tokens: 100_000,
    });
    assert.deepEqual(snap, {
      generationId: "gen-1",
      model: "grok-4.7",
      speed: "fast",
      input: 500_000,
      output: 1_000_000,
      cacheRead: 400_000,
      cacheWrite: 100_000,
    });
  });

  it("ignores payloads that do not report tokens", () => {
    assert.equal(
      normalizeCursorTurnUsage({ model_id: "grok-4.7", hook_event_name: "preToolUse" }),
      null
    );
  });

  it("maps conversation_id onto session_id and error status onto stop_reason", () => {
    const normalized = normalizeCursorHook("stop", {
      conversation_id: "abc",
      status: "error",
      input_tokens: 10,
      user_email: "person@example.com",
    });
    assert.equal(normalized.hookType, "Stop");
    assert.equal(normalized.data.session_id, "abc");
    assert.equal(normalized.data.stop_reason, "error");
    assert.equal("user_email" in normalized.data, false);
  });

  it("keeps user_email on hooks that are not Cursor usage payloads", () => {
    const claude = normalizeCursorHook("PreToolUse", {
      session_id: "claude-session",
      user_email: "person@example.com",
      input_tokens: 10,
      output_tokens: 10,
    });
    assert.equal(claude.data.user_email, "person@example.com");
    assert.equal(isCursorTurnPayload("PreToolUse", claude.data), false);
    assert.equal(
      isCursorTurnPayload("Stop", { conversation_id: "cursor-session", input_tokens: 10 }),
      true
    );
  });

  it("prices the sum of turns once, even when stop repeats a generation", () => {
    const sessionId = "cursor-turn-usage-session";
    stmts.insertSession.run(sessionId, "Cursor", "active", "/tmp", "grok-4.7", null);
    const turn = {
      model_id: "grok-4.7",
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
    };
    assert.equal(applyCursorTurnUsage(stmts, sessionId, { ...turn, generation_id: "a" }), true);
    assert.equal(applyCursorTurnUsage(stmts, sessionId, { ...turn, generation_id: "a" }), true);
    assert.equal(applyCursorTurnUsage(stmts, sessionId, { ...turn, generation_id: "b" }), true);

    const rows = stmts.getTokensBySession.all(sessionId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].input_tokens, 2_000_000);
    assert.equal(rows[0].output_tokens, 2_000_000);
    const priced = calculateCursorCost(
      rows.map((row) => ({ ...row, provider: "cursor" })),
      stmts.listCursorPricing.all()
    );
    assert.equal(priced.total_cost, 16);
    assert.equal(priced.unpriced_models.length, 0);
    assert.equal(priced.breakdown[0].matched_rule, "grok-4.7%");
  });

  it("lowers a corrected generation and drops only the abandoned Cursor bucket", () => {
    const sessionId = "cursor-turn-correction";
    stmts.insertSession.run(sessionId, "Cursor", "active", "/tmp", "grok-4.6", null);
    stmts.resetTokenUsage.run(
      sessionId,
      "claude-sonnet",
      "standard",
      "global",
      "standard",
      50,
      50,
      0,
      0,
      0,
      0,
      0,
      0
    );
    assert.equal(
      applyCursorTurnUsage(stmts, sessionId, {
        generation_id: "a",
        model_id: "grok-4.6",
        input_tokens: 1_000_000,
        output_tokens: 0,
      }),
      true
    );
    assert.equal(
      applyCursorTurnUsage(stmts, sessionId, {
        generation_id: "a",
        model_id: "grok-4.7",
        input_tokens: 100_000,
        output_tokens: 0,
      }),
      true
    );
    const rows = stmts.getTokensBySession.all(sessionId);
    assert.equal(
      rows.find((row) => row.model === "grok-4.6"),
      undefined
    );
    assert.equal(rows.find((row) => row.model === "grok-4.7").input_tokens, 100_000);
    assert.equal(rows.find((row) => row.model === "claude-sonnet").input_tokens, 50);
  });

  it("installs only the dashboard stop command and keeps other Cursor hooks", () => {
    const filePath = path.join(process.env.DASHBOARD_CURSOR_HOME, "hooks.json");
    fs.mkdirSync(process.env.DASHBOARD_CURSOR_HOME, { recursive: true });
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        version: 1,
        hooks: {
          stop: [{ command: "keep-me" }, { command: 'node "/tmp/other/hook-handler.js" Stop' }],
        },
      })
    );
    const first = installCursorHooks({ silent: true });
    const second = installCursorHooks({ silent: true });
    assert.equal(first.ok, true);
    assert.equal(second.replaced, true);
    assert.equal(getCursorHookStatus().installed, true);
    const config = JSON.parse(fs.readFileSync(filePath, "utf8"));
    assert.equal(config.hooks.stop.filter((entry) => entry.command === "keep-me").length, 1);
    assert.equal(
      config.hooks.stop.filter(
        (entry) => entry.command === 'node "/tmp/other/hook-handler.js" Stop'
      ).length,
      1
    );
    assert.equal(
      config.hooks.stop.filter((entry) => String(entry.command).includes("hook-handler.js")).length,
      2
    );
    assert.equal(
      config.hooks.afterAgentResponse.filter((entry) =>
        String(entry.command).includes("hook-handler.js")
      ).length,
      1
    );
  });

  it("keeps the existing hooks.json mode", () => {
    const filePath = path.join(process.env.DASHBOARD_CURSOR_HOME, "hooks.json");
    fs.chmodSync(filePath, 0o640);
    assert.equal(installCursorHooks({ silent: true }).ok, true);
    assert.equal(fs.statSync(filePath).mode & 0o777, 0o640);
  });

  it("creates a missing hooks.json as owner-read/write", () => {
    const filePath = path.join(process.env.DASHBOARD_CURSOR_HOME, "hooks.json");
    fs.rmSync(filePath, { force: true });
    assert.equal(installCursorHooks({ silent: true }).ok, true);
    assert.equal(fs.statSync(filePath).mode & 0o777, 0o600);
  });

  it("updates the target of a hooks.json symlink and leaves the link in place", (t) => {
    const home = process.env.DASHBOARD_CURSOR_HOME;
    const filePath = path.join(home, "hooks.json");
    const real = path.join(home, "real-hooks.json");
    fs.copyFileSync(filePath, real);
    fs.chmodSync(real, 0o640);
    fs.rmSync(filePath, { force: true });
    try {
      fs.symlinkSync(real, filePath);
    } catch (error) {
      if (error.code === "EPERM" || error.code === "ENOTSUP") {
        t.skip("symlinks are not available");
        return;
      }
      throw error;
    }
    assert.equal(installCursorHooks({ silent: true }).ok, true);
    assert.equal(fs.lstatSync(filePath).isSymbolicLink(), true);
    assert.equal(fs.statSync(real).mode & 0o777, 0o640);
    const config = JSON.parse(fs.readFileSync(real, "utf8"));
    assert.equal(Array.isArray(config.hooks.stop), true);
  });
});
