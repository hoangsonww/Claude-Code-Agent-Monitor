# Test Plan — focus-report-fidelity (List-view parity)

> Authored by `qa-lead`, synthesizing Coverage + Risk + Unit + E2E findings. The QA
> deliverable: exactly what tests to add/modify. Detailed enough to implement
> without re-investigating. (Plan only — a separate step, `team-build`, writes
> the tests and the product code.)

## Objective

Close two zero-coverage gaps this change lands on, both already-demonstrated
recurring failure modes in this project this session: (1) `inferredSegment()`
in `server/lib/focus-report.js` — the exact function behind the round-3
data-fidelity bug — has never had a dedicated test; and (2) the List view
(`FocusReportModal.tsx`) and Calendar view (`FocusCalendarView.tsx`) render the
same server-computed `wall_ms`/`active_ms`/`chunks` facts with no shared
rendering helper and no test enforcing they agree — the exact gap that let
round 4 ship an idle-aware fix into Calendar only, leaving List stale and
internally self-contradicting (a bar labeled with `active_ms` but sized by
`wall_ms`). End state after this plan: `inferredSegment()`'s five branches
(item-kind, detour-kind, deleted-item, unclassified, idle-tail) are pinned;
the two aggregate bars' sizing basis is guarded against ever silently
reverting to `wall_ms` (including a near-zero-`active_ms` case); the extracted
`idleStripesInRange` helper has its own unit tests independent of either
component; a permanent List-vs-Calendar cross-view consistency test exists so
a future fix landing in only one view is caught before it ships; and the
i18n key relocation is a structural, per-locale completeness check, not a
human eyeball-scan. No server behavior changes in this pass — all new server
test coverage is coverage-only, pinning already-correct behavior.

## Coverage gap being closed

