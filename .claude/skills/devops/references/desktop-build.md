# desktop-build — build a fresh DMG and install/replace the app

Alias: `up`.

Goal: produce a fresh arm64 DMG from the current source and install it into
`/Applications`, so whatever's running on Sara's Mac after this command is
the latest build — "refresh with a new build" and "deploy it to my
desktop" combined into one action.

Depends on `desktop-setup` having run at least once (Electron,
electron-builder, and the native `better-sqlite3` binary all present).

## Phase 1 — Audit (always first, read-only)

Run the shared audit script and show Sara the table:

```bash
zsh <skill-base-dir>/scripts/desktop-check.sh
```

If invoked in status-only mode (bare `/devops`), stop after showing the table.

If `desktop-setup`'s prerequisites are missing (check
`scripts/desktop-setup-check.sh` too if unsure), stop and point Sara at
`/devops desktop-setup` first.

## Phase 2 — Plan

State what will happen, in order:

| Step | What it does |
|---|---|
| Build | `npm run desktop:dmg:arm64` — rebuilds the client, compiles the desktop TypeScript, packages an ad-hoc-signed arm64 DMG into `desktop/release/` (wipes `desktop/release/` first) |
| Install | Mount the new DMG, quit `Claude Code Monitor` if it's currently running, replace `/Applications/Claude Code Monitor.app` with the freshly built one, unmount the DMG |

This is not a network download (all deps are already installed by
`desktop-setup`) but it **does** overwrite whatever's currently in
`/Applications` and quits the app if it's open — that's the "deploy"
half of this command, so it gets a gate:

🟧🟧🟧 HUMAN GATE REQUIRED 🟧🟧🟧

> 🟧🟧🟧 HUMAN GATE REQUIRED 🟧🟧🟧
>
> **Human decision needed:** Build a fresh DMG and replace the app
> currently installed at `/Applications/Claude Code Monitor.app`? Any
> in-progress work in a running instance will be closed. (yes / no)

## Phase 3 — Execute (only after confirmation)

### 3.1 Build the DMG

```bash
cd <project-root>
npm run desktop:dmg:arm64
```

Takes about a minute. This wipes `desktop/release/` first and emits one
DMG titled "Claude Code Monitor (Apple Silicon)".

### 3.2 Install into /Applications

```bash
cd <project-root>
DMG="$(ls -t desktop/release/*-arm64.dmg | head -1)"

# Quit the running app, if any, so the bundle isn't in use while replaced.
osascript -e 'quit app "Claude Code Monitor"' 2>/dev/null || true

MOUNT_DIR="$(hdiutil attach "$DMG" -nobrowse | tail -1 | awk -F'\t' '{print $NF}')"
rm -rf "/Applications/Claude Code Monitor.app"
ditto "$MOUNT_DIR/Claude Code Monitor.app" "/Applications/Claude Code Monitor.app"
hdiutil detach "$MOUNT_DIR" -quiet
```

The DMG is ad-hoc signed, not notarized — this local install path bypasses
the Gatekeeper "Apple could not verify…" prompt that a downloaded DMG would
trigger (no quarantine attribute gets set on a locally built/mounted DMG
copied this way). If Sara ever sees that prompt anyway, `xattr -cr` on the
`.app` clears it.

## Phase 4 — Verify

Re-run the shared audit — `dmg-artifact` and `app-installed` should both be
`ok`, with `app-installed`'s version matching the repo's
`package.json` version (no more `WRONG`).

Then prove it actually launches — the real check, not just "the bundle
exists":

```bash
open -a "Claude Code Monitor"
sleep 2
curl -sf http://localhost:4820/api/health || curl -sf http://localhost:4821/api/health
```

(The app tries port 4820 first, falling back to 4821-4829 — see
`DESKTOP.md`.) Report plainly: DMG built, app installed, version confirmed,
and whether the health check actually responded.

## Notes

- Builds **arm64 only** (Apple Silicon), matching Sara's Mac
  (`uname -m` → `arm64`). If she's ever on an Intel Mac, this command would
  need `desktop:dmg:x64` instead — check `uname -m` in the audit if that
  ever comes up.
- Cheaply re-runnable: re-running `desktop-build` on a healthy environment
  just produces a newer DMG and reinstalls it — no state to reset first.
- Does not touch app data (`~/Library/Application Support/Claude Code
  Monitor/`) or logs — those live outside the bundle and survive a
  reinstall by design (see `DESKTOP.md`).
