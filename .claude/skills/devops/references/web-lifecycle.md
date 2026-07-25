# web-build / web-up / web-down — the web-app dev stack

Aliases (bare, unqualified — reassigned away from the desktop commands):
`build` → `web-build`, `up` → `web-up`, `down` → `web-down`.

Goal: the fast iteration loop — Vite HMR reloads sub-second, versus roughly
a minute for a full `desktop-build` cycle. Use this for anything scoped to
`client/` or `server/`; reach for `desktop-build` only when you need to
verify Electron-specific behavior (tray, native menu, packaging) or want
the actual installed app updated.

Backend: a single native process — `node scripts/dev.js` (what `npm run
dev` runs: Express + Vite via `concurrently`). Not Docker — this app reads
live Claude Code hook events and session working directories from
`~/.claude/` on the host, and `better-sqlite3` is a native module built for
the host Node's ABI; containerizing would mean bind-mounting the same host
paths anyway, and on macOS Docker's bind-mount layer adds real latency to
Vite's file-watching. See `DESKTOP.md`-adjacent project discussion — this
is a deliberate choice, not an oversight.

`scripts/dev.js` already forwards `SIGINT`/`SIGTERM` through to its
`concurrently` children (server + Vite), so `web-down` only needs to signal
the one tracked PID — no process-group gymnastics, no name-pattern `pkill`
that could collide with some other project's `vite`.

## Solution this covers

| Solution | Underlying unit | Notes |
|---|---|---|
| `web` (only solution; `all` means the same thing) | `node scripts/dev.js`, tracked via PID file | Express (`server/index.js`) + Vite client, same process tree `npm run dev` starts |

State: PID file `~/.claude/.ccam-web-dev.pid`, log `~/.claude/.ccam-web-dev.log` (mirrors this project's own convention of keeping runtime state under `~/.claude/` — see `server/lib/server-info.js` / `~/.claude/.agent-dashboard.json`).

## Shared audit (Phase 1 for all three actions below)

```bash
zsh <skill-base-dir>/scripts/web-check.sh
```

Reports: dependencies installed, whether `client/dist` (the production
bundle) exists, and whether the dev server is currently running (PID +
port). Read-only, exits 0 always. If invoked in status-only mode (bare
`/devops`), stop after showing the table.

If `root-deps` / `client-deps` are missing, point Sara at `/devops
web-setup` first.

## build (alias: `build`)

**Plan:** rebuilds `client/dist`, the production bundle (`npm run build`).
Not required for `web-up` — Vite dev mode serves from source — but is what
`npm start` and the desktop app ship, so this is useful as a fast
production-parity check without going all the way to a desktop rebuild.
Non-destructive; no gate needed.

**Execute:**
```bash
cd <project-root>
npm run build
```

**Verify:** re-run the shared audit — `client-build` reads `ok`. Confirm
`client/dist/index.html` exists.

## up (alias: `up`)

**Plan:** state that this starts the Express server + Vite (HMR) in the
background, auto-picking a free port starting at 4820 if something else
(commonly the desktop app) already holds it. Non-destructive, nothing to
confirm — starting a local dev server has no side effect beyond binding a
port.

If the audit already shows `web-running`, report that it's already up
(with its PID/port) and stop — idempotent, no second instance started.

**Execute:**
```bash
cd <project-root>
mkdir -p "$HOME/.claude"
nohup node scripts/dev.js > "$HOME/.claude/.ccam-web-dev.log" 2>&1 &
echo $! > "$HOME/.claude/.ccam-web-dev.pid"
disown
```

Invoking `node scripts/dev.js` directly (rather than `npm run dev`) avoids
an extra process layer between the tracked PID and the process that
actually has the `SIGTERM`/`SIGINT` forwarding logic — `web-down` signals
exactly the process that knows how to shut down its own children cleanly.

**Verify:** re-run the shared audit — `web-running` shows a PID. Then prove
it's actually serving, the real check:

```bash
sleep 2
PORT="$(grep -oE 'listen on :[0-9]+|using [0-9]+ instead' "$HOME/.claude/.ccam-web-dev.log" | tail -1 | grep -oE '[0-9]+')"
curl -sf "http://localhost:${PORT:-4820}/api/health"
```

Report the resolved port plainly — it may not be 4820 if something else
(e.g. the desktop app) already holds it; `scripts/dev.js` logs a warning
about shared-database double-counting in that case, surface it if present.

## down (alias: `down`)

**Plan:** stop the tracked process. Cheaply reversible — `up` starts a
fresh one from the same source in a couple seconds. No confirmation gate
needed (unlike `desktop-remove`, this touches no installed app, no user
data — it's just stopping a local process).

If the audit shows `web-running` as "not running", report there's nothing
to stop and stop here.

**Execute:**
```bash
PID_FILE="$HOME/.claude/.ccam-web-dev.pid"
PID="$(cat "$PID_FILE" 2>/dev/null)"
if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
  kill -TERM "$PID"
  for i in 1 2 3 4 5; do
    kill -0 "$PID" 2>/dev/null || break
    sleep 1
  done
  kill -0 "$PID" 2>/dev/null && kill -KILL "$PID"
fi
rm -f "$PID_FILE"
```

`SIGTERM` is enough in the normal case — `scripts/dev.js` forwards it to
`concurrently`, which forwards it to the server and Vite, both exiting
cleanly. The `SIGKILL` fallback only fires if something hangs past 5s.

**Verify:** re-run the shared audit — `web-running` reads "not running".
Confirm the port is free: `lsof -nP -iTCP:<port> -sTCP:LISTEN` returns
nothing for the port `up` was using (skip if it was never captured).

## Notes

- No `web-remove` — there's no destructive artifact to wipe. `client/dist`
  is just a build output `web-build` regenerates every run; deleting it
  manually (`rm -rf client/dist`) is enough on the rare occasion you'd want
  to, and doesn't warrant a gated command of its own.
- If the desktop app is also running, it's on the same port (4820) unless
  displaced — `web-up` detects this via `scripts/dev.js`'s own port-probe
  and picks a fallback port automatically. Both processes share the same
  SQLite database (`~/.claude/agent-dashboard`), so live hook events get
  counted by both if left running together; `scripts/dev.js` already warns
  about this in its log output when it happens.
