# Request Brief: Focus-Time Reporting Fidelity

## Raw ask (verbatim)

Sara's `/team-intake` invocation, in full:

> "auto-pilot i want you to work on helping to update the reporting in such a
> way that it is able to get to my intent, I want you to auto approve any
> hand off in building the right solution for what i have been trying to
> solve."

This is not a fresh complaint — it's a step-back request over an entire
session of prior iteration on the same feature. The original complaint that
kicked the session off (quoted in the source doc's framing, not a fresh
quote from Sara this turn) was:

> "I don't know if we're representing the data properly and there's still a
> lot of noise that's not coming out clean."

Round-by-round asks that followed (all verbatim, from
`intake/2026-07-26-focus-report-fidelity/request-source.md`):

- Round 1: "a code-looking icon [that] I could click on and then have it do
  a big pop-up and show me all of the events that represent that single
  event so I can see what data is supporting the duration of that activity."
- Round 2: "we need to aggregate the data... in five minute blocks... count
  of each event type... because each hour only has 20 events so if it last
  10 hours that's only 200 events."
- Round 3 (the real bug report): a segment stated "1h 40m" but its events
  all clustered in the first ~20 minutes, ending in an `Interrupted` event,
  then nothing for ~84 minutes before `ended_at`. "are we limiting the
  events shown?"
- Round 4 (Sara's own fix design, already implemented, uncommitted):
  "We can increase our block aggregation to 10 minutes if it is active
  agent time on the calendar it should show as one color and if for that 10
  minute block, it is not active agent time. It should show as another
  color when we show the card we should show the wall clock time. We
  should show the agent time let's do that."

## Restated ask

Sara believes the Focus-Time Report (Calendar view especially, but
potentially other views) still doesn't fully represent reality — despite
four rounds of iteration this session culminating in an already-implemented
but uncommitted fix. She wants the team to independently judge, from her
original complaint forward, whether the reporting now actually reflects
what happened, or whether gaps remain — and to build/fix whatever's still
missing, with standing pre-authorization to proceed through planning and
implementation without per-phase check-ins.

## Requester / source

Sara, same session, via the `/team-intake` slash-command invocation
(not an external ticket). Captured in
`intake/2026-07-26-focus-report-fidelity/request-source.md`, which itself
transcribes the whole chronological working history. Date: 2026-07-26.

## Surface / area touched

- `server/lib/focus-report.js` — `buildSessionFocusReport`,
  `buildActivityChunks`, `buildProjectFocusReport`, `inferredSegment`.
- `client/src/components/FocusCalendarView.tsx` — calendar swimlane view,
  chunk-stripe overlay, hover popup (wall clock + agent time).
- `client/src/components/FocusReportModal.tsx` — the `ListView` sub-component
  (stat tiles, per-session segmented bar, per-item rollup, project split) —
  **confirmed during intake to still be `wall_ms`-only** (see below).
- `client/src/components/SegmentEventsModal.tsx` /
  `client/src/lib/eventBuckets.ts` — the drill-down modal's 10-minute event
  buckets.
- Route: `GET /api/projects/:id/focus-report`.

## Known-variant relevance

No `PROJECT-CONTEXT.md` is configured for this repo (checked — file does
not exist at repo root or elsewhere). No pre-named recurring-defect surface
to cross-check against. That said, this request is itself exactly the
shape of a recurring-defect pattern worth naming going forward: a
derived/summary number (`wall_ms`) computed once and then reused
uncritically across multiple rendering surfaces (Calendar block, Calendar
popup, List stat tiles, List per-session bar, List per-item rollup, List
project split) — a fix applied to one consumer doesn't retroactively fix
the others. I confirmed by reading `FocusReportModal.tsx` directly: `ListView`
computes `totalMs` from `session.segments.reduce((sum, seg) => sum + seg.wall_ms, 0)`,
`kindTotalsAsSegments` reads `totals.by_kind[kind].wall_ms`, and the
project-split/per-item bars are sized by `wall_ms` throughout — none of
them reference `active_ms` or the new `chunks` field the round-4 fix added
to the API response. So the List view has the identical blind spot the
Calendar view had *before* round 4, and round 4 did not touch it.

## Provisional request type

`missed-requirement` (PROVISIONAL — PM makes the final call). Reasoning:
round 3 surfaced a genuine data-fidelity bug (a stated duration far
exceeding actual worked time); round 4 fixed only the Calendar view, one of
at least two consumers of the same underlying `wall_ms` figure. This isn't
a new feature ask and isn't quite a "bug" in the sense of broken code — the
code does what it was told — it's closer to an incompletely-scoped fix
that didn't cover every surface the original complaint implicated. Could
also be filed as `bug` at PM's discretion, since the List view's numbers
are actively misleading for the same reason the round-3 report was.

## Attachments / evidence

- No separate screenshot/example files were provided in this intake — the
  `supporting/` subfolder for this intake is empty. All evidence is the
  quoted conversational history in `request-source.md` (the "1h 40m" vs.
  ~20-minutes-of-events discrepancy from round 3; the "93 `TurnDuration`
  events in 5 minutes" anomaly mentioned as a screenshot observation but not
  attached as a file).
- Uncommitted round-4 diff is live in the working tree right now (`git
  status` shows modifications to `server/lib/focus-report.js`,
  `FocusCalendarView.tsx`, `FocusReportModal.tsx` test file, `eventBuckets`
  types, docs, etc., plus new untracked files
  `client/src/components/FocusCalendarView.tsx` note: this file is modified
  not new — the new untracked files are `FocusCalendarView.test.tsx`,
  `calendarLanes.ts`/test, `focus-inference.js`/test). Team should treat
  this diff as available-but-unreviewed work product, not as ground truth
  that the problem is solved.

## Explicit acceptance signals

Sara gave no single crisp "done when..." statement. The closest proxies,
extracted from the history:

- Round 1/2/4 each closed with an explicit build instruction that was then
  implemented and (per the source doc) tested green — those are "done" by
  Sara's own literal spec at each round.
- The *meta*-acceptance signal for *this* intake is implicit in her own
  framing: reporting should "get to my intent" and stop leaving "a lot of
  noise that's not coming out clean" — i.e., no further open question below
  should remain uninvestigated before this is considered ready to ship.

## Open questions

### BLOCKING
None. Every open question below is investigable from the code and existing
conversation history — none requires a business/priority judgment call only
Sara herself could make (Sara has also pre-authorized the team to proceed
through hand-offs without pausing).

### Non-blocking (proceed with stated assumption; team should resolve during
design/build, not escalate back to Sara first)

