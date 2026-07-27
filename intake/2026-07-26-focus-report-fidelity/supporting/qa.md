# QA / Test Plan — Focus-Time Reporting Fidelity

Intake: `intake/2026-07-26-focus-report-fidelity/request-brief.md`

Test stack (from `CLAUDE.md`, confirmed by running both suites):
- Server: Node's built-in `node:test` runner via `npm run test:server`. Single
  spec: `node --test server/__tests__/focus-report.test.js` (or any other
  file under `server/__tests__/`).
- Client: Vitest + Testing Library via `npm run test:client` (or, for a
  single spec, `cd client && npx vitest run src/components/__tests__/FocusCalendarView.test.tsx`).
  Includes per-screen render snapshots
  (`client/src/pages/__tests__/screens.snapshot.test.tsx`) — regenerate with
  `cd client && npx vitest run -u` only after reviewing the diff, never blindly.
- No `PROJECT-CONTEXT.md` exists for this repo (confirmed absent at repo
  root and elsewhere), so there is no pre-named "must-stay-in-sync" surface
  to cross-check against formally — but this intake itself identifies one
  worth treating that way going forward (see "Regression coverage" below).

## 1. How we verify done

Manual (visual — this is a calendar/report UI; some things are only
checkable by looking at rendered output):
1. Open a project with at least one long-idle-tailed session (the round-3
   shape: a burst of activity then a long silent stretch before
   `ended_at`) in the Focus-Time Report modal.
2. **Calendar view** (already shipped, round 4): confirm the segment block
   shows a dark idle-stripe overlay over the quiet 10-minute chunks and a
   normal-color stripe over the active ones; hover the block and confirm
   the popup states both "Wall clock" and "Agent time" with different
   values; click the `</>` icon and confirm `SegmentEventsModal` opens with
   the same wall/agent figures in its header.
3. **List view** (the gap this intake targets): confirm the per-session bar,
   per-item rollup bar, and project-split bar visually communicate the same
   active/idle distinction the Calendar view now has — i.e., whatever the
   team decides to build (sizing bars by `active_ms` instead of `wall_ms`,
   and/or adding an idle-hatch/stripe treatment) is actually visible, not
   just computed and unused.
4. Cross-check: for the *same* underlying report object, Calendar-view and
   List-view numbers for a given session must agree (same wall_ms, same
   active_ms) — toggle List → Calendar → List in one modal open (no second
   fetch) and confirm the numbers shown in each don't disagree.
5. Pull one real project's focus report via `GET /api/projects/:id/focus-report`
   (or the dashboard UI) and manually inspect a session whose report shows
   a large `idle_ms` — confirm the event count in that segment's window
   (via the `</>` drill-down) genuinely looks sparse, i.e., the fix isn't
   just re-labeling the same misleading number.

Automated:
1. `npm run test:server` — must stay green; add cases per section 3 below.
2. `npm run test:client` — must stay green; add/extend `FocusReportModal.test.tsx`
   cases per section 3 below.
3. If `buildActivityChunks`/`inferredSegment`/`buildSessionFocusReport`
   boundary math changes, re-run both suites and specifically inspect the
   diff of any snapshot test touched (`screens.snapshot.test.tsx` does not
   currently render `FocusReportModal`/`FocusCalendarView`, so it's
   unlikely to be affected — confirm this stays true if the modal is added
   to a snapshot screen later).

## 2. Regression coverage

Current state — **ran both suites just now, genuinely green, not just
claimed**:
- `server/__tests__/focus-report.test.js` — 902/902 server tests pass
  overall (`npm run test:server`; this file's own suites are folded into
  that total, all passing, no failures/skips).
- `client/src/components/__tests__/FocusCalendarView.test.tsx` and
  `client/src/components/__tests__/FocusReportModal.test.tsx` — both pass
  as part of 403/403 client tests (`cd client && npx vitest run`).
- `client/src/lib/__tests__/eventBuckets.test.ts` (6 tests) and
  `client/src/lib/__tests__/calendarLanes.test.ts` (8 tests, new/untracked
  this session) — both pass.
- `server/__tests__/focus-inference.test.js` (new/untracked this session,
  covers the background classifier that feeds `inferredSegment`) — passes
  as part of the same server run.

