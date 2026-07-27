# Product Owner Assessment — Project-wide Focus Calendar Board

Source: `intake/2026-07-26-focus-calendar-board/request-brief.md` and
`request-source.md`. No `PROJECT-CONTEXT.md` exists for this repo, and no
scope-decision / business-requirements / stakeholder source-of-truth doc set
is configured or discoverable anywhere in the tree — I confirmed this by
searching the repo root and by relying on the intake brief's own "Known-variant
relevance" section, which states the same. This request is therefore evaluated
against CLAUDE.md's engineering constraints and ordinary product judgment, not
against any pre-existing signed-off spec (there isn't one to contradict).

## 1. Value & intent

Sara wants to go from "focus/activity data is something you dig for,
per-project, behind a modal" to "focus/activity data is a first-class place
you can go look at, across everything, the same way you already go look at
Dashboards or Projects." The underlying job-to-be-done is situational
awareness across a fleet of concurrent Claude Code sessions/projects: "what
has been happening, when, across all my agents" without having to open each
project's card one at a time and mentally stitch the timelines together.

This matters to the end user (Sara, and by extension anyone else who runs
this dashboard) because the existing `FocusReportModal` entry point only
answers "what happened in this one project" — it structurally cannot answer
"what happened across my whole fleet today," which is the more valuable
question once you have more than one or two active projects. The ask is a
straightforward generalization of an already-proven, already-loved feature
(the calendar/swimlane view, hover popup, event drill-down) rather than a new
concept — that lowers delivery risk and raises confidence the value is real.

## 2. Scope check

**Not a contradiction of any approved decision** — there is nothing to
contradict; no scope-decision doc, business-requirements doc, or
stakeholder-approved spec exists for this project. This is new territory,
not a re-litigation of settled scope.

**Is it a new ask vs. already-approved scope?** New ask. It is net-new UI
surface (new nav entry + new route) and, depending on the architecture
decision, net-new backend surface (a new aggregate endpoint). Nothing in
CLAUDE.md's repo map anticipates this — the repo map documents the *existing*
per-project modal/report path, not an aggregate one. I concur with the
brief's provisional classification of `new-feature`, not `bug-fix` /
`enhancement-to-existing-broken-behavior`.

**Verbal, same-session request, not yet approved.** Sara herself asked "how
would you go about that" — she was requesting a plan, not greenlighting a
build. The exploratory code notes in `request-source.md` are explicitly
flagged as "not yet approved" by the author who wrote them. Nothing in this
evaluation should be read as authorization to start implementation; that is
consistent with the guidance that no agent's message (including mine) can
substitute for Sara's own sign-off.

## 3. Acceptance criteria

Since Sara gave no explicit "done when" statement (confirmed in the brief),
these are proposed and need her confirmation before build, per section 5.
I've folded in a direct recommendation on each of the four flagged judgment
calls, since the brief asked for the evaluation team's read on those
specifically.

### Judgment call 1 — Standalone page vs. modal-like overlay

**Recommendation: standalone page**, a peer route to `Dashboard` / `Projects`
/ `Kanban Board`, not a modal.

- Rationale: Sara's own words — "a new *report*, a new *board*" — explicitly
  analogize to the existing sidebar peers, not to the existing modal
  behavior she already has and is choosing to move away from. If she wanted
  "the same modal, opened from a different button," she would not have
  described it as a new nav-level destination. Building a modal here would
  under-deliver relative to what she asked for.
- Acceptance criteria:
  - "Done when" a new entry appears in the sidebar nav list (peer position to
    existing entries, own icon + i18n label in `nav.json`), and clicking it
    navigates to its own URL/route (e.g. `/focus-calendar`) with its own
    page header — not an overlay on top of another page.
  - Deep-linking/refresh on that route lands on the same view (proof it's a
    real route, not route-simulated-by-modal-state).
  - Existing routes/nav entries are unchanged in position, label, and
    behavior (regression check).

### Judgment call 2 — Session-filter scoping (global vs. project-scoped)

**Recommendation: session filter is dependent on / scoped to whichever
project filter is currently selected** — i.e., the session dropdown is
empty/disabled until a project is chosen, then populates with that project's
sessions only. When "all projects" is selected (see call 3), the session
filter is disabled or hidden, since "which session" is only meaningful within
a project's session set.

- Rationale: a flat, unscoped list of every session across every project
  would be long, cross-project session IDs carry no meaning to a human
  without project context attached, and nothing in Sara's ask implies she
  wants to browse sessions independent of project. This mirrors how the
  brief's own default assumption reads her intent.
- Acceptance criteria:
  - "Done when" selecting a project populates the session filter with only
    that project's sessions (by recency or start time, matching existing
    session-list ordering conventions elsewhere in the app).
  - Clearing/resetting the project filter clears the session filter too (no
    stale session selection pointing at a now-hidden project).
  - Selecting a session further narrows the calendar to that session's
    activity only, without needing a page reload.

### Judgment call 3 — "All projects" as a valid unfiltered state

**Recommendation: yes — "all projects, no filter" is the default landing
state**, and project/session filters are strictly narrowing controls layered
on top, not required gates.

- Rationale: Sara's wording — "it would include all of the agent activities
  in the same way that we do it... and then we probably want a filter" —
  reads as: show everything first, filters are for narrowing after the fact.
  This is also the more valuable default: the entire point of a fleet-wide
  view (vs. the existing per-project modal, which already exists) is seeing
  everything at once without having to pick a project first.
