# Claude Code Working Guide

## Project mission
- Maintain a reliable local-first dashboard for Claude Code session monitoring.
- Preserve real-time behavior (hooks -> API -> SQLite -> WebSocket -> UI).
- Keep MCP integration production-ready for local use (`mcp/`).

## Repo map
- `server/`: Express API, hook ingestion, SQLite access, websocket broadcast (includes optional git upstream checks and `routes/updates.js`, plus `lib/workflow-ingest.js` which ingests on-disk Workflow-tool run journals — fleets that emit no hooks).
- `client/`: React + Vite UI.
- `scripts/`: hook installer/handler, import, seed, cleanup utilities, `self-update-restart.js` (pull → setup → restart).
- `mcp/`: local MCP server exposing dashboard operations as tools.

## Non-negotiable engineering rules
- Preserve existing behavior unless explicitly asked to change it.
- Prefer minimal, reversible diffs.
- Never silently weaken safety controls around destructive actions.
- Keep docs updated when behavior, commands, file locations, or workflows change.

## Commands you should know
- Setup: `npm run setup`
- Dev: `npm run dev`
- Prod build/start: `npm run build` then `npm start`
- Server tests: `npm run test:server`
- Client tests: `npm run test:client`
- MCP install/build/start: `npm run mcp:install`, `npm run mcp:build`, `npm run mcp:start`
- MCP typecheck: `npm run mcp:typecheck`

## Testing and verification policy
- Backend changes: run `npm run test:server` before finishing.
- Frontend changes: run `npm run test:client` when relevant. This includes per-screen render snapshots (`client/src/pages/__tests__/screens.snapshot.test.tsx`). If a UI change is intentional, review the snapshot diff and regenerate baselines with `cd client && npx vitest run -u`; never blindly update snapshots to make tests pass.
- MCP changes: run `npm run mcp:typecheck` and `npm run mcp:build`.
- If you cannot run a verification step, state exactly what was not run and why.

## Change guidelines by area
- API routes: preserve response shapes unless change is requested and documented.
- Database: avoid schema changes without migration-safe logic.
- Hooks: keep fail-safe and non-blocking behavior.
- WebSocket: keep message types stable and backward-compatible.
- Documentation: include exact commands and paths; keep markdown examples runnable.

## Agent behavior
- Explore first, then implement.
- For larger tasks, propose/check a short plan before broad edits.
- Use file-specific rules in `.claude/rules/` when working in scoped areas.
- Use project skills from `.claude/skills/` for repeatable workflows.
- Use `.claude/agents/` subagents for focused review or investigation passes.
