# Engineer findings: project-wide Focus Calendar Board

Grounding: read the actual current code (not just the source doc's summary) —
`Sidebar.tsx`, `App.tsx`, `nav.json` (all 4 locales), `FocusCalendarView.tsx`,
`FocusReportModal.tsx`, `calendarLanes.ts`, `idleStripes.ts`, `eventBuckets.ts`,
`Projects.tsx`/`KanbanBoard.tsx` trigger points, `server/routes/projects.js`,
`server/lib/focus-report.js`, `server/db.js` schema, `client/src/lib/api.ts`,
`docs/API.md`, and `client/src/pages/__tests__/screens.snapshot.test.tsx`.

## 0. The one fact that changes the cost estimate

`buildProjectFocusReport(dbModule, sessions)` in
`server/lib/focus-report.js:386` **already takes a plain `sessions` array**,
not a project id. It has zero project-specific logic inside it — all project
scoping happens one layer up, in the route handler
(`server/routes/projects.js:218-235`), which resolves `project.id` →
`project_paths.cwd` list → a `SELECT ... WHERE cwd IN (...)` query, then hands
the resulting session rows to `buildProjectFocusReport` unchanged.

This means the "proper" (aggregate endpoint) direction is **not** a
refactor of `focus-report.js` — it's a new route handler that builds a
different `sessions` array (all sessions, or sessions filtered by
`project_id`/`session_id`) and calls the exact same, unmodified
`buildProjectFocusReport`. That's a materially smaller and lower-risk change
than "generalize buildProjectFocusReport" would suggest, and it directly
supports CLAUDE.md's "minimal, reversible diffs" bias.

## 1. Exact change set — both candidate directions

### Shared, direction-independent changes (needed either way)

| File | Change |
|---|---|
| `client/src/components/Sidebar.tsx` | Add one entry to `NAV_KEYS` (line 96-107), e.g. `{ to: "/focus-calendar", icon: CalendarDays, key: "nav:focusCalendar" }`. `CalendarDays` isn't currently imported in this file (it's imported in `FocusReportModal.tsx`) — add to the `lucide-react` import list (line 61-86). |
| `client/src/App.tsx` | Add `<Route path="focus-calendar" element={<FocusCalendarBoard />} />` inside the `Layout` route (alongside line 108-119) + import the new page component (alongside line 73-84). |
| `client/src/i18n/locales/en/nav.json` | Add `"focusCalendar": "Focus Calendar"` (or similar) key. |
| `client/src/i18n/locales/{zh,vi,ko}/nav.json` | **Same key must be added to all three sibling files** — this project keeps 4 flat, hand-synced locale files with no fallback; a missing key renders the raw `nav:focusCalendar` string in that language rather than English. This is exactly the "same key, N sibling files, easy to update one and miss the others" defect shape flagged as the top gotcha in the request brief's own risk callout. |
| `client/src/pages/__tests__/screens.snapshot.test.tsx` | Add a 13th `it(...)` snapshot entry for the new page (import it, register in the `describe` block near line 507-548), following the exact pattern of the other 12 — one test per routed screen. Also needs to be added to the `vi.mock("../../lib/api", ...)` fixture block (lines ~28-490) with a deterministic empty-state mock for whatever new `api.*` call(s) the page makes, or the test will hit real `fetch` and fail/hang. |
| New page component (new file) | e.g. `client/src/pages/FocusCalendarBoard.tsx` — see §1a/1b below for what it fetches. |
| Docs: `docs/API.md`, `README`/`ARCHITECTURE.md` if a new route is added | Per CLAUDE.md, must be updated in the same change-set. `docs/API.md` already documents `GET /api/projects/:id/focus-report` at line ~1207-1216, 1280 — the new/changed surface needs a parallel section. |
| Every new/edited file above | Needs the mandatory `@author Son Nguyen <hoangson091104@gmail.com>` header (`.claude/skills/file-headers/`) — all files touched here already carry it; new files must add it. |

