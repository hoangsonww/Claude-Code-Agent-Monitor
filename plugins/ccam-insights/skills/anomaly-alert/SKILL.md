---
name: anomaly-alert
description: >
  Identify anomalous sessions using Agent Monitor data — cost outliers from
  the pricing engine, token anomalies (cache miss spikes, compaction baseline
  surges), unusual event type ratios (PreToolUse/PostToolUse gaps, APIError
  clusters), behavioral deviations from workflow intelligence (complexity
  score outliers, error propagation anomalies), and sessions with abnormal
  metadata (extreme turn_count, high thinking_blocks, zero turn_duration).
---

# Anomaly Alert

Detect anomalous sessions in Claude Code Agent Monitor data.

## Input

The user provides: **$ARGUMENTS**

This may be:
- "all" or empty (default: check all anomaly types)
- "cost" for cost anomalies only
- "duration" for duration anomalies only
- "errors" for error rate anomalies only
- A sensitivity level: "strict" (1σ), "normal" (2σ), "relaxed" (3σ)

## Procedure

1. **Fetch baseline data** from `http://localhost:4820`:
   - `GET /api/sessions?limit=500` — historical sessions for baseline
   - `GET /api/analytics` — aggregated metrics
   - `GET /api/pricing/cost` — cost data per session

2. **Compute baselines** for each metric:
   - Mean, median, standard deviation
   - P25, P75, P90, P95, P99 percentiles
   - Interquartile range (IQR) for robust outlier detection

3. **Detect anomalies** using statistical thresholds:

   ### Cost Anomalies
   - Sessions costing >2σ above mean
   - Single sessions exceeding daily average
   - Sudden cost spikes (session-over-session increase >200%)

   ### Duration Anomalies
   - Sessions lasting >2σ above mean duration
   - Extremely short sessions (<1 minute) that still incur cost
   - Sessions with unusual active-vs-idle ratios

   ### Error Rate Anomalies
   - Sessions with error rates >2σ above baseline
   - New error types not seen in previous sessions
   - Sessions with >3 consecutive tool failures

   ### Behavioral Anomalies
   - Unusual tool combinations not seen before
   - Sessions with abnormally high compaction counts
   - Model switches mid-session (if unexpected)
   - Sessions with no tool usage (pure conversation)

   ### Token Anomalies
   - Input/output token ratio far from historical norm
   - Cache miss rate significantly higher than average
   - Token usage growing faster than session count

4. **Classify each anomaly**:
   - **🔴 Critical**: Likely indicates a real problem requiring attention
   - **🟡 Warning**: Unusual but may be expected for certain tasks
   - **🔵 Info**: Interesting deviation worth noting

## Output Format

Present as an **Anomaly Report**:

```
═══════════════════════════════════════════════
  ANOMALY DETECTION REPORT
  Analyzed: N sessions | Baseline: last 30 days
  Anomalies found: N (🔴 N critical, 🟡 N warn, 🔵 N info)
═══════════════════════════════════════════════
```

For each anomaly:
- Session ID and timestamp
- Anomaly type and severity
- Observed value vs expected range
- Possible explanation
- Recommended action (if any)
