# CCAM Skills and Plugin Marketplace

CCAM ships one source tree that supports three distribution paths:

- **Claude Code plugins** through `.claude-plugin/marketplace.json`
- **Codex plugins** through `.agents/plugins/marketplace.json` and each plugin's `.codex-plugin/plugin.json`
- **Open Agent Skills / skills.sh** through standards-compliant `SKILL.md` files with required `name` and `description` metadata

The verified bundle contains **14 plugins, 66 bundled plugin skills, 18 Claude subagents, 34 Claude commands, 3 CLI helpers, 3 hook configurations, and 2 MCP-enabled plugins**. The skills.sh CLI discovers **75 total repository skills** because it also includes the repository-maintenance skills under `.agents/skills/` and `.claude/skills/`.

## Choose an Installation Path

| Need | Recommended path | Why |
| --- | --- | --- |
| A curated capability pack for Claude Code | Claude Code plugin marketplace | Installs the plugin's skills, commands, agents, and metadata together. |
| The same pack for Codex | Codex plugin marketplace | Uses the Codex manifest while sharing the canonical plugin source tree. |
| One reusable workflow without the rest of a plugin | `npx skills add` | Keeps the install focused on the selected skill and supports project or global scope. |
| Modify or contribute an extension | Clone this repository | Lets you run the sync and validation commands before using local manifests. |

Do not install the same capability through multiple paths unless you intentionally want duplicates. Start with one path, verify it with the listed CLI command, and switch only after removing the previous installation.

## Install for Claude Code

```bash
claude plugin marketplace add hoangsonww/Claude-Code-Agent-Monitor
claude plugin install ccam-platform@claude-code-agent-monitor-plugins
```

List the marketplace and install any plugin shown in the catalog:

```bash
claude plugin marketplace list
claude plugin validate . --strict
```

## Install for Codex

```bash
codex plugin marketplace add hoangsonww/Claude-Code-Agent-Monitor
codex plugin list --marketplace claude-code-agent-monitor-plugins --available --json
codex plugin add ccam-platform@claude-code-agent-monitor-plugins
```

Codex reads `.agents/plugins/marketplace.json`. Every entry points to the same `plugins/<name>` directory used by Claude Code. Each plugin has a separate `.codex-plugin/plugin.json` with UI metadata, capabilities, skills, and optional MCP wiring.

## Install skills with skills.sh

The repository does not need a PR to the `vercel-labs/skills` source repository. The `skills` CLI installs from public GitHub repositories directly, and skills.sh discovery/ranking is driven by install telemetry.

```bash
# List all 75 repository skills without installing
npx skills add hoangsonww/Claude-Code-Agent-Monitor --list

# Install one skill into the current project for Claude Code and Codex
npx skills add hoangsonww/Claude-Code-Agent-Monitor \
  --skill mcp-server \
  --agent claude-code \
  --agent codex \
  --yes

# Verify project-scoped installation
npx skills list --json

# Install the same skill globally for both agents
npx skills add hoangsonww/Claude-Code-Agent-Monitor \
  --skill mcp-server \
  --agent claude-code \
  --agent codex \
  --global \
  --yes

# Verify global installation
npx skills list --global --json

# Install all discovered skills for every supported agent in the current project
npx skills add hoangsonww/Claude-Code-Agent-Monitor --all

# Update project-scoped or global skills
npx skills update --project --yes
npx skills update --global --yes

# Remove the selected skill from the current project or global scope
npx skills remove mcp-server --yes
npx skills remove --global mcp-server --yes
```

Project installs use the current repository's `.agents/skills/` directory and create agent-specific links such as `.claude/skills/mcp-server`. By default, global Claude Code skills resolve under `~/.claude/skills/` and global Codex skills under `~/.codex/skills/`; `CLAUDE_CONFIG_DIR` and `CODEX_HOME` replace those respective base directories. Multi-agent installs may deduplicate files through a shared store and link the agent-specific destinations. The CLI records source and hash metadata in `skills-lock.json` for project installs and a global skill lockfile so later `skills update` runs can check the original GitHub source.

Every bundled skill carries:

- `SKILL.md` frontmatter with canonical `name` and `description`
- procedural instructions and safety boundaries
- `agents/openai.yaml` with Codex/ChatGPT UI metadata and a `$skill-name` default prompt

The public repository becomes installable as soon as these files are on the default branch. Site search or leaderboard visibility can lag and depends on real installs. This change does not publish or submit anything externally.

## Plugin Catalog

