---
name: i18n-parity
description: MANDATORY for every coding agent and contributor touching localized content — keep all five localization surfaces (dashboard UI keys, wiki page, mirrored READMEs, locale-aware formatting, language switchers) in parity across every supported language. Use automatically (without being asked) whenever you add or change user-visible UI copy, add an i18n key, edit README.md, edit wiki/index.html, or change docs that the READMEs and wiki mirror — and use the full new-language checklist whenever adding a language (a new README-XX.md, a new client/src/i18n/locales/<xx>/ directory, or a new lang-option in the wiki).
---

> **Mirror.** The canonical copy of this skill — and the `i18n-audit.sh`
> script it tells you to run — live at `.claude/skills/i18n-parity/`.
> Keep the two in sync; edit the canonical copy first.

# i18n Parity

This repository is localized on **five independent surfaces**, each with its own
mechanism. A change that lands on one and not the others leaves the product
half-translated: the English falls through, and the gap is invisible to anyone
working in English. This skill states the invariant, maps every surface to the
exact files, and gives one command that proves parity.

**The invariant: English is the source of truth on every surface, and no change
is done until every supported language carries it in the same PR.** A fallback
to English is a safety net, never a completed translation.

Supported languages are declared in one place — `supportedLngs` in
`client/src/i18n/index.ts`. Today:
**`en`, `zh`, `vi`, `ko`, `es`**. Everything below derives from that list; the
audit script reads it rather than hard-coding.

## The five surfaces

| # | Surface | English source of truth | Translations live in | Automated gate |
|---|---|---|---|---|
| 1 | **Dashboard UI** | `client/src/i18n/locales/en/*.json` | `client/src/i18n/locales/<xx>/*.json` (same 15 namespaces) | `client/src/i18n/__tests__/i18n.test.ts` — key, type, and interpolation-token parity |
| 2 | **Wiki page** | English text in the `wiki/index.html` DOM | `wiki/script.js` (`T`, `ATTRIBUTE_TRANSLATIONS`, `META`, `languageLabels`, the two language ladders) + `wiki/i18n-content.js` (`window.__WIKI_CONTENT_I18N`, both the body bundles and `plain`) | `client/tests/wiki-i18n.test.ts` — live-DOM prose coverage, inline-tag preservation, block-length budgets, asset-version sync |
| 3 | **Mirrored READMEs** | `README.md` | `README-CN.md` (zh), `README-VN.md` (vi), `README-KO.md` (ko), `README-ES.md` (es) | partial — `scripts/i18n-audit.sh` (existence, heading count, cross-links) and `server/__tests__/plugins-marketplace.test.js` (documented counts); prose parity is review-only |
| 4 | **Language switchers** | — | `client/src/components/Sidebar.tsx`, `client/src/lib/paletteCommands.ts`, the two `.lang-select-menu` blocks in `wiki/index.html`, `nav.json` `languageNames` / `languageShort` | `scripts/i18n-audit.sh` |
| 5 | **Locale-aware formatting** | — | `client/src/lib/format.ts` (`SupportedLanguage` union, `getCurrentLanguage()` whitelist, `getCurrentLocale()` BCP-47 map) | `client/src/lib/__tests__/format.test.ts` |

### What is deliberately NOT localized

Verified against the tree — do not go looking for translation hooks in these,
and do not add them without being asked:

- **The root landing page `index.html`** has no i18n layer. Do not add
  `data-lang` markup; put localized long-form content in the wiki instead. Its
  one language-aware element is the `Languages (en/zh/…)` stat label, which just
  enumerates the codes.
- **`client/index.html`** is an English shell: `<html lang="en">`,
  `og:locale=en_US`, and English `<title>`/meta. The React app never reassigns
  `document.documentElement.lang` when the user switches language — a known gap,
  not something a translation PR is expected to fix.
- **The CLI (`bin/ccam.js`), the MCP server (`mcp/`), the Express server
  (`server/`), the desktop shell (`desktop/`), the VS Code extension, and the
  statusline** contain no i18n wiring at all. Their output is English.
