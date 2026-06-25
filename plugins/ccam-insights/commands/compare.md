---
description: Compare two sessions side-by-side with cost and workflow deltas
argument-hint: "[sessionA] [sessionB]"
---

Compare the two sessions in **$ARGUMENTS** (first id = Session A, second id = Session B) side-by-side using the Agent Monitor dashboard. If fewer than two ids are given, ask for both.

1. Fetch cost for each, in parallel:
   - `curl -s http://localhost:4820/api/pricing/cost/<sessionA>`
   - `curl -s http://localhost:4820/api/pricing/cost/<sessionB>`
   Each returns `{ total_cost, breakdown:[{ model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost, matched_rule }] }`.

2. Fetch workflow intelligence for each:
   - `curl -s http://localhost:4820/api/workflows/<sessionA>`
   - `curl -s http://localhost:4820/api/workflows/<sessionB>`
   Use `stats` (tool/event/agent counts), `complexity` (score), `effectiveness` (subagent success), `compaction` (impact), and `errorPropagation`.

3. Print a side-by-side comparison table with a delta column (B − A):
   - Total cost (USD, 4 decimals) and Δ% .
   - Tokens: input, output, cache_read, cache_write (sum the breakdown per session).
   - Cache hit rate = `cache_read / (cache_read + input)`.
   - Tool count, event count, agent count (from `stats`).
   - Complexity score (from `complexity`).
   - Subagent success rate (from `effectiveness`) and compaction count (from `compaction`).

Output rules: one row per metric with columns Session A | Session B | Δ; use ▲ when B is higher and ▼ when lower; currency in USD to 4 decimals; rates as percentages to 2 decimals. End with a one-line verdict on which session was cheaper/leaner and the main driver. Cite only fields the API returned — never fabricate. If a session id is unknown or the dashboard is unreachable at `http://localhost:4820`, say so and tell the user to start it with `npm start` from the repo root.
