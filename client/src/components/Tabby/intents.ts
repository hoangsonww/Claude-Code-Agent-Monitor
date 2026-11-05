/**
 * @file intents.ts
 * @description Tabby's local "Ask" brain. Matches a free-text question against a
 *   small set of intents answerable from cached dashboard status. Anything it
 *   can't answer becomes a handoff to the Run page (spawn a real `claude`).
 *   Pure function - no network, no DOM - so it's fully unit-testable.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/Tabby/intents.ts
 * **Area:** client Tabby component
 * **Responsibility:**
 * Tabby's local "Ask" brain. Matches a free-text question against a small set of intents answerable
 * from cached dashboard status. Anything it can't answer becomes a handoff to the Run page (spawn a
 * real `claude` ). Pure function - no network, no DOM - so it's fully unit-testable.
 *
 * ## Architectural boundary
 * - Provides the optional Tabby companion layer without becoming a dependency of core monitoring
 *   workflows.
 * - Intent recognition, state transitions, positioning, and rendering remain separable so
 *   decoration cannot block data views.
 * - Reduced-motion, hidden, and disabled states are first-class outcomes rather than exceptional
 *   branches.
 *
 * ## Local dependency edges
 * - `./brain` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Public surface
 * - `AskResult` (type) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `matchIntent` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `AskResult` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `matchIntent` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `plural` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Area invariants
 * - Keep companion reactions deterministic for a given event/state input when tests assert a
 *   specific response.
 * - Bound timers, animation frames, listeners, and persisted position state; clean them up on
 *   unmount.
 * - Respect reduced-motion preferences and never require animation to communicate dashboard status.
 * - Keep the companion out of keyboard focus order unless an element performs an actual interactive
 *   action.
 * - Constrain dragging and restored coordinates to the current viewport after resizes or display
 *   changes.
 * - Avoid coupling core API requests or monitoring state transitions to companion visibility.
 * - Keep quips and intent vocabulary aligned with the localization decision already established by
 *   the module.
 * - Do not let decorative overlays cover destructive confirmations, navigation, or primary session
 *   controls.
 * - Prefer explicit state-machine transitions over intersecting booleans that allow impossible
 *   poses.
 * - Test cleanup with fake timers where time drives behavior, then restore timer globals after each
 *   case.
 *
 * ## Change-review checklist
 * - Read the file header and this generated index before changing code; both describe the intended
 *   ownership boundary.
 * - Trace every local import listed here to distinguish data contracts from presentation helpers
 *   and avoid circular dependencies.
 * - Search every exported symbol before changing its signature; callers may live in tests, route
 *   components, desktop code, or MCP wiring.
 * - Keep observable behavior stable unless the task explicitly requests a behavior change and
 *   includes regression coverage.
 * - Prefer the repository's existing helpers and types over parallel abstractions that encode the
 *   same contract twice.
 * - Keep failure behavior explicit: recoverable local failures should degrade visibly without
 *   hiding actionable diagnostics.
 * - Preserve deterministic ordering for lists, maps, serialized values, snapshots, and generated
 *   output where this module participates.
 * - Treat identifiers, API paths, event names, translation keys, and persisted field names as
 *   compatibility surfaces.
 * - Update the truthful file overview when the module's responsibility changes; never let the
 *   header become historical fiction.
 * - Run the narrowest relevant test first, then the area gate, then the full repository
 *   verification before merging.
 *
 * ## Focused validation
 * - Run `npm run typecheck:client` and resolve failures before widening the verification scope.
 * - Run `npm run test:client` and resolve failures before widening the verification scope.
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/Tabby/intents.ts` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
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

/**
 * Result of a question to Tabby: an answer to show inline, or a prompt to hand off to the Run page.
 */
export type AskResult = { kind: "answer"; text: string } | { kind: "handoff"; prompt: string };

/** Plural suffix for an English count. */
const plural = (n: number) => (n === 1 ? "" : "s");

/**
 * Answer simple status questions (what is running, how many sessions are waiting or errored, a
 * quick status) from the live counts. Anything else is handed off to Claude through the Run page.
 *
 * @param query - What the user typed.
 * @param status - Current live counts.
 * @returns An inline answer or a handoff prompt.
 */
export function matchIntent(query: string, status: TabbyStatus): AskResult {
  const q = query.trim().toLowerCase();
  if (!q) {
    return {
      kind: "answer",
      text: "ask me about your sessions - what's running, any errors, or a quick status.",
    };
  }

  /** Whether the question mentions any of the words. */
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
