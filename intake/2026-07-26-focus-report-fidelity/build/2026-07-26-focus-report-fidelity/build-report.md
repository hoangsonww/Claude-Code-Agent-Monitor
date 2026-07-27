# Build Report — 2026-07-26-focus-report-fidelity

> Authored by `build-lead`, synthesizing the build brief, task list, red/green
> evidence, and review. The document the user reads. This build **stopped at
> green** — it did not commit, push, or open a PR.

## What was built

`FocusReportModal.tsx`'s List view now renders duration the same way
`FocusCalendarView.tsx` already did after round 4: the per-session bar stays
sized by `wall_ms` but overlays an idle-chunk stripe (via a newly-extracted,
shared `client/src/lib/idleStripes.ts` helper — `idleStripesInRange`, used by
*both* views, not re-implemented a second time) and its header now shows a
labeled "Wall clock X · Agent time Y" split whenever the two diverge, instead
of one unlabeled `wall_ms` number. The two aggregate bars (per-item rollup,
project-wide split) are now sized by `active_ms` instead of `wall_ms`, which
also fixes a previously-embedded bug where those two bars already *printed*
an `active_ms` number over a bar sized by the (larger) `wall_ms` figure — a
kind with real elapsed time but near-zero active time now correctly renders
near-zero width there instead of misleadingly near-full width. The
`report.calendar.wallClockLabel`/`activeLabel` i18n keys were relocated up to
`report.wallClockLabel`/`activeLabel` (shared by both views now) across all 4
locale files (`en`/`ko`/`vi`/`zh`) in the same step, mechanically guarded by a
new registry-derived per-locale completeness test. `inferredSegment()` in
`server/lib/focus-report.js` — the exact function behind the original round-3
data-fidelity bug, previously zero-coverage — now has 5 dedicated test cases,
including the round-3-shaped idle-tail case reached via the inference path
instead of a declared segment. A new standing cross-view (List vs. Calendar)
consistency test exists so a future fix landing in only one of the two
rendering surfaces is caught before it ships, not after. No server response
shape changed; `chunks`/`active_ms` were already computed and shipped by
round 4 (commit `2416292`, this worktree's starting commit, already on
`master`). Docs (`ARCHITECTURE.md`, `client/README.md`, `docs/API.md`,
`server/README.md`) were updated to describe the List view's new parity with
Calendar. Everything described here is **uncommitted** in the effort
worktree — build task 17 (the commit) was not yet performed by this build
pass.

## Change verdict

**Verdict:** GREEN
**Durable cure:** applied — de facto catalog id **DERIVED-DUAL-VIEW** ("a
duration value computed once server-side, rendered by two independent client
surfaces, with no shared helper and no test enforcing agreement"), this
project's own name for the pattern (no `PROJECT-CONTEXT.md`/formal catalog
exists here — see "Open decisions" below). All 4 build-brief MANDATORY
obligations confirmed applied as structural cures, not shortcuts:
1. Extract-before-reuse: `idleStripesInRange` is a genuine shared module,
   imported by both `FocusCalendarView.tsx` and `FocusReportModal.tsx`'s
   `SegmentedBar` — never a second re-implementation.
2. Single source for "how long": both aggregate bars size off the
   already-computed `FocusKindTotals.by_kind[kind].active_ms` field — no new
   client-side rollup invented (explicitly rejected by the architect).
3. Standing cross-view regression test: written as a template with an
   in-file comment stating any future `FocusReportSegment` field either view
   renders must extend this same test, not get a separate view-local test.
4. Atomic 4-locale i18n relocation: all 4 locale files moved in the same
   step, mechanically guarded by a registry-derived completeness test (no
   eyeball-scan reliance).

