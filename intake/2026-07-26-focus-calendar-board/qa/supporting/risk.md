# Risk & Regression Analysis — focus-calendar-board

> Author: risk-analyst pass. Grounded against the actual current codebase
> (not just the plan's prose) — see file/line citations throughout. This
> project has no `PROJECT-CONTEXT.md`/defect-class catalog (confirmed by all
> four evaluators in `pm-plan.md` §3 and independently re-confirmed here), so
> section 3 reasons from this project's own git history and persistent
> memory (`project_holistic-focus-history.md`) instead of catalog IDs.

---

## 0. Why this change is structurally dangerous, in one sentence

This change adds a **third consumer** of the focus-report rendering surface
(`FocusCalendarView`/report chrome — modal List tab, modal Calendar tab, now
the standalone board) and a **second computation path** for the same
underlying data (`GET /api/projects/:id/focus-report` vs. new
`GET /api/focus-report`), in the **same feature area, same day**, that this
project's own `6e29722` ("List view now honestly represents active vs. idle
time") fixed *reactively* this morning for exactly this shape: "a
computed/rendered surface duplicated across multiple consumers, no shared
helper, no cross-consumer test — one consumer gets a fix, the other doesn't."
Every risk below is a variation on: **did the extraction/shared-source-of-truth
discipline actually get built, or did the new consumer quietly fork it?**

---

## 1. Blast radius

Beyond the literal new files, these existing modules are load-bearing for
this change and would silently propagate a defect if any one of them drifts:

- **`server/lib/focus-report.js`** (`buildProjectFocusReport`,
  `buildSessionFocusReport`, `buildFocusSegments`, `mergeIntervals`,
  `emptyKindTotals`) — the single computation engine, now fed by **two**
  independent route layers (`server/routes/projects.js:218-236` and the new
  `server/routes/focus-report.js`). It is unchanged by this plan, but it is
  now the shared dependency two different session-selection paths must feed
  identically to stay in sync.
- **`server/routes/projects.js`** (confirmed at lines 218-236: `GET
  /:id/focus-report`, the raw `SELECT id, name, cwd, started_at, ended_at
  FROM sessions WHERE cwd IN (...) ORDER BY started_at ASC` query, response
  shape `{project_id, ...report}`) — explicitly untouched, but it is the
  **oracle** the new route's deep-equal test (T1) is checked against. Its
  response envelope has **no** `session_id` key at all, which matters (see
  §4a).
- **`server/lib/source-filter.js`** (`parseSources`, `sourceColumnClause`,
  `sessionIdInSourcesClause`) — this project's one cross-cutting scoping
  convention, already used by `analytics.js`/`agents.js`/`events.js`. This
  change applies it to the *new* route only, deliberately leaving the old
  route's `?sources=`-ignoring gap alone. That asymmetry is now a permanent,
  intentional divergence between two routes that otherwise claim to return
  "the same report" — a subtle contract to hold onto correctly (see §4d).
- **`client/src/components/FocusReportBody.tsx`** (new) and
  **`client/src/components/FocusCalendarView.tsx`** (existing, 518 lines,
  additive props only) — the shared chrome/renderer now serving three
  call-shapes: modal (no new props), board List view, board Calendar view
  (`selectedDate` controlled + `hideDateNav=true` + `projectLabelForCwd`).
  Any prop-threading gap here reproduces this morning's exact defect shape.
- **`client/src/lib/calendarWindow.ts`** (new) — single source for
  `startOfDay`/`DAY_MS`, consumed by three places:
  `FocusCalendarView.tsx`'s internal nav, `TimePeriodPicker.tsx`, and
  `FocusCalendarBoard.tsx`. A day-boundary bug here (see §4i, DST) propagates
  to all three simultaneously — which is actually the *good* failure mode
  (consistent-but-wrong beats silently-divergent), but still worth a targeted
  test since nothing today exercises a DST-boundary day.
- **`client/src/lib/types.ts`** (`FocusReport` interface, confirmed at line
  1619-1620: `project_id: string`, no `session_id` field today) — widened to
  `project_id: string | null` + new `session_id: string | null`. This is a
  shared DTO consumed by both routes' typed responses and by
  `screens.snapshot.test.tsx`'s mocks; a fixture that doesn't add the new
  field will still typecheck (both are optional-shaped/nullable) but could
  mask a route that forgets to echo the field.
- **`client/src/i18n/locales/{en,zh,vi,ko}/{nav,plan}.json`** (8 files) —
  cross-locale consistency is a hand-maintained, four-times-repeated
  operation with no existing general-purpose guard (see §4f).
- **`client/src/components/Sidebar.tsx`** (`NAV_KEYS` array, line 96) and
  **`client/src/App.tsx`** (route table) — ordering-sensitive; DEC-5
  corrected the plan's own original (wrong) placement once already, showing
  this is an easy thing to get subtly wrong even with a written decision in
  hand.
- **`client/src/pages/__tests__/screens.snapshot.test.tsx`** (549 lines, 12
  cases today) — its byte-identity guarantee for `Projects`/`KanbanBoard` is
  the regression fence proving the shared-chrome extraction didn't leak into
  the two existing entry points; it is arguably the single highest-leverage
  existing test in this whole change, and it did not exist to catch this
  specific class of regression until this plan added a 13th case.

---

## 2. Invariants that must hold

No formal defect-class catalog exists, so these are reasoned from first
principles and mapped onto the five properties this brief named, plus one the
plan's own B1 spec implies but doesn't label:

| # | Invariant (as named in the change brief) | General class | Where it's enforced by design |
|---|---|---|---|
| 1 | New `GET /api/focus-report?project_id=` output deep-equals old `GET /api/projects/:id/focus-report` output for the same fixture | **Consistency across paths** | T1 (new, unproven) |
| 2 | `FocusReportBody`/`FocusCalendarView` render identical geometry/data for modal-shaped vs. board-shaped props (same underlying report) | **Consistency across paths** (rendering variant — the exact `6e29722` shape) | T2, extending the existing "standing template" test at `FocusReportModal.test.tsx:517` |
| 3 | Project / session / time-period filters are mutually independent — none clears or resets another | **Isolation across variants** (here: isolation across *filter dimensions*, not tenants — same shape: one axis's state must never leak into a reset of another axis) | T3(d),(f),(h) — **all net-new, zero prior guard** (see §4g) |
| 4 | No hidden server-side time-window default exists; missing/malformed `from`/`to` → 400, never a silent unbounded query | Boundary-contract honesty (closest general class: **no-leak at boundaries**, inverted — an *implicit default* is itself the thing that must not leak across the client/server contract undetected) | T1 |
| 5 | `nav:focusCalendar` key present, with the *correct* (short) value, in all four locale files in the same commit | **Completeness across a registry/enum** (registry = the `LOCALES` array already used at `i18n.test.ts:15`; enum = nav keys) | T6 (new) — but only catches *missing*, not *wrong* (flagged explicitly in the plan's own §7 risk list) |
| 6 (added) | `project_id`/`session_id` echoed by the new route must round-trip exactly what was requested (`null` when unfiltered, never repurposed to mean something else) | **Round-trip integrity** across the request→response boundary | Implicit in B1's spec; **no test in T1's list explicitly asserts the echo-back values themselves** (T1 asserts totals/sessions/items, not that `session_id` in the response matches the `?session_id=` sent) — a real gap, see §4e |

---

## 3. Recurring-issue mapping (no formal catalog — reasoning from history)

This project has no `PROJECT-CONTEXT.md`/defect catalog. The closest thing to
one is this project's own persistent memory
(`project_holistic-focus-history.md`) plus today's git log, and both are
unambiguous:

- **`6e29722`** (this morning, same day) is a **directly on-point precedent**,
  not a tangential one. It fixed: "FocusReportModal's List view sized every
  bar from raw `wall_ms` while its own stat tile already showed `active_ms`
  next to it — the same 'computed once, rendered by two views
  inconsistently' gap the Calendar view had before this session's earlier
  fix." The durable fix was (a) extract shared logic (`idleStripes.ts`)
  instead of duplicating it, and (b) add a permanent cross-view
  "[standing template]" consistency test explicitly commented: *"extend THIS
  test, not a view-local one, for any future field either view renders."*
- **This change touches that exact standing-template test** (T2 is specified
  as extending it, not writing a new one) and **that exact shared-extraction
  pattern** (`FocusReportBody.tsx` is `idleStripes.ts`'s sibling for this
  change). That is the single loudest signal in this whole intake: **if T2
  is built as a new, separate test file instead of literally extending
  `FocusReportModal.test.tsx`'s line-517 template, this is a regression of
  this morning's fix in spirit** — not because the List/Calendar bug
  reappears, but because the *guardrail* the morning fix installed
  (one test, extended forever, never forked) gets forked on its first real
  test, defeating its whole purpose hours after it was written.
- Treat this as: **this change is either the second successful application
  of a fix this project shipped hours ago, or — if the extraction/shared-test
  discipline is skipped anywhere — a third occurrence of the identical
  defect shape in a single day**, this time shipped preemptively rather than
  caught by a bug report. There is no "OPEN/WATCH" formal marker to point to,
  but the informal signal is as strong as a marked entry would be: this
  project has now hit "one rendering surface, multiple consumers, no shared
  source of truth" **twice today**, independently diagnosed both times by
  the PM (`pm-plan.md` §4) without prompting.

---

## 4. The "ships green but broken" traps — ranked, with the required assertion

### a) T1's "deep-equal" claim is under-specified and could pass while masking a real divergence (HIGH)
The old route's response envelope is `{project_id, ...report}` — **no**
`session_id` key exists in it at all (confirmed: `server/routes/projects.js`
line ~236). The new route's is `{project_id, session_id, ...report}`. A
literal full-object deep-equal between the two responses is **false by
construction** — the envelopes are non-identical by design. If T1 is
implemented as a naive `expect(newRes).toEqual(oldRes)`, it will either (i)
fail immediately and get "fixed" by stripping fields until it passes — at
which point it's easy to over-strip and silently stop comparing `totals` or
`items` too — or (ii) be scoped correctly to `sessions`/`items`/`totals`
sub-objects only. **Required assertion:** the deep-equal check must
explicitly enumerate which top-level keys are compared (the shared report
body) and separately, explicitly assert the *envelope* fields
(`project_id`, `session_id`) each round-trip correctly relative to what was
requested (invariant 6 above) — two assertions, not one, or this test can
ship green while silently comparing nothing meaningful.

### b) DEC-6's relabeled `concurrency_ratio` copy has no i18n key anywhere in the plan's own change table (HIGH)
`decisions.md` DEC-6 and `technical-plan.md` §5/§8 commit to relabeling
`concurrency_ratio`'s copy on the aggregate view (e.g. "Concurrent agent
sessions"). But **F12's own key list** — the *only* place in the plan that
enumerates new `plan.json` keys — lists `title, projectFilter, allProjects,
sessionFilter, allSessions, customRange, dayView, from, to`. There is no
`concurrencyLabel`/`concurrentSessions`-shaped key anywhere in that list, in
any of the four locales. This is a real gap in the plan as written, not a
hypothetical: it can ship as (i) a hardcoded English string bypassing this
project's i18n discipline entirely (invisible to `zh`/`vi`/`ko` users), or
(ii) the board silently reusing the *existing* per-project label
unchanged, which is precisely the "reads correctly as cross-project overlap"
requirement DEC-6 exists to fix — and **no test in T1-T7 would catch either
outcome**, since T6 only checks `nav:focusCalendar`, not `plan.json`'s
`report.board.*` completeness, and no test asserts the concurrency tile's
text differs between modal and board. **Required assertion:** a
registry-driven (four-locale) check that a distinct, translated
board-specific concurrency-tile string exists and renders on the board,
verifiably different from the modal's copy for the same underlying stat.

### c) Filter independence (DEC-2) has zero prior test coverage to lean on — it's a brand-new page, brand-new state (HIGH)
`FocusCalendarBoard.tsx` doesn't exist yet; `FocusCalendarBoard.test.tsx`
(T3) is entirely new. Nothing today exercises this invariant even
partially. DEC-2 explicitly **reversed** the original draft's behavior
("project filter clears session on change") — reverting to that shape is a
one-line, easy-to-reintroduce mistake (e.g., a convenience `onChange`
handler on the project `<select>` that also calls `setSessionId(undefined)`
"to avoid a confusing empty result"). **Required assertion:** T3(d)/(h) must
explicitly set session, then change project, and assert session is still
set (not just that no error is thrown) — and the same in the other
direction and against the time-period filter.

### d) A well-intentioned future fix to the old route's `?sources=` gap has nothing pinning it as intentional today (MEDIUM-HIGH)
`server/routes/projects.js`'s `GET /:id/focus-report` silently ignores
`?sources=` — a **known, deliberately-not-fixed** gap per this plan (§5,
§9 DoD: "confirmed, not accidentally fixed"). But there is currently no
existing test in `projects.test.js` asserting the old route ignores
`sources` (verified: this project's own test suite doesn't pin the gap
either way). A future engineer "helpfully" fixing that gap — entirely
plausible since the new route sits right next to it doing exactly that —
would silently break the old-vs-new deep-equal invariant (T1) the moment
`?sources=` is present in a request that both routes are compared under,
and, worse, could pass *today's* test suite cleanly if T1 only compares
outputs where `?sources=` is absent. **Required assertion:** T1 needs an
explicit case with a real `?sources=` value applied, asserting the new
route *narrows* and the old route (called the same way) does *not* — making
the asymmetry itself a pinned, tested fact, not just documented prose.

### e) Global session dropdown could be correct in the fetch but wrong in the render (MEDIUM)
DEC-2 requires the session `<select>` to always show the full global list,
independent of the project filter. F5 specifies fetching once via
`api.sessions.list({limit: 10000})` with no `cwd` param — but nothing stops
`FocusCalendarBoard.tsx` from fetching the global list correctly and then
**filtering the rendered `<option>` list client-side** by the currently
selected project "for UX convenience," which would satisfy any test that
only inspects the API call arguments (a very likely test shape) while
violating DEC-2 in what the user actually sees. **Required assertion:** T3
must assert on the *rendered* option list's contents/count directly, not
just on the mocked fetch call's parameters.

### f) Locale completeness test catches "missing," not "wrong" (MEDIUM — explicitly acknowledged by the plan itself)
T6 is registry-driven off the same `LOCALES` array `i18n.test.ts` already
uses (line 15) and will catch an outright missing `nav:focusCalendar` key in
any of the four files. It **cannot** catch a mistranslation or a
copy-pasted wrong value (e.g., `zh/nav.json` accidentally getting the fuller
`report.board.title` string "焦点日历" instead of the intended short "日历").
This is called out in the plan's own §7 risk list, but is worth restating
here since it's the PM's own named "single most likely partial-ship
mistake" and an automated-only verification pass would miss it entirely.
**Required action (not a test):** a native-reading manual diff of all four
`nav.json`/`plan.json` additions against `decisions.md` DEC-5's literal
values before merge — this is a process control, not a code assertion, and
should be tracked as such in the test plan rather than assumed covered by
T6.

### g) Day-boundary math (`calendarWindow.ts`) is untested across a DST transition (LOW-MEDIUM, niche but real)
`startOfDay` + a fixed `DAY_MS` (24h) constant computing a day's `[from, to)`
window will be wrong on the two days per year a local day is 23 or 25 hours
long (DST transitions), for any install running in a DST-observing
timezone. None of T3/T7's listed cases exercise a DST-boundary date.
Consequence would be a silently truncated or overlapping day window on
exactly those two days a year — a correctness bug, not a crash, so it would
not surface as a visible error. **Required assertion:** at least one test
constructing `from`/`to` for a known DST-transition date in a DST-observing
timezone and asserting the window still spans exactly one local calendar
day.

### h) Double day-nav UI regression has exactly one guard, and it's a new test asserting new code (MEDIUM)
`hideDateNav` defaults to `false`; if `FocusCalendarBoard.tsx` forgets to
pass `hideDateNav={true}` when wiring `FocusReportBody`→`FocusCalendarView`,
the user sees two stacked prev/today/next controls. T2 is the *only*
assertion for this (explicitly named in the plan's own §7 risk list) and it
is new, unproven code testing new, unproven code — there's no independent
existing regression fence here the way `screens.snapshot.test.tsx` provides
for the *existing* entry points. Treat T2's zero-buttons assertion as
load-bearing, not incidental.

---

## 5. Severity & priority (worst first)

1. **[Data-correctness, user-visible, precedent-repeat] Old-vs-new endpoint
   consistency (§2 invariant 1, §4a, §4d).** This is the exact defect class
   the project shipped a fix for hours ago, now with a second computation
   path instead of a second rendering path. A silent divergence here means
   real users see different focus-time numbers depending on which screen
   they're looking at — the single worst outcome this feature could produce.
   Fix the T1 assertion scoping (§4a) before trusting T1 exists as "coverage."
2. **[Data-correctness, user-visible, precedent-repeat] Modal-vs-board
   rendering consistency (§2 invariant 2, §4h).** Same defect class,
   rendering side. T2 extending the actual standing-template test (not a
   new file) is itself part of the invariant — verify this literally, not
   just that "a test with similar assertions exists."
3. **[Functional regression of an explicit correction] Filter independence
   (§2 invariant 3, §4c, §4e).** DEC-2 explicitly reversed a drafted
   behavior; reverting it is a small, easy, silent mistake with zero
   existing test fence (brand-new page). Verify the render-level assertion,
   not just the fetch-call assertion.
4. **[Contract honesty / performance] No hidden time-window default (§2
   invariant 4).** Testable via a straightforward 400-on-missing-param
   check; lower risk of silent drift than 1-3 because it's a hard boundary
   (throws, doesn't quietly succeed), but still worth confirming the 400
   path is exercised for *both* missing and malformed inputs, not just
   missing.
5. **[User-visible for non-English users, contractually significant for a
   multi-locale product] 4-locale nav completeness + correct label (§2
   invariant 5, §4f).** Missing key breaks navigation for non-en locales
   outright (raw i18next key strings are exactly the kind of unresolved
   internal token that should never reach a real user — a no-leak-at-boundary
   failure in its own right); wrong-but-present label is cosmetic but
   embarrassing and untestable by T6 alone.
6. **[New, currently-undocumented gap in the plan itself] DEC-6 concurrency
   relabel has no i18n key (§4b).** Not flagged anywhere in the technical
   plan's own change tables; recommend surfacing this back to the tech lead
   before build, not discovering it during implementation.
7. **[Latent, low-probability] DST day-boundary math (§4g).** Real but
   narrow (two days/year, silent truncation only); reasonable to accept as
   a follow-up test rather than a blocker, but worth a one-line ticket if not
   added now.

---

## Grounding notes

- No `PROJECT-CONTEXT.md` and no defect-class catalog exist for this
  project (confirmed directly, matching all four evaluators' own
  independent confirmation in the intake docs). Section 3 substitutes this
  project's own git history / persistent memory as the closest available
  substitute, per the task's own fallback instruction.
- Verified directly against current code (not assumed from the plan's
  prose): `client/src/components/FocusReportModal.tsx` header/structure,
  `server/routes/projects.js` lines ~211-236 (`GET /:id/focus-report`
  handler and its exact response shape), `server/lib/source-filter.js`'s
  documented convention and caller list, `client/src/lib/types.ts:1619-1620`
  (`FocusReport.project_id: string`, no `session_id` field today —
  confirms the widening is a real, needed change), `client/src/i18n/__tests__/i18n.test.ts`
  (confirms the existing `LOCALES`-driven completeness test is scoped only
  to the `report.calendar.*` key relocation, not a general nav-key
  completeness check — T6 is genuinely new, not an extension of existing
  coverage), and `client/src/components/Sidebar.tsx`'s `NAV_KEYS` array
  (line 96). No `focusCalendar` key exists in any of the four `nav.json`
  files today (confirmed by direct grep across all four locales).
- `git show 6e29722 --stat` confirms the precedent's actual shape: extraction
  into `client/src/lib/idleStripes.ts`, a 280-line extension to
  `FocusReportModal.test.tsx` (the "standing template" test), and a
  44-line addition to `i18n.test.ts` for the key-relocation completeness
  check — the exact pattern (extract + extend one permanent cross-view test
  + registry-driven i18n check) this change's own guardrails (§5 of the
  technical plan) claim to be reapplying.
