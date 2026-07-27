# Manual click-path verification — focus-calendar-board

Performed by the orchestrator (not a subagent) per test-plan.md's DoD item
that names this as the one proof no automated test can supply, and per
CLAUDE.md's testing policy for UI changes ("start the dev server and use the
feature in a browser before reporting the task as complete").

**Environment:** effort worktree's own dev server
(`/Users/sara/CODE-LOCAL/SARA/efforts/2026-07-26-focus-calendar-board/Claude-Code-Agent-Monitor`),
backend on `:4820`, client on `:5174` (auto-selected since `:5173` was busy
with the main checkout's dev server — no port collision, no shared state
mutated beyond read-only queries against the real dashboard DB).

## Checks performed

1. **Nav entry position/label** — "Calendar" appears in the sidebar directly
   after "Projects" and before "Kanban Board". Matches DEC-5 exactly.
2. **Route** — clicking it resolves to `/focus-calendar`. Matches plan.
3. **List view (default)** — renders with real data: stat tiles (Active
   time, **Concurrent agent sessions** — DEC-6's relabeled copy, confirmed
   live — On declared item, Off-plan, Idle excluded), per-session breakdown
   bars with idle striping, Project/Session filters, Today/Custom range
   controls.
4. **Calendar view (toggle)** — swimlane renders correctly across many
   concurrent sessions/projects with lane assignment and idle striping.
5. **Project filter** — selecting "Claude Code Agent Monitor" correctly
   narrows both List and Calendar views' data and re-derives all stats.
6. **Filter independence (DEC-2)** — with a project selected, the session
   dropdown was re-inspected via the accessibility tree: it still lists the
   **full global session set** across every project (not narrowed to the
   selected project), and selecting a project did not reset/clear the
   session selection. Confirms DEC-2 as actually built, not just tested in
   isolation.
7. **Custom range** — switching to a 7-day range (`07/20`–`07/26`) correctly
   widens the List view's aggregate stats and per-session rows to include
   sessions outside "today." Switching back to "Single day" restores
   day-nav (prev/Today/next) and the project filter selection persisted
   across the mode switch.
8. **Locale check** — switched to Chinese (中文): sidebar shows "日历", page
   title "焦点日历", filters/labels all translated, no raw i18n keys or
   English fallback strings visible. Switched back to English cleanly.

## Finding: Calendar view has no in-range day navigation during a custom range

Not a crash, not a data-correctness bug, and not covered by any test's
stated scope (test-plan.md focused Calendar-view assertions on the
day/single-day path) — but worth Sara's attention before this ships:

When "Custom range" is active, `FocusCalendarBoard.tsx` pins the Calendar
view's rendered day to `timeWindow.start` (the range's first day) with
`hideDateNav={true}` — so there is no way to page through the other days in
the selected range from the Calendar view. If the range's first day happens
to have no activity, the Calendar view shows "No activity on this day" with
no visible path to see the range's other days, even though the List view
(same filters, same range) correctly shows all of them. A user would need to
switch to List view, or narrow back to "Single day" and step through
manually, to see calendar-view data for anything other than the range's
first day.

This wasn't explicitly specced in technical-plan.md (which focused on the
day-nav + custom-range control existing at all, not on Calendar view's
per-day behavior within a multi-day range) — a reasonable gap for a v1, not
a regression of anything promised. Flagging as a follow-up candidate rather
than fixing unilaterally, since it's outside this build's approved scope.

## Verdict

Manual click-path: **PASS**, with the one UX gap above noted for Sara's
awareness (non-blocking, out of this build's approved scope).
