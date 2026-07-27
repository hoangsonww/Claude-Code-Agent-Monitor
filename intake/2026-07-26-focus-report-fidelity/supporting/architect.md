# Architect Assessment — Focus-Time Reporting Fidelity

No `PROJECT-CONTEXT.md` is configured for this repo (confirmed: not present
at repo root or elsewhere). No pre-named recurring-defect catalog to check
against directly, so the general single-source-of-truth principle is applied
on its own merits below — but note that the shape here (a computed number
duplicated across several rendering surfaces, one surface's fix not reaching
the others) is exactly the kind of thing such a catalog exists to prevent,
and it is worth naming as a candidate entry now.

## 1. Affected subsystems & boundaries

- **`server/lib/focus-report.js`** — sole owner of focus-time computation.
  `buildFocusSegments` (declared history replay), `inferredSegment`
  (classifier fallback), `activeIdleMs` (grace-discounted active/idle),
  `buildActivityChunks` (round-4 addition: 10-min active/idle flags),
  `buildSessionFocusReport` (per-session enrichment — this is where
  `wall_ms`/`active_ms`/`idle_ms`/`chunks` all get attached to every
  segment), `buildProjectFocusReport` (rollup: per-item totals, project
  totals, wall-clock union, concurrency ratio). This file is the single
  source of truth for "how long," and it already **does** attach `chunks` to
  every segment unconditionally — the raw material for parity already
  reaches the client for every consumer, it's just unused in some of them.
- **`client/src/lib/types.ts`** — wire contract (`FocusReportSegment`,
  `FocusReportChunk`, `FocusKindTotals`, `FocusReport`). `chunks` was added
  to `FocusReportSegment` only; `FocusKindTotals`/per-kind buckets were not
  touched, which is the structural reason the List view's item-rollup and
  project-split sections have no chunk-shaped data to draw on even if they
  wanted it (see §1 answer below).
- **`client/src/components/FocusCalendarView.tsx`** — round-4's only wired
  consumer of `chunks` (`idleStripesForBlock`). Owns per-segment rendering;
  operates one segment/block at a time, so per-segment `chunks` arrays are a
  natural fit for its geometry.
- **`client/src/components/FocusReportModal.tsx`** (`ListView` sub-component)
  — confirmed by direct read: `totalMs` per session is
  `segments.reduce((sum, seg) => sum + seg.wall_ms, 0)` (line 242);
  `kindTotalsAsSegments` reads `totals.by_kind[kind].wall_ms` (line 376);
  `SegmentedBar` sizes every bar by `wall_ms` (lines 279, 305, 318,
  304/398/404). None of the three `ListView` surfaces (per-session bar,
  per-item rollup, project split) touch `active_ms` or `chunks`. This is a
  **different shape of consumer** than the Calendar: it aggregates N
  segments (from possibly many sessions) into one bar, and the project-split
  /per-item cases aggregate across *kind*, not per-segment at all — chunks,
  which are per-segment, don't exist at that granularity today.
- **`client/src/components/SegmentEventsModal.tsx`** /
  **`client/src/lib/eventBuckets.ts`** — independent bucketing of raw
  `DashboardEvent` rows (client-side, from `/api/events`), not of `chunks`
  (server-side, from `focus-report.js`). Same 10-minute grain by convention
  (`BUCKET_MS` mirrors `CHUNK_MS`, both hardcoded, cross-referenced only in
  comments) but no runtime coupling — see §3.
- **Route**: `GET /api/projects/:id/focus-report` (`server/routes/projects.js:218`)
  — thin, delegates entirely to `buildProjectFocusReport`. Not itself a
  design surface, but its response payload size is affected by §4 below.

## 2. Current design

The project already has a clear "one computation, multiple renderers"
intent: `focus-report.js`'s doc header explicitly frames `wall_ms` (a raw
span) as separate from `active_ms`/`idle_ms` (grace-discounted) and now
`chunks` (an honest, non-discounted per-window fact) — three deliberately
different "how long" figures for different display purposes, computed once,
server-side, per segment. That is the right instinct and the right owner.

The gap is that this multi-figure design was only **wired through to one of
two client consumers**. The Calendar view (built in round 4) reads
`wall_ms`, `active_ms`, and `chunks` together. The List view was left
exactly as it was before round 4 — reading only `wall_ms`, ignoring
`active_ms` (which the *stat tiles* above `ListView` already correctly use)
and `chunks` (which doesn't exist at the granularity `ListView` needs
anyway — see below). This is not a case of the server failing to produce a
single source of truth; it's a case of one client surface not yet consuming
what's already there, plus one new field (`chunks`) that was designed for
exactly one shape of consumer (single segment, single block) without
considering the others.

## 3. Options — Question 1: List-view parity

