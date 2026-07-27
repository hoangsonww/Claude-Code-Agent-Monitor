# Technical Plan: Focus-Time Reporting Fidelity — List-View Parity

Intake: `intake/2026-07-26-focus-report-fidelity/` · Classification: `missed-requirement` (+ one embedded `bug`) · Date: 2026-07-26

Inputs reconciled: `request-brief.md`, `pm-plan.md`, `supporting/architect.md`,
`supporting/engineer.md`, `supporting/qa.md`, `supporting/product-owner.md`.
Scope is exactly the PM-approved scope handed to this pass — no wall_ms
end-boundary redesign, no chunk-grain change, no noise-verification pass,
no `CHUNK_MS`/`BUCKET_MS` unification. Those are listed as follow-ups only.

## 1. Objective

`FocusReportModal.tsx`'s **List view** currently sizes and labels all three
of its duration bars (per-session, per-item rollup, project-wide split) by
`wall_ms` — the raw, un-idle-aware span that round 3 already proved
misleading (a segment stated "1h 40m" when only ~20 minutes were real
work). Round 4 fixed this for the **Calendar view** only. This change set
brings the List view to parity with Calendar's already-shipped convention
(idle-stripe overlay on the per-session bar, `active_ms`-based sizing on the
two aggregate bars) using a shared helper instead of copy-pasting Calendar's
stripe math, fixes an embedded, independent bug where the per-item/
project-split rows already print an `active_ms` number over a `wall_ms`-sized
bar, closes the zero-coverage gap on `inferredSegment()` (the exact code
path behind the round-3 bug), and adds a permanent cross-view regression
test so a fix landing in one consumer of the report's duration fields can
never again silently fail to reach its sibling. End state: every
duration-bearing surface in both views is idle-aware, sourced from fields
`server/lib/focus-report.js` already computes and ships today — **no server
or wire-shape change is required.**

## 2. Recommended approach

No architect/engineer/QA disagreement to resolve here — all four converged
on the same shape and I'm not overriding anything. Two points worth stating
explicitly since they affect how the fix is built:

- **The per-session bar keeps `wall_ms` as its sizing basis** (does *not*
  switch to `active_ms`). This mirrors `FocusCalendarView`'s own block
  exactly: a block's box represents the segment's real time span, and the
  idle-chunk overlay is drawn *within* that box at its real relative
  position — an idle stripe positioned against a wall_ms-proportional box is
  the only way its geometry stays honest. Only the two **aggregate** bars
  (per-item rollup, project-wide split) switch their sizing denominator to
  `active_ms`, because they have no single segment (and therefore no single
  `chunks` array) to attach a stripe overlay to — this is the
  architect's/engineer's explicit finding, not a design choice being made
  fresh here.
