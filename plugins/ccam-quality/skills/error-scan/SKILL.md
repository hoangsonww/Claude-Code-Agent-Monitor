---
description: >
  Scan recent Claude Code activity for errors and failure signals across all
  sessions using Agent Monitor data — APIError events and PreToolUse→PostToolUse
  gaps (tools that started but never completed) — then group failures by tool and
  model and rank them by frequency. Use when checking for errors or asking
  "what's failing right now".
---

# Error Scan

Sweep recent events across sessions for error and failure signals, then rank them
by how often they occur and which tool or model produced them.

## Input

The user provides: **$ARGUMENTS**

This may be:
- empty or "all" — scan every failure signal (default)
- "api" — APIError events only
- "tools" — tool-failure gaps only
- a number N — limit the scan to the most recent N sessions
- a session ID — scan a single session

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/analytics` | `event_types` (counts per type incl. PreToolUse, PostToolUse, APIError), `tool_usage` (top 20), `daily_events` (365d) — fleet-wide failure baseline |
| `GET /api/events?session_id=X` | Per-session event stream: `event_type`, `tool_name`, `summary`, `data`, `timestamp` — locate `APIError` and unmatched `PreToolUse` |
| `GET /api/sessions?limit=N` | Sessions with `id`, `status`, `model`, `started_at` — pick the recent window and attribute failures to a model |

## Report Sections

### 1. Scope
Resolve `$ARGUMENTS` to a session set: pull `GET /api/sessions?limit=N` (default 50, ordered by `started_at`). Report how many sessions and what time span are covered.

### 2. Fleet Failure Counts
From `GET /api/analytics` `event_types`, report total `APIError` count and the PreToolUse→PostToolUse gap: `gap = PreToolUse − PostToolUse` (unmatched tool starts = likely failures). State both as raw counts and as a share of `total_events`.

### 3. Group by Tool
For each session in scope, pull `GET /api/events?session_id=X`. Match each `PreToolUse` to its following `PostToolUse` by `tool_name`; unmatched starts are failures. Aggregate failures and `APIError` events per `tool_name`. Rank tools by failure frequency (descending).

### 4. Group by Model
Join failures to the owning session's `model` (from `GET /api/sessions`). Rank models by APIError count and tool-failure count.

### 5. Top Offenders
List the single most failure-prone tool, the most error-prone model, and the session with the most failures, each with its exact count and one-line `summary` excerpt from a representative event.

## Output

- A ranked Markdown table: tool/model | APIError count | tool-failure (gap) count | total failures | share of events.
- Rates as percentages to 2 decimals.
- Cite exact `event_type`, `tool_name`, and `session_id` values — never fabricate counts.
- End with the one failure pattern most worth investigating and a concrete next step.
- Read-only: only report what the API returns. If `curl` cannot reach `http://localhost:4820`, tell the user to start the dashboard with `npm start` from the repo root.
