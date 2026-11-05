/**
 * @file main.tsx
 * @description Vite client entry point. Bootstraps React 19, loads global styles
 * and i18n, registers the service worker for offline asset caching, and mounts
 * {@link App} into `#root`.
 *
 * ## Fonts
 * Only Latin subsets of Inter and JetBrains Mono are imported so Vite bundles
 * lean WOFF2 files instead of every glyph subset Google Fonts would serve.
 *
 * ## Service worker reload policy
 * On first visit there is no controlling SW yet — we must not reload when the
 * initial SW activates (the page is already fresh). On subsequent deploys the
 * page is controlled; when a new SW takes over we reload once so hashed bundle
 * URLs update without a manual hard refresh.
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
 * **Module:** client/src/main.tsx
 * **Area:** client build or application entry
 * **Responsibility:**
 * Vite client entry point. Bootstraps React 19, loads global styles and i18n, registers the service
 * worker for offline asset caching, and mounts {@link App} into `#root` . ## Fonts Only Latin
 * subsets of Inter and JetBrains Mono are imported so Vite bundles lean WOFF2 files instead of
 * every glyph subset Google Fonts would serve. ## Service worker reload policy On first visit there
 * is no controlling SW yet — we must not reload when the initial SW activates (the page is already
 * fresh). On subsequent deploys the page is controlled; when a new SW takes over we reload once so
 * hashed bundle URLs update without a manual hard refresh.
 *
 * ## Architectural boundary
 * - Owns a focused TypeScript responsibility within the repository and should remain loadable only
 *   by its intended consumers.
 * - Public exports are compatibility surfaces; internal declarations may change only while their
 *   observable behavior remains stable.
 * - Cross-package dependencies should point through established contracts rather than reaching into
 *   build output or private state.
 *
 * ## Local dependency edges
 * - `./App` — repository-local contract consumed by this module; review its exports before changing
 *   assumptions here.
 * - `./i18n` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./index.css` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `@fontsource/inter/latin-400.css` — external package boundary; keep usage within the installed
 *   version and the repository's existing adapter patterns.
 * - `@fontsource/inter/latin-500.css` — external package boundary; keep usage within the installed
 *   version and the repository's existing adapter patterns.
 * - `@fontsource/inter/latin-600.css` — external package boundary; keep usage within the installed
 *   version and the repository's existing adapter patterns.
 * - `@fontsource/inter/latin-700.css` — external package boundary; keep usage within the installed
 *   version and the repository's existing adapter patterns.
 * - `@fontsource/jetbrains-mono/latin-400.css` — external package boundary; keep usage within the
 *   installed version and the repository's existing adapter patterns.
 * - `@fontsource/jetbrains-mono/latin-500.css` — external package boundary; keep usage within the
 *   installed version and the repository's existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-dom/client` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `root` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Area invariants
 * - Keep types narrower than the untrusted values they validate and avoid assertions that merely
 *   silence the compiler.
 * - Preserve deterministic output, ordering, and error behavior for identical inputs.
 * - Do not create module-evaluation side effects unless startup ownership is the module's explicit
 *   purpose.
 * - Use explicit units for time, bytes, tokens, money, and percentages.
 * - Keep nullable and optional fields distinct where absence carries meaning.
 * - Avoid hidden mutation of arguments and imported singleton state.
 * - Keep asynchronous work cancellable or safely ignorable after its consumer is gone.
 * - Return actionable errors without leaking secrets or unrelated implementation details.
 * - Document compatibility fallbacks beside the branch that implements them.
 * - Add focused tests for new boundary and failure cases.
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
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check client/src/main.tsx` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/main.tsx`
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
 * - `./App`
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

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Latin-only subset (matches the app's previous Google Fonts request) so Vite
// bundles just the latin WOFF2 per weight instead of every subset.
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import App from "./App";
import "./i18n";
import "./index.css";

if ("serviceWorker" in navigator) {
  // Detect whether the page is already controlled by an SW *before* we
  // register. On a truly fresh install there is no controller yet, so the
  // first `controllerchange` should NOT reload (the user just opened the page
  // - nothing is stale). On every subsequent rebuild the page is controlled,
  // a new SW takes over, and a one-shot reload picks up the new bundle URLs
  // automatically - no hard refresh needed.
  const wasControlled = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!wasControlled || reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => {
      // Poke the registration so a freshly-built SW activates promptly
      // instead of waiting for the browser's lazy update check.
      reg.update().catch(() => {});
    })
    .catch(() => {});
}

/** Mount point for the React app in `index.html`. */
const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
