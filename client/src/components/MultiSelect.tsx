/**
 * @file MultiSelect.tsx
 * @description Searchable custom multi-select popover for selecting several
 * options without relying on browser-native multi-select controls. It keeps
 * long labels readable through truncation plus full-value tooltips and uses
 * the dashboard's themed checkbox primitive for consistent interaction.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/MultiSelect.tsx
 * **Area:** client component
 * **Responsibility:**
 * Searchable custom multi-select popover for selecting several options without relying on
 * browser-native multi-select controls. It keeps long labels readable through truncation plus
 * full-value tooltips and uses the dashboard's themed checkbox primitive for consistent
 * interaction.
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
 * - `./Checkbox` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `MultiSelect` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `MultiSelectOption` (interface) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `MultiSelectProps` (interface) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `MultiSelect` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `MultiSelectOption` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `MultiSelectProps` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## React and framework hooks
 * - `useEffect` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useId` — lifecycle/state dependency detected in this module; preserve dependency freshness and
 *   cleanup semantics.
 * - `useMemo` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useRef` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useState` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/MultiSelect.tsx` .
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
 * **Path:** `client/src/components/MultiSelect.tsx`
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
 * - `./Checkbox`
 *
 * ## Public surface
 * - `MultiSelectOption` — exported API; see TSDoc on the symbol for behavior.
 * - `MultiSelectProps` — exported API; see TSDoc on the symbol for behavior.
 * - `MultiSelect` — exported API; see TSDoc on the symbol for behavior.
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
 * **MultiSelectOption**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **MultiSelectProps**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **MultiSelect**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Checkbox } from "./Checkbox";

/** One selectable item in a {@link MultiSelect}. */
export interface MultiSelectOption {
  /** Stable value emitted through `onChange`. */
  value: string;
  /** Visible option label and value searched by the filter field. */
  label: string;
}

/** Props for the searchable multi-select popover. */
export interface MultiSelectProps {
  /** Accessible name for the trigger and popover. */
  label: string;
  /** All available options. */
  options: MultiSelectOption[];
  /** Controlled selected values. */
  value: string[];
  /** Called whenever one option is checked or unchecked. */
  onChange: (value: string[]) => void;
  /** Trigger text when there is no active selection. */
  allLabel: string;
  /** Summary shown on the trigger for two or more active selections. */
  selectedCountLabel: (count: number) => string;
  /** Placeholder inside the in-menu search field. */
  searchPlaceholder: string;
  /** Empty-state text when the search has no matches. */
  emptyLabel: string;
  /** Accessible label and visible text for clearing all selections. */
  clearLabel: string;
}

/**
 * An accessible, searchable multi-select that stays open as options are
 * toggled, allowing users to build a multi-value filter quickly.
 */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  allLabel,
  selectedCountLabel,
  searchPlaceholder,
  emptyLabel,
  clearLabel,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const dialogId = useId();

  /** Options whose label contains the search text, case-insensitively. */
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => option.label.toLocaleLowerCase().includes(normalizedQuery));
  }, [options, query]);

  /**
   * Trigger label: the "all" label when nothing is selected, the option's label for one, or a count
   * for several.
   */
  const selectedLabel = useMemo(() => {
    if (value.length === 0) return allLabel;
    if (value.length === 1)
      return options.find((option) => option.value === value[0])?.label ?? value[0];
    return selectedCountLabel(value.length);
  }, [allLabel, options, selectedCountLabel, value]);

  useEffect(() => {
    if (!open) return;
    /** Close when a press lands outside the component. */
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    setOpenUp(below < 360 && rect.top > below);
    searchRef.current?.focus();
  }, [open]);

  /** Close the dropdown, clear the search, and return focus to the trigger. */
  const close = () => {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  };

  /** Add or remove one value from the selection. */
  const toggle = (optionValue: string) => {
    onChange(
      value.includes(optionValue)
        ? value.filter((selected) => selected !== optionValue)
        : [...value, optionValue]
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label}: ${selectedLabel}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            close();
          }
        }}
        className={`flex h-[38px] w-full items-center gap-2 rounded-lg border px-3 text-left text-sm transition-colors focus:outline-none focus:border-accent/50 active:translate-y-px ${
          value.length > 0
            ? "border-accent/40 bg-accent/10 text-gray-100"
            : "border-border bg-surface-1 text-gray-300 hover:bg-surface-3"
        }`}
      >
        <span
          className="min-w-0 flex-1 truncate"
          title={value.length === 1 ? selectedLabel : undefined}
        >
          {selectedLabel}
        </span>
        {value.length > 1 && (
          <span className="rounded bg-accent/20 px-1.5 py-0.5 font-mono text-[10px] text-accent">
            {value.length}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
      </button>

      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-label={label}
          className={`absolute z-30 w-[min(32rem,calc(100vw-2rem))] max-w-none overflow-hidden rounded-lg border border-border bg-surface-1 shadow-xl shadow-black/40 ${
            openUp ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    close();
                  }
                }}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-border bg-surface-2 py-2 pl-8 pr-3 text-xs text-gray-100 placeholder:text-gray-500 outline-none transition-colors focus:border-accent/50"
              />
            </div>
            {value.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="mt-2 inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-gray-400 transition-colors hover:bg-surface-3 hover:text-gray-200 active:translate-y-px"
              >
                <X className="h-3 w-3" />
                {clearLabel}
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            {filteredOptions.length === 0 ? (
              <p className="px-2 py-5 text-center text-xs text-gray-500">{emptyLabel}</p>
            ) : (
              filteredOptions.map((option) => (
                <Checkbox
                  key={option.value}
                  checked={value.includes(option.value)}
                  onChange={() => toggle(option.value)}
                  className="w-full rounded-md px-2 py-2 hover:bg-surface-3"
                  label={
                    <span className="block truncate" title={option.label}>
                      {option.label}
                    </span>
                  }
                  labelClassName="min-w-0 flex-1 truncate font-mono text-xs text-gray-300 group-hover:text-gray-100"
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
