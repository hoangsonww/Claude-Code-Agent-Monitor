# QA Assessment — focus-report-fidelity (List-view parity)

> Authored by `qa-strategist`. **This is the document the user reads first.** It
> answers: is the change adequately tested, where are the gaps, have we shipped
> this *class* of gap before, and how do we stop it.

## Change summary

This change set does two things at once: (1) brings `FocusReportModal.tsx`'s
List view up to parity with the already-shipped-but-uncommitted Calendar-view
idle-awareness fix — adding an idle-stripe overlay to the per-session bar via
a new shared `client/src/lib/idleStripes.ts` helper, and switching the two
aggregate bars (per-item rollup, project-split) to size by `active_ms` instead
of `wall_ms`, closing an embedded bug where the bar's visible width and its
adjacent printed number already disagree; and (2) closes a zero-test-coverage
gap on `inferredSegment()`, the server-side inference fallback that was the
exact function behind this project's original round-3 data-fidelity bug, plus
adds a permanent List-vs-Calendar cross-view consistency regression test. No
server behavior changes and no wire-shape changes — every field the client
newly reads already ships today.

## Coverage verdict

**BLIND** (for the current, pre-this-change state of the repo — before any of
the tests this pass proposes are written).

This change lands squarely on two of this project's own already-demonstrated
recurring failure modes, both of which have **zero guard today**:

1. **DERIVED-DUAL-VIEW** (a value computed once server-side, rendered by two
   independent UI surfaces, with no shared helper/test enforcing agreement).
   This project's own risk analysis (`risk.md` §0) documents this pattern has
   already fired once this session: round 4 shipped the idle-aware fix to
   `FocusCalendarView.tsx` only, silently leaving `FocusReportModal.tsx`'s
   List view stale (and internally self-contradicting — a bar labeled with
   `active_ms` but sized by `wall_ms`). This change is being made *specifically
   because* that gap shipped once with a fully green suite — and as of today,
   there is still no cross-view consistency test in the repo. If this change's
   own List-view fix is itself incomplete on landing (e.g., wired only into
   the per-session bar, not both aggregate bars, or wired into one aggregate
   bar but not the other), nothing in the current suite would catch it — the
   exact same shape recurring a second time, in the same session, still
   unguarded.
2. **`inferredSegment()` zero coverage.** Confirmed by the cartographer via
   direct grep of every `describe` block in `server/__tests__/focus-report.test.js`:
   none targets `inferredSegment()` or its code path. This is not a new
   surface introduced by this change — it is the *original round-3 bug's own
   function*, still with no dedicated test today. This change's stated intent
   is to finally close that gap, but until the tests land, the function
   remains exactly as exposed as it has been since round 3 shipped.

Both of these are not hypothetical risk — they are named, dated, in-project
recurrences (this session), with an existing document (`risk.md`) explicitly
tracking them as "DERIVED-DUAL-VIEW." A change that touches both surfaces,
evaluated against the coverage that exists *right now*, is BLIND by this
role's own definition: it lands on a known recurring failure mode with no
guard. This verdict is expected to move to **ADEQUATE** once the must-add-now
tests below (already well-designed in `unit-tests.md`) are actually written
and passing — this is a solvable, not a stop-everything, situation, but it
must not be treated as "GAPPED-but-fine-to-defer."

## Current coverage

| Surface | Guard today | Baseline |
|---|---|---|
| `server/lib/focus-report.js` — `inferredSegment()` | **None.** 6 `describe` blocks in `focus-report.test.js`, none target this function; every existing test seeds a declared `Focus` event so `buildFocusSegments()` never returns `[]`, so the `inferredSegment` branch is never exercised. The sibling `focus-inference.test.js` tests the *writer* of `focus_inferences` rows, not this *reader*. | Whatever passes today does so without ever calling this function. |
| `FocusReportModal.tsx` List view — idle-stripe overlay, dual header split, two aggregate bars' sizing | **None for the new/changed behavior.** `FocusReportModal.test.tsx`'s `makeReport()` fixture sets `active_ms === wall_ms` for every segment and every totals bucket today — a bar sized by either field is numerically identical, so no existing assertion can distinguish correct from wrong sizing. | 13/13 `it()` blocks green (loading/error/empty/toggle/inferred-chip/close/link behavior — unaffected by this change and will keep passing). |
| `FocusReportModal.tsx` on-item-percentage stat tile | **Guarded but the wrong assertion.** Passes today at 75%/25%, but the plan's new fixture will legitimately produce 67%/33% — a deliberate, called-out edit, not a regression signal. | Green today; will need a deliberate value update. |
| `FocusCalendarView.tsx` idle-stripe / dual wall-clock-agent-time behavior | **Guarded.** Two idle-stripe assertions + one dual-label-text assertion, all currently passing — this is the exact reference pattern the new `idleStripes.ts` extraction must not disturb. | 13/13 `it()` blocks green. Must stay green with **zero assertion changes** through the refactor (a directly falsifiable acceptance signal, not just a hope). |
| List-vs-Calendar cross-view consistency | **None.** No test anywhere compares the two views' numbers/geometry for the same segment. | N/A — doesn't exist. |
| `idleStripesForBlock`/`idleStripesInRange` as a standalone lib unit | **None.** Only ever exercised indirectly through `FocusCalendarView.test.tsx`'s component-level assertions; once promoted to a shared `lib/idleStripes.ts` with a second consumer, it has no dedicated unit test of its own. | N/A — doesn't exist yet. |
| `calendarLanes.ts` / `eventBuckets.ts` (siblings, unaffected) | Guarded, 8/8 and 6/6 green. | Unaffected by this change. |
| `GET /:id/focus-report` route-level test (`server/__tests__/projects.test.js`) | **Adjacent, pre-existing gap, not required for this change:** its only `active_ms`-adjacent assertions force `DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "0"`, which disables idle discounting entirely — so `active_ms` trivially equals `wall_ms` in that fixture regardless of whether idle discounting is wired correctly end-to-end over the wire. Named by the e2e architect as worth flagging even though out of this change's scope. | Green today, but proves nothing about `chunks`/`active_ms` surviving the HTTP round trip. |

