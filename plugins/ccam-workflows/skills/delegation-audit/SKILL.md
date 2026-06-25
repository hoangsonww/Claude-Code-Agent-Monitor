---
description: >
  Audit model delegation and subagent effectiveness for a session — which
  models handled which subagent types, per-type success rates and average
  durations, and wasted delegations (heavy models on trivial work or types
  that consistently fail) — using the Agent Monitor workflow intelligence API.
  Use when reviewing how a session delegated work across models and subagents.
---

# Delegation Audit

Audit how a Claude Code session delegated work: model-to-subagent mapping and whether each delegation paid off.

## Input

The user provides: **$ARGUMENTS**

A session ID. If empty, fetch `GET /api/sessions?limit=1` and audit the most recent session, stating which one.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/workflows/{sessionId}` | The `modelDelegation` dataset (which models are delegated which subagent types) and the `effectiveness` dataset (per-type completion/success rate, avg duration, task success) |
| `GET /api/agents` | Raw subagent records (`type`, `model`, `status`, `depth`, `parent`) to corroborate counts and statuses |

## Report Sections

### 1. Delegation Matrix
From `modelDelegation`: a model × subagent-type table of how many agents of each type each model ran.
| Model | explore | code-review | debugger | ... | Total |
|-------|---------|-------------|----------|-----|-------|

### 2. Effectiveness by Subagent Type
From `effectiveness`: per type, the success rate and average duration.
| Subagent type | Count | Success rate | Avg duration | Verdict |
|---------------|-------|--------------|--------------|---------|
Mark types below ~70% success as low-yield.

### 3. Wasted Delegations
Flag, with evidence:
- A heavy model (e.g. Opus) assigned to a simple/low-stakes subagent type that a cheaper model handled successfully elsewhere — candidate for rebalancing.
- Subagent types with low success rates (effort spent, task not completed).
- Duplicate delegations: the same type spawned repeatedly with poor success (retry churn).

### 4. Rebalancing Suggestions
Concrete model reassignments grounded in the matrix and effectiveness data. State the type, the model used, the success rate, and the suggested model — only where the data supports it.

## Output

- Markdown tables for the matrix and effectiveness.
- Success rates as percentages; durations in human units (e.g. `1m 12s`).
- Use ▲/▼ when comparing a type's success rate against the session-wide average.
- Cite only numbers returned by the API; do not infer success rates that the `effectiveness` dataset does not provide.
- If the dashboard is unreachable, tell the user to start it with `npm start` from the repo root.
