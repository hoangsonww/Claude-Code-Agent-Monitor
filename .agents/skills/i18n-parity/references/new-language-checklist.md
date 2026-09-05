# Adding a New Language — Complete Checklist

Work top to bottom; later steps depend on earlier ones. Throughout, `<xx>` is
the new ISO 639-1 code (e.g. `ja`), `<XX>` the README suffix you choose
(`README-JP.md`), and `<xx-YY>` the BCP-47 tag used for date/number formatting
(`ja-JP`).

Pick the README suffix once and use it everywhere; the existing set is
`zh → CN`, `vi → VN`, `ko → KO`, `es → ES`.

Run the audit after each phase — it tells you exactly what is still missing:

```bash
bash .claude/skills/i18n-parity/scripts/i18n-audit.sh
```

---

## Phase 1 — Register the locale

- [ ] `client/src/i18n/index.ts`
  - [ ] Add `import <ns>_<xx> from "./locales/<xx>/<ns>.json";` for **all 15
        namespaces** (`common`, `nav`, `dashboard`, `sessions`, `activity`,
        `analytics`, `workflows`, `settings`, `kanban`, `errors`, `updates`,
        `ccConfig`, `run`, `alerts`, `splash`) — copy the `es` import block.
  - [ ] Add the `<xx>: { ... }` entry to `resources`, listing all 15 namespaces.
  - [ ] Add `"<xx>"` to `supportedLngs`.
  - [ ] Update the file's header comment, which names the supported languages.
- [ ] `client/src/lib/format.ts`
  - [ ] Add `| "<xx>"` to the `SupportedLanguage` union.
  - [ ] Add the `language === "<xx>"` branch in `getCurrentLanguage()`.
  - [ ] Add `if (language === "<xx>") return "<xx-YY>";` to the locale map.
- [ ] `client/src/components/Sidebar.tsx`
  - [ ] Add `"<xx>"` to `SUPPORTED_LANGUAGES`.
  - [ ] Add the `base === "<xx>"` case to `normalizeLanguage()` so regional tags
        (`<xx>-YY`) resolve instead of falling back to `en`.
- [ ] `client/src/lib/paletteCommands.ts` — add `"<xx>"` to `LANGUAGES` so the
      command palette can switch to it.

Nothing else in the client needs touching: `client/index.html` is an English
shell (`<html lang="en">`, `og:locale`) and the app does not reassign
`document.documentElement.lang` on switch.

## Phase 2 — Translate the dashboard UI

- [ ] Create `client/src/i18n/locales/<xx>/` with **all 15 `*.json` files**,
      copied from `en/` and then translated.
- [ ] Every key, at every nesting level, must exist with the **same key path**,
      the **same value type**, and the **same `{{interpolation}}` tokens** as
      `en`. `client/src/i18n/__tests__/i18n.test.ts` enforces this.
- [ ] Plural keys use the i18next v4 suffixes `_one` / `_other`. Key parity is
      absolute, so the new locale needs **both** forms for every plural key even
      if the language has no plural inflection — give both the same string, the
      way `zh`/`vi`/`ko` already do. (The stray `_plural` keys in `kanban.json`
      and `sessions.json` are legacy and no longer resolved; mirror them for
      parity, but do not create new ones.)
- [ ] Add `"<xx>"` to **`languageNames` and `languageShort` in every locale's
      `nav.json`** — `en`, `zh`, `vi`, `ko`, `es`, and the new one. This is the
      switcher label; a missing entry renders the raw key in that language.
- [ ] Read the diff for strings you copied but never translated. The parity test
      passes on English left in a `<xx>` file — only review catches it.

## Phase 3 — Translate the wiki (`wiki/`)

The wiki is the largest surface. English lives in the `wiki/index.html` DOM and
is swapped at runtime; see `.claude/rules/wiki-i18n.md`
for the mechanism and the length/markup constraints.

- [ ] `wiki/i18n-content.js`
  - [ ] Update the file's header comment, which names the bundled languages.
  - [ ] Add a top-level `<xx>: { ... }` bundle: **every body-content string**
        (`p`, `li`, `td`, `th`, `.screenshot-caption`, `.callout-body > strong`,
        `.route-desc`, footer). Keys are the element's `innerHTML` with every
        whitespace run collapsed to one space and the ends trimmed; values keep
        the identical set of inline tags (`<code>`, `<strong>`, `<a>`, `<span>`).
  - [ ] Add `plain.<xx>` with the heading/label entries.
  - [ ] Mirror the `Object.assign(...)` appendix blocks at the end of the file.
- [ ] `wiki/script.js` — **eight** separate edits; missing any one leaves the
      locale half-wired. Add them *inside* the existing objects: the wiki test
      slices this file on literal markers (`"  const T = "`, `"  const
      ATTRIBUTE_TRANSLATIONS = "`, `"  const META = "`), so do not rename,
      reorder, or re-indent those declaration lines.
  - [ ] Add the `<xx>` block to `T` — the scannable layer matched by the `PLAIN`
        selector (`.logo-sub`, `.section-label`, `.nav-section`, `.nav-empty`,
        `.stat-label`, `.t-label`, `.main-content h2/h3/h4/th`, `.hero-desc`)
        plus the `TEXTNODE_SEL` trailing text nodes (`.nav-link`, `.hero-badge`)
        and UI chrome (`Search docs...`, `No results found`).
  - [ ] Add `<xx>: CONTENT.<xx> || {}` to the `H` map.
  - [ ] Add an `<xx>` value to **every entry** of `ATTRIBUTE_TRANSLATIONS`
        (`alt`, `aria-label`, `title`, `placeholder`) — currently 52 entries.
  - [ ] Add the `<xx>` block to `META` (title, description, socialTitle,
        socialDescription, twitterDescription, socialImageAlt).
  - [ ] Add `"<xx>"` to the `["zh", "vi", "ko", "es"]` array that merges
        `CONTENT.plain` into `T`.
  - [ ] Add `<xx>: "<native name>"` to `languageLabels` — without it the
        switcher trigger reads "English" while the page is translated.
  - [ ] Add the `<xx>` branch to the `document.documentElement.lang` ladder
        inside `apply()`, mapping to the BCP-47 tag.
  - [ ] Add the `<xx>` branch to the first-visit `navigator.language` ladder
        (`n.indexOf("<xx>") === 0`), or the locale is only ever reachable by
        picking it manually.
  - [ ] Update the file's header comment, which names the wiki's languages.
