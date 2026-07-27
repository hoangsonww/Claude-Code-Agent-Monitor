# Red Evidence — focus-calendar-board

Prepared by: Test Author
Worktree: `/Users/sara/CODE-LOCAL/SARA/efforts/2026-07-26-focus-calendar-board/Claude-Code-Agent-Monitor`
Branch: `effort/2026-07-26-focus-calendar-board`
Base commit: `0ef79b378e0de180155bc5549643760230d9dc2a`

All tests below were authored per `test-plan.md` / `build-task-list.md`, run
against the **current, wholly-unbuilt** code in this worktree (no product code
from build tasks 1-23 has landed yet), and confirmed RED for the stated
reason. No product code was touched — test files only. Dependencies were
installed first (`npm run setup`) since this fresh worktree had no
`node_modules`.

---

## 1. `server/__tests__/focus-report-route.test.js` (new)

**Command:** `node --test server/__tests__/focus-report-route.test.js`

**Result:** 21 cases, **0 passed, 21 failed.**

**Reason:** `GET /api/focus-report` is not mounted (`server/routes/focus-report.js`
doesn't exist; `server/index.js` has no `app.use("/api/focus-report", ...)`
line yet). Every request the route needs falls through to Express's default
404 (HTML body, not JSON).

Representative failures:

- The five 400-validation cases (missing `from`+`to`, missing `from` only,
  missing `to` only, unparseable `from`, unparseable `to`) and the 6
  filter-present-without-bounds loop cases (11 total) fail with:
  ```
  Expected values to be strictly equal:
  404 !== 400
  ```
  (the unmounted route 404s instead of validating and 400ing).

- The window-boundary, `project_id`/`session_id` scoping (except the two
  "unknown id" cases, see below), `?sources=` narrowing, and split-parity
  cases (9 total) fail with:
  ```
  Expected values to be strictly equal:
  404 !== 200
  ```

- The two "unknown project_id / unknown session_id → structured 404" cases
  were deliberately written to check the response **body shape**
  (`typeof res.body?.error?.code === "string"`), not just the status code —
  because the unmounted route *also* returns 404 for these URLs (coincidentally
  matching the expected status), which would otherwise be a false-green
  pinned to the wrong reason. With the body-shape assertion added, both fail
  as intended:
  ```
  AssertionError [ERR_ASSERTION]: expected undefined to be 'string'
  ```
  (the unmounted-route's 404 body is a raw HTML string, so `res.body.error`
  is `undefined` — genuinely red for the right reason: no structured JSON
  404 exists yet, not merely "some 404 happened").