This build went through one fix-loop: the first verify pass BLOCKED on a
client build/typecheck failure (`tsc -b` under `noUncheckedIndexedAccess`,
6 `TS2769`/`TS2532` errors, all non-null array-index assertions in the
brand-new `idleStripes.test.ts`). The implementer's original characterization
of this as unrelated/pre-existing was wrong — it was a real gap in the first
pass's own new test file, introduced by this build, not carried over from
round 4. The fix was narrow and mechanically verified: only the 7 flagged
lines (`stripes[0]!` non-null assertions) changed, confirmed by mtime
comparison across every touched/untracked file (only `idleStripes.test.ts`'s
mtime moved) and by a direct diff read — no test logic, fixture data, or
expected value changed. Second verify pass: GREEN.

## Red → green evidence

| Test | Layer | RED before | GREEN after |
|------|-------|-----------|-------------|
| `client/src/lib/__tests__/idleStripes.test.ts` (10 cases, incl. 2 fixtures ported byte-for-byte from `FocusCalendarView.test.tsx`) | client lib unit | ✅ import-resolution failure — `client/src/lib/idleStripes.ts` did not exist | ✅ 10/10, including the two ported fixtures matching exactly |
| `client/src/i18n/__tests__/i18n.test.ts` — registry-derived 4-locale completeness block (9 assertions) | client i18n | ✅ both directions failed for all 4 locales: new `report.*` path returned the literal key string; old `report.calendar.*` path still resolved | ✅ 15/15 (6 pre-existing + 9 new), all 4 locales |
| `FocusReportModal.test.tsx` — "computes the on-item percentage" (fixture-update side effect) | client component | ✅ `screen.getByText("75%")` not found (new fixture yields 67%/33%) | ✅ updated to 67%/33%, 13/13 |
| `FocusReportModal.test.tsx` — dual wall-clock/agent-time header split | client component | ✅ only one unlabeled `40m 0s` rendered, no `30m 0s` anywhere in "Worker"'s row | ✅ green, both labeled numbers present when they diverge, plain single number when they don't |
| `FocusReportModal.test.tsx` — per-session idle-stripe overlay (+ negative "no chunks → no stripe" sibling) | client component | ✅ `0` `[data-testid="idle-stripe"]` elements found, expected `1` | ✅ green, exactly 1 stripe at the correct `left`/`width`; negative case correctly `0` both before and after |
| `FocusReportModal.test.tsx` — aggregate-bar `active_ms` sizing incl. near-zero-`active_ms` injected kind | client component | ✅ rendered widths `[50, 33.3, 16.7]` (wall_ms-proportional) vs. expected `active_ms`-proportional `[66.7, ~0, 33.3]` | ✅ green, both bars size by `active_ms`, near-zero kind renders `<2%` width |
| `FocusReportModal.test.tsx` — standing cross-view (List vs. Calendar) consistency test | client component | ✅ failed on the very first List-view assertion (header showed only `20m 0s`, zero idle stripes) — the literal reproduction of round-4's exact failure shape, confirming the test is strong enough | ✅ green without modification once the List-view fix landed; also confirms the fetch mock still fires only once across the List→Calendar toggle |
| `server/__tests__/focus-report.test.js` — new `inferredSegment` `describe` block, 5 cases (item-kind, detour-kind, deleted-item, unclassified, round-3-shaped idle-tail via inference) | server integration | n/a — coverage-only, no behavior change; expected to pass immediately | ✅ all 5 pass first run (after an incidental pre-existing test-isolation bug in an unrelated `describe` block's `beforeEach`/`before` env-var capture was found and fixed — test-harness-only, no product code touched) |

Full-suite counts, both verify passes: server 907/907 (902 baseline + 5 new);
client 427/427 across 37 files (403 baseline + 24 new/updated: 10
`idleStripes.test.ts`, 9 `i18n.test.ts`, 5 net new/updated in
`FocusReportModal.test.tsx`). `screens.snapshot.test.tsx` reviewed, no diff
(neither modal is rendered by that suite, confirmed by direct grep, not
assumed).

## Files changed

```
 ARCHITECTURE.md                                            |  46 ++--
 client/README.md                                           |   2 +-
 client/src/components/FocusCalendarView.tsx                |  46 +---
 client/src/components/FocusReportModal.tsx                 |  98 ++++++--
 client/src/components/SegmentEventsModal.tsx                |   4 +-
 client/src/components/__tests__/FocusReportModal.test.tsx  | 280 ++++++++++++++++++++-
 client/src/i18n/__tests__/i18n.test.ts                     |  44 ++++
 client/src/i18n/locales/en/plan.json                       |   4 +-
 client/src/i18n/locales/ko/plan.json                       |   4 +-
 client/src/i18n/locales/vi/plan.json                       |   4 +-
 client/src/i18n/locales/zh/plan.json                       |   4 +-
 docs/API.md                                                |   2 +-
 server/README.md                                           |   2 +-
 server/__tests__/focus-report.test.js                      | 160 +++++++++++-
 14 files changed, 596 insertions(+), 104 deletions(-)

 (plus 2 new, untracked files, not shown by --stat against the starting commit)
 client/src/lib/idleStripes.ts               (new)
 client/src/lib/__tests__/idleStripes.test.ts (new)
```

Single repo touched: `Claude-Code-Agent-Monitor`. Diff is against this
worktree's own starting commit `2416292ed801bf1d1959e6733f2eec679ced4224`
(round 4, already on `master` before this build began — not part of this
diff). `SegmentEventsModal.tsx`'s 2-line change is the i18n key-path update
for its own, third, independent consumption of the relocated keys (flagged by
review, see below).

## Standing guards + Definition of Done

- [x] Every new test observed RED before, GREEN after (see table above)
- [x] Full relevant suites green: server 907/907; client 427/427 (37 files)
- [x] All 4 DERIVED-DUAL-VIEW durable-cure obligations met (extract-before-reuse,
      `active_ms`-only aggregate sizing, standing cross-view test, atomic
      4-locale i18n relocation)
- [x] Build/typecheck clean: `tsc --noEmit` 0 errors; `npm run build`
      succeeds end-to-end, `dist/` produced (this was the fix-loop's own gate
      — confirmed clean on the second pass)
- [x] `bash .claude/skills/file-headers/scripts/check-headers.sh` — clean,
      exit 0, both passes
- [x] Plan's own Definition of Done items met, with 3 explicit exceptions
      (all expected/pending, not gaps): the commit itself (task 17, not yet
      done — see "Next step"); the `projects.test.js` follow-up gap named in
      the plan as a PR-description item, not yet written into any PR since no
      commit/PR exists yet; the manual QA spot-check (an explicitly
      non-automatable human step)

## Worktree & stack

- **Worktree path:** `/Users/sara/CODE-LOCAL/SARA/efforts/2026-07-26-focus-report-fidelity/Claude-Code-Agent-Monitor`
  (branch `effort/2026-07-26-focus-report-fidelity`, off `master` at starting
  commit `2416292ed801bf1d1959e6733f2eec679ced4224`) — **use this path, not
  the main checkout**, to review/commit this diff.
- **Docker stack:** none provisioned. Per the build brief, this change needed
  no live service — every verification step is a direct `npm run
  test:server` / `npm run test:client` / `tsc` / `npm run build` invocation
  against the worktree.

## Residual risk & back-out

- **Watch:** the entire diff is still uncommitted in the worktree (`git
  status --porcelain` shows 14 modified + 2 untracked files). Nothing has
  been lost — it's simply not yet packaged as the one reviewed commit the
  plan calls for (task 17).
- **Deferred, explicitly out-of-scope (named in the plan, not silently
  dropped):** `server/__tests__/projects.test.js`'s adjacent route-level gap
  — its `active_ms` assertions are neutralized by
  `DASHBOARD_FOCUS_IDLE_GRACE_SECONDS="0"`, so the HTTP contract this
  List-view work depends on is not proven end-to-end at the route layer.
  This is round-4's contract, not this pass's; both the technical-plan and
  test-plan explicitly scope it out and require it be named as a follow-up in
  the eventual PR/commit description.
- **Reviewer nits (0 blockers, 0 should-fix, 2 non-blocking, both deferred by
  agreement, neither gates GREEN):**
  1. A stale doc comment on `client/src/lib/types.ts`'s `chunks` field —
     written when `FocusCalendarView.tsx` was its only consumer, now stale
     since `FocusReportModal.tsx` is a second consumer of the same field.
     Cosmetic; `types.ts` itself needed no code change for this build
     (confirmed 0-line diff against the starting commit).
  2. `SegmentEventsModal.tsx`'s i18n key usage (`report.wallClockLabel`/
     `activeLabel`, 2-line update in this diff) has no dedicated test
     guarding against an accidental revert to the old
     `report.calendar.*` key path — it's a *third* consumer of the relocated
     keys, alongside List and Calendar, and only those two are covered by
     the new registry-derived i18n completeness test's actual call sites
     being exercised through component render; the key *string* itself is
     covered (the registry test checks the raw key resolves/doesn't resolve
     regardless of caller), but no render-level test exists for this
     specific modal's usage.
