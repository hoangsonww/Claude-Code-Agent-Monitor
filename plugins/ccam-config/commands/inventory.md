---
description: One-screen inventory of skills, agents, commands, MCP servers, and hooks counts.
---

Print a one-screen inventory of the user's Claude Code config from the Agent
Monitor Config Explorer at `http://localhost:4820`. Fetch the overview once:

```bash
curl -s http://localhost:4820/api/cc-config/overview
```

From `counts`, surface just the five core surfaces:
- **skills** — `counts.skills.user + counts.skills.project`
- **agents** — `counts.agents.user + counts.agents.project`
- **commands** — `counts.commands.user + counts.commands.project`
- **mcp** — `counts.mcpServers.user + counts.mcpServers.project`
- **hooks** — `counts.hooks.user + counts.hooks.project + counts.hooks["project-local"]`

Print a single compact block with the total for each, plus the user/project
split in parentheses where it applies:

```
Config Inventory
  Skills ... 25   (user 22 / project 3)
  Agents ...  8   (user 7 / project 1)
  Commands . 14   (user 14 / project 0)
  MCP ......  6   (user 5 / project 1)
  Hooks ....  7   (user 7 / project 0 / local 0)
```

Cite only the numbers the API returned — never fabricate counts. If the
dashboard is unreachable, say so and tell the user to start it with `npm start`
from the repo root. Keep it to the block only; no extra prose.
