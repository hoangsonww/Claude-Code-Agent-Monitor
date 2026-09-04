#!/usr/bin/env bash
# i18n-audit.sh — prove that every supported language is present on all five
# localization surfaces (dashboard UI keys, wiki page, mirrored READMEs,
# language switchers, locale-aware formatting), and that the Codex/OpenAI
# copies of this skill still match the canonical Claude Code one.
#
# The supported-language list is READ from `supportedLngs` in
# client/src/i18n/index.ts — the single source of truth — so adding a locale
# there immediately makes every other surface a reported gap until it is filled.
#
# Usage (from anywhere):
#   bash .claude/skills/i18n-parity/scripts/i18n-audit.sh
#
# Exits 0 when every surface is in parity, 1 otherwise, printing one FAIL line
# per gap with the exact file and locale. Requires node (already a dev
# dependency of this repo).
# @author Son Nguyen <hoangson091104@gmail.com>

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT" || exit 1

fails=0
checks=0

fail() {
  echo "FAIL  $*"
  fails=$((fails + 1))
}

ok() {
  checks=$((checks + 1))
}

# has FILE FIXED_STRING LABEL — the file must contain the literal string.
has() {
  if grep -qF -- "$2" "$1"; then ok; else fail "$3"; fi
}

section() {
  echo
  echo "── $1"
}

I18N_INDEX="client/src/i18n/index.ts"
LOCALES_DIR="client/src/i18n/locales"

# ── Supported languages (source of truth) ───────────────────────────────────
if [ ! -f "$I18N_INDEX" ]; then
  echo "FAIL  $I18N_INDEX not found — run this from the repository." >&2
  exit 1
fi

LOCALES=$(
  grep -o 'supportedLngs: \[[^]]*\]' "$I18N_INDEX" |
    grep -o '"[a-z-]*"' | tr -d '"' | tr '\n' ' '
)
if [ -z "${LOCALES// /}" ]; then
  echo "FAIL  could not read supportedLngs from $I18N_INDEX" >&2
  exit 1
fi
NON_EN=$(echo "$LOCALES" | tr ' ' '\n' | grep -v '^en$' | grep -v '^$' | tr '\n' ' ')

echo "Supported languages: $LOCALES"

# README mirror per locale. A new locale MUST get a row here (and a real file).
readme_for() {
  case "$1" in
    zh) echo "README-CN.md" ;;
    vi) echo "README-VN.md" ;;
    ko) echo "README-KO.md" ;;
    es) echo "README-ES.md" ;;
    *) echo "" ;;
  esac
}

# ── 1. Dashboard UI: namespace files + key parity ───────────────────────────
section "Surface 1 — dashboard UI (client/src/i18n/locales)"

EN_NS=$(ls "$LOCALES_DIR/en" 2>/dev/null | grep '\.json$' | sort)
if [ -z "$EN_NS" ]; then
  fail "$LOCALES_DIR/en has no namespace JSON files"
fi

for xx in $LOCALES; do
  if [ ! -d "$LOCALES_DIR/$xx" ]; then
    fail "$LOCALES_DIR/$xx/ is missing (locale declared in supportedLngs)"
    continue
  fi
  ok
  got=$(ls "$LOCALES_DIR/$xx" | grep '\.json$' | sort)
  if [ "$got" != "$EN_NS" ]; then
    missing=$(comm -23 <(echo "$EN_NS") <(echo "$got") | tr '\n' ' ')
    extra=$(comm -13 <(echo "$EN_NS") <(echo "$got") | tr '\n' ' ')
    [ -n "${missing// /}" ] && fail "$LOCALES_DIR/$xx/ missing namespaces: $missing"
    [ -n "${extra// /}" ] && fail "$LOCALES_DIR/$xx/ has namespaces English does not: $extra"
  else
    ok
  fi
done

