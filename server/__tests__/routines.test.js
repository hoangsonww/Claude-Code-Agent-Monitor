/**
 * @file Tests for the routines DB layer + the pure computeNextRun helper.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

function freshLib() {
  process.env.DASHBOARD_DB_PATH = ":memory:";
  delete require.cache[require.resolve("../db")];
  delete require.cache[require.resolve("../lib/routines")];
  return require("../lib/routines");
}

describe("computeNextRun", () => {
  it("manual schedules return null", () => {
    const { computeNextRun } = freshLib();
    assert.strictEqual(computeNextRun({ type: "manual" }, Date.now()), null);
  });

  it("hourly fires at the next minute mark", () => {
    const { computeNextRun } = freshLib();
    // 10:30:00 local — minute=15 should jump to 11:15:00.
    const from = new Date(2026, 4, 7, 10, 30, 0).getTime();
    const next = computeNextRun({ type: "hourly", minute: 15 }, from);
    const d = new Date(next);
    assert.strictEqual(d.getMinutes(), 15);
    assert.strictEqual(d.getHours(), 11);
  });

  it("hourly with same-hour future minute fires this hour", () => {
    const { computeNextRun } = freshLib();
    const from = new Date(2026, 4, 7, 10, 5, 0).getTime();
    const next = computeNextRun({ type: "hourly", minute: 30 }, from);
    const d = new Date(next);
    assert.strictEqual(d.getHours(), 10);
    assert.strictEqual(d.getMinutes(), 30);
  });

  it("daily today-future fires today; today-past rolls to tomorrow", () => {
    const { computeNextRun } = freshLib();
    const today8am = new Date(2026, 4, 7, 8, 0, 0).getTime();
    const future = computeNextRun({ type: "daily", hour: 9, minute: 0 }, today8am);
    assert.strictEqual(new Date(future).getDate(), 7);
    assert.strictEqual(new Date(future).getHours(), 9);

    const today10am = new Date(2026, 4, 7, 10, 0, 0).getTime();
    const tomorrow = computeNextRun({ type: "daily", hour: 9, minute: 0 }, today10am);
    assert.strictEqual(new Date(tomorrow).getDate(), 8);
    assert.strictEqual(new Date(tomorrow).getHours(), 9);
  });

  it("weekdays skips Sat/Sun", () => {
    const { computeNextRun } = freshLib();
    // Friday 2026-05-08 at 10:00 — schedule daily-9am — next is Mon 2026-05-11.
    // (May 7 2026 is Thu; May 8 Fri; May 9 Sat; May 10 Sun; May 11 Mon)
    const friAt10 = new Date(2026, 4, 8, 10, 0, 0).getTime();
    const next = computeNextRun({ type: "weekdays", hour: 9, minute: 0 }, friAt10);
    const d = new Date(next);
    assert.strictEqual(d.getDay(), 1, "should land on a Monday");
    assert.strictEqual(d.getDate(), 11);
  });

  it("weekly lands on the requested day-of-week", () => {
    const { computeNextRun } = freshLib();
    // Wed 2026-05-06 noon — request weekly Friday (dow=5) at 10:00.
    const wedNoon = new Date(2026, 4, 6, 12, 0, 0).getTime();
    const next = computeNextRun({ type: "weekly", hour: 10, minute: 0, dow: 5 }, wedNoon);
    const d = new Date(next);
    assert.strictEqual(d.getDay(), 5);
    assert.strictEqual(d.getHours(), 10);
  });

  it("weekly on the same DOW rolls forward when time has passed", () => {
    const { computeNextRun } = freshLib();
    // Friday 2026-05-08 at 11:00 — weekly Friday at 10:00 should be next Friday.
    const friAt11 = new Date(2026, 4, 8, 11, 0, 0).getTime();
    const next = computeNextRun({ type: "weekly", hour: 10, minute: 0, dow: 5 }, friAt11);
    const d = new Date(next);
    assert.strictEqual(d.getDay(), 5);
    assert.strictEqual(d.getDate(), 15); // next Friday
  });
});

describe("routines lib CRUD", () => {
  it("create() generates id + token + computes next_run_at", () => {
    const r = freshLib();
    const created = r.create({
      name: "test",
      description: "d",
      instructions: "do a thing",
      cwd: "/tmp",
      schedule: { type: "manual" },
    });
    assert.ok(created.id);
    assert.ok(created.webhookToken && created.webhookToken.length >= 48);
    assert.strictEqual(created.nextRunAt, null);
    assert.strictEqual(created.status, "active");
  });

  it("create() rejects too-long name", () => {
    const r = freshLib();
    assert.throws(
      () =>
        r.create({
          name: "a".repeat(81),
          description: "d",
          instructions: "x",
          cwd: "/tmp",
          schedule: { type: "manual" },
        }),
      /name must be 1-80/,
    );
  });

  it("update() recomputes next_run_at when schedule changes", () => {
    const r = freshLib();
    const c = r.create({
      name: "n",
      description: "d",
      instructions: "x",
      cwd: "/tmp",
      schedule: { type: "manual" },
    });
    assert.strictEqual(c.nextRunAt, null);
    const u = r.update(c.id, { schedule: { type: "daily", hour: 9, minute: 0 } });
    assert.ok(u.nextRunAt && u.nextRunAt > Date.now() - 1000);
  });

  it("setStatus(disabled) clears next_run_at; reactivation recomputes it", () => {
    const r = freshLib();
    const c = r.create({
      name: "n",
      description: "d",
      instructions: "x",
      cwd: "/tmp",
      schedule: { type: "daily", hour: 9, minute: 0 },
    });
    assert.ok(c.nextRunAt);
    const off = r.setStatus(c.id, "disabled");
    assert.strictEqual(off.nextRunAt, null);
    const on = r.setStatus(c.id, "active");
    assert.ok(on.nextRunAt);
  });

  it("dueNow() returns active routines whose next_run_at <= now", () => {
    const r = freshLib();
    r.create({
      name: "soon",
      description: "d",
      instructions: "x",
      cwd: "/tmp",
      schedule: { type: "manual" },
    });
    // Manually create one with a backdated next_run_at by going through
    // create() then update() to set schedule, then forcing the column.
    const c = r.create({
      name: "ready",
      description: "d",
      instructions: "x",
      cwd: "/tmp",
      schedule: { type: "daily", hour: 9, minute: 0 },
    });
    // Force next_run_at into the past via direct DB write.
    const { db } = require("../db");
    db.prepare("UPDATE routines SET next_run_at = ? WHERE id = ?").run(Date.now() - 1000, c.id);
    const due = r.dueNow(Date.now());
    assert.ok(due.find((x) => x.id === c.id));
  });

  it("recordRun + listRuns + completeRun roundtrip", () => {
    const r = freshLib();
    const c = r.create({
      name: "n",
      description: "d",
      instructions: "x",
      cwd: "/tmp",
      schedule: { type: "manual" },
    });
    const runId = r.recordRun(c.id, { trigger: "manual" });
    r.completeRun(runId, { status: "completed", exit_code: 0, output_summary: "ok" });
    const runs = r.listRuns(c.id);
    assert.strictEqual(runs.length, 1);
    assert.strictEqual(runs[0].status, "completed");
    assert.strictEqual(runs[0].exit_code, 0);
  });

  it("list({ includeDisabled }) honors the filter", () => {
    const r = freshLib();
    const a = r.create({
      name: "a",
      description: "d",
      instructions: "x",
      cwd: "/tmp",
      schedule: { type: "manual" },
    });
    const b = r.create({
      name: "b",
      description: "d",
      instructions: "x",
      cwd: "/tmp",
      schedule: { type: "manual" },
    });
    r.setStatus(b.id, "disabled");
    const visible = r.list({ includeDisabled: false });
    assert.deepStrictEqual(
      visible.map((x) => x.id).sort(),
      [a.id].sort(),
    );
    const all = r.list({ includeDisabled: true });
    assert.strictEqual(all.length, 2);
  });
});
