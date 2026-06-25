---
description: >
  Find Claude Code sessions tracked by the Agent Monitor by project (cwd), model,
  status, or date, then rank the matches by cost or recency. Pulls the session list
  and the distinct cwd / facet values so filters use real values rather than guesses.
  Use when locating a session — "find my EstateWise sessions", "which Opus runs
  errored this week", "most expensive sessions in /repo".
---

# Session Search

Locate Claude Code sessions in the Agent Monitor by project, model, status, or date.

## Input

The user provides: **$ARGUMENTS**

A free-form query naming any combination of:
- **project / cwd** — a working-directory path or basename (e.g. `EstateWise`, `/Users/.../repo`)
- **model** — `opus`, `sonnet`, `haiku`, or a full model id substring
- **status** — `active`, `working`, `completed`, `error`
- **date** — `today`, `this week`, or an ISO date / range matched against `started_at`
- **ranking** — `by cost` (default when cost is mentioned) or `recent` (default otherwise)

If the query is empty, return the most recent sessions ranked by recency.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/sessions?limit=N` | session list: id, status, model, cwd, started_at, ended_at, cost, metadata (thinking_blocks, turn_count, total_turn_duration_ms, usage_extras) |
| `GET /api/run/cwds` | the distinct working directories that have sessions — use to resolve a fuzzy project name to exact cwd values |
| `GET /api/events/facets` | distinct facet values (event types, tool names, models, statuses) for validating filters |

## Report Sections

### 1. Resolve filters
Fetch `/api/run/cwds` and `/api/events/facets` to map the user's loose terms to
real values: pick the cwd(s) whose path contains the project term, confirm the
model substring exists, and validate the status against known statuses. State
which concrete filters you settled on.

### 2. Pull candidates
`GET /api/sessions?limit=200` (raise the limit if the date window is wide). Filter
in-memory by cwd, model (substring, case-insensitive), status, and `started_at`
date window.

### 3. Rank
Sort by `cost` descending when the user asked "by cost"; otherwise by `started_at`
descending (most recent first). Keep the top 20 unless the user asked for more.

### 4. Matches
One row per session.

### 5. Summary
Count of matches, summed cost across matches, and the model / status distribution.

## Output

Markdown table: `# | id (short) | status | model | cwd (basename) | started_at | cost`.
Currency as USD to 4 decimal places; token / count fields with thousands separators.
If a filter resolved to zero rows, say so and show the closest available values
(e.g. the cwds that *do* exist) rather than fabricating results. If the dashboard
is unreachable, tell the user to start it with `npm start` from the repo root.
