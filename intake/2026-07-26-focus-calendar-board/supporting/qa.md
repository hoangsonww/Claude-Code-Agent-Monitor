# QA / Test Plan: Project-wide Focus Calendar Board

No `PROJECT-CONTEXT.md` exists for this project (confirmed: not present at repo
root), so there is no formal "must-stay-in-sync surface" catalog to check
against. However, the codebase already has a concrete, working precedent for
exactly this class of risk — see "Existing precedent" below — and this plan
leans on it rather than inventing a new pattern.

Test stack (from `CLAUDE.md` + verified against the repo):
- Server: Node's built-in `node:test`, run via `npm run test:server`
  (`node --test server/__tests__/*.test.js`). Single spec:
  `node --test server/__tests__/focus-report.test.js`.
- Client: Vitest, run via `npm run test:client` (`cd client && npm test` →
  `vitest run`). Single spec:
  `cd client && npx vitest run src/components/__tests__/FocusCalendarView.test.tsx`.
- Snapshot regeneration (only after reviewing the diff):
  `cd client && npx vitest run -u`.
- MCP is not touched by this request (no mcp/ surface referenced in the brief).

Baseline check performed as part of writing this plan (2026-07-26): ran the
three most relevant existing suites against the current `master` — all green,
confirming these are a real, currently-passing safety net today, not
aspirational:
- `node --test server/__tests__/focus-report.test.js server/__tests__/projects.test.js` → 47/47 pass.
- `cd client && npx vitest run src/components/__tests__/FocusCalendarView.test.tsx src/components/__tests__/FocusReportModal.test.tsx src/components/__tests__/Sidebar.test.tsx` → 3 files, 42/42 pass.

## Existing precedent: the codebase already has a "two paths, one truth" test

`client/src/components/__tests__/FocusReportModal.test.tsx` already contains
exactly the kind of parity test this request needs, guarding List view vs.
Calendar view inside the existing modal (both read from `server/lib/focus-report.js` via `buildProjectFocusReport`, both render the same
`FocusCalendarView`/list data structures). Its own comment names the pattern
this new work should extend:

> `"[standing template] List and Calendar views render the same wall-clock/agent-time numbers and proportionally equivalent idle-stripe geometry for the same segment — extend THIS test, not a view-local one, for any future FocusReportSegment field either view renders"`
> (`client/src/components/__tests__/FocusReportModal.test.tsx:518`)

The new standalone board reuses `FocusCalendarView` as a second mount point
of the *same component*, so it inherits parity with the modal's Calendar tab
"for free" at the component level — but that guarantee only holds if the
**data passed in** (the `FocusReport` shape from whichever backend path wins)
is itself identical in the two entry paths for the same project/session. That
data-identity gap, not `FocusCalendarView`'s own rendering, is where a
divergence would actually hide. Treat this as the named recurring-risk
surface for this feature going forward (a candidate line item if/when
`PROJECT-CONTEXT.md` is created).

## 1. How we verify done

Manual:
1. Open the existing per-project focus report modal (report icon on a
   project card, `Projects.tsx:601` / `KanbanBoard.tsx:968`) for a project
   with real session history, switch to its Calendar tab, and note the
   rendered blocks/lanes/stripes for a specific day.
2. Navigate to the new sidebar entry / standalone route, select the same
   project (and, if session-filter is scoped-to-project per the brief's
   working assumption, the same session or "all sessions"), navigate to the
   same day, and confirm the rendered calendar is pixel-for-pixel/data-for-
   data identical to step 1 (same blocks, same lane assignment, same idle
   stripes, same hover-popup wall-clock/active numbers).
3. Repeat with "all projects" selected (no project filter) and confirm it
   shows the union of every project's activity for that day, not an error or
   an empty state.
