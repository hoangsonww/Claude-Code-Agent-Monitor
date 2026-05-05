# 03 — Third-Party Orchestrators (deep analysis)

Nine GitHub projects analyzed in source code, not just READMEs.
Each analysis verified the `claude` invocation path, orchestration
model, hook compatibility, and project maturity using parallel
`Task`-dispatched subagents that cloned each repo to `/tmp/` and
inspected files.

## Feature score matrix

### Auth and integration safety

| Repo | ⭐ | License | Max-compat | Hook-safe | Tampers `~/.claude/`? |
|---|---:|---|---|---|---|
| superset-sh | 10.3k | ⚠️ ELv2 | ✅ subprocess (PTY) | ✅ | Merges, preserves user hooks |
| catlog22/CCW | 2.0k | MIT | ✅ subprocess | ✅ | Appends only |
| claw-empire | 1.1k | Apache-2.0 | ✅ subprocess | ⚠️ Strips `CLAUDECODE` env | No |
| OpenSwarm | 626 | ⚠️ GPL-3 | ✅ subprocess | ✅ | No |
| maestro | 397 | Apache-2.0 | ✅ Plugin (inherits) | ✅ | Adds via plugin manifest |
| rjcorwin/cook | 367 | ⚠️ NONE | ✅ subprocess | ✅ | No |
| mco-org/mco | 331 | MIT | ✅ subprocess | ✅ | No |
| genie | 307 | MIT | ✅ subprocess (in tmux) | ⚠️ Injects own hooks | Deep-merges |
| aannoo/hcom | 251 | MIT | ✅ subprocess | ⚠️ Writes to settings.json | Yes (additive, 10 events) |
| metaswarm | 241 | MIT | ✅ Plugin (inherits) | ✅ | Adds via plugin manifest |

### Orchestration model

