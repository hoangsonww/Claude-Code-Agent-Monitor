#!/usr/bin/env bash
# Dev-container bootstrap. Installs all workspace dependencies and builds the
# MCP server. Runs once, after the container is created.
#
# Deliberately does NOT install Claude Code hooks: hooks are a host-side concern
# (issue #193) and `scripts/install-hooks.js` refuses to run inside a container.
set -euo pipefail

echo "▶ Installing server + client + vscode-extension dependencies (npm run setup)…"
npm run setup

echo "▶ Installing and building the MCP server…"
npm run mcp:install
npm run mcp:build

cat <<'EOF'

✅ Dev environment ready.

  Develop:
    npm run dev            # server on :4820 + Vite client on :5173
    npm start              # production-style server (serves client/dist)

  Test:
    npm run test:server    # node --test
    npm run test:client    # vitest
    npm run test:mcp       # MCP server tests
    npm run mcp:typecheck  # MCP type check

  Docs:
    npm run openapi:yaml   # regenerate openapi.yaml from the live spec

⚠  Claude Code hooks are HOST-side. Do NOT run `npm run install-hooks` in this
   container — it is refused on purpose (issue #193). Run it on your HOST so the
   hook handler path exists there and POSTs to http://localhost:4820 (forwarded
   from this container).

   Electron desktop builds (npm run desktop:*) also need a host with a display
   and are not supported inside this container.
EOF
