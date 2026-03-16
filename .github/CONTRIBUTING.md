# Contributing to Agent Dashboard

Thanks for taking the time to contribute. Please read this guide before opening a PR or issue.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branching and Commits](#branching-and-commits)
- [Pull Requests](#pull-requests)
- [Testing](#testing)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

---

## Getting Started

### Prerequisites

- Node.js 18+ (22+ recommended for automatic SQLite fallback)
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
```

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

## Reporting Bugs

Open an issue and include:

- Steps to reproduce
- Expected vs. actual behavior
- Browser/OS/Node version if relevant
- Relevant logs or screenshots

---

## Requesting Features

Open an issue. Explain the problem you're solving, not just the solution you want.
