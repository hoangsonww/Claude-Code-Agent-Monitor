/**
 * @file Tests for the new cross-project aggregate route,
 * `GET /api/focus-report` (server/routes/focus-report.js, not yet built as of
 * this test's authoring) — a thin session-selection + explicit `from`/`to`
 * time-window layer in front of the unmodified `buildProjectFocusReport`.
 *
 * Per `qa-assessment.md`'s must-fix #1, the parity check against the
 * existing `GET /api/projects/:id/focus-report` route is deliberately split
 * into two independent assertion groups rather than one whole-object
 * `deepEqual` (the two envelopes legitimately differ — the old route has no
 * `session_id` key at all):
 *   (a) report-body deep-equal: `sessions`/`items`/`totals` (deepEqual),
 *       `wall_clock_ms`/`concurrency_ratio` (equal).
 *   (b) envelope echo-back: the new route's `project_id`/`session_id` match
 *       what was requested (`null` when unfiltered); the OLD route's body is
 *       explicitly asserted to carry no `session_id` key at all.
 *
 * Also pins, as intentional (not a future "helpful" fix), that the old
 * route ignores `?sources=` while the new route honors it — see DEC/§5 of
 * `technical-plan.md`.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const http = require("http");

const TEST_DB = path.join(
  os.tmpdir(),
  `dashboard-focus-report-route-test-${Date.now()}-${process.pid}.db`
);
process.env.DASHBOARD_DB_PATH = TEST_DB;
process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "0"; // isolate from idle discounting

const { createApp, startServer } = require("../index");
const { db, stmts } = require("../db");

let server;
let BASE;

// --- HTTP helper, copied per this repo's own one-helper-per-file convention
// (see server/__tests__/projects.test.js) rather than cross-imported. ---
function fetch(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || "GET",
      headers: { "Content-Type": "application/json", ...options.headers },
    };
    const req = http.request(opts, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });
    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

function post(urlPath, body) {
  return fetch(urlPath, { method: "POST", body });
}

before(async () => {
  const app = createApp();
  server = await startServer(app, 0);
  const addr = server.address();
  BASE = `http://127.0.0.1:${addr.port}`;
});

after(() => {
  server?.close();
  try {
    db.close();
  } catch {
    /* already closed */
  }
});

// --- Fixture helpers, copied per-file from projects.test.js's own
// t()/focus() convention (this repo's stated "do not cross-import between
// test files" rule). ---
const insertFocusEventRaw = db.prepare(
  "INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, data, created_at) VALUES (?, NULL, 'Focus', NULL, ?, ?, ?)"
);
const setSessionTimesRaw = db.prepare(
  "UPDATE sessions SET started_at = ?, ended_at = ? WHERE id = ?"
);

/** ISO timestamp for `hour:minute` on day `dayOffset` from a fixed epoch
 *  (2026-01-01 UTC) — deterministic, independent of real wall-clock time. */
function dayIso(dayOffset, hour = 0, minute = 0) {
  return new Date(Date.UTC(2026, 0, 1 + dayOffset, hour, minute, 0)).toISOString();
}

function focus(sessionId, atIso, data) {
  insertFocusEventRaw.run(sessionId, "focus test", JSON.stringify(data), atIso);
}

function seedSession(id, cwd, startedAt, endedAt) {
  stmts.insertSession.run(id, "Route Test", "active", cwd, "claude-opus-4-8", null);
  setSessionTimesRaw.run(startedAt, endedAt, id);
}

async function createProject(name, cwds) {
  const res = await post("/api/projects", { name, cwds });
  return res.body.project;
}

