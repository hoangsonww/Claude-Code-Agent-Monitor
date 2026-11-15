/**
 * @file Unit tests for `ccam tui` (cli/commands/tui.js). The renderer is a pure
 * `buildFrame(state, size)` function, so layout and filtering are verified here
 * without a real terminal: every line is exactly the requested width (a TUI that
 * miscounts emits garbage on a real TTY), the panes show what they should, and
 * the live-message fold, filtering, and selection math behave.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { stripAnsi } = require("../../cli/lib/ui");
const {
  buildFrame,
  applyMessage,
  matchesFilter,
  filterSessions,
  filterEvents,
  clampIndex,
  windowAround,
  recomputeDerived,
  upsertById,
} = require("../../cli/commands/tui");

function baseState(overrides = {}) {
  return {
    url: "http://127.0.0.1:4820",
    connection: "live",
    focus: "sessions",
    selection: { sessions: 0, events: 0 },
    filter: "",
    filterDraft: "",
    mode: "normal",
    waitingCount: 1,
    stats: { events_today: 47, active_sessions: 3, active_agents: 2 },
    cost: { today: 12.4 },
    sessions: [
      { id: "auth-1", name: "auth-refactor", status: "working", cwd: "/home/dev/app" },
      { id: "docs-1", name: "docs-sweep", status: "waiting", awaiting_input_since: 1 },
      { id: "test-1", name: "test-harness", status: "working" },
    ],
    agents: [
      { id: "a1", session_id: "auth-1", status: "working" },
      { id: "a2", session_id: "auth-1", status: "waiting" },
    ],
    events: [
      {
        id: 2,
        event_type: "PreToolUse",
        tool_name: "Edit",
        summary: "server/db.js",
        created_at: "2026-11-15T14:39:02.000Z",
      },
      {
        id: 1,
        event_type: "PreToolUse",
        tool_name: "Bash",
        summary: "npm run test",
        created_at: "2026-11-15T14:39:04.000Z",
      },
    ],
    ...overrides,
  };
}

const lines = (frame) => frame.split("\n");

describe("ccam tui buildFrame", () => {
  it("renders exactly `rows` lines, each exactly `cols` visible columns", () => {
    for (const [cols, rows] of [
      [80, 24],
      [120, 40],
      [200, 50],
      [40, 12], // minimum
      [30, 8], // below the clamp floor → clamped up to 40x12
    ]) {
      const frame = buildFrame(baseState(), { cols, rows });
      const rendered = lines(frame);
      const expectCols = Math.max(40, cols);
      const expectRows = Math.max(12, rows);
      assert.equal(rendered.length, expectRows, `row count at ${cols}x${rows}`);
      for (const line of rendered) {
        assert.equal(
          stripAnsi(line).length,
          expectCols,
          `width at ${cols}x${rows}: ${JSON.stringify(stripAnsi(line))}`
        );
      }
    }
  });

  it("shows the panes, the connection state, and the key legend", () => {
    const frame = stripAnsi(buildFrame(baseState(), { cols: 100, rows: 24 }));
    assert.match(frame, /Sessions \(3\)/);
    assert.match(frame, /Events \(2\)/);
    assert.match(frame, /auth-refactor/);
    assert.match(frame, /● live/);
    assert.match(frame, /\[q\]uit/);
    assert.match(frame, /Today \$12\.4000/);
  });

  it("surfaces the detail pane for the selected session", () => {
    const frame = stripAnsi(buildFrame(baseState(), { cols: 100, rows: 24 }));
    assert.match(frame, /Detail: auth-refactor/);
    assert.match(frame, /1 working, 1 waiting/); // its two agents
    assert.match(frame, /\/home\/dev\/app/);
  });

  it("reflects the active filter in the footer and narrows the sessions pane", () => {
    const frame = stripAnsi(buildFrame(baseState({ filter: "docs" }), { cols: 100, rows: 24 }));
    assert.match(frame, /Sessions \(1\)/);
    assert.match(frame, /docs-sweep/);
    assert.doesNotMatch(frame, /auth-refactor/);
    assert.match(frame, /filter: docs/);
  });

  it("shows the filter draft while typing a filter", () => {
    const frame = stripAnsi(
      buildFrame(baseState({ mode: "filter", filterDraft: "auth" }), { cols: 100, rows: 24 })
    );
    assert.match(frame, /\/auth/);
    assert.match(frame, /Enter apply/);
  });

  it("shows a reconnecting indicator when the socket is down", () => {
    const frame = stripAnsi(
      buildFrame(baseState({ connection: "reconnecting" }), { cols: 80, rows: 24 })
    );
    assert.match(frame, /reconnecting/);
  });

  it("handles an empty dataset without throwing or missizing", () => {
    const empty = baseState({ sessions: [], agents: [], events: [], cost: null });
    const frame = buildFrame(empty, { cols: 80, rows: 24 });
    assert.equal(lines(frame).length, 24);
    assert.match(stripAnsi(frame), /No session selected/);
  });
});

describe("ccam tui filtering and selection", () => {
  it("matchesFilter is a case-insensitive substring, empty matches all", () => {
    assert.equal(matchesFilter("Auth Refactor", "auth"), true);
    assert.equal(matchesFilter("Auth Refactor", "REFACTOR"), true);
    assert.equal(matchesFilter("Auth Refactor", "xyz"), false);
    assert.equal(matchesFilter("", ""), true);
    assert.equal(matchesFilter(null, ""), true);
  });

  it("filterSessions matches name and cwd; filterEvents matches type, tool and summary", () => {
    const s = baseState();
    assert.equal(filterSessions(s.sessions, "/home/dev/app").length, 1);
    assert.equal(filterSessions(s.sessions, "sweep").length, 1);
    assert.equal(filterEvents(s.events, "bash").length, 1);
    assert.equal(filterEvents(s.events, "pretooluse").length, 2);
    assert.equal(filterEvents(s.events, "db.js").length, 1);
  });

  it("clampIndex and windowAround stay in bounds", () => {
    assert.equal(clampIndex(5, 3), 2);
    assert.equal(clampIndex(-1, 3), 0);
    assert.equal(clampIndex(0, 0), 0);
    assert.deepEqual(windowAround(0, 0, 5), { start: 0, end: 0 });
    assert.deepEqual(windowAround(3, 0, 5), { start: 0, end: 3 });
    // A long list keeps the selection visible and the window full.
    const w = windowAround(100, 50, 10);
    assert.ok(w.start <= 50 && w.end > 50);
    assert.equal(w.end - w.start, 10);
    // Near the end the window sticks to the tail rather than overrunning.
    assert.deepEqual(windowAround(100, 99, 10), { start: 90, end: 100 });
  });
});

describe("ccam tui live message fold", () => {
  it("prepends a new_event and bumps today's count", () => {
    const s = baseState();
    const changed = applyMessage(s, {
      type: "new_event",
      data: { id: 3, event_type: "Stop", tool_name: null, summary: "done", session_id: "auth-1" },
    });
    assert.equal(changed, true);
    assert.equal(s.events[0].id, 3);
    assert.equal(s.stats.events_today, 48);
  });

  it("upserts a session on session_updated and recomputes derived counts", () => {
    const s = baseState();
    applyMessage(s, {
      type: "session_updated",
      data: { id: "auth-1", status: "waiting", name: "auth-refactor" },
    });
    assert.equal(s.sessions.find((x) => x.id === "auth-1").status, "waiting");
    assert.equal(s.waitingCount, 2); // docs-sweep + the now-waiting auth-refactor
    // A brand-new session id is inserted, not dropped.
    applyMessage(s, {
      type: "session_created",
      data: { id: "new-1", status: "active", name: "fresh" },
    });
    assert.ok(s.sessions.some((x) => x.id === "new-1"));
  });

  it("upserts an agent on agent_updated", () => {
    const s = baseState();
    applyMessage(s, {
      type: "agent_updated",
      data: { id: "a3", session_id: "test-1", status: "working" },
    });
    assert.ok(s.agents.some((x) => x.id === "a3"));
  });

  it("ignores messages with no type or an unhandled type", () => {
    const s = baseState();
    assert.equal(applyMessage(s, {}), false);
    assert.equal(applyMessage(s, { type: "run_stream", data: { id: "r1" } }), false);
  });
});

describe("ccam tui derived counts", () => {
  it("recomputeDerived counts waiting sessions and active sessions/agents", () => {
    const s = baseState();
    recomputeDerived(s);
    assert.equal(s.waitingCount, 1);
    assert.equal(s.stats.active_sessions, 2); // two "working" sessions
    assert.equal(s.stats.active_agents, 1); // one "working" agent
  });

  it("upsertById merges onto an existing row and prepends a new one", () => {
    const list = [{ id: "x", a: 1 }];
    upsertById(list, { id: "x", b: 2 });
    assert.deepEqual(list[0], { id: "x", a: 1, b: 2 });
    upsertById(list, { id: "y", a: 9 });
    assert.equal(list[0].id, "y");
    assert.equal(list.length, 2);
  });
});
