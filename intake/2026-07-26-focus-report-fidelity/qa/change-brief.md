# Change Brief — focus-report-fidelity (List-view parity)

> Authored by `qa-triage`. The single normalized statement of *what we are
> about to change*, before any coverage evaluation. **Nothing in this
> change set has been implemented yet** — this brief describes the
> approved, not-yet-built plan, confirmed against the live repo.

- **Date:** 2026-07-26
- **Scope source:** intake-handoff (`technical-plan.md`, cross-checked live
  against `git status`/`git diff HEAD` and direct file reads — no
  disagreement found between plan and code)
- **Intake link:** `intake/2026-07-26-focus-report-fidelity/technical-plan.md`
  (+ `pm-plan.md`, `supporting/{architect,engineer,qa,product-owner}.md`)

## Change summary

Two independent, bundled pieces of not-yet-written work: (1) bring
`FocusReportModal.tsx`'s **List view** to parity with the already-shipped
(but uncommitted) Calendar-view idle-awareness fix — idle-stripe overlay on
the per-session bar via a new shared `client/src/lib/idleStripes.ts` helper,
`active_ms`-based sizing on the two aggregate bars (closing an embedded
"label says active_ms, bar is wall_ms-sized" bug on the same lines) — and
(2) close a zero-coverage test gap on `inferredSegment()`, the server
function behind the original round-3 data-fidelity bug, plus add a
permanent List-vs-Calendar cross-view consistency regression test. No
server behavior/wire-shape change; all fields consumed already exist and
ship today.

## Changed files (by layer)

**Not yet touched (per technical-plan.md, all confirmed unmodified/absent
in the live tree):**

- `client/src/lib/idleStripes.ts` — **does not exist yet** (confirmed:
  `ls` fails). New file to be created; extraction of
  `FocusCalendarView.tsx`'s current local `idleStripesForBlock`.
- `client/src/components/FocusCalendarView.tsx` — currently still has its
  own local `IdleStripe` interface / `idleStripesForBlock()` (confirmed via
  grep, lines ~104-125) and its own `t("report.calendar.wallClockLabel")` /
  `t("report.calendar.activeLabel")` calls (lines ~517-519). To be
  refactored to import the shared helper — plan states this must be
  behavior-preserving (its own test file must pass unmodified).
- `client/src/components/FocusReportModal.tsx` — confirmed **fully
  committed at commit `2c1ef2f`, zero working-tree diff, zero diff vs
  `HEAD`**. Currently: per-session bar sizes/labels by `wall_ms` only (line
  242, 268, 279); per-item rollup and project-split bars already print an
  `active_ms` number (lines 300, 323) next to a bar sized by `wall_ms`
  (lines 305, 318) — the embedded bug, confirmed present today by direct
  read. `SegmentedBar`'s segment type (line ~392) only picks
  `kind`/`wall_ms`/`label` (+ `inferred`/`inferred_reason`) — no
  `active_ms`/`chunks`/`start`/`end`, no `sizeField` prop yet.
- `client/src/i18n/locales/{en,ko,vi,zh}/plan.json` — confirmed
  `wallClockLabel`/`activeLabel` still live under the `calendar` sub-object
  (grep confirms, e.g. en/plan.json lines 63-72). Not yet relocated to
  `report.wallClockLabel`/`report.activeLabel`.
- `server/__tests__/focus-report.test.js` — confirmed **no
  `inferredSegment`-specific `describe` block exists** (grep of all
  `describe(` blocks: `buildFocusSegments`, `buildSessionFocusReport - idle
  grace window`, `buildActivityChunks`, `buildSessionFocusReport - activity
  chunks`, `buildProjectFocusReport`, `mergeIntervals` — none target
  `inferredSegment` directly). Gap confirmed real, not already closed.
- `client/src/components/__tests__/FocusReportModal.test.tsx` — confirmed
  zero working-tree diff vs `HEAD` (not yet touched). Its `makeReport()`
  fixture is presumed (per plan) to currently have `active_ms === wall_ms`
  everywhere — not independently re-derived here, but this is exactly the
  structural reason the plan gives for why the existing suite can't catch
  a wrong-field-sizing bug, and is consistent with every existing bar
  reading `wall_ms` correctly matching every existing label.
- Docs (`ARCHITECTURE.md`, `docs/API.md`, `client/README.md`,
  `server/README.md`) — plan calls for extending existing round-4 prose;
  not yet done for List view (these files' current diffs are round-4-only,
  confirmed by `git diff --stat HEAD`).

