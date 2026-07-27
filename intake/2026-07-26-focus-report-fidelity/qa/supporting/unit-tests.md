# Unit / Component Test Design — focus-report-fidelity (List-view parity)

Builds on `technical-plan.md` §6 (do not re-derive that reasoning; this
refines it into byte-level spec/case/assertion detail an implementer can
transcribe without guessing). Grounded in direct reads of:
`server/lib/focus-report.js`, `server/__tests__/focus-report.test.js`,
`server/__tests__/focus-inference.test.js`, `client/src/components/FocusReportModal.tsx`,
`client/src/components/FocusCalendarView.tsx`,
`client/src/components/__tests__/{FocusReportModal,FocusCalendarView}.test.tsx`,
`client/src/lib/__tests__/{calendarLanes,eventBuckets}.test.ts`,
`client/src/lib/types.ts`, `client/src/i18n/__tests__/i18n.test.ts`,
`client/src/i18n/locales/en/plan.json`, `server/db.js` (`stmts.upsertFocusInference`/
`getPlanItemById`/`getFocusInference` signatures).

No `PROJECT-CONTEXT.md` or defect-catalog is configured for this repo (confirmed
absent). The one named invariant class this pass exists to pin — per
`qa/change-brief.md`'s "Variant relevance" section — is: **two independent
rendering surfaces (List view, Calendar view) must state the same
wall_ms/active_ms/chunks-derived facts for the same segment, and must do so
through one shared computation, not two.** Every assertion below is written
in that frame where it applies.

---

## 1. Server — `server/__tests__/focus-report.test.js` (node:test)

New `describe("inferredSegment / buildSessionFocusReport - inferred fallback", ...)`
block. Insert it **between** the existing `describe("buildSessionFocusReport -
activity chunks", ...)` block (ends line 412) and `describe("buildProjectFocusReport", ...)`
(starts line 414) — this matters: `buildProjectFocusReport`'s own tests set
`process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "0"` per-test and never
restore it, while `"buildSessionFocusReport - idle grace window"` (the block
before "activity chunks") *does* restore it via its own `after()`. Placing the
new block in this slot means it inherits the file's untouched default grace
(`DEFAULT_GRACE_SECONDS` = 300s / 5min) with no explicit env var needed —
matching the sibling "activity chunks" test's own convention (no override).
**Do not set the grace env var in this new block**; if a future edit moves it
after `buildProjectFocusReport`, it must add its own `beforeEach`/`after`
save-restore pair mirroring the idle-grace-window block, or it will silently
inherit a leaked `"0"`.

