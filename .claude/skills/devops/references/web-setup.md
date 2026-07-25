# web-setup — web-app dev environment setup

Goal: from any starting state, end with a Mac that can run `npm run dev`
(Express server + Vite client with HMR), proven by installed dependencies
and a working native `better-sqlite3` binary for the host Node.

Much lighter than `desktop-setup`: no Xcode Command Line Tools, no
Electron, no Electron-ABI native rebuild — the web app runs on the host
Node directly.

## Phase 1 — Audit (always first, read-only)

```bash
zsh <skill-base-dir>/scripts/web-setup-check.sh
```

If every row is `ok`, report "web-app dev environment is already set up"
and stop. If invoked in status-only mode (bare `/devops`), stop after
showing the table.

## Phase 2 — Plan

| Step | Size / time | Interactive? |
|---|---|---|
| Root + client + vscode-extension deps (`npm run setup`) | ~150-300 MB, ~1-2 min | No |

Only one real step here. If it involves a meaningful download (first-ever
install, or a `node_modules` wipe), confirm first:

🟧🟧🟧 HUMAN GATE REQUIRED 🟧🟧🟧

> 🟧🟧🟧 HUMAN GATE REQUIRED 🟧🟧🟧
>
> **Human decision needed:** Proceed with `npm run setup`? (yes / no)

## Phase 3 — Install

```bash
cd <project-root>
npm run setup
```

Installs root, `client/`, and `vscode-extension/` dependencies, then links
the `ccam` CLI. This is the same command `desktop-setup` also runs — safe
to re-run, idempotent either way.

## Phase 4 — Verify

Re-run the audit — every row must be `ok`. That's sufficient proof here
(no separate compile step needed for dev mode); `web-up`'s own verify
phase is what actually proves the server boots and serves traffic.

## Notes

- If `desktop-setup` already ran, `root-deps` / `client-deps` /
  `better-sqlite3` will already read `ok` here too — they check the same
  `node_modules`. Running `web-setup` after `desktop-setup` (or vice versa)
  is a fast no-op.
- The `better-sqlite3` binary checked here is the ROOT project's own
  install (built for the host Node's ABI), separate from
  `desktop/node_modules/better-sqlite3` (built for Electron's ABI, which
  `desktop-setup` handles).
