# QA Assessment — focus-calendar-board

> Authored by `qa-strategist`. **This is the document the user reads first.** It
> answers: is the change adequately tested, where are the gaps, have we shipped
> this *class* of gap before, and how do we stop it.

## Change summary
This adds a new top-level "Calendar" page (`/focus-calendar`) that shows the
existing focus-time swimlane calendar across every monitored project at once,
filterable independently by project, session, and time period, backed by a
new `GET /api/focus-report` endpoint that reuses the existing (unmodified)
report-computation engine. The existing per-project modal is left behaviorally
untouched but has its rendering chrome extracted into a shared component so
both entry points use one implementation. No code exists yet — this QA pass
evaluates a finalized, build-ready plan plus a fully-designed test suite
(T1–T7) against the current, real codebase before a single line is written.

## Coverage verdict
**GAPPED**

This is not BLIND: the plan's own test design correctly recognizes and
targets this project's #1 recurring failure shape ("one rendering surface /
one computation path, multiple consumers, no shared source of truth") with
purpose-built countermeasures — T1 (cross-route parity) and T2 (extending,
not forking, this morning's "[standing template]" cross-view test). That is
the right structural response, already in the design, not something QA has to
invent from scratch.

It is not ADEQUATE either, because two real, load-bearing gaps exist in the
plan *as currently written*, independent of "will the tests be built" — one
in the test design itself, one in the technical plan's own artifact
inventory:

1. **T1's parity assertion is under-specified and would pass while
   comparing nothing meaningful if built literally as "deep-equal the two
   response bodies."** The old route's envelope has no `session_id` key; the
   new route's does. A naive full-object `assert.deepEqual` is false by
   construction and will get "fixed" by stripping fields until green — the
   exact way a consistency guard quietly loses its teeth. (Flagged HIGH by
   `risk.md` §4a; `unit-tests.md` §1e and `e2e-tests.md` §2a already correct
   this by scoping to `sessions`/`items`/`totals` sub-objects plus a separate
   echo-back assertion — but this correction must actually ship as designed,
   not regress to the naive form during implementation.)
2. **DEC-6's relabeled `concurrency_ratio` copy has no i18n key anywhere in
   the technical plan's own F12 key table.** `decisions.md` DEC-6 and
   `technical-plan.md` §5/§8 commit to a board-specific relabel; F12's key
   list (`title, projectFilter, allProjects, sessionFilter, allSessions,
   customRange, dayView, from, to`) has no corresponding key, in any locale.
   This can ship as a hardcoded English string (invisible to zh/vi/ko users)
   and **no test in T1–T7 would catch it** — `unit-tests.md` §5d only checks
   that *some* string differs from the modal's copy, not that it's a real,
   translated i18n key. This is a build-blocking plan gap, not a missing
   test to bolt on after.

Once these two are corrected — before implementation, not as a follow-up —
the rest of the design (T3–T7, the regression-suite-run-unmodified
requirement, and the snapshot byte-identity check) is genuinely strong and
would move this to ADEQUATE.

## Current coverage
Baseline actually run on 2026-07-26, before any of this feature's code
exists (from `coverage.md` §4):

- **Server** — `npm run test:server`: **913/913 pass**, 201 suites, 0
  fail/skip. Full run (not targeted), ~21s.
- **Client** — targeted subset (`FocusReportModal.test.tsx`,
  `FocusCalendarView.test.tsx`, `calendarLanes.test.ts`, `Sidebar.test.tsx`,
  `i18n.test.ts`, `screens.snapshot.test.tsx`): **77/77 pass**. Full suite
  (`npm run test:client`): **435/435 pass**, 37 files.

Both baselines are **GREEN**. What guards each touched surface today:

| Surface | Guard today | Verdict |
|---|---|---|
| `server/lib/focus-report.js` computation (unmodified by this plan) | `focus-report.test.js`, 768 lines, unit-grade | GUARDED |
| `GET /:id/focus-report` (old route, byte-unmodified) | `projects.test.js` lines 211-294 | GUARDED (scoping/shape/404); **UNGUARDED for `?sources=`**, a real pre-existing, deliberately-not-fixed gap |
| `FocusReportModal.tsx` current behavior | 18 tests incl. the "[standing template]" cross-view parity test (line 518) | GUARDED |
| `FocusCalendarView.tsx` current (uncontrolled) behavior | 13 tests | GUARDED |
| `calendarLanes.ts` swimlane scheduler | 8 tests, untouched by this plan | GUARDED |
| `Sidebar.tsx` nav ordering | 11 tests, but **"Projects" itself has zero existing assertion** — no label/href/position check | PARTIAL — real, pre-existing hole adjacent to this change's insertion point |
| `i18n.test.ts` registry-driven completeness pattern | 15 tests; one existing `LOCALES`-loop block (key-relocation case) proves the pattern is reusable | Pattern GUARDED; not yet applied to `nav:focusCalendar` or DEC-6's key (see gaps) |
| `screens.snapshot.test.tsx` — `Projects`/`KanbanBoard` cases | Existing byte-identical baselines | GUARDED — the single strongest mechanical fence against chrome-extraction leakage |
| `GET /api/focus-report`, `FocusCalendarBoard.tsx`, `FocusReportBody.tsx`, `TimePeriodPicker.tsx`, `nav:focusCalendar` key | None — don't exist yet | UNGUARDED (expected; T1–T7 are the designed answer) |

## Gaps & test-debt diagnosis

**Have we shipped this class of gap before?** Yes — this is now the **3rd
instance in one day** of this project's own recurring pattern (informally
named `DERIVED-DUAL-VIEW` in this morning's `focus-report-fidelity` QA run;
this project has no formal `PROJECT-CONTEXT.md`/defect catalog, so there is
no id to cite beyond that run-log entry):
1. Round 4 (earlier): Calendar view got an idle-stripe fix, List view didn't
   — shipped-incomplete.
