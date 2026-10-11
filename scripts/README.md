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

| Script                   | Used by                                 | Purpose |
| ------------------------ | --------------------------------------- | ------- |
| `bump-release.js`        | `npm run release:bump`, `release-bump.yml` | Plans or applies `major`, `intermediate`, and `minor` root releases across every guarded shipping surface, regenerates OpenAPI and agent extensions, and rejects stale old-version references. `--dry-run --json` is read-only. |
| `lib/release-version.js` | `bump-release.js`                       | Pure strict-version calculation, allowlisted mutation planning, fixture-safe application, and previous-version sweep helpers. |
| `publish-release.js`     | `.github/workflows/ci.yml`              | Creates or resumes a same-commit draft GitHub release, uploads desktop artifacts with retries, verifies all four, then publishes. Published releases are never modified. |

Repository automation uses these component names:

```bash
npm run release:bump -- major                   # X.Y.Z -> X+1.0.0
npm run release:bump -- intermediate            # X.Y.Z -> X.Y+1.0
npm run release:bump -- minor                   # X.Y.Z -> X.Y.Z+1
node scripts/bump-release.js intermediate --dry-run --json
```

The JSON form is invoked directly with `node` so stdout contains only the JSON document. The manual **Prepare Release Bump** workflow creates the coordinated commit, milestone, branch, and pull request. It does not merge, tag, or publish.

## Tests

Script behavior is covered in `server/__tests__/`, e.g. `hook-handler.test.js`, `hook-transport.test.js`, `dev-server.test.js`, `run-npm-env.test.js`, `publish-release.test.js`, and `plugins-marketplace.test.js`:

```bash
npm run test:server
```

## Conventions

- Every script starts with the project file header (`@author Son Nguyen <hoangson091104@gmail.com>`); check with `npm run check:headers`.
- Executables keep their `#!/usr/bin/env node` shebang above the header.
- Destructive scripts default to a dry run and require an explicit flag to write.
