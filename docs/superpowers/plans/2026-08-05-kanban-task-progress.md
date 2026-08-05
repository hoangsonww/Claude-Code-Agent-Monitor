# Implementation Plan — Kanban Task Progress (Percent-Complete on Agent Cards)

**Date:** 2026-08-05
**Spec:** `docs/superpowers/specs/2026-08-05-kanban-task-progress-design.md`
**Branch:** `feat/task-percentage-done`
**Status:** Ready for implementation (Stage 4)

Locked decisions (from spec §12): columns `todo_done` / `todo_total` / `progress_source`; TodoWrite precedence over workflow; progress bar on its own line; shared `ProgressBar.tsx`; `completed/total` unweighted; bar shown only for `working` agents with `todo_total > 0`.

Verified code anchors (read before writing this plan):
- `server/routes/hooks.js`: `processEvent` transaction L332; `toolName = data.tool_name` L385; `agentId` inits to `mainAgentId` L387, reassigned to deepest working subagent in `PostToolUse` L506–511; `PostToolUse` branch L484–520. `tool_input` is **not** destructured → read `data.tool_input`.
- `server/db.js`: additive-migration pattern L479–485; `stmts` object near L1441 (`getAgent`).
- `server/lib/workflow-ingest.js`: journal `progress[]` parse L250–273; `ingestWorkflowJournal` upsert L291–309, agent loop L316; `mainAgentId = ${sessionId}-main` L282; live builder `progress` L453/489/531, upsert ~L565.
- `client/src/lib/types.ts`: `Agent` interface L720–787 (last field `cost?` L786).
- `client/src/components/AgentCard.tsx`: props L100, `useTranslation("kanban")` L112, task-preview block L255–267, meta row L269–313.
- i18n: namespace `kanban`, languages `en es ko vi zh` under `client/src/i18n/locales/<lng>/kanban.json`.
- Test harness (server): `node:test`; set `process.env.DASHBOARD_DB_PATH`; `const { createApp, startServer } = require("../index")`; POST helper `hook(hook_type, data) => POST /api/hooks/event { hook_type, data }` (see `awaiting-subagent-guard.test.js`). Component tests: vitest + RTL (see `StatCard.test.tsx`).
- Every touched `.js/.ts/.tsx` must keep/add the `@author Son Nguyen <hoangson091104@gmail.com>` header.

---

## Task 1 — Schema migration + prepared statement (`server/db.js`)

**1a. Migration.** Immediately AFTER the workflow-link migration block (after `CREATE INDEX ... idx_agents_workflow`, ~L485), insert:

```js
// Migrate: per-agent task-progress counts. `todo_done`/`todo_total` come from
// the agent's own TodoWrite list (completed/total items) or, for Workflow-tool
// runs, done/total inner agents. `progress_source` records which produced them
// ('todo' | 'workflow'). NULL everywhere = no progress known. Additive, safe on
// existing DBs.
try {
  db.prepare("SELECT todo_done FROM agents LIMIT 1").get();
} catch {
  db.prepare("ALTER TABLE agents ADD COLUMN todo_done INTEGER").run();
  db.prepare("ALTER TABLE agents ADD COLUMN todo_total INTEGER").run();
  db.prepare("ALTER TABLE agents ADD COLUMN progress_source TEXT").run();
}
```

**1b. Prepared statement.** In the `stmts` object, right after `getAgent` (L1441), add:

```js
  updateAgentProgress: db.prepare(
    "UPDATE agents SET todo_done = ?, todo_total = ?, progress_source = ? WHERE id = ?"
  ),
```

**No test of its own** (exercised by Tasks 2 & 3). File header already present — leave as is.

**Command:** `npm run test:server` (must stay green — migration must not break existing suites).

---

## Task 2 — Fase 1: TodoWrite ingestion (`server/routes/hooks.js`)

In the `PostToolUse` branch, AFTER the `agentId` reassignment block that ends at L511 (`}` closing `if (mainAgent && mainAgent.status === "waiting" ...)`), and BEFORE the `current_tool` clear at L513, insert:

