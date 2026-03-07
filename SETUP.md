# Setup Guide

## How it works

Agent Dashboard integrates with Claude Code through its native hook system. When Claude Code performs any action (tool use, session start, session end), it fires a hook that calls a small Node.js script bundled with this project. That script forwards the event over HTTP to the dashboard server, which stores it in SQLite and broadcasts it to the browser over WebSocket.

```
Claude Code  →  hook fires  →  hook-handler.js  →  POST /api/hooks/event
                                                         ↓
Browser  ←  WebSocket broadcast  ←  Express server  ←  SQLite
```

No Claude Code configuration is required beyond running this dashboard — the server configures the hooks automatically on startup.

---

## Configuration

### Hook auto-installation

The dashboard server writes the following to `~/.claude/settings.json` every time it starts:

```json
{
  "hooks": {
    "PreToolUse":   [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node \"/path/to/scripts/hook-handler.js\" PreToolUse" }] }],
    "PostToolUse":  [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node \"/path/to/scripts/hook-handler.js\" PostToolUse" }] }],
    "Stop":         [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node \"/path/to/scripts/hook-handler.js\" Stop" }] }],
    "SubagentStop": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node \"/path/to/scripts/hook-handler.js\" SubagentStop" }] }],
    "Notification": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node \"/path/to/scripts/hook-handler.js\" Notification" }] }]
  }
}
```

Existing hooks in that file are preserved. The dashboard only adds or updates entries that contain `hook-handler.js`.

To re-run hook installation manually:

```bash
npm run install-hooks
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `DASHBOARD_PORT` | `4820` | Port the Express server listens on |
| `DASHBOARD_DB_PATH` | `data/dashboard.db` | Path to the SQLite database file |
| `NODE_ENV` | `development` | Set to `production` to serve built client |

Example with custom port:

```bash
DASHBOARD_PORT=9000 npm run dev
```

> If you change the port, update `client/vite.config.ts` proxy target to match, and re-run `npm run install-hooks` so the hook handler points to the new port.

---

## Database

The SQLite database is created automatically at `data/dashboard.db` on first run. The directory is created if it does not exist. The database uses WAL mode for concurrent reads and foreign keys for referential integrity.

### Clear all data

To remove all sessions, agents, events, and token usage (useful after running seed data or for a clean start):

```bash
npm run clear-data
```

### Data management via Settings page

The Settings page (`/settings`) provides a UI for:

- **Model Pricing** — view and edit per-model cost rates, reset to defaults, add custom models
- **Hook Configuration** — check which hooks are installed and reinstall them
- **Data Export** — download all sessions, agents, events, and pricing as a JSON file
- **Session Cleanup** — abandon stale active sessions after N hours, purge old completed sessions after N days
- **Clear All Data** — remove all sessions, agents, events, and token usage

### Seed demo data

To populate the dashboard with sample sessions, agents, and events for UI exploration:

```bash
npm run seed
```

---

## Scripts reference

| Script | Command | Description |
|---|---|---|
| `setup` | `npm run setup` | Install all dependencies (server + client) |
| `dev` | `npm run dev` | Start server + client in development mode |
| `start` | `npm start` | Start server in production mode |
| `build` | `npm run build` | Build the React client to `client/dist/` |
| `install-hooks` | `npm run install-hooks` | Write Claude Code hooks to `~/.claude/settings.json` |
| `clear-data` | `npm run clear-data` | Delete all data from the database |
| `seed` | `npm run seed` | Insert demo sessions/agents/events |
| `import-history` | `npm run import-history` | Import legacy sessions from `~/.claude/` (also runs on startup) |
| `test` | `npm test` | Run all server and client tests |
| `test:server` | `npm run test:server` | Run server integration tests only |
| `test:client` | `npm run test:client` | Run client unit tests only |
| `format` | `npm run format` | Format all files with Prettier |
| `format:check` | `npm run format:check` | Check formatting without writing |

---

## Statusline (optional)

The `statusline/` directory contains a standalone terminal statusline for Claude Code showing model, working directory, git branch, context window usage, and token counts. It is independent of the web dashboard.

See [statusline/README.md](./statusline/README.md) for installation instructions.

---

## Troubleshooting

### No sessions appearing after starting Claude Code

**Check 1 — Is the server running?**

```bash
curl http://localhost:4820/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

**Check 2 — Are hooks installed?**

Open `~/.claude/settings.json` and confirm it contains a `hooks` section with entries referencing `hook-handler.js`. If not, run:

```bash
npm run install-hooks
```

**Check 3 — Did you start a new Claude Code session after the server started?**

Hooks only apply to sessions started after installation. Restart Claude Code.

**Check 4 — Is Node.js in PATH when Claude Code runs hooks?**

On some systems, the shell environment when Claude Code fires hooks may not include the full PATH. Test with:

```bash
node --version
```

If Node.js is not found, use the full path to `node` in the hook command. Edit `scripts/install-hooks.js`, replace `node` with the absolute path (e.g. `/usr/local/bin/node`), and re-run `npm run install-hooks`.

---

### Dashboard shows "Disconnected" in the sidebar

The WebSocket connection to the server failed. Ensure the server is running:

```bash
npm run dev
```

The client will automatically reconnect every 2 seconds once the server is available.

---

### Events Today shows 0 despite recent activity

This was a known timezone bug (fixed in current version). If you are still seeing this, ensure you are running the latest code and restart the server.

---

### Port 4820 already in use

```bash
DASHBOARD_PORT=4821 npm run dev
```

Then update the Vite proxy in `client/vite.config.ts`:

```ts
proxy: {
  "/api": "http://localhost:4821",
  "/ws":  { target: "ws://localhost:4821", ws: true }
}
```

And reinstall hooks:

```bash
DASHBOARD_PORT=4821 npm run install-hooks
# This does not currently pass the port — edit scripts/hook-handler.js
# and change the default port, or set CLAUDE_DASHBOARD_PORT=4821 in your env.
```
