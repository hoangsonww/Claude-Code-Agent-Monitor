#!/bin/zsh
# @file Read-only audit of build/install state for the desktop app -- shared
# by the desktop-build and desktop-remove commands. Prints one
# "KEY | STATUS | DETAIL" line per check; exits 0 always. Safe to run any
# time -- changes nothing.
# @author Son Nguyen <hoangson091104@gmail.com>

setopt null_glob

PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$PROJECT_ROOT" || exit 0

line() { printf '%-24s | %-8s | %s\n' "$1" "$2" "$3"; }

APP_NAME="Claude Code Monitor"
APP_PATH="/Applications/${APP_NAME}.app"
DATA_DIR="$HOME/Library/Application Support/${APP_NAME}"
LOG_DIR="$HOME/Library/Logs/${APP_NAME}"

REPO_VERSION="$(node -p "require('./package.json').version" 2>/dev/null)"

# --- Latest local arm64 DMG build artifact ---
dmgs=(desktop/release/*-arm64.dmg)
if [ -e "${dmgs[1]}" ]; then
  latest_dmg="$(ls -t desktop/release/*-arm64.dmg 2>/dev/null | head -1)"
  line "dmg-artifact" "ok" "$latest_dmg"
else
  line "dmg-artifact" "absent" "no arm64 DMG built yet -- run: /devops desktop-build"
fi

# --- Installed app in /Applications ---
if [ -d "$APP_PATH" ]; then
  installed_version="$(defaults read "$APP_PATH/Contents/Info.plist" CFBundleShortVersionString 2>/dev/null)"
  if [ -n "$REPO_VERSION" ] && [ "$installed_version" != "$REPO_VERSION" ]; then
    line "app-installed" "WRONG" "v${installed_version} installed, repo is v${REPO_VERSION} -- run: /devops desktop-build"
  else
    line "app-installed" "ok" "v${installed_version} at $APP_PATH"
  fi
else
  line "app-installed" "absent" "not installed -- run: /devops desktop-build"
fi

# --- Currently running ---
if pgrep -f "${APP_PATH}/Contents/MacOS/${APP_NAME}" >/dev/null 2>&1; then
  line "app-running" "info" "running"
else
  line "app-running" "info" "not running"
fi

# --- App data outside the installed bundle (survives reinstall/remove-app) ---
if [ -d "$DATA_DIR" ]; then
  data_size="$(du -sh "$DATA_DIR" 2>/dev/null | awk '{print $1}')"
  line "app-data" "info" "present at $DATA_DIR (${data_size})"
else
  line "app-data" "info" "absent (no data dir yet)"
fi

if [ -d "$LOG_DIR" ]; then
  line "app-logs" "info" "present at $LOG_DIR"
else
  line "app-logs" "info" "absent (no logs yet)"
fi

exit 0
