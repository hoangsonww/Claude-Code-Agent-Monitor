# Claude Code Agent Monitor — Plugin Marketplace

Official Claude Code plugins for the Agent Monitor dashboard. **10 plugins** extend Claude Code with skills, agents, slash commands, hooks, and CLI tools for deep analytics, cost guardrails, productivity automation, developer tools, AI-powered insights, session forensics, workflow/fleet intelligence, reliability & SLOs, config & memory governance, and dashboard connectivity.

Every plugin is powered by the local Agent Monitor REST API at `http://localhost:4820`. They are read-only advisors unless a skill explicitly documents a mutating endpoint (and those preview + confirm before acting).

## Quick Start

### Add the marketplace

```bash
claude plugin marketplace add hoangsonww/Claude-Code-Agent-Monitor
```

### Install a plugin

```bash
claude plugin install ccam-analytics@hoangsonww-claude-code-agent-monitor
claude plugin install ccam-cost-guard@hoangsonww-claude-code-agent-monitor
claude plugin install ccam-productivity@hoangsonww-claude-code-agent-monitor
claude plugin install ccam-devtools@hoangsonww-claude-code-agent-monitor
claude plugin install ccam-insights@hoangsonww-claude-code-agent-monitor
claude plugin install ccam-sessions@hoangsonww-claude-code-agent-monitor
claude plugin install ccam-workflows@hoangsonww-claude-code-agent-monitor
claude plugin install ccam-quality@hoangsonww-claude-code-agent-monitor
claude plugin install ccam-config@hoangsonww-claude-code-agent-monitor
claude plugin install ccam-dashboard@hoangsonww-claude-code-agent-monitor
```

### Or install locally during development

```bash
# From the repo root, test a plugin locally
claude --plugin-dir plugins/ccam-analytics
```

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- Agent Monitor dashboard running at `http://localhost:4820` (see [SETUP.md](../SETUP.md))
- Hooks installed: `npm run setup` from the Agent Monitor project

Skills and commands are invoked as `/ccam-<plugin>:<name>`. Agents are dispatched automatically by Claude Code (or named explicitly).

## Available Plugins

### 1. `ccam-analytics` — Analytics & Monitoring

Deep analytics on sessions, token usage, costs, cache efficiency, model mix, and productivity.

| Skill | Command | Purpose |
|-------|---------|---------|
| Session Report | `/ccam-analytics:session-report` | Per-model tokens (input/output/cache_read/cache_write + baselines), cost, agent hierarchy, tool activity, timeline |
| Cost Breakdown | `/ccam-analytics:cost-breakdown` | Per-model cost via the pricing engine, daily trends, cache efficiency, optimization opportunities |
| Usage Trends | `/ccam-analytics:usage-trends` | 365-day session/event trends, token volume, tool rankings, model distribution, event-type ratios |
| Productivity Score | `/ccam-analytics:productivity-score` | Weighted scorecard: completion, token efficiency, tool effectiveness, velocity, cost efficiency |
| Cache Efficiency | `/ccam-analytics:cache-efficiency` | Cache hit rate, write-vs-read reuse, sessions with poor cache reuse |
| Model Mix | `/ccam-analytics:model-mix` | Share of tokens and cost per model family; expensive models doing cheap work |

**Commands:** `/ccam-analytics:cost-today` · `/ccam-analytics:top-spenders` · `/ccam-analytics:burn-rate`

**Agents:** `analytics-advisor` (full advisor incl. workflow intelligence) · `token-economist` (token economics & reduction tactics)

**Hooks:** Logs `Stop` / `SubagentStop` events. **CLI:** `ccam-stats` — terminal stats (sessions, cost, tokens).

---

### 2. `ccam-cost-guard` — Budget Guardrails

Spend limits, forecasting, cost alerts, and model-routing savings.

| Skill | Command | Purpose |
|-------|---------|---------|
| Budget Set | `/ccam-cost-guard:budget-set` | Define a budget and (optionally) arm a `token_threshold` alert rule; explains the $→token conversion |
| Spend Forecast | `/ccam-cost-guard:spend-forecast` | Project week/month-end spend from the daily trend (moving average × remaining days) |
| Cost Alert | `/ccam-cost-guard:cost-alert` | Review alert rules and fired alerts; explain exactly what tripped |
| Model Savings | `/ccam-cost-guard:model-savings` | Estimate $ saved by routing eligible work to a cheaper model family |
| Daily Budget Check | `/ccam-cost-guard:daily-budget-check` | Today's spend vs a daily budget, pace vs target, projected overage |

