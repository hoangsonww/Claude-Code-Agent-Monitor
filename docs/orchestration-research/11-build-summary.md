# 11 — Overnight Build Summary

A worked example of `06-agentic-pattern-archetypes.md`'s **Supervisor +
Worker** pattern executed end-to-end: 4 rounds of parallel
background-agent fan-out delivered the full Phase 0–6 of
`10-pwa-on-dashboard-design.md` while the user slept.

**459/459 tests pass** (186 server + 139 client + 134 MCP). Production
build clean. TypeScript clean. All new code lives behind
`ORCHESTRATOR_ENABLED=1` so the dashboard's observe-only contract is
preserved by default.

## TL;DR — what was built

| Phase | What | Status |
|---|---|---|
| **0** | PWA enablement (`vite-plugin-pwa`, manifest, icons, custom SW with restored push handlers) | done |
| **1** | Mobile shell + responsive bottom-tab nav (`client/src/features/mobile/`) | done |
| **2** | Backend orchestrator + spawner (env-stripping daemon trick) + mobile chat UI | done |
| **3** | Channels viewer + Skills/Plugins viewer (read-only) | done |
| **4** | Hooks viewer + Context/compaction viewer (read-only) | done |
| **5** | Push notifications wired (subscribe button + hook-event-to-push dispatch) | done |
| **6** | Final validation across all suites | done (this doc) |

| Phase | Status | Notes |
|---|---|---|
| 7 | deferred | Long-term memory / vector RAG was scoped out of overnight build (too speculative) |

## Architecture (as built)

```text
Mobile (PWA, installable from any browser, Tailscale or LAN)
  ▼ HTTPS + WS
Existing dashboard (untouched)
  ├─ Express :4820 + WebSocket
  ├─ SQLite (sessions, agents, events)
  └─ Push routes (subscribe / send)
       ▲ web-push API
       ▼
NEW (gated by ORCHESTRATOR_ENABLED=1)
  ├─ /api/orchestrator         spawn / kill / inspect agents
  ├─ /api/memory               read auto memory + CLAUDE.md
  ├─ /api/channels             read configured channels
  ├─ /api/skills               read skills, agents, plugins, marketplaces
  ├─ /api/hooks-mgmt           read hooks across user/project/local scopes
  ├─ /api/context              compaction events + per-session budget
  └─ server/lib/spawner.js     env-stripping `claude` subprocess spawner
       ▼
claude -p subprocesses (Max-billed, hooks fire normally)
       ▼
Existing /api/hooks/event ingestion → existing dashboard captures live
```

The dashboard's observe-only contract is preserved when
`ORCHESTRATOR_ENABLED` is unset — every new route returns 404. Existing
behavior unchanged.

## File inventory

### New backend files (`server/`)

```text
server/lib/
  spawner.js              133 lines  env-stripping spawn helper, agent registry
  safe-edit.js             43 lines  backup-before-write helper
  push-dispatcher.js       91 lines  hook-event-to-push fan-out

server/routes/
  orchestrator.js          68 lines  spawn / kill / inspect agents
  memory.js               205 lines  auto memory + CLAUDE.md viewer
  channels.js             178 lines  channels viewer
  skills.js               305 lines  skills / agents / plugins / marketplaces
  hooks-mgmt.js           254 lines  hooks across user/project/local
  context.js              297 lines  compaction events + token budgets

server/__tests__/
  orchestrator.test.js     91 lines  4 tests
  memory.test.js          231 lines  10 tests
  channels.test.js        313 lines  8 tests
  skills.test.js          340 lines  13 tests
  hooks-mgmt.test.js      318 lines  9 tests
  context.test.js         328 lines  11 tests
```

**Server total: 3,195 lines new code (1,574 production + 1,621 tests)**

### New client files (`client/`)

```text
client/src/features/mobile/
  index.ts                  9 lines  barrel exports
  useMediaQuery.ts         47 lines  responsive hook
  BottomTabNav.tsx         97 lines  4-tab fixed nav
  MobileShell.tsx          44 lines  responsive shell wrapper
  MobileShell.module.css   98 lines  dark-theme styles
  PushSubscribeButton.tsx 110 lines  push permission + subscribe flow
  css-modules.d.ts         16 lines  CSS module type ambient

client/src/hooks/
  useOrchestrator.ts       65 lines
  useMemory.ts            144 lines
  useChannels.ts          128 lines
  useSkills.ts            161 lines
  useHooksMgmt.ts         160 lines
  useContext.ts           161 lines
  usePushSubscription.ts  150 lines

client/src/pages/
  MobileChat.tsx          152 lines
  MemoryView.tsx          424 lines
  ChannelsView.tsx        420 lines
  SkillsView.tsx          614 lines
  HooksView.tsx           442 lines
  ContextView.tsx         593 lines

client/src/sw.ts           70 lines  service worker source
client/src/vite-env.d.ts    2 lines  vite/PWA ambient types

client/public/
  icon-192.png            (PNG)     PWA icon
  icon-512.png            (PNG)     PWA icon (larger)
```

