# plugins/

Source of the CCAM agent-extension marketplace: 14 plugins that bring Agent Monitor data into Claude Code and Codex as skills, subagents, slash commands, hooks, CLI helpers, and MCP wiring. Each plugin talks to the local dashboard (default `http://localhost:4820`).

Installation paths (Claude Code marketplace, Codex marketplace, skills.sh), the full catalog, and the safety model are documented in [`docs/PLUGINS.md`](../docs/PLUGINS.md).

## Plugins

| Plugin               | Focus |
| -------------------- | ----- |
| `ccam-analytics`     | Cost tracking, token breakdowns, usage trends, productivity scoring |
| `ccam-config`        | Audit Claude Code config and file-based memory via the Config Explorer API |
| `ccam-cost-guard`    | Budgets, spend forecasts, cost-threshold alerts, model-savings estimates |
| `ccam-dashboard`     | Direct MCP integration: live session data, quick stats, dashboard health |
| `ccam-devtools`      | Session debugging, hook diagnostics, data export, health checks |
| `ccam-insights`      | Pattern detection, anomaly alerting, optimization tips, session comparison |
| `ccam-integrations`  | Alert rules, webhooks, browser push, SSH remote data sources |
| `ccam-platform`      | Config explorers, history import, backup restore, hook install, updates, MCP server |
| `ccam-productivity`  | Standups, weekly reports, sprint summaries |
| `ccam-quality`       | API errors, hook delivery failures, tool-failure ratios, SLO tracking |
| `ccam-reports`       | Stakeholder-ready Markdown reports |
| `ccam-runner`        | Launch, follow up, stop, and resume dashboard-run Claude Code / Codex agents |
| `ccam-sessions`      | Search, inspect, replay, and clean up sessions |
| `ccam-workflows`     | Multi-agent orchestration and Workflow-tool fleet analysis |

## Plugin layout

```text
plugins/<name>/
├── .claude-plugin/plugin.json   # Claude manifest — the source of truth
├── .codex-plugin/plugin.json    # GENERATED Codex manifest
├── skills/<skill>/
│   ├── SKILL.md                 # source of truth
│   └── agents/openai.yaml       # GENERATED skill UI metadata
├── agents/*.md                  # optional Claude subagents
├── commands/*.md                # optional slash commands
├── hooks/hooks.json             # optional hooks
├── bin/*                        # optional CLI helpers
└── .mcp.json                    # optional MCP server wiring
```

The catalogs that list these plugins live outside this directory: [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) (Claude Code) and [`.agents/plugins/marketplace.json`](../.agents/plugins/marketplace.json) (Codex). Both are generated.

## Editing workflow

Edit only the Claude manifest, `SKILL.md`, agents, commands, hooks, and helpers — never the generated files. Then regenerate and validate:

```bash
npm run extensions:sync
npm run extensions:validate
node --test server/__tests__/plugins-marketplace.test.js
```

Adding a plugin means creating `plugins/<name>/.claude-plugin/plugin.json` (its `name` must match the folder) plus at least one skill, then running the commands above. In the same change:

- Update the catalog table in [`docs/PLUGINS.md`](../docs/PLUGINS.md).
- Bump the pinned counts in `server/__tests__/plugins-marketplace.test.js` — the `ships the complete N-plugin catalog` assertions and the plugin/skill counts in `COUNTED_DOCS`.
- Update the matching plugin and skill counts in every guide that `COUNTED_DOCS` checks: the concise `README.md`, canonical `README-EN.md`, full `README-CN.md` / `README-VN.md` / `README-KO.md` / `README-ES.md` mirrors, `docs/PLUGINS.md`, and `.codex/README.md` — plus the plugin count and table in this file.