No `PROJECT-CONTEXT.md`/defect-catalog exists for this repo. The de facto
catalog id in play, per `risk.md`/`qa-assessment.md`, is **DERIVED-DUAL-VIEW**
("a duration value computed once server-side, rendered by two independent
client surfaces, with no shared helper and no test enforcing agreement") —
cited below wherever it applies.

- `server/lib/focus-report.js` `inferredSegment()` — **no catalog id** (this
  is the original round-3 bug's own function, zero coverage) — pinned by 5
  new cases in a dedicated `describe` block, closing the "declared-only
  seeding convention never reaches the fallback branch" structural cause.
- `FocusReportModal.tsx` List view's per-session idle-stripe overlay + dual
  header split — **DERIVED-DUAL-VIEW** (within-component variant: label vs.
  bar disagreement) — pinned by new idle-stripe and header-split assertions.
- `FocusReportModal.tsx`'s two aggregate bars (`active_ms` sizing) —
  **DERIVED-DUAL-VIEW** (the embedded bug: printed number already reads
  `active_ms`, bar reads `wall_ms`) — pinned by a direct sizing assertion,
  including the near-zero-`active_ms` fixture case `risk.md` explicitly
  requires so the bar can't silently revert to `wall_ms` sizing later.
- List-vs-Calendar cross-view consistency — **DERIVED-DUAL-VIEW**, direct hit,
  the highest-priority test in this whole plan — currently doesn't exist at
  all; pinned by one new cross-view test.
- `idleStripesInRange` as a standalone lib unit — **DERIVED-DUAL-VIEW**
  prevention (guards the *shared helper itself* doesn't drift once it has two
  consumers) — pinned by a new `idleStripes.test.ts`, including two fixtures
  ported byte-for-byte from `FocusCalendarView.test.tsx` as a same-input/
  same-output pin.
- i18n key relocation (`report.calendar.*` → `report.*`, 4 locales) — no
  catalog id, but the closest analog to a "no-leak boundary" invariant this
  change has (a missed locale silently renders a raw i18n key string) —
  pinned by a registry-derived, per-locale completeness check.

## Test change set

This project has three test layers (discovered from `package.json` / test
directories, no `PROJECT-CONTEXT.md` configured): **server** (`node --test`,
one flat unit/integration layer), **client component** (Vitest + Testing
Library), **client lib unit** (Vitest, pure functions, no DOM). No e2e/browser
layer exists (no Playwright/Cypress config, confirmed by the e2e architect) —
none is being added; the cross-view "flow" proof stays in the client
component layer per the e2e architect's explicit finding, which this plan
adopts without change.

**Server (`node --test`)**

- `server/__tests__/focus-report.test.js` — **add** one new `describe`
  block, `describe("inferredSegment / buildSessionFocusReport - inferred
  fallback", ...)`, inserted between the existing `"buildSessionFocusReport -
  activity chunks"` block (ends line 412) and `"buildProjectFocusReport"`
  (starts line 414) — this slot inherits the file's untouched default idle
  grace (`DEFAULT_GRACE_SECONDS`), no env var override needed. **Do not** set
  `DASHBOARD_FOCUS_IDLE_GRACE_SECONDS` in this block.
  - Case 1 — item-kind inference resolves to the plan item's *current*
    `item_number`/text via `getPlanItemById` (not a stale snapshot): seed one
    `activity()` event + `upsertFocusInference.run(id, CWD, "item", "item-4",
    null, 0.9, "llm", "matched auth work")`; assert `seg.item_number === 4`,
    `seg.label === "Migrate auth"`, `seg.inferred === true`,
    `seg.inferred_reason === "matched auth work"`.
  - Case 2 — detour-kind inference: `upsertFocusInference.run(id, CWD,
    "detour", null, "CI pipeline fix", 0.8, "llm", "no item covers CI")`;
    assert `seg.kind === "detour"`, `seg.item_number === null`, `seg.label ===
    "CI pipeline fix"`.
  - Case 3 — deleted-item inference (`item_id: "item-does-not-exist"`) →
    `assert.deepEqual(report.segments, [])` — must not fabricate a segment
    with a garbage `item_number`.
  - Case 4 — unclassified verdict (`kind: "unclassified"`, real row present)
    → `assert.deepEqual(report.segments, [])` — pins the early-return before
    the `item`/`detour` `if` chain, distinct from the pre-existing
    no-inference-row-at-all case.
  - Case 5 (**highest-value**) — round-3-shaped idle tail via the inference
    path: `activity()` bursts at minutes 1/4/8, `ended_at: t(130)`, one `item`
    inference row. Assert `seg.wall_ms === 130 * 60_000`, `seg.active_ms <
    seg.wall_ms`, `seg.chunks.length === Math.ceil((130*60_000)/CHUNK_MS)`,
    `seg.chunks[0].active === true`, every later chunk `active === false`.
  - All cases seed via the file's existing `seedSession`/`focus`/`activity`/
    `t`/`nextId` helpers and `stmts.upsertFocusInference.run(sessionId, cwd,
    kind, item_id, label, confidence, method, reason)` — do not introduce a
    parallel seeding helper.

**Client component (Vitest + Testing Library)**

- `client/src/components/__tests__/FocusReportModal.test.tsx` — **update**
  fixture + **add** 4 new tests + one near-zero fixture case:
  - Update `makeReport()`'s base fixture (lines 23-94) so segment 1 (`item`,
    4, "Migrate auth") has `wall_ms: 30m, active_ms: 20m, idle_ms: 10m`, with
    a 3-chunk `chunks` array (first two chunks `active: true`, last `active:
    false`); segment 2 (`bug`, "npm conflict") stays `wall_ms === active_ms
    === 10m`, **no `chunks` field at all** (this is what exercises the
    "no-chunks → no-stripe" guard). Recompute `items[0].totals`,
    `by_kind.item`, `by_kind.bug`, and project-level `totals.active_ms` to
    match (see `unit-tests.md` §2.1 for the exact arithmetic). Leave
    `totals.wall_ms` (50m) and `totals.idle_ms` (10m) untouched — unrelated
    tests depend on those exact values.
  - **Update** the existing "computes the on-item percentage" assertion
    (line ~138-149): `"75%"` → `"67%"`, `"25%"` → `"33%"`
    (`Math.round(20/30*100)=67`, `100-67=33`). This is a deliberate,
    plan-called-out side effect of the fixture change, not a regression to
    investigate.
  - **Add** — per-session header shows a labeled wall-clock/agent-time split
    when they diverge, a plain single number when they don't: push a second
    session (`"NoIdle"`, `wall_ms === active_ms === 15m`) alongside the
    existing `"Worker"` session (`wall_ms 40m / active_ms 30m` after the
    fixture update); assert `"Worker"`'s row contains both `/40m 0s/` and
    `/30m 0s/`; assert `"NoIdle"`'s row contains exactly `"15m 0s"` and
    `queryByText(/30m 0s|40m 0s/)` is null.
  - **Add** — per-session bar overlays exactly one idle stripe, only for the
    segment carrying a `chunks` field: assert
    `container.querySelectorAll('[data-testid="idle-stripe"]')` has length 1
    (not 2 — segment 2 has no `chunks`, so no stripe for it); assert that
    stripe's `left`/`width` (`parseFloat(...).toBeCloseTo(...)`, not string
    equality — this fixture's 1/3 split produces a repeating decimal) equal
    `(20/30)*100` and `(10/30)*100`. Add a second, dedicated "renders no idle
    stripe" case using a single-segment, no-`chunks` fixture, asserting
    stripe count `0` — mirrors `FocusCalendarView.test.tsx`'s own convention
    of a separate negative-case test, not folding it into the positive case.
  - **Add** — per-item rollup bar and project-split bar sized by `active_ms`,
    matching their already-correct printed number (**the direct regression
    test for the embedded bug**): assert both bars' per-kind slice widths are
    `(20/30)*100` (`item`) and `(10/30)*100` (`bug`), not the `wall_ms`-based
    75/25. Requires the implementer add `data-kind={seg.kind}` on every
    `SegmentedBar` slice and `data-testid="segmented-bar-{session|item-rollup|
    project-split}"` on the three call sites (no such hooks exist today);
    fallback selector if the implementer declines the `data-testid`s:
    `.h-3 > div` / `.h-6 > div` (the rollup/split bars' distinguishing height
    classes) — state which approach was taken in the PR.
  - **Add (required — do not drop)** the near-zero-`active_ms` fixture case
    `risk.md` explicitly calls for: inject a third kind (e.g. `detour`) into
    `items[0].totals.by_kind` and `report.totals.by_kind` with a large
    `wall_ms` (e.g. 20m) and a near-zero `active_ms` (e.g. 1000ms), added on
    top of the existing item/bug totals. Assert that kind's rendered slice
    width is near-0 (e.g. `toBeLessThan(2)` as a percentage), **not** the
    ~40% a `wall_ms`-proportional width would produce. Without this case, a
    future contributor reverting the aggregate bars to `wall_ms` sizing would
    still pass every other assertion in this file — this is the one case
    that specifically pins "the sizing basis switched," not just "the
    numbers happen to be right for this fixture."
  - **Add** — the cross-view (List vs. Calendar) consistency test, the
    single highest-priority test in this plan: build one single-segment
    session dated "today" (adapt `FocusCalendarView.test.tsx`'s
    `NOW`/`todayAt()` pattern locally, scoped to this one test with
    `vi.useFakeTimers()`/`vi.setSystemTime`/`vi.useRealTimers()` in a
    `try/finally` — do not add fake timers file-wide, every other test in
    this file uses literal 2026-06-10 timestamps) with `wall_ms: 20m,
    active_ms: 10m, idle_ms: 10m`, two 10-minute chunks (first active, second
    idle). Render the modal, assert the List view's per-session header
    contains both `/20m 0s/` and `/10m 0s/`, and exactly one
    `idle-stripe` at `left ≈ 50%, width ≈ 50%`. Then `fireEvent.click
    (screen.getByTitle("Calendar"))` (assert `focusReportMock` still called
    only once total — no second fetch), `fireEvent.mouseEnter` the block,
    assert the hover popup contains the **same two numbers** (`/20m 0s/`,
    `/10m 0s/`) and exactly one idle stripe at `top ≈ 50%, height ≈ 50%`.
    Single-segment, single-session is deliberate: it's the only shape where
    "the same segment's numbers" is unambiguous between List's
    per-session-summed header and Calendar's per-block popup.

- `client/src/components/__tests__/FocusCalendarView.test.tsx` — **no
  assertion changes.** This file is the regression gate for the
  `idleStripesForBlock` → `idleStripesInRange` extraction: run it after the
  extraction step and again after the i18n relocation step. If any assertion
  needs touching, stop — treat that as a live regression signal against
  round 4's still-uncommitted fix, not a refactor detail, per the plan's own
  Definition of Done.

**Client lib unit (Vitest, pure functions, no DOM)**

- `client/src/lib/__tests__/idleStripes.test.ts` — **new file**, sibling in
  location/shape to `calendarLanes.test.ts`/`eventBuckets.test.ts`. Tests for
  `idleStripesInRange(chunks, rangeStartMs, rangeEndMs)`:
  - Returns `[]` for `undefined` chunks and for `[]` chunks.
  - Returns `[]` for a zero-length or inverted (`start >= end`) range.
  - Returns one stripe per idle chunk, in `{offsetPct, spanPct}` percent-
    of-range coordinates, skipping active chunks; assert the exact returned
    key set is `["offsetPct", "spanPct"]` (guards against a silent field-name
    revert to the old `topPct`/`heightPct`).
  - Clips a chunk that only partially overlaps the range to the visible
    portion (`offsetPct: 0, spanPct: 50` for a chunk half-outside/half-inside
    a 10-minute range).
  - Drops an idle chunk entirely outside the range (`[]`).
  - Orientation-agnostic: identical output fractions regardless of the
    range's absolute epoch (same relative chunks at two different epochs
    produce identical `{offsetPct, spanPct}` arrays).
  - Two fixtures **ported byte-for-byte** from `FocusCalendarView.test.tsx`'s
    existing idle-stripe tests (its 50%/50% split fixture and its
    all-active/no-stripe fixture) — asserting the exact same
    already-Sara-approved values. This is what actually proves the
    extraction is behavior-preserving, independent of whether the component
    test happens to still pass for an unrelated reason.
  - New file needs the file header per `.claude/rules/file-headers.md`.

