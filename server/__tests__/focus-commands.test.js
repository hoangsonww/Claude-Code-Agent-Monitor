/**
 * Tests for server/lib/focus-commands.js — the `ccam focus …` extractor
 * (command-position anchoring, compound commands, path/env/npx prefixes),
 * the per-verb argument parser, and applyFocusCommand semantics: set/push/
 * pop/done state transitions, unknown-item flagging vs strict 409 codes,
 * stack depth cap, empty-pop handling, strict-path idempotent dedupe, and
 * the Focus event + broadcast side effects.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TEST_DB = path.join(
  os.tmpdir(),
  `dashboard-focus-commands-test-${Date.now()}-${process.pid}.db`
);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const dbModule = require("../db");
const { db, stmts } = dbModule;
const {
  extractFocusCommand,
  parseFocusArgs,
  applyFocusCommand,
  focusWireShape,
  MAX_STACK_DEPTH,
} = require("../lib/focus-commands");

const CWD = "/tmp/focus-test-project";
const SESSION = { id: "focus-test-session", cwd: CWD };

let broadcasts = [];
const broadcast = (type, data) => broadcasts.push({ type, data });

before(() => {
  stmts.insertSession.run(SESSION.id, "Focus Test", "active", CWD, null, null);
  stmts.upsertPlan.run(CWD, "Test plan", `${CWD}/AGENT-PLAN.md`, "hash", 2);
  stmts.upsertPlanItem.run(CWD, 1, "First item", null, 0, 0);
  stmts.upsertPlanItem.run(CWD, 4, "Migrate auth", "SSO works", 0, 1);
});

after(() => {
  try {
    db.close();
  } catch {
    /* already closed */
  }
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.rmSync(`${TEST_DB}${suffix}`, { force: true });
    } catch {
      /* best effort */
    }
  }
});

describe("extractFocusCommand", () => {
  const positives = [
    ["ccam focus set 4", "set", "4"],
    ['cd x && ccam focus set 4 "backend first"', "set", '4 "backend first"'],
    ['./bin/ccam.js focus push "fix flaky test"', "push", '"fix flaky test"'],
    ["FOO=1 ccam focus pop", "pop", ""],
    ["npx ccam focus done 2", "done", "2"],
    ["ccam focus status", "status", ""],
    ["git status; ccam focus set 1", "set", "1"],
  ];
  for (const [cmd, verb, args] of positives) {
    it(`extracts from: ${cmd}`, () => {
      const res = extractFocusCommand(cmd);
      assert.ok(res, `expected a match for ${cmd}`);
      assert.equal(res.verb, verb);
      assert.equal(res.argsRaw, args);
    });
  }

  const negatives = [
    "ccam focusx set 4",
    "ccam status",
    "ls -la",
    "myccam focus set 4",
    "ccam focus jump 4",
  ];
  for (const cmd of negatives) {
    it(`ignores: ${cmd}`, () => {
      assert.equal(extractFocusCommand(cmd), null);
    });
  }
});

describe("parseFocusArgs", () => {
  it("parses set with number and quoted note", () => {
    assert.deepEqual(parseFocusArgs("set", '4 "backend first"'), {
      verb: "set",
      itemNumber: 4,
      note: "backend first",
    });
  });
  it("rejects set without a number", () => {
    assert.deepEqual(parseFocusArgs("set", "banana"), { error: "bad_args" });
  });
  it("parses push description and rejects empty push", () => {
    assert.deepEqual(parseFocusArgs("push", '"npm conflict"'), {
      verb: "push",
      description: "npm conflict",
    });
    assert.deepEqual(parseFocusArgs("push", ""), { error: "bad_args" });
  });
  it("parses bare pop/status/done", () => {
    assert.deepEqual(parseFocusArgs("pop", ""), { verb: "pop" });
    assert.deepEqual(parseFocusArgs("status", ""), { verb: "status" });
    assert.deepEqual(parseFocusArgs("done", "4"), { verb: "done", itemNumber: 4 });
  });
});