- **Back-out (this repo only):**
  ```
  git -C /Users/sara/CODE-LOCAL/SARA/efforts/2026-07-26-focus-report-fidelity/Claude-Code-Agent-Monitor reset --hard 2416292ed801bf1d1959e6733f2eec679ced4224
  ```
  This is a no-op reset back to the worktree's own starting commit — the
  worktree was created clean at this exact commit, so this command is the
  literal "undo everything this build did" anchor. (To remove the worktree
  entirely once the effort lands or is abandoned:
  `git -C /Users/sara/CODE-LOCAL/SARA/Claude-Code-Agent-Monitor worktree remove /Users/sara/CODE-LOCAL/SARA/efforts/2026-07-26-focus-report-fidelity/Claude-Code-Agent-Monitor`.)

## Open decisions

- **DERIVED-DUAL-VIEW as a named `PROJECT-CONTEXT.md` catalog entry** —
  PENDING, explicitly Sara's call, not decided by any upstream pass or this
  build. Worth flagging concretely now: this is this pattern's **second**
  occurrence this session (Calendar-before-round-4, List-before-this-build),
  and this build itself needed one fix-loop where the implementer's first
  pass mischaracterized a real, build-introduced test-authoring gap as
  pre-existing/unrelated — not a DERIVED-DUAL-VIEW instance itself, but
  evidence this project is accumulating exactly the kind of repeatable
  build-time friction a defect-class catalog exists to shorten next time.
  Recommend Sara consider formally adopting a `PROJECT-CONTEXT.md` +
  defect-catalog for this project going forward; not unilaterally created by
  this build.
- Both reviewer nits above (stale `types.ts` doc comment, untested
  `SegmentEventsModal.tsx` i18n key usage) — non-blocking, not looped back
  on, available to fold into this same commit or a fast follow-up at Sara's
  discretion.

## Next step

Stops at green. **The user commits / pushes / opens a PR — or hands it back
for changes.** This skill does not commit, and does not tear down the
worktree or Docker stack — those stay live at
`/Users/sara/CODE-LOCAL/SARA/efforts/2026-07-26-focus-report-fidelity/Claude-Code-Agent-Monitor`
until whoever merges runs the manual teardown (worktree-remove command
above; no Docker stack was provisioned for this effort). When committing,
per the technical-plan's own instruction: state the visible behavior change
plainly (labeled wall-clock/agent-time split now shown when they diverge;
per-item/project-split bars now sized by `active_ms`, not `wall_ms` — a
kind with real elapsed time but zero active time now renders ~0 width there,
intended, not a regression) and name the `projects.test.js` gap as an
out-of-scope follow-up in the PR description, not silently dropped.