- The envelope echo-back case (group b) fails on:
  ```
  Expected values to be strictly equal:
  + actual - expected
  + undefined
  - '370288e2-c62e-4256-b3e4-47167193664a'
  ```
  (`newRes.body.project_id` is `undefined` because the whole response is the
  unmounted-route's HTML 404 body, not JSON).

**Sanity check — regression companions still pass, unmodified:**
`node --test server/__tests__/focus-report.test.js server/__tests__/projects.test.js`
→ 47/47 pass, confirming the new test file didn't touch or destabilize
either existing suite.

---

## 2. `client/src/components/__tests__/FocusReportModal.test.tsx` (extended)

**Command:** `cd client && npx vitest run src/components/__tests__/FocusReportModal.test.tsx`

**Result:** Suite fails to load. **0 of 23 tests run** (all, including the 22
pre-existing/previously-passing tests, are swept into this failure).

**Reason:** the new standing-template-extension `it(...)` (added
immediately after the existing `"[standing template]"` test, same
`describe`) imports `FocusReportBody` from `../FocusReportBody`, which does
not exist yet (build task 9). Vite/esbuild reports:
```
Error: Failed to resolve import "../FocusReportBody" from
"src/components/__tests__/FocusReportModal.test.tsx". Does the file exist?
```
This is expected and matches the build-task-list's own stated red reason for
task 8: *"before step 4 [sic — task 9], this test cannot even import
FocusReportBody (compile/module-resolution failure)."* The cascading failure
of the file's other 22 (previously-green) tests is an unavoidable
consequence of a top-level ES import for a not-yet-built module, not a
regression in their own logic — this resolves once `FocusReportBody.tsx`
exists (build task 9).

---

## 3. `client/src/components/__tests__/FocusCalendarView.test.tsx` (extended)

**Command:** `cd client && npx vitest run src/components/__tests__/FocusCalendarView.test.tsx`

**Result:** 18 tests, **15 passed, 3 failed.**

**Reason:** new `describe("board-mode additive props...")` block. `renderCalendar()`
was extended to accept an `extraProps` param spread onto `<FocusCalendarView>`;
since the component doesn't destructure/use `selectedDate`/`hideDateNav`/
`projectLabelForCwd` yet (build task 7), these props are silently ignored at
runtime (harmless extra JSX props, no compile-time type gate at test-run
time). All 13 **pre-existing** assertions in the file still pass unmodified.

Within the new block (5 cases):
- **RED (3, for the intended reason):**
  - `selectedDate controls the rendered day instead of internal state` —
    fails because the component still defaults to its own internal
    `today` state instead of the passed `selectedDate` (a fixture seeded
    only on "yesterday" still renders "No activity on this day" instead of
    the yesterday session):
    ```
    expect(element).not.toBeInTheDocument()
    ```
  - `hideDateNav={true} renders zero day-nav buttons` — fails because the
    nav row renders unconditionally (prop ignored):
    ```
    expect(element).not.toBeInTheDocument()
    ```
  - `projectLabelForCwd renders the resolved label for a block's cwd` —
    fails because no "Acme Corp" text renders anywhere (prop ignored):
    ```
    Unable to find an element with the text: Acme Corp.
    ```
- **Not expected to be RED (2, intentionally vacuous forward guards,
  documented inline in the test file):**
  - `hideDateNav omitted (default false) still renders the nav row
    unchanged (inverted-boolean guard)` — passes today because the
    component doesn't read this prop at all yet, so "nav visible" already
    matches the omitted-prop expectation. This guards a *future* regression
    (an inverted boolean once `hideDateNav` is wired), not currently-missing
    behavior.
  - `projectLabelForCwd resolving undefined renders nothing extra (no
    crash, no stray label)` — passes today for the same reason (nothing
    extra renders because nothing related exists yet); it protects the
    "returns `undefined` -> no crash/no stray text" contract once the prop
    is wired.

Flagging this per instructions: these two are legitimately, expectedly
green now — not evidence the feature exists, just assertions that happen to
be insensitive to the feature's current absence. Not stopping/reporting as a
false-green since the other 3 cases in the same block are genuinely red and
these two are explicitly documented as forward guards, not red-first pins.

---

## 4. `client/src/components/__tests__/TimePeriodPicker.test.tsx` (new)

**Command:** `cd client && npx vitest run src/components/__tests__/TimePeriodPicker.test.tsx`

**Result:** Suite fails to load. **0 tests run.**

**Reason:**
```
Error: Failed to resolve import "../TimePeriodPicker" from
"src/components/__tests__/TimePeriodPicker.test.tsx". Does the file exist?
```
Neither `TimePeriodPicker.tsx` (build task 12) nor `calendarWindow.ts`
(build task 6) exist yet in this worktree. Matches the build-task-list's
stated reason: *"RED (module doesn't exist / fails to mount)."*

---

## 5. `client/src/i18n/__tests__/i18n.test.ts` (extended)

**Command:** `cd client && npx vitest run src/i18n/__tests__/i18n.test.ts`

**Result:** 25 tests, **15 passed, 10 failed.**

**Reason:** two new `LOCALES`-driven blocks. `nav:focusCalendar` and
`plan:report.board.concurrentSessions` don't exist in any of the four
locale files yet (build tasks 15/0's pre-req is already satisfied in
`technical-plan.md`'s F12 table, but the actual locale JSON files haven't
been edited). i18next's missing-key fallback returns the literal
namespace-stripped key path:
```
AssertionError: expected 'focusCalendar' not to be 'focusCalendar'
```
```
AssertionError: expected 'report.board.concurrentSessions' not to be
'report.board.concurrentSessions'
```
```
AssertionError: expected 'focusCalendar' to be 'Calendar'
Expected: "Calendar"
Received: "focusCalendar"
```
```
AssertionError: expected 'report.board.concurrentSessions' to be
'Concurrent agent sessions'
```
All 4 locales fail identically for both new blocks (4 + 1 exact-value pin
for `nav:focusCalendar`; 4 + 1 exact-value pin for the DEC-6 key = 10 total).
All 15 pre-existing assertions in the file pass unmodified.

---

## 6. `client/src/components/__tests__/Sidebar.test.tsx` (extended)

**Command:** `cd client && npx vitest run src/components/__tests__/Sidebar.test.tsx`

**Result:** 12 tests, **9 passed, 3 failed.**

**Reason:** `Sidebar.tsx`'s `NAV_KEYS` has no `/focus-calendar` entry /
`nav:focusCalendar` key yet (build task 19).
- `should render all navigation links` (extended with a "Calendar" assertion):
  ```
  Unable to find an element with the text: Calendar.
  ```
- `should have correct navigation hrefs` (extended with `/focus-calendar`):
  ```
  AssertionError: expected [ '/', '/projects', '/kanban', …(9) ] to include
  '/focus-calendar'
  ```
- `positions Calendar right after Projects in nav order` (new): `"Calendar"`
  isn't found in the nav's link labels at all, so its index is `-1`:
  ```
  AssertionError: expected -1 to be 2
  ```
All 9 pre-existing assertions in the file pass unmodified.

---

## 7. `client/src/pages/__tests__/FocusCalendarBoard.test.tsx` (new)

**Command:** `cd client && npx vitest run src/pages/__tests__/FocusCalendarBoard.test.tsx`

**Result:** Suite fails to load. **0 tests run.**

**Reason:**
```
Error: Failed to resolve import "../FocusCalendarBoard" from
"src/pages/__tests__/FocusCalendarBoard.test.tsx". Does the file exist?
```
`client/src/pages/FocusCalendarBoard.tsx` doesn't exist yet (build task 17).
Matches the build-task-list's stated reason: *"RED (page module doesn't
exist yet, import fails)."*

