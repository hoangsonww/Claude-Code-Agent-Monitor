# Red Evidence — focus-report-fidelity (List-view parity)

Test Author pass. Worktree used for everything below:
`/Users/sara/CODE-LOCAL/SARA/efforts/2026-07-26-focus-report-fidelity/Claude-Code-Agent-Monitor`
(branch `effort/2026-07-26-focus-report-fidelity`).

Note: this worktree had no `node_modules` installed (fresh worktree). Ran
`npm install` (repo root) and `npm install` (client/) once before any test
commands — required to make even the pre-existing baseline runnable, not a
test-authoring change.

## Baseline re-verification (task 1 / test-plan step 1)

- `npm run test:server` → **902/902** pass.
- `npm run test:client` → **403/403** pass, 36 files.
- `bash .claude/skills/file-headers/scripts/check-headers.sh` → clean, exit 0.

Ground truth confirmed real, not stale, before adding anything.

---

## 1. `client/src/lib/__tests__/idleStripes.test.ts` (new file — client lib unit)

Command: `cd client && npx vitest run src/lib/__tests__/idleStripes.test.ts`

**RED (module missing):**

```
FAIL  src/lib/__tests__/idleStripes.test.ts [ src/lib/__tests__/idleStripes.test.ts ]
Error: Failed to resolve import "../idleStripes" from "src/lib/__tests__/idleStripes.test.ts". Does the file exist?
  Plugin: vite:import-analysis
  File: .../client/src/lib/__tests__/idleStripes.test.ts:20:35
  1  |  import { describe, it, expect } from "vitest";
  2  |  import { idleStripesInRange } from "../idleStripes";
     |                                      ^

 Test Files  1 failed (1)
      Tests  no tests
```

Exactly the expected done-check ("Cannot find module '../idleStripes'" /
equivalent import-resolution failure) — `client/src/lib/idleStripes.ts` does
not exist yet. 9 cases written (undefined/empty chunks, zero-length/inverted
range, `{offsetPct, spanPct}` key-set guard, partial-overlap clipping,
fully-outside drop, orientation-agnostic epoch check, and the two fixtures
ported byte-for-byte from `FocusCalendarView.test.tsx`'s 50/50-split and
all-active/no-stripe cases).

---

## 2. `client/src/i18n/__tests__/i18n.test.ts` (updated — registry-derived completeness block)

Command: `cd client && npx vitest run src/i18n/__tests__/i18n.test.ts`

**RED, both directions, all 4 locales + the en-only byte-identical check (9
new failures, 6 pre-existing tests still pass):**

```
 ✓ i18n resources > should provide Vietnamese translations for navigation keys
 ✓ i18n resources > should keep Agent terminology untranslated in zh, vi, and ko locales
 ✓ i18n resources > should support non-explicit Vietnamese locale tags
 ✓ i18n resources > should provide Korean translations for navigation keys
 ✓ i18n resources > should support non-explicit Korean locale tags
 ✓ i18n resources > pluralizes the subagent count labels in English
 × ... > resolves the new top-level keys for locale "en"
 × ... > no longer resolves the old report.calendar.* path for locale "en"
 × ... > resolves the new top-level keys for locale "ko"
 × ... > no longer resolves the old report.calendar.* path for locale "ko"
 × ... > resolves the new top-level keys for locale "vi"
 × ... > no longer resolves the old report.calendar.* path for locale "vi"
 × ... > resolves the new top-level keys for locale "zh"
 × ... > no longer resolves the old report.calendar.* path for locale "zh"
 × ... > keeps the relocated English strings byte-identical to their pre-relocation values

AssertionError (representative, "no longer resolves" direction, ko):
expected '실제 경과 시간' to be 'report.calendar.wallClockLabel' // Object.is equality
Expected: "report.calendar.wallClockLabel"
Received: "실제 경과 시간"

AssertionError (representative, byte-identical check, en):
expected 'report.wallClockLabel' to be 'Wall clock' // Object.is equality
Expected: "Wall clock"
Received: "report.wallClockLabel"

 Test Files  1 failed (1)
      Tests  9 failed | 6 passed (15)
```

Confirmed empirically (scratch check) that i18next's missing-key fallback in
this app's config returns the literal dotted key path with the namespace
prefix stripped (e.g. `"report.wallClockLabel"`, not `"plan:report.wallClockLabel"`)
— assertions above use that exact literal, not a guess.

---

## 3. `client/src/components/__tests__/FocusReportModal.test.tsx` (fixture update + 5 new tests)

### 3a. Fixture update (task 7) — expected RED on exactly one existing test

