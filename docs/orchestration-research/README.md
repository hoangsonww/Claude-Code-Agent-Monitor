# Orchestration Research

Research notes from session **2026-05-04** investigating how to add
multi-agent orchestration on top of this dashboard while billing
through a Claude Max subscription rather than an Anthropic API key.

## TL;DR

- The Claude Agent SDK does **not** support Max-plan auth. Anthropic
  policy explicitly forbids subscription auth for products built on
  the SDK.
- Two Max-compatible orchestration paths exist:
  1. **Spawn the `claude` CLI binary as a subprocess** — the CLI is
     authenticated via `claude /login` against the user's Max plan.
  2. **Run as a Claude Code plugin** (subagents + MCP server) — the
     plugin inherits whatever auth the host session is using.
- Claude Code's built-in `Task` tool **is** a real orchestration
  primitive (used inline for the 9-way analysis that produced this
  doc). It's fork-join only, has no inter-subagent messaging, and
  has a notable observability gap: subagent tool calls do **not**
  fire `~/.claude/settings.json` hooks. The dashboard papers over
  this via the post-hoc `scanAndImportSubagents` JSONL scan.
- Of nine third-party orchestrators surveyed in source, the
  strongest fits for this dashboard's constraints are
  `josstei/maestro-orchestrate` (Claude Code plugin) and
  `rjcorwin/cook` (clean ~4.3k LOC CLI-subprocess reference).

## Files in this directory

- `01-current-architecture.md` — the dashboard's observe-only design
  and why orchestration **does not belong inside it**.
- `02-claude-orchestration-options.md` — Anthropic auth/billing
  paths, the Task tool's capabilities and limitations, when to use
  which primitive.
- `03-third-party-orchestrators.md` — full feature score matrix and
  per-repo findings for nine surveyed projects.
- `04-architecture-patterns.md` — ten Mermaid diagrams of
  orchestration **topology** patterns (how agents compose).
- `05-runtime-comparison.md` — local LLM vs API vs CLI-session
  **runtime substrate**, with diagrams and a 15-axis comparison
  matrix; orthogonal to file 04.
- `06-agentic-pattern-archetypes.md` — canonical pattern catalog
  (single-agent, multi-agent, frontier) with a decision tree and
  Claude Code CLI implementation sketches for each pattern.
- `07-claude-code-hidden-features.md` — in-depth tour of features
  in Claude Code v2.1.128: built-in MCP servers, power-user CLI
  flags, subcommands, hook events (incl. PreCompact/PostCompact),
  hidden gems (Channels, Routines, Tool Search, etc.), changelog
  highlights, and worked examples for each.
- `08-claudeclaw-deep-dive.md` — four-axis Supervisor + Worker
  analysis of `moazbuilds/claudeclaw`: lineage vs OpenClaw,
  architecture (pure `claude` CLI subprocess daemon), parallels
  with Claude Code v2.1.128 + Cowork, and practical fit for this
  project. Includes the env-stripping daemon trick worth stealing.
- `09-memory-and-rag.md` — how Claude Code's memory system works
  (CLAUDE.md + auto memory), the absence of vector RAG, the
  retrieval-flavored mechanisms that *are* present (MEMORY.md
  index, path-scoped rules, lazy nested loading), auto memory
  internals from binary inspection, and how to bolt on real RAG
  if needed.
- `10-pwa-on-dashboard-design.md` — design for extending this
  dashboard with mobile/management features as a PWA, opt-in
  behind `ORCHESTRATOR_ENABLED=1`. 7-phase plan, decision points,
  patterns reused from prior research.
- `11-build-summary.md` — overnight implementation of file 10,
  Phases 0-6. 7,300+ lines of new code across 33 files, 459/459
  tests pass, all behind feature flag. Built using Supervisor +
  Worker fan-out (4 rounds × 2 parallel agents).

## Quick decision tree

| If you want… | Pick |
|---|---|
| Cleanest architectural fit (zero auth/hook surgery) | `maestro-orchestrate` (plugin) |
| To learn the pattern and write your own | `rjcorwin/cook` (read it) |
| Parallel multi-agent review with consensus | `mco-org/mco` |
| Fixed worker→reviewer→tester pipeline | `OpenSwarm` (sibling process only — GPL-3) |
| Multi-CLI DAG (Claude + Codex + Gemini peers) | `catlog22/CCW` (vendor 5k LOC) |
| Peer-messaging dynamics | `aannoo/hcom` (back up settings.json) |
| Multi-pane GUI (replaces the dashboard frontend) | `superset-sh/superset` (ELv2) |

See `03-third-party-orchestrators.md` for full analysis.

## Recommended posture

Keep this dashboard **observe-only**. Run any orchestrator as a
**separate process** (or as a Claude Code plugin). The dashboard
already ingests live hooks at `POST /api/hooks/event` and backfills
subagent trees from JSONL. Both observation modes work for free with
zero changes to dashboard code.

See `04-architecture-patterns.md` § *10. Hybrid: dashboard + plugin +
subprocess* for the target topology.

## Methodology

- 9 parallel `Task`-tool dispatches, one per repo.
- Each subagent cloned the target repo via
  `gh repo clone <repo> /tmp/<name>-research`, inspected source
  (not just READMEs), and returned a structured ≤350-word analysis.
- Token cost: ≈540k tokens against the user's Max plan, ≈3 minutes
  wall time.

## Setup state at the time of research

- Host: macOS Darwin 24.6.0, Node v25.4.0, npm 11.7.0.
- Repo on master at `a67d113` (3 commits ahead of the
  `a976fb6` initial clone — fast-forwarded during this session).
- Dashboard running:
  - API on `http://localhost:4820`
  - Vite dev UI on `http://localhost:5173`
  - 13 legacy sessions auto-imported on startup.
- Hooks installed: 8 lifecycle events wired in
  `~/.claude/settings.json` via `npm run install-hooks`. Backup
  saved as `~/.claude/settings.json.pre-install-hooks-<ts>.bak`.