2. `6e29722` (this morning, same day): reactive fix — List view corrected,
   `idleStripes.ts` extracted, the "[standing template]" cross-view test
   installed as the durable guardrail with an explicit self-imposed rule:
   "extend THIS test, not a view-local one."
3. **This change** (now): a **third rendering consumer** (`FocusReportBody`
   serving modal + board) and a **second computation path** (old route + new
   route) land in the same feature area, same day. Unlike instances 1 and 2,
   this one has a **designed countermeasure already in the plan** (T1, T2) —
   which is why this is GAPPED, not BLIND. But the countermeasure has a
   specific implementation flaw (§ above) that, if not corrected, would
   reproduce the exact same "green suite, silently forked" shape a third
   time in one day, this time pre-emptively rather than caught by a bug
   report.

**Systemic reason the gaps exist (not just "two tests are missing"):**
- The T1 gap is systemic to *any* pairwise parity test written by hand: the
  old and new routes' envelopes differ by design (a real, intentional
  asymmetry — `session_id` only exists on the new route), so "deep-equal the
  whole response" is a plausible-looking but structurally wrong first draft.
  Nothing in this project enforces "parity tests must explicitly enumerate
  compared fields" as a convention — it depends on whoever writes the test
  noticing the envelope difference themselves. `risk.md` caught it this time
  because grounding against the actual route code was done line-by-line;
  that diligence is not mechanically guaranteed for the *next* parity test
  this pattern will need (a 3rd or 4th route).
- The DEC-6 gap is systemic to how this project turns a decision into a
  build checklist: `decisions.md` DEC-6 and `technical-plan.md` §5/§8 commit
  to new user-visible copy, but the *only* place new `plan.json` keys are
  enumerated is F12's hand-maintained key list, which was never
  cross-checked against the decisions log for completeness. Nothing forces
  "every DECIDED item that changes user-visible copy has a corresponding
  i18n key in the build's own key inventory" — the same class of gap this
  fallback log has already seen across other projects as "risk.md's
  recommended fix doesn't mechanically land in the downstream doc"
  (laundryroom-alerts 2026-07-17, todo-ios-app 2026-07-19, rule-manager-v2
  2026-07-24) — here it's the *technical plan's* key table that silently
  dropped a decision, not the test-design doc, but the same "hand-sync
  between two artifacts, no mechanical check" root cause.

## Recommendation

**Must-add-now (gate this change, prioritized worst-first):**
1. **Fix T1's parity assertion before it's implemented**, not after: two
   explicit assertion groups — (a) `sessions`/`items`/`totals` deep-equal
   between old and new routes, cited field-by-field, not a whole-body
   compare; (b) a separate echo-back check that `project_id`/`session_id` in
   the new route's envelope match what was requested (`null` when
   unfiltered). `unit-tests.md` §1e and `e2e-tests.md` §2a already specify
   this correctly — hold implementation to that spec, not a simplified
   version of it.
