/**
 * @file DateTimePicker.tsx
 * @description A React component that provides a user-friendly interface for selecting both date and time. The component displays a button that shows the currently selected date and time in a human-readable format. When the button is clicked, a dropdown appears containing a calendar for date selection and an input for time selection. The component handles edge cases such as invalid dates and ensures that the dropdown is positioned correctly within the viewport. It also allows users to clear their selection easily. This component is designed to be reusable across the application wherever date and time input is required.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/DateTimePicker.tsx
 * **Area:** client component
 * **Responsibility:**
 * A React component that provides a user-friendly interface for selecting both date and time. The
 * component displays a button that shows the currently selected date and time in a human-readable
 * format. When the button is clicked, a dropdown appears containing a calendar for date selection
 * and an input for time selection. The component handles edge cases such as invalid dates and
 * ensures that the dropdown is positioned correctly within the viewport. It also allows users to
 * clear their selection easily. This component is designed to be reusable across the application
 * wherever date and time input is required.
 *
 * ## Architectural boundary
 * - This component should express one reusable UI responsibility through typed props and observable
 *   callbacks.
 * - Network orchestration belongs in pages, hooks, or the typed API client unless this component
 *   explicitly owns the workflow.
 * - Visual state must remain a projection of props and local interaction state rather than a second
 *   server truth.
 *
 * ## Package dependency edges
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `DateTimePicker` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `DateTimePicker` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `DateTimePickerProps` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## React and framework hooks
 * - `useEffect` — lifecycle/state dependency detected in this module; preserve dependency freshness
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/DateTimePicker.tsx` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/DateTimePicker.tsx`
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
 * - `DateTimePicker` — exported API; see TSDoc on the symbol for behavior.
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
 * **DateTimePicker**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import React, { useState, useRef, useEffect } from "react";
import { Calendar, Clock, ChevronLeft, ChevronRight, X } from "lucide-react";

/** Props for {@link DateTimePicker}. */
interface DateTimePickerProps {
  /**
   * Selected local date and time as `YYYY-MM-DDTHH:mm` (the `datetime-local` format), or an empty
   * string for none.
   */
  value: string; // Expected format: YYYY-MM-DDTHH:mm
  /** Called with the new value in the same format, or an empty string when cleared. */
  onChange: (value: string) => void;
  /** Text shown when no value is selected. */
  placeholder?: string;
  /** Extra classes for the trigger button. */
  className?: string;
  /** Accessible label for the trigger button. */
  "aria-label"?: string;
  /** Tooltip for the trigger button. */
  title?: string;
}

/**
 * Compact date and time picker with a month calendar and a time field in a popover, styled to match
 * the dashboard instead of the browser's native control. Values stay in local time and the
 * `datetime-local` string format, so they drop into the event filters unchanged.
 */
export function DateTimePicker({
  value,
  onChange,
  placeholder = "Select date & time",
  className = "",
  "aria-label": ariaLabel,
  title,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [alignment, setAlignment] = useState<"left" | "right">("left");
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse value
  const dateObj = value ? new Date(value) : null;
  const [viewDate, setViewDate] = useState(dateObj || new Date());

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.left + 230 > window.innerWidth) {
        setAlignment("right");
      } else {
        setAlignment("left");
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (dateObj && !isNaN(dateObj.getTime())) {
      setViewDate(dateObj);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /**
   * Short localized label for the trigger, or an empty string for an invalid date.
   *
   * @param d - Selected date, or null.
   * @returns The label.
   */
  const formatDisplay = (d: Date | null) => {
    if (!d || isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /**
   * Pick a calendar day, keeping the current time of day (midnight when nothing was selected yet).
   *
   * @param day - Day of the month in the viewed month.
   */
  const handleDateClick = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (dateObj && !isNaN(dateObj.getTime())) {
      newDate.setHours(dateObj.getHours(), dateObj.getMinutes());
    } else {
      newDate.setHours(0, 0); // Default midnight
    }
    updateValue(newDate);
  };

  /**
   * Apply a typed `HH:mm` time to the selected day (today when nothing was selected). Ignores
   * incomplete input.
   */
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeStr = e.target.value;
    if (!timeStr) return;
    const parts = timeStr.split(":");
    if (parts.length !== 2) return;
    const h = parts[0] || "0";
    const m = parts[1] || "0";
    const newDate = dateObj && !isNaN(dateObj.getTime()) ? new Date(dateObj) : new Date();
    newDate.setHours(parseInt(h, 10), parseInt(m, 10));
    updateValue(newDate);
  };

  /**
   * Report a date to the parent in `YYYY-MM-DDTHH:mm` local time.
   *
   * @param d - Date to report.
   */
  const updateValue = (d: Date) => {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    onChange(`${y}-${mo}-${day}T${h}:${mi}`);
  };

  /** Clear the value and close the popover without toggling it open again. */
  const clearValue = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="w-6 h-6" />);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const isSelected = !!(
      dateObj &&
      dateObj.getDate() === i &&
      dateObj.getMonth() === viewDate.getMonth() &&
      dateObj.getFullYear() === viewDate.getFullYear()
    );
    const isToday =
      new Date().getDate() === i &&
      new Date().getMonth() === viewDate.getMonth() &&
      new Date().getFullYear() === viewDate.getFullYear();

    days.push(
      <button
        key={i}
        type="button"
        onClick={() => handleDateClick(i)}
        className={`w-6 h-6 flex items-center justify-center rounded text-[11px] transition-colors
          ${
            isSelected
              ? "bg-accent text-white font-medium"
              : isToday
                ? "bg-surface-3 text-accent font-medium"
                : "hover:bg-surface-2 text-gray-300 hover:text-white"
          }`}
      >
        {i}
      </button>
    );
  }

  const timeValue =
    dateObj && !isNaN(dateObj.getTime())
      ? `${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`
      : "";

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={ariaLabel}
        title={title}
        className={`flex items-center gap-2 bg-surface-2 border ${isOpen ? "border-accent" : "border-border"} rounded px-2 py-1.5 min-w-[150px] text-xs focus:outline-none focus:border-accent transition-colors w-full text-left`}
      >
        <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <span className={`flex-1 truncate ${!dateObj ? "text-gray-500" : "text-gray-200"}`}>
          {dateObj ? formatDisplay(dateObj) : placeholder}
        </span>
        {dateObj && (
          <X className="w-3 h-3 text-gray-500 hover:text-white shrink-0" onClick={clearValue} />
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute top-full mt-1 ${alignment === "right" ? "right-0" : "left-0"} z-50 bg-surface-1 border border-border rounded-lg shadow-xl p-3 w-[220px] flex flex-col gap-3`}
        >
          {/* Calendar Header */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
              }
              className="p-1 hover:bg-surface-2 rounded text-gray-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-gray-200">
              {viewDate.toLocaleString(undefined, { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              onClick={() =>
                setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
              }
              className="p-1 hover:bg-surface-2 rounded text-gray-400 hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Calendar Grid */}
          <div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <div key={day} className="w-6 text-center text-[10px] font-medium text-gray-500">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">{days}</div>
          </div>

          {/* Time Picker */}
          <div className="pt-3 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium">Time</span>
            </div>
            <input
              type="time"
              value={timeValue}
              onChange={handleTimeChange}
              className="bg-surface-2 border border-border rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-accent w-[85px] time-input-custom"
            />
          </div>
        </div>
      )}
    </div>
  );
}
