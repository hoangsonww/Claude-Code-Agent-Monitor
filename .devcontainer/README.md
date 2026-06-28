# Dev Container (optional)

A ready-to-use, **opt-in** development environment for Claude Code Agent Monitor.
It is used **only** when you explicitly choose it — it changes nothing about
host-based development (`npm run dev` / `npm start` still work exactly as before).

## When to use it

Use it if you want a consistent, batteries-included toolchain without installing
Node, build tools, or Python on your machine — or if you're on a GitHub Codespace.

## How to open it

- **VS Code:** install the *Dev Containers* extension, then run
  **"Dev Containers: Reopen in Container"** (Command Palette).
- **GitHub Codespaces:** *Code → Create codespace on this branch*.

The first build runs `.devcontainer/post-create.sh`, which installs all workspace
dependencies (`npm run setup`) and builds the MCP server (`npm run mcp:install`,
`npm run mcp:build`).

## What's inside

| Component        | Detail                                                              |
| ---------------- | ------------------------------------------------------------------- |
| Base image       | `mcr.microsoft.com/devcontainers/javascript-node:22` (matches prod) |
| Native toolchain | `build-essential` + `python3` so `better-sqlite3` compiles          |
| Python           | `python3` / `python` for `statusline.py` and helper scripts         |
| sqlite3 CLI      | inspect the dashboard DB during development                         |
| Features         | GitHub CLI, Docker-in-Docker (build/run the project's own Dockerfile) |
| Forwarded ports  | `4820` (server API + WebSocket), `5173` (Vite client)               |
| Editor           | ESLint + Prettier (format on save), Vitest, Docker, YAML, Tailwind  |

## Everyday commands

```bash
npm run dev            # server on :4820 + Vite client on :5173
npm start              # production-style server (serves client/dist)
npm run test:server    # node --test
npm run test:client    # vitest
npm run test:mcp       # MCP server tests
npm run openapi:yaml   # regenerate openapi.yaml from the live spec
```

## Claude Code hooks are HOST-side (important — issue #193)

Claude Code runs on your **host**, so its hooks must point at a handler path that
exists on the host. This container therefore:

- does **not** bind-mount `~/.claude`, and
- does **not** install hooks — `scripts/install-hooks.js` **refuses to run inside
  a container** (it would write a container-internal handler path into your host
  settings and break every host hook with `MODULE_NOT_FOUND`).

Install hooks **on your host** instead:

```bash
npm run install-hooks   # on the HOST
```

The host hook handler POSTs to `http://localhost:4820`, which this container
forwards — so a host-installed hook reaches the containerized dashboard.

> Escape hatch: if you genuinely run Claude Code *inside* this same container,
> set `CCAM_ALLOW_CONTAINER_HOOKS=1` before `npm run install-hooks`.

## Not supported in the container

Electron desktop builds (`npm run desktop:*`) need a host with a display and are
host-only.
