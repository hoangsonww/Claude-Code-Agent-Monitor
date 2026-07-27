# Technical Plan: Project-wide Focus Calendar Board

Intake: `intake/2026-07-26-focus-calendar-board/` · Date: 2026-07-26 · Tech Lead pass
Classification (PM, final): `new-feature`. Inputs reconciled: `pm-plan.md`,
`supporting/architect.md`, `supporting/engineer.md`, `supporting/qa.md`,
`supporting/product-owner.md`.

**Revision note (2026-07-26, same day):** Sara has now answered all six open
decision points, recorded verbatim in `decisions.md`. Four (DEC-1 standalone
page, DEC-4 leave the existing modal untouched, DEC-5 nav label/position,
DEC-6 keep `concurrency_ratio` with relabeled copy) confirm this plan's
original drafted defaults as-is. **Two changed the actual design** and are
folded into this revision throughout:

- **DEC-2**: the session filter is a **global list across all projects**,
  not scoped to the selected project as originally drafted — and it sits
  alongside a **third, independent filter control: a time-period selector**.
  Project, session, and time-period are three independent filters, not a
  project→session dependency chain.
- **DEC-3**: given DEC-2's time-period selector, the default view is
  **"today"** (not an unbounded/30-day-windowed all-time view), with
  day-by-day navigation (prev/today/next, matching the existing per-project
  Calendar view's UX) plus a custom date-range picker. Because the client now
  always supplies an explicit bound, the originally-drafted server-side
  `DASHBOARD_FOCUS_BOARD_WINDOW_DAYS` env-knob/30-day-default mechanism is
  **dropped** and replaced by `from`/`to` query params the client always
  sends.

One additional correction folded in per DEC-5: the original draft's nav
label ("Focus Calendar", positioned after Kanban Board) did not match what
Sara actually decided ("Calendar", positioned right after Projects) — fixed
in §3/§8 below.

**Status: decisions are now final** (all six DECIDED in `decisions.md`); this
plan is build-ready as written. No further sign-off gate beyond normal code
review.

---

## 1. Objective

Add a first-class sidebar destination, **Calendar** (route
`/focus-calendar`, page heading "Focus Calendar"), that renders the existing
focus-time swimlane calendar across every monitored project at once,
filterable by three independent controls: **project** (optional, default "all
projects"), **session** (a global list across every project, independent of
the project filter), and **time period** (day-by-day navigation or a custom
date range, defaulting to "today"). It is powered by a new aggregate
endpoint, `GET /api/focus-report`, that reuses `buildProjectFocusReport` /
`buildSessionFocusReport` in `server/lib/focus-report.js` completely
unchanged — the new route is a thin session-selection + explicit time-window
layer in front of the same functions. The existing per-project modal
(`FocusReportModal.tsx`, opened from `Projects.tsx:601` and
`KanbanBoard.tsx:968`) is left fully intact and unregressed; its reusable
chrome (stat tiles, List/Calendar toggle, list body) is extracted into a
shared component so the new page consumes the same implementation instead of
copy-pasting it — closing, prospectively, the exact "one rendering surface,
two codepaths" defect shape this project fixed reactively this morning
(`6e29722`). End state: one computation path (`focus-report.js`), one scoping
convention (`source-filter.js`), one rendering-chrome implementation
(`FocusReportBody.tsx`), one day-navigation implementation (shared between
`FocusCalendarView`'s internal nav and the board's page-level control),
consumed from two entry points (modal + new page).

## 2. Recommended approach

**Data access: Architect's Option B (new aggregate endpoint), confirmed.**
Reject the client-merge "quick" path per architect/engineer/QA unanimous
agreement — it would force a second, client-side reimplementation of
`mergeIntervals`/per-kind totals math that already lives once in
`focus-report.js`, recreating on the client the exact duplication risk this
project just spent a morning fixing on the rendering side.

**Filter shape: three independent controls, per Sara's DEC-2/DEC-3 (this
overrides the original draft, which offered "session scoped to selected
project" + a server-side 30-day default as the two defaults; Sara rejected
both).** Project, session, and time-period are independent filters that
combine by intersection, not a dependency chain:

- **Project** — optional; unset means "all projects."
- **Session** — a single global dropdown sourced from every session across
  every project (not filtered by whatever project is currently selected).
  Selecting a session whose `cwd` doesn't belong to the currently-selected
  project is a legitimate combination that simply yields an empty result —
  not an error, not a disabled/auto-cleared state. (The original draft had
  the board clear the session selection whenever the project filter changed;
  that dependency no longer exists — the two filters are independent and
  both persist across changes to the other.)
- **Time period** — always present, always bound; the client always sends
  an explicit `from`/`to`. Default on first load: today. Day-by-day
  navigation (prev/today/next) mirrors the existing per-project Calendar
  view's UX; a custom date-range mode is also available.

