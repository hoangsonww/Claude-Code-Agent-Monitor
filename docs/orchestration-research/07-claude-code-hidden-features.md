# 07 — Claude Code Hidden Features (v2.1.128)

A reference of features and tools in the Claude Code CLI that aren't
on the marketing pages or are surfaced only after you go looking.
Discovered during the upgrade from 2.1.85 → 2.1.128 in this research
session.

## How to read this doc

Every item carries an evidence tag in brackets:

- **[docs]** — confirmed by Anthropic's published docs at
  `code.claude.com/docs/en/`
- **[help]** — confirmed by `claude --help` or `claude <subcommand>
  --help` output
- **[changelog]** — confirmed by an entry in
  `~/.claude/cache/changelog.md`
- **[binary]** — confirmed by string-grep against
  `/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe`
- **[speculative]** — inferred from codename patterns or feature
  flags; may not be functional yet

Items with multiple tags are the most reliable. `[binary]`-only items
warrant verification before depending on them.

## How to discover more yourself

Five fast probes to surface what's in your install:

```bash
# 1. All CLI flags + subcommands
claude --help | less

# 2. Build-up of analytics events (one per tracked feature)
strings /opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe \
  | grep -E "^tengu_[a-z_]+$" | sort -u | less

# 3. Slash commands baked into the binary
strings /opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe \
  | grep -E "^/[a-z][a-z_-]+$" | sort -u | less

# 4. Recent change history
less ~/.claude/cache/changelog.md

# 5. Doc index for the current docs version
curl -s https://code.claude.com/docs/llms.txt | less
```

Anything that appears in two of these five sources is almost certainly
a real, supported feature.

## A. Built-in MCP servers (opt-in via `enabledMcpServers`)

Built-in MCP servers ship with the CLI binary itself. They're
**different from**:

- User-defined MCP servers (added via `claude mcp add`)
- Plugin MCP servers (loaded from `~/.claude/plugins/`)
- claude.ai-hosted MCPs (Gmail, Drive, Notion, etc.)

The opt-in mechanism is per-project, persisted in
`~/.claude.json` under
`projects[<absolute-path>].enabledMcpServers`. To enable one:

```bash
python3 - <<'PY'
import json, os
cfg = json.load(open(os.path.expanduser('~/.claude.json')))
proj = cfg.setdefault('projects', {}).setdefault(os.getcwd(), {})
proj.setdefault('enabledMcpServers', [])
if 'computer-use' not in proj['enabledMcpServers']:
    proj['enabledMcpServers'].append('computer-use')
json.dump(cfg, open(os.path.expanduser('~/.claude.json'), 'w'), indent=2)
print('enabled:', proj['enabledMcpServers'])
PY
```

Or interactively, via `/mcp` in a CLI session.

### A.1 `computer-use` [docs, binary, verified]

**What:** macOS GUI control. Lets Claude open apps, click, type, and
see your screen via Anthropic's Swift bridge.

**Use case:** Build a native app, launch it, click through every
button, screenshot the result — all in one conversation. Test UI
flows without writing Playwright. Drive GUI-only tools that have no
API.

**Example (interactive session):**

```text
Use the mcp__computer-use__* tools to open the iOS Simulator,
launch the app, and tap through the onboarding screens. Tell me
if any screen takes more than a second to load.
```

**Gotchas:**

- `-p` (print/non-interactive) mode disables it. Interactive only.
- Per-session app allowlist via `request_access`. First call to a
  new app prompts for approval in the terminal.
- Machine-wide lock — only one CU session at a time on the host.
- Apps are auto-hidden while CU runs (host disruption).

### A.2 `filesystem` [binary; functionality unverified]

**Likely what:** Permission-gated filesystem ops, alternative to the
unrestricted Read/Edit/Write tools, possibly with explicit
allowlist.

**Suggested probe:** enable, restart session, run `/mcp` and check
whether `mcp__filesystem__*` tools appear. If they do, inspect their
schemas for the permission model.

### A.3 `sandbox` [docs, binary]

**What:** Filesystem and network isolation for safer autonomous
execution. The `Sandboxing` doc page at
`code.claude.com/docs/en/sandboxing` covers the policy model.

**Use case:** Let an agent run untrusted code or experiment with
file changes without risking your real working tree. Defense in
depth for `--dangerously-skip-permissions` workflows.

**Example:** combined with `--permission-mode bypassPermissions`,
the sandbox lets you run an agent autonomously on a cleaning task
("delete all `node_modules/` directories under `~/Projects`")
without it accidentally `rm -rf`'ing important paths.

