---
name: session-compare
description: >
  Compare two sessions side-by-side using Agent Monitor data — per-model
  token usage (input/output/cache_read/cache_write + compaction baselines),
  pricing engine cost breakdowns, workflow intelligence (complexity scores,
  tool flow transitions, subagent effectiveness), session metadata
  (thinking_blocks, turn_count, turn_duration_ms, usage_extras), and
  full event timelines with all 10+ event types.
---

# Session Compare

Compare two Claude Code sessions side-by-side using Agent Monitor data.

## Input

The user provides: **$ARGUMENTS**

This may be:
- Two session IDs: "abc123 def456"
- "best vs worst" — compare highest and lowest productivity sessions
- "latest 2" — compare the two most recent sessions
- A session ID + "vs average" — compare one session against the baseline

## Procedure

1. **Identify sessions to compare**:
   - If two IDs given: fetch both from `http://localhost:4820/api/sessions/{id}`
   - If "best vs worst": fetch sessions, score by completion + cost efficiency, pick extremes
   - If "latest 2": `GET /api/sessions?limit=2` (default sort: most recently updated first)
   - If "vs average": fetch session + compute averages from last 50 sessions

2. **Gather detailed data** for each session:
   - Session metadata: `GET /api/sessions/{id}`
   - Events: `GET /api/events?session_id={id}`
   - Agents: `GET /api/agents?session_id={id}`
   - Cost: `GET /api/pricing/cost/{id}`

3. **Build comparison**:

   ### Overview Comparison
   | Metric | Session A | Session B | Difference |
   |--------|-----------|-----------|-----------|
   | Status | completed | error | — |
   | Model | sonnet-4 | sonnet-4 | same |
   | Duration | 12m 34s | 45m 12s | +32m 38s |
   | Total Cost | $0.0234 | $0.1456 | +522% |
   | Events | 45 | 187 | +315% |
   | Tools Used | 8 | 12 | +4 |
   | Error Count | 0 | 7 | +7 |
   | Agents | 2 | 5 | +3 |

   ### Token Comparison
   | Token Type | Session A | Session B | Difference |
   |-----------|-----------|-----------|-----------|
   | Input | N | N | ±N% |
   | Output | N | N | ±N% |
   | Cache Read | N | N | ±N% |
   | Cache Write | N | N | ±N% |
   | Efficiency | N% | N% | ±N% |

   ### Tool Usage Comparison
   - Tools unique to Session A
   - Tools unique to Session B
   - Shared tools with usage count comparison
   - Error rate per tool in each session

   ### Timeline Comparison
   - Side-by-side event timeline
   - Where sessions diverged in approach
   - Key decision points that led to different outcomes

   ### Agent Activity Comparison
   - Agent counts and types
   - Subagent strategy differences
   - Agent success rates

4. **Analysis**:
   - Why one session was more efficient/successful than the other
   - Key decisions that made the difference
   - Lessons to apply to future sessions

## Output Format

Present as a side-by-side comparison report with:
- Executive comparison summary (which session was "better" and why)
- Structured comparison tables with color-coded differences (green = better, red = worse)
- A "Lessons Learned" section with actionable takeaways
- Overall winner declaration with justification