**i18n (Vitest)**

- `client/src/i18n/__tests__/i18n.test.ts` — **add** a registry-derived loop
  over `LOCALES = ["en", "ko", "vi", "zh"] as const` (one array driving N
  assertions, not 4 copy-pasted `it`s, so a skipped locale can't ship green):
  - For each locale: `i18n.t("plan:report.wallClockLabel")` and
    `i18n.t("plan:report.activeLabel")` resolve to real strings, **not** the
    literal key string (i18next's default missing-key behavior).
  - For each locale: `i18n.t("plan:report.calendar.wallClockLabel")` and
    `...activeLabel` **do** resolve to the literal key string (i.e. no longer
    resolve at all) — catches a copy-instead-of-move that leaves the old path
    stale.
  - One additional assertion (en only): the relocated value is byte-identical
    to the pre-relocation string (`"Wall clock"`, `"Agent time"`) — a key
    move, not a translation change.
  - Confirm `it.each` is already used elsewhere in this codebase before
    relying on it; otherwise use an explicit `for (const locale of LOCALES)`
    loop at module-eval time — either way, one array must drive every
    per-locale assertion.

**Fixtures / test data**

- Server: reuse existing `seedSession`/`focus`/`activity`/`t`/`nextId` +
  `CWD`/`item-4` from `focus-report.test.js`'s own `before()` hook; seed via
  `stmts.upsertFocusInference.run` (column order confirmed at
  `server/db.js:1911-1923`). No new tables/migrations.
- Client: `makeReport()`'s updated base fixture (above) is the single shared
  fixture for every List-view/cross-view test in this plan; the near-zero
  case and the cross-view test each layer one additional override on top of
  it — do not create a second, parallel base-fixture builder.

## Implementation steps

Sequenced so each step is independently checkable; run the named test file
immediately after each step rather than batching changes before testing.
Steps 1-2 and 8 have no interdependency and may be done in parallel by a
second contributor; everything else is a straight line.

1. **Re-verify the round-4 baseline is real, not stale.** Run `npm run
   test:server` (expect 902/902) and `npm run test:client` (expect 403/403,
   36 files) fresh. Run `bash .claude/skills/file-headers/scripts/check-headers.sh`
   (expect clean, including the untracked round-4 files). This is not a new
   test — it's the ground truth this plan is built on top of; do not skip it.

2. **Write `client/src/lib/__tests__/idleStripes.test.ts` first, against the
   not-yet-created module.** *Red-first:* every case fails at import time —
   `client/src/lib/idleStripes.ts` does not exist (confirmed: `ls` fails).
   Then create `client/src/lib/idleStripes.ts` (`idleStripesInRange`, ported
   from `FocusCalendarView.tsx`'s current `idleStripesForBlock`, fields
   renamed `topPct`/`heightPct` → `offsetPct`/`spanPct`, widened to accept
   `undefined`/empty chunks). Run the test file again — *green* once the
   module exists and behaves per the ported fixtures. This is the
   single-source-of-truth guardrail for the *rendering math itself*: nothing
   downstream may reimplement this logic.

3. **Refactor `FocusCalendarView.tsx` onto the shared helper** (pure move —
   delete its local `IdleStripe`/`idleStripesForBlock`, import
   `idleStripesInRange`, rename the two field reads at the call site). Run
   `cd client && npx vitest run src/components/__tests__/FocusCalendarView.test.tsx`.
   *Gate, not red-first:* this file's assertions must need **zero** changes
   to pass. If any assertion needs touching, stop and treat it as a
   regression against round 4, not a refactor detail — per the plan's own
   Definition of Done.

4. **Relocate the i18n keys.** First add the new registry-completeness block
   to `client/src/i18n/__tests__/i18n.test.ts` (above). *Red-first:* against
   the current locale files, the "resolves the new path" assertions fail
   (missing key returns the literal key string) and the "no longer resolves
   the old path" assertions fail in the opposite direction (the old path
   still resolves correctly today). Then move
   `report.calendar.{wallClockLabel,activeLabel}` → `report.{wallClockLabel,
   activeLabel}` in all 4 locale files in the same step (same string values,
   key-path rename only), and update both `FocusCalendarView.tsx`'s and (once
   step 6 exists) `FocusReportModal.tsx`'s `t(...)` calls to the new path.
   Run the i18n test file again — *green* only once all 4 files are done; if
   a future edit does only 3 of 4, the loop fails on exactly the one skipped
   locale. Re-run `FocusCalendarView.test.tsx` once more here too (it reads
   the relocated key at its own call site).

