---
description: >
  Define a spend budget for Claude Code and, optionally, create a cost alert
  rule that fires when usage crosses the limit, via POST /api/alerts/rules on
  the Agent Monitor dashboard. Reads current spend from /api/pricing/cost to
  size the budget sensibly and explains every rule field before writing.
  Use when setting a spend limit or wiring up a budget guardrail.
---

# Budget Set

Help the user define a spend budget and turn it into a live cost guardrail on the
Agent Monitor dashboard.

## Input

The user provides: **$ARGUMENTS**

This is the budget to set — e.g. `"$50/month"`, `"$10/week"`, or `"200000 tokens"`.
If a period is omitted, treat it as a monthly budget and say so. If no number is
given, read current spend first and propose a target.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/pricing/cost` | `{ total_cost, breakdown: [{ model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost, matched_rule }] }` — current spend, used to size the budget and compute the blended $/token rate |
| `GET /api/alerts/rules` | `{ rules: [{ id, name, rule_type, config, enabled, cooldown_seconds }] }` — existing rules, so you don't create a duplicate guardrail |
| `POST /api/alerts/rules` | Create a rule. Body: `{ name, rule_type, config, enabled?, cooldown_seconds? }`. Returns `{ rule }` |

## How a budget becomes a rule

The dashboard's alerting engine fires on **tokens**, not dollars. The spend-relevant
rule type is **`token_threshold`**, whose config is `{ total_tokens }` — it fires when
a session's cumulative tokens (input + output + cache_read + cache_write) cross the
threshold. To turn a **dollar** budget into a token ceiling:

```
blended_rate_per_token = total_cost / total_tokens          # from /api/pricing/cost
token_ceiling          = budget_dollars / blended_rate_per_token
```

Compute `total_tokens` by summing the four token columns across the cost `breakdown`.

### Rule fields explained

| Field | Meaning |
|-------|---------|
| `name` | Human label shown in the alert feed (e.g. `"Monthly $50 budget"`). Required, non-empty. |
| `rule_type` | `"token_threshold"` for a spend guardrail. (Other types: `event_pattern`, `inactivity`, `status_duration` — not spend-related.) |
| `config.total_tokens` | Positive integer token ceiling. A session crossing it fires the alert. Derive from the dollar budget as above. |
| `enabled` | `true` to arm immediately (default), `false` to stage it. |
| `cooldown_seconds` | Minimum seconds between re-fires for the same scope. Default `300`. Raise it (e.g. `3600`) so a single overspending session doesn't spam the feed. |

## Report Sections

### 1. Current spend snapshot
From `/api/pricing/cost`: `total_cost`, total tokens, and the blended $/Mtok rate. State how much of the proposed budget is already consumed.

### 2. Budget interpretation
Restate the parsed budget (amount + period). If converting dollars → tokens, show the blended rate and the `token_ceiling` arithmetic.

### 3. Existing guardrails
List any `token_threshold` rules from `/api/alerts/rules` so the user sees what is already in place; warn before creating a near-duplicate.

### 4. Proposed alert rule
Show the exact JSON body you would POST, with each field annotated. Then give the ready-to-run command (only run it on explicit confirmation):

```
curl -s -X POST http://localhost:4820/api/alerts/rules \
  -H 'Content-Type: application/json' \
  -d '{"name":"Monthly $50 budget","rule_type":"token_threshold","config":{"total_tokens":12500000},"cooldown_seconds":3600}'
```

### 5. Confirmation
On success, echo the returned `rule` (id, name, config). Remind the user that the rule is per-session token usage — to track a whole-period dollar budget, pair it with `/ccam-cost-guard:forecast` and the `spend-forecast` skill.

## Output

Markdown with the snapshot, the conversion math, and the annotated rule body. Currency as USD to 4 decimal places; token counts with thousands separators. Only POST after the user confirms — never create a rule silently.
