---
name: workflow-report
description: >
  Create a workflow-intelligence report from CCAM orchestration, delegation,
  tool flow, concurrency, complexity, compaction, and fleet-run data. Use for
  architecture reviews, agent-fleet analysis, or workflow optimization reports.
---

# Workflow Report

1. Confirm whether the report covers all sessions or one session.
2. Read `GET /api/workflows` and, when scoped, `GET /api/workflows/{sessionId}`.
3. Summarize orchestration depth, subagent types, delegation patterns, tool
   transitions, concurrency, model delegation, error propagation, and
   compaction.
4. Identify serialization bottlenecks, repeated patterns, and error-amplifying
   branches only when supported by returned values.
5. Provide a short architecture narrative, a metrics table, and prioritized
   optimization opportunities.
6. Do not claim causality from correlation alone.
