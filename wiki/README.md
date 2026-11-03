# wiki/

The localized static wiki: a single-page product and architecture tour published at <https://hoangsonww.github.io/Claude-Code-Agent-Monitor/wiki/>. It is a self-contained, offline-capable PWA with no build step and no third-party CDN requests.

It is separate from the task-oriented [GitHub Wiki](https://github.com/hoangsonww/Claude-Code-Agent-Monitor/wiki) and from the exact technical contracts in [`docs/`](../docs/README.md).

## Files

| File              | Purpose |
| ----------------- | ------- |
| `index.html`      | The page. English DOM content is the source of truth for every language. |
| `script.js`       | Mermaid setup, navigation, and the runtime language switcher (the `T` dictionary for short labels). |
| `i18n-content.js` | Generated-style dictionary of translated body HTML, keyed by whitespace-normalized English `innerHTML`. |
| `style.css`       | Page styles. |
| `sw.js`           | Service worker: precaches assets, network-first HTML, cache-first CSS/JS. |
| `manifest.json`   | PWA manifest. |
| `mermaid.min.js`  | Vendored `mermaid@10.9.6` build (do not edit). |

Fonts come from the repo-root [`fonts/`](../fonts/) directory via `fonts/fonts.css`.

## Previewing locally

Serve from the repo root so the relative `../fonts/` path resolves:

```bash
python3 -m http.server 8000
# open http://localhost:8000/wiki/
```

The service worker caches aggressively; use a private window or "Update on reload" in DevTools while editing.

## Editing rules

The wiki ships in English, Simplified Chinese (`zh`), Vietnamese (`vi`), Korean (`ko`), Spanish (`es`), French (`fr`), German (`de`), Portuguese (`pt`), and Italian (`it`). Any new or changed visible text must include all eight translations in the same change, and changed assets need their cache versions bumped: the asset's query string in `index.html` (`style.css?v=N`, `script.js?v=N`, `i18n-content.js?v=N`), the **same** versioned URL in the `PRECACHE` list in `sw.js`, and `CACHE_NAME` in `sw.js`. If the `PRECACHE` URL doesn't match `index.html`, the edited asset isn't served from cache and won't load offline.

The full procedure is in [`.claude/rules/wiki-i18n.md`](../.claude/rules/wiki-i18n.md). Verify with:

```bash
bash .claude/skills/i18n-parity/scripts/i18n-audit.sh
```
