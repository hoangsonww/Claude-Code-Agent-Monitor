# 08 — claudeclaw Deep Dive

In-source analysis of `moazbuilds/claudeclaw`, including lineage vs.
OpenClaw, parallels with Claude Code v2.1.128 + Cowork, and adoption
fit for this project. Performed using the Supervisor + Worker
fan-out pattern from
[06-agentic-pattern-archetypes.md](06-agentic-pattern-archetypes.md)
with four background subagents covering different axes — itself a
worked example of the pattern.

## Single-line verdict

**A focused, well-built Bun-based Claude-CLI scheduler daemon for
chat bridges and cron tasks — not a multi-agent orchestrator.**
Subscription-billing-safe, hook-safe, but answers a different
question than the one this research has been investigating.

## Lineage: claudeclaw vs OpenClaw

`moazbuilds/claudeclaw` is **inspired-but-independent** of
`openclaw/openclaw`. Not a fork; zero shared code, zero shared
contributors, zero shared dependencies, different stacks (Bun vs
pnpm/tsdown). Originally created 2026-02-11 as `claude-heartbeat`
(still the workspace name in `bun.lock`); rebranded to `claudeclaw`
and re-positioned as a deliberately lightweight counter-pitch to
OpenClaw.

The README explicitly markets it as *"A lightweight, open-source
OpenClaw version built into your Claude Code"* (`README.md:27`),
and the FAQ jokes: *"If it bothers Anthropic, I might rename it to
OpenClawd"* — explicit naming awareness.

|  | OpenClaw | claudeclaw |
|---|---|---|
| Created | 2025-11-24 | 2026-02-11 |
| First name | Warelay → Clawdbot → Moltbot → OpenClaw | claude-heartbeat → claudeclaw |
| Stack | TS ESM, pnpm monorepo, tsdown, custom `openclaw.mjs` bin, Dockerfile, fly.toml, render.yaml | TS ESM, single-package Bun, no monorepo, no Docker |
| Scale | 600k+ LOC across `apps/`, `extensions/`, `packages/` | 18.5k LOC across flat `src/` (53 files) |
| Top contributor | steipete (24,215 commits) | moazbuilds (255), TerrysPOV (109) |
| License | MIT | MIT |
| Codenames | lobster/molty/crustacean themes | "claw" morpheme only |
| Channels | 24+ adapters in `src/channels/` | Telegram, Discord, Slack only |
| Manifest format | Custom OpenClaw plugin SDK | Anthropic's standard `SKILL.md` + YAML frontmatter |

## Architecture

### Runtime

- **Bun** mandatory (`Bun.spawn`, `Bun.serve`, `Bun.file` across
  19 files). Auto-installs via `curl | bash` if missing — security
  flag.
- TypeScript ESM, single package (not a monorepo).
- Entrypoint: `bun run src/index.ts` → flat argv router into
  `start/stop/clear/status/telegram/discord/slack/send`.
- The `start` command runs as a long-lived daemon writing PID to
  `.claude/claudeclaw/daemon.pid`.

### Auth path (the architecturally clever part)

**Pure `claude` CLI subprocess.** No SDK. No API key path. No
beta-header trickery.

```typescript
// src/runner.ts:1060 (simplified)
Bun.spawn([
  CLAUDE_EXECUTABLE,    // resolves to "claude" (or claude.exe on Windows)
  "-p", prompt,
  "--output-format", "stream-json",
  "--verbose",
  ...securityArgs,
], { env: cleanSpawnEnv() })
```

The `cleanSpawnEnv()` helper at `src/runner.ts:105-117` deliberately
**strips** these env vars before spawn:

- `CLAUDECODE`
- `CLAUDE_CODE_OAUTH_TOKEN`
- `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST`

The reason (per the inline comment at `:84-103`): a daemon launched
from inside a Claude Code session would inherit a soon-to-expire
OAuth token. Stripping these forces the spawned `claude` to
re-resolve credentials from platform-native storage (Keychain on
macOS, `~/.claude/.credentials.json` elsewhere, Credential Manager
on Windows), which auto-refreshes — surviving the parent's ~8h OAuth
expiry.

