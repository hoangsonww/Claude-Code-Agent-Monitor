# Agent Launcher with Reusable Profiles — Design

## Overview

Add a UI-driven launcher to the dashboard that spawns `claude` subprocesses with any combination of CLI flags from the [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference), and lets the user save those configurations as named, editable **Profiles**. Continue any session — live or imported — by typing into a send composer added to the existing **Conversation** tab.

This work extends the orchestrator surface introduced in commit `a6343be` (PWA + mobile orchestrator, gated by `ORCHESTRATOR_ENABLED=1`) — it is not a greenfield feature.

## Problem

The existing orchestrator (`server/lib/spawner.js`, `server/routes/orchestrator.js`, `client/src/hooks/useOrchestrator.ts`, `client/src/pages/MobileChat.tsx`) is a partial slice:

1. **Only 6 of ≈ 50 CLI flags are exposed** (`effort`, `permissionMode`, `maxBudgetUsd`, `model`, `allowedTools`, `appendSystemPrompt`). Everything else is unreachable from the UI.
2. **No persistence.** Each `POST /api/orchestrator/spawn` carries an inline `preset`; nothing is saved or reusable.
3. **No follow-up turn.** The spawner sets `stdio: ["ignore", ...]` (`server/lib/spawner.js:64`) — stdin is closed, so multi-turn back-and-forth is impossible.
4. **No `agent_stream` broadcast.** A `// TODO: parse stream-json and broadcast via WS` (`server/lib/spawner.js:83`) is unimplemented; the UI never sees streamed assistant tokens.
5. **No way to continue an existing session.** Imported sessions are read-only; no UI affordance to type into them.
6. **No cwd discipline.** The spawner accepts whatever `cwd` the caller passes — fine when only code calls it; not fine when a UI form is in front of it.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Interaction mode | Chat-style (line/message-buffered, `--input-format stream-json --output-format stream-json`) — no PTY | Lighter; reuses existing hook-event pipeline for observation; matches the existing `MobileChat.tsx` pattern |
| Send-box scope | Every session — historical sessions auto-resume via `claude --resume <session-id>` | Maximally useful UX; resumed `claude` reuses the same `session_id` so the existing event router routes new events to the same Conversation row |
| Profile storage | SQLite source of truth + JSON export/import | Consistent with the rest of the dashboard; shareable artifacts when the user wants them |
| Working-directory model | Dropdown of dashboard's known cwds (from `~/.claude/projects/`) + "Add custom path" with confirm-and-remember | No setup friction day one; each new path is a deliberate confirmation, not a free-for-all |
| Concurrency cap | Default 5 live agents; configurable via `ORCHESTRATOR_MAX_CONCURRENT` | Bounded blast radius; UI exposes current count |
| Per-profile secrets | Profiles store env-var **names only**; values come from host `process.env` or an opt-in `~/.claude/launcher/secrets.env` (gitignored) | Profiles stay shareable; secrets stay in one well-known place |
| Dangerous-flag UX | Exposed (user accepted the risk) but collapsed under a red ⚠ "Advanced — dangerous" expander | Day-to-day form does not tempt mistakes |
| Profile shape | Strict JSON Schema, derived from CLI flag list | Server validates every write; unknown keys → 400; mutually-exclusive flags rejected at API layer |
| State-dependent flags | NOT in profiles | `--continue`, `--resume`, `--session-id`, `--fork-session` are per-launch toggles set by the launcher itself, not preferences a user saves |
| Subcommands | Out of scope | `claude auth`, `claude install`, `claude project purge`, `claude ultrareview` etc. are operations, not session configs |

## Architecture

### Data flow — new launch

```
LauncherView (form)
  → POST /api/orchestrator/spawn { profileId, configOverride?, prompt, cwd }
    → server validates body against ProfileConfig JSON Schema
    → server validates cwd is in launcher_allowed_cwds
    → server checks concurrency cap
    → spawnAgent() builds argv from ProfileConfig, spawns `claude` with cleanSpawnEnv()
      → child stdout (stream-json) → parseStreamJson() → broadcast WS `agent_stream`
      → spawned `claude` fires hooks → POST /api/hooks/event → existing dashboard ingestion
    → response { id, pid, status, startedAt }
  → client subscribes to WS for agent_stream/agent_status messages
```

### Data flow — continue conversation

```
ConversationView send composer
  → if session has live handle:
      POST /api/orchestrator/agents/:id/message { text }
        → server writes JSON user message to child stdin
        → child stream-json output → WS agent_stream → ConversationView
  → else (historical session):
      POST /api/orchestrator/spawn { resumeSessionId, profileId, prompt: text }
        → spawnAgent adds --resume <id> to argv
        → resumed `claude` reuses session_id, fires hooks against same row
        → ConversationView receives new events via existing path
```