1. **Does the List view need the same wall_ms→active_ms/chunks treatment as
   the Calendar view got in round 4?**
   Assumption: yes — confirmed above that `ListView` is 100% `wall_ms`-based
   (stat tiles already correctly use `active_ms`/`wall_clock_ms` at the
   report level, but the per-session bar, per-item rollup, and project
   split below them are not) and this is the same class of misleading
   number round 3 flagged. Team should decide the concrete display change
   (e.g., size segmented bars by `active_ms`, or add its own idle
   indication) as part of design, not treat this brief as prescribing the
   fix.

2. **Does round 4's chunk-stripe overlay actually address the round-3 root
   cause, or only make the pre-existing misleading number visible
   (cosmetic) without questioning whether `wall_ms` should even be the
   figure quoted/used for sizing in the first place?**
   Assumption: worth a design-level second look — now that `chunks` exists
   on every segment, `buildSessionFocusReport`/`buildProjectFocusReport`
   could plausibly use `active_ms` for anything currently presented as "how
   long," reserving `wall_ms` as a secondary/explicit "wall clock" figure
   everywhere, not just in the Calendar popup. Non-blocking because it's a
   design tradeoff (how much churn to introduce) the team can propose and
   verify against tests, not something only Sara can decide.

3. **Is 10 minutes the right chunk grain, or an arbitrary number Sara typed
   in the moment?**
   Assumption: keep 10 minutes unless investigation surfaces a concrete
   problem with it (e.g., a segment where 10-minute granularity itself
   hides a shorter but still-misleading idle stretch, or event density data
   suggesting a different grain reads better). This is a tunable, not a
   correctness question — non-blocking.

4. **Is there other "noise" still hiding in the raw event data** (e.g., the
   93 `TurnDuration` events in 5 minutes observed in one screenshot,
   duplicate/near-duplicate events) that the new bucket/chunk tooling now
   makes visible but hasn't yet been examined?
   Assumption: worth a verification pass over real session data using the
   now-implemented bucketing before declaring this done, but not something
   that blocks starting design/build work on questions 1–2.

5. **Is the uncommitted round-4 work actually ready to ship as-is?**
   Assumption: no — per CLAUDE.md's testing policy this needs to be
   evaluated (tests re-run, diff reviewed) as part of this pass rather than
   assumed green from the source doc's self-report, especially since
   questions 1–2 may mean round 4 is superseded/extended rather than final.