5. **Update `FocusReportModal.test.tsx`'s `makeReport()` fixture** so
   `active_ms < wall_ms` for segment 1 (per the Test change set section
   above). Run the file. *Expected red:* the existing "computes the on-item
   percentage" test now fails (`75%`/`25%` no longer match the new fixture's
   `67%`/`33%`) — this is the one deliberate, called-out assertion edit in
   this plan, not a regression to chase. Update that assertion to `67%`/`33%`
   and confirm the rest of the file is still green (concurrency-ratio and
   idle-excluded tests override the relevant fields directly and are
   unaffected).

6. **Implement `FocusReportModal.tsx`'s List-view fix**: `kindTotalsAsSegments()`
   gains `active_ms` and filters on `active_ms > 0`; `SegmentedBar` gains
   `sizeField?: "wall_ms" | "active_ms"` (default `"wall_ms"`), sizes/labels
   each slice by `seg[sizeField]`, adds `data-kind`/`data-testid` hooks, and
   renders the idle-stripe overlay (via `idleStripesInRange`) only when
   `sizeField === "wall_ms"` and the segment carries `chunks`/`start`/`end`;
   the per-session call site computes both `totalWallMs`/`totalActiveMs` and
   renders the labeled dual split only when they diverge; the two aggregate
   call sites switch to `sizeField="active_ms"`.

