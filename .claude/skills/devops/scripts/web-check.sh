#!/bin/zsh
# @file Read-only audit of build/run state for the web app (Express server +
# Vite client dev stack) -- shared by the web-build, web-up, and web-down
# commands. Prints one "KEY | STATUS | DETAIL" line per check; exits 0
# always. Safe to run any time -- changes nothing.
# @author Son Nguyen <hoangson091104@gmail.com>

setopt null_glob

PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$PROJECT_ROOT" || exit 0

line() { printf '%-24s | %-8s | %s\n' "$1" "$2" "$3"; }

PID_FILE="$HOME/.claude/.ccam-web-dev.pid"
LOG_FILE="$HOME/.claude/.ccam-web-dev.log"

# --- Dependencies (web-build/web-up need these; see /devops web-setup) ---
if [ -d "node_modules" ]; then
  line "root-deps" "ok" "node_modules present"
else
  line "root-deps" "MISSING" "run: /devops web-setup"
fi

if [ -d "client/node_modules" ]; then
  line "client-deps" "ok" "client/node_modules present"
else
  line "client-deps" "MISSING" "run: /devops web-setup"
fi

# --- Production client bundle (web-build's artifact). NOT required for
# --- web-up -- Vite serves straight from source in dev mode -- but is what
# --- `npm start` / the desktop app ship, so it's worth surfacing here. ---
if [ -d "client/dist" ]; then
  line "client-build" "ok" "client/dist present"
else
  line "client-build" "absent" "not built yet -- run: /devops web-build"
fi

# --- Running state (dev server started via /devops web-up) ---
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE" 2>/dev/null)" 2>/dev/null; then
  pid="$(cat "$PID_FILE")"
  port="$(grep -oE 'listen on :[0-9]+|using [0-9]+ instead' "$LOG_FILE" 2>/dev/null | tail -1 | grep -oE '[0-9]+')"
  line "web-running" "info" "running, PID $pid${port:+, port $port}"
else
  line "web-running" "info" "not running"
fi

exit 0