- **`client/src/lib/event-summary.ts` and `event-grouping.ts`** build tool-event
  headlines and bullets from English template literals (`Last message: …`,
  `3 lines stdout`, `2 matches`). Their MODULE_GUIDE boilerplate claims strings
  belong in i18n JSON, but neither file imports i18next. They sit outside the
  key system today; do not "fix" them as part of a localization change.
- **Number and date formatting is only locale-aware where the `format.ts`
  helpers are used.** Most components call `toLocaleString()` / 
  `toLocaleString(undefined, …)` directly, which follows the *browser* locale
  rather than the chosen UI language. In new code prefer `getCurrentLocale()`
  from `format.ts`; leave existing call sites alone unless asked.

## Workflow A — you changed content (the common case)

Find what you touched in the left column and ship everything in the right column
**in the same PR**.

| You changed | You must also do |
|---|---|
| Added/renamed a UI string or i18n key | Add the key to `en` **and every other locale** in the same namespace file. Same key path, same value type, same `{{interpolation}}` tokens. |
| Added a new namespace (new `*.json`) | Create it for every locale, then register the imports, the `resources` entry per language, and the `ns` array in `client/src/i18n/index.ts`. |
| Added user-visible wiki text in `wiki/index.html` | Follow `.claude/rules/wiki-i18n.md`: scannable layer (the `PLAIN` selector set — `.logo-sub`, `.section-label`, `.nav-section`, `.nav-empty`, `.stat-label`, `.t-label`, `h2`/`h3`/`h4`, `th`, `.hero-desc`, plus `.nav-link` / `.hero-badge` trailing text nodes) → `T` in `wiki/script.js`; body prose (the `HTML_SEL` set — `p`, `li`, `td`, `th`, captions, `.callout-body > strong`, `.route-desc`, footer) → `wiki/i18n-content.js` keyed by whitespace-normalized `innerHTML`; new `alt`/`aria-label`/`title`/`placeholder` → `ATTRIBUTE_TRANSLATIONS`. Then bump `CACHE_NAME` in `wiki/sw.js` and the matching `?v=` query strings. |
| Edited a section of `README.md` | Mirror the **same** edit at the corresponding section of `README-CN.md`, `README-VN.md`, `README-KO.md`, and `README-ES.md`. All four, every time. |
| Changed behavior that the README/wiki document (env var, event type, route, CLI command, feature) | Run the `update-project-docs` (`.claude/skills/update-project-docs/SKILL.md`) skill — it owns the change→docs mapping — then come back here for the translation propagation it triggers. |
| Changed a documented count (plugins, skills, namespaces, languages) | The count is repeated across all five READMEs, `ARCHITECTURE.md`, `docs/*.md`, `index.html`, `wiki/index.html`, `wiki/i18n-content.js`, and asserted in `server/__tests__/plugins-marketplace.test.js`. Grep the old number repo-wide; update every hit. |

## Workflow B — adding a new language

This is a large, exact, mechanical change. **Read
[`references/new-language-checklist.md`](references/new-language-checklist.md)
and work through it top to bottom** — it lists every file, in dependency order,
with the exact edit for each.

The three things contributors most often ship incomplete, stated up front:

1. **The README mirror must be complete.** `README-<XX>.md` is a full mirror of
   `README.md` — every section, every table row, every code block, every mermaid
   diagram, in the same order. Do not summarize, do not drop "less important"
   sections, do not stop halfway. Diff the heading list against `README.md`
   before you open the PR — the audit script compares heading counts, which
   catches a truncated mirror but not a reordered or silently condensed one.
2. **Every app key must be translated.** All 15 namespaces × every key. The
   parity test fails on a missing key, but it *passes* on a key you copied over
   in English — so read your diff for untranslated leftovers.
3. **The wiki must be translated completely**, not just the headings. That means
   a full `<xx>` bundle in `wiki/i18n-content.js` (thousands of body strings), a
   full `<xx>` block in `T`, `META`, and every entry of `ATTRIBUTE_TRANSLATIONS`
   in `wiki/script.js`. A locale that only fills `T` renders a page with
   translated headings over English paragraphs, which is worse than English.

## What stays in English (all surfaces)