# Key-path / value-type / interpolation-token parity against English.
parity=$(
  LOCALES="$LOCALES" node -e '
    const fs = require("fs");
    const path = require("path");
    const dir = "client/src/i18n/locales";
    const locales = process.env.LOCALES.trim().split(/\s+/).filter((l) => l !== "en");
    const flat = (v, p = "", out = {}) => {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        for (const [k, c] of Object.entries(v)) flat(c, p ? `${p}.${k}` : k, out);
      } else out[p] = v;
      return out;
    };
    const tokens = (v) =>
      typeof v === "string"
        ? [...v.matchAll(/{{\s*([^},\s]+)[^}]*}}|%\{\s*([^}\s]+)\s*\}/g)]
            .map((m) => m[1] ?? m[2])
            .filter(Boolean)
            .sort()
            .join(",")
        : "";
    for (const ns of fs.readdirSync(path.join(dir, "en")).filter((f) => f.endsWith(".json"))) {
      const en = flat(JSON.parse(fs.readFileSync(path.join(dir, "en", ns), "utf8")));
      for (const xx of locales) {
        const file = path.join(dir, xx, ns);
        if (!fs.existsSync(file)) continue;
        const loc = flat(JSON.parse(fs.readFileSync(file, "utf8")));
        for (const k of Object.keys(en)) {
          if (!(k in loc)) console.log(`${xx}/${ns}: missing key ${k}`);
          else if (typeof loc[k] !== typeof en[k]) console.log(`${xx}/${ns}: ${k} type ${typeof loc[k]} != ${typeof en[k]}`);
          else if (tokens(loc[k]) !== tokens(en[k])) console.log(`${xx}/${ns}: ${k} interpolation tokens differ`);
        }
        for (const k of Object.keys(loc)) if (!(k in en)) console.log(`${xx}/${ns}: key ${k} not in English`);
      }
    }
  ' 2>&1
)
if [ -n "$parity" ]; then
  while IFS= read -r line; do fail "$line"; done <<<"$parity"
else
  ok
fi

# ── 2. Language switchers ───────────────────────────────────────────────────
section "Surface 4 — language switchers and registration"

for xx in $LOCALES; do
  has "$I18N_INDEX" "\"$xx\"" "$I18N_INDEX: '$xx' not in supportedLngs/ns registration"
  if ! grep -qE "^      $xx: \{" "$I18N_INDEX"; then
    fail "$I18N_INDEX: no resources.$xx bundle"
  else
    ok
  fi
  has "client/src/components/Sidebar.tsx" "\"$xx\"" "Sidebar.tsx: '$xx' not in SUPPORTED_LANGUAGES"
  has "client/src/components/Sidebar.tsx" "base === \"$xx\"" "Sidebar.tsx: normalizeLanguage() does not accept '$xx' (regional tags fall back to en)"
  has "client/src/lib/paletteCommands.ts" "\"$xx\"" "paletteCommands.ts: '$xx' not in LANGUAGES (palette cannot switch to it)"
  has "client/src/lib/format.ts" "\"$xx\"" "format.ts: '$xx' not in the SupportedLanguage union"
  has "client/src/lib/format.ts" "language === \"$xx\"" "format.ts: getCurrentLanguage() does not whitelist '$xx'"
  # Switcher labels must exist in EVERY locale's nav.json, not just the new one.
  for host in $LOCALES; do
    navf="$LOCALES_DIR/$host/nav.json"
    [ -f "$navf" ] || continue
    if ! node -e "const n=require('./$navf');process.exit(n.languageNames&&n.languageNames['$xx']&&n.languageShort&&n.languageShort['$xx']?0:1)" 2>/dev/null; then
      fail "$navf: languageNames.$xx / languageShort.$xx missing (switcher shows the raw key in $host)"
    else
      ok
    fi
  done
done

for xx in $NON_EN; do
  has "client/src/lib/format.ts" "if (language === \"$xx\") return" "format.ts: getCurrentLocale() has no BCP-47 tag for '$xx'"