### A.4 `bash`, `terminal`, `grep`, `task`, `todo`, `note`, `memory`, `database`, `docker`, `chrome`, `browser`, `file` [binary; functionality unverified]

These names appear as MCP server identifiers in the binary. Some are
likely production-ready, others may be stubs. Probe each via:

```text
/mcp        # in an interactive session, see if the name appears
```

If it does, enable it and inspect the surfaced tool list.

## B. Power-user CLI flags

All confirmed via `claude --help`. Most are documented in passing or
not at all on the docs site.

### B.1 `--effort low | medium | high | xhigh | max` [help, binary]

**What:** Reasoning effort tier. Higher tiers spend more time
"thinking" (extended thinking budget).

**Use case:** Hard problems where you'd take a long completion in
exchange for higher quality. `xhigh` and `max` aren't on the docs
page but are real choices.

**Example:**

```bash
claude --effort max -p "Audit this 500-line auth flow for race
conditions, OAuth flaws, and JWT validation gaps. Return a
prioritized list with severity and remediation."
```

**Gotchas:**

- Some models don't support effort levels (you'll see a banner
  warning at session start). 3P providers may downgrade silently.
- Each tier roughly doubles the thinking-token spend; combine with
  `--max-budget-usd` if cost-sensitive.

### B.2 `--max-budget-usd <amount>` [help]

**What:** Hard dollar cap on API spend per session (works only with
`--print`).

**Use case:** Cost discipline for headless / CI / orchestrator usage.
Cancel automatically if a runaway agent burns through your budget.

**Example:**

```bash
claude --max-budget-usd 2.50 -p "Refactor auth.ts and add tests"
```

If the run exceeds $2.50, the CLI exits with a non-zero code and
the session is preserved for review/resume.

**Gotchas:**

- Only valid with `-p` (non-interactive). Interactive sessions don't
  honor the cap.
- Cost is computed from API response usage data; off by ±10%.
- Doesn't include MCP server costs (e.g., paid plugin MCPs).

### B.3 `--json-schema <schema>` [help]

**What:** Native structured output validation. The CLI enforces the
output matches the schema before returning.

**Use case:** Replace the "≤350 words, exact format" prompt-discipline
hack we use in [04-architecture-patterns.md](04-architecture-patterns.md)
and [06-agentic-pattern-archetypes.md](06-agentic-pattern-archetypes.md).
Get reliable parseable output without SDK plumbing.

**Example:**

```bash
SCHEMA='{
  "type": "object",
  "properties": {
    "title":      { "type": "string" },
    "severity":   { "enum": ["low", "med", "high", "critical"] },
    "files":      { "type": "array", "items": { "type": "string" } },
    "remediation": { "type": "string" }
  },
  "required": ["title", "severity", "files", "remediation"]
}'

claude -p --json-schema "$SCHEMA" \
  "Analyze the auth bug at line 42 of auth.ts and return findings."
```

You get back validated JSON. Pipe it directly to `jq`.

**Gotchas:**

- Only with `--print`. Interactive sessions can't enforce schema.
- Complex schemas can confuse smaller models — start simple.
- Combines well with `--output-format json` for shell scripting.

### B.4 `--brief` [help]

**What:** Enables the `SendUserMessage` tool, which lets the agent
push messages to the user mid-task without blocking on a turn
boundary.

**Use case:** Long-running tasks that want to report progress.
Mid-flight clarifying questions that don't need a full pause.
Background agents reporting status to the foreground.

**Example:**

```bash
claude --brief "Run the full test suite, fix any failures, and
ping me with a summary every 5 minutes."
```

**Gotchas:**

- The agent has to *choose* to use it — phrasing matters
  ("ping me", "let me know", "give status updates").
- Requires terminal that supports interactive output during streams.
- Could pair with the `Notification` hook for desktop alerts.

### B.5 `--bare` [help]

**What:** Minimal mode. Skips hooks, LSP, plugin sync, attribution,
auto-memory, background prefetches, keychain reads, CLAUDE.md
auto-discovery. Sets `CLAUDE_CODE_SIMPLE=1`. Auth is strictly
`ANTHROPIC_API_KEY` (OAuth/keychain ignored).

**Use case:** CI runs, sandboxed scripts, reproducible automated
flows. Eliminates everything that could differ between machines or
inject "surprise" context.

**Example:**