Never translate: code inside `<code>`/backticks, commands, file and directory
paths, URLs, env-var names, HTTP methods and status codes, CLI flags, code
identifiers, numbers with units, brand and product names, Claude Code hook event
names (`PreToolUse`, `Stop`, …), tool names (`Bash`, `Agent`), and the product
terms `Claude Code` and `MCP`, plus `Agent` / `Subagent` — with one deliberate
exception: `zh`, `vi`, and `ko` keep `Agent` / `Subagent` literal, while Spanish
renders them `agente` / `subagente`. `client/src/i18n/__tests__/i18n.test.ts`
asserts both halves of that contract. Translate only the prose around them. A block that is *entirely* code or identifiers needs no wiki entry —
it correctly falls back to English.

Terminology, per-locale conventions, and the shared glossary live in
[`references/translation-style.md`](references/translation-style.md). Read it
before translating; drifting terminology across pages is the most common
review comment on localization PRs.

## Two traps worth knowing before you edit the wiki

1. **`client/tests/wiki-i18n.test.ts` parses `wiki/script.js` by exact source
   markers.** It slices the file between literal strings — `"  const T = "` …
   `"\n\n  const PLAIN"`, `"  const ATTRIBUTE_TRANSLATIONS = "` …
   `"\n  const ATTR"`, `"  const META = "` … `"\n  const trH"` — and `eval`s
   what it finds. Renaming, reordering, or re-indenting those declarations
   breaks the test with a confusing error. Add locales *inside* the existing
   objects; leave the declaration lines alone.
2. **The wiki's chosen language lives in `localStorage["wiki-lang"]`, not a URL
   parameter.** There is no `?lang=` support. First visit falls back to a
   `navigator.language` prefix ladder in `wiki/script.js`. To preview a locale,
   use the switcher, or run
   `localStorage.setItem("wiki-lang", "<xx>")` in the console and reload.

## This skill is mirrored for every agent

The canonical copy — and both scripts — live at `.claude/skills/i18n-parity/`.
It is mirrored, with links rewritten to repo-root-relative paths and an
`agents/openai.yaml` interface added, to:

- `.agents/skills/i18n-parity/` (the shared/OpenAI skill tree)
- `.codex/skills/i18n-parity/` (Codex)

**Editing this skill means regenerating the mirrors** — edit the canonical copy,
then run:

```bash
bash .claude/skills/i18n-parity/scripts/sync-agent-mirrors.sh
```

`i18n-audit.sh` runs that script in `--check` mode, so a stale mirror is a
reported gap rather than silent drift. The mirrors carry no scripts: they point
back at the canonical ones by repo-root path.

## Verify (do not skip)

```bash
# 1. Cross-surface parity: locale sets, namespace files, key parity, switcher
#    entries, wiki bundles, README mirrors and cross-links, agent-skill mirrors.
bash .claude/skills/i18n-parity/scripts/i18n-audit.sh

# 2. UI key/type/interpolation parity + locale formatting
npm run test:client

# 3. Wiki live-DOM coverage, inline tags, metadata, cache versions
cd client && npx vitest run tests/wiki-i18n.test.ts && cd ..

# 4. Documented counts asserted against the source tree
npm run test:server

# 5. The static wiki files and locale JSON are Prettier-managed
npm run format
```

`i18n-audit.sh` exits non-zero and names the exact file and locale for every
gap. Every check is a structural one — a named thing is present or it is not —
with a single exception: the `wiki/i18n-content.js` bundle-size check is a
**stub detector** (it flags a locale holding under 60% of the largest bundle's
entries). Exact per-string wiki coverage is asserted by
`client/tests/wiki-i18n.test.ts`, which walks the live DOM.

State explicitly which surfaces you updated and which you intentionally skipped
(with the reason), per the repo's verification policy in `CLAUDE.md`.

## Tips

- **Write the English first and get it right**, on all surfaces, before
  translating anything. Every other locale is derived from it; re-translating
  because the English moved is the biggest waste in this workflow.
- To find where a string already lives: `grep -rn "<neighbouring English text>"
  client/src/i18n/locales/en wiki/i18n-content.js wiki/script.js`.
- When adding a language, one locale per subagent is fine for the *wiki body*
  bundle (it is large), but keep the README mirror with a single author so the
  section order and terminology stay coherent.
- Wiki edits are cache-first: forgetting the `CACHE_NAME` / `?v=` bump means
  returning visitors never see the translation you just shipped.
