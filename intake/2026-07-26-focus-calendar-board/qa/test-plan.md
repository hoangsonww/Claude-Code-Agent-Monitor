# Test Plan — focus-calendar-board

> Authored by `qa-lead`, synthesizing Coverage + Risk + Unit + E2E findings. The QA
> deliverable: exactly what tests to add/modify. Detailed enough to implement
> without re-investigating. (Plan only — a separate step writes the tests.)
>
> Companion to `qa-assessment.md` (verdict: **GAPPED**). That document says
> *whether* coverage is adequate; this document says *exactly what to build*
> to close the two must-fix gaps it names and move this change to ADEQUATE.

## ⚠ Build-blocking pre-req (gate this before any implementation, not a test)

**DEC-6's relabeled `concurrency_ratio` copy has no i18n key anywhere in
`technical-plan.md`'s F12 key table.** `decisions.md` DEC-6 commits to a
board-specific relabel (e.g. "Concurrent agent sessions"); F12's key list
(`title, projectFilter, allProjects, sessionFilter, allSessions, customRange,
dayView, from, to`) has no corresponding entry, in any locale. This is a gap
in the **technical plan's own artifact**, not a missing test — no test in
this plan can pin a key that was never named to build. **Action item, owned
by whoever owns `technical-plan.md` (not the implementer, not this test
plan):** add a real key (e.g. `report.board.concurrencyLabel`) to F12's table,
with real (or at least placeholder-but-tracked) values for all four locales,
**before** step 9 below is implemented. Until this lands, §9's i18n
completeness test (below) has nothing to be written against, and the
implementer has no key name to code against — do not let this get silently
resolved as "just hardcode a string for now," which is exactly the failure
mode `qa-assessment.md` flags as untestable by T1-T7 as originally scoped.

Sara also still needs to lock the actual copy string (all four locales) — see
`qa-assessment.md`'s "Open decisions for the user." Until locked, the test at
step 9 asserts only "distinct from the modal's copy and resolves through
`i18n.t(...)`," not an exact literal.

## Objective

Add the test coverage this change needs to safely introduce a **third
consumer** of the focus-report rendering chrome (`FocusReportBody` — serving
the existing per-project modal's List tab, its Calendar tab, and now the new
cross-project `FocusCalendarBoard`) and a **second computation path** for the
same underlying report data (existing `GET /api/projects/:id/focus-report`
vs. new `GET /api/focus-report`), without reproducing this project's own
recurring defect shape — informally named `DERIVED-DUAL-VIEW` in this
project's memory, and shipped twice already in the 24 hours before this
change (a Calendar/List idle-stripe divergence, then this morning's `6e29722`
fix). End state: (1) the two computation paths are pinned to agree on the
report body they share, with an explicit, itemized assertion — not a
whole-object compare that could silently stop comparing anything; (2) the
rendering chrome is pinned to render identically for the modal's and the
board's prop shapes, by *extending* this project's own existing
"[standing template]" cross-view test rather than forking a new one; (3) the
brand-new page's three independent filters are pinned, at the rendered-DOM
level, to never clear one another; (4) the new endpoint's "no hidden
time-window default" contract is pinned; (5) 4-locale nav completeness is
pinned via this project's existing `LOCALES`-driven registry pattern; and (6)
the two existing entry points (`Projects`, `KanbanBoard`) are pinned
byte-identical via the existing snapshot suite, proving the chrome extraction
didn't leak.

## Coverage gap being closed

This project has no `PROJECT-CONTEXT.md`/defect-catalog — the closest thing
to an id is the informal `DERIVED-DUAL-VIEW` pattern name from this
project's own run-log/memory, cited below where it applies.