- **The per-session bar's misleading, unlabeled duration number is fixed by
  showing both figures, labeled, when they diverge** — not by silently
  swapping which field is "primary." Silently making `active_ms` the sole
  displayed number while the bar stays `wall_ms`-sized would recreate the
  exact "label says X, box says Y" contradiction this whole pass exists to
  eliminate. Mirroring Calendar's own hover-popup convention (`Wall clock: X
  · Agent time: Y`) sidesteps that entirely and reuses text Sara already
  approved in round 4.

Nothing here overrides the architect's or engineer's assessment; this is a
literal implementation of "reuse chunk/idle-stripe treatment for the
per-session bar, switch sizing to `active_ms` for the two aggregate bars"
plus a concrete, unambiguous choice for the one open detail (how the
per-session header text changes) that none of the four inputs pinned down
byte-for-byte.

## 3. Change set

**Client — new shared helper (extract-before-reuse, per architect's explicit
ask not to re-implement Calendar's stripe math a second time):**

1. `client/src/lib/idleStripes.ts` (new file) — `idleStripesInRange(chunks,
   rangeStartMs, rangeEndMs): FractionalStripe[]`, the orientation-agnostic
   generalization of `FocusCalendarView`'s current `idleStripesForBlock`.

**Client — Calendar view (mechanical, behavior-preserving):**

2. `client/src/components/FocusCalendarView.tsx` — delete the local
   `IdleStripe` interface and `idleStripesForBlock()`, import
   `idleStripesInRange` instead; rename `stripe.topPct`/`stripe.heightPct` →
   `stripe.offsetPct`/`stripe.spanPct` at the call site; rename the two
   `t("report.calendar.wallClockLabel")`/`t("report.calendar.activeLabel")`
   calls to `t("report.wallClockLabel")`/`t("report.activeLabel")` (key
   relocation, see item 6).

**Client — List view (the actual fix):**

3. `client/src/components/FocusReportModal.tsx`:
   - `ListView`'s per-session block: compute both `totalWallMs` and
     `totalActiveMs`; render both, labeled, only when they differ; pass
     `totalWallMs` to `SegmentedBar` unchanged (sizing basis stays wall_ms).
   - `kindTotalsAsSegments()`: add `active_ms` to the returned pseudo-segment
     shape (already present in `FocusKindTotals.by_kind`, no new aggregate
     needed); filter on `active_ms > 0` instead of `wall_ms > 0`.
   - The two aggregate `<SegmentedBar>` call sites (per-item rollup,
     project-wide split): pass `totalMs={item.totals.active_ms}` /
     `totalMs={report.totals.active_ms}` and a new `sizeField="active_ms"`
     prop (see below) instead of `wall_ms`.
   - `SegmentedBar`: add a `sizeField?: "wall_ms" | "active_ms"` prop
     (default `"wall_ms"`, preserving the per-session call site's behavior
     unchanged); size and label each slice by `seg[sizeField]`; render an
     idle-stripe overlay (via `idleStripesInRange`) inside each slice only
     when `sizeField === "wall_ms"` and the segment carries `chunks`/`start`/
     `end` (pseudo-segments never do — guarded, not assumed, per engineer's
     note); each stripe gets `data-testid="idle-stripe"` so both this suite
     and `FocusCalendarView.test.tsx` are one grep-discoverable family.
   - Widen `SegmentedBar`'s segment `Pick<FocusReportSegment, ...>` union to
     include `active_ms`, `chunks`, `start`, `end` (all already exist on
     `FocusReportSegment` in `client/src/lib/types.ts` — **no changes to
     `types.ts` needed**, this is purely a local `Pick<>` widening).

**i18n — key relocation (same value, moved up one namespace level, all four
locales together — not a new key):**

4. `client/src/i18n/locales/{en,ko,vi,zh}/plan.json` — move
   `report.calendar.wallClockLabel` / `report.calendar.activeLabel` to
   `report.wallClockLabel` / `report.activeLabel` (shared by both views now,
   not Calendar-only). Update both call sites from item 2/3 to match.

**Server — no changes.** `chunks`/`active_ms`/`idle_ms` are already computed
and shipped by the (uncommitted) round-4 diff; this pass only changes which
already-shipped fields the client reads.

**Tests:**

5. `server/__tests__/focus-report.test.js` — new `describe` block closing
   the `inferredSegment()` coverage gap (QA's flagged highest-value hole).
6. `client/src/components/__tests__/FocusReportModal.test.tsx` — update
   `makeReport()` so `active_ms < wall_ms`; add List-view idle-stripe /
   active_ms-sizing assertions; add the cross-view (List vs Calendar)
   consistency regression test.

**Docs:**

7. `ARCHITECTURE.md`, `docs/API.md`, `client/README.md`, `server/README.md`
   — extend the existing round-4 prose to state the List view now carries
   the same idle-visibility/active_ms-sizing convention (see §7 for exact
   locations).

## 4. Implementation steps

Sequenced; each is independently checkable (run the relevant test file
after each client step rather than batching all changes before testing).

1. **Land the round-4 diff first.** Per engineer's finding, the working
   tree's round-4 changes (`server/lib/focus-report.js`'s `CHUNK_MS`/
   `buildActivityChunks`, `FocusCalendarView.tsx`'s idle-stripe overlay,
   `client/src/lib/types.ts`'s `FocusReportChunk`/`chunks?`) are green
   (902/902 server, 403/403 client) but uncommitted. Re-run both suites
   fresh in this pass (do not trust the prior self-report) before adding
   anything on top of it:
   - `npm run test:server`
   - `npm run test:client`
   Confirm the four untracked files (`client/src/components/SegmentEventsModal.tsx`,
   `client/src/lib/eventBuckets.ts` + test, and anything else `git status`
   still shows as `??`) carry the required file-header via
   `bash .claude/skills/file-headers/scripts/check-headers.sh`. Fix any
   missing header before proceeding — do not bundle a header fix silently
   into an unrelated diff hunk later.

2. **Add `client/src/lib/idleStripes.ts`.** New file. Port
   `idleStripesForBlock`'s body verbatim, renaming it `idleStripesInRange`,
   renaming its return fields `topPct`/`heightPct` → `offsetPct`/`spanPct`,
   and widening its first parameter to accept `FocusReportChunk[] |
   undefined` (returning `[]` for `undefined`/empty/malformed range) so
   every caller gets the "missing chunks → no stripes" guard for free
   instead of re-deriving `?? []` at each call site. Give it the file
   header per `.claude/rules/file-headers.md`.

3. **Wire `FocusCalendarView.tsx` to the shared helper** (pure refactor, no
   behavior change): delete the local `IdleStripe` interface and
   `idleStripesForBlock` function; import `idleStripesInRange` and (if
   needed for typing) `FractionalStripe` from `../lib/idleStripes`; update
   the one call site and the two field renames (`stripe.topPct` →
   `stripe.offsetPct`, `stripe.heightPct` → `stripe.spanPct`). Run
   `cd client && npx vitest run src/components/__tests__/FocusCalendarView.test.tsx`
   — must still pass unmodified (this step is a refactor, not a behavior
   change; if any assertion needs touching here, something went wrong).

4. **Relocate the i18n keys.** In all four `client/src/i18n/locales/{en,ko,vi,zh}/plan.json`
   files, move `report.calendar.wallClockLabel` and `report.calendar.activeLabel`
   up to `report.wallClockLabel` / `report.activeLabel` (same string
   values — this is a key-path rename, not a copy change; do not alter the
   translated text). Update `FocusCalendarView.tsx`'s two `t(...)` calls
   (hover popup) to the new key path. Run the Calendar test file again to
   confirm nothing broke from the rename.

5. **`FocusReportModal.tsx` — `kindTotalsAsSegments` and `SegmentedBar`.**
   - Extend `kindTotalsAsSegments()`'s return shape and mapping to include
     `active_ms: totals.by_kind[kind].active_ms` alongside the existing
     `wall_ms`; change its filter from `s.wall_ms > 0` to `s.active_ms > 0`.
   - Add `sizeField?: "wall_ms" | "active_ms"` (default `"wall_ms"`) to
     `SegmentedBar`'s props; widen its segment prop type to
     `Pick<FocusReportSegment, "kind" | "label" | "wall_ms" | "active_ms"> &
     Partial<Pick<FocusReportSegment, "inferred" | "inferred_reason" |
     "chunks" | "start" | "end">>`.
   - Inside `SegmentedBar`, replace every `seg.wall_ms` read used for sizing
     and the tooltip's duration with `seg[sizeField]`; make each rendered
     slice `relative` (for the stripe overlay's `absolute` children) instead
     of a bare colored `div`.
   - Add the idle-stripe overlay: when `sizeField === "wall_ms"` and
     `seg.start`/`seg.end` are present, compute
     `idleStripesInRange(seg.chunks, new Date(seg.start).getTime(), new
     Date(seg.end).getTime())` and render one `data-testid="idle-stripe"`
     absolutely-positioned `div` per stripe (`left: {offsetPct}%`, `width:
     {spanPct}%`, `inset-y-0`, `bg-black/45` — same visual treatment as
     Calendar's stripe).

6. **`FocusReportModal.tsx` — the three call sites.**
   - Per-session block: compute `totalWallMs` (existing `wall_ms` reduce,
     renamed from `totalMs`) and `totalActiveMs` (new `active_ms` reduce).
     Pass `totalWallMs` to `<SegmentedBar segments={session.segments}
     totalMs={totalWallMs} height="h-5" />` (unchanged — default
     `sizeField="wall_ms"` applies). Replace the header's single
     `{formatMs(totalMs)}` with: if `totalActiveMs === totalWallMs`, render
     `{formatMs(totalWallMs)}` unchanged (the common no-idle case, zero
     visual churn); otherwise render both, labeled — `{t("report.wallClockLabel")}
     {formatMs(totalWallMs)} · {t("report.activeLabel")} {formatMs(totalActiveMs)}`.
   - Per-item rollup: `<SegmentedBar segments={kindTotalsAsSegments(item.totals)}
     totalMs={item.totals.active_ms} height="h-3" sizeField="active_ms" />`.
     The printed number above it (`formatMs(item.totals.active_ms)`) is
     already correct — do not touch it; this step is what makes the bar
     agree with it (closing the embedded bug — label and bar now both read
     from `active_ms`, changed together in this one step, not separately).
   - Project-wide split: `<SegmentedBar segments={kindTotalsAsSegments(report.totals)}
     totalMs={report.totals.active_ms} height="h-6" sizeField="active_ms" />`.
     Same rationale — the legend below it already reads
     `report.totals.by_kind[kind].active_ms`; this step makes the bar agree.

7. **Run the client suite before writing new tests**, to see the diff's
   effect on the *existing* fixtures (which currently have `active_ms ===
   wall_ms` everywhere, so this step should still be green — a real
   behavior change only becomes visible once fixtures diverge, which is
   step 9): `cd client && npx vitest run src/components/__tests__/FocusReportModal.test.tsx`.

8. **Server test gap — `inferredSegment()`.** Add the new `describe` block
   to `server/__tests__/focus-report.test.js` (see §6.A for the exact cases
   and a fixture sketch). This has no dependency on steps 2–7 and can be
   done in parallel by a second contributor if useful, but is sequenced
   after step 1 only because step 1 is "make sure the ground you're
   building on is real."

9. **Update `FocusReportModal.test.tsx` fixtures and add new assertions**
   (see §6.B) — this is the step that actually exercises steps 5–6's
   behavior change end to end, including the cross-view consistency test.

10. **Full re-verification** (per CLAUDE.md and QA's Definition of Done):
    - `npm run test:server`
    - `npm run test:client` (review any snapshot diff in
      `screens.snapshot.test.tsx` deliberately; regenerate with
      `cd client && npx vitest run -u` only if the diff is expected —
      this modal/calendar pair is not currently rendered by that snapshot
      suite per QA's check, so no diff is expected here)
    - `bash .claude/skills/file-headers/scripts/check-headers.sh`

11. **Docs** (see §7) — update `ARCHITECTURE.md`, `docs/API.md`,
    `client/README.md`, `server/README.md` together, in the same commit.

12. **Commit as one change** (per PO's explicit instruction — do not commit
    round 4 in isolation and reopen the diff for List-view parity
    separately): round-4's idle-chunk work plus this pass's List-view
    parity, tests, and docs, in one reviewed, tested commit. State the
    visible behavior change plainly in the commit/PR summary (per PO/QA):
    the per-session bar's header text now shows a labeled wall-clock/agent-time
    split whenever they diverge (previously a single, unlabeled,
    wall_ms-only number); the per-item and project-split bars are now sized
    by `active_ms`, not `wall_ms` (a kind with real elapsed time but zero
    active time will now render with ~0 width in those two bars, whereas it
    previously rendered full width unstriped — this is the intended fix,
    not a regression, but it is a visible change worth calling out).

## 5. Single-source-of-truth guardrail

No `PROJECT-CONTEXT.md`/defect-class catalog is configured for this repo
(confirmed absent by all four upstream passes), so there is no named
convention to cite by ID. That said, this pass **is** an instance of this
project's one clear existing single-source-of-truth pattern:
`server/lib/focus-report.js` is already the sole place "how long" gets
computed (`wall_ms`/`active_ms`/`idle_ms`/`chunks`, all attached once, per
segment, server-side) — the defect this whole intake is about was never a
duplicated *computation*, it was duplicated, unsynchronized *consumption*
choices across two client rendering surfaces. The durable fix this plan
applies is: (a) route the List view through the exact fields
`focus-report.js` already emits — **do not add a second, List-view-specific
computed figure anywhere** (e.g., no "rolled-up chunk count" for the
aggregate bars, per architect's explicit rejection of that option — the
already-computed `active_ms` on `FocusKindTotals` is the single source for
that), and (b) extract the idle-stripe *rendering* math itself
(`idleStripesForBlock` → `idleStripesInRange`) into one shared client-side
helper before a second consumer (List view) needs it, rather than
copy-pasting Calendar's version — this is the one place in this change set
where a second consumer of the same logic is being added, and it must go
through the shared function, never a re-implementation. If Sara decides
(per PO's/architect's flagged process note) to start a defect-class catalog
for this project after this ships, "a derived/summary number computed once,
consumed by multiple rendering surfaces with no shared helper and no
cross-surface test" is the concrete candidate entry this intake surfaced
twice over (Calendar-before-round-4, and now List-before-this-pass).

## 6. Testing & verification

### A. `server/__tests__/focus-report.test.js` — close the `inferredSegment()` gap

New `describe("inferredSegment / buildSessionFocusReport - inferred fallback")`
block, following the file's existing `seedSession`/`focus`/`activity`/`t()`
helper conventions and `stmts.upsertFocusInference.run(sessionId, cwd, kind,
itemId, label, confidence, method, reason)` (mirrors
`focus-inference.test.js`'s own seeding pattern). Cases:

1. **Item-kind inference resolves to the plan item's current display number
   and text.** Seed a session with one non-Focus `activity()` event (so
   `buildFocusSegments` returns `[]` and `inferredSegment` has a start
   timestamp to fall back to) and an `upsertFocusInference` row
   (`kind: "item"`, `item_id: "item-4"`, using the existing `CWD`/`item-4`
   fixture from the file's `before()` hook). Assert the resulting segment's
   `kind`, `item_number` (4), `label` ("Migrate auth"), `inferred: true`.
2. **Detour-kind inference** produces a segment with `kind: "detour"`,
   `item_number: null`, `label` set from the inference row's `label`.
3. **Deleted-item inference** (`item_id` doesn't resolve via
   `getPlanItemById`) → `buildSessionFocusReport` returns zero segments —
   same shape as "never declared focus."
4. **Unclassified/no usable verdict** → zero segments (completeness case;
   the existing generic empty-segments shape is already covered elsewhere,
   this pins the inference-specific path to it).
5. **The round-3 regression case** — the single highest-value test in this
   set: an inferred segment with a burst of `activity()` calls in the first
   ~10 minutes, then an `ended_at` ~130 minutes later (mirrors the existing
   *declared*-segment version of this exact test at
   `server/__tests__/focus-report.test.js:385-412`, but through the
   inference path instead of a declared `Focus` "set" event). Assert:
   `wall_ms` rides all the way to the full ~130-minute span (the bug's raw
   material), `active_ms < wall_ms` (the fix's guarantee), `chunks.length
   === Math.ceil(wall_ms / CHUNK_MS)`, first chunk `active: true`, every
   later chunk `active: false`.

### B. `client/src/components/__tests__/FocusReportModal.test.tsx` — List-view parity + fixture fix

1. **Update `makeReport()`'s base fixture** so `active_ms < wall_ms` for at
   least the "item" segment (currently every fixture segment has them
   equal — QA's and engineer's independently-flagged reason the existing
   suite structurally cannot catch a wrong-field-sizing bug). Concrete
   values that keep every *existing* assertion's math traceable: segment 1
   (`item`, 4, "Migrate auth") `wall_ms: 30m, active_ms: 20m, idle_ms: 10m`,
   with a 3-chunk `chunks` array (first two 10-minute chunks `active: true`,
   last `active: false`); segment 2 (`bug`, "npm conflict") unchanged at
   `wall_ms: active_ms: 10m` (no idle, no `chunks` needed — this segment's
   *absence* of a `chunks` field also exercises the "no chunks → no stripe"
   guard). Recompute the session/item/report totals to match this new sum
   (session: wall 40m/active 30m/idle 10m; `by_kind.item`: wall 30/active
   20/idle 10; `by_kind.bug`: wall 10/active 10/idle 0) and **update the
   existing "computes the on-item percentage" test's expected values**
   accordingly (20m item-active / 30m total-active = 67%/33%, not the old
   75%/25% — this is an expected, deliberate assertion change, not
   collateral damage; call it out in the PR description).
2. **New test: per-session header shows both wall-clock and agent time,
   labeled, when they diverge**, and shows the plain single number when
   they don't (add a second, single-segment fixture session with
   `wall_ms === active_ms` to cover that branch explicitly).
3. **New test: the per-session bar overlays exactly one idle stripe**, for
   the segment carrying an idle chunk, none for the segment without a
   `chunks` field at all (mirrors `FocusCalendarView.test.tsx`'s two
   idle-stripe tests near-verbatim, using `data-testid="idle-stripe"`).
4. **New test: the per-item rollup bar and the project-split bar are sized
   by `active_ms`, matching their already-correct printed number** — assert
   each bar's per-kind slice widths are proportional to `active_ms`, not
   `wall_ms` (e.g., with the new fixture, the item's own rollup bar should
   split roughly 67/33 between its `item` and `bug` kinds, not 75/25). This
   is the direct regression test for the embedded bug (§2 of `pm-plan.md`):
   a fix that changed only the label or only the bar would fail this test.
5. **New test: cross-view consistency (List vs. Calendar)** — build a
   dedicated single-segment session dated **today** (reuse/adapt
   `FocusCalendarView.test.tsx`'s `todayAt()` helper pattern, since the
   Calendar view only renders "today" by default) with `wall_ms`/`active_ms`
   diverging and a `chunks` array. Render the modal, read the List view's
   per-session header text for that session, then click the Calendar
   toggle, `fireEvent.mouseEnter` the corresponding block (found via its
   `aria-label`), and assert the hover popup's "Wall clock"/"Agent time"
   text states **the same two numbers**. This is the permanent regression
   guard QA specified — the one test that would have caught round 4
   stopping at one consumer, and the reason a fix to either view alone
   can't silently reopen the same gap in the other going forward. Use a
   single-segment session specifically (not a multi-segment one) so
   "the same segment's numbers" is unambiguous between the two views' own
   aggregation levels (List's per-session header sums across a session's
   segments; Calendar's popup is per-block/per-segment — they only cleanly
   coincide for a one-segment session).

### C. Commands

- `npm run test:server` (902 baseline + new `inferredSegment` cases).
- `npm run test:client` (403 baseline + updated/new `FocusReportModal.test.tsx`
  cases; `FocusCalendarView.test.tsx` should need zero assertion changes —
  if it does, something in step 3 of §4 went beyond a pure refactor).
- `cd client && npx vitest run -u` — only if `screens.snapshot.test.tsx`'s
  diff is reviewed and expected (not anticipated for this change; confirm
  this stays true, per QA's own note, since neither modal is currently
  rendered by that snapshot suite).
- `bash .claude/skills/file-headers/scripts/check-headers.sh`.

## 7. Docs to update (same commit)

- **`ARCHITECTURE.md`** (~line 1690-1701, the `FocusReportModal.tsx` List
  description): add a sentence that the per-session bar now overlays idle
  chunks the same way Calendar does (via the shared `idleStripesInRange`
  helper) and that the per-item/project-split bars are sized by `active_ms`,
  matching the figure already printed above them.
- **`client/README.md`** (`#### FocusReportModal`, ~lines 647-654): extend
  the List-view bullet to mention the idle-stripe overlay on the
  per-session bar and the `active_ms` sizing basis for the rollup/split
  bars — the existing Calendar section (~lines 665-671) already documents
  this pattern; List view's description should now read as "same
  convention," not silent about it.