This is the **canonical pattern for long-lived subscription-auth
daemons**, and is worth stealing for any orchestrator built on this
research.

### Agent model

Single ReAct loop **per channel/thread**, fully delegated to the
spawned `claude` CLI's internal loop. Claudeclaw owns scheduling
and message routing only.

`runClaudeStream` (`src/runner.ts:462-581`) parses the NDJSON
`stream-json` events, capturing `system`/`result` events for
`session_id`/`result`, and forwarding `assistant`/`user` blocks
(text, `tool_use`, `tool_result`) to channel-specific chunk
handlers.

Sessions persist across calls via `--resume <session_id>` from
`.claude/claudeclaw/session.json` (`src/sessions.ts:6,36-46`). A
separate `model-router.ts` does keyword/phrase routing between
configured "modes" (e.g., cheap haiku vs sonnet) before each spawn.

### MCP integration

**None.** Neither MCP host nor MCP server. The only stray reference
is `src/config.ts:216` letting users point voice transcription at an
`mcp__whisper__transcribe` tool name that the spawned `claude` (not
claudeclaw) would invoke.

### Storage

Plain JSON files under `<cwd>/.claude/claudeclaw/`:

```text
.claude/claudeclaw/
├── session.json              # main session ID
├── session_fallback.json     # GLM fallback session
├── daemon.pid
├── state.json
├── settings.json
├── logs/
└── agents/<name>/
    └── session.json          # per-agent CWD-scoped sessions
```

No SQLite, no Redis, no DB. All state is markdown + JSON.

### Channel SDKs

Hand-rolled with **zero SDK dependencies**:

- **Discord** — raw gateway WebSocket (`src/commands/discord.ts:18-29`)
- **Telegram** — direct HTTPS to Bot API
- **Slack** — Socket Mode + `chat.postMessage`

Single runtime dependency in `package.json`: `ogg-opus-decoder` for
Discord voice messages. Whisper.cpp binaries fetched on demand from
GitHub releases / Homebrew bottles for transcription.

### Multi-agent shape

Per-Discord-thread parallel sessions
(`MULTI_SESSION_SPEC.md`, `src/sessionManager.ts`) — concurrent
thread-scoped `--resume` IDs. **NOT** supervisor/worker
orchestration. The "parallel" in the README means
parallel-Discord-threads, not orchestrated subagents.

## Parallels matrix vs Claude Code v2.1.128 + Cowork

| Anthropic feature | claudeclaw equivalent | Verdict |
|---|---|---|
| Claude CLI subprocess auth | `Bun.spawn(["claude", "-p", "stream-json", ...])` w/ env stripping | **Match** — pure CLI wrapper |
| `computer-use` MCP | Single stray reference (`mcp__whisper__transcribe` for STT). No MCP wiring. | **Absent** |
| Channels (Slack/Telegram/Discord) | Telegram (1604 LOC), Discord (1452 LOC, thread-isolated), Slack via Socket Mode (1684 LOC), voice via Whisper | **Match in spirit** — predates Anthropic's; built-from-scratch |
| Skills (`SKILL.md` + frontmatter) | Identical format; scans project `.claude/skills/`, global `~/.claude/skills/`, `~/.claude/plugins/*/skills/` | **Match** |
| Plugin marketplace | Own `marketplace.json` + daemon-level plugin event bus compatible with OpenClaw plugin API | **Match + extends** |
| Hooks (PreToolUse, etc.) | `hooks/hooks.json` is literally `{"hooks": {}}` — empty stub. No hook listeners anywhere in `src/`. | **Absent (stubbed)** |
| Memory (CLAUDE.md + auto memory) | Managed-block injection into project CLAUDE.md via `<!-- claudeclaw:managed:start -->` markers. Does NOT use `~/.claude/projects/<repo>/memory/` | **Divergent** |
| Subagent dispatch (Task tool) | Doesn't supervise; observes `Agent` blocks in stream-json (`src/runner.ts:1521-1525`) and emits lifecycle events to its dashboard | **Divergent** (consumes, doesn't add) |
| Cost / effort controls (`--max-budget-usd`, `--effort`, `--json-schema`) | None. Only `timeouts.{telegram,heartbeat,job}` minutes + GLM fallback on rate limit | **Absent** |
| Cowork-style multi-tab UX | Single web dashboard at `:4632`. No Chat/Code/General tabs, no Dispatch | **Absent** |

