---
description: One-line Agent Monitor health + counts summary from /api/stats
---

Fetch the dashboard stats and print a single-line health summary.

Run:

```bash
curl -s -m 5 http://localhost:4820/api/stats
```

Then print exactly one line summarizing health and key counts from the JSON,
in this shape:

```
✅ UP | 127 sessions | 3 active | 1 agents | 4,892 events | 42 today | 2 ws
```

Pull the numbers from these fields: `total_sessions`, `active_sessions`,
`active_agents`, `total_events`, `events_today`, `ws_connections`.

If the `curl` command fails (non-zero exit, empty body, or unparseable JSON),
print instead:

```
❌ DOWN | dashboard not reachable at http://localhost:4820 — start it with `npm start` from the repo root
```

Do not modify any data. Output only the single summary line — no preamble.
