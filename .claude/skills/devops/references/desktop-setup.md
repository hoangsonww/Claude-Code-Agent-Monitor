# desktop-setup — desktop-app build environment setup

Alias: `setup`.

Goal: from any starting state, end with a Mac that can build the Electron
desktop app, proven by a real TypeScript compile of the `desktop/`
workspace (the same compile `desktop-build` depends on).

## Phase 1 — Audit (always first, read-only)

Run the audit script and show Sara the table:

```bash
zsh <skill-base-dir>/scripts/desktop-setup-check.sh
```

If every row is `ok`, report "desktop build environment is already set up",
offer the Phase 4 smoke test as proof, and stop.

If invoked in status-only mode (bare `/devops`), stop after showing the table.

## Phase 2 — Plan

From the audit, list only the missing/wrong items, in dependency order:

| Step | Size / time | Interactive? |
|---|---|---|
| Xcode Command Line Tools | ~1-2 GB download, ~5-10 min | Yes — triggers a GUI installer |
| Root + client deps (`npm run setup`) | ~150-300 MB, ~1-2 min | No |
| Client build (`npm run build`) | seconds | No |
| Desktop deps: Electron + electron-builder + native `better-sqlite3` rebuild (`npm run desktop:install`) | ~150-250 MB (Electron binary download), ~2-3 min | No — unless the native rebuild falls back to compiling from source, which needs Xcode CLT from the step above |

Before starting, stop on a human gate if any step involves a real download:

🟧🟧🟧 HUMAN GATE REQUIRED 🟧🟧🟧

> 🟧🟧🟧 HUMAN GATE REQUIRED 🟧🟧🟧
>
> **Human decision needed:** Proceed with the plan above (including the
> Electron/Xcode CLT downloads)? (yes / no)

## Phase 3 — Install

Only run the steps the audit flagged. Every step is idempotent.

### 3.1 Xcode Command Line Tools (if `xcode-clt` MISSING)

This triggers macOS's own GUI installer and needs Sara to click through it —
hand it to her directly rather than running it in the background:

```
! xcode-select --install
```

Wait for her to confirm the installer finished before continuing.

### 3.2 Root + client dependencies (if `root-deps` / `client-deps` MISSING)

```bash
cd <project-root>
npm run setup
npm run build
```

### 3.3 Electron + electron-builder + native rebuild (if `electron` / `electron-builder` / `better-sqlite3` MISSING)

```bash
cd <project-root>
npm run desktop:install
```

This runs `desktop/`'s own `npm install` plus `electron-builder
install-app-deps`, which rebuilds `better-sqlite3` against Electron's Node
ABI (fetched as a prebuilt binary on a recent Node LTS; falls back to
compiling from source, which needs the Xcode CLT from 3.1). If this step
fails, it prints the exact per-OS fix itself (see `DESKTOP.md`'s "Known
caveats" section) — surface that output to Sara rather than re-deriving it.

## Phase 4 — Verify (smoke test)

Re-run the audit script — every row must be `ok`. Then prove the toolchain
actually works with a real compile (cheaper than a full DMG package, which
is `desktop-build`'s job):

```bash
cd <project-root>/desktop
npm run build
```

This runs `prebuild.js` (fails loudly with setup help if the native binary
is still missing) then `tsc`, producing `desktop/out/main.js`. Confirm that
file exists as the proof. Report plainly what was proven (compiles cleanly)
and what wasn't (a full DMG package — that's `/devops desktop-build`).

## Notes

- Scoped to macOS only — this project's desktop app also ships a Windows
  build, but that has to be built on Windows (see `DESKTOP.md`), which is
  out of scope for this command on Sara's Mac.
- Node LTS 20 or 22 gets a prebuilt `better-sqlite3` binary and skips the
  native compile step entirely; anything else may need the Xcode CLT.
- `npm run desktop:install` is itself idempotent — safe to re-run.
