---
description: List current cost and token outlier sessions via z-score
argument-hint: "[threshold]"
---

List the current cost/token **outlier** sessions from the Agent Monitor dashboard using a z-score test. **$ARGUMENTS** optionally sets the z-score threshold (default `2.0`; lower = stricter).

1. Fetch the population:
   - `curl -s "http://localhost:4820/api/sessions?limit=200"` → a session list; each item has `id`, `status`, `model`, `cwd`, `started_at`, `cost`, and `metadata`.

2. Compute the baseline over all returned sessions:
   - Mean and standard deviation of `cost`.
   - For sessions where you need token totals, pull `curl -s http://localhost:4820/api/pricing/cost/<id>` and sum `input_tokens + output_tokens + cache_read_tokens + cache_write_tokens`; compute mean and stddev of total tokens too.

3. Flag outliers: any session whose `z = (value − mean) / stddev` exceeds the threshold (default 2.0) on cost (primary) or tokens (secondary). Skip the calc gracefully if stddev is 0.

4. Print the flagged sessions, sorted by descending cost z-score:
   - Session id (short), model, started_at.
   - Cost (USD, 4 decimals) and its z-score.
   - Total tokens and its z-score (when fetched).
   - A flag tag: 🔴 if z > 3, 🟡 if z > 2.

Output rules: a Markdown table of flagged sessions only; currency in USD to 4 decimals; z-scores to 2 decimals; if nothing exceeds the threshold, say "No cost/token outliers above z=<threshold>" and report the top session by cost for context. Cite only API values — never fabricate. If the dashboard is unreachable at `http://localhost:4820`, tell the user to start it with `npm start` from the repo root.
