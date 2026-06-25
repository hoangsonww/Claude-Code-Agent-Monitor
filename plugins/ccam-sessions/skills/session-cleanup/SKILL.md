---
description: >
  Identify stale and empty Claude Code sessions in the Agent Monitor and explain the
  cleanup endpoint (POST /api/settings/cleanup), always showing the exact list of
  what WOULD be removed before anything is deleted. Cleanup permanently deletes data,
  so this skill previews first and requires explicit user confirmation. Use when
  tidying the monitoring database.
---

# Session Cleanup

Find prune-worthy sessions and explain cleanup — preview first, delete only on
explicit confirmation.

## Input

The user provides: **$ARGUMENTS**

- Empty / `preview` → only show what would be removed (the safe default).
- `confirm` → the user has reviewed the preview and explicitly authorizes deletion.
- An optional staleness threshold (e.g. `older than 7d`) for what counts as stale.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/sessions?limit=N` | session list: id, status, model, cwd, started_at, ended_at, cost, metadata (turn_count, total_turn_duration_ms) |
| `GET /api/stats` | totals: total_sessions, active_sessions, total_events, events_today, sessions_by_status, agents_by_status |
| `POST /api/settings/cleanup` | runs the cleanup routine and returns what was removed — DESTRUCTIVE, only after confirmation |

## Report Sections

### 1. Baseline
`GET /api/stats` — record total_sessions, sessions_by_status, total_events. This is
the before-state to compare against.

### 2. Identify candidates
`GET /api/sessions?limit=1000`. Flag sessions that are:
- **Empty** — zero events and `turn_count` 0 / null and `cost` 0 (started but never
  did anything).
- **Stale active** — `status` active/working but last activity older than the
  threshold (default 24h), i.e. never cleanly stopped.
- **Truncated** — no `ended_at` and no recent events.

### 3. Preview table (ALWAYS shown)
List every candidate with the reason it qualifies. State the total count and confirm
that **nothing has been deleted yet**.

### 4. Explain the endpoint
Describe `POST /api/settings/cleanup`: it prunes empty / orphaned sessions and their
dangling events server-side and returns a summary of removed rows. Make clear this
is **permanent** and **not reversible** from the dashboard.

### 5. Execute only on confirmation
If — and only if — `$ARGUMENTS` is `confirm` (or the user has explicitly approved
this run), call `POST /api/settings/cleanup`, then re-read `/api/stats` and report
the before → after delta. Otherwise stop after the preview and tell the user to
re-run with `confirm`.

## Output

A preview Markdown table: `id (short) | status | reason | cwd basename | started_at | cost`,
then a one-line count and the explicit "nothing deleted — re-run with `confirm` to
proceed" notice. On a confirmed run, add a before → after summary using ▲/▼ on the
counts. Currency as USD to 4 decimal places.

## Safety

- This is the ONLY skill in the plugin that mutates data, and only via the one
  documented endpoint.
- NEVER call `POST /api/settings/cleanup` without an explicit `confirm` from the
  user in this turn — previewing is the default.
- Never widen scope to `POST /api/settings/clear-data` or any other destructive
  endpoint; cleanup of stale/empty sessions only.
- If the dashboard is unreachable, tell the user to start it with `npm start` from
  the repo root.