```bash
claude --bare \
  --add-dir /sandbox/repo \
  --mcp-config /etc/ci/mcp.json \
  --settings '{"permissions":{"defaultMode":"acceptEdits"}}' \
  -p "Run tests, fix failures, return JSON of remaining issues" \
  --json-schema "$ISSUE_SCHEMA"
```

**Gotchas:**

- Skills still resolve via `/skill-name` syntax (not auto-loaded).
- Requires explicit context via `--system-prompt[-file]`,
  `--add-dir`, `--mcp-config`, `--settings`, `--agents`,
  `--plugin-dir`.
- No CLAUDE.md auto-loading means you'll need to re-establish
  project conventions in the system prompt.

### B.6 `--from-pr [N]` [help]

**What:** Resume the session linked to a specific PR
(GitHub/GitLab/Bitbucket).

**Use case:** Pick up a session that was opened on the web or in
another machine when you started working on a PR. The link is
established when you first push commits or run `/branch` on a session
that's about to open a PR.

**Example:**

```bash
claude --from-pr 1234        # by PR number in current repo
claude --from-pr https://github.com/myorg/myrepo/pull/1234
claude --from-pr             # interactive picker with PR search
```

### B.7 `--worktree [name]` and `--tmux` [help]

**What:** Create a new git worktree just for this session, optionally
paired with a tmux/iTerm2 session for live observation.

**Use case:** Speculative changes get isolated by default. Pairs
with the cook-style worktree race pattern from
[06-agentic-pattern-archetypes.md](06-agentic-pattern-archetypes.md).

**Example:**

```bash
# A Claude session in its own worktree, in its own tmux pane:
claude --worktree feature-X --tmux \
  "Implement feature X. Run tests. Commit when green."
```

If you have iTerm2, `--tmux` will use native panes instead of
classic tmux.

**Gotchas:**

- Worktrees clone the working tree but share the `.git/objects`
  store, so they're cheap (no full clone).
- The branch is created from local HEAD as of v2.1.128 (was
  `origin/<default>` previously, dropping unpushed commits).

### B.8 `--no-session-persistence` [help]

**What:** Don't save the session to disk. Once you exit, it's gone.

**Use case:** Sensitive analysis you don't want recoverable. CI runs
where the result is captured elsewhere.

**Example:**

```bash
claude -p --no-session-persistence \
  "Review this internal employee data and tell me if any of it
  looks anomalous: $(cat /tmp/sensitive.csv)"
```

**Gotcha:** Only with `--print`. Interactive sessions always persist.

### B.9 `--betas <header...>` [help]

**What:** Send arbitrary beta headers in API requests. API-key users
only.

**Use case:** Opt into in-development features that require explicit
beta headers, like new tool types, new model behaviors, or extended
context windows.

**Example:**

```bash
ANTHROPIC_API_KEY=sk-... claude --betas \
  "computer-use-2024-10-22" \
  "prompt-caching-2024-07-31" \
  -p "Open the design tool and..."
```

**Gotcha:** Subscription users (Pro/Max OAuth) can't use this — beta
headers route through API key path only.

### B.10 `--include-hook-events` [help]

**What:** When using `--output-format=stream-json`, include all hook
lifecycle events in the output stream alongside model output.

**Use case:** Build a dashboard or tracer that needs the full
lifecycle, not just model events. Pairs perfectly with this
project's hook ingestion.

**Example:**

```bash
claude -p --output-format stream-json --include-hook-events \
  "Refactor X" | tee session.jsonl

# Now session.jsonl has both model events AND hook firings.
# Useful for building a UI that shows tool-use approval states.
```

### B.11 `--exclude-dynamic-system-prompt-sections` [help]

**What:** Move per-machine sections (cwd, env info, memory paths,
git status) from the system prompt into the first user message.

**Use case:** Improve cross-user prompt-cache reuse when running the
CLI as part of a shared service. Without this, the system prompt
varies per machine, defeating prompt caching.

**Example:**

```bash
claude --exclude-dynamic-system-prompt-sections -p "..."
```

**Gotcha:** Only applies with the default system prompt. Ignored if
you supply `--system-prompt`.

### B.12 Quick reference for the rest

