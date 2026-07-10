#!/usr/bin/env bash
# check-headers.sh — audit the repo for applicable source files missing the
# mandatory copyright/authorship header (see .claude/skills/file-headers).
# Prints each non-compliant file; exits 0 when fully compliant, 1 otherwise.
# @author Son Nguyen <hoangson091104@gmail.com>

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
AUTHOR_MARK="@author Son Nguyen"

missing=0
while IFS= read -r f; do
  if ! grep -q "$AUTHOR_MARK" "$f"; then
    echo "MISSING HEADER: ${f#"$ROOT"/}"
    missing=1
  fi
done < <(
  find "$ROOT" \
    \( -name node_modules -o -name dist -o -name build -o -name .git \
       -o -path "$ROOT/data" -o -name "__snapshots__" \) -prune -o \
    -type f \( -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.cjs" \
       -o -name "*.mjs" -o -name "*.py" -o -name "*.sh" -o -name "*.css" \) \
    ! -name "*.min.js" ! -path "*/wiki/i18n-content.js" -print
)

if [ "$missing" -eq 0 ]; then
  echo "✔ All applicable files carry the authorship header."
fi
exit "$missing"
