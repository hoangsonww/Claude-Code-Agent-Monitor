# Coverage Map — focus-report-fidelity (List-view parity)

No `PROJECT-CONTEXT.md` is configured for this repo (confirmed absent at
project root). Test stack, run commands, and conventions below were
discovered directly from `package.json` / `client/package.json` and the
existing test directories, per `CLAUDE.md`'s own "Commands you should know"
section (which itself matches what's actually runnable).

Layers this project tests at (discovered, not assumed):
- **Server unit/integration** — `node --test server/__tests__/*.test.js`
  (`npm run test:server`). One flat layer; no separate "unit vs
  integration" split — route-level tests (e.g. `GET /:id/transcript...`)
  and pure-function tests (e.g. `mergeIntervals`) live in the same files/run.
- **Client unit** (`client/src/lib/__tests__/*.test.ts`) and **client
  component** (`client/src/components/__tests__/*.test.tsx`, `client/src/pages/__tests__/*.test.tsx`)
  — both run via `vitest run` (`npm run test:client`, or targeted with
  `cd client && npx vitest run <path>`). No separate e2e/browser layer
  exists in this repo (no Playwright/Cypress config found) — component
  tests via React Testing Library are the deepest UI layer.
- No project/tag/bucket convention (no `smoke`/`regression`/`serial`
  grouping) — every suite in each package.json script always runs as one
  full pass; targeted runs are just a file-path argument to `vitest run` or
  a glob on `node --test`.

## 1. Existing coverage by surface

### Surface: `server/lib/focus-report.js` — `inferredSegment()`

- **File:** `server/__tests__/focus-report.test.js` (608 lines, 908→ soon
  more `it()` blocks across 6 `describe` blocks: `buildFocusSegments`,
  `buildSessionFocusReport - idle grace window`, `buildActivityChunks`,
  `buildSessionFocusReport - activity chunks`, `buildProjectFocusReport`,
  `mergeIntervals`).
- **Confirmed by direct grep of every `describe(` block in the file: none
  targets `inferredSegment` by name or exercises its code path.** Every
  existing declared-segment test seeds a `Focus` "set"/"push"/"pop"/"done"
  event, so `buildFocusSegments` always returns ≥1 segment and
  `buildSessionFocusReport` never falls through to
  `inferredSegment(dbModule, session, endAt)` (the `if (segments.length ===
  0)` branch at `server/lib/focus-report.js:275-278`). The sibling file
  `server/__tests__/focus-inference.test.js` tests the *classifier that
  writes* `focus_inferences` rows (`focus-inference.js`), not the *read-side
  consumption* of those rows inside `focus-report.js`.
- **Verdict: UNGUARDED.** The brief's claim of a "zero-coverage gap" is
  confirmed real, not stale. No existing test would catch a regression in
  any of: item-kind resolution via `getPlanItemById`, detour-kind handling,
  a deleted-item's `item_id` failing to resolve, an `unclassified`/no-row
  verdict, or — the highest-value case — the round-3-shaped idle-tail bug
  reappearing on the *inferred* path specifically (the declared-segment
  version of that exact scenario **is** covered, at
  `server/__tests__/focus-report.test.js:385-412`, `buildSessionFocusReport
  - activity chunks`, but that seeds a declared `Focus` "set" event, so it
  never touches `inferredSegment` itself).

### Surface: `FocusReportModal.tsx` List view (3 duration bars + header)

- **File:** `client/src/components/__tests__/FocusReportModal.test.tsx`
  (338 lines, 13 `it()` blocks, all currently green).
- What's covered today: loading/error/empty states; the on-item-percentage
  stat-tile math (`75%`/`25%`, from `active_ms`); the concurrency-ratio and
  wall-clock stat tiles; per-session name/link rendering and per-item
  rollup row presence; the "≈ inferred" chip (badge, tooltip text, and the
  visible-caption naming what an inferred single-segment session was
  attributed to, for both `item` and `detour` kinds); Escape/backdrop/close-
  button dismissal; the List/Calendar toggle switching bodies without a
  second fetch.
- **Confirmed by direct read (line 23-94): `makeReport()`'s base fixture
  has `active_ms === wall_ms` for every segment and every totals bucket**
  (segment 1: `wall_ms: active_ms: 30m`; segment 2: `wall_ms: active_ms:
  10m`; `report.totals`: `wall_ms: 50m, active_ms: 40m` — only the
  *idle_ms-bearing* `bug` kind's totals bucket has `idle_ms: 10m`, but no
  individual *segment* object in the fixture has `active_ms < wall_ms`).
  This is exactly the structural reason given in the brief/plan: no
  existing assertion can distinguish a bar sized by `wall_ms` from one sized
  by `active_ms`, because they're numerically identical in every fixture
  used today.
- Nothing in this file exercises: an idle-stripe overlay (no
  `data-testid="idle-stripe"` query anywhere in this file today — grep
  confirms zero occurrences), a labeled wall-clock/agent-time split on the
  per-session header, `sizeField`/`chunks` on `SegmentedBar`'s prop type
  (doesn't exist in the component yet either — confirmed by direct read of
  `FocusReportModal.tsx:387-424`), or any cross-view (List vs Calendar)
  consistency check.
- **Verdict:**
  - Loading/error/empty/toggle/inferred-chip/link behavior: **GUARDED**
    (unaffected by this change; will keep passing without modification).
  - The on-item-percentage assertion (`75%/25%`): **GUARDED but will need
    a deliberate update** — the plan's own §6.B.1 calls out the value must
    become `67%/33%` once the fixture's `active_ms < wall_ms`; this is an
    expected planned edit to an existing green assertion, not a gap.
  - Per-session bar's idle-stripe overlay, labeled dual wall-clock/agent-
    time header text, and the two aggregate bars' `active_ms`-vs-`wall_ms`
    sizing (the embedded bug this pass exists to fix): **UNGUARDED** — no
    test today could fail if the aggregate bars stayed wall_ms-sized after
    the fix, or if the per-session bar's stripe overlay were wired
    incorrectly.
  - Cross-view (List vs Calendar) consistency: **UNGUARDED** — see §3
    below, this is also the registry/consistency gap.

### Surface: `FocusCalendarView.tsx` (reference pattern for the extraction)

- **File:** `client/src/components/__tests__/FocusCalendarView.test.tsx`
  (639 lines, 13 `it()` blocks, all currently green).
- Directly relevant, already-passing coverage that the refactor (technical-
  plan §3 item 2 / §4 step 3) must not break: two idle-stripe tests —
  "overlays an idle stripe only for the chunk with no activity, none for
  the active one" (asserts exactly 1 `[data-testid="idle-stripe"]` node,
  `top: 50%` / `height: 50%`) and "renders no idle stripe when every chunk
  in the segment is active" (asserts 0 stripe nodes) — plus "shows both
  wall-clock and agent time in the hover popup and the events-modal header"
  (asserts literal text `Wall clock: 2h 0m` / `Agent time: 23m 0s`, i.e. the
  exact `t("report.calendar.wallClockLabel")`/`t("report.calendar.activeLabel")`
  strings this pass must relocate).
