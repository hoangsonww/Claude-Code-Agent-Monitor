---
name: hook-diagnostics
description: >
  Diagnose Claude Code hook installation, delivery, and ingestion issues.
  Checks hook configuration, connectivity, event flow, and identifies
  common problems. Use when events are not appearing in the dashboard.
---

# Hook Diagnostics

Diagnose hook integration issues between Claude Code and the Agent Monitor.

## Input

The user provides: **$ARGUMENTS**

This may be:
- "full" or empty (default: run all diagnostics)
- "install" to check hook installation only
- "connectivity" to check dashboard connectivity only
- "events" to check event delivery only

## Procedure

Run diagnostic checks in this order:

### 1. Hook Installation Check
Verify hooks are installed in Claude Code settings:

```bash
# Check if hooks exist in Claude Code settings
cat ~/.claude/settings.json | jq '.hooks // empty'
```

Verify:
- All 7 expected hook types are registered: `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`, `Notification`, `SessionStart`, `SessionEnd`
- Hook commands point to the correct handler script path
- Handler script exists and is readable at the configured path

### 2. Dashboard Connectivity
Test that the dashboard API is reachable:

```bash
curl -sf http://localhost:4820/api/health
```

Verify:
- Dashboard responds with 200 OK
- Response includes expected health fields
- WebSocket endpoint is accessible

### 3. Hook Handler Validation
Check the hook handler script:

```bash
# Verify handler exists and is executable
ls -la <handler-path>
# Syntax check
node --check <handler-path>
```

### 4. Event Delivery Test
Send a test event and verify it arrives:

```bash
echo '{"hook_type":"test","session_id":"diag-test","data":{}}' | \
  curl -sf -X POST http://localhost:4820/api/hooks/event \
  -H 'Content-Type: application/json' -d @-
```

### 5. Database Check
Verify the database is writable and events are persisted:

```bash
curl -sf http://localhost:4820/api/stats
curl -sf http://localhost:4820/api/events?limit=5
```

### 6. Recent Event Flow
Check if events are flowing:
- Time since last event received
- Events received in last hour
- Any gaps in event delivery

## Output Format

Present as a diagnostic report with:
```
Hook Diagnostics Report
━━━━━━━━━━━━━━━━━━━━━━
✅ Hook Installation .............. PASS
✅ Dashboard Connectivity ......... PASS
✅ Handler Script ................. PASS
⚠️ Event Delivery ................ WARN (slow)
✅ Database ....................... PASS
❌ Recent Event Flow .............. FAIL (no events in 2h)
━━━━━━━━━━━━━━━━━━━━━━
Overall: 5/6 checks passed
```

For each failed or warning check, include:
- What was expected vs what was found
- Specific remediation steps
- Commands to fix the issue
