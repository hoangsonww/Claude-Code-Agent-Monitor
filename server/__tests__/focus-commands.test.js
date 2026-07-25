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
  MAX_TITLE_LEN,
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
    ['ccam focus bug "Title" "Summary"', "bug", '"Title" "Summary"'],
    [
      'ccam focus feature "Title" "Summary" --detail "long text"',
      "feature",
      '"Title" "Summary" --detail "long text"',
    ],
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

  it("parses bug/feature title + summary, with and without --detail", () => {
    assert.deepEqual(parseFocusArgs("bug", '"Waiting bug" "Session mislabeled"'), {
      verb: "bug",
      kind: "bug",
      title: "Waiting bug",
      description: "Session mislabeled",
      detail: null,
    });
    assert.deepEqual(
      parseFocusArgs("feature", '"Badges" "Add plan-item badges" --detail "longer explanation"'),
      {
        verb: "feature",
        kind: "feature",
        title: "Badges",
        description: "Add plan-item badges",
        detail: "longer explanation",
      }
    );
  });

  it("truncates an overlong bug/feature title", () => {
    const longTitle = "x".repeat(MAX_TITLE_LEN + 20);
    const res = parseFocusArgs("bug", `"${longTitle}" "summary"`);
    assert.equal(res.title.length, MAX_TITLE_LEN);
  });

  it("rejects bug/feature missing a title or summary", () => {
    assert.deepEqual(parseFocusArgs("bug", ""), { error: "bad_args" });
    assert.deepEqual(parseFocusArgs("bug", '"only title"'), { error: "bad_args" });
  });

  it("rejects a title/summary truncated to an unterminated quote (regression)", () => {
    // A `)` in the title/summary text truncates FOCUS_RE's tail capture mid-
    // quote (the same char class already excludes `;&|)#`), leaving an
    // opening quote with no closing partner. Before the fix this silently
    // parsed to { kind: "feature", title: '"', description: "README-VN.md" }
    // instead of failing — reproduced live by a subagent's real
    // `ccam focus feature "...)" "README-VN.md ..."` invocation.
    assert.deepEqual(parseFocusArgs("feature", '" README-VN.md'), { error: "bad_args" });
    assert.deepEqual(parseFocusArgs("bug", "'Docs (README-VN.md"), { error: "bad_args" });
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

  it("bug/feature push a kind-tagged frame and pop resolves it like a plain detour", () => {
    applyFocusCommand(dbModule, broadcast, SESSION, { verb: "set", itemNumber: 4 });
    broadcasts = [];
    let res = applyFocusCommand(dbModule, broadcast, SESSION, {
      verb: "bug",
      kind: "bug",
      title: "Waiting bug",
      description: "Session mislabeled while a subagent works",
      detail: "Watchdog skips the working-fleet guard",
    });
    assert.equal(res.focus.detour_stack.length, 1);
    const frame = res.focus.detour_stack[0];
    assert.equal(frame.kind, "bug");
    assert.equal(frame.title, "Waiting bug");
    assert.equal(frame.description, "Session mislabeled while a subagent works");
    assert.equal(frame.detail, "Watchdog skips the working-fleet guard");
    assert.equal(frame.prior_item, 4);
    const events = stmts.listFocusEvents.all(SESSION.id, 10);
    assert.equal(events[0].summary, "Bug: Waiting bug");
    assert.equal(JSON.parse(events[0].data).kind, "bug");

    res = applyFocusCommand(dbModule, broadcast, SESSION, {
      verb: "feature",
      kind: "feature",
      title: "Badges",
      description: "Add plan-item badges",
      detail: null,
    });
    assert.equal(res.focus.detour_stack.length, 2);
    assert.equal(res.focus.detour_stack[1].kind, "feature");
    assert.equal("detail" in res.focus.detour_stack[1], false);

    res = applyFocusCommand(dbModule, broadcast, SESSION, { verb: "pop" });
    assert.equal(res.focus.detour_stack.length, 1);
    assert.equal(res.focus.detour_stack[0].kind, "bug");
    res = applyFocusCommand(dbModule, broadcast, SESSION, { verb: "pop" });
    assert.equal(res.focus.detour_stack.length, 0);
  });

  it("a plain push still has no kind/title/detail fields (regression)", () => {
    const res = applyFocusCommand(dbModule, broadcast, SESSION, {
      verb: "push",
      description: "npm conflict",
    });
    const frame = res.focus.detour_stack[res.focus.detour_stack.length - 1];
    assert.equal("kind" in frame, false);
    assert.equal("title" in frame, false);
    assert.equal("detail" in frame, false);
    applyFocusCommand(dbModule, broadcast, SESSION, { verb: "pop" });
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