---

## 8. `client/src/pages/__tests__/screens.snapshot.test.tsx` (extended)

**Command:** `cd client && npx vitest run src/pages/__tests__/screens.snapshot.test.tsx`

**Result:** Suite fails to load. **0 of 13 tests run** (all, including the
12 pre-existing cases — `Dashboard`, `Projects`, `Kanban board`, etc. — are
swept into this failure).

**Reason:**
```
Error: Failed to resolve import "../FocusCalendarBoard" from
"src/pages/__tests__/screens.snapshot.test.tsx". Does the file exist?
```
The new 13th case (`"Focus calendar board"`, positioned right after
`"Projects"` per DEC-5) requires a top-level `import { FocusCalendarBoard }
from "../FocusCalendarBoard"`, which cannot resolve before build task 17
lands. This is an unavoidable, expected consequence of a top-level ES
import for a not-yet-built module (same pattern as items 2/4/7 above) — it
is **not** evidence that `Projects`/`Kanban board`'s own rendering changed;
those two cases' real byte-identity check against the committed snapshot
baseline can only run once `FocusCalendarBoard.tsx` exists. Flagging this
explicitly per instructions rather than silently treating the whole-file
failure as a "Projects/Kanban board regression" — it is not one.

The `vi.mock("../../lib/api", ...)` factory was also extended with a new
top-level `api.focusReport` mock (empty-fixture-shaped, `project_id`/
`session_id` both `null`) alongside the existing `api.projects.list`/
`api.sessions.list` mocks, per the test-plan's fixture instructions.

---

## Summary table

| File | Layer | New/Extended | Command | Result |
|---|---|---|---|---|
| `server/__tests__/focus-report-route.test.js` | integration (server) | new | `node --test server/__tests__/focus-report-route.test.js` | 21/21 RED — route not mounted (404 instead of 400/200; unstructured 404 body) |
| `client/src/components/__tests__/FocusReportModal.test.tsx` | component | extended | `npx vitest run .../FocusReportModal.test.tsx` | Suite fails to load — `FocusReportBody` module missing |
| `client/src/components/__tests__/FocusCalendarView.test.tsx` | component | extended | `npx vitest run .../FocusCalendarView.test.tsx` | 3/5 new-block cases RED (props ignored); 2/5 vacuously green (forward guards, documented); 13/13 pre-existing pass |
| `client/src/components/__tests__/TimePeriodPicker.test.tsx` | component | new | `npx vitest run .../TimePeriodPicker.test.tsx` | Suite fails to load — `TimePeriodPicker`/`calendarWindow` modules missing |
| `client/src/i18n/__tests__/i18n.test.ts` | i18n registry | extended | `npx vitest run .../i18n.test.ts` | 10/10 new-block cases RED — missing-key echo; 15/15 pre-existing pass |
| `client/src/components/__tests__/Sidebar.test.tsx` | component | extended | `npx vitest run .../Sidebar.test.tsx` | 3/3 new/extended cases RED — no Calendar nav entry; 9/9 pre-existing pass |
| `client/src/pages/__tests__/FocusCalendarBoard.test.tsx` | page | new | `npx vitest run .../FocusCalendarBoard.test.tsx` | Suite fails to load — `FocusCalendarBoard` module missing |
| `client/src/pages/__tests__/screens.snapshot.test.tsx` | snapshot | extended | `npx vitest run .../screens.snapshot.test.tsx` | Suite fails to load (cascades to the 12 pre-existing cases too) — `FocusCalendarBoard` module missing |