2. **Add DEC-6's missing i18n key to `technical-plan.md`'s F12 table now**,
   before build starts (e.g. `report.board.concurrencyLabel` or similar,
   real value TBD — see open decision below), in all four locales, and add a
   registry-driven (`LOCALES`-loop) completeness test for that key mirroring
   the pattern `unit-tests.md` §7 already uses for `nav:focusCalendar`.
   Extend `unit-tests.md` §5d beyond "differs from the modal's copy" to also
   assert the string resolves via `i18n.t(...)`, not a hardcoded literal.
3. **T3's filter-independence tests must assert on rendered output, not just
   mocked fetch-call arguments** (`risk.md` §4e) — a client-side filter of
   the rendered `<option>` list would satisfy a fetch-args-only assertion
   while violating DEC-2. `unit-tests.md` §5b is already specified this way;
   verify it lands as written.
4. **T1 needs an explicit `?sources=`-present case comparing old vs. new
   route side-by-side** (`risk.md` §4d) — proving the asymmetry (new route
   narrows, old route doesn't) is a pinned, tested fact, not just documented
   prose that a future "helpful" fix to the old route could silently break.
5. **Sidebar ordering test (T5's new `it`)** is the *first* test in this
   file to check "Projects" at all — treat it as load-bearing, not
   incidental, given zero prior assertion exists for the entry immediately
   before this change's insertion point.

**Durable cure (stops the whole class, not just this change):**
- **Generalize T1's parity check into a reusable test-support assertion**
  (e.g. a small shared helper asserting "report-body fields match, envelope
  fields echo correctly") rather than a hand-written per-pair comparison.
  The next new consumer of `buildProjectFocusReport` (there will be one —
  this pattern has already repeated twice today) should not have to
  re-derive "which fields are envelope vs. body" from scratch.
- **Keep enforcing the "[standing template], extend don't fork" rule as a
  literal code-review check**, not just a comment: confirm T2 is actually
  added as the next `it(...)` inside the existing `describe` block in
  `FocusReportModal.test.tsx`, not a new file. If it ships as a separate
  file, the guardrail this morning's fix installed is defeated on its first
  real use, hours after being written.
- **Add a lightweight process rule**: every `DEC-*` entry that changes
  user-visible copy must name the i18n key(s) it requires, and the tech
  lead's own key-inventory table (F-series in this plan's convention) must
  be diffed against the decisions log before a plan is marked build-ready.
  This is cheaper than a test and closes the DEC-6 class of gap at the
  source rather than catching it downstream.

**Safe to ship once the must-adds are in:** Yes. The plan's overall shape is
sound and the test design (T1–T7) already covers every named invariant
correctly in structure; the two corrections above are narrow, well-scoped,
and don't require re-architecting anything. Once items 1–2 are folded into
the technical plan/test design (not just added as an afterthought) and items
3–5 are confirmed built as specified, this change should move to ADEQUATE.

## Open decisions for the user
- [ ] Lock DEC-6's actual board-specific copy string (all four locales) and
      its i18n key name before build — `change-brief.md` itself notes the
      plan's copy is only an example ("e.g. 'Concurrent agent sessions'"),
      not a locked literal. QA's recommendation only verifies *some*
      distinct, translated string renders unless you lock exact wording now.
- [ ] Decide whether to accept the durable-cure items (shared parity-assertion
      helper, DEC-copy-to-i18n-key process rule) now, or defer them and take
      only the point fixes (must-add-now items 1–5) for this change. Given
      this is the 3rd occurrence of the same pattern in one day, I'd lean
      toward taking at least the process rule now — it's cheap — but the
      shared test helper can reasonably wait for the next occurrence if you
      want to keep this change's scope tight.
- [ ] Confirm whether `Sidebar.tsx`'s pre-existing "Projects" test gap
      (label/href/position never asserted, independent of this change)
      should be closed as part of this change's T5 work (cheap, already
      adjacent) or tracked separately — it's not caused by this plan, but
      this plan is the first natural opportunity to close it.

---
*Memory updated:* qa-run-log.md ✅ · no `PROJECT-CONTEXT.md`/defect catalog
configured for this project — no catalog entry to update; the informal
`DERIVED-DUAL-VIEW` pattern name (first used in this morning's
`focus-report-fidelity` run-log entry) is carried forward here as this
project's own emerging shorthand, not a formal catalog id.
