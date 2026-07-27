# E2E / API Test Design — focus-report-fidelity (List-view parity)

## Verdict: no new e2e coverage is warranted for this change

This is a client-only rendering change (`FocusReportModal.tsx`'s List view
sizing/labels, a client-only `idleStripes.ts` extraction, a pure refactor of
`FocusCalendarView.tsx` onto that shared helper) plus a server-side
**test-coverage-only** addition (`inferredSegment()` describe block — no
behavior change to the function). There is:

- no new route,
- no new/changed response field or wire shape (`chunks`/`active_ms` already
  ship today from the already-committed-to-working-tree round-4 diff — this
  pass only changes which already-shipped fields the client reads), and
- no new user-facing flow beyond "the same modal, opened the same way, now
  renders three existing duration bars using different already-present
  fields, and one more field label appears when two numbers diverge."

That is exactly the shape this role's brief says to leave to the unit/
component layer rather than manufacture e2e scope for. I looked for a
dedicated e2e/browser-flow layer to place tests in and confirmed there isn't
one to place them in:

- No `PROJECT-CONTEXT.md` at the repo root (confirmed absent, matching the
  change brief's own note).
- No Playwright/Cypress config anywhere in the tree (`playwright.config.*`,
  `cypress.config.*` — none found), no `e2e/` test directory, no `.spec.*`
  files. A repo-wide grep for `playwright|cypress|e2e` across
  `*.md/*.json/*.yml` turns up nothing in-project (only unrelated hits under
  `monitoring/README.md`, which documents this dashboard's own
  operational/monitoring "end-to-end" pipeline, not a test framework).
- This project's two test layers are: `node --test server/__tests__/*.test.js`
  (server — includes route-level tests that hit the real Express app over
  HTTP against a real SQLite DB, e.g. `server/__tests__/projects.test.js`,
  which is the closest thing this repo has to an "API/contract" bucket) and
  `cd client && npm test` (Vitest + Testing Library component tests). There
  is no bucket/tag/smoke-vs-regression convention to discover, because there
  is no third (browser e2e) layer at all.

Given that, inventing a Playwright-style flow spec for this change would be
manufacturing e2e scope the project doesn't have infrastructure for, and
wouldn't prove anything the component layer can't already prove more
cheaply. The "flow" proof for this specific change is fully covered by the
plan's own §6.B component-test additions to
`client/src/components/__tests__/FocusReportModal.test.tsx`:

- Opening the modal, reading the List view's per-session header (both/
  single-number branches),
- `fireEvent.click(screen.getByTitle("Calendar"))` (the existing
  List↔Calendar toggle mechanism this suite already exercises at line ~318)
  to flip views without a second fetch, then `fireEvent.mouseEnter` a block
  to read its hover popup — this **is** the "flow" (open report → switch
  view → confirm the same computed fact renders identically) and belongs in
  the component suite, not a new browser-level spec, because no real
  network/browser/session boundary is being crossed — it's the same React
  tree, same in-memory fixture, just two branches of one component.

**What I am NOT recommending, and why:** a full page-level or
Playwright-style "user opens dashboard → clicks a project → opens focus
report → toggles view" flow spec. It would require standing up browser
automation this project has never had, to re-prove a wiring path (does the
button under the modal open the report; does the toggle switch views) that
is unrelated to this change's actual risk (does the *value read for a bar's
width* match the *value printed next to it*, per view). That risk is a pure
data-to-pixel mapping question, which is what component tests are for.

## The one adjacent thing worth flagging: the existing API-contract test's blind spot

The task asked me to check whether the existing route-level test for
`GET /api/projects/:id/focus-report`
(`server/__tests__/projects.test.js`, `describe("GET /:id/focus-report")`,
lines 211-294) already exercises `chunks`/`active_ms` as a regression guard
for round 4 — independent of this pass's own scope, since that's the
contract this List-view UI work depends on. I read it directly. It does
not, and I think this is worth naming even though it isn't in this change's
file list:

- Both assertions in the second test (`"scopes the report to only the
  clicked project's sessions, and rolls a bug detour up under its item"`,
  lines 239-293) check **`wall_ms` only** —
  `res.body.items[0].totals.by_kind.bug.wall_ms` (line 289),
  `res.body.totals.by_kind.bug.wall_ms` (line 291),
  `res.body.totals.by_kind.item.wall_ms` (line 292). Nothing in this
  `describe` block ever reads `.active_ms`, `.idle_ms`, or `.chunks`
  anywhere in the response.
- More importantly, this test explicitly sets
  `process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "0"` (line 240) —
  per `server/lib/focus-report.js`'s own `activeIdleMs()` (`grace <= 0`
  branch, line 164), this **disables idle discounting entirely**, so
  `active_ms` trivially equals `wall_ms` in this fixture regardless of
  whether the idle-discounting logic is even wired correctly. So even
  reading this test's current numbers wouldn't tell you if `active_ms`/
  `chunks` are computed and threaded through the HTTP response correctly at
  all — an `active_ms` assertion added to *this specific test as written*
  would pass even if `active_ms` were silently broken, because the fixture
  itself neutralizes the one thing that would make `active_ms` diverge from
  `wall_ms`.
