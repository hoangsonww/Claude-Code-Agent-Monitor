---
description: Generate an evidence-backed CCAM executive, cost, reliability, or workflow report.
argument-hint: "[executive|cost|reliability|workflow] [scope]"
---

Generate the requested report type from the local CCAM API.

Use **$ARGUMENTS** to determine the report type and optional provider, source,
session, or time scope. Default to an executive report over all available local
data when no type is provided.

State the scope and freshness first. Use exact API values, distinguish
unavailable data from zero, and return Markdown with:

1. Executive summary
2. Key metrics table
3. Evidence-backed findings
4. Prioritized follow-ups

Remain read-only.
