# Decision Log — focus-calendar-board

> Every clarifying / blocking question the team raised on this request, the
> context behind it, the options offered, and the choice made. Readable on its
> own — someone should be able to open this months later and understand *what we
> decided and why*. Newest decisions at the bottom.
>
> Status values: **PENDING** (asked, awaiting answer) · **DECIDED** ·
> **PARKED** (deferred to stakeholder / later) · **SUPERSEDED** (a later
> decision overrode this one — link it).

---

## DEC-1 — Standalone page vs. modal-overlay for the new board
- **Item / area:** Overall UI shape
- **Status:** DECIDED
- **Raised:** 2026-07-26 · **Decided:** 2026-07-26 · **Decided by:** Sara
- **Recurring-issue link:** — (no defect catalog configured for this project)

### The question
Should the new calendar board be a genuinely new top-level page (own route,
own header, filters at the top), or stay a modal-like overlay just launched
from the sidebar instead of a project card?

### Where we're coming from (history, as of when)
Sara's own wording ("a new report a new board... just like how we have
dashboards and projects") reads as a first-class page. The existing
per-project Calendar view lives inside `FocusReportModal`, opened from a
report icon on a project card.

### Options presented
- **A) Standalone page** (product-owner + tech-lead recommendation) — new
  route `/focus-board` (working name), own header/filters, reuses the
  calendar renderer plus the newly-extracted shared report chrome.
- **B) Modal-overlay** — keep it a modal, just triggerable from the sidebar
  instead of a project card.

### Decision
**Chosen:** A — Standalone page
**Note from decision-maker:** Confirmed via one-by-one question walkthrough.
**Rationale / implications:** Matches Sara's stated framing and the existing
nav pattern (Dashboard/Projects are pages, not modals).

---

## DEC-2 — Session filter scoping
- **Item / area:** Filter UX
- **Status:** DECIDED (differs from both offered options — see below)
- **Raised:** 2026-07-26 · **Decided:** 2026-07-26 · **Decided by:** Sara
- **Recurring-issue link:** —

### The question
Should the session filter list every session across all projects, or only
sessions belonging to whichever project is currently selected?

### Where we're coming from (history, as of when)
Not stated explicitly in Sara's ask. A global session list could be large and
unwieldy on installs with long history.

### Options presented
- **A) Scoped to selected project** (recommended) — session dropdown is
  empty/disabled until a project is chosen, then lists that project's
  sessions only.
- **B) Global list** — every session across every project, unfiltered.

### Decision
**Chosen:** Neither A nor B as offered — **C) Global session list, PLUS a
third, independent filter: a time-period selector**, defaulting to "today."
**Note from decision-maker (verbatim):** "its global and it would only show
the current day, there needs to be a time period selector in addition to the
project selector so we can filter to the desired data"
**Rationale / implications:** This changes the shape of the board's filter
bar from two controls (project, session) to three (project, session,
time-period), and changes the default view from "unfiltered, bounded by a
server-side 30-day window" (DEC-3's original framing) to "today, by default,
user-adjustable." This has downstream implications for DEC-3 (the time-window
default) and for the technical plan's query-param design and default UI
state — flagged for the tech lead to revise before build.

---

## DEC-3 — Default/unfiltered state ("all projects") + time-period selector
- **Item / area:** Filter UX / data scope
- **Status:** DECIDED (superseded by DEC-2's time-period-selector requirement — question reframed accordingly)
- **Raised:** 2026-07-26 · **Decided:** 2026-07-26 · **Decided by:** Sara
- **Recurring-issue link:** —

### The question
Is "all projects, unfiltered" a valid default landing state for the board, or
must a project always be selected first? If unfiltered is allowed, what
bounds the query so it can't become unbounded on a long-lived install?

### Where we're coming from (history, as of when)
The architect flagged that removing the existing per-project scope removes a
natural bound on the query; the tech lead's plan proposes a time-window
default to address this.

### Options presented
- **A) "All projects" is the default state, bounded by a 30-day rolling
  window** (recommended, per tech-lead's plan) — new env knob
  `DASHBOARD_FOCUS_BOARD_WINDOW_DAYS` (default 30), applied only when neither
  `project_id` nor `session_id` is given.
- **B) A project must always be selected** — no true "all projects" view;
  simpler, but doesn't match Sara's "select which project" phrasing implying
  project is a filter, not a requirement.