```js
      // TodoWrite carries the agent's own plan — completed/total items is the
      // one real, self-declared progress denominator we get. Parse it into
      // per-agent counts and attribute to whoever ran it (agentId, already
      // resolved above to the deepest working subagent when main is waiting).
      // Fail-safe: a malformed payload must never throw inside this ingest
      // transaction (backend rule: hooks stay non-blocking).
      if (toolName === "TodoWrite") {
        try {
          const todos = Array.isArray(data.tool_input?.todos) ? data.tool_input.todos : [];
          if (todos.length > 0) {
            const total = todos.length;
            const done = todos.filter((item) => item && item.status === "completed").length;
            stmts.updateAgentProgress.run(done, total, "todo", agentId);
            broadcast("agent_updated", stmts.getAgent.get(agentId));
          }
        } catch {
          /* fail-safe: ignore malformed TodoWrite payloads */
        }
      }
```

Notes:
- Explicit `broadcast` here (not the conditional one at L517) so the card updates live even when `agentId` is a subagent or the main agent isn't `working`.
- Header already present.

### Task 2 test — `server/__tests__/task-progress-todo.test.js` (NEW)

```js
/**
 * @file Regression: TodoWrite hook payloads must be parsed into per-agent
 * progress counts (agents.todo_done / todo_total / progress_source='todo').
 * A completed/total denominator is the primary signal behind the Kanban
 * progress bar; malformed or empty payloads must never write or throw.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const fs = require("fs");
const http = require("http");

const TEST_DB = path.join(os.tmpdir(), `task-progress-todo-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { createApp, startServer } = require("../index");
const { db, stmts } = require("../db");

let server;
let BASE;

function fetchJson(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || "GET",
        headers: { "Content-Type": "application/json", ...options.headers },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(body);
          } catch {
            parsed = body;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}
const hook = (hook_type, data) =>
  fetchJson("/api/hooks/event", { method: "POST", body: { hook_type, data } });

before(async () => {
  const app = createApp();
  server = await startServer(app, 0);
  const addr = server.address();
  BASE = `http://127.0.0.1:${addr.port}`;
});

after(() => {
  if (server) server.close();
  if (db) db.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(TEST_DB + suffix);
    } catch {
      /* ignore */
    }
  }
});

async function driveWorkingMain(sid) {
  await hook("SessionStart", { session_id: sid });
  await hook("UserPromptSubmit", { session_id: sid, prompt: "go" });
}

describe("TodoWrite → agent progress", () => {
  it("writes completed/total and progress_source='todo' from a TodoWrite payload", async () => {
    const sid = "todo-basic";
    await driveWorkingMain(sid);
    await hook("PostToolUse", {
      session_id: sid,
      tool_name: "TodoWrite",
      tool_input: {
        todos: [
          { content: "a", status: "completed" },
          { content: "b", status: "completed" },
          { content: "c", status: "in_progress" },
          { content: "d", status: "pending" },
          { content: "e", status: "pending" },
        ],
      },
    });
    const agent = stmts.getAgent.get(`${sid}-main`);
    assert.equal(agent.todo_total, 5);
    assert.equal(agent.todo_done, 2); // in_progress counts as NOT done (unweighted)
    assert.equal(agent.progress_source, "todo");
  });

  it("updates counts when a later TodoWrite replaces the list", async () => {
    const sid = "todo-replace";
    await driveWorkingMain(sid);
    await hook("PostToolUse", {
      session_id: sid,
      tool_name: "TodoWrite",
      tool_input: { todos: [{ content: "x", status: "completed" }] },
    });
    await hook("PostToolUse", {
      session_id: sid,
      tool_name: "TodoWrite",
      tool_input: {
        todos: [
          { content: "x", status: "completed" },
          { content: "y", status: "completed" },
          { content: "z", status: "pending" },
        ],
      },
    });
    const agent = stmts.getAgent.get(`${sid}-main`);
    assert.equal(agent.todo_total, 3);
    assert.equal(agent.todo_done, 2);
  });

  it("ignores an empty todos array (no write, no throw)", async () => {
    const sid = "todo-empty";
    await driveWorkingMain(sid);
    await hook("PostToolUse", {
      session_id: sid,
      tool_name: "TodoWrite",
      tool_input: { todos: [] },
    });
    const agent = stmts.getAgent.get(`${sid}-main`);
    assert.equal(agent.todo_total, null);
    assert.equal(agent.progress_source, null);
  });

  it("ignores a malformed TodoWrite payload without throwing", async () => {
    const sid = "todo-malformed";
    await driveWorkingMain(sid);
    const res = await hook("PostToolUse", {
      session_id: sid,
      tool_name: "TodoWrite",
      tool_input: { todos: "not-an-array" },
    });
    assert.equal(res.status, 200);
    const agent = stmts.getAgent.get(`${sid}-main`);
    assert.equal(agent.todo_total, null);
  });

  it("leaves non-TodoWrite tools untouched", async () => {
    const sid = "todo-other-tool";
    await driveWorkingMain(sid);
    await hook("PreToolUse", { session_id: sid, tool_name: "Read", tool_input: {} });
    await hook("PostToolUse", { session_id: sid, tool_name: "Read", tool_input: {} });
    const agent = stmts.getAgent.get(`${sid}-main`);
    assert.equal(agent.todo_total, null);
    assert.equal(agent.progress_source, null);
  });
});
```

> Implementer note: confirm `startServer(app, 0)` returns/`resolve`s the `http.Server` and that `server.address().port` is available (match whatever `awaiting-subagent-guard.test.js` / `session-liveness.test.js` do in this repo — mirror that exact bootstrap if the signature differs). Adjust only the bootstrap, not the assertions.

**Command:** `npm run test:server` → the new suite passes; all pre-existing suites stay green.

---

## Task 3 — Fase 2: Workflow fleet progress (`server/lib/workflow-ingest.js`)

Goal: after a workflow's agents are known, write `done/total` to the run's **main agent** (`${sessionId}-main`) with `progress_source='workflow'`, **without** clobbering a `'todo'` source (precedence).

**3a. Add a precedence-aware helper** (module-scope, near `mapState`):

```js
/**
 * Write fleet progress (done/total inner agents) onto the run's main agent,
 * but never overwrite a finer-grained 'todo' progress the orchestrator set for
 * itself. Counts a `done` OR `error` inner agent as finished (an errored agent
 * won't progress further). No-op when there are no inner agents.
 */