- **`docs/API.md`** (`Get Project Focus Report`, ~lines 1204-1284): no
  wire-shape change, so no response-schema edit needed; optionally add one
  clause noting both the Calendar and List client views now consume
  `chunks`/`active_ms` for idle-aware rendering (currently only Calendar is
  named).
- **`server/README.md`** (~lines 647-677, the focus-report route summary):
  same optional one-clause update as `docs/API.md` if the route summary
  there names Calendar specifically.
- i18n: no new locale content, but the `report.calendar.wallClockLabel`/
  `activeLabel` → `report.wallClockLabel`/`activeLabel` key move is a code
  change across 4 files, not a docs change — already covered in §3/§4.

## 8. Risks & rollback

- **Visible behavior change** (expected, not a regression): a real segment
  with nonzero `wall_ms` but zero `active_ms` now renders with ~0 width in
  the per-session bar (previously rendered full-width, unstriped, looking
  misleadingly "fully active" — the exact thing this pass exists to fix).
  Call this out plainly in the PR/commit summary per PO's/QA's instruction
  so Sara isn't surprised by it.
- **i18n key relocation risk**: moving `wallClockLabel`/`activeLabel` out of
  the `calendar` sub-object is a mechanical rename, but it must be done
  identically across all 4 locale files and both call sites in the same
  commit — a partial rename (e.g., English updated, one other locale
  missed) would silently fall back to the key path and render a raw i18n
  key string in that locale. Verify by grepping all four `plan.json` files
  for `wallClockLabel`/`activeLabel` after the change and confirming
  exactly one occurrence each, at the new path, in every file.