The List view's three sub-surfaces are structurally different from the
Calendar's, so "just reuse chunks" doesn't uniformly apply:

- **Per-session bar** (`SegmentedBar segments={session.segments}
  totalMs={totalMs}`): this *is* per-segment, same granularity as Calendar
  blocks. `chunks` could be reused directly here — e.g. size the bar by
  `active_ms` instead of `wall_ms`, and/or stripe each segment's slice of the
  bar the same idle-overlay way Calendar does. This is the cheapest,
  lowest-risk parity fix and directly addresses the round-3 bug shape (a
  long low-density segment inflating a bar).
- **Per-item rollup** (`kindTotalsAsSegments(item.totals)`,
  `totalMs={item.totals.wall_ms}`): this is aggregated across every segment
  that touched an item, across sessions — pseudo-segments, not real ones.
  There is no single segment here to attach a `chunks` array to; a
  "rolled-up idle fraction" is a different, new shape:
  `item.totals.{wall_ms,active_ms,idle_ms}` already exists (from
  `emptyKindTotals`/`addToTotals`), so the fix here is simply **switch the
  bar's sizing denominator from `wall_ms` to `active_ms`** (which the code
  already computes and carries, just doesn't use for sizing) — no chunk
  reuse needed or possible at this granularity.
- **Project split** (`kindTotalsAsSegments(report.totals)`,
  `totalMs={report.totals.wall_ms}`): same shape as the per-item rollup —
  aggregated by kind across the whole project. Same fix: size by
  `active_ms`.

**Recommendation:** two complementary, independently-shippable changes,
not one:
1. Per-session bar: reuse `chunks` (same idle-stripe treatment as Calendar,
   factored into a shared helper rather than copy-pasted — see risk below).
2. Per-item rollup and project split: switch `totalMs`/sizing from
   `wall_ms` to `active_ms` (the data already exists; this is a one-line
   change per call site in `ListView`, not a new aggregate shape). A
   "rolled-up active/idle chunk count" (the brief's parenthetical
   alternative) is unnecessary extra surface — `FocusKindTotals` already
   carries the rolled-up `active_ms`/`idle_ms` sums needed to size these
   bars correctly; introducing a second rolled-up representation of the same
   fact would itself violate the single-source-of-truth principle this
   whole intake is about.

This also argues for extracting the idle-stripe-from-chunks math
(`idleStripesForBlock` in `FocusCalendarView.tsx`) into a shared helper
(e.g. `client/src/lib/calendarLanes.ts` or a new small module) so the
per-session `SegmentedBar` and Calendar blocks compute idle overlays from
one function, not two independent reimplementations — reusing the *pattern*
without duplicating the *logic*, which is the same lesson the project's own
`wall_ms`-duplication-across-views bug is teaching in the first place.

## 4. Question 2 — is wall_ms's "duration" role still sound; should inferredSegment's end be capped?

This is the more consequential design question, and it's where I'd push
back gently on treating it as purely non-blocking/cosmetic.

**Current behavior:** `inferredSegment` (focus-report.js:217) sets a
whole-session segment's `end` to `endAt`, which `buildSessionFocusReport`
passes through as `session.ended_at || nowIso` — i.e., the segment rides
all the way to session end (or "now" for a live session) regardless of when
real activity actually stopped. `wall_ms` is then `end - start` over that
full span. This is exactly the round-3 bug shape: "1h40m" stated, ~20
minutes of real events, 84 minutes of silence before `ended_at`.

Round 4's `chunks`/idle-stripe fix makes this **visible** (idle stretches
render differently) but does not **change** what `wall_ms` numerically is,
nor what get quoted as "the segment's duration" in every place that isn't
Calendar's stripe overlay (List view's bars, `SegmentedBar` tooltips, the
event modal's header `wallMs`, i18n strings like `report.calendar.wallClockLabel`).
`wall_ms` is still "the full span, no matter how much of it was silence" —
chunks papers over that at the pixel level in one view, but the underlying
number Sara originally complained about ("1h40m" when it should read more
like "20m") is unchanged everywhere the number itself (not a chunk stripe)
is what's shown.

**Options:**

- **(A) Leave `wall_ms`/segment boundaries as-is; treat `chunks` as the
  complete fix.** Cheapest, zero migration risk, already implemented for
  Calendar. Con: does not resolve the root complaint for any surface that
  quotes a duration number rather than rendering stripes (List view numbers,
  tooltips, event-modal header, i18n labels like "the segment ran Xh Ym") —
  those still say something materially larger than the truth for a
  long-idle-tailed segment. This is the "cosmetic, not corrective" risk the
  brief itself flags in its Non-blocking Q2.

