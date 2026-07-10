# File Header Rules (binding for every coding agent)

- Every applicable source file (`.js/.ts/.tsx/.cjs/.mjs/.py/.sh/.css` — excluding `node_modules/`, `dist/`, `data/`, minified/vendored, generated `wiki/i18n-content.js`, snapshots) MUST start with the header comment: a truthful file overview plus the exact line `@author Son Nguyen <hoangson091104@gmail.com>`.
- Creating a new applicable file → write the header before any code (after the shebang in scripts).
- Editing a file that lacks the header → add it in the same change; if the edit changes the file's purpose, update the overview.
- Formats and the repo-wide audit script live in `.claude/skills/file-headers/` (`bash .claude/skills/file-headers/scripts/check-headers.sh` must exit 0).