Two further explicit overrides, both in the direction of a smaller diff,
both stated here so the reasoning is on record (unchanged from the original
draft — DEC-2/DEC-3 didn't touch these):

- **Do not refactor `server/routes/projects.js`.** The architect/engineer
  suggested factoring the "project_id → cwds → sessions" query into one
  helper shared by both the old and new routes. I'm overriding that: the old
  route's cwd-resolution already goes through the shared prepared statement
  `stmts.listProjectPaths` (not raw duplicated SQL) — the only literally
  duplicated fragment is a ~6-line `SELECT ... FROM sessions WHERE cwd IN
  (...)` query. Extracting a "shared helper" for that, when the old route
  would deliberately keep calling it *without* the new `sources`/time-window
  behavior (see §5), means the "shared" helper would need a flag to skip its
  own new behavior for one caller — that's worse than two small, honestly
  independent queries. `server/routes/projects.js` gets **zero changes** in
  this plan; its route, tests, and behavior are untouched. If the old route's
  `sources`-filter gap is fixed later (tracked as a separate follow-up, see
  §5), extracting a real shared helper at that time is straightforward and
  this plan doesn't preclude it.
- **No new server-side field for cross-project session labeling.** The
  architect flagged that `FocusReportSessionEntry` carries a raw `cwd` but no
  project id/name, and a cross-project calendar needs one to disambiguate
  concurrent blocks. Rather than adding a server field (which would touch
  `buildSessionFocusReport`'s shape, currently untouched by this whole
  feature), resolve it **client-side**: the new page already fetches
  `api.projects.list()` for the project filter dropdown, and each `Project`
  already carries its mapped `paths[].cwd`. Build a `cwd → project name` map
  from that response and pass it into `FocusCalendarView` as a new, optional,
  additive prop, populated only by the new page. The existing modal doesn't
  pass it, so its rendering is byte-identical to today.

**Time-period control: one implementation, two entry points, following the
same "don't fork the rendering chrome" logic already applied to
`FocusReportBody.tsx`.** `FocusCalendarView.tsx` already owns a working
prev/today/next day-nav bar internally (uncontrolled `selectedDate` state,
used to re-slice an already-fully-fetched report client-side). The board
needs a day-nav control too, but for a different purpose: driving a *server*
fetch (`from`/`to`), not re-slicing client-side data already in hand. Rather
than teaching `FocusCalendarView` to sometimes trigger fetches (blurring its
documented contract as a "no fetch, no project/session awareness" pure
renderer), this plan keeps them as two small, visually-matching but
functionally separate implementations, sharing only the tiny, genuinely
pure day-boundary helpers (`startOfDay`, `DAY_MS`) via one new shared lib
file — not the aggregation math, and not the fetch-triggering responsibility.
This is a deliberate, stated call: `FocusCalendarView`'s day-nav is
client-side re-slicing of data already fetched; the board's day-nav is a
data-window selector that triggers a new fetch. Different responsibilities,
kept as two thin, unmodified-in-spirit implementations rather than one
overloaded component.

Everything else follows the architect's plan as written: new top-level route
(not nested under `/api/projects`, not reusing `/api/focus` — see engineer's
gotcha, confirmed at `server/index.js:102` / `server/routes/plans.js:84-88`,
an unrelated "declared focus" hydrate endpoint), shared chrome extraction,
"all projects" as the unfiltered default, existing modal untouched.

## 3. Change set

### Backend

| # | File | Change |
|---|---|---|
| B1 | `server/routes/focus-report.js` (**new**) | `GET /` handler. Resolves the session set from `?project_id=`/`?session_id=`/`?sources=` (same three branches as before), and **requires `?from=`/`?to=`** — ISO-8601 instant strings bounding the query (matching the existing lexically-sortable `started_at`/`ended_at` column format already used by `ORDER BY started_at ASC` in `projects.js:230`). Selects sessions whose activity window overlaps `[from, to)`: `started_at < ? AND (ended_at IS NULL OR ended_at >= ?)`, params `(to, from)`. **No env knob, no server-side default window** — if either `from` or `to` is missing or fails to parse as a valid instant, respond with a structured 400 (`{error:{code:"BAD_REQUEST", message}}`, per `.claude/rules/backend-node.md`), since the client (the only caller) always supplies both per DEC-3. Calls the unmodified `buildProjectFocusReport(dbModule, sessions)`, returns `{ project_id, session_id, ...report }` (both echoed back as the resolved filter, `null` when unfiltered/not applicable — never repurposing `project_id` to mean something it didn't mean on the old route; `from`/`to` are not echoed back — the caller already knows what it asked for). |
| B2 | `server/index.js` | Add `const focusReportRouter = require("./routes/focus-report");` near line 68, and `app.use("/api/focus-report", focusReportRouter);` near line 100-102, with a one-line comment distinguishing it from the pre-existing, unrelated `/api/focus` mount on the next line. |
| B3 | `server/lib/focus-report.js` | **No changes.** `buildFocusSegments` / `buildSessionFocusReport` / `buildProjectFocusReport` are consumed as-is. |
| B4 | `client/src/lib/types.ts` | Widen `FocusReport.project_id` from `string` to `string | null`; add `session_id: string | null`. Additive/widening only — verified no client code currently reads `report.project_id` (grep confirmed zero matches), so this is a zero-risk type change. |
| B5 | `docs/API.md` | New section for `GET /api/focus-report` (query params — `project_id`, `session_id`, `sources`, and the now-required `from`/`to` instant bounds; response shape — point back to the existing `GET /api/projects/:id/focus-report` section for the shared fields, document only what's new). Explicitly document that `from`/`to` have no server-side default and a request missing either is a 400, not an implicit "all time" query. |
| B6 | `server/__tests__/focus-report-route.test.js` (**new**) | Route-level tests — see §6. |

### Frontend — shared chrome extraction (do first, mandatory)

| # | File | Change |
|---|---|---|
| F1 | `client/src/components/FocusReportBody.tsx` (**new**) | Move, verbatim except as noted, out of `FocusReportModal.tsx`: `ReportBody` (renamed `FocusReportBody`, exported), `ListView`, `StatTile`, `SegmentedBar`, `kindTotalsAsSegments`, `ALL_KINDS`, the `ViewMode` type (exported). Also extract the List/Calendar toggle button markup (currently inline in `FocusReportModal.tsx` lines ~113-147) into a new exported `FocusReportViewToggle({ viewMode, onChange }: { viewMode: ViewMode; onChange: (v: ViewMode) => void })`. Add one new optional prop to `FocusReportBody`: `projectLabelForCwd?: (cwd: string | null) => string | undefined`, threaded straight through to `FocusCalendarView` (F2) when `viewMode === "calendar"`. File header required (new file). |
| F2 | `client/src/components/FocusCalendarView.tsx` | Additive-only, two new optional props (both unused by the existing modal, so its rendering is unchanged): (1) `projectLabelForCwd?: (cwd: string | null) => string | undefined` — when provided and it returns a value for a block's `session.cwd`, render it as a small label in the block's hover popup / caption, disambiguating concurrent same-named sessions from different projects; (2) `selectedDate?: Date` + `hideDateNav?: boolean` — when `selectedDate` is supplied, use it instead of the internal `useState` for the day being rendered (controlled mode); when `hideDateNav` is true, skip rendering the internal prev/today/next button row entirely (the board renders its own, see F5b). Both new props default to their current, uncontrolled, nav-visible behavior when omitted — the modal passes neither, so it is pixel-identical to today. No other change to this file — lane assignment, idle striping, hover popup mechanics, `SegmentEventsModal` all untouched. |
| F3 | `client/src/components/FocusReportModal.tsx` | Remove the moved definitions (F1). Import `{ FocusReportBody, FocusReportViewToggle }` and the `ViewMode` type from `./FocusReportBody`. Replace the inline toggle JSX (header, ~lines 113-147) with `<FocusReportViewToggle viewMode={viewMode} onChange={setViewMode} />` under the same guard condition it already has. Replace `<ReportBody report={report} viewMode={viewMode} />` with `<FocusReportBody report={report} viewMode={viewMode} />` (no `projectLabelForCwd`/`selectedDate`/`hideDateNav` passed — single-project modal context needs none of them). `viewMode` state itself stays owned by `FocusReportModal`, unchanged. Net effect: identical rendered DOM, verified by the existing (unmodified) `FocusReportModal.test.tsx` suite passing with no edits. |

### Frontend — shared day-window helper (new, small)

| # | File | Change |
|---|---|---|
| F5a | `client/src/lib/calendarWindow.ts` (**new**) | Extract the currently module-private `DAY_MS` constant and `startOfDay(d: Date): Date` function out of `FocusCalendarView.tsx` into this new shared file; export both. `FocusCalendarView.tsx` imports them from here instead of defining them locally (a pure relocation, zero behavior change). The new `TimePeriodPicker` (F5b) and `FocusCalendarBoard` (F5) import the same two helpers so "what counts as one day" is computed identically in both the modal's internal nav and the board's page-level nav — never two slightly-different day-boundary implementations. |

### Frontend — new time-period control (new)

| # | File | Change |
|---|---|---|
| F5b | `client/src/components/TimePeriodPicker.tsx` (**new**) | Page-level filter control, visually mirroring `FocusCalendarView`'s existing prev/today/next button row (reusing its `report.calendar.prevDay`/`report.calendar.today`/`report.calendar.nextDay` i18n keys — no new keys needed for day mode) plus a new "custom range" toggle exposing two `<input type="date">` fields (new i18n keys, see F12). Props: `value: { mode: "day"; date: Date } | { mode: "range"; start: Date; end: Date }`, `onChange: (next: typeof value) => void`. Pure/controlled — no fetching, no knowledge of `FocusReport`, mirroring `FocusCalendarView`'s own "no fetch" contract. Uses `calendarWindow.ts` (F5a) for day-boundary math. File header required (new file). |

### Frontend — new endpoint client + new page

| # | File | Change |
|---|---|---|
| F4 | `client/src/lib/api.ts` | Add a new top-level method, `api.focusReport({ projectId, sessionId, from, to }: { projectId?: string; sessionId?: string; from: string; to: string }) => request<FocusReport>(...)` — `from`/`to` are **required** parameters (not optional), always ISO-8601 instant strings computed by the caller, sent as `?from=&?to=`. Builds the rest of the query string from whichever of `projectId`/`sessionId` are supplied and calls `applyScope(qs)` exactly like `sessions.list` does (line ~648) so the global Data Scope selector's `?sources=` is picked up automatically. Doc-comment mirrors the existing `api.projects.focusReport` style (line ~1950-1959), and explicitly notes `from`/`to` have no default — the caller must always compute and pass them. |
| F5 | `client/src/pages/FocusCalendarBoard.tsx` (**new**) | Page component. On mount: `api.projects.list()` for the project filter + `cwd → project name` map; **`api.sessions.list({ limit: 10000 })` (no `cwd` filter) once, for a genuinely global session dropdown**, following the same "fetch effectively all, once" pattern this codebase already uses for large flat lists (`Projects.tsx:125`, `KanbanBoard.tsx:299`, `ActivityFeed.tsx:211/232`) — no new server endpoint needed, and no re-fetch when the project filter changes, since the session list is independent of it. State: `projectId?: string`, `sessionId?: string` (independent, neither clears the other), and `timeWindow: { mode: "day"; date: Date } | { mode: "range"; start: Date; end: Date }` (default `{ mode: "day", date: startOfDay(new Date()) }` from F5a — "today" on first load, per DEC-3). Derives `from`/`to` instants from `timeWindow` (day mode: `[startOfDay(date), startOfDay(date) + DAY_MS)`; range mode: `[startOfDay(start), startOfDay(end) + DAY_MS)`) and fetches the report via `api.focusReport({ projectId, sessionId, from, to })` (F4) on mount and whenever any of the three filters change. Page chrome, top to bottom: header with title (`plan:report.board.title`, "Focus Calendar" — distinct from the shorter sidebar nav label "Calendar", see F6/F8-11), project select, session select (never disabled/hidden — always the full global list, per DEC-2), `<TimePeriodPicker value={timeWindow} onChange={setTimeWindow} />` (F5b), then `<FocusReportViewToggle>` + `<FocusReportBody report={report} viewMode={viewMode} projectLabelForCwd={cwdToProjectName} />`. When `viewMode === "calendar"`, `FocusReportBody` passes `selectedDate={timeWindow.mode === "day" ? timeWindow.date : timeWindow.start}` and `hideDateNav={true}` down into `FocusCalendarView` (via F1's threading) so there is exactly one day-nav control on the page — the board's own — not two stacked ones. Loading/error/empty states mirror the modal's (`plan:report.loading` / `report.error` / `report.empty` — reused, no new keys needed for those three). A project+session combination that yields zero matching sessions is rendered as the existing empty state, not an error (per §2's independent-filters note). |

### Frontend — nav / routing / i18n

| # | File | Change |
|---|---|---|
| F6 | `client/src/components/Sidebar.tsx` | Add `CalendarDays` to the `lucide-react` import list (line ~61-86). Add one `NAV_KEYS` entry: `{ to: "/focus-calendar", icon: CalendarDays, key: "nav:focusCalendar" }`, positioned **immediately after `projects` and before `agentBoard` (Kanban Board)** — per DEC-5's final decision (label "Calendar", position right after "Projects"). **Correction from the original draft**, which had incorrectly placed this after Kanban Board — fixed here to match Sara's actual answer. |
| F7 | `client/src/App.tsx` | Import `FocusCalendarBoard` (near line 73-84) and add `<Route path="focus-calendar" element={<FocusCalendarBoard />} />` (near line 109-119), placed right after the `projects` route to mirror the corrected sidebar order (F6). |
| F8 | `client/src/i18n/locales/en/nav.json` | Add `"focusCalendar": "Calendar"` — **short label**, per DEC-5 (not "Focus Calendar"; that fuller name is used only for the in-page heading, `plan:report.board.title`, F12). |
| F9 | `client/src/i18n/locales/zh/nav.json` | Add `"focusCalendar": "日历"` (calendar — matches existing "日历" usage in `plan.json`'s `viewCalendar`; no "焦点"/focus prefix, per the short-label decision). |
| F10 | `client/src/i18n/locales/vi/nav.json` | Add `"focusCalendar": "Lịch"` (calendar — matches existing "Lịch" in `plan.json`'s `viewCalendar`; no "trọng tâm"/focus prefix). |
| F11 | `client/src/i18n/locales/ko/nav.json` | Add `"focusCalendar": "달력"` (calendar — no "포커스"/focus prefix). |
| F12 | `client/src/i18n/locales/{en,zh,vi,ko}/plan.json` | Add a `report.board` object with `title`, `projectFilter`, `allProjects`, `sessionFilter`, `allSessions`, `customRange`, `dayView`, `from`, `to`, **and `concurrentSessions`** keys in all four files (the day-nav labels `prevDay`/`today`/`nextDay` are **reused** from the existing `report.calendar.*` keys, not duplicated — F5b imports them, no new key needed there). Concrete strings: EN `Focus Calendar` / `Project` / `All projects` / `Session` / `All sessions` / `Custom range` / `Single day` / `From` / `To` / `Concurrent agent sessions`; ZH `焦点日历` / `项目` / `所有项目` / `会话` / `所有会话` / `自定义范围` / `单日` / `起始` / `结束` / `并发代理会话`; VI `Lịch trọng tâm` / `Dự án` / `Tất cả dự án` / `Phiên` / `Tất cả phiên` / `Khoảng tùy chỉnh` / `Một ngày` / `Từ` / `Đến` / `Phiên tác tử đồng thời`; KO `포커스 달력` / `프로젝트` / `모든 프로젝트` / `세션` / `모든 세션` / `사용자 지정 범위` / `하루` / `시작` / `종료` / `동시 에이전트 세션` (terms chosen to match each locale's existing `nav.json`/`plan.json` vocabulary, not invented fresh). Note: `report.board.title` intentionally keeps the fuller "Focus Calendar" wording even though the sidebar label (F8-F11) is the shorter "Calendar" — two different strings, two different purposes, not a sync gap. **`report.board.concurrentSessions` is DEC-6's relabeled `concurrency_ratio` copy on the aggregate/board view — added here per the QA team's finding that the original draft named this relabel in prose (§8/DEC-6) but never gave it an actual key, which would have forced a hardcoded, non-localized string at build time.** `FocusReportBody.tsx` (F1) takes the label as a prop so the modal keeps its existing per-project copy unchanged and only the board passes `report.board.concurrentSessions`. |

### Tests (see §6 for the full rationale; listed here for the change set)

| # | File | Change |
|---|---|---|
| T1 | `server/__tests__/focus-report-route.test.js` (new) | Route tests for B1 — see §6 for the updated (from/to-based) list. |
| T2 | `client/src/components/__tests__/FocusReportModal.test.tsx` | **Extend, don't duplicate**: add one new `it(...)` immediately after the existing line-518 standing-template test. |
| T3 | `client/src/pages/__tests__/FocusCalendarBoard.test.tsx` (new) | Filter/edge-case acceptance tests for F5, including the new time-period control and independent project/session combination — see §6. |
| T4 | `client/src/pages/__tests__/screens.snapshot.test.tsx` | 13th snapshot case + new `api.focusReport`/`api.projects.list`/`api.sessions.list` mock fixtures. |
| T5 | `client/src/components/__tests__/Sidebar.test.tsx` | New nav link + href assertions, label "Calendar", positioned right after "Projects". |
| T6 | `client/src/i18n/__tests__/i18n.test.ts` | New registry-driven (`LOCALES` array, already defined at line 15) completeness check for `nav:focusCalendar` across all four locales — closes the gap the PM explicitly flagged (no existing test catches a locale miss for a new nav key). |
| T7 | `client/src/components/__tests__/TimePeriodPicker.test.tsx` (new) | Unit tests for F5b — day-mode prev/today/next emits the correct `onChange` value; switching to range mode and picking two dates emits a `{mode:"range",...}` value; today-button always returns to `startOfDay(new Date())` regardless of current state. |

Every new/edited file in the tables above must carry the mandatory
`@author Son Nguyen <hoangson091104@gmail.com>` header
(`.claude/skills/file-headers/`); verify with
`bash .claude/skills/file-headers/scripts/check-headers.sh`.

## 4. Implementation steps (sequenced)

1. **Shared chrome + day-window extraction first** (F1, F2, F3, F5a) — this
   has no dependency on the backend work and de-risks everything downstream:
   it proves the modal is unregressed *before* a second consumer exists. Run
   `cd client && npx vitest run src/components/__tests__/FocusReportModal.test.tsx src/components/__tests__/FocusCalendarView.test.tsx` and confirm zero behavior change (existing assertions pass unmodified).
2. **Backend route** (B1, B2, B4) — new `server/routes/focus-report.js`,
   mounted, response-shape type widened, `from`/`to` required with 400 on
   missing/malformed input (no env-knob default). Add tests (T1, B6) in the
   same step, per CLAUDE.md's testing policy. Run
   `node --test server/__tests__/focus-report-route.test.js server/__tests__/projects.test.js server/__tests__/focus-report.test.js`.
3. **API client method** (F4) — depends on step 2 existing server-side;
   `from`/`to` are required parameters on this method, not optional.
4. **Time-period picker component** (F5b) — depends only on step 1 (F5a's
   shared `startOfDay`/`DAY_MS`), independent of steps 2-3; add its tests
   (T7) in the same step.
5. **Nav/route wiring** (F6, F7, F8-F11) — independent of steps 2-4; can be
   done in parallel with them, pointing at a stub/loading page initially if
   sequencing works out that way. Do all four `nav.json` files **in the same
   commit**, checklist-style, using the corrected label/position (right after
   Projects, labeled "Calendar"):
   - [ ] `en/nav.json` — `focusCalendar: "Calendar"` added
   - [ ] `zh/nav.json` — `focusCalendar: "日历"` added
   - [ ] `vi/nav.json` — `focusCalendar: "Lịch"` added
   - [ ] `ko/nav.json` — `focusCalendar: "달력"` added
   - [ ] `client/src/i18n/__tests__/i18n.test.ts` new completeness test (T6) added and passing for all four
6. **`plan.json` `report.board.*` keys**, all four locales (F12) — needed
   before step 7 renders real page chrome text (including the new
   custom-range/day-view/from/to labels).
7. **New page component** (F5) — depends on steps 2, 3, 4, 5, 6 all being
   real (not stubs). Reuses `FocusReportBody`/`FocusReportViewToggle`/
   `FocusCalendarView`/`TimePeriodPicker` from steps 1 and 4 unmodified
   except for the additive props, defaults `timeWindow` to today.
8. **Docs** (B5, plus any `README`/`ARCHITECTURE.md` claims about the
   focus-report surface) — same change-set as steps 2 and 7, not a follow-up,
   per CLAUDE.md. Document the `from`/`to`-required, no-default behavior
   explicitly.
9. **Remaining tests** (T2 cross-entry extension, T3 filter/edge cases, T4
   snapshot, T5 Sidebar) — land alongside the page component (step 7), not
   after.
10. **Full verification pass** (§6) — `npm run test:server`, then
    `npm run test:client`; review any `screens.snapshot.test.tsx` diff by eye
    (expect a diff only for the new page's own case; `Projects`/`KanbanBoard`
    snapshots must be byte-identical, proving the existing modal entry point
    wasn't touched) before regenerating baselines with
    `cd client && npx vitest run -u`.

## 5. Single-source-of-truth guardrails

This project has no `PROJECT-CONTEXT.md`/defect-class catalog (confirmed by
all four evaluators), so there's no formal registry to route through by
name — but there are live, working conventions this change must extend
rather than fork, both explicitly named by the architect/engineer, plus one
new one this revision adds explicitly:

- **Report math**: `server/lib/focus-report.js`'s `buildProjectFocusReport`/
  `buildSessionFocusReport` are the only place segment-replay/idle-grace/
  rollup math is computed. This plan adds **zero** new copies of that math —
  the new route is a thin session-selection layer in front of the same,
  unmodified functions. Never hand-implement `mergeIntervals`/per-kind totals
  a second time client-side.
- **Cross-machine source scoping**: `server/lib/source-filter.js`
  (`parseSources`, `sourceColumnClause`) is this project's one
  cross-cutting-filter convention, already used by `analytics.js`/
  `agents.js`/`events.js`. The new `GET /api/focus-report` route applies it
  from day one on its session query. **Explicitly not fixed as part of this
  plan**: the *existing* `GET /api/projects/:id/focus-report` route silently
  ignores `?sources=` today (confirmed by the architect) — that is a
  separate, pre-existing gap, left alone here per CLAUDE.md's "preserve
  existing behavior unless explicitly requested." File it as a follow-up if
  Sara wants it fixed; do not bundle it into this feature's diff.
- **Rendering chrome** (the guardrail this whole request exists to get
  right, per the PM's recurrence diagnosis): `FocusReportBody.tsx` (F1) is
  the one implementation of "how a `FocusReport` renders" (stat tiles,
  List/Calendar toggle, list body). Both `FocusReportModal` and the new
  `FocusCalendarBoard` page consume it; **do not let the new page re-derive
  or copy any of that JSX**. This is the same durable pattern this project
  used hours ago for `idleStripes.ts` and the List/Calendar standing-template
  test (`6e29722`), applied here prospectively rather than reactively.
- **Day-boundary math** (new, this revision): `startOfDay`/`DAY_MS` move to
  one shared file, `client/src/lib/calendarWindow.ts` (F5a), imported by
  both `FocusCalendarView.tsx`'s internal nav and the new
  `TimePeriodPicker.tsx`/`FocusCalendarBoard.tsx`. Never define a second,
  slightly-different "what is a day" calculation client-side.
- **Time-period bound — client-supplied, not server-defaulted (revised per
  DEC-2/DEC-3, replacing the original draft's env-knob mechanism).** The
  original draft proposed a server-side `DASHBOARD_FOCUS_BOARD_WINDOW_DAYS`
  env knob defaulting to 30 days, applied only when the request was
  otherwise unfiltered. **Sara rejected this**: the board now always has an
  explicit, user-visible time-period selector (day nav + custom range,
  defaulting to "today"), so the client always computes and sends `from`/`to`
  — there is no "unfiltered" case left to default for. The new route
  requires both params and 400s if either is missing; there is no env knob,
  no default-window fallback, and no code path that silently applies an
  unbounded or hidden-default query. This is a simpler, more honest
  convention than a server-side default would have been, and it's the one
  going forward for this endpoint — do not reintroduce a hidden default if
  extending this route later.
- **`concurrency_ratio`/`wall_clock_ms` on the aggregate view**: shipped
  computed exactly as `buildProjectFocusReport` already returns them (zero
  code branch needed — the function is generic over whatever `sessions`
  array it's given). Per DEC-6, ship with relabeled copy (e.g. "Concurrent
  agent sessions" in place of whatever per-project label implies
  single-project multitasking) on the aggregate/board view specifically —
  this is now a committed decision, not a flagged maybe. Thread the relabel
  through `FocusReportBody`'s stat-tile row via the same
  `projectLabelForCwd`-style additive prop pattern (e.g. a boolean or label
  override prop indicating "this report may span multiple projects"), scoped
  so the existing single-project modal's copy is unaffected.

## 6. Testing & verification

Stack (per QA, confirmed against `CLAUDE.md`): server = `node --test` via
`npm run test:server`; client = Vitest via `npm run test:client`.

**New/updated tests:**

- **T1 — `server/__tests__/focus-report-route.test.js`** (new):
  `?from=&?to=` bounding a single day correctly excludes a session entirely
  outside that window and includes one that overlaps it (started before
  `to` and either still open or ended at/after `from`); **missing `from` or
  missing `to` → structured 400** (`{error:{code,message}}`), not a 500 and
  not a silent unbounded query — this is the direct regression guard for
  dropping the old draft's env-knob default; a malformed (non-parseable)
  `from`/`to` value also → 400; `?project_id=X` (with `from`/`to` spanning
  all of that project's history) produces `sessions`/`items`/`totals`
  **deep-equal** to `GET /api/projects/X/focus-report`'s own output for the
  same fixture (the concrete "two entry paths must not silently diverge"
  regression guard, per QA); `?session_id=` returns exactly that session and
  no others; unknown `project_id`/`session_id` → structured 404, not a 500
  or a silently-empty 200; a project with zero mapped folders and a session
  with zero focus data both produce the existing well-shaped-empty-totals
  response (extend, don't duplicate, the existing "empty-but-well-shaped"
  assertions in `projects.test.js`); `?sources=` narrows the result set
  (seed two sessions with different `sessions.source` values, confirm
  filtering), proving B1 actually applies `source-filter.js` unlike the old
  route.
- **T2 — extend `FocusReportModal.test.tsx`, don't duplicate it**: add one
  new `it(...)` directly after the line-518 standing-template test (same
  file, same fixture-building helpers already in scope — `makeReport()`,
  fixed `NOW`). It mounts `FocusReportBody` twice with the same underlying
  report data shaped two ways: once as the modal would receive it (single
  project, no `projectLabelForCwd`, no `selectedDate`/`hideDateNav`), once
  as the board would receive it (same sessions, `projectLabelForCwd`
  supplied resolving `"/repo"` to a project name, plus a fixed
  `selectedDate`/`hideDateNav={true}`) — and asserts both renders produce
  identical block geometry/idle-stripe placement (reusing the file's
  existing `data-testid="idle-stripe"` / `.style.left`/`.style.top`
  comparison technique) and that the board variant renders zero
  prev/today/next buttons (nav suppressed) while the modal variant renders
  its own, with the *only* other permitted difference being the presence of
  the project label. This is the client-side half of the "two entry paths,
  one truth" guarantee; T1's deep-equal check is the server-side half. Per
  the standing-template's own comment convention, do not weaken or delete
  this test in any future refactor — extend it further instead.
- **T3 — `client/src/pages/__tests__/FocusCalendarBoard.test.tsx`** (new):
  (a) default state on mount is "today," all projects, no session selected,
  renders without error; (b) selecting a project with zero sessions shows
  the existing `plan:report.calendar.empty` string, not a crash; (c)
  selecting a session with no focus history in the current window shows the
  same empty-day treatment; (d) selecting a project does **not** clear an
  already-selected session, and vice versa — the concrete regression guard
  for DEC-2's "independent filters" requirement (replacing the original
  draft's "clears the session on project change" test, which no longer
  applies); (e) a project/session combination with no overlapping sessions
  renders the existing empty state, not an error; (f) using prev/today/next
  on the board's `TimePeriodPicker` re-fetches with the correct new
  `from`/`to` and does not reset the project/session filters; (g) switching
  to custom-range mode and picking a start/end re-fetches with `from`/`to`
  spanning the full selected range; (h) changing a project/session filter
  does not reset the currently-selected time period.
- **T4 — `screens.snapshot.test.tsx`**: add the 13th case following the
  existing per-page pattern; mock `api.focusReport` (empty-state fixture,
  today's `from`/`to`) and reuse/extend the existing
  `api.projects.list`/`api.sessions.list` mocks already present for
  `Projects`/`KanbanBoard`/`Sessions` (note: `api.sessions.list` is now
  called with `{ limit: 10000 }` and no `cwd`, matching the mock shape
  already used elsewhere in this file for the same pattern). Confirm the
  `Projects` and `KanbanBoard` snapshots are byte-identical to their
  pre-change baseline (proves the modal entry points weren't touched).
- **T5 — `Sidebar.test.tsx`**: add the new label ("Calendar") to `"should
  render all navigation links"` and its href to `"should have correct
  navigation hrefs"`, asserting position right after "Projects" and before
  "Kanban Board" — following the exact existing per-entry pattern.
- **T6 — `i18n.test.ts`**: new `describe` block, driven by the existing
  `LOCALES` array (line 15), asserting `i18n.t("nav:focusCalendar")` resolves
  to a non-empty, non-key-echoing, non-"Focus Calendar" (i.e., the *short*
  label) string in all four locales — mirrors the file's own
  `report.wallClockLabel` registry-driven pattern used for the morning's
  key-relocation guard.
- **T7 — `TimePeriodPicker.test.tsx`** (new): prev/today/next in day mode
  emit the expected `{mode:"day", date}` values (today always resolves to
  `startOfDay(new Date())` regardless of the current selected date);
  toggling to range mode and setting both date inputs emits
  `{mode:"range", start, end}`; toggling back to day mode from range mode
  defaults back to today (not the last-viewed day in range mode), matching
  DEC-3's "today" default framing.

**Regression suites that must still pass, unmodified:**
`server/__tests__/focus-report.test.js`, `server/__tests__/projects.test.js`
(zero changes expected — proves B1 didn't touch B3/the old route),
`client/src/components/__tests__/FocusCalendarView.test.tsx`,
`client/src/lib/__tests__/calendarLanes.test.ts`.

**Run order before calling this done:**
`npm run test:server` → `npm run test:client` → review any
`screens.snapshot.test.tsx` diff (expect exactly one new case; everything
else byte-identical) → `bash .claude/skills/file-headers/scripts/check-headers.sh`.

**Manual verification** (QA §1, unchanged in spirit, updated for the new
filter shape): open the existing modal for a project with real history, note
a specific day's calendar; navigate to `/focus-calendar`, filter to the same
project and, independently, the same session (confirm both can be set
without either clearing the other), navigate to the same day via
prev/today/next, confirm pixel/data parity with the modal; try a custom
range spanning several days and confirm the fetched data covers the whole
range while the day-nav still pages one day at a time within it; clear
filters and confirm the union view (all projects, all sessions, today)
renders without error; confirm the modal's two existing trigger points are
unchanged.

## 7. Risks & rollback

- **Risk: the toggle/body/day-window extraction (F1-F3, F5a) introduces a
  subtle rendering diff in the modal.** Mitigation: step 1 explicitly runs
  the existing, *unmodified* `FocusReportModal.test.tsx`/
  `FocusCalendarView.test.tsx` suites right after the extraction, before any
  new code depends on it — a failure here is caught immediately and is
  trivially revertable (single commit, no downstream dependents yet).
- **Risk: a user-selected custom range is very large** (e.g., "all time"
  picked by hand), which has the same underlying performance shape the
  original draft's env-knob was meant to bound, just moved from a hidden
  server default to an explicit user choice. Mitigation: this is now the
  user's own explicit, visible choice (not a silent unbounded default), so
  it's a materially different (and smaller) risk than the original
  all-projects-unbounded case; no server-side hard cap is added in v1 —
  flagged as a candidate follow-up (e.g., a soft warning above some
  day-count threshold) if real usage shows it's needed, same open thread
  already tracked in `project_holistic-focus-history.md`.
- **Risk: nav-key locale miss** (the single most likely partial-ship
  mistake per engineer/PM), compounded here by also needing the *corrected*
  label text ("Calendar", not "Focus Calendar") in all four files, not just
  `en`. Mitigation: T6's registry-driven completeness test makes a missing
  key a CI failure; manual double-check of the label text itself against
  `decisions.md` DEC-5 before merge, since a completeness test only catches
  "missing," not "wrong."
- **Risk: response-shape drift** between the old and new endpoints for the
  same project, now with an added `from`/`to` dimension. Mitigation: T1's
  deep-equal assertion (using a `from`/`to` window wide enough to cover the
  fixture's full history) is the concrete regression guard; it fails loudly
  if `?project_id=` ever stops matching the old route's output.
- **Risk: double day-nav UI on the board page** if `hideDateNav` is ever
  forgotten when wiring `FocusCalendarView` into `FocusReportBody`/the board
  (F1/F5's threading). Mitigation: T2's extended test explicitly asserts
  zero prev/today/next buttons render in the board-shaped case.
- **Rollback**: every change is additive (new route, new files, new nav
  entry, new optional props) except the F1-F3/F5a extractions inside
  `FocusReportModal.tsx`/`FocusCalendarView.tsx`, which are pure moves with
  no behavior change. If something regresses post-ship, reverting the single
  commit that adds the nav entry + route (F6, F7) immediately hides the new
  surface from users with zero impact on the existing modal or any other
  page — no data migration, no schema change, nothing to undo server-side
  beyond un-mounting one router line.

## 8. Decisions (resolved — see `decisions.md` for full detail)

All items below were open at the original draft and have since been decided
by Sara (`decisions.md`, DEC-1 through DEC-6). Kept here as a compact
cross-reference, not as a pending-approval list:

1. **Nav label/position (DEC-5): "Calendar" at `/focus-calendar`, positioned
   right after "Projects."** The original draft here incorrectly said
   "Focus Calendar," positioned after Kanban Board — corrected in F6/F7/§3
   above; do not build the original draft's placement.
2. **Filter shape (DEC-2, DEC-1, DEC-4): standalone page; project filter
   optional/default-all; session filter is a global list independent of the
   project filter (not scoped to it, as the original draft proposed); a
   third, independent time-period filter exists alongside them; existing
   modal left untouched.** All four evaluators' original convergence on
   "standalone page" and "leave the modal untouched" held; the "session
   scoped to project" piece did not and is corrected throughout §2/§3/§6
   above.
3. **Time-period default (DEC-3): "today," with day nav (prev/today/next)
   plus a custom date-range picker, and the client always supplies
   `from`/`to`.** This supersedes the original draft's proposed server-side
   `DASHBOARD_FOCUS_BOARD_WINDOW_DAYS` 30-day default entirely — that
   mechanism is dropped, not merely deprioritized (see §5's guardrail
   bullet and B1).
4. **`concurrency_ratio`/`wall_clock_ms` copy (DEC-6): keep the stat,
   relabel it on the aggregate/board view** (e.g. "Concurrent agent
   sessions") so it reads correctly as cross-project overlap rather than
   per-project multitasking — now a committed part of this build, not a
   flagged maybe (see §5's last bullet).

## 9. Definition of Done

- [ ] `GET /api/focus-report` exists, mounted independently of `/api/focus`
      and `/api/projects`, applies `source-filter.js`, **requires `from`/`to`
      and 400s if either is missing or malformed (no env knob, no
      server-side default window)**, and calls `buildProjectFocusReport`
      unmodified.
- [ ] `server/routes/projects.js` and its existing route/tests are
      byte-unmodified.
- [ ] `FocusReportBody.tsx` exists and is the single implementation of the
      stat-tile/List-Calendar chrome; `FocusReportModal.tsx` and
      `FocusCalendarBoard.tsx` both consume it; neither copy-pastes its JSX.
- [ ] `FocusCalendarView.tsx`'s only changes are the additive
      `projectLabelForCwd`/`selectedDate`/`hideDateNav` props; existing modal
      usage (all three omitted) is pixel-identical to before.
- [ ] `client/src/lib/calendarWindow.ts` exists; `FocusCalendarView.tsx`,
      `TimePeriodPicker.tsx`, and `FocusCalendarBoard.tsx` all import
      `startOfDay`/`DAY_MS` from it rather than defining their own copies.
- [ ] The board's project, session, and time-period filters are genuinely
      independent: changing one never resets another; the session dropdown
      is the full global list at all times, never scoped to the selected
      project.
- [ ] The board defaults to "today," all projects, no session selected, on
      first load, with no query missing `from`/`to`.
- [ ] New sidebar nav entry labeled **"Calendar"** (not "Focus Calendar"),
      positioned **right after "Projects"** (not after Kanban Board) + new
      route; all four `nav.json` files and all four `plan.json` files
      updated in the same change-set (checklist in §4 satisfied).
- [ ] T1-T7 all added and passing; existing
      `focus-report.test.js`/`projects.test.js`/`FocusCalendarView.test.tsx`/
      `calendarLanes.test.ts` suites pass unmodified.
- [ ] `npm run test:server` and `npm run test:client` both pass clean.
- [ ] `screens.snapshot.test.tsx` shows exactly one new case; `Projects` and
      `KanbanBoard` snapshots are byte-identical to their pre-change baseline.
- [ ] Every new/edited file carries the required authorship header;
      `bash .claude/skills/file-headers/scripts/check-headers.sh` exits 0.
- [ ] `docs/API.md` (and any `README`/`ARCHITECTURE.md` claims about the
      focus-report surface) updated in the same change-set, documenting the
      required (not defaulted) `from`/`to` params.
- [ ] The old `GET /api/projects/:id/focus-report` route's `sources`-filter
      gap is explicitly *not* touched by this change-set (confirmed, not
      accidentally fixed as a side effect).
- [ ] `concurrency_ratio`/`wall_clock_ms` carry the relabeled copy on the
      board/aggregate view per DEC-6, sourced from the actual
      `report.board.concurrentSessions` i18n key (F12) in all four locales —
      not a hardcoded string.
