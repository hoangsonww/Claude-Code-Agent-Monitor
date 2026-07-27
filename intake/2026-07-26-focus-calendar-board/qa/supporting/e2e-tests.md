# E2E / API / Integration Test Design — focus-calendar-board

> This project has **no browser e2e runner** (no Playwright/Cypress config,
> no `e2e/` directory — confirmed by search). Its "integration" layer is
> route-level tests in `server/__tests__/*.test.js`, run via `node --test`
> against a real, ephemeral SQLite DB and a real listening Express instance
> (`createApp()` + `startServer()`), driven by a hand-rolled `http.request`
> `fetch`/`post`/`patch`/`del` helper — see `server/__tests__/projects.test.js`
> lines 1-80 and its existing `describe("GET /:id/focus-report", ...)` block
> (lines 211-294). This design reuses that convention exactly for the new
> route; it does not introduce a new framework. Client-side "flow" coverage
> for this feature is the existing Vitest component/page-test layer
> (`FocusCalendarBoard.test.tsx`, `screens.snapshot.test.tsx`), which the unit
> architect owns — this doc only covers the boundary this role is
> responsible for: the real HTTP/DB round trip for `GET /api/focus-report`,
> plus a scoped manual click-path pass since no automated browser layer
> exists to do it for us.

## 1. Flows to cover

This is a data-contract-heavy feature (new aggregate endpoint, two computation
paths that must not diverge) more than a UI-navigation-heavy one. The
integration-level flows that matter:

1. **Seed real sessions/focus-events into the DB → call
   `GET /api/focus-report` with each filter axis (project, session, sources,
   time-window) → assert the JSON shape and content are correct**, including
   the required-`from`/`to`/400-on-missing-or-malformed contract (this
   directly replaces the rejected env-knob/hidden-default mechanism — DEC-3 —
   so a passing 400 test here is the concrete proof that mechanism was never
   reintroduced).
2. **Cross-path consistency**: seed one project's history, call both
   `GET /api/projects/:id/focus-report` (old, unchanged route) and
   `GET /api/focus-report?project_id=:id&from=...&to=...` (new route) with a
   window wide enough to cover the fixture's full history, and deep-equal
   `sessions`/`items`/`totals` between the two responses. This is the direct,
   automatable regression guard for the plan's #1 named risk ("one rendering
   surface / one computation path, multiple consumers" — the same defect
   shape `6e29722` fixed reactively this morning on the rendering side; here
   it's the *data* side).
3. **`sources` scoping applies on the new route only**: seed two sessions
   with different `sessions.source` values, confirm `?sources=` narrows the
   new route's result set, and confirm (regression-style, in the *existing*
   unmodified `projects.test.js` suite, not duplicated here) that the old
   route's `?sources=`-ignoring gap is still present/untouched — i.e. this
   change-set must not accidentally "fix" that gap as an unrequested side
   effect.
4. **Manual click-path** (documented steps, no automated runner): sidebar nav
   to Calendar → select project → select session → change time period →
   verify calendar renders → compare visually against the equivalent
   per-project modal view for the same underlying data. This is warranted
   here specifically because T1-T7 (unit/component layer) individually cover
   each piece (routing, filter independence, rendering-parity of
   `FocusReportBody` in isolation) but nothing in the automated suite actually
   clicks through the sidebar into the real page in a real browser and
   eyeballs the rendered calendar next to the modal's — the one gap an
   assertion-based test structurally cannot close.

## 2. Spec file(s)

### 2a. Integration/route spec (primary, automated)

**`server/__tests__/focus-report-route.test.js`** (new — already named `B6`/
`T1` in the technical plan; this section is this role's design of its actual
contents, not a restatement of the plan).