- Acceptance criteria:
  - "Done when" landing on the new page with no filters selected renders a
    calendar showing activity across every project's sessions, in the same
    visual language as the existing per-project calendar (same lane
    assignment logic, same idle striping, same hover popup, same
    drill-down modal).
  - Each rendered segment/lane is attributable to its originating project
    (visible label or distinguishable grouping) since, unlike the
    single-project modal, ambiguity about "which project is this segment
    from" would make the aggregate view less useful, not more.
  - Performance: the "all projects, no filter" state must not silently
    degrade (e.g., unbounded query across all history) — needs an explicit,
    documented time-window default (matching whatever the existing
    per-project report already defaults to, unless the architect's plan
    states otherwise) since this state can no longer rely on a single
    project's naturally-bounded dataset size.

### Judgment call 4 — Fate of the existing per-project modal

**Recommendation: leave `FocusReportModal.tsx` and its two existing entry
points (`Projects.tsx:601`, `KanbanBoard.tsx:968`) exactly as they are** for
this change. Do not deprecate, hide, or visually alter them.

- Rationale: CLAUDE.md is explicit — "preserve existing behavior unless
  explicitly asked to change it." Sara asked for something new to be
  *added*; she did not ask for the modal to be removed or superseded. Users
  who currently rely on "click the report icon on a project card" muscle
  memory should see zero change. Consolidation, if it ever happens, is a
  distinct future decision that needs its own explicit ask and its own
  sign-off — bundling it into this change would be scope creep in the
  opposite direction (removing value without being asked).
- Acceptance criteria:
  - "Done when" the existing modal's trigger icon, position, and behavior on
    `Projects.tsx` and `KanbanBoard.tsx` are pixel/behavior-identical to
    before this change (covered by existing snapshot tests —
    `screens.snapshot.test.tsx` — which must show no diff for those two
    screens unless a diff is separately justified).
  - The new standalone page and the existing modal render the *same*
    calendar output for the same project/session (the brief's own
    known-variant risk: "does the calendar look and behave identically in
    both places" — this should be an explicit QA check, not assumed from
    code reuse).

### General/content-parity criterion

Since the calendar/swimlane rendering (`FocusCalendarView.tsx`,
`calendarLanes.ts`, `idleStripes.ts`, hover popup, `SegmentEventsModal`
drill-down) is being reused rather than reinvented, "done" also means: the
visual/interaction behavior in the new page is not a re-implementation that
drifts from the existing modal's — same component, same styling rules,
same idle-inference logic — verified by both automated tests and a manual
side-by-side check, not by trusting that "it's the same underlying
component" alone (two different data-fetch paths feeding the same component
can still produce visibly different results, e.g. different time windows or
missing project labels).

## 4. Priority & impact

- **Who is blocked today:** No one is hard-blocked — the per-project modal
  still works, so this is not fixing broken functionality. This is a
  visibility/efficiency improvement for a single stakeholder (Sara, the
  dashboard's primary/only user per the project's local-first, single-operator
  framing) rather than an urgent fix.
- **Visibility:** High-visibility once built — it's a new top-level nav
  item, seen on every session. Get the four judgment calls wrong and Sara
  will notice immediately every time she opens the sidebar, which raises the
  cost of shipping the wrong shape of "done" relative to a buried/internal
  change.
- **Urgency:** Low-to-medium. This was raised as an in-passing "let's plan
  this" request during an unrelated session, not as "I need this today."
  Recommend normal-priority backlog placement — plan it properly (architect's
  quick-vs-proper data-access call is the one item here with real technical
  weight, per the brief), but no need to rush ahead of other in-flight work
  without Sara asking to reprioritize.
- **Impact if under-scoped:** Building the "quick" client-side-merge N+1
  version to save time now would likely need to be redone once project count
  grows, per the brief's own architect-flagged concern — recommend PO
  input here be read alongside the architect's plan rather than in isolation,
  since data-access shape affects several of the acceptance criteria above
  (esp. the "all projects" performance criterion).

## 5. Stakeholder questions (need Sara's sign-off before implementation)

This entire feature needs Sara's explicit go-ahead before any code is
written — per the brief, she asked for a high-level plan, not a build
authorization, and per the general rule that no agent's exploratory work or
planning output constitutes her consent. Specifically, present her with:

1. Confirm the four recommendations above (standalone page; session filter
   scoped to selected project; "all projects" as valid default/unfiltered
   state; existing modal left untouched) — these are reasonable defaults,
   not her stated requirements, since she gave none.
2. Confirm the architect's chosen data-access path (quick vs. proper vs.
   third option) once that plan exists — this has cost/complexity trade-offs
   she should see before work starts, not just a technical footnote.
3. Confirm the nav entry's exact label/position and any naming (e.g. "Focus
   Calendar," "Activity Board") — Sara's own words used "board" and
   "calendar" somewhat interchangeably; a concrete proposed label should go
   back to her rather than the team guessing.
4. No content/wording change is involved here (this is a new feature/view,
   not a text correction), so the "must match source-of-truth doc exactly"
   acceptance bar from the standard PO template does not apply — flagging
   this explicitly so it isn't mistaken for an oversight.
