---
description: One-line reliability verdict (OK / DEGRADED / FAILING) for Claude Code usage
---

Print a single reliability verdict for Claude Code usage from the Agent Monitor
dashboard at `http://localhost:4820`. No arguments.

1. Fetch state:
   ```bash
   curl -s http://localhost:4820/api/stats
   curl -s http://localhost:4820/api/analytics
   ```
   From `stats`: `total_events`, `events_today`, `sessions_by_status`. From
   `analytics`: `event_types` (PreToolUse, PostToolUse, APIError).

2. Derive two reliability signals:
   - **Error rate** = `APIError / total_events` (percentage, 2 decimals).
   - **Tool-failure rate** = `(PreToolUse − PostToolUse) / PreToolUse` (percentage).

3. Pick the verdict from the worse of the two signals:
   - **OK** — error rate ≤ 1% and tool-failure rate ≤ 1%.
   - **DEGRADED** — either is in 1–5%.
   - **FAILING** — either exceeds 5%.

4. Print exactly one line:
   `Reliability: <OK|DEGRADED|FAILING> — errors X.XX%, tool failures Y.YY% (N events)`
   Prefix with ✅ (OK), ⚠️ (DEGRADED), or ❌ (FAILING).

Output rules: cite only fields the API returned — never fabricate. One line only;
no extra prose. If `curl` cannot reach `http://localhost:4820`, print
`Reliability: UNKNOWN — dashboard unreachable; start it with \`npm start\` from the repo root.`
