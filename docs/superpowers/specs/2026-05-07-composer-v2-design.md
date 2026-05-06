# Composer V2 — Design

## Overview

Replace the minimal `SendComposer` component (committed in `b3a647e`) with a Claude-Desktop-class **Composer**: model picker, permission-mode picker, slash-command autocomplete, native file picker (paperclip), photo picker (mobile-friendly with `capture` attribute), drag-and-drop upload, and the existing text input + Send + Stop. Mid-session model/mode swaps tear down the old `claude` child and respawn it with the new flags + `--resume <session-id>`, replaying any unsent text. Uploads land in `<cwd>/.launcher-uploads/<uuid>/<filename>` with auto-`.gitignore`. Slash menu pulls from built-in commands + user skills + plugins + per-cwd `.claude/commands/`.

This work supersedes `SendComposer.tsx` and lands on the same `worktree-feat-agent-launcher` branch as PR #140.

## Problem

The current `SendComposer` (49 lines) gives the user a profile dropdown, a textarea, and Send/Stop. Compared to Claude Desktop or the Claude Code TUI, what's missing:

1. **No model picker** — model is fixed by the active profile or by what `claude` was spawned with. To try a different model on the same conversation, the user has to edit the profile first, then resume — multiple steps and irreversible if they want to compare.
2. **No permission-mode picker** — same issue.
3. **No slash-command discovery** — user must know which commands exist and type them blind. Skills, plugins, and project-local commands are invisible.
4. **No file upload at all** — to give the agent context from a file, the user must already have it on the file system in the cwd and tell the agent the path. From a phone this is essentially impossible.
5. **No drag-and-drop**, no photo picker, no inline error UI for upload failures.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Live agents and model/mode pickers | Show pickers always; picking a different value teardown + respawn with new flag + `--resume` + replay unsent text | Mid-session swap matches Claude Desktop's mental model. Respawn reuses `session_id` so hook ingestion continues to flow into the same Conversation row. User accepts that budget counter resets on respawn. |
| Slash command sources | Built-in + user skills + user plugins + per-cwd `.claude/commands/` | Reuses existing `useSkills` hook for the first three. Per-cwd walk happens once per Conversation tab open; cached. |
| Slash command execution | Picker inserts literal text into input (e.g., `/agents`). On send, the binary intercepts as a built-in or routes via SDK protocol. Picker is *discovery*, not *execution*. | We can't reimplement the TUI's command dispatcher. Insertion + binary's own handling is the honest contract. |
| Upload location | `<cwd>/.launcher-uploads/<uuid>/<filename>` | No respawn needed (cwd is already on argv). Agent uses Read tool just like any other file. Auto-`.gitignore` on first use mitigates pollution. |
| Image upload | Same path-based flow as text. Claude Code's Read tool is image-aware (returns vision content) | One mental model for all file types. Avoids stream-json content-array embedding. |
| File-picker affordances | Two icons in the toolbar: paperclip (any file) + camera/photos (`accept="image/*" capture="environment"` to bias to photos on mobile). Plus drag-and-drop on the textarea | Native iOS/Android file pickers. Desktop drag-drop. |
| Composer file structure | Composed sub-components matching ProfileEditor pattern from T17 | Familiar to anyone who reviewed the launcher PR. Each file fits in one editor window. |
| State ownership | Lifted to `useComposerState` hook; sub-components are mostly dumb | Sub-components testable in isolation; orchestrator coordinates via one hook |
| Backwards compat | `SendComposer.tsx` is replaced (not aliased) — its two callers (`ConversationView`, `MobileChat`) are updated to use the new `Composer` | Clean diff; the old component had no semantics worth preserving |

## Architecture

### Component hierarchy

```text
Composer.tsx                            (orchestrator — ~90 lines)
├── useComposerState(props)             (single state hook)
├── ComposerToolbar.tsx
│   ├── ModelPicker.tsx                 (dropdown + free-text "Custom…")
│   ├── ModePicker.tsx                  (dropdown over PERMISSION_MODES)
│   ├── ProfilePicker.tsx               (dropdown over saved profiles)
│   ├── UploadButtons.tsx               (paperclip + camera, two <input type=file/>)
│   └── (right-aligned) status pill
├── AttachmentBar.tsx                   (chips: name | size | × per attachment)
├── ComposerTextarea.tsx
│   ├── auto-resize, max 8 rows
│   ├── drag-and-drop handler (calls useUploads.add)
│   ├── paste handler (image/file paste)
│   └── '/' at start-of-token opens SlashMenu
├── SlashMenu.tsx                       (popover, type-to-filter, grouped)
└── ComposerActions.tsx                 (Send | Stop | (live: respawning…) )
```

