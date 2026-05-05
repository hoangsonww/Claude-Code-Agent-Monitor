# 02 — Claude Orchestration Options

Three primitives are available to drive Claude programmatically.
Two are Max-compatible; one is not.

## Auth/billing matrix

| Path | Billing | Setup | Live hooks fire? |
|---|---|---|---|
| Anthropic SDK (`@anthropic-ai/sdk`) | API key | `ANTHROPIC_API_KEY` | N/A (not Claude Code) |
| Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) | API key, Bedrock, Vertex, Foundry | env var or cloud auth | N/A |
| `claude` CLI subprocess (`spawn("claude", ...)`) | **Max plan** | `claude /login` once | ✅ live |
| Claude Code `Task` tool (built-in) | **Max plan** (host's) | none | ⚠️ partial — Task dispatch only |
| Claude Code plugin (subagents + MCP) | **Max plan** (host's) | install via marketplace | ✅ live (host's hooks fire) |

## SDK explicitly forbids subscription auth

Quoting the official Claude Agent SDK docs (verified via WebFetch
during this research):

> Unless previously approved, Anthropic does not allow third party
> developers to offer claude.ai login or rate limits for their
> products, including agents built on the Claude Agent SDK.
> Please use the API key authentication methods described in this
> document instead.

Source: <https://code.claude.com/docs/en/agent-sdk/overview>

Implication: any Max-billed orchestration must avoid the SDK and
either shell out to the `claude` CLI binary or run inside a Claude
Code plugin/subagent context.

## CLI subprocess primitive

Canonical pattern (Node.js):

```typescript
import { spawn } from "node:child_process";

const child = spawn("claude", [
  "-p", "Audit auth.ts for vulnerabilities",
  "--output-format", "stream-json",
  "--allowedTools", "Read,Edit,Bash"
], {
  env: { ...process.env }
});

child.stdout.on("data", (chunk) => {
  // parse stream-json events: assistant, user, tool_use, tool_result
});

child.on("exit", (code) => {
  // session ended, code 0 on success
});
```

Each subprocess is a fresh top-level Claude Code session. The
user's `~/.claude/settings.json` hooks (which the dashboard
installs via `npm run install-hooks`) fire normally for every
PreToolUse, PostToolUse, Stop, SubagentStop, etc.

### Useful flags

- `-p / --print` — non-interactive headless mode.
- `--output-format stream-json` — emit per-event JSON to stdout.
- `--allowedTools Read,Edit,Bash` — explicit tool allowlist.
- `--permission-mode default | acceptEdits | bypassPermissions` —
  approval posture. Default is safest; `bypassPermissions` skips
  all tool confirmations.
- `--max-turns N` — cap inference turns per session.
- `--model claude-opus-4-7` — pin a specific model.

### Hook firing during subprocess

The CLI honors whatever is in `~/.claude/settings.json`. Setting
`CLAUDECODE` env var to empty before spawn allows nested Claude
Code sessions (some orchestrators delete this var to defeat
"already inside Claude Code" detection). Hooks fire regardless.

## The Task tool — Claude Code's built-in orchestration

Claude Code ships with a `Task` tool that dispatches **subagents**
(isolated context windows) in-process. Multiple `Task` calls in a
single assistant message run in parallel.

### Capabilities

- Custom typed subagents via `.claude/agents/*.md` (frontmatter:
  `name`, `description`, `tools`, optional `model`, optional
  `isolation: worktree`, optional `color`).
- Description-driven dispatch: Claude reads each agent's
  description text and routes the task to the best match.
- True parallelism: N concurrent `Task` calls in one message → N
  subagents run simultaneously.
- Auth inheritance: subagents are the host session, so they bill
  against whatever auth the parent uses (Max plan supported).

### Hard limitations

| Limitation | Consequence |
|---|---|
| No inter-subagent communication during execution | Siblings sealed once dispatched. To pass data, parent must thread results through prompts. |
| Single final-message return | No streaming, no partial results. Structured output requires prompt-discipline ("≤350 words, exact format"). |
| No persistence/resume across calls | Each Task starts fresh. |
| Subagent tool calls don't fire user hooks | **Major observability gap** — backfilled post-hoc from JSONL. |
| No mid-flight cancel/interrupt | Parent waits for all dispatched agents to return. |
| No concurrency cap | 50 simultaneous Tasks will hit Max rate limits hard. |
| Token costs aggregate at parent | A 9-way fan-out can burn 500k+ tokens in minutes. |
| No nested orchestration unless granted | Subagent must have Task in its tool allowlist. |
| Description-driven routing is fragile | Overlapping descriptions → wrong agent selected. |
| No deterministic replay | Internals opaque to parent beyond JSONL. |

### Granularity of control

**Configurable**: tool allowlist, model override, worktree
isolation, color, dispatch description, runtime prompt.

**Not configurable**: per-call cwd, per-call env vars, hooks at
subagent level, structured-output schemas, token caps, timeouts,
streaming, retry policies, inter-agent channels, persistent
identity across calls.

## Comparison: Task tool vs. CLI subprocess

| Capability | Task tool | `claude -p` subprocess |
|---|:---:|:---:|
| Parallel fork-join | ✅ excellent | ✅ |
| Auth-free (inherits Max) | ✅ | ✅ (CLI is authed) |
| Description-based routing | ✅ unique | ❌ |
| Live inter-agent messaging | ❌ | ✅ (files, sockets, hcom-style) |
| Long-running daemon agents | ❌ | ✅ |
| Mid-flight kill/preempt | ❌ | ✅ (`kill PID`) |
| Cross-machine distribution | ❌ in-process | ✅ |
| Per-agent cwd / env / settings | ❌ | ✅ full |
| Hooks fire for all tool calls | ❌ Task event only | ✅ all events |
| Streaming partial results | ❌ | ✅ `--output-format stream-json` |
| Cost-per-spawn discipline | ⚠️ implicit | ✅ explicit `--max-turns` |
| Native to host | ✅ | ❌ (~1–2s spawn cost) |

## Bottom line

- **Task tool** excels at fork-join with synthesis at the parent
  (research, review, ensemble — exactly what produced this doc).
- **CLI subprocess** excels at anything needing persistence, peer
  comm, mid-flight control, or full live observability.
- They are **complementary primitives**, not competitors. Most
  production orchestrators use both: outer subprocess agents for
  long-running work, inner Task fan-out for analysis bursts.