**Commands:** `/ccam-cost-guard:budget` · `/ccam-cost-guard:forecast` · `/ccam-cost-guard:overspend`

**Agent:** `budget-sentinel` — watches spend vs target, projects month-end, recommends cuts. **Hooks:** fail-safe `Stop` event POST so budget tracking sees session ends.

---

### 3. `ccam-productivity` — Productivity & Workflows

Standups, weekly/monthly reviews, sprint tracking, focus analysis, and workflow optimization.

| Skill | Command | Purpose |
|-------|---------|---------|
| Daily Standup | `/ccam-productivity:daily-standup` | Standup from recent sessions — work by project (cwd), costs, tools, errors, velocity |
| Weekly Report | `/ccam-productivity:weekly-report` | Daily session/event trends, per-session costs, token volumes, tool top-20, completion rates |
| Sprint Summary | `/ccam-productivity:sprint-summary` | Per-project + per-model costs, token efficiency, subagent effectiveness, retrospective data |
| Workflow Optimizer | `/ccam-productivity:workflow-optimizer` | Tool-flow transitions, effectiveness, delegation, error propagation, concurrency, compaction |
| Monthly Review | `/ccam-productivity:monthly-review` | Month-over-month sessions, cost, tokens, completion, top projects, notable shifts |
| Time of Day | `/ccam-productivity:time-of-day` | Activity/productivity bucketed by hour and day-of-week; peak vs low-output windows |

**Commands:** `/ccam-productivity:standup` · `/ccam-productivity:whats-next` · `/ccam-productivity:focus-report`

**Agents:** `productivity-coach` (work-pattern review) · `focus-analyst` (deep-work / focus blocks). **Hooks:** session start/end timing.

---

### 4. `ccam-devtools` — Developer Tools

Debugging, data-integrity inspection, event tracing, transcript search, diagnostics, export, and health checks.

| Skill | Command | Purpose |
|-------|---------|---------|
| Session Debug | `/ccam-devtools:session-debug` | Full event chain, agent hierarchy, token usage with baselines, workflow intelligence |
| Hook Diagnostics | `/ccam-devtools:hook-diagnostics` | Hook install, connectivity, handler validation, event delivery, data freshness |
| Data Export | `/ccam-devtools:data-export` | Export sessions/events/analytics/costs as JSON/CSV/Markdown |
| Health Check | `/ccam-devtools:health-check` | API, SQLite (WAL), WebSocket, endpoints, hooks, disk, data freshness |
| Event Trace | `/ccam-devtools:event-trace` | Ordered event timeline for a session, highlighting gaps/failures |
| Transcript Grep | `/ccam-devtools:transcript-grep` | Search a session transcript for a string/pattern with context |

**Commands:** `/ccam-devtools:doctor` · `/ccam-devtools:export` · `/ccam-devtools:tail-events`

**Agents:** `issue-triager` (cross-component triage) · `db-inspector` (data-integrity inspection). **CLI:** `ccam-doctor`, `ccam-export`.

---

### 5. `ccam-insights` — AI-Powered Insights

Pattern detection, anomaly alerting, forecasting, regression watch, benchmarking, optimization, and comparison.

| Skill | Command | Purpose |
|-------|---------|---------|
| Pattern Detect | `/ccam-insights:pattern-detect` | Tool-flow transitions, recurring sequences, agent co-occurrence, delegation habits |
| Anomaly Alert | `/ccam-insights:anomaly-alert` | Cost/token/event-ratio/complexity outliers (statistical) |
| Optimization Suggest | `/ccam-insights:optimization-suggest` | Model downgrades, cache optimization, compaction reduction, tool reliability |
| Session Compare | `/ccam-insights:session-compare` | Side-by-side tokens, costs, complexity, tool-flow, metadata deltas |
| Regression Watch | `/ccam-insights:regression-watch` | Rising error rate, falling cache hits, growing compaction, climbing cost/session |
| Benchmark | `/ccam-insights:benchmark` | Benchmark a session vs the rolling average; show percentile |

**Commands:** `/ccam-insights:insights` · `/ccam-insights:compare` · `/ccam-insights:anomalies`

**Agents:** `insights-advisor` (strategic analysis) · `trend-forecaster` (near-future cost/usage projection).

---

### 6. `ccam-sessions` — Session Forensics

Search, timeline, transcript replay, per-project rollups, and lifecycle management.