function writeWorkflowProgress(dbModule, mainAgentId, progress) {
  const { stmts } = dbModule;
  const entries = Array.isArray(progress)
    ? progress.filter((e) => e && e.type === "workflow_agent")
    : [];
  const total = entries.length;
  if (total === 0) return;
  const done = entries.filter((e) => e.state === "done" || e.state === "error").length;
  const main = stmts.getAgent.get(mainAgentId);
  if (!main) return;
  if (main.progress_source === "todo") return; // TodoWrite wins (spec §6.1)
  stmts.updateAgentProgress.run(done, total, "workflow", mainAgentId);
}
```

**3b. Call it in the journal path.** In `ingestWorkflowJournal`, after the agent loop completes (after the `for (const entry of agentEntries)` block, before the function returns the upserted workflow row), add:

```js
  try {
    writeWorkflowProgress(dbModule, mainAgentId, journal.progress);
  } catch {
    /* progress is best-effort; never fail the ingest over it */
  }
```

**3c. Call it in the live path.** In the live-run builder (the block ~L407–575 that upserts the workflow from the reconstructed `progress[]`), after `progress` is fully built and before/after the workflow upsert, add the same guarded call using that scope's `progress` array and `${sessionId}-main` (bind `mainAgentId` if not already in scope):

```js
  try {
    writeWorkflowProgress(dbModule, `${sessionId}-main`, progress);
  } catch {
    /* best-effort */
  }
```

> Implementer note: verify the exact variable names in the live builder (`sessionId`, `progress`, and whether a `dbModule`/`stmts` handle is in scope) and wire the call to match. Do not change the workflow upsert itself.

### Task 3 test — `server/__tests__/task-progress-workflow.test.js` (NEW)

Mirror the harness of the existing `import-workflow-link.test.js` / `workflow-ingest.test.js` (same suite already builds a journal fixture and calls the ingest). The implementer MUST open one of those two files and copy its exact fixture-building + ingest-invocation approach, then assert:

```js
// after ingesting a journal whose progress[] has 3 workflow_agent entries
// (2 state:"done", 1 state:"running") for session `sid`:
const main = stmts.getAgent.get(`${sid}-main`);
assert.equal(main.todo_total, 3);
assert.equal(main.todo_done, 2);
assert.equal(main.progress_source, "workflow");

