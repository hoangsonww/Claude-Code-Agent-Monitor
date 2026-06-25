---
description: >
  Break down Claude Code usage by model family (Opus / Sonnet / Haiku) from the
  Agent Monitor dashboard — each family's share of tokens, share of cost, and
  the spots where an expensive model is doing cheap work. Pulls per-model token
  and cost splits from /api/pricing/cost, current rates from /api/pricing, fleet
  token totals from /api/analytics, and per-session model assignment from
  /api/sessions. Use when deciding model routing or whether to downshift work to
  a cheaper tier.
---

# Model Mix

See where your tokens and dollars go by model family, and where to re-route work.

## Input

The user provides: **$ARGUMENTS**

This may be: empty (analyze the whole fleet), "today" / "this week" / a date range, or a focus like "where is Opus overused?". When empty, analyze all data from `/api/pricing/cost` and `/api/sessions`.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/pricing/cost` | `{ total_cost, breakdown: [{ model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost, matched_rule }] }` — per-model token and cost split |
| `GET /api/pricing` | `{ pricing: [{ model_pattern, display_name, input_per_mtok, output_per_mtok, cache_read_per_mtok, cache_write_per_mtok }] }` — rates per family |
| `GET /api/analytics` | `tokens` totals (total_input, total_output, total_cache_read, total_cache_write — baselines pre-summed), `agent_types` for delegation context |
| `GET /api/sessions?limit=200` | Session list — model, cwd, started_at, ended_at, inline `cost`, metadata (JSON: thinking_blocks, turn_count, total_turn_duration_ms, usage_extras) |

### How families and rates work

Map each `model` in the cost breakdown to a family from its `matched_rule` / `display_name`:

| Family | Input $/Mtok | Output $/Mtok | Cache Read $/Mtok | Cache Write $/Mtok |
|--------|-------------|--------------|-------------------|-------------------|
| Opus 4.5/4.6 | $5 | $25 | $0.50 | $6.25 |
| Sonnet 4/4.5/4.6 | $3 | $15 | $0.30 | $3.75 |
| Haiku 4.5 | $1 | $5 | $0.10 | $1.25 |

`cost = (tokens / 1M) × rate_per_mtok` summed over the 4 token types; longest `model_pattern` wins. Opus output costs ~5× Sonnet and ~5× Haiku per token, so a family's **cost share routinely exceeds its token share** — that gap is the routing signal.

## Report Sections

### 1. Token Share by Family
Aggregate `input + output + cache_read + cache_write` tokens per family from `/api/pricing/cost`. Show each family's tokens and percent of total. Cross-check the grand total against `/api/analytics` token totals.

### 2. Cost Share by Family
Sum `cost` per family. Show each family's dollar total and percent of `total_cost`. Place the cost-share % next to the token-share % so the premium gap is visible.

### 3. Cost-vs-Token Gap
For each family compute `cost_share − token_share`. A large positive gap on Opus/Sonnet signals premium spend concentration. Rank families by gap.

### 4. Expensive Model on Cheap Work
From `/api/sessions?limit=200`, find Opus/Sonnet sessions with signals of low complexity: low `turn_count`, short `total_turn_duration_ms`, few thinking_blocks, or small token footprints. List candidates that could plausibly run on a cheaper tier, with current cost and estimated cost if downshifted.

### 5. Routing Recommendations
- Quantify the savings of moving each candidate workload to the next-cheaper family (recompute cost at that family's rates).
- Note work that genuinely needs Opus (deep reasoning, long context) and should stay.
- Summarize a suggested routing policy (e.g. Haiku for mechanical edits, Sonnet for default dev, Opus for hard reasoning).

## Output

Structured Markdown with tables. Currency as USD to 4 decimal places; rates as $/Mtok; token shares and cost shares as percentages; use ▲/▼ for the cost-vs-token gap and any trend. Token counts with thousands separators.
