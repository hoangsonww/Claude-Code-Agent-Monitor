---
description: CCAM platform status across hooks, config, updates, and MCP prerequisites
---

Run `ccam health`, `ccam hooks status`, `ccam config claude overview`,
`ccam config codex overview`, and `ccam update-check`. Note that
`ccam update-check` runs `git fetch --prune`, so it updates local Git metadata
without changing working-tree files. Also check whether `mcp/build/index.js`
exists. Report exact provider hook state, configuration roots, dashboard
version, and MCP build readiness. Do not modify configuration or install hooks.
