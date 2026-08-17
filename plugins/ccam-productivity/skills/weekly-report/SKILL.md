---
name: weekly-report
description: >
  Compile a weekly productivity report using Agent Monitor data — daily_sessions
  and daily_events trends, per-session costs from pricing engine, token volumes
  (input/output/cache_read/cache_write + baselines), tool usage top 20,
  session completion rates by status, and workflow intelligence metrics.
---

# Weekly Report

Generate a comprehensive weekly productivity report from Agent Monitor data.

## Input

The user provides: **$ARGUMENTS**

This may be:
- "this week" or empty (default: current week Mon-Sun)
- "last week" for the previous week
- A date range: "2025-04-07 to 2025-04-13"

## Procedure

1. **Fetch weekly data** from `http://localhost:4820`:
   - `GET /api/sessions?limit=200` — filter to target week (default sort: most recently updated first)
   - `GET /api/analytics` — aggregated analytics
   - `GET /api/pricing/cost` — cost data

2. **Build the weekly report**:

   ### 📊 Week at a Glance
   | Metric | This Week | Last Week | Change |
   |--------|-----------|-----------|--------|
   | Sessions | N | N | ↑/↓ N% |
   | Total Hours | N | N | ↑/↓ N% |
   | Tokens Used | N | N | ↑/↓ N% |
   | Total Cost | $X.XX | $X.XX | ↑/↓ N% |
   | Completion Rate | N% | N% | ↑/↓ |

   ### 🏆 Highlights
   - Most productive day (by sessions completed)
   - Longest session and what it accomplished
   - Most used tools and any new tools adopted
   - Notable achievements (complex tasks completed, errors resolved)

   ### 📈 Daily Breakdown
   | Day | Sessions | Hours | Cost | Completion |
   |-----|----------|-------|------|------------|
   For each day of the week with activity.

   ### 🔧 Tool Usage Report
   - Top 10 tools by invocation count
   - Tools with highest error rate
   - Tool usage distribution chart (text-based)

   ### 💡 Productivity Insights
   - Peak productivity hours
   - Average session duration and trend
   - Cost efficiency trend
   - Model usage distribution

   ### 🎯 Recommendations for Next Week
   - Based on error patterns: what to improve
   - Based on cost trends: optimization opportunities
   - Based on tool usage: workflow suggestions

## Output Format

Professional report format with:
- Executive summary (3 sentences max)
- Structured tables with week-over-week comparisons
- Emoji-prefixed section headers for scannability
- Actionable recommendations in priority order