### State (in `useComposerState`)

```ts
interface ComposerState {
  text: string;
  attachments: Attachment[];                      // { id, path, name, size, kind }
  model: string | null;                           // null = default (Profile or built-in)
  mode: PermissionMode | null;                    // same
  profileId: string | null;
  slash: { open: boolean; query: string; anchor: { x: number; y: number } | null };
  busy: boolean;
  respawning: boolean;
  error: string | null;
}

interface ComposerActions {
  setText, setModel, setMode, setProfileId
  addAttachment(file: File): Promise<void>        // POST /api/orchestrator/uploads
  removeAttachment(id: string): Promise<void>     // DELETE /api/orchestrator/uploads/:id
  openSlash(anchor), closeSlash, setSlashQuery
  send(): Promise<void>                            // see "Send flow"
  stop(): Promise<void>
}
```

### Send flow

```text
onSend()
  buildMessageText(state.text, state.attachments)
    └── if attachments: append "\n\nAttached files:\n- ./.launcher-uploads/<id>/<name>\n- ..."
  effectiveConfig = mergeProfileConfig(profile, model, mode)
  if (sessionLiveHandleId && (modelOrModeUnchanged)):
    sendMessage(handleId, messageText)            // existing /agents/:id/message
  else if (sessionLiveHandleId && (modelOrModeChanged)):
    respawn(handleId, effectiveConfig, messageText)  // see Respawn flow
  else:
    spawn({ prompt: messageText, cwd, profileId, configOverride: { model, mode },
            resumeSessionId: mode === "fresh" ? null : sessionId })
  reset state.text + state.attachments + state.error
```

### Respawn flow (mid-session model/mode swap)

```text
respawn(oldHandleId, newConfig, queuedText)
  state.respawning = true
  POST /api/orchestrator/agents/:id/respawn { config: newConfig, prompt: queuedText }
    server-side:
      1. existing handle found, status running/spawning
      2. kill old child (SIGTERM, escalate to SIGKILL after 5 s)
      3. wait for exit event
      4. spawnAgent({ profile: newConfig, perLaunch: { prompt, cwd, resumeSessionId, ... } })
      5. write queuedText (already in prompt arg) — no extra stdin write
      6. delete old handle from agents map; new handle takes its place
      7. emit WS agent_status { sessionId, status: "respawned", oldHandleId, newHandleId }
    response: { id: newHandleId, pid, status, startedAt }
  client receives newHandleId; updates parent state via callback
  state.respawning = false
```

### Upload flow

```text
addAttachment(file)
  POST /api/orchestrator/uploads (multipart)
    fields: cwd, file
    server-side:
      1. cwds.isAllowed(cwd) gate                  (security)
      2. uuid = randomUUID()
      3. mkdir <cwd>/.launcher-uploads/<uuid>/
      4. write file to <cwd>/.launcher-uploads/<uuid>/<sanitized-filename>
      5. ensureGitignore(<cwd>)                    (idempotent: appends ".launcher-uploads/" if missing)
      6. respond { id: uuid, path: "./.launcher-uploads/<uuid>/<name>", name, size, kind }
    enforcement: 25 MB per file (env: LAUNCHER_MAX_UPLOAD_MB), reject mime types matching a denylist
                 (executables on macOS: .app, .pkg, .dmg) — soft warning, not blocked
  client appends Attachment to state.attachments

removeAttachment(id)
  DELETE /api/orchestrator/uploads/:id  → server rm -rf <cwd>/.launcher-uploads/<id>/
```

### Slash command flow

