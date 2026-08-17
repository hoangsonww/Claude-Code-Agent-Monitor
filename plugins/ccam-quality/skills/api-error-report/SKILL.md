---
name: api-error-report
description: >
  Produce a detailed report on APIError events from Agent Monitor data — counts
  over time, which sessions and models are affected, and the likely root cause
  (rate limits, overload/529, or context-window pressure) inferred from each
  event's summary and data payload. Use when API errors spike or when you need to
  explain why requests are failing.
---

# API Error Report

Drill into `APIError` events: how many, when, where, and most likely why.

## Input

The user provides: **$ARGUMENTS**

This may be:
- empty or "all" — report on every APIError in the recent window (default)
- a session ID — report APIErrors for that one session only
- a window like "today" or "last 7d" — restrict the time range
- a cause filter: "rate-limit", "overload", or "context"

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/analytics` | `event_types` (total `APIError` count), `daily_events` (365d) — APIError volume and trend over time |
| `GET /api/events?session_id=X` | Per-session event stream — each `APIError` carries `summary`, `data`, and `timestamp` used to classify the cause |
| `GET /api/sessions?limit=N` | Sessions with `id`, `model`, `started_at` — attribute each error to a model and place it on the timeline |

## Report Sections

### 1. Volume & Trend
From `GET /api/analytics`: total `APIError` count and its share of `total_events`. Use `daily_events` to chart APIErrors over the requested window and flag any day that spikes above the window mean.

### 2. Affected Sessions & Models
For each session in scope, pull `GET /api/events?session_id=X` and collect `APIError` events. Group by `session_id` and, via `GET /api/sessions`, by `model`. Report the top affected sessions and which model accounts for the most errors.

### 3. Likely Cause Classification
Inspect each error's `summary`/`data` and bucket it:
- **Rate limit** — mentions 429, "rate limit", "quota", or retry-after.
- **Overload** — mentions 529, "overloaded", or capacity.
- **Context** — mentions context length, token limit, or "too long" (correlate with nearby `Compaction` events).
- **Other** — anything else; quote the `summary`.
Report the count and percentage in each bucket.

### 4. Timeline
List the most recent APIErrors with `timestamp`, `session_id`, `model`, classified cause, and a one-line `summary` excerpt.

## Output

- A Markdown table per section (volume, by model, by cause).
- Rates as percentages to 2 decimals; any currency in USD to 4 decimals.
- Cite exact `session_id`, `model`, `timestamp`, and `summary` values — never invent a cause not supported by the payload; bucket as "Other" when unclear.
- End with the dominant cause and a concrete mitigation (e.g., back off and retry on 529, reduce context to cut context errors, slow request rate on 429).
- Read-only: only report what the API returns. If `curl` cannot reach `http://localhost:4820`, tell the user to start the dashboard with `npm start` from the repo root.
