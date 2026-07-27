# Change Brief — focus-calendar-board

> Authored by `qa-triage`. The single normalized statement of *what we just
> changed*, before any coverage evaluation.

- **Date:** 2026-07-26
- **Scope source:** intake-handoff (no code written yet — this brief describes
  a finalized, build-ready technical plan, checked line-by-line against the
  actual current codebase for buildability)
- **Intake link:** `intake/2026-07-26-focus-calendar-board/` — `technical-plan.md`
  (final revision, all 6 decisions folded in), `decisions.md` (DEC-1..DEC-6,
  all DECIDED), `pm-plan.md` (classification: `new-feature`, recurrence
  diagnosis re: rendering-chrome duplication risk)

## Change summary
Add a new top-level "Calendar" page (`/focus-calendar`) that renders the
existing focus-time swimlane calendar across every monitored project at once,
filterable by three independent controls (project, global session, and a
day/range time-period picker defaulting to "today"), powered by a new
`GET /api/focus-report` endpoint that reuses the existing report-computation
functions unchanged. The existing per-project `FocusReportModal` is left
functionally untouched but has its rendering chrome extracted into a shared
component so both entry points consume one implementation.

## Verification against actual code (confirmed, not assumed)
I read the following and confirmed the plan's every specific citation
(function names, line numbers, existing i18n keys, existing test line
numbers, existing fetch patterns) against the real files — all matched:

- `client/src/components/FocusReportModal.tsx` (490 lines) — `ReportBody`,
  `ListView`, `StatTile`, `SegmentedBar`, `kindTotalsAsSegments`, `ALL_KINDS`,
  `ViewMode` type, and the inline List/Calendar toggle JSX (lines 113-147) all
  exist exactly as F1/F3 describe. `api.projects.focusReport(projectId)` call
  at line 71-72 confirmed.
- `client/src/components/FocusCalendarView.tsx` (518 lines) — module-private
  `DAY_MS` (line 65) and `startOfDay` (lines 99-101) confirmed exactly where
  F5a says to extract them from; uncontrolled `selectedDate` state (line 152)
  confirmed; day-nav reuses `report.calendar.prevDay/today/nextDay` i18n keys
  (lines 244/258/263) confirmed — F5b's "no new keys needed" claim holds.
- `server/lib/focus-report.js` (446 lines) — exports `buildFocusSegments`,
  `buildSessionFocusReport`, `buildProjectFocusReport`, `buildActivityChunks`,
  `mergeIntervals`, `emptyKindTotals`, `DEFAULT_GRACE_SECONDS`, `CHUNK_MS` —
  matches B1/B3's "consumed as-is" claim.
- `server/routes/projects.js` (237 lines) — `GET /:id/focus-report` (line
  218), its cwd-resolution via `stmts.listProjectPaths`, and the ~6-line raw
  `SELECT ... FROM sessions WHERE cwd IN (...) ORDER BY started_at ASC`
  fragment (line 230, cited by B1) confirmed — this is the one duplicated
  fragment the plan explicitly declines to extract into a shared helper (§2).
- `server/index.js` — router mounts confirmed: `/api/projects` at line 100,
  `/api/focus` (the unrelated `plansRouter.focusRouter`) at line 102, matching
  B2/§2's citation exactly. `server/routes/plans.js` lines 84-88 confirmed as
  the bulk-focus-hydrate router the plan says not to reuse/confuse with.
- `client/src/lib/types.ts` — `FocusReport.project_id: string` at line 1620,
  no `session_id` field present — matches F4's widening claim exactly (a
  real, needed change, not a no-op).
- `client/src/lib/api.ts` — `api.projects.focusReport` doc-comment style at
  line ~1958; `applyScope(qs)` pattern at `sessions.list` line 648, cited
  exactly by F4.
- `client/src/components/Sidebar.tsx` — `NAV_KEYS` array (line 96) has
  `projects` (line 98) immediately followed by `agentBoard`/Kanban (line 99)
  — confirms F6's insertion point ("right after Projects, before Kanban
  Board") is real and adjacent today.
- `client/src/App.tsx` — `<Route path="projects">` (line 109) immediately
  followed by `<Route path="kanban">` (line 110) — confirms F7's insertion
  point.
- `client/src/i18n/locales/{en,zh,vi,ko}/nav.json` — no `focusCalendar` key
  in any of the four files today (confirmed by direct read) — F8-F11 are
  genuinely additive, not already partially done.
