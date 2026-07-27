# Build Brief — focus-calendar-board

Slug: `2026-07-26-focus-calendar-board`
Prepared by: Build-Intake Clerk
Date: 2026-07-26

**STATUS: READY.** The dirty base branch that blocked the prior triage pass
has been resolved (Sara committed the 29 unrelated files as `0ef79b3`); this
pass re-verified `git status --porcelain` independently rather than taking
that on faith, confirmed the tree is clean, and provisioned the effort
worktree.

## What we're building

A new first-class sidebar page, **Calendar** (route `/focus-calendar`, page
heading "Focus Calendar"), rendering the existing focus-time swimlane
calendar across every monitored project at once, filterable by three
independent controls — project (optional, default all), session (global list
across all projects), and time period (day nav, default "today," plus a
custom date range). Powered by a new aggregate endpoint, `GET
/api/focus-report`, that is a thin session-selection + explicit time-window
layer in front of the existing, unmodified `buildProjectFocusReport`/
`buildSessionFocusReport` (`server/lib/focus-report.js`). The existing
per-project modal (`FocusReportModal.tsx`) is left fully intact; its reusable
chrome is extracted into a shared `FocusReportBody.tsx` component so both
entry points consume one rendering implementation — closing, prospectively,
the exact "one rendering surface, two codepaths" defect shape this project
fixed reactively earlier today (`6e29722`). All six open decision points
(`decisions.md`) are DECIDED; the plan is stated as build-ready.

## Plan sources

- `/Users/sara/CODE-LOCAL/SARA/Claude-Code-Agent-Monitor/intake/2026-07-26-focus-calendar-board/technical-plan.md`
- `/Users/sara/CODE-LOCAL/SARA/Claude-Code-Agent-Monitor/intake/2026-07-26-focus-calendar-board/qa/test-plan.md`
- `/Users/sara/CODE-LOCAL/SARA/Claude-Code-Agent-Monitor/intake/2026-07-26-focus-calendar-board/decisions.md` (all 6 DECIDED)

Both plans read in full. The test-plan's tests correspond directly to the
technical-plan's change set — same surfaces (`server/routes/focus-report.js`,
`FocusReportBody.tsx`/`FocusCalendarView.tsx` extraction, `TimePeriodPicker.tsx`,
`FocusCalendarBoard.tsx`, `calendarWindow.ts`, Sidebar/App routing, all four
locale files), same sequencing, same red-first discipline, same durable-cure
framing (`DERIVED-DUAL-VIEW`). No inconsistency found between them.

**Pre-existing gap the test-plan itself flags, re-confirmed already resolved:**
the test-plan's own "build-blocking pre-req" section says the technical-plan's
F12 i18n key table was missing a key for DEC-6's relabeled `concurrency_ratio`
copy. Re-checked against the current `technical-plan.md` text: F12 **already
lists** `report.board.concurrentSessions` with concrete EN/ZH/VI/KO values and
an explicit note tying it to DEC-6 ("added here per the QA team's finding").
This pre-req is **already landed** in the technical plan handed to this
triage pass — treat it as satisfied, not an open item. (Carried forward
unchanged from the prior triage pass's finding; nothing about this changed
between passes.)

## Buildability check

- Technical-plan has a concrete **Change set** (§3 — 8 backend/frontend
  tables, ~24 numbered file-level items) and concrete, sequenced
  **Implementation steps** (§4, 10 steps).
- Test-plan names **specific spec files + assertions** (§ Test change set —
  exact `describe`/`it` additions, exact assertion groups for the
  old-vs-new-route parity check, exact fixture-reuse conventions) and an
  explicit **red-first** implementation sequence (§ Implementation steps,
  15 steps, each stating what's RED before and GREEN after).
- Neither plan is vague — both are buildable as written. **Not blocked** on
  this axis.

## Repo layout (discovered — no `PROJECT-CONTEXT.md`)

Single git repo, no monorepo wrapper (`find . -maxdepth 2 -name .git` finds
only the top-level `.git`). Base/working branch: `master`
(`git symbolic-ref refs/remotes/origin/HEAD` → `refs/remotes/origin/master`;
local checkout is also on `master`). One repo touched trivially — this
effort's whole change set (server routes, client components/pages, i18n,
docs) lives in this one repo.

Efforts convention (same one the prior triage pass on this repo inferred and
this pass reused): a shared sibling directory,
`/Users/sara/CODE-LOCAL/SARA/efforts/<slug>/<repo-name>`, one level above all
repos under `~/CODE-LOCAL/SARA/`. The earlier effort that established this
precedent (`2026-07-26-focus-report-fidelity`) has already shipped and had
its own worktree cleaned up (its path no longer appears in `git worktree
list`), consistent with normal effort lifecycle.

