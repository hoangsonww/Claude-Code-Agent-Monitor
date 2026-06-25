---
description: >
  Trace error propagation through a multi-agent session by agent depth — where
  failures originated, the depth at which they appeared, and how they cascaded
  up to parent agents — using the Agent Monitor workflow intelligence API and
  the session event stream. Use when a multi-agent run failed and you need to
  find the origin and blast radius of the failure.
---

# Error Propagation

Trace where a multi-agent session's failures started and how far they spread.

## Input

The user provides: **$ARGUMENTS**

A session ID. If empty, fetch `GET /api/sessions?limit=1`, but prefer the most recent session whose `status` is `error` or `abandoned`; state which one you picked.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/workflows/{sessionId}` | The `errorPropagation` dataset: failures grouped by agent depth, with originating depth and cascade paths to parents |
| `GET /api/events?session_id={sessionId}` | The event stream — corroborate with `APIError`, `SubagentStop`, and failing `PostToolUse` events (`event_type`, `tool_name`, `summary`, `timestamp`) |

## Report Sections

### 1. Failure Summary
From `errorPropagation`: total errors, the depth where the first error originated, and how many distinct agents were affected.
`Origin depth: d · Errors: N · Agents affected: M`

### 2. Errors by Depth
| Depth | Errors originated | Errors inherited from children | Net failing agents |
|-------|-------------------|--------------------------------|--------------------|
Show whether failures concentrate deep in the tree (leaf subagents) or shallow (orchestrator).

### 3. Cascade Paths
For each originating failure, the path it propagated along:
`debugger (depth 2, tool failure) → code-review (depth 1, marked error) → root (depth 0, aborted)`
Tie each step to a concrete event from `/api/events` (event_type + tool_name + timestamp) where available.

### 4. Error Taxonomy
Break errors down by type from the event stream: `APIError` vs failing tool calls vs `SubagentStop` with error status. Note the most frequent tool involved in failures.

### 5. Containment Assessment
Whether failures were contained at the depth where they originated or leaked to parents. Name any parent that aborted solely because a child failed — a candidate for better error handling / isolation.

## Output

- Markdown tables for the depth breakdown; a fenced list for cascade paths.
- Timestamps for the first and last error.
- Cite only errors present in `errorPropagation` and the event stream; never invent failures or causes.
- If the session has no errors, say so plainly and stop.
- If the dashboard is unreachable, tell the user to start it with `npm start` from the repo root.
