# Claude Code Working Guide

## Project mission
- Maintain a reliable local-first dashboard for Claude Code session monitoring.
- Preserve real-time behavior (hooks -> API -> SQLite -> WebSocket -> UI).
- Keep MCP integration production-ready for local use (`mcp/`).

## Repo map
- `server/`: Express API, hook ingestion, SQLite access, websocket broadcast (includes optional git upstream checks and `routes/updates.js`, plus `lib/workflow-ingest.js` which ingests on-disk Workflow-tool run journals — fleets that emit no hooks).
- `client/`: React + Vite UI.
- `scripts/`: hook installer/handler, import, seed, cleanup utilities. (Update detection lives server-side in `server/lib/update-check.js`; the dashboard never restarts itself — users run the printed command, surfaced in the UI and by `ccam update-check`.)
- `mcp/`: local MCP server exposing dashboard operations as tools.

## Non-negotiable engineering rules
- Preserve existing behavior unless explicitly asked to change it.
- Prefer minimal, reversible diffs.
- Never silently weaken safety controls around destructive actions.
- Keep docs updated when behavior, commands, file locations, or workflows change — apply the `update-project-docs` skill automatically at the end of every change-set that alters behavior, config, interfaces, events, schema, CLI commands, or features (do not wait to be asked).
- Apply the `i18n-parity` skill whenever a change touches localized content — new/changed UI copy or i18n keys, `README.md`, `wiki/index.html`, or docs the READMEs and wiki mirror — and work through its new-language checklist whenever adding a language. English is the source of truth on all five localization surfaces (dashboard keys, wiki, mirrored READMEs, language switchers, locale-aware formatting); every supported language ships the change in the same PR. Verify with `bash .claude/skills/i18n-parity/scripts/i18n-audit.sh`.
- Apply the `push-to-forked-pr` skill whenever updating a PR whose head branch lives on a fork — `origin` here is the upstream, so a plain `git push origin` updates the wrong branch and leaves the PR untouched.
- Apply the `version-release` skill for every release bump: patch for backward-compatible fixes/small improvements, minor for larger backward-compatible capabilities, and major for breaking/fundamental changes; synchronize root, desktop, OpenAPI, snapshots, and generated plugin metadata, create or reuse the matching `v<version>` GitHub milestone, and assign the release PR plus linked closing issues to it.
- Every applicable source file you create or update (`.js/.ts/.tsx/.cjs/.mjs/.py/.sh/.css`) must start with the copyright/authorship header — file overview + the exact line `@author Son Nguyen <hoangson091104@gmail.com>`. Formats and audit script: `.claude/skills/file-headers/` (verify with `bash .claude/skills/file-headers/scripts/check-headers.sh`). This binds every coding agent (Claude Code, Codex, or others).

## Commands you should know
- Setup: `npm run setup`
- Dev: `npm run dev`
- Prod build/start: `npm run build` then `npm start`
- Full local gate (headers + format + client typecheck + server + client tests): `npm run verify`
- Server tests: `npm run test:server`
- Client tests: `npm run test:client`
- MCP install/build/start: `npm run mcp:install`, `npm run mcp:build`, `npm run mcp:start`
- MCP typecheck: `npm run mcp:typecheck`
- Token repair: `npm run repair-tokens` — one-time re-derivation of token totals inflated before usage was reconciled per `message.id` (the dashboard also runs this automatically once per database; `DASHBOARD_TOKEN_REPAIR=0` opts out)
- CLI (after setup): `ccam <command>` — terminal access to the full dashboard surface (`bin/ccam.js`; `ccam help` lists commands)

## Testing and verification policy
- `npm run verify` runs the whole local gate in one command (header audit, format check, client typecheck, server tests, client tests) and is the fastest way to confirm a change-set before opening a PR. It includes `tsc -b` because Vitest transpiles without typechecking — a test file can pass locally and still break the production build.
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
- Localization: adding an i18n key means adding it to every locale; editing `README.md` means mirroring the edit into `README-CN.md`, `README-VN.md`, `README-KO.md`, and `README-ES.md`. See `.claude/rules/i18n-parity.md`.

## Agent behavior
- Explore first, then implement.
- For larger tasks, propose/check a short plan before broad edits.
- Use file-specific rules in `.claude/rules/` when working in scoped areas.
- Use project skills from `.claude/skills/` for repeatable workflows.
- Use `.claude/agents/` subagents for focused review or investigation passes.
