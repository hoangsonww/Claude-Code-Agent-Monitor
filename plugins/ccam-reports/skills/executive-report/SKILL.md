---
name: executive-report
description: >
  Generate a concise stakeholder report from CCAM sessions, analytics, cost,
  alerts, and workflow intelligence. Use for release summaries, leadership
  updates, operational reviews, or a scoped Markdown report with evidence.
---

# Executive Report

1. Confirm the time window, provider scope, and source scope.
2. Read:
   - `GET /api/stats`
   - `GET /api/analytics`
   - `GET /api/pricing/cost`
   - `GET /api/alerts?limit=100`
   - `GET /api/workflows?status=all`
3. Report:
   - Scope and data freshness
   - Sessions, agents, events, tokens, and cost
   - Completion, error, and alert outcomes
   - Workflow complexity and subagent effectiveness
   - Three evidence-backed highlights
   - Three prioritized follow-ups
4. Use Markdown tables and cite exact API values. Distinguish zero from missing
   or unavailable data.
5. Do not mutate dashboard state.