- `client/src/i18n/locales/en/plan.json` — `report.loading`/`report.error`/
  `report.empty`/`report.viewList`/`report.viewCalendar`/
  `report.calendar.{prevDay,today,nextDay,empty}` all already exist — F5/F5b's
  "reused, no new keys needed for these" claims hold exactly.
- `client/src/components/__tests__/FocusReportModal.test.tsx` (594 lines) —
  the `"[standing template] List and Calendar views render..."` test exists
  at line 517 (plan cites "line-518" — a one-line rounding, immaterial).
- `client/src/i18n/__tests__/i18n.test.ts` — `LOCALES` array at line 15
  exactly as F5/T6 cite.
- `client/src/pages/__tests__/screens.snapshot.test.tsx` (549 lines) — exactly
  12 existing `it(...)` screen cases (Dashboard through Not found) — confirms
  T4's "13th case" framing.
- `client/src/pages/Projects.tsx:601` and `client/src/pages/KanbanBoard.tsx:968`
  — both render `<FocusReportModal projectId={...} projectName={...}
  onClose={...} />` exactly as the plan's two cited trigger points describe.
- The "fetch effectively-all-at-once" pattern F5 cites
  (`api.sessions.list({ limit: 10000 })`) is real and already used at
  `Projects.tsx:125`, `KanbanBoard.tsx:299`, and `ActivityFeed.tsx:211` — the
  plan's precedent for the new page's global session fetch is accurate.
- `server/lib/source-filter.js` exports `parseSources`, `sourceColumnClause`,
  `sessionIdInSourcesClause` — matches §5's cross-cutting-filter convention
  claim.

No discrepancy found between the plan's description of the current codebase
and the actual code. The plan is buildable as written against what's really
there.

## Changed files (by layer)
No files are changed yet — the working tree's only relevant new content is
the `intake/` folder itself (untracked); everything below is **planned**,
not yet built. (Unrelated uncommitted changes exist elsewhere in the working
tree — `ARCHITECTURE.md`, several README/docs files, `StatusBadge.tsx`,
`SessionDetail.tsx`, `server/routes/hooks.js`, `server/openapi.js`, locale
`common.json` files, wiki assets, two `server/__tests__` files — none of
these touch this feature area and none are attributed to this request in the
intake docs; flagged as a non-blocking note below.)

**Backend (planned)**
- `server/routes/focus-report.js` (new) — `GET /` handler: resolves
  `project_id`/`session_id`/`sources`, **requires** `from`/`to` (400 if
  missing/malformed), applies `source-filter.js`, calls unmodified
  `buildProjectFocusReport`.
- `server/index.js` — mount `/api/focus-report`, distinct from `/api/focus`
  and `/api/projects`.
- `server/lib/focus-report.js` — **no changes** (consumed as-is).
- `client/src/lib/types.ts` — widen `FocusReport.project_id` to
  `string | null`, add `session_id: string | null`.
- `docs/API.md` — new `GET /api/focus-report` section.
- `server/__tests__/focus-report-route.test.js` (new) — route tests.

**Frontend — shared chrome/extraction (planned)**
- `client/src/components/FocusReportBody.tsx` (new) — extracted
  `ReportBody`→`FocusReportBody`, `ListView`, `StatTile`, `SegmentedBar`,
  `kindTotalsAsSegments`, `ALL_KINDS`, `ViewMode`, plus new
  `FocusReportViewToggle`. New optional `projectLabelForCwd` prop.
- `client/src/components/FocusCalendarView.tsx` — additive-only: optional
  `projectLabelForCwd`, `selectedDate`, `hideDateNav` props; all default to
  today's uncontrolled/nav-visible behavior (modal unaffected).
- `client/src/components/FocusReportModal.tsx` — remove moved definitions,
  import from `FocusReportBody.tsx`; no other behavior change.
- `client/src/lib/calendarWindow.ts` (new) — relocate `DAY_MS`/`startOfDay`
  out of `FocusCalendarView.tsx` (pure move).

**Frontend — new controls/page/routing (planned)**
- `client/src/components/TimePeriodPicker.tsx` (new) — day-nav + custom
  range control, pure/controlled.
- `client/src/lib/api.ts` — new `api.focusReport({ projectId, sessionId,
  from, to })`, `from`/`to` required.
- `client/src/pages/FocusCalendarBoard.tsx` (new) — the page itself: three
  independent filters, defaults to today/all-projects/no-session.