| Repo | Model | Concurrency | Inter-agent comm | LOC |
|---|---|---|---|---:|
| superset-sh | Tiled panes (multiplexer) | Bounded by box | None (visual only) | 380k |
| catlog22/CCW | DAG with topo sort + queue scheduler | `maxConcurrentSessions=2` | SQLite + `{{var}}` interpolation | 210k |
| claw-empire | Fixed CEO→6 depts→roles | N detached children | SQLite + WS broadcast | 110k |
| OpenSwarm | Fixed pipeline: worker→reviewer→tester | Sequential per pipeline | Stage outputs as text | 48k |
| maestro | Supervisor + 4-phase, 39 specialists | Native `Task()` | Markdown state files | 40k |
| cook | 5-primitive AST, parallel worktree races | `Promise.all` | Last-message + filesystem | 4.3k |
| mco | Static fan-out + consensus | `ThreadPoolExecutor` | None (sealed) | 13.4k |
| genie | brainstorm→wish→work→10-critic council | `GENIE_MAX_CONCURRENT=5` | **Postgres LISTEN/NOTIFY** + tmux | 146k |
| hcom | Peer messaging + spawn each other | Many independent | SQLite + 127.0.0.1 PTY inject | 91k |
| metaswarm | Prompt library (no runtime) | N/A (host's) | BEADS issues + JSONL | 13k md + 1.5k code |

### External baggage / defaults

| Repo | Heavy deps | Default permission posture |
|---|---|---|
| superset-sh | Electron desktop app | `acceptEdits` |
| catlog22/CCW | better-sqlite3, node-pty (native) | `bypassPermissions` |
| claw-empire | pixi.js, Remotion, pptxgenjs, hardcoded Google OAuth secrets | `--dangerously-skip-permissions` (mandatory) |
| OpenSwarm | LanceDB + xenova/transformers, Linear/Discord coupling | **`bypassPermissions` everywhere** |
| maestro | None (plain MCP server) | Inherits user's |
| cook | None | `--permission-mode acceptEdits` |
| mco | None | **`bypassPermissions` hardcoded** |
| genie | **tmux + Postgres + bun** mandatory | `--permission-mode auto` forced |
| hcom | Optional MQTT for cross-device | (per launch) |
| metaswarm | **`bd` (BEADS) CLI** required, 100% coverage gate | (host's) |

## Tier ranking

For a user with this dashboard who wants lightweight orchestration
on top, billed via Max, with hooks preserved:

### Tier 1 — Best architectural fit

1. **maestro-orchestrate** (Claude Code plugin). Never spawns
   Claude; inherits host auth and hook config. Apache-2.0. Watch
   its `PreToolUse:Bash` policy enforcer (could conflict with the
   dashboard's hooks).
2. **rjcorwin/cook** (CLI subprocess reference). Smallest readable
   implementation: ~700 LOC of orchestration logic in
   `native-runner.ts` + `loop.ts` + `executor.ts`. Five-primitive
   AST is genuinely elegant. **License absent** — read it, don't
   ship a fork.
3. **mco-org/mco** (parallel fan-out + consensus). ~13k LOC, MIT,
   easy to bolt on. Override `bypassPermissions` default before
   adopting.

### Tier 2 — Powerful but you'll fight the framework

1. **OpenSwarm** — strongest worker→reviewer→tester pattern; GPL-3
   forces sibling-process integration only.
1. **catlog22/CCW** — most sophisticated multi-CLI DAG; ships its
   own dashboard (overlaps with this user's). Vendor only
   `cli-executor-core.ts` + `flow-executor.ts` (~5k LOC of the
   210k total).
1. **hcom** — most interesting orchestration *concept* (peer
   messaging). Implementation is SQLite polling + PTY TCP
   injection. Writes 10 hooks into settings.json (additively).

### Tier 3 — Wrong shape

1. **superset-sh/superset** — 380k-LOC Electron desktop app, ELv2
   license. Replaces the dashboard's UI rather than complementing
   it.
1. **claw-empire** — literal pixi.js office simulator with 110k
   LOC of unrelated baggage. Hardcoded Google OAuth secrets in
   repo (base64-obfuscated but committed).
1. **genie** — requires Postgres + tmux + bun; uses
   `git clone --shared`, not real `git worktree` despite
   branding.

### Honorable mention

1. **metaswarm** — config package, not a runtime.
   "Self-improving" oversells a PR-comment-to-FAQ tool. Hard
   BEADS dependency.

## Per-repo verbatim findings

Sorted by stars descending.

### superset-sh/superset (10.3k⭐, ELv2)

**Verdict:** Qualified yes — Max-compatible, hook-merging Electron
desktop app, not a library. Spawns `claude` via `node-pty`:
`packages/host-service/src/trpc/router/settings/agent-presets.ts:33-42`
declares `command: "claude", args: ["--permission-mode",
"acceptEdits"]`. The `@anthropic-ai/sdk` import in
`apps/api/.../run-agent.ts:1` is for a separate Slack-integration
backend, not the desktop agent runtime.

**Orchestration:** tiled panes via `pty-daemon`. Per-workspace git
worktrees. No agent-to-agent communication; this is a
multiplexer + worktree manager, not a swarm.

**Hook merging:** only filters Superset-managed entries,
preserves user hooks
(`agent-wrappers-claude-codex-opencode.ts:217-231`). No
`CLAUDE_HOME`/`CLAUDE_CONFIG_DIR` override.

**Risks:** ELv2 forbids hosting as a service (fine for personal
use, problematic for commercial redistribution); 380k LOC;
replaces this dashboard's UI role rather than complementing it.

### catlog22/Claude-Code-Workflow (2.0k⭐, MIT)

**Verdict:** Qualified yes — 210k-LOC DAG executor. Spawns
`claude` at `ccw/src/tools/cli-executor-core.ts:231` with args
from `ccw/src/tools/cli-executor-utils.ts:346-376`. Hooks
**append** to `~/.claude/settings.json`
(`ccw/src/core/hooks/hook-templates.ts:1036-1059`), never
overwrite. Multi-CLI peer fan-out in one DAG: same flow can
route node A to `claude`, B to `gemini`, C to `codex`.

**Risks:** bus-factor-1 (catlog22 owns 2268 of ~2320 commits);
ships own React/Express/SQLite dashboard overlapping user's;
defaults to `--dangerously-skip-permissions`. Pragmatic move:
vendor only the ~5k LOC of orchestration logic; don't adopt
210k.

### GreenSheep01201/claw-empire (1.1k⭐, Apache-2.0)

**Verdict:** Qualified yes for auth path (subprocess spawn
inherits Max via `~/.claude.json`); strong no for shape
(literal pixi.js office simulator with fixed 6-department /
4-role hierarchy seeded at boot —
`server/modules/bootstrap/schema/seeds.ts:14-63`). 110k LOC
includes Remotion video pipeline, pptxgenjs slide gen, and a
pixi.js renderer — heavy surface area unrelated to
orchestration.

`server/modules/workflow/agents/cli-runtime.ts:239-242` strips
`CLAUDECODE` env so each child becomes a fresh top-level session
(hooks fire). README's "OAuth" refers to GitHub Copilot and
Google Antigravity, **not** Anthropic OAuth (no third-party
Claude OAuth violation).

**Risks:** hardcoded Google `client_id`/`client_secret` in repo
at `server/oauth/helpers.ts:46-55` (base64-obfuscated but
committed); single-maintainer; per-spawn session explosion on
the dashboard.

### unohee/OpenSwarm (626⭐, GPL-3)

**Verdict:** Strong yes (architecturally) with caveat. Genuinely a
`claude` CLI subprocess orchestrator:
`src/adapters/claude.ts:50` runs
`claude -p ... --output-format stream-json --verbose
--permission-mode bypassPermissions`. No `@anthropic-ai/sdk` in
`src/`. Quota tracker reads OAuth-authenticated user's quota at
`src/support/quotaTracker.ts:59`.

**Orchestration:** fixed sequential pipeline
(`worker → reviewer → tester → documenter`, optional `auditor` /
`skill-documenter`) with iteration on reviewer rejection.

**Risks:** GPL-3.0 (recently switched from MIT) — embed/link
infects your code; spawn as sibling process only.
`bypassPermissions` everywhere. Solo author (Heewon Oh, 148
commits combined). Korean code comments throughout.

### josstei/maestro-orchestrate (397⭐, Apache-2.0)

**Verdict:** Strong yes — plugin architecture inherits Max auth
and hook config; never spawns Claude itself. The "39 specialists"
are Claude Code subagent `.md` files at `claude/agents/*.md`. The
MCP server (`src/mcp/maestro-server.js`) is a thin state and
validation kernel exposing ~13 tools (`validate_plan`,
`transition_phase`, etc.) across 3 packs. State persists to
`<workspace>/docs/maestro/state/active-session.md` (markdown, no
DB).

`grep -rn "spawn|child_process|@anthropic"` returns only
`execFileSync('diff', ...)` at `src/generator/file-writer.js:40`
and `execSync` for git in `src/core/project-root-resolver.js:5`.

**Tests:** 86 unit/integration files via `node --test`, c8
coverage.

**Risks:** single-maintainer (josstei owns 74 commits); very
young (rapid v1.6.x releases in same month); orchestration logic
lives in agent prompts/skills (markdown), not testable code, so
behavior depends on lead-model adherence; aggressive
`PreToolUse:Bash` policy enforcer
(`claude/scripts/policy-enforcer.js`) could conflict with the
user's dashboard hooks if the user also gates Bash.

### rjcorwin/cook (367⭐, no LICENSE)

**Verdict:** Qualified yes — clean ~4.3k LOC TypeScript reference.
Spawns `claude` directly via `NativeRunner.buildCommand` at
`src/native-runner.ts:114-118` (`cmd: 'claude', args: ['--model',
model, '--permission-mode', 'acceptEdits', '-p', ...]`).
Five-primitive AST in `executor.ts`
(`work` / `repeat` / `review` / `ralph` / `composition`), true
parallelism via `Promise.all` over per-branch git worktrees.
Auth via `~/.claude/.credentials.json`; never
`ANTHROPIC_API_KEY` for the Claude path.

**Risks:** no LICENSE file (legal risk to redistribute);
single-maintainer (rjcorwin owns 195 of 220 commits); tests are
markdown smoke specs not executable suites; depends on Ink/React
19 for TUI.

### mco-org/mco (331⭐, MIT)

**Verdict:** Qualified yes — 13.4k LOC Python, parallel multi-CLI
fan-out with consensus. `subprocess.Popen` at
`runtime/adapters/shim.py:118` launches `["claude", "-p",
"--permission-mode", "bypassPermissions", "--output-format",
"text", prompt]` (`runtime/adapters/claude.py:39-47`).
`_sanitize_env` only strips `CLAUDECODE`. No
`ANTHROPIC_API_KEY` in `runtime/`.

**Orchestration:** static fan-out — `ThreadPoolExecutor` at
`runtime/review_engine.py:805` launches one subprocess per
provider in parallel, aggregates after. Two top-level commands:
`run` (general task, optional `--synthesize`) and `review`
(structured-findings JSON contract with consensus scoring,
optional `--debate` / `--divide`).

**Risks:** 2-author bus factor; v0.9.x pre-1.0 contracts may
shift; `bypassPermissions` default surprises users expecting
tool prompts; optional EverMemos memory feature reaches a
third-party SaaS (`runtime/cli.py:1127`).

### automagik-dev/genie (307⭐, MIT)

**Verdict:** Qualified yes — Max-compatible CLI subprocess path
exists, but framework imposes heavy infra (tmux + PostgreSQL +
bun) and uses `git clone --shared` rather than true
`git worktree` (`src/lib/team-manager.ts:8` explicitly disables
worktrees due to a "worktree bug"). Brand mismatch:
documentation says "isolated worktrees", code uses linked
clones.

**Spawn:** `src/lib/provider-adapters.ts:433` resolves `claude`
binary; launch via tmux `send-keys`. Per-agent isolated
checkout under `~/.genie/worktrees/<project>/<team>/`. Postgres
`LISTEN/NOTIFY` for inter-agent state.

**Risks:** tmux + PostgreSQL + bun ≥1.3.10 mandatory; injects
own `PreToolUse`/`PostToolUse`/`UserPromptSubmit`/`Stop` hooks
into every spawn (deep-merge with user's settings.json — both
fire); `--permission-mode auto` forced; 2566 commits in 2026
alone.

### aannoo/hcom (251⭐, MIT, Rust)

**Verdict:** Qualified yes — Max-compat and hook-friendly, heavy
footprint. No `reqwest`/`anthropic` SDK in `Cargo.toml`. Tool
resolution: `LaunchTool::Claude => "claude"` at
`src/launcher.rs:976`. Headless: `claude -p --output-format
stream-json --verbose`.

**Orchestration:** messages are rows in a shared SQLite at
`~/.hcom/`; `hcom send @luna -- text` inserts a message; the
agent's own `Stop` hook polls the DB and injects message text
into PTY via `TcpStream::connect("127.0.0.1:{port}")`.
"Spawning" = agent shells `hcom 1 claude --headless
--hcom-prompt "..."`. MQTT exists only for cross-device sync.

**Hook impact:** writes 10 hook events to
`~/.claude/settings.json` (`src/hooks/claude.rs:1907-1918`),
preserves non-hcom hooks (`remove_hcom_hooks_from_settings` at
`:2083`). `Stop` hook returns **exit code 2** to inject
(signals "blocking feedback"); user's dashboard hook is
unaffected but turn semantics change.

**Risks:** writes user's settings.json; PTY injection via
127.0.0.1 TCP with no auth; SQLite as message bus has
write-contention ceiling; pre-1.0 (v0.7.14, 206 commits total).

### dsifry/metaswarm (241⭐, MIT)

**Verdict:** Qualified yes (architecturally) — Claude Code plugin
/ prompt library, **not** a runtime. Total surface: ~13k LOC of
markdown agent prompts/skills/commands plus ~1.5k LOC of bash/JS
for installer and PR-comment fetching. Orchestration is
performed by Claude Code's own `Task` tool dispatching subagents
whose system prompts are `agents/*.md` files.

**"Self-improving" debunked:** the only mechanism is
`/self-reflect` (`commands/self-reflect.md`), which mines
CodeRabbit PR comments and asks the user to approve adding text
"facts" to a BEADS knowledge JSONL. Zero code modifies agent
definitions, skills, or prompts.

**Risks:** solo maintainer (Dave Sifry, 104 commits); hard `bd`
(BEADS) CLI dependency; 19 agent prompts unverified by tests;
v0.11.0 with breaking version bumps every few weeks.

## Common patterns observed across the field

- **`bypassPermissions` is the default in 4 of 10 surveyed.** For
  an observability-focused dashboard, this is a footgun: agents
  execute arbitrary bash with no approval gate, and the dashboard
  records it all. Always override to `default` or `acceptEdits`
  if adopting.
- **Multi-CLI orchestration is a recurring pitch but adds zero
  value for a Claude-only user.** Each provider abstraction is
  ~60–100 LOC of arg-builder. Don't pay complexity tax for
  capability you won't use.
- **Solo-maintainer bus factor is the dominant non-technical
  risk.** 7 of 10 surveyed are dominated by one author (often
  >90% of commits). Pin commits, don't track HEAD; or vendor
  what you need.
- **The size-vs-clarity gradient is striking.** `cook` does the
  same core primitive (parallel `claude -p` in worktrees) in
  4.3k LOC that genie does in 146k and superset does in 380k.
  The "right" tool for this dashboard is closer to "read cook,
  write 200 lines" than "adopt anything."
- **Most "orchestrators" are spawn-and-aggregate, not true
  orchestration.** Only hcom (peer messaging), genie (Postgres
  event store), and CCW (DAG with cross-stage data flow) have
  meaningful inter-agent coordination beyond text-passing.
