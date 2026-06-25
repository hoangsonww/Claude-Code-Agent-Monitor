---
description: List recent Workflow-tool fleet runs with status and agent counts.
---

List recent Workflow-tool (Workflow()) fleet runs from the Agent Monitor at `http://localhost:4820`.

These fleets emit **no hooks** — the dashboard ingests them from on-disk run journals, so this is independent of the hook event stream. If the dashboard is unreachable, tell the user to start it with `npm start` from the repo root.

Fetch the run journals:

```
curl -s http://localhost:4820/api/workflows/runs
```

Each run has a run id, status, agent count, and timing.

Print, concisely:

1. **Status mix** — one summary line, e.g. `8 runs: 5 completed, 2 running, 1 error`.
2. **Recent runs** — a compact table, most recent first:

   | Run ID | Status | Agents | Started | Duration |
   |--------|--------|--------|---------|----------|

Keep it terse. Cite only runs returned by the API; never invent runs. If there are no fleet runs, say so. To drill into one run's per-agent detail, point the user at the `fleet-runs` skill.
