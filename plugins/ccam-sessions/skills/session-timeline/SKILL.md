---
description: >
  Render an ordered timeline of one Claude Code session's events (every event type)
  with per-event durations and tool names, reconstructed from Agent Monitor data.
  Pairs PreToolUse with PostToolUse to compute tool durations and surfaces gaps,
  errors, and compaction points. Use when reconstructing what happened in a session
  step by step.
---

# Session Timeline

Reconstruct the chronological event timeline of a single Claude Code session.

## Input

The user provides: **$ARGUMENTS**

- A **session ID** to time-line, or
- "latest" / "last" for the most recent session.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/sessions/:id` | session header: status, model, cwd, started_at, ended_at, cost, metadata (thinking_blocks, turn_count, total_turn_duration_ms) — and nested events |
| `GET /api/events?session_id=X` | the full event stream: event_type (PreToolUse, PostToolUse, Stop, SubagentStop, SessionStart, SessionEnd, Notification, Compaction, APIError, TurnDuration), tool_name, summary, data, timestamp |

## Report Sections

### 1. Resolve & header
If "latest", `GET /api/sessions?limit=1` to get the id, then `GET /api/sessions/:id`.
Print a one-line header: id, status, model, cwd basename, started_at → ended_at,
turn_count, total_turn_duration_ms, cost.

### 2. Build the ordered timeline
`GET /api/events?session_id=X`. Sort strictly by `timestamp`. For each event emit a
row with: relative offset from `started_at` (e.g. `+00:03.412`), event_type,
tool_name (when present), and a one-line `summary`.

### 3. Compute durations
Pair each `PreToolUse` with its matching `PostToolUse` (same tool_name, next
occurrence) and show the tool's wall-clock duration. For `TurnDuration` events use
the recorded duration directly. Flag any `PreToolUse` with no matching `PostToolUse`
as **unclosed**.

### 4. Annotate notable points
Mark `APIError` (❌), `Compaction` (⚠️ context compressed), `SubagentStop`
(subagent finished), `Notification` (ℹ️), and any timeline gap > 30s between
consecutive events as an idle window.

### 5. Tallies
Event count by type, total tool time vs. session wall time, and the longest single
tool call.

## Output

A Markdown table — `offset | event_type | tool_name | duration | summary` — in
strict timestamp order, preceded by the header line and followed by the tallies.
Durations in ms or `mm:ss.mmm`; currency as USD to 4 decimal places. Never invent a
duration when a PostToolUse is missing — label it `unclosed`. If the dashboard is
unreachable, tell the user to start it with `npm start` from the repo root.
