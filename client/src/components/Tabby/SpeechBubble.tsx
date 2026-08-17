/**
 * @file SpeechBubble.tsx
 * @description Transient speech bubble rendered above the Tabby cat mascot.
 * Pure presentation — visibility timing and quip selection live in
 * {@link useTabbyBrain}; this component only paints the bubble and handles
 * user dismissal.
 *
 * ## Accessibility
 * Uses `role="status"` with `aria-live="polite"` so screen readers announce
 * new quips without interrupting current speech. Click anywhere on the bubble
 * to dismiss early.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/Tabby/SpeechBubble.tsx`
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
 * ## Public surface
 * - `SpeechBubble` — exported API; see TSDoc on the symbol for behavior.
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
 * **SpeechBubble**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

/** Props for {@link SpeechBubble}. */
interface SpeechBubbleProps {
  /** Quip text to display inside the bubble. */
  text: string;
  /** Called when the user clicks to dismiss. */
  onDismiss: () => void;
}

/**
 * Animated speech bubble above Tabby.
 * @param props See {@link SpeechBubbleProps}.
 */
export function SpeechBubble({ text, onDismiss }: SpeechBubbleProps) {
  return (
    <div
      className="tabby-bubble tabby-bubble-enter"
      role="status"
      aria-live="polite"
      onClick={onDismiss}
      title="Dismiss"
    >
      {text}
    </div>
  );
}
