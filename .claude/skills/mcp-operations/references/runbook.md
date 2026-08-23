# MCP Runbook

## Read-only daily mode
- Keep both mutation flags false.
- Use read tools for observability and reporting.

## Admin mode
- Set `MCP_DASHBOARD_ALLOW_MUTATIONS=true`.
- Run maintenance/pricing operations.
- Reset mutation flag to false after completion.

## Destructive mode
- Set both mutation and destructive flags true.
- Execute destructive command only with explicit confirmation token.
- Immediately disable destructive flag after operation.

## Process and session lifecycle
- A stdio server exits on its own when its host dies (stdin end/close, or re-parenting away from the ppid it started with). Seeing `shutting down orphaned stdio server` in stderr with a `reason` is expected, not a fault.
- HTTP sessions end on `DELETE /mcp`, on SSE disconnect, or via the idle sweep at `MCP_HTTP_SESSION_TIMEOUT_MS` (default 30 min, `0` disables).
- `curl -s http://127.0.0.1:8819/health` reports `activeSessions`; a count that only ever climbs means clients are dropping without terminating.

## Verification commands
- `npm run mcp:typecheck`
- `npm run mcp:build`
