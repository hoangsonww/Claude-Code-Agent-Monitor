---
description: List the most recent APIError events with their session and a summary
argument-hint: "[N]"
---

List the most recent Claude Code errors from the Agent Monitor dashboard at
`http://localhost:4820`. `$ARGUMENTS` is the number of errors to show (default 10).

1. Pull recent events and keep only API errors:
   ```bash
   curl -s http://localhost:4820/api/events?limit=300
   ```
   Filter the array to `event_type == "APIError"`. (If `$ARGUMENTS` is a number,
   show that many; otherwise show 10.) If none are found, also check
   `curl -s http://localhost:4820/api/analytics` `event_types.APIError` to confirm
   the true total and say "no recent APIError events (N total all-time)".

2. For each error, newest first, print one line:
   `timestamp · session_id · summary` — using the `timestamp`, `session_id`, and
   `summary` fields exactly as returned (trim long summaries to ~100 chars).

3. End with a one-line tally: total APIErrors shown and the most-affected
   `session_id`.

Output rules: cite only fields the API returned — never fabricate an error or a
cause. Keep it to the list plus the tally; no extra prose. If `curl` cannot reach
`http://localhost:4820`, tell the user to start the dashboard with `npm start`
from the repo root.
