---
description: List the top N most expensive Claude Code sessions by inline cost.
argument-hint: "[N]"
---

List the most expensive Claude Code sessions from the Agent Monitor dashboard.

`N` = **$ARGUMENTS** (default `10` if empty).

Fetch the session list (each session carries an inline `cost` field from bulk pricing):

```
curl -s "http://localhost:4820/api/sessions?limit=200"
```

Then:

1. Sort sessions by `cost` descending.
2. Print the top `N` as a numbered list, one line each:
   `<rank>. $<cost to 4dp> — <model> — <cwd basename or id> — <started_at>`
3. After the list, print the **summed cost of the top N** and what percent that is of the summed cost of all returned sessions.

Currency as USD to 4 decimal places. Skip sessions with no/zero cost only if it would otherwise pad the list past meaningful entries — otherwise include them. Keep it terse, no extra commentary.

If the dashboard is unreachable, tell the user to start it with `npm start` from the repo root.