Follow the exact structural convention of
`server/__tests__/projects.test.js`'s existing
`describe("GET /:id/focus-report", ...)` block and `focus()`/`t()` fixture
helpers (lines 211-294) — copy the `t(minutesFromStart)` / `focus(sessionId,
minute, data)` helpers verbatim (or import-share them if this project later
extracts a shared fixture module; today it does not, so duplicate them
per-file the same way `projects.test.js` already stands alone). Same
top-of-file harness pattern as every other route-test file in this repo
(`projects.test.js` lines 1-80): a per-file `TEST_DB` path under
`os.tmpdir()`, keyed by `Date.now()}-${process.pid}` so parallel `node --test`
workers never collide; `process.env.DASHBOARD_DB_PATH = TEST_DB` set *before*
`require("../index")`/`require("../db")`; `createApp()` + `startServer(app,
0)` in `before()`; `server.close()` + `db.close()` in `after()`.

```js
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const http = require("http");

const TEST_DB = path.join(os.tmpdir(), `dashboard-focus-report-route-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const { createApp, startServer } = require("../index");
const { db, stmts } = require("../db");

// ...same fetch/post helper as projects.test.js...

describe("GET /api/focus-report", () => {
  // same t()/focus() fixture helpers as projects.test.js's focus-report block
});
```

Cases (maps directly to the plan's T1 list — this is the concrete spelling
of each):

- `400` when `from` is missing (`to` present) — structured
  `{ error: { code: "BAD_REQUEST", message } }`, not a 500 and not a
  silently-empty 200.
- `400` when `to` is missing (`from` present).
- `400` when `from`/`to` is present but not a parseable instant (e.g.
  `?from=not-a-date&to=2026-07-26T00:00:00.000Z`).
- Window bounding: a session started/ended entirely before `from` is
  **excluded**; a session overlapping `[from, to)` (`started_at < to AND
  (ended_at IS NULL OR ended_at >= from)`) is **included** — mirrors the
  exact predicate B1 specifies, don't just assert "some session came back,"
  assert the specific included/excluded session IDs.
- `?project_id=X` with `from`/`to` spanning that project's full seeded
  history → **deep-equal** `sessions`/`items`/`totals` against
  `GET /api/projects/X/focus-report`'s own response for the identical
  fixture (`assert.deepEqual(newRes.body.sessions, oldRes.body.sessions)`,
  same for `items`/`totals` — three separate assertions, not one blob
  compare, so a future partial-field regression names the exact field that
  drifted).
- `?session_id=` returns exactly that session, no others.
- Unknown `project_id` → structured `404` (not `500`, not a silently-empty
  `200`) — mirrors `projects.test.js`'s existing "404s for an unknown
  project" case for the old route.
- Unknown `session_id` → structured `404`.
- A project with zero mapped folders and a session with zero focus data both
  → the existing well-shaped-empty-totals response (`sessions: []`,
  `items: []`, `totals.wall_ms === 0`, `totals.by_kind.item` present,
  `idle_grace_seconds` is a number) — extend, don't duplicate, the assertion
  style already in `projects.test.js` lines 228-237.
- `?sources=` seeded with two sessions of different `sessions.source`
  values → the new route's result set narrows correctly (mirror
  `remote-sources.test.js`'s `sessions?sources=local`/`sessions?sources=`
  pattern, e.g. lines 297-305, for how this project seeds/asserts a
  `sources`-scoped fixture).
- The new route's response echoes `project_id`/`session_id` as the resolved
  filter (`null` when unfiltered) — but never `from`/`to` (per B1, the
  caller already knows what it asked for) — assert both echoed fields
  explicitly and assert `from`/`to` keys are *absent* from the response body
  (a concrete, cheap guard against silently changing the response contract
  later).

Regression companions run in the same pass, **unmodified**:
`server/__tests__/focus-report.test.js` and `server/__tests__/projects.test.js`
must still pass with zero edits — the concrete proof B1/B2 didn't touch B3
(`focus-report.js`) or the old route.

### 2b. Bucket / grouping

This project has no formal bucket/tag scheme (no `PROJECT-CONTEXT.md`, no
smoke/regression tag convention found in `package.json` or `server/__tests__`
— every spec file there is just plain `node --test`, run either individually
or as the full `npm run test:server` glob). The nearest thing to a "bucket"
this project has is **file-per-concern under `server/__tests__/`**, each
runnable standalone or as part of the full suite — so the "bucket" for this
spec is simply: a new peer file next to `projects.test.js`/
`focus-report.test.js`, picked up automatically by `npm run test:server`'s
glob, no registration step needed. No serial/state-dependent isolation
concern beyond what every other route-test file already handles (unique
per-file `TEST_DB`, so tests never share DB state across files and can run
concurrently under `node --test`'s default parallelism).

### 2c. Manual click-path (documented steps, no runner)

No new "spec file" — a documented manual pass, added to this feature's DoD
sign-off (not a CI-enforced spec, since there is no browser-automation
runner in this repo to execute it). Steps:

1. Open the existing per-project modal (`Projects.tsx:601` trigger) for a
   project with real focus history; note one specific day's rendered
   calendar (block positions, idle striping, stat-tile numbers).
2. Navigate via the sidebar's new "Calendar" entry (confirm it appears
   immediately after "Projects," before "Kanban Board" — DEC-5) to
   `/focus-calendar`.
3. Select the same project in the board's project filter.
4. Independently select the matching session in the board's session filter
   — confirm selecting the session does **not** clear the project filter,
   and vice versa (DEC-2's independence requirement, the manual eyeball
   companion to T3(d)/(h)).
5. Use the board's prev/today/next controls to navigate to the same day
   noted in step 1.
6. Compare the board's rendered calendar for that day against the modal's
   (step 1) — same block positions, same idle striping, same stat-tile
   numbers (allowing for the DEC-6 relabeled `concurrency_ratio` copy on the
   board, which is an intentional, expected difference — confirm it reads
   as cross-project phrasing, e.g. "Concurrent agent sessions," not the
   per-project modal's wording).
7. Switch the board to a custom date range spanning several days; confirm
   the fetched data covers the full range while day-nav still pages one day
   at a time inside it.
8. Clear all three filters; confirm the default "today, all projects, no
   session" view renders without error (the union view).
9. Re-open both existing modal trigger points (`Projects.tsx:601`,
   `KanbanBoard.tsx:968`) and confirm they are visually unchanged from
   before this feature shipped.
10. Check all four locale files' sidebar label reads "Calendar" (or its
    translated equivalent), not "Focus Calendar" — a completeness test
    (T6) only catches a *missing* key, not a *wrong* one, so this specific
    check must stay manual.

## 3. Tag

No tag/bucket convention exists to attach (see 2b). The spec runs as part of
the default `npm run test:server` invocation, same as every other file in
`server/__tests__/`. Nothing here requires serial execution — it does not
share mutable state with any other spec (own `TEST_DB`).

## 4. Assertions (concrete)

- **Status codes**: `400` (missing/malformed `from`/`to`), `404` (unknown
  `project_id`/`session_id`), `200` (all valid/empty-but-well-shaped cases) —
  never a `500` for any of these expected-error inputs.
- **Error shape**: `{ error: { code: "BAD_REQUEST", message } }` on 400s, per
  `.claude/rules/backend-node.md`'s "return structured errors" rule — assert
  the `code` field specifically, not just that `res.status === 400`.
- **Window-boundary correctness**: assert by session ID which sessions are
  included/excluded at the exact boundary (`started_at < to`,
  `ended_at IS NULL OR ended_at >= from`), not just "count > 0."
- **Cross-path deep-equal**: `sessions`, `items`, and `totals` from the new
  route (`?project_id=`) match the old route's own output field-for-field,
  for the same fixture — this is the one assertion this whole feature exists
  to protect (per the change brief's "Test-invariants at risk" #1).
- **`sources` scoping present on new route, absent on old** — narrows
  correctly on `/api/focus-report`; the existing unmodified
  `projects.test.js` continuing to pass with no new `sources` case added to
  it *is itself* the "not accidentally fixed" assertion (a `git diff`-level
  check as much as a test-level one).
- **No hidden default window**: no test path exists in this spec that omits
  both `from` and `to` and gets a 200 — every 200 case has both explicitly
  set to fixture-appropriate instants.
- **Response contract**: `project_id`/`session_id` echoed (`null` when
  unfiltered); `from`/`to` **not** echoed.
- Reuse existing fixture-seeding helpers rather than inventing new ones:
  `stmts.upsertPlan`/`stmts.upsertPlanItem`/`stmts.insertSession` (from
  `../db`), the `insertFocusEventRaw` prepared statement + `t()`/`focus()`
  pattern already established in `projects.test.js`'s focus-report block.

## 5. How to run

Single spec (once created):

```bash
node --test server/__tests__/focus-report-route.test.js
```

Alongside its regression companions (matches the technical plan's own
prescribed step-2 command, §4 of `technical-plan.md`):

```bash
node --test server/__tests__/focus-report-route.test.js server/__tests__/projects.test.js server/__tests__/focus-report.test.js
```

Full backend suite (required before calling the change done, per
`CLAUDE.md`):

```bash
npm run test:server
```

No environment/stack prerequisite beyond what every other `server/__tests__`
file needs: `node --test` spins up its own real (ephemeral, file-backed)
SQLite DB and a real listening Express server per file via `createApp()` +
`startServer(app, 0)` — no separately-running dev server, no Docker, no
external service. `DASHBOARD_DB_PATH` is set to a unique tmp path before any
app module loads, so this spec cannot collide with data from other test
files or a real dashboard instance.

Manual click-path pass (2c) requires the dev stack up:

```bash
npm run dev
```

then open `http://localhost:<client-port>` in a real browser (per Sara's
global instruction: `open -a "Google Chrome" "http://localhost:5173"` or
whatever port `npm run dev` prints) with at least one project that has real
seeded focus history — e.g. the dashboard's own dogfood data, or run
`scripts/seed.js` if a clean seed is preferred first.

