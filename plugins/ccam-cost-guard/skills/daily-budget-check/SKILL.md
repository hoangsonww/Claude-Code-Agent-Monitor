---
description: >
  Run a daily spend check-in against a daily budget on the Agent Monitor
  dashboard — today's spend vs the daily target, pace through the day, and the
  projected overage if the current pace holds. Uses /api/pricing/cost and
  /api/sessions (grouped by started_at = today). Use for a quick daily spend
  check-in or a morning/evening budget pulse.
---

# Daily Budget Check

A fast daily pulse: are you on pace against today's budget?

## Input

The user provides: **$ARGUMENTS**

This is the **daily budget in dollars** — e.g. `"5"` or `"$5/day"`. If omitted, ask
for one or derive it from a monthly budget (`monthly / days_in_month`) and state the
assumption.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/pricing/cost` | `{ total_cost, breakdown: [{ model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost, matched_rule }] }` — fleet-wide spend and the avg cost-per-session used to value today's sessions |
| `GET /api/sessions?limit=200` | Session list with inline `cost` and `started_at` — filter to today (`DATE(started_at) = today`) to isolate today's spend |

## Method

Spend has no per-day field, so isolate **today** from the session list:

1. **Today's sessions** = sessions whose `started_at` is today (local date).
2. **Today's spend** = sum of inline `cost` over today's sessions. If inline `cost` is absent for some rows, fall back to `today_session_count × (total_cost / total_session_count)` and flag it as approximate.
3. **Pace**: `fraction_of_day_elapsed = hours_since_midnight / 24`. `expected_by_now = daily_budget × fraction_of_day_elapsed`.
4. **Pace delta** = `today_spend − expected_by_now` (▲ ahead of budget / ▼ behind).
5. **End-of-day projection**: `projected_today = today_spend / fraction_of_day_elapsed` (linear extrapolation of the current pace). Guard against tiny `fraction_of_day_elapsed` early in the day — if under ~0.1, label the projection low-confidence.
6. **Projected overage** = `projected_today − daily_budget` (positive = over).

## Report Sections

### 1. Today vs budget
One headline line: **today's spend / daily budget**, and the percent consumed. Verdict: **under** / **on pace** / **over**.

### 2. Pace
`expected_by_now` vs actual `today_spend`, the ▲/▼ pace delta, and the fraction of the day elapsed.

### 3. End-of-day projection
`projected_today` and the projected overage/headroom vs the daily budget. Note the confidence (low early in the day).

### 4. Today's drivers
Today's sessions ranked by `cost` (top 5): name/id, model, cost. Surface any premium-model session inflating the day.

### 5. Nudge
If projected over: one concrete cut (route the priciest session type cheaper — see `model-savings`; or arm a `token_threshold` rule via `budget-set`). If under: confirm headroom and the remaining daily allowance.

## Output

Compact Markdown — this is a daily check-in, keep it tight. Currency as USD to 4 decimal places; pace deltas with ▲/▼. Lead with the verdict line.
