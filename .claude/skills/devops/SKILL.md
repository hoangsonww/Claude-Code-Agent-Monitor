---
name: devops
argument-hint: "[desktop-setup|setup | desktop-build | desktop-remove | web-setup | web-build|build | web-up|up | web-down|down | status]"
description: >
  Claude Code Agent Monitor's DevOps toolbox — commands for the desktop
  Electron app AND the native web-app dev stack (Express + Vite). Use when
  Sara types "/devops", or asks to set up, build, deploy, refresh, run, or
  remove either. Desktop commands: `desktop-setup` (alias `setup`) — audits
  and installs everything needed to build the desktop app locally;
  `desktop-build` — builds a fresh arm64 DMG and installs/replaces the app
  in /Applications; `desktop-remove` — quits and deletes the installed app,
  optionally purging its data. Web-app commands (the fast iteration loop —
  Vite HMR, no packaging): `web-setup` — installs root+client deps only;
  `web-build` (alias `build`) — runs the production client build;
  `web-up` (alias `up`) — starts the dev server in the background;
  `web-down` (alias `down`) — stops it. Bare `build`/`up`/`down` default to
  the web app, not desktop. `status` — read-only report of the current
  state of everything the devops skill manages. Invoking with no command
  lists available commands and runs the status report.
---

# DevOps Skill — Claude Code Agent Monitor

A command-based toolbox covering two things: the Electron desktop shell in
`desktop/` (see `DESKTOP.md` in the project root for the full feature doc),
and the native web-app dev stack (`npm run dev` — Express + Vite). Each
command follows the same discipline:

1. **Audit first** — run the read-only check script and show current state.
2. **Plan** — list exactly what's missing or what will change, with
   download sizes / disk requirements, before installing or deploying
   anything.
3. **Install / Execute** — run non-interactive steps directly. For steps
   needing a login or `sudo` (e.g. Xcode Command Line Tools), give Sara the
   exact command prefixed with `!` so she can run it in-session.
4. **Verify** — prove the result end-to-end (a real compile, a real DMG, a
   real installed app that launches), don't just assume it worked.

Never install or deploy anything before showing the audit and plan. All
installs must be idempotent — re-running a command on a healthy environment
should report "already set up" / "already up to date" and change nothing.

## Human gates

**Every human decision** uses the delivery-team visible gate. Do not bury a
choice in a narrative paragraph.

At every stop-and-wait point, include the literal banner in the chat reply
and present the question as its own callout:

> 🟧🟧🟧 HUMAN GATE REQUIRED 🟧🟧🟧
>
> **Human decision needed:** <the question>

Rules:

- Never fold a gate into a summary where it reads as background.
- Multiple gates in one report-back → each gets its own banner + callout.
- Multi-way choices in plain chat: letter them `**A)**` / `**B)**` / `**C)**`
  (plain yes/no "proceed?" does not need lettering).
- Wait for the answer before execute / install / delete.

Typical gates here: `/devops desktop-build` before overwriting the app
currently installed in `/Applications`; `/devops desktop-remove` before
deleting it; a second, separate gate in `desktop-remove` asking whether to
also purge app data. The web-app commands (`web-build`/`web-up`/`web-down`)
do NOT gate — they touch no installed app and no user data, only a local
dev-server process that's cheap to restart. Mark each gate in the
procedure docs with `🟧🟧🟧 HUMAN GATE REQUIRED 🟧🟧🟧` above the decision.

## Command routing

Parse the argument after `/devops`. **Bare `build`/`up`/`down` default to
the web app, not desktop** — say `desktop-build` explicitly to reach that
one; there's no `up`/`down` shorthand for it anymore.

