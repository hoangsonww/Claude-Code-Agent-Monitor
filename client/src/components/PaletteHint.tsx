/**
 * @file PaletteHint.tsx
 * @description The `⌘K` chip shown beside a page's own search field, teaching the
 * global palette at the moment the user is already searching for something.
 *
 * It decorates an input that exists rather than adding chrome of its own, and it
 * renders `null` forever once the palette has been opened once — a permanent
 * affordance for a fact you learn in a second is a bad trade. Purely
 * informational: `aria-hidden`, `pointer-events-none`, and never focusable, so it
 * neither intercepts a click into the field nor adds a stop for keyboard and
 * screen-reader users, who reach the palette by the chord itself.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/PaletteHint.tsx
 * **Area:** client component
 * **Responsibility:**
 * The `⌘K` chip shown beside a page's own search field, teaching the global palette at the moment
 * the user is already searching for something. It decorates an input that exists rather than adding
 * chrome of its own, and it renders `null` forever once the palette has been opened once — a
 * permanent affordance for a fact you learn in a second is a bad trade. Purely informational:
 * `aria-hidden` , `pointer-events-none` , and never focusable, so it neither intercepts a click
 * into the field nor adds a stop for keyboard and screen-reader users, who reach the palette by the
 * chord itself.
 *
 * ## Architectural boundary
 * - This component should express one reusable UI responsibility through typed props and observable
 *   callbacks.
 * - Network orchestration belongs in pages, hooks, or the typed API client unless this component
 *   explicitly owns the workflow.
 * - Visual state must remain a projection of props and local interaction state rather than a second
 *   server truth.
 *
 * ## Local dependency edges
 * - `../lib/paletteDiscovery` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 *
 * ## Public surface
 * - `paletteChordLabel` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `PaletteHint` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `isMacPlatform` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `paletteChordLabel` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `PaletteHint` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `PaletteHintProps` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## React and framework hooks
 * - `useShowPaletteHint` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Area invariants
 * - Keep prop meaning and callback timing stable; parent components often rely on both even when
 *   types still compile.
 * - Render valid semantic controls with accessible names, focus behavior, disabled states, and
 *   keyboard operation.
 * - Keep visible strings in the appropriate i18n namespace rather than embedding English-only
 *   literals.
 * - Use shared design tokens and existing primitives so light/dark styling and compact layouts
 *   remain coherent.
 * - Avoid mutating arrays or objects received through props; derived display data should be
 *   computed immutably.
 * - Make empty and unavailable values explicit instead of rendering misleading zeroes or
 *   placeholder punctuation.
 * - Keep event handlers narrow and prevent accidental bubbling only when the enclosing interaction
 *   requires it.
 * - Do not duplicate server validation or destructive gates as if client-side checks were
 *   authoritative.
 * - Preserve responsive behavior at narrow widths and avoid fixed dimensions that clip translated
 *   copy.
 * - Prefer stable keys derived from entity identity over array indexes for live, filtered, or
 *   reordered collections.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/PaletteHint.tsx` .
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
 * **Path:** `client/src/components/PaletteHint.tsx`
 * **Purpose:** Dashboard module consumed by the React client, MCP tools, or desktop shell depending on deployment mode.
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
 * - `../lib/paletteDiscovery`
 *
 * ## Public surface
 * - `paletteChordLabel` — exported API; see TSDoc on the symbol for behavior.
 * - `PaletteHint` — exported API; see TSDoc on the symbol for behavior.
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
 * **paletteChordLabel**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **PaletteHint**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useShowPaletteHint } from "../lib/paletteDiscovery";

/**
 * True on Apple platforms. `userAgentData` first — `navigator.platform` is
 * deprecated and lies under some privacy modes — and falsy wherever the platform
 * cannot be determined, because rendering `Ctrl` on a Mac is a smaller error than
 * rendering `⌘` on Windows.
 */
function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform =
    (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ||
    navigator.platform ||
    navigator.userAgent ||
    "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Platform-correct label for the palette chord, e.g. `⌘K` or `Ctrl K`. */
export function paletteChordLabel(): string {
  return isMacPlatform() ? "⌘K" : "Ctrl K";
}

/** Props for {@link PaletteHint}. */
interface PaletteHintProps {
  /**
   * `absolute` pins the chip inside a `relative` field wrapper (the Sessions
   * search box); `inline` sits in a flex row beside the input (Agent Config).
   */
  variant?: "absolute" | "inline";
}

/** Renders the chord chip, or nothing once the palette has been discovered. */
export function PaletteHint({ variant = "inline" }: PaletteHintProps) {
  const show = useShowPaletteHint();
  if (!show) return null;

  return (
    <kbd
      aria-hidden="true"
      className={`pointer-events-none select-none rounded border border-border bg-surface-2 px-1.5 py-0.5 font-sans text-[10px] text-gray-500 ${
        variant === "absolute" ? "absolute right-2.5 top-1/2 -translate-y-1/2" : "flex-shrink-0"
      }`}
    >
      {paletteChordLabel()}
    </kbd>
  );
}