- **(B) Cap an *inferred* whole-session segment's `end` near the last real
  event timestamp (e.g. last event + grace window), instead of riding to
  `session.ended_at`/now.** This directly fixes the round-3 root cause for
  the one case it was actually observed in (a session with no declared Focus
  history, relying on `inferredSegment`). It's a narrow, well-scoped change:
  `inferredSegment` already has access to the session id; it would need the
  same `allTimestampsMs` list `buildSessionFocusReport` builds (a
  restructuring — `inferredSegment` is currently called *before*
  `allTimestampsMs` is computed, so this requires either passing that array
  in or querying the last event timestamp directly).
  - **Risk:** `wall_ms` currently participates in `sessionSpans` in
    `buildProjectFocusReport` (line 420-423), which computes `wall_clock_ms`
    via `mergeIntervals` — the project's "calendar time at least one
    session was running." If an inferred segment's `end` is capped short of
    `session.ended_at`, the session's own "last segment end" no longer
    represents when the session actually finished — `wall_clock_ms` would
    under-report calendar coverage for any project with idle-tailed inferred
    sessions. That's a real, silent side effect two rollups downstream from
    the change, easy to miss in review.
  - **Risk:** declared segments (from real `Focus` events, not inferred)
    would NOT get this treatment under this option — the brief's own
    round-3 example may or may not have been an inferred session; if
    declared segments have the same problem (a real `Focus` "set" event
    that's simply never closed because the session died/was killed rather
    than clean-`Stop`ed), option B as scoped only half-fixes it. Worth
    checking against real data (this is exactly Non-blocking Q4 in the
    brief) before committing to "inferred-only."
  - **Migration concern:** none — this is a pure computation change, no
    schema/stored-data migration; every focus-report response is computed
    fresh on each request.

- **(C) Reconsider what "duration" means globally: make `active_ms` the
  number surfaced everywhere as "how long," and demote `wall_ms` to an
  explicit, secondary "wall clock" label wherever it appears (not just the
  Calendar popup) — without touching segment boundaries at all.** This
  is a presentation-layer generalization of the §1 fix (item
  rollup/project split already need this) rather than a computation change,
  so it's lower-risk than (B): no `mergeIntervals`/`wall_clock_ms`
  side effects, because segment boundaries and thus session spans are
  untouched. It also composes cleanly with (B) — they solve different
  problems (A: what gets displayed as "the" duration; B: whether the
  segment's own boundary is honest) and are not mutually exclusive.

**Recommended approach:** (C) first — extend round 4's "wall_ms + active_ms
side by side" convention to every remaining surface (List view's three
sub-surfaces, per §1) — because it's a pure display change with no
`wall_clock_ms`/concurrency side effects and directly answers "does the
quoted number reflect reality" everywhere, not just Calendar. Pair with a
scoped version of (B) restricted to `inferredSegment` specifically (capping
only the *inferred* whole-session fallback's end near last real activity,
credited with the grace window same as `activeIdleMs` already uses) since
that's the one case where a segment's boundary itself — not just its
display — is architecturally unmoored from any real signal (`session.ended_at`
is a fact about the *session*, not about when this *particular inferred
attribution* stopped being true). Do NOT extend boundary-capping to
declared segments without first confirming (via Q4's data-verification
pass) that declared segments exhibit the same problem — declared segments
have a real `Focus` "done"/"set" event that's supposed to be the authority
on when a segment ends; capping them speculatively risks eroding "declared
history is ground truth" (the file's own stated invariant, line 39-40)
for a problem that may not exist there.

## 5. Question 3 — is 10 minutes (CHUNK_MS/BUCKET_MS) architecturally sound as a hardcoded default, or should it be an env knob like DASHBOARD_FOCUS_IDLE_GRACE_SECONDS?

Structurally, `CHUNK_MS` and `BUCKET_MS` are **not** the same kind of knob
as `DASHBOARD_FOCUS_IDLE_GRACE_SECONDS`:

- `DASHBOARD_FOCUS_IDLE_GRACE_SECONDS` changes a *value* (`active_ms`/
  `idle_ms`) that is computed once, server-side, and consumed as a number —
  changing it doesn't require the client and server to agree on anything
  beyond the resulting figure.
- `CHUNK_MS`/`BUCKET_MS` are **shared, cross-process constants** that two
  independently-computed features must agree on for a claimed invariant to
  actually hold: the file header of `focus-report.js` (lines 53-56) and
  `eventBuckets.ts` (lines 17-19) each claim, in a comment, that their
  10-minute constant "matches" the other — but nothing enforces this at
  runtime. They are two separately hardcoded `10 * 60 * 1000` literals, one
  in server JS, one in client TS, connected only by a code comment. If either
  were made independently configurable (e.g. `CHUNK_MS` via an env var read
  only server-side), the documented parity between calendar stripes and the
  events-modal bucket rows would silently break for any operator who
  changed one without knowing about the other — a real duplicated-constant
  risk of exactly the kind this intake's premise (duplicated-logic drift)
  warns about, just for a granularity constant instead of a computed value.
  Also note `bucketEvents(events, bucketMs = BUCKET_MS)` already accepts an
  override parameter client-side — nothing currently calls it with a
  non-default value, but the seam exists on one side and not the other.

