---
paths:
  - "wiki/index.html"
  - "wiki/script.js"
  - "wiki/i18n-content.js"
  - "wiki/style.css"
  - "wiki/sw.js"
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
  ~450–550 characters (~65–80 words; the 39-card group spans 209–628 with a
  ~494 median). No lists, no sub-headings, no exhaustive keybinding/edge-case
  enumeration.
- **Screenshot captions** (`.screenshot-caption`): ~150–300 characters — emoji,
  bolded screen name, em dash, one dense sentence.
- **Card order is editorial.** A newly shipped feature is inserted by
  importance among the existing cards; it does not go first.
- Full detail (keyboard maps, degradation behaviour, per-group breakdowns)
  belongs in a normal `<section>` further down the page with `h3` + `<ul>`.
- Measure before finishing:
  `.claude/skills/update-project-docs/scripts/wiki-block-lengths.sh` must exit 0.

## Indentation and list markup

Prose lists use plain `<ul>` / `<ol>` with `<li>` children placed as **direct
children of their `<section>`**; the stylesheet's `.main-content section > ul` /
`> ol` rules supply the indent, marker, and item rhythm (the global reset zeroes
list padding, so without them a list renders its markers outside the content
column). A list nested inside a component (card, timeline step, callout) is
deliberately outside those rules and carries its own layout. Do not add ad-hoc inline
`padding-left` / `list-style` to fix indentation, and in new content keep a
`<ul>` out of a `<p>` — the browser closes the paragraph for you and the i18n
key then no longer matches the DOM.

**Never scope a rule for a block-level content element with `:not([class])`.**
The scroll-reveal pass in `script.js` adds `reveal-on-scroll` to every
below-the-fold direct child of a `<section>` at runtime, so such a rule matches
in the static file (and in jsdom, which does not run that script) and then
silently stops applying in the real browser. `a:not([class])` for inline links
is fine — only a section's own children get classed. `client/tests/wiki-i18n.test.ts`
enforces this.

**Verify wiki CSS in a browser that ran the page's JavaScript**, not against the
static HTML. Reliable local check:

```bash
python3 -m http.server 8899   # from the repo root
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --virtual-time-budget=6000 --dump-dom http://127.0.0.1:8899/wiki/index.html \
  | grep -o '<ul[^>]*>'      # shows the classes script.js actually applied
```

Do not narrow the page (hiding other sections, isolating a fragment) before
checking: moving a block above the fold changes whether it gets the reveal
class, which is exactly the variable under test.

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
- Run `npx vitest run tests/wiki-i18n.test.ts` from `client/` to
  check live-DOM prose and label coverage, metadata and assistive attributes,
  inline-tag preservation, and asset-version synchronization.
- The service worker is cache-first. After editing `index.html`, `style.css`,
  `script.js`, or `i18n-content.js`, bump that asset's query string
  (`style.css?v=N`, `script.js?v=N`, `i18n-content.js?v=N`) in `index.html`,
  bump the SAME value in the `PRECACHE` list in `wiki/sw.js`, and bump
  `CACHE_NAME`. The fetch handler matches on the full URL including the query,
  so a precache entry whose version differs from the page's is never served —
  first load and offline silently fall back to the network for that asset.
- Run `npm run format` before committing (the static wiki files are Prettier-managed).
