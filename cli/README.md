# cli/

Source of `ccam`, the Claude Code Agent Monitor command-line interface. It is a [Commander.js](https://github.com/tj/commander.js) command tree that gives the terminal the same surface as the dashboard: server lifecycle, live monitoring, sessions/agents/events/transcripts, analytics, cost, alerts, pricing, data sources, and admin tasks.

The executable shim is [`bin/ccam.js`](../bin/ccam.js) (see [`bin/README.md`](../bin/README.md)). For the complete user-facing command reference see [`docs/CLI.md`](../docs/CLI.md); this file covers how the code is organized.

## Quick start

```bash
npm run setup          # installs deps and links `ccam` globally
ccam help              # grouped command list
ccam start             # start the dashboard in the background
ccam overview --watch  # live one-screen snapshot
ccam sessions --json   # machine-readable output
ccam repl              # interactive shell with completion and history
```

## Layout

```text
cli/
├── index.js            # program assembly: global options, help styling, exit codes
├── repl.js             # `ccam repl` / `shell` / `i` interactive shell
├── lib/
│   ├── framework.js    # CcamCommand, run(), listGroup(), confirm(), parsers, introspection
│   ├── runtime.js      # process-wide state, error classes, repo root, version
│   ├── http.js         # dashboard URL discovery, auth, JSON/raw requests, health probe
│   ├── offline.js      # direct SQLite reads when the server is down
│   └── ui.js           # colors, tables, cards, charts, sparklines, formatters
└── commands/
    ├── server.js       # status, health, start, stop, restart, logs, open
    ├── monitor.js      # stats, kanban, overview/top, tail, stream, watch
    ├── data.js         # sessions, agents, events, transcripts (+ legacy forms)
    ├── insights.js     # analytics, workflows, runs, run, cost
    ├── alerts.js       # alert feed, alert rules, webhooks
    ├── pricing.js      # Claude pricing rules, GPT/Codex and Cursor rate cards
    ├── sources.js      # history import, import-data, SSH remote sources
    ├── admin.js        # doctor, info, export, cleanup, snapshots, clear-data, hooks, config, api, mcp, updates, metrics, home, push
    └── meta.js         # help, version, commands, completion, repl
```

`index.js` registers every module listed in `COMMAND_MODULES`; each module exports `register(program)`, which attaches its commands to the shared root.

## Global options

Valid anywhere on the command line and inherited by every command:

| Option            | Env fallback                               | Effect                                                     |
| ----------------- | ------------------------------------------ | ---------------------------------------------------------- |
| `--json`          | `CCAM_OUTPUT=json`                         | Stable JSON on stdout; errors as `{"error":{...}}` on stderr |
| `--format pretty` | —                                          | Human views for commands whose default is raw JSON (`run`) |
| `--server <url>`  | `CCAM_URL`                                 | Target a specific dashboard base URL                       |
| `--token <token>` | `DASHBOARD_API_TOKEN` / `CCAM_API_TOKEN`   | API bearer token                                           |
| `--no-color`      | `NO_COLOR=1` (force on: `FORCE_COLOR` / `CCAM_COLOR=1`) | Plain output; colors are also off when piped |

> **Rule:** no subcommand option may reuse one of these names — the root would swallow it. `server/__tests__/ccam-cli-framework.test.js` enforces this.

## Server discovery

`lib/http.js` resolves the dashboard URL in this order:

1. `--server` / `CCAM_URL`
2. `CLAUDE_DASHBOARD_PORT` / `DASHBOARD_PORT` → `http://127.0.0.1:<port>`
3. The live-server discovery file `.agent-dashboard.json` (`~/.claude` for the default home, machine-local app data for a relocated home; PID liveness checked)
4. `http://127.0.0.1:4820`

## Offline mode

When no server answers, read-only commands fall back to reading the SQLite database directly (`lib/offline.js`; safe as a second reader under WAL). Commands that need server-side logic — cost math, analytics aggregation, live capture, mutations that broadcast — refuse with a `SERVER_DOWN` error instead of producing divergent results. Offline reads also correct the *displayed* status of sessions whose process has exited; the database is never written.

## Error model and exit codes

Commands never call `process.exit`. They throw `CliError` (usage/validation), `ApiError` (HTTP failure), or `ServerDownError`, and the single reporter in `lib/runtime.js` prints them. Exit codes are `0` success and `1` any failure; the failure kind is carried by the JSON `error.code` (`USAGE`, `SERVER_DOWN`, `CONFIRMATION_REQUIRED`, `HTTP_404`, …).

## Safety model for writes

- Writes go through `confirm()` — pass `--yes`, or answer y/N on a TTY. The prompt only appears when stdin and stdout are both TTYs **and** JSON mode is off; non-interactive shells and any `--json` / `CCAM_OUTPUT=json` run must pass `--yes` (otherwise the refusal is `CONFIRMATION_REQUIRED`).
- Established one-shot mutations keep their historical no-prompt behavior: `pricing set/delete`, `alerts ack/ack-all`, `cleanup`, and `remote-sources add/sync`. Don't add a prompt to these without treating it as a behavior change.
- `clear-data` requires a literal `--yes`; reaching it through the generic `ccam api` route additionally needs `--confirm CLEAR_ALL_DATA`.
- `snapshots prune` is a dry run unless given `--apply --confirm PRUNE_SNAPSHOTS`.
- Pricing edits for GPT/Cursor read the existing row and merge onto it, so a partial edit never zeroes the other rates.

## Adding or changing a command

1. Pick the module in `commands/` that owns the area (or add a new one and append it to `COMMAND_MODULES` in `index.js`).
2. Build commands with the helpers in `lib/framework.js`: wrap actions in `run()` (it supplies `ctx = { args, opts, cmd }` and routes offline fallbacks), use `listGroup()` for list-by-default resource groups, and gate writes with `confirm()`.
3. Render with `lib/ui.js` helpers and honor `isJson()` so `--json` output stays stable.
4. Do not reuse a global option name for a subcommand option.
5. Run the CLI tests and update [`docs/CLI.md`](../docs/CLI.md):

```bash
node --test server/__tests__/ccam-cli.test.js server/__tests__/ccam-cli-framework.test.js server/__tests__/ccam-stop.test.js
```

## Shell completion and introspection

- `ccam completion bash|zsh|fish` prints a completion script driven by the hidden Cobra-style `__complete` command.
- `ccam commands --json` emits a machine-readable schema of every command, argument, and option (useful for agents).
- The REPL's tab-completion uses the same command tree, so it always matches the one-shot CLI.
