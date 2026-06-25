---
description: >
  Analyze prompt-cache effectiveness for Claude Code usage from the Agent
  Monitor dashboard — cache hit rate (total_cache_read / (total_cache_read +
  total_input)), cache_write vs cache_read reuse, cache-read vs cache-write
  spend, and the sessions with the poorest reuse. Pulls token totals from
  /api/analytics, per-session detail from /api/sessions, and dollar splits
  from /api/pricing/cost. Use when diagnosing cache spend or deciding whether
  prompt caching is paying off.
---

# Cache Efficiency

Diagnose whether prompt caching is actually saving money, and where it is not.

## Input

The user provides: **$ARGUMENTS**

This may be: empty (analyze the whole fleet), "today" / "this week" / a date range, a session ID to scope the analysis, or a target like "hit rate > 80%". When empty, analyze all data from `/api/analytics`.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/analytics` | `tokens.total_input`, `tokens.total_output`, `tokens.total_cache_read`, `tokens.total_cache_write` (baselines pre-summed), plus `daily_sessions` |
| `GET /api/sessions?limit=200` | Session list — each has model, cwd, started_at, ended_at, inline `cost`, metadata (JSON: usage_extras with cache token detail) |
| `GET /api/sessions/{id}` | Full session detail with nested agents and events, for drill-down on a flagged session |
| `GET /api/pricing/cost` | `{ total_cost, breakdown: [{ model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost, matched_rule }] }` — used to price cache read vs write spend |

### How cache economics work

```
cache_hit_rate   = total_cache_read / (total_cache_read + total_input)
cache_reuse      = total_cache_read / total_cache_write
cache_read_cost  = (cache_read_tokens  / 1M) × cache_read_per_mtok
cache_write_cost = (cache_write_tokens / 1M) × cache_write_per_mtok
```

Cache writes cost more per token than cache reads (e.g. Sonnet $3.75 write vs $0.30 read per Mtok), and writes are billed even if the cached block is never reused. The payoff only arrives on subsequent reads — so a healthy fleet shows **cache_read_tokens far exceeding cache_write_tokens**. When `cache_reuse < 1`, you are paying to cache context you barely re-read.

Token counts are **effective totals** = `current + baseline` (baselines preserve pre-compaction tokens).

## Report Sections

### 1. Fleet Cache Hit Rate
From `/api/analytics`: compute `cache_hit_rate × 100`. State raw `total_cache_read` and `total_input`. Benchmark: >70% strong, 40–70% moderate, <40% weak prompt-cache utilization.

### 2. Write vs Read Reuse
Compute `cache_reuse = total_cache_read / total_cache_write`. Show both token counts. Flag if reuse < 1 (writing more cache than is ever read back).

### 3. Cache Spend Split
From `/api/pricing/cost` breakdown, sum `cache_read_cost` and `cache_write_cost` across all models. Show the dollar split and what fraction of total cost is cache-write overhead vs cache-read savings.

### 4. Sessions With Poor Reuse
From `/api/sessions?limit=200`, parse `metadata.usage_extras` for per-session cache read/write where available; rank sessions by lowest read/write reuse (and by cache_write-heavy cost). List the worst 10 with model, cost, and reuse ratio. Use `/api/sessions/{id}` to drill into any single flagged session.

### 5. Recommendations
- Sessions where `cache_write >> cache_read`: short or one-shot sessions rarely recoup cache writes — note them.
- Stable, repeated context (system prompts, large files) should be cached once and reused; high churn defeats caching.
- Estimate the dollar impact of raising the hit rate to the next benchmark tier.

## Output

Structured Markdown with tables. Currency as USD to 4 decimal places; rates as $/Mtok; percentages with ▲/▼ for any trend. Token counts with thousands separators.
