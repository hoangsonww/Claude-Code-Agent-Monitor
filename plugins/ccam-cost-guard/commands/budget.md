---
description: Show current Claude Code spend versus a budget number
argument-hint: "[monthly-$]"
---

Show current Claude Code spend against the budget **$ARGUMENTS** (a monthly dollar
figure, e.g. `50`). If `$ARGUMENTS` is empty, just report spend-to-date and ask for a budget.

1. Fetch current spend:
   ```
   curl -s http://localhost:4820/api/pricing/cost
   ```
   Read `total_cost` (spend-to-date) and the per-model `breakdown`.

2. Print a concise budget status:
   - **Spend to date**: `total_cost` as USD to 4 decimals.
   - **Budget**: `$ARGUMENTS`/month.
   - **Consumed**: `total_cost / budget × 100`% — with a ▲/▼ vs. the linear pace expected for today's day-of-month (`budget × day_of_month / days_in_month`).
   - **Verdict**: under budget / on pace / over budget.
   - **Top 3 models by cost** from the breakdown (model, cost, % of total).

If the dashboard is unreachable (curl fails / empty), tell the user to start it with
`npm start` from the repo root. Keep the output to a few lines plus one small table.
Currency as USD to 4 decimal places. Read-only — do not modify anything.
