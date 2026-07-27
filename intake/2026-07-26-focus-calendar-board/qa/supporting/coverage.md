# Coverage Map — focus-calendar-board

> Role: Coverage Cartographer. This maps what guards the surfaces this change
> touches **today**, before any of the planned code exists, and records an
> actually-executed baseline. No new tests are proposed here.

## 0. Test stack (discovered — no `PROJECT-CONTEXT.md` in this repo)

- **Server**: `node --test server/__tests__/*.test.js` (`npm run test:server`).
  No project/tag bucketing convention — every file in the directory runs as
  one flat suite; there is no smoke/regression split at this layer.
- **Client**: Vitest, `cd client && npm test` == `vitest run` (`npm run
  test:client` from repo root). Config: `client/vite.config.ts` /
  `client/vitest.setup.ts` (not read in depth here; irrelevant to this map).
  No project/tag convention either — one flat run, `jsdom` environment.
- There is no separate e2e/integration layer in this repo (confirmed by
  directory layout — only `server/__tests__/` and
  `client/src/**/__tests__/`). "Backend unit/integration" and "frontend
  unit/component" are the only two layers this project tests at; the
  `server/__tests__/projects.test.js` file itself is a real HTTP
  integration test (spins up `createApp()`/`startServer()` and issues real
  `http.request` calls), so backend route coverage is integration-grade, not
  mocked.

## 1. Existing coverage by surface (as of this baseline — no feature code written yet)

### `server/lib/focus-report.js` (`buildProjectFocusReport`/`buildSessionFocusReport`/`buildFocusSegments`/`buildActivityChunks`/`mergeIntervals`)
- `server/__tests__/focus-report.test.js` (768 lines) — thorough, unit-grade:
  segment reconstruction (set/push/pop/done, nested detours, no-ops),
  idle-grace-window discounting (including the `<= 0` disable case and the
  inferred-fallback path), activity chunking, and `buildProjectFocusReport`'s
  rollup/concurrency math (fully-overlapping sessions merge to one wall-clock
  span, disjoint spans sum, partial overlap unions, null-ratio empty case).
  **Verdict: GUARDED.** This is the one computation path the plan explicitly
  reuses unmodified (B3) — if this suite stays green post-change, the math
  itself didn't regress. It says nothing about a *second caller* of these
  functions, though (see §3).

### `server/routes/projects.js` — `GET /:id/focus-report`
- `server/__tests__/projects.test.js`, `describe("GET /:id/focus-report")`
  (lines 211-294): 404 for unknown project; well-shaped empty totals for a
  project with zero mapped folders; scopes to only the clicked project's
  sessions and rolls a bug detour up under its item.
  **Verdict: GUARDED** for the route's existing behavior (scoping,
  empty-shape, 404). **UNGUARDED for `?sources=`** — no test in this
  `describe` block ever sends a `?sources=` query param, which lines up
  exactly with the change brief's own finding: the route's handler (read
  directly, lines 218-233) never imports or calls
  `server/lib/source-filter.js` at all. Confirmed by grep: `agents.js`,
  `analytics.js`, `events.js`, `pricing.js`, `stats.js`, `sessions.js` all
  import `parseSources`/`sourceColumnClause`/`sessionIdInSourcesClause` from
  `source-filter.js`; `projects.js` does not. This is a real, pre-existing
  gap, not a hypothetical — see the registry check in §3.

### `client/src/components/FocusReportModal.tsx` / `FocusReportModal.test.tsx` (594 lines, 18 tests)
- Loading/error/empty states; on-item percentage math (active-time based,
  idle excluded); concurrency ratio + real wall-clock display; session→detail
  link; per-item rollup; inferred-session badging (with/without a reason);
  inferred-detour caption; close behavior (Escape/backdrop/close button);
  List↔Calendar toggle (no re-fetch); toggle hidden when no history;
  wall-clock/agent-time dual-number header; idle-stripe overlay geometry on
  both the per-session bar and the per-item/project-split bars
  (active_ms-proportional, not wall_ms — the specific regression class
  `6e29722` fixed this morning).
