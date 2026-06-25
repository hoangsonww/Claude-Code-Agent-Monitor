---
description: >
  Audit hook delivery health from Agent Monitor data — balance PreToolUse vs
  PostToolUse (a gap means tools that started but never reported back), detect
  missing Stop/SubagentStop terminators (sessions/subagents that never closed),
  and check for stale ingestion (no recent events). Use when hooks look
  unreliable or events seem to be dropping.
---

# Hook Failure Audit

Assess whether the hook pipeline is delivering events reliably, using the event
counts and stream the dashboard already has. This is about *delivery* health
(missing/dropped events), not about why a model errored.

## Input

The user provides: **$ARGUMENTS**

This may be:
- empty or "all" — run every check (default)
- "balance" — PreToolUse/PostToolUse balance only
- "terminators" — missing Stop/SubagentStop only
- "freshness" — stale-ingestion check only

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/analytics` | `event_types` (counts per type: PreToolUse, PostToolUse, Stop, SubagentStop, SessionStart, SessionEnd), `daily_events` (365d), `total_subagents`, `sessions_by_status` — fleet-wide delivery balance |
| `GET /api/stats` | `total_sessions`, `total_agents`, `total_events`, `events_today` — expected terminator counts and recency |
| `GET /api/events?session_id=X` | Per-session stream — confirm which sessions are missing a `PostToolUse`, `Stop`, or `SubagentStop` |

## Report Sections

### 1. PreToolUse / PostToolUse Balance
From `GET /api/analytics` `event_types`: `gap = PreToolUse − PostToolUse`. A positive gap means tools whose completion hook never arrived. Report the gap as a count and as a percentage of `PreToolUse`. A healthy pipeline keeps this near 0%.

### 2. Missing Terminators
Compare `Stop` count against completed sessions (`sessions_by_status`) and `SubagentStop` against `total_subagents`/`total_agents` (from `/api/stats`). A shortfall means sessions or subagents that ran but never emitted a closing hook — likely dropped delivery or a crashed handler. Report expected vs observed for each.

### 3. Stale Ingestion
Check `events_today` from `/api/stats` and the tail of `daily_events` from analytics. If recent days are empty while sessions exist, ingestion has stalled. Report the most recent day with events and how long ago that was.

### 4. Localize
For the sessions with the largest gaps or missing terminators, pull `GET /api/events?session_id=X` and confirm which specific hook types are absent. List the offending session IDs.

## Output

- A check-by-check report with a PASS / WARN / FAIL marker each (✅ / ⚠️ / ❌) and the expected-vs-observed numbers.
- Rates as percentages to 2 decimals.
- Cite exact `event_type` counts and `session_id` values — never fabricate.
- End with an overall verdict (e.g., "4/4 checks passed" or "hook delivery DEGRADED") and the single highest-impact remediation (e.g., reinstall hooks via the dashboard Settings, or restart the server with `npm start`).
- Read-only: only report what the API returns. If `curl` cannot reach `http://localhost:4820`, tell the user to start the dashboard with `npm start` from the repo root.
