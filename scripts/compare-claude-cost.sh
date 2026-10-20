#!/usr/bin/env bash
# compare-claude-cost.sh — lists every Claude session whose dashboard cost differs
# from Claude Code's own recorded cost. Wrapper around compare-claude-cost.js that
# runs from any directory; all arguments are passed through.
#   scripts/compare-claude-cost.sh [--threshold USD] [--models] [--json] [--server URL]
# @author Son Nguyen <hoangson091104@gmail.com>

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is not on PATH (Node.js 22+ is required)." >&2
  exit 2
fi

exec node "$script_dir/compare-claude-cost.js" "$@"
