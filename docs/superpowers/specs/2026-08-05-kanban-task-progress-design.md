# Kanban Task Progress — Percent-Complete on Agent Cards (Design Spec)

**Date:** 2026-08-05
**Status:** Approved (design) — decisions locked, ready for planning
**Owner:** Son Nguyen (David)
**Branch:** `feat/task-percentage-done`
**Topic:** Show an estimated completion indicator (progress bar + `done/total` count) on the Kanban `AgentCard`s, derived from the agent's own TodoWrite list (per-agent) and from Workflow-tool run state (fleets). Honest, source-labelled, and hidden when there is no real denominator.

---

## 1. Summary

Agent cards on the Kanban board (`working | waiting | completed | error`) currently show status, tool, model, cost, and elapsed time — but **nothing about how far along the task is**. This feature adds a slim progress bar plus a `3/5` count to a card **only when a real denominator exists**.

There is no ground-truth "percent done" for an AI task, so we do **not** invent one. We surface the two signals that carry a genuine denominator:

1. **TodoWrite (Fase 1)** — when an agent maintains a todo list, `completed / total` items is a real, self-declared measure of its own plan. This is the primary signal.
2. **Workflow runs (Fase 2)** — for a Workflow-tool fleet, `agents done / total agents` is a real measure of the run. This reuses data already ingested into the `workflows` table.

