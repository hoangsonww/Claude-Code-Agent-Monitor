---
name: daily-standup
description: >
  Generate a daily standup summary from recent Claude Code sessions — completed
  work grouped by project (cwd), session costs from the pricing engine,
  tool invocations, error/compaction/APIError events, and turn velocity
  metrics from session metadata (turn_count, total_turn_duration_ms).
---

# Daily Standup

Generate a daily standup report from Claude Code Agent Monitor data.

## Input

The user provides: **$ARGUMENTS**

This may be:
- "today" or empty (default: last 24 hours)
- "yesterday" for the previous day
- A specific date: "2025-04-10"

## Procedure

1. **Fetch recent session data** from `http://localhost:4820`:
   - `GET /api/sessions?limit=50` (default sort: most recently updated first)
   - Filter sessions that started within the target day
   - For each matching session: `GET /api/events?session_id={session_id}`

2. **Compile standup sections**:

   ### ✅ What I accomplished
   - List each completed session with:
     - Brief description (from session name or first tool's context)
     - Working directory (project context)
     - Key tools used and outcomes
     - Duration and model used
   - Group by project/working directory if multiple

   ### ⚠️ Issues encountered
   - Sessions that ended in `error` or `abandoned` status
   - Tools that failed (from error events)
   - Compaction events (hit context limits)
   - Unusually long sessions (>2x average duration)

   ### 📋 Key metrics
   - Total sessions: N
   - Total time spent: X hours Y minutes
   - Tools invoked: N (top 3 listed)
   - Estimated cost: $X.XX
   - Completion rate: N%

   ### 🔮 Suggested focus areas
   - Based on incomplete/error sessions, suggest what to revisit
   - Based on tool patterns, suggest workflow improvements

3. **Format for standup**:
   - Keep it concise — aim for a 2-minute read
   - Lead with accomplishments
   - Be honest about blockers
   - Make metrics scannable

## Output Format

Present as a clean standup report with emoji section headers, bullet points for items, and a compact metrics table. Add a one-line summary at the top suitable for pasting into Slack or a team channel.
