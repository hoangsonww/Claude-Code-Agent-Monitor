---
description: >
  Summarize Workflow-tool fleet runs from the Agent Monitor — these fleets emit
  no hooks and are ingested from on-disk run journals. List recent runs with
  status and agents-per-run, then drill into a single run's per-agent detail.
  Reconciles against the live run-state endpoints. Use when reviewing Workflow()
  fleets rather than hook-instrumented interactive sessions.
---

# Fleet Runs

Summarize Workflow-tool (Workflow()) fleet runs and drill into one run's agents.

## Input

The user provides: **$ARGUMENTS**

- Empty → list the most recent fleet runs.
- A run ID → drill into that single run.
- `latest` → drill into the most recent run.

These fleets emit **no hooks**; the dashboard ingests them from on-disk Workflow-tool run journals, so this data is independent of the hook event stream.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/workflows/runs` | List of ingested fleet run journals: run id, status, agent count, timing |
| `GET /api/workflows/runs/{runId}` | One run in detail: per-agent status, timing, type, and outputs |
| `GET /api/run` | Live run state across the fleet (current/active runs) |
| `GET /api/run/{id}` | Live state for one run, to reconcile against the journal |

## Report Sections

### 1. Runs Overview (when listing)
| Run ID | Status | Agents | Started | Duration |
|--------|--------|--------|---------|----------|
Sort most recent first. Add a one-line status mix below (e.g. `8 runs: 5 completed, 2 running, 1 error`).

### 2. Run Detail (when a run ID / `latest` is given)
From `GET /api/workflows/runs/{runId}`, reconciled with `GET /api/run/{id}`:
- Header: run id, status, total agents, wall-clock duration.
- Per-agent table:
  | Agent | Type | Status | Duration | Notes |
  |-------|------|--------|----------|-------|
- Call out the longest-running agent and any agent with an error/failed status.

### 3. Status & Health
Completion rate (completed / total agents), any stalled or errored agents, and whether the journal and the live run-state endpoint agree (flag drift if they do not).

## Output

- Markdown tables; status mix as a single summary line.
- Durations in human units (e.g. `3m 04s`).
- Make explicit that these runs come from run journals (no hooks), so hook-derived metrics do not apply.
- Cite only runs and agents returned by the API; never invent runs.
- If there are no fleet runs, say so plainly.
- If the dashboard is unreachable, tell the user to start it with `npm start` from the repo root.
