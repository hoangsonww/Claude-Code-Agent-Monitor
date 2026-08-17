---
name: health-check
description: >
  Run comprehensive health checks on the Claude Code Agent Monitor system.
  Validates dashboard API, database, WebSocket, hooks, and disk usage.
  Use to verify the monitoring setup is working correctly.
---

# Health Check

Run a comprehensive health check on the Agent Monitor system.

## Input

The user provides: **$ARGUMENTS**

This may be:
- "full" or empty (default: run all checks)
- "quick" for a fast connectivity check
- "deep" for extended checks including database integrity

## Procedure

Run health checks in this order:

### 1. API Health
```bash
curl -sf http://localhost:4820/api/health
```
- Verify HTTP 200 response
- Check response time (<500ms expected, <1000ms acceptable)
- Confirm JSON response body

### 2. Database Health
```bash
curl -sf http://localhost:4820/api/stats
```
- Verify stats endpoint returns valid data
- Check that counts are non-negative integers
- Verify database file exists and has reasonable size

### 3. WebSocket Health
- Check that the WebSocket server is listening
- Verify WebSocket upgrade is supported on the dashboard port

### 4. API Endpoint Validation
Test each major endpoint:
```bash
curl -sf http://localhost:4820/api/sessions?limit=1
curl -sf http://localhost:4820/api/events?limit=1
curl -sf http://localhost:4820/api/analytics
curl -sf http://localhost:4820/api/pricing
curl -sf http://localhost:4820/api/settings/info
```

### 5. Hook Integration
- Verify hook handler script exists
- Check hooks are configured in `~/.claude/settings.json`
- Verify the handler script targets the correct dashboard URL

### 6. Disk & Resource Usage (deep mode only)
- Database file size
- Log file sizes (if any)
- Available disk space
- Node.js process memory usage (if accessible)

### 7. Data Freshness
- Time since last event ingested
- Time since last session created
- Check for stale active sessions (active but no events in >1 hour)

## Output Format

Present as a system health dashboard:

```
╔══════════════════════════════════════════════╗
║   AGENT MONITOR HEALTH CHECK                ║
║   Timestamp: 2025-04-11 12:00:00 UTC        ║
╠══════════════════════════════════════════════╣
║                                              ║
║   API Server ............ ✅ OK (45ms)       ║
║   Database .............. ✅ OK (2.4 MB)     ║
║   WebSocket ............. ✅ OK              ║
║   API Endpoints ......... ✅ 6/6 passing     ║
║   Hook Integration ...... ⚠️ 5/7 hooks      ║
║   Data Freshness ........ ✅ 3m ago          ║
║                                              ║
║   Overall: HEALTHY (5/6 checks passed)       ║
║                                              ║
╚══════════════════════════════════════════════╝
```

For any non-passing check, include detailed explanation and remediation steps below the dashboard.