- **Verdict: GUARDED**, and specifically positioned as a regression guard
  *for this change*: per the plan's own Definition of Done and §6.C, this
  file "should need zero assertion changes" after the `idleStripesInRange`
  extraction and the i18n key relocation — if any assertion here needs
  touching, that is itself the signal that step went beyond a pure refactor
  (a directly falsifiable claim, not just an assumption). Re-running this
  file alone after each of steps 3/4/5 (as the plan's own §4 sequencing
  specifies) is the correct verification gate, not a full-suite rerun each
  time.

### Surface: `client/src/lib/calendarLanes.ts` / `eventBuckets.ts` (siblings of the new `idleStripes.ts`)

- **Files:** `client/src/lib/__tests__/calendarLanes.test.ts` (8 tests, pure
  function `assignLanes()`) and `client/src/lib/__tests__/eventBuckets.test.ts`
  (6 tests, pure function `bucketEvents()`). Both **GUARDED** and unaffected
  by this change — neither is touched by the plan, cited here only as the
  naming/location convention the new `client/src/lib/idleStripes.ts` +
  `client/src/lib/__tests__/idleStripes.test.ts` should follow (see §5).
- Neither file currently has any test for the *soon-to-be-extracted*
  `idleStripesForBlock`/`idleStripesInRange` logic itself as a standalone
  unit — that logic is presently only exercised indirectly, through
  `FocusCalendarView.test.tsx`'s two idle-stripe assertions (component-level,
  not a dedicated lib-level unit test). Once extracted to
  `client/src/lib/idleStripes.ts`, it has **no dedicated unit test of its
  own** unless one is added — worth flagging as a place the architects
  should add direct coverage (percent-math edge cases: a chunk straddling
  the range boundary, an out-of-range chunk, empty/undefined `chunks`),
  not just rely on the two call sites' component tests to exercise it
  indirectly.

