---
description: Quick Claude Code config audit — counts per surface (user vs project) and totals.
---

Run a fast configuration audit against the Agent Monitor Config Explorer at
`http://localhost:4820`. Fetch the overview in one call:

```bash
curl -s http://localhost:4820/api/cc-config/overview
```

The response is `{ roots, counts }` where `counts` includes:
`skills`, `agents`, `commands`, `outputStyles` (each `{ user, project }`),
`plugins`, `pluginsEnabled`, `pluginsDisabled`, `marketplaces`, `keybindings`,
`mcpServers` (`{ user, project }`), `hooks` (`{ user, project, "project-local" }`),
`memory`, and `settingsFiles`.

Print a compact one-screen table — one row per surface with User, Project, and
Total columns (sum the two scopes; for plugins/memory/etc. that have no scope
split, show the single total). Echo the resolved `roots.claudeHome` and
`roots.projectRoot` on the first line so the user knows what was inspected.

```
Config Audit  (home=~/.claude  project=/path/to/repo)
  Skills .......... user 22  project 3   total 25
  Agents .......... user  7  project 1   total  8
  Commands ........ user 14  project 0   total 14
  Output styles ... user  2  project 0   total  2
  Plugins ......... 9  (enabled 7 / disabled 2)
  Marketplaces .... 2
  MCP servers ..... user 5  project 1   total  6
  Hooks ........... user 7  project 0  project-local 0  total 7
  Memory .......... 41 entries
  Settings files .. 2
```

End with a one-line verdict: note the largest surface and any obvious sprawl
(e.g. heavy user-scope skills/commands). Cite only the numbers the API
returned — never fabricate counts. If the dashboard is unreachable, say so and
tell the user to start it with `npm start` from the repo root. Keep it to the
table + verdict; no extra prose.