What's actually covered today, by file:
- `server/lib/focus-report.js`:
  - `buildFocusSegments` — segment reconstruction from Focus events (set/
    push/pop/done, nesting, ignored no-ops): well covered.
  - `activeIdleMs` (idle-grace discount) — well covered, several grace
    values and edge cases.
  - `buildActivityChunks` — well covered as a pure function (malformed
    span, active/idle flagging, last-chunk shortening, no grace credit).
  - `buildSessionFocusReport` **applied to a chunk-bearing declared
    segment** — one test ("marks only the chunks with real activity...").
  - `buildProjectFocusReport` / `mergeIntervals` — well covered (rollup,
    sort order, concurrency ratio, wall-clock union).
  - **Gap**: `inferredSegment` itself (the fallback path for a session with
    zero declared Focus events, reading `focus_inferences`) has **no test
    in `focus-report.test.js`** — not for the `item` branch, not the
    `detour` branch, not the "item since deleted" / "unclassified" null
    returns, and critically not for what `buildSessionFocusReport` computes
    (`wall_ms`/`active_ms`/`idle_ms`/`chunks`) when it's fed an
    *inferred* segment that rides a long idle tail to `ended_at` — exactly
    the round-3 bug's shape. This is the single most important regression
    hole given this feature's history: the round-3 complaint was about a
    number that runs session-start-to-`ended_at` regardless of real work,
    and that's structurally *most* true for inferred (not declared)
    segments, which is the one path with zero test coverage.
- `client/src/components/FocusCalendarView.tsx` — well covered (lanes,
  inferred/live styling, idle stripes, wall/agent popup text, events-modal
  handoff).
- `client/src/components/FocusReportModal.tsx` — well covered for stat
  tiles, inferred chip, view-mode toggle — but **zero assertions on the
  actual numeric sizing/values of `ListView`'s three `SegmentedBar`
  instances** (per-session, per-item, project-split). No test currently
  checks that a bar's rendered width or displayed duration reflects
  `active_ms` vs `wall_ms`, so a fix that changes `ListView`'s sizing basis
  (or fails to) would not be caught by the existing suite.

## 3. New/updated tests required