done

# ── 3. Wiki ─────────────────────────────────────────────────────────────────
section "Surface 2 — wiki (wiki/)"

# Bundles actually exported by wiki/i18n-content.js (read, not grepped — the
# body bundles and the plain bundles sit at different nesting levels).
WIKI_BODY_LOCALES=$(node -e 'global.window={};require("./wiki/i18n-content.js");const C=window.__WIKI_CONTENT_I18N||{};console.log(Object.keys(C).filter((k)=>k!=="plain").join(" "))' 2>/dev/null)
WIKI_PLAIN_LOCALES=$(node -e 'global.window={};require("./wiki/i18n-content.js");const C=window.__WIKI_CONTENT_I18N||{};console.log(Object.keys(C.plain||{}).join(" "))' 2>/dev/null)

REF_ATTR=""
for xx in $NON_EN; do
  # Both .lang-select-menu blocks (desktop header + mobile drawer).
  n=$(grep -c "data-lang=\"$xx\"" wiki/index.html)
  if [ "$n" -lt 2 ]; then
    fail "wiki/index.html: data-lang=\"$xx\" appears $n time(s); both .lang-select-menu blocks need it"
  else
    ok
  fi

  if ! echo " $WIKI_BODY_LOCALES " | grep -qF " $xx "; then
    fail "wiki/i18n-content.js: no '$xx' body-content bundle"
  else
    ok
  fi
  if ! echo " $WIKI_PLAIN_LOCALES " | grep -qF " $xx "; then
    fail "wiki/i18n-content.js: no plain.$xx heading/label bundle"
  else
    ok
  fi

  # T and META blocks in script.js, plus the CONTENT.plain merge list.
  blocks=$(grep -cE "^    $xx: \{" wiki/script.js)
  if [ "$blocks" -lt 2 ]; then
    fail "wiki/script.js: '$xx' has $blocks top-level block(s); both T and META are required"
  else
    ok
  fi
  has "wiki/script.js" "$xx: CONTENT.$xx" "wiki/script.js: '$xx' missing from the H content map"
  if ! grep -qE "^    $xx: \"" wiki/script.js; then
    fail "wiki/script.js: '$xx' missing from languageLabels (the switcher trigger shows English)"
  else
    ok
  fi
  has "wiki/script.js" "lang === \"$xx\"" "wiki/script.js: apply() does not map '$xx' to a document.documentElement.lang value"
  has "wiki/script.js" "n.indexOf(\"$xx\") === 0" "wiki/script.js: navigator.language detection never resolves to '$xx'"
  if ! grep -E '\]\.forEach\(\(lng\)' wiki/script.js | grep -qF "\"$xx\""; then
    fail "wiki/script.js: '$xx' missing from the CONTENT.plain -> T merge list"
  else
    ok
  fi

  # Every ATTRIBUTE_TRANSLATIONS entry must carry every locale.
  attr=$(grep -cE "^      $xx:" wiki/script.js)
  if [ -z "$REF_ATTR" ]; then
    REF_ATTR="$attr"
    REF_LOCALE="$xx"
    ok
  elif [ "$attr" != "$REF_ATTR" ]; then
    fail "wiki/script.js: '$xx' has $attr ATTRIBUTE_TRANSLATIONS values but '$REF_LOCALE' has $REF_ATTR"
  else
    ok
  fi

  has "client/tests/wiki-i18n.test.ts" "\"$xx\"" "client/tests/wiki-i18n.test.ts: '$xx' not in LANGUAGES (its wiki bundle is never asserted)"
done

