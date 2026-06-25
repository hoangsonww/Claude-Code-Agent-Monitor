---
description: Suggest the next action from your most recent in-progress sessions and recent errors.
argument-hint: "[project-path]"
---

Recommend what to pick up next, using Agent Monitor data at `http://localhost:4820`. If the dashboard is unreachable, tell the user to start it with `npm start` from the repo root.

Optional **$ARGUMENTS**: a project path (`cwd`) to scope the suggestion to one project; otherwise consider all recent work.

1. Fetch recent sessions: `curl -s 'http://localhost:4820/api/sessions?limit=20'` (already sorted most-recently-updated first).
2. For the most recent unfinished sessions (`status` of `running`, `error`, or `abandoned`), fetch their events to see where they left off:
   `curl -s 'http://localhost:4820/api/events?session_id=<id>'` — look at the last few events (last `tool_name`, `summary`, and any `APIError` / `Compaction` event types).

Print a short, prioritized "Next up" list (top 3–5 items). For each item give:

- The project (`cwd`) and session status.
- What it was last doing (from the final events / last tool used).
- A concrete suggested next action (resume, debug the error, re-run after compaction, or close out).

Put unresolved errors and abandoned-mid-task sessions at the top. Keep it to one screen and cite only data returned by the API.
