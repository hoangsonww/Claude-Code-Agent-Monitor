/**
 * @file HooksView.tsx
 * @description Read-only viewer for Claude Code hooks configured across the
 * three settings layers (user / project / local). Hooks are grouped by event
 * type (PreToolUse, PostToolUse, etc). Each event card shows the documented
 * description plus three columns — one per scope — listing matchers and the
 * commands they fire. On mobile the columns collapse into stacked sections.
 *
 * Editing is a later phase; this surface is strictly browse.
 */

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Filter as FilterIcon,
  Info,
  RefreshCw,
  Terminal,
  Webhook,
  Zap,
} from "lucide-react";
import {
  useHooksConfig,
  type HookEntry,
  type HookEventConfig,
  type HooksConfigResponse,
} from "../hooks/useHooksMgmt";

// Hot-path events we visually highlight — they fire on every tool call and
// are by far the most common reason something breaks during a session.
const HOT_EVENTS = new Set(["PreToolUse", "PostToolUse"]);

// Stable display order for events. Anything not in this list (custom/unknown)
// goes alphabetically at the end.
const EVENT_ORDER = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "Notification",
  "PreCompact",
  "PostCompact",
  "Stop",
  "SubagentStop",
  "SessionEnd",
];

type Filter = "all" | "configured" | "empty";

function DisabledBanner() {
  return (
    <div className="card p-6 flex flex-col items-center text-center gap-3">
      <AlertCircle className="w-8 h-8 text-accent" />
      <h3 className="text-lg font-semibold text-gray-100">Hooks viewer disabled</h3>
      <p className="text-sm text-gray-400 max-w-md">
        Set <code className="text-accent">ORCHESTRATOR_ENABLED=1</code> in your{" "}
        <code className="text-accent">.env</code> and restart the server to enable read-only
        hooks-configuration browsing.
      </p>
    </div>
  );
}

function ErrorBanner({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="card p-4 flex items-center gap-3 border border-red-500/40">
      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
      <span className="text-sm text-red-400 flex-1">{error}</span>
      {onRetry ? (
        <button className="btn-ghost text-xs" onClick={onRetry}>
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      ) : null}
    </div>
  );
}

function ScopePill({ scope }: { scope: "user" | "project" | "local" }) {
  const cls =
    scope === "user"
      ? "bg-blue-500/15 text-blue-300"
      : scope === "project"
        ? "bg-emerald-500/15 text-emerald-300"
        : "bg-amber-500/15 text-amber-300";
  return (
    <span
      className={"text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 " + cls}
    >
      {scope}
    </span>
  );
}

function orderedEventKeys(events: Record<string, HookEventConfig>): string[] {
  const keys = Object.keys(events);
  const known: string[] = [];
  const seen = new Set<string>();
  for (const k of EVENT_ORDER) {
    if (events[k]) {
      known.push(k);
      seen.add(k);
    }
  }
  const rest = keys.filter((k) => !seen.has(k)).sort();
  return [...known, ...rest];
}

export function HooksView() {
  const cfg = useHooksConfig();
  const [filter, setFilter] = useState<Filter>("all");

  if (cfg.disabled) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Header />
        <DisabledBanner />
      </div>
    );
  }

  if (cfg.loading && !cfg.data) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Header />
        <div className="card h-64 animate-pulse bg-surface-2" />
      </div>
    );
  }

  if (cfg.error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Header />
        <ErrorBanner error={cfg.error} onRetry={cfg.reload} />
      </div>
    );
  }

  const data = cfg.data;
  if (!data) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Header />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Header />
      <SummaryCard data={data} onReload={cfg.reload} />

      <div className="flex flex-wrap items-center gap-2">
        <FilterIcon className="w-4 h-4 text-gray-500" />
        <FilterButton current={filter} value="all" onClick={setFilter}>
          All events
        </FilterButton>
        <FilterButton current={filter} value="configured" onClick={setFilter}>
          With hooks ({data.summary.totalEventTypesWithHooks})
        </FilterButton>
        <FilterButton current={filter} value="empty" onClick={setFilter}>
          No hooks
        </FilterButton>
      </div>

      <EventsList data={data} filter={filter} />
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-gray-100 flex items-center gap-2">
          <Webhook className="w-6 h-6 text-accent" />
          Hooks
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Read-only view of Claude Code hooks configured across user, project, and local scopes.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({ data, onReload }: { data: HooksConfigResponse; onReload: () => void }) {
  const { summary, errors } = data;
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap gap-4 text-sm">
          <Stat label="Configured events" value={summary.totalEventTypesWithHooks} />
          <Stat label="Total commands" value={summary.totalCommands} />
        </div>
        <button
          className="btn-ghost text-xs"
          onClick={onReload}
          aria-label="Reload hooks"
          title="Reload"
        >
          <RefreshCw className="w-3 h-3" />
          Reload
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
        <SourceLine
          label="user"
          present={summary.bySource.user}
          path={summary.paths.user}
          error={errors.user}
        />
        <SourceLine
          label="project"
          present={summary.bySource.project}
          path={summary.paths.project}
          error={errors.project}
        />
        <SourceLine
          label="local"
          present={summary.bySource.local}
          path={summary.paths.local}
          error={errors.local}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-semibold text-gray-100 leading-tight">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-gray-500">{label}</div>
    </div>
  );
}

