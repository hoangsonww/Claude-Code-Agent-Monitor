# Run Plan — team-qa (direct mode) — focus-calendar-board

## 1. Scope read

This is not a small change. It adds a new backend endpoint (`GET
/api/focus-report`, a second computation path for report data alongside the
existing `GET /api/projects/:id/focus-report`), a brand-new frontend page
(`FocusCalendarBoard`) with three independently-combinable filter controls
(project/global-session/time-period) wired to nav+routing+four locale files,
and — critically — a shared-chrome extraction (`FocusReportBody.tsx`,
`FocusCalendarView.tsx` additive props) that turns an existing, already
fragile two-consumer rendering surface into a three-consumer one. The
change-brief is explicit that this is the same "one rendering surface,
multiple consumers, no shared source of truth" defect shape this project's
own history (`6e29722`, committed *this same morning*) had to fix reactively
— now compounded by a second computation path on top of a third rendering
consumer. Blast radius spans server routing, a cross-cutting scoping
convention (`source-filter.js`), two existing widely-used components
(`FocusReportModal`, `FocusCalendarView`) that must remain byte/pixel
identical for their two existing callers, i18n completeness across four
locales, and a public new page. No auth/security surface, no migration — but
the rendering-parity and cross-path-consistency risks are real, named, and
directly tied to a defect class this project has already paid for once
today.

## 2. Agents to run

1. **qa-coverage-cartographer** — must map existing coverage first: the
   plan's own Definition of Done leans on several *existing, unmodified*
   suites (`FocusReportModal.test.tsx`, `FocusCalendarView.test.tsx`,
   `focus-report.test.js`, `projects.test.js`, `calendarLanes.test.ts`,
   `Sidebar.test.tsx`, `i18n.test.ts`, `screens.snapshot.test.tsx`) staying
   green and byte-identical through an extraction refactor. Establishing the
   green/red baseline on these specific files before any build starts is the
   only way a later QA pass can tell "extraction leaked" from "was already
   broken." Runs first, no dependency on the others.
2. **qa-risk-analyst** — this is precisely the case this agent exists for:
   the change-brief and technical-plan both independently name the exact
   recurring defect class (rendering-chrome duplication, now joined by a
   second computation path), cite the same-day prior incident (`6e29722`) as
   direct precedent, and flag several "ships-green-but-broken" traps by name
   (double day-nav if `hideDateNav` is forgotten, silent cross-path
   divergence, a 4-locale nav-key miss, filter-independence regressing back
   to a clear-on-change pattern Sara explicitly rejected). A defect-pattern
   match this explicit forces this agent on regardless of file count.
3. **qa-unit-architect** — designs the parity-shaped unit/component tests
   this change specifically needs: T2's cross-consumer rendering-identity
   check (modal-shaped vs. board-shaped `FocusReportBody`/`FocusCalendarView`
   props producing identical block geometry), T7's `TimePeriodPicker` unit
   tests, and the "pure move, zero behavior change" assertions for F1-F3/F5a.
   These are exactly the assertion-design problems this role is built for,
   and they're the most defect-class-relevant tests in the whole plan.
4. **qa-e2e-architect** — designs the new-surface tests: T1's route-level
   tests for the brand-new `GET /api/focus-report` endpoint (400 handling,
   `?sources=` scoping, the deep-equal cross-path consistency check against
   the old route), T3's page-level filter/edge-case tests for the new
   `FocusCalendarBoard` page, and T4's snapshot extension. A genuinely new
   API endpoint and a genuinely new page are never a skip for this role.
5. **qa-strategist** — mandatory lead/synth; produces the coverage
   verdict, test-debt diagnosis, and memory entry.
6. **qa-lead** — mandatory lead/synth; synthesizes coverage + risk + unit +
   e2e into the one buildable test plan downstream skills read.

## 3. Agents skipped

None. Every evaluator candidate is warranted for this change (see below,
Forced back on).

## 4. Forced back on

All four evaluator candidates (`qa-coverage-cartographer`,
`qa-risk-analyst`, `qa-unit-architect`, `qa-e2e-architect`) were kept, so
strictly speaking nothing needed to be "forced back on" after being cut —
but the reasoning that would have forced them back on if I'd leaned toward
trimming any of them: this project has no formal `PROJECT-CONTEXT.md`
defect-class catalog, but the change-brief's own "Variant relevance" section
functions as an equivalent, project-sourced defect-catalog match — it names
the exact recurring pattern, cites the same-day prior fix commit
(`6e29722`) as direct precedent, and flags a *new* second computation path
compounding the risk. That is precisely the signal this role's own
instructions say overrides a leaner call. Additionally, this change exposes
a genuinely new API surface (`GET /api/focus-report`) and a genuinely new
page — both explicitly never QA-skippable regardless of size. Full roster
runs.
