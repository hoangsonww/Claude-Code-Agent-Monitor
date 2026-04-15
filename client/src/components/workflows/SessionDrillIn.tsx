/**
 * @file SessionDrillIn.tsx
 * @description Defines the SessionDrillIn component, which provides a detailed view of a specific session in the agent dashboard application. It allows users to drill into the agent tree, tool timeline, and event sequence for a selected session. The component manages its own state for loading, error handling, and active tab selection, and it fetches the necessary data from the backend API when a session is selected. It also includes a session selector for searching and selecting different sessions to view.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { X, GitFork, Wrench, List, Search, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { formatDateTime, formatMs } from "../../lib/format";
import type {
  SessionDrillIn as SessionDrillInData,
  DashboardEvent,
  Session,
} from "../../lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "tree" | "timeline" | "events";

type AgentNode = SessionDrillInData["tree"][number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: string): string {
  switch (status) {
    case "completed":
      return "text-violet-400 bg-violet-500/10 border-violet-500/20";
    case "working":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    case "error":
      return "text-red-400 bg-red-500/10 border-red-500/20";
    case "active":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    case "idle":
      return "text-gray-400 bg-gray-500/10 border-gray-500/20";
    default:
      return "text-gray-400 bg-gray-500/10 border-gray-500/20";
  }
}

function safeTimestamp(raw: string): string {
  try {
    const normalized = /[Zz]$|[+-]\d{2}:\d{2}$/.test(raw) ? raw : raw.replace(" ", "T") + "Z";
    return formatDateTime(normalized);
  } catch {
    return raw;
  }
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

interface TabBarProps {
  active: Tab;
  onChange: (t: Tab) => void;
}

function TabBar({ active, onChange }: TabBarProps) {
  const { t } = useTranslation("workflows");
  const tabs = [
    {
      id: "tree" as Tab,
      label: t("drillIn.tabs.agentTree"),
      icon: <GitFork className="w-3.5 h-3.5" />,
    },
    {
      id: "timeline" as Tab,
      label: t("drillIn.tabs.toolTimeline"),
      icon: <Wrench className="w-3.5 h-3.5" />,
    },
    {
      id: "events" as Tab,
      label: t("drillIn.tabs.eventSequence"),
      icon: <List className="w-3.5 h-3.5" />,
    },
  ];
  return (
    <div className="flex gap-1 p-1 bg-surface-3 rounded-lg">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={[
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150",
            active === tab.id
              ? "bg-surface-5 text-gray-100 shadow-sm"
              : "text-gray-500 hover:text-gray-300",
          ].join(" ")}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Agent Tree ────────────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: AgentNode;
  depth: number;
}

function TreeNode({ node, depth }: TreeNodeProps) {
  const { t } = useTranslation(["workflows", "common"]);
  const indentPx = depth * 20;
  const isMain = node.type === "main";
  const dur = node.ended_at
    ? formatMs(
        Math.max(
          0,
          new Date(node.ended_at + "Z").getTime() - new Date(node.started_at + "Z").getTime()
        )
      )
    : t("common:running");
  const sc = statusColor(node.status);
  const statusLabel = t(`common:status.${node.status}`, { defaultValue: node.status });

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 hover:bg-white/5 rounded transition-colors"
        style={{ paddingLeft: `${indentPx + 8}px`, paddingRight: "8px" }}
      >
        {/* Depth connector line */}
        {depth > 0 && <span className="w-px h-4 bg-border flex-shrink-0 -ml-3 mr-1" aria-hidden />}

        {/* Status badge */}
        <span
          className={`flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${sc}`}
        >
          {statusLabel}
        </span>

        {/* Name */}
        <span
          className={`text-sm font-medium truncate ${isMain ? "text-indigo-300" : "text-gray-200"}`}
        >
          {node.name}
        </span>

        {/* Subagent type */}
        {node.subagent_type && (
          <span className="text-xs text-gray-500 truncate flex-shrink-0">
            [{node.subagent_type}]
          </span>
        )}

        {/* Duration */}
        <span className="ml-auto flex-shrink-0 text-xs text-gray-600 tabular-nums">{dur}</span>
      </div>

      {node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

interface AgentTreeProps {
  tree: SessionDrillInData["tree"];
}

function AgentTree({ tree }: AgentTreeProps) {
  const { t } = useTranslation("workflows");
  if (tree.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">{t("drillIn.noAgentTree")}</p>;
  }

  return (
    <div className="overflow-auto max-h-[420px] pr-1">
      {tree.map((node) => (
        <TreeNode key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}

// ── Tool Timeline ─────────────────────────────────────────────────────────────

type ToolEvent = SessionDrillInData["toolTimeline"][number];

interface ToolTimelineProps {
  events: ToolEvent[];
}

function ToolTimeline({ events }: ToolTimelineProps) {
  const { t } = useTranslation("workflows");
  if (events.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">{t("drillIn.noToolEvents")}</p>;
  }

  return (
    <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
      <div className="flex flex-col gap-1 min-w-0">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
          >
            {/* Tool pill */}
            <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 whitespace-nowrap">
              {ev.tool_name ?? ev.event_type}
            </span>

            {/* Summary */}
            {ev.summary && (
              <span className="text-xs text-gray-400 truncate flex-1 min-w-0">{ev.summary}</span>
            )}

            {/* Timestamp */}
            <span className="flex-shrink-0 text-[10px] text-gray-600 tabular-nums ml-auto">
              {safeTimestamp(ev.created_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Event Sequence ────────────────────────────────────────────────────────────

interface EventSequenceProps {
  events: DashboardEvent[];
}

const EVENT_TYPE_COLOR: Record<string, string> = {
  tool_use: "text-blue-400",
  tool_result: "text-emerald-400",
  agent_start: "text-indigo-400",
  agent_stop: "text-violet-400",
  compaction: "text-amber-400",
  error: "text-red-400",
};

function eventTypeColor(type: string): string {
  return EVENT_TYPE_COLOR[type] ?? "text-gray-400";
}

function EventSequence({ events }: EventSequenceProps) {
  const { t } = useTranslation("workflows");
  if (events.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">{t("drillIn.noEvents")}</p>;
  }

  const recent = events.slice(0, 100);

  return (
    <div className="overflow-auto max-h-[420px]">
      <div className="flex flex-col gap-0.5">
        {recent.map((ev) => (
          <div
            key={ev.id}
            className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors group"
          >
            {/* Event type badge */}
            <span
              className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide mt-0.5 w-[90px] truncate ${eventTypeColor(ev.event_type)}`}
              title={ev.event_type}
            >
              {ev.event_type}
            </span>

            {/* Summary */}
            <span className="text-xs text-gray-400 flex-1 min-w-0 truncate">
              {ev.summary ?? ev.tool_name ?? "—"}
            </span>

            {/* Timestamp */}
            <span className="flex-shrink-0 text-[10px] text-gray-600 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
              {safeTimestamp(ev.created_at)}
            </span>
          </div>
        ))}
        {events.length > 100 && (
          <p className="text-xs text-gray-600 text-center py-2">
            {t("drillIn.showingOf", { total: events.length })}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Loading / Error states ────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col gap-3 py-8 px-4 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-4 bg-surface-4 rounded" style={{ width: `${80 - i * 10}%` }} />
      ))}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
}

function ErrorState({ message }: ErrorStateProps) {
  const { t } = useTranslation("workflows");
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
      <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
        <X className="w-4 h-4 text-red-400" />
      </div>
      <p className="text-sm font-medium text-red-400">{t("drillIn.failedLoad")}</p>
      <p className="text-xs text-gray-600 mt-1 max-w-xs">{message}</p>
    </div>
  );
}

// ── Empty / no-selection state ────────────────────────────────────────────────

interface NoSessionStateProps {
  onSelectSession: (id: string) => void;
}

function NoSessionState({ onSelectSession }: NoSessionStateProps) {
  const { t } = useTranslation("workflows");
  const tabs = [
    {
      id: "tree" as Tab,
      label: t("drillIn.tabs.agentTree"),
      icon: <GitFork className="w-3.5 h-3.5" />,
    },
    {
      id: "timeline" as Tab,
      label: t("drillIn.tabs.toolTimeline"),
      icon: <Wrench className="w-3.5 h-3.5" />,
    },
    {
      id: "events" as Tab,
      label: t("drillIn.tabs.eventSequence"),
      icon: <List className="w-3.5 h-3.5" />,
    },
  ];
  return (
    <div className="flex flex-col py-6 px-4 border-2 border-dashed border-border rounded-xl">
      <SessionSelector onSelectSession={onSelectSession} />

      <div className="flex flex-col items-center text-center mt-2">
        <div className="w-10 h-10 rounded-xl bg-surface-4 flex items-center justify-center mb-4">
          <GitFork className="w-5 h-5 text-gray-600" />
        </div>
        <p className="text-sm font-medium text-gray-400 mb-1">{t("drillIn.noSessionSelected")}</p>
        <p className="text-xs text-gray-600 max-w-xs">{t("drillIn.noSessionDesc")}</p>

        {/* Preview tab pills */}
        <div className="flex gap-2 mt-5">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-600 bg-surface-3 border border-border"
            >
              {tab.icon}
              {tab.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Session header ────────────────────────────────────────────────────────────

interface SessionHeaderProps {
  drillIn: SessionDrillInData;
  onClose: () => void;
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
}

function SessionHeader({ drillIn, onClose, activeTab, onTabChange }: SessionHeaderProps) {
  const { t } = useTranslation("workflows");
  const { session } = drillIn;

  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-100 truncate">
            {session.name ?? session.id}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {session.model ?? t("drillIn.unknownModel")} &middot;{" "}
            {t(`common:status.${session.status}`, { defaultValue: session.status })}
            {session.started_at && ` \u00b7 ${safeTimestamp(session.started_at)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:text-gray-200 hover:bg-white/10 transition-colors"
          aria-label={t("drillIn.closePanel")}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <TabBar active={activeTab} onChange={onTabChange} />
    </div>
  );
}

// ── Session Selector ──────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

interface SessionSelectorProps {
  onSelectSession: (id: string) => void;
}

function SessionSelector({ onSelectSession }: SessionSelectorProps) {
  const { t } = useTranslation("workflows");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchPage = useCallback((pageOffset: number, replace: boolean) => {
    setLoading(true);
    api.sessions
      .list({ limit: PAGE_SIZE, offset: pageOffset })
      .then(({ sessions: page }) => {
        setSessions((prev) => (replace ? page : [...prev, ...page]));
        setHasMore(page.length === PAGE_SIZE);
        setOffset(pageOffset + page.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load ALL sessions for search (once, lazily)
  const loadAllSessions = useCallback(() => {
    if (allLoaded) return;
    setAllLoaded(true);
    // Fetch large batch for search
    api.sessions
      .list({ limit: 5000, offset: 0 })
      .then(({ sessions: all }) => setAllSessions(all))
      .catch(() => {});
  }, [allLoaded]);

  // Load first page when dropdown opens
  useEffect(() => {
    if (open && sessions.length === 0) {
      fetchPage(0, true);
    }
  }, [open, sessions.length, fetchPage]);

  // When user starts typing, load all sessions for search
  useEffect(() => {
    if (search.trim().length > 0) {
      loadAllSessions();
    }
  }, [search, loadAllSessions]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // When searching, filter across ALL sessions; otherwise show paginated
  const filtered = search.trim()
    ? (allSessions.length > 0 ? allSessions : sessions).filter((s) => {
        const q = search.toLowerCase();
        return (s.name ?? "").toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
      })
    : sessions;

  function handleSelect(id: string) {
    setOpen(false);
    setSearch("");
    onSelectSession(id);
  }

  function handleLoadMore() {
    fetchPage(offset, false);
  }

  return (
    <div ref={containerRef} className="relative mb-4">
      {/* Trigger row */}
      <div
        className={[
          "flex items-center gap-2 px-3 py-2 rounded-lg border bg-surface-3 transition-colors cursor-text",
          open ? "border-indigo-500/40 ring-1 ring-indigo-500/20" : "border-border",
        ].join(" ")}
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        <Search className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          placeholder={t("drillIn.searchPlaceholder")}
          className="flex-1 bg-transparent text-xs text-gray-200 placeholder-gray-600 outline-none min-w-0"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
        />
        <ChevronDown
          className={[
            "w-3.5 h-3.5 text-gray-600 flex-shrink-0 transition-transform duration-150",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </div>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-surface-2 border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {loading && sessions.length === 0 ? (
              <div className="flex flex-col gap-2 p-3 animate-pulse">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-3 bg-surface-4 rounded"
                    style={{ width: `${75 - i * 8}%` }}
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6 px-3">
                {search.trim() ? t("drillIn.noMatch") : t("drillIn.notFound")}
              </p>
            ) : (
              <div className="flex flex-col">
                {filtered.map((s) => {
                  const sc = statusColor(s.status);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelect(s.id)}
                      className="flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors border-b border-border/50 last:border-0"
                    >
                      <span
                        className={`flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${sc}`}
                      >
                        {s.status}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-medium text-gray-200 truncate">
                          {s.name ?? s.id}
                        </span>
                        {s.name && (
                          <span className="block text-[10px] text-gray-600 font-mono truncate">
                            {s.id}
                          </span>
                        )}
                      </span>
                      {s.model && (
                        <span className="flex-shrink-0 text-[10px] text-gray-500 truncate max-w-[80px]">
                          {s.model}
                        </span>
                      )}
                      {s.started_at && (
                        <span className="flex-shrink-0 text-[10px] text-gray-600 tabular-nums">
                          {safeTimestamp(s.started_at)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Load more — only show when not filtering client-side */}
            {!search.trim() && hasMore && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loading}
                className="w-full px-3 py-2 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors border-t border-border/50 disabled:opacity-50"
              >
                {loading ? t("drillIn.loading") : t("drillIn.loadMore")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export interface SessionDrillInProps {
  sessionId: string | null;
  onClose: () => void;
  onSelectSession: (id: string) => void;
}

export function SessionDrillIn({ sessionId, onClose, onSelectSession }: SessionDrillInProps) {
  const { t } = useTranslation(["workflows", "common"]);
  const [activeTab, setActiveTab] = useState<Tab>("tree");
  const [drillIn, setDrillIn] = useState<SessionDrillInData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setDrillIn(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setDrillIn(null);

    api.workflows
      .session(sessionId)
      .then((data) => {
        if (!cancelled) {
          setDrillIn(data);
          setActiveTab("tree");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : t("common:unexpectedError");
          setError(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, t]);

  // No session selected
  if (!sessionId) {
    return <NoSessionState onSelectSession={onSelectSession} />;
  }

  if (loading) {
    return (
      <div className="bg-surface-2 border border-border rounded-xl p-4">
        <SessionSelector onSelectSession={onSelectSession} />
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface-2 border border-border rounded-xl p-4">
        <SessionSelector onSelectSession={onSelectSession} />
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-600 font-mono truncate">{sessionId}</p>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:text-gray-300 hover:bg-white/10 transition-colors"
            aria-label={t("drillIn.close")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <ErrorState message={error} />
      </div>
    );
  }

  if (!drillIn) return null;

  return (
    <div className="bg-surface-2 border border-border rounded-xl p-4 animate-fade-in">
      <SessionSelector onSelectSession={onSelectSession} />
      <SessionHeader
        drillIn={drillIn}
        onClose={onClose}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab content */}
      {activeTab === "tree" && <AgentTree tree={drillIn.tree} />}
      {activeTab === "timeline" && <ToolTimeline events={drillIn.toolTimeline} />}
      {activeTab === "events" && <EventSequence events={drillIn.events} />}
    </div>
  );
}