Use the file's existing helpers unchanged: `seedSession(id, cwd)`, `focus(id,
minute, summary, data)`, `activity(id, minute)`, `t(minutesFromStart)`,
`nextId(prefix)`. Seed via `stmts.upsertFocusInference.run(sessionId, cwd,
kind, item_id, label, confidence, method, reason)` — confirmed exact column
order from `server/db.js:1911-1923` (matches `focus-inference.test.js`'s own
usage). Reuse the file's own `before()`-seeded fixture: `CWD` +
`item-4` (`item_number: 4`, text `"Migrate auth"`).

Every case below calls `buildSessionFocusReport(dbModule, { id, name:
"Report Test", cwd: CWD, ended_at: t(N) })` — deliberately **not** passing
`started_at`, so `inferredSegment()`'s fallback path (`session.started_at ||
<earliest event's created_at>`, line 226-231 of `focus-report.js`) is what's
under test, not the `started_at`-present branch (that branch is already
implicitly exercised by `focus-inference.test.js`'s real-timestamp suite —
this new block's job is the deterministic-timestamp, display-number-resolution,
and idle/chunk-fidelity angles that file doesn't cover).

### Case 1 — item-kind inference resolves to the item's *current* display number/text
```js
it("resolves an item-kind inference to the plan item's current display number and text", () => {
  const id = nextId("sess");
  seedSession(id, CWD);
  activity(id, 0); // one non-Focus event: buildFocusSegments -> [], gives inferredSegment a start to fall back to
  stmts.upsertFocusInference.run(id, CWD, "item", "item-4", null, 0.9, "llm", "matched auth work");

  const report = buildSessionFocusReport(dbModule, { id, name: "Report Test", cwd: CWD, ended_at: t(20) });
  assert.equal(report.segments.length, 1);
  const seg = report.segments[0];
  assert.equal(seg.kind, "item");
  assert.equal(seg.item_number, 4);
  assert.equal(seg.label, "Migrate auth"); // item's CURRENT text via getPlanItemById, not a snapshot
  assert.equal(seg.inferred, true);
  assert.equal(seg.inferred_reason, "matched auth work");
  assert.equal(seg.start, t(0));
  assert.equal(seg.end, t(20));
});
```
**Red-first:** guards that resolution goes through `getPlanItemById(session.cwd,
row.item_id)`'s *current* `item_number`/`text` at read time. If a future
change stopped doing that lookup (e.g., returned early with a stale/undefined
number, or read some cached value instead), `seg.item_number`/`seg.label`
would not equal `4`/`"Migrate auth"` and this fails.

### Case 2 — detour-kind inference
```js
it("resolves a detour-kind inference to a detour segment with no item_number", () => {
  const id = nextId("sess");
  seedSession(id, CWD);
  activity(id, 0);
  stmts.upsertFocusInference.run(id, CWD, "detour", null, "CI pipeline fix", 0.8, "llm", "no item covers CI");

  const report = buildSessionFocusReport(dbModule, { id, name: "Report Test", cwd: CWD, ended_at: t(15) });
  assert.equal(report.segments.length, 1);
  const seg = report.segments[0];
  assert.equal(seg.kind, "detour");
  assert.equal(seg.item_number, null);
  assert.equal(seg.label, "CI pipeline fix");
  assert.equal(seg.inferred, true);
  assert.equal(seg.inferred_reason, "no item covers CI");
});
```
**Red-first:** if the `row.kind === "detour"` branch (line 246-256) ever
started resolving `item_number` from something other than a hardcoded `null`
(e.g., copying an unrelated field), this fails on `item_number`.

### Case 3 — deleted-item inference → zero segments (not a fabricated one)
```js
it("treats an inference pointing at a since-deleted plan item as no usable inference", () => {
  const id = nextId("sess");
  seedSession(id, CWD);
  activity(id, 0);
  stmts.upsertFocusInference.run(id, CWD, "item", "item-does-not-exist", null, 0.9, "llm", "r");

  const report = buildSessionFocusReport(dbModule, { id, name: "Report Test", cwd: CWD, ended_at: t(10) });
  assert.deepEqual(report.segments, []);
});
```
**Red-first:** guards the `if (!item || item.item_number == null) return null;`
guard at line 235. If removed/weakened, this would instead return a segment
with a null/garbage `item_number`, and `report.segments.length` would be `1`,
not `0` — a silently-wrong item attribution shipping instead of an honest gap.

### Case 4 — unclassified verdict → zero segments (inference-specific path)
```js
it("keeps an unclassified verdict an honest hole, not a fabricated segment", () => {
  const id = nextId("sess");
  seedSession(id, CWD);
  activity(id, 0);
  stmts.upsertFocusInference.run(id, CWD, "unclassified", null, null, null, "heuristic", "r");

  const report = buildSessionFocusReport(dbModule, { id, name: "Report Test", cwd: CWD, ended_at: t(10) });
  assert.deepEqual(report.segments, []);
});
```
Distinct from the pre-existing "never declared focus" case (no inference row
at all, `focus-report.test.js:204-208`/`329-340`) — this pins the specific
`row.kind === "unclassified"` early-return at line 224, with a real row
present. **Red-first:** if that check were dropped, `row` would fall through
to the `if (row.kind === "item" ...)`/`detour` branches, neither of which
match `"unclassified"`, so it would already return `null` today by
happenstance of the `if` chain — but a plausible refactor (e.g., a `switch`
with a `default` case) could easily start treating unclassified as a detour.
This test fails immediately if that happens.

### Case 5 — round-3-shaped case via the inference path (highest-value, per QA)
```js
it("keeps an inferred whole-session segment idle-aware over a long idle tail after an initial burst (round-3 regression, inference path)", () => {
  const id = nextId("sess");
  seedSession(id, CWD);
  // Burst in the first ~10 minutes, then silence until ended_at - the exact
  // shape of the round-3 bug (see the sibling declared-segment version of
  // this test at focus-report.test.js:385-411), but reached via
  // inferredSegment() instead of a declared Focus "set" event.
  activity(id, 1);
  activity(id, 4);
  activity(id, 8);
  stmts.upsertFocusInference.run(id, CWD, "item", "item-4", null, 0.9, "llm", "matched auth work");

  const report = buildSessionFocusReport(dbModule, { id, name: "Report Test", cwd: CWD, ended_at: t(130) });
  assert.equal(report.segments.length, 1);
  const seg = report.segments[0];
  assert.equal(seg.wall_ms, 130 * 60_000); // rides to the full span - the bug's raw material
  assert.ok(seg.active_ms < seg.wall_ms, "active_ms must be discounted below the raw wall_ms span");
  assert.equal(seg.chunks.length, Math.ceil((130 * 60_000) / CHUNK_MS));
  assert.equal(seg.chunks[0].active, true);
  assert.ok(
    seg.chunks.slice(1).every((c) => c.active === false),
    "every chunk after the first burst should read idle"
  );
});
```
**Red-first:** this is the single highest-value case. `inferredSegment()`
builds a segment shape structurally different from a declared one (only
`kind`/`label`/`item_number`/`start`/`end`/`inferred`/`inferredReason` — no
`chunks` of its own), which is synthesized purely by `buildSessionFocusReport`'s
shared `enriched = segments.map(...)` step (line 295-312) that calls
`activeIdleMs`/`buildActivityChunks` identically for both declared and
inferred segments. If a future change ever special-cased inferred segments
(e.g., skipped chunk-building because "there's no real declared segment to
chunk"), `active_ms` would silently equal `wall_ms` again and `chunks` would
be empty/wrong-length — this is exactly the round-3 bug reincarnated in the
one segment-origin path this repo has never covered until now (neither this
file's other tests, which are all declared-segment, nor
`focus-inference.test.js`'s own "renders an inferred whole-session item
segment" test, which uses real wall-clock timestamps and never asserts
`active_ms`/`chunks` at all).

---

## 2. Client — `client/src/components/__tests__/FocusReportModal.test.tsx` (Vitest + Testing Library)

### 2.1 Fixture fix — `makeReport()` base fixture (§6.B.1 of the plan)

Current fixture (lines 32-56) has segment 1 (`item`, 4, "Migrate auth") at
`wall_ms: active_ms: 30m, idle_ms: 0` — every segment has `active_ms ===
wall_ms`, which is structurally why the current suite cannot catch a
wrong-field-sizing bug (a bar sized by either field looks identical). Change:

```ts
// segment 1 - now idle-aware
{
  kind: "item", item_number: 4, label: "Migrate auth",
  start: "2026-06-10T09:00:00.000Z", end: "2026-06-10T09:30:00.000Z",
  wall_ms: 30 * 60_000, active_ms: 20 * 60_000, idle_ms: 10 * 60_000,
  inferred: false, inferred_reason: null,
  chunks: [
    { start: "2026-06-10T09:00:00.000Z", end: "2026-06-10T09:10:00.000Z", active: true },
    { start: "2026-06-10T09:10:00.000Z", end: "2026-06-10T09:20:00.000Z", active: true },
    { start: "2026-06-10T09:20:00.000Z", end: "2026-06-10T09:30:00.000Z", active: false },
  ],
},
// segment 2 - unchanged (wall_ms === active_ms, NO `chunks` field at all -
// this segment's absence of chunks is what exercises the "no chunks -> no
// stripe" guard)
{
  kind: "bug", item_number: 4, label: "npm conflict",
  start: "2026-06-10T09:30:00.000Z", end: "2026-06-10T09:40:00.000Z",
  wall_ms: 10 * 60_000, active_ms: 10 * 60_000, idle_ms: 0,
  inferred: false, inferred_reason: null,
},
```

Recompute (verified by direct arithmetic, not re-derived from the plan
verbatim):
- `items[0].totals`: `wall_ms: 40*60_000` (unchanged, 30+10), `active_ms:
  30*60_000` (20+10, was 40), `idle_ms: 10*60_000` (was 0); `by_kind.item:
  {wall_ms: 30*60_000, active_ms: 20*60_000, idle_ms: 10*60_000}` (was
  `{30,30,0}`); `by_kind.bug` unchanged `{10*60_000,10*60_000,0}`.
- `totals` (project-level): `active_ms: 30*60_000` (was `40*60_000`);
  `by_kind.item: {wall_ms: 30*60_000, active_ms: 20*60_000, idle_ms:
  10*60_000}` (was `{30,30,0}`). **Leave `totals.wall_ms` (`50*60_000`) and
  `totals.idle_ms` (`10*60_000`) exactly as-is** — these two fields are
  already deliberately decoupled from the segment sums in this fixture (the
  pre-existing "Idle excluded" tile test reads `totals.idle_ms` directly, the
  concurrency tests override `wall_clock_ms`/`concurrency_ratio` directly);
  the plan's own risk note (`technical-plan.md` §8, "Fixture-value ripple")
  confirms these two don't need to change. Do not "fix" this apparent
  inconsistency as part of this pass — it's out of scope and unrelated tests
  depend on the current values.

**Update the existing "computes the on-item percentage" test** (line
138-149): 20m item-active ÷ 30m total-active = 67% (`Math.round(20/30*100)`),
not 75%. Change both `expect(screen.getByText("75%"))` →
`expect(screen.getByText("67%"))` and `"25%"` → `"33%"`. **Red-first for this
specific edit:** this isn't a new regression guard, it's a deliberate,
plan-called-out side effect (technical-plan.md §6.B.1/§8) — flag it as
expected in the PR, not a defect. (Re-verify: `Math.round((10/30)*100) = 33`,
and the component's `offPlan` tile computes `Math.max(0, 100 - onItemPct)` =
`100 - 67 = 33` — consistent, no rounding-sum drift to worry about.)

Double-check every *other* existing assertion in the file against these new
numbers before submitting (per the plan's own instruction) — in particular
the "shows the concurrency ratio..." and "falls back to a dash..." tests both
pass `wall_clock_ms`/`concurrency_ratio` as overrides and don't read the
base segment numbers, so they're unaffected; the "badges sessions..." and
"shows a visible caption..." tests push their *own* second session with its
own literal segment values and don't read `report.totals`, so also unaffected.

### 2.2 New test — per-session header shows labeled wall-clock/agent-time split when they diverge, plain number when they don't

```ts
it("shows a labeled wall-clock/agent-time split in the per-session header when they diverge, a plain number when they don't", async () => {
  const report = makeReport();
  report.sessions.push({
    session_id: "sess-plain",
    name: "NoIdle",
    cwd: "/repo",
    ended_at: "2026-06-10T11:15:00.000Z",
    segments: [
      {
        kind: "feature", item_number: null, label: "small feature",
        start: "2026-06-10T11:00:00.000Z", end: "2026-06-10T11:15:00.000Z",
        wall_ms: 15 * 60_000, active_ms: 15 * 60_000, idle_ms: 0,
        inferred: false, inferred_reason: null,
      },
    ],
  });
  focusReportMock.mockResolvedValue(report);
  renderModal();
  await screen.findByText("Per-session breakdown");

  // "Worker" (session-1) diverges: wall 40m vs active 30m.
  const workerRow = screen.getByText("Worker").closest(".space-y-1\\.5") as HTMLElement;
  expect(within(workerRow).getByText(/40m 0s/)).toBeInTheDocument();
  expect(within(workerRow).getByText(/30m 0s/)).toBeInTheDocument();

  // "NoIdle" doesn't diverge: exactly one number, no dual-label text.
  const plainRow = screen.getByText("NoIdle").closest(".space-y-1\\.5") as HTMLElement;
  expect(within(plainRow).getByText("15m 0s")).toBeInTheDocument();
  expect(within(plainRow).queryByText(/30m 0s|40m 0s/)).not.toBeInTheDocument();
});
```
Note: select the row via the outer `.space-y-1.5` wrapper (the per-session
`<div>` at `FocusReportModal.tsx:248`), not `.closest("div")`, since the name
and the duration text are siblings a level further up than the immediate
parent — verify the exact selector once the implementation lands; a
`data-testid="session-row"` on that wrapper div is a cheap, worthwhile
addition if the implementer wants a more robust hook than a Tailwind class
selector (same spirit as the `data-testid="idle-stripe"` hook already
planned for this file).

**Red-first:** current (pre-fix) code always renders a single
`{formatMs(totalMs)}` (`wall_ms` only, line 267-269) — for "Worker" that's
"40m 0s" with no "30m 0s" anywhere in that row at all. Asserting `within(workerRow).getByText(/30m 0s/)`
fails against today's code and only passes once the dual-label branch is
added.

### 2.3 New test — per-session bar overlays exactly one idle stripe, only for the segment with a `chunks` field

Mirrors `FocusCalendarView.test.tsx`'s two idle-stripe tests
(lines 537-601) near-verbatim, using the same `data-testid="idle-stripe"`
convention (per technical-plan.md §4 step 5, this is deliberately the same
family so both suites are one grep away from each other).

```ts
it("overlays exactly one idle stripe on the per-session bar, for the segment carrying an idle chunk", async () => {
  focusReportMock.mockResolvedValue(makeReport());
  const { container } = renderModal();
  await screen.findByText("Per-session breakdown");

  const stripes = container.querySelectorAll('[data-testid="idle-stripe"]');
  expect(stripes).toHaveLength(1); // segment 2 (bug) has no `chunks` field at all -> no stripe for it
  // Segment 1 spans 09:00-09:30 (30m); its idle chunk is the last third
  // (09:20-09:30) -> offset 66.67%, span 33.33% of THAT SEGMENT's own slice
  // width (not the whole bar).
  const style = (stripes[0] as HTMLElement).style;
  expect(parseFloat(style.left)).toBeCloseTo((20 / 30) * 100, 1);
  expect(parseFloat(style.width)).toBeCloseTo((10 / 30) * 100, 1);
});

it("renders no idle stripe for a segment with no chunks field, even next to one that has stripes", async () => {
  // Same fixture, already covered by the assertion above (stripes.length===1,
  // not 2) - restated as its own case per FocusCalendarView.test.tsx's
  // convention of a dedicated "no idle stripe" test rather than folding it
  // into the positive case only.
  focusReportMock.mockResolvedValue(makeReport({
    sessions: [
      {
        session_id: "sess-1", name: "Worker", cwd: "/repo",
        ended_at: "2026-06-10T09:40:00.000Z",
        segments: [
          {
            kind: "bug", item_number: 4, label: "npm conflict",
            start: "2026-06-10T09:00:00.000Z", end: "2026-06-10T09:10:00.000Z",
            wall_ms: 10 * 60_000, active_ms: 10 * 60_000, idle_ms: 0,
            inferred: false, inferred_reason: null,
          },
        ],
      },
    ],
  }));
  const { container } = renderModal();
  await screen.findByText("Per-session breakdown");
  expect(container.querySelectorAll('[data-testid="idle-stripe"]')).toHaveLength(0);
});
```
Use `parseFloat(...).toBeCloseTo(...)` rather than string equality — unlike
`FocusCalendarView.test.tsx`'s round 50%/50% fixture, this segment's 30-minute
span with a 1/3-idle chunk produces a repeating decimal
(`66.66666666666666...%`); asserting the numeric value with a tolerance is
more robust than pinning the exact floating-point string.

**Red-first:** current `SegmentedBar` (`FocusReportModal.tsx:387-424`) has no
chunk/idle-stripe logic at all — no element with this testid can exist today,
so `stripes` is empty and `toHaveLength(1)` fails against the pre-fix code;
it only passes once the `idleStripesInRange` overlay is wired in per
technical-plan.md §4 step 5.

### 2.4 New test — per-item rollup and project-split bars sized by `active_ms`, matching their already-correct printed number

This is the **direct regression test for the embedded bug** (pm-plan.md §2):
a fix that changes only the printed number, or only the bar, without changing
both together, fails this test.

```ts
it("sizes the per-item rollup bar and the project-split bar by active_ms, not wall_ms", async () => {
  focusReportMock.mockResolvedValue(makeReport());
  const { container } = renderModal();
  await screen.findByText("Per-session breakdown");

  // Item rollup: item.totals = {item: active 20m, bug: active 10m} -> 67/33,
  // NOT the wall_ms-based 75/25 (item wall 30m vs bug wall 10m).
  const itemBar = container.querySelector('[data-testid="segmented-bar-item-rollup"]');
  const itemSlices = itemBar!.querySelectorAll("[data-kind]");
  expect(itemSlices).toHaveLength(2); // detour/feature are 0, filtered out
  expect(parseFloat((itemSlices[0] as HTMLElement).style.width)).toBeCloseTo((20 / 30) * 100, 1);
  expect((itemSlices[0] as HTMLElement).dataset.kind).toBe("item");
  expect(parseFloat((itemSlices[1] as HTMLElement).style.width)).toBeCloseTo((10 / 30) * 100, 1);
  expect((itemSlices[1] as HTMLElement).dataset.kind).toBe("bug");

  // Project-wide split: report.totals mirrors the same 20m/10m active split
  // in this single-item fixture -> same 67/33, for the same reason.
  const splitBar = container.querySelector('[data-testid="segmented-bar-project-split"]');
  const splitSlices = splitBar!.querySelectorAll("[data-kind]");
  expect(parseFloat((splitSlices[0] as HTMLElement).style.width)).toBeCloseTo((20 / 30) * 100, 1);
  expect(parseFloat((splitSlices[1] as HTMLElement).style.width)).toBeCloseTo((10 / 30) * 100, 1);
});
```
**Testability hook needed:** neither `SegmentedBar`'s per-kind slices nor the
three call sites are currently selectable in the DOM (no `data-testid`, no
`data-kind`, pseudo-segments render `label: null` so there's no text to query
either). Recommend the implementer add, in the same step that adds
`sizeField`/the idle-stripe overlay (technical-plan.md §4 step 5):
- `data-kind={seg.kind}` on every `SegmentedBar` slice `div` (cheap, mirrors
  the already-planned `data-testid="idle-stripe"` convention — a per-kind
  hook, not new behavior).
- `data-testid="segmented-bar-{session|item-rollup|project-split}"` on the
  three call sites (`FocusReportModal.tsx:279`, `:303-307`, `:316-320`) so
  tests can target each bar unambiguously instead of relying on Tailwind
  `h-5`/`h-3`/`h-6` height classes as a de facto selector.

If the implementer prefers not to add `data-testid`s to `SegmentedBar`
itself, the fallback selector is `container.querySelectorAll(".h-3 > div")` /
`.h-6 > div` (the rollup/split bars' distinguishing height class) — more
fragile (depends on exact Tailwind class strings staying put) but workable;
state which approach was taken in the PR so the next person doesn't have to
rediscover it.

**Red-first:** run this exact test against the file's current, still-committed
code (confirmed zero working-tree diff — sizing is `seg.wall_ms` unconditionally,
line 404) with the *new* fixture numbers in place: item kind wall_ms=30m vs
bug wall_ms=10m still produces a 75/25 width split today (component reads
`wall_ms`, and the new fixture didn't change either kind's `wall_ms`) —
asserting 67/33 fails against that code, and only passes once `sizeField:
"active_ms"` is wired to both call sites per technical-plan.md §4 step 6.
This is the cleanest red-first case in the whole set: the "before" state is
today's exact, currently-committed source, not a hypothetical.

---

## 3. New — cross-view (List vs. Calendar) consistency test

This is `technical-plan.md` §6.B.5 — "the permanent regression guard... the
one test that would have caught round 4 stopping at one consumer." Add it to
`FocusReportModal.test.tsx` (it drives the modal, which owns the List/Calendar
toggle; it is not a good fit for either view's own isolated test file since
its entire point is exercising both from one shared `report`).

**What it must assert, concretely** (per the prompt's own framing — build one
fixture, render both, check agreement — not vague "looks similar"):
1. The same two **numbers** (wall-clock ms and agent/active ms, formatted via
   the shared `formatMs`) appear in both the List view's per-session header
   and the Calendar view's hover popup for the *same* segment.
2. Both views agree on **which time is idle**: exactly one
   `data-testid="idle-stripe"` renders in each view for the one idle chunk,
   with proportionally equivalent geometry (List: horizontal
   `offsetPct`/`spanPct`; Calendar: vertical `topPct`/`heightPct` — different
   axis, same fractions, since both are computed by the one shared
   `idleStripesInRange` helper from the same `chunks`/range input).
3. Only ever **one fetch** — switching views must not re-request the report
   (already partially covered by an existing test at line 312-329; restated
   here scoped to this fixture as a sanity check, not a new invariant).

Use a **single-segment, single-session** report dated **today**, so "the same
segment's numbers" is unambiguous between List's per-session (summed-across-
segments) aggregation and Calendar's per-block (per-segment) aggregation —
they only cleanly coincide for a one-segment session (per plan's own
reasoning). Reuse/adapt `FocusCalendarView.test.tsx`'s `NOW`/`todayAt()`
pattern locally in this file (duplicate the ~6-line helper; the two test
files don't share a fixture module today and this pass isn't the place to
introduce one), scoped with `vi.useFakeTimers()`/`vi.setSystemTime(NOW)` for
the duration of this one test only (this file has no global fake-timer setup
today, unlike `FocusCalendarView.test.tsx` — don't add it file-wide, since
every other existing test in this file uses real 2026-06-10 literal
timestamps and doesn't care about "today").

```ts
it("states the same wall-clock/agent-time numbers and idle geometry in both List and Calendar view for the same segment", async () => {
  const NOW = new Date("2026-03-05T15:00:00.000Z");
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  function todayAt(hour: number, minute = 0): string {
    const d = new Date(NOW);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  }
  try {
    const report = makeReport({
      sessions: [
        {
          session_id: "sess-cross", name: "CrossView", cwd: "/repo",
          ended_at: todayAt(9, 20),
          segments: [
            {
              kind: "item", item_number: 6, label: "MCP Reliability",
              start: todayAt(9, 0), end: todayAt(9, 20),
              wall_ms: 20 * 60_000, active_ms: 10 * 60_000, idle_ms: 10 * 60_000,
              inferred: false, inferred_reason: null,
              chunks: [
                { start: todayAt(9, 0), end: todayAt(9, 10), active: true },
                { start: todayAt(9, 10), end: todayAt(9, 20), active: false },
              ],
            },
          ],
        },
      ],
      items: [],
    });
    focusReportMock.mockResolvedValue(report);
    const { container } = renderModal();
    await screen.findByText("Per-session breakdown");
    expect(focusReportMock).toHaveBeenCalledTimes(1);

    // --- List view ---
    const listRow = screen.getByText("CrossView").closest(".space-y-1\\.5") as HTMLElement;
    expect(within(listRow).getByText(/20m 0s/)).toBeInTheDocument(); // wall
    expect(within(listRow).getByText(/10m 0s/)).toBeInTheDocument(); // active
    const listStripes = container.querySelectorAll('[data-testid="idle-stripe"]');
    expect(listStripes).toHaveLength(1);
    expect(parseFloat((listStripes[0] as HTMLElement).style.left)).toBeCloseTo(50, 1);
    expect(parseFloat((listStripes[0] as HTMLElement).style.width)).toBeCloseTo(50, 1);

    // --- switch to Calendar ---
    fireEvent.click(screen.getByTitle("Calendar"));
    expect(focusReportMock).toHaveBeenCalledTimes(1); // still one fetch total
    const block = screen.getByText("CrossView").closest("a") as HTMLAnchorElement;
    fireEvent.mouseEnter(block);
    // Same two numbers, same units - not asserting identical surrounding
    // punctuation (Calendar's popup uses "Wall clock: 20m 0s", List's header
    // uses a different template per technical-plan.md §4 step 6) - only that
    // the SAME formatMs() outputs appear in both.
    expect(screen.getByText(/20m 0s/)).toBeInTheDocument();
    expect(screen.getByText(/10m 0s/)).toBeInTheDocument();
    const calendarStripes = container.querySelectorAll('[data-testid="idle-stripe"]');
    expect(calendarStripes).toHaveLength(1);
    expect(parseFloat((calendarStripes[0] as HTMLElement).style.top)).toBeCloseTo(50, 1);
    expect(parseFloat((calendarStripes[0] as HTMLElement).style.height)).toBeCloseTo(50, 1);
  } finally {
    vi.useRealTimers();
  }
});
```

**Red-first — this is the one that matters most:** run this test against the
state right after round 4 lands but *before* this pass's List-view fix (i.e.,
Calendar already idle-aware, List still `wall_ms`-only, no chunks/stripe
support at all in `SegmentedBar`). It fails on the very first List-view
assertion: the header shows only `"20m 0s"` (wall, unlabeled) with no `"10m
0s"` anywhere, and `listStripes` has length `0`, not `1` — reproducing
exactly the failure mode `qa/change-brief.md` names as "the second time in
this session this exact shape has caused a shipped-but-incomplete fix." Once
the List-view fix (§4 steps 5-6) lands, both assertions pass. This is the
literal mechanism such that a future fix landing in only one view again
(instead of going through the shared `idleStripesInRange` helper + the same
`active_ms`/`wall_ms` fields both views already read) reopens this exact
failure and is caught here before it ships.

---

## 4. New — `client/src/lib/__tests__/idleStripes.test.ts` (pure-function unit tests)

Mirrors `calendarLanes.test.ts`/`eventBuckets.test.ts`'s style exactly: no
rendering, no Testing Library, plain `describe`/`it`/`expect` over the
function's return value, small inline fixture builders.

```ts
/**
 * @file idleStripes.test.ts
 * @description Unit tests for idleStripesInRange() - the orientation-agnostic
 * generalization of FocusCalendarView's original idleStripesForBlock, shared
 * by FocusCalendarView (vertical top/height) and FocusReportModal's
 * SegmentedBar (horizontal left/width). Covers the empty/malformed-range
 * guard, one-stripe-per-idle-chunk, partial-overlap clipping, out-of-range
 * chunks, and a byte-for-byte port of FocusCalendarView.test.tsx's own two
 * idle-stripe fixtures (the refactor's own "must not change behavior" guard).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
import { describe, it, expect } from "vitest";
import { idleStripesInRange } from "../idleStripes";
import type { FocusReportChunk } from "../types";

function chunk(startMs: number, endMs: number, active: boolean): FocusReportChunk {
  return { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString(), active };
}

describe("idleStripesInRange", () => {
  it("returns no stripes for undefined or empty chunks", () => {
    expect(idleStripesInRange(undefined, 0, 100)).toEqual([]);
    expect(idleStripesInRange([], 0, 100)).toEqual([]);
  });

  it("returns no stripes for a malformed (zero or negative) range", () => {
    const c = [chunk(0, 100, false)];
    expect(idleStripesInRange(c, 100, 100)).toEqual([]);
    expect(idleStripesInRange(c, 100, 50)).toEqual([]);
  });

  it("returns one stripe per idle chunk, in offsetPct/spanPct percent-of-range coordinates, skipping active chunks", () => {
    const start = Date.UTC(2026, 0, 1, 0, 0, 0);
    const tenMin = 10 * 60_000;
    const chunks = [chunk(start, start + tenMin, true), chunk(start + tenMin, start + 2 * tenMin, false)];
    const stripes = idleStripesInRange(chunks, start, start + 2 * tenMin);
    expect(stripes).toHaveLength(1);
    expect(stripes[0]!.offsetPct).toBe(50);
    expect(stripes[0]!.spanPct).toBe(50);
    // Field-name contract guard: the extraction renamed topPct/heightPct ->
    // offsetPct/spanPct (technical-plan.md §3 item 1/§4 step 2). A silent
    // revert to the old field names would break both consumers' destructuring
    // without TypeScript necessarily catching it if the shape is loosely typed.
    expect(Object.keys(stripes[0]!).sort()).toEqual(["offsetPct", "spanPct"]);
  });

  it("clips a chunk that only partially overlaps the range to the visible portion", () => {
    const start = Date.UTC(2026, 0, 1, 0, 0, 0);
    const tenMin = 10 * 60_000;
    // Idle chunk starts 5 min before the range and ends 5 min into it -
    // only the second half (5 of its 10 minutes) is inside [start, start+10m).
    const chunks = [chunk(start - 5 * 60_000, start + 5 * 60_000, false)];
    const stripes = idleStripesInRange(chunks, start, start + tenMin);
    expect(stripes).toHaveLength(1);
    expect(stripes[0]!.offsetPct).toBe(0); // clipped to the range's own start
    expect(stripes[0]!.spanPct).toBe(50); // only 5 of the range's 10 minutes
  });

  it("drops an idle chunk entirely outside the range", () => {
    const start = Date.UTC(2026, 0, 1, 0, 0, 0);
    const tenMin = 10 * 60_000;
    const chunks = [chunk(start - 20 * 60_000, start - 10 * 60_000, false)];
    expect(idleStripesInRange(chunks, start, start + tenMin)).toEqual([]);
  });

  it("is orientation-agnostic: identical fractions regardless of the range's absolute epoch", () => {
    const tenMin = 10 * 60_000;
    const epochA = Date.UTC(2026, 0, 1, 0, 0, 0);
    const epochB = Date.UTC(2030, 5, 15, 8, 0, 0);
    const chunksA = [chunk(epochA, epochA + tenMin, true), chunk(epochA + tenMin, epochA + 2 * tenMin, false)];
    const chunksB = [chunk(epochB, epochB + tenMin, true), chunk(epochB + tenMin, epochB + 2 * tenMin, false)];
    const stripesA = idleStripesInRange(chunksA, epochA, epochA + 2 * tenMin);
    const stripesB = idleStripesInRange(chunksB, epochB, epochB + 2 * tenMin);
    expect(stripesB).toEqual(stripesA);
  });

  // Ported byte-for-byte from FocusCalendarView.test.tsx's two idle-stripe
  // fixtures (lines 537-601) - the refactor's own regression guard: if
  // FocusCalendarView.tsx's extraction step (technical-plan.md §4 step 3)
  // introduced any math drift while porting idleStripesForBlock's body,
  // THIS test catches it directly against the already-Sara-approved values,
  // independent of whether the component-level test happens to still pass.
  it("matches FocusCalendarView.test.tsx's already-approved 50%/50% idle-stripe fixture", () => {
    const start = new Date("2026-03-05T09:00:00.000Z").getTime();
    const chunks = [
      chunk(start, start + 10 * 60_000, true),
      chunk(start + 10 * 60_000, start + 20 * 60_000, false),
    ];
    const stripes = idleStripesInRange(chunks, start, start + 20 * 60_000);
    expect(stripes).toEqual([{ offsetPct: 50, spanPct: 50 }]);
  });

  it("matches FocusCalendarView.test.tsx's already-approved all-active (no stripe) fixture", () => {
    const start = new Date("2026-03-05T09:00:00.000Z").getTime();
    const chunks = [chunk(start, start + 10 * 60_000, true)];
    expect(idleStripesInRange(chunks, start, start + 10 * 60_000)).toEqual([]);
  });
});
```

**Red-first:** the file/function doesn't exist yet at all (confirmed: `ls
client/src/lib/idleStripes.ts` fails per the change brief) — every case here
is red until the extraction (technical-plan.md §3 item 1) lands, then green.
Post-creation, the two "matches FocusCalendarView.test.tsx's already-approved
..." cases are the ones that keep mattering going forward: they'd fail on
their own (independent of whichever component test happens to be run) if a
later edit to this shared helper introduced a fractional/off-by-one drift —
this is the single-source-of-truth guardrail (`technical-plan.md` §5) made
concrete as an assertion instead of prose.

---

## 5. i18n key relocation — registry-completeness check

`report.calendar.wallClockLabel`/`activeLabel` move to
`report.wallClockLabel`/`activeLabel` across **all four** locale files
together (`technical-plan.md` §3 item 4, §8 risk: "a partial rename... would
silently fall back to the key path and render a raw i18n key string in that
locale"). The four-locale list (`en`/`ko`/`vi`/`zh`) is this project's
registry here — add a registry-**derived** loop (not four copy-pasted
asserts) to `client/src/i18n/__tests__/i18n.test.ts` so a locale accidentally
skipped can't ship green:

```ts
describe("report.wallClockLabel / report.activeLabel key relocation", () => {
  const LOCALES = ["en", "ko", "vi", "zh"] as const; // keep in sync with client/src/i18n/locales/*

  it.each(LOCALES)("resolves the new report.%s key path with a real string, not the raw key", async (locale) => {
    await i18n.changeLanguage(locale);
    expect(i18n.t("plan:report.wallClockLabel")).not.toBe("plan:report.wallClockLabel");
    expect(i18n.t("plan:report.activeLabel")).not.toBe("plan:report.activeLabel");
  });

  it.each(LOCALES)("no longer resolves the old report.calendar.* path in %s (fully relocated, not duplicated)", async (locale) => {
    await i18n.changeLanguage(locale);
    // i18next returns the bare key string for a missing key by default.
    expect(i18n.t("plan:report.calendar.wallClockLabel")).toBe("plan:report.calendar.wallClockLabel");
    expect(i18n.t("plan:report.calendar.activeLabel")).toBe("plan:report.calendar.activeLabel");
  });

  it("keeps the exact same English string value across the relocation (key move, not a copy change)", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("plan:report.wallClockLabel")).toBe("Wall clock");
    expect(i18n.t("plan:report.activeLabel")).toBe("Agent time");
  });
});
```
(Confirm `vitest`'s `it.each` is already in use elsewhere in this codebase
before relying on it; if not, an explicit `for (const locale of LOCALES)
{ it(...) }` loop at module-eval time is an equally valid, already-idiomatic
substitute — either way, the point is one array driving N assertions, not N
hand-written cases.)

**Red-first:** run this against the *current* (pre-relocation) locale files —
`i18n.t("plan:report.wallClockLabel")` today returns the bare key string
(missing), failing the first `it.each` immediately; and
`i18n.t("plan:report.calendar.wallClockLabel")` today resolves correctly
("Wall clock"), failing the second `it.each`'s "no longer resolves" assertion
in the opposite direction. Both flip once the relocation lands in all four
files. If a future partial edit updates 3 of 4 locales, the first `it.each`
fails for exactly the one skipped locale — pinpointing it immediately instead
of a generic "something's wrong" client-test failure.

---

## 6. Test data / fixtures summary

| Layer | Fixture | Source |
|---|---|---|
| Server | `seedSession`/`focus`/`activity`/`t()`/`nextId()` helpers, `CWD`+`item-4` from the file's `before()` hook | `server/__tests__/focus-report.test.js:33-89` (unchanged, reused) |
| Server | `stmts.upsertFocusInference.run(sessionId, cwd, kind, item_id, label, confidence, method, reason)` | `server/db.js:1911-1923` (confirmed column order) |
| Client | `makeReport()` base fixture (updated per §2.1 above) | `FocusReportModal.test.tsx:23-94` |
| Client | `NOW`/`todayAt()`/`yesterdayAt()` pattern | `FocusCalendarView.test.tsx:30-46` (duplicated locally for the cross-view test, not shared as a module in this pass) |
| Client | `FocusReportChunk` shape `{start, end, active}` | `client/src/lib/types.ts:1557-1561` |

No new server fixture tables/migrations. No round-trip/persistence surface is
touched by this change (no server behavior change) — the "round-trip
integrity" and "no-unresolved-token" invariant classes from the standard
checklist are not applicable here (confirmed in `qa/change-brief.md`'s own
"Test-invariants at risk" section); the i18n key-relocation check in §5 above
is the closest analog and is covered.

---

## 7. How to run

- Server (new `inferredSegment` block): `npm run test:server` (baseline
  902/902 + new cases), or scoped: `node --test server/__tests__/focus-report.test.js`.
- Client, scoped per file while iterating:
  - `cd client && npx vitest run src/components/__tests__/FocusReportModal.test.tsx`
  - `cd client && npx vitest run src/components/__tests__/FocusCalendarView.test.tsx`
    — **must pass with zero assertion changes**; any diff here means the
    "pure refactor" step went further than intended (technical-plan.md §4
    step 3, DoD).
  - `cd client && npx vitest run src/lib/__tests__/idleStripes.test.ts`
  - `cd client && npx vitest run src/i18n/__tests__/i18n.test.ts`
- Full client suite: `npm run test:client` (baseline 403/403 + new/updated
  cases; review `screens.snapshot.test.tsx`'s diff deliberately if one
  appears — none is expected, since neither modal is rendered there per the
  change brief's own pre-check).
- File headers (new `idleStripes.ts` + `idleStripes.test.ts` both need the
  header): `bash .claude/skills/file-headers/scripts/check-headers.sh`.
