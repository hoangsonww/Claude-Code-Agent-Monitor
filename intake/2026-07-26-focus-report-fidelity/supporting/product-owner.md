# Product Owner Assessment — Focus-Time Reporting Fidelity
Intake: `intake/2026-07-26-focus-report-fidelity/` · Date: 2026-07-26

## 1. Value & intent

Sara's actual intent (stated across five rounds, distilled): **the
Focus-Time Report must never assert a duration/visual size that isn't
backed by real worked time.** The originating complaint — "I don't know if
we're representing the data properly and there's still a lot of noise
that's not coming out clean" — is a trust problem, not a cosmetics problem.
The round-3 bug (a segment claiming "1h 40m" when only ~20 minutes of real
activity occurred) is the concrete proof case: a wrong number in a
dashboard whose entire purpose is to tell Sara, accurately, how her agent
fleet spent time.

End-user here is Sara herself (sole stakeholder/operator of this
local-first dashboard) — there is no separate "end user" to weigh against
her stated intent. That simplifies scope-check: whatever she says the
reporting should represent *is* the requirement, constrained only by the
project's own engineering non-negotiables (CLAUDE.md).

Why it matters: if the report can silently overstate active time on one
screen while correctly showing it on another (Calendar now fixed, List
still not), Sara's trust in the *whole feature* stays broken even after
"fixing" it — she'll keep hitting the same misleading number from a
different view and reopen this exact loop again.

## 2. Scope check

**No `PROJECT-CONTEXT.md` exists in this repo** (confirmed: not at root,
not elsewhere). There is also no separate scope-decision, business-
requirements, or stakeholder-approved source-of-truth doc for this feature
anywhere in `docs/` — I checked `docs/API.md`, `docs/DATABASE.md`,
`docs/CLI.md`, `docs/HOOKS.md`, `docs/I18N.md`, etc.; none govern focus-
report content/behavior as a requirements spec. For this project, the
closest thing to a source of truth is:
- `CLAUDE.md` (engineering non-negotiables: preserve behavior, minimal
  diffs, keep docs in sync, test before finishing), and
- `intake/2026-07-26-focus-report-fidelity/request-source.md` (Sara's own
  chronological build instructions this session, which function as her
  de facto sign-off record round by round).

**This is in scope, not a new ask.** Fixing the List view's `wall_ms`-only
blind spot is parity work directly inside the surface Sara has been
iterating on all session — it is not a new feature, not a new surface, and
does not contradict any prior instruction. It's the *same* class of bug
Sara already asked to be fixed once (round 3→4), just on a sibling view
the round-4 fix didn't reach. I independently verified the code (not just
trusting the brief's claim):

- `client/src/components/FocusReportModal.tsx`, `ListView`:
  - line 242: `totalMs = session.segments.reduce((sum, seg) => sum + seg.wall_ms, 0)` — per-session bar sized by wall_ms.
  - line 305 / 318: `totalMs={item.totals.wall_ms}` and `totalMs={report.totals.wall_ms}` — per-item rollup and project split both sized by wall_ms.
  - line 373/376 (`kindTotalsAsSegments`): builds bar segments from `totals.by_kind[kind].wall_ms`.
  - By contrast, the top stat tile (line 195) already correctly uses `report.totals.active_ms` — confirming the report-level aggregate *is* available and simply isn't propagated to the bars below it.

So: yes, the List view has the identical blind spot the Calendar view had
before round 4, and round 4 (uncommitted) did not touch any of the above.
Nothing here contradicts an approved decision — there is no locked spec to
contradict, and Sara's own most recent instruction ("get to my intent...
still a lot of noise") explicitly invites exactly this kind of gap-closing
across the whole feature, not just the view she happened to be looking at.

The two "should we reconsider the model" questions (wall_ms-as-primary,
10-minute grain) are **design tradeoffs within the same approved scope**,
not scope expansions — they're about *how* to represent time Sara already
asked to have represented faithfully, not *whether* to. Treat them as
non-blocking design questions per the brief, not stakeholder-approval gates.

## 3. Acceptance criteria ("done when...")

Concrete, user-facing, testable:

1. **No view states or visually sizes a duration using `wall_ms` alone
   without also making the active/idle split visible or using `active_ms`
   for anything presented as "how long."** Specifically for List view:
   - The per-session segmented bar, per-item rollup bar, and project-split
     bar either (a) size themselves by `active_ms` (matching the stat
     tile's convention), or (b) keep `wall_ms` sizing but add the same
     idle-visibility treatment the Calendar view got in round 4 (a visibly
     distinct idle portion) — team's design call, but one of the two must
     be true everywhere a duration bar renders.
   - Every duration figure printed in the List view is unambiguously
     labeled wall-clock vs. agent/active time wherever both could be
     confused (mirroring the Calendar popup's "Wall clock: Xh Ym / Agent
     time: Xm Ys" pattern).
2. **The round-3 reproduction case no longer misleads in any view.** A
   segment with a long gap after an `Interrupted`/last event and before
   `ended_at` must not present a bar, block, or headline number in *any*
   view (Calendar or List) that reads as "fully active" for that gap.
3. **All existing green suites stay green, and the new/changed assertions
   specifically cover the List view's bar/rollup sizing** (server:
   `npm run test:server`; client: `npm run test:client`, including the
   per-screen snapshot suite reviewed/regenerated deliberately, not blindly,
   per CLAUDE.md's testing policy).
4. **Docs stay in sync**: `ARCHITECTURE.md`, `docs/API.md`,
   `client/README.md`, `server/README.md` reflect any additional response-
   shape or UI convention introduced for List-view parity (same discipline
   already applied for round 4, per `request-source.md`).
5. **No unauthorized regression**: Calendar view's round-4 behavior
   (10-minute chunk stripes, dual wall/agent time in the hover popup)
   remains intact and its own tests remain green — this task must not
   quietly rewrite round 4 while fixing List view unless questions 1–2
   below justify that as scoped work.
6. For the currently-uncommitted round-4 diff specifically: **"ready to
   ship" = tests re-run fresh in this pass (not trusted from the source
   doc's self-report) + file-header audit passes
   (`bash .claude/skills/file-headers/scripts/check-headers.sh`) given four
   new untracked files exist (`FocusCalendarView.test.tsx`,
   `calendarLanes.ts`/test, `focus-inference.js`/test) that must carry the
   required authorship header before commit.**

## 4. Priority & impact

Who's blocked: Sara alone (single-operator local tool), but she is
*actively* blocked in the sense that she's mid-session, has explicitly
paused forward feature work to get this right, and pre-authorized
auto-pilot specifically so this gets resolved without further round-trips.
That's a strong urgency signal even though the "audience" is one person.

Recommended priority order across the open questions (my read, as PM/PO
prioritization call the brief explicitly invites the team to make):

1. **List-view parity (open question 1)** — highest priority, do first.
   It's the most concrete, scoped, already-diagnosed gap; fixing it is a
   direct continuation of round 4's own intent (make every consumer of
   `wall_ms` at least idle-aware) and is the most visibly "not done yet"
   piece if Sara opens List view next. Low ambiguity, high confidence fix.
2. **Ship-readiness of the uncommitted round-4 diff (question 5)** — do
   this *alongside/immediately after* #1, not as an afterthought: since #1
   touches the same files round 4 already modified, re-running the full
   verification (tests, headers, docs) once at the end covers both. Don't
   commit round 4 in isolation and then reopen the diff for List-view
   parity — bundle them into one reviewed, tested, committed change.
3. **Reconsidering wall_ms as the primary duration figure (question 2)** —
   worth a real look now that `chunks`/`active_ms` are available everywhere,
   but treat as an enhancement layered on top of #1's fix, not a
   precondition. If #1 is implemented as "size bars by active_ms," question
   2 is largely resolved as a side effect for the List view; it only needs
   separate attention if #1 is instead implemented as "keep wall_ms sizing
   + idle overlay."
4. **Other event-data noise (question 4)** — verification/spot-check pass,
   not a code change by default. Do this after #1–3 land, using the
   now-implemented bucket/chunk tooling to actually look at real data
   (e.g., chase down the "93 TurnDuration events in 5 minutes" observation)
   before declaring the whole intake done. If it surfaces a real bug,
   it gets its own priority; if not, it closes the loop on Sara's original
   "noise" framing with evidence rather than assumption.
5. **10-minute chunk grain reconsideration (question 3)** — lowest
   priority. It's a tunable already implemented and tested this session;
   re-litigate only if the data-noise pass (#4) or List-view work (#1)
   surfaces a concrete case where 10 minutes hides something. Otherwise
   leave as-is — don't spend cycles re-deriving a number Sara already chose
   and tested green.

## 5. Stakeholder questions / sign-off needed

- **No blocking sign-off needed to start.** Sara pre-authorized proceeding
  through design and implementation without per-phase check-ins
  ("auto-pilot... auto approve any hand off"), and every open question in
  the brief is investigable/decidable by the team per its own analysis —
  none requires a judgment call only Sara could make.
- **One thing that should still surface to Sara at delivery, not before
  building**: whichever concrete display convention the team picks for
  List-view parity (active_ms-sized bars vs. wall_ms bars + idle overlay)
  is a user-facing behavior/visual change she should see and can react to
  when the work lands — this is analogous to the pattern in this project's
  content-change guidance: *if* the team changes how a number is presented
  or labeled, that convention should be stated plainly in the PR/commit
  summary and in updated docs (`ARCHITECTURE.md`/`docs/API.md`), so Sara
  isn't surprised by a different bar-sizing convention between Calendar
  and List views without it being called out.
- **No existing signed-off spec or scope-decision doc is being
  contradicted** — there isn't one for this feature. Because of that,
  Sara's own chronological instructions in `request-source.md` are the de
  facto source of truth; nothing in this recommended plan overrides or
  reopens a decision she already locked in (round 4's chunk/color/dual-time
  design is being extended, not reversed).
- Suggest, as a process note (not a blocker): since this intake itself
  observed that "a derived number computed once and reused across multiple
  rendering surfaces" is a recurring defect *shape* in this codebase, it
  may be worth Sara deciding — after this ships — whether that pattern
  deserves a named entry in whatever recurring-defect tracking the team
  uses going forward, so future single-surface fixes get checked against
  all consumers before being called done.
