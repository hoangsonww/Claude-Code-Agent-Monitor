---
description: >
  Detect quality and efficiency regressions over time using Agent Monitor data —
  rising error rate (APIError events), falling cache hit rate, growing compaction
  frequency, and climbing cost-per-session. Splits history into an earlier
  baseline window and a recent window and reports which metrics are getting
  worse, by how much, and where. Use when checking whether things are degrading
  or trending in the wrong direction.
---

# Regression Watch

Detect whether Claude Code sessions are getting worse over time across quality and
efficiency metrics, using Agent Monitor data.

## Input

The user provides: **$ARGUMENTS**

This may be:
- empty or "all" — check every regression metric (default)
- "errors" — error-rate regression only
- "cache" — cache hit-rate regression only
- "compaction" — compaction-frequency regression only
- "cost" — cost-per-session regression only
- A window like "last 30d" or "30 vs 90" — set the recent vs baseline window sizes

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/analytics` | `daily_events` (365d), `daily_sessions` (365d), `event_types`, `tokens` (total_input, total_output, total_cache_read, total_cache_write — baselines pre-summed), `avg_events_per_session` |
| `GET /api/events?session_id=X` | Event stream incl. `APIError`, `Compaction`, `PreToolUse`/`PostToolUse` — used to localize regressions to specific sessions |
| `GET /api/pricing/cost` | `{ total_cost, breakdown[...] }` — total cost to derive cost-per-session |
| `GET /api/pricing/cost/{sessionId}` | Per-session cost — used to compare recent vs baseline session cost |
| `GET /api/workflows/{sessionId}` | `compaction` (impact), `errorPropagation` (by depth), `effectiveness` — per-session quality signals |
| `GET /api/sessions?limit=N` | Sessions with `started_at`, `cost`, `metadata` — to bucket sessions into time windows |

## Report Sections

### 1. Windowing
Split history into a **baseline window** (older) and a **recent window** (newer).
Default: recent = last 30 days, baseline = the 30–90 day range before it. Use
`daily_events`/`daily_sessions` for series metrics and `GET /api/sessions?limit=N`
to assign sessions to each window by `started_at`.

### 2. Error Rate Regression
- Recent error rate = `APIError count / total events` in the recent window
  (from `event_types` and `daily_events`, or per-session `GET /api/events`).
- Compare to the baseline rate. Flag if recent is higher.
- Report the absolute and relative change and which sessions contributed most
  `APIError` events.

### 3. Cache Hit Rate Regression
- Cache hit rate = `total_cache_read / (total_cache_read + total_input)`.
- Compute for each window (per-window input/cache_read from session metadata or
  the pricing breakdown). Flag a **falling** hit rate — that means more
  uncached input tokens and higher cost.

### 4. Compaction Frequency Regression
- Compaction frequency = `Compaction events / session` per window (from
  `event_types` / `daily_events`, confirmed via per-session
  `GET /api/workflows/{id}` `compaction`). Flag a **rising** rate — context is
  overflowing more often.

### 5. Cost-per-Session Regression
- Cost-per-session = window total cost / window session count, using
  `GET /api/pricing/cost` overall and `GET /api/pricing/cost/{id}` for the
  sessions in each window. Flag a **climbing** value.

### 6. Verdict
Roll up which metrics regressed, rank by relative worsening, and name the most
likely driver (e.g., cache hit rate fell → cost per session climbed).

## Output

- A Markdown table: metric | baseline | recent | Δ | direction (▲ worse / ▼ better) | verdict.
- Tag each regressed metric 🔴 (clear regression), 🟡 (mild/within noise), or 🟢 (improved).
- Currency in USD to 4 decimals; rates as percentages to 2 decimals.
- List the specific session IDs that contributed most to any regression.
- End with the single highest-priority regression to address and a concrete next step.
- Read-only: only report what the API returns; never fabricate baselines.