```text
ComposerTextarea.onKeyDown
  if char === "/" AND cursor is at start-of-token:
    openSlash(anchor = caret position)
ComposerTextarea.onChange
  if slash.open:
    setSlashQuery(text after '/')
    if user typed space or moved caret outside the token:
      closeSlash()

useSlashCommands(cwd)
  GET /api/orchestrator/slash-commands?cwd=<encoded>
  returns: { builtin: [...], skills: [...], plugins: [...], project: [...] }
  filters by query client-side (case-insensitive substring on name + description)
SlashMenu
  renders 4 sections (suppressed if empty); arrow keys navigate;
  Enter / click → text = text.slice(0, slashStart) + selectedCommand + " "
```

### Server endpoints

```
POST   /api/orchestrator/uploads           multipart upload → save under <cwd>/.launcher-uploads/<id>/
DELETE /api/orchestrator/uploads/:id       delete <cwd>/.launcher-uploads/<id>/  (cwd from query)
GET    /api/orchestrator/slash-commands    ?cwd=<encoded> → grouped command list
POST   /api/orchestrator/agents/:id/respawn  body { config, prompt } → kill+respawn flow
```

All gated by `ORCHESTRATOR_ENABLED=1` (existing pattern).

## Data model

No new tables. The composer is fully stateless on disk except for upload files. Two filesystem additions:

- `<cwd>/.launcher-uploads/<uuid>/<filename>` — uploaded files
- `<cwd>/.gitignore` — auto-appended `.launcher-uploads/` line if missing (idempotent; never duplicates; never overwrites existing user lines)

## File map

**New (server)**
- `server/routes/uploads.js` — Express router, multipart via `multer` (dependency may need adding) or a hand-rolled boundary parser
- `server/lib/uploads.js` — uuid + safe-write + gitignore management helpers
- `server/routes/slash-commands.js` — Express router
- `server/lib/slash-commands.js` — built-in catalogue + per-cwd discovery + skills/plugins query (delegates to existing `server/routes/skills.js` lib if exposed)

**New (client)**
- `client/src/lib/composer-types.ts`
- `client/src/hooks/useComposerState.ts`
- `client/src/hooks/useSlashCommands.ts`
- `client/src/hooks/useUploads.ts`
- `client/src/features/composer/Composer.tsx`
- `client/src/features/composer/ComposerToolbar.tsx`
- `client/src/features/composer/ComposerTextarea.tsx`
- `client/src/features/composer/AttachmentBar.tsx`
- `client/src/features/composer/SlashMenu.tsx`
- `client/src/features/composer/UploadButtons.tsx`
- `client/src/features/composer/ComposerActions.tsx`
- `client/src/features/composer/ModelPicker.tsx`
- `client/src/features/composer/ModePicker.tsx`
- `client/src/features/composer/ProfilePicker.tsx`

**Modified**
- `server/lib/spawner.js` — add `respawnAgent(oldId, profile, perLaunch)` that does kill→wait→spawn atomically, preserving the original sessionId mapping
- `server/routes/orchestrator.js` — mount new sub-routers; add `POST /agents/:id/respawn`
- `client/src/components/conversation/ConversationView.tsx` — replace `<SendComposer>` with `<Composer>`
- `client/src/pages/MobileChat.tsx` — same
- `client/src/lib/types.ts` — add `agent_respawned` WSMessage variant
- `.env.example` — document `LAUNCHER_MAX_UPLOAD_MB`

**Deleted**
- `client/src/features/launcher/SendComposer.tsx` (superseded — old callers updated)
- `client/src/features/launcher/__tests__/SendComposer.test.tsx` (replaced by `Composer.test.tsx`)

**New (tests)**
- `server/__tests__/uploads.test.js` (lib + route)
- `server/__tests__/slash-commands.test.js` (lib + route)
- `server/__tests__/spawner-respawn.test.js` (kill→spawn round-trip)
- `server/__tests__/orchestrator-respawn.test.js` (route)
- `client/src/hooks/__tests__/useComposerState.test.ts`
- `client/src/hooks/__tests__/useSlashCommands.test.ts`
- `client/src/hooks/__tests__/useUploads.test.ts`
- `client/src/features/composer/__tests__/Composer.test.tsx`
- `client/src/features/composer/__tests__/SlashMenu.test.tsx`
- `client/src/features/composer/__tests__/UploadButtons.test.tsx`
- `client/src/features/composer/__tests__/AttachmentBar.test.tsx`

## API surface

