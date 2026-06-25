---
description: Compute the recent 7-day spend trend (burn rate) from daily sessions and per-session cost.
argument-hint: ""
---

Estimate the recent daily spend trend (burn rate) for Claude Code usage from the Agent Monitor dashboard.

Fetch analytics, which includes the 365-day daily series and token totals:

```
curl -s http://localhost:4820/api/analytics
```

Use `daily_sessions` (365 days of `{ date, count }`) together with per-session cost to estimate daily spend. If `daily_sessions` does not carry cost directly, fetch the session list to map cost to dates:

```
curl -s "http://localhost:4820/api/sessions?limit=200"
```

Then compute and print:

1. **Last 7 days vs. prior 7 days** — total spend in each window, and the change as a percent with ▲ (up) / ▼ (down).
2. **7-day burn rate** — average daily spend over the last 7 days, as USD to 4 decimal places, plus a simple 30-day projection (`avg_daily × 30`).
3. **Per-day mini-trend** — one line per day for the last 7 days: `<date> — $<spend to 4dp>` with a ▲/▼ vs. the prior day.

Currency as USD to 4 decimal places. Keep it to these three blocks — no long analysis.

If session dates and costs cannot be aligned precisely, state the approximation you made in one line rather than fabricating exact daily figures. If the dashboard is unreachable, tell the user to start it with `npm start` from the repo root.