// precedence: if the main agent already has progress_source='todo' with counts,
// a subsequent workflow ingest must NOT overwrite them.
stmts.updateAgentProgress.run(1, 4, "todo", `${sid}-main`);
// ...re-run the same ingest...
const main2 = stmts.getAgent.get(`${sid}-main`);
assert.equal(main2.progress_source, "todo");
assert.equal(main2.todo_total, 4);
assert.equal(main2.todo_done, 1);
```

Header on the new test file required.

**Command:** `npm run test:server`.

---

## Task 4 — Client: `Agent` type, `ProgressBar` component, `AgentCard` integration

**4a. Type** — `client/src/lib/types.ts`, in `interface Agent`, after `cost?` (L786):

```ts
  /** Completed items of the agent's progress denominator — TodoWrite completed
   *  items, or done/errored Workflow inner agents. Null when no progress is
   *  known. Maps to `agents.todo_done`. */
  todo_done?: number | null;
  /** Total items of the progress denominator (todo items, or total Workflow
   *  inner agents). Null when unknown. Maps to `agents.todo_total`. */
  todo_total?: number | null;
  /** What produced the counts above: 'todo' (agent's own TodoWrite list) or
   *  'workflow' (fleet done/total); null when no progress. Maps to
   *  `agents.progress_source`. */
  progress_source?: "todo" | "workflow" | null;
```

**4b. Component** — `client/src/components/ProgressBar.tsx` (NEW):

```tsx
/**
 * @file ProgressBar.tsx
 * @description A slim, accessible task-progress bar for Kanban agent cards.
 * Given completed/total counts it renders a track+fill plus a compact
 * "done/total" label; the exact percent + source live in the hover tooltip.
 * Pure presentational — no data access — so it is unit-testable in isolation.
 * Renders nothing when there is no real denominator (total <= 0).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

interface ProgressBarProps {
  /** Completed units (todo items done, or finished workflow agents). */
  done: number;
  /** Total units. When <= 0 the component renders nothing. */
  total: number;
  /** Tooltip text (exact percent + source), supplied by the caller for i18n. */
  title?: string;
  /** Accessible label, supplied by the caller for i18n. */
  ariaLabel?: string;
}

export function ProgressBar({ done, total, title, ariaLabel }: ProgressBarProps) {
  if (!Number.isFinite(total) || total <= 0) return null;
  const safeDone = Math.max(0, Math.min(done, total));
  const pct = Math.round((safeDone / total) * 100);
  return (
    <div
      className="flex items-center gap-2"
      title={title}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={safeDone}
      aria-label={ariaLabel}
    >
      <div className="h-1.5 flex-1 min-w-0 rounded-full bg-surface-3 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-mono text-gray-500 flex-shrink-0 tabular-nums">
        {safeDone}/{total}
      </span>
    </div>
  );
}
```

> Implementer note: confirm the theme token for the track (`bg-surface-3`) exists in this Tailwind config; if the scale differs, use the nearest existing surface token used elsewhere in cards. Fill uses `bg-accent` (already used across cards).

**4c. AgentCard integration** — `client/src/components/AgentCard.tsx`:

1. Import: `import { ProgressBar } from "./ProgressBar";`
2. Derive, near the other `const` derivations (after `cost`, ~L137):

```tsx
  // Progress bar shows only when the agent is actively working AND has a real
  // denominator (TodoWrite items or workflow fleet). No denominator → no bar
  // (we never fake a percent from time/tool-counts).
  const progressTotal = typeof agent.todo_total === "number" ? agent.todo_total : 0;
  const progressDone = typeof agent.todo_done === "number" ? agent.todo_done : 0;
  const showProgress = isActive && progressTotal > 0;
  const progressPct = progressTotal > 0 ? Math.round((Math.min(progressDone, progressTotal) / progressTotal) * 100) : 0;
```

3. Render on its own line, BETWEEN the task-preview block (closes L267) and the meta row (opens L269):

```tsx
      {showProgress && (
        <div className="mb-3">
          <ProgressBar
            done={progressDone}
            total={progressTotal}
            title={t("progress.tooltip", {
              pct: progressPct,
              done: progressDone,
              total: progressTotal,
              context: agent.progress_source === "workflow" ? "workflow" : "todo",
            })}
            ariaLabel={t("progress.aria", { pct: progressPct })}
          />
        </div>
      )}
