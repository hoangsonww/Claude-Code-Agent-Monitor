---
description: >
  Probes each major Agent Monitor API route — /api/stats, /api/analytics,
  /api/sessions, /api/pricing/cost, /api/workflows/runs, /api/cc-config/overview
  — and reports each one's HTTP status, latency, and response shape, flagging
  which are reachable. Use to verify a dashboard install is wired up correctly.
---

# Endpoint Probe

Smoke-test the dashboard's main API surface by hitting each major route once and
reporting whether it responds and what shape it returns.

## Input

The user provides: **$ARGUMENTS**

Options: empty (default: probe all routes below), or a substring to filter which
routes are probed (e.g. `pricing` probes only matching routes).

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/stats` | `{ total_sessions, active_sessions, active_agents, total_agents, total_events, events_today, ws_connections, agents_by_status, sessions_by_status }` |
| `GET /api/analytics` | `{ overview, tokens, tool_usage, daily_events, daily_sessions, agent_types, event_types, avg_events_per_session, total_subagents, sessions_by_status, agents_by_status }` |
| `GET /api/sessions` | Session list; each: `id, status, model, cwd, started_at, ended_at, cost, metadata` |
| `GET /api/pricing/cost` | `{ total_cost, breakdown:[{ model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost, matched_rule }] }` |
| `GET /api/workflows/runs` | Workflow-tool run journals (fleets) |
| `GET /api/cc-config/overview` | Claude Code config explorer overview (skills, agents, commands, plugins, mcp, hooks, etc.) |

## Method

For each route, issue a single `GET` against `http://localhost:4820<path>` with a
short timeout, capturing the HTTP status code, round-trip latency, and the
top-level shape of the JSON body (object keys, or array length). A route counts
as reachable when it returns a 2xx with parseable JSON.

If `/api/stats` itself fails to connect, the dashboard is not running — stop and
tell the user to start it with `npm start` (or `npm run dev`) from the repo root.

## Report Sections

### 1. Probe Matrix
A Markdown table — one row per route — with columns:
`endpoint`, `status` (HTTP code), `latency`, `reachable` (✅/❌), `shape`
(e.g. `object: {total_cost, breakdown[…]}` or `array[N]`).

### 2. Reachability Summary
Count of reachable vs total. Name any unreachable or non-2xx routes explicitly.

### 3. Verdict
One line: install looks healthy (all reachable) or partially wired (list the
gaps and the most likely cause — server not running, route disabled, or empty data).

## Output

- Compact Markdown; the probe matrix is the centerpiece.
- Cite the real status code, latency, and observed shape per route — never assume.
- Report shape from what actually came back; if a route returns an empty array or
  object, say so rather than inferring fields.
- Keep currency, where shown, to 4 decimals (e.g. `total_cost: $0.0000`).
