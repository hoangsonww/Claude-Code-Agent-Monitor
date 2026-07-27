# Risk & Regression Analysis — focus-report-fidelity (List-view parity)

Source: `intake/2026-07-26-focus-report-fidelity/qa/change-brief.md` +
`technical-plan.md`. No `PROJECT-CONTEXT.md` / formal defect-class catalog
is configured for this repo (confirmed: no such file at repo root). Per
this task's own instruction, this project's de facto recurring trap is
named explicitly below and treated as if it were a catalog entry, since it
has already bitten this exact codebase twice in one session.

## 0. This project's de facto catalog entry (no formal catalog exists)

**"DERIVED-DUAL-VIEW": a duration/summary value computed once server-side,
consumed by two independent client rendering surfaces, with no shared
helper and no cross-surface test enforcing agreement.**

Evidence this is real and recurring, not a one-off:
- **Round 3** (already shipped): `wall_ms` alone was misleading (a session
  read "1h 40m" when only ~20 min was real work). Fixed by adding
  `active_ms`/`idle_ms`/`chunks` server-side.
- **Round 4** (in the working tree now, uncommitted): the idle-awareness
  fix landed in `FocusCalendarView.tsx` only. `FocusReportModal.tsx`'s
  List view was never touched — same report, same fields, silently still
  wall_ms-only and, worse, already printing an `active_ms` number next to
  a `wall_ms`-sized bar (an internal self-contradiction, not just a stale
  view).
- **This pass** exists solely to close that gap and is explicit that its
  own highest-priority deliverable is the regression test that would have
  caught round 4 stopping at one consumer (`technical-plan.md` §6.B.5).

Every risk below either instantiates this pattern again or is the kind of
gap that would let it recur a third time undetected. Treat this repo's
"grep both views for the same key/field" hygiene check as equivalent to a
catalog ID for the rest of this document — call it **DERIVED-DUAL-VIEW**
below.

## 1. Blast radius

Beyond the literal changed lines:

- **`client/src/lib/idleStripes.ts` (new)** — becomes a shared dependency
  of both `FocusCalendarView.tsx` and `FocusReportModal.tsx`'s
  `SegmentedBar`. Any future third consumer (e.g. `SegmentEventsModal.tsx`,
  which already independently buckets events at the same 10-minute grain
  via `client/src/lib/eventBuckets.ts`) inherits whatever this helper gets
  wrong. It is now the single point of truth for "which 10-minute windows
  in a rendered range are idle" — a bug here silently propagates to every
  consumer, present and future.
- **`kindTotalsAsSegments()` and `SegmentedBar`** in `FocusReportModal.tsx`
  are shared by *three* call sites (per-session, per-item rollup,
  project-split). `SegmentedBar`'s widened `Pick<>` type and new
  `sizeField` prop is a single piece of logic now serving both a
  `wall_ms`-sized, stripe-overlaid caller and two `active_ms`-sized,
  non-overlaid callers — a single bug in the `sizeField` branch logic hits
  all three bars, just differently.
