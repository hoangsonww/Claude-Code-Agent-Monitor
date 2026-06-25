---
description: >
  Compile a month-over-month retrospective from Agent Monitor data — sessions,
  cost, token volumes, completion rate, top projects by working directory, and
  notable shifts versus the prior month. Uses daily_sessions/daily_events (365d)
  from analytics, the session list, and the pricing cost breakdown. Use when
  doing a monthly retrospective or planning the month ahead.
---

# Monthly Review

Generate a month-over-month productivity retrospective from Agent Monitor data.

## Input

The user provides: **$ARGUMENTS**

This may be:
- "this month" or empty (default: the current calendar month to date)
- "last month" for the previous full calendar month
- A specific month: "2026-02" or "February 2026"

The comparison period is always the immediately preceding calendar month.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/analytics` | `daily_sessions` and `daily_events` (365d) for monthly bucketing and trends; `tokens` (total_input/output/cache_read/cache_write — baselines pre-summed); `tool_usage` (top 20); `sessions_by_status` |
| `GET /api/sessions?limit=500` | Sessions with `started_at`, `ended_at`, `status`, `model`, `cwd`, `cost`, and `metadata` (turn_count, thinking_blocks) — for per-project (cwd) grouping and completion rate |
| `GET /api/pricing/cost` | `total_cost` and per-model `breakdown` (input/output/cache tokens, cost, matched_rule) |

## Report Sections

### 1. Month at a Glance
Compare the target month to the prior month in a table:

| Metric | This Month | Last Month | Change |
|--------|-----------|------------|--------|
| Sessions | N | N | ▲/▼ N% |
| Total Cost | $X.XXXX | $X.XXXX | ▲/▼ N% |
| Tokens (in/out/cache) | N | N | ▲/▼ N% |
| Completion Rate | N% | N% | ▲/▼ N pts |
| Active Days | N | N | ▲/▼ |

Derive monthly buckets from `daily_sessions` / `daily_events`. Completion rate =
`completed sessions / total sessions` for the month (from `sessions_by_status` and
the filtered session list).

### 2. Top Projects (by cwd)
Group the month's sessions by `cwd`. For the top 5–8 projects, list session count,
total cost, completion rate, and dominant model. Note any project that newly
appeared or dropped off versus last month.

### 3. Cost & Token Breakdown
From `/api/pricing/cost`, show cost per model and the dominant token type. Compute
cache hit rate = `total_cache_read / (total_cache_read + total_input)` and compare
to last month. Currency to 4 decimals.

### 4. Tool & Workflow Shifts
From `tool_usage`, highlight the tools that rose or fell most month-over-month, and
any new tool adopted. Flag rising error/Compaction activity if present.

### 5. Notable Shifts & Narrative
Three to five plain-language observations: what changed, why it likely changed, and
what it implies (e.g., "cost up 22% but sessions flat → heavier per-session work").

### 6. Focus for Next Month
Two to four prioritized, actionable goals grounded in the numbers above.

## Output

- Markdown report with emoji-light, scannable section headers.
- Tables for all month-over-month comparisons; ▲ / ▼ for deltas.
- Currency in USD to 4 decimals; tokens with thousands separators.
- Lead with a 2–3 sentence executive summary, then the sections in order.
- Cite only numbers returned by the API; if a month has no data, say so explicitly.