- **Fixture-value ripple**: changing `makeReport()`'s base segment values
  (§6.B.1) changes the sums used by *other*, unrelated existing tests in
  the same file if they read the shared base fixture without their own
  override. Verified in this plan for the "on-item percentage" test (needs
  updating); the concurrency-ratio and idle-excluded tests were checked and
  do not need changes (they either override the relevant fields directly
  or assert on `idle_ms`, which stays 10m under the new fixture) — but
  re-run the full file after step 9 and treat any other newly-failing
  assertion as a signal to double check the math, not to loosen the
  assertion.
- **Do not extend this to aggregate-level chunk-striping.** `buildActivityChunks`'s
  grid is segment-relative, not epoch-aligned (confirmed by engineer);
  merging chunks across sessions/segments that don't share a grid is real,
  separate, larger work (a new epoch-aligned server helper + a
  `FocusKindTotals` shape change), explicitly out of scope here. If this
  is attempted as a shortcut to "make the rollup bars fancier," stop —
  `active_ms` sizing alone already fixes the correctness bug at the
  aggregate level; anything more is a distinct follow-up.
- **Rollback**: every change in this set is additive/local to
  `FocusReportModal.tsx`, `FocusCalendarView.tsx`, one new lib file, 4 JSON
  files, and 2 test files — no schema, no API response shape, no removed
  exports. Revert is a straightforward `git revert` of the single commit
  from step 12 with no migration or data cleanup implication.