- This means the API contract the List-view fix depends on — "the route
  actually serializes `chunks`/`active_ms`/`idle_ms` per segment, and they
  reflect real idle discounting, not just a copy of `wall_ms`" — is
  currently unprotected at the route/API-contract level. `focus-report.js`'s
  own unit tests (`server/__tests__/focus-report.test.js`) do cover
  `active_ms`/`chunks`/`buildActivityChunks` at the function level, but
  nothing proves those fields survive the HTTP round trip
  (JSON-serialize → route handler → response body) the way this test file's
  job is to prove for every other field it does assert on.

**Recommendation (optional, not blocking this change):** add one small,
additive assertion block to the existing
`"scopes the report to only the clicked project's sessions..."` test (or a
new sibling `it` in the same `describe`) that:
1. does **not** force `DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "0"` (or uses a
   second session/segment with a real activity gap under the default grace
   window), and
2. asserts `res.body.sessions[0].segments[0].active_ms < res.body.sessions[0].segments[0].wall_ms`
   and that `res.body.sessions[0].segments[0].chunks` is a non-empty array
   with the expected `{start, end, active}` shape.

This is genuinely adjacent-scope (it's round-4's contract, not this pass's),
so I'm flagging it as a recommendation for whoever owns round-4's own QA
pass, not adding it to this change's required test list — but per this
task's own instruction to confirm the contract this UI depends on is
protected, it is not, today, and is cheap insurance given it's the one gap
between "the function is unit-tested" and "the wire actually carries the
fix to any client."

## What this change's actual test plan should rely on instead

See the technical plan's own §6.A/§6.B (already fully specified, this pass
doesn't need a parallel e2e version of them) — summarized here only to state
why they're sufficient without an e2e layer on top:

- **Server unit layer** (`server/__tests__/focus-report.test.js`): new
  `inferredSegment` describe block, five cases including the round-3-shaped
  idle-tail regression case (`wall_ms` rides the full span, `active_ms <
  wall_ms`, `chunks.length === Math.ceil(wall_ms / CHUNK_MS)`). Run:
  `npm run test:server`.
- **Client component layer**
  (`client/src/components/__tests__/FocusReportModal.test.tsx`): fixture
  update (`active_ms < wall_ms`), idle-stripe overlay assertions
  (`data-testid="idle-stripe"`), `active_ms`-sizing assertions on the two
  aggregate bars, and the List↔Calendar cross-view consistency test (the
  plan's own named highest-priority regression guard, §6.B.5) — this last
  one is the closest thing to a "flow" test this change needs, and it
  already lives correctly in the component suite using the existing
  `fireEvent.click(screen.getByTitle("Calendar"))` toggle mechanism and (per
  the plan) an adapted `todayAt()` fixture helper from
  `FocusCalendarView.test.tsx`. Run:
  `cd client && npx vitest run src/components/__tests__/FocusReportModal.test.tsx`.
- `client/src/components/__tests__/FocusCalendarView.test.tsx` must stay
  green with **zero** assertion changes (proves the refactor step was
  behavior-preserving) — run the same way:
  `cd client && npx vitest run src/components/__tests__/FocusCalendarView.test.tsx`.
- Full re-verification before calling this done:
  `npm run test:server`, `npm run test:client` (review, don't blindly
  regenerate, any `screens.snapshot.test.tsx` diff — none anticipated since
  neither modal is currently rendered there), and
  `bash .claude/skills/file-headers/scripts/check-headers.sh`.

No environment/base-URL prerequisite applies to any of the above — these
are in-process Node/Vitest test runs (server tests spin up the Express app
in-process against a temp SQLite file; client tests render React components
in jsdom), not a running dashboard instance.

## Cost note / what's intentionally not covered here

- Not adding a browser-level (Playwright/Cypress) spec — no such layer
  exists in this project, and this change doesn't have a risk shape (missing
  wiring, cross-page navigation, real network/auth boundary) that would
  justify introducing one for the first time here.
- Not adding a new API-contract test as part of *this* change's required
  set — the route already returns `chunks`/`active_ms` today (round 4,
  already-shipped), and this pass reads, not changes, those fields. The gap
  named above is a pre-existing hole in round-4's own contract coverage, not
  something this List-view pass introduces or is required to fix; flagged
  above as a recommendation for whoever owns that follow-up.
- Exhaustive permutation coverage (every kind combination, every
  wall/active/idle ratio, multi-segment cross-view edge cases beyond the
  single-segment case the plan deliberately scopes the cross-view test to)
  is left to the unit/component layer per the plan's own §6.B.5 rationale
  (a single-segment session is used specifically so "the same segment's
  numbers" is unambiguous between List's per-session sum and Calendar's
  per-block popup — multi-segment cross-view parity is a separate,
  more elaborate test that isn't needed to catch the class of bug this
  pass is closing).
