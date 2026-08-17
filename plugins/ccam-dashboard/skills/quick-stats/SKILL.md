---
name: quick-stats
description: >
  One-line summary of key Agent Monitor metrics — active sessions, total
  cost from the pricing engine, events today from daily_events, top tool
  from tool_usage, and current model from the most recent session. Use for
  a fast at-a-glance check without leaving the terminal.
---

# Quick Stats

One-line summary of key Agent Monitor metrics.

## Input

The user provides: **$ARGUMENTS**

Options: empty (default), "cost" (cost only), "sessions" (sessions only), "tokens" (token summary).

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/stats` | `{ total_sessions, active_sessions, active_agents, total_agents, total_events, events_today, ws_connections, agents_by_status, sessions_by_status }` |
| `GET /api/pricing/cost` | `{ total_cost, breakdown }` |
| `GET /api/analytics` | tokens (total_input, total_output, total_cache_read, total_cache_write — baselines pre-summed), tool_usage, daily_sessions, daily_events |
| `GET /api/sessions?limit=1` | Most recent session for model/status |

## Output

Produce a single-line or compact summary:

**Default format:**
```
📊 127 sessions | 💰 $4.2301 total cost | 🔧 4,892 events | ⚡ 3 active | 🏆 Top tool: Read (1,204)
```

**Cost format:**
```
💰 Total: $4.2301 | Sonnet: $3.1200 | Opus: $0.9800 | Haiku: $0.1301 | Cache efficiency: 67%
```

**Sessions format:**
```
📋 127 total | ✅ 98 completed | ❌ 12 errored | 🏃 3 active | 💤 14 abandoned | Rate: 87%
```

**Tokens format:**
```
🔤 Input: 2.4M | Output: 890K | Cache Read: 1.8M | Cache Write: 340K
```

Keep it short enough to scan in a terminal prompt.