### A. `server/__tests__/focus-report.test.js` — close the `inferredSegment` gap
Add a new `describe("inferredSegment / buildSessionFocusReport - inferred fallback")`
block that seeds a `focus_inferences` row directly (via
`db.prepare("INSERT INTO focus_inferences ...")`, mirroring how
`focus-inference.test.js` seeds it) for a session with **no** Focus events,
then calls `buildSessionFocusReport`:
1. `item`-kind inference resolves to the plan item's *current* display
   number and text (mirrors the existing declared-segment "stale text"
   check in `buildProjectFocusReport`'s test, but for the inferred path).
2. `detour`-kind inference produces a `detour` segment with `item_number: null`.
3. Deleted-item inference (`item_id` no longer resolves via
   `getPlanItemById`) returns `null` and the session ends up with zero
   segments — same as "never declared focus" today.
4. **The round-3 regression case**: an inferred segment with a burst of
   activity in the first ~20 minutes, then nothing until `ended_at` ~100
   minutes later — assert `wall_ms` spans the whole gap (~120m) but
   `active_ms`/`chunks` correctly show only the first chunks as active,
   i.e. assert the same invariant the existing "activity chunks" describe
   block already checks for a *declared* segment, but for the inferred
   fallback path specifically (`inferred: true`).
5. `unclassified`/no-row → `inferredSegment` returns `null`, `buildSessionFocusReport`
   falls through to the empty-segments shape (already covered generically,
   add one inference-specific case for completeness).

### B. `client/src/components/__tests__/FocusReportModal.test.tsx` — List view parity
Whatever the concrete display change (size bars by `active_ms`, or an idle-
hatch overlay on `SegmentedBar` mirroring Calendar's idle stripe), the new
assertions should be:
1. A session/segment whose `wall_ms` and `active_ms` diverge (e.g.
   `wall_ms: 120m, active_ms: 20m`) renders a per-session bar and/or
   duration label that reflects `active_ms`, not the inflated `wall_ms` —
   assert on the rendered text (e.g. `formatMs(active_ms)` appears) and/or
   the segment's rendered width (`style.width` proportional to `active_ms`)
   depending on which sizing basis the team picks.
2. Same assertion repeated for the per-item rollup bar
   (`kindTotalsAsSegments`/`FocusKindTotals`) and the project-split bar —
   these are the two other consumers named in the brief, so a single fixed
   `ListView` bar without the other two updated should fail this test.
3. **Cross-consumer consistency test** (this is the "recurring-defect
   surface" the brief flags): render both List and Calendar view from the
   *same* mocked report and assert the duration text shown for the same
   session's same segment matches between the two view modes (e.g. both
   show "Agent time: 23m 0s" for the same segment) — this is the concrete
   regression test that would have caught round 4 only fixing one of the
   two consumers, and should be kept indefinitely as the two-views-must-
   agree guard for this feature.
4. If idle striping is added to `SegmentedBar`, mirror
   `FocusCalendarView.test.tsx`'s two idle-stripe tests (`data-testid="idle-stripe"` present only for
   the idle chunk / absent when all chunks are active).

### C. If `inferredSegment`'s end-boundary computation changes
(e.g., clipping the inferred segment's end to the last real event + grace,
rather than riding all the way to `ended_at`/now) — see risk analysis below
for what this affects. New tests to add regardless of the exact boundary
chosen:
1. An inferred segment where the last real event happens well before
   `ended_at` — assert `end` (and therefore `wall_ms`) reflects the new
   boundary rule, not the raw `ended_at`.
2. An inferred segment where the last real event happens right at (or
   after) `ended_at` — assert no regression (end still clips to `ended_at`,
   never extends past it).
3. A session with **zero** events at all (inference exists but nothing was
   ever logged) — assert this doesn't throw and produces a sane
   (likely zero-length or `null`) segment rather than `NaN`/negative
   durations.
4. Re-run `buildProjectFocusReport`'s existing concurrency/wall-clock-union
   tests unmodified — they rely on `report.segments[0].start` /
   `report.segments[last].end` bookending a session's span
   (`buildProjectFocusReport`'s own comment: "gapless by construction").
   If a boundary change makes an inferred segment's `end` no longer equal
   the session's true last activity, this assumption could silently break
   the wall-clock-union math for sessions that fall back to inference —
   add a project-level test combining one declared session and one
   whole-session-inferred session to confirim `wall_clock_ms` still unions
   correctly.

## 4. Test data / fixtures

Server (`focus-report.test.js` patterns to reuse):
- `stmts.upsertPlan` / `stmts.upsertPlanItem` for plan/item fixtures (already
  seeded for `CWD`/`CWD2` in the `before()` hook — add a `focus_inferences`
  insert helper alongside the existing `insertFocusEventRaw`/`insertPlainEventRaw`
  raw-SQL helpers, following `focus-inference.test.js`'s own seeding pattern
  for that table).
- The `t(minutesFromStart)` helper for deterministic, gap-exact timestamps —
  reuse directly for the round-3-shape fixture (events at minute 1/4/8,
  `ended_at` at minute 130, mirroring the existing declared-segment chunk
  test at line ~386-411 but with an inference row instead of a `Focus` "set"
  event).
- `DASHBOARD_FOCUS_IDLE_GRACE_SECONDS` env var — set to `0` when isolating
  boundary/chunk math from grace-window credit (existing project-report
  tests already do this).

Client (`FocusReportModal.test.tsx` / `FocusCalendarView.test.tsx` patterns):
- `makeReport()` factory in `FocusReportModal.test.tsx` — extend with a
  segment where `wall_ms` and `active_ms` diverge (it currently only has
  segments where they're equal — `30m/30m` and `10m/10m` — which is exactly
  why the existing suite can't currently distinguish "sized by wall_ms" from
  "sized by active_ms"). Add `chunks` to at least one fixture segment too
  (currently `FocusReportModal.test.tsx`'s fixtures never set `chunks` at
  all, unlike `FocusCalendarView.test.tsx`'s idle-stripe tests which do).
- `FocusCalendarView.test.tsx`'s existing `todayAt()`/`yesterdayAt()` +
  `chunks: [...]` fixture pattern (see the two idle-stripe tests near the
  end of the file) is the direct template for any List-view idle-stripe
  parity test.

## 5. Definition of Done checklist

- [ ] `npm run test:server` green (currently 902/902 — re-confirm after any change).
- [ ] `npm run test:client` green (currently 403/403 — re-confirm after any change).
- [ ] New `inferredSegment`/inferred-fallback test block added to
      `server/__tests__/focus-report.test.js` and passing (section 3A).
- [ ] List view (per-session, per-item, project-split bars) demonstrably
      uses/displays `active_ms` (or an equivalent idle-aware treatment),
      with new assertions in `FocusReportModal.test.tsx` (section 3B) —
      not just changed in source with no test catching a revert.
- [ ] Cross-view consistency test added (List vs. Calendar agree on the same
      segment's numbers) and passing — this is the regression guard for the
      exact "fixed one consumer, not the other" failure mode this intake
      exists because of.
- [ ] If `inferredSegment`'s end-boundary computation changed: boundary
      tests (section 3C) added, and `buildProjectFocusReport`'s wall-clock-
      union tests re-verified against a mixed declared+inferred session set.
- [ ] Manual visual check performed on at least one real project with a
      long-idle-tail session, in both List and Calendar view (section 1,
      steps 1-5) — not just automated coverage, since this is a rendering-
      fidelity complaint.
- [ ] `bash .claude/skills/file-headers/scripts/check-headers.sh` passes for
      every new/modified source file (all touched files here already carry
      the required header per the files read during this pass).
- [ ] Docs updated per `update-project-docs` skill if the List view's visible
      behavior changes (this repo's `docs/API.md`/`ARCHITECTURE.md` already
      reference the round-4 Calendar changes per current `git status`; a
      List-view change of the same kind should get the same doc treatment).
