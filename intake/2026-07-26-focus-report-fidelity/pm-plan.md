# PM Plan: Focus-Time Reporting Fidelity

Intake: `intake/2026-07-26-focus-report-fidelity/` · Date: 2026-07-26 · PM pass

## 1. Request summary

Sara has spent an entire session iterating on the Focus-Time Report (the
per-project dashboard that shows how much of a Claude Code session was real
agent work vs. idle time), and rather than continue patching round by round
she stepped back and asked the team (via `/team-intake`, on auto-pilot) to
independently judge whether the reporting now actually reflects reality, end
to end, and fix whatever still doesn't. The concrete trigger four rounds ago
(round 3) was a real data-fidelity bug: a segment stated "1h 40m" when only
about 20 minutes of real activity happened, because a session with no
declared Focus history gets one inferred segment that rides all the way to
`ended_at` regardless of how much of that span was silence. Round 4 (Sara's
own fix design, implemented this session, largely uncommitted) added
10-minute active/idle "chunks" and wired them into the **Calendar view**
only — dark idle stripes over the block, plus a wall-clock/agent-time
split in the hover popup. All four team assessments, reading the code
directly rather than trusting the brief, converged on the same finding: the
**List view** (`FocusReportModal.tsx`) — the sibling view showing the same
underlying report data as stat tiles, a per-session bar, a per-item rollup,
and a project-wide split — was never touched by round 4 and still sizes and
labels everything by the raw `wall_ms` span. Worse, the engineer found the
List view is already self-contradictory on its own terms, independent of
Calendar parity: its per-item and project-split rows print an `active_ms`
duration next to a bar that is sized by `wall_ms` — two different totals,
side by side, today.

## 2. Request type

**Final classification: `missed-requirement`**, with one embedded, genuinely
standalone **`bug`** called out explicitly below. Reasoning:

- The overarching story is missed-requirement, not bug, at the intake
  level: round 3 correctly diagnosed a real fidelity problem, and round 4 —
  a fix Sara designed and the team built and tested exactly to her literal
  spec ("on the calendar... when we show the card") — was itself scoped,
  by its own wording, to one view. Nothing was built wrong relative to what
  was asked; what was asked simply didn't name every surface the original
  complaint implicated. That is the textbook missed-requirement shape: we
  built what was said, and the requirement (implicitly, "fix the
  misleading-duration problem," which is what the *original* complaint was
  really about) was incomplete because it didn't enumerate every consumer
  of the same underlying number.
- Embedded inside it is one real `bug`, independent of any Calendar/List
  parity question: `ListView`'s per-item rollup and project-split rows
  already print `active_ms` next to a `wall_ms`-sized bar
  (`FocusReportModal.tsx` lines ~300-305, ~318/323 — confirmed by direct
  read by both architect and engineer). That mismatch has nothing to do
  with round 4 not reaching this view; it is the file being internally
  inconsistent with itself, and it never worked correctly. This should be
  fixed as part of the same change, not filed separately, since the fix is
  identical to the List-view parity fix (see §6).
- Not `regression` — nothing that used to be correct broke; the List view
  has been `wall_ms`-only since before this session (confirmed: it is
  fully committed in `2c1ef2f`, in its pre-round-4 shape — round 4 never
  touched it).
- Not `new-feature` or `text/content-change` — no new capability or copy
  change is being requested; this is a correctness/consistency pass over
  reporting the team already owns.

## 3. History / background

**First team-intake request for this project** — no `PROJECT-CONTEXT.md`,
no defect-class catalog, and no prior entry for this project anywhere in
`~/.claude/skills/team-intake/memory/request-log.md` or `decision-log.md`
(checked directly, zero matches for "focus" or this project name). So there
is no cross-session PM memory to reconcile against; the entire relevant
history lives in this same session, already transcribed in
`request-source.md`, and I confirmed it against the live repo rather than
trusting the writeup:

| Round | Ask (verbatim, abridged) | What shipped | Committed? |
|---|---|---|---|
| Pre-session | — | Day-view swimlane calendar, List/Calendar toggle | Yes (before this session) |
| 1 | Hover popup + a "code icon" opening an events drill-down | Styled hover popup, `</>` icon → `SegmentEventsModal` | Yes, `2c1ef2f` |
| 2 | Aggregate raw events into 5-minute buckets w/ per-type counts | `bucketEvents()` / `eventBuckets.ts` | Untracked but present (`?? eventBuckets.ts`) |
| 3 | **Real bug found**: "1h 40m" segment, ~20m of real events, 84m of silence before `ended_at`. "Are we limiting events shown?" | Root cause diagnosed: `inferredSegment` rides to `ended_at` regardless of idle time; `wall_ms` used for size/duration everywhere | N/A (diagnosis, not code) |
| 4 | Sara's own fix: 10-min chunks, active=one color/idle=another on Calendar, dual wall-clock/agent-time in the popup | `CHUNK_MS`/`buildActivityChunks()` server-side; Calendar idle stripes + dual popup text client-side | **Uncommitted** (verified via `git diff --stat HEAD` just now — matches engineer's account exactly) |
| 5 (this intake) | Step back: does the reporting reflect reality everywhere, not just where round 4 looked? | This assessment | — |

