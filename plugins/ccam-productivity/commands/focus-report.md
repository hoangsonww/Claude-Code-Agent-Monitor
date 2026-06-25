---
description: One-screen focus snapshot — avg turn duration, thinking-block usage, and longest sessions.
argument-hint: "[limit]"
---

Print a one-screen focus snapshot from Agent Monitor data at `http://localhost:4820`. If the dashboard is unreachable, tell the user to start it with `npm start` from the repo root.

Optional **$ARGUMENTS**: a session count to inspect (default 100).

1. Fetch sessions: `curl -s 'http://localhost:4820/api/sessions?limit=100'` (use the $ARGUMENTS limit if given). Parse each `metadata` JSON for `turn_count`, `total_turn_duration_ms`, and `thinking_blocks`.
2. Fetch baselines: `curl -s http://localhost:4820/api/analytics` for `avg_events_per_session` and `sessions_by_status`.

Compute and print (over sessions that have the focus metadata):

- **Avg turn duration** = `total_turn_duration_ms / turn_count`, reported in seconds (averaged across sessions).
- **Thinking-block usage** = average `thinking_blocks` per session and per turn (`thinking_blocks / turn_count`).
- **Longest sessions**: top 3–5 by `total_turn_duration_ms`, each with project (`cwd`), duration in minutes, turn count, and thinking blocks.

Show the three metrics as a compact table plus the longest-sessions list. State how many sessions had usable metadata. Durations from ms; cite only numbers returned by the API. Keep it to one screen.