### Decision
**Chosen:** Day picker + custom range. Default view: today, all projects
(project filter optional, not required). Time-period selector supports
day-by-day navigation (prev/today/next, like the existing per-project
calendar) AND a custom date-range picker. Since every query is now bounded by
the selected time period (not left unbounded), the server-side
`DASHBOARD_FOCUS_BOARD_WINDOW_DAYS` 30-day-default-window mechanism from the
original tech-lead draft is **no longer needed** — the time period IS the
bound, always supplied by the client.
**Note from decision-maker:** Confirmed via one-by-one question walkthrough,
following DEC-2's time-period-selector requirement.
**Rationale / implications:** Simpler than a hidden server-side default —
the bound is explicit and user-controlled. Tech lead should drop the env-knob
mechanism and instead require `from`/`to` (or equivalent) as effectively
mandatory query params on the new endpoint, with the client always supplying
them (defaulting to "today" on first load).

---

## DEC-4 — Fate of the existing per-project modal
- **Item / area:** Scope boundary
- **Status:** DECIDED
- **Raised:** 2026-07-26 · **Decided:** 2026-07-26 · **Decided by:** Sara
- **Recurring-issue link:** —

### The question
Once the standalone board exists, should the existing per-project
`FocusReportModal` entry point (on project cards / Kanban) be left as-is, or
consolidated/removed?

### Where we're coming from (history, as of when)
CLAUDE.md's "preserve existing behavior unless explicitly asked to change
it" rule, plus this being the same session where the modal's Calendar view
was just fixed for data fidelity (this morning's `focus-report-fidelity`
cycle) — reworking or removing it now would add unrelated risk to this
request.

### Options presented
- **A) Leave the modal untouched** (recommended) — both entry points coexist;
  consolidation is a separate future ask if wanted.
- **B) Deprecate/remove the modal** in favor of the new board.

### Decision
**Chosen:** A — Leave the existing modal untouched.
**Note from decision-maker:** Confirmed via one-by-one question walkthrough.
**Rationale / implications:** Minimal, reversible diff; avoids touching a
surface that was just fixed today.

---

## DEC-5 — Nav label and position
- **Item / area:** Nav/UX polish
- **Status:** DECIDED
- **Raised:** 2026-07-26 · **Decided:** 2026-07-26 · **Decided by:** Sara
- **Recurring-issue link:** —

### The question
What should the new sidebar entry be called, and where should it sit in the
list (`Dashboard, Projects, Kanban Board, Sessions, Activity Feed, Analytics,
Workflows, Claude Config, Run, Settings`)?

### Where we're coming from (history, as of when)
Sara called it "the calendar board" in conversation but didn't specify final
copy or position.

### Options presented
- **A) "Focus Calendar"**, placed right after "Projects" — reads as a peer of
  the existing Dashboard/Projects entries per Sara's own framing.
- **B) Some other label/position** — Sara's call.

### Decision
**Chosen:** "Calendar", placed right after "Projects" in the sidebar.
**Note from decision-maker:** Confirmed via one-by-one question walkthrough.
**Rationale / implications:** Requires a new i18n key across all 4 locale
`nav.json` files (en/vi/zh/ko) per the engineer's flagged sync trap.

---

## DEC-6 — `concurrency_ratio` copy on the aggregate view
- **Item / area:** Data semantics / copy
- **Status:** DECIDED
- **Raised:** 2026-07-26 · **Decided:** 2026-07-26 · **Decided by:** Sara
- **Recurring-issue link:** —

### The question
The existing per-project report includes a `concurrency_ratio` stat (how
much of the wall-clock span had overlapping sessions). Across an "all
projects" aggregate view, does this number still mean the same thing, and how
should it be labeled so it isn't misread?

### Where we're coming from (history, as of when)
`buildProjectFocusReport` computes this via interval-merging session spans;
the tech lead's plan reuses the builder unchanged, so the number will compute
correctly but its real-world meaning shifts once sessions can span unrelated
projects.

### Options presented
- **A) Keep the stat, relabel copy** to make clear it's cross-project overlap
  ("concurrent agent sessions"), not per-project multitasking.
- **B) Hide the stat** on the aggregate/all-projects view; show it only when
  a single project is selected.

### Decision
**Chosen:** A — Keep the stat, relabel copy (e.g. "Concurrent agent
sessions") so it reads correctly as cross-project overlap.
**Note from decision-maker:** Confirmed via one-by-one question walkthrough.
**Rationale / implications:** Low build cost; tech lead should specify the
exact relabeled copy in the technical plan's UI-copy section.

---