```
POST   /api/orchestrator/uploads           multipart, fields: cwd, file
                                            201 { id, path, name, size, kind }
                                            400 invalid cwd / unknown cwd
                                            413 file too big
DELETE /api/orchestrator/uploads/:id       query: ?cwd=<encoded>
                                            204 deleted
                                            404 not found
GET    /api/orchestrator/slash-commands    query: ?cwd=<encoded>
                                            200 { builtin: SC[], skills: SC[], plugins: SC[], project: SC[] }
                                            interface SC { name, description, source }
POST   /api/orchestrator/agents/:id/respawn  body { config: ProfileConfig, prompt: string }
                                            200 { id: <newHandleId>, pid, status, startedAt }
                                            404 agent not found
                                            400 invalid config
                                            429 concurrency cap
WS variant additions:
  | { type: "agent_respawned"; sessionId: string; oldHandleId: string; newHandleId: string }
```

## UI

### Composer layout — desktop

```text
┌─ ComposerToolbar ─────────────────────────────────────────────────┐
│ [Model ▾] [Mode ▾] [Profile ▾]            [📎] [📷]   busy / idle │
├─ AttachmentBar (only when attachments.length > 0) ────────────────┤
│ [● file.txt 12 KB ×] [● photo.png 1.2 MB ×]                       │
├─ ComposerTextarea (autoresize, drag-drop active) ─────────────────┤
│ Ask Claude…                                                       │
│   (when typing /: SlashMenu popover anchored to caret)            │
├─ ComposerActions ─────────────────────────────────────────────────┤
│   Cmd+Enter to send                       [Stop] [Send (Cmd+⏎)]   │
└───────────────────────────────────────────────────────────────────┘
```

### Composer layout — mobile

Same structure, toolbar wraps; pickers render as compact chips; textarea spans full width.

### SlashMenu

```text
┌─ /age... ─────────────────────────────┐
│ Built-in                              │
│  /agents     List configured subagents│
│  /clear      Clear screen             │
│ Skills                                │
│  /code-review  Review current diff    │
│ Plugins                               │
│  /ccam-deploy  Deploy via plugin      │
│ Project                               │
│  /db-migrate   Run database migration │
└───────────────────────────────────────┘
```

Filter is case-insensitive substring on name OR description. Sections that match nothing collapse out. Arrow up/down navigates; Enter inserts; Escape closes.

### Pickers

- **ModelPicker**: dropdown over `["sonnet", "opus", "haiku", "claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5"]` plus a `"Custom…"` item that opens a free-text TextField. Selected value persists per-Conversation (lifted via parent state, not in the hook — composer state resets per session).
- **ModePicker**: dropdown over `PERMISSION_MODES`. Default empty (= profile/spawn-default).
- **ProfilePicker**: dropdown over `useProfiles().profiles`. Default empty.
- Picking a different value while `sessionLiveHandleId !== null` → `respawning = true` for ~1–3s, then resolved to the new handle.

### Upload buttons

- **📎 (file)**: `<input type="file" multiple>` — any file type. Click → native OS file dialog.
- **📷 (camera/photos)**: `<input type="file" accept="image/*" capture="environment" multiple>` — biases iOS/Android to camera/photos. On desktop, falls back to a regular image picker.
- Both pipe through the same `useUploads.addAttachment(file)`.

### Drag-and-drop

`ComposerTextarea` listens for `dragover` / `drop` events. On drop, iterates `dataTransfer.files` and calls `addAttachment` per file. Visual cue (textarea border highlight) during dragover.

## Security & limits

- Upload size capped at `LAUNCHER_MAX_UPLOAD_MB` (default 25 MB). Server returns 413 on overflow.
- File names sanitized (path-traversal characters stripped, kept ≤ 255 bytes).
- Cwd must be in `launcher_allowed_cwds` (existing gate); uploads to unknown cwds return 400.
- DELETE handler verifies the upload uuid path is under the requested cwd (no cross-cwd deletion).
- `ensureGitignore` only *appends* `.launcher-uploads/` if the literal line doesn't exist; it never modifies other lines or rewrites the file.
- The `<cwd>/.launcher-uploads/` directory has no special permissions — it inherits the user's umask.
- `respawnAgent` validates the new config before killing the old child; an invalid config returns 400 with the old child still alive.
- All routes 404 unless `ORCHESTRATOR_ENABLED=1`.

