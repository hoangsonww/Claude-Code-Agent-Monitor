---
description: Show the latest N ingested events with timestamp, event_type, and tool_name.
argument-hint: "[N]"
---

Show the most recent events from the Agent Monitor dashboard. Argument:
**$ARGUMENTS** — `N`, the number of events to show (default 20).

Fetch recent events and take the newest N:

```bash
N="${1:-20}"
curl -s "http://localhost:4820/api/events?limit=${N}" | jq -r '.[] | "\(.timestamp)\t\(.event_type)\t\(.tool_name // "-")"'
```

The `/api/events` list is returned newest-first; show the most recent `N`.
Render a compact, aligned table — one row per event:

```
TIME                  EVENT_TYPE     TOOL_NAME
2026-06-25T14:03:11Z  PostToolUse    Bash
2026-06-25T14:03:09Z  PreToolUse     Bash
2026-06-25T14:02:58Z  Stop           -
```

Include `event_type` (PreToolUse, PostToolUse, Stop, SubagentStop, SessionStart,
SessionEnd, Notification, Compaction, APIError, TurnDuration) and `tool_name`
when present (use `-` for events without a tool). End with a one-line count:
`Showing latest <N> events.`

If the request returns a non-200 or empty body, say so and tell the user to start
the dashboard with `npm start` from the repo root. Read-only — never POST or
modify events.