describe("GET /api/focus-report — required from/to, 400s", () => {
  it("400s when both from and to are missing", async () => {
    const res = await fetch("/api/focus-report");
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "BAD_REQUEST");
    assert.equal(typeof res.body.error.message, "string");
  });

  it("400s when only from is missing", async () => {
    const res = await fetch(`/api/focus-report?to=${encodeURIComponent(dayIso(2))}`);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "BAD_REQUEST");
  });

  it("400s when only to is missing", async () => {
    const res = await fetch(`/api/focus-report?from=${encodeURIComponent(dayIso(1))}`);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "BAD_REQUEST");
  });

  it("400s when from is unparseable", async () => {
    const res = await fetch(
      `/api/focus-report?from=not-a-date&to=${encodeURIComponent(dayIso(2))}`
    );
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "BAD_REQUEST");
  });

  it("400s when to is unparseable", async () => {
    const res = await fetch(
      `/api/focus-report?from=${encodeURIComponent(dayIso(1))}&to=not-a-date`
    );
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "BAD_REQUEST");
  });

  // No combination of project_id/session_id/sources ever yields 200 without
  // both bounds present — loops over filter-present prefixes so a future fix
  // that only guards the bare/no-filter case can't slip an implicit,
  // filter-scoped default window past this test.
  const filterOnlyCases = [
    {},
    { project_id: "does-not-matter" },
    { session_id: "does-not-matter" },
    { sources: "local" },
    { project_id: "does-not-matter", session_id: "does-not-matter" },
    { project_id: "does-not-matter", sources: "local" },
  ];
  for (const params of filterOnlyCases) {
    it(`400s for ${JSON.stringify(params)} with no from/to`, async () => {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`/api/focus-report${qs ? `?${qs}` : ""}`);
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, "BAD_REQUEST");
    });
  }
});

describe("GET /api/focus-report — window-boundary session selection", () => {
  const FROM = dayIso(1); // 2026-01-02T00:00:00.000Z
  const TO = dayIso(2); // 2026-01-03T00:00:00.000Z
  const CWD = "/tmp/focus-report-route-window-test";

  it("includes a session overlapping [from,to) and excludes one entirely outside it", async () => {
    const project = await createProject("Window Test", [CWD]);

    seedSession("window-in", CWD, dayIso(1, 9), dayIso(1, 10));
    focus("window-in", dayIso(1, 9), { verb: "set", item_number: 1, item_text_snapshot: "x" });

    seedSession("window-boundary-touch", CWD, dayIso(0, 23), dayIso(1, 1));
    focus("window-boundary-touch", dayIso(0, 23), {
      verb: "set",
      item_number: 1,
      item_text_snapshot: "x",
    });

    seedSession("window-before", CWD, dayIso(0, 9), dayIso(0, 10));
    focus("window-before", dayIso(0, 9), { verb: "set", item_number: 1, item_text_snapshot: "x" });

    seedSession("window-after", CWD, dayIso(2, 9), dayIso(2, 10));
    focus("window-after", dayIso(2, 9), { verb: "set", item_number: 1, item_text_snapshot: "x" });

    const res = await fetch(
      `/api/focus-report?project_id=${project.id}&from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`
    );
    assert.equal(res.status, 200);
    const ids = res.body.sessions.map((s) => s.session_id).sort();
    assert.deepEqual(ids, ["window-boundary-touch", "window-in"]);
  });
});