4. Exercise each edge case named in the brief (see section 3) by hand once.
5. Confirm the existing modal entry point still opens and behaves exactly as
   before (unchanged, per CLAUDE.md's "preserve existing behavior").

Automated: the new/updated specs in section 3, plus the full existing suite
(`npm run test:server`, `npm run test:client`) run clean before calling this
done. If a UI diff shows up in `screens.snapshot.test.tsx`, the diff must be
reviewed (new nav entry / new route is an *expected* diff) and baselines
regenerated deliberately, never blindly.

## 2. Regression coverage

Existing specs that already cover this surface, all currently passing (see
Baseline check above):

| File | Covers | Needs update for this feature? |
|---|---|---|
| `server/__tests__/focus-report.test.js` | `buildFocusSegments`, `buildSessionFocusReport`, `buildProjectFocusReport`, `buildActivityChunks`, `mergeIntervals` — the whole segment-replay/idle-grace/rollup engine | Only if the aggregate path changes the shared engine's signature (e.g. a new "all projects" grouping mode) — see section 3 by backend path |
| `server/__tests__/projects.test.js` | `GET /:id/focus-report` route: 404 on unknown project, empty-but-well-shaped totals, project-scoping correctness | Not touched by the quick-merge path (route is unchanged); IS the file a new aggregate-endpoint test would sit beside (or a new sibling file) under the proper path |
| `client/src/components/__tests__/FocusCalendarView.test.tsx` | Swimlane rendering itself: lanes, idle stripes, hover popup, live pulse, inferred dashed border, day nav, SegmentEventsModal drill-down | No changes needed if the component's props (`report: FocusReport`) stay the same shape for both mount points — this is the whole point of reusing the component unmodified |
| `client/src/components/__tests__/FocusReportModal.test.tsx` | Existing per-project modal, including the List/Calendar parity "standing template" test (line 518) | No changes needed — this is the regression guard that the *existing* modal wasn't broken by adding the new page |
| `client/src/components/__tests__/Sidebar.test.tsx` | Nav entry rendering + href assertions (`should render all navigation links`, `should have correct navigation hrefs`) | **Yes** — new nav item and its href need assertions added (see section 3) |
| `client/src/pages/__tests__/screens.snapshot.test.tsx` | One render snapshot per routed page, API layer mocked to deterministic empty state | **Yes** — new page needs a snapshot case added; existing snapshots for `Projects`/`KanbanBoard` should NOT change (their modal entry point is untouched) |

## 3. New / updated tests required

### A. Component-identity / parity test (first-class risk named in the brief)

Add a new spec — `client/src/pages/__tests__/FocusCalendarBoard.crossEntry.test.tsx`
(or wherever the new page component lands) — that is the standalone-page
analog of `FocusReportModal.test.tsx`'s line-518 standing template:

- Fetch (via whichever API call the new page uses) and mount the standalone
  board for one project/session; separately mount `FocusReportModal` (or
  just `FocusCalendarView` directly, fed by each path's own data-fetch) for
  the same project/session/day.
- Assert both render the same set of blocks (same session ids, kinds,
  start/end, `wall_ms`/`active_ms`, `inferred` flags, `chunks`) for that day.
- Assert both compute the same lane assignment (same relative `left`/`top`
  geometry) and the same idle-stripe placement — reuse the existing
  `data-testid="idle-stripe"` hook and the `.style.left`/`.style.top`
  comparison technique already used in `FocusCalendarView.test.tsx` and
  `FocusReportModal.test.tsx`.
- If the tech lead's plan ends up **unifying** the two entry paths under one
  shared data-fetching hook/component (rather than two independent fetches
  landing on the same `FocusCalendarView`), this test still applies as the
  regression guard for that refactor: it should pass unchanged before and
  after the unification, proving the refactor didn't change what either
  entry path renders. Do not delete or weaken this test as part of a
  unification refactor — extend it, per the same "extend THIS test" comment
  convention already established in the modal's own standing-template test.

### B. Filter acceptance tests — edge cases named in the brief

Whatever component/page owns the project/session filter UI needs a spec
(new file, e.g. `client/src/pages/__tests__/FocusCalendarBoard.test.tsx`)
asserting:

1. **No project selected / "all projects"** — the default state (per the
   brief's working assumption) renders the aggregate calendar across every
   project without error; the project filter control shows an explicit "All
   projects" option/state, not an empty/broken dropdown.
2. **Project with zero sessions** — selecting such a project shows the
   existing "no activity" / empty-state treatment (reuse
   `FocusCalendarView`'s own `"No activity on this day"` string, per its
   existing empty-state test) rather than a crash or a raw empty array
   rendering nothing with no explanation.
3. **Session with zero focus data** (a session with events but no declared
   Focus history AND no usable `focus_inferences` verdict — the
   `inferredSegment` "unclassified" / deleted-item paths already covered
   server-side in `server/__tests__/focus-report.test.js`) — selecting it
   shows the same empty-day/no-segments treatment, not an error.
4. **Session filter scoped to selected project** (if that's the direction
   confirmed with Sara per the brief's open question) — changing the
   project filter clears/resets an incompatible session selection rather
   than silently querying with a mismatched project+session pair.
5. Filters combine correctly with day navigation (Prev/Today/Next still
   works after a filter change; changing a filter doesn't reset the
   currently-selected day).

### C. Sidebar / routing

- `client/src/components/__tests__/Sidebar.test.tsx`: add the new nav
  label to the `"should render all navigation links"` assertion list and its
  href to `"should have correct navigation hrefs"` — following the exact
  pattern already used for `Dashboard`/`Kanban Board`/`Sessions`/`Activity Feed`.
- `client/src/pages/__tests__/screens.snapshot.test.tsx`: add one new
  `it("Focus calendar board", ...)` snapshot case for the new route,
  following the existing per-page pattern (mock the new API call(s) in the
  shared `vi.mock("../../lib/api", ...)` block with a deterministic
  loaded-empty fixture). Confirm existing `Projects`/`KanbanBoard` snapshots
  are byte-identical to before (proves the existing modal entry point wasn't
  touched).

### D. Backend test obligations — by which path wins (architect/engineer call)

Per the brief, engineer and architect are evaluating two directions in
parallel; name the test obligations for both so this plan holds regardless
of outcome.

**If "quick" (client-side merge of N per-project reports) wins:**
- `server/__tests__/projects.test.js` and `server/__tests__/focus-report.test.js`
  need **no changes** — the existing `GET /:id/focus-report` route and
  `buildProjectFocusReport` are reused as-is (this is the whole appeal of
  this path). Net-new test burden shifts entirely to the client:
  - A new client-side merge/filter utility (e.g.
    `client/src/lib/mergeFocusReports.ts` or similar) needs its own unit
    spec in `client/src/lib/__tests__/` covering: merging N project reports
    into one aggregate `FocusReport`-shaped object, correct behavior when
    one of the N per-project fetches fails (partial data vs. whole-page
    error — pick one and pin it), and de-duplication/pass-through of
    `wall_clock_ms`/`concurrency_ratio` math across merged projects (or an
    explicit decision that project-level concurrency figures don't make
    sense aggregated and are omitted/recomputed — either way, pin the
    decision in a test).
  - A regression test asserting N project fetches happen (not 1), documenting
    the accepted N+1 tradeoff so a future "why so many requests" investigation
    finds this test instead of re-litigating the tradeoff.

**If "proper" (new aggregate `GET /api/focus-report` endpoint) wins:**
- New server-side route test, likely appended to `server/__tests__/projects.test.js`
  or a new `server/__tests__/focus-report-api.test.js`, covering:
  - No filters → aggregates every session across every project (parity
    check: sum of per-project totals from the existing per-project route
    should reconcile with the new aggregate route's totals for the same
    data, modulo wall-clock-merge semantics across projects if applicable).
  - `?project_id=` behaves identically to the existing
    `GET /:id/focus-report` for the same project (this is the actual
    regression guarantee for "same data, two routes" — assert the two
    responses' `sessions`/`items`/`totals` are deep-equal for a fixed
    fixture).
  - `?session_id=` returns exactly that session's segments and no others.
  - Unknown `project_id`/`session_id` → structured 404/empty response
    (per `.claude/rules/backend-node.md`: "validate input thoroughly and
    return structured errors"), not a 500 or a silently-empty 200 that masks
    a typo.
  - A project with zero mapped sessions and a session with zero focus
    history both produce the existing well-shaped-empty-totals response
    (extend `buildProjectFocusReport`'s existing "empty-but-well-shaped
    totals" test coverage rather than duplicating it).
  - If `buildProjectFocusReport` itself is generalized (e.g. a new
    `buildAggregateFocusReport` or a parameter added) rather than a thin
    route-level wrapper reusing it unchanged, `server/__tests__/focus-report.test.js`
    needs new `describe` blocks for the generalized function, following the
    file's existing structure (seed sessions across `CWD`/`CWD2`, assert
    totals/rollup/wall-clock math) — do not weaken or remove the existing
    project-scoped assertions, since those pin the still-supported
    single-project route's behavior.
  - Response-shape stability: assert the new endpoint's per-session/
    per-segment field names match `FocusReportSessionEntry`/
    `FocusReportSegment` in `client/src/lib/types.ts` exactly, since
    `FocusCalendarView` and `FocusReportModal` both already type against
    that shape and a drift here is a silent client-side breakage, not a
    server-side test failure.

### E. Docs (not a test, but a DoD gate per CLAUDE.md)

If a new route/response shape/nav entry lands, `docs/API.md`, `README`, and
any `ARCHITECTURE.md` claims about the focus-report surface must be updated
in the same change-set — verify this is done, don't just verify tests pass.

## 4. Test data / fixtures

Reuse the same seeding conventions already established in
`server/__tests__/focus-report.test.js` (helper functions `seedSession`,
`focus`, `activity`, the `t(minutesFromStart)` deterministic-timestamp
helper, two distinct `cwd`s `CWD`/`CWD2` to prove cross-project isolation)
and in `FocusCalendarView.test.tsx`/`FocusReportModal.test.tsx` (`makeReport()`
builder, fixed `NOW` via `vi.setSystemTime`, `todayAt()`/`yesterdayAt()`
helpers). Concretely, drive the new tests with:

- **At least 2 projects**, each with **at least 2 sessions**, so cross-
  project aggregation and per-project scoping are both exercised in the same
  fixture (mirrors the existing `CWD`/`CWD2` split).
- **One project with zero sessions** (edge case B.2) — a project row with no
  mapped `project_paths`, matching the existing
  `"returns well-shaped empty totals for a project with no mapped folders"`
  case in `server/__tests__/projects.test.js`.
- **One session with declared Focus history**, **one session with only an
  inferred verdict**, and **one session with neither** (zero focus data,
  edge case B.3) — the three states `buildSessionFocusReport` already
  distinguishes (declared segments / inferred fallback / empty `segments: []`).
- **Overlapping-time sessions** across two different projects on the same
  day, to prove cross-project lane assignment in the aggregate/"all
  projects" view behaves the same way `FocusCalendarView.test.tsx`'s existing
  "puts overlapping sessions in separate lanes" test already proves within a
  single project.
- A segment with `chunks` (mixed active/idle) to re-exercise the idle-stripe
  parity check across both entry paths.

## 5. Definition of Done checklist

- [ ] New sidebar nav entry added; `Sidebar.test.tsx` updated and passing.
- [ ] New route mounted in `App.tsx`; `screens.snapshot.test.tsx` has a new
      case and its diff has been reviewed (not blindly generated) before
      baselines were committed.
- [ ] Existing `FocusReportModal`/`FocusCalendarView`/`focus-report.test.js`/
      `projects.test.js` suites are unmodified in behavior and still pass —
      proving the existing per-project modal entry point was not regressed.
- [ ] A cross-entry parity test (section 3.A) exists and passes, proving the
      modal's Calendar tab and the new standalone page render identical
      data/geometry for the same project/session/day.
- [ ] Filter edge cases from section 3.B (all-projects default, zero-session
      project, zero-focus-data session, project/session filter interaction)
      each have an explicit assertion, not just "doesn't crash."
- [ ] Backend test obligations for whichever path (quick vs. proper) was
      actually chosen (section 3.D) are fully satisfied, not just the
      other path's.
- [ ] `npm run test:server` and `npm run test:client` both pass clean.
- [ ] Every new/edited source file carries the required authorship header;
      `bash .claude/skills/file-headers/scripts/check-headers.sh` exits 0.
- [ ] `docs/API.md` / `README` / `ARCHITECTURE.md` updated if a new route,
      response shape, or nav entry was added.