**Recommendation:** keep 10 minutes as a fixed default (no concrete problem
surfaced yet that a different grain would fix — this is a tunable, not a
correctness gap, matching the brief's own assumption). If it's ever made
configurable, it must be a **single source of truth**, not two mirrored env
vars: e.g. serve the grain the server used in the `FocusReport` payload
itself (the way `idle_grace_seconds` is already echoed back at
line 431/`report.idle_grace_seconds`) and have `eventBuckets.ts` consume
that returned value instead of its own hardcoded `BUCKET_MS` constant. That
turns an implicit, comment-only "these must match" contract into an
explicit, enforced one — the same fix-shape as the general
single-source-of-truth principle this whole intake is testing.

## 6. Other structural risks in the round-4 diff (from reading current code)

- **Payload size / unbounded chunk arrays.** `buildActivityChunks` is now
  called unconditionally for every segment in `buildSessionFocusReport`
  (line 310), including `inferredSegment`'s whole-session fallback, whose
  span can be arbitrarily long (a multi-day idle session). At 10-minute
  granularity that's ~144 chunk objects/day/segment, each a full
  `{start, end, active}` triple (two ISO strings + bool — not compact).
  `buildProjectFocusReport` calls this per session, for every session in a
  project. A project with many long-idle or long-running sessions could see
  a materially larger `/api/projects/:id/focus-report` response than
  before round 4, with no cap, no pagination, and no lazy-loading — the
  entire chunk breakdown for every segment of every session ships on first
  fetch even though only the Calendar view (and only for the one visible
  day) currently renders any of it. This isn't a correctness bug but is a
  scaling risk worth a deliberate call: either accept it (chunks are cheap
  enough in practice) or scope chunk generation to only the segments/time
  range actually being viewed (which would require a client-driven
  date-range parameter the endpoint doesn't have today — a bigger change,
  probably out of scope for this pass, but worth flagging so it doesn't
  surprise someone later on a project with months of session history).

- **`chunks` marked optional (`chunks?:`) in the wire type but always sent
  by the server.** This is a reasonable defensive choice for typing (per
  the type's own comment, "older-shaped fixtures/data don't need to
  fabricate it") but means every consumer that *does* read `chunks` must
  handle `undefined` (Calendar does: `seg.chunks ?? []`). Any future List
  view change reusing `chunks` (§1's per-session-bar option) must do the
  same — easy to get right, easy to forget; worth a shared accessor rather
  than each call site re-deriving `?? []`.

- **No test coverage found yet for `buildActivityChunks` boundary behavior**
  beyond what's implied by `FocusCalendarView.test.tsx` (untracked, not yet
  reviewed for chunk-specific assertions) — worth confirming during
  implementation/verification (this overlaps with the brief's own
  Non-blocking Q5: round 4 should not be assumed green without an actual
  `npm run test:server` / `npm run test:client` run).

- **No functional regression spotted** in the diff itself: `chunks` is
  additive to the segment shape, `CHUNK_MS`/`buildActivityChunks` are new
  exports, nothing existing was restructured or removed. The
  `buildProjectFocusReport`/`mergeIntervals`/`wall_clock_ms` logic is
  untouched by round 4 — the risk in §4 above (option B) is prospective
  (only relevant if boundary-capping is implemented), not present in the
  current diff.

## Summary of recommendations

1. List view parity: two distinct fixes, not one reused mechanism — reuse
   `chunks`/idle-stripe treatment for the per-session bar (same granularity
   as Calendar); switch the per-item-rollup and project-split bars from
   `wall_ms` to the already-computed `active_ms` (no new aggregate shape
   needed, `FocusKindTotals` already carries it).
2. `wall_ms` as "the duration": not fully sound in isolation post-round-4;
   recommend (C) — surface `active_ms` alongside `wall_ms` everywhere, not
   just Calendar — paired with a scoped (B): cap `inferredSegment`'s end
   near last real activity (grace-window credited), but only after
   confirming declared segments don't share the problem; watch
   `wall_clock_ms`/`mergeIntervals` for knock-on effects.
3. Keep `CHUNK_MS`/`BUCKET_MS` fixed at 10 minutes; if ever made
   configurable, echo the server's value back in the `FocusReport` payload
   (like `idle_grace_seconds` already does) rather than maintaining two
   independently-hardcoded constants that must be kept in sync by comment
   convention alone.
4. Structural risk: unbounded per-segment `chunks` arrays inflate the
   project focus-report payload with no cap/lazy-load, worth a deliberate
   accept-or-scope decision before this ships broadly.