## Safety gate — re-verified clean, not taken on faith

Ran `git status --porcelain` at the repo root myself before doing anything
else:

```
?? intake/
```

Only the untracked `intake/` planning folder remains — the 29 modified
tracked files that blocked the prior pass (`ARCHITECTURE.md`,
`server/routes/hooks.js`, `client/src/components/StatusBadge.tsx`, etc.) are
gone from the diff, consistent with the claim that they're now folded into
commit `0ef79b3` (`git log -1 --oneline` on `master` confirms `0ef79b3
feat(status): distinguish subagent/shell/monitor as active-work awaiting
reasons` is the current tip). `intake/` itself is this and a prior sibling
intake cycle's own planning artifacts, not product code — it does not block.

**Verdict: clean. Proceeding to provision.**

## Worktree set

| Repo | Worktree path | Branch | Type | Starting commit |
|---|---|---|---|---|
| Claude-Code-Agent-Monitor | `/Users/sara/CODE-LOCAL/SARA/efforts/2026-07-26-focus-calendar-board/Claude-Code-Agent-Monitor` | `effort/2026-07-26-focus-calendar-board` | new branch off `master` | `0ef79b378e0de180155bc5549643760230d9dc2a` |

- Base branch: `master`, HEAD at time of provisioning = `0ef79b3` (same commit
  as the starting commit above — the new branch was cut directly from it).
- Created via: `git -C .../Claude-Code-Agent-Monitor worktree add
  /Users/sara/CODE-LOCAL/SARA/efforts/2026-07-26-focus-calendar-board/Claude-Code-Agent-Monitor
  -b effort/2026-07-26-focus-calendar-board master`.
- Verified clean immediately after creation: `git status --porcelain` on the
  new worktree returned no output.
- No other repos exist under this project, so there are no "untouched repos"
  needing a base-HEAD-only worktree.
- Note for the build team: six unrelated `.claude/worktrees/agent-*`
  worktrees exist on this repo at a different, older commit (`6758179`) —
  they predate this effort, sit on their own branches, and are untouched by
  this provisioning. Not this effort's concern.

## Docker stack