### File map

**New**
- `server/lib/profiles.js` — DB access + validation for `launcher_profiles`, `launcher_allowed_cwds`, `launcher_launches`.
- `server/lib/profile-schema.js` — JSON Schema for `ProfileConfig`; flag → argv mapping table.
- `server/lib/stream-json-parser.js` — newline-delimited JSON reassembly + broadcast helpers.
- `server/routes/profiles.js` — CRUD + import/export.
- `server/routes/cwds.js` — allowlist CRUD.
- `server/migrations/2026-05-05-launcher.sql` — schema migration.
- `client/src/pages/LauncherView.tsx` — the launch form.
- `client/src/features/launcher/ProfileEditor.tsx` — shared editor used by Launcher and Settings.
- `client/src/features/launcher/CommandPreview.tsx` — live argv preview.
- `client/src/features/launcher/SendComposer.tsx` — send-box for ConversationView.
- `client/src/hooks/useProfiles.ts` — CRUD wrappers.
- `client/src/hooks/useCwds.ts` — allowlist wrappers.
- `client/src/lib/profile-types.ts` — shared `ProfileConfig` TypeScript type.
- `docs/launcher.md` — user-facing docs.

**Modified**
- `server/lib/spawner.js` — stdin pipe, full flag mapping, stream-json parsing, WS broadcast, concurrency cap, resume support, env injection, audit-log write to `launcher_launches`.
- `server/routes/orchestrator.js` — extend `POST /spawn` body shape; add `POST /agents/:id/message`; mount profile + cwd routers.
- `server/db.js` — register new tables in init / migration runner.
- `server/index.js` — mount new routes (still gated by `ORCHESTRATOR_ENABLED`).
- `client/src/hooks/useOrchestrator.ts` — add `sendMessage(handleId, text)`; new `SpawnArgs` shape.
- `client/src/components/conversation/ConversationView.tsx` — mount `SendComposer` at the bottom.
- `client/src/pages/MobileChat.tsx` — refactor to thin wrapper over `SendComposer` with no preselected session.
- `client/src/lib/types.ts` — add `agent_input_ack` WSMessage variant.
- `.env.example` — document `ORCHESTRATOR_MAX_CONCURRENT`.
- `README.md`, `ARCHITECTURE.md`, `mcp/README.md` — cross-references.

## Data model

```sql
CREATE TABLE launcher_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  config_json TEXT NOT NULL,
  default_cwd TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE TABLE launcher_allowed_cwds (
  path TEXT PRIMARY KEY,
  source TEXT NOT NULL,                  -- 'imported' | 'manual' | 'session'
  added_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE TABLE launcher_launches (
  id TEXT PRIMARY KEY,                   -- same uuid as orchestrator handle
  profile_id TEXT,
  session_id TEXT,
  cwd TEXT NOT NULL,
  argv_json TEXT NOT NULL,               -- env values redacted
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  exit_code INTEGER,
  status TEXT NOT NULL                   -- 'spawning'|'running'|'completed'|'error'|'killed'
);
```

`ProfileConfig` (TypeScript, also used to derive the JSON Schema):

```ts
type Effort = "low" | "medium" | "high" | "xhigh" | "max";
type PermissionMode = "default" | "acceptEdits" | "plan" | "auto" | "dontAsk" | "bypassPermissions";

interface ProfileConfig {
  // Model & runtime
  model?: string;
  fallbackModel?: string;
  effort?: Effort;
  betas?: string[];

  // Permissions
  permissionMode?: PermissionMode;

  // Tools
  tools?: string[];
  allowedTools?: string[];
  disallowedTools?: string[];

  // System prompt (mutually exclusive: replace vs file; appends are independent)
  systemPrompt?: string;
  systemPromptFile?: string;
  appendSystemPrompt?: string;
  appendSystemPromptFile?: string;

  // Working dirs
  addDir?: string[];

  // MCP
  mcpConfig?: string[];
  strictMcpConfig?: boolean;

  // Plugins
  pluginDir?: string[];

  // Settings
  settings?: string;
  settingSources?: ("user" | "project" | "local")[];

  // Agents
  agent?: string;
  agents?: Record<string, { description: string; prompt: string; tools?: string[] }>;

  // Output / IO
  outputFormat?: "text" | "json" | "stream-json";   // forced to stream-json by launcher; UI displays as locked
  inputFormat?: "text" | "stream-json";             // forced to stream-json by launcher; UI displays as locked
  includeHookEvents?: boolean;
  includePartialMessages?: boolean;
  jsonSchema?: string;

  // Limits
  maxTurns?: number;
  maxBudgetUsd?: number;

  // Logging
  verbose?: boolean;
  debug?: string;

  // Env
  envVarNames?: string[];                            // names only; values resolved at spawn time

  // Channels
  channels?: string[];

  // Misc
  excludeDynamicSystemPromptSections?: boolean;

  // Dangerous (collapsed in UI)
  bare?: boolean;
  dangerouslySkipPermissions?: boolean;
  allowDangerouslySkipPermissions?: boolean;
  dangerouslyLoadDevelopmentChannels?: string[];
}
```

