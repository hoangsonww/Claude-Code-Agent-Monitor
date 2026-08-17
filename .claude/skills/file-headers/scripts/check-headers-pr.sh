#!/usr/bin/env bash
# check-headers-pr.sh — verify that applicable files touched in a git diff carry
# the mandatory copyright/authorship header. Used locally before opening a PR and
# by the file-headers GitHub Actions workflow on every pull request.
#
# Usage:
#   check-headers-pr.sh [<base-sha> <head-sha>]
#
# When omitted, compares the current branch against origin/master (or master).
# @author Son Nguyen <hoangson091104@gmail.com>

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
AUTHOR_MARK="@author Son Nguyen"
AUTHOR_EMAIL="hoangson091104@gmail.com"

usage() {
  cat <<'EOF'
Usage: check-headers-pr.sh [<base-sha> <head-sha>]

Checks only added/copied/renamed/modified files in the diff between base and
head. Applicable extensions: .js .ts .tsx .cjs .mjs .py .sh .css

The author line must appear in the file header using the syntax for that type:
  JS/TS/CSS  — block comment (/** ... @author ... */)
  Shell      — # comment after the shebang
  Python     — module docstring (""" ... @author ... """)
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

BASE_SHA="${1:-}"
HEAD_SHA="${2:-}"

cd "$ROOT"

if [[ -z "$BASE_SHA" || -z "$HEAD_SHA" ]]; then
  if git show-ref --verify --quiet refs/remotes/origin/master; then
    BASE_SHA="$(git merge-base HEAD origin/master)"
  elif git show-ref --verify --quiet refs/heads/master; then
    BASE_SHA="$(git merge-base HEAD master)"
  else
    echo "error: could not resolve base ref; pass <base-sha> <head-sha>" >&2
    exit 1
  fi
  HEAD_SHA="HEAD"
fi

# Return 0 when the path is subject to the header policy (keep in sync with
# check-headers.sh exclusions).
is_applicable_file() {
  local f="$1"

  case "$f" in
    */node_modules/*|*/dist/*|*/build/*|*/.git/*|*/data/*)
      return 1
      ;;
    */monitoring/.bin/*|*/monitoring/.data/*|*/__snapshots__/*)
      return 1
      ;;
  esac

  case "$f" in
    wiki/i18n-content.js|*/wiki/i18n-content.js)
      return 1
      ;;
  esac

  case "$f" in
    *.js|*.ts|*.tsx|*.cjs|*.mjs|*.py|*.sh|*.css)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

# Best-effort hint for contributors when a file fails.
header_hint_for() {
  local f="$1"
  case "$f" in
    *.py)
      echo '  expected: module docstring with @author Son Nguyen <hoangson091104@gmail.com>'
      ;;
    *.sh)
      echo '  expected: # block after shebang with @author Son Nguyen <hoangson091104@gmail.com>'
      ;;
    *.css)
      echo '  expected: /** @file ... @author Son Nguyen <hoangson091104@gmail.com> */'
      ;;
    *)
      echo '  expected: /** @file ... @author Son Nguyen <hoangson091104@gmail.com> */'
      ;;
  esac
}

# Require the exact author mark anywhere in the file (same rule as check-headers.sh).
has_author_header() {
  local f="$1"
  grep -q "$AUTHOR_MARK" "$f" && grep -q "$AUTHOR_EMAIL" "$f"
}

BASE_SHORT="$(git rev-parse --short "${BASE_SHA}" 2>/dev/null || echo "${BASE_SHA}")"
HEAD_SHORT="$(git rev-parse --short "${HEAD_SHA}" 2>/dev/null || echo "${HEAD_SHA}")"

checked=0
missing=0
skipped=0

echo "Checking authorship headers for files changed between ${BASE_SHORT}..${HEAD_SHORT}"

while IFS= read -r f; do
  [[ -z "$f" ]] && continue

  if ! is_applicable_file "$f"; then
    skipped=$((skipped + 1))
    continue
  fi

  if [[ ! -f "$f" ]]; then
    echo "SKIP (missing on disk): $f"
    skipped=$((skipped + 1))
    continue
  fi

  checked=$((checked + 1))

  if ! has_author_header "$f"; then
    echo "MISSING HEADER: $f"
    header_hint_for "$f"
    missing=1
  fi
done < <(git diff --name-only --diff-filter=ACMR "${BASE_SHA}" "${HEAD_SHA}")

if [[ "$checked" -eq 0 ]]; then
  echo "✔ No applicable source files changed in this diff (skipped ${skipped} path(s))."
  exit 0
fi

if [[ "$missing" -eq 0 ]]; then
  echo "✔ All ${checked} applicable changed file(s) carry the authorship header."
  exit 0
fi

echo
echo "Add the project header to each file listed above."
echo "See .claude/skills/file-headers/SKILL.md for per-type examples."
exit 1