**Not provisioned**, by deliberate choice (same call the prior effort in this
repo made, for the same reason): `docker-compose.yml`, `docker-compose.full.yml`,
and `monitoring/docker-compose.yml` exist at the project root/subdirectories,
but they describe a **production-style deployment** of the whole dashboard
(single build context `.`, bind-mounting the real `~/.claude/agent-dashboard`
host directory) — not a multi-service dev/test stack this effort's
verification loop touches. Both plans confirm the verification path is
`npm run test:server` / `npm run test:client` plus a manual click-path pass
against `npm run dev` in a real browser (QA's test-plan explicitly states "no
separate e2e/browser-automation runner exists" for this project). Nothing in
either plan names a containerized dependency. If a later step in this build
does need Docker, provisioning can be revisited then — skipping it now avoids
standing up an isolated stack (with its own port-offset/`.env` bookkeeping)
that nothing in this effort's test plan will ever start.

## Effort registry

No effort registry exists for this project (no `PROJECT-CONTEXT.md`, no
discovered registry file) — step skipped.

## Surfaces touched

Backend: `server/routes/focus-report.js` (new), `server/index.js`,
`server/lib/focus-report.js` (unchanged, consumed as-is),
`server/__tests__/focus-report-route.test.js` (new).

Frontend: `client/src/components/FocusReportBody.tsx` (new, extracted),
`client/src/components/FocusCalendarView.tsx` (additive props only),
`client/src/components/FocusReportModal.tsx` (consumes the extraction),
`client/src/lib/calendarWindow.ts` (new), `client/src/components/
TimePeriodPicker.tsx` (new), `client/src/lib/api.ts`, `client/src/lib/
types.ts` (widened `FocusReport.project_id`, new `session_id`),
`client/src/pages/FocusCalendarBoard.tsx` (new), `client/src/components/
Sidebar.tsx`, `client/src/App.tsx`, all four locales' `nav.json`/`plan.json`.

Tests: `FocusReportModal.test.tsx` (extend), `FocusCalendarView.test.tsx`
(extend), new `TimePeriodPicker.test.tsx`, new `FocusCalendarBoard.test.tsx`,
`Sidebar.test.tsx` (extend), `i18n.test.ts` (extend), `screens.snapshot.test.tsx`
(extend, 13th case).

Docs: `docs/API.md`.

**Risk-surface note:** no `PROJECT-CONTEXT.md` names a project-specific
defect catalog for this repo. Both plans cite an informal, project-memory
pattern instead — `DERIVED-DUAL-VIEW` ("a value/rendering computed once,
consumed by two independent surfaces, with no shared helper and no test
enforcing agreement") — the same shape that produced this morning's `6e29722`
fix. This effort deliberately extends that same surface
(`FocusReportBody`/`FocusCalendarView`/`focus-report.js`) a second and third
time, so it is the highest-attention area for review, not a fresh risk.

## Durable-cure obligations (MANDATORY)

No named defect-catalog id is configured for this project; both plans use the
informal `DERIVED-DUAL-VIEW` label as their own de-facto id. Per both plans:

1. **One computation path.** The new `GET /api/focus-report` route must never
   hand-derive its own version of `mergeIntervals`/per-kind totals — it feeds
   session rows through the unmodified `buildProjectFocusReport`/
   `buildSessionFocusReport`. Pinned by the test-plan's split parity assertion
   (report-body deep-equal vs. the old route, as its own assertion group —
   never a whole-object `deepEqual`, which would be false-by-construction
   since the two envelopes legitimately differ: the old route has no
   `session_id` key).
2. **One rendering-chrome implementation.** `FocusReportBody.tsx` is the only
   implementation of stat-tiles/List-Calendar toggle/list body; both
   `FocusReportModal` and the new `FocusCalendarBoard` consume it — no
   copy-pasted JSX in the new page. Pinned by extending (not forking) the
   existing "[standing template]" test in `FocusReportModal.test.tsx`.
3. **One day-boundary implementation.** `startOfDay`/`DAY_MS` live once in
   `client/src/lib/calendarWindow.ts`, imported by `FocusCalendarView.tsx`,
   `TimePeriodPicker.tsx`, and `FocusCalendarBoard.tsx` — never a second,
   slightly-different "what is a day" calculation.
4. **No hidden server-side time-window default.** Per DEC-2/DEC-3, the new
   route requires `from`/`to` and 400s if either is missing/malformed — no
   env knob, no silent unbounded query. Pinned by T1's explicit 400 cases.
5. **Filter independence, asserted on rendered DOM.** Project/session/
   time-period must never clear one another; the test-plan explicitly
   requires this be checked via the rendered `<select>`'s displayed value,
   not only mocked fetch-call arguments (a fetch-arg-only check could pass
   while the actual UI still violated DEC-2).
6. **4-locale i18n completeness, atomic in one commit.** New nav key
   (`nav:focusCalendar`) and DEC-6's relabel key (`report.board.
   concurrentSessions`) must land in all four locale files in the same
   change-set; the registry-driven `i18n.test.ts` loop is the mechanical
   guard, plus an explicit pin that the English nav value is exactly
   "Calendar," not "Focus Calendar."
7. **`server/routes/projects.js` and the old focus-report route stay
   byte-unmodified.** Both plans deliberately leave the old route's
   `?sources=`-ignoring gap unfixed here (tracked as a separate follow-up) —
   pinned by an explicit test asserting the gap is still present, not
   accidentally fixed as a side effect.
8. **File-header compliance.** Every new/edited applicable source file must
   carry the mandatory `@author Son Nguyen <hoangson091104@gmail.com>` header
   per `CLAUDE.md`/`.claude/rules/file-headers.md`; verify with
   `bash .claude/skills/file-headers/scripts/check-headers.sh`.

## Back-out command(s)

```
git -C /Users/sara/CODE-LOCAL/SARA/efforts/2026-07-26-focus-calendar-board/Claude-Code-Agent-Monitor reset --hard 0ef79b378e0de180155bc5549643760230d9dc2a
```

## Open questions

**BLOCKING:** none.

**Non-blocking (assumption stated):**

1. **Efforts directory convention** — no `PROJECT-CONTEXT.md` names one.
   Assumption: reuse the pattern already visible in this same repo's prior
   effort, `/Users/sara/CODE-LOCAL/SARA/efforts/<slug>/<repo-name>`. If this
   is wrong, redirect and the worktree can be re-provisioned at the correct
   path before build work starts.
2. **DEC-6 i18n key gap** (carried from the prior pass) — the test-plan's own
   "build-blocking pre-req" claims `technical-plan.md`'s F12 table is missing
   a key for DEC-6's relabeled copy. The technical-plan text actually
   supplied to this triage pass already contains that key
   (`report.board.concurrentSessions`, all four locales). Assumption: the two
   documents are already reconciled and this pre-req is satisfied. If a
   *different*, still-unreconciled version of `technical-plan.md` is the one
   meant to gate the build, surface that before test-plan step 0 is treated
   as done.
3. **Docker non-provisioning** — assumption stated above (production-style
   compose files, not part of this project's test/verification loop). If a
   later build step turns out to need a running dashboard container for some
   reason not visible in either plan, flag it and Docker can be provisioned
   at that point.