# Stub detector: a bundle far smaller than the largest is an unfinished locale.
# Exact per-string coverage is asserted by client/tests/wiki-i18n.test.ts.
stub=$(
  node -e '
    global.window = {};
    require("./wiki/i18n-content.js");
    const C = window.__WIKI_CONTENT_I18N || {};
    const body = Object.keys(C).filter((k) => k !== "plain");
    const size = (o) => Object.keys(o || {}).length;
    const report = (label, obj, keys) => {
      const max = Math.max(...keys.map((k) => size(obj[k])));
      for (const k of keys) {
        const n = size(obj[k]);
        if (n < max * 0.6) console.log(`wiki/i18n-content.js: ${label}.${k} has ${n} entries vs ${max} for the largest locale — bundle looks unfinished`);
      }
    };
    if (body.length) report("content", C, body);
    if (C.plain) report("plain", C.plain, Object.keys(C.plain));
  ' 2>&1
)
if [ -n "$stub" ]; then
  while IFS= read -r line; do fail "$line"; done <<<"$stub"
else
  ok
fi

# ── 4. Mirrored READMEs ─────────────────────────────────────────────────────
section "Surface 3 — mirrored READMEs"

READMES="README.md"
for xx in $NON_EN; do
  f=$(readme_for "$xx")
  if [ -z "$f" ]; then
    fail "no README mirror mapped for '$xx' — add a case to readme_for() in this script and create the file"
    continue
  fi
  if [ ! -f "$f" ]; then
    fail "$f is missing (README mirror for '$xx')"
    continue
  fi
  ok
  READMES="$READMES $f"

  # Structural mirror: same number of markdown headings as the English source.
  en_h=$(grep -c '^#\{1,6\} ' README.md)
  xx_h=$(grep -c '^#\{1,6\} ' "$f")
  lo=$((en_h * 90 / 100))
  hi=$((en_h * 115 / 100))
  if [ "$xx_h" -lt "$lo" ] || [ "$xx_h" -gt "$hi" ]; then
    fail "$f has $xx_h headings vs $en_h in README.md — the mirror is incomplete or has drifted"
  else
    ok
  fi

  has "server/__tests__/plugins-marketplace.test.js" "$f" "server/__tests__/plugins-marketplace.test.js: $f has no COUNTED_DOCS entry (its documented counts are never verified)"
done

# Every README links to every other README.
for src in $READMES; do
  for dst in $READMES; do
    [ "$src" = "$dst" ] && continue
    has "$src" "$dst" "$src does not link to $dst (localized-docs cross-link line)"
  done
done

# ── 5. Docs that enumerate the languages ────────────────────────────────────
section "Docs enumerating the locale set"

for xx in $LOCALES; do
  has "docs/I18N.md" "\`$xx\`" "docs/I18N.md does not document '$xx'"
  # The landing page is English-only, but its stat label enumerates the codes.
  if ! grep 'Languages (' index.html | grep -qF "$xx"; then
    fail "index.html: the \"Languages (...)\" stat label does not list '$xx'"
  else
    ok
  fi
done

for xx in $NON_EN; do
  has "client/src/i18n/__tests__/i18n.test.ts" "\"$xx\"" "client/src/i18n/__tests__/i18n.test.ts: '$xx' not covered by the parity loops"
done

# ── 6. Agent mirrors ────────────────────────────────────────────────────────
section "Agent mirrors (.agents, .codex)"

mirror_out=$(bash "$ROOT/.claude/skills/i18n-parity/scripts/sync-agent-mirrors.sh" --check 2>&1)
if [ $? -eq 0 ]; then
  ok
else
  while IFS= read -r line; do
    case "$line" in
      STALE*|ORPHAN*) fail "$line" ;;
    esac
  done <<<"$mirror_out"
fi

# ── Result ──────────────────────────────────────────────────────────────────
echo
if [ "$fails" -eq 0 ]; then
  echo "✔ i18n parity clean — $checks checks passed across $(echo "$LOCALES" | wc -w | tr -d ' ') languages."
  exit 0
fi
echo "✘ $fails i18n parity gap(s); $checks checks passed."
echo "  Fix with .claude/skills/i18n-parity/SKILL.md (new language: references/new-language-checklist.md)."
exit 1
