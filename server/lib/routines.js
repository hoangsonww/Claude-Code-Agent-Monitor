/**
 * @file SQLite CRUD + scheduling-math layer for routines.
 *
 * Routines are templated agent jobs that fire on a schedule (manual / hourly /
 * daily / weekdays / weekly), or on demand via the API or a per-routine
 * webhook URL. Persisted across two tables: `routines` (the template) and
 * `routine_runs` (history). The pure helper `computeNextRun` advances the
 * next-fire wallclock from a schedule descriptor and a "from" timestamp, and
 * is unit-tested independently of the database.
 */
const { randomUUID, randomBytes } = require("node:crypto");
const { db } = require("../db");

const SCHEDULE_TYPES = ["manual", "hourly", "daily", "weekdays", "weekly"];

const SELECT = `SELECT id, name, description, instructions, cwd, worktree,
  permission_mode, model, schedule_type, schedule_minute, schedule_hour,
  schedule_minute_of_hour, schedule_dow, status, webhook_token,
  created_at, updated_at, last_run_at, next_run_at FROM routines`;

function row2routine(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    instructions: r.instructions,
    cwd: r.cwd,
    worktree: !!r.worktree,
    permissionMode: r.permission_mode,
    model: r.model,
    schedule: scheduleFromRow(r),
    status: r.status,
    webhookToken: r.webhook_token,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastRunAt: r.last_run_at,
    nextRunAt: r.next_run_at,
  };
}

function scheduleFromRow(r) {
  switch (r.schedule_type) {
    case "manual":
      return { type: "manual" };
    case "hourly":
      return { type: "hourly", minute: r.schedule_minute ?? 0 };
    case "daily":
      return {
        type: "daily",
        hour: r.schedule_hour ?? 9,
        minute: r.schedule_minute_of_hour ?? 0,
      };
    case "weekdays":
      return {
        type: "weekdays",
        hour: r.schedule_hour ?? 9,
        minute: r.schedule_minute_of_hour ?? 0,
      };
    case "weekly":
      return {
        type: "weekly",
        hour: r.schedule_hour ?? 9,
        minute: r.schedule_minute_of_hour ?? 0,
        dow: r.schedule_dow ?? 1,
      };
    default:
      return { type: "manual" };
  }
}

/**
 * Pure helper: given a schedule descriptor and a "from" wallclock (ms since
 * epoch), return the next fire time in ms, or `null` for manual schedules.
 *
 * The arithmetic uses the host's local time zone so a "Daily at 09:00"
 * routine fires at 09:00 in whatever zone the dashboard is running. Hourly
 * uses the next minute mark strictly after `fromTs`; the other types fall
 * to the next matching wall-clock instant.
 *
 * @param {object} schedule { type, minute?, hour?, dow? }
 * @param {number} fromTs ms since epoch
 * @returns {number|null}
 */
function computeNextRun(schedule, fromTs) {
  if (!schedule || !schedule.type) return null;
  switch (schedule.type) {
    case "manual":
      return null;
    case "hourly": {
      const minute = clampInt(schedule.minute, 0, 59, 0);
      const d = new Date(fromTs);
      d.setSeconds(0, 0);
      d.setMinutes(minute);
      if (d.getTime() <= fromTs) d.setHours(d.getHours() + 1);
      return d.getTime();
    }
    case "daily": {
      const hour = clampInt(schedule.hour, 0, 23, 9);
      const minute = clampInt(schedule.minute, 0, 59, 0);
      const d = new Date(fromTs);
      d.setSeconds(0, 0);
      d.setHours(hour, minute);
      if (d.getTime() <= fromTs) d.setDate(d.getDate() + 1);
      return d.getTime();
    }
    case "weekdays": {
      const hour = clampInt(schedule.hour, 0, 23, 9);
      const minute = clampInt(schedule.minute, 0, 59, 0);
      const d = new Date(fromTs);
      d.setSeconds(0, 0);
      d.setHours(hour, minute);
      if (d.getTime() <= fromTs) d.setDate(d.getDate() + 1);
      // Skip Sat (6) and Sun (0): bump until Mon-Fri.
      while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() + 1);
      }
      return d.getTime();
    }
    case "weekly": {
      const hour = clampInt(schedule.hour, 0, 23, 9);
      const minute = clampInt(schedule.minute, 0, 59, 0);
      const targetDow = clampInt(schedule.dow, 0, 6, 1);
      const d = new Date(fromTs);
      d.setSeconds(0, 0);
      d.setHours(hour, minute);
      // Walk forward until the day-of-week matches AND the time hasn't
      // already passed today.
      while (d.getDay() !== targetDow || d.getTime() <= fromTs) {
        d.setDate(d.getDate() + 1);
      }
      return d.getTime();
    }
    default:
      return null;
  }
}

