# Agent Launcher

The Launcher lets you start `claude` sessions from the dashboard, with every CLI flag exposed and saved as reusable Profiles. Once a session is running (or imported into the dashboard), you can continue the conversation from the dashboard's Conversation tab.

## Enable

The launcher is gated behind an env flag. Add to your `.env`:

```bash
ORCHESTRATOR_ENABLED=1
ORCHESTRATOR_MAX_CONCURRENT=5   # optional; default 5
```

Restart the server (`npm run dev` or `npm start`). Without the flag, every `/api/orchestrator/*` route returns `404`.

## Working-directory allowlist

Before launching, register the directories you'll work in:

- Open **Settings → Agent Profiles → Working directory** (the cwd dropdown inside any profile editor section).
- Pick from the existing list, or click **Add new path…** to enter an absolute path.
- The server verifies the path exists as a directory before remembering it.

Even if a request body smuggles in `/etc` or `..`, `cwds.isAllowed()` rejects unknown paths server-side. The dropdown is UX; the allowlist is the security boundary.

## Profiles

A Profile is a saved set of CLI flags.

| Field family | Examples |
|---|---|
| Model & runtime | `--model`, `--fallback-model`, `--effort`, `--betas` |
| Permissions | `--permission-mode` |
| Tools | `--tools`, `--allowedTools`, `--disallowedTools` |
| System prompt | `--system-prompt`, `--system-prompt-file`, `--append-system-prompt`, `--append-system-prompt-file` |
| Working dirs | `--add-dir` |
| MCP & plugins | `--mcp-config`, `--strict-mcp-config`, `--plugin-dir` |
| Settings & sources | `--settings`, `--setting-sources` |
| Agents | `--agent`, `--agents` |
| Output | `--include-hook-events`, `--include-partial-messages`, `--json-schema` |
| Limits & logging | `--max-turns`, `--max-budget-usd`, `--debug` |
| Channels | `--channels`, `--exclude-dynamic-system-prompt-sections` |
| Env vars (names only) | `envVarNames` (resolved at spawn from secrets.env / process.env) |
| **⚠ Dangerous** | `--bare`, `--dangerously-skip-permissions`, `--allow-dangerously-skip-permissions`, `--dangerously-load-development-channels` |

The launcher always forces `--input-format stream-json --output-format stream-json --verbose`; these are locked in the Output section.

State-dependent flags (`--continue`, `--resume`, `--session-id`, `--fork-session`) are NOT stored in profiles — they're per-launch toggles set by the launcher itself.

### Create

`/launcher` → fill the form → **Save as profile**. The Identity section requires a name.

### Edit

`Settings → Agent Profiles` → pick a profile → edit fields. Changes save on blur.

### Duplicate / Delete / Import / Export

Buttons are above the editor in the Settings tab. Export downloads a JSON artifact safe to share or commit to a dotfiles repo. Import accepts the same shape; on a name collision the imported profile is auto-suffixed (`name (2)`, `name (3)`, ...).

## Continue any conversation

Open any session in the dashboard. The Conversation tab now has a sticky **Send** box at the bottom.

- **Live session** (an orchestrator process is currently attached): your message is piped to the running agent's stdin via `POST /api/orchestrator/agents/:id/message`.
- **Historical session** (no live process): the dashboard runs `claude --resume <session-id>` with the chosen profile and pipes your message in. The resumed `claude` reuses the same `session_id`, so new events flow through the existing hook ingestion path and land on the same Conversation row.

Use **Cmd+Enter** (or **Ctrl+Enter**) to send. The **Stop** button (only visible on live sessions) sends `SIGTERM` to the agent (escalating to `SIGKILL` after 5 s).

## Secrets

Profiles store env-var **names** only — never values. At spawn time, values resolve from:

1. **`~/.claude/launcher/secrets.env`** — `KEY=VALUE` per line. Lives in your home, gitignored by convention.
2. **The dashboard's host environment** (`process.env`).

`secrets.env` wins on conflict. Names that resolve nowhere are silently dropped at spawn.

The audit table (`launcher_launches`) records `argv` and the LIST of injected env names — not their values. A forensic dump won't leak secrets.

## Concurrency

`ORCHESTRATOR_MAX_CONCURRENT` (default 5) caps live agents. Spawn returns `429` once reached, with a `running` array listing the existing agents:

```json
{
  "error": "concurrency limit 5 reached",
  "running": [
    { "id": "...", "pid": 12345, "startedAt": 1714900000000 }
  ]
}
```

Stop one of them or wait, then retry.

## Architecture (one-pass)

```text
Launcher form / Conversation send composer
  → POST /api/orchestrator/spawn  or  /agents/:id/message
    → server validates body against ProfileConfig schema
    → server checks cwd against launcher_allowed_cwds (security gate)
    → server checks concurrency cap
    → spawnAgent() builds argv, spawns `claude` with cleanSpawnEnv()
      → child stdout (stream-json) → parseStreamJson() → broadcast WS agent_stream
      → spawned `claude` fires hooks → POST /api/hooks/event → existing dashboard ingestion
    → response { id, pid, status, startedAt }
```

## Source map

| Concern | File |
|---|---|
| Flag mapping (server) | `server/lib/profile-schema.js` |
| Stream-json line buffer | `server/lib/stream-json-parser.js` |
| Subprocess spawner | `server/lib/spawner.js` |
| Profile CRUD (DB) | `server/lib/profiles.js` |
| cwd allowlist | `server/lib/cwds.js` |
| Audit log | `server/lib/launches.js` |
| Secrets resolver | `server/lib/launcher-secrets.js` |
| HTTP routes | `server/routes/orchestrator.js`, `routes/profiles.js`, `routes/cwds.js` |
| WSMessage types | `client/src/lib/types.ts` (`agent_stream`, `agent_status`, `agent_input_ack`) |
| Flag mapping (client) | `client/src/lib/profile-flag-mapping.ts` |
| Profile editor | `client/src/features/launcher/ProfileEditor.tsx` + `sections/*` |
| Command preview | `client/src/features/launcher/CommandPreview.tsx` |
| Send composer | `client/src/features/launcher/SendComposer.tsx` |
| Launcher page | `client/src/pages/LauncherView.tsx` |
| Profile manager tab | `client/src/pages/SettingsProfiles.tsx` |

## Safety story

- Every new HTTP route 404s unless `ORCHESTRATOR_ENABLED=1`.
- The cwd allowlist is enforced server-side in the spawn handler — UI dropdowns are convenience, not security.
- The default permission mode is `acceptEdits` (not `bypassPermissions`).
- Dangerous flags (`--bare`, `--dangerously-skip-*`, `--dangerously-load-development-channels`) live behind a collapsed red banner in the editor.
- Hook handlers always exit `0` (preserved from the project's gotcha #2).
- Argv is recorded in `launcher_launches.argv_json` with **env values redacted** — only the names that were injected are kept.

## Implementation notes

- **`SendComposer` has two modes**: `mode="resume"` (default) calls `spawn` with `resumeSessionId` so the new `claude` re-attaches to an existing session row. `mode="fresh"` skips `resumeSessionId` so the spawned `claude` creates a new session under the locally-minted id. The Conversation send composer uses the default; the mobile `/chat` tab passes `mode="fresh"` because it mints a UUID before any session row exists.
- **`LauncherView` Launch** sends `editor.config` as `configOverride` on `POST /spawn`, so the launcher form drives the full flag set. The form is also usable for "Save as profile" without launching.
