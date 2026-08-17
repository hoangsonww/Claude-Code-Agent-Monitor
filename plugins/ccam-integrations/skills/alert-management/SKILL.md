---
name: alert-management
description: >
  Inspect fired CCAM alerts and manage alert rules for token thresholds, event
  patterns, inactivity, and status duration. Use when acknowledging alerts,
  creating or editing a rule, checking cooldowns, or connecting alert rules to
  webhook targets.
---

# Alert Management

## Read

- `ccam alerts --unacked`
- `ccam alert-rules list`

## Write

Before changing anything, show the rule name, type, normalized config, enabled
state, and cooldown. Use `--yes` only after confirmation.

```bash
ccam alert-rules create --name "Token guard" --type token_threshold \
  --config '{"total_tokens":1000000}' --cooldown 300 --yes
```

Use `ccam alert-rules update <id> ... --yes` for partial edits and
`ccam alert-rules delete <id> --yes` for deletion. Acknowledgment changes the
feed state only. It does not change the rule or underlying session.

Never invent rule configs. Read the current rule and provider catalog first.