- **`GET /api/focus-report` (new route) — no coverage exists (expected, doesn't exist yet).** Defect class: `DERIVED-DUAL-VIEW` (2nd computation path for the same data). Pinned by the corrected §1 parity test below — the whole reason this change is being tested at all.
- **Old-vs-new route parity assertion, as currently *specified*, would be false-by-construction if built literally as a whole-object deep-equal** (old route's envelope has no `session_id` key; new route's does). Not yet a shipped gap — a plan-design gap `qa-assessment.md` flags HIGH. Closed by the corrected split assertion in §1 below (never built as a naive `toEqual`).
- **`FocusReportBody`/`FocusCalendarView` as a 3rd-consumer-safe extraction target — no coverage (expected).** Defect class: `DERIVED-DUAL-VIEW` (3rd rendering consumer). Pinned by extending the existing "[standing template]" test in `FocusReportModal.test.tsx`, not a new file (§2).
- **Filter independence (DEC-2) — brand-new page, zero prior coverage.** Pinned by §4's rendered-DOM assertions (not fetch-arg-only checks, which risk.md §4e flags as a way this could pass while violating DEC-2).
- **`nav:focusCalendar` 4-locale completeness — no coverage (expected, key doesn't exist yet).** Pinned by §6's registry-driven (`LOCALES`-loop) extension of `i18n.test.ts`.
- **DEC-6 concurrency-relabel i18n completeness — currently uncoverable** because no key exists in the plan (see pre-req above). Once the pre-req lands, pinned by §6's second block.
- **Sidebar "Projects" nav entry — pre-existing hole, not caused by this change, but adjacent to this change's insertion point** (zero label/href/position assertion exists today). Cheap to close now; pinned by §5.
- **`screens.snapshot.test.tsx` — `Projects`/`KanbanBoard` byte-identity — currently GUARDED, must stay GUARDED through this change.** The single strongest mechanical fence against chrome-extraction leakage; pinned by running these two cases unmodified plus the new 13th case (§7).
- **Old route's `?sources=` gap — deliberately staying UNGUARDED.** Not a gap to close — a gap to *pin as intentional* so a future "helpful" fix to the old route doesn't silently break the new parity test. Pinned by §1's explicit `?sources=`-present case comparing old vs. new side by side.

## Test change set

This project has two real test layers (confirmed by `coverage.md` §0: no
separate e2e/browser-automation runner exists) — server (`node --test`,
HTTP-integration-grade against a real ephemeral SQLite DB) and client
(Vitest/RTL, component- and page-level) — plus one **manual** click-path pass
that stands in for the browser-e2e layer this repo doesn't have.

**Reconciliation note (unit vs. e2e architects):** `unit-tests.md` §1 and
`e2e-tests.md` §2a independently specified the *same* file,
`server/__tests__/focus-report-route.test.js`, with near-identical exhaustive
permutation coverage (all four 400 cases, project/session/sources filters,
window-boundary inclusion/exclusion, the parity check, echo-back). This is
**one file, not two** — there is no separate "unit" vs. "e2e" backend layer
in this project for this route; the HTTP-integration test *is* the unit-grade
test here, per `coverage.md`'s own convention note. Write it once, per
`unit-tests.md`'s fuller spec (it has the more complete red-first framing and
assertion breakdown). `e2e-tests.md`'s actual distinct contribution — the one
thing the component/page/route-integration layers structurally cannot
prove — is the **manual click-path pass** (§8 below); that is this change's
real "minimum flow proof," and it is *not* duplicated into an automated spec
file, consistent with this repo having no Playwright/Cypress runner to build
one in cheaply.

**Backend (route/integration — `server/__tests__/`)**
- `server/__tests__/focus-report-route.test.js` (new) — add. Assertions:
  - 400 (not 500, not silent 200) for: missing `from`+`to`, missing `from`
    only, missing `to` only, unparseable `from`, unparseable `to`; error body
    `{ error: { code: "BAD_REQUEST", message } }`.
  - No combination of `project_id`/`session_id`/`sources` being present ever
    yields 200 while `from`/`to` are missing (loop over filter-present
    prefixes).
  - `?project_id=` returns only that project's sessions; unknown
    `project_id` → 404 (not empty 200).
  - `?session_id=` returns only that session; unknown `session_id` → 404.
  - `?sources=` narrows the result set to the matching-source session(s);
    omitting `sources` returns sessions from every source.
  - **Parity with `GET /api/projects/:id/focus-report` — the corrected,
    split form (per `qa-assessment.md`'s must-fix #1), never a whole-object
    deep-equal:**
    - Assertion group (a) — **report-body deep-equal**, field-by-field, not
      one blob: `assert.deepEqual(newRes.body.sessions, oldRes.body.sessions)`;
      `assert.deepEqual(newRes.body.items, oldRes.body.items)`;
      `assert.deepEqual(newRes.body.totals, oldRes.body.totals)`;
      `assert.equal(newRes.body.wall_clock_ms, oldRes.body.wall_clock_ms)`;
      `assert.equal(newRes.body.concurrency_ratio, oldRes.body.concurrency_ratio)`.
    - Assertion group (b) — **separate envelope/shape check**, run
      independently of (a): the new route's `project_id`/`session_id` echo
      back exactly what was requested (`null` when unfiltered); explicitly
      assert the old route's envelope has **no** `session_id` key at all
      (`assert.equal(oldRes.body.session_id, undefined)` or
      `assert.ok(!("session_id" in oldRes.body))`) — this is the concrete
      guard against the exact "under-specified deep-equal" trap
      `qa-assessment.md`/`risk.md` §4a name: the two envelopes are legitimately
      different by design, and the test must say so explicitly rather than
      strip fields until a naive compare passes.
    - An explicit `?sources=`-present case: seed two differently-sourced
      sessions, call the new route with `?sources=local` and the old route
      the same way (old route has no such param, so call it plain) — assert
      the new route narrows and the old route's own existing (unmodified)
      test suite still shows it does not. Pins the asymmetry as intentional,
      not a future accidental fix.
  - Zero-focus-data project/session → same well-shaped-empty-totals response
    shape as the old route's existing case (extend, don't re-derive).
  - Response never includes `from`/`to` echoed back (contract-narrowness
    guard).
  - **Regression companions, run unmodified:** `server/__tests__/focus-report.test.js`
    and `server/__tests__/projects.test.js` must pass with zero edits — proves
    the new route didn't touch `focus-report.js` or the old route. An edit to
    either is a scope-creep signal, not a fix to make.

**Frontend (unit/component — `client/src/components/__tests__/`)**
- `client/src/components/__tests__/FocusReportModal.test.tsx` — extend in
  place (do **not** fork a new file) — add exactly one new `it(...)`
  immediately after the existing `"[standing template] List and Calendar
  views render the same wall-clock/agent-time numbers..."` block, inside the
  same `describe`. Assertion: render `FocusReportBody` directly (not through
  `FocusReportModal`) once with modal-shaped props (no `projectLabelForCwd`/
  `selectedDate`/`hideDateNav`) and once with board-shaped props
  (`projectLabelForCwd` set, `selectedDate` fixed, `hideDateNav={true}`);
  assert the modal-shaped render shows exactly one prev/today/next control
  set and no project label; the board-shaped render shows **zero** day-nav
  controls and does show the project label; and the two renders' idle-stripe
  `top`/`height` geometry and non-relabeled stat-tile text are identical for
  the same underlying segment.
- `client/src/components/__tests__/FocusCalendarView.test.tsx` — extend
  (existing file) with a new `describe("board-mode additive props...")`
  block: `selectedDate` controls the rendered day instead of internal state;
  `hideDateNav={true}` renders zero day-nav buttons; `hideDateNav` omitted
  (default `false`) still renders the nav row unchanged (inverted-boolean
  guard); `projectLabelForCwd` renders the resolved label or nothing extra
  when it resolves `undefined`.
- `client/src/components/__tests__/TimePeriodPicker.test.tsx` (new) — day
  mode default highlights Today; prev/next emit the adjacent day (computed
  via the shared `calendarWindow.ts` helper, not a hand-derived literal);
  Today always resolves to `startOfDay(new Date())` regardless of the
  currently-viewed date (not a no-op, not the last-viewed date); switching to
  range mode emits `{mode:'range', start, end}`; switching back to day mode
  from range mode defaults to today, not the last-viewed range day (DEC-3
  "today" default regression guard).

**Frontend (page — `client/src/pages/__tests__/`)**
- `client/src/pages/__tests__/FocusCalendarBoard.test.tsx` (new) — defaults
  on first load (today, all-projects, no-session; `api.sessions.list` called
  with `{limit: 10000}`, no `cwd`, exactly once); **filter independence,
  asserted on rendered output, not just mocked fetch-call args** (per
  `qa-assessment.md` must-fix #3 / `risk.md` §4e): selecting a project does
  not clear an already-selected session (assert the session `<select>`'s
  *displayed* value, not only the next `api.focusReport` call's arguments),
  selecting a session does not clear an already-selected project, changing
  project/session does not reset the current time-period, and prev/today/next
  navigation does not reset project/session; zero-result edge cases (project
  with no sessions, session with no history in-window, non-overlapping
  project+session combo) render the existing empty state, not a crash or
  error UI; DEC-6 relabel renders a board-specific string distinct from the
  modal's, verified via `i18n.t(...)` once the pre-req key lands (not a
  hardcoded literal unless Sara locks copy first).

**i18n (registry-driven — `client/src/i18n/__tests__/i18n.test.ts`)**
- Extend (existing file, new `describe` block, mirroring the existing
  `report.{wallClockLabel,activeLabel}` registry-driven template at line 75):
  loop the file's own `LOCALES` array asserting `nav:focusCalendar` resolves
  a non-empty, non-key-echoing string in every locale; a separate assertion
  pins the English value to exactly `"Calendar"`, not `"Focus Calendar"` (the
  PM's own named most-likely partial-ship mistake — a completeness loop alone
  wouldn't catch a *wrong* label, only a *missing* one).
- Second new block (**blocked on the pre-req above**): same `LOCALES`-loop
  pattern for DEC-6's new i18n key, asserting it resolves through `i18n.t(...)`
  and is distinct from the existing per-project concurrency label — this is
  what actually closes must-fix #2 from `qa-assessment.md`, not §5d's
  render-level check alone (that check can pass on a hardcoded string; this
  one cannot).

**Sidebar (`client/src/components/__tests__/Sidebar.test.tsx`)**
- Extend two existing tests (not new ones): `"should render all navigation
  links"` gains `expect(screen.getByText("Calendar")).toBeInTheDocument()`
  (exact string, not "Focus Calendar"); `"should have correct navigation
  hrefs"` gains `/focus-calendar`.
- New `it("positions Calendar right after Projects in nav order")` —
  asserts ordering explicitly (index of "Calendar" == index of "Projects" +
  1), closing the pre-existing "Projects has zero assertion" hole
  identified in `coverage.md` as the first test in this file to check
  "Projects" at all.

**Snapshot (`client/src/pages/__tests__/screens.snapshot.test.tsx`)**
- Extend the `vi.mock("../../lib/api", ...)` factory with a top-level
  `api.focusReport` mock (empty-fixture-shaped, matching the new DTO); add
  the 13th `it("Focus calendar board", ...)` case, positioned right after
  the existing "Projects" case per DEC-5's ordering convention. Diff-review
  (not blind-regenerate): run without `-u` first, confirm the existing
  "Projects"/"Kanban board" snapshots are byte-identical to their pre-change
  baselines (any diff there is a real chrome-extraction regression, not
  something to bless away), then run `-u` once to add only the one new
  baseline.

**Manual click-path (e2e-equivalent minimum flow proof — no automated runner exists)**
- Documented pass, run once before ship (see §8/§9): modal → sidebar nav to
  Calendar → independent project/session selection → time-period navigation
  → visual parity check against the modal for the same day/data → confirm
  both existing modal trigger points are visually unchanged → confirm all
  four locales' sidebar label reads correctly (the one thing no automated
  test here can fully verify — completeness ≠ correctness).

**Fixtures / test data**
- None external. Server: reuse `projects.test.js`'s `t()`/`focus()`
  fixture-seeding helpers (copied per-file, per this repo's existing
  one-helper-per-file convention — do not cross-import between test files).
  Client: reuse each file's own existing `makeReport()`-style helper; add a
  new one in `FocusCalendarBoard.test.tsx` rather than importing across test
  files.

## Implementation steps

Each step is independently checkable and red-first: state what fails before
the step's change and passes after, no step assumes a later step already
landed.

0. **[Pre-req, not a test — build-blocking]** Add DEC-6's i18n key to
   `technical-plan.md`'s F12 table, all four locales (owner: whoever owns the
   technical plan, not the test implementer). Nothing in step 9 below can be
   written meaningfully until this lands. **Check:** F12's table now lists
   the new key with a value (or explicit placeholder) for `en`/`zh`/`vi`/`ko`.
1. Build `server/routes/focus-report.js` + mount it in `server/index.js` at
   `/api/focus-report` (distinct from `/api/focus` and `/api/projects`), per
   the technical plan's B1/B2 — a thin filter layer (project/session/sources/
   from/to resolution) feeding the unmodified `buildProjectFocusReport`.