## 2. Coverage verdict summary

| Surface | Verdict | Why |
|---|---|---|
| `inferredSegment()` (server) | **UNGUARDED** | Confirmed zero dedicated `describe`/`it` targets this function or its code path anywhere in `server/__tests__/focus-report.test.js`. |
| List view per-session bar: idle-stripe overlay + labeled dual header | **UNGUARDED** | Feature doesn't exist yet; fixture can't distinguish it once built (`active_ms === wall_ms` everywhere). |
| List view aggregate bars (rollup, project-split): `active_ms` sizing (the embedded bug) | **UNGUARDED** | Same fixture limitation — bar-vs-label mismatch is numerically invisible today. |
| List-vs-Calendar cross-view consistency | **UNGUARDED** | No test in either file compares the two views' numbers for the same segment; this is also the registry/consistency gap (§3). |
| `FocusCalendarView.tsx` idle-stripe/dual-time-label behavior (pre-existing, round-4) | **GUARDED** | 3 targeted assertions exist and pass; must stay green unmodified through the refactor. |
| `FocusReportModal.tsx` loading/error/empty/toggle/inferred-chip/close behavior | **GUARDED** | Existing assertions, untouched by this change. |
| `FocusReportModal.tsx` on-item-percentage stat tile | **PARTIAL** | Guarded today (75%/25% is asserted and passes), but the assertion's expected values are stale relative to the new fixture the plan requires (67%/33%) — must be updated *as part of* this change, not left alone, or it will assert against numbers no longer produced by the new fixture. |
| `calendarLanes.ts` / `eventBuckets.ts` | **GUARDED** | Unaffected siblings; cited for convention only. |
| `idleStripesForBlock`/`idleStripesInRange` as a standalone lib unit | **UNGUARDED** (pre-existing gap, widens with this change) | Only ever exercised today through `FocusCalendarView`'s component test, not as a lib-level unit; once it's promoted to a shared `lib/idleStripes.ts` with a second consumer, it has no dedicated unit test of its own unless one is added. |

## 3. Registry/consistency gap check

