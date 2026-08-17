---
name: dashboard-status
description: >
  Quick dashboard health and status overview — checks the Agent Monitor API
  (port 4820), reports session/agent/event counts from /api/stats, confirms
  WebSocket connectivity, reads the redacted hook status returned by
  /api/settings/info, and shows data freshness (last event timestamp). Use to verify the monitoring
  system is operational.
---

# Dashboard Status

Quick status check on the Claude Code Agent Monitor dashboard.

## Input

The user provides: **$ARGUMENTS**

Options: empty (default: full status), "quick" (API only), "verbose" (include endpoint details).

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/health` | HTTP 200 if API is running |
| `GET /api/stats` | `{ total_sessions, active_sessions, active_agents, total_agents, total_events, events_today, ws_connections, agents_by_status, sessions_by_status }` |
| `GET /api/settings/info` | Dashboard configuration: version, port, data paths |
| `GET /api/events?limit=1` | Most recent event (for freshness check) |

## Status Report

### 1. API Server
- Reachable at `http://localhost:4820`? Response time?
- If unreachable: suggest `npm start` from the project directory

### 2. System Counts
From `/api/stats`:
- Total sessions tracked (`total_sessions`)
- Active agents currently running (`active_agents`)
- Total events ingested (`total_events`)
- Events today (`events_today`)
- WebSocket connections (`ws_connections`)

### 3. Data Freshness
From latest event:
- Time since last event ingested
- If >1 hour: warn about possible hook disconnect

### 4. Hook Status
Use `/api/settings/info` → `hooks` for configured hook names:
- Expected: PreToolUse, PostToolUse, Stop, SubagentStop, Notification, SessionStart, SessionEnd
- Report which hook names are present vs missing. Do not read hook commands or
  unrelated settings.

### 5. Dashboard Info
From `/api/settings/info`:
- Dashboard version
- Database path and size
- Configured port

## Output Format

Compact status card:

```
╔══════════════════════════════════════╗
║   AGENT MONITOR STATUS              ║
╠══════════════════════════════════════╣
║   API:        ✅ Online (42ms)      ║
║   Sessions:   127 tracked           ║
║   Events:     4,892 ingested        ║
║   Hooks:      7/7 configured        ║
║   Last Event: 3 minutes ago         ║
╚══════════════════════════════════════╝
```
