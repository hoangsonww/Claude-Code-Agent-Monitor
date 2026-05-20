# Claude Code Monitor — macOS Desktop App

The dashboard ships with an optional **native macOS application** that wraps the existing server + client into a single `.app` you install once and forget. Everything you see in the browser at `localhost:4820` lives inside this window, with macOS-native lifecycle on top: menu-bar icon, application menu, Login Items integration, and a single quit button that cleans up the server.

## Why this exists in addition to the PWA

The PWA (added in #144) makes the dashboard installable in Chromium-based browsers, which is great for users who already keep the server running. The desktop app solves the orthogonal problem: **starting and keeping the server running** without a terminal window. Concretely:

| Capability | PWA | Desktop App |
|---|---|---|
| Installs to dock / Applications | ✅ | ✅ |
| Manages the Express server | ❌ — user must `npm start` separately | ✅ — embedded in-process |
| Auto-starts at login (macOS) | ❌ | ✅ via native Login Items |
| Menu-bar (tray) icon for always-on status | ❌ | ✅ |
| Native application menu (⌘ shortcuts, etc.) | ❌ | ✅ |
| Survives browser restart | ⚠️ depends on browser | ✅ |

The two coexist — install whichever fits your workflow.

## Quick install

**Option A — download a pre-built DMG** (recommended):

1. Open [**Releases → latest**](https://github.com/hoangsonww/Claude-Code-Agent-Monitor/releases/latest) and grab `ClaudeCodeMonitor-<version>-universal.dmg` from the assets. Every `master` commit that bumps the version in `package.json` cuts a new `vX.Y.Z` release automatically (CI publishes it), so this link always lands on the current build — no GitHub sign-in required.
2. Want a **per-commit build** instead of waiting for a release? Every green CI run uploads a `ClaudeCodeMonitor-dmg` workflow artifact (sign-in required, 14-day retention):
   ```bash
   gh run download <run-id> -R hoangsonww/Claude-Code-Agent-Monitor -n ClaudeCodeMonitor-dmg
   ```
3. Double-click the DMG → drag `Claude Code Monitor.app` into your `Applications` folder.
4. Open it. macOS may show a Gatekeeper warning the first time — see [Gatekeeper](#gatekeeper-first-launch) below.

**Option B — build locally:**

```bash
# In the project root, after `git clone`:
npm run setup                # installs root + client + vscode-extension deps
npm run build                # builds the React client
npm run desktop:install      # installs Electron + electron-builder

# Build the DMG — pick one:
npm run desktop:dmg:arm64    # Apple Silicon only — FAST (~1 min); use this for your own Mac
npm run desktop:dmg:x64      # Intel only — FAST
npm run desktop:dmg          # universal (x64 + arm64) — SLOW; for distributing one DMG to everyone

# Open the DMG you just built. Each desktop:dmg* build wipes release/ first
# and emits exactly one DMG, so match the suffix to the build above.
open desktop/release/ClaudeCodeMonitor-*-arm64.dmg   # …-x64.dmg / …-universal.dmg for the others
```

> **The universal `desktop:dmg` build is intentionally slow.** It builds the app
> twice (once per architecture), merges both slices with `@electron/universal`,
> and code-signs every binary — gigabytes of disk I/O, and the silent
> `packaging arch=universal` step can run for several minutes. For running on
> **your own Mac**, use the arch-specific command (`desktop:dmg:arm64` /
> `desktop:dmg:x64`) — it finishes in about a minute. CI builds the universal
> DMG for you and uploads it as the `ClaudeCodeMonitor-dmg` artifact, so you
> rarely need to build it locally.

## What happens when you launch the app

1. The Electron main process picks a free port — preferring **4820**, falling back to 4821–4829, then a random high port if all those are taken.
2. If something already answers `/api/health` on port 4820 (e.g. you ran `npm start` in a terminal), the app **adopts that server** and skips starting a second one. No double-binding, no SQLite contention.
3. Otherwise it `require()`s `server/index.js` directly in-process — same Node runtime as the main process, same memory. Boot is typically under two seconds.
4. On startup the server records its **live port** to `~/.claude/.agent-dashboard.json`. The Claude Code hook handler reads that file, so events still reach the dashboard when the app bound a fallback port instead of 4820.
5. The dashboard window opens (unless macOS launched the app at login, in which case it stays tray-only).
6. A menu-bar (tray) icon appears. One click opens a dropdown with a **live status snapshot** (server port, active sessions, working agents, events today — all clickable to jump into the dashboard) plus *Open Dashboard*, *Open in Browser*, *Restart Server*, *Show Logs*, *Open at Login* (toggle), and *Quit*.

## Lifecycle semantics

- **Closing the window hides it.** The server keeps running, the tray icon stays, and the **dock icon stays too** — clicking it re-opens the window. Three independent signals that the app is still alive.
- **Quitting** (⌘Q, *Quit* in the application menu, or *Quit* in the tray menu) pops a confirmation modal — *"Quit Claude Code Monitor? Press ⌘Q again to skip this prompt and quit immediately."* Press **Quit** in the dialog, or **press ⌘Q a second time** to bypass the prompt. Either way the SQLite handle is checkpointed cleanly before the process exits.
- **Menu-bar tray** — a single click (left or right) opens the dropdown. The dropdown shows a **live status snapshot** pulled straight from the embedded SQLite handle each time it opens: server port, active sessions, working agents, and events today. Snapshot rows are clickable — they open the dashboard.
- **Login Items toggle:** flip *Open at Login* in the tray menu (or the app menu). It registers via macOS's `SMAppService` API — you'll see the entry under  → *System Settings → General → Login Items*.
- **Single-instance:** double-launching just focuses the existing window. No second server, no port collision.
- **Logs** live at `~/Library/Logs/Claude Code Monitor/desktop.log` (use *Show Logs* in the menu to open the folder).
- **Your data** (the SQLite database and VAPID keys) lives in `~/Library/Application Support/Claude Code Monitor/data/` — outside the app bundle, so it **survives app reinstalls and updates**.
- **The `claude` CLI** is resolved using your login-shell `PATH`, recovered at startup — so "Run Claude" works even though a Finder/Dock-launched app would otherwise only inherit a minimal `PATH`.
- **Notifications** (including the in-dashboard *Send test notification* button) are delivered as **native macOS notifications** when running inside the `.app` — the embedded server calls Electron's `Notification` API directly. Web Push doesn't work reliably inside Electron (Chromium-in-Electron ships without Firebase Cloud Messaging credentials, so `pushManager.subscribe` returns endpoints nothing can deliver to), and this path bypasses it entirely. The web dashboard at `npm start` continues to use Web Push as before.
- **Coexists with the web dashboard.** You can run the desktop app and `npm run dev` (or `npm start`) at the same time. Each server writes its `{port, pid, startedAt}` entry to a shared discovery file at `~/.claude/.agent-dashboard.json`, and the Claude Code hook handler **fan-outs each event to every live entry**. Both UIs stay real-time; the two SQLite databases (`~/Library/Application Support/Claude Code Monitor/data/dashboard.db` and the repo's `data/dashboard.db`) each record the same events independently.

## File layout (for contributors)

```
desktop/
├── package.json                # Electron + electron-builder
├── tsconfig.json
├── electron-builder.yml        # DMG config; signing/notarization hooks
├── assets/                     # icon.svg + generated icon.icns + tray PNGs
├── src/
│   ├── main.ts                 # main process entry, lifecycle
│   ├── server-host.ts          # in-process Express boot, port discovery, adopt
│   ├── window.ts               # BrowserWindow + persisted state
│   ├── tray.ts                 # menu-bar icon + context menu
│   ├── menu.ts                 # native application menu
│   ├── login-item.ts           # macOS Login Items toggle
│   ├── shell-path.ts           # recover the user's shell PATH (find `claude`)
│   ├── preload.ts              # (empty — kept for future renderer bridges)
│   ├── logger.ts               # file logger
│   └── constants.ts
├── scripts/
│   ├── prebuild.js             # ensures root + client are built before tsc
│   ├── build-icons.sh          # SVG → PNG/ICNS via qlmanage/sips/iconutil
│   └── notarize.js             # electron-builder afterSign hook (opt-in)
└── tests/
    └── smoke.test.mjs          # spawn-and-probe /api/health
```

**Changes outside `desktop/` are deliberately minimal:**

- `server/index.js` — a behavior-preserving refactor: the post-listen bootstrap (one-time legacy-session import, update scheduler, Claude Code config watcher, orphaned-run reconciliation) was extracted into an exported `startBackgroundServices()` so the embedded server runs exactly what `node server/index.js` runs. The standalone server path is functionally unchanged. (The legacy-session import previously sat in the standalone-only `require.main` block, so the desktop dashboard started empty — moving it into `startBackgroundServices()` fixes that.) It also now publishes its live port via `server/lib/server-info.js` on startup.
- `server/lib/server-info.js` *(new)* — writes/reads the `~/.claude/.agent-dashboard.json` port discovery file.
- `scripts/hook-handler.js` — resolves the dashboard port from the discovery file (falling back to `CLAUDE_DASHBOARD_PORT`, then 4820), so hook events reach the server even when it bound a fallback port.

`client/`, `mcp/`, and `vscode-extension/` are untouched. The Electron main process is otherwise just a host for the same code.

## Gatekeeper (first launch)

The DMG is **ad-hoc signed** by default — that's all the project can offer without a paid Apple Developer ID. macOS will warn the first time you open it: *"Apple could not verify…"*.

Two ways past it:

```bash
# Easiest: strip the quarantine attribute from the DMG before opening.
xattr -cr ~/Downloads/ClaudeCodeMonitor-*.dmg
```

Or open  → *System Settings → Privacy & Security*, scroll to the blocked DMG, click *Open Anyway*.

### Notarization (for the maintainer)

When you're ready to make this go away for everyone, add these three repository secrets:

| Secret | Where it comes from |
|---|---|
| `APPLE_ID` | Your Apple ID email |
| `APPLE_TEAM_ID` | Your Apple Developer team ID |
| `APPLE_APP_SPECIFIC_PASSWORD` | An app-specific password created at appleid.apple.com |

Optionally, also `CSC_LINK` (base64-encoded `.p12`) and `CSC_KEY_PASSWORD` to provide an explicit Developer ID certificate from outside the runner keychain. The CI workflow picks them up automatically — no code change required. See [`desktop/scripts/notarize.js`](desktop/scripts/notarize.js) for the hook.

> Local builds are **always ad-hoc signed**: the `package` script sets `CSC_IDENTITY_AUTO_DISCOVERY=false`, so a code-signing certificate already in your macOS keychain is never auto-discovered (an Apple Development cert would otherwise be picked up and fail distribution-type signing). Real signing activates only through the explicit `CSC_LINK` certificate above — that path is unaffected by the flag.

## Development workflow

```bash
# Hot-iterate on the main process (rebuilds tsc on save would be next steps;
# v1 ships without watch mode — just re-run desktop:dev after changes):
npm run desktop:dev

# Smoke test (also runs in CI on macOS):
npm run desktop:test

# Single-architecture DMG — fast (~1 min):
npm run desktop:dmg:arm64    # or desktop:dmg:x64 for Intel

# Universal DMG — slow (builds + signs both architectures, then merges):
npm run desktop:dmg
```

> After `npm run clean` in `desktop/`, you must `npm run build` again before
> packaging — `clean` removes `out/`, and `electron-builder` only packages, it
> does not compile. The `desktop:dmg*` scripts chain the build for you; a bare
> `electron-builder` call does not, and fails with
> _"entry file out/main.js does not exist"_.

The smoke test does not exercise the BrowserWindow (no display on headless CI). It spawns Electron, waits for the embedded server to answer `/api/health`, then shuts down. Anything that depends on the renderer is part of the manual QA checklist on the PR.

## Known caveats

- **Bundle size** ≈ 80 MB DMG, ≈ 250 MB on disk. The standard Electron tax. Tauri would cut this dramatically but at the cost of a sidecar-process model and a Rust toolchain dependency — fair to revisit in a follow-up PR if bundle size becomes a real complaint.
- **Native modules**: `better-sqlite3` is rebuilt against Electron's Node version automatically via `electron-builder install-app-deps` in the desktop workspace's `postinstall`. If that fails for any reason, the server falls back to `node:sqlite` (per #37), so the app still boots.
- **Universal binary**: `npm run desktop:dmg` produces a DMG containing both x64 and arm64 slices, which is slow to build. `npm run desktop:dmg:arm64` and `npm run desktop:dmg:x64` build a single-architecture DMG instead — much faster, and roughly half the size.
- **Auto-update**: not wired in v1. The current update path is *re-download the latest DMG*. `electron-updater` + GitHub Releases is the natural follow-up.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Apple could not verify…" on first launch | Unnotarized DMG | `xattr -cr ~/Downloads/ClaudeCodeMonitor-*.dmg` |
| macOS prompts to install Rosetta when opening the app | You installed the **x64** build on an Apple Silicon Mac | Check your arch with `uname -m` (`arm64` → Apple Silicon, build with `desktop:dmg:arm64`). Each `desktop:dmg*` build now wipes `release/` and emits a single DMG whose mounted-volume title states the architecture — e.g. *Claude Code Monitor (Apple Silicon)* — so there is no ambiguous second window to drag from. If stale DMGs from an older build linger, clear them with `rm -rf desktop/release` and rebuild |
| Window shows but content is blank | Server didn't boot — check `~/Library/Logs/Claude Code Monitor/desktop.log` | Restart from tray → *Restart Server* |
| Tray icon missing | The OS hides tray icons when the menu bar is full | Move other menu-bar items aside, or look in the overflow chevron |
| App didn't auto-start at login | Login Items entry got revoked by macOS | Toggle *Open at Login* off and on again from the tray menu |
| Port 4820 already in use, app refuses to start | Something other than the dashboard is on 4820 and it doesn't answer `/api/health` | The app will pick a fallback (4821–4829, then a random high port) — check the tray menu's port indicator |
| Dashboard stays empty — 0 sessions, 0 agents, no real-time updates | The app bound a fallback port (4820 was taken), and the Claude Code hooks were posting events to the wrong port | Fixed — the server publishes its live port to `~/.claude/.agent-dashboard.json` and the hook handler reads it. After upgrading from a pre-fix build, **start a new Claude Code session** so the updated hooks take effect |
| `desktop:dmg` seems stuck at `packaging arch=universal` | Not stuck — the universal merge is genuinely slow | Wait a few minutes, or build a single architecture with `desktop:dmg:arm64` / `desktop:dmg:x64` |
| Build fails: `entry file out/main.js does not exist` | `electron-builder` was run without compiling TypeScript first | Build via `npm run desktop:dmg*` (chains the build); don't invoke `electron-builder` bare |
| Signing fails with `Application … could not be found` | A code-signing certificate in your keychain was auto-discovered | Fixed — the `package` script sets `CSC_IDENTITY_AUTO_DISCOVERY=false`; build via `npm run desktop:dmg*` |
| "Run Claude" reports the `claude` CLI isn't on your PATH | A Finder/Dock-launched app inherits launchd's minimal PATH, not your shell PATH | Fixed — the app recovers your login-shell PATH at startup. If it persists, ensure `claude` is a real executable (not a shell alias/function) and on your shell PATH |
| Imported history / sessions vanished after updating the app | Older builds stored the database inside the (replaceable) app bundle | Fixed — data now lives in `~/Library/Application Support/Claude Code Monitor/data/` and survives reinstalls. After upgrading from a pre-fix build, re-run **Import History → Rescan** once |
| Signing fails: `Application … could not be found` after retries | A keychain code-signing certificate was auto-discovered | Fixed — the `package` script sets `CSC_IDENTITY_AUTO_DISCOVERY=false`; build via `npm run desktop:dmg*` |
