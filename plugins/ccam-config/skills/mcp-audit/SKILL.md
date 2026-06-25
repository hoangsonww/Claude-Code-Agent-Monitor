---
description: >
  Audit the configured MCP servers (user + project scope) via the Agent
  Monitor Config Explorer API: transport (stdio vs http), command/args and env
  variable names, headers, and the source file each definition came from.
  Reads /api/cc-config/mcp. Use when reviewing MCP integrations for hygiene,
  duplication, or unexpected transports.
---

# MCP Audit

Inventory and audit every Model Context Protocol server the user has
configured — both user-scope and project-scope — read through the Agent Monitor
dashboard at `http://localhost:4820`.

## Input

The user provides: **$ARGUMENTS**

This may be:
- empty — audit all MCP servers (default).
- a server name fragment — focus on matching servers.
- "stdio" / "http" — restrict to one transport kind.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/cc-config/mcp` | `{ user:[…], projectScoped:[…] }`. Each server: `{ name, source, kind }` where `kind` is `stdio` (with `command, args, envNames`), `http` (with `url, headers`), or `unknown`. `source` names the file the definition came from (e.g. `~/.claude.json (top-level)`, `~/.claude.json (projects[<root>])`, `~/.claude/settings.json`) |

## Report Sections

### 1. Server inventory
List every server from `user` and `projectScoped`. For each show `name`,
`source`, `kind`, and the transport detail:
- **stdio** — the `command`, its `args`, and the `envNames` (names only — values
  are not exposed by the API).
- **http** — the `url` and the `headers` key names (values not exposed).
- **unknown** — a definition the server could not classify; flag it for review.

### 2. Scope split & duplication
Separate user-scope from project-scope servers. Flag any `name` that appears in
both scopes (project may shadow user) and any duplicate definitions across
source files.

### 3. Hygiene flags
- **Unknown transport** — servers with `kind: "unknown"` (malformed or
  unsupported definition).
- **Env reliance** — stdio servers with many `envNames`; note they depend on
  environment variables being present at launch.
- **Remote endpoints** — http servers; surface the `url` host so the user can
  confirm they trust the remote.

## Output

- Section 1 as a table (`Scope | Name | Kind | Transport detail | Source`).
- Env names and header names listed by name only — never invent or print values
  (the API does not expose them).
- Cite only fields the API returned — never fabricate servers, commands, or
  hosts.
- Note: MCP servers are read-only via the Config Explorer (they are written
  concurrently by the running CLI); edit their definitions in the source file
  named by `source`.
- If the dashboard is unreachable at `http://localhost:4820`, say so and tell
  the user to start it with `npm start` from the repo root.