Command: `cd client && npx vitest run src/components/__tests__/FocusReportModal.test.tsx`
(fixture updated: segment 1 now `wall_ms 30m / active_ms 20m / idle_ms 10m`
with a 3-chunk array; segment 2 unchanged `wall_ms === active_ms === 10m`, no
`chunks` field; totals recomputed per the build-task-list's exact arithmetic)

**RED, isolated to the intended test, all 12 others still green:**

```
 ✓ FocusReportModal > fetches the report scoped to the given project id and shows a loading state first
 ✓ FocusReportModal > shows an error state when the fetch fails
 ✓ FocusReportModal > shows an empty state for a project with no session focus history
 × FocusReportModal > computes the on-item percentage from active time and surfaces idle time separately
 ✓ FocusReportModal > shows the concurrency ratio and the real wall-clock span (not the per-segment sum)
 ✓ FocusReportModal > falls back to a dash when there's no wall-clock time for a concurrency ratio
 ✓ FocusReportModal > renders the session's name linking to its detail page and the per-item rollup
 ✓ FocusReportModal > badges sessions whose segments are inferred, and leaves declared sessions unbadged
 ✓ FocusReportModal > shows a visible caption naming an inferred detour, not just a hover-only bar
 ✓ FocusReportModal > falls back to the generic inferred note when the classifier left no reason
 ✓ FocusReportModal > closes on Escape, backdrop click, and the close button
 ✓ FocusReportModal > switches to the calendar view and back without a second fetch, keeping stat tiles visible
 ✓ FocusReportModal > hides the List/Calendar toggle when there is no focus history to show

TestingLibraryElementError: Unable to find an element with the text: 75%.
 ❯ src/components/__tests__/FocusReportModal.test.tsx:159:19
    expect(screen.getByText("75%")).toBeInTheDocument();

 Tests  1 failed | 12 passed (13)
```

Fails for exactly the reason the plan calls out: 30m item / 40m total active
was 75%; the new fixture's 20m item active / 30m total active is 67%, so the
literal string "75%" is genuinely no longer rendered anywhere. All 12 other
existing tests (concurrency-ratio, idle-excluded, inferred badge/caption,
close behavior, view toggle) are unaffected, confirming the fixture edit is
isolated as the plan predicted.

### 3b. Assertion update (task 8) — back to green

Updated `"75%"`/`"25%"` → `"67%"`/`"33%"`. Re-run: **13/13 green.**

### 3c. Four new tests (tasks 10–13) — RED against current (pre-List-fix) code

Command: `cd client && npx vitest run src/components/__tests__/FocusReportModal.test.tsx`

```
 ✓ ... (13 pre-existing tests, unchanged)
 × shows a labeled wall-clock/agent-time split in the per-session header when they diverge, a plain single number when they don't
 × overlays exactly one idle stripe on the per-session bar, only for the segment carrying chunks
 ✓ renders no idle stripe on the per-session bar for a single segment with no chunks   (negative case — correctly green both before and after the fix)
 × sizes the per-item rollup and project-split bars by active_ms, not wall_ms (the embedded-bug regression)
 × [standing template] List and Calendar views render the same wall-clock/agent-time numbers and proportionally equivalent idle-stripe geometry for the same segment — extend THIS test, not a view-local one, for any future FocusReportSegment field either view renders

 Test Files  1 failed (1)
      Tests  4 failed | 14 passed (18)
```

**Dual header split (task 10):**
```
Unable to find an element with the text: /30m 0s/.
<div class="flex items-baseline justify-between gap-2 min-w-0">
  ...<a href="/sessions/sess-1">Worker</a>...
  <span class="text-[11px] font-mono text-gray-500 flex-shrink-0">40m 0s</span>
</div>
```
Only one, unlabeled number (`40m 0s`, the `wall_ms` sum) renders in the
"Worker" row today — no `30m 0s` anywhere in it — exactly round-4's known gap.

**Idle-stripe overlay (task 11):**
```
AssertionError: expected  to have a length of 1 but got +0
```
Zero `[data-testid="idle-stripe"]` elements exist anywhere in the List view
today (confirmed by grep before writing the assertion, per the task list's
own instruction) — the negative "no idle stripe" sibling case is correctly
green already (0 stripes either way for a no-`chunks` fixture).

**Aggregate-bar `active_ms` sizing incl. near-zero case (task 12):**
```
AssertionError: expected 50 to be close to 66.66666666666666, received difference is 16.666666666666657, but expected 0.5
```
Diagnosed the exact rendered slice widths first (temporary debug log, removed
before finalizing): `[50, 33.33, 16.67]` — i.e. item 30/60=50%, detour
20/60=33.3%, bug 10/60=16.7% — the current `wall_ms`-proportional sizing
exactly as predicted, not `20/30=66.7%` (item), `1000/(20*60_000+...)≈0%`
(detour), `10/30=33.3%` (bug) that `active_ms`-based sizing would produce.
Fails on the very first (`item`) width check, for the sizing-basis reason,
not a selector/typo issue.

**Cross-view standing-template test (task 13) — load-bearing per the task
list's own sequencing note:**
```
TestingLibraryElementError: Unable to find an element with the text: /10m 0s/.
<div class="flex items-baseline justify-between gap-2 min-w-0">
  ...<a href="/sessions/sess-cross-view">CrossView</a>...
  <span class="text-[11px] font-mono text-gray-500 flex-shrink-0">20m 0s</span>
</div>
```
Fails on the very first List-view assertion (header shows only `20m 0s`, not
also `10m 0s`) — the literal reproduction of round-4's exact failure shape,
confirming the test itself is strong enough (per the task list's own
stop-and-report trigger: "the cross-view test does not reproduce round-4's
failure shape pre-task-9" — it does reproduce it, so no stop/report needed
here).

Implementation note: this test originally used `await screen.findByText(...)`
under `vi.useFakeTimers()` and hung/timed out at 5000ms, because
testing-library's `findBy*/waitFor` polling relies on real timers, which are
frozen for this test (fake timers are required here so Calendar view's
"today" is deterministic). Fixed by flushing the mock fetch's microtask queue
manually inside `act()` (the same technique `FocusCalendarView.test.tsx`
already uses for its own async fetches under fake timers) instead of
`findByText`, then using synchronous `getByText`. Re-ran and confirmed it now
fails cleanly on the intended assertion instead of timing out.

---

## 4. `server/__tests__/focus-report.test.js` (new `inferredSegment` describe block — coverage-only)

Command: `node --test server/__tests__/focus-report.test.js`

**Not a red/green pair per the plan — expected to pass immediately.** First
run surfaced a **test-isolation bug in this file's existing "buildSessionFocusReport
- idle grace window" describe block** (pre-existing, unrelated to this
build's product code): its cleanup re-captured `originalGrace` in
`beforeEach()` on every test rather than once in `before()`, so by the time
the block's tests finished, the "restored" value was actually the previous
test's own leftover mutation (`"0"`, from the `"<= 0 disables discounting"`
case), not the true pre-suite value. This silently left
`DASHBOARD_FOCUS_IDLE_GRACE_SECONDS="0"` for the rest of the file — invisible
to the existing 902-test baseline because no pre-existing test after that
point depended on the ambient grace value, but it broke my new case 5
(idle-tail via inference) on first run:

