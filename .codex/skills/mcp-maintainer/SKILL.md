---
name: mcp-maintainer
description: Operate and maintain the local MCP server for this repository. Use for MCP tool updates, policy-guard changes, host configuration, and MCP runtime troubleshooting.
---

# MCP Maintainer Skill

## Workflow
- Confirm dashboard API availability (`/api/health`).
- Inspect affected MCP domain modules under `mcp/src/tools/domains/`.
- Preserve safety gates in `mcp/src/policy/tool-guards.ts`.
- Validate with `npm run mcp:typecheck` and `npm run mcp:build`.

## Safety rules
- Keep loopback-only target checks enabled.
- Keep mutating and destructive tools behind explicit flags.
- Do not log protocol data to stdout.

## References
- `references/tool-domain-map.md`
- `references/operations-runbook.md`