**Full-suite sanity check (client):** `cd client && npx vitest run` →
7 test files failed / 32 passed (39 total); 16 tests failed / 408 passed
(424 total) — matches the sum of the genuinely-red assertions above
(3 FocusCalendarView + 10 i18n + 3 Sidebar = 16) plus the 4 suites that fail
to load entirely (FocusReportModal, TimePeriodPicker, FocusCalendarBoard,
screens.snapshot). No other test file in the repo was affected.

**Full-suite sanity check (server):**
`node --test server/__tests__/focus-report.test.js server/__tests__/projects.test.js`
→ 47/47 pass, zero edits to either file — confirms the new route test file
doesn't destabilize the existing regression suites it must coexist with.

**File-header audit:** `bash .claude/skills/file-headers/scripts/check-headers.sh`
→ exits 0, "All applicable files carry the authorship header."

**No product code was edited.** `git status --porcelain` in this worktree
shows only the 8 test files listed above as changed (7 new: `focus-report-route.test.js`,
`TimePeriodPicker.test.tsx`, `FocusCalendarBoard.test.tsx`; 5 modified:
`FocusReportModal.test.tsx`, `FocusCalendarView.test.tsx`, `Sidebar.test.tsx`,
`i18n.test.ts`, `screens.snapshot.test.tsx`) plus `node_modules`/lockfile
artifacts from the one-time `npm run setup` dependency install this fresh
worktree needed before any test could run.

---

# Round 2 — build-reviewer follow-up (post-implementation)

Prepared by: Test Author
Date: 2026-07-26
Context: by this round, build tasks 1-23 have landed (all product code from
Round 1 above now exists and is green). The build-reviewer found a real bug
in `client/src/components/TimePeriodPicker.tsx`'s `parseDateInputValue`
(~lines 46-51) and two coverage gaps against `technical-plan.md`'s T3(g)/T7.
This round adds three new test cases — one bug-catching, two closing the
named coverage gaps — test files only, no product code touched.

## R2-1. `TimePeriodPicker.tsx`'s `parseDateInputValue` empty-string bug

**File:** `client/src/components/__tests__/TimePeriodPicker.test.tsx`
**New test:** `"clearing the start date input to an empty string does not
silently emit a garbage fallback date such as 1900-01-01
(parseDateInputValue nullish-coalescing bug: Number('') is 0, not NaN, so
the ?? fallbacks never fire)"`

**Command:** `cd client && npx vitest run src/components/__tests__/TimePeriodPicker.test.tsx`

**Result: RED, confirmed for the right reason.**

```
FAIL  src/components/__tests__/TimePeriodPicker.test.tsx > TimePeriodPicker >
clearing the start date input to an empty string does not silently emit a
garbage fallback date such as 1900-01-01 (parseDateInputValue
nullish-coalescing bug: Number('') is 0, not NaN, so the ?? fallbacks never
fire)
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ src/components/__tests__/TimePeriodPicker.test.tsx:155:32
    153|       return next.start.getFullYear() < 2000;
    154|     });
    155|     expect(emittedGarbageDate).toBe(false);
       |                                ^
```

The test fires `fireEvent.change(fromInput, { target: { value: "" } })` on
the range-mode "From" `<input type="date">`, then inspects every `onChange`
call the component made, checking whether any resulting `start` date has
`getFullYear() < 2000`. It fails because `onChange` *was* called, with a
`start` date whose year is 0 -> normalized by the JS `Date` constructor to
1900 (confirmed via a standalone repro: `new Date(0, 0, 1)` -> "Nov 30 1899"
in this machine's local timezone) — i.e. the component silently accepted the
cleared field as if the user had picked a real (ancient, nonsensical) date,
exactly the bug the reviewer flagged. This is **not** a compile/import
failure or a typo — the suite's other 7 cases in the same file (including
the new R2-2 test below) pass, proving the test harness/selectors are sound
and this one assertion is failing on the actual runtime value, for the
actual reason: `Number("")` is `0`, not `NaN`, so `parseDateInputValue`'s
`y ?? 1970` fallback never fires (0 is not nullish).

I deliberately chose "assert `onChange` is never called with a garbage
(pre-2000) date" rather than "assert `onChange` is never called at all,"
since the latter presumes one specific fix strategy (silently ignore
invalid input) over other equally valid ones (e.g. clamping to a sane
default). This assertion is agnostic to which fix the implementer picks, as
long as it isn't "silently accept the empty string as 1900-01-01."

