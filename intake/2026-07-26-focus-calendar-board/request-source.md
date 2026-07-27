# Request source: project-wide focus calendar board

**Origin:** Not an external ticket — this is a same-session request from Sara,
captured verbatim plus the exploratory discussion that preceded it, so the
team has the full "where we're coming from" rather than just the final ask.

## Sara's own words

> I want to add a new view so just like how we have In our side menu, we have
> dashboards and projects in the combo board. What I wanna do is what we look
> at for the focus report for that calendar. I want a new report a new board
> that is the calendar board and it would show the calendar and it would
> include all of the age activities in the same way that we do it and show
> the calendar in the focus report and then we probably want a filte that
> would allow us to select which project or another filter they would allow
> us to pick which session that we're reviewing at, but yeah, let's tell me
> at a high-level. How would you go about that

Read literally, plus a follow-up clarifying exchange in the same turn: Sara
wants a **new top-level nav destination** (she described it as being like how
"Dashboards" and "Projects" already sit in the side menu) that surfaces the
**focus-report calendar** — today only reachable per-project, inside a modal
opened from a project card — as its own standalone page. It should show "all
of the [agent] activities" the same way the existing calendar does (session
focus segments / active-idle chunk striping), plus **two new filters**: by
project, and by session.

Note on framing: I (the assistant) pointed out mid-conversation that there is
no actual dropdown/combo box in the side menu today — `Sidebar.tsx` is a flat
list of nav entries (`Dashboard`, `Projects`, `Kanban Board`, `Sessions`,
`Activity Feed`, `Analytics`, `Workflows`, `Claude Config`, `Run`,
`Settings`), each mapped 1:1 to a route in `App.tsx`. Sara's "combo board"
language should be read as "a new peer entry in that same list", not as a
literal combo/dropdown control that needs to be built.

## Exploratory groundwork already done this session (not yet approved)

Before this intake was invoked, I explored the existing focus-report/calendar
code and proposed a high-level direction. Sara has **not yet picked a path**
— she moved straight to `/team-intake` after hearing it. The team should
treat the below as candidate input, not a decision:

- **Existing pieces to reuse:**
  - `client/src/components/FocusCalendarView.tsx` — the swimlane renderer
    (lane assignment via `client/src/lib/calendarLanes.ts`, idle striping via
    `client/src/lib/idleStripes.ts`, hover popup, `SegmentEventsModal` for
    raw-event drill-down). Currently only ever mounted inside
    `FocusReportModal.tsx`, which is opened per-project from a report icon on
    a project card (`client/src/pages/Projects.tsx:601`,
    `client/src/pages/KanbanBoard.tsx:968`).
  - Nav/route pattern: `client/src/components/Sidebar.tsx` (`NAV_KEYS`
    array + i18n label in `client/src/i18n/locales/en/nav.json`) and a
    matching `<Route>` in `client/src/App.tsx` — no registry/plugin system,
    just these two literal lists kept in sync.
- **The gap:** the only existing API is project-scoped —
  `GET /api/projects/:id/focus-report` (`server/routes/projects.js:218-233`,
  built by `server/lib/focus-report.js`'s `buildProjectFocusReport`). It
  takes no query params (no session filter, no cross-project aggregation).
  There is no `project_id` column anywhere in `events`/`sessions`/
  `focus_inferences` — project scoping is always done by joining through
  `project_paths.cwd`.
- **Two directions I sketched, unevaluated:**
  1. *Quick*: new page fetches every project's existing per-project report
     and merges/filters client-side. Reuses everything as-is, zero backend
     change, but N+1 requests and filtering logic pushed into the client.
  2. *Proper*: add a new aggregate endpoint (e.g. `GET /api/focus-report`
     with optional `?project_id=`/`?session_id=`) generalizing
     `buildProjectFocusReport` to run over all sessions, with the filters
     applied server-side. One request, cleaner scoping, more backend work.
  I leaned toward the "proper" direction but did not get Sara's sign-off
  before she invoked this intake.

## Open questions for the team to actually resolve

- Quick vs. proper data-access path (above) — or a third option the team
  finds.
- Does this become a genuinely new page (own route, own header, filters at
  the top) or could/should it stay a modal-like overlay, just launched from
  the sidebar instead of a project card? Sara's wording ("new board") reads
  as a first-class page, but the team should confirm this reads right against
  product/UX conventions already in the app.
- Session filter UX: global list of all sessions (could be large/unwieldy) vs.
  scoped to whichever project is currently selected (probably the intended
  behavior, but not stated explicitly).
- Should "all project" be a valid filter state (aggregate calendar across
  every project) or must a project always be selected first?
- Whether the existing per-project modal entry point should be kept as-is
  once this standalone board exists, or eventually consolidated/superseded.

## Constraints / non-negotiables (from CLAUDE.md)
- Preserve existing behavior unless explicitly asked to change it; minimal,
  reversible diffs. API routes: preserve response shapes unless a change is
  requested and documented.
- Backend changes: `npm run test:server` before finishing. Frontend:
  `npm run test:client` (includes per-screen snapshot tests,
  `client/src/pages/__tests__/screens.snapshot.test.tsx` — review diffs, never
  blindly regenerate).
- Every source file needs the project's authorship header
  (`.claude/skills/file-headers/`).
- Docs (`README`, `ARCHITECTURE.md`, `docs/API.md`, server/client READMEs)
  must stay in sync with any new route/response shape/nav entry.
- No `PROJECT-CONTEXT.md` exists for this project — no defect-class catalog
  configured; PM memory falls back to
  `~/.claude/skills/team-intake/memory/`.