**Baseline actually run (per coverage.md, re-verified live):** `npm run
test:server` → 902/902 pass. `npm run test:client` → 403/403 pass (36 files),
including `FocusReportModal.test.tsx` 13/13 and `FocusCalendarView.test.tsx`
13/13. `bash .claude/skills/file-headers/scripts/check-headers.sh` → clean.
`screens.snapshot.test.tsx` confirmed (by direct grep) to render neither modal
today, so no snapshot diff is expected from this change.

## Gaps & test-debt diagnosis

**UNGUARDED surfaces this change touches, today:**
- `inferredSegment()` — the round-3 bug's own function, zero coverage.
- The List view's idle-stripe overlay, dual header split, and both aggregate
  bars' `active_ms` sizing — the fixture structurally cannot distinguish
  correct from wrong.
- List-vs-Calendar cross-view agreement — no test exists at all.
- `idleStripesInRange` as a standalone unit (once promoted from
  component-private to a shared lib module).
- i18n key relocation (`report.calendar.*` → `report.*`) across 4 locale
  files — a partial rename would silently render a raw key string in the
  missed locale(s), invisible to a reviewer who doesn't read that language.

**Systemic reason the gap exists (not just "add a test"):**
This project has one recurring structural cause behind both headline gaps:
**a derived value is computed once, server-side, and consumed by
independently-written client rendering surfaces, with no single shared
rendering helper and no test that asserts the surfaces agree** — named in
this project's own `risk.md` as DERIVED-DUAL-VIEW. Nothing forces a second
consumer of `wall_ms`/`active_ms`/`chunks` to go through the same code path
as the first; a fix to one view is not mechanically required to also touch
the other. That is exactly how round 4 shipped Calendar-only and left List
silently behind with a fully green suite — and it is exactly the shape this
change itself is racing to close. Separately, `inferredSegment()`'s gap has
a narrower, equally systemic cause: every existing test in
`focus-report.test.js` seeds a declared `Focus` event, so the file's entire
suite structurally never reaches the `if (segments.length === 0)` fallback
branch — the function has been exercisable-but-untested since round 3, not
because anyone forgot a test, but because the seeding convention in use
never produces a zero-declared-segments session.

**Have we shipped this class of gap before?**
Yes — **2x this session, no formal defect-catalog exists to cite an id
against** (confirmed: no `PROJECT-CONTEXT.md` at repo root). Round 3 shipped
`inferredSegment()`'s data-fidelity bug with zero test coverage on that
function (still true today, closed only by this pass). Round 4 shipped the
idle-aware fix into `FocusCalendarView.tsx` only, leaving
`FocusReportModal.tsx` stale — the first live occurrence of DERIVED-DUAL-VIEW
in this codebase, per `risk.md`'s own framing. This change is that pattern's
**second occurrence** if its own fix ships without the cross-view test
actually landing and passing — not a fresh risk being introduced, but the
same trap being walked into a second time in one session, this time with a
document that already names it and a test that already fully designed.

**A more specific, corroborating find, worth naming on its own:** `risk.md`
itself named a concrete required assertion for trap 1 (aggregate-bar
sizing) — "an explicit fixture case where `active_ms` is near-zero and
`wall_ms` is large, asserting near-0 width (not full width)," to guard
against a future contributor "fixing" the intentionally-shrunk bar back to
`wall_ms` sizing. `unit-tests.md`'s §2.4 test for that exact surface reuses
the base fixture's 20m/10m (67%/33%) split, not a near-zero case. This is the
same meta-pattern this QA pipeline has now seen recur across other projects
in this fallback log (a risk analyst's own named required assertion not
mechanically carried into the unit-test design) — worth a one-line addition
before this test-set is considered complete, not a blocking rewrite.

## Recommendation

