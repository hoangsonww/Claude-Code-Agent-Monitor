# Codex Project Instructions

## Project intent
- Keep this repository a stable, local-first Claude Code monitoring platform.
- Maintain correctness across hooks, API, DB, websocket, UI, and MCP integration.

## Priorities
- Correctness over cleverness.
- Small, scoped, reversible diffs.
- Preserve existing behavior unless change is requested.
- Update docs whenever workflow or architecture changes — follow `.claude/skills/update-project-docs/` automatically at the end of every change-set (README + VN/CN/KO mirrors, ARCHITECTURE, wiki + i18n + cache bump, server/client READMEs, docs/*).
- Every applicable source file you create or update (`.js/.ts/.tsx/.cjs/.mjs/.py/.sh/.css`) must start with the authorship header: a truthful file overview plus the exact line `@author Son Nguyen <hoangson091104@gmail.com>`. See `.claude/skills/file-headers/` and `.claude/rules/file-headers.md`; verify with `bash .claude/skills/file-headers/scripts/check-headers.sh`.

## Where to work
- `server/` for API/routes/data processing.
- `client/` for React UI behavior.
- `mcp/` for local MCP server tooling.
- `scripts/` for hook/install/import/cleanup utilities.

## Validation expectations
- Backend changes: run `npm run test:server` when possible.
- Frontend changes: run `npm run test:client` when possible.
- MCP changes: run `npm run mcp:typecheck` and `npm run mcp:build`.
- If any check is skipped, report it explicitly.

## Safety expectations
- Keep destructive capabilities behind explicit configuration gates.
- Never broaden destructive behavior without explicit user request.
- Treat hook execution path as fail-safe and non-blocking.

## Useful commands
- Setup: `npm run setup`
- Dev: `npm run dev`
- Build/start: `npm run build` then `npm start`
- MCP helpers: `npm run mcp:install`, `npm run mcp:build`, `npm run mcp:start`
