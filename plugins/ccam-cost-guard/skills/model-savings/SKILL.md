---
description: >
  Estimate the dollars saved by routing eligible Claude Code work to a cheaper
  model family, using the Agent Monitor pricing engine. Re-prices each model's
  token mix at the target family's rates and quantifies the delta. Uses
  /api/pricing (rates), /api/pricing/cost (current per-model spend), /api/sessions,
  and /api/analytics. Use when hunting for cost cuts or comparing model tiers.
---

# Model Savings

Quantify how much spend you would recover by moving eligible work to a cheaper model.

## Input

The user provides: **$ARGUMENTS**

This is the routing question — e.g. `"Opus → Sonnet"`, `"move simple work to Haiku"`,
or empty (analyze every premium model against the next tier down). If no target family
is named, default to proposing the next-cheaper tier per model and say so.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/pricing` | `{ pricing: [{ model_pattern, display_name, input_per_mtok, output_per_mtok, cache_read_per_mtok, cache_write_per_mtok }] }` — the rate card for every family |
| `GET /api/pricing/cost` | `{ total_cost, breakdown: [{ model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost, matched_rule }] }` — current spend and the exact token mix per model |
| `GET /api/sessions?limit=200` | Sessions with `model`, inline `cost`, and `metadata` (turn_count, thinking_blocks) — used to judge which work is *eligible* to downshift |
| `GET /api/analytics` | `agent_types`, `tool_usage`, `total_subagents` — corroborate which task types are low-complexity and safe to route cheaper |

## Savings method

For each candidate model in the cost `breakdown`, re-price its **exact token mix** at the target family's rates:

```
cost_at_target = (input_tokens      / 1M) × target.input_per_mtok
               + (output_tokens     / 1M) × target.output_per_mtok
               + (cache_read_tokens / 1M) × target.cache_read_per_mtok
               + (cache_write_tokens/ 1M) × target.cache_write_per_mtok

savings = current_model_cost − cost_at_target
```

Pull `target.*_per_mtok` from `/api/pricing` (longest `model_pattern` match wins). Default rates ($/Mtok in/out/cacheRead/cacheWrite): **Opus** $5/$25/$0.50/$6.25, **Sonnet** $3/$15/$0.30/$3.75, **Haiku** $1/$5/$0.10/$1.25.

### Eligibility — don't promise savings on work that needs the big model

Re-pricing the full token mix is the *theoretical ceiling*. Scope it to **eligible** work:
- Low-turn sessions (`metadata.turn_count` small) and simple subagent/tool work are safe to downshift.
- Heavy-reasoning sessions (many thinking_blocks, high turn counts) likely need the premium model — exclude or discount them.
- Report both the **full re-price** (ceiling) and an **eligible-only** estimate, and state the eligibility rule you applied.

## Report Sections

### 1. Current spend by model
Table from `/api/pricing/cost`: each model, its 4 token counts, and current cost. Note its share of `total_cost`.

### 2. Re-priced at target family
For each candidate, show `cost_at_target` and `savings` (absolute $ and %). Make the target rate card explicit.

### 3. Eligible-only estimate
Apply the eligibility rule and recompute savings over just the downshiftable token mix. Show how many sessions / what share of tokens qualified.

### 4. Recommended routing
Rank routing moves by eligible monthly savings (descending), top 5. For each: source → target, the token mix moved, estimated $ saved, and a confidence level (high/medium/low) based on how clearly the work is low-complexity.

### 5. Caveats
Cheaper models may need more turns or produce more output — note that realized savings can be lower than the static re-price, and that quality-sensitive work should stay on the premium tier.

## Output

Markdown tables. Currency as USD to 4 decimal places; token counts with thousands separators; rates as $/Mtok. Always present both the ceiling (full re-price) and the eligible-only estimate so the number is honest.