function clampInt(v, min, max, fallback) {
  const n = Number.isFinite(v) ? Math.trunc(v) : fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function validateSchedule(schedule) {
  if (!schedule || typeof schedule !== "object") {
    return { ok: false, error: "schedule required" };
  }
  if (!SCHEDULE_TYPES.includes(schedule.type)) {
    return { ok: false, error: "invalid schedule.type" };
  }
  if (schedule.type === "hourly") {
    if (!isInt(schedule.minute, 0, 59)) {
      return { ok: false, error: "schedule.minute must be 0-59" };
    }
  }
  if (schedule.type === "daily" || schedule.type === "weekdays" || schedule.type === "weekly") {
    if (!isInt(schedule.hour, 0, 23)) {
      return { ok: false, error: "schedule.hour must be 0-23" };
    }
    if (!isInt(schedule.minute, 0, 59)) {
      return { ok: false, error: "schedule.minute must be 0-59" };
    }
  }
  if (schedule.type === "weekly" && !isInt(schedule.dow, 0, 6)) {
    return { ok: false, error: "schedule.dow must be 0-6" };
  }
  return { ok: true };
}

function isInt(v, min, max) {
  return Number.isFinite(v) && Math.trunc(v) === v && v >= min && v <= max;
}

function scheduleToColumns(schedule) {
  switch (schedule.type) {
    case "manual":
      return { schedule_type: "manual", schedule_minute: null, schedule_hour: null, schedule_minute_of_hour: null, schedule_dow: null };
    case "hourly":
      return { schedule_type: "hourly", schedule_minute: schedule.minute ?? 0, schedule_hour: null, schedule_minute_of_hour: null, schedule_dow: null };
    case "daily":
      return { schedule_type: "daily", schedule_minute: null, schedule_hour: schedule.hour ?? 9, schedule_minute_of_hour: schedule.minute ?? 0, schedule_dow: null };
    case "weekdays":
      return { schedule_type: "weekdays", schedule_minute: null, schedule_hour: schedule.hour ?? 9, schedule_minute_of_hour: schedule.minute ?? 0, schedule_dow: null };
    case "weekly":
      return { schedule_type: "weekly", schedule_minute: null, schedule_hour: schedule.hour ?? 9, schedule_minute_of_hour: schedule.minute ?? 0, schedule_dow: schedule.dow ?? 1 };
    default:
      return { schedule_type: "manual", schedule_minute: null, schedule_hour: null, schedule_minute_of_hour: null, schedule_dow: null };
  }
}

function create(input) {
  const v = validateInput(input, { creating: true });
  if (!v.ok) throw new Error(v.error);
  const id = randomUUID();
  const token = randomBytes(24).toString("hex");
  const now = Date.now();
  const cols = scheduleToColumns(input.schedule);
  const nextRun = computeNextRun(input.schedule, now);
  db.prepare(
    `INSERT INTO routines (id, name, description, instructions, cwd, worktree,
       permission_mode, model, schedule_type, schedule_minute, schedule_hour,
       schedule_minute_of_hour, schedule_dow, status, webhook_token,
       created_at, updated_at, last_run_at, next_run_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
  ).run(
    id,
    input.name,
    input.description,
    input.instructions,
    input.cwd,
    input.worktree ? 1 : 0,
    input.permissionMode || "default",
    input.model || null,
    cols.schedule_type,
    cols.schedule_minute,
    cols.schedule_hour,
    cols.schedule_minute_of_hour,
    cols.schedule_dow,
    input.status || "active",
    token,
    now,
    now,
    nextRun,
  );
  return get(id);
}

function validateInput(input, { creating }) {
  if (!input || typeof input !== "object") return { ok: false, error: "input must be an object" };
  if (creating || input.name !== undefined) {
    if (typeof input.name !== "string" || input.name.length < 1 || input.name.length > 80) {
      return { ok: false, error: "name must be 1-80 chars" };
    }
  }
  if (creating || input.description !== undefined) {
    if (typeof input.description !== "string" || input.description.length < 1 || input.description.length > 280) {
      return { ok: false, error: "description must be 1-280 chars" };
    }
  }
  if (creating || input.instructions !== undefined) {
    if (typeof input.instructions !== "string" || input.instructions.length < 1 || input.instructions.length > 8000) {
      return { ok: false, error: "instructions must be 1-8000 chars" };
    }
  }
  if (creating || input.cwd !== undefined) {
    if (typeof input.cwd !== "string" || !input.cwd.length) {
      return { ok: false, error: "cwd is required" };
    }
  }
  if (creating || input.schedule !== undefined) {
    const sv = validateSchedule(input.schedule);
    if (!sv.ok) return sv;
  }
  if (input.permissionMode !== undefined) {
    const allowed = ["default", "acceptEdits", "plan", "auto", "dontAsk", "bypassPermissions"];
    if (!allowed.includes(input.permissionMode)) {
      return { ok: false, error: "invalid permissionMode" };
    }
  }
  if (input.status !== undefined && !["active", "disabled"].includes(input.status)) {
    return { ok: false, error: "status must be active|disabled" };
  }
  return { ok: true };
}

function get(id) {
  return row2routine(db.prepare(`${SELECT} WHERE id = ?`).get(id));
}

function list({ includeDisabled = false } = {}) {
  const rows = includeDisabled
    ? db.prepare(`${SELECT} ORDER BY (next_run_at IS NULL), next_run_at ASC, created_at DESC`).all()
    : db
        .prepare(`${SELECT} WHERE status = 'active' ORDER BY (next_run_at IS NULL), next_run_at ASC, created_at DESC`)
        .all();
  return rows.map(row2routine);
}

function update(id, patch) {
  const cur = get(id);
  if (!cur) throw new Error("not found");
  const v = validateInput(patch, { creating: false });
  if (!v.ok) throw new Error(v.error);
  const next = {
    name: patch.name ?? cur.name,
    description: patch.description ?? cur.description,
    instructions: patch.instructions ?? cur.instructions,
    cwd: patch.cwd ?? cur.cwd,
    worktree: patch.worktree !== undefined ? !!patch.worktree : cur.worktree,
    permissionMode: patch.permissionMode ?? cur.permissionMode,
    model: patch.model !== undefined ? patch.model : cur.model,
    schedule: patch.schedule ?? cur.schedule,
    status: patch.status ?? cur.status,
  };
  const cols = scheduleToColumns(next.schedule);
  const now = Date.now();
  // Recompute next_run_at when the schedule changed or status flipped to active.
  const scheduleChanged = patch.schedule !== undefined;
  const reactivated = patch.status === "active" && cur.status !== "active";
  let nextRun = cur.nextRunAt;
  if (scheduleChanged || reactivated) {
    nextRun = next.status === "active" ? computeNextRun(next.schedule, now) : null;
  }
  if (next.status === "disabled") nextRun = null;
  db.prepare(
    `UPDATE routines SET name = ?, description = ?, instructions = ?, cwd = ?,
       worktree = ?, permission_mode = ?, model = ?, schedule_type = ?,
       schedule_minute = ?, schedule_hour = ?, schedule_minute_of_hour = ?,
       schedule_dow = ?, status = ?, updated_at = ?, next_run_at = ?
     WHERE id = ?`,
  ).run(
    next.name,
    next.description,
    next.instructions,
    next.cwd,
    next.worktree ? 1 : 0,
    next.permissionMode,
    next.model || null,
    cols.schedule_type,
    cols.schedule_minute,
    cols.schedule_hour,
    cols.schedule_minute_of_hour,
    cols.schedule_dow,
    next.status,
    now,
    nextRun,
    id,
  );
  return get(id);
}

function remove(id) {
  db.prepare(`DELETE FROM routines WHERE id = ?`).run(id);
}

function setStatus(id, status) {
  const cur = get(id);
  if (!cur) throw new Error("not found");
  if (!["active", "disabled"].includes(status)) throw new Error("invalid status");
  const now = Date.now();
  const nextRun = status === "active" ? computeNextRun(cur.schedule, now) : null;
  db.prepare(`UPDATE routines SET status = ?, updated_at = ?, next_run_at = ? WHERE id = ?`).run(status, now, nextRun, id);
  return get(id);
}

function recordRun(routineId, { trigger, status = "spawning", agentHandleId = null, startedAt }) {
  const id = randomUUID();
  const ts = startedAt || Date.now();
  db.prepare(
    `INSERT INTO routine_runs (id, routine_id, agent_handle_id, trigger, status, started_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, routineId, agentHandleId, trigger, status, ts);
  // Touch last_run_at and advance next_run_at for scheduled triggers.
  const r = get(routineId);
  if (r) {
    let nextRun = r.nextRunAt;
    if (r.status === "active") {
      nextRun = computeNextRun(r.schedule, ts);
    }
    db.prepare(`UPDATE routines SET last_run_at = ?, next_run_at = ? WHERE id = ?`).run(ts, nextRun, routineId);
  }
  return id;
}

function attachAgentHandle(runId, agentHandleId) {
  db.prepare(`UPDATE routine_runs SET agent_handle_id = ? WHERE id = ?`).run(agentHandleId, runId);
}

function completeRun(runId, { status, exit_code = null, output_summary = null, ended_at }) {
  db.prepare(
    `UPDATE routine_runs SET status = ?, exit_code = ?, output_summary = ?, ended_at = ? WHERE id = ?`,
  ).run(status, exit_code, output_summary, ended_at || Date.now(), runId);
}

function getRun(runId) {
  return db.prepare(`SELECT * FROM routine_runs WHERE id = ?`).get(runId) || null;
}

function listRuns(routineId, limit = 25) {
  return db
    .prepare(`SELECT * FROM routine_runs WHERE routine_id = ? ORDER BY started_at DESC LIMIT ?`)
    .all(routineId, limit);
}

function dueNow(now) {
  return db
    .prepare(`${SELECT} WHERE status = 'active' AND next_run_at IS NOT NULL AND next_run_at <= ?`)
    .all(now)
    .map(row2routine);
}

module.exports = {
  create,
  list,
  get,
  update,
  remove,
  setStatus,
  recordRun,
  attachAgentHandle,
  completeRun,
  getRun,
  listRuns,
  dueNow,
  computeNextRun,
  validateSchedule,
  SCHEDULE_TYPES,
};
