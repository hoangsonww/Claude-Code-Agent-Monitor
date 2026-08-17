---
name: data-export
description: >
  Export Claude Code session and analytics data in JSON, CSV, or Markdown
  formats. Supports exporting sessions, events, costs, and analytics
  for external analysis or reporting. Use for data backup or integration.
---

# Data Export

Export Agent Monitor data in various formats.

## Input

The user provides: **$ARGUMENTS**

This may be:
- A data type: "sessions", "events", "analytics", "costs", "all"
- A format: "json", "csv", "markdown" (default: json)
- A filter: "last 7 days", "session {id}", "completed only"
- Combined: "sessions csv last 30 days"

## Procedure

1. **Parse the request** to determine:
   - Data scope: which data to export
   - Format: output format
   - Filters: time range, status, session ID

2. **Fetch data** from `http://localhost:4820`:
   - Sessions: `GET /api/sessions?limit=1000`
   - Events: `GET /api/events?limit=5000`
   - Analytics: `GET /api/analytics`
   - Costs: `GET /api/pricing/cost`
   - Full export: `GET /api/settings/export`

3. **Transform to requested format**:

   ### JSON Format
   Pretty-printed JSON with metadata header:
   ```json
   {
     "export": {
       "source": "Claude Code Agent Monitor",
       "exported_at": "2025-04-11T12:00:00Z",
       "filters": { "type": "sessions", "range": "last 7 days" },
       "count": 42
     },
     "data": [...]
   }
   ```

   ### CSV Format
   Standard CSV with headers, proper quoting, and ISO timestamps:
   ```
   id,name,status,model,started_at,ended_at,duration_minutes,cost_usd
   ```

   ### Markdown Format
   Human-readable tables with summary statistics:
   ```markdown
   # Agent Monitor Export — Sessions (Last 7 Days)
   | ID | Name | Status | Model | Duration | Cost |
   |...
   **Total: 42 sessions, $12.34 cost**
   ```

4. **Output the data**:
   - For small exports (<100 rows): output directly
   - For large exports: save to file and report the path
   - Include row count and any filter notes

## Output Format

Deliver the exported data in the requested format. Always include:
- Export metadata (when, what, filters applied)
- Row/record count
- Suggested filename for saving
