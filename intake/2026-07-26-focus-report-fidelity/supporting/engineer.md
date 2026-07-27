# Engineer notes — Focus-Time Reporting Fidelity (2026-07-26)

## 0. State of the working tree, verified

The `git status` snapshot quoted in the request brief is stale relative to
the tree right now. A commit already landed mid-session:

```
2c1ef2f feat(focus): calendar view for focus-time report and background focus inference
```

That commit contains the round-1/2/3 work: the List/Calendar toggle, stat
tiles (`active_ms` vs `wall_clock_ms`/`concurrency_ratio`), `FocusCalendarView.tsx`
itself, `calendarLanes.ts`, `focus-inference.js`, and `FocusReportModal.tsx` /
its test file as they exist today. **`FocusReportModal.tsx` is fully
committed** — there is no uncommitted diff to it right now.

What's still uncommitted (verified via `git diff --stat HEAD`) is narrower
than the brief implies — just the round-4 idle-chunk-stripe work, layered on
top of the already-committed calendar view:

- `server/lib/focus-report.js` — adds `CHUNK_MS`, `buildActivityChunks()`,
  wires `chunks` onto each enriched segment in `buildSessionFocusReport`.
- `server/__tests__/focus-report.test.js` — tests for the above.
- `client/src/lib/types.ts` — adds `FocusReportChunk` and `FocusReportSegment.chunks?`.
- `client/src/components/FocusCalendarView.tsx` + its test — idle stripe
  overlay per block, wall-clock/agent-time side-by-side in the hover popup
  and events-modal header.

Also untracked: `client/src/components/SegmentEventsModal.tsx`,
`client/src/lib/eventBuckets.ts` (+ its test) — the drill-down modal and its
event-bucketing helper, apparently not yet committed either (no `?? ` for
`calendarLanes.ts`/`focus-inference.js` anymore — those got swept into
2c1ef2f).

