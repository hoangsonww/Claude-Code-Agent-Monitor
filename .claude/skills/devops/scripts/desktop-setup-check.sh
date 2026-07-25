#!/bin/zsh
# @file Read-only audit of the desktop-app build environment (Xcode CLT,
# npm dependencies, Electron/electron-builder, native better-sqlite3 binary).
# Prints one "KEY | STATUS | DETAIL" line per check; exits 0 always.
# Safe to run any time -- changes nothing.
# @author Son Nguyen <hoangson091104@gmail.com>

setopt null_glob

PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$PROJECT_ROOT" || exit 0

line() { printf '%-24s | %-8s | %s\n' "$1" "$2" "$3"; }

MIN_DISK_GB=3

# --- OS / hardware context ---
line "os" "info" "$(sw_vers -productVersion 2>/dev/null || uname -sr) ($(uname -m))"

avail_gb=$(df -g / | awk 'NR==2 {print $4}')
if [ "$avail_gb" -ge "$MIN_DISK_GB" ]; then disk_status="ok"; else disk_status="LOW"; fi
line "disk-free" "$disk_status" "${avail_gb} GB free (build needs ~${MIN_DISK_GB} GB free)"

# --- Xcode Command Line Tools (native module compile fallback) ---
if xcode-select -p >/dev/null 2>&1; then
  line "xcode-clt" "ok" "$(xcode-select -p)"
else
  line "xcode-clt" "MISSING" "run: xcode-select --install"
fi

# --- Node.js / npm ---
if command -v node >/dev/null 2>&1; then
  node_ver="$(node --version)"
  node_major="${${node_ver#v}%%.*}"
  if [ "$node_major" -eq 20 ] || [ "$node_major" -eq 22 ]; then
    line "node" "ok" "$node_ver (LTS -- prebuilt better-sqlite3 available)"
  else
    line "node" "info" "$node_ver (not 20/22 LTS -- native rebuild may need Xcode CLT)"
  fi
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

if [ -d "client/dist" ]; then
  line "client-build" "ok" "client/dist present"
else
  line "client-build" "MISSING" "run: npm run build"
fi

# --- desktop/ workspace: Electron + electron-builder + native rebuild ---
if [ -d "desktop/node_modules/electron" ]; then
  line "electron" "ok" "desktop/node_modules/electron present"
else
  line "electron" "MISSING" "run: npm run desktop:install"
fi

if [ -d "desktop/node_modules/electron-builder" ]; then
  line "electron-builder" "ok" "desktop/node_modules/electron-builder present"
else
  line "electron-builder" "MISSING" "run: npm run desktop:install"
fi

sqlite_bin="desktop/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
if [ -f "$sqlite_bin" ]; then
  line "better-sqlite3" "ok" "native binary present at $sqlite_bin"
else
  line "better-sqlite3" "MISSING" "run: npm run desktop:install (see DESKTOP.md if it fails)"
fi

exit 0