7. **Add the new List-view tests one at a time, each red-first against the
   step-6 implementation as it lands** (or all red against pre-step-6 code if
   written first — either order works, but verify each one fails for the
   stated reason before implementing the piece that makes it pass):
   - Dual header split test — red: current code always renders one
     `{formatMs(totalMs)}` (`wall_ms` only); no `/30m 0s/` exists in
     "Worker"'s row until the dual-split branch is added.
   - Idle-stripe overlay test (+ its "no stripe" sibling) — red: no
     `data-testid="idle-stripe"` element exists anywhere in this file today
     (confirmed by grep); `stripes.length` is `0`, not `1`, until the overlay
     is wired.
   - Aggregate-bar `active_ms`-sizing test, **including the near-zero
     fixture case** — red: run this exact test against the file's
     currently-committed code (confirmed zero working-tree diff) with the
     new fixture numbers already in place — sizing still reads `wall_ms`
     unconditionally, so it produces 75/25 (and the injected near-zero-kind
     case would still render its old, larger, `wall_ms`-proportional width)
     until `sizeField="active_ms"` is wired to both call sites.

8. **Add `inferredSegment()`'s 5-case `describe` block to
   `server/__tests__/focus-report.test.js`.** No dependency on steps 2-7 —
   may be done in parallel. **Not a literal red/green pair**: this is a
   coverage-only addition (no behavior change to `inferredSegment()` in this
   pass) — write it, run it, and expect it to pass immediately against
   today's code. If any case fails on first run, that is a real, previously
   hidden bug in `inferredSegment()` surfacing for the first time — stop and
   report it; do not adjust the assertion to match wrong behavior. Run
   `npm run test:server` (expect 902 + 5 new).