```

**4d. i18n** — add a `progress` block to `kanban.json` for **all five** languages (`en es ko vi zh`). English:

```json
  "progress": {
    "tooltip_todo": "{{pct}}% · {{done}} of {{total}} todos done",
    "tooltip_workflow": "{{pct}}% · {{done}} of {{total}} agents done",
    "aria": "Task {{pct}}% complete"
  },
```

> i18next `context` maps `progress.tooltip` + `context:"todo"|"workflow"` → keys `tooltip_todo` / `tooltip_workflow`. Provide translated strings for `es`, `ko`, `vi`, `zh` (do not leave English placeholders — match how the rest of each file is localized). Keep placeholder names identical across languages.

### Task 4 test — `client/src/components/__tests__/ProgressBar.test.tsx` (NEW)

```tsx
/**
 * @file Unit tests for ProgressBar — width from done/total, label, a11y attrs,
 * and the render-nothing contract when there is no denominator.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressBar } from "../ProgressBar";

describe("ProgressBar", () => {
  it("renders a done/total label", () => {
    render(<ProgressBar done={3} total={5} />);
    expect(screen.getByText("3/5")).toBeInTheDocument();
  });

  it("sets progressbar aria attributes", () => {
    render(<ProgressBar done={3} total={5} ariaLabel="Task 60% complete" />);
    const bar = screen.getByRole("progressbar", { name: "Task 60% complete" });
    expect(bar).toHaveAttribute("aria-valuenow", "3");
    expect(bar).toHaveAttribute("aria-valuemax", "5");
  });

  it("computes 60% fill width for 3/5", () => {
    const { container } = render(<ProgressBar done={3} total={5} />);
    const fill = container.querySelector('[style*="width"]');
    expect(fill).toHaveStyle({ width: "60%" });
  });

  it("clamps done to total", () => {
    render(<ProgressBar done={9} total={5} />);
    expect(screen.getByText("5/5")).toBeInTheDocument();
  });

  it("renders nothing when total is 0", () => {
    const { container } = render(<ProgressBar done={0} total={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

**Command:** `cd client && npm test` (or `npm run test:client`).

---

## Task 5 — Snapshot baseline, docs, headers, full verification

1. **Snapshot review:** `cd client && npx vitest run` — inspect the `screens.snapshot.test.tsx` diff; the progress bar should appear only on `working` agent cards that carry `todo_total`. If the snapshot fixtures have no such agent, the diff may be empty (acceptable). Regenerate intentionally: `cd client && npx vitest run -u`. Review the diff before committing — never blind-update.
2. **Docs (`update-project-docs` skill):**
   - `docs/DATABASE.md` — document the three new `agents` columns.
   - `docs/HOOKS.md` — note that `TodoWrite` `PostToolUse` payloads are now consumed into per-agent progress.
   - Any card/UI reference doc that lists card fields.
3. **Headers:** `bash .claude/skills/file-headers/scripts/check-headers.sh` → exit 0 (new `.tsx`/`.test.tsx`/`.js` files carry `@author`).
4. **Full gates:**
   - `npm run test:server`
   - `npm run test:client`
   - (No MCP surface touched — `mcp:typecheck` not required; state so if skipped.)

---

## Review gates (Stage 4, per task)

For each task: **spec-compliance review** (built exactly what spec §4–§8 says?) → **code-quality review** (fail-safe, backward-compatible, matches repo idioms, headers present) → fix loop → mark complete → next task.

## Final holistic review

Across all changed files: precedence correctness (todo never clobbered by workflow), no broadcast/WS shape regressions (`SELECT *` carries new columns; existing consumers unaffected by extra fields), bar hidden for non-working agents, i18n complete in all 5 languages, all four verification commands green.

## Ordered task list
1. Task 1 — schema migration + `updateAgentProgress` stmt.
2. Task 2 — TodoWrite ingestion + `task-progress-todo.test.js`.
3. Task 3 — workflow fleet progress + `task-progress-workflow.test.js`.
4. Task 4 — `Agent` type + `ProgressBar.tsx` + `AgentCard` wiring + i18n (×5) + `ProgressBar.test.tsx`.
5. Task 5 — snapshot/docs/headers/full verification.
