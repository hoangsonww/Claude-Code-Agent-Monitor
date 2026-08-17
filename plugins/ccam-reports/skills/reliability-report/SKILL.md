---
name: reliability-report
description: >
  Generate a CCAM reliability report from session outcomes, hook events,
  alerts, tool failures, and data freshness. Use for health reviews, incident
  follow-up, hook-delivery audits, or reliability trend summaries.
---

# Reliability Report

1. Confirm the review window and data scope.
2. Read stats, analytics, recent events, alert history, and workflow error
   propagation.
3. Separate:
   - Active, waiting, completed, error, and abandoned sessions
   - API errors, tool failures, interrupted turns, and stale data
   - Trigger, impact, recovery, and remaining risk
4. Compare `PreToolUse` and `PostToolUse` counts without assuming every gap is a
   failure. Check matching event context.
5. End with ranked corrective actions and the exact evidence needed for any
   unresolved hypothesis.
6. Remain read-only.
