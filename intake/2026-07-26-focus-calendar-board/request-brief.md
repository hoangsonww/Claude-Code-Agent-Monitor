# Request Brief: Project-wide Focus Calendar Board

## Source
- File: `/Users/sara/CODE-LOCAL/SARA/Claude-Code-Agent-Monitor/intake/2026-07-26-focus-calendar-board/request-source.md`
- `supporting/` subfolder exists but is empty — no additional attachments.

## Requester / source
Sara, same-session verbal request (not an external ticket), captured 2026-07-26. The source doc also carries exploratory groundwork from the assistant earlier in the same conversation, done before Sara invoked intake — explicitly **not yet approved** by her.

## Raw ask (verbatim)
> "I want to add a new view so just like how we have In our side menu, we have dashboards and projects in the combo board. What I wanna do is what we look at for the focus report for that calendar. I want a new report a new board that is the calendar board and it would show the calendar and it would include all of the age activities in the same way that we do it and show the calendar in the focus report and then we probably want a filte that would allow us to select which project or another filter they would allow us to pick which session that we're reviewing at, but yeah, let's tell me at a high-level. How would you go about that"

(Transcribed speech — "age activities" almost certainly means "agent activities"; "filte" = "filter"; "combo board" is Sara's loose description of the sidebar nav list, not a literal dropdown — see note below.)

## Restated ask
Add a new top-level sidebar destination — a peer of the existing `Dashboard` / `Projects` / `Kanban Board` entries — that renders the same focus-report calendar/swimlane view used today (per-project, inside a modal), but as its own standalone page showing agent activity across all projects, with filters to narrow by project and by session.

## Surface / area touched
- `client/src/components/Sidebar.tsx` (`NAV_KEYS` list) + `client/src/App.tsx` (route table) — new nav entry/route.
- `client/src/components/FocusCalendarView.tsx` (swimlane renderer, reused/relocated) and its helpers `client/src/lib/calendarLanes.ts`, `client/src/lib/idleStripes.ts`.
- Currently the only mount point is `client/src/components/FocusReportModal.tsx`, opened per-project from `client/src/pages/Projects.tsx:601` and `client/src/pages/KanbanBoard.tsx:968`.
- Backend: `server/routes/projects.js:218-233` (`GET /api/projects/:id/focus-report`) and `server/lib/focus-report.js` (`buildProjectFocusReport`) — currently project-scoped only, no session filter, no cross-project aggregation, no `project_id` column on `events`/`sessions`/`focus_inferences` (scoping is done via `project_paths.cwd` join).

## Known-variant relevance
No `PROJECT-CONTEXT.md` is configured for this project, so there is no formal recurring-defect-class catalog to check against. That said, this request itself is about to create the exact shape of risk that catalog would normally flag: the same calendar/swimlane content (`FocusCalendarView`, lane assignment, idle striping, hover popup, `SegmentEventsModal` drill-down) would now be rendered via **two different entry paths** — the existing per-project modal and the new standalone page — potentially with different data-fetching (single-project vs. aggregate/filtered). QA should treat "does the calendar look and behave identically in both places for the same project/session" as a first-class check, and the eventual PROJECT-CONTEXT.md (if one gets written) is a reasonable place to record this as a named surface going forward.

## Provisional request type
`new-feature` (PROVISIONAL — PM makes final call). This is net-new UI/API surface, not a fix to existing broken behavior.

## Explicit acceptance signals
None stated. Sara asked for a high-level approach/plan, not a specific "done when" condition. Acceptance criteria will need to be defined by the team as part of planning, not assumed from this ask.

## Attachments / evidence
None. No screenshots, mockups, or example data were provided. The only evidence is the assistant's own prior code exploration (summarized above and in the source doc), which is candidate input, not verified requirements.

## Ambiguity hunt

### BLOCKING
None identified. The core ask — new sidebar nav entry surfacing an all-agent-activity focus calendar, filterable by project and by session — is clear enough for a product owner/architect/engineer/QA pass to produce a real plan. Nothing below prevents that evaluation from starting.

### Non-blocking (judgment calls for the evaluation team to resolve and present back to Sara before implementation)
These are exactly the kind of decisions the product owner and architect are expected to weigh in on as part of the PM/tech-lead plan — not gaps that stop evaluation:

1. **Data-access path — "quick" (client-side merge of N per-project reports) vs. "proper" (new aggregate `GET /api/focus-report` endpoint with `?project_id=`/`?session_id=`) vs. a third option.** This is squarely an architect call; recommend the architect pick a direction and justify it in the plan (note: CLAUDE.md's "preserve existing behavior" / "minimal diffs" bias, plus the N+1 downside of the quick path, likely favors "proper," but that's the architect's call to make and document, not intake's).
2. **Standalone page vs. modal-style overlay launched from the sidebar.** Sara's own words ("a new report a new board," explicitly analogized to `Dashboard`/`Projects` sidebar entries) lean toward a first-class page with its own route — this reads as largely resolved by her phrasing already, but the team should state that assumption explicitly and confirm it against existing product/UX conventions rather than silently building a modal.
3. **Session-filter scoping — global list of all sessions vs. scoped to whichever project is currently selected.** Assume scoped-to-selected-project as the sane default (avoids an unwieldy global session list); state this assumption in the plan for confirmation.
4. **Whether "all projects" is a valid filter state (aggregate view with no project selected) vs. a project must always be chosen first.** Sara's wording — "it would include all of the [agent] activities in the same way that we do it... and then we probably want a filter" — reads as: the default/unfiltered view already shows everything, and project/session filters are for narrowing down from there. Recommend the team adopt "all projects is the default state" as the working assumption and confirm rather than treat as unresolved.
5. **Fate of the existing per-project modal (`FocusReportModal.tsx`) once the standalone board exists** — keep as-is, deprecate, or consolidate. Per CLAUDE.md's "preserve existing behavior unless explicitly asked to change it," default assumption should be: leave the existing modal entry point untouched for now; consolidation is a separate, future decision Sara has not asked for.

## Constraints carried forward (from CLAUDE.md, applies to whoever implements)
- Preserve existing behavior/response shapes unless a change is explicitly requested and documented; minimal, reversible diffs.
- Backend changes require `npm run test:server`; frontend changes require `npm run test:client` (including screen snapshot tests — review diffs, never blind-regenerate).
- Every new/edited source file needs the project authorship header (`.claude/skills/file-headers/`).
- Docs (`README`, `ARCHITECTURE.md`, `docs/API.md`, relevant READMEs) must be updated in the same change-set if a new route, response shape, or nav entry is added.