**Must-add-now (gates this change, prioritized worst-first):**
1. **`inferredSegment()`'s idle-tail case** (`unit-tests.md` §1, Case 5) — the
   single highest-value test in this whole set. It reproduces the round-3
   bug shape (`wall_ms` rides the full span, `active_ms < wall_ms`, chunk
   count/idle-tail correct) through the one code path this repo has never
   covered. The other 4 `inferredSegment` cases (item-kind resolution,
   detour-kind, deleted-item, unclassified) should land alongside it — they
   pin the "declared-history-is-ground-truth" and "no fabricated segment"
   invariants `risk.md` calls out.
2. **The List-vs-Calendar cross-view consistency test** (`unit-tests.md` §3)
   — the permanent guard against DERIVED-DUAL-VIEW's second occurrence. This
   is the one test that would reproduce today's exact failure mode
   (round-4-Calendar-only-fix) if run against the state right after round 4
   but before this pass's List-view fix — confirmed red-first by the unit
   architect against that exact intermediate state.
3. **The two aggregate bars' `active_ms`-sizing test** (`unit-tests.md` §2.4)
   — the direct regression test for the embedded "label says `active_ms`,
   bar renders `wall_ms`" bug. **Add the near-zero-`active_ms` fixture case
   `risk.md` explicitly asked for** (large `wall_ms`, ~0 `active_ms`,
   asserting near-0 width) — this is the cheap addition flagged above and
   should not be dropped; without it, a future contributor could revert the
   aggregate bars to `wall_ms` sizing and this test would still pass.
4. **`idleStripes.test.ts`** (`unit-tests.md` §4), including the two
   byte-for-byte-ported fixtures from `FocusCalendarView.test.tsx` — this is
   what actually proves the extraction is behavior-preserving, independent of
   whether the component test happens to still pass.
5. **The i18n registry-completeness check** (`unit-tests.md` §5) — cheap,
   4-locale, structural (not visual), and closes the one silent-failure mode
   a human reviewer literally cannot eyeball-catch in 3 of 4 locales.
6. **`FocusReportModal.test.tsx`'s fixture update + the 75%/25% → 67%/33%
   assertion edit** — expected, deliberate, already fully specified.

**Durable cure (stops the whole class, not just this instance):**
- **DERIVED-DUAL-VIEW needs a standing name and a standing check**, not a
  one-off cross-view test that only covers this pass's fields. The
  structural cure already underway here — routing both views through one
  shared `idleStripesInRange` helper and one server-computed
  `active_ms`/`wall_ms`/`chunks` source, plus a permanent cross-view
  consistency test in `FocusReportModal.test.tsx` — is the right shape and
  should be treated as the template: **any future field added to
  `FocusReportSegment` that either view renders must ship with an update to
  that same cross-view consistency test**, not a separate, view-local test
  only. Recommend this be written down (see Open decisions) so it isn't
  re-discovered a third time.
- **`inferredSegment()`'s gap exists because the seeding convention in
  `focus-report.test.js` structurally never exercises the fallback branch.**
  The durable fix already lands in this pass (a dedicated `describe` block
  that deliberately omits `started_at` and never seeds a declared `Focus`
  event) — recommend this file's own comments (or a short section in
  `server/README.md`'s testing notes) call out explicitly that *any* new
  `describe` block added to this file should state which of the two
  branches (declared vs. inferred) it's exercising, so a future
  contributor doesn't add another declared-only test and believe the
  fallback path is covered by proxy.

**Safe to ship once:** items 1–5 above are written, passing, and (per the
plan's own acceptance criterion) `FocusCalendarView.test.tsx` needs **zero**
assertion changes to stay green through the refactor. If that file needs any
assertion touched, treat it as a live signal of a regression against round
4's still-uncommitted fix, not a refactor detail — stop and re-examine before
merging.

## Open decisions for the user

- [ ] **Adopt "DERIVED-DUAL-VIEW" as a named, tracked pattern for this
  project.** It has now recurred twice in one session (round 4 → this
  change) with no `PROJECT-CONTEXT.md`/defect-catalog to record it against —
  every future occurrence currently has to be re-discovered from scratch by
  whichever agent happens to read `risk.md` fresh. Recommend standing up a
  minimal `PROJECT-CONTEXT.md` (or equivalent) naming this pattern, its two
  known occurrences, and pointing at the cross-view consistency test as the
  standing mitigation, so a third occurrence is caught by convention, not
  luck.
- [ ] **Accept the near-zero-`active_ms` fixture addition to `unit-tests.md`
  §2.4** (flagged above) before calling that test complete, or explicitly
  waive it — it's a one-line fixture change, not a redesign.
- [ ] **Whether to also fix the adjacent, out-of-scope
  `projects.test.js` route-level gap** (its `active_ms` assertions are
  neutralized by `DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "0"`, so the HTTP
  contract this List-view work depends on is unproven end-to-end). Not
  required for this change to ship, but cheap insurance if picked up in the
  same pass.

---
*Memory updated:* qa-run-log.md ✅ · this project's recurring-issue catalog:
n/a (no `PROJECT-CONTEXT.md` configured) — DERIVED-DUAL-VIEW proposed above
as the founding entry if/when Sara stands one up.
