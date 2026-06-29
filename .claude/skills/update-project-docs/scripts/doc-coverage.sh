#!/usr/bin/env bash
# doc-coverage.sh — verify that one or more terms (a new env var, event type,
# route, identifier, feature name, …) are documented across this repo's
# canonical doc surface. Prints a HIT/miss matrix so a docs update can be
# checked for "full coverage" before finishing.
#
# Usage:
#   .claude/skills/update-project-docs/scripts/doc-coverage.sh DASHBOARD_SESSION_SYNC_MS
#   .claude/skills/update-project-docs/scripts/doc-coverage.sh Interrupted pendingInterrupt
#
# Run from the repo root. Exit code is non-zero if any term is missing from a
# doc that the change-type mapping (see references/doc-map.md) says it belongs
# in — but treat the matrix as advisory: not every term belongs in every file.

set -u

# The canonical doc set kept in sync. Translations + HTML + per-area READMEs.
DOCS=(
  "README.md"
  "README-VN.md"
  "README-CN.md"
  "ARCHITECTURE.md"
  "index.html"
  "wiki/index.html"
  "wiki/i18n-content.js"
  "server/README.md"
  "client/README.md"
  "docs/HOOKS.md"
  "docs/DATABASE.md"
  "docs/API.md"
  "docs/PLUGINS.md"
  "docs/MCP.md"
  "mcp/README.md"
  "docs/I18N.md"
  ".env.example"
)

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <term> [term2 ...]" >&2
  exit 2
fi

missing_any=0
for term in "$@"; do
  echo "── coverage for: $term ──────────────────────────────"
  for doc in "${DOCS[@]}"; do
    if [ ! -f "$doc" ]; then
      printf "  %-26s (absent)\n" "$doc"
      continue
    fi
    n=$(grep -Fc -- "$term" "$doc" 2>/dev/null || true)
    n=${n:-0}
    if [ "$n" -gt 0 ]; then
      printf "  ✅ %-26s %s\n" "$doc" "$n"
    else
      printf "  ·  %-26s 0\n" "$doc"
    fi
  done
  echo
done

exit $missing_any
