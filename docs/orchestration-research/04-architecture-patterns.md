# 04 — Architecture Patterns

Ten orchestration patterns observed in the surveyed projects, each
with a Mermaid diagram, where it's used, and tradeoffs.

## 1. Observe-only dashboard (current state)

**Used by:** This project (Claude-Code-Agent-Monitor).

```mermaid
flowchart LR
  CC["Claude Code session"]
  HH["hook-handler.js"]
  API["Express API :4820"]
  DB[("SQLite")]
  WS{{"WebSocket"}}
  UI["React UI :5173"]

  CC -->|"8 lifecycle events"| HH
  HH -->|"POST /api/hooks/event<br>fail-safe, exit 0"| API
  API -->|"INSERT/UPDATE"| DB
  API -->|"broadcast"| WS
  WS -->|"live updates"| UI
  DB -.->|"REST queries"| API
```

**Tradeoffs.** Zero risk to running agents (nothing flows back).
Cannot spawn or control anything. Hook handler always exits 0
(gotcha #2). Orchestration must be a separate process.

---

## 2. Task tool fork-join (in-process)

**Used by:** Claude Code itself; demonstrated in this conversation
(9 parallel `Task` calls produced the orchestrator analysis).

```mermaid
flowchart TD
  P[Parent Claude session]
  S1[Subagent 1]
  S2[Subagent 2]
  S3[Subagent 3]
  SN[Subagent N]
  R[Synthesis at parent]

  P -->|"dispatch via Task tool"| S1
  P -->|"dispatch"| S2
  P -->|"dispatch"| S3
  P -->|"dispatch"| SN

  S1 -->|"final message only"| R
  S2 -->|"final message only"| R
  S3 -->|"final message only"| R
  SN -->|"final message only"| R
```

**Tradeoffs.** Native, free, parallel. No inter-subagent
communication during execution. Single final-message return; no
streaming, no partial results. No mid-flight cancel. Subagent
internal tool calls don't fire user hooks (gotcha #6 — backfilled
post-hoc from JSONL by `scanAndImportSubagents`).

---

## 3. CLI subprocess pool (multi-process)

**Used by:** OpenSwarm, mco, cook, hcom — all surveyed CLI
orchestrators.

```mermaid
flowchart TD
  ORC[Orchestrator process]
  C1["claude -p (session 1)"]
  C2["claude -p (session 2)"]
  C3["claude -p (session 3)"]
  HOOKS["~/.claude/settings.json hooks"]
  DASH[Dashboard]

  ORC -->|"spawn"| C1
  ORC -->|"spawn"| C2
  ORC -->|"spawn"| C3

  C1 --> HOOKS
  C2 --> HOOKS
  C3 --> HOOKS

  HOOKS -->|"POST /api/hooks/event"| DASH

  C1 -.->|"stream-json stdout"| ORC
  C2 -.->|"stream-json stdout"| ORC
  C3 -.->|"stream-json stdout"| ORC
```

**Tradeoffs.** Full per-process control: cwd, env, kill, settings.
Hooks fire live for everything. Each subprocess is a fresh
top-level session. Highest overhead per agent (~1–2s spawn time).
Most flexible model — anything you can express in a shell script,
you can orchestrate.

---

## 4. Claude Code plugin (in-host)

**Used by:** maestro-orchestrate, metaswarm.

```mermaid
flowchart TD
  HOST["Host Claude session<br>(Max-authed)"]
  PLUGIN["Plugin: subagents + MCP server"]
  MCP[("MCP state kernel")]
  S1["Subagent: planner"]
  S2["Subagent: coder"]
  S3["Subagent: reviewer"]

  HOST -->|"loads on session start"| PLUGIN
  PLUGIN -->|"defines"| S1
  PLUGIN -->|"defines"| S2
  PLUGIN -->|"defines"| S3
  PLUGIN -->|"runs"| MCP

  HOST -->|"Task() dispatch"| S1
  HOST -->|"Task() dispatch"| S2
  HOST -->|"Task() dispatch"| S3

  S1 -.->|"validate_plan"| MCP
  S2 -.->|"transition_phase"| MCP
  S3 -.->|"validate_plan"| MCP
```

**Tradeoffs.** Inherits host auth, hooks, settings. Zero subprocess
overhead. Constrained by Task tool's limitations (no inter-subagent
comm, single-message return). MCP server provides shared state and
phase gates. Best fit when you want orchestration *inside* an
existing Claude Code session.

---

## 5. Pipeline (linear stages)

**Used by:** OpenSwarm
(`worker → reviewer → tester → documenter`).

