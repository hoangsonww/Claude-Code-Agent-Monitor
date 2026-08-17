---
name: productivity-score
description: >
  Calculate a productivity score using actual Agent Monitor metrics —
  session completion rates, cache efficiency (cache_read vs input),
  compaction pressure (baseline tokens), turn velocity (turn_count /
  total_turn_duration_ms), tool success ratio (PreToolUse vs PostToolUse),
  and the workflow intelligence API's complexity and effectiveness scores.
---

# Productivity Score

Calculate a productivity scorecard from the Agent Monitor's real data.

## Input

The user provides: **$ARGUMENTS**

Options: "today", "this week", "last 30 days", a session ID, or "compare" for period comparison.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/analytics` | Token totals (`total_input`, `total_output`, `total_cache_read`, `total_cache_write` — baselines pre-summed), tool_usage top 20, daily_events/sessions, event_types, sessions_by_status, agents_by_status, avg_events_per_session, total_subagents |
| `GET /api/sessions?limit=100` | Sessions with metadata JSON: `thinking_blocks`, `turn_count`, `total_turn_duration_ms`, `usage_extras` (service_tier, speed, inference_geo) |
| `GET /api/pricing/cost` | Total cost with per-model breakdown |
| `GET /api/workflows/{sessionId}` | 11 workflow datasets: stats, orchestration, toolFlow, effectiveness, patterns, modelDelegation, errorPropagation, concurrency, complexity, compaction, cooccurrence |

## Score Components (each 0–100)

### 1. Completion Rate (20% weight)
From `sessions_by_status`:
- `completed / (completed + error + abandoned) × 100`
- Bonus for high completed-to-active ratio
- Penalty for abandoned sessions (wasted work)

### 2. Token Efficiency (20% weight)
From analytics `tokens` (baselines are pre-summed into totals):
- **Cache hit rate**: `total_cache_read / (total_cache_read + total_input) × 100`
  - Above 60% = excellent, below 30% = poor
- **Output concentration**: `total_output / total_input` — 0.3–0.8 is balanced

### 3. Tool Effectiveness (20% weight)
From `event_types`:
- **Success ratio**: Count `PostToolUse` / Count `PreToolUse` — should be ~1.0; gap = tool failures
- **API error rate**: Count `APIError` / total events — should be near 0
- From workflow `effectiveness` data: subagent completion rates, task success per type

### 4. Velocity (20% weight)
From session metadata:
- **Turns per session**: average `turn_count` across sessions
- **Turn speed**: average `total_turn_duration_ms / turn_count` — lower = faster
- **Events per session**: from `avg_events_per_session` in analytics overview
- **Thinking depth**: average `thinking_blocks` — more thinking = more thorough (neutral metric)

### 5. Cost Efficiency (20% weight)
From pricing:
- **Cost per completed session**: `total_cost / completed_sessions`
- **Cost trend**: comparing current period to previous (decreasing = improving)
- **Model optimization**: sessions using expensive models (Opus) for tasks subagents handle with Haiku/Sonnet

## Overall Score

Weighted sum → letter grade:
- **A+** (95-100), **A** (90-94), **B+** (85-89), **B** (80-84), **C+** (75-79), **C** (70-74), **D** (60-69), **F** (<60)

## Output Format

```
═══════════════════════════════════════
  PRODUCTIVITY SCORE: 87/100 (B+)
═══════════════════════════════════════
  Completion Rate   ████████░░  80/100
  Token Efficiency  █████████░  92/100
  Tool Effectiveness████████░░  85/100
  Velocity          █████████░  88/100
  Cost Efficiency   █████████░  90/100
═══════════════════════════════════════
```

Then: top 3 strengths, top 3 improvement areas with actionable steps, and period comparison if available.