describe("GET /api/focus-report — project_id / session_id scoping", () => {
  it("?project_id= returns only that project's sessions", async () => {
    const CWD_A = "/tmp/focus-report-route-scope-a";
    const CWD_B = "/tmp/focus-report-route-scope-b";
    const projectA = await createProject("Scope A", [CWD_A]);
    await createProject("Scope B", [CWD_B]);

    seedSession("scope-a-1", CWD_A, dayIso(1, 9), dayIso(1, 10));
    focus("scope-a-1", dayIso(1, 9), { verb: "set", item_number: 1, item_text_snapshot: "x" });
    seedSession("scope-b-1", CWD_B, dayIso(1, 9), dayIso(1, 10));
    focus("scope-b-1", dayIso(1, 9), { verb: "set", item_number: 1, item_text_snapshot: "x" });

    const res = await fetch(
      `/api/focus-report?project_id=${projectA.id}&from=${encodeURIComponent(dayIso(0))}&to=${encodeURIComponent(dayIso(2))}`
    );
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.sessions.map((s) => s.session_id),
      ["scope-a-1"]
    );
    assert.equal(res.body.project_id, projectA.id);
  });

  it("unknown project_id -> structured 404, not an empty 200", async () => {
    const res = await fetch(
      `/api/focus-report?project_id=does-not-exist&from=${encodeURIComponent(dayIso(0))}&to=${encodeURIComponent(dayIso(2))}`
    );
    assert.equal(res.status, 404);
    // A structured JSON 404, not merely "some non-200 status" - the route
    // being unmounted entirely also 404s, but with an HTML body, not this
    // shape, so this assertion can't pass by accident before B1 exists.
    assert.equal(typeof res.body?.error?.code, "string");
  });

  it("?session_id= returns only that session, and echoes it back", async () => {
    const CWD = "/tmp/focus-report-route-session-scope";
    await createProject("Session Scope", [CWD]);
    seedSession("session-scope-1", CWD, dayIso(1, 9), dayIso(1, 10));
    focus("session-scope-1", dayIso(1, 9), {
      verb: "set",
      item_number: 1,
      item_text_snapshot: "x",
    });
    seedSession("session-scope-2", CWD, dayIso(1, 9), dayIso(1, 10));
    focus("session-scope-2", dayIso(1, 9), {
      verb: "set",
      item_number: 1,
      item_text_snapshot: "x",
    });

    const res = await fetch(
      `/api/focus-report?session_id=session-scope-1&from=${encodeURIComponent(dayIso(0))}&to=${encodeURIComponent(dayIso(2))}`
    );
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.sessions.map((s) => s.session_id),
      ["session-scope-1"]
    );
    assert.equal(res.body.session_id, "session-scope-1");
    assert.equal(res.body.project_id, null);
  });

  it("unknown session_id -> structured 404, not an empty 200", async () => {
    const res = await fetch(
      `/api/focus-report?session_id=does-not-exist&from=${encodeURIComponent(dayIso(0))}&to=${encodeURIComponent(dayIso(2))}`
    );
    assert.equal(res.status, 404);
    assert.equal(typeof res.body?.error?.code, "string");
  });
});

describe("GET /api/focus-report — ?sources= narrows; old route's non-support stays intentional", () => {
  it("?sources=local narrows to the matching-source session; omitting sources returns every source; the OLD route continues to ignore sources entirely", async () => {
    const CWD = "/tmp/focus-report-route-sources-test";
    const project = await createProject("Sources Gap Test", [CWD]);

    seedSession("sources-local", CWD, dayIso(1, 9), dayIso(1, 10));
    focus("sources-local", dayIso(1, 9), { verb: "set", item_number: 1, item_text_snapshot: "x" });

    seedSession("sources-remote", CWD, dayIso(1, 11), dayIso(1, 12));
    focus("sources-remote", dayIso(1, 11), {
      verb: "set",
      item_number: 1,
      item_text_snapshot: "x",
    });
    stmts.setSessionSource.run("src_remotebox", "sources-remote");

    const newNarrowed = await fetch(
      `/api/focus-report?project_id=${project.id}&sources=local&from=${encodeURIComponent(dayIso(0))}&to=${encodeURIComponent(dayIso(2))}`
    );
    assert.equal(newNarrowed.status, 200);
    assert.deepEqual(
      newNarrowed.body.sessions.map((s) => s.session_id),
      ["sources-local"]
    );

    const newUnfiltered = await fetch(
      `/api/focus-report?project_id=${project.id}&from=${encodeURIComponent(dayIso(0))}&to=${encodeURIComponent(dayIso(2))}`
    );
    assert.equal(newUnfiltered.status, 200);
    assert.deepEqual(newUnfiltered.body.sessions.map((s) => s.session_id).sort(), [
      "sources-local",
      "sources-remote",
    ]);

    // The OLD route has no `sources` param at all, and — deliberately, per
    // technical-plan.md §2/§5 — never filters by source either way. Calling
    // it "plain" must still surface BOTH sessions, pinning that this gap is
    // intentional and not something a future "helpful" fix silently closes.
    const oldRes = await fetch(`/api/projects/${project.id}/focus-report`);
    assert.equal(oldRes.status, 200);
    assert.deepEqual(oldRes.body.sessions.map((s) => s.session_id).sort(), [
      "sources-local",
      "sources-remote",
    ]);
  });
});