**Inheritance direction**: claudeclaw is a pure consumer of Claude
Code conventions (CLAUDE.md, `.claude/skills/`, `~/.claude/plugins/`,
marketplace, `claude` CLI subprocess, `--allowedTools`/`--resume`/
`--append-system-prompt`/stream-json). Same direction as OpenClaw,
but lighter-weight and Bun-native.

### Where it goes BEYOND Anthropic

- Background daemon with PID file + watchdog (`src/pid.ts`,
  `src/watchdog.ts`)
- Heartbeat (periodic self-prompts with quiet hours,
  `src/cron.ts:24`)
- Cron jobs with timezone shifting (`src/jobs.ts`,
  `src/timezone.ts`)
- Multi-channel chat bridges with voice transcription via bundled
  whisper.cpp + warm-up (`src/whisper.ts`, `src/whisper-warmup.ts`)
- Per-Discord-thread isolated sessions (`MULTI_SESSION_SPEC.md`)
- GLM-as-fallback model routing on rate-limit (`src/model-router.ts`)
- Auto-rotation when context fills, with markdown summary handoff
  (`src/rotation.ts`)
- Daemon-level plugin event bus deliberately distinct from Claude
  Code's hook system

### Where it's MISSING

- Hooks (`PreToolUse`/`PostToolUse`/`PreCompact`/`PostCompact`)
- MCP integration entirely
- Cost/budget/effort controls
- Anthropic's auto-memory at `~/.claude/projects/<repo>/memory/`
- Cowork-style multi-tab UX and Dispatch trigger
- Routines API integration (has its own cron, no integration with
  Anthropic's Routines)

## Practical fit for this project

**For the stated orchestration goal: qualified miss.**

| Constraint | claudeclaw | Verdict |
|---|---|---|
| Max-subscription billing | Yes — pure `claude` CLI subprocess | safe |
| License | MIT (2026 moaz) | safe to adopt, fork, vendor |
| Maintenance | Active (450 commits, 150 in past 30d), bus factor ~1 (top 2 = 81% of commits) | active but solo-author risk |
| Setup complexity | `claude plugin install` + `/claudeclaw:start` wizard. **Bun mandatory** (auto `curl\|bash` install if missing) | multi-step |
| Hook preservation | Only writes project-local `./.claude/settings.json` for statusline. Never touches `~/.claude/settings.json`. `hooks/hooks.json` empty | additive, dashboard-safe |
| Heavy deps | Bun (forced), Node (OGG helper), optional Discord/Telegram/Slack tokens, optional GLM token, Whisper for voice | Bun is non-negotiable |
| Integration shape | Sibling-process daemon + Claude Code plugin marketplace entry | sibling-process (good) |

### Comparison vs surveyed alternatives

| Project | claudeclaw vs ... | Verdict |
|---|---|---|
| OpenSwarm | claudeclaw is MIT (vs GPL-3); both are CLI-subprocess-based; but solve different problems | not comparable |
| rjcorwin/cook | cook is ~4.3k LOC clean reference, no LICENSE; claudeclaw is ~18k LOC MIT | cook wins on minimalism, claudeclaw on license |
| mco-org/mco | mco does parallel fan-out + consensus; claudeclaw does scheduled cron + chat bridges | mco wins for orchestration |
| maestro-orchestrate | both are Claude Code plugins under permissive licenses; maestro is built for orchestration | maestro wins for orchestration |

### What claudeclaw uniquely unlocks

No other surveyed project provides:

- Telegram + Discord + Slack chat bridges with voice transcription
- Cron + heartbeat scheduling for Claude prompts
- Per-thread session isolation in Discord
- In-process web dashboard at `:4632`
- GLM fallback model routing on rate-limit hits
- An "agentic" model router (planning → opus, implementation →
  sonnet) keyed off keywords

### What it uniquely *fails* at

- It is **NOT** a multi-agent orchestrator (the orchestration goal
  this research has been pursuing).
- **Auto-installs 6 third-party Claude Code plugins** on first run
  (`src/preflight.ts:21-39`) into `~/.claude/plugins/`:
  `dev-browser`, `claude-mem`, `superpowers-marketplace`,
  `ralph-loop`, `hookify`, etc. Adoption commits the user to that
  supply chain without the README mentioning it.
- The `curl | bash` Bun installer is a remote-pipe-to-shell footgun
  on machines that don't have Bun.

## Risks worth knowing before adopting

1. **Bus factor ~1.** moazbuilds (255) + TerrysPOV (109) =
   81% of commits. Project is active (last push 2026-05-04), but a
   hit-by-bus event is a real risk.
2. **Mandatory Bun runtime.** The plugin's `start.md` will
   `curl | bash` install Bun if missing — that's a remote pipe to
   shell on an unsuspecting user's machine. Audit the install URL
   before adopting.
3. **Preflight installs 6 third-party Claude Code plugins** silently
   on first run (`src/preflight.ts:21-39`). Plugin supply-chain risk
   inherits from each.
4. Project-local `.claude/settings.json` gets a `statusLine` field
   added; teardown is implemented but a stale clone leaves config
   drift.
5. Author explicitly acknowledges Anthropic ToS uncertainty in
   README (*"Will Anthropic sue you for building ClaudeClaw? — I
   hope not"*). The architecture is fine — they correctly use the
   `claude` CLI subprocess pattern that this research already
   identified as the only safe path — but the public branding is
   provocative.
6. `cleanSpawnEnv` strips `CLAUDE_CODE_OAUTH_TOKEN` before spawning
   to force Keychain refresh. This is the **correct** fix for
   detached daemon auth, but means the spawned CLI **fails on
   machines where Keychain isn't unlocked** (CI runners, headless
   boxes). Worth knowing if you'd run this server-side.
7. Hard-codes `--dangerously-skip-permissions` on every spawn
   (`src/runner.ts:830`); the `unrestricted` security level
   disables directory scoping entirely.
8. Whisper binaries pulled from GHCR with a literal anonymous bypass
   header (`Authorization: Bearer QQ==` — that's `:` base64-encoded,
   `src/whisper.ts:33,38`) — fragile and licensing-grey.

## Honest recommendation

**Skip claudeclaw for the orchestration goal.** It's solving "I want
a Claude daemon that responds to Telegram/Discord and runs cron
prompts" — not the orchestration question this research has been
pursuing. For that question, **maestro-orchestrate** (Apache-2.0
plugin) and **rjcorwin/cook** (clean reference) remain the better
picks (see file 03).

**Do consider claudeclaw if** the goal pivots to:

- "Trigger Claude tasks from my phone via Telegram"
- "Run morning Claude routines on a schedule"
- "Voice-message Claude through Discord"
- "Have Claude post work updates to Slack as it makes progress"

In that lane, claudeclaw is the best-in-class option this research
identified — MIT, active, subscription-native, hook-safe. **It can
safely run alongside this project's dashboard** since it doesn't
touch global hooks; the dashboard would observe every
claudeclaw-spawned session as a normal top-level Claude Code session
via the existing `POST /api/hooks/event` ingestion.

## What to steal even if you don't adopt

Two patterns from claudeclaw worth borrowing:

### 1. The env-stripping daemon trick

For any long-lived orchestrator that spawns `claude -p` subprocesses,
strip OAuth-related env vars before spawn so the child re-resolves
from platform credential storage. This is the right pattern for
daemons that outlive the parent process's OAuth token.

```typescript
function cleanSpawnEnv() {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_OAUTH_TOKEN;
  delete env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST;
  return env;
}

const child = spawn("claude", [...args], { env: cleanSpawnEnv() });
```

This makes a difference for the cowork-bridge-mcp work in
[`~/Projects/cowork-bridge-mcp/`](../../../cowork-bridge-mcp/) — if
the bridge daemon ran past 8 hours, it would lose auth without this
trick.

### 2. Stream-json `Agent` block detection

For dashboards observing subagent dispatches (Task tool), parse the
`stream-json` output for `Agent` tool-use blocks:

```typescript
// adapted from src/runner.ts:1521-1525
for await (const event of streamJsonEvents) {
  for (const block of event.message?.content ?? []) {
    if (block.type === "tool_use" && block.name === "Agent") {
      emit({
        type: "subagent_spawn",
        id: block.id,
        description: block.input.description,
      });
    }
  }
}
```

This lets your dashboard observe Task-dispatched subagents without
needing to BE a subagent. Closes part of the gotcha #6 observability
gap (subagent tool calls not firing hooks) without the post-hoc
JSONL scan in `scripts/import-history.js`.

## Methodology — the Supervisor + Worker fan-out in action

This analysis is itself a worked example of the
**Supervisor + Worker** pattern from
[06-agentic-pattern-archetypes.md §B.7](06-agentic-pattern-archetypes.md).

### Setup

Four background subagents dispatched in parallel via Task with
`run_in_background: true`, each with a non-overlapping axis:

| Worker | Axis | Output bound |
|---|---|---|
| 1 | Architecture & technical implementation | ≤700 words |
| 2 | Lineage vs OpenClaw | ≤500 words |
| 3 | Parallels with Claude Code + Cowork | ≤700 words |
| 4 | Practical fit for this user | ≤600 words |

Each worker cloned the repo to its own `/tmp/claudeclaw-*-research/`
directory to avoid disk collisions. Each was given a strict output
format and word budget so synthesis at the parent would be
mechanical rather than creative.

### Why four axes (not one or nine)

- **One agent** would have to context-switch across all concerns
  and produce shallow analysis on each.
- **Nine agents** would over-fragment ("did anyone look at the
  README?").
- **Four lets each worker go deep on a single axis with
  non-overlapping responsibilities**, which is the sweet spot for
  synthesis at the parent. This is the same calculus that file 06
  recommends.

### Why it converged cleanly

Each worker, working independently, arrived at compatible answers:

- Lineage said "inspired-not-fork"
- Architecture said "pure CLI subprocess daemon"
- Parallels said "consumer of Claude Code conventions, missing
  orchestration features"
- Practical fit said "qualified miss for orchestration, qualified
  hit for chat bridges"

When four independent investigations converge on a coherent
picture, the picture is well-supported. Divergent verdicts would
have been a signal to dig deeper; convergence is a signal to trust
the synthesis.

### Cost shape

Token cost: roughly 260k tokens across the four workers (per the
usage events at agent completion). About 4 minutes wall time for the
parallel workers, ~5 minutes including synthesis. Comparable to the
9-way OpenClaw / orchestrator survey in file 03.

## Cross-references

- [03-third-party-orchestrators.md](03-third-party-orchestrators.md)
  — claudeclaw doesn't appear in the original survey; this doc
  positions it relative to the 9 surveyed projects.
- [06-agentic-pattern-archetypes.md](06-agentic-pattern-archetypes.md)
  — the Supervisor + Worker fan-out used to produce this analysis.
- [07-claude-code-hidden-features.md](07-claude-code-hidden-features.md)
  — the v2.1.128 feature set claudeclaw was compared against.
- The OpenClaw forensic comparison referenced in this doc (the
  agent's earlier delivery on `openclaw/openclaw`) — not yet
  written to disk, but the lineage findings here are consistent
  with what that analysis found.
