---
description: Surface the top 3 data-backed insights about your Claude Code usage right now
---

Produce the **top 3 insights** about Claude Code usage right now, each backed by real numbers from the Agent Monitor dashboard.

1. Fetch high-level state:
   - `curl -s http://localhost:4820/api/stats` → total_sessions, active_sessions, active_agents, total_events, events_today, agents_by_status, sessions_by_status.
   - `curl -s http://localhost:4820/api/analytics` → tokens (total_input/total_output/total_cache_read/total_cache_write), tool_usage (top 20), daily_events (365d), daily_sessions (365d), event_types, avg_events_per_session, total_subagents.

2. Derive signal, citing exact field values:
   - Cache hit rate = `total_cache_read / (total_cache_read + total_input)`.
   - Activity trend: compare the last 7 days of `daily_sessions`/`daily_events` against the prior 7.
   - Concentration: the single most-used tool and most-frequent `event_type`, with its share of the total.
   - Error pressure: `APIError` share of events; subagent fan-out via `total_subagents` and `avg_events_per_session`.

3. Pick the **3 most decision-relevant** findings (biggest cost lever, sharpest trend, or clearest anomaly). For each print:
   - A one-line headline with the supporting number.
   - Why it matters in one sentence.
   - One concrete action.

Output rules: rank by impact (most important first); currency in USD to 4 decimals; rates as percentages to 2 decimals; use ▲/▼ for trend direction; cite only fields the API returned — never fabricate. If `curl` cannot reach `http://localhost:4820`, tell the user to start the dashboard with `npm start` from the repo root.