## 9. Definition of Done

- [ ] `client/src/lib/idleStripes.ts` created with file header; used by
      both `FocusCalendarView.tsx` (refactored, not behavior-changed) and
      `FocusReportModal.tsx`'s `SegmentedBar` (new usage).
- [ ] `FocusReportModal.tsx`'s per-session bar: sized by `wall_ms`
      (unchanged), idle-stripe overlay added via the shared helper, header
      shows labeled wall-clock/agent-time split when they diverge.
- [ ] `FocusReportModal.tsx`'s per-item rollup and project-split bars: sized
      by `active_ms`, matching their already-correct printed number (embedded
      bug closed — label and bar changed together, not separately).
- [ ] i18n keys `report.wallClockLabel`/`report.activeLabel` relocated in
      all 4 locale files; both `FocusCalendarView.tsx` and
      `FocusReportModal.tsx` reference the new path; no locale left
      pointing at the old `report.calendar.*` path.
- [ ] `server/__tests__/focus-report.test.js` — new `inferredSegment`
      describe block passing, including the round-3-shaped idle-tail case.
- [ ] `client/src/components/__tests__/FocusReportModal.test.tsx` — fixtures
      updated to `active_ms < wall_ms`; new idle-stripe, active_ms-sizing,
      and cross-view consistency tests passing; the pre-existing
      on-item-percentage assertion updated to the new correct values.
