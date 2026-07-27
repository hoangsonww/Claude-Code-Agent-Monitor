Unit / Parity / Component Test Design — focus-calendar-board

> Companion to `technical-plan.md` §6 (T1-T7) and `change-brief.md`'s
> "Test-invariants at risk" list. This document is implementation-ready: exact
> file paths, `describe`/`it` names, fixtures, and assertions. The
> implementer should not need to re-derive anything from the plan.
>
> Frameworks (confirmed from `CLAUDE.md` / actual test files read):
> server = `node:test` + `node:assert/strict`, run via `npm run test:server`
> (see `server/__tests__/projects.test.js` for the exact `fetch`/`post`/`patch`
> harness convention this repo already uses — reuse it, don't reinvent it);
> client = Vitest + React Testing Library, run via `npm run test:client` (see
> `client/src/components/__tests__/FocusReportModal.test.tsx` for the
> `makeReport()`/mock-module convention).

---

## 1. `GET /api/focus-report` — new route handler

**File:** `server/__tests__/focus-report-route.test.js` (new)

Follow `server/__tests__/projects.test.js`'s exact harness: `TEST_DB` via
`os.tmpdir()` + `process.env.DASHBOARD_DB_PATH`, `createApp`/`startServer`
from `../index`, the local `fetch(urlPath, options)`/`post`/`patch`/`del`
helpers (copy them verbatim — do not import from `projects.test.js`, each
server test file is self-contained per existing convention), `before`/`after`
hooks that start/close the server and `db`. Also import
`buildProjectFocusReport` isn't needed directly — instead call **both routes**
over HTTP inside the same test process for the deep-equal comparison (T1's
requirement below), since both are mounted on the same `createApp()` instance.

Reuse the projects.test.js `focus()`/`insertFocusEventRaw`/`t()` helpers
(copy them into this file) for seeding Focus events at deterministic minute
offsets from a fixed `Date.UTC(2026, 0, 1)` anchor.

```js
describe("GET /api/focus-report", () => {
  describe("from/to validation", () => { ... });
  describe("project_id filter", () => { ... });
  describe("session_id filter", () => { ... });
  describe("sources filter", () => { ... });
  describe("parity with GET /api/projects/:id/focus-report", () => { ... });
});
```

### 1a. `describe("from/to validation")`

- `it("400s when both from and to are missing")` — `GET /api/focus-report`
  with no query params → `assert.equal(res.status, 400)`;
  `assert.equal(res.body.error.code, "BAD_REQUEST")` (per
  `.claude/rules/backend-node.md` + technical-plan.md B1's exact error shape);
  `assert.match(res.body.error.message, /from/i)` or similar — message names
  the missing param(s).
- `it("400s when from is present but to is missing")` — `?from=2026-01-01T00:00:00.000Z`
  only → 400, same error code.
- `it("400s when to is present but from is missing")` — mirror of the above.
- `it("400s when from is not a parseable ISO instant")` — `?from=not-a-date&to=2026-01-02T00:00:00.000Z`
  → 400 (not 500 — assert `res.status !== 500` explicitly as a named
  assertion, not just checking equal(400), so a future regression to an
  unhandled `new Date(...)` throw is caught as a *wrong status*, not just
  "not 200").
- `it("400s when to is not a parseable ISO instant")` — mirror.
- `it("never returns 200 with an implicit/unbounded window")` — this is the
  direct regression guard for DEC-3 (env-knob dropped): assert that omitting
  `from`/`to` never returns `200` under any combination of `project_id`/
  `session_id`/`sources` also being present (loop over `["", "?project_id=x",
  "?session_id=x", "?sources=local"]` prefixes, each still missing `from`/`to`
  → each must 400). **Red-first**: before the fix, if a stray default window
  were reintroduced this would return 200; the test fails pre-fix-removal and
  passes once B1's "no env knob, no default" is actually built as specified.

### 1b. `describe("project_id filter")`

Seed fixture: two projects (`ProjectA` at cwd `/tmp/focus-route-a`,
`ProjectB` at cwd `/tmp/focus-route-b`), one session per project with Focus
events inside a known day window (e.g. `2026-01-01T00:10`–`00:40`).

- `it("returns only the requested project's sessions")` —
  `GET /api/focus-report?project_id=<A>&from=<dayStart>&to=<dayEnd>` →
  `res.body.sessions.length === 1`, `res.body.sessions[0].cwd === "/tmp/focus-route-a"`.
- `it("echoes back project_id and session_id as the resolved filter (null when not applicable)")` —
  `assert.equal(res.body.project_id, projectAId)`; `assert.equal(res.body.session_id, null)`
  (per B1: "both echoed back... null when unfiltered/not applicable").
- `it("404s for an unknown project_id")` — `?project_id=does-not-exist&from=...&to=...`
  → `assert.equal(res.status, 404)` (not a silent empty 200 — per B1's exact
  wording).
- `it("a project with zero mapped folders returns the existing well-shaped-empty-totals response")` —
  extend, don't duplicate, `projects.test.js`'s
  `"returns well-shaped empty totals for a project with no mapped folders"`
  assertions verbatim (`sessions: []`, `items: []`, `totals.wall_ms === 0`,
  `totals.by_kind.item` truthy, `typeof idle_grace_seconds === "number"`).

### 1c. `describe("session_id filter")`

- `it("returns exactly that session and no others")` — seed two sessions in
  the same project/cwd, one with Focus history in-window, one without; assert
  `res.body.sessions.length === 1` and its `session_id` matches.
- `it("404s for an unknown session_id")` — mirrors the project_id 404 case.

### 1d. `describe("sources filter")`

Seed two sessions with different `sessions.source` values (e.g. `"local"`
and `"src_remote1"` — matching `source-filter.js`'s param convention) both
with in-window Focus events, same cwd/project.

- `it("applies source-filter.js to narrow the result set")` —
  `?sources=local&from=...&to=...` → only the `local`-sourced session appears
  in `res.body.sessions`. **Red-first**: if B1 forgot to call
  `parseSources`/`sourceColumnClause`, this returns both sessions — test
  fails pre-fix, passes once the route actually applies the filter.
- `it("omitting sources returns sessions from every source")` — no
  `?sources=` → both sessions present (confirms "absent means no filter",
  per `source-filter.js`'s own doc comment).

### 1e. `describe("parity with GET /api/projects/:id/focus-report")`  — **the core invariant this build exists to pin**

This is `change-brief.md`'s "Cross-path consistency (old vs. new endpoint)"
risk and directly guards against the same defect shape `6e29722` fixed
reactively this morning.

- `it("produces sessions/items/totals deep-equal to the old per-project route for the same project and a from/to window spanning its full history")`:
  - Seed one project with 2+ sessions, several Focus segments including at
    least one `bug` detour rolled up under an item (mirror
    `projects.test.js`'s existing `"scopes the report to only the clicked
    project's sessions, and rolls a bug detour up under its item"` fixture
    shape/verbs exactly, so this test is provably exercising the same code
    path the old route's own test already pins).
  - Call `GET /api/projects/:id/focus-report` (old route, no params).
  - Call `GET /api/focus-report?project_id=<id>&from=<epoch-0-ish>&to=<far-future>`
    (new route, window wide enough to cover the fixture's full history — say
    `from=2020-01-01T00:00:00.000Z&to=2030-01-01T00:00:00.000Z`).
  - `assert.deepEqual(newRes.body.sessions, oldRes.body.sessions)`;
    `assert.deepEqual(newRes.body.items, oldRes.body.items)`;
    `assert.deepEqual(newRes.body.totals, oldRes.body.totals)`;
    `assert.equal(newRes.body.wall_clock_ms, oldRes.body.wall_clock_ms)`;
    `assert.equal(newRes.body.concurrency_ratio, oldRes.body.concurrency_ratio)`.
    (Do **not** deep-equal the whole body — `project_id`/`session_id` framing
    differs between the two routes by design per B1; assert on the shared
    report fields only, matching change-brief.md's own framing: "same
    underlying `buildProjectFocusReport` call".)
  - **Red-first**: before `server/routes/focus-report.js` exists (or if it
    ever independently re-derives the session query instead of feeding the
    same `sessions` rows through the unmodified `buildProjectFocusReport`),
    this fails — either the route 404s (doesn't exist yet) or the two bodies
    diverge (e.g. a `sources`/window mismatch selecting a different session
    set). Passes once B1 is built exactly as specified (thin filter layer,
    unmodified builder call).
- `it("a session with zero focus data produces the same well-shaped-empty-totals response as the old route's equivalent case")` —
  extend `projects.test.js`'s empty-totals assertions to the new route,
  confirming the "empty-but-well-shaped" convention isn't forked into a
  second, slightly-different empty shape.

### Regression guard (run unmodified, not edited)

`server/__tests__/focus-report.test.js` and `server/__tests__/projects.test.js`
must pass with **zero edits** — proves B1 didn't touch B3
(`server/lib/focus-report.js`) or `server/routes/projects.js`. If either
needs an edit to keep passing, that's a scope-creep signal per DEC's
"old route byte-unmodified" requirement — flag it, don't just fix it.

---

## 2. Shared chrome component — `FocusReportBody` (extends the standing parity template)

**File:** `client/src/components/__tests__/FocusReportModal.test.tsx` (extend
in place — do **not** create a new file; per technical-plan.md T2: "add one
new `it(...)` immediately after the existing standing-template test," which
is the `it("[standing template] List and Calendar views render the same
wall-clock/agent-time numbers...")` block currently ending at line 593.)

New test, placed as the very next `it(...)` after that block, inside the same
top-level `describe("FocusReportModal")`:

```
it("[standing template extension] FocusReportBody renders identically for the modal's props shape and the board's props shape, and hideDateNav actually suppresses the day-nav", async () => { ... })
```

Import `FocusReportBody` directly from `../FocusReportBody` (not just through
`FocusReportModal`) so this test exercises the shared component in isolation,
per the plan's "extend THIS test... for any future field either view
renders" convention already stated in the standing-template's own `it` name.

**Setup:** reuse the file's existing `makeReport()` helper — do not
duplicate it. Build one `report` fixture whose one session has `cwd: "/repo"`
(already the fixture default) and a segment with `chunks` (so idle-stripe
geometry is exercised, matching the standing template's own technique).

**Assertions (both renders performed in the same test, side by side):**

1. **Modal-shaped render:** `render(<FocusReportBody report={report}
   viewMode="calendar" />)` — i.e. no `projectLabelForCwd`, no
   `selectedDate`, no `hideDateNav` (the exact props `FocusReportModal.tsx`
   passes per F3). Assert:
   - Exactly one `prevDay`/`today`/`nextDay` control set renders — query by
     the existing `title={t("report.calendar.prevDay")}` /
     `t("report.calendar.nextDay")` `title` attributes (already used
     elsewhere in this file, e.g. `screen.getByTitle("Calendar")` pattern)
     plus `screen.getByText("Today")` (already asserted at line 337 today).
   - No project-label text rendered anywhere in the block (since
     `projectLabelForCwd` was omitted).
2. **Board-shaped render:** `render(<FocusReportBody report={report}
   viewMode="calendar" projectLabelForCwd={(cwd) => (cwd === "/repo" ?
   "Agent Monitor" : undefined)} selectedDate={new Date("2026-06-10T00:00:00.000Z")}
   hideDateNav={true} />)`. Assert:
   - `expect(screen.queryByTitle("report.calendar.prevDay" translation
     value)).not.toBeInTheDocument()` and same for `nextDay`, and
     `expect(screen.queryByText("Today")).not.toBeInTheDocument()` — **zero**
     day-nav buttons render (this is the concrete regression guard named in
     `change-brief.md`'s "double day-nav UI" risk, §7 of the plan).
   - The project label text ("Agent Monitor") *is* rendered somewhere in the
     block/popup (the one permitted difference).
3. **Cross-render geometry parity** (the actual "one truth" assertion,
   mirroring the existing standing template's own technique at lines
   572-575/586-589): for the *same underlying segment*, assert the two
   renders' `[data-testid="idle-stripe"]` elements have `toBeCloseTo`-equal
   `top`/`height` percentages between the modal-shaped and board-shaped
   renders (excluding the day-nav/label differences called out above as the
   *only* permitted deltas). Use `container.querySelectorAll('[data-testid="idle-stripe"]')`
   exactly as the existing tests already do.
4. Assert **stat tile content is identical** between the two renders for any
   field not affected by DEC-6's relabeling (e.g. "Active time", the
   percentage figures) — reuse the `within(...).getByText(...)` pattern from
   the tile-math tests earlier in this file (lines 153-165ish) applied to
   both render outputs.

**Red-first:** before `FocusReportBody.tsx`/F2's additive props exist, this
test can't even compile/import; once they exist but `hideDateNav` is wired
incorrectly (e.g. passed to the wrong component, or defaulting to `true`),
either the "modal-shaped render shows nav" assertion or the "board-shaped
render shows zero nav buttons" assertion fails. Once F1-F3 are built exactly
per spec, both pass.

### Registry/enum completeness note
`ALL_KINDS`/`FOCUS_KIND_CONFIG` are not being extended by this change (no new
kind added) — no registry-completeness test is needed here. If a future
change adds a 5th `FocusKind`, this test (and the file's kind-ordering test at
line ~450-516) is the one to extend, not fork.

### `FocusCalendarBoard` page-level consumer (second half of "3 consumers, 1 truth")
See §5 below (T3) for the board-page-level assertions that
`FocusCalendarView` + `FocusReportBody` render correctly when driven by the
page's own state, complementing this component-level test.

---

## 3. `TimePeriodPicker` component

**File:** `client/src/components/__tests__/TimePeriodPicker.test.tsx` (new)

Follow `FocusReportModal.test.tsx`'s render-helper convention (a small
`renderPicker(value, onChange)` local helper). No API mocking needed — per
F5b, this component is pure/controlled, no fetch.

```js
describe("TimePeriodPicker", () => {
  describe("day mode navigation", () => { ... });
  describe("custom range mode", () => { ... });
  describe("default", () => { ... });
});
```

Fixture: fix `vi.setSystemTime(new Date("2026-07-26T15:00:00.000Z"))` (same
`NOW` convention as the standing-template test) so "today" is deterministic.

- `it("renders in day mode by default and highlights Today")` — mount with
  `value={{ mode: "day", date: startOfDay(new Date()) }}`; assert the "Today"
  button carries the active-state class/attribute mirroring
  `FocusCalendarView`'s own `isToday` styling convention (`bg-accent
  text-white` class check, or a `data-active="true"` hook if one is added —
  implementer's choice, but state which selector this test uses).
- `it("prev emits the previous day, onChange called with {mode:'day', date}")` —
  click the control whose `title` matches `t("report.calendar.prevDay")`
  (reusing the existing i18n key per F5b); assert `onChange` called once with
  `{ mode: "day", date: <yesterday's startOfDay> }` (computed via the shared
  `calendarWindow.ts`'s `startOfDay`/`DAY_MS`, imported into the test file
  too, so the expected value is derived the same way production code derives
  it — not a hand-computed literal that could silently drift).
- `it("next emits the next day")` — mirror of prev.
- `it("today always resolves to startOfDay(new Date()) regardless of the currently selected/viewed date")` —
  mount with `value={{ mode: "day", date: <some day 10 days in the past> }}`;
  click "Today"; assert `onChange` called with
  `{ mode: "day", date: startOfDay(new Date()) }` — **not** the previously
  selected date. **Red-first**: a bug that made "Today" a no-op or that
  returned the currently-viewed date unchanged fails this; correct
  implementation passes.
- `it("switching to range mode and setting both date inputs emits {mode:'range', start, end}")` —
  click the "custom range" toggle (new i18n key from F12, e.g.
  `t("report.board.customRange")`); fill both `<input type="date">` fields
  via `fireEvent.change` with distinct start/end values; assert `onChange`
  called with `{ mode: "range", start: <Date for start input>, end: <Date for
  end input> }`.
- `it("toggling back to day mode from range mode defaults to today, not the last-viewed range day")` —
  from an active range-mode value, toggle back to day mode; assert `onChange`
  called with `{ mode: "day", date: startOfDay(new Date()) }` (per
  technical-plan.md T7's explicit "matching DEC-3's 'today' default
  framing" — this is the exact regression guard named there). **Red-first**:
  an implementation that instead resurfaces `range.start` as the new day
  value fails this test; the spec'd "always today on mode-switch" behavior
  passes it.

**Fixtures/test data:** none external — all inline `Date` literals under the
fixed system clock above.

---

## 4. `FocusCalendarView`'s additive props (`selectedDate`, `hideDateNav`)

**File:** `client/src/components/__tests__/FocusCalendarView.test.tsx`
(existing file — extend, do not fork; confirm it exists and read its current
fixture helper before adding, reusing whatever `makeReport`-equivalent
already lives there per the file-reuse rule.)

New `describe` block appended, e.g. `describe("board-mode additive props
(selectedDate, hideDateNav)", () => { ... })`:

- `it("existing (modal) usage — omitting all three new props — is pixel-identical to before")` —
  this is the DoD's explicit "existing modal usage (all three omitted) is
  pixel-identical to before" requirement. Snapshot or assert the exact
  rendered day-nav row + block geometry against what the file's *existing*,
  unmodified tests already assert (i.e., simply confirm the pre-existing
  tests in this file pass with zero edits — call this out as a note in the
  PR rather than a new assertion if the existing suite already covers it
  fully; only add a new `it` here if the existing suite doesn't already
  exercise the default (no-props) path explicitly).
- `it("selectedDate, when supplied, controls which day is rendered instead of internal state")` —
  render with `selectedDate={new Date("2026-06-01T00:00:00.000Z")}` and a
  report fixture with a segment only on that date; assert the block renders
  (i.e., the component used the controlled date, not "today"/internal
  `useState`'s default).
- `it("hideDateNav renders zero day-nav buttons")` — render with
  `hideDateNav={true}`; assert
  `screen.queryByTitle(t("report.calendar.prevDay"))` and the `nextDay`
  equivalent are both absent, and `screen.queryByText(t("report.calendar.today"))`
  is absent — **the board variant renders zero day-nav buttons**, this
  task's literal requirement. **Red-first**: before F2's additive props are
  wired, `hideDateNav` doesn't exist as a prop at all (TS compile error) or is
  ignored — nav buttons still render; once wired per spec, they're gone.
- `it("hideDateNav omitted (default false) still renders the nav row, unchanged")` —
  the inverse control case, guarding against an inverted-boolean-logic bug
  (`hideDateNav ?? true` instead of `?? false`) that would silently break
  every existing modal-mode test if it slipped through. Explicit assertion:
  `screen.getByText(t("report.calendar.today"))` **is** present when
  `hideDateNav` is omitted.
- `it("projectLabelForCwd, when it resolves a value for a block's cwd, renders that label; when it returns undefined, renders nothing extra")` —
  two sub-cases in one test or two `it`s: resolved case shows the label text;
  unresolved (`() => undefined`) case renders identically to omitting the
  prop entirely (assert no extra/empty label element added to the DOM, e.g.
  no stray empty `<span>`).

---

## 5. `FocusCalendarBoard` page

**File:** `client/src/pages/__tests__/FocusCalendarBoard.test.tsx` (new)

Mock `api.focusReport`, `api.projects.list`, `api.sessions.list` at module
level, same `vi.mock("../../lib/api", ...)` pattern as
`FocusReportModal.test.tsx`'s `focusReportMock`. Fixture projects (`Project
A` at `/repo-a`, `Project B` at `/repo-b`), fixture global sessions across
both cwds (mirrors the "fetch effectively-all-at-once" pattern; assert the
mock is called as `api.sessions.list({ limit: 10000 })` — **no `cwd` key** —
per F5's exact call shape).

```js
describe("FocusCalendarBoard", () => {
  describe("defaults on first load", () => { ... });
  describe("filter independence", () => { ... });
  describe("edge cases", () => { ... });
  describe("time-period control wiring", () => { ... });
});
```

Fix system time (`vi.setSystemTime`) to a known instant, same convention as
above, so "today" is deterministic.

### 5a. `describe("defaults on first load")`
- `it("defaults to today, all projects, no session selected, and renders without error")` —
  assert `api.focusReport` was called with `projectId: undefined, sessionId:
  undefined` and `from`/`to` spanning exactly `[startOfDay(NOW),
  startOfDay(NOW) + DAY_MS)` (computed via the same `calendarWindow.ts`
  helper the test imports, not a hand re-derived literal).
- `it("fetches the global session list once, unfiltered by project, on mount")` —
  assert `api.sessions.list` called with `{ limit: 10000 }` exactly (no
  `cwd`), and only once even after a project filter is later applied (see
  5b) — the concrete guard for DEC-2's "session dropdown is always the full
  global list."

### 5b. `describe("filter independence")` — **the DEC-2 regression guard**

- `it("selecting a project does not clear an already-selected session")` —
  select a session first (e.g. one belonging to Project B), then select
  Project A; assert the session selector's displayed value is still the
  previously-selected session (not reset to "all sessions"), and
  `api.focusReport` was re-called with **both** `projectId` (A) and
  `sessionId` (still B's session) set simultaneously — a legitimate
  "yields empty result, not an error" combination per DEC-2. **Red-first**:
  the original rejected draft cleared session on project change; this test
  fails against that behavior and passes against the corrected one.
- `it("selecting a session does not clear an already-selected project")` —
  mirror, opposite order.
- `it("changing a project/session filter does not reset the currently-selected time period")` —
  navigate the time period off "today" (e.g. via `prevDay`) first, then
  change the project filter; assert the last `api.focusReport` call still
  carries the previously-navigated `from`/`to`, not reset back to today's
  window.
- `it("using prev/today/next re-fetches with the correct new from/to and does not reset project/session filters")` —
  set project + session filters, then click "next day" on the board's
  `TimePeriodPicker`; assert the next `api.focusReport` call has
  `projectId`/`sessionId` unchanged and `from`/`to` advanced by exactly one
  `DAY_MS`.
- `it("switching to custom-range mode and picking a start/end re-fetches with from/to spanning the full selected range")` —
  toggle range mode, set start/end 5 days apart; assert `api.focusReport`
  called with `from = startOfDay(start)` and
  `to = startOfDay(end) + DAY_MS` (per F5's exact derivation formula).

### 5c. `describe("edge cases")`
- `it("a project with zero sessions shows the existing empty state, not a crash")` —
  select a project whose id has no mapped sessions in the fixture;
  `api.focusReport` resolves to `makeReport({ sessions: [] })`
  (reuse/extend the shared `makeReport` helper — see note below); assert
  `screen.getByText(t("report.calendar.empty"))` (reused key, no new key
  needed per F5).
- `it("a session with no focus history in the current window shows the same empty-day treatment")` —
  same assertion, session-filtered case.
- `it("a project+session combination with no overlapping sessions renders the empty state, not an error")` —
  select a project and a session that don't intersect; assert no error UI
  (`screen.queryByText(/[Cc]ouldn't load/)` absent) and the empty state
  renders instead.
- `it("zero-focus-data across all projects/sessions/today renders the empty state on first load")` —
  default mount with an empty-fixture mock; same empty-state assertion.

### 5d. `describe("concurrency_ratio / wall_clock_ms relabeling (DEC-6)")`
- `it("renders a board-specific relabeled copy for the concurrency stat, distinct from the modal's per-project copy")` —
  per `change-brief.md`'s explicit note that exact final copy isn't locked:
  assert *some* string renders in the concurrency tile that is **not** equal
  to the modal's own literal copy (read the modal's current string constant
  from `FocusReportModal.test.tsx`'s existing concurrency assertion, e.g. the
  "Concurrency" tile label test at line ~182-189, and assert the board's
  label differs from it) — do not hardcode "Concurrent agent sessions" as a
  literal match unless Sara locks copy before this test is written.

**Shared fixture helper:** add a `makeReport()` to this new test file
mirroring `FocusReportModal.test.tsx`'s shape (do not import across test
files; each test file owns its own fixture builder, per this repo's existing
one-helper-per-file convention observed in both `projects.test.js` and
`FocusReportModal.test.tsx`).

---

## 6. `Sidebar.test.tsx` — new nav entry

**File:** `client/src/components/__tests__/Sidebar.test.tsx` (extend the two
existing tests, not new ones — matches technical-plan.md T5's "add to" framing)

- Extend `"should render all navigation links"` (currently line 32-38): add
  `expect(screen.getByText("Calendar")).toBeInTheDocument();` — asserting the
  literal DEC-5 label, **not** "Focus Calendar" (the wrong-label trap the PM
  flagged; a completeness-only test wouldn't catch this, so assert the exact
  string here).
- Extend `"should have correct navigation hrefs"` (currently line 58-66): add
  `expect(hrefs).toContain("/focus-calendar");`.
- **New** `it("positions Calendar right after Projects in nav order")` —
  assert ordering explicitly, not just presence (this is the DEC-5 "right
  after Projects" requirement, which the two extended tests above don't pin
  on their own): query all nav link text nodes in DOM order (e.g.
  `screen.getAllByRole("link").map(el => el.textContent)`, or however the
  existing icon+label markup renders text) and assert the index of
  `"Calendar"` is exactly `index of "Projects" + 1`. **Red-first**: this
  fails against the original draft's placement (after Kanban Board) and
  passes only once F6 places the `NAV_KEYS` entry in the corrected position.

---

## 7. i18n completeness — registry-driven, closes the flagged gap

**File:** `client/src/i18n/__tests__/i18n.test.ts` (extend — new `describe`
block, following the exact pattern of the existing
`describe("report.{wallClockLabel,activeLabel} key relocation (registry-derived, all locales)")`
block at line 75, which is explicitly cited as the template to mirror.)

```js
describe("nav.focusCalendar key completeness (registry-derived, all locales)", () => {
  for (const locale of LOCALES) {
    it(`resolves a non-empty, non-key-echoing, short label for locale "${locale}"`, async () => {
      await i18n.changeLanguage(locale);
      const label = i18n.t("nav:focusCalendar");
      expect(label).not.toBe("focusCalendar");       // missing-key guard
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    });
  }

  it("uses the short 'Calendar' label in English, not the fuller 'Focus Calendar' page-heading copy (DEC-5)", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("nav:focusCalendar")).toBe("Calendar");
    expect(i18n.t("nav:focusCalendar")).not.toBe("Focus Calendar");
  });
});
```

This closes exactly the gap `change-brief.md` names: "this morning's i18n
test is narrowly scoped [to the wallClockLabel/activeLabel relocation] and
won't catch this [new nav key]." Because it's driven by the file's existing
`LOCALES` array (line 15: `["en", "ko", "vi", "zh"]`), a locale accidentally
skipped in F8-F11 fails this loop's iteration for that locale specifically —
an omitted entry can't ship green.

**Note (stated per the brief's own caveat):** this test catches *missing*
key, and (via the second `it`) catches the *specific* known wrong-label trap
(shipping "Focus Calendar" in `nav:focusCalendar` instead of "Calendar") for
English. It does **not** verify the zh/vi/ko strings are the *correct*
translation (only that they're non-empty/non-key-echo) — per
`technical-plan.md` §7's own risk note, a manual label-text check against
`decisions.md` DEC-5 for all four locales is still required before merge;
this is not a substitute for that.

**Red-first:** with no `nav.json` change at all, `i18n.t("nav:focusCalendar")`
resolves to the literal string `"focusCalendar"` (i18next's missing-key
fallback with namespace stripped) — every locale's first assertion fails.
Once F8-F11 land in all four files, all pass. If F8-F11 land in only 3 of 4
locales, exactly one locale's iteration fails, pinpointing the specific
missing file.

---

## 8. `screens.snapshot.test.tsx` — 13th case

**File:** `client/src/pages/__tests__/screens.snapshot.test.tsx` (extend)

1. Extend the `vi.mock("../../lib/api", ...)` factory's returned `api`
   object (around the existing `projects: {...}` block, line 385-395) to add:
   ```js
   focusReport: r({
     sessions: [], items: [], totals: /* emptyKindTotals()-shaped, wall_ms:0,... */,
     idle_grace_seconds: 300, wall_clock_ms: 0, concurrency_ratio: null,
     project_id: null, session_id: null,
   }),
   ```
   at the top level (new `api.focusReport`, not nested under `projects` —
   per F4/B1's route mount being a new top-level `api.focusReport(...)`
   method, distinct from the existing `api.projects.focusReport`).
2. Confirm the existing `api.sessions.list` mock (`r({ sessions: [], total:
   0, limit: 50, offset: 0 })`, already present at line 210) is reused as-is
   — the plan notes the board calls it with `{ limit: 10000 }` and no `cwd`,
   which this shared empty-fixture mock already satisfies regardless of call
   args (the mock is arg-agnostic `r(...)`), so no new mock shape is needed,
   only confirm no assertion elsewhere in this file inspects call args in a
   way this would break.
3. Import `FocusCalendarBoard` alongside the other page imports (line
   427-438).
4. Add the 13th case, placed to mirror the sidebar/route order (right after
   the `"Projects"` case, before `"Kanban board"`), per DEC-5's positioning
   convention carried through to snapshot ordering too:
   ```js
   it("Focus calendar board", async () => {
     await snapshot(<FocusCalendarBoard />, "/focus-calendar");
   });
   ```

**Diff-review note (do not blind-regenerate — per `CLAUDE.md`'s testing
policy, restated here for this specific change):**
- Run `cd client && npx vitest run src/pages/__tests__/screens.snapshot.test.tsx`
  first without `-u`.
- Expect **exactly one new snapshot** (the "Focus calendar board" case, which
  has no prior baseline so it will "pass" trivially on first run, per
  Vitest's snapshot semantics — visually inspect its generated output once by
  eye for sane structure, since there's no prior baseline to diff against).
- Expect the existing **`"Projects"` and `"Kanban board"` snapshots to be
  byte-identical** to their pre-change baselines — this is the concrete DoD
  item ("Projects and KanbanBoard snapshots are byte-identical to their
  pre-change baseline, proving the shared-chrome extraction didn't leak into
  the existing entry points"). If either shows a diff, that is a real
  regression from the F1-F3 extraction (do not regenerate to "fix" it —
  investigate why the extraction changed rendered output).
- Only after confirming the above, run `cd client && npx vitest run -u` to
  bless the new baseline, and re-diff the committed snapshot file to confirm
  only the one new case's entry was added (no incidental whitespace/ordering
  changes to the 12 existing entries).

---

## Round-trip / boundary-surface note

This feature has **no persistence** (no schema/migration, per
`technical-plan.md` §"Database / migration: None") and **no create/update
round-trip** to test — `GET /api/focus-report` is read-only, computed
on-the-fly from existing `sessions`/`events` rows via the unmodified
`buildProjectFocusReport`. The relevant "boundary" here is the
**client↔server query-param boundary** (§1a above covers it fully: no
unresolved/implicit default ever crosses that boundary — every 400 case
above is the "no-unresolved-token" analogue for this feature, i.e. "no
hidden default window" is asserted both at the point the client could omit
`from`/`to` and at the point the server would otherwise silently supply one).

---

## How to run

- Backend: `npm run test:server` (equivalently,
  `node --test server/__tests__/focus-report-route.test.js
  server/__tests__/projects.test.js server/__tests__/focus-report.test.js`
  for the touched-surface subset during iteration).
- Frontend: `npm run test:client` (equivalently, for the touched-surface
  subset:
  `cd client && npx vitest run src/components/__tests__/FocusReportModal.test.tsx src/components/__tests__/FocusCalendarView.test.tsx src/components/__tests__/TimePeriodPicker.test.tsx src/components/__tests__/Sidebar.test.tsx src/pages/__tests__/FocusCalendarBoard.test.tsx src/pages/__tests__/screens.snapshot.test.tsx src/i18n/__tests__/i18n.test.ts`).
- Snapshot regeneration (only after diff review per §8):
  `cd client && npx vitest run -u`.
- File-header audit (every new test file above needs the header too, per
  `.claude/rules/file-headers.md`): `bash .claude/skills/file-headers/scripts/check-headers.sh`.
- Full pre-done sequence (matches `technical-plan.md` §4 step 10):
  `npm run test:server` → `npm run test:client` → review
  `screens.snapshot.test.tsx` diff by eye → `bash .claude/skills/file-headers/scripts/check-headers.sh`.

---

## Cross-reference: which test guards which named risk (`change-brief.md` → this doc)

| Risk in `change-brief.md` | Test(s) here |
|---|---|
| Cross-path consistency (old vs. new endpoint) | §1e |
| Cross-consumer rendering consistency (modal vs. board) | §2, §4 |
| Modal non-regression | §1 (regression guard), §4 (pixel-identical case), existing suites run unmodified |
| Filter independence | §5b |
| No hidden/implicit time bound | §1a |
| Locale completeness (4-locale nav.json trap) | §7 |
| `sources` scoping on new route only | §1d, §1 regression guard (old route/tests unmodified) |
| Snapshot byte-identity for existing pages | §8 |
