---
description: >
  Review the configured cost alert rules and the alerts currently fired on the
  Agent Monitor dashboard, then explain exactly what tripped and why. Uses
  /api/alerts (fired feed) and /api/alerts/rules (definitions). Use when
  checking spend alerts or asking why a cost alarm went off.
---

# Cost Alert

Audit the spend guardrails: which rules exist, which have fired, and what tripped them.

## Input

The user provides: **$ARGUMENTS**

This may be empty (review everything), `"unacked"` (only unacknowledged alerts),
or a rule name to focus on.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/alerts/rules` | `{ rules: [{ id, name, rule_type, config, enabled, cooldown_seconds }] }` — the guardrail definitions |
| `GET /api/alerts` | `{ alerts: [{ id, rule_id, rule_name, rule_type, session_id, agent_id, message, details, triggered_at, acked }], total, unacked, limit, offset }` — the fired-alert feed, newest first. `?unacked=true` filters to unacknowledged |

## What the rule types mean

| `rule_type` | `config` | Fires when |
|-------------|----------|------------|
| `token_threshold` | `{ total_tokens }` | A session's cumulative tokens (input + output + cache_read + cache_write) cross the ceiling — the spend-relevant guardrail |
| `event_pattern` | `{ event_type?, tool_name?, summary_contains?, count?, window_minutes? }` | Matching events reach `count` within the window |
| `inactivity` | `{ minutes }` | An active session goes quiet for `minutes` |
| `status_duration` | `{ status, minutes }` | An agent is stuck in `working`/`waiting` for `minutes` |

For cost work, focus on `token_threshold`. Translate its token ceiling to dollars using the blended rate from `/api/pricing/cost` (`total_cost / total_tokens`) so the user sees the alarm in money terms.

## Report Sections

### 1. Configured guardrails
Table from `/api/alerts/rules`: name, type, the human-readable threshold (e.g. `token_threshold → 12,500,000 tokens ≈ $50.0000`), enabled state, cooldown. Flag rules that are `disabled` or have no spend-relevant guardrail at all.

### 2. Fired alerts
Table from `/api/alerts`: rule name, `triggered_at`, scope (session/agent id), `acked`, and the `message`. Lead with the `unacked` count. Honor `"unacked"` input by querying `?unacked=true`.

### 3. What tripped — per alert
For each fired alert, parse `details` and explain in plain terms: e.g. *"session X crossed 12,500,000 tokens (threshold 12,500,000) ≈ $50.12 at current rates — your `token_threshold` budget rule fired."* Tie the observed value back to the rule's config.

### 4. Next steps
Suggest acknowledging stale alerts (`POST /api/alerts/:id/ack` or `/api/alerts/ack-all`), tightening or loosening a threshold, or arming a missing budget rule (point to the `budget-set` skill).

## Output

Markdown tables. Currency as USD to 4 decimal places; token counts with thousands separators. Make the link between each fired alert and the rule that produced it explicit — never report a raw alert without saying which rule tripped and why.
