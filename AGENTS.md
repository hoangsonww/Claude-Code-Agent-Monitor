# Codex Project Instructions

## Project intent
- Keep this repository a stable, local-first Claude Code monitoring platform.
- Maintain correctness across hooks, API, DB, websocket, UI, and MCP integration.

## Priorities
- Correctness over cleverness.
- Small, scoped, reversible diffs.
- Preserve existing behavior unless change is requested.
- Update docs whenever workflow or architecture changes — follow `.claude/skills/update-project-docs/` automatically at the end of every change-set (README + CN/VN/KO/ES mirrors, ARCHITECTURE, wiki + i18n + cache bump, server/client READMEs, docs/*).
- Apply `.agents/skills/i18n-parity/` (mirrored from `.claude/skills/i18n-parity/`, which also holds its scripts) whenever a change touches localized content (UI copy or i18n keys, `README.md`, `wiki/index.html`, or docs the READMEs and wiki mirror), and work through its new-language checklist when adding a language. English is the source of truth on all five localization surfaces; every supported language (`en`/`zh`/`vi`/`ko`/`es`) ships the change in the same PR. Verify with `bash .claude/skills/i18n-parity/scripts/i18n-audit.sh`.
- Apply `.agents/skills/push-to-forked-pr/` whenever updating a PR whose head branch lives on a fork — `origin` here is the upstream, so a plain `git push origin` updates the wrong branch and leaves the PR untouched.
- Apply `.agents/skills/version-release/` for every release bump: patch for backward-compatible fixes/small improvements, minor for larger backward-compatible capabilities, and major for breaking/fundamental changes; synchronize every shipping release surface, create or reuse the matching `v<version>` GitHub milestone, and assign the release PR plus linked closing issues to it.
- Every applicable source file you create or update (`.js/.ts/.tsx/.cjs/.mjs/.py/.sh/.css`) must start with the authorship header: a truthful file overview plus the exact line `@author Son Nguyen <hoangson091104@gmail.com>`. See `.claude/skills/file-headers/` and `.claude/rules/file-headers.md`; verify with `bash .claude/skills/file-headers/scripts/check-headers.sh`.

## Where to work
- `server/` for API/routes/data processing.
- `client/` for React UI behavior.
- `mcp/` for local MCP server tooling.
- `scripts/` for hook/install/import/cleanup utilities.

## Validation expectations
- Full local gate (headers + format + client typecheck + server + client tests): `npm run verify`
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
- Token repair: `npm run repair-tokens` — one-time re-derivation of token totals inflated before usage was reconciled per `message.id` (the dashboard also runs this automatically once per database; `DASHBOARD_TOKEN_REPAIR=0` opts out)