Per-launch toggles (NOT in `ProfileConfig`): `cwd`, `prompt`, `resumeSessionId?`, `forkSession?`, `continue?`, `sessionId?`.

## API surface

All routes live under `/api/orchestrator/...` and 404 when `ORCHESTRATOR_ENABLED !== "1"` (existing gate).

```
POST   /api/orchestrator/profiles                  create
GET    /api/orchestrator/profiles                  list
GET    /api/orchestrator/profiles/:id              read
PUT    /api/orchestrator/profiles/:id              full replace
PATCH  /api/orchestrator/profiles/:id              partial update
DELETE /api/orchestrator/profiles/:id              delete
POST   /api/orchestrator/profiles/:id/duplicate    → 201 with new profile
POST   /api/orchestrator/profiles/import           accept JSON body, validate, insert
GET    /api/orchestrator/profiles/:id/export       application/json download

GET    /api/orchestrator/cwds                      list allowed cwds
POST   /api/orchestrator/cwds                      add (existence-check)
DELETE /api/orchestrator/cwds                      remove

POST   /api/orchestrator/spawn                     extended body
POST   /api/orchestrator/agents/:id/message        write user message to child stdin
DELETE /api/orchestrator/agents/:id                kill (existing)
GET    /api/orchestrator/agents                    list (extend existing)
```

`POST /spawn` body:

```ts
{
  profileId?: string;             // resolve from launcher_profiles
  configOverride?: ProfileConfig; // merged on top of profile
  prompt: string;
  cwd: string;                    // must be in launcher_allowed_cwds
  resumeSessionId?: string;       // must be a known session_id
  forkSession?: boolean;
  continue?: boolean;             // adds --continue
  sessionId?: string;             // adds --session-id
}
```

WebSocket additions: keep `agent_stream` and `agent_status` (already declared in `client/src/lib/types.ts` per commit `a6343be`); add:

```ts
| { type: "agent_input_ack"; sessionId: string; messageId: string; ts: number }
```

## UI

### Launcher (new page `/launcher`)

Sections, top to bottom; first three are always visible, the rest are collapsible:

1. Identity — Profile dropdown ("Ad-hoc" or saved profile) + description.
2. Working directory — dropdown of allowed cwds + "Add new path…".
3. Prompt — multi-line textarea.
4. Model & runtime
5. Permissions
6. Tools (`tools` allowlist, `allowedTools` no-prompt, `disallowedTools` blocklist)
7. System prompt (radio: replace vs append; text vs file; mutually exclusive)
8. Extra working dirs
9. MCP
10. Plugins
11. Settings & sources
12. Agents
13. Output (forced stream-json shown locked; toggles for hook events, partial messages, JSON schema)
14. Limits
15. Logging
16. Env vars (names)
17. ▼ Advanced — dangerous (collapsed by default; red banner)