Filter dropdown data — **no new endpoint needed for either direction**:
- Project filter: `api.projects.list()` (`client/src/lib/api.ts:1900`) already
  returns `{ projects, unassigned }` — this is what `Projects.tsx` and
  `KanbanBoard.tsx` already use to render project cards.
- Session filter, scoped to the selected project: `api.sessions.list({ cwd })`
  (`client/src/lib/api.ts:629-654`) already accepts a `cwd` filter (the same
  one `Sessions.tsx`'s working-directory dropdown uses via
  `api.sessions.facets()`, `client/src/lib/api.ts:606`). Since a project is
  really just a set of `cwd`s (via `project_paths`), scoping the session
  dropdown to "sessions in the selected project" means calling
  `api.sessions.list({ cwd })` once per mapped folder, or (cleaner) reusing
  each project's own `paths` array already present in the `Project` object
  returned by `api.projects.list()`.

### 1a. "Quick" direction — client-side merge, zero backend change

| File | Change |
|---|---|
| New page `FocusCalendarBoard.tsx` | On mount, calls `api.projects.list()` to get all projects, then calls `api.projects.focusReport(id)` **once per project** (reusing the existing per-project endpoint verbatim), merges the returned `FocusReport[]` into one `sessions` array structurally compatible with what `FocusCalendarView` expects (`report.sessions`), and recomputes `report.items`/`report.totals`/`wall_clock_ms`/`concurrency_ratio` client-side by literally reimplementing `addToTotals`/`mergeIntervals`'s logic in TypeScript, OR just skip totals for the aggregate view and only render calendar lanes (this needs a product/architect call — the doc's totals section (`FocusReportModal`'s `ReportBody`) is currently coupled to the shape `buildProjectFocusReport` returns). |
| `client/src/lib/api.ts` | No route change; possibly add a thin client-side helper (not a new endpoint) to fan out and merge, e.g. `Promise.all(projects.map(p => api.projects.focusReport(p.id)))`. |
| Filtering by project/session | Done entirely client-side after all reports are fetched (or narrowed to fetch only the selected project's report when a project filter is set, degrading the N+1 problem to a single request in the filtered case). |

Feasibility/effort notes for quick path: reuses `FocusCalendarView` completely
unmodified (it already just takes a `report: FocusReport` prop, so a
client-merged synthetic report satisfies its type as long as the merge
produces the right shape). But it duplicates non-trivial aggregation math
(`mergeIntervals`, per-kind totals) in the client in a second language/runtime
from `server/lib/focus-report.js`, which is precisely a "hand-editing a
derived copy instead of the canonical source" risk — the request brief's own
QA note about "two entry paths potentially with different data-fetching"
applies doubly here since the math itself would live in two places, not just
the fetch path.

N+1 cost: with the project counts implied by this app's own use (project ==
one repo/folder grouping, realistically low tens), N+1 sequential-looking
`Promise.all` calls each running the full segment/gap/chunk replay in
`buildSessionFocusReport` per session server-side is unlikely to be
catastrophic, but it re-runs a full unfiltered focus-time recomputation (no
DB-level filtering, no shared cache) once per project on every page load/
filter change, which is real, measurable added server load and multiplies
with session/event volume per project.

### 1b. "Proper" direction — new aggregate endpoint

| File | Change |
|---|---|
| New route, mounted independently (see next row) | Do **not** nest this under `/api/projects` as a bare `router.get("/focus-report", ...)` sibling of `/:id/focus-report` — confirmed there is currently no bare `GET /:id` on the projects router (only `PATCH /:id`, `DELETE /:id`, `GET /:id/focus-report`, etc.), so a literal `/focus-report` segment wouldn't technically collide today, but it reads inconsistently next to the existing per-project sub-resource pattern (`/:id/focus-report` implies "focus-report is a sub-resource of one project"; an unscoped sibling at the same router looks like a bug). **Also confirmed: don't reuse `/api/focus`** — that path is already mounted (`server/index.js:102`, `app.use("/api/focus", plansRouter.focusRouter)`) for an unrelated bulk "every active session's declared focus" hydrate endpoint (`server/routes/plans.js:84-88`, `focusRouter.get("/", ...)`, backing the session-card focus chip, not the focus-*time* report). The confusingly similar name is a real trap: a dev skimming `server/index.js`'s route list could mistake `/api/focus` for the right place to extend. Cleanest option: a genuinely new top-level route, `GET /api/focus-report` (distinct from both `/api/focus` and `/api/projects/:id/focus-report`), in its own file. |
| New file, e.g. `server/routes/focus-report.js` (or extend an existing top-level router file — check `server/index.js`/`server/app.js` for where routers are mounted) | Handler: resolve the session set — no filter → all sessions; `project_id` set → same `project_paths` join `projects.js:223-232` already does, just without requiring `:id` in the path; `session_id` set → `WHERE id = ?` single row. Then call the **unmodified** `buildProjectFocusReport(dbModule, sessions)` — no changes needed inside `focus-report.js` itself. |
| `server/index.js` (or wherever routers are mounted — grep `app.use("/api/projects"` to confirm) | Mount the new router. |
| `client/src/lib/api.ts` | Add `api.focusReport(params?: { projectId?: string; sessionId?: string })` calling the new endpoint — mirrors the existing `api.projects.focusReport(id)` doc-comment style at line ~1950-1959. |
| New page `FocusCalendarBoard.tsx` | Single request via the new `api.focusReport(...)`, filters as query params, re-renders on filter change. Reuses `FocusCalendarView` unmodified — same `report: FocusReport` prop shape, real shape this time (no reimplemented aggregation math). |
| `docs/API.md` | New section documenting `GET /api/focus-report` (params, response shape — identical to the existing project-scoped one, so this can literally point back to the existing section for the shared fields and only document the new query params). |
| `server/__tests__/focus-report.test.js` and/or a new `server/__tests__/focus-report-route.test.js` | New route-level tests: no filter → aggregates across all projects; `project_id` → matches `GET /api/projects/:id/focus-report`'s existing output for the same project (a strong "these two entry paths must not silently diverge" regression test the QA-relevant risk section of the brief calls for); `session_id` → single-session report; unknown ids → 404, mirroring the existing `does-not-exist` 404 test at `server/__tests__/projects.test.js:224`. |

Feasibility/effort notes for proper path: since `buildProjectFocusReport`
needs **zero changes**, this is genuinely close to as simple as it looks —
the actual new work is: (1) a session-resolution query with 3 branches
(none/project/session), which is a small, mechanical variant of code that
already exists in `projects.js:223-232`; (2) route mounting; (3) the new
page + nav/route wiring (shared cost either way); (4) tests + docs.

## 2. Variant branches that each need the change

- **Nav/i18n**: 4 locale files (`en`, `zh`, `vi`, `ko`) — every one needs the
  new nav key, not just `en`.
- **Two existing mount points for the shared UI**: `Projects.tsx:601` and
  `KanbanBoard.tsx:968` both currently open `FocusReportModal` per-project.
  Per the brief's assumption #5 (leave as-is), these do **not** need to
  change for this feature, but they are the reference implementation the new
  page must visually/behaviorally match — the same swimlane/idle-stripe/
  hover-popup/`SegmentEventsModal` code path (`FocusCalendarView.tsx`,
  `calendarLanes.ts`, `idleStripes.ts`) is shared either way (both directions
  reuse it unmodified), so there's only one calendar-rendering implementation
  to keep in sync, not two — the risk is confined to whether the **data**
  feeding it (merged-client-side vs. real aggregate) matches, not the
  rendering.
- **Session-filter scoping variant** (global vs. project-scoped): whichever
  the team picks, `api.sessions.list({ cwd })` already supports both — a
  global list is just an unfiltered call; a project-scoped list means calling
  it once per the project's mapped `cwd`s (from `project.paths`, already on
  the `Project` type). No branch here needs new server code either way.