| Skill | Command | Purpose |
|-------|---------|---------|
| Session Search | `/ccam-sessions:session-search` | Find sessions by project/model/status/date; rank by cost or recency |
| Session Timeline | `/ccam-sessions:session-timeline` | Ordered timeline of one session's events with durations and tool names |
| Transcript Replay | `/ccam-sessions:transcript-replay` | Walk a transcript turn-by-turn, summarizing each message |
| CWD Rollup | `/ccam-sessions:cwd-rollup` | Roll up sessions by working directory: counts, cost, tokens, last-active |
| Session Cleanup | `/ccam-sessions:session-cleanup` | Identify stale/empty sessions; preview before the cleanup endpoint deletes (confirm required) |

**Commands:** `/ccam-sessions:find-session` · `/ccam-sessions:replay` · `/ccam-sessions:recent`

**Agent:** `session-investigator` — end-to-end investigation of a single session.

---

### 7. `ccam-workflows` — Orchestration & Fleet Intelligence

Multi-agent structure analysis using the workflow intelligence API and Workflow-tool run journals.

| Skill | Command | Purpose |
|-------|---------|---------|
| DAG Map | `/ccam-workflows:dag-map` | Orchestration DAG: parent→child subagent edges, depth, fan-out |
| Delegation Audit | `/ccam-workflows:delegation-audit` | Model delegation + subagent effectiveness; wasted delegations |
| Concurrency Report | `/ccam-workflows:concurrency-report` | Concurrency lanes, parallelism, serialization bottlenecks |
| Error Propagation | `/ccam-workflows:error-propagation` | Trace failures by depth and how they cascade across subagents |
| Fleet Runs | `/ccam-workflows:fleet-runs` | Summarize Workflow-tool fleet runs (no-hook fleets ingested from run journals) |

**Commands:** `/ccam-workflows:workflow` · `/ccam-workflows:dag` · `/ccam-workflows:runs`

**Agent:** `orchestration-analyst` — analyzes the 11 workflow datasets + fleet runs.

---

### 8. `ccam-quality` — Reliability & SLOs

Error monitoring, hook-delivery health, SLO tracking with error budgets, and regression alerts.

| Skill | Command | Purpose |
|-------|---------|---------|
| Error Scan | `/ccam-quality:error-scan` | Scan events for APIError + failure signals; group by tool/model; rank by frequency |
| API Error Report | `/ccam-quality:api-error-report` | APIError detail: counts over time, affected sessions/models, likely causes |
| Hook Failure Audit | `/ccam-quality:hook-failure-audit` | PreToolUse/PostToolUse balance, missing terminators, stale ingestion |
| SLO Check | `/ccam-quality:slo-check` | Completion rate, tool success rate, error rate; error budget remaining |
| Regression Alert | `/ccam-quality:regression-alert` | Compare this period's error/failure rates to the prior period; optional alert rule |

**Commands:** `/ccam-quality:errors` · `/ccam-quality:slo` · `/ccam-quality:health`

**Agent:** `reliability-engineer` — treats Claude Code usage as a service with an error budget.

---

### 9. `ccam-config` — Config & Memory Governance

Audit your Claude Code configuration and curate the file-based memory store via the Config Explorer API.

| Skill | Command | Purpose |
|-------|---------|---------|
| Config Audit | `/ccam-config:config-audit` | Counts per surface (user vs project), duplicate skills/agents, shell-running hooks |
| Memory Review | `/ccam-config:memory-review` | CLAUDE.md + per-project auto-memory files grouped by project; flag stale/oversized facts |
| Skill Inventory | `/ccam-config:skill-inventory` | Installed skills + contributing plugins; overlap with your own skills |
| MCP Audit | `/ccam-config:mcp-audit` | MCP servers (user + project): transport, command/args/env names, source file |
| Hook Inventory | `/ccam-config:hook-inventory` | Hooks across settings + the hooks scripts dir; flag network/arbitrary-command hooks |

**Commands:** `/ccam-config:audit-config` · `/ccam-config:memory` · `/ccam-config:inventory`

**Agent:** `config-auditor` — audits config sprawl, duplication, risky hooks, and stale memory.

> Memory Review can also edit the per-project memory store: auto-memory files are mutable via `PUT`/`DELETE /api/cc-config/file` with `{ scope: "auto-memory", type: "auto-memory", project, name }` (always backed up first).

---

### 10. `ccam-dashboard` — Dashboard Connector

Direct MCP integration, quick status, live watch, and endpoint probing.