Footer: **Save as profile** | **Save & launch** | **Launch (don't save)**.
Right side: live `CommandPreview` panel showing the exact argv that would be invoked.

### Send composer (additive to existing Conversation tab)

Sticky bar at the bottom: textarea + Send + Stop. Profile dropdown chooses which profile is used for the resume case (defaults to the session's last-used profile, or the user's default).

### Profile manager (new tab on Settings)

- Left rail: list of profiles + "Default" star + last-used.
- Right pane: the same `ProfileEditor` used by the launcher (with "Save as profile" hidden because the profile already exists).
- Toolbar: Duplicate, Export JSON, Import JSON, Delete.
- Header: "Concurrency: X / N agents running" + link to cwd allowlist.

### Per-session ergonomic

A "Duplicate as profile" button on session rows clones the captured launch config (when known) into a new profile.

## Security & limits

- **Cwd allowlist enforced server-side**: the spawner rejects any cwd not in `launcher_allowed_cwds` even if the request body contains it.
- **Path traversal**: every path field validated with `path.resolve` containment + existence check (matching the pattern in `server/routes/memory.js`).
- **Concurrency cap**: enforced in `spawnAgent`; spawn returns 429 when exceeded with the list of running agents in the body.
- **Dangerous flags**: allowed but require expanding the collapsed section and (on first use per session) typing `enable` in a confirm field.
- **Resume safety**: `resumeSessionId` must be a known `session_id` in the `sessions` table; rejected otherwise.
- **Argv audit**: `launcher_launches.argv_json` records the exact argv used, with env-var values redacted (names retained). Useful for forensics.
- **Secrets**: never logged, never in argv. Env injection only. The `~/.claude/launcher/secrets.env` file (if present) is parsed once per spawn; the dashboard never exposes its contents through any API.
- **Hook handler unchanged**: still always exits 0 (CLAUDE.local.md gotcha #2).
- **Feature gate preserved**: every new route is mounted under the existing `ORCHESTRATOR_ENABLED` gate; default behavior is 404.

## Testing strategy

| Surface | Tests | Verification |
|---|---|---|
| `server/lib/spawner.js` | Build-args matrix (one row per flag); env injection redaction; mutually-exclusive validation; concurrency limit; `parseStreamJson` chunk reassembly; resume support | `npm run test:server` |
| `server/lib/profiles.js` | CRUD round-trip; JSON schema validation; import/export | `npm run test:server` |
| `server/routes/profiles.js` | Profile CRUD HTTP; 404 when feature off; 400 on invalid config | `npm run test:server` |
| `server/routes/cwds.js` | Allowlist CRUD; existence check; spawn-rejects-not-listed | `npm run test:server` |
| `server/routes/orchestrator.js` | Send-message round-trip with stub child; 429 on cap; spawn with profile + override merge | `npm run test:server` |
| `client/src/features/launcher/*` | LauncherView renders all sections; mutually-exclusive system-prompt enforcement; CommandPreview reflects state; SendComposer disables on no-cwd; profile CRUD UI | `npm run test:client` |
| MCP | No changes; verify typecheck still green | `npm run mcp:typecheck && npm run mcp:build` |

Targets: current 459/459 passes today → ≥ 520 after this work.

## Migration & rollout

- Single SQLite migration: `server/migrations/2026-05-05-launcher.sql`. Idempotent (`CREATE TABLE IF NOT EXISTS`).
- Backwards compatible: the existing 6-field `preset` shape is a strict subset of `ProfileConfig`; calls to `POST /api/orchestrator/spawn` with the legacy body shape continue to work (mapped through a tiny shim).
- Gate unchanged: `ORCHESTRATOR_ENABLED=1` still required. Default behavior of the dashboard (observe-only) is preserved.

## Phases

1. **Spawner expansion** — full flag mapping, stdin pipe, stream-json parsing + WS broadcast, concurrency cap. Backwards-compatible. (`server/lib/spawner.js`, `server/lib/stream-json-parser.js`, `server/lib/profile-schema.js` (just the mapping table at this point), tests).
2. **Profile + cwd persistence** — DB migration, `server/lib/profiles.js`, `server/routes/profiles.js`, `server/routes/cwds.js`, JSON export/import. Verifiable via `curl`. No UI yet.
3. **Spawn integration** — extend `POST /spawn` to accept `profileId`/`configOverride`/`resumeSessionId`/`forkSession`; add `POST /agents/:id/message`. Includes the legacy-shape shim.
4. **Launcher form (page)** — `LauncherView.tsx`, `ProfileEditor.tsx`, `CommandPreview.tsx`, hooks. Save as profile / save & launch / launch.
5. **Profile manager (Settings tab)** — list, edit, duplicate, import/export.
6. **Conversation send composer** — `SendComposer.tsx` mounted in the existing Conversation view; `MobileChat.tsx` refactored as thin wrapper.
7. **Polish & docs** — `docs/launcher.md`, `.env.example`, README/ARCHITECTURE/mcp cross-refs.

Each phase is independently shippable; phases 4–6 can run in parallel after phases 1–3 land, because their files do not overlap.

## Out of scope

- TTY/PTY mode (heavy `node-pty` + `xterm.js`; not required by the chat-style decision).
- Multi-user authn/authz on the dashboard (same trust model as today).
- Live filesystem watching of profile files (storage is SQLite-first; JSON files are export-only artifacts).
- Subcommands (`claude auth`, `claude install`, `claude project purge`, `claude ultrareview`).
- Cross-machine profile sync.
- Profile templating / inheritance.

## References

- `code.claude.com/docs/en/cli-reference` — flag inventory.
- `docs/orchestration-research/10-pwa-on-dashboard-design.md` — Phase 2 listed "preset shape" as an open decision; this spec resolves it as `ProfileConfig`.
- `docs/orchestration-research/08-claudeclaw-deep-dive.md` — env-stripping pattern preserved in `server/lib/spawner.js:cleanSpawnEnv`.
- Commit `a6343be` — orchestrator MVP that this work extends.