- [ ] If you introduced a **new content container/class**, add its selector to
      `HTML_SEL` (body prose) or `PLAIN` (scannable labels) so the engine
      translates it at all.
- [ ] `wiki/index.html`
  - [ ] Add `<button type="button" class="lang-option" data-lang="<xx>" role="option" aria-selected="false">Native name</button>`
        to **both** `.lang-select-menu` blocks (desktop header and mobile drawer).
  - [ ] Update the prose that names the shipped languages ("five languages — …").
- [ ] **Bust the cache** (mandatory — the service worker is cache-first):
      bump `i18n-content.js?v=N` and `script.js?v=N` in `wiki/index.html`, bump
      the **same** values in `PRECACHE` in `wiki/sw.js`, and bump `CACHE_NAME`.
      A `?v=` mismatch between the two files means the precached asset is never
      served.

## Phase 4 — Mirror the README

- [ ] Create `README-<XX>.md` as a **complete mirror of `README.md`**: every
      section, every table (same rows, same column count), every code block,
      every mermaid diagram, every badge, in the same order. Nothing summarized,
      nothing dropped.
- [ ] Keep untranslated: code, commands, paths, URLs, env-var names, CLI flags,
      identifiers, mermaid node IDs, brand and product names, hook event names.
      Translate mermaid **labels**, not node IDs.
- [ ] Update the localized-docs cross-link line (around line 73–74) in **all**
      of `README.md`, `README-CN.md`, `README-VN.md`, `README-KO.md`,
      `README-ES.md`, and the new file, so every README links to every other.
- [ ] `server/__tests__/plugins-marketplace.test.js` — add a `COUNTED_DOCS`
      entry for `README-<XX>.md` with regexes matching how the plugin / skill
      counts are phrased in the new language.

## Phase 5 — Update the docs that enumerate languages

Grep first — this list is the current state, not a guarantee:

```bash
grep -rn 'en/zh/vi/ko/es\|five languages\|"en", "zh", "vi", "ko", "es"' \
  --include='*.md' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.html' \
  . --exclude-dir=node_modules --exclude-dir=dist
```

- [ ] `docs/I18N.md` — supported-language line, `supportedLngs`, the locale map
      (`<xx>` → `<xx-YY>`), the ERD `code`/`locale` strings, the classDiagram
      `supportedLngs`, the `stateDiagram-v2` transitions, the format flowchart
      branch, the test matrix, and the operational checklist.
- [ ] `docs/README.md` — the "Internationalization Support (en/zh/…)" heading
      and the supported-codes paragraph.
- [ ] `ARCHITECTURE.md` — the localization-stack paragraph, the command-palette
      actions row, and the `splash` namespace note.
- [ ] `client/README.md` — the palette actions row.
- [ ] `index.html` — the `Languages (en/zh/vi/ko/es)` stat label. The landing
      page itself stays English-only.
- [ ] `.claude/rules/wiki-i18n.md` and `.claude/rules/i18n-parity.md` — the
      locale lists.
- [ ] `.claude/skills/update-project-docs/SKILL.md` and
      `references/doc-map.md` — the README lists.
- [ ] `.github/CONTRIBUTING.md` — the localization section, if it names locales.

## Phase 6 — Extend the tests

- [ ] `client/src/i18n/__tests__/i18n.test.ts` — add `"<xx>"` to the parity loop
      and to the two `["en", "zh", "vi", "ko", "es"]` coverage loops; add a
      nav-keys test and a non-explicit-tag test (`<xx>-YY` resolves to `<xx>`)
      mirroring the existing per-language cases.
- [ ] `client/src/lib/__tests__/format.test.ts` — add the `<xx>` → `<xx-YY>`
      formatting case.
- [ ] `client/src/components/__tests__/Sidebar.test.tsx` — update the
      "all five languages" expectation to the new count.
- [ ] `client/tests/wiki-i18n.test.ts` — add `"<xx>"` to `LANGUAGES` so the wiki
      coverage assertions run against the new bundle.

## Phase 7 — Verify

```bash
bash .claude/skills/i18n-parity/scripts/i18n-audit.sh   # must exit 0
npm run verify                                          # headers, format, typecheck, server + client tests
cd client && npx vitest run tests/wiki-i18n.test.ts     # wiki live-DOM coverage
```

Then read the wiki top to bottom in the new locale. There is **no `?lang=` URL
parameter** — the choice lives in `localStorage["wiki-lang"]`, so either pick it
in the switcher or run this in the console and reload:

```js
localStorage.setItem("wiki-lang", "<xx>");
```

Any English paragraph under a translated heading is a missing
`wiki/i18n-content.js` entry; an English switcher label with a translated page
is a missing `languageLabels` entry.

Finally, run the `update-project-docs` (`.claude/skills/update-project-docs/SKILL.md`)
skill — a new language is a user-facing feature and belongs in the feature
tables and the wiki's own feature list.