9. **Add the cross-view consistency test to `FocusReportModal.test.tsx`.**
   *Red-first, and this is the one that matters most:* run this test against
   the state right after step 3/4 land but *before* step 6's List-view fix —
   it must fail on the very first List-view assertion (header shows only
   `"20m 0s"`, no `"10m 0s"`; zero idle stripes) — this is the literal
   reproduction of round 4's exact failure shape. Once step 6 lands, this
   test passes without modification. If it does not reproduce this failure
   when run pre-step-6, the test itself is wrong (too weak) — fix the test,
   not the sequencing.

10. **Full re-verification:** `npm run test:server` (902+5), `npm run
    test:client` (403+9, across `FocusReportModal.test.tsx`,
    `idleStripes.test.ts`, `i18n.test.ts`; `FocusCalendarView.test.tsx` still
    exactly 13/13 with zero assertion diff), `bash
    .claude/skills/file-headers/scripts/check-headers.sh` (clean, including
    the two new files from step 2). Review (don't blindly regenerate) any
    `screens.snapshot.test.tsx` diff — none is expected, confirmed by direct
    grep that neither modal is rendered there today.

11. **Docs.** Per this project's own `CLAUDE.md` non-negotiable rule, apply
    the `update-project-docs` skill for this change-set: extend
    `ARCHITECTURE.md`, `docs/API.md`, `client/README.md`, `server/README.md`
    per `technical-plan.md` §7 (List view now carries the same idle-stripe/
    `active_ms`-sizing convention Calendar already documents). This is a
    docs deliverable, not a test, but is part of this plan's Definition of
    Done because the technical plan's own DoD gates on it.

## Single-source-of-truth guardrail

Yes, applicable. This project's canonical source for "how long" is
`server/lib/focus-report.js` — `wall_ms`/`active_ms`/`idle_ms`/`chunks`,
computed once per segment, server-side. No test in this plan may bless a
second, view-local recomputation of these values:

- The aggregate-bar sizing test (step 7) asserts against
  `FocusKindTotals.by_kind[kind].active_ms` — the exact same field the
  already-correct printed number reads — never a new client-side rollup.
- The cross-view consistency test (step 9) is the literal mechanism: it
  asserts List view and Calendar view render the *same* `formatMs(wall_ms)`/
  `formatMs(active_ms)` outputs and *proportionally equivalent* idle-stripe
  geometry for the same segment, sourced from the one shared
  `idleStripesInRange` helper (different axis — horizontal offset/span vs.
  vertical top/height — same underlying fractions).
- `idleStripes.test.ts`'s two ported fixtures (step 2) pin that the shared
  helper itself doesn't drift once it has a second consumer — this is the
  guardrail against a *third* occurrence (an independently reimplemented
  stripe-math helper instead of the shared one).
- Never accept a fix that hand-rolls a second `active_ms`/idle-stripe
  computation in `FocusReportModal.tsx` "for convenience" instead of reading
  the existing `FocusKindTotals`/`FocusReportSegment` fields and the shared
  helper — if a future test needs a value neither already provides, that is
  a signal to add it server-side once, not client-side twice.

## Durable-cure decision

**Adding the structural cure now, not deferring to point tests only** — this
matches the strategist's verdict exactly (BLIND → ADEQUATE once these land)
and is the explicit recommendation in both `qa-assessment.md` and `risk.md`.
Concretely, the durable cure in this plan is:

- The cross-view consistency test (step 9) is written as a **standing
  template**, not a one-off: any future field added to `FocusReportSegment`
  that either view renders must extend this same test, not get a separate,
  view-local test only. This is stated in the test file's own comments per
  `unit-tests.md`'s framing.
- `idleStripesInRange` extracted to a shared lib module *before* the second
  consumer needs it (step 2), with its own unit test independent of either
  component — the mechanical prevention against a third, re-implemented
  stripe-math helper.
- `inferredSegment()`'s new `describe` block documents (in-file, per
  `qa-assessment.md`'s recommendation) which of the two branches (declared
  vs. inferred) each block exercises, so a future contributor adding another
  declared-only test doesn't believe the fallback path is covered by proxy.