## 6. Cost note — minimum set, what's deliberately NOT covered here

This is a thin data-contract layer over unit-level coverage already claimed
by the plan (T2 covers `FocusReportBody`/`FocusCalendarView` rendering
parity at the component level; T3 covers the board's filter-independence
edge cases at the page level; T6/T5 cover locale/nav completeness). The
integration layer designed here intentionally covers only what those layers
*cannot*: the real HTTP request → real Express route → real SQLite query →
real JSON response round trip, and the one cross-path data-equivalence
assertion no component test could ever make (it needs two real routes
answering the same real DB state).

**Deliberately NOT covered at this layer** (left to the unit/component
layer, or genuinely out of scope):

- Every individual segment-kind/idle-grace permutation of
  `buildProjectFocusReport`'s math — that's `focus-report.test.js`'s job
  (unmodified, regression-only here) and this feature adds zero new math.
- Component-level rendering geometry/idle-stripe pixel comparison between
  the modal's props-shape and the board's props-shape — that's T2, run in
  Vitest against `FocusReportBody` directly; far cheaper than asserting DOM
  geometry via any server-side test.
- Filter-independence UI interaction (clicking through project/session/
  time-period controls and confirming none resets another) — that's T3,
  a page-level Vitest test with mocked `api.focusReport`; no need to
  re-prove this against a real DB when the contract under test is "React
  state doesn't get cleared," not "the server returns the right data."
- A full browser-automation e2e run of the click-path — this project has no
  Playwright/Cypress runner to build one in cheaply, and introducing one
  for this single feature would be a disproportionately large, ongoing-cost
  addition to the repo's tooling surface for one page. The manual pass
  (2c) is the intentionally-cheaper substitute, run once before ship and
  re-run only if this specific rendering-parity risk resurfaces (it already
  did once this morning, per `6e29722` — if it recurs a third time, that's
  the trigger to reconsider investing in real browser automation, not
  before).
- Large/custom-range performance characteristics (flagged in the plan's §7
  as an accepted, deferred risk, tracked in
  `project_holistic-focus-history.md`) — no load/perf test designed here;
  out of scope for this change's DoD.