```mermaid
flowchart LR
  IN[Task input]
  W[Worker]
  R[Reviewer]
  T[Tester]
  D[Documenter]
  OUT[Final artifact]

  IN --> W
  W -->|"output text"| R
  R -->|"approved"| T
  R -.->|"rejected, retry"| W
  T --> D
  D --> OUT
```

**Tradeoffs.** Predictable, debuggable, linear cost. Reviewer can
loop back to worker on rejection. Brittle when stages depend on
emergent context. Each stage is a separate `claude -p` invocation;
prior stage's output becomes prompt input to next.

---

## 6. DAG (directed acyclic graph)

**Used by:** catlog22/CCW (most explicit DAG executor surveyed).

```mermaid
flowchart TD
  IN[Spec]
  PLAN[Planner]
  A[Backend agent]
  B[Frontend agent]
  C[DB migration agent]
  REV[Reviewer]
  PR[Pull request]

  IN --> PLAN
  PLAN --> A
  PLAN --> B
  PLAN --> C
  A --> REV
  B --> REV
  C --> REV
  REV --> PR
```

**Tradeoffs.** Topological execution with parallel branches that
share a single planner upstream and a single reviewer downstream.
CCW interpolates `{{var}}` from upstream node outputs into
downstream prompts. Multi-CLI peers possible (A→`claude`,
B→`gemini`, C→`codex`). Requires you to model the workflow as a
graph upfront — heavy for ad-hoc tasks.

---

## 7. Peer messaging

**Used by:** aannoo/hcom.

```mermaid
flowchart LR
  A1["Agent @alice"]
  A2["Agent @bob"]
  A3["Agent @carol"]
  BUS[("SQLite message DB<br>~/.hcom/")]
  PTY1["PTY 127.0.0.1:port1"]
  PTY2["PTY 127.0.0.1:port2"]
  PTY3["PTY 127.0.0.1:port3"]

  A1 -->|"hcom send @bob"| BUS
  A2 -->|"hcom poll<br>(via Stop hook, exit 2)"| BUS
  BUS -.->|"PTY inject text"| PTY2
  PTY2 --> A2
  A2 -->|"hcom send @carol"| BUS
  A3 -->|"hcom poll"| BUS
  BUS -.->|"PTY inject text"| PTY3
  PTY3 --> A3
```

**Tradeoffs.** Emergent dynamics possible: review loops,
ensembles, fork-and-investigate. Mechanically heavy: SQLite
polling on each agent's `Stop` hook + PTY TCP injection on
127.0.0.1. Requires designing agent prompts around the messaging
primitive ("send `hcom send @reviewer-` then `hcom stop`").
"Spawning" each other = `hcom claude --headless` invocations.

---

## 8. Worktree race (parallel exploration)

**Used by:** rjcorwin/cook (`composition` primitive with `vN`/`vs`
racing).

```mermaid
flowchart TD
  P["Parent task"]
  W1["git worktree A: claude approach 1"]
  W2["git worktree B: claude approach 2"]
  W3["git worktree C: claude approach 3"]
  PICK["Resolver: pick / merge / compare"]
  WIN["Winning approach merged"]
  CLEAN["Cleanup registry deletes losers"]

  P -->|"Promise.all"| W1
  P -->|"Promise.all"| W2
  P -->|"Promise.all"| W3

  W1 -->|"first to finish"| PICK
  W2 -->|"AbortController cancels losers"| PICK
  W3 -->|"AbortController cancels losers"| PICK

  PICK --> WIN
  W2 --> CLEAN
  W3 --> CLEAN
```

