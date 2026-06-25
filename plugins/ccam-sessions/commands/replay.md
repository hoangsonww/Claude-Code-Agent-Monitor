---
description: Summarize one Agent Monitor session by id — header plus a concise transcript recap.
argument-hint: "[session-id]"
---

Produce a concise recap of one Claude Code session tracked by the Agent Monitor.

The session id is **$ARGUMENTS**. If empty, resolve the latest:
`curl -s "http://localhost:4820/api/sessions?limit=1"` and use its `id`.

Fetch the session header and its transcript:

```
curl -s "http://localhost:4820/api/sessions/$ARGUMENTS"
curl -s "http://localhost:4820/api/sessions/$ARGUMENTS/transcript"
```

The first returns the session detail (status, model, cwd, started_at, ended_at, cost,
metadata: turn_count, thinking_blocks, total_turn_duration_ms). The second returns the
ordered transcript messages (user / assistant / tool).

Then print, concisely:

1. **Header** — one block: `id · model · status · cwd basename · turn_count turns · $<cost to 4dp> · <started_at → ended_at>`.
2. **Recap** — 5–10 bullets walking the conversation in order: the user's goal, the key
   assistant actions and tools used, any tool failures, and how it ended. Summarize each
   message in one line; do not paste large payloads (truncate past ~200 chars with `…`).

Currency as USD to 4 decimal places. If the transcript is empty, say the session has no
stored transcript rather than inventing turns. If the dashboard is unreachable, tell the
user to start it with `npm start` from the repo root.
