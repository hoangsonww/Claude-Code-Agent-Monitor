---
name: cost-report
description: >
  Produce a scoped CCAM cost and token report by model, provider, source, and
  session. Use for spend reviews, model-mix analysis, unpriced usage detection,
  or export-friendly cost summaries.
---

# Cost Report

1. Confirm the time window and optional provider, source, or session scope.
2. Read `GET /api/pricing/cost`, `GET /api/analytics`, and the scoped session
   list.
3. Show total cost, model breakdown, token directions, cache efficiency,
   unpriced models, and the highest-cost sessions.
4. State the pricing rule and rate tier used when returned by the API.
5. Use USD with four decimal places and integer token counts.
6. Do not estimate missing prices as zero-cost usage without labeling them
   unpriced.
