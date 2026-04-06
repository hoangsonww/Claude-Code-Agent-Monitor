---
name: repo-onboarding
description: Understand this repository quickly before making changes. Use for architecture discovery, ownership mapping, command selection, and initial implementation planning.
---

# Repo Onboarding Skill

## Workflow
- Read `AGENTS.md`, `README.md`, and `ARCHITECTURE.md`.
- Determine target layer: `server/`, `client/`, `mcp/`, or docs.
- Identify the minimal file set needed for the task.
- Select verification commands before editing.

## Verification defaults
- Backend: `npm run test:server`
- Frontend: `npm run test:client`
- MCP: `npm run mcp:typecheck` and `npm run mcp:build`

## References
- `references/module-map.md`
- `references/verification-map.md`
