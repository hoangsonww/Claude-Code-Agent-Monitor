---
name: pattern-detect
description: >
  Detect recurring patterns using the Agent Monitor's workflow intelligence —
  toolFlow transitions (tool A → B frequency matrices), recurring workflow
  patterns, agent co-occurrence pairs, model delegation habits, error
  propagation paths by agent depth, and compaction triggers. Use to discover
  habitual usage patterns and anti-patterns.
---

# Pattern Detect

Identify recurring patterns using the Agent Monitor's workflow intelligence engine.

## Input

The user provides: **$ARGUMENTS**

Options: "all", "tools", "errors", "workflows", "last N sessions".

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/sessions?limit=200` | Session list with status, model, cwd, metadata |
| `GET /api/analytics` | tool_usage top 20, event_types, agent_types |
| `GET /api/workflows/{sessionId}` | 11 datasets per session (see below) |

### Workflow datasets used for pattern detection

| Dataset | Pattern insight |
|---------|----------------|
| `toolFlow` | **Tool transition matrix**: tool A → tool B with counts — reveals sequential habits |
| `patterns` | **Detected workflow patterns**: recurring sequences with frequency scores |
| `cooccurrence` | **Agent co-occurrence**: which agents frequently run together |
| `modelDelegation` | **Model habits**: which models are chosen for which task types |
| `errorPropagation` | **Error patterns**: where errors start and how they cascade by agent depth |
| `effectiveness` | **Subagent patterns**: which types succeed most, avg duration per type |
| `compaction` | **Compaction triggers**: what causes context overflow |
| `complexity` | **Complexity patterns**: session complexity scores over time |

## Pattern Categories

### 1. Tool Chain Patterns (from `toolFlow`)
- **Most common sequences**: Top 10 tool transitions (e.g., Read → Edit: 145 times)
- **Starter tools**: First tool used in sessions (indicates task type)
- **Finisher tools**: Last tool before Stop event
- **Anti-patterns**: Tool → same Tool repeated (retries/failures)
- **Co-occurrence**: Tools that always appear together in sessions

### 2. Workflow Patterns (from `patterns`)
- **Named patterns**: Workflow sequences the API has detected with frequency
- **Session archetypes**: Common session shapes (short edit, long debug, subagent-heavy)
- **Project-specific**: Patterns that appear in specific working directories

### 3. Error Patterns (from `errorPropagation` + `event_types`)
- **Error origins**: Which agent depth level produces most errors
- **Cascade patterns**: Errors that trigger chains of follow-up errors
- **APIError frequency**: quota hits, rate_limit, overloaded — by time of day
- **Recovery patterns**: How errors are typically resolved (tool retry vs agent switch)

### 4. Agent Patterns (from `cooccurrence` + `effectiveness`)
- **Agent pairs**: Which agents are spawned together frequently
- **Delegation patterns**: Main agent → subagent task delegation habits
- **Success by type**: Which subagent types (task/explore/code-review) work best for which tasks

### 5. Temporal Patterns (from session timestamps + `daily_sessions`)
- **Peak hours**: When sessions cluster
- **Duration patterns**: Short vs long session distribution
- **Day-of-week trends**: Productive days vs quiet days

## Output

**Pattern Report** with top 10 patterns ranked by frequency × impact:
- Pattern name and description
- Frequency (occurrences across analyzed sessions)
- Impact: positive (reinforce), negative (eliminate), or neutral (observe)
- Actionable recommendation for each
