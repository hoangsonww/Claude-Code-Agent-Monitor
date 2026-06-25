---
description: Summarize the workflow intelligence for a session — stats, complexity, and top patterns.
argument-hint: "[session-id]"
---

Summarize the Agent Monitor workflow intelligence for a session from `http://localhost:4820`.

The session id is **$ARGUMENTS**. If empty, fetch `curl -s 'http://localhost:4820/api/sessions?limit=1'` and use the most recent session, stating which id you picked. If the dashboard is unreachable, tell the user to start it with `npm start` from the repo root.

Fetch the workflow intelligence:

```
curl -s http://localhost:4820/api/workflows/$ARGUMENTS
```

This returns 11 datasets: `stats`, `orchestration`, `toolFlow`, `effectiveness`, `patterns`, `modelDelegation`, `errorPropagation`, `concurrency`, `complexity`, `compaction`, `cooccurrence`.

Print, concisely:

1. **Header** — session id, total agents, max depth, and total tool calls (from `stats` / `orchestration`).
2. **Complexity** — the numeric `complexity` score and what drives it (depth, breadth, tool diversity).
3. **Top patterns** — up to 5 recurring sequences from `patterns`, each as `sequence ×frequency`, sorted by frequency descending.
4. **Quick signals** — one line each: concurrency lane count (`concurrency`), subagent success rate (`effectiveness`), and total errors with origin depth (`errorPropagation`).

Keep it terse — this is a one-shot. Cite only numbers returned by the API; for deeper analysis point the user at the `dag-map`, `delegation-audit`, `concurrency-report`, or `error-propagation` skills.