2. Write `server/__tests__/focus-report-route.test.js` per the Test change
   set above. **Red-first:** before step 1 exists, every case in this file
   fails (route doesn't exist / 404s on the mount, or the 400-validation
   cases get a connection error). **After step 1:** all cases pass, including
   the split parity assertion (group (a) report-body deep-equal, group (b)
   envelope echo-back) against the old route's real, unmodified output.
3. Run `server/__tests__/focus-report.test.js` and
   `server/__tests__/projects.test.js` unmodified. **Check:** both still pass
   with zero edits — if either needs an edit to stay green, stop and treat it
   as scope creep, not a fix.
4. Build the frontend shared-chrome extraction: `client/src/components/FocusReportBody.tsx`
   (moved `ReportBody`/`ListView`/`StatTile`/`SegmentedBar`/`kindTotalsAsSegments`/
   `ALL_KINDS`/`ViewMode` + new `FocusReportViewToggle`, new optional
   `projectLabelForCwd` prop), `client/src/lib/calendarWindow.ts` (moved
   `DAY_MS`/`startOfDay`), and `FocusCalendarView.tsx`'s three additive props
   (`projectLabelForCwd`, `selectedDate`, `hideDateNav`) — all additive-only,
   per F1-F3/F5a.
5. Extend `client/src/components/__tests__/FocusReportModal.test.tsx` with
   the one new standing-template-extension `it(...)` (Test change set,
   above). **Red-first:** before step 4, this test cannot even import
   `FocusReportBody` (compile/module-resolution failure). **After step 4,**
   if `hideDateNav` is wired to the wrong component or the boolean is
   inverted, the "board-shaped render shows zero nav buttons" (or the
   modal-shaped "shows one set") assertion fails specifically; correct
   wiring passes both.
