---
description: >
  Render the multi-agent orchestration DAG for a session — parent→child
  subagent edges, tree depth, and fan-out — from the Agent Monitor workflow
  intelligence API. Cross-checks the orchestration dataset against the raw
  agent records and session detail. Use when visualizing how a session's agent
  structure was organized.
---

# DAG Map

Render the subagent orchestration graph for one Claude Code session as a depth-ordered DAG.

## Input

The user provides: **$ARGUMENTS**

A session ID. If empty, fetch `GET /api/sessions?limit=1` and use the most recent session, stating which one you picked.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/workflows/{sessionId}` | The `orchestration` dataset: DAG nodes (agent id, type, model, status, depth) and parent→child edges |
| `GET /api/agents` | Raw subagent records (`status`, `type`, `depth`, `parent`) to cross-check node/edge counts |
| `GET /api/sessions/{sessionId}` | Full session detail with nested `agents[]` to confirm the root and total agent count |

## Report Sections

### 1. Topology Summary
From `orchestration`: the root agent, total agent count, max depth, and max fan-out (most children under any one parent). Confirm the agent count against `/api/agents` filtered to this session.

### 2. Edge List
Every parent→child edge, grouped by depth, formatted as:
`depth d: parent[model] → child[type, status]`
Mark leaf agents (no children) and any orphan nodes (a `parent` that is not present in the node set).

### 3. Depth & Fan-out Table
| Depth | Agents at depth | Children spawned | Avg fan-out |
|-------|-----------------|------------------|-------------|

### 4. ASCII Tree
A simple indented tree rendering of the DAG, e.g.:
```
root [opus, completed]
├─ explore [sonnet, completed]
└─ code-review [sonnet, error]
   └─ debugger [sonnet, completed]
```

## Output

- Render as Markdown tables plus one fenced ASCII tree block.
- Cite real node and edge counts from the API — never invent agents or edges.
- If a session has no subagents, say so plainly (single-agent session, depth 0) instead of fabricating a tree.
- If the dashboard is unreachable, tell the user to start it with `npm start` from the repo root.