When neither signal is present, the card shows **no** progress element — no time-based or tool-count guessing (that noise would destroy the indicator's credibility). Each progress value is tagged with its `source` so the UI and tooltip stay honest.

The transport layer needs **zero** new plumbing: agent rows are returned via `SELECT * FROM agents` and broadcast whole (`broadcast("agent_updated", stmts.getAgent.get(id))`), so new columns flow to REST + WebSocket automatically, and the board already re-fetches columns on every relevant WS message.

---

## 2. Goals / Non-Goals

### Goals
- A truthful, at-a-glance progress indicator on `AgentCard` for tasks that expose a real denominator.
- Bar + `done/total` label on the card; exact `%` in the hover tooltip (per approved design decision).
- Progress computed from `completed / total` **unweighted** — bar and count always agree (`3/5` ⇒ bar at 60%; `in_progress` counts as not-done).
- Reuse existing signals: TodoWrite hook payloads (currently discarded) and `workflows.progress` (already ingested).
- Fail-safe ingestion — TodoWrite parsing never blocks or breaks the hook transaction.
- Additive, migration-safe schema; backward-compatible REST + WebSocket payloads.
- Source-labelled (`todo` vs `workflow`) so the number is never misread.

### Non-Goals (YAGNI)
- **No** time-based or tool-count percentage (Fase 3 fallback explicitly rejected).
- **No** weighting of `in_progress` items.
- No progress on `SessionCard` (sessions aggregate many agents; out of scope for v1).
- No historical progress timeline / sparkline — just the current value.
- No new WebSocket message type, no new REST endpoint.
- No changes to the status state machines (`working/waiting/completed/error`).
- No persistence of todo item *contents* as structured rows — only the two counts.

---

## 3. Signals & rationale (feasibility recap)

| Signal | Denominator? | Quality | Where it lives today |
|---|---|---|---|
| **TodoWrite** items | ✅ `completed/total` | **High** — the agent's declared plan | Discarded into `events.data` (`hooks.js` ~L1036), `tool_name='TodoWrite'` |
| **Workflow** agents/phases | ✅ `done/total` agents | High (fleets only) | `workflows.progress` JSON (`workflow-ingest.js`) |
| Tool-call count | ❌ no target | Low | `events` rows |
| Elapsed time | ❌ no expected duration | Very low (misleading) | `started_at`/`ended_at` |

TodoWrite is the gold signal and is currently thrown away — the hook arrives but is only stored as an opaque blob. Parsing it is the core of the feature.

---

## 4. Data model changes (schema)

Two additive columns on `agents` (pattern matches existing `ALTER TABLE ... ADD COLUMN` migrations in `server/db.js`, e.g. `workflow_run_id`/`workflow_phase` at ~L482):

| Column | Type | Meaning |
|---|---|---|
| `todo_done` | `INTEGER` | completed todo items (or done workflow agents) — nullable |
| `todo_total` | `INTEGER` | total todo items (or total workflow agents) — nullable |
| `progress_source` | `TEXT` | `'todo'` \| `'workflow'` \| `NULL` — what produced the counts |

- **NULL means "no progress known"** — the UI renders nothing. This is the default for every existing row after migration.
- Store **raw counts**, not a pre-computed percent — keeps the source data and lets the client format the bar and label consistently.
- Naming: `todo_*` is kept generic because Fase 2 reuses the same columns with `progress_source='workflow'`; the alternative (`progress_done`/`progress_total`) is cleaner but a larger rename. **Open item #1** — decide the column names at planning.

No changes to `sessions`, `events`, or `workflows` tables. New columns are covered by `SELECT *`, so REST (`server/routes/agents.js`) and WS broadcasts carry them with no mapper edit.

---

## 5. Fase 1 — TodoWrite ingestion (server)

**Where:** `server/routes/hooks.js`, inside `processEvent`, on the `PostToolUse` branch (~L484). We use `PostToolUse` (not `PreToolUse`) so the todo list reflects the state *after* the write.

**Logic (fail-safe, wrapped in try/catch):**
```
if (toolName === 'TodoWrite') {
  const todos = Array.isArray(toolInput?.todos) ? toolInput.todos : [];
  if (todos.length > 0) {
    const total = todos.length;
    const done  = todos.filter(t => t && t.status === 'completed').length;
    stmts.updateAgentProgress.run(done, total, 'todo', agentId);
  }
}
```
- Attaches to the **agent that emitted the call** (the resolved `agentId` in that branch — typically the session's main agent, but a subagent that runs TodoWrite gets its own counts).
- A new prepared statement `updateAgentProgress` (`UPDATE agents SET todo_done=?, todo_total=?, progress_source=? WHERE id=?`).
- The existing branch already re-broadcasts the updated agent (`broadcast("agent_updated", stmts.getAgent.get(mainAgentId))`), so the new counts ship on the same frame — **no extra broadcast**.
- Parse errors or unexpected shapes → caught, logged, ignored. Never throws inside the transaction (backend rule: non-blocking hooks).

**Codex path:** the Codex ingest (`lib/codex-ingest.js`) has no TodoWrite equivalent; Codex agents simply keep `NULL` progress. Documented, not a regression.

### 5.1 Terminal / reset behavior
- **Agent completes** (`status → completed`): leave the last counts as-is (a completed agent showing its final `5/5` or `3/5` is truthful). The **card only renders the bar for `working` agents** (see §7), so a completed card shows no bar regardless — this keeps completed columns clean while preserving the data.
- **New todo list replaces old** (agent starts a fresh plan): TodoWrite always sends the *full* current list, so `total`/`done` naturally reset to the new list on the next call. No stale accumulation.

---

## 6. Fase 2 — Workflow fleet progress (server)

Workflow runs already store a `progress[]` JSON with one `workflow_agent` entry per inner agent, each carrying a `state` (`done | error | running | queued`). The run's main agent (`${sessionId}-main`) is the board card that represents the fleet.

**Derivation (in `server/lib/workflow-ingest.js`, at the end of both `ingestWorkflowJournal` and the live-run builder):**
```
const agentEntries = progress.filter(e => e?.type === 'workflow_agent');
const total = agentEntries.length;             // == journal.agentCount
const done  = agentEntries.filter(e => ['done','error'].includes(e.state)).length;
if (total > 0) stmts.updateAgentProgress.run(done, total, 'workflow', mainAgentId);
```
- Counts **`done` and `error`** as finished (an errored agent won't progress further — it's "resolved", not "in flight"). Bar reflects fleet completion.
- Uses the same `updateAgentProgress` statement and the same three columns, with `progress_source='workflow'`.
- **Live runs:** the real-time builder (`buildLiveWorkflow`, ~L407) already reconstructs `progress[]` from streaming transcripts; total grows as agents appear. The denominator is provisional until the terminal journal lands (flagged in tooltip via the `workflow` source — see §7). This matches the known limitation that phase/agent totals are only final at completion.

### 6.1 Precedence (todo vs workflow on the same agent)
A workflow orchestrator's main agent can have *both* its own TodoWrite list and a workflow run. Rule: **`todo` wins when present.** Concretely, the workflow update only writes progress if the agent's `progress_source` is not already `'todo'`, OR the todo update always overwrites workflow (todo is finer-grained and agent-authored). Chosen rule: **TodoWrite writes unconditionally; workflow writes only when `progress_source` is `NULL` or `'workflow'`.** This gives a single bar per card with a deterministic source. **Open item #2** — confirm this precedence.

---

## 7. UI — AgentCard rendering (client)

**Types** (`client/src/lib/types.ts`, `Agent` interface ~L720): add
```ts
todo_done?: number | null;
todo_total?: number | null;
progress_source?: 'todo' | 'workflow' | null;
```

**Component** (`client/src/components/AgentCard.tsx`, meta row ~L269): a new presentational `<ProgressBar>` piece rendered **only when**:
- `agent.status === 'working'` **and**
- `todo_total` is a number `> 0`.

Render:
- A slim bar (track + fill) using existing theme tokens (`surface-*`, `accent`) — width = `done/total * 100%`.
- A compact label `done/total` (e.g. `3/5`) beside/under the bar.
- `title` (tooltip) = exact percent + source, e.g. `"60% · 3 of 5 todos done"` or `"60% · 3 of 5 agents done (workflow)"`. i18n keys under a `progress:*` namespace.
- Accessible: `role="progressbar"` with `aria-valuenow/min/max` and an `aria-label`.

**Where in the layout:** its own line in the card body (below the task preview, above or within the meta row) so it doesn't crowd the existing tool/model/cost/time chips. Exact placement finalized against the render snapshot.

**No SessionCard change** (§2 non-goal).

The board (`KanbanBoard.tsx`) needs **no** change — it re-fetches columns on `agent_updated` (debounced 300ms) and the new fields ride along.

---

## 8. Edge cases

| Case | Behavior |
|---|---|
| Agent never calls TodoWrite, not a workflow | `NULL` progress → no bar. |
| `todo_total === 0` (empty list write) | Ignored (guarded) → no bar, no divide-by-zero. |
| Agent `waiting`/`completed`/`error` | Data retained; bar hidden (only `working` renders). |
| Todo list shrinks/replaced | Full-list semantics → counts reset cleanly. |
| Subagent runs its own TodoWrite | Gets its own per-agent counts (correct). |
| Live workflow, growing total | Bar reflects current known total; tooltip source = `workflow`. |
| Old clients / old rows | Fields absent/NULL → render nothing (backward-compatible). |

---

## 9. Phasing

- **Fase 1 — TodoWrite (core, ~½ day):** migration + `updateAgentProgress` stmt + `PostToolUse` parse + `Agent` type + `ProgressBar` + tooltip/i18n + tests. Ship and validate here first.
- **Fase 2 — Workflow fleets (+2–3h):** derive `done/total` in `workflow-ingest.js` (journal + live), reuse the same columns/UI. Precedence rule applied.

Fase 3 (time/tool fallback): **rejected**, not built.

---

## 10. Verification (per CLAUDE.md)

- **Backend:** `npm run test:server`
  - `PostToolUse` with a `TodoWrite` payload → agent row has expected `todo_done/todo_total/progress_source='todo'`.
  - Empty todos / malformed payload → no write, no throw (fail-safe).
  - Workflow ingest (journal fixture) → main agent gets `done/total`, `progress_source='workflow'`.
  - Precedence: agent with todo progress is not overwritten by a later workflow update.
  - Migration idempotent on an existing DB (columns added once, NULL default).
- **Frontend:** `npm run test:client`
  - `ProgressBar` unit: `3/5` → 60% width, correct `aria` + tooltip; `0`/NULL → renders nothing.
  - `AgentCard`: bar shown only for `working` + `todo_total>0`.
  - Review + regenerate `screens.snapshot.test.tsx` baselines intentionally (`cd client && npx vitest run -u`).
- **Docs:** run `update-project-docs` — `docs/DATABASE.md` (new columns), `docs/HOOKS.md` (TodoWrite now consumed), any card/UI reference.
- **Headers:** every touched `.js/.ts/.tsx` keeps the `@author` header; `bash .claude/skills/file-headers/scripts/check-headers.sh` exits 0.

---

## 11. File change summary

**Server**
- `server/db.js` — migration (3 `ADD COLUMN`), `updateAgentProgress` prepared statement.
- `server/routes/hooks.js` — TodoWrite parse in `PostToolUse` (Fase 1).
- `server/lib/workflow-ingest.js` — derive fleet `done/total` in journal + live builders (Fase 2).

**Client**
- `client/src/lib/types.ts` — 3 fields on `Agent`.
- `client/src/components/AgentCard.tsx` — `ProgressBar` render (+ small `ProgressBar` subcomponent, inline or `client/src/components/ProgressBar.tsx`).
- i18n locale files — `progress:*` keys.

**Tests**
- `server/**/__tests__` — ingestion + migration + precedence.
- `client/src/components/__tests__` — `ProgressBar` / `AgentCard`.
- `client/src/pages/__tests__/screens.snapshot.test.tsx` — regenerated baseline.

**Docs**
- `docs/DATABASE.md`, `docs/HOOKS.md` (+ any others flagged by `update-project-docs`).

---

## 12. Decisions (locked 2026-08-05)
1. **Column names:** `todo_done` / `todo_total` (+ `progress_source`) — generic, reused by workflow.
2. **Precedence:** TodoWrite writes unconditionally; workflow writes only when `progress_source` is `NULL` or `'workflow'`. TodoWrite wins.
3. **ProgressBar placement:** its own line in the card body (below the task preview), not an inline meta-row chip.
4. **`ProgressBar` location:** shared, pure presentational `client/src/components/ProgressBar.tsx` — unit-testable in isolation.