function SourceLine({
  label,
  present,
  path,
  error,
}: {
  label: "user" | "project" | "local";
  present: boolean;
  path: string;
  error: string | null;
}) {
  return (
    <div className="bg-surface-2 rounded px-3 py-2 flex items-start gap-2">
      <ScopePill scope={label} />
      <div className="min-w-0 flex-1">
        <div className="text-gray-300">
          {error ? (
            <span className="text-red-400">parse error</span>
          ) : present ? (
            <span className="text-emerald-400">found</span>
          ) : (
            <span className="text-gray-500">not present</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500 break-all mt-0.5" title={path}>
          {path}
        </div>
        {error ? <div className="text-[10px] text-red-400 mt-0.5 break-words">{error}</div> : null}
      </div>
    </div>
  );
}

function FilterButton({
  current,
  value,
  onClick,
  children,
}: {
  current: Filter;
  value: Filter;
  onClick: (v: Filter) => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      className={
        active
          ? "btn-primary text-xs"
          : "btn-ghost text-xs border border-border hover:border-border-light"
      }
      onClick={() => onClick(value)}
    >
      {children}
    </button>
  );
}

function EventsList({ data, filter }: { data: HooksConfigResponse; filter: Filter }) {
  const ordered = useMemo(() => orderedEventKeys(data.events), [data.events]);
  const filtered = ordered.flatMap<{ name: string; event: HookEventConfig }>((k) => {
    const ev = data.events[k];
    if (!ev) return [];
    if (filter === "configured" && !ev.hasAny) return [];
    if (filter === "empty" && ev.hasAny) return [];
    return [{ name: k, event: ev }];
  });

  if (filtered.length === 0) {
    return (
      <div className="card p-6 text-center">
        <Webhook className="w-8 h-8 text-gray-500 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No events match this filter.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filtered.map(({ name, event }) => (
        <EventCard key={name} name={name} event={event} />
      ))}
    </div>
  );
}

function EventCard({ name, event }: { name: string; event: HookEventConfig }) {
  // Default-open for events that actually have hooks, default-closed otherwise
  // so the empty events don't drown out the signal.
  const [open, setOpen] = useState(event.hasAny);
  const isHot = HOT_EVENTS.has(name);

  return (
    <div
      className={"card overflow-hidden " + (isHot && event.hasAny ? "border border-accent/30" : "")}
    >
      <button
        className="w-full text-left p-4 hover:bg-surface-2 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
          )}
          <Webhook className="w-4 h-4 text-accent flex-shrink-0" />
          <span className="font-medium text-gray-100 truncate">{name}</span>
          {isHot ? (
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/15 text-accent flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5" />
              hot
            </span>
          ) : null}
          <span className="text-[10px] text-gray-500 flex-shrink-0">{event.doc.since}</span>
          <span className="ml-auto text-[11px] text-gray-500">
            {countTotal(event)} cmd{countTotal(event) === 1 ? "" : "s"}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 ml-6 flex items-start gap-1.5">
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0 text-gray-500" />
          <span>{event.doc.description}</span>
        </p>
      </button>
      {open ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-4 pb-4 border-t border-border pt-3">
          <ScopeColumn label="user" entries={event.user} />
          <ScopeColumn label="project" entries={event.project} />
          <ScopeColumn label="local" entries={event.local} />
        </div>
      ) : null}
    </div>
  );
}

function countTotal(event: HookEventConfig): number {
  const count = (arr: HookEntry[]) =>
    arr.reduce((sum, entry) => sum + (entry.hooks?.length || 0), 0);
  return count(event.user) + count(event.project) + count(event.local);
}

function ScopeColumn({
  label,
  entries,
}: {
  label: "user" | "project" | "local";
  entries: HookEntry[];
}) {
  return (
    <div className="bg-surface-2 rounded p-3 min-h-[5rem]">
      <div className="flex items-center gap-1.5 mb-2">
        <ScopePill scope={label} />
        <span className="text-[11px] text-gray-500">
          {entries.length} matcher{entries.length === 1 ? "" : "s"}
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="text-[11px] text-gray-600 italic">No hooks at this scope.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry, i) => (
            <MatcherEntry key={i} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MatcherEntry({ entry }: { entry: HookEntry }) {
  const matcher = typeof entry.matcher === "string" ? entry.matcher : "";
  const hooks = Array.isArray(entry.hooks) ? entry.hooks : [];
  return (
    <li className="border-l-2 border-border pl-2">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] uppercase tracking-wider text-gray-500">matcher</span>
        <code className="text-[11px] text-gray-300 bg-surface-1 px-1 py-0.5 rounded font-mono break-all">
          {matcher || "(any)"}
        </code>
      </div>
      <ul className="space-y-1">
        {hooks.length === 0 ? (
          <li className="text-[11px] text-gray-600 italic">No commands.</li>
        ) : (
          hooks.map((h, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <Terminal className="w-3 h-3 text-accent/70 mt-0.5 flex-shrink-0" />
              <code className="text-[11px] text-gray-300 break-all font-mono leading-snug">
                {typeof h.command === "string" ? h.command : JSON.stringify(h)}
              </code>
            </li>
          ))
        )}
      </ul>
    </li>
  );
}

export default HooksView;
