---
description: Quick month-end spend projection from the daily trend
argument-hint: "[week|month]"
---

Give a quick spend projection for the end of the **$ARGUMENTS** period (`week` or
`month`; default `month` if empty).

1. Fetch the trend and current spend in parallel:
   ```
   curl -s http://localhost:4820/api/analytics
   curl -s http://localhost:4820/api/pricing/cost
   ```
   From `/api/analytics` read `daily_sessions` (`[{ date, count }]`) and the session
   total; from `/api/pricing/cost` read `total_cost`.

2. Project:
   - `avg_cost_per_session = total_cost / total_session_count`.
   - `avg_daily_spend = mean(last 7 days of daily_sessions[].count) × avg_cost_per_session`.
   - `days_remaining` = days left until end of the chosen period (week → Sunday; month → last calendar day).
   - `projected_total = total_cost + avg_daily_spend × days_remaining`.

3. Print: spend-to-date, `avg_daily_spend`, `days_remaining`, and the **projected end-of-period total** (USD, 4 decimals), with a ▲/▼ note on whether the 7-day pace is above or below the trailing 14-day pace.

State that daily spend is approximated from session counts. If the dashboard is
unreachable, tell the user to start it with `npm start` from the repo root. Keep it to
a few lines. Read-only — do not modify anything.