- **Screen snapshot test**: whichever direction, the new page needs a mocked
  `api` fixture. The "quick" direction requires mocking `api.projects.list()`
  **and** `api.projects.focusReport()` (already mocked or mockable per
  existing per-project modal tests); the "proper" direction requires mocking
  the new `api.focusReport()` call instead — one new mock either way, but a
  different one depending on direction, so this isn't decided until the
  architect picks.

## 3. Effort estimate

- **Quick (client-merge) direction: M.** Reuses everything as literally
  zero backend diff, but the client-side reimplementation of
  `mergeIntervals`/per-kind totals (if the new page needs the same stat
  tiles `FocusReportModal` shows) adds real logic + tests that don't exist
  today, plus N+1 fetch orchestration/loading-state handling across projects.
- **Proper (aggregate endpoint) direction: M, same rough size, lower risk.**
  Slightly more files touched (new route file/mount, new API client method,
  route tests, docs) but each piece is small and mechanical since
  `buildProjectFocusReport` needs no changes. No client-side math
  duplication. This is the direction more likely to actually land at the
  "M" estimate rather than creep toward "L" once someone tries to make the
  merged client-side totals actually correct (concurrency ratio across
  projects, per-item rollup dedup, etc.).
- Either direction: nav/route/i18n/page-shell/snapshot-test scaffolding is a
  fixed **S** cost shared by both, since it doesn't depend on the data-path
  choice.
