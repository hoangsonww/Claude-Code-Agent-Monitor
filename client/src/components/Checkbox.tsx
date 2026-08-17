/**
 * @file Checkbox.tsx
 * @description Accessible custom checkbox built on a `<button role="checkbox">`
 * instead of a native `<input type="checkbox">` so the control matches the
 * dashboard's dark theme (accent fill, rounded square, Lucide check mark).
 *
 * ## Keyboard & ARIA
 * Space and Enter toggle via the native button behavior. `aria-checked` mirrors
 * the `checked` prop for screen readers.
 *
 * ## Usage
 * Pass `label` for inline text, or omit it and wrap with an external `<label>`
 * when the clickable area should include more than the box itself.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/Checkbox.tsx`
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
 * ## Public surface
 * - `CheckboxProps` — exported API; see TSDoc on the symbol for behavior.
 * - `Checkbox` — exported API; see TSDoc on the symbol for behavior.
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
 * **CheckboxProps**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **Checkbox**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import { Check } from "lucide-react";

/** Props for {@link Checkbox}. */
export interface CheckboxProps {
  /** Controlled checked state. */
  checked: boolean;
  /** Called with the toggled value when the user activates the control. */
  onChange: (v: boolean) => void;
  /** Optional label rendered to the right of the box. */
  label?: ReactNode;
  /** Extra classes on the outer `<button>`. */
  className?: string;
  /** Classes applied to the label `<span>` when `label` is set. */
  labelClassName?: string;
}

/**
 * Themed checkbox control.
 * @param props See {@link CheckboxProps}.
 */
export function Checkbox({ checked, onChange, label, className, labelClassName }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`group inline-flex items-center gap-2 text-left ${className ?? ""}`}
    >
      <span
        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
          checked
            ? "bg-accent border-accent"
            : "bg-surface-2 border-border group-hover:border-border-light"
        }`}
      >
        {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>
      {label != null && (
        <span className={labelClassName ?? "text-xs text-gray-400 group-hover:text-gray-300"}>
          {label}
        </span>
      )}
    </button>
  );
}
