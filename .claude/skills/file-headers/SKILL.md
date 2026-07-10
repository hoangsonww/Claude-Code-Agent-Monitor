---
name: file-headers
description: MANDATORY for every coding agent (Claude Code, Codex, or any other) on every change-set — every applicable source file the agent creates or updates MUST start with the project's copyright/authorship header (file overview + exact author line). Use automatically whenever writing a new file or editing an existing one; do not wait to be asked. Covers JS/TS/TSX/CJS/MJS, Python, shell, and CSS. Includes the audit script to verify repo-wide compliance.
---

# File Headers — Copyright Comment + File Overview

Every applicable source file in this repository starts with a header comment
containing a **file overview** and the **exact author line**:

```
@author Son Nguyen <hoangson091104@gmail.com>
```

The name and email must be exactly as above — no variations, no substitutions,
no other names. This applies to **every coding agent** working in this repo
(Claude Code, Codex, or any other tool): when you **create** a new applicable
file, write the header first; when you **update** an existing applicable file
that is missing the header, add it as part of the same change.

## Applicable files

| Included | Excluded |
| -------- | -------- |
| `*.js`, `*.ts`, `*.tsx`, `*.cjs`, `*.mjs` | anything under `node_modules/`, `dist/`, `build/`, `data/` |
| `*.py`, `*.sh` | vendored/minified files (`*.min.js`, `wiki/mermaid.min.js`) |
| `*.css` | generated files (`wiki/i18n-content.js` — carries its own AUTO-GENERATED banner) |
| | snapshots (`__snapshots__/`), lockfiles, JSON/YAML/Markdown |

## Header formats by file type

**JS / TS / TSX — server & scripts style** (overview inline in `@file`):

```js
/**
 * @file One-to-few-sentence overview of what this file does and why it
 * exists. Mention the key contracts or invariants the file owns.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
```

**JS / TS / TSX — client style** (`@file` name + `@description` overview), used
under `client/src/`:

```ts
/**
 * @file ComponentName.tsx
 * @description What the component/module renders or provides and how it fits
 * into the app.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
```

**CSS** (same block-comment shape as `client/src/index.css`):

```css
/**
 * @file file.css
 * @description What these styles cover.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
```

**Shell** (`#` block right after the shebang; existing overview comments count —
just make sure the `@author` line is in the block):

```bash
#!/usr/bin/env bash
# script-name.sh — what the script does, one to few lines.
# @author Son Nguyen <hoangson091104@gmail.com>
```

**Python** (inside the module docstring):

```python
"""
module.py — what the module does.

@author Son Nguyen <hoangson091104@gmail.com>
"""
```

## Rules

1. **New file → header first.** Any applicable file you create starts with the
   header before any code (after the shebang for scripts).
2. **Touched file missing header → add it.** If you edit a file that lacks the
   header, add one in the same commit. Write a real overview — describe what
   the file actually does; never a placeholder like "TODO" or "utility file".
3. **Exact author line.** `@author Son Nguyen <hoangson091104@gmail.com>` —
   byte-exact, in every file type (shell and Python use it inside `#` / docstring
   comments).
4. **Don't churn existing headers.** If a file already has a compliant header,
   leave it alone unless the file's purpose changed (then update the overview).
5. **Overviews must stay truthful.** When an edit changes what a file does,
   update its `@file`/`@description` overview in the same change.

## Audit

Run the bundled checker to list any applicable file missing the header:

```bash
bash .claude/skills/file-headers/scripts/check-headers.sh
```

Exit code `0` = fully compliant; `1` = the printed files are missing headers.
Run it before finishing any change-set that adds files, and during reviews.
