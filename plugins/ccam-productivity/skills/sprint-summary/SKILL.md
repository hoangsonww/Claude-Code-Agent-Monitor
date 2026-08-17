---
name: sprint-summary
description: >
  Summarize a sprint's worth of Claude Code activity — sessions grouped by
  project (cwd), per-model cost breakdown, token efficiency (cache hit rate,
  compaction baselines), subagent effectiveness from workflow API, velocity
  metrics (turn_count, turn_duration_ms), and tool diversity across the sprint.
---

# Sprint Summary

Generate a sprint summary from Claude Code Agent Monitor data.

## Input

The user provides: **$ARGUMENTS**

This may be:
- A sprint duration: "last 2 weeks", "last 10 days"
- A date range: "2025-03-31 to 2025-04-13"
- "current sprint" (default: last 14 days)

## Procedure

1. **Fetch sprint data** from `http://localhost:4820`:
   - `GET /api/sessions?limit=500` — all sessions in range (default sort: most recently updated first)
   - `GET /api/analytics` — aggregated metrics
   - `GET /api/pricing/cost` — total costs
   - For high-value sessions: `GET /api/events?session_id={id}` — event details

2. **Compile sprint summary**:

   ### 🎯 Sprint Overview
   - Sprint period: [start] to [end]
   - Total sessions: N (completed: N, errored: N, abandoned: N)
   - Total development hours with Claude Code: N
   - Total cost: $X.XX
   - Overall completion rate: N%

   ### 📦 Deliverables
   Group sessions by working directory (project):
   - **Project A** (`/path/to/project`)
     - N sessions, N hours, key activities
   - **Project B** (`/path/to/other`)
     - N sessions, N hours, key activities

   ### 📊 Velocity Metrics
   | Metric | Sprint | Previous Sprint | Trend |
   |--------|--------|-----------------|-------|
   | Sessions/day | N | N | ↑/↓ |
   | Avg session duration | Nm | Nm | ↑/↓ |
   | Cost/session | $N | $N | ↑/↓ |
   | Tokens/session | N | N | ↑/↓ |
   | Completion rate | N% | N% | ↑/↓ |

   ### 🛠 Technology Breakdown
   - Models used with distribution percentages
   - Top 15 tools by usage with category grouping
   - Subagent utilization rate

   ### ⚡ Efficiency Analysis
   - Token efficiency: cache hit rate, compaction frequency
   - Cost per completed task
   - Time-to-first-output (avg across sessions)
   - Error recovery rate (sessions that recovered from errors)

   ### 🔄 Retrospective Data Points
   - **What went well**: Highest-efficiency sessions, best completion rates
   - **What could improve**: Most expensive sessions, highest error rates
   - **Action items**: Data-driven suggestions for next sprint

## Output Format

Professional sprint report suitable for sharing with team leads or managers:
- Executive summary paragraph (5 sentences max)
- Structured data tables with trend indicators
- Grouped deliverables by project
- Numbered action items at the end
