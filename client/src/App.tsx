/**
 * @file App.tsx
 * @description Top-level React tree for the Claude Code Agent Monitor dashboard.
 * Wires together routing, real-time WebSocket ingestion, browser notifications,
 * and the splash screen shown on cold load.
 *
 * ## Data flow
 * 1. {@link useWebSocket} connects to the server's `/ws` endpoint.
 * 2. Each inbound {@link WSMessage} is published on the in-memory
 *    {@link eventBus} so any page can subscribe without prop drilling.
 * 3. {@link useNotifications} listens for alert-worthy events and surfaces OS
 *    notifications when permitted.
 * 4. {@link useSoundCues} plays subtle, synthesized audio cues for the same
 *    class of events (opt-out via Settings -> Sound).
 *
 * ## Routing
 * All feature pages nest under {@link Layout}, which owns the sidebar and
 * passes `wsConnected` for the connection badge. Unknown paths fall through to
 * {@link NotFound}.
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
 * **Module:** client/src/App.tsx
 * **Area:** client build or application entry
 * **Responsibility:**
 * Top-level React tree for the Claude Code Agent Monitor dashboard. Wires together routing,
 * real-time WebSocket ingestion, browser notifications, and the splash screen shown on cold load.
 * ## Data flow 1. {@link useWebSocket} connects to the server's `/ws` endpoint. 2. Each inbound
 * {@link WSMessage} is published on the in-memory {@link eventBus} so any page can subscribe
 * without prop drilling. 3. {@link useNotifications} listens for alert-worthy events and surfaces
 * OS notifications when permitted. 4. {@link useSoundCues} plays subtle, synthesized audio cues for
 * the same class of events (opt-out via Settings -> Sound). ## Routing All feature pages nest under
 * {@link Layout}, which owns the sidebar and passes `wsConnected` for the connection badge. Unknown
 * paths fall through to {@link NotFound}.
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
 * - `./components/DocumentTitle` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `./components/Layout` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `./components/SplashScreen` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `./hooks/useNotifications` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `./hooks/useSoundCues` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `./hooks/useWebSocket` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `./lib/eventBus` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./lib/types` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./pages/ActivityFeed` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `./pages/Analytics` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `./pages/CcConfig` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `./pages/Dashboard` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `./pages/KanbanBoard` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `./pages/NotFound` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `./pages/Run` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./pages/SessionDetail` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `./pages/Sessions` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `./pages/Settings` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `./pages/Workflows` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-router` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `App` (function) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `shouldShowOnboarding` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `App` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `DashboardOnboarding` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `shouldShowOnboarding` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## React and framework hooks
 * - `useCallback` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useLocation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useNotifications` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useSoundCues` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useWebSocket` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Literal API paths
 * - `/api/` — route literal present in this source; keep request/response expectations aligned with
 *   the server and API docs.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/App.tsx` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/App.tsx`
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
 * - `./hooks/useSoundCues`
 * - `./components/Layout`
 * - `./components/SplashScreen`
 * - `./pages/Dashboard`
 * - `./pages/KanbanBoard`
 * - `./pages/Sessions`
 * - `./pages/SessionDetail`
 * - `./pages/ActivityFeed`
 * - `./pages/Analytics`
 * - `./pages/Workflows`
 * - `./pages/Settings`
 * - `./pages/CcConfig`
 * - `./pages/Run`
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

import { BrowserRouter, Routes, Route, useLocation } from "react-router";
import { useCallback } from "react";
import { Layout } from "./components/Layout";
import { DocumentTitle } from "./components/DocumentTitle";
import { SplashScreen } from "./components/SplashScreen";
import { Dashboard } from "./pages/Dashboard";
import { KanbanBoard } from "./pages/KanbanBoard";
import { Sessions } from "./pages/Sessions";
import { SessionDetail } from "./pages/SessionDetail";
import { ActivityFeed } from "./pages/ActivityFeed";
import { Analytics } from "./pages/Analytics";
import { Workflows } from "./pages/Workflows";
import { Settings } from "./pages/Settings";
import { CcConfig } from "./pages/CcConfig";
import { Run } from "./pages/Run";
import { NotFound } from "./pages/NotFound";
import { useWebSocket } from "./hooks/useWebSocket";
import { useNotifications } from "./hooks/useNotifications";
import { useSoundCues } from "./hooks/useSoundCues";
import { eventBus } from "./lib/eventBus";
import type { WSMessage } from "./lib/types";

/**
 * API reference pages are served by Express, not the React dashboard. Keep
 * this guard for a stale shell or an unsupported API URL that reaches the SPA
 * fallback: developer documentation must never be obscured by onboarding.
 *
 * @param pathname - Current location path.
 * @returns False for API reference paths, true elsewhere.
 */
export function shouldShowOnboarding(pathname: string): boolean {
  return !pathname.startsWith("/api/");
}

/** Renders first-run onboarding only on dashboard routes. */
function DashboardOnboarding() {
  const { pathname } = useLocation();
  return shouldShowOnboarding(pathname) ? <SplashScreen /> : null;
}

/**
 * Application root component mounted by {@link main.tsx}.
 * @returns Routed dashboard UI inside `BrowserRouter`.
 */
export default function App() {
  /** Forward every WebSocket message to the app-wide event bus. */
  const onMessage = useCallback((msg: WSMessage) => {
    eventBus.publish(msg);
  }, []);

  const { connected } = useWebSocket(onMessage);
  useNotifications();
  useSoundCues();

  return (
    <BrowserRouter>
      <DashboardOnboarding />
      <DocumentTitle />
      <Routes>
        <Route element={<Layout wsConnected={connected} />}>
          <Route index element={<Dashboard />} />
          <Route path="kanban" element={<KanbanBoard />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="sessions/:id" element={<SessionDetail />} />
          <Route path="activity" element={<ActivityFeed />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="workflows" element={<Workflows />} />
          <Route path="cc-config" element={<CcConfig />} />
          <Route path="run" element={<Run />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
