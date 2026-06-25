---
description: >
  Trace the full event chain for one Claude Code session into an ordered
  timeline of every event type with tool_name and summary, highlighting gaps,
  out-of-order events, and failures. Reads /api/events?session_id= and
  /api/sessions/:id from the Agent Monitor dashboard. Use when debugging what a
  session actually did, step by step.
---

# Event Trace

Build a chronological, annotated event timeline for a single session.

## Input

The user provides: **$ARGUMENTS**

This is a session ID. It may also be:
- `latest` / `last` — trace the most recently updated session
- `errors` — trace the most recent session whose status is `error`

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/sessions?limit=N` | session list (used to resolve `latest`/`errors` and the target id) |
| `GET /api/sessions/:id` | full session detail (status, model, cwd, started_at, ended_at, cost, nested agents + events) |
| `GET /api/events?session_id=X` | the ordered event stream: event_type, tool_name, summary, data, timestamp |

## Report Sections

### 1. Resolve the session
If `$ARGUMENTS` is a raw id, use it. If `latest`/`last`, call
`GET /api/sessions?limit=1`. If `errors`, call
`GET /api/sessions?limit=10&status=error` and pick the newest. Confirm the id
resolves via `GET /api/sessions/:id`; if not, report it as missing and stop.

### 2. Session header
From `GET /api/sessions/:id`: id, status, model, cwd, started_at → ended_at,
total duration, cost (USD to 4 decimals), and counts (events, agents).

### 3. Ordered timeline
From `GET /api/events?session_id=X`, list every event in timestamp order. One row
per event:

`| # | time | Δ since prev | event_type | tool_name | summary |`

Cover all event types present: SessionStart, PreToolUse, PostToolUse, Stop,
SubagentStop, Compaction, APIError, TurnDuration, Notification, SessionEnd.

### 4. Gap & failure highlights
Annotate the timeline:
- **Gaps**: any Δ > 30s between consecutive events — mark ⏳ and note the wait.
- **Unpaired tool calls**: a PreToolUse with no matching PostToolUse (same
  tool_name, next in stream) — mark ⚠️ "no completion recorded".
- **Failures**: APIError events and PostToolUse whose `summary`/`data` indicates
  an error — mark ❌ with the error text.
- **Compaction**: mark ♻️ and note it resets the visible token baseline.
- **Missing bookends**: no SessionStart at the head or no Stop/SessionEnd at the
  tail of an ended session — mark 🚩.

### 5. Verdict
One line: CLEAN, GAPS DETECTED, or FAILURES PRESENT — with the count of each
flag type and the single most likely thing to investigate next.

## Output

- Markdown timeline table, events in strict timestamp order.
- Status glyphs inline: ✅ ok, ❌ error, ⚠️ warning/unpaired, ⏳ gap, ♻️ compaction, 🚩 missing bookend.
- Currency in USD to 4 decimals.
- Cite only event data returned by the API — do not invent timestamps or summaries.
- If the dashboard is unreachable, tell the user to start it with `npm start` from the repo root.