- **L risk factor (either direction)**: if the team also decides to
  consolidate/replace the existing per-project modal entry points (explicitly
  out of scope per the brief's assumption #5, but worth flagging) — that
  would turn this from a net-new page into a refactor of two existing pages'
  trigger points too.

## 4. Dependencies & order

1. **Architect decision first**: quick vs. proper data path. Downstream file
   list differs (§1a vs §1b), so no code should be written before this is
   confirmed — this is the one true blocking dependency.
2. If "proper": add the new server route + mount it, and add
   `api.focusReport(...)` to `client/src/lib/api.ts` **before** the new page
   component is built against it (the page is the consumer, not the other
   way around).
3. Nav entry (`Sidebar.tsx` + `App.tsx` + 4 `nav.json` files) can be done in
   parallel with the data-layer work — it only wires a route to a page
   component, which can be a loading-skeleton stub initially.
4. New page component last, once its data source (whichever direction) is
   real.
5. Snapshot test entry + doc updates land in the same change-set as the page
   (CLAUDE.md requires docs to stay in sync with new routes/nav entries in
   the same change-set, not a follow-up).
6. `npm run test:server` (if proper direction touches the server) then
   `npm run test:client` (both directions touch the client) before calling
   it done, per CLAUDE.md's testing policy. Screen-snapshot diffs must be
   reviewed, not blindly regenerated (`cd client && npx vitest run -u`).

## 5. Gotchas

1. **The 4-locale nav.json sync trap** (see §1, shared changes) — this is
   the single most likely place to ship a half-done change: add the nav
   label to `en/nav.json` and forget `zh`/`vi`/`ko`. No test currently
   catches a missing key across locales for `nav.json` specifically (i18n
   tests under `client/src/i18n/__tests__/` should be checked for a
   "same keys across all locales" completeness test — grep confirmed the
   directory exists; whether such a completeness assertion exists should be
   verified before assuming it will catch a miss).
2. **Naming collision risk with the existing (unrelated) `/api/focus`
   endpoint** — confirmed at `server/index.js:102`
   (`app.use("/api/focus", plansRouter.focusRouter)`) and
   `server/routes/plans.js:84-88`: this already-mounted route is a bulk
   "every active session's *declared* focus" hydrate (backs the session-card
   focus chip), not a focus-*time* report. It is a completely different
   feature that happens to share the word "focus." A dev extending this
   feature should not add query params to the existing `/api/focus` route
   thinking it's the right place, nor nest the new endpoint under
   `/api/projects` where it would read inconsistently next to the existing
   per-project sub-resource pattern — give it its own distinct top-level
   path instead (e.g. `GET /api/focus-report`).
3. **`FocusReportModal.tsx`'s `ReportBody`/`ListView` assumes a
   `FocusReport` whose `items`/`totals`/`wall_clock_ms` came from
   `buildProjectFocusReport`'s real math.** If the new page reuses
   `FocusCalendarView` only (not the stat tiles), this doesn't matter; if it
   also wants the stat-tile row (active time / concurrency / on-item % /
   idle), that row's component isn't currently exported standalone from
   `FocusReportModal.tsx` — it's inlined in `ReportBody` — so reusing it
   would need extracting a shared component, an additional small file split
   not mentioned in the brief's file list.
4. **`live` segment flag depends on `session.ended_at == null`
   (`FocusCalendarView.tsx:210`)** — for a cross-project aggregate, many more
   sessions can be "live" simultaneously (i.e., across projects, not just
   within one). The lane-assignment algorithm (`calendarLanes.ts`) already
   handles arbitrary overlap counts correctly (it's a general interval
   scheduler), but with many projects the calendar's lane count for a busy
   day could now legitimately be much higher than the current per-project
   case ever exercises — worth a quick gut-check on the day-view's visual
   layout at higher concurrency, though no code change is implied.
5. **`idle_grace_seconds`/`concurrency_ratio` are computed once for the
   whole report** (`buildProjectFocusReport` return shape,
   `server/lib/focus-report.js:427-434`) — an "all projects" aggregate
   report is a defensible reading of "wall clock across everything," but the
   number's meaning shifts from "how concurrent is this one project's
   sessions" to "how concurrent is everything, everywhere" — worth the
   architect/product owner explicitly deciding whether that number is even
   shown on the all-projects view, not just assuming it carries over
   unchanged.

## 6. Verification hooks (existing tests that would catch a mistake)

- **Server, focus-report core logic**: `server/__tests__/focus-report.test.js`
  — exercises `buildFocusSegments`/`buildSessionFocusReport`/
  `buildProjectFocusReport`/`mergeIntervals` directly. Since the proper
  direction calls `buildProjectFocusReport` unmodified, this file's existing
  coverage carries over with zero changes needed — a strong argument for the
  proper direction's lower risk.
- **Server, route-level project scoping**:
  `server/__tests__/projects.test.js`, `describe("GET /:id/focus-report")`
  block (line 211 onward) — includes a 404-for-unknown-project test
  (line 224) and a same-shape-response check. A new aggregate route should
  add an equivalent `describe` block in a new or the same test file, and
  ideally a test asserting the aggregate endpoint's `project_id=X` output
  matches `GET /api/projects/X/focus-report`'s output byte-for-byte for the
  same project — this is the concrete regression test for the "two entry
  paths diverge" risk the brief calls out.
- **Client, calendar rendering**:
  `client/src/components/__tests__/FocusCalendarView.test.tsx` — covers the
  swimlane renderer itself; untouched by either direction since
  `FocusCalendarView` isn't modified, so existing coverage still applies
  as-is to the new page's rendering.
- **Client, lane assignment**: `client/src/lib/__tests__/calendarLanes.test.ts`
  — pure function, unaffected by this change, but is the correctness backstop
  for the higher-concurrency aggregate case flagged in Gotcha 4.
- **Client, modal composition**:
  `client/src/components/__tests__/FocusReportModal.test.tsx` — covers the
  existing per-project modal; not touched by this feature (per brief
  assumption #5), and should be re-run as a regression check that the
  existing entry point is genuinely untouched, not just assumed so.
- **Client, per-screen snapshot**:
  `client/src/pages/__tests__/screens.snapshot.test.tsx` — must gain a 13th
  case for the new page (see §1); this is also the test most likely to need
  a **new mock** in its `vi.mock("../../lib/api", ...)` fixture block, since
  neither `api.projects.focusReport` fan-out (quick) nor a new
  `api.focusReport` (proper) has an existing deterministic empty-state fixture
  there today.
- **i18n completeness**: check `client/src/i18n/__tests__/` for any existing
  "all locale files have matching keys" test before assuming a missed
  `nav.json` translation would be caught automatically — if no such test
  exists, this is a manual-review gotcha, not a caught-by-CI one.