| Argument | Command |
|---|---|
| `desktop-setup`, `setup` | Desktop build-environment setup — follow `references/desktop-setup.md` |
| `desktop-build` | Build a fresh DMG and install/replace the app in `/Applications` — follow `references/desktop-build.md` |
| `desktop-remove` | Quit and delete the installed app, optionally purge its data — follow `references/desktop-remove.md` |
| `web-setup` | Web-app dev-environment setup (root+client deps only) — follow `references/web-setup.md` |
| `web-build`, `build` | Run the production client build (`npm run build`) — follow `references/web-lifecycle.md` |
| `web-up`, `up` | Start the web-app dev server (Express + Vite HMR) in the background — follow `references/web-lifecycle.md` |
| `web-down`, `down` | Stop the backgrounded web-app dev server — follow `references/web-lifecycle.md` |
| `status` | Report current state of everything this skill manages — follow `references/status.md` |
| *(none)* | List commands, then run the `status` command |

Unknown argument → list available commands, suggest the closest match.

## Commands

### desktop-setup (alias: setup)

Audits and installs everything needed to *build* the desktop app on this
Mac: Xcode Command Line Tools, root + client npm dependencies, and the
`desktop/` workspace's Electron + electron-builder + native `better-sqlite3`
rebuild. Full procedure in `references/desktop-setup.md`; audit script at
`scripts/desktop-setup-check.sh`.

### desktop-build

Builds a fresh arm64 DMG (`npm run desktop:dmg:arm64`) and installs it into
`/Applications`, replacing whatever build is currently there — this is the
"refresh with a new build" and "deploy it to my Mac" action combined into
one step. Full procedure in `references/desktop-build.md`; audit script at
`scripts/desktop-check.sh` (shared with `desktop-remove`). No `up` alias —
bare `up` now routes to `web-up` (see below).

### desktop-remove

Quits `Claude Code Monitor.app` if it's running, then deletes it from
`/Applications`. Asks, every run, whether to also purge the app's data
(`~/Library/Application Support/Claude Code Monitor/`) and logs
(`~/Library/Logs/Claude Code Monitor/`) — default is to keep that data.
Full procedure in `references/desktop-remove.md`; audit script at
`scripts/desktop-check.sh` (shared with `desktop-build`).

### web-setup

Audits and installs just what `npm run dev` needs: root + client npm
dependencies (`npm run setup`). No Xcode Command Line Tools, no Electron,
no Electron-ABI native rebuild — the web app runs on the host Node
directly. Full procedure in `references/web-setup.md`; audit script at
`scripts/web-setup-check.sh`.

### web-build (alias: build), web-up (alias: up), web-down (alias: down)

The fast iteration loop for anything scoped to `client/` or `server/` —
Vite HMR reloads sub-second, versus roughly a minute for a full
`desktop-build`. `web-build` runs `npm run build` (the production client
bundle — not required for dev mode, useful as a production-parity check).
`web-up` starts `node scripts/dev.js` (same as `npm run dev`) in the
background, tracked via a PID file at `~/.claude/.ccam-web-dev.pid`, and
verifies with a live `/api/health` check. `web-down` stops it via `SIGTERM`
(the project's own `scripts/dev.js` forwards this cleanly to both the
server and Vite). None of the three gate — they touch no installed app and
no user data. Full procedure in `references/web-lifecycle.md`; shared
audit script at `scripts/web-check.sh`.

### status

Read-only report of the current state of everything the devops skill
manages. Runs every audit script in `scripts/` (so new commands are picked
up automatically) and gives a per-command verdict plus what to run to fix
anything unhealthy. Never installs or changes anything. Procedure in
`references/status.md`.

## Adding new commands

New commands get: a row in the routing table, a section here, a procedure
doc in `references/<command>.md`, an entry in the frontmatter
`argument-hint`, and a read-only audit script in
`scripts/<command>-check.sh` — the audit script is what makes the command
show up in `status`. Keep the audit/plan/install/verify structure. If a
new command shares build/install state with `desktop-build` or
`desktop-remove`, reuse `scripts/desktop-check.sh`; if it shares state with
`web-build`/`web-up`/`web-down`, reuse `scripts/web-check.sh` — don't add a
new script for state something already tracks (see `references/status.md`'s
note on shared scripts).