| Flag | One-liner |
|---|---|
| `--fork-session` | When resuming, create a new session ID — useful for branching exploration |
| `--ide` | Auto-connect to detected IDE on startup |
| `--remote-control-session-name-prefix <p>` | Auto-name remote-controlled sessions by hostname or custom prefix |
| `--input-format text \| stream-json` | Read user messages from stdin as a stream |
| `--include-partial-messages` | Stream partial message chunks as they arrive (`--print` only) |
| `--replay-user-messages` | Re-emit user messages on stdout for downstream acknowledgment |
| `--setting-sources <user,project,local>` | Control which settings layers load |
| `--strict-mcp-config` | Use only MCPs from `--mcp-config`, ignore everything else |
| `--disable-slash-commands` | Disable all skills (rare; for sandboxed/CI use) |
| `--allow-dangerously-skip-permissions` | Make `--dangerously-skip-permissions` available without enabling it |
| `--name <n>` | Set a display name for this session |
| `--add-dir <dir...>` | Allow tool access to additional directories |
| `--agent <agent>` | Override the agent setting for this session |
| `--agents '<json>'` | Define custom agents inline as JSON |

## C. Subcommands

All confirmed via `claude --help` and `claude <subcommand> --help`.

### C.1 `claude auto-mode` [help]

**What:** Inspect the auto-mode classifier configuration. Auto mode
is the system that decides whether a tool call needs permission,
auto-accepts, or asks.

**Use case:** Debug why a tool call you expected to be auto-approved
keeps prompting (or vice versa). Audit your permission setup.

**Example:**

```bash
claude auto-mode
# Shows the classifier rules:
#   "Bash(npm test)" → accept
#   "Bash(rm *)"     → ask
#   "Edit(**/*.md)"  → accept
#   ...
```

### C.2 `claude agents` [help]

**What:** Manage **background** agents (decoupled from a session) and
configured agents (`.claude/agents/*.md`).

**Use case:** Long-running agents that should outlive a single CLI
session. Like a watchdog that tails logs and pings you when something
fires.

**Example:**

```bash
claude agents list
claude agents start watchdog --prompt "Tail server.log and notify me on errors"
claude agents stop watchdog
```

**Gotcha:** Background agents live in their own process tree. They
don't share session state with your interactive sessions, but they
can write to files / send via Channels.

### C.3 `claude project purge [path]` [help, changelog 2.1.126]

**What:** Wipe all Claude state for a project: transcripts, tasks,
file history, the entry in `~/.claude.json`.

**Use case:** Cleanup. Your `~/.claude.json` accumulates project
entries forever; over years that's hundreds of stale paths.

**Example:**

```bash
# Show what would be deleted, don't actually delete:
claude project purge --dry-run

# Interactive picker for which projects to purge:
claude project purge -i

# Purge everything older than X (no flag for this; combine with -i):
claude project purge -i --all
```

**Gotcha:** The transcripts contain real conversation content;
purging them means losing replay/audit. Take a backup if uncertain.

### C.4 `claude install [stable | latest | <version>]` [help]

**What:** Install a specific version of the native build. Useful for
pinning, downgrading, or trying a beta.

**Use case:** A 2.1.128 regression breaks your workflow → roll back
to 2.1.126.

**Example:**

```bash
claude install 2.1.126     # specific version
claude install stable      # latest stable channel
claude install latest      # bleeding edge
```

**Gotcha:** Conflicts with `brew install --cask claude-code` if you
mixed installers. Stick with one channel per machine.

### C.5 `claude setup-token` [help]

**What:** Mint a long-lived authentication token for the current
account. Subscription required.

**Use case:** Use Claude Code in environments where the OAuth
browser-callback flow is impractical: CI runners, headless servers,
remote dev boxes you SSH into.

**Example:**

```bash
claude setup-token
# Walks through claude.ai web auth, returns a long-lived token.
# Set CLAUDE_CODE_OAUTH_TOKEN=... in your CI secrets.
```

**Gotcha:** Tokens carry your subscription's quota — leaking one is
a real cost incident. Treat as a secret on par with API keys.

### C.6 `claude ultrareview` [help, docs]

**What:** Cloud-hosted multi-agent code review of the current branch
(or a PR). Runs on Anthropic infrastructure; results stream back to
your terminal.

**Use case:** Pre-merge review of a substantial PR. The cloud agents
do dispatch + analysis without consuming your local CLI session
quota.

**Example:**

```bash
# Review current branch:
claude ultrareview

# Review specific PR:
claude ultrareview 1234

# Review against a different base:
claude ultrareview --base develop
```

**Gotcha:** It's billed separately from your CLI session usage. Free
on Max plan; check pricing if you're elsewhere.

### C.7 `claude doctor` [help]

**What:** Health check of the auto-updater + plugin/MCP/skill load
status.

**Use case:** Diagnose why the CLI is misbehaving. First thing to
run when something feels broken.

**Example:**

