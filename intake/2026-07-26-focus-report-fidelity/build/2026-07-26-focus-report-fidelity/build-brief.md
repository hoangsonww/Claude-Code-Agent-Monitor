# Build Brief — focus-report-fidelity (List-view parity)

Slug: `2026-07-26-focus-report-fidelity`
Prepared by: Build-Intake Clerk
Date: 2026-07-26

## What we're building

`FocusReportModal.tsx`'s List view currently sizes/labels all three of its
duration bars (per-session, per-item rollup, project-wide split) by `wall_ms`
— the raw, un-idle-aware span already proven misleading in round 3. Round 4
fixed this for the Calendar view only. This change brings List view to parity
with Calendar's shipped convention (idle-stripe overlay on the per-session
bar via a new shared `idleStripesInRange` helper extracted from Calendar's
`idleStripesForBlock`; `active_ms`-based sizing on the two aggregate bars),
fixes an embedded bug where the per-item/project-split rows already print an
`active_ms` number over a `wall_ms`-sized bar, closes the zero-coverage gap on
`inferredSegment()` (the exact code path behind the round-3 bug), and adds a
permanent cross-view (List vs. Calendar) regression test. No server or wire
shape change is required — `server/lib/focus-report.js` already computes and
ships `chunks`/`active_ms` per segment (landed on `master` at commit
`2416292`, round-4's commit, prior to this build starting).

## Plan sources

- `/Users/sara/CODE-LOCAL/SARA/Claude-Code-Agent-Monitor/intake/2026-07-26-focus-report-fidelity/technical-plan.md`
- `/Users/sara/CODE-LOCAL/SARA/Claude-Code-Agent-Monitor/intake/2026-07-26-focus-report-fidelity/qa/test-plan.md`

Both plans read in full. The test-plan's tests correspond directly to the
technical-plan's change set — same surfaces (`idleStripes.ts`,
`FocusCalendarView.tsx` refactor, `FocusReportModal.tsx`'s `SegmentedBar`/
call sites, i18n key relocation, `inferredSegment()` coverage), same
sequencing, same red-first discipline described step-by-step. No
inconsistency found between them.

## Buildability check

- Technical-plan has a concrete **Change set** (§3, 7 numbered items across
  client/i18n/server/tests/docs) and concrete **Implementation steps** (§4,
  12 sequenced steps, each independently checkable).
