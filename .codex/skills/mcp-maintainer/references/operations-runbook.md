# MCP Operations Runbook

## Modes
- Read-only:
  - `MCP_DASHBOARD_ALLOW_MUTATIONS=false`
  - `MCP_DASHBOARD_ALLOW_DESTRUCTIVE=false`
- Admin:
  - Set mutations true for controlled maintenance operations.
- Destructive:
  - Set both true and require `confirmation_token = CLEAR_ALL_DATA`.

## Verification
- `npm run mcp:typecheck`
- `npm run mcp:build`
