# scripts/

Node (and one Python) utilities for development, hook delivery, data management, code generation, and release automation. Most are wired to an `npm run` script in the root `package.json`; prefer that form so flags and working directory stay consistent.

## Development

| Script          | npm script           | Purpose |
| --------------- | -------------------- | ------- |
| `dev.js`        | `npm run dev`        | Picks a free port (starting at 4820, probing IPv4 and IPv6 loopback), exports it as `DASHBOARD_PORT`, then runs the server and Vite client together. Avoids silent collisions with an SSH `LocalForward` on 4820. |
| `dev-server.js` | `npm run dev:server` | Runs `server/index.js` under a debounced, cross-platform watcher of `server/` and `scripts/`; save bursts become one graceful restart. |
| `postinstall.js`| (`postinstall` hook) | After a root `npm install`, also installs `client/` dependencies. Safe no-op when `client/` is absent (Docker stages, published tarball). |
| `run-npm.js`    | used by `npm run setup`, `mcp:install` | Runs nested npm installs with inherited `npm_config_allow_scripts` stripped, so npm ≥ 11 does not fail with `EALLOWSCRIPTS`. |

## Hooks

| Script                    | npm script              | Purpose |
| ------------------------- | ----------------------- | ------- |
| `install-hooks.js`        | `npm run install-hooks` | Writes the dashboard's hook entries into Claude Code `settings.json`, and optionally the Codex hook set. Pass `--claude`, `--codex`, or `--both` to skip the interactive chooser. |
| `install-codex-hooks.js`  | —                       | Installs the supported Codex lifecycle hooks into `~/.codex/hooks.json` without touching unrelated user hooks. |
| `hook-handler.js`         | invoked by Claude Code  | Reads hook JSON from stdin and forwards it to every live dashboard. Fire-and-forget and fail-silent — it must never block Claude Code. |
| `codex-hook-handler.js`   | invoked by Codex        | Same contract for Codex lifecycle hooks. |
| `hook-transport.js`       | (library)               | Shared fail-safe transport: loopback fan-out by default, opt-in HTTPS remote dashboard via `CCAM_DASHBOARD_URL` plus `CCAM_HOOK_TOKEN` / `CCAM_HOOK_TOKEN_FILE`. |

Hook behavior is documented in [`docs/HOOKS.md`](../docs/HOOKS.md). Any change here must stay non-blocking and fail-safe.

## Data management

| Script              | npm script                   | Purpose |
| ------------------- | ---------------------------- | ------- |
| `import-history.js` | `npm run import-history`     | Imports existing Claude Code sessions from `~/.claude/` JSONL files. Flags: `--dry-run`, `--project <name>`. Also used for auto-import on server startup. |
|                     | `npm run reconcile-tokens`   | Same script with `--reconcile-tokens` (add `--all`, `--reset-baselines` as needed) to re-derive token totals. |
| `cost-snapshot.js`  | —                            | `snapshot --out f.tsv` writes a per-session source/token/cost TSV from the database opened read-only; `compare before.tsv after.tsv` splits local vs remote changes. `--fail-on-local-change` exits 1 when local tokens/cost change, a local session is removed, or ownership (source or provider) changes for a local session; an incomplete or non-numeric row is refused. Take one before an upgrade that recounts tokens at startup. |
| `seed.js`           | `npm run seed`               | Additive, idempotent fixtures for development. `--full` adds random demo sessions; `--reset` refreshes only fixture rows. Never deletes user data. |
| `clear-data.js`     | `npm run clear-data`         | **Destructive.** Dry run by default (prints counts). `--yes` wipes sessions/agents/events/token usage; `--backup` snapshots the DB to `data/backups/` first; `--demo-only --yes` removes only seed fixtures. |

```bash
npm run import-history -- --dry-run
npm run seed
npm run clear-data                    # dry run
npm run clear-data -- --yes --backup  # irrevocable, with backup
```

## Code generation and agent extensions

| Script                          | npm script                    | Purpose |
| ------------------------------- | ----------------------------- | ------- |
| `generate-openapi-yaml.js`      | `npm run openapi:yaml`        | Regenerates root `openapi.yaml` from `createOpenApiSpec()` in `server/openapi.js`. Never hand-edit `openapi.yaml`. |
| `sync-agent-extensions.js`      | `npm run extensions:sync`     | Generates Codex plugin manifests, skill `agents/openai.yaml`, and both marketplace catalogs from the Claude plugin sources in [`plugins/`](../plugins/README.md). |
| `validate-agent-extensions.js`  | `npm run extensions:validate` | Read-only validation of manifests, skills, components, MCP wiring, and catalog drift. |
| `expand-ts-module-docs.py`      | —                             | One-off, idempotent helper that appends TSDoc module guides to TypeScript files (comments only). |

## Release

| Script               | Used by                      | Purpose |
| -------------------- | ---------------------------- | ------- |
| `publish-release.js` | `.github/workflows/ci.yml`   | Creates or resumes a same-commit draft GitHub release, uploads desktop artifacts with retries, verifies all four, then publishes. Published releases are never modified. |

## Tests

Script behavior is covered in `server/__tests__/`, e.g. `hook-handler.test.js`, `hook-transport.test.js`, `dev-server.test.js`, `run-npm-env.test.js`, `publish-release.test.js`, and `plugins-marketplace.test.js`:

```bash
npm run test:server
```

## Conventions

- Every script starts with the project file header (`@author Son Nguyen <hoangson091104@gmail.com>`); check with `npm run check:headers`.
- Executables keep their `#!/usr/bin/env node` shebang above the header.
- Destructive scripts default to a dry run and require an explicit flag to write.

### Codex output repair

Stop the dashboard before upgrading ingestion and applying historical repair. Preview with `node scripts/repair-codex-output.js --db /path/to/dashboard.db --out /private/backup/plan.json`; apply with `--apply --journal /private/backup/new-before-after.json` instead of `--out`. Files must be new: neither plans nor journals overwrite existing files. Keep these private journals out of Git. Only output totals whose complete legacy buckets match retained evidence are changed. Plain, gzip and Zstd prefixes are streamed; foreign identities, changed files/cursors/ownership and unverifiable histories are skipped. The journal file and directory are flushed before updates; repair refuses unsupported durability. Re-running the preview identifies already-correct rows.

Use `--session <id>` to recheck one live transcript whose fingerprint changed during a full pass. It applies the same journal and identity/cursor/token/file fences and never widens the repair scope.

Cost snapshots close their owned scratch database before removing the temporary directory. An embedding caller retains its existing database connection and environment; failed pricing initialization also releases owned handles.

The comparison includes one-hour cache writes and web search, web fetch and code execution usage, including baselines, even if a model has no price and its estimated cost stays zero. Partial snapshots with the earlier eight-column header are rejected, as is a snapshot that lists one session twice; regenerate both snapshots with the same script. Newly added sessions are reported separately and do not fail the existing-session local-change guard.

Rate cards, session ownership and usage are captured in one read transaction. The transaction ends before pricing calculations and TSV output, so those steps do not keep the WAL snapshot open.

Each snapshot output must be a new file. Existing snapshots and paths that alias the input database are refused; choose distinct before and after filenames.