```
not ok - highest-value: a round-3-shaped idle tail reached via the inference path still discounts active_ms and produces chunks
error: 'active_ms should be discounted below wall_ms'
expected: true
actual: false
```

Confirmed via a standalone reproduction (isolated `node -e` script, no other
describe blocks in play) that `inferredSegment`/`activeIdleMs` compute the
correct discounted `active_ms` (780000 of 7800000ms wall) when the grace env
var is left at its true default — i.e. this was a test-harness ordering
defect, not a hidden product bug. Fixed the pre-existing describe block's
`beforeEach()` → `before()` (test-file-only change, no product code touched)
so it captures the true original env value once. Re-ran:

```
1..7
# tests 35
# suites 7
# pass 35
# fail 0
```

All 35 tests in the file pass, including all 5 new `inferredSegment` cases
(item-kind resolves current item_number/text via `getPlanItemById`,
detour-kind uses the inference row's own label, deleted-item and
unclassified verdicts both fabricate no segment, and the highest-value
idle-tail case pins `wall_ms === 130*60_000`, `active_ms < wall_ms`,
`chunks.length === Math.ceil(wall_ms/CHUNK_MS)`, first chunk active, every
later chunk idle) — first-run green as the plan expects for a coverage-only
addition, no adjustment needed to any assertion.

---

## Full-suite re-verification after all test-only changes

- `npm run test:server` → **907/907** (902 baseline + 5 new `inferredSegment` cases).
- `npm run test:client` → **3 failed files / 34 passed (37 total)**, **13
  failed / 404 passed (417 total)** — exactly the 13 expected-red assertions
  above (9 in `i18n.test.ts`, 4 in `FocusReportModal.test.tsx`) plus
  `idleStripes.test.ts` failing to even load (module doesn't exist yet); all
  36 pre-existing files/403 pre-existing tests plus the file-header rule are
  unaffected.
- `bash .claude/skills/file-headers/scripts/check-headers.sh` → clean, exit 0
  (new `idleStripes.test.ts` carries the required header).

No expected-red test came up unexpectedly green. No product code was
touched.
