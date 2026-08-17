---
name: mcp-server
description: >
  Configure, launch, validate, and troubleshoot CCAM's comprehensive MCP server
  for Claude Code, Codex, and other MCP hosts. Use when installing dependencies,
  building the server, selecting stdio, HTTP, or REPL transport, setting
  mutation/destructive policy, supplying dashboard authentication, or checking
  complete tool registration.
---

# MCP Server

## Build

```bash
npm run mcp:install
npm run mcp:typecheck
npm run mcp:build
```

Normal `npm run setup` performs install and build automatically.

## Launch

```bash
ccam mcp stdio
ccam mcp http
ccam mcp repl
```

## Policy

- Reads are enabled by default.
- Writes require `MCP_DASHBOARD_ALLOW_MUTATIONS=true`.
- Full data clearing additionally requires
  `MCP_DASHBOARD_ALLOW_DESTRUCTIVE=true` and the exact tool argument
  `confirmation_token = "CLEAR_ALL_DATA"`. `CLEAR_ALL_DATA` is not an
  environment variable.
- Set `MCP_DASHBOARD_API_TOKEN` when the dashboard uses `DASHBOARD_TOKEN`.
- The target URL remains restricted to loopback and approved container-host
  names.

Validate with `npm run test:mcp`. Protocol and REPL transports must expose the
same catalog because both use the canonical domain registration path.