**Already in the working tree, uncommitted (round-4 — a separate, prior
change this pass builds on top of, per the plan's step 1 "land this
first"):**

- `server/lib/focus-report.js` (+44/-0) — `CHUNK_MS`, `buildActivityChunks`.
- `server/__tests__/focus-report.test.js` (+73/-0) — round-4's own
  `buildActivityChunks`/`activity chunks` describe blocks (distinct from
  the still-missing `inferredSegment` block this pass must add).
- `client/src/lib/types.ts` (+16/-0) — `FocusReportChunk`, `chunks?` on
  `FocusReportSegment` (confirmed present: `types.ts` lines 1553-1570).
- `client/src/components/FocusCalendarView.tsx` (+324/-~) and its test
  (+321/-~) — idle-stripe overlay, dual wall-clock/agent-time popup.
- 4 locale `plan.json` files (+16/-? each) — `calendar.wallClockLabel`/
  `calendar.activeLabel` keys added (round-4's original add, pre-relocation).
- `ARCHITECTURE.md`, `docs/API.md`, `client/README.md`, `server/README.md` —
  round-4's own doc updates.
- Untracked (`??`): `client/src/components/SegmentEventsModal.tsx`,
  `client/src/lib/eventBuckets.ts` + `client/src/lib/__tests__/eventBuckets.test.ts`
  — an earlier round (round 1/2) drill-down modal + event-bucketing helper,
  file-header audit confirmed clean (`check-headers.sh` → "All applicable
  files carry the authorship header").

**Tests changed in this set:** none yet — the two test files this plan
targets (`server/__tests__/focus-report.test.js` for the new
`inferredSegment` block, `client/src/components/__tests__/FocusReportModal.test.tsx`
for List-view/cross-view assertions) are both pending.

**Config / other:** none.

**Baseline re-verified live, matching the plan's stated numbers exactly:**
`npm run test:server` → 902/902 pass. `npm run test:client` → 403/403 pass
(36 files). `bash .claude/skills/file-headers/scripts/check-headers.sh` →
clean. This confirms the round-4 foundation this pass builds on is real and
green today, not a stale self-report.

## Surfaces / features touched

- `FocusReportModal.tsx` **List view** — three duration-bearing bars: the
  per-session bar, the per-item kind-rollup bar, the project-wide kind-split
  bar — plus their adjacent printed numbers/header text.
- `server/lib/focus-report.js`'s `inferredSegment()` — the inference
  fallback path used when a session has no declared Focus history (the
  exact function behind the original round-3 bug); test-coverage-only
  change, no behavior change to the function itself in this pass.
- Indirectly, `FocusCalendarView.tsx` — receives a pure refactor (local
  stripe-math extracted to a shared helper) with an explicit
  "must not change behavior, its own test file must pass unmodified"
  constraint.

## Variant relevance

This project's #1 recurring-bug-class analog, per this intake's own
diagnosis (no formal defect-class catalog exists yet — flagged for Sara's
call, not created here): **two independent rendering surfaces showing the
same underlying computed value, with no shared helper and no test enforcing
they agree.** That is precisely what this change touches — List view and
Calendar view are the two "variants" that must render the same
`wall_ms`/`active_ms`/`chunks` facts identically for the same segment. The
plan's own §5 names this explicitly and its §6.B.5 cross-view consistency
test is the direct mechanism meant to guard it. This is the single most
important invariant this QA pass should weight heavily — it is also, by the
PM's own account, the second time in this session this exact shape has
caused a shipped-but-incomplete fix (Calendar-before-round-4, List-before-
this-pass).

## Test-invariants at risk

No `PROJECT-CONTEXT.md`/defect-catalog is configured for this repo
(confirmed absent — no file at project root); naming general invariant
classes plainly, per the technical-plan's own §5 framing where it overlaps:

- [x] **Cross-path/cross-view consistency** — List view and Calendar view
  must state the same wall-clock/agent-time numbers for the same segment.
  Directly touched and is the plan's own named highest-priority regression
  guard (§6.B.5, "the permanent regression guard... the one test that would
  have caught round 4 stopping at one consumer"). Not yet implemented.
- [x] **Internal self-consistency (a view's own label vs. its own visual)** —
  the embedded bug: a printed `active_ms` number next to a `wall_ms`-sized
  bar. Directly touched — this is one of two things this change set exists
  to fix (plan §9 DoD: "label and bar changed together, not separately").
- [x] **Shared-computation single-sourcing** — no second, view-specific
  duplicate of `active_ms`/idle-stripe math; must go through
  `focus-report.js`'s already-computed fields and the one new shared
  `idleStripesInRange` helper, never a second implementation. Explicitly
  named by the plan (§5) as the guardrail for this exact change.
- [ ] **Round-trip integrity** — not applicable; no persistence/storage
  change in this pass (no server change at all).
- [ ] **No unresolved-boundary-token leak** — not applicable in the literal
  i18n-placeholder sense, but adjacent: the i18n key relocation
  (`report.calendar.wallClockLabel` → `report.wallClockLabel`, all 4
  locales) carries a real, named risk if done partially — "a partial rename
  ... would silently fall back to the key path and render a raw i18n key
  string in that locale" (plan §8). Worth a dedicated test-plan check: grep
  all four locale files post-change for exactly one occurrence each at the
  new path.
- [x] **Refactor-must-not-change-behavior** — `FocusCalendarView.tsx`'s
  extraction to the shared helper is stated as behavior-preserving; its own
  test file is required to pass with zero assertion changes. A real
  assertion change there would itself be a signal something regressed.

## Stated intent / acceptance

- "The report must never assert a duration/visual size that isn't backed by
  real worked time" (PO's distillation, `pm-plan.md` §5) — the umbrella
  acceptance criterion driving both the List-view fix and the cross-view
  test.
- Per-session bar: sizing basis stays `wall_ms` (unchanged) — only the
  *label* gains a labeled dual wall-clock/agent-time split when the two
  numbers diverge, and only the *idle-stripe overlay* is added on top.
  Explicitly NOT switching this bar's sizing to `active_ms` (technical-plan
  §2, first bullet) — this is a specific, easy-to-get-wrong distinction a
  test plan must respect: the per-session bar box changing size on this
  change is a red flag, not a confirmation.
- Aggregate bars (per-item rollup, project-split): sizing switches to
  `active_ms`; a visible-behavior change is expected and called out — "a
  kind with real elapsed time but zero active time will now render with ~0
  width... this is the intended fix, not a regression" (plan §4 step 12,
  §8).
- `FocusCalendarView.test.tsx` must need **zero** assertion changes from the
  refactor step; if it needs any, plan states "something in step 3 of §4
  went beyond a pure refactor" — a directly testable acceptance signal.
- `screens.snapshot.test.tsx` is stated to not currently render either
  modal, so no snapshot diff is anticipated from this change — also a
  directly testable/verifiable claim (worth a quick pre-check, not just
  trusting the plan, since a false snapshot diff appearing would itself be
  a signal something touched more than intended).
- Existing "on-item percentage" test in `FocusReportModal.test.tsx` is
  expected to require an assertion-value update (67%/33% not 75%/25%) as a
  deliberate, called-out side effect of the fixture change (plan §6.B.1) —
  a test plan should treat this specific assertion changing as expected,
  not as an unrelated regression to flag.

## Open questions

**Blocking (cannot plan tests):**
- (none identified)

**Non-blocking (proceeding on assumption):**
- The environment's initial session-start `git status` snapshot (shown in
  this agent's system context) listed an entirely different, broader set
  of modified/untracked files (README*.md, wiki/*, `.env.example`,
  `server/db.js`, `server/index.js`, `server/routes/projects.js`,
  `FocusReportModal.tsx`/its test as modified, `FocusCalendarView.tsx` as
  untracked, `calendarLanes.ts`/`focus-inference.js` as untracked) that
  does **not** match the live repo state re-run just now (which matches the
  technical-plan's account exactly: `FocusReportModal.tsx` fully committed
  at `2c1ef2f`, `FocusCalendarView.tsx` modified-uncommitted,
  `calendarLanes.ts` already committed/untouched). → **Assumption:** the
  live `git status`/`git diff HEAD` I re-ran directly is ground truth (per
  this task's own instruction to check it), and the stale system-context
  snapshot reflects a different point in time, not the actual current
  tree. Flagging this explicitly rather than silently trusting either
  source, since a stale scope read would otherwise be exactly the kind of
  "diff and plan disagree" this role exists to surface — resolved in favor
  of the freshly-executed commands, not the passively-supplied context.
- The plan asserts `FocusReportModal.test.tsx`'s current `makeReport()` has
  `active_ms === wall_ms` for every existing segment fixture; not
  independently re-derived line-by-line here (only confirmed the file has
  zero working-tree diff, i.e., is at its pre-round-4 committed state).
  → **Assumption:** true as stated; a test-planning pass should do one
  direct read of the current fixture before writing new assertion values,
  since the plan's own §8 fixture-ripple risk note says exactly this needs
  care.
- Plan states `screens.snapshot.test.tsx` doesn't currently render either
  `FocusReportModal` or `FocusCalendarView`. Not independently verified
  here beyond the file-list read; a full snapshot run happened as part of
  today's baseline `npm run test:client` (403/403 green, screens snapshot
  suite included and passing), which is consistent with, but does not by
  itself prove, "neither modal is rendered there." → **Assumption:** true
  as stated; worth a one-time grep confirmation (`FocusReportModal|FocusCalendarView`
  in `screens.snapshot.test.tsx`) before the implementer starts, cheap
  insurance against a surprise snapshot diff.

## Verdict

**READY**