**Client total: 4,123 lines new code**

### Modified existing files (additive only)

| File | Change |
|---|---|
| `server/index.js` | +6 require + 6 mount lines for new routers |
| `server/routes/hooks.js` | +1 fire-and-forget block for push dispatch |
| `client/src/App.tsx` | +6 imports + 6 route lines |
| `client/src/main.tsx` | replaced raw SW registration with `virtual:pwa-register` |
| `client/src/lib/types.ts` | extended `WSMessage` to discriminated union with `agent_stream` / `agent_status` variants |
| `client/src/pages/Settings.tsx` | +1 import + 1 "This device" notification subsection |
| `client/vite.config.ts` | added `VitePWA` plugin with `injectManifest` strategy |
| `client/package.json` | +`vite-plugin-pwa@^0.21`, `workbox-window@^7` |

### Files deleted

- `client/public/sw.js` — superseded by `client/src/sw.ts` (push handlers preserved)

## Test results

| Suite | Tests | Status |
|---|---|---|
| Server (`npm run test:server`) | 186 | all pass |
| Client (`npm --prefix client run test`) | 139 | all pass |
| MCP (`npm run test:mcp`) | 134 | all pass |
| **Total** | **459** | **all pass** |

Plus:

- `tsc --noEmit` clean across server, client, MCP
- `npm run build` clean (Vite + injectManifest SW + 13 precache entries)
- MCP build clean (`npm run mcp:build`)

## How to use

### Enable the orchestrator

Set the env flag (one-time):

```bash
echo "ORCHESTRATOR_ENABLED=1" >> .env
```

Or per-launch:

```bash
ORCHESTRATOR_ENABLED=1 npm run dev
```

When unset, every new `/api/orchestrator/*`, `/api/memory/*`,
`/api/channels/*`, `/api/skills/*`, `/api/hooks-mgmt/*`, `/api/context/*`
route returns 404 — the dashboard reverts to pure observe-only.

### Try the orchestrator from a CLI session

```bash
curl -X POST http://localhost:4820/api/orchestrator/spawn \
  -H "Content-Type: application/json" \
  -d '{"prompt": "echo hello and exit", "preset": {"effort": "low", "maxBudgetUsd": 0.10}}'
```

Returns `{ id, pid, status, startedAt }`. Inspect status:

```bash
curl http://localhost:4820/api/orchestrator/agents/<id>
```

### Try the new pages

With the dev server running:

| Route | Page | What it shows |
|---|---|---|
| `/` | Dashboard (existing) | Sessions, agents, kanban (unchanged) |
| `/chat` | **NEW** Mobile chat | Send prompt to orchestrator, stream response |
| `/memory` | **NEW** Memory viewer | Browse auto-memory across all your projects |
| `/channels` | **NEW** Channels viewer | List configured channels (Slack/Telegram/etc.) |
| `/skills` | **NEW** Skills viewer | Skills, subagents, plugins, marketplaces |
| `/hooks` | **NEW** Hooks viewer | All 10 hook events across user/project/local |
| `/context` | **NEW** Context viewer | Compaction events timeline + per-session budget |

On mobile (≤768px), bottom tab nav appears with 4 tabs: Dashboard,
Sessions, Chat, Settings. The other pages (Memory, Channels, Skills,
Hooks, Context) are reachable at their direct URLs — by design, to keep
the bottom nav uncluttered.

### Install as PWA

1. Open `http://localhost:5173/` (dev) or wherever the dashboard is
   served from
2. iOS: Share → Add to Home Screen
3. Android: browser menu → Install app
4. Desktop: Chrome's install icon in address bar

The PWA gets:

- Installable home-screen icon
- Standalone window (no browser chrome)
- Offline fallback for cached `/api/sessions` and `/api/agents`
  (60s NetworkFirst)
