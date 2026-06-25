---
description: >
  Forecast Claude Code spend to the end of the week or month from the daily
  session trend on the Agent Monitor dashboard — moving average of daily spend
  × days remaining, added to spend-to-date. Uses /api/analytics daily_sessions,
  /api/pricing/cost, and /api/sessions for a per-day cost curve.
  Use when projecting cost or asking "where will my spend land".
---

# Spend Forecast

Project where Claude Code spend will end up by the close of the current week or month.

## Input

The user provides: **$ARGUMENTS**

This is the forecast horizon — `"week"`, `"month"`, or a specific date. Default to
**month** (calendar month-end) when nothing is given, and state the horizon you used.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/analytics` | `{ total_cost, tokens (effective totals, baselines pre-summed), daily_sessions (365d: [{ date, count }]), daily_events, overview, ... }` — `daily_sessions` is the trend the forecast extrapolates |
| `GET /api/pricing/cost` | `{ total_cost, breakdown: [{ model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost, matched_rule }] }` — authoritative spend-to-date and avg cost-per-session input |
| `GET /api/sessions?limit=200` | Session list with inline `cost` and `started_at` — group by day for a sharper daily-spend curve than the count-based approximation |

## Forecast method

Spend has no native per-day field, so build a daily-spend series and extrapolate:

1. **Spend-to-date** = `total_cost` from `/api/pricing/cost`.
2. **Avg cost per session** = `total_cost / total_session_count`.
3. **Daily spend series**: for the trailing window, `daily_spend[d] ≈ daily_sessions[d].count × avg_cost_per_session`. For a sharper curve, instead sum inline session `cost` grouped by `DATE(started_at)`.
4. **Moving average**: `avg_daily_spend = mean(daily_spend over the trailing 7 days)`. Also compute a 14-day average to gauge whether the trend is accelerating (▲) or cooling (▼).
5. **Remaining days**: days left until the end of the chosen horizon (week = through Sunday; month = through the last calendar day).
6. **Projection**: `projected_total = spend_to_date_this_period + (avg_daily_spend × days_remaining)`.

> Spend-to-date this period: when the trend covers more than the current period, restrict the spend-to-date term to sessions whose `started_at` falls inside the current week/month so the projection isn't inflated by older spend.

## Report Sections

### 1. Spend to date
`total_cost`, session count, avg cost/session, and how much falls inside the current period.

### 2. Daily trend
The 7-day and 14-day moving averages of daily spend, with a ▲/▼ accelerating-vs-cooling read. Show the last 7 days as a compact table (date, sessions, est. spend).

### 3. Projection
`avg_daily_spend × days_remaining` and the resulting `projected_total` for the horizon. State the days-remaining count explicitly.

### 4. Budget check (if a budget is known)
If the user mentions a budget, show projected vs. budget, the over/under delta, and the date the budget is projected to be crossed (`days_to_budget = (budget − spend_to_date) / avg_daily_spend`).

### 5. Confidence & caveats
Note that the forecast assumes the recent daily pace holds, that daily spend is approximated from session counts unless an inline-cost curve was used, and call out any low-data horizons (e.g. fewer than 7 active days).

## Output

Markdown with the trend table and the projection. Currency as USD to 4 decimal places; show moving averages and the projected total prominently. Deltas with ▲/▼.
