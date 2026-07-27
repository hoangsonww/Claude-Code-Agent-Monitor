# PM Plan: Project-wide Focus Calendar Board

Intake: `intake/2026-07-26-focus-calendar-board/` · Date: 2026-07-26 · PM pass

## 1. Request summary

Sara wants a new, first-class sidebar destination — a peer of `Dashboard`,
`Projects`, and `Kanban Board` — that shows the focus-time calendar/swimlane
view (session activity blocks, idle striping, hover popup, event drill-down)
across her **entire fleet of projects at once**, rather than the one place it
lives today: a modal opened per-project from a project card
(`FocusReportModal.tsx`, triggered from `Projects.tsx:601` /
`KanbanBoard.tsx:968`). She wants it filterable by project and by session.
This was raised as a same-session "how would you approach this" planning
ask, not a build authorization — she has not yet picked a data-access
direction or approved any of the open judgment calls below.

## 2. Request type

**Final classification: `new-feature`.** All four evaluators (PO, architect,
engineer, QA) independently concur; nothing here contradicts that read.

Reasoning:
- This is net-new UI surface (new nav entry, new route) and, under the
  recommended architecture, net-new backend surface (a new aggregate
  endpoint). Nothing existing is broken — the per-project modal works
  exactly as designed today.
- Not `bug` or `regression` — no prior behavior is incorrect or has
  regressed.
- Not `missed-requirement` — no prior requirement specified "and it should
  also show all projects at once"; this is Sara asking for a genuinely new
  capability, not a gap in a previously-stated ask.
- Not `text/content-change` or `clarification-only` — real code/UI/API
  surface is involved either way the architecture is decided.

## 3. History / background

**This exact ask has no precedent.** Checked
`~/.claude/skills/team-intake/memory/request-log.md` and `decision-log.md`
directly (grep for "Claude-Code-Agent-Monitor", "focus-report",
"focus-calendar", "FocusCalendar") — zero prior mentions of a project-wide
or aggregate focus board. This project has no `PROJECT-CONTEXT.md` and no
defect-class catalog, so there is no formal catalog to check either.

**But this is not a request in isolation — it's the latest entry in a long,
fast-moving, same-feature-area history, entirely within this project's own
persistent memory (`project_holistic-focus-history.md`) and today's own
git log:**

| When | What happened |
|---|---|
| Pre-session | Day-view swimlane calendar + List/Calendar toggle built and approved (`2c1ef2f`) |
| Same session | Concurrency/wall-clock vs. agent-effort-time distinction built |
| Same session | Hover popup, events-inspector modal, active/idle chunk striping (`2416292`) |
| **Earlier today (2026-07-26)** | **Separate team-intake cycle**, `2026-07-26-focus-report-fidelity`: a real data-fidelity bug (inferred segments overstating duration) plus a missed-requirement (the chunk/idle-stripe fix landed in Calendar view only, never List view) — classified `missed-requirement` with one embedded `bug`. Fixed and **committed this morning as `6e29722`** ("List view now honestly represents active vs. idle time"), including a new shared `idleStripes.ts` helper and a permanent List-vs-Calendar "standing template" consistency test. |
| **This request** | Same day, same feature area, same underlying files (`FocusCalendarView.tsx`, `FocusReportModal.tsx`, `server/lib/focus-report.js`) — but a different question: not "is the data honest," but "can I see it across all projects, not just one." |

**Have we seen this before? How many times?** Zero times for this specific
ask (aggregate/project-wide view). But this is the **second team-intake
cycle today**, and roughly the sixth-plus incremental extension of the same
focus-report feature within this single project, all arriving as verbal,
same-session asks with no upfront spec — a well-established pattern for this
feature area specifically (per `project_holistic-focus-history.md`, which
also already lists a "time-window selector" and "multi-plan lifecycle"
thread as still-undesigned future asks in this same vein). This request
should be read as another installment in that pattern, not a bolt from the
blue.

## 4. Recurrence diagnosis

This specific feature request is new (no repeat to diagnose in the
"same bug keeps coming back" sense). But there is a **directly on-point
systemic risk being re-triggered**, and it deserves being flagged loudly per
this project's own worked example from *this same morning*:

This morning's `focus-report-fidelity` cycle diagnosed the exact shape:
*"a computed/rendered surface duplicated across multiple consumers, no
shared helper, no cross-consumer test — one consumer gets a fix, the other
doesn't, and it recurs."* The durable fix adopted there was (a) extract
shared logic into a helper (`idleStripes.ts`) instead of copy-pasting, and
(b) add a permanent cross-view consistency test (`FocusReportModal.test.tsx`
line 518, explicitly marked "[standing template] ... extend THIS test, not
a view-local one, for any future field either view renders").

**This new request creates a third consumer of the same rendering surface**
(standalone page, alongside the modal's List and Calendar tabs) and,
independently, the architect and QA on this evaluation both — without
prompting from the morning's history — flagged the identical risk shape:
the *chrome* around `FocusCalendarView` (stat tiles, List/Calendar toggle,
`ListView`) is today private to `FocusReportModal.tsx`, and if the new page
is built by copy-pasting that chrome rather than extracting it, this
project will have manufactured the *same* "same content, multiple
codepaths, no shared source of truth" defect shape a second time in one
day — this time preemptively, before it even ships, rather than reactively
after a bug report.

The good news: I confirmed this morning's durable fix (shared
`idleStripes.ts` helper, cross-view standing-template test) is genuinely
committed and in place (`6e29722`), so the guardrail this feature needs
already exists as a working pattern — it just needs to be **applied
prospectively** to this new entry point rather than re-invented. The
architect's plan already recommends the correct move: extract the modal's
chrome into a shared `FocusReportBody`-style component consumed by both the
existing modal and the new page, and QA's plan extends the existing
standing-template test as the regression guard, not a new one-off. That is
exactly the discipline this morning's incident called for — the team should
be commended for reapplying it here without being told to, but it is worth
Sara knowing this is a deliberate carry-forward of this morning's lesson,
not a coincidence.

**No prior history found for the specific request itself** ("build an
aggregate/all-projects focus view") — this part is genuinely new.

## 5. Where this is coming from

A changed/expanded ambition, not a defect. Sara's own words frame it plainly
as generalizing an already-loved feature ("what we look at for the focus
report for that calendar... include all of the agent activities in the same
way that we do it") from single-project to fleet-wide, because the
dashboard's whole premise is monitoring multiple concurrent Claude Code
sessions/projects, and the current modal structurally cannot answer "what's
happening across everything." This is product ambition growing alongside
increasing real usage, not drift or misunderstanding.

## 6. Recommendation to the human

**This is a new ask, to be scoped and estimated as such — not a fix, not
"our cost."** Recommend normal-priority backlog placement (no one is
blocked; the existing modal still works); build only after Sara explicitly
picks a direction below. Concretely:

1. **Approve the architecture direction now, before any code is written.**
   All three technical evaluators (architect, engineer, QA) independently
   converge on **Option B ("proper"): a new aggregate endpoint**,
   `GET /api/focus-report?project_id=&session_id=&sources=`, reusing
   `buildProjectFocusReport`/`buildSessionFocusReport` completely unchanged
   (they already take a plain `sessions` array — no project-specific logic
   inside them today). Reject the "quick" client-side-merge alternative: it
   requires N+1 fetches with no bound, and — more importantly — it would
   force a second, client-side reimplementation of the wall-clock/
   concurrency aggregation math that already lives once in
   `server/lib/focus-report.js`, recreating the exact "same computation, two
   places" risk this project just spent this morning fixing for a rendering
   surface. Recommend approving Option B outright rather than re-opening the
   debate.
2. **Approve the four working assumptions the PO/architect/engineer/QA
   already converged on**, presented to Sara as defaults to confirm, not
   requirements to re-litigate:
   - Standalone page (own route, own header), not a modal overlay — matches
     Sara's own "new board" framing.
   - Session filter is dependent on / scoped to whichever project is
     selected (disabled/hidden under "all projects") — avoids an unwieldy
     global session list.
   - "All projects, no filter" is the default landing state, not a
     required-gate; each rendered block should show which project it came
     from (a genuinely new field this view needs that the per-project modal
     never did).
   - The existing modal (`FocusReportModal.tsx`, both entry points) is left
     completely untouched — no deprecation, no consolidation, per CLAUDE.md's
     "preserve existing behavior."
3. **Mandate the architect's "extract, don't copy" structure as non-optional
   scope, not a nice-to-have**: the modal's stat-tile/List-Calendar-toggle
   chrome must be extracted into a shared component consumed by both the
   modal and the new page. Building the new page by copy-pasting that chrome
   would reopen, in a new form, the exact defect this project fixed hours
   ago. This should be treated as a DoD item with the same weight as the
   feature itself, not an implementation detail left to taste.
4. **Mandate a cross-entry-path parity test as a DoD item**, extending
   (per its own comment) the existing `FocusReportModal.test.tsx` standing
   template rather than writing a new one-off — asserting the new
   standalone page and the existing modal render identical data/geometry
   for the same project/session/day. This is the concrete regression guard
   for the risk in §4.
5. **Flag, for Sara's explicit decision, not silent adoption**: the new
   endpoint should apply the existing `sources` (Remote Data Sources)
   scoping convention from day one (`server/lib/source-filter.js`, already
   used by `analytics.js`/`agents.js`/`events.js`) — the *old* per-project
   endpoint currently silently ignores this filter, which is a separate,
   pre-existing gap. Recommend fixing it going forward on the *new* endpoint
   only, and treating the old endpoint's gap as an explicitly separate,
   not-bundled follow-up (per CLAUDE.md's "preserve existing behavior unless
   explicitly requested").
6. **Watch the "4-locale nav.json" trap directly** — I independently
   verified (reading `client/src/i18n/__tests__/i18n.test.ts`) that the test
   added this morning is scoped specifically to the `report.calendar.*` key
   relocation, not a general "every locale has every nav key" completeness
   check. There is currently no automated guard that would catch a new nav
   label added to `en/nav.json` and forgotten in `zh`/`vi`/`ko`. Recommend
   either adding a general locale-key-parity test as part of this feature,
   or treating the 4-file edit as a manually-checklisted step — don't rely
   on CI to catch it today.
7. **Do not silently fold in** the still-open "time-window selector" or
   "multi-plan lifecycle" threads already on record in
   `project_holistic-focus-history.md` — those are separate, larger, still-
   undesigned questions; this feature's "all projects, all time" default
   inherits the same unbounded-query performance ceiling flagged there, and
   should get an explicit, documented time-window default (matching
   whatever the per-project report already uses) rather than silently
   deferring the same open question a third time.

## 7. Open decisions for the user

None of these block starting the architecture/build once approved, but all
need Sara's explicit sign-off before code is written (she asked for a plan,
not a green light):

1. **Confirm Option B (aggregate endpoint)** as the data-access direction —
   or explicitly override it.
2. **Confirm the four working-assumption defaults** in §6.2 (standalone
   page; project-scoped session filter; all-projects-as-default with
   per-block project labeling; existing modal untouched).
3. **Confirm the nav entry's label** — Sara used "board" and "calendar"
   interchangeably; team needs one concrete label (e.g. "Focus Calendar")
   rather than guessing.
4. **Decide whether `concurrency_ratio`/`wall_clock_ms` are even meaningful
   on an "all projects" aggregate** (their meaning shifts from "how
   concurrent is this one project" to "how concurrent is everything,
   everywhere") — architect flagged this needs an explicit PO/Sara call, not
   an assumed carry-over.
5. **Decide the time-window default** for the unfiltered "all projects, all
   time" state (performance-bounding), rather than leaving it unbounded.

## Memory update note

This project has no `PROJECT-CONTEXT.md` and no defect-class catalog to
update. Appending this request to the global fallback
`~/.claude/skills/team-intake/memory/request-log.md`. No new catalog entry
is being created unprompted (per the project's own established
"Sara decides whether to start one" convention, already surfaced once this
morning) — but this PM plan explicitly notes, for whoever reads it next,
that this project has now hit the identical "one rendering surface, multiple
consumers" risk shape twice in the same day, which is a reasonable trigger
for Sara to finally decide whether this project should start one.