```bash
claude doctor
# Reports:
#   - Auto-updater channel and last check time
#   - Stdio MCP servers from .mcp.json (with health)
#   - Plugin load status
#   - Skill resolution
```

## D. Hook events (full list)

All confirmed by binary symbols. Connection to docs varies.

| Event | Fires on | Confirmed by |
|---|---|---|
| `SessionStart` | New session beginning | docs |
| `SessionEnd` | Session ending | docs |
| `UserPromptSubmit` | User submits a message | docs |
| `PreToolUse` | Before any tool invocation | docs |
| `PostToolUse` | After any tool invocation | docs |
| `SubagentStop` | Subagent completes | docs |
| `Stop` | Assistant turn ends | docs |
| `Notification` | Notification surfaces | docs |
| `PreCompact` | **Before** compaction runs | binary |
| `PostCompact` | **After** compaction completes | binary |

### D.1 PreCompact / PostCompact deep dive

Compaction is when Claude summarizes/discards old context to fit the
window. The hooks let you snapshot state and react.

**Use case for your dashboard:** record full pre-compact context for
postmortem. After compaction, the original messages aren't in the
session anymore — but with a `PreCompact` hook capturing them to
disk, you can replay or inspect them later.

**Example hook entry in `~/.claude/settings.json`:**

```json
{
  "hooks": {
    "PreCompact": [{
      "hooks": [{
        "type": "command",
        "command": "node ~/scripts/snapshot-pre-compact.js"
      }]
    }],
    "PostCompact": [{
      "hooks": [{
        "type": "command",
        "command": "curl -X POST http://localhost:4820/api/hooks/event \\
                    -H 'X-Hook-Event: PostCompact' \\
                    --data-binary @-"
      }]
    }]
  }
}
```

The `PreCompact` snapshot script could read from
`$CLAUDE_SESSION_TRANSCRIPT_PATH` (the env var set by the hook) and
copy it somewhere durable.

**Gotcha:** Compaction runs without user prompting; your hook fires
synchronously and can delay the session if it's slow. Keep the
script fast (<200 ms) or make it async and write to a queue.

## E. Hidden gem features

Documented in `code.claude.com/docs/en/` but rarely surfaced.

### E.1 Tool Search [docs]

**What:** Discovers and loads only the MCP tools you need, on demand.
Same mechanism that hides `computer-use`'s 25 tools until requested.

**Use case:** When you're connected to many MCP servers (each with
many tools), eager-loading every schema would consume thousands of
tokens before the conversation starts. Tool Search delays that.

**How it surfaces:** Deferred tools appear by NAME in a
`<system-reminder>` block at session start. To use one, you call
`ToolSearch` first to load its schema, then invoke the tool.

**Example (from this very session):**

```text
ToolSearch with query "select:WebFetch"
# Loads the WebFetch tool schema. Only then can I call WebFetch.
```

**Gotcha:** Agents have to *remember* this. The act-first reflex is
to use already-loaded tools; deferred tools require explicit
ToolSearch. Prompts can nudge: *"if you don't have a tool for X,
ToolSearch by name first."*

### E.2 Channels [docs]

**What:** Push messages, alerts, and webhooks INTO a running session
from external sources. Supports Telegram, Discord, iMessage, Slack,
and arbitrary HTTP webhooks.

**Use case:** A monitoring system fires an alert → routes to your
running CLI session as a user message → Claude can act on it
without you typing.

**Example:**

```bash
claude --channels
# Inside the session:
/channels add slack
/channels add webhook --port 8080

# Now anything POSTed to localhost:8080 becomes a user message.
# Or any Slack DM to your bot becomes a user message.
```

**Use case for your dashboard:** Trigger a CLI session from the
dashboard's UI by hitting the channels webhook. The CLI runs the
task, fires hooks back to the dashboard. Bidirectional flow without
modifying the dashboard's core (which we agreed should stay
observe-only).

**Gotcha:** Per the 2.1.128 changelog, channels now works with API
key auth too — but console orgs with managed settings must set
`channelsEnabled: true`. Check `claude doctor` if it's not
appearing.

### E.3 Routines [docs]

**What:** Cloud-hosted scheduled tasks. Run on Anthropic
infrastructure (work even when your machine is off). Trigger via
cron-style schedule, API call, or GitHub event.

**Use case:** Morning inbox triage at 7am every weekday. Daily
dependency audit. Hourly check on a long-running data pipeline.

**Example:**

