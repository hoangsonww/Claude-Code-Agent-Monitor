---
description: >
  Roll up Claude Code sessions by working directory (project) from Agent Monitor
  data — session count, total cost, total tokens, and last-active timestamp per cwd
  — so per-project activity can be compared at a glance. Use when summarizing where
  effort and spend went across projects.
---

# CWD Rollup

Aggregate session activity per working directory (project).

## Input

The user provides: **$ARGUMENTS**

- Empty → roll up **all** working directories.
- A path / project substring → restrict the rollup to matching cwds.
- `top N` → keep only the N highest-cost (or highest-count) projects.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/run/cwds` | the distinct working directories that have sessions — the rollup key set |
| `GET /api/sessions?limit=N` | session list: id, status, model, cwd, started_at, ended_at, cost, metadata (usage_extras with token counts) |
| `GET /api/pricing/cost` | fleet cost: total_cost, breakdown[{ model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost, matched_rule }] — for the fleet total to compute each cwd's share |

## Report Sections

### 1. Key set
`GET /api/run/cwds` for the canonical list of working directories. Apply the
`$ARGUMENTS` filter (substring match) if one was given.

### 2. Pull sessions
`GET /api/sessions?limit=1000`. Bucket sessions by `cwd`.

### 3. Aggregate per cwd
For each working directory compute:
- **sessions** — count.
- **cost** — sum of the inline `cost` field across the bucket.
- **tokens** — sum of input / output / cache-read / cache-write from each session's
  metadata `usage_extras` (sum the four into a total, and keep input + output as the
  "billable text" subtotal).
- **last active** — the max `started_at` (or `ended_at`) in the bucket.
- **models** — the distinct models seen.

### 4. Share of fleet
`GET /api/pricing/cost` for `total_cost`; show each cwd's cost as a percentage of the
fleet total.

### 5. Ranking
Sort by cost descending by default (or count if the user asked); apply `top N`.

## Output

Markdown table: `project (cwd basename) | sessions | total tokens | cost | % of fleet | last active | models`.
Currency as USD to 4 decimal places; token counts with thousands separators; sort
cost-descending. Add a final TOTAL row summing the columns. Only count tokens that
the session metadata actually carries — if `usage_extras` is absent for a session,
note it as excluded rather than guessing. If the dashboard is unreachable, tell the
user to start it with `npm start` from the repo root.
