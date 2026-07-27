# Build Report — focus-calendar-board

> Authored by `build-lead`, synthesizing the build brief, task list, red/green
> evidence, verifier's report, and the orchestrator's manual click-path pass.
> The document the user reads. This build **stopped at green** — it did not
> commit, push, or open a PR.

## What was built

A new first-class sidebar page, **Calendar** (route `/focus-calendar`, sits
directly after "Projects"), that renders the existing focus-time
List/Calendar report across every monitored project at once, filterable by
three fully independent controls — project (optional), session (always the
full global list, never narrowed by project), and time period (day nav
defaulting to "today," plus a custom date range). It's powered by a new
aggregate route, `GET /api/focus-report`, which requires explicit `from`/`to`
bounds (400s otherwise, no hidden server-side default window) and is a thin
session-selection layer in front of the existing, byte-unmodified
`buildProjectFocusReport`/`buildSessionFocusReport`. The pre-existing
per-project modal (`FocusReportModal.tsx`, opened from `Projects.tsx` and
`KanbanBoard.tsx`) is untouched behaviorally — its rendering chrome
(stat-tiles, List/Calendar toggle, list body) was extracted into a new shared
`FocusReportBody.tsx`/`FocusReportViewToggle` that both the modal and the new
board now consume, and a shared `calendarWindow.ts` now holds the one
day-boundary (`startOfDay`/`DAY_MS`) implementation used by all three
day-aware components. This deliberately closes, a second and third time
today, the exact "one value/rendering computed once, consumed by two
independent surfaces with no shared helper or test" shape (informally named
`DERIVED-DUAL-VIEW` on this project — see below) that this repo's own
`6e29722` fixed reactively this morning. All 4 locale files (`nav.json` +
`plan.json`, en/zh/vi/ko) gained the new nav label and DEC-6's relabeled
"Concurrent agent sessions" copy in one atomic step. `docs/API.md`,
`ARCHITECTURE.md`, `README.md`, and `client/README.md` were updated to
describe the new endpoint and page.

## Change verdict

**Verdict:** GREEN

**Durable cure:** Applied — informal catalog id **`DERIVED-DUAL-VIEW`** (no
`PROJECT-CONTEXT.md`/formal defect catalog configured for this project; both
this build's plans and this morning's sibling build converged independently
on this same name). All five `MANDATORY [DERIVED-DUAL-VIEW]` obligations from
`build-task-list.md` were independently verified applied, not just claimed:
one computation path (new route feeds the unmodified `buildProjectFocusReport`,
pinned by a split-parity test, re-confirmed by an empty `git diff` on
`focus-report.js`/`projects.js`); one day-boundary helper
(`calendarWindow.ts`, imported by all three day-aware components, never
redefined); one rendering-chrome implementation (`FocusReportBody.tsx`,
consumed by both the modal and the new board, no copy-pasted JSX); atomic
4-locale i18n landing (all 4 locale files, both `nav.json`/`plan.json`, in
one change-set, mechanically guarded by a registry-driven test); and a
byte-identical snapshot fence proving the chrome extraction leaked nothing
into the two pre-existing entry points (`Projects`/`Kanban board` snapshot
cases are byte-identical to their pre-change baseline).

The verifier's own pass landed **GREEN-WITH-CAVEATS**, with the single named
caveat being test-plan.md's DoD item 12 — the manual click-path pass against
a real `npm run dev` stack — not yet having been run. The orchestrator then
ran that pass directly (`supporting/manual-verification.md`): **PASS**,
including an explicit re-check of DEC-2 filter independence and DEC-6's
relabeled copy in the live UI, plus a Chinese-locale spot-check. That caveat
is resolved, so this report's headline verdict is GREEN, not
GREEN-WITH-CAVEATS — with one non-blocking UX gap flagged below for Sara's
awareness (not a defect, not a regression, out of this build's approved
scope).

## Red -> green evidence

Round 1 (new feature, pre-implementation) — every case below was run against
the wholly-unbuilt worktree and confirmed red for the stated reason (module
missing / route unmounted / prop ignored / key absent), then re-run green
after the corresponding implementation task landed, with the same test
identity (path + assertion) in both passes:

