---
name: cost-breakdown
description: >
  Break down Claude Code costs using the Agent Monitor pricing engine.
  Shows per-model costs (input, output, cache_read, cache_write at $/Mtok rates),
  per-session costs, daily trends, and compaction baseline token recovery.
  Use when analyzing spending, comparing model costs, or planning budgets.
---

# Cost Breakdown

Detailed cost analysis from the Agent Monitor's pricing engine.

## Input

The user provides: **$ARGUMENTS**

This may be: "today", "this week", "last 30 days", a session ID, or "budget $50/week".

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/pricing` | `{ pricing: [{ model_pattern, display_name, input_per_mtok, output_per_mtok, cache_read_per_mtok, cache_write_per_mtok }] }` |
| `GET /api/pricing/cost` | Total cost: `{ total_cost, breakdown: [{ model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost, matched_rule }] }` |
| `GET /api/pricing/cost/{sessionId}` | Per-session cost with same breakdown shape |
| `GET /api/sessions?limit=200` | Sessions list — each includes inline `cost` field (bulk pricing) |
| `GET /api/analytics` | Token totals (total_input, total_output, total_cache_read, total_cache_write — baselines pre-summed), daily trends |

### How costs are calculated

The pricing engine matches model names against `model_pattern` using SQL LIKE (e.g. `claude-sonnet-4-5%` matches `claude-sonnet-4-5-20250514`). **Longest pattern wins** for specificity. Cost per model:

```
cost = (input_tokens / 1M) × input_per_mtok
     + (output_tokens / 1M) × output_per_mtok
     + (cache_read_tokens / 1M) × cache_read_per_mtok
     + (cache_write_tokens / 1M) × cache_write_per_mtok
```

Token counts are **effective totals** = `current + baseline` (baselines preserve pre-compaction tokens that would otherwise be lost when the transcript JSONL is rewritten).

### Default pricing tiers (seeded on first run)

| Family | Input $/Mtok | Output $/Mtok | Cache Read $/Mtok | Cache Write $/Mtok |
|--------|-------------|--------------|-------------------|-------------------|
| Opus 4.5/4.6 | $5 | $25 | $0.50 | $6.25 |
| Sonnet 4/4.5/4.6 | $3 | $15 | $0.30 | $3.75 |
| Haiku 4.5 | $1 | $5 | $0.10 | $1.25 |

## Report Sections

### 1. Cost by Model
Table from `/api/pricing/cost` breakdown — each model with 4 token counts + cost. Highlight which pricing rule matched.

### 2. Cost by Session (Top 10 Most Expensive)
From sessions list with inline `cost` — sort descending. Show session name, model, duration, cost.

### 3. Daily Cost Trend
Cross-reference `daily_sessions` with per-session costs to compute daily spend. Show 7/30-day trend with direction arrows.

### 4. Token Efficiency Analysis
- **Cache hit rate**: `total_cache_read / (total_cache_read + total_input) × 100` — higher = more efficient
- **Compaction baseline recovery**: Tokens preserved via baseline columns (tokens not lost to compaction)
- **Output/input ratio**: Balanced ratio indicates good prompt efficiency

### 5. Cost Optimization Opportunities
- Sessions where cache_write >> cache_read (poor cache reuse)
- Expensive models used for simple tasks (check subagent_type vs model)
- Sessions with many compactions (context overflow = wasted tokens)

## Output

Structured Markdown with tables. Currency as USD to 4 decimal places. Include total and per-model subtotals.
