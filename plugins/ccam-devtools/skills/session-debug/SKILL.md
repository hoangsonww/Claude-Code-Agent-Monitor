---
name: session-debug
description: >
  Debug a specific session by inspecting its full event chain (PreToolUse,
  PostToolUse, Stop, SubagentStop, Compaction, APIError, TurnDuration,
  Notification events), agent hierarchy (recursive parent/child tree with
  subagent_type and depth), token usage with compaction baselines, workflow
  intelligence data (orchestration DAG, error propagation by depth), and
  session metadata (thinking_blocks, turn_count, total_turn_duration_ms).
---

# Session Debug

Debug and inspect a Claude Code session from Agent Monitor data.

## Input

The user provides: **$ARGUMENTS**

This may be:
- A session ID to debug
- "latest" or "last" for the most recent session
- "errors" to find and debug the most recent errored session

## Procedure

1. **Identify the target session**:
   - If session ID given: `GET /api/sessions/{id}` from `http://localhost:4820`
   - If "latest": `GET /api/sessions?limit=1` (default sort: most recently updated first)
   - If "errors": `GET /api/sessions?limit=10&status=error`

2. **Collect full session data**:
   - Session metadata: status, model, cwd, timestamps, duration
   - Events: `GET /api/events?session_id={session_id}` — full event timeline
   - Agents: `GET /api/agents?session_id={session_id}` — all agents in session
   - Cost: `GET /api/pricing/cost/{session_id}`

3. **Analyze the session**:

   ### Session Lifecycle
   - Start time → first event → last event → end time
   - Status transitions (active → working → completed/error)
   - Total duration and active-vs-idle time

   ### Event Chain Analysis
   - Chronological event list with timestamps and durations
   - Identify the **critical path** (longest chain of dependent events)
   - Flag events that took unusually long
   - Highlight error events with full error context

   ### Agent Inspection
   - List all agents: type, task, status, duration
   - Subagent tree visualization (parent → children)
   - Agents that failed and their last known state
   - Agent switching patterns (when and why new agents spawned)

   ### Tool Execution Trace
   - Every tool invocation in order with: tool name, duration, success/failure
   - Failed tool calls with error messages
   - Tool retry patterns (same tool called multiple times)

   ### Anomaly Detection
   - Events out of expected order
   - Gaps in event timeline (>30s with no events)
   - Duplicate events or agent states
   - Token usage spikes (compaction indicators)

4. **Diagnosis**:
   - Root cause hypothesis (if errors present)
   - Contributing factors
   - Remediation suggestions

## Output Format

Present as a debug report with:
- Session summary header (ID, status, model, duration, cost)
- Color-coded timeline (✅ success, ❌ error, ⚠️ warning, ℹ️ info)
- Agent tree diagram
- Diagnosis section with numbered findings
