/**
 * @file SessionReplay.tsx
 * @description Interactive session replay page — reconstructs agent/session state
 * from persisted events and lets users scrub through time with play/pause/step
 * controls, speed selection, keyboard shortcuts, and a lifecycle mini-map.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronFirst,
  ChevronLast,
  Bot,
  Zap,
} from "lucide-react";
import { api } from "../lib/api";
import type { DashboardEvent, Agent, Session } from "../lib/types";

// ── Replay engine types ──────────────────────────────────────────────────────

/** Derived agent state at a given replay cursor position. */
interface ReplayAgentState {
  agent_id: string;
  agent_type: string | null;
  status: "working" | "waiting" | "completed" | "error" | "abandoned" | "idle";
  last_event_type: string;
  last_tool: string | null;
  last_summary: string | null;
}

/** A snapshot of all agent states, built at checkpoint intervals. */
interface Checkpoint {
  index: number;
  agents: Map<string, ReplayAgentState>;
}

/** Lifecycle events shown on the mini-map. */
const LIFECYCLE_TYPES = new Set([
  "SessionStart",
  "Stop",
  "SubagentStop",
  "Compaction",
  "APIError",
  "error",
]);

const CHECKPOINT_INTERVAL = 100;
const SPEED_INTERVALS_MS: Record<string, number> = {
  "0.5": 800,
  "1": 400,
  "2": 200,
  "5": 80,
};

// ── State reconstruction ─────────────────────────────────────────────────────

function eventToAgentStatus(eventType: string): ReplayAgentState["status"] {
  switch (eventType) {
    case "SessionStart":
    case "PreToolUse":
    case "PostToolUse":
    case "TurnDuration":
      return "working";
    case "Notification":
      return "waiting";
    case "Stop":
    case "SubagentStop":
      return "completed";
    case "APIError":
    case "error":
      return "error";
    case "Compaction":
      return "working";
    default:
      return "idle";
  }
}

/** Apply one event to the mutable agents map, returning the updated copy. */
function applyEvent(
  agents: Map<string, ReplayAgentState>,
  ev: DashboardEvent | undefined
): Map<string, ReplayAgentState> {
  if (!ev) return agents;
  const agentId = ev.agent_id ?? `${ev.session_id}-main`;
  const prev = agents.get(agentId);
  const next: ReplayAgentState = {
    agent_id: agentId,
    agent_type: prev?.agent_type ?? null,
    status: eventToAgentStatus(ev.event_type),
    last_event_type: ev.event_type,
    last_tool: ev.tool_name ?? prev?.last_tool ?? null,
    last_summary: ev.summary ?? prev?.last_summary ?? null,
  };
  const updated = new Map(agents);
  updated.set(agentId, next);
  return updated;
}

/** Build checkpoints every CHECKPOINT_INTERVAL events from sorted events. */
function buildCheckpoints(events: DashboardEvent[]): Checkpoint[] {
  const checkpoints: Checkpoint[] = [];
  let state = new Map<string, ReplayAgentState>();
  for (let i = 0; i < events.length; i++) {
    state = applyEvent(state, events[i]);
    if (i % CHECKPOINT_INTERVAL === 0) {
      checkpoints.push({ index: i, agents: new Map<string, ReplayAgentState>(state) });
    }
  }
  return checkpoints;
}

/** Seek to an arbitrary index efficiently using the nearest checkpoint. */
function seekToIndex(
  index: number,
  events: DashboardEvent[],
  checkpoints: Checkpoint[]
): Map<string, ReplayAgentState> {
  let nearest: Checkpoint = checkpoints[0] ?? {
    index: 0,
    agents: new Map<string, ReplayAgentState>(),
  };
  for (const cp of checkpoints) {
    if (cp.index <= index) nearest = cp;
    else break;
  }
  let state = new Map(nearest.agents);
  for (let i = nearest.index + (nearest.index === 0 ? 0 : 1); i <= index; i++) {
    state = applyEvent(state, events[i]);
  }
  return state;
}

// ── Status chip ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  working: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  waiting: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  completed: "bg-green-500/20 text-green-300 border-green-500/30",
  error: "bg-red-500/20 text-red-300 border-red-500/30",
  abandoned: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  idle: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

