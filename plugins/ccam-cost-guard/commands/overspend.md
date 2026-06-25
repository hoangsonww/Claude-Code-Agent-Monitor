---
description: List the most expensive sessions pushing your spend up
argument-hint: "[top-N]"
---

List the sessions driving Claude Code spend up — the **top $ARGUMENTS** most expensive
(default top 10 if empty).

1. Fetch a wide slice of sessions:
   ```
   curl -s "http://localhost:4820/api/sessions?limit=200"
   ```

2. Sort the returned sessions by inline `cost` **descending** and take the top N.

3. Print a table — rank, session id/name, `model`, `started_at`, `metadata.turn_count`, and `cost` (USD, 4 decimals). Below it:
   - **Sum of the top N** and what share of fleet spend they represent (sum top-N `cost` / sum of all `cost`).
   - Flag any Opus session with a low `turn_count` as a downshift candidate (point to the `model-savings` skill).

If the dashboard is unreachable, tell the user to start it with `npm start` from the
repo root. Keep it to one table plus two summary lines. Read-only — do not modify anything.