| Test file | Layer | RED before | GREEN after |
|---|---|---|---|
| `server/__tests__/focus-report-route.test.js` (new, 21 cases) | integration (server) | Route unmounted -> 404s where 400/200 expected; unstructured HTML 404 body where structured JSON expected | 21/21 pass, incl. both split-parity groups vs. the old route |
| `client/src/components/__tests__/FocusReportModal.test.tsx` | component | Suite failed to load — `../FocusReportBody` unresolved (module doesn't exist) | 19/19 pass (18 pre-existing byte-unmodified + 1 new board-mode-parity test) |
| `client/src/components/__tests__/FocusCalendarView.test.tsx` | component | 18 tests, 15/18 (3 of 5 new-block cases red: `selectedDate`/`hideDateNav`/`projectLabelForCwd` all ignored) | 18/18 pass |
| `client/src/components/__tests__/TimePeriodPicker.test.tsx` (new) | component | Suite failed to load — module doesn't exist | 6/6 pass round 1; +1 new bug-guard case (round 2, see below) = 8 total, 7 pass/1 red then fixed |
| `client/src/i18n/__tests__/i18n.test.ts` | i18n registry | 25 tests, 15/25 (10 red — `nav:focusCalendar` + `report.board.concurrentSessions` missing in all 4 locales) | 25/25 pass |
| `client/src/components/__tests__/Sidebar.test.tsx` | component | 12 tests, 9/12 (3 red — no Calendar nav entry/href/position) | 12/12 pass |
| `client/src/pages/__tests__/FocusCalendarBoard.test.tsx` (new) | page | Suite failed to load — module doesn't exist | 9/9 pass round 1; +1 coverage test (round 2) = 10/10 |
| `client/src/pages/__tests__/screens.snapshot.test.tsx` | snapshot | Suite failed to load — cascaded from missing `FocusCalendarBoard` import (all 13 cases, incl. 12 pre-existing, swept in) | 13/13 pass; `Projects`/`Kanban board` cases byte-identical to pre-change baseline (verified by diff, not just re-run) |

Round 2 (build-reviewer's follow-up, post-implementation) — the reviewer
found one real bug and two coverage gaps against the test-plan's own T3(g)/T7
items:

| Test | Layer | RED before | GREEN after |
|---|---|---|---|
| `TimePeriodPicker.test.tsx` — "clearing the start date input to an empty string does not silently emit a garbage fallback date such as 1900-01-01" | component | **RED, genuine bug**: `parseDateInputValue`'s `Number("") === 0` (not `NaN`) meant the `??` nullish-coalescing fallback never fired, silently emitting a ~1900 date on an empty date input | Fixed narrowly in `TimePeriodPicker.tsx`; re-verified green |
| `TimePeriodPicker.test.tsx` — T7 full range-of-motion via real `change` events | component | Flagged green-on-first-run (not weakened) — genuine, non-vacuous new coverage of already-correct behavior | Stayed green; kept as permanent regression coverage |
| `FocusCalendarBoard.test.tsx` — T3(g) custom-range re-fetch spans the full selected range | page | Flagged green-on-first-run (not weakened) — same, already-correct behavior, now guarded | Stayed green; kept as permanent regression coverage |

Both round-2 "unexpectedly green" cases were checked for vacuousness by the
test author and the verifier independently and found to be genuine,
non-trivial assertions (pinning concrete `Date` values / concrete `from`/`to`
window bounds), not weakened to force a pass.

**Full-suite counts (final):** `npm run test:server` 934/934 pass (206
suites); `npm run test:client` 471/471 pass (39 files); `cd client && npx tsc
--noEmit` clean; `bash .claude/skills/file-headers/scripts/check-headers.sh`
exit 0.

## Files changed

Diff against starting commit `0ef79b378e0de180155bc5549643760230d9dc2a`, one
repo (`Claude-Code-Agent-Monitor`):

**Tracked files modified** (`git diff --stat`):
```
 ARCHITECTURE.md                                              |  29 +-
 README.md                                                    |   3 +-
 client/README.md                                             |  49 ++-
 client/src/App.tsx                                            |   3 +
 client/src/components/FocusCalendarView.tsx                  | 119 ++++---
 client/src/components/FocusReportModal.tsx                   | 377 +--------------------
 client/src/components/Sidebar.tsx                             |   4 +
 client/src/components/__tests__/FocusCalendarView.test.tsx   | 128 ++++++-
 client/src/components/__tests__/FocusReportModal.test.tsx    | 127 +++++++
 client/src/components/__tests__/Sidebar.test.tsx              |  23 +-
 client/src/i18n/__tests__/i18n.test.ts                        |  42 +++
 client/src/i18n/locales/{en,ko,vi,zh}/nav.json                |   1 + (each)
 client/src/i18n/locales/{en,ko,vi,zh}/plan.json               |  12 + (each)
 client/src/lib/api.ts                                         |  32 ++
 client/src/lib/types.ts                                       |  14 +-
 client/src/pages/__tests__/__snapshots__/screens.snapshot.test.tsx.snap | 179 ++++++++++
 client/src/pages/__tests__/screens.snapshot.test.tsx          |  40 +++
 docs/API.md                                                   |  41 +++
 server/index.js                                               |   5 +
 25 files changed, 855 insertions(+), 412 deletions(-)
```

**New files** (untracked; not counted in `git diff --stat` above):
```
   454  client/src/components/FocusReportBody.tsx
   152  client/src/components/TimePeriodPicker.tsx
   176  client/src/components/__tests__/TimePeriodPicker.test.tsx
    23  client/src/lib/calendarWindow.ts
   211  client/src/pages/FocusCalendarBoard.tsx
   396  client/src/pages/__tests__/FocusCalendarBoard.test.tsx
   424  server/__tests__/focus-report-route.test.js
   117  server/routes/focus-report.js
```

`server/lib/focus-report.js` and `server/routes/projects.js` — the two files
the durable cure requires stay untouched — show **zero** diff (`git diff
--stat` against the starting commit is empty for both), independently
confirmed by the verifier.

## Standing guards + Definition of Done

- [x] Each new test observed RED before, GREEN after (round 1: 8 files; round
      2: 1 genuine bug fixed red-first, 2 flagged-green coverage additions)
- [x] Full relevant suites green: server 934/934, client 471/471
- [x] `MANDATORY [DERIVED-DUAL-VIEW]` — one computation path, one
      day-boundary helper, one rendering-chrome implementation, atomic
      4-locale i18n, byte-identical snapshot fence — all 5 independently
      verified, not taken on the build task list's word
- [x] `MANDATORY [DEC-2]` filter independence — asserted on rendered
      `<select>` displayed values, not just mocked fetch args (both in
      automated tests and in the orchestrator's live manual pass)
- [x] `MANDATORY [DEC-3]` no hidden time-window default — `from`/`to`
      required, 400 otherwise, no env knob
- [x] Build/typecheck clean (`tsc --noEmit`), file-header audit exit 0
- [x] technical-plan.md §9 DoD: all 15 items MET
- [x] test-plan.md DoD: 14/15 MET automatically; item 12 (manual click-path)
      was NOT MET at verifier time, now resolved by
      `supporting/manual-verification.md` (PASS)

## Worktree & stack

- **Worktree path:** `/Users/sara/CODE-LOCAL/SARA/efforts/2026-07-26-focus-calendar-board/Claude-Code-Agent-Monitor`
  (branch `effort/2026-07-26-focus-calendar-board`) — this is where Sara
  reviews and commits this change, **not** the shared/main checkout at
  `/Users/sara/CODE-LOCAL/SARA/Claude-Code-Agent-Monitor`.
- **Docker stack:** none provisioned for this effort (deliberate — both
  compose files at the repo root describe a production-style deployment, not
  this effort's test/verification loop; see `build-brief.md`). Verification
  ran via `npm run test:server`/`npm run test:client` plus a manual
  `npm run dev` pass, backend on `:4820` / client on `:5174` (auto-selected
  since `:5173` was busy with the main checkout's own dev server — no port
  collision, no shared state mutated beyond read-only queries against the
  real dashboard DB). That dev server is not left running by this skill;
  restart it in the worktree if you want to poke at it live again.

## Residual risk & back-out

- **Watch:** the informal `DERIVED-DUAL-VIEW` pattern has now surfaced 3
  times in one day across two related builds in this repo (this morning's
  `focus-report-fidelity` sibling build, twice within it, plus this build's
  third extension of the same surface). No formal `PROJECT-CONTEXT.md`
  defect catalog exists for this project to record that against — worth
  Sara considering whether to formalize one with a `DERIVED-DUAL-VIEW` entry,
  though that's a call for Sara to make, not this skill's to make
  unilaterally.
- **Non-blocking UX gap (flagged, not fixed, out of approved scope):** when
  "Custom range" is active on the new Calendar page, the Calendar (swimlane)
  view has no in-range day navigation — it pins to the range's first day with
  `hideDateNav={true}`, so if that first day has no activity the Calendar
  view shows "No activity on this day" with no way to page to the range's
  other days (the List view, same filters, correctly shows all of them; a
  user would need to switch to List view or narrow to "Single day" and step
  through manually). Not a crash, not a data-correctness bug, not in either
  plan's stated scope for Calendar-view-within-a-range behavior — a
  reasonable v1 gap, not a regression of anything promised.
- **Deferred (accepted, non-gating):** the test-plan's own "Durable-cure
  decision" section explicitly defers building a shared, generalized
  parity-assertion test helper (for the report-body/envelope split-compare
  pattern used in the new route's tests) — a stated, accepted deferral, not a
  gap this build introduced.
- **Old route's `?sources=`-ignoring gap** on the pre-existing focus-report
  route was deliberately left unfixed (per DEC-4/both plans), confirmed still
  present by an explicit side-by-side test case — tracked as a separate
  future follow-up, not this build's concern.
- **Back-out:**
  ```
  git -C /Users/sara/CODE-LOCAL/SARA/efforts/2026-07-26-focus-calendar-board/Claude-Code-Agent-Monitor reset --hard 0ef79b378e0de180155bc5549643760230d9dc2a
  ```

## Open decisions

All 6 decisions in `decisions.md` are **DECIDED** — none open or pending for
Sara on this build's own scope. The one item genuinely awaiting Sara's
attention is not a decision-log entry but the UX gap and the
catalog-formalization question both noted above.

## Next step

Stops at green. **Sara reviews the diff in the worktree above and
commits/pushes/opens a PR — or hands it back for changes.** This skill does
not commit. It does not tear down the worktree or any Docker stack — none was
provisioned for this effort, and the worktree stays live until whoever merges
this runs the manual teardown (`git worktree remove` after landing the
change, plus deleting the effort branch once merged).