This project has no formal, named defect-class catalog (confirmed absent —
flagged in the change brief itself for Sara's call, not decided here) and
no single canonical *data* registry that multiple code paths must agree
with in the usual sense (e.g. no shared enum/config table driving several
variants). However, the brief itself names the applicable analog
explicitly: **a derived/summary value (`wall_ms`/`active_ms`/`chunks`,
computed once in `server/lib/focus-report.js`) consumed by two independent
client rendering surfaces (List view, Calendar view) with no shared
rendering helper and, as of today, no test enforcing they agree.**
Evaluated against that:

- `FocusCalendarView.tsx` (Calendar view): **GUARDED** for its own internal
  self-consistency (idle-stripe placement, dual wall-clock/agent-time
  label) — but nothing asserts it *agrees with* the List view for the same
  segment.
- `FocusReportModal.tsx`'s List view: **UNGUARDED** for the identical
  fields today (pre-change), and will remain **UNGUARDED** for cross-view
  agreement even after the List-view fix lands, unless the plan's §6.B.5
  cross-view consistency test is actually written. This is not a
  hypothetical: the brief states this exact shape has already caused one
  shipped-but-incomplete fix this session (Calendar got the idle-aware
  treatment in round 4; List didn't, silently, until this pass). No
  defect-catalog id exists to cite (none configured for this repo) — this
  finding is that gap's second occurrence, called out plainly per the
  brief's own framing, and is the single highest-value test this change set
  can add.
- The `idleStripesForBlock`→`idleStripesInRange` extraction is the
  mechanism meant to prevent a *third* occurrence (a second, independently-
  reimplemented stripe-math instead of a shared helper) — but the
  extraction itself, as noted above, has no dedicated unit test; only
  component-level tests exercise it through either view.

## 4. Current baseline (actually run)

- `npm run test:server` → **902/902 pass**, 198 suites, 0 fail, 0
  cancelled, 0 skipped (ran fresh, just now; matches the change brief's and
  technical plan's stated baseline exactly).
- `cd client && npx vitest run` (equivalent to `npm run test:client`) →
  **403/403 pass**, 36 files, 0 failures (ran fresh, just now; matches
  brief/plan). Specifically confirmed within this run:
  - `src/components/__tests__/FocusReportModal.test.tsx` — 13/13 pass.
  - `src/components/__tests__/FocusCalendarView.test.tsx` — 13/13 pass.
  - `src/lib/__tests__/calendarLanes.test.ts` — 8/8 pass.
  - `src/lib/__tests__/eventBuckets.test.ts` — 6/6 pass.
  - `src/pages/__tests__/screens.snapshot.test.tsx` — 12/12 pass; direct
    grep of that file for `FocusReportModal|FocusCalendarView` returns
    **zero matches**, confirming the brief's claim that neither modal is
    currently rendered by the snapshot suite (so no snapshot diff is
    expected from this change — a false positive there would itself be a
    signal, per the brief's own note).
- `bash .claude/skills/file-headers/scripts/check-headers.sh` → **clean**
  ("All applicable files carry the authorship header"), covering the
  untracked round-4 files too (`SegmentEventsModal.tsx`, `eventBuckets.ts`
  + its test).
- Nothing was un-runnable; no service dependency needed for any of the
  above (server tests spin up their own temp SQLite DB per file; client
  tests are pure Vitest/RTL, no live backend).
- Did **not** run the full `npm run mcp:typecheck` / `mcp:build` — out of
  scope, this change touches no MCP surface per the technical plan's change
  set (§3: client + server test-only + docs, no `mcp/` files listed).

## 5. Conventions in play (for the architects)

- **Server tests:** one file per lib module, `server/__tests__/<module>.test.js`,
  using `node:test` (`describe`/`it`/`before`/`after`/`beforeEach`) +
  `node:assert/strict`. The new `inferredSegment` coverage belongs in the
  existing `server/__tests__/focus-report.test.js` as one more `describe`
  block (per the technical plan's own §6.A, which already sketches the
  exact block name and 5 cases) — not a new file; this file already mixes
  multiple `describe` blocks per source module by function/concern
  (`buildFocusSegments`, `buildActivityChunks`, `buildProjectFocusReport`,
  `mergeIntervals`, etc.), so a 7th block is the established pattern, not a
  deviation. Seeding helpers to reuse: `seedSession`, `focus(sessionId,
  minute, summary, data)`, `activity(sessionId, minute)`, `t(minutesFromStart)`,
  `nextId(prefix)` (all already defined at the top of the file); for
  seeding a `focus_inferences` row specifically, mirror
  `server/__tests__/focus-inference.test.js`'s own use of
  `stmts.upsertFocusInference.run(...)` (confirmed present as a sibling
  test file using that exact statement).
- **Client component tests:** one file per component,
  `client/src/components/__tests__/<Component>.test.tsx`, Vitest +
  `@testing-library/react`, `vi.mock("../../lib/api", ...)` for network
  boundaries, a local `makeReport()`/`makeCalendar()`-style fixture
  builder taking `Partial<...>` overrides, and `fireEvent`/`screen`/`within`
  queries by visible text/title/role rather than snapshot matching. New
  List-view idle-stripe/active_ms-sizing/cross-view assertions belong in
  the existing `client/src/components/__tests__/FocusReportModal.test.tsx`,
  reusing `data-testid="idle-stripe"` as the shared grep-discoverable
  convention the plan itself specifies (already established one-way by
  `FocusCalendarView.test.tsx`'s own stripe queries) — not a new file, and
  not a new `data-testid` name.
- **Client lib unit tests:** one file per pure-function module,
  `client/src/lib/__tests__/<module>.test.ts` (no `.tsx`, no
  render/DOM), Vitest only. The new `client/src/lib/idleStripes.ts` is a
  direct sibling of `calendarLanes.ts`/`eventBuckets.ts` in both location
  and shape (small, pure, single-purpose, doc-commented file header module);
  a `client/src/lib/__tests__/idleStripes.test.ts` following that same
  pattern (plain `describe`/`it`/`expect`, a tiny local fixture builder,
  no component rendering) is the natural, convention-matching home for a
  dedicated unit test of the extracted percent-math — currently the one
  piece of this change set with no lib-level test named in the technical
  plan's own §6, worth the architects considering explicitly rather than
  leaving `idleStripesInRange` covered only indirectly through two
  component suites.
- **No project/tag/bucket convention** anywhere in this repo's test
  tooling (no `@smoke`/`@regression` tags, no separate CI stage config
  found) — every suite always runs as a whole; a "targeted run" is just
  invoking `vitest run <path>` or scoping `node --test` to fewer files,
  which is exactly what the technical plan's own §4 step-by-step sequencing
  already does.
