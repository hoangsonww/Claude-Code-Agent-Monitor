---
description: >
  Run a full audit of the user's Claude Code configuration via the Agent
  Monitor Config Explorer API: counts per surface (user vs project),
  duplicate or overlapping skills and subagents, hooks that run shell
  commands, and which surfaces are read-only vs mutable. Reads
  /api/cc-config/overview, /skills, /agents, /commands, /hooks, and /settings.
  Use when reviewing your Claude Code setup for sprawl, duplication, or risk.
---

# Config Audit

Produce a complete, data-backed audit of how the user's `~/.claude`
configuration has grown, what overlaps, and what is risky — all read through
the Agent Monitor dashboard at `http://localhost:4820`.

## Input

The user provides: **$ARGUMENTS**

This may be:
- empty or "full" — audit every surface (default).
- "skills" / "agents" / "commands" / "hooks" / "settings" — scope the audit to
  one surface only.
- a project path passed as `?cwd=` — to audit a project other than the
  dashboard server's own working directory.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/cc-config/overview` | `roots` + `counts` for every surface, split `{user,project}` where applicable (skills, agents, commands, outputStyles, plugins, mcpServers, hooks, memory, settingsFiles) |
| `GET /api/cc-config/skills` | `{ items:[{ scope, name, file, size, mtime, frontmatter, preview }] }` |
| `GET /api/cc-config/agents` | `{ items:[{ scope, name, file, size, mtime, frontmatter, preview }] }` |
| `GET /api/cc-config/commands` | `{ items:[{ scope, name, file, size, mtime, frontmatter, preview }] }` |
| `GET /api/cc-config/hooks` | `{ items:[{ scope, file, exists, hooks:{ <Event>:[{matcher,type,command,timeout}] } }] }` |
| `GET /api/cc-config/settings` | `{ items:[{ scope, file, exists, data(redacted), raw_size }] }` |

## Report Sections

### 1. Surface inventory (user vs project)
From `/overview` `counts`, print a table: one row per surface with `user`,
`project`, and `total` columns. Cover skills, agents, commands, output-styles,
plugins (with enabled/disabled), marketplaces, MCP servers, hooks
(user/project/project-local), memory, and settings files. Echo the resolved
`roots` so the user knows which `claudeHome`/project was inspected.

### 2. Duplicate & overlapping skills + agents
Fetch `/skills` and `/agents`. Detect:
- **Name collisions across scope** — same `name` at both user and project
  scope (project shadows user). List both `file` paths.
- **Near-duplicates** — entries whose `frontmatter.description` / `preview`
  describe the same job. Group them and recommend keeping one.

### 3. Hooks that run shell commands
Flatten `/hooks` to `(scope, file, Event, matcher, type, command, timeout)`.
Flag every `type: "command"` entry. Within those, escalate ones that contain
network egress (`curl`, `wget`, `http`, `nc`) or run unbounded with no
`timeout`. Print the raw `command` so the user can review it.

### 4. Read-only vs mutable surfaces
State which surfaces the Config Explorer can mutate (skills, agents, commands,
output-styles, user/project CLAUDE.md, and per-project `auto-memory` files via
`PUT`/`DELETE /api/cc-config/file`) versus those that are read-only by design
(plugins, MCP servers, settings.json and its in-file hooks — written
concurrently by the running CLI). Direct cleanup suggestions only at mutable
surfaces; for read-only ones, name the source `file` to edit by hand.

## Output

- A one-line verdict first: CLEAN / SPRAWL DETECTED / RISKY HOOKS.
- Section 1 as a Markdown table (`Surface | User | Project | Total`).
- Section 2 as grouped lists with `file` paths.
- Section 3 as a table (`Scope | Event | Matcher | Command | Risk`).
- Sizes in KB; any cost in USD to 4 decimals; use ▲/▼ for scope deltas.
- Cite only fields the API returned — never fabricate counts or commands.
- If the dashboard is unreachable at `http://localhost:4820`, say so and tell
  the user to start it with `npm start` from the repo root.