**Verification run this pass** (per CLAUDE.md's testing policy):
- `npm run test:server` → 902/902 pass, 0 fail.
- `npm run test:client` → 403/403 pass (36 files), including
  `FocusCalendarView.test.tsx` (13 tests) and `FocusReportModal.test.tsx`
  (13 tests).

So, to answer brief open question 5 directly: **yes, the uncommitted
round-4 diff is green and internally consistent with its own tests.** It is
not, however, a fix to the List view — it never touched
`FocusReportModal.tsx`, which was already committed in 2c1ef2f in its
pre-round-4 (wall_ms-only) shape.

## 1. What List-view parity actually requires

`FocusReportModal.tsx`'s `ListView` (lines 233-338) has **three** separate
`wall_ms`-sized bars, and they are not uniformly wrong in the same way —
worth separating:

### a) Per-session bar (lines 240-280) — real segments, chunks already available, no server change needed

```js
const totalMs = session.segments.reduce((sum, seg) => sum + seg.wall_ms, 0);   // line 242
...
<SegmentedBar segments={session.segments} totalMs={totalMs} height="h-5" />    // line 279
```

`session.segments` here is the *real* `FocusReportSegment[]` from the API —
each one **already carries `chunks`** (added by the uncommitted round-4
diff in `focus-report.js`). Nothing new needs to be computed server-side
for this bar. The fix is entirely in `SegmentedBar` (lines 387-424): add an
idle-stripe overlay per segment, the same idea as
`FocusCalendarView`'s `idleStripesForBlock` (lines 111-129) but oriented
horizontally — a `left%`/`width%` rectangle within *that segment's own*
rendered width (not the whole bar), computed from `seg.chunks.filter(c =>
!c.active)` against that segment's own `wall_ms` span. This is the same
class of visual gap this segment's own chunks unambiguously answer — no
cross-segment alignment problem here, because each declared/inferred
segment's chunk list only ever describes itself.

The header number (`formatMs(totalMs)`, line 268) is the other half of the
bug: it's a straight `wall_ms` sum — the literal "1h 40m stated, ~20 min of
actual events" shape from round 3's original complaint, just at the
session-summary level instead of the calendar-block level. This should
switch to `active_ms` (`session.segments.reduce((sum, seg) => sum +
seg.active_ms, 0)`), with `wall_ms` demoted to a secondary/parenthetical
figure (mirrors what the Calendar popup already does with
`report.calendar.wallClockLabel`/`activeLabel`).

### b) Per-item rollup bar (lines 286-312) — aggregated `FocusKindTotals`, no chunks exist, and a pre-existing inconsistency

```js
<span>{formatMs(item.totals.active_ms)}</span>                              // line 300 — active_ms
<SegmentedBar
  segments={kindTotalsAsSegments(item.totals)}
  totalMs={item.totals.wall_ms}                                             // line 305 — wall_ms
  height="h-3"
/>
```

**This is already internally inconsistent today**, independent of anything
this brief is asking for: the printed duration next to each item is
`active_ms`, but the bar under it is sized (and its per-kind widths
computed) from `wall_ms`. If a session had a long idle tail on one kind but
not others, the number and the bar it sits above describe two different
totals. Same pattern in the project-wide split section below it
(`totalMs={report.totals.wall_ms}` at line 318, but the legend at line 323
reads `report.totals.by_kind[kind].active_ms`).

`kindTotalsAsSegments` (lines 371-379) flattens a `FocusKindTotals` into one
pseudo-segment *per kind*, summed across every session and every real
segment that touched that kind. `FocalKindTotals` (`client/src/lib/types.ts`
lines 1563-1571, mirrored server-side by `emptyKindTotals()`/`addToTotals()`
in `focus-report.js` lines 325-339) carries only `wall_ms`/`active_ms`/
`idle_ms` per kind — **no `chunks` field, at any level.** `addToTotals` only
ever sums milliseconds; it never touches or merges `seg.chunks`.

### c) Project-wide split bar (lines 314-335) — same shape as (b), same fix

## 2. Is the multi-segment/multi-session chunk-alignment problem real?

Yes, and it's worth being precise about *why*, because it changes the right
answer for (b)/(c) above.

`buildActivityChunks` (`server/lib/focus-report.js` lines 191-204) walks
`for (let chunkStart = startMs; chunkStart < endMs; chunkStart += chunkMs)`
— **`startMs` is the segment's own start**, not an epoch-aligned boundary.
Two segments starting at different offsets (e.g. 09:03 vs 09:00) produce
chunk grids that don't share boundaries at all. Contrast this with
`client/src/lib/eventBuckets.ts`'s `bucketEvents` (used by
`SegmentEventsModal`), which floors to an **epoch-aligned** grid
(`Math.floor(ms / bucketMs) * bucketMs`, line 58) — every session's buckets
land on the same wall-clock `:00/:10/:20...` boundaries regardless of when
a segment started.

So: `FocusCalendarView` gets away with per-segment, self-relative chunks
because it only ever overlays *one segment's own* chunks onto *that
segment's own* block (`idleStripesForBlock` is called once per block, with
that block's own `chunks`) — never combining two segments' chunk lists. The
per-item/project-wide rollup in `ListView`, by construction, **would** need
to combine chunks from many different segments/sessions that don't share a
grid. Doing this correctly would require a new server-side helper that:

1. Re-slices every contributing segment's real event timestamps against a
   **shared epoch-aligned grid** (like `bucketEvents` does, not like
   `buildActivityChunks` does) instead of each segment's own relative grid, and
2. Merges overlapping/adjacent segments' grid slots (a slot is "active" if
   *any* contributing segment had activity in it) — structurally close to
   `mergeIntervals` but on a discretized grid instead of continuous
   intervals, and per-kind rather than global.

This is real, new work, not a wiring exercise — and it only pays for a
richer stripe-overlay treatment on the aggregate bars. **Recommendation:**
skip it. Switching (b)/(c) to size and label by `active_ms` (already
computed, already correctly summed, no chunk merging needed) fixes the
actual round-3-class bug — a stated duration far exceeding worked time — at
the aggregate level. Reserve literal chunk-stripe rendering for the
per-session bar (2a), where each segment's own chunks are self-consistent.
If Sara later wants aggregate-level striping too, that's a distinct,
larger follow-up (new server helper + a `FocusKindTotals` shape change +
client rendering), not part of this pass.

