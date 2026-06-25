---
description: Print a quick SLO snapshot — completion rate, tool success rate, and error rate
---

Print a compact SLO snapshot for Claude Code usage from the Agent Monitor
dashboard at `http://localhost:4820`. No arguments.

1. Fetch the raw counts:
   ```bash
   curl -s http://localhost:4820/api/analytics
   curl -s http://localhost:4820/api/stats
   ```
   From `analytics`: `event_types` (PreToolUse, PostToolUse, APIError) and
   `sessions_by_status`. From `stats`: `total_events`, `total_sessions`.

2. Compute three SLIs:
   - **Completion rate** = completed sessions / total sessions (from
     `sessions_by_status`; exclude still-`active`/`running` sessions from the
     denominator).
   - **Tool success rate** = `PostToolUse / PreToolUse` (cap at 100%).
   - **Error rate** = `APIError / total_events`.

3. Compare each to its default target (completion ≥ 95%, tool success ≥ 99%,
   error ≤ 1%) and print one line per SLI:
   `SLI .......... observed%  (target X%)  ✅ MET | ❌ BREACHED`

Output rules: rates as percentages to 2 decimals; cite only fields the API
returned — never fabricate. End with one verdict line (e.g.,
`SLOs: 3/3 met` or `SLOs: error rate BREACHED`). Keep it to the snapshot only; no
extra prose. If `curl` cannot reach `http://localhost:4820`, tell the user to
start the dashboard with `npm start` from the repo root.
