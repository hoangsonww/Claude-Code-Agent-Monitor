---
description: >
  Discover when you are most active and most productive with Claude Code by
  bucketing sessions and events into hour-of-day and day-of-week bins from their
  timestamps, then flagging peak versus low-output windows. Uses the session
  list, per-session events, and analytics daily trends. Use when planning a
  schedule or deciding when to do deep work versus lighter tasks.
---

# Time of Day

Profile activity and productivity across the hours of the day and days of the week.

## Input

The user provides: **$ARGUMENTS**

This may be:
- empty or "all" (default: all available sessions)
- a window like "last 30 days" or "last 90 days" to limit the analysis
- a project path to scope the analysis to one `cwd`

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/sessions?limit=500` | Sessions with `started_at`, `ended_at`, `status`, `cwd`, `cost`, and `metadata` (turn_count, total_turn_duration_ms) — primary source for hour/weekday bucketing |
| `GET /api/events?session_id=X` | Events with `timestamp` and `event_type` (PreToolUse, PostToolUse, Stop, Compaction, APIError, etc.) — finer-grained activity within sessions and error timing |
| `GET /api/analytics` | `daily_sessions` / `daily_events` (365d) and `sessions_by_status` for trend context and completion baselines |

## Report Sections

### 1. Activity by Hour of Day
Bucket sessions (by `started_at`) and events (by `timestamp`) into 24 hourly bins.
Show a text bar chart of session and event counts per hour. Identify the busiest
hours by raw volume.

### 2. Productivity by Hour of Day
For each hour bin, compute completion rate (`completed / total` sessions started in
that hour) and average sustained turn time
(`total_turn_duration_ms / turn_count`, ms → minutes). Distinguish "active" hours
(high volume) from "productive" hours (high completion + sustained turns).

### 3. Day-of-Week Pattern
Bucket the same metrics into 7 weekday bins. Table: weekday, sessions, completion
rate, avg cost, dominant model.

### 4. Peak vs. Low-Output Windows
- **Peak windows:** hours/days with high completion rate and long sustained turns.
- **Low-output windows:** hours/days with high abandonment/error/Compaction rates
  or fragmented short turns. Pull error timing from `/api/events` event types
  (APIError, Compaction) to corroborate.

### 5. Schedule Recommendation
Suggest which hour/weekday blocks to reserve for deep work and which to use for
lighter or shallower tasks, grounded in the buckets above.

## Output

- Markdown with text-based bar charts (e.g., `09:00 ████████ 24`) for the hourly
  and weekday distributions.
- Tables for the hour and weekday metrics; ▲ / ▼ for above/below the overall mean.
- Currency in USD to 4 decimals; durations in minutes (convert from ms).
- Cite only numbers from the API. State how many sessions/events were bucketed and
  exclude sessions missing `started_at` or the focus metadata, noting the count.