- Test-plan names **specific spec files + assertions**: exact `describe`
  block names, exact case-by-case assertions (e.g. `seg.chunks.length ===
  Math.ceil(wall_ms / CHUNK_MS)`), exact fixture arithmetic (30m/20m/10m
  wall/active/idle), and an explicit **red-first** sequencing (§ Implementation
  steps 1-10, e.g. "observed RED (module missing) before creation, GREEN
  after").
- Neither plan is vague — both are buildable as written. **Not blocked** on
  this axis.

## Surfaces touched

- `client/src/lib/idleStripes.ts` (new)
- `client/src/lib/__tests__/idleStripes.test.ts` (new)
- `client/src/components/FocusCalendarView.tsx` (refactor onto shared helper,
  no behavior change)
- `client/src/components/FocusReportModal.tsx` (the actual List-view fix:
  `SegmentedBar`, `kindTotalsAsSegments`, three call sites)
- `client/src/components/__tests__/FocusReportModal.test.tsx` (fixture update
  + 4-5 new tests)
- `client/src/components/__tests__/FocusCalendarView.test.tsx` (regression
  gate only — must need zero assertion changes)
- `client/src/i18n/locales/{en,ko,vi,zh}/plan.json` (key relocation:
  `report.calendar.{wallClockLabel,activeLabel}` → `report.{wallClockLabel,
  activeLabel}`)
- `client/src/i18n/__tests__/i18n.test.ts` (new registry-derived per-locale
  completeness check)
- `server/__tests__/focus-report.test.js` (new `inferredSegment` coverage-only
  `describe` block, 5 cases)
- `ARCHITECTURE.md`, `docs/API.md`, `client/README.md`, `server/README.md`
  (doc updates per technical-plan §7)

No project-specific defect-catalog / `PROJECT-CONTEXT.md` is configured for
this repo, so there is no named risk-surface list to flag beyond what both
plans already call out themselves.

## Durable-cure obligations (MANDATORY)

No named defect-catalog id exists for this project (both plans confirm this
explicitly and note it as a candidate for Sara to decide on later — not
decided here). The plans' own de-facto catalog id, **DERIVED-DUAL-VIEW** ("a
duration value computed once server-side, rendered by two independent client
surfaces, with no shared helper and no test enforcing agreement"), is not an
established project convention but is the structural pattern both plans
require the build to cure, not just patch around:

1. **Extract-before-reuse.** `idleStripesInRange` must be a genuine shared
   `client/src/lib/idleStripes.ts` module used by *both* `FocusCalendarView.tsx`
   and `FocusReportModal.tsx`'s `SegmentedBar` — never a second, independently
   re-implemented copy of the stripe math in the List view.
2. **Single source for "how long."** The two aggregate bars must size off the
   already-computed `FocusKindTotals.by_kind[kind].active_ms` field — no new
   client-side rollup/computed figure invented for this (explicitly rejected
   by the architect per technical-plan §5).
3. **Standing cross-view regression test.** The List-vs-Calendar consistency
   test (test-plan step 9) must be written as a standing template per the
   test-plan's own "Durable-cure decision" section — its purpose is to catch
   any *future* field added to `FocusReportSegment` that only one view starts
   rendering, not just to pass once for this pass's fields.
4. **i18n key relocation must be atomic across all 4 locales in the same
   commit** — a partial rename (e.g., English updated, one locale missed)
   silently renders a raw i18n key string in the missed locale. The new
   registry-derived i18n completeness test is the mechanical guard for this;
   do not ship the relocation without it passing for all 4 locales.

All four are called out as MANDATORY by both plans; none of them are optional
polish.

## Worktree set

Single-repo project (`Claude-Code-Agent-Monitor`), no monorepo wrapper, no
`PROJECT-CONTEXT.md`. Efforts convention discovered from the existing shared
sibling directory `/Users/sara/CODE-LOCAL/SARA/efforts/` (already holding
several other prior efforts' worktree parents, one dir per slug) — this
build's worktree was provisioned into that same location, one repo touched:

| Repo | Worktree path | Branch | Type | Starting commit |
|---|---|---|---|---|
| Claude-Code-Agent-Monitor | `/Users/sara/CODE-LOCAL/SARA/efforts/2026-07-26-focus-report-fidelity/Claude-Code-Agent-Monitor` | `effort/2026-07-26-focus-report-fidelity` | new branch off `master` | `2416292ed801bf1d1959e6733f2eec679ced4224` |

- Base branch for the repo: `master` (current local branch at time of
  provisioning; no `origin/HEAD` divergence checked since this is a local-only
  clone context per the task instructions — `master` was confirmed clean
  except an untracked `intake/` folder, which is this team's own planning
  artifact, not product code, and was left alone per instructions).
- Verified clean immediately after creation: `git status --porcelain` on the
  worktree returned no output.
- No other repos exist under this project (`find . -maxdepth 2 -name .git`
  found only the single top-level `.git`), so there are no "untouched repos"
  to also provision a base-HEAD worktree for.

## Docker stack

Not provisioned. Per explicit task instructions, this change requires no
running dashboard/dev stack — all verification runs directly via
`npm run test:server` / `npm run test:client` against the worktree, no
containers needed. (Note for completeness: `docker-compose.yml`,
`docker-compose.full.yml`, and `monitoring/docker-compose.yml` do exist at the
project root/subdirectories, but this build has no need to bring any of them
up, so none was provisioned or repointed.)

## Effort registry

No effort registry exists for this project (no `PROJECT-CONTEXT.md`, no
discovered registry file) — step skipped.

## Back-out command

```
git -C /Users/sara/CODE-LOCAL/SARA/efforts/2026-07-26-focus-report-fidelity/Claude-Code-Agent-Monitor reset --hard 2416292ed801bf1d1959e6733f2eec679ced4224
```

(This is a no-op reset back to the worktree's own starting commit — the
worktree was created clean at this exact commit, so this command is the
literal "undo everything this build did" anchor.)

To remove the worktree entirely once the effort lands or is abandoned:

```
git -C /Users/sara/CODE-LOCAL/SARA/Claude-Code-Agent-Monitor worktree remove /Users/sara/CODE-LOCAL/SARA/efforts/2026-07-26-focus-report-fidelity/Claude-Code-Agent-Monitor
```

## Open questions

Non-blocking (assumption stated, build may proceed):

1. **Efforts directory convention** — no `PROJECT-CONTEXT.md` names an
   explicit convention for this project. Assumption: follow the pattern
   already visible in `/Users/sara/CODE-LOCAL/SARA/efforts/` (a shared
   sibling directory one level above all repos under `~/CODE-LOCAL/SARA/`,
   one subdirectory per effort slug). If this project actually intends a
   different location (e.g. inside the repo itself), redirect before the next
   build starts one there — the worktree can be recreated cheaply since
   nothing has been built on it yet.
2. **DERIVED-DUAL-VIEW as a named catalog entry** — both plans flag this as
   "Sara's call, not decided here." Not blocking this build; noted for later.

No blocking open questions. Both plans are internally consistent, concrete,
and buildable; the base branch and the new worktree are both clean.

## Baseline to re-verify first (per both plans' own step 1)

Before adding anything on top of round-4, re-run both suites fresh in the new
worktree (do not trust the prior self-report):
- `npm run test:server` (expect 902/902)
- `npm run test:client` (expect 403/403, 36 files)
- `bash .claude/skills/file-headers/scripts/check-headers.sh` (expect clean,
  including round-4's previously-untracked files, now committed at
  `2416292`)
