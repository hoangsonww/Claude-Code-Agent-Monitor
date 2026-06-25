---
description: Search Agent Monitor sessions by cwd, model, or status and print the top matches.
argument-hint: "[query]"
---

Search Claude Code sessions tracked by the Agent Monitor and print the top matches.

The query is **$ARGUMENTS** — any mix of a project / cwd substring, a model
(`opus`/`sonnet`/`haiku` or a model-id fragment), and a status
(`active`/`working`/`completed`/`error`). If empty, just show the most recent sessions.

Fetch the session list (each carries an inline `cost` field):

```
curl -s "http://localhost:4820/api/sessions?limit=200"
```

Then:

1. Filter in-memory: keep sessions whose `cwd` contains the project term (case-insensitive),
   whose `model` contains the model term, and whose `status` equals the status term —
   apply only the terms present in `$ARGUMENTS`.
2. Sort matches by `cost` descending if the query mentions cost/expensive, otherwise by
   `started_at` descending (most recent first).
3. Print the top 10 as a numbered list, one line each:
   `<rank>. <id short> — <status> — <model> — <cwd basename> — $<cost to 4dp> — <started_at>`
4. End with the match count and the summed cost of the shown matches.

Currency as USD to 4 decimal places. If nothing matches, say so and list the distinct
cwds/models that DO exist (from the returned data) so the user can refine — do not invent
results. If the dashboard is unreachable, tell the user to start it with `npm start` from
the repo root.
