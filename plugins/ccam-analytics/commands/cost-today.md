---
description: Quick total cost plus a per-model one-liner from the dashboard pricing engine.
argument-hint: "[today|week]"
---

Print a quick cost snapshot from the Agent Monitor dashboard pricing engine.

The user's scope is **$ARGUMENTS** (default `today` if empty; accepts `today` or `week`).

Fetch the fleet-wide cost breakdown:

```
curl -s http://localhost:4820/api/pricing/cost
```

This returns `{ total_cost, breakdown: [{ model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost, matched_rule }] }`.

Then print, concisely:

1. **Total cost** — `total_cost` as USD to 4 decimal places, labeled with the scope (`$ARGUMENTS`).
2. **Per-model one-liners** — one line per entry in `breakdown`, sorted by `cost` descending:
   `<model> — $<cost to 4dp> (in <input_tokens>, out <output_tokens>, cacheR <cache_read_tokens>, cacheW <cache_write_tokens>)`

Keep token counts with thousands separators. No tables, no preamble — just the total and the per-model lines.

Note: the endpoint returns lifetime totals; if the user asked for `today` or `week` and the data is not scoped, say so in one line rather than fabricating a windowed number. If the dashboard is unreachable, tell the user to start it with `npm start` from the repo root.
