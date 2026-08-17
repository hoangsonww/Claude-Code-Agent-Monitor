---
name: workflow-optimizer
description: >
  Analyze workflow patterns using the Agent Monitor's workflow intelligence
  API — orchestration DAGs, tool flow transitions, subagent effectiveness,
  model delegation patterns, error propagation by depth, concurrency lanes,
  compaction impact, and agent co-occurrence. Produces prioritized optimization
  recommendations with quantified impact.
---

# Workflow Optimizer

Analyze Claude Code workflows using the Agent Monitor's workflow intelligence engine.

## Input

The user provides: **$ARGUMENTS**

Options: "analyze", a session ID for single-session analysis, or a focus: "tools", "subagents", "cost", "errors".

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/sessions?limit=100` | Session list with metadata |
| `GET /api/workflows/{sessionId}` | **11 workflow datasets** (see below) |
| `GET /api/analytics` | Tool usage top 20, event types, agent types |
| `GET /api/pricing` | Model pricing rules for cost comparison |

### Workflow Intelligence API (`GET /api/workflows/{sessionId}`)

Returns these 11 datasets per session:

| Dataset | Content |
|---------|---------|
| `stats` | Aggregate session stats: tool count, agent depth, event count |
| `orchestration` | **DAG**: agent nodes with parent/child edges, depths, types |
| `toolFlow` | **Transition matrix**: tool A → tool B with counts (common sequences) |
| `effectiveness` | **Subagent success**: per-type completion rates, avg duration, task success |
| `patterns` | **Recurring sequences**: detected workflow patterns with frequency |
| `modelDelegation` | **Model choices**: which models are delegated which tasks |
| `errorPropagation` | **Error flow by depth**: where in the agent tree errors originate and propagate |
| `concurrency` | **Concurrency lanes**: overlapping agent execution timelines |
| `complexity` | **Complexity score**: numerical score based on depth, breadth, tool diversity |
| `compaction` | **Compaction impact**: token savings, frequency, context health |
| `cooccurrence` | **Agent pairs**: which agents frequently run together |

## Optimization Analyses

### 1. Tool Flow Optimization
From `toolFlow` transition data:
- Identify the most common tool sequences (e.g., Read → Edit → Bash)
- Find redundant transitions (same tool called repeatedly = retries)
- Detect anti-patterns: high-frequency failure loops
- Recommend tool chain shortcuts

### 2. Subagent Strategy
From `effectiveness` + `orchestration`:
- Which subagent types (task, explore, code-review) have highest completion rates
- Average duration per subagent type — are subagents taking too long?
- Underutilized types: tasks that could benefit from delegation
- Over-spawning: too many subagents for simple tasks

### 3. Model Delegation Analysis
From `modelDelegation`:
- Which models handle which task types
- Cost-per-task comparison across models
- Opportunities to delegate simple tasks to cheaper models (Haiku/Sonnet instead of Opus)
- Calculate estimated savings from model rebalancing

### 4. Error Prevention
From `errorPropagation`:
- Where errors originate (agent depth level)
- How errors cascade to parent agents
- Error types (APIError, tool failure) by frequency
- Defensive strategies: which patterns lead to fewer errors

### 5. Concurrency Optimization
From `concurrency`:
- Which agents run in parallel vs sequential
- Bottlenecks: sequential agents that could be parallelized
- Resource contention: overlapping heavy tasks

### 6. Context Health
From `compaction`:
- How often compaction occurs per session
- Token recovery from compaction baselines
- Sessions that hit context limits — suggest breaking into smaller tasks

## Output

Prioritized recommendations table:

| # | Recommendation | Source Data | Impact | Effort | Est. Savings |
|---|---------------|-------------|--------|--------|-------------|

Top 5 recommendations with detailed explanation, supporting data from the workflow API, and implementation steps.
