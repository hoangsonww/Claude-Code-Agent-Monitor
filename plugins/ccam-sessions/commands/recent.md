---
description: List the N most recent Claude Code sessions from the Agent Monitor.
argument-hint: "[N]"
---

List the most recent Claude Code sessions tracked by the Agent Monitor.

`N` = **$ARGUMENTS** (default `10` if empty).

Fetch the most recent sessions (the API returns them most-recently-updated first):

```
curl -s "http://localhost:4820/api/sessions?limit=$ARGUMENTS"
```

This returns a session list; each entry has id, status, model, cwd, started_at,
ended_at, cost, and metadata (turn_count, total_turn_duration_ms).

Then print the sessions as a numbered list, one line each, in the order returned:

`<rank>. <id short> — <status> — <model> — <cwd basename> — <turn_count> turns — $<cost to 4dp> — <started_at>`

After the list, print the summed cost of the listed sessions and a one-line status
tally (e.g. `7 completed · 2 active · 1 error`).

Currency as USD to 4 decimal places. Keep it terse, no preamble. If the dashboard is
unreachable, tell the user to start it with `npm start` from the repo root.
