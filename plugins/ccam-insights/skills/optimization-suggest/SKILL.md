---
name: optimization-suggest
description: >
  Suggest concrete optimizations for Claude Code usage based on historical
  session data. Covers cost reduction, speed improvement, error prevention,
  and workflow efficiency. Use for data-driven optimization planning.
---

# Optimization Suggest

Generate data-driven optimization recommendations for Claude Code usage.

## Input

The user provides: **$ARGUMENTS**

This may be:
- "all" or empty (default: comprehensive optimization scan)
- "cost" for cost reduction focus
- "speed" for performance/speed focus
- "quality" for error reduction focus
- "efficiency" for workflow efficiency focus

## Procedure

1. **Gather optimization data** from `http://localhost:4820`:
   - `GET /api/sessions?limit=200` — session history
   - `GET /api/analytics` — tool and token analytics
   - `GET /api/pricing/cost` — cost data
   - `GET /api/pricing` — pricing rules for model comparison
   - Sample event streams for behavioral analysis

2. **Analyze optimization opportunities**:

   ### 💰 Cost Optimization
   - **Model downgrade opportunities**: Tasks completed with expensive models that could use cheaper ones
     - Compare success rates per model per task type
     - Calculate savings from model substitution
   - **Cache optimization**: Sessions with low cache hit rates
     - Identify sessions that could benefit from better prompt caching
   - **Early termination**: Sessions that ran longer than needed
     - Detect sessions where useful work completed well before session end
   - **Compaction reduction**: Sessions hitting context limits
     - Suggest breaking large tasks into smaller sessions

   ### ⚡ Speed Optimization
   - **Tool selection**: Faster alternatives for commonly-used tool patterns
   - **Subagent parallelization**: Tasks that could run in parallel
   - **Session planning**: Better upfront context to reduce back-and-forth
   - **Preemptive context loading**: Frequently needed files/context

   ### 🛡 Quality Optimization
   - **Error prevention**: Common error patterns with preventive measures
   - **Tool reliability**: Tools with high failure rates and alternatives
   - **Validation gaps**: Sessions lacking verification steps
   - **Recovery strategies**: Better error handling patterns

   ### 🔄 Workflow Optimization
   - **Session sizing**: Optimal session scope based on historical success
   - **Task decomposition**: Complex sessions that should be split
   - **Automation candidates**: Repetitive workflows to automate
   - **Knowledge reuse**: Patterns where previous session context could help

3. **Quantify each recommendation**:
   - Estimated impact (cost savings $, time savings %, error reduction %)
   - Implementation effort (low/medium/high)
   - Confidence level based on data available
   - Priority score = Impact × Confidence / Effort

## Output Format

Present as a prioritized optimization plan:

| # | Recommendation | Category | Impact | Effort | Priority |
|---|---------------|----------|--------|--------|----------|
| 1 | Specific action | 💰/⚡/🛡/🔄 | High | Low | ★★★★★ |
| 2 | Specific action | ... | ... | ... | ★★★★☆ |

For the top 5 recommendations, include:
- Detailed explanation with supporting data
- Step-by-step implementation guide
- Expected before/after metrics
- How to measure success
