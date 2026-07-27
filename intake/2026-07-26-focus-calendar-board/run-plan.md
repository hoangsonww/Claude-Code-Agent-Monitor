# Run Plan (direct mode) — Project-wide Focus Calendar Board

## 1. Scope read

This is a genuine new-feature request that crosses both the client and the
server, and it creates at least one new API contract in the process. On the
client it's the well-worn nav-entry/route pattern (`Sidebar.tsx` `NAV_KEYS` +
`App.tsx` route table — two literal arrays kept in sync) plus a new page that
reuses an already-working component (`FocusCalendarView.tsx`), so that half
is low-novelty. But the brief is explicit that the backend is the real work:
today's `GET /api/projects/:id/focus-report` is project-scoped only, with no
session filter and no cross-project aggregation, and there's a real
architectural fork left unresolved — "quick" client-side N+1 merge vs.
"proper" new aggregate endpoint with server-side filtering — that the
exploratory groundwork explicitly did not get sign-off on. On top of that,
the brief itself flags a named cross-cutting risk: the same swimlane/calendar
rendering will now exist behind two different entry paths (existing
per-project modal, new standalone page) with potentially different
data-fetching, and asks that "does it look and behave identically in both
places" become a first-class QA check. There are also several real,
unresolved product decisions (standalone page vs. overlay, filter defaults,
whether "all projects" is a valid state, fate of the existing modal) with no
stated acceptance criteria yet. This is not a one-file, single-angle change —
it has real blast radius across product scope, architecture, implementation,
and verification, even though no schema/auth/existing-response-shape changes
are in play.

## 2. Agents to run

1. **intake-product-owner** — acceptance criteria are explicitly absent
   ("None stated" in the brief), and there are multiple live product
   decisions only a PO pass can responsibly make/confirm: standalone page
   vs. overlay, session-filter scoping (global vs. project-scoped), whether
   "all projects" is a valid unfiltered state, and whether the existing
   per-project modal stays as-is. These directly shape scope and sign-off
   criteria — skipping this would leave the PM/tech-lead synthesizing a plan
   with no real acceptance bar.
2. **intake-architect** — the brief hands over a concrete, unresolved system
   design fork (quick client-merge vs. proper new aggregate endpoint) plus a
   named cross-entry-point consistency risk (same calendar component
   rendered via two different data paths). This is exactly the class of
   "crosses a real boundary" work (a new endpoint's contract) that this
   process treats as non-skippable regardless of directness-mode economy.
3. **intake-engineer** — the change set spans a new/generalized backend
   endpoint (`buildProjectFocusReport` generalization), new query-param
   handling, a new client page, two new filter controls, and route/nav
   wiring. Feasibility and gotchas (e.g., what querying without a
   `project_id` column on `events`/`sessions`/`focus_inferences` actually
   requires) need a real engineering pass, not an assumption.
4. **intake-qa** — this both changes/creates an API contract (new endpoint
   or new query params on scoping logic) and the brief itself calls out a
   specific regression risk worth a first-class test: the calendar must look
   and behave identically whether reached via the existing per-project modal
   or the new standalone board. Per this process's own rule, an API-contract
   change is never QA-skippable regardless of size.
5. **intake-project-manager** (mandatory) — classifies request type, owns
   history/PM memory, produces the PM plan.
6. **intake-tech-lead** (mandatory) — synthesizes architect + engineer + qa
   input into the one coherent technical plan.

## 3. Agents skipped

None. Every candidate agent's angle is live for this specific request: this
is a multi-file, cross-subsystem, contract-touching change with unresolved
product, design, implementation, and verification questions the brief itself
surfaces — direct mode buys speed on process formality here, not on the
actual roster.

## 4. Forced back on

Nothing was trimmed, so nothing needed forcing back on — but for the record,
two things in the brief would have forced a "skipped" call back on if one had
been made:
- The brief's own "Known-variant relevance" section flags the two-entry-path
  consistency risk (modal vs. standalone page rendering the same calendar
  data) as exactly the kind of pattern a defect-class catalog would normally
  catch — this alone would force `intake-qa` back on even if the change
  looked small elsewhere.
- The new/generalized backend endpoint is a real API-contract boundary
  ("an endpoint's contract... since existing behavior should be preserved")
  — this alone would force `intake-architect` and `intake-qa` back on even
  on a change that looked client-only at a glance.

No `PROJECT-CONTEXT.md`/defect-class catalog exists for this project, so no
catalog-based forcing applied beyond the pattern the brief itself already
named.