- **`FocusKindTotals.by_kind[kind].active_ms`** (server-computed,
  `server/lib/focus-report.js`'s `addToTotals`) is the sole source now feeding
  both the already-correct printed number AND the newly-fixed bar width at
  two call sites. No new computation is introduced (correctly, per the
  plan's §5 single-source-of-truth guardrail) — but that also means a
  latent bug in `addToTotals`'s per-kind summation would now show up
  identically in both places, no longer distinguishable as "label vs bar
  disagree," which actually *raises* the bar for the server-side
  `inferredSegment`/chunk tests to be right, since client tests can no
  longer triangulate a server miscalculation via a label/bar mismatch.
- **The i18n key path `report.wallClockLabel` / `report.activeLabel`** is a
  cross-boundary contract: 4 locale JSON files (`en`, `ko`, `vi`, `zh`) +
  2 call sites (`FocusCalendarView.tsx` unchanged text, `FocusReportModal.tsx`
  new text) must all resolve to the same key path. This is exactly the
  "token must match on both sides of a serialization boundary" shape named
  in this role's brief — i18next's key lookup is the boundary; a mismatch
  doesn't throw, it silently falls back to printing the raw key string.
- **`FocusCalendarView.test.tsx`** is *not* being changed by this pass but
  is directly exposed by the refactor (step 3): its assertions on
  `stripe.topPct`/`heightPct`-derived DOM (rendered `top`/`height` style
  percentages) are the actual regression detector for the
  `idleStripesForBlock` → `idleStripesInRange` extraction, even though no
  line in that test file is planned to change.
- **`server/__tests__/focus-inference.test.js`** — the new
  `inferredSegment` describe block in `focus-report.test.js` is asked to
  mirror this file's seeding conventions (`upsertFocusInference`). A
  fixture-seeding mismatch between the two files (e.g. a different
  `getPlanItemById` shape) would produce a test that passes for the wrong
  reason rather than failing loudly.
- **`SegmentEventsModal.tsx` / `eventBuckets.ts`** (untracked, from an
  earlier round) — not touched by this pass, but shares the same
  `CHUNK_MS`/10-minute-bucket concept with an independently hardcoded
  constant on the client side matching a server hardcoded constant only
  "by comment" (explicitly flagged as an out-of-scope follow-up risk in
  `technical-plan.md` §8/Follow-ups). Not this pass's problem to fix, but
  worth knowing it's adjacent blast radius if `CHUNK_MS` ever changes.

## 2. Invariants that must hold

No formal catalog; reasoning from first principles, explicitly mapped to
this project's one recurring pattern (**DERIVED-DUAL-VIEW**, §0) where it
applies:

- **Consistency across paths (= DERIVED-DUAL-VIEW, directly hit).** List
  view and Calendar view must state the *same* wall-clock and agent-time
  numbers for the same segment. This is the plan's own named top guardrail
  (§6.B.5) and the single most important thing a test plan must pin. A
  weaker version of the same invariant, *within* one view: a bar's visual
  width and its adjacent printed number must agree (the embedded bug this
  pass fixes for the two aggregate bars).
- **Completeness across the i18n locale set.** All 4 locale files must
  carry `report.wallClockLabel`/`report.activeLabel` at the *same* new
  path; none may still resolve at the old `report.calendar.*` path or be
  missing entirely. This is a 4-way completeness check, not a binary
  presence check — a test that only checks `en` passes green while `ko`
  silently regresses.
- **Isolation between sizing bases per bar.** The per-session bar's box
  must stay `wall_ms`-sized (only its label/stripe changes); the two
  aggregate bars must switch fully to `active_ms`. A test that only checks
  "the numbers are right" without checking "each bar uses the *correct*
  basis for *its own role*" could pass even if sizing bases got swapped
  between the per-session bar and an aggregate bar.
- **Round-trip / no-second-computation integrity.** `active_ms` must reach
  the aggregate bar via the exact same `FocusKindTotals.by_kind[...].active_ms`
  field the adjacent number already reads — not a second, list-view-local
  recomputation. (No literal write→read persistence cycle exists in this
  client-only change, but the analogous invariant — one computed value,
  one path to every consumer — is exactly the plan's §5 guardrail.)
- **No-leak at the i18n boundary.** No raw i18n key string (`report.wallClockLabel`,
  `report.calendar.wallClockLabel`, etc.) may ever render literally to an
  end user in any of the 4 supported locales. This is the closest literal
  analog to the "no-leak boundary" class in a change with no server/network
  boundary of its own — i18next's key resolution *is* the boundary, and its
  failure mode (silent fallback to key text) is exactly a leaked internal
  token.
- **Declared-history-is-ground-truth (server invariant, restated from
  `focus-report.js`'s own doc comment, line 39-40).** `inferredSegment()`
  is only ever consulted when `buildFocusSegments()` returns zero segments;
  a declared segment must never be overwritten, blended with, or
  second-guessed by an inference. The new test coverage must pin this
  directly (not just pin what inference produces in isolation), since this
  is the exact contract a subtly wrong "helpfully fill in the gaps" change
  could violate quietly.
- **Refactor purity (`FocusCalendarView.tsx`'s extraction).** A pure move
  of `idleStripesForBlock` → `idleStripesInRange` must not alter its own
  test file's existing assertions. Any assertion change here is itself the
  signal something went beyond a rename (the plan states this outright,
  §6.C: "if it does, something in step 3 of §4 went beyond a pure refactor").

## 3. Recurring-issue mapping

No formal defect-class catalog exists (confirmed absent). Reasoning from
this project's own documented history instead, per this task's framing:

**This change directly touches DERIVED-DUAL-VIEW, the project's one
clearly recurring bug shape, for the SECOND time this session** — and the
whole reason this pass exists is that the round-4 fix landed in exactly
one of the two consumers. That means:

- This is not a fresh risk being introduced; it is **a live, currently
  OPEN instance** of a pattern this project has already shipped incomplete
  once (Calendar-before-round-4). Until §6.B.5's cross-view test lands and
  passes, this pattern's WATCH status should be read as "still open" — the
  fix in this pass closes today's known instance but does not, by itself,
  prevent a *third* recurrence (e.g., a future third rendering surface of
  the same report, or a future field added to `FocusReportSegment` that
  only one of List/Calendar picks up).
- The embedded "label reads `active_ms`, bar renders `wall_ms`" bug in the
  two aggregate bars is itself a *narrower*, single-view instance of the
  identical shape (two renderings — a text number and a bar width — of the
  same underlying fact, disagreeing). It should be read as
  DERIVED-DUAL-VIEW's within-component variant, not an unrelated bug,
  since the same missing-shared-assertion cause applies: nothing enforced
  "the number and the box must agree."
- **This change could regress the round-4 fix (Calendar) if the
  `idleStripesForBlock` → `idleStripesInRange` extraction is not a pure
  move.** Per the plan's own explicit call-out (§8, §9 DoD, §6.C), this is
  the most likely "fix one thing, quietly break the thing you just fixed
  last round" trap in this pass — regression-of-a-very-recent-fix, since
  round 4 is itself still uncommitted. If `FocusCalendarView.test.tsx`
  needs *any* assertion change to stay green post-extraction, that is a
  direct signal of a regression against round 4, not a refactor detail to
  wave through.
- **The i18n key relocation touches round-4's own new keys** (`calendar.wallClockLabel`/
  `activeLabel`, added by round 4, uncommitted). A partial relocation
  doesn't just fail to fix List view — it can actively break Calendar's
  already-shipped (uncommitted) popup text in whichever locale is missed,
  since Calendar's call site is also being repointed to the new path in
  the same step. This is a second, distinct regression-of-the-fix vector
  layered on top of the refactor-purity one above.

## 4. The "ships green but broken" traps

Concretely, per the four assessment questions plus the plan's own material:

1. **Aggregate bars switching to `active_ms` sizing — correctness fix, but
   easy to misread as a regression if shipped without the called-out
   context.** A kind with real elapsed time but ~0 active time (e.g. a
   detour opened and then the agent went idle for the rest of the session)
   will now render a near-0-width slice in the per-item rollup and
   project-split bars, where today it renders full-width. This is the
   intended fix (matching the already-correct printed number), not a
   regression — but a test plan (and the PR description) must state this
   *as an assertion*, not just prose: a test asserting a bar's slice widths
   are proportional to `active_ms` (not `wall_ms`) is required, or a future
   contributor "fixing" what looks like a shrunk/missing bar by reverting
   to `wall_ms` sizing would ship green and silently reopen the exact
   embedded bug this pass closes. **Required assertion:** per-item and
   project-split bar slice width ∝ `active_ms`, with an explicit fixture
   case where `active_ms` is near-zero and `wall_ms` is large, asserting
   near-0 width (not full width).
2. **`idleStripes.ts` extraction changing `FocusCalendarView`'s own
   behavior.** The riskiest concrete way this ships green: the field
   rename `topPct`/`heightPct` → `offsetPct`/`spanPct` is done at the call
   site but the *semantics* subtly shift (e.g., an off-by-one in which
   axis "offset"/"span" apply to, or the "returns `[]` for
   undefined/empty/malformed range" guard behaving differently than the
   old implicit `chunks ?? []` at each call site). If `FocusCalendarView.test.tsx`
   happens not to cover the exact edge case that changed (e.g. a segment
   with an empty `chunks: []` array vs. no `chunks` key at all — two
   different "no stripes" inputs the old code and the new guarded helper
   might treat differently), this ships green with zero visible diff in
   the one test file explicitly relied on to catch it. **Required
   assertion:** before merging the extraction, diff-test
   `idleStripesInRange` directly (new unit test on the helper itself, not
   only indirectly through the two components) against both a `chunks: []`
   and a `chunks: undefined` input, plus at least one case where the old
   `idleStripesForBlock` and the new helper are run side-by-side against
   the same input and asserted equal — a literal "same input, same output"
   pin, not just "the existing UI test still passes."
3. **`inferredSegment()`'s blast radius if subtly wrong.** This is the
   fallback for *every* session with zero declared Focus history — likely
   a large fraction of real sessions (anything that never called `Focus`
   `set`/`push`). A wrong `inferredSegment()`:
   - Silently attributes time to the wrong plan item (if `item_id` →
     current-item-number resolution is off), corrupting the per-item
     rollup and the project split for a plan owner who never even opened
     the item in question — a data-integrity problem that reads as
     legitimate data, not an error.
   - Silently drops a session's time entirely (returns `null` when it
     shouldn't, e.g. treating a resolvable item as "deleted"), which is
     invisible in the UI — a session just doesn't show up, and nothing
     signals "there was inferable data here that got dropped."
   - Worse: could violate **declared-history-is-ground-truth** if a future
     edit (not this pass, but enabled by weak test coverage now) causes
     `inferredSegment` to run even when declared segments exist, silently
     blending guessed and real data with no visual distinction (the
     current `≈ inferred` chip only applies to a whole-session
     `segments = [inferred]` case — a mixed-in inferred segment wouldn't
     necessarily get flagged correctly downstream).
   - The round-3 regression shape specifically (long idle tail riding to
     `ended_at`) is the highest-value single case (`technical-plan.md`
     §6.A.5) — it is the exact bug class that shipped once already, through
     this exact function, with a fully green suite (zero coverage on this
     function until this pass). **Required assertions** (already scoped by
     the plan, restated as the invariant they protect): item-kind inference
     resolves via *current* `item_number`/text, not a stale snapshot;
     detour-kind inference carries no `item_number`; a deleted/unresolved
     item's inference yields zero segments (not a mis-attributed one); an
     unclassified verdict yields zero segments; and the idle-tail case
     (`wall_ms` rides to the full span, `active_ms < wall_ms`,
     `chunks.length === Math.ceil(wall_ms / CHUNK_MS)`, first chunk active,
     rest idle) — this last one is the direct regression pin for the
     original bug.
4. **i18n key relocation, partial-miss failure mode.** If one of the 4
   locale files is missed (e.g. `ko/plan.json` still has
   `calendar.wallClockLabel`/`activeLabel` and nothing at the new
   `report.wallClockLabel`/`activeLabel` path), i18next's default behavior
   on a missing key is to render the **raw key string** (`report.wallClockLabel`)
   literally in the UI for that locale only — not a crash, not an English
   fallback in this repo's i18n config unless one is explicitly set up,
   just a silently wrong-looking string that reads like a bug straight out
   of a debug build. This ships green under the current suite because:
   - The English fixture/test almost certainly only exercises `en`.
   - A human reviewer who doesn't read Korean/Vietnamese/Chinese has no way
     to eyeball-catch this in a screenshot review — this is exactly why the
     task frames it as "a test would catch it, a human reviewing in a
     language they don't read would not."
   **How a test actually catches it (vs. a human eyeballing):** a
   structural, non-visual check that does NOT require reading any
   translated text — e.g., a small Node/vitest script (or an addition to
   an existing i18n-shape test if one exists) that: (a) loads all 4
   `plan.json` files as JSON, (b) asserts `report.wallClockLabel` and
   `report.activeLabel` are present (non-empty strings) in every one of
   the 4 files, and (c) asserts neither `report.calendar.wallClockLabel`
   nor `report.calendar.activeLabel` still exists in any of the 4 files
   (catching a copy-instead-of-move that leaves the old path stale/orphaned
   too). This is exactly the "completeness across a registry" invariant
   class (§2) applied to a 4-entry locale registry, and it is genuinely a
   place a green suite can hide a real user-facing defect for exactly the
   locales the team is least likely to manually verify.

## 5. Severity & priority

Ranked worst-first (user-visible / correctness / data-integrity first,
cosmetic/internal-only last):

1. **[Highest] `inferredSegment()` mis-attribution or silent data loss**
   (trap 3). Affects every session with no declared Focus history — likely
   a large, silent population. Wrong output looks like legitimate data;
   nothing in the UI signals "this number might be wrong." This is also
   the exact class of bug (round 3) that has already shipped once with a
   fully green suite, and the function had zero direct test coverage until
   this pass. Gate the merge on the idle-tail case (§6.A.5) specifically,
   not just "some inferredSegment tests exist."
2. **[High] Cross-view consistency regression (DERIVED-DUAL-VIEW) —
   List and Calendar silently diverging again**, whether via the aggregate
   bars' sizing fix being incomplete, or a future change to only one view.
   This is the pattern that has already cost this project a full extra
   round of work once. The plan's §6.B.5 test is the correct, permanent
   guard — treat its absence or a weak version of it (e.g., only checking
   presence of both numbers rather than their *equality*) as a blocking
   gap, not a nice-to-have.
3. **[High] i18n partial-miss silently rendering a raw key** (trap 4).
   Directly user-visible (to a non-English-reading user specifically —
   arguably worse than an English-only bug, since it's least likely to be
   manually caught pre-release) and 100% preventable with a cheap
   structural test. Low effort, high value to gate on.
4. **[Medium] `idleStripes.ts` extraction regressing `FocusCalendarView`'s
   already-shipped (uncommitted) round-4 behavior** (trap 2). Real
   user-visible risk (wrong/missing idle stripes on a view that already
   shipped correctly) but scoped to one component, and the plan already
   names a concrete, cheap check (`FocusCalendarView.test.tsx` must need
   zero assertion changes) — the risk is mainly in that check being
   trusted without also directly unit-testing the extracted helper in
   isolation (see trap 2's required assertion).
5. **[Medium, but easy to mis-read as higher] Aggregate bars' visible
   sizing change** (trap 1). Real user-visible change, but explicitly
   correct and called out by the plan/PO — the actual risk here is process
   (someone unfamiliar with this reasoning "fixing" it back to `wall_ms`
   sizing later), not a defect in this change itself. Mitigate with an
   explicit assertion (not just a code comment) plus the plain-language PR
   note the plan already commits to writing.
6. **[Lower] Fixture-value ripple in `FocusReportModal.test.tsx`**
   (the 75%/25% → 67%/33% on-item-percentage change). Purely a test-file
   consistency risk, already flagged and pre-verified by the plan (§8) for
   the other two tests that share the base fixture. Worth one direct
   re-check after implementation (run the full file, treat any other
   newly-failing assertion as a math signal, not something to loosen) but
   is not itself a user-facing risk.
7. **[Lowest / cosmetic] Docs drift** (`ARCHITECTURE.md`, `docs/API.md`,
   `client/README.md`, `server/README.md` not extended per §7). No
   functional risk, but per `CLAUDE.md`'s non-negotiable rule to keep docs
   updated in the same change-set — flag if the PR ships without them,
   since this project's own working guide treats that as a defect class
   of its own (undocumented behavior change), not a style nit.