**Consequence of deferring** (not chosen, stated for the record): shipping
only the point tests without the cross-view test as a standing template would
leave DERIVED-DUAL-VIEW's second occurrence closed for *this pass's* fields
only — a third occurrence (a new field, or a third rendering surface such as
`SegmentEventsModal.tsx`, which already independently buckets at the same
10-minute grain via its own `eventBuckets.ts`) would still ship undetected.
That is explicitly the risk this plan is closing, not accepting.

**Explicitly not gating this change** (per the e2e architect's and
strategist's own framing, adopted unchanged): the adjacent
`server/__tests__/projects.test.js` route-level gap (its `active_ms`
assertions are neutralized by `DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "0"`, so
the HTTP contract this List-view work depends on is unproven end-to-end) is
real but out of scope for this change — it's round-4's contract, not this
pass's. Flag it as a follow-up recommendation in the PR, do not add it to
this test set. Likewise, whether to formally adopt "DERIVED-DUAL-VIEW" as a
named `PROJECT-CONTEXT.md` catalog entry is Sara's call, not this plan's —
noted, not decided here.

## How to run

No `PROJECT-CONTEXT.md` configured; commands below are `CLAUDE.md`'s own
documented commands, cross-checked against `package.json`/`client/package.json`.

- Server, full: `npm run test:server`
- Server, scoped while iterating: `node --test server/__tests__/focus-report.test.js`
- Client, full: `npm run test:client`
- Client, scoped while iterating:
  - `cd client && npx vitest run src/components/__tests__/FocusReportModal.test.tsx`
  - `cd client && npx vitest run src/components/__tests__/FocusCalendarView.test.tsx`
  - `cd client && npx vitest run src/lib/__tests__/idleStripes.test.ts`
  - `cd client && npx vitest run src/i18n/__tests__/i18n.test.ts`
- Snapshot regeneration (only if a reviewed, expected diff appears — none is
  anticipated): `cd client && npx vitest run -u`
- File headers: `bash .claude/skills/file-headers/scripts/check-headers.sh`
- No environment/base-URL prerequisite for any of the above — server tests
  spin up their own temp SQLite DB per file; client tests are pure
  Vitest/jsdom, no live backend or browser automation required.

## Definition of Done

- [ ] `server/__tests__/focus-report.test.js` — new `inferredSegment`
      `describe` block, all 5 cases passing (item-kind, detour-kind,
      deleted-item, unclassified, idle-tail); confirmed passing on first run
      against unchanged `inferredSegment()` code (coverage-only, not a fix).
- [ ] `client/src/lib/idleStripes.ts` + `client/src/lib/__tests__/idleStripes.test.ts`
      created; observed RED (module missing) before creation, GREEN after;
      the two ported `FocusCalendarView.test.tsx` fixtures match exactly.
- [ ] `client/src/components/__tests__/FocusCalendarView.test.tsx` — 13/13,
      **zero assertion changes**, after both the extraction and the i18n
      relocation.
- [ ] `client/src/components/__tests__/FocusReportModal.test.tsx` — fixture
      updated (`active_ms < wall_ms`); on-item-percentage assertion updated
      to 67%/33% (deliberate); 4 new tests added and each observed RED before
      its corresponding implementation step and GREEN after (dual header
      split, idle-stripe overlay + its negative case, aggregate-bar
      `active_ms` sizing **including the near-zero-`active_ms` case**,
      cross-view consistency); cross-view test specifically confirmed to
      fail against the pre-List-fix state before passing post-fix.
- [ ] `client/src/i18n/__tests__/i18n.test.ts` — registry-derived 4-locale
      completeness check added; observed failing pre-relocation (both
      directions: new path missing, old path still present) and passing
      post-relocation for all 4 locales.
- [ ] `npm run test:server` green (902 baseline + 5 new).
- [ ] `npm run test:client` green (403 baseline + new/updated cases across
      `FocusReportModal.test.tsx`, `idleStripes.test.ts`, `i18n.test.ts`);
      any `screens.snapshot.test.tsx` diff reviewed, not blindly regenerated
      (none expected).
- [ ] `bash .claude/skills/file-headers/scripts/check-headers.sh` clean,
      including the two new files.
- [ ] Single-source-of-truth guardrail honored: no second, view-local
      computation of `active_ms`/idle-stripe math introduced anywhere in
      this change; both views verified (by the cross-view test) to read the
      one shared `idleStripesInRange` helper and the one server-computed
      `active_ms`/`wall_ms`/`chunks` fields.
- [ ] Docs (`ARCHITECTURE.md`, `docs/API.md`, `client/README.md`,
      `server/README.md`) updated in the same commit per
      `technical-plan.md` §7.
- [ ] `projects.test.js`'s adjacent route-level gap explicitly named as a
      follow-up in the PR description, not silently dropped and not
      accidentally treated as in-scope.
