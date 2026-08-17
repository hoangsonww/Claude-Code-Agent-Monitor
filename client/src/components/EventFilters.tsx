/**
 * @file EventFilters.tsx
 * @description Filter toolbar for the event list. Surfaces every filter the
 * backend supports on /api/events - event_type, tool_name, agent_id,
 * session_id, free-text search, and an ISO date range - as a single
 * controlled component. Parent owns the filter state; this component only
 * renders the inputs and emits change events.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/EventFilters.tsx`
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
 * - `../lib/api`
 * - `./DateTimePicker`
 *
 * ## Public surface
 * - `EventFiltersValue` — exported API; see TSDoc on the symbol for behavior.
 * - `EMPTY_FILTERS` — exported API; see TSDoc on the symbol for behavior.
 * - `isEmptyFilters` — exported API; see TSDoc on the symbol for behavior.
 * - `STATUS_TO_EVENT_TYPES` — exported API; see TSDoc on the symbol for behavior.
 * - `STATUS_OPTIONS` — exported API; see TSDoc on the symbol for behavior.
 * - `expandStatusToEventTypes` — exported API; see TSDoc on the symbol for behavior.
 * - `EventFilters` — exported API; see TSDoc on the symbol for behavior.
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
 * **EventFiltersValue**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **EMPTY_FILTERS**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **isEmptyFilters**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **STATUS_TO_EVENT_TYPES**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **STATUS_OPTIONS**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **expandStatusToEventTypes**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **EventFilters**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, X, Filter } from "lucide-react";
import { api } from "../lib/api";
import { DateTimePicker } from "./DateTimePicker";

export type EventFiltersValue = {
  event_type: string[];
  tool_name: string[];
  agent_id: string[];
  session_id: string[];
  status: string[];
  q: string;
  from: string;
  to: string;
};

export const EMPTY_FILTERS: EventFiltersValue = {
  event_type: [],
  tool_name: [],
  agent_id: [],
  session_id: [],
  status: [],
  q: "",
  from: "",
  to: "",
};

export function isEmptyFilters(f: EventFiltersValue): boolean {
  return (
    f.event_type.length === 0 &&
    f.tool_name.length === 0 &&
    f.agent_id.length === 0 &&
    f.session_id.length === 0 &&
    f.status.length === 0 &&
    f.q === "" &&
    f.from === "" &&
    f.to === ""
  );
}

// Status preset → event_type values. Mirrors the status badges shown on event
// rows (see ActivityFeed/SessionDetail statusFromEventType). "Idle" is handled
// as everything not covered by the other presets, which translates to an empty
// preset that doesn't restrict the query (same as no selection).
export const STATUS_TO_EVENT_TYPES: Record<string, string[]> = {
  working: ["PreToolUse"],
  waiting: ["PostToolUse", "Stop"],
  completed: ["Stop", "SubagentStop", "Compaction"],
  error: ["error", "APIError"],
};

export const STATUS_OPTIONS = ["working", "waiting", "completed", "error"] as const;

// Expand the selected status presets into a union of event_type values. The
// consumer merges this with any explicit event_type selection so both layers
// can be combined (selecting "Working" AND a specific event_type still works
// as an OR inside the single `event_type` API param).
export function expandStatusToEventTypes(statuses: string[]): string[] {
  const out = new Set<string>();
  for (const s of statuses) {
    const list = STATUS_TO_EVENT_TYPES[s];
    if (list) for (const et of list) out.add(et);
  }
  return Array.from(out);
}

type EventFiltersProps = {
  value: EventFiltersValue;
  onChange: (next: EventFiltersValue) => void;
  // If set, hides the session filter - useful inside SessionDetail where the
  // session is already implicit.
  hideSessionFilter?: boolean;
  // Optional pre-known agent ids (SessionDetail passes the agents from its
  // parent query instead of fetching /agents again).
  agentOptions?: Array<{ id: string; label: string }>;
  // Optional pre-known session ids (ActivityFeed passes session options).
  sessionOptions?: Array<{ id: string; label: string }>;
};

export function EventFilters({
  value,
  onChange,
  hideSessionFilter,
  agentOptions,
  sessionOptions,
}: EventFiltersProps) {
  const { t } = useTranslation("common");
  const [facets, setFacets] = useState<{ event_types: string[]; tool_names: string[] }>({
    event_types: [],
    tool_names: [],
  });
  const [searchDraft, setSearchDraft] = useState(value.q);

  // Debounce text search - only push up after 300ms of inactivity.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (searchDraft !== value.q) onChange({ ...value, q: searchDraft });
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  // Keep draft in sync when parent clears filters.
  useEffect(() => {
    if (value.q !== searchDraft) setSearchDraft(value.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.q]);

  useEffect(() => {
    let cancelled = false;
    api.events
      .facets()
      .then((data) => {
        if (!cancelled) setFacets(data);
      })
      .catch(() => {
        // Non-fatal: filters still work via text input.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (field: keyof EventFiltersValue, item: string) => {
    const current = value[field];
    if (!Array.isArray(current)) return;
    const next = current.includes(item) ? current.filter((x) => x !== item) : [...current, item];
    onChange({ ...value, [field]: next });
  };

  const empty = isEmptyFilters(value);

  return (
    <div className="card p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
          <input
            type="text"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder={t("eventFilters.searchPlaceholder")}
            aria-label={t("eventFilters.searchPlaceholder")}
            className="w-full bg-surface-2 border border-border rounded pl-7 pr-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent"
          />
        </div>
        <DateTimePicker
          value={value.from}
          onChange={(val: string) => onChange({ ...value, from: val })}
          aria-label={t("eventFilters.from")}
          title={t("eventFilters.from")}
          placeholder={t("eventFilters.from")}
        />
        <span className="text-xs text-gray-600">→</span>
        <DateTimePicker
          value={value.to}
          onChange={(val: string) => onChange({ ...value, to: val })}
          aria-label={t("eventFilters.to")}
          title={t("eventFilters.to")}
          placeholder={t("eventFilters.to")}
        />
        {!empty && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded text-gray-400 hover:text-gray-200 hover:bg-surface-2 cursor-pointer"
            aria-label={t("eventFilters.clearAll")}
          >
            <X className="w-3 h-3" />
            {t("eventFilters.clearAll")}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <ChipGroup
          label={t("eventFilters.status")}
          options={[...STATUS_OPTIONS]}
          labels={{
            working: t("status.working"),
            waiting: t("status.waiting"),
            completed: t("status.completed"),
            error: t("status.error"),
          }}
          selected={value.status}
          onToggle={(item) => toggle("status", item)}
        />
        <ChipGroup
          label={t("eventFilters.eventType")}
          options={facets.event_types}
          selected={value.event_type}
          onToggle={(item) => toggle("event_type", item)}
        />
        <ChipGroup
          label={t("eventFilters.toolName")}
          options={facets.tool_names}
          selected={value.tool_name}
          onToggle={(item) => toggle("tool_name", item)}
        />
        {agentOptions && agentOptions.length > 0 && (
          <ChipGroup
            label={t("eventFilters.agentId")}
            options={agentOptions.map((a) => a.id)}
            labels={Object.fromEntries(agentOptions.map((a) => [a.id, a.label]))}
            selected={value.agent_id}
            onToggle={(item) => toggle("agent_id", item)}
          />
        )}
        {!hideSessionFilter && sessionOptions && sessionOptions.length > 0 && (
          <ChipGroup
            label={t("eventFilters.sessionId")}
            options={sessionOptions.map((s) => s.id)}
            labels={Object.fromEntries(sessionOptions.map((s) => [s.id, s.label]))}
            selected={value.session_id}
            onToggle={(item) => toggle("session_id", item)}
          />
        )}
      </div>
    </div>
  );
}

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
  labels,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (item: string) => void;
  labels?: Record<string, string>;
}) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside dismiss.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectedCount = selected.length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`text-[11px] px-2 py-1 rounded border cursor-pointer flex items-center gap-1.5 ${
          selectedCount > 0
            ? "border-accent/40 bg-accent/10 text-accent"
            : "border-border bg-surface-2 text-gray-400 hover:text-gray-200"
        }`}
      >
        <span>{label}</span>
        {selectedCount > 0 && (
          <span className="bg-accent/25 text-accent rounded px-1.5 font-mono">{selectedCount}</span>
        )}
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 mt-1 z-20 min-w-[220px] max-h-64 overflow-auto bg-surface-1 border border-border rounded shadow-xl p-1.5"
        >
          {options.length === 0 ? (
            <p className="text-[11px] text-gray-500 px-2 py-1 italic">
              {t("eventFilters.noOptions")}
            </p>
          ) : (
            options.map((opt) => {
              const checked = selected.includes(opt);
              const display = labels?.[opt] ?? opt;
              return (
                <label
                  key={opt}
                  className="flex items-center gap-2 px-2 py-1 text-[11px] text-gray-300 rounded hover:bg-surface-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(opt)}
                    className="accent-accent"
                  />
                  <span className="font-mono break-all">{display}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