I independently re-ran `git status`/`git diff --stat HEAD` against the live
tree (not just the brief's stale snapshot) and it matches the engineer's
account precisely: `server/lib/focus-report.js`, its test,
`client/src/lib/types.ts`, `FocusCalendarView.tsx` + test, four locale
`plan.json` files, and four docs files are modified-but-uncommitted;
`SegmentEventsModal.tsx` and `eventBuckets.ts` (+ test) are untracked.
**`FocusReportModal.tsx` and its test file are fully committed already**,
in their pre-round-4, `wall_ms`-only shape — confirming this is not a
"finish an in-flight diff" problem, it's a "round 4 never started here"
problem.

**Have we seen this before? How many times?** Once, in the sense that this
is a first occurrence for List view specifically. But structurally, this is
the *second* time in this same session that a duration figure computed once
server-side turned out to be reused uncritically by a client surface without
that surface being idle-aware: Calendar had this exact blind spot before
round 4; List view has it now. It came back because round 4 fixed the
*consumer Sara was looking at*, not the *underlying pattern* ("any surface
that shows a duration must not just echo `wall_ms`").

## 4. Recurrence diagnosis

**Systemic cause, not a one-off oversight:** `server/lib/focus-report.js` is
correctly the single source of truth for "how long" — it computes `wall_ms`,
`active_ms`, `idle_ms`, and now `chunks` once, per segment, server-side, and
already attaches all of them to the wire payload unconditionally. The defect
is entirely on the client side: two independent rendering surfaces
(`FocusCalendarView.tsx`, `FocusReportModal.tsx`) each decide for themselves
which of those fields to use for sizing/labeling, with no shared helper and
no test that would fail if one surface adopts a fidelity fix the other
doesn't. Round 4 added a *third* field (`chunks`) and wired it into exactly
one of the two consumers — there was no mechanism (test or otherwise) that
would have caught "did every view that shows a duration get this treatment?"
The architect independently named this precisely: "a computed number
duplicated across several rendering surfaces, one surface's fix not
reaching the others" — and flagged that this project doesn't yet have a
named defect-class catalog to check patterns like this against, even though
this is exactly the shape such a catalog exists to catch. The embedded bug
(§2) is the same root cause one layer down: even *within* `ListView`, the
printed number and the bar's sizing pull from two different fields with
nothing enforcing they agree.

**The durable fix is not "extend chunks to List view and call it done."**
It's: (a) make every view-facing duration statement in this feature source
from the same field-choice convention (active_ms as "how long," wall_ms as
an explicit secondary label — Calendar's round-4 convention, generalized),
and (b) add the cross-view consistency test QA specified — render List and
Calendar from the same mocked report and assert they state the same numbers
for the same segment. That test is the actual regression guard against this
recurring exactly as it did this time; without it, a future round-5 fix to
either view could silently reopen the same gap in the other.

## 5. Where this is coming from

Not a changed requirement, not a misunderstanding, and not really "drift"
in the classic two-copies-of-logic sense (the server-side computation is
one clean source of truth). It's a **missing enforcement mechanism**: the
requirement ("the report must never assert a duration/visual size that
isn't backed by real worked time" — the product owner's own distillation of
five rounds of Sara's asks) was never written down as a cross-cutting
acceptance criterion that every consumer must satisfy; it existed only
implicitly, round to round, as "fix the thing Sara is currently looking
at." Round 4 satisfied that implicit, narrower ask completely and
correctly. The broader, real requirement was missed because nobody had
stated it at the feature level until this intake.

## 6. Recommendation to the human

**This is our cost, not a new ask** — bundling List-view parity into the
same commit as the still-uncommitted round-4 diff is the right call (as PO
proposes), because it is the same defect class discovered mid-build, not a
new feature request arriving after the fact.

**Approve this concrete, converged scope (S/M effort, per engineer):**

1. **Per-session bar** (`ListView`, real segments): reuse `chunks` for an
   idle-stripe overlay, same idea as Calendar's `idleStripesForBlock` but
   extracted into a **shared helper** (architect's explicit ask — do not
   copy-paste the stripe math a second time; that would recreate this
   exact defect shape inside the fix for it). Switch the header duration
   from a `wall_ms` sum to `active_ms`, demoting `wall_ms` to a secondary
   label, mirroring the Calendar popup's existing convention.
2. **Per-item rollup and project-split bars**: switch sizing from `wall_ms`
   to the already-computed `active_ms` (`FocusKindTotals` already carries
   it — no new aggregate shape, no server change). This single change also
   closes the embedded bug in §2 (the label and the bar will finally agree)
   — **do not fix the label and the bar separately**; a fix that changes
   only one would leave the file self-contradictory in a new way.
3. **Do not** attempt aggregate-level chunk-striping for the rollup/split
   bars (engineer's finding: `buildActivityChunks`'s grid is segment-
   relative, not epoch-aligned, so merging chunks across sessions/segments
   that don't share a grid is real new work — a shared epoch-aligned grid
   helper, `mergeIntervals`-on-a-discretized-grid, per-kind — not a wiring
   exercise). `active_ms` sizing already fixes the actual round-3-class
   bug at the aggregate level; treat richer aggregate striping as a
   distinct, larger follow-up if Sara wants it later.
4. **No server change required** for this scope — `chunks`/`active_ms` are
   already on the wire from the uncommitted round-4 diff.
5. **Close QA's flagged test gap regardless of what else ships**:
   `inferredSegment()` — the exact code path that produced the round-3 bug
   — has zero test coverage today in `focus-report.test.js`. This is the
   single highest-value regression pin available and should not wait for a
   future request to surface it again.
6. **Add the cross-view consistency test** (List vs. Calendar, same mocked
   report, same segment, must state the same numbers) as a permanent
   regression guard — this is the concrete test that would have caught
   round 4 stopping at one consumer, and per QA should be kept indefinitely
   as this feature's own "two views must agree" gate.
7. **Ship-readiness of the round-4 diff itself**: re-run both suites fresh
   in this pass rather than trusting the source doc's self-report (engineer
   already did — 902/902 server, 403/403 client, currently green), and run
   the file-header audit before commit (`bash
   .claude/skills/file-headers/scripts/check-headers.sh`) — four untracked
   files (`SegmentEventsModal.tsx`, `eventBuckets.ts`/test) need to carry
   the required header if they don't already.
8. **Update docs together with the code** (`ARCHITECTURE.md`, `docs/API.md`,
   `client/README.md`, `server/README.md`) — the same discipline already
   applied for round 4, extended to note the List view's new sizing
   convention so Sara isn't surprised by a Calendar/List convention
   difference (there won't be one, if `active_ms` is used consistently,
   but state it explicitly per PO's ask).

**Defer, don't block on, these lower-priority items** (all four evaluators
converged this ordering; nothing here needs to happen before the above
ships):

- Whether `wall_ms` should be capped at the inferred segment's own boundary
  (architect's option B — capping `inferredSegment`'s `end` near last real
  activity instead of riding to `ended_at`). This is a genuine, larger
  design question with a real, non-obvious side effect (`wall_clock_ms`
  in `buildProjectFocusReport`'s `mergeIntervals` union would under-report
  calendar coverage for idle-tailed inferred sessions) and an open question
  about whether declared segments share the problem. Worth a dedicated pass
  after real-data verification, not bundled into this fix.
- 10-minute chunk/bucket grain — keep as-is; no evidence it's wrong,
  re-litigate only if the noise-verification pass below finds a concrete
  problem with it.
- Verification pass over real session data for other "noise" (e.g. the "93
  `TurnDuration` events in 5 minutes" observation) — a spot-check, not a
  code change by default; do after the above ships.
- `CHUNK_MS`/`BUCKET_MS` duplicated-constant risk (two independently
  hardcoded `10 * 60 * 1000` literals, server JS and client TS, "matching"
  only by code comment) and unbounded per-segment `chunks` array payload
  size — both real, both flagged by the architect as non-blocking
  footnotes worth a deliberate accept-or-fix decision at some point, not
  urgent enough to gate this pass.

**Durable fix to stop this exact recurrence going forward:** the cross-view
consistency test (item 6 above) is the mechanical guard. Structurally,
also worth Sara deciding, once this ships, whether this project should
start a defect-class catalog — this is the shape ("a derived/summary
number computed once, consumed by multiple rendering surfaces with no
shared helper and no cross-surface test") that such a catalog exists to
catch before it recurs a third time. Not creating one unprompted, since
this project has no such convention yet — flagging it for Sara's call, per
her own established pattern of deciding this per-project rather than having
it opened for her.

## 7. Open decisions for the user

None are blocking — every question above is decidable by the team (Sara
pre-authorized proceeding through hand-offs without pausing), and all four
evaluators independently converged on the same scope. Two things worth
Sara's attention at delivery, not before building:

1. **The concrete List-view display convention** (idle-stripe on the
   per-session bar + `active_ms` sizing on the rollup/split bars) is a
   visible behavior change she should see called out plainly in the
   commit/PR summary and updated docs, not discover by accident.
2. **Whether to start a defect-class catalog for this project** — flagged
   above, not decided here; this is the second time this session the same
   "one computed value, multiple untested consumers" shape has bitten, and
   the project doesn't yet have a place to track that pattern across
   future requests.