| Skill | Command | Purpose |
|-------|---------|---------|
| Dashboard Status | `/ccam-dashboard:dashboard-status` | Health: API connectivity, session/event counts, hook status, data freshness |
| Quick Stats | `/ccam-dashboard:quick-stats` | One-line metrics: active sessions, total cost, events, top tool, cache efficiency |
| Live Watch | `/ccam-dashboard:live-watch` | Poll a few times to show live deltas (active sessions/agents, events, ws connections) |
| Endpoint Probe | `/ccam-dashboard:endpoint-probe` | Probe each major API route and report reachability/shape |

**Commands:** `/ccam-dashboard:status` · `/ccam-dashboard:ping` · `/ccam-dashboard:open-dashboard`

**Agent:** `dashboard-operator` — verifies the dashboard is up and guides start/restart/import. **MCP Server:** direct tool access to the Agent Monitor API. **Settings:** default agent model.

---

## Data Model Reference

These plugins query the Agent Monitor API at `http://localhost:4820`. Key data shapes:

### Token Tracking
- **4 token types**: `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`
- **4 baselines**: `baseline_input`, `baseline_output`, `baseline_cache_read`, `baseline_cache_write` (preserve pre-compaction tokens)
- **Effective total** = current + baseline (the `/api/analytics` totals are pre-summed)

### Cost Calculation
- Formula: `(tokens / 1,000,000) × rate_per_mtok` for each token type
- Model matching: longest `model_pattern` wins (e.g., `claude-sonnet-4-5%` beats `claude-sonnet-4%`)
- Pre-seeded rates for Opus, Sonnet, Haiku families

### Session Metadata (JSON)
- `thinking_blocks`: count of extended thinking blocks
- `turn_count`: number of conversation turns
- `total_turn_duration_ms`: cumulative turn processing time
- `usage_extras`: `{ service_tiers[], speeds[], inference_geos[] }`

### Event Types
`PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`, `SessionStart`, `SessionEnd`, `Notification`, `Compaction`, `APIError`, `TurnDuration`

### Workflow Intelligence API (`/api/workflows/{sessionId}`)
11 datasets: `stats`, `orchestration` (DAG), `toolFlow` (transitions), `effectiveness` (subagent success), `patterns` (recurring sequences), `modelDelegation`, `errorPropagation` (by depth), `concurrency` (lanes), `complexity` (score), `compaction` (impact), `cooccurrence` (agent pairs)

### Alert Rules (`/api/alerts/rules`)
Rule types: `token_threshold` (`{ total_tokens }` — the spend-relevant guardrail), `event_pattern`, `inactivity`, `status_duration`.

### Config Explorer (`/api/cc-config/*`)
Read every Claude Code surface (skills, agents, commands, output-styles, plugins, marketplaces, mcp, hooks, settings, keybindings, statusline, memory). `memory` includes the per-project file-based store with `scope: "auto-memory"` (carrying `project`, `name`, `isIndex`, `frontmatter`); those files plus `CLAUDE.md` are mutable via `PUT`/`DELETE /api/cc-config/file` with always-on timestamped backups.

## Plugin Development

To create your own plugins for the Agent Monitor, see the [Claude Code plugin documentation](https://docs.anthropic.com/en/docs/claude-code/plugins).

### Plugin structure

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json          # Required: name (== dir name), description, version
├── skills/
│   └── my-skill/
│       └── SKILL.md         # Skill (description-only frontmatter; uses $ARGUMENTS)
├── agents/
│   └── my-agent.md          # Agent (name == filename, model, tools, instructions)
├── commands/
│   └── my-command.md        # Slash command (description, optional argument-hint)
├── hooks/
│   └── hooks.json           # Event hooks (fail-safe, non-blocking)
├── bin/
│   └── my-cli-tool          # CLI scripts (added to PATH)
├── .mcp.json                # MCP server configuration
└── settings.json            # Plugin settings
```

Structure is validated by `server/__tests__/plugins-marketplace.test.js`, which enforces the marketplace↔directory bijection, `plugin.json` shape, name/dir agreement, and required frontmatter on every agent / skill / command.

### Testing locally

```bash
claude --plugin-dir /path/to/my-plugin   # then use /my-plugin:my-skill some args
```

## Troubleshooting

### Dashboard not reachable
```bash
cd /path/to/Claude-Code-Agent-Monitor
npm start        # or: npm run dev
```

### Hooks not installed
```bash
cd /path/to/Claude-Code-Agent-Monitor
npm run setup
```

### Plugin not found
```bash
claude plugin marketplace list
claude plugin marketplace add hoangsonww/Claude-Code-Agent-Monitor
```

## License

Same as the parent project. See [LICENSE](../LICENSE).
