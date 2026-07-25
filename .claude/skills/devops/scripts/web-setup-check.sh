#!/bin/zsh
# @file Read-only audit of the web-app dev environment (root + client npm
# dependencies, native better-sqlite3 for the host Node). Lighter than
# desktop-setup-check.sh -- no Xcode CLT, no Electron, no Electron-ABI
# native rebuild, since `npm run dev` runs on the host Node directly.
# Prints one "KEY | STATUS | DETAIL" line per check; exits 0 always. Safe to
# run any time -- changes nothing.
# @author Son Nguyen <hoangson091104@gmail.com>

setopt null_glob

PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$PROJECT_ROOT" || exit 0

line() { printf '%-24s | %-8s | %s\n' "$1" "$2" "$3"; }

# --- Node.js / npm ---
if command -v node >/dev/null 2>&1; then
  line "node" "ok" "$(node --version)"
else
  line "node" "MISSING" "install Node.js LTS (20 or 22)"
fi

if command -v npm >/dev/null 2>&1; then
  line "npm" "ok" "$(npm --version)"
else
  line "npm" "MISSING" "ships with Node.js"
fi

# --- Root + client dependencies (npm run setup) ---
if [ -d "node_modules" ]; then
  line "root-deps" "ok" "node_modules present"
else
  line "root-deps" "MISSING" "run: npm run setup"
fi

if [ -d "client/node_modules" ]; then
  line "client-deps" "ok" "client/node_modules present"
else
  line "client-deps" "MISSING" "run: npm run setup"
fi

# --- Root's own better-sqlite3 (built for the HOST Node, not Electron's ABI
# --- -- server/index.js loads this directly when run via `npm run dev`) ---
sqlite_bin="node_modules/better-sqlite3/build/Release/better_sqlite3.node"
if [ -f "$sqlite_bin" ]; then
  line "better-sqlite3" "ok" "native binary present at $sqlite_bin"
else
  line "better-sqlite3" "MISSING" "run: npm run setup"
fi

exit 0