```bash
claude
# In session:
/schedule daily 7am "Review yesterday's PRs and email summary"

# Or programmatically:
claude routines create --name morning-triage \
  --schedule "0 7 * * MON-FRI" \
  --prompt "Summarize unread email"
```

**Gotcha:** Routines run on Anthropic infra without local file
access. They can read shared cloud sources (Drive, GitHub, etc.) but
can't directly touch `~/Downloads`. For local-resource automation,
use Desktop Scheduled Tasks or `cron` instead.

### E.4 Checkpointing [docs]

**What:** Track, rewind, and summarize Claude's edits across a
conversation. Conversation time-travel.

**Use case:** Claude made 12 edits across 5 files; the last 4 broke
something. Rewind to checkpoint 8 without losing the conversation
context.

**Example (interactive):**

```text
/checkpoint list             # show all checkpoints
/checkpoint restore 8        # roll back files to checkpoint 8
                             # conversation history preserved
```

**Gotcha:** Checkpoints capture *file* state, not the agent's
internal reasoning. The conversation continues from where you left
off, but with the file system reset.

### E.5 Voice Dictation [docs]

**What:** Speak your prompts. Hold-to-record (`Cmd+Shift+Space` by
default) or tap-to-record.

**Use case:** Long, exploratory prompts you wouldn't bother typing.
"Explain this codebase to me, focus on how X talks to Y, and
include any subtle gotchas you notice." 30-second voice dictation
beats 3-minute typing.

**Example:** No CLI flag — it's a key binding inside interactive
sessions. Configure under `/config` → keybindings.

**Gotcha:** Uses macOS native dictation by default. Quality is OK,
not amazing. For better quality, route through Whisper or other
local STT.

### E.6 Output Styles [docs]

**What:** Adapt Claude's response style for non-coding uses.

**Use case:** Currently in this conversation, we're using
`learning + explanatory` styles, which is why I include `★ Insight`
blocks and educational sidebars. Other styles for documentation,
tutoring, journaling, etc.

**Example:**

```bash
# In a session:
/output-style list
/output-style learning
/output-style minimal      # return to terse default
```