**Tradeoffs.** True parallel exploration with full filesystem
isolation. Cost scales linearly with N (each worktree burns full
inference). Cleanup registry needed to delete losing worktrees.
Uses real `git worktree` (unlike genie's `git clone --shared`).
First-finish wins is an opinionated cost/quality tradeoff.

---

## 9. Hierarchical / supervisor (CEO → dept → role)

**Used by:** claw-empire (literal office sim with 6 SQL-seeded
departments), genie (10-critic council).

```mermaid
flowchart TD
  CEO[CEO agent]
  P[Planning lead]
  D[Development lead]
  Q[QA lead]
  P1[Senior planner]
  P2[Junior planner]
  D1[Senior dev]
  D2[Junior dev]
  D3[Junior dev]
  Q1[Tester]

  CEO --> P
  CEO --> D
  CEO --> Q
  P --> P1
  P --> P2
  D --> D1
  D --> D2
  D --> D3
  Q --> Q1
```

**Tradeoffs.** Clear authority, easy to reason about. Rigid:
can't flexibly recompose roles per task. claw-empire bakes 6
departments into a SQL seed at `seeds.ts:14-63`; genie's
"10-critic council" is similarly fixed. Good for "company
simulation" demos, overkill for ad-hoc orchestration.

---

## 10. Tiled panes (multiplexer)

**Used by:** superset-sh/superset (Electron + node-pty).

```mermaid
flowchart LR
  USER["User"]
  WS["Workspace tab"]
  P1["Pane 1<br>claude in worktree A"]
  P2["Pane 2<br>claude in worktree B"]
  P3["Pane 3<br>codex in worktree C"]
  P4["Pane 4<br>terminal"]

  USER --> WS
  WS --> P1
  WS --> P2
  WS --> P3
  WS --> P4
```

**Tradeoffs.** No agent-to-agent communication; coordination is
purely visual ("user looks at panes side-by-side"). Excellent
ergonomics for human-in-the-loop multi-agent work. Not a
swarm — agents don't know about each other. Per-workspace git
worktree isolation. Long-lived `pty-daemon` survives host-service
restarts.

---

## 11. Hybrid: dashboard + plugin + subprocess (recommended)

**Recommended posture for this project.**

This combines the strengths of each pattern while preserving the
dashboard's observe-only commitment.

```mermaid
flowchart TB
  subgraph Local["Local machine"]
    HOST["Claude Code session<br>(Max-authed)"]
    PLUGIN["maestro-orchestrate plugin"]
    SUB1["claude -p subprocess #1"]
    SUB2["claude -p subprocess #2"]
    HOOKS["~/.claude/settings.json hooks"]
    JSONL["~/.claude/projects/.../subagents/*.jsonl"]
  end

  subgraph Dashboard["Claude-Code-Agent-Monitor (observe-only)"]
    HH["hook-handler.js"]
    API["Express :4820"]
    DB[("SQLite")]
    UI["React :5173"]
    SCAN["scanAndImportSubagents<br>post-hoc backfill"]
  end

  HOST -->|"Task() dispatch (in-host)"| PLUGIN
  HOST -->|"shell out (out-of-host)"| SUB1
  HOST -->|"shell out"| SUB2

  HOST --> HOOKS
  SUB1 --> HOOKS
  SUB2 --> HOOKS
  PLUGIN -.->|"internal Task subagents<br>NO hooks fire"| JSONL

  HOOKS -->|"live POST"| HH
  HH --> API
  JSONL -.->|"post-hoc on SubagentStop"| SCAN
  SCAN --> DB
  API --> DB
  DB --> UI
```

**Tradeoffs.** Best of all worlds:

- Live observability for top-level sessions and `claude -p`
  subprocesses (hooks fire).
- Post-hoc observability for plugin-dispatched subagents
  (JSONL backfill via `scanAndImportSubagents`).
- Dashboard never modified — upstream merges from
  `hoangsonww/Claude-Code-Agent-Monitor` remain clean.
- Orchestrator choice (plugin vs. subprocess vs. both) is
  decoupled from the dashboard.
- Max billing throughout: plugin inherits host auth; subprocesses
  use `claude /login` credentials.

This is the architecture this research recommends. Implementation
is incremental:

1. Install `maestro-orchestrate` as a Claude Code plugin to get
   immediate multi-agent capability.
2. When you outgrow plugin-only orchestration, add a small Node
   script that spawns `claude -p` subprocesses for long-running
   work or peer dynamics.
3. The dashboard observes both modes for free.

## Pattern selection guide

| If your task shape is… | Use pattern |
|---|---|
| "Run N independent analyses, synthesize" | 2 — Task fork-join |
| "Drive code through review/test stages" | 5 — Pipeline |
| "Plan-then-fan-out across components" | 6 — DAG |
| "Try N approaches, keep the best" | 8 — Worktree race |
| "Long-running agents that watch/respond to each other" | 7 — Peer messaging |
| "Human-in-the-loop multi-agent dev" | 10 — Tiled panes |
| "Methodology-as-plugin (gated phases)" | 4 — Plugin |
| "Need persistence + Task speed" | 11 — Hybrid |

## What none of these solve

- **Reliable cross-machine distribution.** Even hcom's MQTT and
  genie's Postgres `LISTEN/NOTIFY` are tuned for local
  same-machine sync, not multi-region orchestration.
- **Token-cost budgeting.** No surveyed orchestrator exposes a
  "stop spending after $X" gate. You roll your own quota check
  via `claude` CLI's quota endpoint
  (`api.anthropic.com/api/oauth/usage`).
- **Deterministic replay of full agent reasoning.** Best you get
  is JSONL transcripts; internal model state is unrecoverable.
- **Native cancellation of in-flight Task subagents.** Only
  CLI-subprocess patterns let you `kill PID` mid-run.

Plan around these gaps; do not assume any framework hides them.
