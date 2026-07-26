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
 *
 * ## Routing
 * All feature pages nest under {@link Layout}, which owns the sidebar and
 * passes `wsConnected` for the connection badge. Unknown paths fall through to
 * {@link NotFound}.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
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

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useCallback } from "react";
import { Layout } from "./components/Layout";
import { SplashScreen } from "./components/SplashScreen";
import { Dashboard } from "./pages/Dashboard";
import { Projects } from "./pages/Projects";
import { FocusCalendarBoard } from "./pages/FocusCalendarBoard";
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
import { eventBus } from "./lib/eventBus";
import type { WSMessage } from "./lib/types";

/**
 * Application root component mounted by {@link main.tsx}.
 * @returns Routed dashboard UI inside `BrowserRouter`.
 */
export default function App() {
  const onMessage = useCallback((msg: WSMessage) => {
    eventBus.publish(msg);
  }, []);

  const { connected } = useWebSocket(onMessage);
  useNotifications();

  return (
    <>
      <SplashScreen />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout wsConnected={connected} />}>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            {/* Right after Projects, per DEC-5 - mirrors the corrected sidebar order. */}
            <Route path="focus-calendar" element={<FocusCalendarBoard />} />
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
    </>
  );
}
