/**
 * @file Layout.tsx
 * @description Application shell that frames every authenticated route: persistent
 * sidebar, main content column, update notifier, the Cmd/Ctrl+K command palette,
 * and the Tabby assistant overlay.
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
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/Layout.tsx
 * **Area:** client component
 * **Responsibility:**
 * Application shell that frames every authenticated route: persistent sidebar, main content column,
 * update notifier, the Cmd/Ctrl+K command palette, and the Tabby assistant overlay. The layout is
 * the single parent route in {@link App} — child pages render inside React Router's `<Outlet />` so
 * navigation never remounts chrome. ## Sidebar persistence Collapsed state is read once from
 * `localStorage` via {@link loadCollapsed} and written back on every toggle. Failures to access
 * storage are swallowed so a private-browsing quota error never breaks the UI. ## Sticky
 * descendants The inner content wrapper uses `overflow-x-clip` (not `hidden` ) so horizontal
 * overflow is clipped without creating a scroll container. That keeps `position: sticky` elements —
 * e.g. the Settings page table-of-contents — pinned to the viewport rather than a nested scroll
 * box.
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
 * - `./ActionToast` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./CommandPalette` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `./PaletteActionProvider` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `./Sidebar` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./Tabby/Tabby` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./UpdateNotifier` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-router` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `Layout` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `Layout` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `LayoutActions` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `LayoutProps` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## React and framework hooks
 * - `useCallback` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `usePaletteAction` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useState` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useTranslation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Translation namespaces
 * - `nav` — visible copy resolves through this namespace; key and interpolation parity applies to
 *   every supported locale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/Layout.tsx` .
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
 * - `./CommandPalette`
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

import { useCallback, useState } from "react";
import { Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import { Sidebar, SIDEBAR_STORAGE_KEY, loadCollapsed } from "./Sidebar";
import { UpdateNotifier } from "./UpdateNotifier";
import { CommandPalette } from "./CommandPalette";
import { Tabby } from "./Tabby/Tabby";
import { ActionToast } from "./ActionToast";
import { PaletteActionProvider, usePaletteAction } from "./PaletteActionProvider";

/** Props for {@link Layout}. */
interface LayoutProps {
  /** Live WebSocket status forwarded to the sidebar connection indicator. */
  wsConnected: boolean;
}

/**
 * Registers the shell-level commands the palette offers on every page: the
 * sidebar toggle and the two scroll jumps. They are palette actions rather than
 * chords — ⌘/Ctrl+K is the dashboard's only navigation shortcut.
 */
function LayoutActions({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  usePaletteAction("layout.toggleSidebar", onToggleSidebar);
  usePaletteAction("layout.scrollTop", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  usePaletteAction("layout.scrollBottom", () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  });
  return null;
}

/**
 * Root layout wrapping all dashboard routes: sidebar, global overlays, and the
 * routed page outlet.
 * @param props See {@link LayoutProps}.
 */
export function Layout({ wsConnected }: LayoutProps) {
  const { t } = useTranslation("nav");
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  /** Collapse or expand the sidebar and remember the choice in localStorage. */
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
    <PaletteActionProvider>
      <div className="min-h-screen bg-surface-0">
        <a href="#main-content" className="skip-to-content">
          {t("skipToContent")}
        </a>
        <LayoutActions onToggleSidebar={toggle} />
        <UpdateNotifier />
        <CommandPalette />
        <ActionToast />
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
    </PaletteActionProvider>
  );
}