describe("GET /api/focus-report — split parity vs GET /api/projects/:id/focus-report", () => {
  const CWD = "/tmp/focus-report-route-parity-test";

  it("group (a): report-body deep-equal (sessions/items/totals) and equal (wall_clock_ms/concurrency_ratio) against the old route's real output", async () => {
    stmts.upsertPlan.run(CWD, "Parity test plan", `${CWD}/AGENT-PLAN.md`, "hash-parity", 1);
    stmts.upsertPlanItem.run(CWD, "item-4", 4, null, "Shared Backend", null, null, 0, 0);
    const project = await createProject("Parity Test", [CWD]);

    seedSession("parity-1", CWD, dayIso(1, 9, 0), dayIso(1, 10, 0));
    focus("parity-1", dayIso(1, 9, 0), {
      verb: "set",
      item_number: 4,
      item_text_snapshot: "Shared Backend",
    });
    focus("parity-1", dayIso(1, 9, 20), {
      verb: "bug",
      kind: "bug",
      title: "npm conflict",
      description: "npm conflict",
    });

    const wideFrom = dayIso(0);
    const wideTo = dayIso(3);

    const oldRes = await fetch(`/api/projects/${project.id}/focus-report`);
    const newRes = await fetch(
      `/api/focus-report?project_id=${project.id}&from=${encodeURIComponent(wideFrom)}&to=${encodeURIComponent(wideTo)}`
    );

    assert.equal(oldRes.status, 200);
    assert.equal(newRes.status, 200);

    // (a) report-body deep-equal, field-by-field — never a whole-object
    // deepEqual, since the envelopes below legitimately differ.
    assert.deepEqual(newRes.body.sessions, oldRes.body.sessions);
    assert.deepEqual(newRes.body.items, oldRes.body.items);
    assert.deepEqual(newRes.body.totals, oldRes.body.totals);
    assert.equal(newRes.body.wall_clock_ms, oldRes.body.wall_clock_ms);
    assert.equal(newRes.body.concurrency_ratio, oldRes.body.concurrency_ratio);
  });

  it("group (b): envelope echo-back is independent of (a) — new route echoes project_id/session_id, old route's body has NO session_id key at all", async () => {
    const project = await createProject("Parity Test Envelope", [
      "/tmp/focus-report-route-parity-envelope-test",
    ]);
    const CWD2 = "/tmp/focus-report-route-parity-envelope-test";
    seedSession("parity-envelope-1", CWD2, dayIso(1, 9), dayIso(1, 10));
    focus("parity-envelope-1", dayIso(1, 9), {
      verb: "set",
      item_number: 1,
      item_text_snapshot: "x",
    });

    const oldRes = await fetch(`/api/projects/${project.id}/focus-report`);
    const newRes = await fetch(
      `/api/focus-report?project_id=${project.id}&from=${encodeURIComponent(dayIso(0))}&to=${encodeURIComponent(dayIso(2))}`
    );

    assert.equal(newRes.body.project_id, project.id);
    assert.equal(newRes.body.session_id, null);
    // The old route's envelope legitimately has no session_id key at all -
    // this is the concrete guard against the "under-specified deep-equal"
    // trap: the two envelopes are different by design, asserted explicitly
    // rather than by stripping fields until a naive compare passes.
    assert.equal(oldRes.body.session_id, undefined);
    assert.ok(!("session_id" in oldRes.body));
  });

  it("zero-focus-data project produces the same well-shaped-empty-totals response shape as the old route", async () => {
    const project = await createProject("No folders (new route)", []);
    const res = await fetch(
      `/api/focus-report?project_id=${project.id}&from=${encodeURIComponent(dayIso(0))}&to=${encodeURIComponent(dayIso(2))}`
    );
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.sessions, []);
    assert.deepEqual(res.body.items, []);
    assert.equal(res.body.totals.wall_ms, 0);
    assert.ok(res.body.totals.by_kind.item);
    assert.ok(typeof res.body.idle_grace_seconds === "number");
  });

  it("never echoes from/to back in the response (contract-narrowness guard)", async () => {
    const project = await createProject("From-To Echo Guard", []);
    const res = await fetch(
      `/api/focus-report?project_id=${project.id}&from=${encodeURIComponent(dayIso(0))}&to=${encodeURIComponent(dayIso(2))}`
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.from, undefined);
    assert.equal(res.body.to, undefined);
  });
});
