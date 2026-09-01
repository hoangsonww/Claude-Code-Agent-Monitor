---
paths:
  - "wiki/index.html"
  - "wiki/script.js"
  - "wiki/i18n-content.js"
---

# Wiki Internationalization Rules

The static wiki (`wiki/index.html`) is fully localized to English, Simplified
Chinese (`zh`), Vietnamese (`vi`), Korean (`ko`), and Spanish (`es`). English is
the DOM source of truth; `wiki/script.js` swaps text at runtime. **Any new or
changed user-visible wiki text MUST ship with `zh` + `vi` + `ko` + `es`
translations in the same change** — otherwise it falls back to English and the
page is half-translated.

## When you add or edit content in `wiki/index.html`

- The scannable layer — `.section-label`, `.nav-section`, `h2/h3/h4`,
  `.hero-desc`, `.nav-link`, `.hero-badge` — is keyed by plain text in the `T`
  dictionary inside `wiki/script.js`. Add the new English text as a key with its
  `zh`, `vi`, `ko`, and `es` values there.
- Body content — `.main-content p:not(.hero-desc)`, `li`, `td`, `th`,
  `.screenshot-caption`, `.callout-body > strong`, `.route-desc`, and the footer
  (`.wiki-footer .footer-note / .footer-col-title / .footer-col-links a`) — is
  keyed by **whitespace-normalized `innerHTML`** in `wiki/i18n-content.js`
  (`window.__WIKI_CONTENT_I18N`). Add an entry to every non-English locale whose
  **key is the element's `innerHTML` with every whitespace run collapsed to one
  space and ends trimmed**, and whose value keeps the same complete set of
  inline tags (`<code>`, `<strong>`, `<a>`, `<span>`).
- Add every new image `alt`, `aria-label`, `placeholder`, or `title` value to
  `ATTRIBUTE_TRANSLATIONS` in `wiki/script.js`, and keep `META` complete for
  every locale whenever page metadata changes.
- If you introduce a **new content container/class**, add its selector to
  `HTML_SEL` in `wiki/script.js` so the engine translates it.

## Fit the block you are writing into (length + placement)

The wiki is a designed page. Some blocks live in fixed-size boxes, so a new
entry that is 2–3x its neighbours breaks the layout rather than just reading
long. **Read the two blocks around yours and match their length, tone, markup,
and heading depth — never invent a new pattern for one entry.**

- **Feature carousel cards** (`#feature-carousel .feature-card`): one `<p>` of
  ~400–550 characters (~60–80 words). No lists, no sub-headings, no exhaustive
  keybinding/edge-case enumeration.
- **Screenshot captions** (`.screenshot-caption`): ~150–300 characters — emoji,
  bolded screen name, em dash, one dense sentence.
- **Card order is editorial.** A newly shipped feature is inserted by
  importance among the existing cards; it does not go first.
- Full detail (keyboard maps, degradation behaviour, per-group breakdowns)
  belongs in a normal `<section>` further down the page with `h3` + `<ul>`.
- Measure before finishing:
  `.claude/skills/update-project-docs/scripts/wiki-block-lengths.sh` must exit 0.

## Indentation and list markup

Prose lists use plain `<ul>` / `<ol>` with `<li>` children; the stylesheet's
`.main-content ul:not([class])` rules supply the indent, marker, and item
rhythm (the global reset zeroes list padding, so an unclassed list without
those rules renders flush against the content edge). Do not add ad-hoc inline
`padding-left` / `list-style` to fix indentation, and in new content keep a
`<ul>` out of a `<p>` (close the paragraph first) — the browser closes the
paragraph for you and the i18n key then no longer matches the DOM.

## What stays English (do NOT translate)

Anything inside `<code>`, commands, file/dir paths, URLs, env-var names, HTTP
methods/status codes, numbers + units, CLI flags, code identifiers, brand/product
names, hook event names (`PreToolUse`, `Stop`, …), and tool names (`Bash`,
`Agent`). Translate only the prose around them. A block that is entirely
code/identifier/product-name needs no entry (it correctly falls back to English).

## Verify, then bust caches

- Verify coverage against the live DOM with `jsdom` (already in
  `client/node_modules`): load `index.html`, run the `HTML_SEL` selectors with
  the same `norm(s) = s.replace(/\s+/g," ").trim()`, and confirm every
  real-prose block matches a dictionary key. Misses that are pure
  code/identifiers are fine; prose misses are bugs.
- Run `npx vitest run src/i18n/__tests__/wiki-i18n.test.ts` from `client/` to
  check live-DOM prose and label coverage, metadata and assistive attributes,
  inline-tag preservation, and asset-version synchronization.
- The service worker is cache-first. After editing `index.html`, `script.js`, or
  `i18n-content.js`, bump the asset query strings (`script.js?v=N`,
  `i18n-content.js?v=N`) in `index.html` AND bump `CACHE_NAME` in `wiki/sw.js`,
  or returning users keep the stale bundle.
- Run `npm run format` before committing (the static wiki files are Prettier-managed).