- `client/src/components/Sidebar.tsx` — new nav entry "Calendar" after
  "Projects."
- `client/src/App.tsx` — new route `focus-calendar` after `projects`.
- `client/src/i18n/locales/{en,zh,vi,ko}/nav.json` — new `focusCalendar` key
  (all four, same commit).
- `client/src/i18n/locales/{en,zh,vi,ko}/plan.json` — new `report.board.*`
  keys (all four).

**Tests (planned)**
- `server/__tests__/focus-report-route.test.js` (new)
- `client/src/components/__tests__/FocusReportModal.test.tsx` (extend, one
  new `it` after the existing standing-template test at line 517)
- `client/src/pages/__tests__/FocusCalendarBoard.test.tsx` (new)
- `client/src/pages/__tests__/screens.snapshot.test.tsx` (13th case added)
- `client/src/components/__tests__/Sidebar.test.tsx` (extend)
- `client/src/i18n/__tests__/i18n.test.ts` (extend, registry-driven)
- `client/src/components/__tests__/TimePeriodPicker.test.tsx` (new)

**Database / migration**
- None.

**Config / other**
- None beyond the docs/i18n files listed above.

## Surfaces / features touched
- New page: **Focus Calendar Board** (`/focus-calendar`, sidebar label
  "Calendar"), a cross-project aggregate view of the focus-time swimlane
  calendar.
- New endpoint: **`GET /api/focus-report`** (project/session/sources/from/to
  filtering).
- Shared rendering chrome: **`FocusReportBody`/`FocusReportViewToggle`**,
  now consumed by both `FocusReportModal` (existing, per-project) and
  `FocusCalendarBoard` (new, cross-project).
- **`FocusCalendarView`** (the swimlane renderer itself) — additive props
  only; both the existing modal and the new board consume it.
- Existing, explicitly untouched: `server/routes/projects.js`'s
  `GET /api/projects/:id/focus-report` route (including its pre-existing,
  known `?sources=`-ignoring gap — deliberately not fixed here), and both
  existing `FocusReportModal` trigger points (`Projects.tsx:601`,
  `KanbanBoard.tsx:968`).

## Variant relevance
Yes — this is precisely this project's #1 recurring bug class, and the PM's
own `pm-plan.md` names it explicitly: **"one rendering surface, multiple
consumers, no shared source of truth."** This morning's `6e29722` fixed
exactly this shape reactively (List view silently diverging from Calendar
view). This request creates a **third consumer** of the same
`FocusCalendarView`/report-chrome rendering surface (modal's List tab,
modal's Calendar tab, and now the standalone board), and a **second
computation path** for the same report data (old per-project route, new
aggregate route). The plan's own guardrails (§5) and its test plan (T1's
deep-equal check between the two routes' `?project_id=` output; T2's
extension of the existing cross-view standing-template test to also cover
the board-shaped render) are the direct countermeasures QA should verify
were actually built and actually assert equivalence — not just "a test
exists," but that it fails if the shapes diverge.

## Test-invariants at risk
- [ ] **Cross-path consistency (old vs. new endpoint)** — `?project_id=`
  filtered output of the new `GET /api/focus-report` must be deep-equal to
  `GET /api/projects/:id/focus-report`'s own output for the same fixture
  (sessions/items/totals). This is the direct regression class this
  project's own history (`6e29722`, same day) was created to prevent. Test
  coverage claimed: T1.
- [ ] **Cross-consumer rendering consistency (modal vs. board)** —
  `FocusReportBody`/`FocusCalendarView` must render byte/geometry-identical
  output for the modal's props shape vs. the board's props shape (same
  underlying data), and the board's `hideDateNav` must actually suppress the
  modal's own day-nav (avoiding a double day-nav UI, flagged as its own risk
  in §7 of the plan). Test coverage claimed: T2 (extended standing template).
- [ ] **Modal non-regression** — `FocusReportModal.tsx`/`FocusCalendarView.tsx`
  extractions (F1-F3, F5a) must be pure moves with zero behavior change;
  existing unmodified test suites must pass without edits. Test coverage
  claimed: existing `FocusReportModal.test.tsx`/`FocusCalendarView.test.tsx`
  suites, run unmodified per step 1 of §4.
- [ ] **Filter independence** — project, session, and time-period filters
  must never clear or reset one another (this is a corrected requirement —
  the *original* draft had project-change clearing session, which Sara
  explicitly rejected via DEC-2). A regression back to the old
  clear-on-change behavior would be a silent, easy-to-reintroduce mistake.
  Test coverage claimed: T3(d),(f),(h).