- **The line-518 standing template** (`"[standing template] List and
  Calendar views render the same wall-clock/agent-time numbers..."`, verified
  at line 518, one line off the brief's "line-517" citation — immaterial) is
  the file's own designated extension point for any new
  `FocusReportSegment`-rendering consumer; its own comment says "extend THIS
  test, not a view-local one."
  **Verdict: GUARDED** for the modal's current (pre-change) behavior,
  including the exact List/Calendar parity class this feature's plan names
  as its #1 risk. It currently asserts nothing about a third consumer
  (`FocusReportBody` extracted, or a board-shaped render) — that's expected;
  the surface doesn't exist yet.

### `client/src/components/FocusCalendarView.tsx` / `FocusCalendarView.test.tsx` (13 tests)
- Empty-day state; block rendering + label; hover popup (formatted, not
  native `title`, closes on mouse-leave); inferred note + "still running"
  indicator; lane assignment for overlapping vs. non-overlapping sessions;
  dashed border for inferred vs. solid for declared; live-pulse only on a
  still-running session's open segment; Prev/Today/Next day navigation;
  `SegmentEventsModal` (raw events bucketed into 5-minute rows, expand to see
  individual events, empty-inferred explanation); idle-stripe overlay
  geometry (top/height percentages) matching only the idle chunk.
  **Verdict: GUARDED** for the renderer's current, uncontrolled/nav-visible
  behavior. Says nothing yet about the planned additive
  `projectLabelForCwd`/`selectedDate`/`hideDateNav` props (don't exist) or
  about controlled-mode/nav-suppressed rendering — expected gap, not a
  regression-risk item, **provided** the extraction stays additive-only as
  planned.

### `client/src/lib/calendarLanes.ts` / `calendarLanes.test.ts` (85 lines, 8 tests)
- `assignLanes()` — the greedy interval scheduler behind the swimlane: no
  items, non-overlapping-all-lane-0, fully-overlapping-separate-lanes,
  touching-boundary-treated-as-free, minimal-lane chain case, input-order
  preservation, extra-field passthrough, stable tie-breaking.
  **Verdict: GUARDED.** Untouched by this plan (no changes to
  `calendarLanes.ts` are in the change set) — a regression here would be
  unrelated to this feature, but the suite is a live regression guard for the
  swimlane math the new board also depends on transitively via
  `FocusCalendarView`.

### `client/src/components/Sidebar.tsx` / `Sidebar.test.tsx` (11 tests)
- Brand name, subtitle; **nav-link presence check only for Dashboard, Kanban
  Board, Sessions, Activity Feed** (`"should render all navigation links"`,
  lines 32-38) — **"Projects" is not asserted here at all**, despite
  `NAV_KEYS` (confirmed at `Sidebar.tsx:96-99`) already containing a
  `projects` entry between `dashboard` and `agentBoard` today; live/disconnected
  WebSocket state; version string; **href check, same gap** — asserts `/`,
  `/kanban`, `/sessions`, `/activity` but not `/projects`
  (`"should have correct navigation hrefs"`, lines 58-66); four
  language-toggle buttons render; switching to Vietnamese/Korean updates nav
  text; collapsed-mode language cycling.
  **Verdict: PARTIAL for the exact surface this change edits.** The
  "Projects" nav entry itself — immediately before the insertion point for
  the new "Calendar" entry — has **zero existing assertion of its own** (no
  label check, no href check, no position check). This is a real,
  pre-existing hole, not introduced by this plan, but it means there is no
  existing "Projects is 2nd, Kanban is 3rd" ordering test to protect against
  an insertion mistake — T5's new assertions will be the *first* test in this
  file to check "Projects" at all, let alone its position relative to
  "Calendar."

### `client/src/i18n/__tests__/i18n.test.ts` (111 lines, 15 tests, all pass)
- Vietnamese/Korean nav-key translations for the *existing* keys
  (`dashboard`, `agentBoard`) plus `languageShort`; Agent/Subagent
  terminology preserved untranslated across zh/vi/ko; non-explicit locale
  tag resolution (`vi-VN`→`vi`, `ko-KR`→`ko`); English subagent-count
  pluralization; and a **registry-driven, `LOCALES`-array-based
  completeness check** for the `report.{wallClockLabel,activeLabel}` key
  relocation (one `for (const locale of LOCALES)` loop driving per-locale
  assertions, plus a "the old path must be gone" negative check, plus an
  English byte-identity check) — this is the exact pattern T6 is meant to
  copy for `nav:focusCalendar`.
  **Verdict: UNGUARDED for `nav:focusCalendar`** — necessarily, since the
  key doesn't exist in any of the four `nav.json` files yet (confirmed
  directly by the change brief's own read). No existing test in this file
  would catch a 3-of-4-locale partial ship of a *new* nav key today; the
  registry-driven pattern exists and is provably reusable (it already
  protects one key-relocation), but nothing currently walks `LOCALES` for
  `focusCalendar` specifically.

### `client/src/pages/__tests__/screens.snapshot.test.tsx` (549 lines)
- Exactly 12 `it(...)` screen cases today (confirmed by grep: Dashboard,
  Projects, Kanban board, Sessions, Session detail, Activity feed,
  Analytics, Workflows, Claude Config, Run, Settings, Not found) — matches
  the brief's "12 existing cases / 13th to be added" framing exactly.
  `api.projects.list`/`api.sessions.list` are already mocked (lines
  ~209-210, ~385-387) with the same empty-fixture shape the plan's T4 says
  it will extend/reuse — confirms F5/T4's reuse claim is real, not
  speculative.
  **Verdict: GUARDED** for `Projects` and `KanbanBoard`'s current rendered
  snapshot (both are existing cases in this file today) — this is the
  concrete mechanism that would catch byte-level chrome-extraction leakage
  into those two entry points. **UNGUARDED for the not-yet-existing 13th
  case** (`FocusCalendarBoard`) — expected, page doesn't exist.

## 2. Coverage verdict per surface (summary table)

| Surface | Exists today? | Verdict | Notes |
|---|---|---|---|
| `server/lib/focus-report.js` computation | Yes, unmodified by plan | **GUARDED** | `focus-report.test.js`, unit-grade, thorough |
| `GET /api/projects/:id/focus-report` (existing route, scoping/shape/404) | Yes, byte-unmodified by plan | **GUARDED** | `projects.test.js` lines 211-294 |
| `GET /api/projects/:id/focus-report` `?sources=` behavior | Yes (route ignores it) | **UNGUARDED** (pre-existing, deliberately not fixed) | See registry gap, §3 |
| `GET /api/focus-report` (new aggregate route) | No | **UNGUARDED (expected)** | Doesn't exist; T1 is the plan's answer |
| `FocusReportModal.tsx` current behavior | Yes | **GUARDED** | 18 tests, incl. the List/Calendar parity standing template |
| `FocusReportModal.tsx` as a 3rd-consumer-safe extraction target | N/A pre-change | **UNGUARDED (expected)** | T2 extension is the plan's answer |
| `FocusCalendarView.tsx` current (uncontrolled) behavior | Yes | **GUARDED** | 13 tests |
| `FocusCalendarView.tsx` additive props (`projectLabelForCwd`/`selectedDate`/`hideDateNav`) | No | **UNGUARDED (expected)** | Doesn't exist |
| `FocusReportBody.tsx` / `FocusReportViewToggle` (extracted chrome) | No | **UNGUARDED (expected)** | New file |
| `client/src/lib/calendarWindow.ts` (`startOfDay`/`DAY_MS`) | No (currently private in `FocusCalendarView.tsx`, untested directly) | **UNGUARDED today, indirectly exercised** | No dedicated unit test of `startOfDay`/`DAY_MS` exists even in their current private location — `FocusCalendarView.test.tsx`'s day-nav tests exercise them by proxy only |
| `TimePeriodPicker.tsx` | No | **UNGUARDED (expected)** | New file; T7 is the plan's answer |
| `FocusCalendarBoard.tsx` (new page) | No | **UNGUARDED (expected)** | New file; T3 is the plan's answer |
| Global session list fetch pattern (`api.sessions.list({limit:10000})`, no `cwd`) | Precedent exists (`Projects.tsx`, `KanbanBoard.tsx`, `ActivityFeed.tsx`), but no test for a *board*-shaped caller | **UNGUARDED (expected)** | Precedent is real; new caller isn't |
| Sidebar "Calendar" nav entry | No | **UNGUARDED (expected)** | T5 is the plan's answer |
| Sidebar "Projects" nav entry (position/label/href) | Yes, but **untested itself** | **UNGUARDED today** (pre-existing hole, not introduced by this plan) | See §1 Sidebar section — real regression-risk zone since insertion is adjacent |
| 4-locale `nav:focusCalendar` key | No | **UNGUARDED (expected)** | T6 registry pattern exists and is reusable; not yet applied to this key |
| `screens.snapshot.test.tsx` — `Projects`/`KanbanBoard` cases | Yes | **GUARDED** | Existing snapshot baseline; this is the actual regression-risk zone for the chrome extraction |
| `screens.snapshot.test.tsx` — 13th (`FocusCalendarBoard`) case | No | **UNGUARDED (expected)** | T4 is the plan's answer |

## 3. Registry/consistency gap check

This project has no formal named registry/defect-catalog file — confirmed by
the change brief itself ("This project has no `PROJECT-CONTEXT.md`/defect-class
catalog... confirmed by all four evaluators") and independently by this pass
(no `PROJECT-CONTEXT.md` found anywhere in the repo). Two live conventions
function as the closest thing to one, and both have a real, checkable gap
worth calling out explicitly, since an entry with no covering assertion is
UNGUARDED even though every existing suite is green:

1. **`server/lib/source-filter.js` cross-cutting scope convention.**
   Consumers today: `agents.js`, `analytics.js`, `events.js`, `pricing.js`,
   `stats.js`, `sessions.js` (all grep-confirmed). `server/routes/projects.js`'s
   `GET /:id/focus-report` is **not** a consumer — confirmed by reading the
   route body directly (lines 218-233): no import, no `parseSources`/
   `sourceColumnClause` call anywhere in the file. No test in
   `projects.test.js` sends a `?sources=` param to this route, so nothing
   today would fail if a future change silently started (or silently kept
   not) honoring it. This is the plan's own DEC-adjacent guardrail (§5 "not
   fixed as part of this plan") and its own DoD item ("old route's
   `sources`-filter gap explicitly not touched") — call this out as an
   **existing, acknowledged UNGUARDED gap on the old route**, distinct from
   (but easily confusable with) the new route's T1 `?sources=` test, which
   only covers the *new* endpoint. There is no defect-catalog id in this repo
   to cite for it; the plan's own §5/§9 text is the closest thing to a
   tracked reference.
2. **`FocusReportBody`/rendering-chrome "one implementation" convention**
   (not yet real — it's what F1 creates). Today there is exactly one
   consumer (`FocusReportModal`) and the closest thing to a registry-style
   check is the line-518 standing template's own self-imposed rule ("extend
   THIS test... for any future `FocusReportSegment` field either view
   renders"). That rule currently has no way to be violated because there's
   only one view-pair (List/Calendar) and no second *consumer*. Once
   `FocusReportBody.tsx` exists with two consumers (modal, board), T2's
   extension is what turns this from a comment-only convention into an
   enforced one — until T2 lands, a hypothetical second consumer copy-pasting
   the JSX instead of importing `FocusReportBody` would be **UNGUARDED** by
   anything in this repo today (there being no second consumer is exactly why
   nothing catches it yet).

## 4. Current baseline (actually run, 2026-07-26, before any of this feature's code exists)

**Server** — `npm run test:server` (== `node --test server/__tests__/*.test.js`):
```
# tests 913
# suites 201
# pass 913
# fail 0
# cancelled 0
# skipped 0
# todo 0
```
**GREEN.** Full run, not targeted — this repo's server suite runs fast enough
(~21s) that a full run was cheaper than curating a subset.

**Client** — targeted subset first, then the full suite:
```
cd client && npx vitest run \
  src/components/__tests__/FocusReportModal.test.tsx \
  src/components/__tests__/FocusCalendarView.test.tsx \
  src/lib/__tests__/calendarLanes.test.ts \
  src/components/__tests__/Sidebar.test.tsx \
  src/i18n/__tests__/i18n.test.ts \
  src/pages/__tests__/screens.snapshot.test.tsx
```
→ 6 files, 77 tests, **all passed**.

```
npm run test:client   # == cd client && vitest run, full suite
```
→ 37 files, 435 tests, **all passed.**

**Both baselines are GREEN.** No service dependency blocked either run (server
tests use a fresh per-file SQLite temp DB via `DASHBOARD_DB_PATH`, no external
service required; client tests are pure jsdom/Vitest, no dev server needed).
Nothing was skipped or left unrun for lack of infrastructure.

## 5. Conventions in play (for the architects placing new tests)

- **Server route tests** live at `server/__tests__/<router-basename>.test.js`,
  real-HTTP-integration style against `createApp()`/`startServer(app, 0)`
  (see `projects.test.js` lines 15-81 for the exact boilerplate: temp SQLite
  DB via `DASHBOARD_DB_PATH`, a tiny local `fetch`/`post`/`patch`/`del`
  helper set, `before`/`after` hooks). A new `focus-report-route.test.js`
  should copy this boilerplate, not `focus-report.test.js`'s (which tests the
  lib functions directly, no HTTP).
- **Server lib tests** (pure functions, no HTTP) live at
  `server/__tests__/<lib-basename>.test.js`, `node:test`'s
  `describe`/`it`/`before`/`after`, `node:assert/strict`. No changes planned
  to `focus-report.js` itself, so no new file needed there.
- **Client component tests** live beside a `<name>.test.tsx` at
  `client/src/components/__tests__/<Component>.test.tsx`, Vitest +
  `@testing-library/react`, wrapped in `<MemoryRouter>`, with `../../lib/api`
  mocked via `vi.mock` returning a `vi.fn()`-backed object matching the real
  `api` shape (see `FocusReportModal.test.tsx` lines 18-21,
  `FocusCalendarView.test.tsx` lines 20-28). A new `FocusReportBody.test.tsx`
  is optional per the plan (T2 folds body-vs-modal parity into the existing
  file's standing template instead) — `TimePeriodPicker.test.tsx` follows the
  same per-component pattern.
- **Client page tests** live at `client/src/pages/__tests__/<Page>.test.tsx`
  — `FocusCalendarBoard.test.tsx` should follow the sibling pattern already
  used by `Projects.test.tsx`/`KanbanBoard.projectsView.test.tsx` (both
  present in the full client run above) for mocking `api.projects.list`/
  `api.sessions.list` at the page level.
- **Screen snapshot cases** are added as one more `it("<Page name>", ...)`
  inside the single `describe("screen snapshots", ...)` block in
  `screens.snapshot.test.tsx` — not a new file — following the file's
  existing per-page mock-then-snapshot pattern (fixture objects near the top
  of the file, one `it` block per page near line 508+).
- **i18n completeness checks** are added as a new `describe` block inside the
  single `i18n.test.ts` file, looping the existing top-level `LOCALES` array
  (line 15) — never a new per-locale test file, and never a hardcoded
  4-locale copy-paste (the `report.{wallClockLabel,activeLabel}` block at
  lines 75-110 is the copyable template, not the earlier Vietnamese/Korean
  ad hoc checks at lines 18-24/47-53, which predate the registry pattern and
  are not itself registry-driven).
- **File headers**: every new test file above must still carry the
  `@author Son Nguyen <hoangson091104@gmail.com>` header per
  `.claude/rules/file-headers.md` — confirmed already true of every existing
  test file read during this pass (all carry it).

## Summary of what's genuinely new vs. what's an actual regression zone

**Zero coverage today, expected (the surface doesn't exist yet — not a finding, just a fact):**
`GET /api/focus-report` (new endpoint), `FocusCalendarBoard.tsx` (new page),
`FocusReportBody.tsx`/`FocusReportViewToggle` (new shared chrome component),
`TimePeriodPicker.tsx` (new control), the global-session-list-for-a-board
caller shape, and the `nav:focusCalendar` key in all four locales.

**Existing, GREEN, and modified by this plan — the actual regression-risk zone:**
`FocusReportModal.tsx`/`FocusCalendarView.tsx` (extraction must stay pixel-
identical — 31 existing tests are the guard, plus the line-518 standing
template as the designated extension point), `server/routes/projects.js`'s
`GET /:id/focus-report` (must stay byte-unmodified — 5 existing tests, all
currently green, are the guard, but they do **not** cover `?sources=`, so a
"did we accidentally fix the old gap" regression wouldn't be caught by
anything existing — it needs the plan's own DoD checklist item, not a test),
`Sidebar.tsx`'s nav ordering (the insertion point is adjacent to "Projects,"
which itself has zero existing assertion — the weakest link in this whole
map), and the `Projects`/`KanbanBoard` screens.snapshot.test.tsx baselines
(the single most mechanically strong guard in this entire map for the
chrome-extraction risk, since it's a byte-diff, not a semantic assertion that
could be fooled by a subtly-wrong extraction).
