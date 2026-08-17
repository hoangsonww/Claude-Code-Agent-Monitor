/**
 * @file Layout.tsx
 * @description Application shell that frames every authenticated route: persistent
 * sidebar, main content column, update notifier, and the Tabby assistant overlay.
 * The layout is the single parent route in {@link App} — child pages render inside
 * React Router's `<Outlet />` so navigation never remounts chrome.
 *
 * ## Sidebar persistence
 * Collapsed state is read once from `localStorage` via {@link loadCollapsed} and
 * written back on every toggle. Failures to access storage are swallowed so a
 * private-browsing quota error never breaks the UI.
 *
 * ## Sticky descendants
 * The inner content wrapper uses `overflow-x-clip` (not `hidden`) so horizontal
 * overflow is clipped without creating a scroll container. That keeps `position:
 * sticky` elements — e.g. the Settings page table-of-contents — pinned to the
 * viewport rather than a nested scroll box.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/Layout.tsx`
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
 * - `./Sidebar`
 * - `./UpdateNotifier`
 * - `./Tabby/Tabby`
 *
 * ## Public surface
 * - `Layout` — exported API; see TSDoc on the symbol for behavior.
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
 * **Layout**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useState, useCallback } from "react";
import { Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import { Sidebar, SIDEBAR_STORAGE_KEY, loadCollapsed } from "./Sidebar";
import { UpdateNotifier } from "./UpdateNotifier";
import { Tabby } from "./Tabby/Tabby";

/** Props for {@link Layout}. */
interface LayoutProps {
  /** Live WebSocket status forwarded to the sidebar connection indicator. */
  wsConnected: boolean;
}

/**
 * Root layout wrapping all dashboard routes.
 * @param props See {@link LayoutProps}.
 */
export function Layout({ wsConnected }: LayoutProps) {
  const { t } = useTranslation("nav");
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen bg-surface-0">
      <a href="#main-content" className="skip-to-content">
        {t("skipToContent")}
      </a>
      <UpdateNotifier />
      <Tabby />
      <Sidebar wsConnected={wsConnected} collapsed={collapsed} onToggle={toggle} />
      <main
        id="main-content"
        tabIndex={-1}
        className="min-h-screen min-w-0 transition-[margin-left,width] duration-200 outline-none"
        style={{
          marginLeft: collapsed ? "4.25rem" : "15rem",
          width: collapsed ? "calc(100% - 4.25rem)" : "calc(100% - 15rem)",
        }}
      >
        {/* overflow-x-clip (not -hidden) clips horizontal overflow without
            creating a scroll container, so descendant `position: sticky`
            elements (e.g. the Settings page TOC) still pin to the window. */}
        <div className="p-5 lg:p-6 max-w-full overflow-x-clip">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
