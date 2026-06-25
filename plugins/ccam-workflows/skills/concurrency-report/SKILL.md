---
description: >
  Report concurrency and parallelism for a session — how many agents ran in
  parallel, concurrency-lane utilization, peak parallel width, and
  serialization bottlenecks (sequential chains that could have run as parallel
  lanes) — using the Agent Monitor workflow intelligence API. Use when checking
  whether a multi-agent session used parallelism efficiently.
---

# Concurrency Report

Report on parallel execution for one Claude Code session: lanes, peak width, utilization, and where work serialized.

## Input

The user provides: **$ARGUMENTS**

A session ID. If empty, fetch `GET /api/sessions?limit=1` and report on the most recent session, stating which one.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/workflows/{sessionId}` | The `concurrency` dataset (overlapping agent execution lanes with start/end timing) and the `complexity` dataset (numeric score from depth, breadth, and tool diversity) |

## Report Sections

### 1. Parallelism Summary
From `concurrency`: number of distinct lanes, peak parallel width (max agents running simultaneously), and total agents. Pair with the `complexity` score to judge whether the parallelism matched the work's size.
`Lanes: N · Peak parallel: M · Agents: K · Complexity: S`

### 2. Lane Timeline
A per-lane list of the agents that occupied each lane in order:
`Lane 1: explore (0–12s) → code-review (12–48s)`
`Lane 2: debugger (5–30s)`
Show overlapping windows so simultaneity is visible.

### 3. Utilization
| Lane | Busy time | Idle time | Utilization % |
|------|-----------|-----------|---------------|
Plus an overall utilization figure (busy lane-time / total lane-time).

### 4. Serialization Bottlenecks
Identify sequential chains where one agent waited on the previous despite no apparent dependency — candidates to run as parallel lanes. State the chain and the wall-clock time it cost. Only flag chains the `concurrency` timing data actually shows as sequential.

## Output

- Markdown tables for utilization; a fenced list for the lane timeline.
- Durations in human units (e.g. `48s`, `2m 10s`); percentages to whole numbers.
- Use ▲/▼ when comparing utilization against an even-distribution baseline.
- Cite only timing returned by the API; never invent lane overlaps or durations.
- If the session ran a single agent (no concurrency), say so plainly rather than inventing lanes.
- If the dashboard is unreachable, tell the user to start it with `npm start` from the repo root.