6. Extend `client/src/components/__tests__/FocusCalendarView.test.tsx` with
   the new `describe("board-mode additive props...")` block. **Red-first:**
   before step 4's additive props exist, `hideDateNav`/`selectedDate` are
   either a TS compile error or silently ignored (nav still renders,
   internal state still drives the date) — fails; after step 4, passes.
7. Build `client/src/components/TimePeriodPicker.tsx` (pure/controlled, per
   F5b) and `client/src/lib/api.ts`'s new `api.focusReport({projectId,
   sessionId, from, to})` (both `from`/`to` required).
8. Write `client/src/components/__tests__/TimePeriodPicker.test.tsx`.
   **Red-first:** fails to compile/mount before step 7; once step 7 is built,
   fails specifically on any inverted default (e.g. "Today" resolving to a
   stale range day) until F5b/T7's exact "always resolves to today on
   mode-switch" behavior is implemented, then passes.
9. Build `client/src/pages/FocusCalendarBoard.tsx` (three independent
   filters, defaults today/all-projects/no-session), wire it up with
   `Sidebar.tsx`'s new nav entry and `App.tsx`'s new route, and add the
   `nav:focusCalendar` + DEC-6 `plan.json` keys to all four locale files
   (the DEC-6 key only buildable because of step 0's pre-req).
10. Write `client/src/pages/__tests__/FocusCalendarBoard.test.tsx`.
    **Red-first:** before step 9, this fails to import the page at all; once
    built, the filter-independence cases specifically catch a regression to
    the *rejected* original draft's "project change clears session" behavior
    (fails against that shape, passes against DEC-2's corrected shape) — and
    because these assertions are on rendered `<select>` values, a
    client-side-only render filter that "cheats" the fetch-args shape would
    still be caught here.
11. Extend `client/src/i18n/__tests__/i18n.test.ts` with both new
    `LOCALES`-driven blocks (nav completeness + DEC-6 key completeness).
    **Red-first:** before step 9's locale-file edits land, `i18n.t(...)`
    resolves the literal fallback string (namespace-stripped missing-key
    echo) for every locale — every iteration fails; landing all four locale
    files in the same commit is what turns every iteration green
    simultaneously. If only 3 of 4 locales land, exactly one iteration stays
    red, pinpointing the missing file.
12. Extend `client/src/components/__tests__/Sidebar.test.tsx` (two extended
    assertions + the new ordering `it`). **Red-first:** before step 9's
    `Sidebar.tsx`/`NAV_KEYS` change, "Calendar" is absent from both the label
    and href assertions, and the new ordering test has no "Calendar" entry to
    find its index for — all three fail; after step 9, all three pass,
    specifically catching a wrong-position insertion (e.g. after Kanban
    Board instead of after Projects) as a distinct failure from "missing
    entirely."
13. Extend `client/src/pages/__tests__/screens.snapshot.test.tsx` (mock +
    13th case). **Red-first:** run without `-u` — the new case has no
    baseline (trivial first-pass, inspect its structure by eye once), but
    the two *existing* `"Projects"`/`"Kanban board"` cases are the real
    check: if step 4's extraction changed either page's rendered output at
    all, their diffs show here as failures against the committed baseline.
    Only after confirming those two are unchanged, run `-u` once to bless
    the one new baseline.
14. Run the manual click-path pass (Test change set, above / §8 below) once
    the full stack is buildable (`npm run dev`) — the one check no automated
    layer here can perform: visual parity between the modal and the board
    for the same data, and a native-language glance at all four locales'
    "Calendar" label (catches *wrong*, not just *missing* — step 11's
    automated check only catches the latter).
15. Run `npm run test:server` and `npm run test:client` in full, then the
    file-header audit. All must be clean before calling this change done.

## Single-source-of-truth guardrail

Applies, on two axes:

1. **Computation:** `server/lib/focus-report.js`'s `buildProjectFocusReport`
   is the one canonical computation engine; the old route
   (`GET /api/projects/:id/focus-report`) is untouched and therefore the
   **oracle** the new route must agree with. Step 2's parity test asserts
   the new route's rendered report body (`sessions`/`items`/`totals`/
   `wall_clock_ms`/`concurrency_ratio`) against that oracle — it must never
   independently re-derive the session-selection query; if a future change
   makes the new route compute its own session set instead of feeding the
   same rows through the unmodified builder, this test is what catches the
   divergence. Never bless a route that hand-derives its own version of this
   data as a shortcut around the shared builder.
2. **Rendering:** `FocusReportBody`/`FocusCalendarView` becomes the one
   canonical rendering chrome for report data, now with two real consumers
   (modal, board). Step 5's extension of the "[standing template]" test is
   the enforcement mechanism — it must literally be the *same* test file,
   extended, not a fork, per this project's own self-imposed rule from
   `6e29722`. Never bless a second consumer that copy-pastes chrome JSX
   instead of importing `FocusReportBody`; that would defeat this project's
   own guardrail on its first real use, hours after being written.
3. **Day-boundary math:** `calendarWindow.ts`'s `startOfDay`/`DAY_MS` becomes
   the one canonical source for day windows, consumed by `FocusCalendarView`,
   `TimePeriodPicker`, and `FocusCalendarBoard`. Tests (steps 8, 10) must
   derive their *expected* values through this same shared helper, not a
   hand-computed literal — a literal that silently drifts from the helper's
   actual behavior would mask a real bug rather than catch one.

## Durable-cure decision

**Taking now (must-add-now, per `qa-assessment.md`):** the corrected T1 split
parity assertion, the DEC-6 i18n-key pre-req + its registry test, the
rendered-DOM (not fetch-arg-only) filter-independence assertions, the
explicit `?sources=`-present parity case, and the Sidebar "Projects" ordering
test. These are narrow, already-scoped corrections to this change's own test
design — not deferred.

**Deferring (durable-cure, per `qa-assessment.md`'s recommendation):** the
**shared parity-assertion test helper** (generalizing "compare report-body
fields, echo-check envelope fields" into a reusable assertion rather than a
hand-written per-pair comparison) is **not** being built as part of this
change. This is the second time this project has needed a pairwise parity
test in one day (rendering side in `6e29722`, data side here); it is not yet
the third, which is the threshold at which generalizing pays for itself
without over-engineering for a pattern that's only shown up twice.
**Consequence of deferring:** the next new consumer of
`buildProjectFocusReport` — there will be one, per this project's own repeat
rate — will have to hand-derive "which fields are envelope vs. body" from
scratch again, with the same risk of writing a naive whole-object compare
that `qa-assessment.md` had to catch by hand this time. If a third pairwise
parity test is needed before this is generalized, treat that as the trigger
to build the shared helper, not defer it again.

**Taking now, cheaply, as a process control rather than code:** the
"every `DEC-*` entry that changes user-visible copy must name its i18n
key(s) before the plan is build-ready" rule — this is what step 0's pre-req
gate operationalizes for this change specifically; whether it becomes a
standing process rule beyond this change is Sara's call, flagged in
`qa-assessment.md`'s open decisions, not decided here.

## How to run

- **Backend, full:** `npm run test:server`
- **Backend, touched-surface subset (fast iteration):**
  `node --test server/__tests__/focus-report-route.test.js server/__tests__/projects.test.js server/__tests__/focus-report.test.js`
- **Frontend, full:** `npm run test:client`
- **Frontend, touched-surface subset (fast iteration):**
  `cd client && npx vitest run src/components/__tests__/FocusReportModal.test.tsx src/components/__tests__/FocusCalendarView.test.tsx src/components/__tests__/TimePeriodPicker.test.tsx src/components/__tests__/Sidebar.test.tsx src/pages/__tests__/FocusCalendarBoard.test.tsx src/pages/__tests__/screens.snapshot.test.tsx src/i18n/__tests__/i18n.test.ts`
- **Snapshot review (never blind `-u`):** first
  `cd client && npx vitest run src/pages/__tests__/screens.snapshot.test.tsx`
  (no `-u`), confirm `Projects`/`Kanban board` unchanged, then
  `cd client && npx vitest run -u` once to bless only the new case, then
  re-diff the committed snapshot file by eye.
- **Manual click-path:** `npm run dev`, then open the app in a real browser
  (`open -a "Google Chrome" "http://localhost:5173"` or whatever port
  `npm run dev` prints) with at least one project that has real seeded focus
  history (`scripts/seed.js` if a clean seed is needed).
- **File-header audit:** `bash .claude/skills/file-headers/scripts/check-headers.sh`
- **Full pre-done sequence:** `npm run test:server` → `npm run test:client` →
  review the snapshot diff by eye → manual click-path pass → file-header
  audit.

## Definition of Done

- [ ] Step 0's DEC-6 i18n-key pre-req landed in `technical-plan.md`'s F12
      table (all four locales) **before** any DEC-6-dependent test was
      written — confirm this order, not just that the key eventually exists.
- [ ] `server/__tests__/focus-report-route.test.js` added; every case
      observed RED before its corresponding implementation step and GREEN
      after (steps 1-2).
- [ ] The parity check is the **corrected, split form** — report-body
      deep-equal (`sessions`/`items`/`totals`/`wall_clock_ms`/
      `concurrency_ratio`) as one assertion group, envelope echo-back
      (`project_id`/`session_id`, including the old route's confirmed
      *absence* of `session_id`) as a separate assertion group — never a
      single whole-object `deepEqual`/`toEqual`.
- [ ] `server/__tests__/focus-report.test.js` and `projects.test.js` pass
      with **zero edits**.
- [ ] `FocusReportModal.test.tsx`'s standing-template test was **extended**
      (one new `it` in the same `describe`), not forked into a new file.
- [ ] `FocusCalendarView.test.tsx`, `TimePeriodPicker.test.tsx`,
      `FocusCalendarBoard.test.tsx`, `Sidebar.test.tsx`, `i18n.test.ts` all
      extended/added per the Test change set; every new test observed RED
      before its implementation step and GREEN after.
- [ ] Filter-independence tests assert on **rendered DOM** (selected
      `<option>`/value state), not only on mocked `api.focusReport` call
      arguments.
- [ ] `nav:focusCalendar` completeness test passes for all four locales, and
      the English-value pin (`"Calendar"`, not `"Focus Calendar"`) passes.
- [ ] DEC-6 i18n-key completeness test passes for all four locales (blocked
      until the pre-req lands — do not skip or stub this out).
- [ ] `screens.snapshot.test.tsx`'s `Projects`/`Kanban board` cases are
      byte-identical to their pre-change baselines; exactly one new case
      (`Focus calendar board`) was added, reviewed by eye, then blessed via
      `-u` — never a blind bulk regenerate.
- [ ] The old route's `?sources=`-ignoring gap is confirmed **still
      present**, not accidentally fixed as a side effect.
- [ ] Manual click-path pass (§ above) run once against a real dev stack with
      real seeded data; board-vs-modal visual parity and all-four-locale
      label correctness confirmed by eye.
- [ ] `npm run test:server` and `npm run test:client` both green, full run.
- [ ] `bash .claude/skills/file-headers/scripts/check-headers.sh` exits 0 for
      every new file.
- [ ] `docs/API.md` updated with the new `GET /api/focus-report` section in
      the same change-set (per `change-brief.md`'s changed-files list).