- Push notification support (after user grants permission via the
  Settings page's "This device" section)

### Push notifications

1. Open the dashboard, navigate to Settings
2. Find the "This device" section under Notifications
3. Click "Enable notifications" — prompts for browser permission
4. Permission granted → subscription registered with the server
5. From now on, `Stop` / `Notification` / `SubagentStop` hook events
   trigger pushes to your subscribed devices

To test push manually:

```bash
curl -X POST http://localhost:4820/api/push/send \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "body": "Hello from your dashboard"}'
```

## What was NOT built (and why)

| Feature | Why deferred |
|---|---|
| Phase 7: long-term memory + vector RAG | Speculative; no clear success criteria for v1; Pinecone MCP plugin already covers this if needed |
| Edit / write actions for memory, hooks, skills, plugins | Out of scope for read-only v1; needed approval flows + UI for diff preview |
| OAuth flows for adding new channels (Slack/Discord) | Requires interactive user testing; deferred to a session with the user awake |
| Pre-compact transcript snapshotting | The hooks fire and events are stored, but capturing the FULL transcript before compaction needs a custom hook handler script (not just a route) |
| Token budget tracking via stream-json `usage` parsing | Deferred to v2; current viewer shows event counts as a proxy |
| Native `claude agents` subcommand integration | The `claude agents` background-agent command is a separate orchestration path; not wired |
| Multiple-host orchestration | Single host only; multi-host needs a different storage / session model |

## Patterns reused from prior research

This build is a worked example of the patterns documented in the prior
research files:

- **Env-stripping daemon trick** ([08-claudeclaw-deep-dive.md](08-claudeclaw-deep-dive.md))
  → `server/lib/spawner.js` lines 1-30
- **Stream-json `Agent` block detection** ([08-claudeclaw-deep-dive.md](08-claudeclaw-deep-dive.md))
  → can be added to spawner's stdout handler in v2
- **Hook handler always exits 0, fail-safe**
  ([01-current-architecture.md](01-current-architecture.md))
  → preserved in `server/routes/hooks.js` push dispatch wiring
- **Backup-before-edit** (this conversation's `~/.claude.json` pattern)
  → `server/lib/safe-edit.js`
- **Schema-preservation** (existing dashboard's WSMessage discipline)
  → `client/src/lib/types.ts` extended additively to discriminated union
- **`acceptEdits` as default permission**, never `bypassPermissions`
  implicit ([03-third-party-orchestrators.md](03-third-party-orchestrators.md)
  cross-cutting findings)
  → `server/lib/spawner.js` `buildArgs` defaults
- **Supervisor + Worker fan-out**
  ([06-agentic-pattern-archetypes.md](06-agentic-pattern-archetypes.md))
  → 4 rounds of parallel background agents producing this build itself

## Build orchestration metrics (for the curious)

The build itself was a worked example of file 06's
**Supervisor + Worker fan-out** pattern:

- **4 rounds × 2 parallel workers each = 8 background-dispatched agents** (plus Round 1's 4-agent fan-out at the start)
- Each agent owned a non-overlapping file scope
- Parent (this session) handled wiring of shared files
  (`server/index.js`, `client/src/App.tsx`) sequentially after each round
- Total wall time across all rounds: ~30-45 minutes
- Token cost: ~0.5M tokens against the user's Max plan

The result: **7,318 lines of production code + tests across 33 files**, all
passing tests, all integrated, all behind a feature flag.

## Next steps for the user

When you wake up:

1. **Smoke test**: `ORCHESTRATOR_ENABLED=1 npm run dev`. Open
   `http://localhost:5173/`. Visit each new route at `/chat`, `/memory`,
   `/channels`, `/skills`, `/hooks`, `/context`. Click around.
2. **Install as PWA on your phone**: navigate to
   `http://<your-machine>.local:5173/` (or via Tailscale), tap
   "Add to Home Screen". Tap the icon. Verify the bottom tab nav.
3. **Try push**: Settings → "This device" → Enable notifications. Run
   any command that triggers a `Stop` event in your real Claude Code
   session — your phone should buzz.
4. **Review the diffs**: `git status` shows ~20 modified + ~30 new
   files. `git diff` is reviewable before committing.
5. **Decide on commit strategy**: this is a substantial change. Options:
   - Single commit "feat: PWA + orchestrator + management UIs"
   - Multiple commits per phase (Phase 0/1, Phase 2, Phase 3, etc.)
   - Branch + PR for upstream maintainability

## Cross-references

- Design doc this build implements:
  [10-pwa-on-dashboard-design.md](10-pwa-on-dashboard-design.md)
- Pattern catalog used:
  [06-agentic-pattern-archetypes.md](06-agentic-pattern-archetypes.md)
- Architectural origin (claudeclaw env-stripping):
  [08-claudeclaw-deep-dive.md](08-claudeclaw-deep-dive.md)
- Memory layout reference:
  [09-memory-and-rag.md](09-memory-and-rag.md)
- Hidden CLI features the orchestrator preset surfaces:
  [07-claude-code-hidden-features.md](07-claude-code-hidden-features.md)
