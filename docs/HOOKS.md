# Hook System Integration Guide

Comprehensive guide to integrating with Claude Code's hook system for real-time agent monitoring.

---

## Table of Contents

- [Overview](#overview)
- [Hook Architecture](#hook-architecture)
- [Hook Installation](#hook-installation)
- [Hook Types](#hook-types)
- [Hook Handler Implementation](#hook-handler-implementation)
- [Event Processing](#event-processing)
- [Error Handling](#error-handling)
- [Performance Considerations](#performance-considerations)
- [Testing Hooks](#testing-hooks)
- [Troubleshooting](#troubleshooting)

---

## Overview

Claude Code provides a hook system that allows external tools to receive real-time events during agent execution. Agent Dashboard uses these hooks to capture session lifecycle, tool executions, and notifications.

```mermaid
graph TB
    subgraph "Claude Code Process"
        CLI[Claude CLI]
        Agent[Agent Execution]
        Hooks[Hook System]
    end
    
    subgraph "Hook Wiring (~/.claude/settings.json)"
        SessionStart[SessionStart]
        UserPromptSubmit[UserPromptSubmit]
        PreTool[PreToolUse]
        PostTool[PostToolUse]
        Stop[Stop]
        SubagentStop[SubagentStop]
        Notification[Notification]
        SessionEnd[SessionEnd]
    end

    subgraph "Hook Handler"
        Handler[hook-handler.js]
    end

    subgraph "Dashboard Server"
        API[Express Server<br/>:4820]
    end

    Agent --> Hooks
    Hooks -->|stdin JSON| SessionStart
    Hooks -->|stdin JSON| UserPromptSubmit
    Hooks -->|stdin JSON| PreTool
    Hooks -->|stdin JSON| PostTool
    Hooks -->|stdin JSON| Stop
    Hooks -->|stdin JSON| SubagentStop
    Hooks -->|stdin JSON| Notification
    Hooks -->|stdin JSON| SessionEnd

    SessionStart -->|exec| Handler
    UserPromptSubmit -->|exec| Handler
    PreTool -->|exec| Handler
    PostTool -->|exec| Handler
    Stop -->|exec| Handler
    SubagentStop -->|exec| Handler
    Notification -->|exec| Handler
    SessionEnd -->|exec| Handler
    
    Handler -->|HTTP POST| API
    
    style Hooks fill:#F59E0B
    style Handler fill:#10B981
    style API fill:#3B82F6
```

---

## Hook Architecture

### Hook Execution Flow

```mermaid
sequenceDiagram
    participant Claude as Claude Code
    participant HookScript as Hook Script<br/>(Python)
    participant Handler as hook-handler.js
    participant Server as Dashboard Server
    participant DB as SQLite
    participant WS as WebSocket
    
    Claude->>HookScript: Execute (stdin: JSON)
    HookScript->>HookScript: Read stdin
    HookScript->>Handler: exec node hook-handler.js
    Handler->>Handler: Parse JSON
    Handler->>Server: HTTP POST /hooks/{type}
    Server->>DB: Insert/Update data
    DB-->>Server: Success
    Server->>WS: Broadcast event
    WS-->>Server: Sent to clients
    Server-->>Handler: 200 OK
    Handler-->>HookScript: exit 0
    HookScript-->>Claude: exit 0 (non-blocking)
    
    Note over Claude: Continues execution<br/>without waiting
```

### Hook System Characteristics

**Design Principles:**

```mermaid
graph TB
    subgraph "Hook System Goals"
        NonBlocking[Non-Blocking<br/>Never block Claude Code]
        FailSafe[Fail-Safe<br/>Errors don't stop execution]
        FastExec[Fast Execution<br/>&lt; 100ms per hook]
        Complete[Complete Data<br/>Capture all events]
    end
    
    subgraph "Implementation"
        Timeout[5s Timeout]
        ErrorLog[Silent Error Logging]
        Async[Async HTTP POST]
        JSON[JSON Serialization]
    end
    
    NonBlocking --> Timeout
    FailSafe --> ErrorLog
    FastExec --> Async
    Complete --> JSON
    
    style NonBlocking fill:#10B981
    style FailSafe fill:#10B981
    style FastExec fill:#10B981
```

---

## Hook Installation

### Installation Script

```bash
# Install hooks
npm run install-hooks
```

This copies hook scripts from `scripts/hooks/` to `.githooks/`:

```mermaid
graph LR
    Source[scripts/hooks/*.py] -->|Copy| Target[.githooks/*.py]
    Handler[scripts/hook-handler.js] -->|Reference| Target
    
    Target -->|chmod +x| Executable[Executable Hooks]
    
    style Source fill:#3B82F6
    style Executable fill:#10B981
```

### Manual Installation

```bash
#!/bin/bash
# scripts/install-hooks.js

HOOKS_DIR=".githooks"
SOURCE_DIR="scripts/hooks"

# Create hooks directory
mkdir -p "$HOOKS_DIR"

# Copy hook scripts
cp "$SOURCE_DIR/session-start.py" "$HOOKS_DIR/"
cp "$SOURCE_DIR/pre-tool-use.py" "$HOOKS_DIR/"
cp "$SOURCE_DIR/post-tool-use.py" "$HOOKS_DIR/"
cp "$SOURCE_DIR/stop.py" "$HOOKS_DIR/"
cp "$SOURCE_DIR/subagent-stop.py" "$HOOKS_DIR/"
cp "$SOURCE_DIR/notification.py" "$HOOKS_DIR/"
cp "$SOURCE_DIR/session-end.py" "$HOOKS_DIR/"

# Make executable
chmod +x "$HOOKS_DIR"/*.py

echo "Hooks installed in .githooks/"
```

### Verification

```bash
# Check hook files exist
ls -la .githooks/

# Expected output:
# session-start.py
# pre-tool-use.py
# post-tool-use.py
# stop.py
# subagent-stop.py
# notification.py
# session-end.py
```

---

## Hook Types

### 1. SessionStart

Triggered when a Claude Code session starts (fresh launch, `--resume`, `/clear`, etc.).

**Payload Example:**

```json
{
  "type": "sessionStart",
  "sessionId": "sess_abc123",
  "source": "startup",
  "model": "claude-sonnet-4",
  "timestamp": "2024-03-18T12:00:00Z"
}
```

**Purpose:**
- Create the session and main-agent records on first contact
- Stamp `awaiting_input_since` so the dashboard shows the row in **Waiting** from the moment the CLI lands at a prompt
- Reactivate completed/abandoned sessions on resume
- Sweep other active sessions whose last activity is older than `DASHBOARD_STALE_MINUTES` (default 180), marking them `abandoned` with their agents `completed`

---

### 2. UserPromptSubmit

Triggered the moment the user hits enter on a prompt — fires *before* Claude does any work.

**Payload Example:**

```json
{
  "type": "userPromptSubmit",
  "sessionId": "sess_abc123",
  "prompt": "Refactor this function...",
  "timestamp": "2024-03-18T12:00:30Z"
}
```

**Purpose:**
- Clear `awaiting_input_since` on the session and main agent
- Promote the main agent to `working` so the dashboard reflects "Claude is now thinking on this" through the entire response — including text-only replies that emit no `PreToolUse` before `Stop`

---

### 3. PreToolUse

Triggered before a tool executes.

**Payload Example:**

```json
{
  "type": "preToolUse",
  "sessionId": "sess_abc123",
  "agentId": "agent_main_001",
  "toolName": "bash",
  "timestamp": "2024-03-18T12:01:00Z"
}
```

**Purpose:**
- Clear `awaiting_input_since` (Claude can only call a tool after fresh user input)
- Set agent to `working`, set `current_tool`
- Track tool execution start time
- If tool name is `Agent`, create a subagent record

---

### 4. PostToolUse

Triggered after a tool completes execution.

**Payload Example:**

```json
{
  "type": "postToolUse",
  "sessionId": "sess_abc123",
  "agentId": "agent_main_001",
  "toolName": "bash",
  "durationMs": 1234,
  "success": true,
  "inputTokens": 1500,
  "outputTokens": 800,
  "timestamp": "2024-03-18T12:01:01.234Z"
}
```

**Purpose:**
- Clear `awaiting_input_since` (covers permission-prompt approval mid-tool)
- Clear `current_tool` on agent (agent stays `working`)
- Update agent token counts via shared transcript cache
- Calculate and update cost
- Rollup cost to session

**Cost Calculation Flow:**

```mermaid
graph TB
    PostHook[PostToolUse Hook] --> Tokens{Has Token<br/>Counts?}
    Tokens -->|Yes| Pricing[Fetch Pricing Rule]
    Tokens -->|No| Skip[Skip Cost Update]
    
    Pricing --> Calculate[Cost = <br/>input/1M * input_price +<br/>output/1M * output_price]
    Calculate --> UpdateAgent[Update agent.cost]
    UpdateAgent --> Rollup[Rollup to session.total_cost]
    Rollup --> Broadcast[Broadcast Updates]
    
    style Calculate fill:#10B981
    style Broadcast fill:#F59E0B
```

---

### 5. Stop

Triggered when Claude finishes a turn (NOT when the session is closed).

**Payload Example:**

```json
{
  "type": "stop",
  "sessionId": "sess_abc123",
  "stop_reason": "end_turn",
  "timestamp": "2024-03-18T12:05:00Z"
}
```

**Purpose:**
- Non-error: set main agent to `idle` and stamp `awaiting_input_since` — Claude finished its turn, ball is in the user's court. The session shows as **Waiting** until `UserPromptSubmit` / `PreToolUse` fires
- Error (`stop_reason="error"`): drop `awaiting_input_since`, mark the session `error`
- Background subagents continue running — they complete individually via `SubagentStop`, never via `Stop`

---

### 6. SubagentStop

Triggered when a sub-agent (explore, task, etc.) completes.

**Payload Example:**

```json
{
  "type": "subagentStop",
  "sessionId": "sess_abc123",
  "agentId": "agent_explore_002",
  "agentType": "explore",
  "timestamp": "2024-03-18T12:03:00Z"
}
```

**Purpose:**
- Match the finishing subagent by description, type, or task and mark it `completed`
- **Deliberately does NOT clear `awaiting_input_since`** — a backgrounded subagent finishing tells us nothing about whether the human has responded
- **Triggers a fire-and-forget JSONL scan** (`scanAndImportSubagents` from `scripts/import-history.js`) after `res.json()` returns. The scan walks the session's `subagents/agent-*.jsonl` files, pairs each assistant `tool_use` block with the next matching user `tool_result` block by `tool_use_id`, and emits per-tool `PreToolUse` + `PostToolUse` events under the subagent's own `agent_id`. Idempotent (`data LIKE '%"tool_use_id":"X"%'` dedup) and merges into a hook-created live row when one matches by `subagent_type + started_at` within 30 s — closes the gap where subagent-internal tool calls would otherwise be invisible to the dashboard
- Imported tool events carry `imported: true, source: "subagent_jsonl"` in their JSON `data` payload so analytics can distinguish backfilled rows from live hook-captured ones if needed

---

### 7. Notification

Triggered when Claude Code sends a system notification.

**Payload Example:**

```json
{
  "type": "notification",
  "sessionId": "sess_abc123",
  "notificationType": "backgroundTaskComplete",
  "message": "Explore agent completed successfully",
  "timestamp": "2024-03-18T12:03:00Z"
}
```

**Purpose:**
- Log the event for the activity feed
- If the message matches a permission/input-prompt pattern (`permission`, `waiting for input`, `needs your approval`, `awaiting your response`, …), stamp `awaiting_input_since` so the session lands in **Waiting**
- If the message matches a compaction pattern, tag as a `Compaction` event
- Trigger a browser notification when the user has notifications enabled

---

### 8. SessionEnd

Triggered when a Claude Code session ends.

**Payload Example:**

```json
{
  "type": "sessionEnd",
  "sessionId": "sess_abc123",
  "timestamp": "2024-03-18T14:30:00Z"
}
```

**Purpose:**
- Drop `awaiting_input_since` on the session and any agents that still have it
- Mark all agents and the session as `completed`
- Evict the session's transcript from the shared transcript cache

---

## Hook Handler Implementation

### hook-handler.js Architecture

```mermaid
graph TB
    CLI[CLI Args] --> Parse[Parse Hook Type]
    Stdin[stdin] --> ReadJSON[Read JSON]
    
    Parse --> HookType{Hook Type?}
    ReadJSON --> Payload[Event Payload]
    
    HookType -->|session-start| Endpoint1[POST /hooks/session-start]
    HookType -->|pre-tool-use| Endpoint2[POST /hooks/pre-tool-use]
    HookType -->|post-tool-use| Endpoint3[POST /hooks/post-tool-use]
    HookType -->|stop| Endpoint4[POST /hooks/stop]
    HookType -->|subagent-stop| Endpoint5[POST /hooks/subagent-stop]
    HookType -->|notification| Endpoint6[POST /hooks/notification]
    HookType -->|session-end| Endpoint7[POST /hooks/session-end]
    
    Payload --> Endpoint1
    Payload --> Endpoint2
    Payload --> Endpoint3
    Payload --> Endpoint4
    Payload --> Endpoint5
    Payload --> Endpoint6
    Payload --> Endpoint7
    
    Endpoint1 --> HTTP[HTTP POST]
    Endpoint2 --> HTTP
    Endpoint3 --> HTTP
    Endpoint4 --> HTTP
    Endpoint5 --> HTTP
    Endpoint6 --> HTTP
    Endpoint7 --> HTTP
    
    HTTP --> Response{Success?}
    Response -->|Yes| Exit0[exit 0]
    Response -->|No| Exit1[exit 1]
    
    style HTTP fill:#10B981
    style Exit0 fill:#10B981
    style Exit1 fill:#EF4444
```

### Implementation

```javascript
#!/usr/bin/env node
// scripts/hook-handler.js

const http = require('http');
const fs = require('fs');

const HOOK_TYPE = process.argv[2];
const SERVER_URL = 'http://localhost:4820';
const TIMEOUT = 5000; // 5s timeout

// Read JSON from stdin
let inputData = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => inputData += chunk);

process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(inputData);
    sendToServer(HOOK_TYPE, payload);
  } catch (err) {
    console.error('[hook-handler] JSON parse error:', err);
    process.exit(1);
  }
});

function sendToServer(hookType, payload) {
  const postData = JSON.stringify(payload);
  
  const options = {
    hostname: 'localhost',
    port: 4820,
    path: `/hooks/${hookType}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    },
    timeout: TIMEOUT
  };
  
  const req = http.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => responseData += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        process.exit(0);
      } else {
        console.error(`[hook-handler] Server error: ${res.statusCode}`);
        process.exit(1);
      }
    });
  });
  
  req.on('error', (err) => {
    console.error('[hook-handler] Request error:', err);
    process.exit(1);
  });
  
  req.on('timeout', () => {
    console.error('[hook-handler] Request timeout');
    req.destroy();
    process.exit(1);
  });
  
  req.write(postData);
  req.end();
}
```

---

## Event Processing

### Server-Side Hook Processing

```javascript
// server/routes/hooks.js

router.post('/session-start', (req, res) => {
  try {
    const { sessionId, model, agentId, agentType } = req.body;
    
    // Upsert session
    let session = stmts.findSession.get(sessionId);
    if (!session) {
      stmts.createSession.run(sessionId, model);
      session = stmts.findSession.get(sessionId);
      broadcast({ type: 'session.created', data: session });
    }
    
    // Create main agent
    if (!stmts.findAgent.get(agentId)) {
      stmts.createAgent.run(agentId, sessionId, agentType);
      const agent = stmts.findAgent.get(agentId);
      broadcast({ type: 'agent.created', data: agent });
    }
    
    // Touch session (update updated_at)
    stmts.touchSession.run(sessionId);
    
    res.json({ success: true });
  } catch (err) {
    console.error('session-start error:', err);
    res.json({ success: false, error: err.message });
  }
});
```

### Event Processing Pipeline

```mermaid
graph TB
    Hook[Hook Event] --> Validate[Validate Payload]
    Validate --> DB[Database Operations]
    DB --> Session[Update Session]
    DB --> Agent[Update Agent]
    DB --> Tool[Create Tool Record]
    
    Session --> Broadcast[Broadcast to WebSocket]
    Agent --> Broadcast
    Tool --> Broadcast
    
    Broadcast --> Client1[Client 1]
    Broadcast --> Client2[Client 2]
    Broadcast --> ClientN[Client N]
    
    style Validate fill:#3B82F6
    style DB fill:#003B57,color:#fff
    style Broadcast fill:#F59E0B
```

---

## Error Handling

### Error Handling Strategy

```mermaid
graph TB
    Error[Error Occurs] --> Type{Error Type?}
    
    Type -->|Network Error| Retry[Retry Once]
    Type -->|Timeout| Log1[Log + Exit 1]
    Type -->|Parse Error| Log2[Log + Exit 1]
    Type -->|Server Error| Log3[Log + Exit 1]
    
    Retry --> Success{Success?}
    Success -->|Yes| Exit0[Exit 0]
    Success -->|No| Exit1[Exit 1]
    
    Log1 --> Exit1
    Log2 --> Exit1
    Log3 --> Exit1
    
    style Exit0 fill:#10B981
    style Exit1 fill:#EF4444
```

### Hook Script Error Handling

```python
#!/usr/bin/env python3
# .githooks/session-start.py

import sys
import json
import subprocess
import logging

logging.basicConfig(
    filename='.githooks/hooks.log',
    level=logging.ERROR,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

try:
    data = json.load(sys.stdin)
    
    result = subprocess.run(
        ['node', 'scripts/hook-handler.js', 'session-start'],
        input=json.dumps(data),
        text=True,
        timeout=5,
        capture_output=True
    )
    
    if result.returncode != 0:
        logging.error(f'Hook handler failed: {result.stderr}')
    
except Exception as e:
    logging.error(f'Hook error: {str(e)}')

# Always exit 0 to avoid blocking Claude Code
sys.exit(0)
```

---

## Performance Considerations

### Hook Execution Time

```mermaid
graph TB
    subgraph "Hook Execution Breakdown"
        Python[Python Script<br/>~10ms]
        Handler[Node Handler<br/>~20ms]
        HTTP[HTTP POST<br/>~30ms]
        DB[Database Write<br/>~5ms]
        WS[WebSocket Broadcast<br/>~5ms]
    end
    
    Total[Total: ~70ms]
    
    Python --> Handler
    Handler --> HTTP
    HTTP --> DB
    DB --> WS
    WS --> Total
    
    style Total fill:#10B981
```

**Performance Targets:**

| Phase | Target | Actual |
|-------|--------|--------|
| Hook script | < 20ms | ~10ms |
| Handler | < 30ms | ~20ms |
| HTTP POST | < 50ms | ~30ms |
| Database | < 10ms | ~5ms |
| **Total** | **< 100ms** | **~70ms** |

### Optimization Techniques

```mermaid
graph TB
    subgraph "Optimizations"
        Async[Async HTTP<br/>Don't wait for response]
        Batch[Batch Updates<br/>Transaction batching]
        Index[Database Indexes<br/>Fast lookups]
        Pool[Connection Pooling<br/>Reuse connections]
    end
    
    Async --> Faster[Faster Hook Execution]
    Batch --> Faster
    Index --> Faster
    Pool --> Faster
    
    style Faster fill:#10B981
```

---

## Testing Hooks

### Manual Testing

```bash
# Test session-start hook
echo '{"type":"sessionStart","sessionId":"test_001","model":"claude-sonnet-4","agentId":"agent_test","agentType":"general-purpose"}' | \
  python3 .githooks/session-start.py

# Test pre-tool-use hook
echo '{"type":"preToolUse","sessionId":"test_001","agentId":"agent_test","toolName":"bash"}' | \
  python3 .githooks/pre-tool-use.py

# Test post-tool-use hook
echo '{"type":"postToolUse","sessionId":"test_001","agentId":"agent_test","toolName":"bash","durationMs":100,"success":true,"inputTokens":1000,"outputTokens":500}' | \
  python3 .githooks/post-tool-use.py
```

### Integration Testing

```javascript
// server/__tests__/hooks.test.js
import { test } from 'node:test';
import assert from 'node:assert';

test('session-start hook creates session', async () => {
  const payload = {
    sessionId: 'test_session',
    model: 'claude-sonnet-4',
    agentId: 'test_agent',
    agentType: 'general-purpose'
  };
  
  const response = await fetch('http://localhost:4820/hooks/session-start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const data = await response.json();
  assert.strictEqual(data.success, true);
  
  // Verify session exists
  const session = await fetch('http://localhost:4820/api/sessions/test_session');
  assert.strictEqual(session.status, 200);
});
```

---

## Troubleshooting

### Common Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Hooks not executing | No data in dashboard | Check `.githooks/` exists and scripts are executable |
| Timeout errors | Hooks take >5s | Check server is running, reduce timeout |
| Parse errors | JSON parse failed | Validate hook payload format |
| Permission denied | Hook script won't run | `chmod +x .githooks/*.py` |
| Server connection refused | HTTP POST fails | Start dashboard server (`npm start`) |

### Debug Mode

```bash
# Enable hook logging
export DASHBOARD_DEBUG=1

# Run hook manually with verbose output
python3 -u .githooks/session-start.py < test-payload.json
```

### Health Check

```bash
# Check server is running
curl http://localhost:4820/api/sessions

# Expected: {"sessions": [...]}
```

---

## Summary

The hook system provides:

- ✅ **Real-time event capture** - Lifecycle, tools, notifications
- ✅ **Non-blocking execution** - Never delays Claude Code
- ✅ **Fail-safe design** - Errors don't stop execution
- ✅ **Fast processing** - < 100ms per hook
- ✅ **Complete coverage** - All agent lifecycle events
- ✅ **Easy installation** - One-command setup

For server-side processing, see [server/README.md](../server/README.md).