function StatusChip({ status }: { status: string }) {
  const { t } = useTranslation("replay");
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
        STATUS_COLORS[status] ?? STATUS_COLORS.idle
      }`}
    >
      {t(`status.${status}`, status)}
    </span>
  );
}

// ── Mini-map ──────────────────────────────────────────────────────────────────

const MINIMAP_COLORS: Record<string, string> = {
  SessionStart: "#3b82f6",
  Stop: "#22c55e",
  SubagentStop: "#a3e635",
  Compaction: "#f59e0b",
  APIError: "#ef4444",
  error: "#ef4444",
};

function MiniMap({
  events,
  cursor,
  onJump,
}: {
  events: DashboardEvent[];
  cursor: number;
  onJump: (i: number) => void;
}) {
  const { t } = useTranslation("replay");
  const total = events.length;
  const markers = useMemo(
    () => events.map((ev, i) => ({ ev, i })).filter(({ ev }) => LIFECYCLE_TYPES.has(ev.event_type)),
    [events]
  );

  if (markers.length === 0) {
    return <p className="text-xs text-gray-500 px-4 py-2">{t("minimap.noTransitions")}</p>;
  }

  return (
    <div
      className="relative h-8 bg-[#0d1117] rounded border border-gray-800 overflow-hidden cursor-pointer"
      role="group"
      aria-label={t("minimap.ariaLabel")}
    >
      {/* progress fill */}
      <div
        className="absolute inset-y-0 left-0 bg-[#58a6ff]/10"
        style={{ width: `${total > 1 ? (cursor / (total - 1)) * 100 : 0}%` }}
      />
      {/* cursor line */}
      <div
        className="absolute inset-y-0 w-px bg-[#58a6ff] z-10"
        style={{
          left: `${total > 1 ? (cursor / (total - 1)) * 100 : 0}%`,
        }}
      />
      {/* lifecycle markers */}
      {markers.map(({ ev, i }) => (
        <button
          key={i}
          type="button"
          title={`${ev.event_type} — ${new Date(ev.created_at).toLocaleTimeString()}`}
          aria-label={`${ev.event_type} — ${new Date(ev.created_at).toLocaleTimeString()}`}
          onClick={() => onJump(i)}
          className="absolute top-1 w-1.5 h-6 rounded-sm opacity-80 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]"
          style={{
            left: `calc(${(i / Math.max(total - 1, 1)) * 100}% - 3px)`,
            background: MINIMAP_COLORS[ev.event_type] ?? "#6b7280",
          }}
        />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SessionReplay() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("replay");

  // ── Data ─────────────────────────────────────────────────────────────────
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [agentMeta, setAgentMeta] = useState<Map<string, Agent>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Replay state ───────────────────────────────────────────────────────────
  // Declared before the data-loading effect so the reset below can reference
  // playback controls without crossing initialization order.
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<string>("1");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPlay = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    // A route change must not inherit state from the previous session: React
    // reuses this page instance across ids, so a stale cursor can point past
    // the new event set and a running interval would keep advancing it.
    stopPlay();
    setSession(null);
    setEvents([]);
    setAgentMeta(new Map());
    setCursor(0);
    api.sessions
      .get(id)
      .then(({ session, agents, events: evs }) => {
        if (cancelled) return;
        // Reset again right before applying the payload in case the user
        // started playback while the fetch was in flight.
        stopPlay();
        setCursor(0);
        setSession(session);
        const sorted = [...evs].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id - b.id
        );
        setEvents(sorted);
        const meta = new Map<string, Agent>();
        agents.forEach((ag) => meta.set(ag.id, ag));
        setAgentMeta(meta);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, stopPlay]);

  // ── Checkpoints ───────────────────────────────────────────────────────────
  const checkpoints = useMemo(() => buildCheckpoints(events), [events]);

  const agentStates = useMemo(
    () => (events.length ? seekToIndex(cursor, events, checkpoints) : new Map()),
    [cursor, events, checkpoints]
  );

  const total = events.length;

  const startPlay = useCallback(() => {
    stopPlay();
    if (cursor >= total - 1) setCursor(0);
    intervalRef.current = setInterval(() => {
      setCursor((prev) => {
        if (prev >= total - 1) {
          stopPlay();
          return prev;
        }
        return prev + 1;
      });
    }, SPEED_INTERVALS_MS[speed] ?? 400);
    setPlaying(true);
  }, [cursor, total, speed, stopPlay]);

  const togglePlay = useCallback(() => {
    if (playing) stopPlay();
    else startPlay();
  }, [playing, startPlay, stopPlay]);

  // Restart interval when speed changes while playing
  useEffect(() => {
    if (playing) startPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  useEffect(() => {
    return () => stopPlay();
  }, [stopPlay]);

  // Jump to index
  const jumpTo = useCallback(
    (i: number) => {
      stopPlay();
      setCursor(Math.max(0, Math.min(i, total - 1)));
    },
    [total, stopPlay]
  );

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        jumpTo(cursor + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        jumpTo(cursor - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        jumpTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        jumpTo(total - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, jumpTo, cursor, total]);

  // ── Visible event window (±50 around cursor for perf) ─────────────────────
  const windowedEvents = useMemo(() => {
    const start = Math.max(0, cursor - 50);
    const end = Math.min(total, cursor + 51);
    return events.slice(start, end).map((ev, idx) => ({
      ev,
      globalIdx: start + idx,
    }));
  }, [events, cursor, total]);

  const currentEvent = events[cursor] ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="animate-spin w-6 h-6 border-2 border-[#58a6ff] border-t-transparent rounded-full mr-3" />
        {t("loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-400">
        <p className="font-semibold">{t("loadError")}</p>
        <p className="text-sm mt-1 text-gray-500">{error}</p>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="p-6">
        <p className="text-gray-300 font-semibold">{t("noEvents")}</p>
        <p className="text-sm mt-1 text-gray-500">{t("noEventsDesc")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to={`/sessions/${id}`}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#58a6ff] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("backToSession")}
        </Link>
        <span className="text-gray-700">/</span>
        <div>
          <h1 className="text-lg font-semibold text-gray-100">{t("title")}</h1>
          {session && (
            <p className="text-xs text-gray-500 font-mono truncate max-w-xs">{session.id}</p>
          )}
        </div>
      </div>

      {/* Controls bar */}
      <div className="bg-[#161b22] border border-gray-800 rounded-lg p-3 flex flex-wrap items-center gap-3">
        {/* Jump to start */}
        <button
          onClick={() => jumpTo(0)}
          disabled={cursor === 0}
          title={t("controls.toStart")}
          aria-label={t("controls.toStart")}
          className="p-1.5 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronFirst className="w-4 h-4" />
        </button>

        {/* Step back */}
        <button
          onClick={() => jumpTo(cursor - 1)}
          disabled={cursor === 0}
          title={t("controls.stepBack")}
          aria-label={t("controls.stepBack")}
          className="p-1.5 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          title={playing ? t("controls.pause") : t("controls.play")}
          aria-label={playing ? t("controls.pause") : t("controls.play")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#58a6ff] hover:bg-[#79b8ff] text-[#0d1117] font-semibold text-sm transition-colors"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {playing ? t("controls.pause") : t("controls.play")}
        </button>

        {/* Step forward */}
        <button
          onClick={() => jumpTo(cursor + 1)}
          disabled={cursor >= total - 1}
          title={t("controls.stepForward")}
          aria-label={t("controls.stepForward")}
          className="p-1.5 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        {/* Jump to end */}
        <button
          onClick={() => jumpTo(total - 1)}
          disabled={cursor >= total - 1}
          title={t("controls.toEnd")}
          aria-label={t("controls.toEnd")}
          className="p-1.5 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLast className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-gray-700" />

        {/* Speed selector */}
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs text-gray-500">{t("controls.speed")}</span>
          {Object.keys(SPEED_INTERVALS_MS).map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                speed === s
                  ? "bg-[#58a6ff]/20 text-[#58a6ff] border border-[#58a6ff]/40"
                  : "text-gray-400 hover:text-gray-100 hover:bg-gray-700"
              }`}
            >
              {t(`controls.speeds.${s}`)}
            </button>
          ))}
        </div>

        <div className="ml-auto text-xs text-gray-500 font-mono">
          {t("scrubber.eventOf", { current: cursor + 1, total })}
        </div>
      </div>

      {/* Timeline scrubber */}
      <div className="bg-[#161b22] border border-gray-800 rounded-lg p-3 flex flex-col gap-2">
        <label className="text-xs text-gray-500 font-medium">{t("scrubber.label")}</label>
        <input
          type="range"
          min={0}
          max={total - 1}
          value={cursor}
          onChange={(e) => jumpTo(Number(e.target.value))}
          aria-label={t("scrubber.ariaLabel")}
          className="w-full accent-[#58a6ff] cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-gray-600 font-mono">
          <span>{events[0] ? new Date(events[0].created_at).toLocaleTimeString() : ""}</span>
          <span>{currentEvent ? new Date(currentEvent.created_at).toLocaleTimeString() : ""}</span>
          <span>
            {total > 0 && events[total - 1]
              ? new Date(events[total - 1]!.created_at).toLocaleTimeString()
              : ""}
          </span>
        </div>

        {/* Mini-map */}
        <div className="mt-1">
          <p className="text-[10px] text-gray-600 mb-1">{t("minimap.title")}</p>
          <MiniMap events={events} cursor={cursor} onJump={jumpTo} />
        </div>
      </div>

      {/* Main content: current event + agent states */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Current event detail */}
        <div className="bg-[#161b22] border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">{t("cursor.eventType")}</h2>
          {currentEvent ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500 shrink-0">{t("cursor.eventIndex")}</dt>
                <dd className="text-gray-100 font-mono">
                  {cursor + 1} / {total}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500 shrink-0">{t("cursor.timestamp")}</dt>
                <dd className="text-gray-100 font-mono text-xs">
                  {new Date(currentEvent.created_at).toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500 shrink-0">{t("cursor.eventType")}</dt>
                <dd>
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/20">
                    {t(`eventTypes.${currentEvent.event_type}`, currentEvent.event_type)}
                  </span>
                </dd>
              </div>
              {currentEvent.tool_name && (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500 shrink-0">{t("cursor.tool")}</dt>
                  <dd className="text-gray-100 font-mono text-xs truncate">
                    {currentEvent.tool_name}
                  </dd>
                </div>
              )}
              {currentEvent.agent_id && (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500 shrink-0">{t("cursor.agent")}</dt>
                  <dd className="text-gray-400 font-mono text-xs truncate">
                    {currentEvent.agent_id}
                  </dd>
                </div>
              )}
              {currentEvent.summary && (
                <div className="flex flex-col gap-1">
                  <dt className="text-gray-500 text-xs">{t("cursor.summary")}</dt>
                  <dd className="text-gray-300 text-xs bg-[#0d1117] rounded px-2 py-1">
                    {currentEvent.summary}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-gray-600 text-sm">—</p>
          )}
        </div>

        {/* Agent states */}
        <div className="bg-[#161b22] border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Bot className="w-4 h-4 text-gray-500" />
            {t("agents.title")}
          </h2>
          {agentStates.size === 0 ? (
            <p className="text-gray-600 text-sm">{t("agents.noAgents")}</p>
          ) : (
            <ul className="space-y-2">
              {[...agentStates.values()].map((ag) => {
                const meta = agentMeta.get(ag.agent_id);
                return (
                  <li key={ag.agent_id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-gray-300 font-mono text-xs truncate">
                        {meta?.subagent_type ?? ag.agent_id.replace(/^.*-main$/, "main")}
                      </p>
                      {ag.last_tool && (
                        <p className="text-gray-600 text-[11px] truncate">{ag.last_tool}</p>
                      )}
                    </div>
                    <StatusChip status={ag.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Windowed event list */}
      <div className="bg-[#161b22] border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-300">
            {t("scrubber.eventOf", { current: cursor + 1, total })}
          </h2>
          <span className="text-[11px] text-gray-600">{t("keyboard.hint")}</span>
        </div>
        <div className="overflow-y-auto max-h-72 divide-y divide-gray-800/50">
          {windowedEvents.map(({ ev, globalIdx }) => {
            const isCurrent = globalIdx === cursor;
            return (
              <button
                key={ev.id}
                onClick={() => jumpTo(globalIdx)}
                className={`w-full text-left px-4 py-2 flex items-start gap-3 text-xs transition-colors ${
                  isCurrent
                    ? "bg-[#58a6ff]/10 border-l-2 border-[#58a6ff]"
                    : "hover:bg-gray-800/50 border-l-2 border-transparent"
                }`}
              >
                <span className="text-gray-600 font-mono w-10 shrink-0 text-right">
                  {globalIdx + 1}
                </span>
                <span
                  className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                    LIFECYCLE_TYPES.has(ev.event_type)
                      ? "bg-[#58a6ff]/10 text-[#58a6ff] border-[#58a6ff]/20"
                      : "bg-gray-800 text-gray-400 border-gray-700"
                  }`}
                >
                  {t(`eventTypes.${ev.event_type}`, ev.event_type)}
                </span>
                {ev.tool_name && (
                  <span className="text-gray-500 font-mono truncate">{ev.tool_name}</span>
                )}
                {ev.summary && !ev.tool_name && (
                  <span className="text-gray-500 truncate">{ev.summary}</span>
                )}
                <span className="ml-auto text-gray-700 font-mono shrink-0">
                  {new Date(ev.created_at).toLocaleTimeString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
