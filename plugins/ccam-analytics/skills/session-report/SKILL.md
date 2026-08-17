---
name: session-report
description: >
  Generate a comprehensive session report with per-model token usage
  (input, output, cache_read, cache_write including compaction baselines),
  cost breakdown via the pricing engine, tool invocations, agent hierarchy,
  compaction events, API errors, turn durations, and thinking block counts.
  Use when reviewing a specific session or summarizing activity over a date range.
---

# Session Report

Generate a detailed session report from the Claude Code Agent Monitor.

## Input

The user provides: **$ARGUMENTS**

This may be a session ID, "latest", or a date range like "last 24 hours".

## Data Sources

All data comes from the Agent Monitor API at `http://localhost:4820`:

| Endpoint | What it returns |
|----------|----------------|
| `GET /api/sessions/{id}` | Session with nested `.agents[]` and `.events[]` |
| `GET /api/sessions?limit=50` | Session list with `agent_count`, `last_activity`, and **inline `cost`** per session (bulk pricing applied server-side) |
| `GET /api/pricing/cost/{sessionId}` | `{ total_cost, breakdown: [{ model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost, matched_rule }] }` |
| `GET /api/events?session_id={id}` | Event stream: each has `event_type`, `tool_name`, `summary`, `data` (JSON), `created_at` |

### Key data points available per session

- **Status**: `active` / `completed` / `error` / `abandoned`
- **Model**: primary model (e.g. `claude-sonnet-4-20250514`)
- **Metadata (JSON)**: `thinking_blocks` count, `turn_count`, `total_turn_duration_ms`, `usage_extras` (service_tier, speed, inference_geo)
- **Token usage per model**: Pricing breakdown reports `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens` per model (baselines are pre-summed into these totals at the DB level)
- **Cost formula**: `(tokens / 1,000,000) × rate_per_mtok` for each of 4 token types, using longest-match pricing rule
- **Agent hierarchy**: recursive parent_agent_id tree, subagent_type (e.g. "task", "explore", "code-review", "compaction")
- **Event types**: `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`, `SessionStart`, `SessionEnd`, `Notification`, `Compaction`, `APIError`, `TurnDuration`

## Report Sections

### 1. Session Overview
- ID (first 16 chars), name, status, model, working directory
- Start → end time, total duration
- Turn count and avg turn duration (from metadata)

### 2. Token Usage (per model)
Include these columns: Model, Input, Output, Cache Read, Cache Write, and Total.
Show **effective totals** (current + baseline) since baselines preserve tokens lost during compaction. Calculate cache hit rate: `cache_read / (cache_read + input) × 100`.

### 3. Cost Breakdown
From `/api/pricing/cost/{id}` — show each model's cost with the matched pricing rule. Note rates are per million tokens.

### 4. Agent Hierarchy
Render the agent tree (main → subagents, with nested children). For each agent: name, type, subagent_type, status, task (first 60 chars), duration.

### 5. Tool Activity
Count `PreToolUse` events by `tool_name`. Flag tools that appear in error events. Note subagent spawns (`tool_name = "Agent"`).

### 6. Compaction & Context Health
- Count of `Compaction` events (each = context was compressed)
- Baseline tokens recovered (sum of baseline_* columns)
- Thinking block count from metadata

### 7. API Errors
List any `APIError` events with type (quota, rate_limit, overloaded) and message.

### 8. Timeline
Key lifecycle events: SessionStart → first tool → compactions → errors → Stop → SessionEnd. Include TurnDuration events.

## Output Format

Clean Markdown: executive summary line, structured tables, agent tree, numbered timeline. Bold key metrics.