## Testing strategy

| Surface | Tests | Verification |
|---|---|---|
| `server/lib/uploads.js` | uuid round-trip; gitignore idempotency; path-traversal rejection; size cap | `npm run test:server` |
| `server/routes/uploads.js` | upload + delete happy path; 400 on unknown cwd; 413 on too-big; 404 when feature off | same |
| `server/lib/slash-commands.js` | built-in list completeness; per-cwd `.claude/commands/` discovery; cache | same |
| `server/routes/slash-commands.js` | grouped response shape; empty cwd handled | same |
| `server/lib/spawner.js` (respawn) | kill→spawn preserves session_id mapping; new handle id; old handle removed | same |
| `server/routes/orchestrator.js` (respawn) | route happy + 404 + 400 + 429 | same |
| `client/src/hooks/useComposerState` | send routes via sendMessage when live; respawn when model differs; reset on send | `npm run test:client` |
| `client/src/hooks/useSlashCommands` | groups, filter, cache key | same |
| `client/src/hooks/useUploads` | post round-trip; remove; error UI | same |
| `client/src/features/composer/SlashMenu` | open on '/'; filter; keyboard nav; insert | same |
| `client/src/features/composer/UploadButtons` | file picker fires; photo picker has correct attrs | same |
| `client/src/features/composer/AttachmentBar` | chips render; remove fires DELETE | same |
| `client/src/features/composer/Composer` | end-to-end render + send + respawn + drag-drop | same |
| MCP | unaffected | `npm run mcp:typecheck && npm run mcp:build` |

Targets: server **241 → ~270**; client **159 → ~190** after this work.

## Migration & rollout

- All changes additive at the server layer; new routes 404 unless flag enabled.
- `SendComposer.tsx` and its test are deleted; the two callers are updated atomically in the same commits as the new `Composer.tsx`.
- `WSMessage` extension (`agent_respawned`) is purely additive.
- `.gitignore` mutation in user cwds is idempotent and only on first upload — no surprise edits.

## Phases

1. **Server: uploads** — `lib/uploads.js`, `routes/uploads.js`, gitignore helper, tests.
2. **Server: slash-commands** — `lib/slash-commands.js`, `routes/slash-commands.js`, tests.
3. **Server: respawn** — extend `spawner.js`; add `POST /agents/:id/respawn`; tests.
4. **Client: hooks** — `useUploads`, `useSlashCommands`, `useComposerState`. Tests.
5. **Client: leaf components** — `ModelPicker`, `ModePicker`, `ProfilePicker`, `UploadButtons`, `AttachmentBar`, `SlashMenu`, `ComposerActions`, `ComposerTextarea`, `ComposerToolbar`. Tests.
6. **Client: orchestrator** — `Composer.tsx` orchestrator. Tests.
7. **Wire-up** — replace `SendComposer` references in `ConversationView`, `MobileChat`. Delete old `SendComposer.tsx` + test.
8. **Polish & docs** — `docs/launcher.md` updated, `.env.example` for `LAUNCHER_MAX_UPLOAD_MB`, `WSMessage` type addition.

Phases 1–3 are independent of each other (parallel-safe). Phase 4 needs phases 1–3. Phases 5–6 are sequential (orchestrator imports leaves). Phase 7 must come last. Phase 8 anywhere after 7.

## Out of scope

- Voice input.
- Mid-message model swap **without** respawn (Anthropic API native; not possible via Claude Code's stream-json).
- Image preview thumbnails in `AttachmentBar` (chips show name only; preview is a follow-up).
- Cross-cwd uploads (each session's uploads stay in its own cwd).
- Persisting composer state across page reloads (text is in-memory only; refresh = clean slate).
- Per-message attachment ordering / re-ordering (chips appear in upload order; that's the order they go into the prompt).

## References

- `docs/superpowers/specs/2026-05-05-agent-launcher-design.md` — the launcher spec this builds on.
- `docs/superpowers/plans/2026-05-05-agent-launcher.md` — Task 22 introduced the original `SendComposer`; this design replaces that work.
- `server/routes/skills.js` — existing skill discovery the slash-commands lib should reuse.
- `server/lib/spawner.js` — existing concurrency cap, env-stripping, kill flow that the respawn helper composes around.
