# Request source: focus-time reporting fidelity

**Origin:** Not an external ticket — this is a same-session request from Sara,
captured verbatim plus the full working history that led up to it, since the
team needs the "where we're coming from" to judge whether Sara's stated
intent has actually been reached.

## Sara's own words (the /team-intake invocation)

> auto-pilot i want you to work on helping to update the reporting in such a
> way that it is able to get to my intent, I want you to auto approve any
> hand off in building the right solution for what i have been trying to
> solve.

Read literally: Sara believes the focus-time reporting feature (see history
below) does not yet fully match what she has been trying to get it to do,
across several rounds of iteration this session. She wants a fresh, more
rigorous pass (hence invoking team-intake instead of just continuing ad hoc)
to figure out what's actually still missing, and has pre-authorized
proceeding through planning into implementation without pausing for
approval at each phase ("auto-pilot", "auto approve any hand off").

## Working history this session (chronological)

The feature in question is the **Focus-Time Report** for a project
(`GET /api/projects/:id/focus-report`, `server/lib/focus-report.js`),
specifically its **Calendar** view (`client/src/components/
FocusCalendarView.tsx`) and the modals it opens.

1. **Starting point (already shipped before this session, per git log):** a
   day-view swimlane calendar showing each session's focus segments as
   colored blocks on a 24-hour axis, with a List/Calendar toggle in
   `FocusReportModal`.

2. **Round 1 — hover tooltip.** Sara noted that hovering a calendar block
   showed its detail via the browser's native `title` attribute (plain OS
   tooltip) and asked for "a code-looking icon [that] I could click on and
   then have it do a big pop-up and show me all of the events that
   represent that single event so I can see what data is supporting the
   duration of that activity." Implemented:
   - A floating, styled hover popup (portaled, anchored off the block),
     replacing the native tooltip.
   - A `</>` (Code2) icon on each block opening `SegmentEventsModal` — every
     raw hook event in that segment's real time window, fetched from
     `GET /api/events?session_id=&from=&to=`.

3. **Round 2 — event volume / aggregation.** Sara: "we need to aggregate the
   data... in five minute blocks... count of each event type... because
   each hour only has 20 events so if it last 10 hours that's only 200
   events." Implemented: `bucketEvents()` (`client/src/lib/
   eventBuckets.ts`) grouping the modal's raw events into 5-minute buckets,
   each showing a per-`event_type` count and expanding into its individual
   events.

4. **Round 3 — the actual data-quality bug.** Sara noticed a real
   discrepancy: a segment's stated duration ("1h 40m") didn't match the
   events actually shown (all clustered in the first ~20 minutes, ending in
   an `Interrupted` event, then nothing for ~84 minutes before the
   session's `ended_at`). She asked: "are we limiting the events shown?"

   Root cause found (not a display bug): for a session with **no declared
   Focus history**, `inferredSegment()` in `server/lib/focus-report.js`
   builds ONE segment spanning the session's first event straight through
   to `session.ended_at` — regardless of how much of that span was silence.
   The report separately computes an idle-grace-discounted `active_ms` for
   the segment, but the calendar block's size/position and the popup's
   duration figure were both built from the raw `wall_ms`, not `active_ms`.
   So a segment can visually claim (and state) far more time than was
   actually worked.

   Three fix options were offered (trim the segment to last-activity+grace;
   show `active_ms` instead of `wall_ms`; investigate why `ended_at` is so
   late). Sara did not pick one of those — she designed her own fix instead
   (round 4).

5. **Round 4 — Sara's own fix design, implemented this session.**
   > "We can increase our block aggregation to 10 minutes if it is active
   > agent time on the calendar it should show as one color and if for that
   > 10 minute block, it is not active agent time. It should show as
   > another color when we show the card we should show the wall clock
   > time. We should show the agent time let's do that."

   Implemented (server + client):
   - `server/lib/focus-report.js`: new `buildActivityChunks()` — slices
     each segment into fixed 10-minute windows, each flagged `active` if
     any real event landed inside it (no idle-grace credit, a plainer fact
     than `active_ms`/`idle_ms`). Attached as `chunks` on every segment in
     the API response.
   - `FocusCalendarView.tsx`: each block now overlays a dark stripe over any
     idle 10-minute chunk; active chunks get no overlay (the block's normal
     kind color already reads correctly). The hover popup now states BOTH
     "Wall clock: Xh Ym" and "Agent time: Xm Ys".
   - `SegmentEventsModal.tsx` / `eventBuckets.ts`: bucket size bumped from
     5 → 10 minutes (unifying the grain with the new chunk stripes); header
     now also states both wall-clock and agent time.
   - Tests added/updated at every layer (server: `focus-report.test.js`;
     client: `FocusCalendarView.test.tsx`, `eventBuckets.test.ts`). Full
     suites green (902 server / 403 client), `tsc --noEmit` clean, docs
     updated (`ARCHITECTURE.md`, `docs/API.md`, `client/README.md`,
     `server/README.md`).
   - **This work is implemented but UNCOMMITTED** as of this request — it
     has not been reviewed against Sara's actual underlying goal, only
     against her literal build instructions.

## The open question this intake should actually answer

Sara's team-intake framing ("help update the reporting... to get to my
intent") reads as a step back from round-by-round patching: rather than
assuming round 4's implementation is the finish line, the team should
independently judge — from the *original* complaint ("I don't know if we're
representing the data properly and there's still a lot of noise that's not
coming out clean") through every round above — whether the reporting now
actually represents reality, or whether gaps remain. Candidates worth the
team's scrutiny (not a prescriptive list — the team should find its own):

- Does the round-4 fix fully address the round-3 root cause, or only make it
  visible (stripes + two numbers) without addressing *why* an inferred
  segment's `wall_ms` can be so misleading in the first place (e.g. should
  `buildSessionFocusReport`'s use of `wall_ms` for calendar sizing/duration
  be reconsidered, now that `chunks` exists)?
- Is 10 minutes actually the right grain, or an arbitrary number Sara typed
  in the moment?
- Does the List view in `FocusReportModal` (stat tiles, per-session
  segmented bar, per-item rollup) have the same wall_ms-only blind spot the
  Calendar view had before round 4 — i.e. was the fix applied everywhere the
  same misleading number shows up, or only in the Calendar view Sara
  happened to be looking at?
- Is there anywhere else "noise" (Sara's original word) could still be
  hiding — duplicate/near-duplicate events, event volume anomalies (e.g. 93
  `TurnDuration` events in 5 minutes seen in one screenshot), or other
  under-examined signal in the raw event data the new tooling now exposes?
- Given this is now implemented but uncommitted, is it actually ready to
  ship as-is, or does verification/QA reveal gaps before it should land?

## Constraints / non-negotiables (from CLAUDE.md)
- Preserve existing behavior unless explicitly asked to change it; minimal,
  reversible diffs.
- Backend changes: `npm run test:server` before finishing. Frontend:
  `npm run test:client` (includes per-screen snapshot tests).
- Every source file needs the project's authorship header
  (`.claude/skills/file-headers/`).
- Docs (`README`, `ARCHITECTURE.md`, `docs/API.md`, server/client READMEs)
  must stay in sync with any behavior/response-shape change.
