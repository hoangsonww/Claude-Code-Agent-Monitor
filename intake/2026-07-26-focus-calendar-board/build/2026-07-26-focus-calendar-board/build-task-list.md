# Build Task List — 2026-07-26-focus-calendar-board

> Authored by `build-planner`, merging `technical-plan.md` (what to change) and
> `test-plan.md` (what to prove) into ONE ordered, dependency-correct
> sequence. The implementer follows this top to bottom, test-first. Detailed
> enough to build without re-reading the original investigation.

**Worktree (all paths below are relative to this root):**
`/Users/sara/CODE-LOCAL/SARA/efforts/2026-07-26-focus-calendar-board/Claude-Code-Agent-Monitor`
(branch `effort/2026-07-26-focus-calendar-board`, starting commit `0ef79b378e0de180155bc5549643760230d9dc2a`).
No Docker stack is provisioned for this effort (deliberate — see `build-brief.md`);
verification is `npm run test:server` / `npm run test:client` plus one manual
`npm run dev` pass. This project has no `PROJECT-CONTEXT.md`/formal defect
catalog — both plans use the informal id **`DERIVED-DUAL-VIEW`** ("a
value/rendering computed once, consumed by multiple independent surfaces,
with no shared helper/test enforcing agreement") as this project's own
de-facto catalog entry; cited below wherever it gates a task.

Every new file created below requires the mandatory
`@author Son Nguyen <hoangson091104@gmail.com>` header
(`.claude/rules/file-headers.md`); every edited file that lacks the header
must gain one in the same change. Audited at task 24, but do not defer adding
headers on new files until then — add them as you create each file.

## Build order (dependency-correct, red-first)
> Tests that prove a change come BEFORE the change they guard. `[test]` =
> author a failing test; `[impl]` = product code; `MANDATORY [<id>]` = durable
> cure, gates done. Single sequential implementer — no step below is safe to
> parallelize with another (see Sequencing notes).

| # | Task | Type | Layer | File(s) | Done-check |
|---|------|------|-------|---------|------------|
| 1 | Author the new route's full test suite: 400s for missing/malformed `from`/`to` (all four cases) with `{error:{code:"BAD_REQUEST",message}}` body; no filter combination ever yields 200 without both bounds; `?project_id=`/`?session_id=` scoping incl. 404 on unknown ids; `?sources=` narrows the set; **split parity assertions** vs. the old route — group (a) `assert.deepEqual` on `sessions`/`items`/`totals`, `assert.equal` on `wall_clock_ms`/`concurrency_ratio` (never a whole-object `deepEqual`); group (b) envelope echo-back (`project_id`/`session_id` incl. explicit assertion the *old* route's body has no `session_id` key at all); an explicit `?sources=`-present case run against both routes side by side, pinning the old route's continued non-support as intentional; empty-shape parity; no `from`/`to` echoed back | test | integration (server) | `server/__tests__/focus-report-route.test.js` (new) | `node --test server/__tests__/focus-report-route.test.js` — every case RED (route not mounted → connection error / 404) |
| 2 | Build `GET /api/focus-report`: resolve session set from `?project_id=`/`?session_id=`/`?sources=` (via `source-filter.js`), **require `from`/`to`** ISO-8601 instants (400 if either missing/unparseable, no env knob, no default window), select sessions overlapping `[from,to)`, feed the resolved rows into the **unmodified** `buildProjectFocusReport`, return `{project_id, session_id, ...report}` (`from`/`to` never echoed). Mount in `server/index.js` near the existing `/api/focus` line with a comment distinguishing the two. `server/lib/focus-report.js` gets **zero edits**. | impl | backend | `server/routes/focus-report.js` (new), `server/index.js` | `node --test server/__tests__/focus-report-route.test.js` — all cases GREEN, including both parity assertion groups against the real old-route output |
| 3 | Widen `FocusReport.project_id` to `string \| null`; add `session_id: string \| null` — additive/widening only | impl | frontend types | `client/src/lib/types.ts` | typecheck clean (`cd client && npx tsc --noEmit` or project's configured typecheck); grep confirms no existing reader of `report.project_id` breaks |
| 4 | Run the two regression companions **unmodified** — proves task 2 didn't touch the shared computation engine or the old route | test | integration (server) | `server/__tests__/focus-report.test.js`, `server/__tests__/projects.test.js` | `node --test server/__tests__/focus-report.test.js server/__tests__/projects.test.js` GREEN with **zero edits**; `git diff --stat -- server/lib/focus-report.js server/routes/projects.js` is empty. **`MANDATORY [DERIVED-DUAL-VIEW]`** — this is the "one computation path" cure's other half: if this diff isn't empty, stop, you re-derived instead of reusing |
| 5 | Add new `describe("board-mode additive props...")` block: `selectedDate` controls rendered day over internal state; `hideDateNav={true}` renders zero day-nav buttons; `hideDateNav` omitted still renders the nav row (inverted-boolean guard); `projectLabelForCwd` renders the resolved label or nothing when it resolves `undefined` | test | component (client) | `client/src/components/__tests__/FocusCalendarView.test.tsx` (extend) | `cd client && npx vitest run src/components/__tests__/FocusCalendarView.test.tsx` — new block RED (props don't exist/are ignored); pre-existing assertions in the file still pass |
| 6 | Extract `DAY_MS`/`startOfDay(d: Date): Date` out of `FocusCalendarView.tsx` into a new shared file; export both; `FocusCalendarView.tsx` imports them from here instead of defining them locally (pure relocation, zero behavior change) | impl | frontend lib | `client/src/lib/calendarWindow.ts` (new), `client/src/components/FocusCalendarView.tsx` | `cd client && npx vitest run src/components/__tests__/FocusCalendarView.test.tsx` — no new failures from the relocation alone. **`MANDATORY [DERIVED-DUAL-VIEW]`** — this is now the *one* day-boundary implementation; tasks 12 and 17 must import from here, never redefine `startOfDay`/`DAY_MS` a second time |
| 7 | Add the three additive props to `FocusCalendarView.tsx`: `projectLabelForCwd?`, `selectedDate?`, `hideDateNav?` — all default to today's uncontrolled, nav-visible behavior when omitted | impl | component (client) | `client/src/components/FocusCalendarView.tsx` | `cd client && npx vitest run src/components/__tests__/FocusCalendarView.test.tsx` — full file GREEN (task 5's new block passes; every pre-existing assertion still passes unmodified) |
| 8 | Add exactly one new `it(...)` directly after the existing line-518 `"[standing template]"` test, inside the same `describe` (do not fork a new file): mount `FocusReportBody` directly twice — modal-shaped props (no `projectLabelForCwd`/`selectedDate`/`hideDateNav`) vs. board-shaped props (`projectLabelForCwd` set, fixed `selectedDate`, `hideDateNav={true}`) — assert modal-shaped shows exactly one day-nav control set and no project label; board-shaped shows **zero** day-nav controls and does show the label; idle-stripe `top`/`height` geometry and non-relabeled stat-tile text identical between the two for the same segment | test | component (client) | `client/src/components/__tests__/FocusReportModal.test.tsx` (extend) | run — RED: `./FocusReportBody` doesn't exist yet (module-resolution/compile failure) |
| 9 | Move, verbatim except as noted, out of `FocusReportModal.tsx`: `ReportBody` (renamed `FocusReportBody`, exported), `ListView`, `StatTile`, `SegmentedBar`, `kindTotalsAsSegments`, `ALL_KINDS`, the `ViewMode` type (exported). Extract the List/Calendar toggle markup into a new exported `FocusReportViewToggle({viewMode, onChange})`. Add one new optional prop, `projectLabelForCwd?: (cwd: string \| null) => string \| undefined`, threaded straight through to `FocusCalendarView` when `viewMode==="calendar"` | impl | component (client) | `client/src/components/FocusReportBody.tsx` (new) | **`MANDATORY [DERIVED-DUAL-VIEW]`** — this file becomes the single implementation of stat-tiles/List-Calendar toggle/list body; no code may copy-paste this JSX anywhere else in this change-set (verified structurally, not just by test, in task 10 and again in task 17) |
| 10 | Remove the moved definitions from `FocusReportModal.tsx`; import `{FocusReportBody, FocusReportViewToggle, ViewMode}` from `./FocusReportBody`; replace the inline toggle JSX with `<FocusReportViewToggle viewMode={viewMode} onChange={setViewMode}/>`; replace `<ReportBody .../>` with `<FocusReportBody report={report} viewMode={viewMode}/>` (no `projectLabelForCwd`/`selectedDate`/`hideDateNav` — single-project modal needs none). `viewMode` state stays owned by `FocusReportModal` | impl | component (client) | `client/src/components/FocusReportModal.tsx` | `cd client && npx vitest run src/components/__tests__/FocusReportModal.test.tsx src/components/__tests__/FocusCalendarView.test.tsx` — **all GREEN**, including task 8's new test, with every pre-existing assertion in both files passing **unmodified** (the explicit "modal is unregressed before a second consumer exists" proof both plans call for) |
| 11 | Author unit tests: day-mode default highlights Today; prev/next emit the adjacent day computed via `calendarWindow.ts` (never a hand-derived literal); Today always resolves to `startOfDay(new Date())` regardless of the currently-viewed date; switching to range mode emits `{mode:'range',start,end}`; switching back to day mode from range mode defaults to today, not the last-viewed range day | test | component (client) | `client/src/components/__tests__/TimePeriodPicker.test.tsx` (new) | run — RED (module doesn't exist / fails to mount) |
| 12 | Build the page-level filter control: props `value: {mode:"day",date} \| {mode:"range",start,end}`, `onChange`; day mode mirrors `FocusCalendarView`'s existing prev/today/next row, reusing `report.calendar.prevDay/today/nextDay` (no new keys needed there); a "custom range" toggle exposes two `<input type="date">`; pure/controlled, no fetching | impl | component (client) | `client/src/components/TimePeriodPicker.tsx` (new) | `cd client && npx vitest run src/components/__tests__/TimePeriodPicker.test.tsx` GREEN. **`MANDATORY [DERIVED-DUAL-VIEW]`** — must import `startOfDay`/`DAY_MS` from task 6's `calendarWindow.ts`; do not redefine day-boundary math locally |
| 13 | Add `api.focusReport({projectId?, sessionId?, from, to})` — `from`/`to` are **required** (not optional) ISO-8601 instant strings; builds the query string from whichever filters are supplied; calls `applyScope(qs)` exactly like `sessions.list` does so the global Data Scope selector's `?sources=` is picked up automatically; doc-comment states there is no default — the caller must always compute and pass both | impl | frontend lib | `client/src/lib/api.ts` | Calling `api.focusReport()` without `from`/`to` is a TS compile error; `cd client && npx tsc --noEmit` passes; manual smoke call against task 2's live route (`npm run dev` optional here, or a quick fetch in a scratch test) returns 200 for a valid window |
| 14 | Add two new `LOCALES`-driven `describe` blocks to the existing file: (1) `nav:focusCalendar` resolves a non-empty, non-key-echoing string in all four locales, **plus** a separate assertion pinning the English value to exactly `"Calendar"` (not `"Focus Calendar"`); (2) `report.board.concurrentSessions` (DEC-6's relabel key) resolves through `i18n.t(...)` in all four locales and is distinct from the existing per-project concurrency label | test | i18n registry (client) | `client/src/i18n/__tests__/i18n.test.ts` (extend) | run — **every `LOCALES` iteration in both new blocks RED** (keys don't exist yet; `i18n.t(...)` returns the namespace-stripped missing-key echo) |
| 15 | Add, **in one atomic step covering all four locale files at once** (not split across separate edits/commits): `nav.json` → `"focusCalendar"` (en `"Calendar"`, zh `"日历"`, vi `"Lịch"`, ko `"달력"`); `plan.json` → `report.board` object with `title, projectFilter, allProjects, sessionFilter, allSessions, customRange, dayView, from, to, concurrentSessions` per the technical-plan's F12 table (concrete strings already specified there for all four locales, including the DEC-6 `concurrentSessions` entry) | impl | i18n (client) | `client/src/i18n/locales/en/nav.json`, `client/src/i18n/locales/zh/nav.json`, `client/src/i18n/locales/vi/nav.json`, `client/src/i18n/locales/ko/nav.json`, and the matching four `plan.json` files | `cd client && npx vitest run src/i18n/__tests__/i18n.test.ts` — **both new blocks fully GREEN across all four locales simultaneously.** **`MANDATORY [DERIVED-DUAL-VIEW]`** — the atomic-landing cure: if exactly one `LOCALES` iteration per key stays red, that pinpoints one missing locale file — **stop and fix it, do not ship 3-of-4** |
| 16 | Author: default state on mount (today, all-projects, no-session, `api.sessions.list` called with `{limit:10000}` and no `cwd`, exactly once); **filter independence asserted on rendered `<select>` displayed values** (not just mocked fetch-call args) — selecting a project doesn't clear an already-selected session and vice versa, changing project/session doesn't reset the time period, day-nav doesn't reset project/session; zero-result edge cases (empty project, empty session, non-overlapping combo) render the existing empty state, not a crash; DEC-6 relabel renders via `i18n.t(...)`, distinct from the modal's copy | test | page (client) | `client/src/pages/__tests__/FocusCalendarBoard.test.tsx` (new) | run — RED (page module doesn't exist yet, import fails) |
| 17 | Build the page: on mount, `api.projects.list()` (project filter + `cwd→name` map) and `api.sessions.list({limit:10000})` **once, no `cwd` filter** (genuinely global session list, independent of the project filter — never re-fetched on project change). State: `projectId?`, `sessionId?` (neither clears the other), `timeWindow` defaulting to `{mode:"day", date: startOfDay(new Date())}` (today, via task 6's helper). Derive `from`/`to`, call `api.focusReport(...)` on mount and on any filter change. Render header (`plan:report.board.title`), project select, session select (always the full list), `<TimePeriodPicker/>` (task 12), `<FocusReportViewToggle/>` + `<FocusReportBody report=... viewMode=... projectLabelForCwd=.../>`, passing `selectedDate`/`hideDateNav={true}` through when `viewMode==="calendar"` so there is exactly one day-nav control on the page | impl | page (client) | `client/src/pages/FocusCalendarBoard.tsx` (new) | `cd client && npx vitest run src/pages/__tests__/FocusCalendarBoard.test.tsx` GREEN, **specifically**: the filter-independence assertions pass reading rendered `<select>` values (a client-side-only "cheat" that only fixes fetch args would still fail here). **`MANDATORY [DERIVED-DUAL-VIEW]`** — must consume `FocusReportBody`/`FocusReportViewToggle`/`FocusCalendarView`/`TimePeriodPicker`/`calendarWindow.ts` as-is; zero re-derived JSX or day-math. **`MANDATORY [DEC-2]`** — project/session/time-period are independent; none ever clears another. **`MANDATORY [DEC-3]`** — every request the client sends has explicit `from`/`to`; no hidden default |
| 18 | Extend two existing tests + add one new: `"should render all navigation links"` gains a `"Calendar"` assertion; `"should have correct navigation hrefs"` gains `/focus-calendar`; new `it("positions Calendar right after Projects...")` asserting `index("Calendar") === index("Projects") + 1` | test | component (client) | `client/src/components/__tests__/Sidebar.test.tsx` (extend) | run — RED (`"Calendar"` absent from `NAV_KEYS`, no index to find) |
| 19 | Add `CalendarDays` to the `lucide-react` import list; add one `NAV_KEYS` entry `{to:"/focus-calendar", icon:CalendarDays, key:"nav:focusCalendar"}`, positioned **immediately after `projects` and before `agentBoard`** (per DEC-5 — corrected from the original draft's after-Kanban placement; do not build the original placement) | impl | component (client) | `client/src/components/Sidebar.tsx` | `cd client && npx vitest run src/components/__tests__/Sidebar.test.tsx` GREEN — label, href, **and position** all pass |
| 20 | Import `FocusCalendarBoard`; add `<Route path="focus-calendar" element={<FocusCalendarBoard/>}/>` right after the `projects` route, mirroring the corrected sidebar order | impl | routing (client) | `client/src/App.tsx` | `cd client && npx tsc --noEmit` clean; `cd client && npx vitest run src/pages/__tests__/FocusCalendarBoard.test.tsx` still GREEN (page still mounts standalone) |
| 21 | Extend the `vi.mock("../../lib/api", ...)` factory with a top-level `api.focusReport` mock (empty-fixture-shaped) and reuse/extend the existing `api.projects.list`/`api.sessions.list` mocks (note: `sessions.list` now called with `{limit:10000}`, no `cwd`); add the 13th case, `"Focus calendar board"`, positioned right after the existing `"Projects"` case | test | snapshot (client) | `client/src/pages/__tests__/screens.snapshot.test.tsx` (extend) | run **without** `-u` first: `cd client && npx vitest run src/pages/__tests__/screens.snapshot.test.tsx` — new case has no baseline yet (expected, inspect by eye); **the existing `"Projects"` and `"Kanban board"` cases must be byte-identical to their pre-change baseline.** **`MANDATORY [DERIVED-DUAL-VIEW]`** — this is the single strongest mechanical fence against chrome-extraction leakage; any diff here means tasks 6-10 changed the existing modal entry points — stop, do not bless it away |
| 22 | Bless **only** the one new baseline | impl | snapshot (client) | `client/src/pages/__tests__/screens.snapshot.test.tsx` (generated baseline) | `cd client && npx vitest run -u` once; `git diff --stat` on the snapshot file shows exactly one new baseline block added, zero changes to the `Projects`/`Kanban board` blocks |
| 23 | Add a new `GET /api/focus-report` section (query params incl. the now-required `from`/`to`; response shape pointing back to the existing per-project section for shared fields; explicitly state there is no server-side default and a missing bound is a 400, not "all time"). Update any `README`/`ARCHITECTURE.md` claims about the focus-report surface in the same change-set | impl | docs | `docs/API.md` (+ `README.md`/`ARCHITECTURE.md` if they describe this surface) | Section present with concrete param/response docs and the explicit no-default statement; commands/paths in the doc are copy-pasteable |
| 24 | Run the repo's file-header audit over every new/edited applicable file from tasks 1-23 (`focus-report.js`, `focus-report-route.test.js`, `FocusReportBody.tsx`, `calendarWindow.ts`, `TimePeriodPicker.tsx`, `TimePeriodPicker.test.tsx`, `FocusCalendarBoard.tsx`, `FocusCalendarBoard.test.tsx`, plus any edited file missing a header) | impl | repo hygiene | (all new/edited files) | `bash .claude/skills/file-headers/scripts/check-headers.sh` exits 0 |
| 25 | Full regression pass, not just touched-surface subsets | test | full-suite | (whole repo) | `npm run test:server` exits 0; `npm run test:client` exits 0 |
| 26 | Manual click-path (no automated e2e runner exists in this repo): open the existing modal for a project with real history, note a specific day; navigate via sidebar to Calendar; independently set project **and** session filters (confirm neither clears the other); navigate the same day via prev/today/next, confirm pixel/data parity with the modal; try a custom range spanning several days, confirm fetched data covers the whole range while day-nav still pages one day at a time within it; clear filters, confirm the all-projects/all-sessions/today union view renders without error; confirm the modal's two existing trigger points (`Projects.tsx:601`, `KanbanBoard.tsx:968`) are visually unchanged; glance at all four locales' sidebar label for correctness (not just presence) | manual | end-to-end (product) | (running app) | `npm run dev`; open in real Chrome (`open -a "Google Chrome" "http://localhost:<port npm run dev prints>"` — this effort has no dedicated Docker port block, use whatever `npm run dev` prints in **this** worktree); every sub-bullet above confirmed by eye, documented as passed |

## Mandatory durable-cure tasks

- **#2 — one computation path** `MANDATORY [DERIVED-DUAL-VIEW]` — the new
  route never hand-derives `mergeIntervals`/per-kind totals; it feeds
  resolved session rows through the unmodified `buildProjectFocusReport`.
  Enforced structurally by task 2, pinned by task 1's split-parity test and
  reconfirmed untouched by task 4's regression check.
- **#6 — one day-boundary-math helper** `MANDATORY [DERIVED-DUAL-VIEW]` —
  `startOfDay`/`DAY_MS` live once in `calendarWindow.ts`; tasks 12
  (`TimePeriodPicker.tsx`) and 17 (`FocusCalendarBoard.tsx`) import from it,
  never redefine it.
- **#9 — one rendering-chrome implementation** `MANDATORY [DERIVED-DUAL-VIEW]`
  — `FocusReportBody.tsx` is the only implementation of stat-tiles/
  List-Calendar toggle/list body; both `FocusReportModal` (task 10) and
  `FocusCalendarBoard` (task 17) consume it, no copy-pasted JSX. Pinned by
  extending (task 8), not forking, the existing "[standing template]" test.
- **#15 — 4-locale i18n completeness, atomic** `MANDATORY [DERIVED-DUAL-VIEW]`
  — the new nav key and DEC-6's relabel key must land in all four locale
  files (`nav.json` + `plan.json`) in the same step; a partial landing is a
  stop-and-fix condition, not a "ship 3 and follow up" condition. Pinned by
  task 14's registry-driven loop authored *before* the keys exist.
- **#21 — byte-identical snapshot regression fence** `MANDATORY [DERIVED-DUAL-VIEW]`
  — mechanical proof that the chrome extraction (tasks 6-10) leaked nothing
  into the two pre-existing entry points.
- **#17 — filter independence** `MANDATORY [DEC-2]` and **no hidden
  time-window default** `MANDATORY [DEC-3]` — not the `DERIVED-DUAL-VIEW`
  pattern itself, but equally non-negotiable per Sara's locked decisions;
  called out here so neither gets quietly softened as "good enough" during
  implementation.

**No open decision to surface here:** both plans implement the full
structural cure for every recurring-pattern surface this change touches (data,
rendering, day-math, i18n) — neither plan takes a point-fix shortcut where the
project's own memory calls for a structural one. Nothing to flag as a
downgraded/point-fix decision.

## Sequencing notes

- **Do not parallelize — single sequential implementer.** `FocusCalendarView.tsx`
  is edited across tasks 5-7 and again read (not edited) by task 10's
  regression check; `FocusReportModal.tsx` is edited in task 10 only but its
  test depends on task 9 existing first. Do these in exact numeric order —
  task 10's done-check (both suites green, zero pre-existing assertions
  changed) is the actual proof the extraction was safe, and it can only mean
  anything if tasks 5-9 already landed in order.
- **Task 15's four locale files must land as one atomic unit** — not spread
  across separate edits over time, even by the same implementer in the same
  sitting split into multiple saves. If interrupted mid-way, treat the
  partial state as "not done," matching task 14's tripwire.
- **Needs a live service:** only task 26 (manual click-path) requires
  `npm run dev` running. Every other task (1-25) is unit/integration-level
  (`node --test` against an ephemeral SQLite DB, or Vitest/RTL component/page
  tests) — no Docker stack is needed or provisioned for this effort (see
  `build-brief.md`: both compose files at the repo root describe a
  production-style deployment, not this effort's test loop). When running
  task 26, use whatever port `npm run dev` prints in **this** worktree — there
  is no dedicated Docker port block for this effort to reference, and no
  shared/default-stack port should be assumed.
- **Stop-and-report triggers (plan-is-wrong conditions — escalate, don't
  improvise):**
  - Task 4's regression check fails, or passing it seems to require editing
    `server/lib/focus-report.js` or `server/routes/projects.js` — this is
    explicit, named scope creep in both plans (the old route's `?sources=`
    gap is deliberately staying unfixed here). Stop; do not "helpfully" fix it.
  - Task 15 lands with fewer than all four locales green in task 14's tests —
    stop; do not ship a partial i18n commit under time pressure.
  - Task 21's `"Projects"`/`"Kanban board"` snapshot cases show **any** diff
    from their committed baseline — stop; this means the chrome extraction
    changed real user-facing output in the existing entry points. Do not run
    `-u` to bless it away; find and fix the leak first.
  - Any task's done-check reveals `FocusCalendarBoard.tsx`, the new route, or
    `TimePeriodPicker.tsx` hand-deriving its own merge/day-math instead of
    importing the shared helper/component — stop; this is exactly the defect
    shape (`DERIVED-DUAL-VIEW`) this entire effort exists to prevent
    prospectively, not the shape to reproduce a third time.
  - Task 17's filter-independence assertions only pass when checked against
    mocked fetch-call arguments but fail against rendered `<select>` values —
    stop; per DEC-2 and both plans, only the rendered-DOM version counts as
    proof.
