/**
 * @file intents.ts
 * @description Tabby's local "Ask" brain. Matches a free-text question against a
 *   small set of intents answerable from cached dashboard status. Anything it
 *   can't answer becomes a handoff to the Run page (spawn a real `claude`).
 *   Pure function - no network, no DOM - so it's fully unit-testable.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/Tabby/intents.ts`
 * **Purpose:** Tabby is the optional on-screen cat assistant — quips, intents, and lightweight event reactions layered above the dashboard chrome.
 *
 * ## Design constraints
 * - Local-first: no telemetry leaves the machine unless the user configures webhooks.
 * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that
 *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).
 * - Destructive flows stay behind explicit confirmation modals and server-side gates.
 * - Internationalization: user-visible strings belong in i18n JSON, not literals here.
 *
 * ## Remote data & SSH
 * Remote Data Sources let operators aggregate multiple machines. SSH entries describe
 * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every
 * scoped GET via `?sources=`. Health checks and import history surface in Settings.
 *
 * ## Observability
 * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four
 * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and
 * Docker Compose profiles are documented in `monitoring/README.md`.
 *
 * ## Internal dependencies
 * - `./brain`
 *
 * ## Public surface
 * - `AskResult` — exported API; see TSDoc on the symbol for behavior.
 * - `matchIntent` — exported API; see TSDoc on the symbol for behavior.
 *
 * ## Testing pointers
 * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.
 * - Server contract changes require `npm run test:server` and OpenAPI sync.
 * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.
 *
 * ## Related docs
 * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.
 * - `docs/API.md` — REST reference.
 * - `.claude/skills/file-headers/` — mandatory `@author` header policy.
 * ============================================================================= */
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **AskResult**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **matchIntent**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import type { TabbyStatus } from "./brain";

export type AskResult = { kind: "answer"; text: string } | { kind: "handoff"; prompt: string };

const plural = (n: number) => (n === 1 ? "" : "s");

export function matchIntent(query: string, status: TabbyStatus): AskResult {
  const q = query.trim().toLowerCase();
  if (!q) {
    return {
      kind: "answer",
      text: "ask me about your sessions - what's running, any errors, or a quick status.",
    };
  }

  const has = (...words: string[]) => words.some((w) => q.includes(w));

  if (has("help", "what can you", "what do you do")) {
    return {
      kind: "answer",
      text: 'I watch your sessions. Try "what\'s running", "any errors", or "status". Anything else, I\'ll hand to Claude.',
    };
  }

  // Errors first: "any failed runs" should report errors, not live count.
  if (has("error", "broke", "broken", "fail", "wrong", "crash")) {
    return {
      kind: "answer",
      text:
        status.errorCount > 0
          ? `${status.errorCount} session${plural(status.errorCount)} errored - open the panel to jump to them.`
          : "no errors - all clean 🐾",
    };
  }

  if (has("waiting", "stuck", "blocked", "input", "my turn", "paused")) {
    return {
      kind: "answer",
      text:
        status.waitingCount > 0
          ? `${status.waitingCount} session${plural(status.waitingCount)} waiting on you 👀`
          : "nothing's waiting on you right now 🐾",
    };
  }

  if (has("running", "active", "live", "going on", "happening", "in progress")) {
    const tail = status.waitingCount > 0 ? ` (${status.waitingCount} waiting on you 👀)` : "";
    return {
      kind: "answer",
      text:
        status.liveCount > 0
          ? `${status.liveCount} session${plural(status.liveCount)} live right now 🐾${tail}`
          : "nothing's running right now - all quiet.",
    };
  }

  if (has("status", "summary", "overview", "how are things", "how's it", "how is it")) {
    return {
      kind: "answer",
      text: `${status.liveCount} live · ${status.waitingCount} waiting · ${status.errorCount} errored · ${
        status.connected ? "connected" : "offline"
      }.`,
    };
  }

  return { kind: "handoff", prompt: query.trim() };
}