- [ ] **No hidden/implicit time bound** — the new endpoint must 400 on
  missing/malformed `from`/`to`, never silently apply an unbounded or
  hidden-default query (this directly replaces the original draft's rejected
  env-knob mechanism, DEC-3). Test coverage claimed: T1.
- [ ] **Locale completeness (4-locale nav.json trap)** — new `nav:focusCalendar`
  key must land in all four locale files in the same change-set, with the
  *correct*, shorter label ("Calendar," not "Focus Calendar") — the PM/plan
  both flag this as the single most likely partial-ship mistake. Test
  coverage claimed: T6 (registry-driven), plus a manual label-text
  double-check called out explicitly in §7 (a completeness test alone
  wouldn't catch "wrong label," only "missing").
- [ ] **`sources` (Remote Data Sources) scoping applied on the new route
  only, not retrofitted onto the old one** — a scope-creep risk in the
  opposite direction (accidentally "fixing" the old route's pre-existing gap
  as an unrequested side effect). Test coverage claimed: T1's `?sources=`
  case, plus the DoD checklist's explicit "confirmed, not accidentally
  fixed" item.
- [ ] **Snapshot byte-identity for existing pages** — `Projects` and
  `KanbanBoard` screen snapshots must be byte-identical pre/post-change,
  proving the shared-chrome extraction didn't leak into the existing entry
  points. Test coverage claimed: T4.

## Stated intent / acceptance
From `technical-plan.md` §9 (Definition of Done) — the plan's own explicit
acceptance checklist, condensed:
- `GET /api/focus-report` exists, requires `from`/`to`, 400s on
  missing/malformed, applies `source-filter.js`.
- `server/routes/projects.js` byte-unmodified.
- `FocusReportBody.tsx` is the single chrome implementation; neither
  consumer copy-pastes its JSX.
- `FocusCalendarView.tsx`'s only changes are the three additive props;
  existing modal usage is pixel-identical to before.
- Board's three filters are genuinely independent; session dropdown is
  always the full global list.
- Board defaults to today/all-projects/no-session on first load.
- New nav entry labeled "Calendar," positioned right after "Projects"; all
  four locale files updated together.
- T1-T7 added and passing; named existing regression suites pass unmodified.
- `npm run test:server`/`npm run test:client` both pass clean;
  `screens.snapshot.test.tsx` shows exactly one new case, two byte-identical
  baselines.
- File-header audit script exits 0.
- `docs/API.md` updated in the same change-set.
- Old route's `?sources=` gap confirmed *not* touched.
- `concurrency_ratio`/`wall_clock_ms` carry DEC-6's relabeled copy on the
  board view.

## Open questions

**Blocking (cannot plan tests):**
- None. The plan is fully decided (all 6 decision points DECIDED, no PENDING
  items), internally consistent, and verified buildable against the actual
  current codebase — every specific file/line/function citation checked out.

**Non-blocking (proceeding on assumption):**
- No code exists yet for this feature → assumption: this brief describes the
  *planned* change set for the purposes of upstream test-plan design; a
  follow-up git-diff-based confirmation pass should re-run once the feature
  is actually implemented, to catch any drift between what was planned here
  and what was actually built (the standard "plan vs. diff disagree, say so"
  case this role exists for — there is no diff yet to disagree with).
- The exact final UI copy for DEC-6's relabeled concurrency-tile string on
  the aggregate view is given only as an example ("e.g. 'Concurrent agent
  sessions'") in the plan, not a locked-in literal across all four locales →
  assumption: QA should verify *some* relabeled, board-specific string
  renders (distinct from the per-project modal's copy), not match on exact
  wording, unless Sara locks specific copy before build.
- The unrelated uncommitted working-tree changes (docs files, `StatusBadge.tsx`,
  `SessionDetail.tsx`, `server/routes/hooks.js`, `server/openapi.js`, locale
  `common.json` files, wiki assets, `server/__tests__/api.test.js`,
  `server/__tests__/awaiting-subagent-guard.test.js`) are not mentioned
  anywhere in this intake's plan/decisions/PM docs → assumption: they belong
  to a separate, already-in-progress change and are out of scope for this
  brief; flagged so a later QA pass doesn't accidentally attribute them to
  this feature or, conversely, silently exclude them from some other review
  that should cover them.

## Verdict
**READY**