- [ ] `client/src/components/__tests__/FocusCalendarView.test.tsx` unchanged
      and still green (pure refactor confirmed, no behavior drift).
- [ ] `npm run test:server` green.
- [ ] `npm run test:client` green; `screens.snapshot.test.tsx` diff (if any)
      reviewed, not blindly regenerated.
- [ ] `bash .claude/skills/file-headers/scripts/check-headers.sh` passes.
- [ ] `ARCHITECTURE.md`, `docs/API.md`, `client/README.md`, `server/README.md`
      updated per §7.
- [ ] Round-4's uncommitted diff and this pass's List-view parity work
      committed together, one commit, with the visible behavior change
      (per §8) stated plainly in the commit/PR summary.
- [ ] Manual spot-check (QA's step, not automatable): open a real project
      with a long-idle-tailed session in both List and Calendar view and
      confirm the numbers/stripes agree and no bar reads as "fully active"
      for a genuinely idle stretch.

## Follow-ups (explicitly out of scope for this pass — do not implement)

Carried forward from `pm-plan.md` §6/§7, unchanged, for whoever picks these
up next:

- Whether `inferredSegment`'s `end` should be capped near last real
  activity instead of riding to `session.ended_at` (architect's option B) —
  a genuine design question with a real side effect on
  `wall_clock_ms`/`mergeIntervals`; needs its own pass, including checking
  whether declared segments share the problem.
- The 10-minute `CHUNK_MS`/`BUCKET_MS` grain choice — keep as-is; no
  concrete problem surfaced.
- A verification/spot-check pass over real session data for other
  "noise" (e.g., the "93 `TurnDuration` events in 5 minutes" observation).
- The `CHUNK_MS`/`BUCKET_MS` duplicated-constant risk (two independently
  hardcoded `10 * 60 * 1000` literals, one server JS, one client TS,
  "matching" only by comment) and the unbounded per-segment `chunks` array
  payload-size risk on `GET /api/projects/:id/focus-report` — both real,
  both worth a deliberate accept-or-fix decision, neither urgent enough to
  gate this pass.
- Whether this project should start a named defect-class catalog — flagged
  for Sara's call, not decided here.
