# Contributing to Agent Dashboard

Thanks for taking the time to contribute. Please read this guide before opening a PR or issue.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Contributor License Agreement (CLA)](#contributor-license-agreement-cla)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branching and Commits](#branching-and-commits)
- [Pull Requests](#pull-requests)
- [Testing](#testing)
- [Translations and Internationalization](#translations-and-internationalization)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

---

## Contributor License Agreement (CLA)

All contributions require a signed **[Contributor License Agreement](../CLA.md)**. This is enforced automatically — there is nothing to set up ahead of time.

1. Open your pull request as normal.
2. On your **first** PR, the `🖋️ CLA Assistant` bot comments asking you to sign. Read [`CLA.md`](../CLA.md), then post this comment on the PR, verbatim:

   ```
   I have read the CLA Document and I hereby sign the CLA
   ```

3. The bot records your signature and turns the **CLA Assistant** status check green. The PR cannot be merged until it is green.

You sign **once** — the signature covers all of your current and future contributions, so returning contributors are never asked again. If you contribute **on behalf of a company**, contact the maintainer ([@hoangsonww](https://github.com/hoangsonww)) to arrange a Corporate CLA first.

---

## Getting Started

### Prerequisites

- Node.js 20+ (22+ recommended for automatic SQLite fallback)
- npm 9+

### Setup

```bash
git clone https://github.com/hoangsonww/Claude-Code-Agent-Monitor.git
cd Claude-Code-Agent-Monitor
npm run setup
npm run dev
```

The Express server runs on `http://localhost:4820` and the Vite dev server on `http://localhost:5173`.

---

## Development Workflow

The repo has two packages:

| Package | Path | Description |
| --- | --- | --- |
| Server | `server/` | Express 4 REST API + WebSocket + SQLite |
| Client | `client/` | React 18 + Vite + Tailwind CSS SPA |

**Adding a new API endpoint:**

1. Add prepared statement(s) to `server/db.js` if new queries are needed
2. Add route file in `server/routes/`
3. Mount the router in `server/index.js`

**Adding a new page:**

1. Create component in `client/src/pages/`
2. Add route in `client/src/App.tsx`
3. Add sidebar link in `client/src/components/Sidebar.tsx`

---

## Branching and Commits

- Branch off `master`. Use a short, descriptive branch name:
  - `feat/budget-alerts`
  - `fix/token-counting`
  - `docs/setup-guide`
  - `chore/upgrade-vite`

- Commit messages should be concise and use the imperative mood:
  - `add per-session cost breakdown endpoint`
  - `fix stale session detection on resume`
  - `update Dockerfile to node 22`

- Do not commit directly to `master`.

---

## Pull Requests

- Fill out the PR template completely.
- Keep PRs focused — one logical change per PR.
- All PRs require passing tests and a clean TypeScript build.
- Add screenshots for any UI changes.
- Request review from a maintainer when ready.

**Before submitting:**

```bash
npm test           # all server and client tests must pass
npm run format     # run Prettier
bash .claude/skills/file-headers/scripts/check-headers-pr.sh origin/master HEAD
```

Applicable source files (`.js`, `.ts`, `.tsx`, `.py`, `.sh`, `.css`, etc.) must
include the `@author Son Nguyen <hoangson091104@gmail.com>` header — CI enforces
this on every PR via the **File Headers** workflow.

---

## Testing

Tests live alongside their source:

```bash
npm test                    # all packages
npm run test:server         # server integration tests only
npm run test:client         # client unit tests only
```

**Rules:**

- Write tests for every feature added or modified.
- Server tests use a real SQLite database (temp file) — do not mock the DB.
- Client tests use Vitest + jsdom.
- All tests must pass before a PR can be merged.

---

## Translations and Internationalization

The dashboard ships in **English (`en`), Simplified Chinese (`zh`), Vietnamese
(`vi`), Korean (`ko`), and Spanish (`es`)** across five independent surfaces.
English is the source of truth on all of them, and **a change is not merged
until every supported language carries it in the same PR** — falling back to
English is a safety net, not a completed translation.

| Surface | English source | Translations live in |
|---|---|---|
| Dashboard UI | `client/src/i18n/locales/en/*.json` | `client/src/i18n/locales/<xx>/*.json` |
| Wiki page | English text in the `wiki/index.html` DOM | `wiki/script.js` + `wiki/i18n-content.js` |
| Mirrored READMEs | `README.md` | `README-CN.md`, `README-VN.md`, `README-KO.md`, `README-ES.md` |
| Language switchers | — | `Sidebar.tsx`, `paletteCommands.ts`, `nav.json`, `wiki/index.html` |
| Locale-aware formatting | — | `client/src/lib/format.ts` |

**If you add or change a UI string**, add the key to `en` *and every other
locale*, with the same key path, value type, and `{{interpolation}}` tokens.

**If you edit `README.md`**, mirror the same edit into all four translated
READMEs. They are full mirrors, not summaries.

**If you edit user-visible text in `wiki/index.html`**, add `zh` + `vi` + `ko` +
`es` entries and bump the wiki cache versions (`CACHE_NAME` in `wiki/sw.js` plus
the matching `?v=` query strings).

**If you are adding a new language**, three things must be complete: a full
`README-<XX>.md` mirror of `README.md` (every section, in order — not a
summary), every key in all 15 UI namespaces plus the language-switcher entry,
and a complete wiki translation (body content, headings, attributes, and page
metadata). Work through the step-by-step checklist:

- Guide: [`docs/I18N.md` §9](../docs/I18N.md#9-contributing-translations-and-adding-a-language)
- Checklist: [`.claude/skills/i18n-parity/references/new-language-checklist.md`](../.claude/skills/i18n-parity/references/new-language-checklist.md)
- Glossary and style: [`.claude/skills/i18n-parity/references/translation-style.md`](../.claude/skills/i18n-parity/references/translation-style.md)

Never translate code, commands, paths, URLs, env-var names, CLI flags,
identifiers, brand names, Claude Code hook event names, tool names, or the
product terms `Agent` / `Subagent` (Spanish is the deliberate exception and uses
`agente` / `subagente`). Translate only the prose around them.

Before opening the PR:

```bash
bash .claude/skills/i18n-parity/scripts/i18n-audit.sh   # must exit 0 — names every gap
npm run test:client
```

If you use an AI coding agent, point it at `.claude/skills/i18n-parity/` — the
skill, its checklist, and the audit script are written to be followed directly.

---

## Reporting Bugs

Open an issue and include:

- Steps to reproduce
- Expected vs. actual behavior
- Browser/OS/Node version if relevant
- Relevant logs or screenshots

---

## Requesting Features

Open an issue. Explain the problem you're solving, not just the solution you want.