| Plugin | Focus | Bundled skills |
| --- | --- | --- |
| `ccam-analytics` | tokens, costs, cache, model mix, trends | `cache-efficiency`, `cost-breakdown`, `model-mix`, `productivity-score`, `session-report`, `usage-trends` |
| `ccam-config` | Claude config and memory governance | `config-audit`, `hook-inventory`, `mcp-audit`, `memory-review`, `skill-inventory` |
| `ccam-cost-guard` | budgets, forecasts, cost alerts | `budget-set`, `cost-alert`, `daily-budget-check`, `model-savings`, `spend-forecast` |
| `ccam-dashboard` | dashboard status and MCP connector | `dashboard-status`, `endpoint-probe`, `live-watch`, `quick-stats` |
| `ccam-devtools` | diagnostics, export, transcripts | `data-export`, `event-trace`, `health-check`, `hook-diagnostics`, `session-debug`, `transcript-grep` |
| `ccam-insights` | anomalies, patterns, regressions | `anomaly-alert`, `benchmark`, `optimization-suggest`, `pattern-detect`, `regression-watch`, `session-compare` |
| `ccam-integrations` | alerts, webhooks, remote collection | `alert-management`, `remote-collection`, `webhook-management` |
| `ccam-platform` | Claude/Codex config, hooks, import, backup, MCP | `config-explorer`, `history-portability`, `hook-setup`, `mcp-server` |
| `ccam-productivity` | standups and reviews | `daily-standup`, `monthly-review`, `sprint-summary`, `time-of-day`, `weekly-report`, `workflow-optimizer` |
| `ccam-quality` | errors, SLOs, hook reliability | `api-error-report`, `error-scan`, `hook-failure-audit`, `regression-alert`, `slo-check` |
| `ccam-reports` | executive, cost, reliability, workflow reports | `cost-report`, `executive-report`, `reliability-report`, `workflow-report` |
| `ccam-runner` | monitored Claude Code/Codex launch and history | `run-agent`, `run-history` |
| `ccam-sessions` | session search, timeline, replay, cleanup | `cwd-rollup`, `session-cleanup`, `session-search`, `session-timeline`, `transcript-replay` |
| `ccam-workflows` | orchestration and fleet intelligence | `concurrency-report`, `dag-map`, `delegation-audit`, `error-propagation`, `fleet-runs` |

## MCP-enabled plugins

`ccam-dashboard` and `ccam-platform` include:

```json
{
  "mcpServers": {
    "ccam-dashboard": {
      "command": "ccam",
      "args": ["mcp", "stdio"]
    }
  }
}
```

The stable `ccam mcp stdio` launcher resolves the MCP build from the linked CCAM checkout. This avoids plugin-cache-relative paths, which break after installation. Run `npm run setup` first. It now installs and builds MCP before linking `ccam`.

## Source layout

```text
.claude-plugin/
└── marketplace.json                 # Claude Code catalog
.agents/plugins/
└── marketplace.json                 # Codex catalog
plugins/<name>/
├── .claude-plugin/plugin.json       # Claude plugin manifest
├── .codex-plugin/plugin.json        # Codex plugin manifest
├── skills/<skill>/
│   ├── SKILL.md
│   └── agents/openai.yaml
├── agents/*.md                      # Claude subagents where applicable
├── commands/*.md                    # Claude commands where applicable
├── hooks/hooks.json                 # optional
├── bin/*                            # optional CLI helpers
└── .mcp.json                        # optional MCP server wiring
```

`node scripts/sync-agent-extensions.js` is the deterministic source synchronizer. It:

1. adds missing canonical skill names
2. writes `agents/openai.yaml`
3. generates `.codex-plugin/plugin.json`
4. rebuilds both marketplace catalogs
5. prints verified component totals

Do not hand-edit generated Codex manifests or skill `agents/openai.yaml`. Edit the Claude manifest or `SKILL.md`, then run:

```bash
npm run extensions:sync
npm run extensions:validate
```

## Validation

```bash
npm run extensions:sync
npm run extensions:validate
node --test server/__tests__/plugins-marketplace.test.js
claude plugin validate . --strict
npx skills add . --list
```

For a clean Codex installation test:

```bash
tmp="$(mktemp -d)"
CODEX_HOME="$tmp" codex plugin marketplace add "$PWD" --json
CODEX_HOME="$tmp" codex plugin add ccam-platform@claude-code-agent-monitor-plugins --json
CODEX_HOME="$tmp" codex plugin list --json
rm -rf "$tmp"
```

The repository test enforces:

- marketplace-to-directory bijection for Claude and Codex
- valid dual manifests whose names match their folders
- required policy/category fields in the Codex catalog
- skill name-to-directory agreement
- `description` in every skill
- `agents/openai.yaml` in every skill with a `$skill-name` prompt
- required frontmatter for Claude agents and commands
- valid hook JSON

## Safety

- Most analytical plugins are read-only.
- Skills that can mutate show the intended change and require confirmation.
- Webhook tests and push notifications are external sends.
- Run tools launch or control real local processes.
- Config edits remain inside server allowlists and create backups.
- Remote-source deletion retains data unless purge is explicitly confirmed.
- Full dashboard clearing stays behind MCP mutation/destructive flags and the exact `CLEAR_ALL_DATA` token.

## Public publication

A repository marketplace is immediately usable by Claude Code and Codex from Git. Public inclusion in OpenAI's universal plugin directory is a separate reviewed submission through OpenAI's plugin submission portal. This repository adds publication-ready manifests but does not submit them or perform any external publication action.
