---
description: Quick daily standup from today's Claude Code sessions — grouped by project, with cost and errors.
argument-hint: "[today|yesterday]"
---

Generate a fast daily standup from Agent Monitor data at `http://localhost:4820`.

Target day from **$ARGUMENTS**: "today" or empty = the last calendar day; "yesterday" = the day before. If the dashboard is unreachable, tell the user to start it with `npm start` from the repo root.

1. Fetch sessions:
   `curl -s 'http://localhost:4820/api/sessions?limit=50'`
   Keep sessions whose `started_at` falls on the target day.
2. Fetch cost: `curl -s http://localhost:4820/api/pricing/cost` for the `total_cost` and per-model `breakdown`.

Print a compact standup (aim for a 30-second read):

- **One-line summary** suitable for pasting into Slack (e.g. "5 sessions across 3 projects, 4 done, $0.7421").
- **Done / In progress** grouped by project (`cwd`): per group list session count and statuses (`completed`, `running`, `error`, `abandoned`).
- **Errors / blockers**: any session with `status` `error` or `abandoned`; name the project.
- **Numbers**: total sessions, completion rate (completed / total), and estimated cost in USD to 4 decimals.

Keep it terse — this is a one-shot, not a full report. Cite only numbers returned by the API.