## 3. Effort estimate

**Overall: S/M** for the recommended scope (2a + switch (b)/(c) sizing to
`active_ms` + fix the existing number/bar mismatch); **L** if the team
also wants literal idle-chunk striping on the aggregate rollup/split bars.

- `server/lib/focus-report.js`: **none required** for the recommended
  scope — `chunks`/`active_ms`/`idle_ms` are already on the wire. (Only
  needed if going for the L-sized aggregate-chunk option in §2.)
- `client/src/components/FocusReportModal.tsx`: **S** — touches
  `ListView`'s per-session block (totalMs + `SegmentedBar` call),
  `kindTotalsAsSegments`/its two callers (totalMs source), and
  `SegmentedBar` itself (add an optional idle-stripe overlay parameter).
  All changes are additive/local to one file.
- `client/src/lib/types.ts`: **trivial** — widen the `Pick<...>` union
  `SegmentedBar` accepts to include `chunks`/`active_ms` (only needed for
  the per-session bar's real segments; the pseudo-segments from
  `kindTotalsAsSegments` never carry chunks so don't need the field).
- `client/src/components/__tests__/FocusReportModal.test.tsx`: **S** —
  extend `makeReport()` fixtures with differing `wall_ms`/`active_ms` and a
  `chunks` array on at least one segment; assert (i) the per-session header
  number now reads `active_ms`, (ii) an idle stripe renders for the idle
  chunk and none for the fully-active one (mirror
  `FocusCalendarView.test.tsx`'s two `idle-stripe` tests almost verbatim),
  (iii) the per-item/split bar's printed number and its bar proportions
  now agree (regression test for the number/bar mismatch found in §1b).
- i18n: if a new "wall clock / agent time" caption is added to the
  per-session row (mirroring the Calendar popup), reuse
  `report.calendar.wallClockLabel`/`activeLabel` (already present in all
  four locales — `en/ko/vi/zh` `plan.json`) rather than adding new keys;
  if the team decides those belong outside the `calendar` namespace
  instead, that's a same-value key rename across all 4 locale files at
  once, per this repo's i18n convention — do not add an English-only key.

## 4. Dependencies & order

1. No server change needed for the recommended (S/M) scope — `chunks` is
   already shipped by the uncommitted round-4 diff. **First**, land/commit
   that diff (it's green, see §0) since `ListView`'s per-session idle
   stripes depend on `seg.chunks` existing on the wire at all; today it's
   uncommitted, so building on it means building on a dirty tree, not a
   missing feature.
2. Then: `client/src/lib/types.ts` widening (mechanical, no behavior) →
   `FocusReportModal.tsx`'s `SegmentedBar`/`ListView`/`kindTotalsAsSegments`
   changes → test updates. No shared-registry/mapping entry blocks this
   (unlike, say, adding a new `FocusKind` — this only touches the two
   already-existing surfaces).
3. If the team later pursues the L-sized aggregate-chunk option (§2): that
   would need the new epoch-aligned grid helper in
   `server/lib/focus-report.js` *before* any client rendering work, and a
   `FocusKindTotals` shape addition on both sides (`server/lib/focus-report.js`
   `emptyKindTotals()`/`addToTotals()` and `client/src/lib/types.ts`) — a
   genuine "shared shape must land first" dependency, unlike the
   recommended scope.

## 5. Gotchas

- **The generalized defect class the brief names is real and already
  visible twice over**, not just in the Calendar-vs-List split: within
  `ListView` itself, the printed duration and the bar's sizing/legend
  already disagree (`active_ms` label over a `wall_ms`-sized bar, §1b/1c)
  — a fix applied to only the label or only the bar, not both, would leave
  the *same* file self-contradictory. Any fix here should change the
  label and the bar's sizing basis together, not one at a time.
- **Two independently-hardcoded "10 minutes" constants, unchecked for
  equality.** `CHUNK_MS` (`server/lib/focus-report.js`) and `BUCKET_MS`
  (`client/src/lib/eventBuckets.ts`) are both `10 * 60 * 1000`, cross-
  referenced only in doc comments ("Matches CHUNK_MS in..."), with no test
  asserting they're numerically equal. If round 4's chunk grain (brief's
  open question 3) is ever tuned, it is easy to change one and forget the
  sibling — no compiler/test failure would catch it, since they're two
  unrelated literals in two different languages/files. Worth either an
  explicit comment-only acknowledgment (current state) or, better, a light
  test that fails loudly if they drift (e.g. an integration test comparing
  the two constants' values, since they can't literally share an import
  across the JS server / TS client boundary).
- **`buildActivityChunks`'s grid is segment-relative, not epoch-aligned** —
  see §2. Anyone assuming a segment's `chunks[i]` boundaries line up with
  another segment's, or with `SegmentEventsModal`'s epoch-aligned event
  buckets, at the same wall-clock instant, will be wrong. The existing doc
  comment ("agree on the same 10-minute granularity") is true about *size*
  only, not *alignment* — a subtle enough gap that a future engineer
  reading only the comment could reasonably (and incorrectly) assume more.
- **`kindTotalsAsSegments`'s pseudo-segments have no `label`/`chunks`/
  `inferred` by construction** (line 374-378: `label: null`, no
  `inferred`/`chunks` keys at all) — `SegmentedBar`'s `Pick<...>` prop type
  already reflects this correctly (chunks/inferred are `Partial`), so
  adding an idle-stripe *rendering* path to `SegmentedBar` must guard on
  `seg.chunks` being present/non-empty, not assume every caller supplies it
  — otherwise the per-item/split bars (which will never have chunks under
  the recommended scope) would silently render zero stripes, which is
  correct, but only if the guard is written defensively rather than
  assumed.
- **Docs**: per CLAUDE.md's `update-project-docs` rule, `docs/API.md` (the
  `focus-report` response shape section, already touched by the round-4
  diff for `chunks`) and any README callouts about the report views would
  need a follow-up line if `wall_ms`/`active_ms` semantics change in
  `ListView`'s rendering (the wire shape doesn't change, only which field
  each renderer chooses — but if this ships alongside a genuine API
  addition like an aggregate-chunk field, doc sync is mandatory).

## 6. Verification hooks

- `client/src/components/__tests__/FocusReportModal.test.tsx` — the direct
  spec for everything in §1; today it only exercises the pre-round-4 shape
  (`makeReport()`'s segments never set `chunks`, and its
  `active_ms`/`wall_ms` are always equal to each other, e.g. lines 39-40,
  51-52 — meaning **the existing suite cannot currently catch either the
  wall_ms-vs-active_ms bug or the number/bar mismatch**, since every
  fixture segment has zero idle time). Any fix must add fixtures where
  `active_ms < wall_ms` and assert on the *rendered* numbers, not just
  presence of text.
- `client/src/components/__tests__/FocusCalendarView.test.tsx` — the
  reference pattern to mirror for idle-stripe assertions (`data-testid="idle-stripe"`,
  the two tests at lines 537-601 covering "one idle chunk → one stripe,
  correct top/height%" and "all-active segment → zero stripes"). A
  `ListView` idle-stripe test should use the same `data-testid` convention
  so both suites are grep-discoverable as one family.
- `server/__tests__/focus-report.test.js` — already covers
  `buildActivityChunks` and `buildSessionFocusReport`'s chunk wiring
  thoroughly (lines 343-412); **no server-side test changes needed** for
  the recommended (S/M) scope since no server code changes. If the L-sized
  aggregate-chunk helper is built later, it needs its own `describe` block
  here, following the existing `buildProjectFocusReport` test patterns
  (lines 414-550) for cross-session aggregation scenarios (concurrent,
  disjoint, partially-overlapping spans — the exact three shapes already
  covered for `wall_clock_ms`/`concurrency_ratio` would need chunk-grid
  equivalents).
- Full commands: `npm run test:server` (902 tests, currently 0 fail) and
  `npm run test:client` (403 tests, currently 0 fail) — both were re-run
  this pass and are green on the current tree.