Output styles ship as plugins. Your install has several
(`learning-output-style`, `explanatory-output-style` etc. visible
in `~/.claude/settings.json`'s `enabledPlugins`).

### E.7 `/ultraplan` [docs]

**What:** Start planning in CLI, draft on web, execute remotely or
back in terminal. Cross-surface plan composition.

**Use case:** You start sketching a refactor in CLI, but want to
think it through with a colleague over a web link. `/ultraplan`
moves the plan to the web; further edits sync back.

**Example:**

```text
/ultraplan
# Generates a shareable URL. Open it; edit; close.
# Returning to CLI, the updated plan is loaded.
# Then: "Execute the plan."
```

### E.8 `/ultrareview` (we covered above) [docs]

### E.9 Auto Memory [docs]

**What:** CLAUDE.md auto-accumulates learnings across sessions
without you writing them. The CLI extracts "facts about this
project" and writes them to your CLAUDE.md.

**Use case:** Build commands, debugging insights, architecture
gotchas — these accumulate over weeks/months without conscious
effort. Future sessions start with that knowledge in context.

**Example:** No invocation. It happens automatically. Inspect with:

```bash
cat CLAUDE.md
# Look for the "Auto Memory" section that's appended over time.
```

**Gotcha:** Sometimes captures things you'd rather it didn't (e.g.,
a one-off debugging note treated as a permanent fact). Curate
periodically.

### E.10 Server-Managed Settings [docs]

**What:** Centrally configure Claude Code for an org without device
management. Settings come from a server URL.

**Use case:** Your team wants everyone using `--effort high`, a
specific MCP whitelist, certain hooks. Without each developer
configuring locally, push from a central server.

**Example settings shape:**

```json
{
  "managedSettings": {
    "url": "https://config.mycompany.com/claude-code/team-rules",
    "authMode": "oidc",
    "refreshIntervalMinutes": 60
  }
}
```

**Gotcha:** Permissions managed from server can be stricter than
local settings, but never more permissive — local users can't
escalate by editing local config.

### E.11 LLM Gateway [docs]

**What:** Route Claude API calls through your own gateway (LiteLLM,
Bedrock proxy, custom).

**Use case:** Cost analysis, rate limiting, multi-provider routing
(Bedrock for cheap calls, Anthropic for hard ones), auth proxying.

**Example:**

```bash
ANTHROPIC_BASE_URL=https://gateway.mycompany.com/anthropic \
ANTHROPIC_API_KEY=$GATEWAY_TOKEN \
  claude -p "..."
```

The 2.1.126 changelog notes: `/model` picker now lists models from
your gateway's `/v1/models` endpoint when `ANTHROPIC_BASE_URL`
points at an Anthropic-compatible gateway.

### E.12 Network Config [docs]

**What:** Proxy servers, custom CAs, mTLS for enterprise networks.

**Use case:** Corporate proxy with TLS interception, on-prem mTLS to
internal model gateways.

**Example env vars:**

```bash
HTTPS_PROXY=https://proxy.mycompany.com:8443
NODE_EXTRA_CA_CERTS=/etc/ssl/corp-root.pem
CLAUDE_CODE_CLIENT_CERT=/etc/ssl/client.crt
CLAUDE_CODE_CLIENT_KEY=/etc/ssl/client.key
```

## F. Recent changelog highlights (2.1.85 → 2.1.128)

The most relevant deltas in your 43-version jump:

- **2.1.128:** `/mcp` shows tool counts; `--plugin-dir` accepts
  `.zip`; `--channels` works with API key auth; MCP server name
  `workspace` reserved; reconnecting MCP servers no longer flood the
  conversation; `--max-budget-usd` added.
- **2.1.126:** `claude project purge` added;
  `--dangerously-skip-permissions` now bypasses prompts for
  `.claude/`, `.git/`, `.vscode/` and shell config files; OAuth code
  paste fallback for WSL2/SSH/containers; `claude_code.skill_activated`
  OpenTelemetry event added.
- **2.1.123:** Fixed OAuth 401 retry loop with
  `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`.
- **2.1.122:** `/branch` for forking sessions; `/mcp` shows hidden
  connectors; ToolSearch finds MCP tools that connected after
  session start; `ANTHROPIC_BEDROCK_SERVICE_TIER` env var added.
- **Various 2.1.86–2.1.121:** native binary distribution
  (single Bun-compiled `bin/claude.exe` instead of cli.js +
  node_modules); computer-use Swift module integration.

## G. Codenames spotted in the binary

Speculative observations from `tengu_*` analytics events. These
aren't documented features — just hints at what's being instrumented.

### "Amber" series

Seven analytics events with `tengu_amber_*` prefix:

- `tengu_amber_anchor`
- `tengu_amber_flint`
- `tengu_amber_lark`
- `tengu_amber_lynx`
- `tengu_amber_prism`
- `tengu_amber_sentinel`
- `tengu_amber_wren`

Pattern suggests a coordinated feature wave with seven
sub-components, each with an animal/object codename. Could be a
new agent SDK module, a new IDE-pane suite, or something else
entirely.

### Other singletons

- `tengu_ashen_kelp` — single, no obvious cluster
- `tengu_async_agent_stall_timeout` — async/background agent
  management is being instrumented (consistent with the existing
  `claude agents` subcommand)
- `tengu_advisor_*` — there's an "advisor" feature distinct from
  Task tool; likely a new clarification/guidance primitive

### Desktop-only feature flags

From `/Applications/Claude.app`'s process command line — desktop
features marked `unavailable` (in development):

- `wakeScheduler` — sounds like cron-style wake events
- `operon` — unknown codename
- `framebufferPreview` — likely VM/sandbox visual preview
- `iosSimulator` — would unlock mobile dev workflows
- `coworkKappa` and `coworkArtifacts` — Cowork-related extensions

## H. `--effort` tiers explained

The `--effort` flag accepts `low`, `medium`, `high`, `xhigh`, `max`.

| Tier | Approximate use |
|---|---|
| `low` | Snap responses; simple lookups; trivial edits |
| `medium` | Default for most coding tasks |
| `high` | Hard analysis; multi-file refactors; subtle bug hunts |
| `xhigh` | Architecture review; security audit; complex algorithm design |
| `max` | When you're willing to wait minutes for the highest quality |

Each tier roughly doubles the extended-thinking budget. Cost scales
linearly with budget (extended thinking tokens are billed).

**Practical advice:** start at `medium`, escalate to `high` if the
agent's first attempt was wrong, only reach `xhigh`/`max` for the
hardest 5% of problems.

## I. The `SendUserMessage` primitive (`--brief`)

**What `SendUserMessage` is:** a built-in tool the agent can invoke
to push text to the user mid-task without ending its turn. The
message appears in your terminal/UI immediately.

**What it unlocks for orchestration:**

This primitive is the missing piece for closing the
"Cowork approval visibility" gap discussed earlier in our research.
A subagent could `SendUserMessage`("I'm about to delete 17 files;
approve in the Cowork tab") — the dashboard could surface this as a
notification, the user clicks Approve in Cowork, and the subagent
continues.

**Example invocation pattern:**

```bash
claude --brief "Run a refactor across all 50 files. Use
SendUserMessage to ping me every 10 files with progress."
```

The agent will use the tool autonomously when the prompt encourages
it. Combine with the `Notification` hook in
`~/.claude/settings.json` to forward to desktop banners or your
dashboard's WebSocket.

## J. Recommended next steps with worked examples

In rough order of likely value to your setup:

### J.1 Cap orchestrator costs

Add `--max-budget-usd` to any orchestrator script that spawns
`claude -p`. For the bridge MCP we built, this means safe
experimentation:

```bash
claude --max-budget-usd 1.00 -p "$WRAPPED_PROMPT" \
       --output-format stream-json \
       --include-hook-events
```

### J.2 Replace prompt-discipline with `--json-schema`

The "≤350 words, exact format" technique in
[06-agentic-pattern-archetypes.md](06-agentic-pattern-archetypes.md)
becomes:

```bash
SCHEMA='{
  "type": "object",
  "properties": {
    "verdict": { "enum": ["pass", "fail", "partial"] },
    "summary": { "type": "string", "maxLength": 1000 },
    "issues": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["verdict", "summary", "issues"]
}'

result=$(claude --max-budget-usd 0.50 -p \
  --json-schema "$SCHEMA" \
  --output-format json \
  "Review the auth module and report")

echo "$result" | jq '.verdict'
```

No more prompt-discipline; the schema is enforced by the runtime.

### J.3 Add PreCompact hook to your dashboard

Add this to `~/.claude/settings.json` (your CCM hook handler will
need to handle a new event type):

```json
{
  "hooks": {
    "PreCompact": [{
      "hooks": [{
        "type": "command",
        "command": "node /path/to/scripts/hook-handler.js PreCompact"
      }]
    }]
  }
}
```

In `hook-handler.js`, handle the new event by snapshotting the
transcript before compaction destroys it. Your dashboard now has
full pre-compact recall.

### J.4 Try `/ultrareview` on a real PR

```bash
# In your dashboard project:
git checkout -b some-feature
# make changes...
git push origin some-feature
gh pr create

# Then:
claude ultrareview $(gh pr view --json number -q .number)
```

Free on Max plan; results come back in your terminal.

### J.5 Use `--worktree --tmux` for the cook-style worktree race

Combine with the worktree race pattern from file 06:

```bash
for variant in approach-a approach-b approach-c; do
  claude --worktree "$variant" --tmux \
         --max-budget-usd 1.00 \
         -p "Implement feature X using $variant" &
done
wait

# Pick the winner; cook-style.
```

Each variant lives in its own worktree + tmux pane. You can watch
all three live.

### J.6 Wire Channels to your dashboard for bidirectional flow

```bash
# In a fresh session in your dashboard project:
claude --channels
# /channels add webhook --port 8019

# Now any POST to localhost:8019 is a user message.
# Add a button in your dashboard UI that POSTs to that endpoint.
# The CLI runs the task, your hook handler streams events back to
# the dashboard. Closed loop, dashboard never modified.
```

### J.7 Audit and clean stale projects

Your `~/.claude.json` has 43 project entries (some likely stale):

```bash
claude project purge --dry-run    # see what'd go
claude project purge -i           # interactively pick which to keep
```

## Cross-references

- File 02 — Anthropic's auth/billing/orchestration primitives
  (now partly superseded by computer-use being native).
- File 04 — orchestration topology patterns (Channels enables a
  new pattern: webhook-triggered agents).
- File 06 — agentic pattern archetypes; `--json-schema` and
  `--max-budget-usd` change implementation sketches there.

## Methodology recap

This doc was generated by:

1. Running `claude --version` before/after upgrade to detect drift.
2. `claude update` (2.1.85 → 2.1.128).
3. `claude --help` for flags + subcommands.
4. `strings $BINARY` for `tengu_*`, MCP names, slash commands,
   hook events.
5. `cat ~/.claude/cache/changelog.md` for version-by-version
   diffs.
6. `WebFetch https://code.claude.com/docs/llms.txt` for the
   docs index.
7. Cross-referencing all four sources to flag confirmed vs.
   speculative items.

The same methodology will work for the next major version. Watch the
"amber" series in `tengu_*` events — that's where the next wave is
likely to surface first.