describe("applyFocusCommand", () => {
  it("set records focus, stamps set_at, writes a Focus event, broadcasts", () => {
    broadcasts = [];
    const res = applyFocusCommand(dbModule, broadcast, SESSION, {
      verb: "set",
      itemNumber: 4,
      note: "backend first",
    });
    assert.equal(res.focus.item_number, 4);
    assert.equal(res.focus.item_text, "Migrate auth");
    assert.equal(res.focus.note, "backend first");
    assert.ok(res.focus.since);
    assert.deepEqual(
      broadcasts.map((b) => b.type),
      ["new_event", "session_focus"]
    );
    const events = stmts.listFocusEvents.all(SESSION.id, 10);
    assert.equal(events.length, 1);
    assert.match(events[0].summary, /item 4/);
  });

  it("set for an unknown item is recorded but flagged on the hook path", () => {
    const res = applyFocusCommand(dbModule, broadcast, SESSION, { verb: "set", itemNumber: 99 });
    assert.equal(res.focus.item_number, 99);
    assert.equal(res.focus.item_text, null);
    const events = stmts.listFocusEvents.all(SESSION.id, 10);
    assert.equal(JSON.parse(events[0].data).unknown_item, true);
  });

  it("set for an unknown item is a 409-shaped error on the strict path", () => {
    const res = applyFocusCommand(
      dbModule,
      broadcast,
      SESSION,
      { verb: "set", itemNumber: 99 },
      { strict: true }
    );
    assert.equal(res.code, "UNKNOWN_ITEM");
  });

  it("strict set with identical end-state dedupes without a new event", () => {
    applyFocusCommand(dbModule, broadcast, SESSION, { verb: "set", itemNumber: 4, note: "n" });
    const before = stmts.listFocusEvents.all(SESSION.id, 50).length;
    const res = applyFocusCommand(
      dbModule,
      broadcast,
      SESSION,
      { verb: "set", itemNumber: 4, note: "n" },
      { strict: true }
    );
    assert.equal(res.deduped, true);
    assert.equal(stmts.listFocusEvents.all(SESSION.id, 50).length, before);
  });

  it("push/pop maintain the detour stack with prior_item", () => {
    applyFocusCommand(dbModule, broadcast, SESSION, { verb: "set", itemNumber: 4 });
    let res = applyFocusCommand(dbModule, broadcast, SESSION, {
      verb: "push",
      description: "npm conflict",
    });
    assert.equal(res.focus.detour_stack.length, 1);
    assert.equal(res.focus.detour_stack[0].description, "npm conflict");
    assert.equal(res.focus.detour_stack[0].prior_item, 4);
    assert.equal(res.focus.item_number, 4);
    res = applyFocusCommand(dbModule, broadcast, SESSION, { verb: "pop" });
    assert.equal(res.focus.detour_stack.length, 0);
  });

  it("pop on an empty stack is a flagged no-op (hook) and EMPTY_STACK (strict)", () => {
    const before = stmts.listFocusEvents.all(SESSION.id, 100).length;
    const res = applyFocusCommand(dbModule, broadcast, SESSION, { verb: "pop" });
    assert.equal(res.focus.detour_stack.length, 0);
    const events = stmts.listFocusEvents.all(SESSION.id, 100);
    assert.equal(events.length, before + 1);
    assert.equal(JSON.parse(events[0].data).ignored, "empty_stack");
    const strictRes = applyFocusCommand(
      dbModule,
      broadcast,
      SESSION,
      { verb: "pop" },
      { strict: true }
    );
    assert.equal(strictRes.code, "EMPTY_STACK");
  });

  it("caps the detour stack depth", () => {
    for (let i = 0; i < MAX_STACK_DEPTH + 2; i++) {
      applyFocusCommand(dbModule, broadcast, SESSION, { verb: "push", description: `d${i}` });
    }
    const row = stmts.getSessionFocus.get(SESSION.id);
    assert.equal(JSON.parse(row.detour_stack).length, MAX_STACK_DEPTH);
    while (JSON.parse(stmts.getSessionFocus.get(SESSION.id).detour_stack).length > 0) {
      applyFocusCommand(dbModule, broadcast, SESSION, { verb: "pop" });
    }
  });

  it("done stamps declared_done, clears matching pointer, broadcasts plan_updated", () => {
    applyFocusCommand(dbModule, broadcast, SESSION, { verb: "set", itemNumber: 4 });
    broadcasts = [];
    const res = applyFocusCommand(dbModule, broadcast, SESSION, { verb: "done", itemNumber: 4 });
    assert.equal(res.focus.item_number, null);
    assert.equal(res.planChanged, true);
    const item = stmts.getPlanItem.get(CWD, 4);
    assert.ok(item.declared_done_at);
    assert.equal(item.declared_done_session, SESSION.id);
    assert.ok(broadcasts.some((b) => b.type === "plan_updated"));
  });

  it("status is a pure read: no event, no broadcast, no write", () => {
    const before = stmts.listFocusEvents.all(SESSION.id, 100).length;
    broadcasts = [];
    const res = applyFocusCommand(dbModule, broadcast, SESSION, { verb: "status" });
    assert.ok("focus" in res);
    assert.equal(stmts.listFocusEvents.all(SESSION.id, 100).length, before);
    assert.equal(broadcasts.length, 0);
  });

  it("declarations never touch drift columns", () => {
    stmts.setSessionFocusDrift.run("drift", "test reason", "2026-01-01T00:00:00Z", SESSION.id);
    applyFocusCommand(dbModule, broadcast, SESSION, { verb: "set", itemNumber: 1 });
    const row = stmts.getSessionFocus.get(SESSION.id);
    assert.equal(row.drift_status, "drift");
    const wire = focusWireShape(dbModule, row);
    assert.equal(wire.drift, true);
    assert.equal(wire.drift_reason, "test reason");
  });
});
