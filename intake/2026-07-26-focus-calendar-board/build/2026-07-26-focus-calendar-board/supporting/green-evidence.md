# Verification Report — focus-calendar-board

Prepared by: Verifier
Worktree: `/Users/sara/CODE-LOCAL/SARA/efforts/2026-07-26-focus-calendar-board/Claude-Code-Agent-Monitor`
Branch: `effort/2026-07-26-focus-calendar-board`
Base commit: `0ef79b378e0de180155bc5549643760230d9dc2a`
Docker stack: not applicable (confirmed by build-brief.md — no compose stack in this effort's verification loop; skipped, not defaulted-past).

## 1. Full suite results (run from the worktree)

- `npm run test:server` → **934/934 pass, 0 fail** (206 suites).
- `npm run test:client` → **471/471 pass, 0 fail** (39 test files, 0 failed).
- `node --test server/__tests__/focus-report-route.test.js server/__tests__/projects.test.js server/__tests__/focus-report.test.js` → **68/68 pass** (21 in the new route file, 47 in the two regression companions).
- `cd client && npx tsc --noEmit` → **clean, exit 0**.
- `bash .claude/skills/file-headers/scripts/check-headers.sh` → **"All applicable files carry the authorship header." exit 0**.

## 2. Red→green per new/extended test file (vs. `supporting/red-evidence.md`)

| File | Red evidence (before) | Now | Verdict |
|---|---|---|---|
| `server/__tests__/focus-report-route.test.js` | 21 cases, 0/21 pass (route unmounted, 404s) | 21/21 pass, same case names (400s, scoping, `?sources=`, split-parity groups a/b, empty-shape, no from/to echo) | RED→GREEN confirmed |
| `client/src/components/__tests__/FocusReportModal.test.tsx` | Suite failed to load (0/23 — import of `FocusReportBody` unresolved); red-evidence's stated "22 pre-existing" count is actually a documentation slip (base commit `0ef79b3` has 18 `it(...)` blocks, not 22 — confirmed via `git show 0ef79b3:...`) | 19/19 pass (18 pre-existing, byte-unmodified per `git diff`, + 1 new `[board-mode extension...]` test) | RED→GREEN confirmed; see §3 below for the fixture-fix legitimacy check. Minor non-blocking note: red-evidence's test count for this file was miscounted (23/22 vs. actual 19/18) — cosmetic, does not affect the substance of the red→green proof, which the diff independently confirms (only an import line + one new `it` block appended; zero other lines touched). |
| `client/src/components/__tests__/FocusCalendarView.test.tsx` | 18 tests, 15 pass/3 fail (new `board-mode additive props` block: 3 genuinely red, 2 documented-vacuous forward guards) | 18/18 pass, all 13 pre-existing + all 5 new (including the 3 that were genuinely red) | RED→GREEN confirmed |
| `client/src/components/__tests__/TimePeriodPicker.test.tsx` (new) | Suite failed to load (module doesn't exist) | 6/6 pass | RED→GREEN confirmed |
| `client/src/i18n/__tests__/i18n.test.ts` | 25 tests, 15 pass/10 fail (`nav:focusCalendar` + `report.board.concurrentSessions` registry blocks, all 4 locales each) | 25/25 pass | RED→GREEN confirmed |
| `client/src/components/__tests__/Sidebar.test.tsx` | 12 tests, 9 pass/3 fail (Calendar label, href, position) | 12/12 pass | RED→GREEN confirmed |
| `client/src/pages/__tests__/FocusCalendarBoard.test.tsx` (new) | Suite failed to load (module doesn't exist) | 9/9 pass, including both DEC-2 rendered-`<select>`-value independence tests | RED→GREEN confirmed |
| `client/src/pages/__tests__/screens.snapshot.test.tsx` | Suite failed to load (13 tests, 0 run — cascaded from the new page's import) | 13/13 pass | RED→GREEN confirmed; snapshot-diff purity checked separately, §5 |

Full client suite: red evidence's stated baseline was 424 tests (408 pass/16 fail) across 39 files (32 pass/7 fail-to-load). Current: 471/471 pass across the same 39 files — the net +47 lines up with the new/extended test counts above (21 server tests are separate/server-side, not counted in the client figure).

## 3. Fixture-fix legitimacy check (item 2 of the brief)

`time-log.jsonl` records a "Test Author (fixture fix)" phase: *"Fix FocusReportModal.test.tsx fixture bug (totals not overridden alongside sessions)."* Compared the current file's new `it(...)` block against the target described in `test-plan.md` (§ Test change set, "extend `FocusReportModal.test.tsx`...") and `build-task-list.md` (task 8):

- **Assertions match the plan's spec exactly**: modal-shaped render — one prev/today/next control set (`getByTitle("Previous day")`/`"Next day"`/`getByText("Today")`), no project label (`queryByText("Acme Corp")` absent); board-shaped render — zero day-nav controls (`queryByTitle`/`queryByText` all absent), project label present; non-relabeled stat-tile text identical (`boardActiveValue === modalActiveValue`, both read from rendered `/10m 0s/` text, not a hardcoded literal); idle-stripe geometry identical (`top`/`height`, `toBeCloseTo`) — consistent with this file's own established Calendar-view idle-stripe convention (the existing "[standing template]" test three tests above it uses the same `top`/`height` pair for its own Calendar-view half; `left`/`width` is that same template's List-view pair). No assertion was weakened, removed, or made vacuous.
- **What the "fixture fix" actually touched**: the test's `makeReport({...})` override supplies `sessions` (a single 20m-wall/10m-active/10m-idle segment) *and* a matching `totals`/`wall_clock_ms` override. Without the latter, the fixture's `totals` would fall back to `makeReport`'s module-level default (a 30m-wall/20m-active session unrelated to the overridden segment), which would make the `getByText(/10m 0s/)` assertion in both the modal- and board-shaped renders fail to find matching text — not because the component was broken, but because the fixture's own `sessions` and `totals` disagreed (the "Active time" stat tile reads `report.totals.active_ms` verbatim, never re-derived from segments, exactly per this project's own architecture). Adding the matching `totals` override is a fixture-internal-consistency fix, not a change to any assertion's expected value or a weakening of what's being checked.
- **Verdict: legitimate.** This was a self-consistency bug in the test's own input fixture (segments and totals disagreeing), not a softened assertion. The assertion text is unchanged and matches both plans' specified checks.

## 4. Byte-unmodified check (item 3 of the brief)

`git diff --stat 0ef79b378e0de180155bc5549643760230d9dc2a -- server/lib/focus-report.js server/routes/projects.js` → **empty output** (zero changes to either file). Confirmed independently, not taken on faith. This also confirms the `MANDATORY [DERIVED-DUAL-VIEW]` cure at build-task-list task 4 and the technical-plan §9 DoD line "one computation path" were actually honored, and that the old route's `?sources=`-ignoring gap was left alone (also independently exercised and confirmed still-present by the new route test's explicit side-by-side case).

## 5. 4-locale i18n atomicity (item 4)

All four locales' `nav.json` **and** `plan.json` were touched, each with the exact same shape:
- `nav.json`: `+"focusCalendar": "<Calendar/日历/Lịch/달력>"` inserted in the same position (after `"projects"`) in all four files.
- `plan.json`: `+12` lines each (a `report.board` object with the same 10 keys — `title, projectFilter, allProjects, sessionFilter, allSessions, customRange, dayView, from, to, concurrentSessions`) — content matches technical-plan.md's F12 table verbatim for all four locales. No partial landing; `i18n.test.ts`'s registry-driven loop (4 locales × 2 new key-blocks) is 100% green, confirming this mechanically as well as by direct diff inspection.

## 6. Snapshot diff purity (item 5)

`git diff 0ef79b378e0de180155bc5549643760230d9dc2a -- client/src/pages/__tests__/__snapshots__/screens.snapshot.test.tsx.snap` contains **exactly one removed line** in the whole diff, and it is the `--- a/...` file-header line itself (`grep -c '^-'` = 1, and that one line is the diff header, not snapshot content). Every other line is an addition — the new `Focus calendar board 1` export block. The `Projects`/`Kanban board` snapshot exports are **byte-identical** to their pre-change baseline; the chrome extraction (F1-F3/F5a) leaked nothing into the two existing entry points. The test file's own diff (mock factory + new 13th `it`) is additive-only and correctly positioned right after the `Projects` case per DEC-5.

## 7. Definition of Done — `technical-plan.md` §9

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | `GET /api/focus-report` mounted independently, applies `source-filter.js`, requires `from`/`to` (400 on missing/malformed, no env knob) | MET | `server/routes/focus-report.js` (new); route test suite 21/21 green incl. all 400/`?sources=` cases |
| 2 | `server/routes/projects.js` byte-unmodified | MET | `git diff --stat` empty (§4) |
| 3 | `FocusReportBody.tsx` single chrome implementation, consumed by both entry points | MET | Both `FocusReportModal.tsx` and `FocusCalendarBoard.tsx` import `FocusReportBody`/`FocusReportViewToggle` from the same file; no copy-pasted JSX found in either |
| 4 | `FocusCalendarView.tsx`'s only changes are additive props; modal usage pixel-identical | MET | Diff shows only 3 new optional props + `DAY_MS`/`startOfDay` import swap; screens.snapshot's Projects/Kanban cases byte-identical (§6); `FocusCalendarView.test.tsx`'s 13 pre-existing assertions pass unmodified |
| 5 | `calendarWindow.ts` exists; all three consumers import from it | MET | `grep` confirms `FocusCalendarView.tsx`, `TimePeriodPicker.tsx`, `FocusCalendarBoard.tsx` all `import { DAY_MS, startOfDay } from "../lib/calendarWindow"` |
| 6 | Filters genuinely independent; session dropdown always global | MET | `FocusCalendarBoard.test.tsx`'s DEC-2 tests assert on rendered `<select>` value (not fetch-arg-only), both pass; page code shows `sessionId`/`projectId` state each only set by its own `onChange`, never cleared by the other's |
| 7 | Defaults to "today," all projects, no session, no query missing from/to | MET | `FocusCalendarBoard.tsx`'s `timeWindow` initial state = `{mode:"day", date: startOfDay(new Date())}`; `windowBounds()` always returns both bounds; default-state test passes |
| 8 | Nav entry "Calendar" right after "Projects"; route; all 4 nav.json + plan.json in one change-set | MET | `Sidebar.tsx`/`App.tsx` diffs (§ above); i18n diffs (§5) |
| 9 | T1-T7 added and passing; `focus-report.test.js`/`projects.test.js`/`FocusCalendarView.test.tsx`/`calendarLanes.test.ts` pass unmodified | MET | All confirmed above; `git diff --stat` empty for `calendarLanes.test.ts`, `focus-report.test.js`, `projects.test.js` |
| 10 | `npm run test:server` and `npm run test:client` both pass clean | MET | §1 |
| 11 | `screens.snapshot.test.tsx` exactly one new case; Projects/Kanban byte-identical | MET | §6 |
| 12 | Every new/edited file carries the authorship header | MET | `check-headers.sh` exit 0 |
| 13 | `docs/API.md` (+ README/ARCHITECTURE) updated in same change-set, documenting required (not defaulted) from/to | MET | `docs/API.md` new §; `ARCHITECTURE.md`/`README.md`/`client/README.md` also diffed (+29/+3/+49 lines) |
| 14 | Old route's `?sources=` gap explicitly not touched | MET | `server/routes/projects.js` byte-unmodified (§4); route test's explicit side-by-side case passes |
| 15 | `concurrency_ratio`/`wall_clock_ms` relabeled via `report.board.concurrentSessions` i18n key, not hardcoded | MET | `FocusReportBody.tsx`'s `concurrencyLabel` prop; `FocusCalendarBoard.tsx` passes `t("report.board.concurrentSessions")`; i18n test pins the exact English string |

**Technical-plan §9: all 15 items MET.**

## 8. Definition of Done — `test-plan.md`

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Step 0's DEC-6 i18n-key pre-req landed in technical-plan.md before any DEC-6-dependent test was written | MET (pre-existing) | `build-brief.md` confirms this was already reconciled before build started; technical-plan.md's F12 table already has the key |
| 2 | `focus-report-route.test.js` added; every case RED before, GREEN after | MET | §2 |
| 3 | Parity check is the corrected split form, never whole-object deepEqual | MET | Route test's two named suites: "group (a)" report-body deep-equal, "group (b)" envelope echo-back (incl. explicit old-route-has-no-session_id assertion), run as independent test cases |
| 4 | `focus-report.test.js`/`projects.test.js` pass with zero edits | MET | §4, and both files run green in the combined companion run |
| 5 | `FocusReportModal.test.tsx`'s standing-template test extended, not forked | MET | Same file, new `it` added in same `describe`, immediately after the existing `[standing template]` test |
| 6 | `FocusCalendarView.test.tsx`/`TimePeriodPicker.test.tsx`/`FocusCalendarBoard.test.tsx`/`Sidebar.test.tsx`/`i18n.test.ts` all extended/added; RED before, GREEN after | MET | §2 |
| 7 | Filter-independence tests assert on rendered DOM, not just mocked fetch args | MET | `FocusCalendarBoard.test.tsx` reads `(screen.getByRole("combobox", {name: "Session"}) as HTMLSelectElement).value` |
| 8 | `nav:focusCalendar` completeness + English-value pin ("Calendar") passes for all 4 locales | MET | i18n test green, including the exact-value pin test |
| 9 | DEC-6 i18n-key completeness passes for all 4 locales | MET | i18n test green, including the exact "Concurrent agent sessions" pin |
| 10 | `screens.snapshot.test.tsx` Projects/Kanban byte-identical; exactly one new case, reviewed then blessed via `-u` | MET (byte-identity mechanically confirmed; "reviewed by eye" is process, not re-verifiable after the fact, but the structural check is stronger) | §6 |
| 11 | Old route's `?sources=` gap confirmed still present | MET | §4, §7 row 14 |
| 12 | **Manual click-path pass run once against a real dev stack with real seeded data; board-vs-modal visual parity and all-4-locale label correctness confirmed by eye** | **NOT MET / NOT RUN** | No entry in `time-log.jsonl` for a manual/dev-server/click-path phase; no artifact anywhere under `intake/2026-07-26-focus-calendar-board/` documents this pass having been performed. This is the one check test-plan.md itself calls "the one thing no automated test here can fully verify." Not re-performed by this Verifier pass either (out of scope for an automated gate — this needs a human/agent driving a real browser against `npm run dev`, per CLAUDE.md's `open -a "Google Chrome"` convention). |
| 13 | `npm run test:server`/`test:client` both green | MET | §1 |
| 14 | `check-headers.sh` exits 0 for every new file | MET | §1 |
| 15 | `docs/API.md` updated in the same change-set | MET | §7 row 13 |

**test-plan.md's DoD: 14/15 items MET; item 12 (manual click-path pass) is NOT MET/NOT RUN** — this is an explicitly-named DoD item in both the technical plan's §6 "Manual verification" section and the test plan's own DoD checklist, and build-task-list.md's task 26. All automated evidence (§1-§7 above) is otherwise clean and complete.

## 9. Durable-cure / deferral notes (non-gating)

- The test-plan's own "Durable-cure decision" section explicitly **defers** building a shared parity-assertion test helper (generalizing the report-body/envelope split-compare pattern) as an accepted, stated, non-gating deferral — not a gap introduced by this build. Noted, not counted against the verdict.
- All five `MANDATORY [DERIVED-DUAL-VIEW]` durable-cure tasks named in build-task-list.md (one computation path, one day-boundary helper, one rendering-chrome implementation, atomic 4-locale i18n, byte-identical snapshot fence) plus the two `MANDATORY [DEC-2]`/`[DEC-3]` filter-independence/no-hidden-default guards were all independently verified above, not merely taken on the build task list's word.

## Verdict

**GREEN-WITH-CAVEATS.**

Every new test named in `red-evidence.md`/`test-plan.md` is present, was genuinely red for the stated reason, and is now green with the same test identity (path + assertion) — confirmed by direct diffs, not by re-running and trusting labels alone. Both full suites (`test:server` 934/934, `test:client` 471/471) pass clean, `tsc --noEmit` is clean, the file-header audit exits 0, `server/lib/focus-report.js` and `server/routes/projects.js` are byte-unmodified, the 4-locale i18n additions landed atomically and correctly, the `screens.snapshot.test.tsx` diff is additive-only with Projects/Kanban baselines byte-identical, and the FocusReportModal fixture fix is a legitimate fixture-consistency correction (not a weakened assertion). All 15 technical-plan §9 DoD items are met.

The single caveat: **test-plan.md's DoD item — the manual click-path pass against a real `npm run dev` stack (board-vs-modal visual parity, all-four-locale label glance) — has not been performed** (no evidence of it in `time-log.jsonl` or anywhere else in the intake artifacts). This is explicitly named by both plans as the one proof automated tests structurally cannot supply. Recommend routing back for that one manual pass before calling this fully done; nothing else needs implementer rework.
