---
description: >
  Benchmark one session (or a small recent set) against the rolling average using
  Agent Monitor data — cost, total tokens, tool count, and workflow complexity
  score — and report where each metric lands as a percentile of the population.
  Tells you whether a session was normal, cheap, or an outlier. Use when judging
  whether a session was typical or out of band.
---

# Benchmark

Score a session against the rolling population average and report its percentile on
cost, tokens, tool count, and complexity using Agent Monitor data.

## Input

The user provides: **$ARGUMENTS**

This may be:
- A single session ID — benchmark that session
- "latest" — benchmark the most recent session
- "latest N" — benchmark the N most recent sessions, each vs the average
- empty — benchmark the most recent session (default)

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/sessions?limit=N` | Population of sessions with `cost`, `model`, `started_at`, `metadata` (turn_count, total_turn_duration_ms) — builds the rolling baseline |
| `GET /api/pricing/cost/{sessionId}` | `{ total_cost, breakdown:[{ input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost }] }` — the target session's cost and tokens |
| `GET /api/workflows/{sessionId}` | `complexity` (score), `stats` (tool/event counts), `toolFlow` (distinct tools used) — the target session's tool count and complexity |
| `GET /api/analytics` | `avg_events_per_session`, `tool_usage`, `daily_sessions` — corroborates population-level averages |

## Report Sections

### 1. Build the Baseline
Fetch the population with `GET /api/sessions?limit=200` (the rolling set). For each
session gather cost (`GET /api/pricing/cost/{id}` or the list `cost` field), total
tokens (sum of the 4 token types from the pricing breakdown), tool count and
complexity (`GET /api/workflows/{id}`). Compute mean, median, and standard
deviation for each metric across the population.

### 2. Measure the Target
For the requested session, pull the same four metrics:
- **Cost** — `total_cost` from `GET /api/pricing/cost/{id}`.
- **Total tokens** — `input + output + cache_read + cache_write` summed from the breakdown.
- **Tool count** — distinct/total tools from `GET /api/workflows/{id}` `stats`/`toolFlow`.
- **Complexity score** — `complexity.score` from `GET /api/workflows/{id}`.

### 3. Percentile and Deviation
For each metric report the target's percentile within the population (share of
sessions at or below it) and its z-score `(value − mean) / stddev`. Label each:
below average / typical / above average / outlier (|z| > 2).

### 4. Verdict
State whether the session was normal overall. If it is an outlier, name which
metric drove it (e.g., complexity p96, cost p91 → an unusually heavy session).

## Output

- A Markdown table: metric | session value | population mean | percentile | z-score | label.
- Currency in USD to 4 decimals; tokens and tool counts as integers; complexity to 2 decimals.
- Use ▲ for above-average and ▼ for below-average vs the mean.
- One-line verdict: "Normal session" or "Outlier — driven by <metric> (pNN)".
- When benchmarking multiple sessions, one row block per session plus a summary line.
- Read-only: percentiles come only from the fetched population; never fabricate the baseline.
