---
description: Print the orchestration DAG edges (parent→child subagents) for a session.
argument-hint: "[session-id]"
---

Print the multi-agent orchestration DAG for a session from `http://localhost:4820`.

The session id is **$ARGUMENTS**. If empty, fetch `curl -s 'http://localhost:4820/api/sessions?limit=1'` and use the most recent session, stating which id you picked. If the dashboard is unreachable, tell the user to start it with `npm start` from the repo root.

Fetch the workflow intelligence and read its `orchestration` dataset:

```
curl -s http://localhost:4820/api/workflows/$ARGUMENTS
```

`orchestration` contains the DAG nodes (agent id, type, model, status, depth) and parent→child edges.

Print, concisely:

1. **One-line topology** — `root → depth <N>, fan-out <max>, <agent count> agents`.
2. **Edge list** — one line per edge, grouped/ordered by depth:
   `depth d: parent[model] → child[type, status]`
3. **Leaves** — list the leaf agents (no children) on one line.

No tables, no preamble — just the topology line and the edges. Cite only nodes and edges returned by the API; never invent agents. If the session has no subagents, say so (single-agent session, depth 0). For a rendered tree and depth/fan-out breakdown, point the user at the `dag-map` skill.