## R2-2. T7 gap — full range-of-motion via real `change` events (component layer)

**File:** `client/src/components/__tests__/TimePeriodPicker.test.tsx`
**New test:** `"firing real change events on both the start and end date
inputs in range mode emits a {mode:'range', start, end} value covering the
full selected range (T7)"`

**Command:** `cd client && npx vitest run src/components/__tests__/TimePeriodPicker.test.tsx`

**Result: GREEN on first run — flagging per instructions, not weakened.**

This test fires a real `fireEvent.change` on the "From" input, asserts the
emitted value, re-renders with that value applied (simulating the real
controlled-component flow `FocusCalendarBoard` uses), fires a real
`fireEvent.change` on the "To" input, and asserts the *final* emitted value
has both the new start **and** the new end. It passed immediately:

```
✓ TimePeriodPicker > firing real change events on both the start and end
  date inputs in range mode emits a {mode:'range', start, end} value
  covering the full selected range (T7) 4ms
```

This is a genuine, non-vacuous assertion (it pins concrete `Date` values on
both fields, not just "truthy"/"defined"), and it is exercising real
`fireEvent.change` calls end-to-end, not mocked-out internals — so this is
not a "weak assertion forced green," it's evidence that
`TimePeriodPicker.tsx`'s existing range-mode `onChange` wiring for
*well-formed* input already does the right thing (each field's handler
correctly threads the *other* field's current value through unchanged).
The technical-plan/reviewer's T3(g)/T7 gap was a **missing-test-coverage**
gap, not a missing-or-broken-behavior gap for this particular
well-formed-input scenario — the only actual defect in this area is the
malformed/empty-input case covered by R2-1 above. I am not weakening this
assertion to force a red; it stands as real, permanent regression coverage
for behavior that already works.

## R2-3. T3(g) gap — custom-range re-fetch spans the full selected range (board/page layer)

**File:** `client/src/pages/__tests__/FocusCalendarBoard.test.tsx`
**New test:** `"switching to custom-range mode and picking a start/end
re-fetches with from/to spanning the full selected range (T3g)"`

**Command:** `cd client && npx vitest run src/pages/__tests__/FocusCalendarBoard.test.tsx`

**Result: GREEN on first run — flagging per instructions, not weakened.**

This test drives the real UI end-to-end: clicks "Custom range", fires real
`fireEvent.change` on the rendered "From"/"To" inputs, and asserts the
*last* `api.focusReport` mock call's `from`/`to` args equal the full
`[2026-03-01, 2026-03-11)` window (i.e. inclusive of 2026-03-10, per
`windowBounds`'s day-after-last-day exclusive-upper-bound convention) —
not just whichever field was edited most recently:

```
✓ src/pages/__tests__/FocusCalendarBoard.test.tsx (10 tests) 308ms
```

(10/10 pass, up from the file's pre-existing 9; all 9 pre-existing cases
pass unmodified.) Same conclusion as R2-2: `FocusCalendarBoard.tsx`'s
`windowBounds()` + `TimePeriodPicker`'s range wiring already correctly
compose for well-formed input; this closes a real, previously-missing
regression guard rather than catching a live bug. Reported as a flag per
the Test Author's mandate to surface unexpected-green rather than silently
force a fail.

## Round 2 summary

| Test | File | Layer | Result |
|---|---|---|---|
| Empty-string date-clear bug guard | `TimePeriodPicker.test.tsx` | component (unit) | **RED, confirmed** — `parseDateInputValue`'s `Number("") === 0` nullish-coalescing bug, silently yields a ~1900 date |
| T7 — full range via real change events | `TimePeriodPicker.test.tsx` | component (unit) | GREEN on first run (flagged — behavior already correct, closes a coverage gap) |
| T3(g) — full range re-fetch | `FocusCalendarBoard.test.tsx` | page (integration) | GREEN on first run (flagged — behavior already correct, closes a coverage gap) |

**Sanity check (no collateral breakage):**
`cd client && npx vitest run src/components/__tests__/TimePeriodPicker.test.tsx src/pages/__tests__/FocusCalendarBoard.test.tsx`
→ 1 file failed (TimePeriodPicker, 1/8 red as intended) / 1 file passed
(FocusCalendarBoard, 10/10); 17 passed, 1 failed of 18 total. All
previously-existing cases in both files still pass unmodified.

**No product code was edited in Round 2.** Only
`client/src/components/__tests__/TimePeriodPicker.test.tsx` and
`client/src/pages/__tests__/FocusCalendarBoard.test.tsx` were changed —
both test files, both already carrying the required author header (edits
only, no new files this round).
