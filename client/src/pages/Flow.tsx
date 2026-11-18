/**
 * @file Flow.tsx
 * @description Live "where does the work go" view. One animated card per active session: the
 * main agent sits in the centre, subagents orbit it, and the tools the session has used sit on an
 * outer ring. Every PreToolUse sends a pulse from the agent out to the tool and every PostToolUse
 * sends one back, so the operator can watch work move in real time. A side feed lists the latest
 * events. Besides the classic card view there are five cinematic canvas themes (Arc Reactor HUD,
 * Synthwave, Matrix, Galaxy, Plasma Storm), a full-screen mode, and a demo mode that animates
 * synthetic sessions so the themes can be previewed with nothing running. Data comes from the
 * existing REST endpoints plus the dashboard WebSocket event bus.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Maximize2, Minimize2, Sparkles, Waypoints } from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { timeAgo } from "../lib/format";
import type { Agent, AgentStatus, DashboardEvent, Session, WSMessage } from "../lib/types";
import { FlowStage, type StageSession } from "../components/flow/FlowStage";
import { STAGE_THEMES, type StageThemeId } from "../components/flow/flowThemes";
import { FlowStageGL, GL_THEMES, type GLThemeId } from "../components/flow/FlowStageGL";

/** Which view the page shows: the classic cards, a WebGL theme or one of the canvas themes. */
export type FlowView = "classic" | StageThemeId | GLThemeId;

/** Every view, in picker order (WebGL themes first). */
const FLOW_VIEWS: FlowView[] = [...GL_THEMES, ...STAGE_THEMES, "classic"];

/** localStorage key for the chosen view. */
const VIEW_KEY = "flow_view";

/** Read the saved view, defaulting to the Arc Reactor theme. */
function readView(): FlowView {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v && (FLOW_VIEWS as string[]).includes(v)) return v as FlowView;
  } catch {
    /* storage blocked */
  }
  return "nebula";
}

/** Demo sessions shown when demo mode is on. */
const DEMO: { id: string; name: string; agents: [string, string][]; tools: string[] }[] = [
  {
    id: "demo-delti",
    name: "Delti",
    agents: [
      ["code-reviewer", "working"],
      ["test-runner", "working"],
      ["Explore", "completed"],
    ],
    tools: ["Bash", "Edit", "Read", "Grep", "mcp__github__pr", "WebFetch"],
  },
  {
    id: "demo-shoresh",
    name: "שורש",
    agents: [
      ["planner", "working"],
      ["frontend", "waiting"],
    ],
    tools: ["Read", "Write", "Bash", "mcp__linear__issues", "Glob"],
  },
  {
    id: "demo-meshek",
    name: "משק בית",
    agents: [
      ["ui-polish", "working"],
      ["a11y", "working"],
      ["perf", "error"],
      ["sync", "completed"],
    ],
    tools: ["Edit", "Read", "Bash", "mcp__browser__shot", "Grep", "TodoWrite", "WebSearch"],
  },
];

/** Build the demo data in the page's own shapes. */
function demoData(): {
  sessions: Session[];
  agents: Map<string, Agent[]>;
  tools: Map<string, ToolUse[]>;
} {
  const now = new Date().toISOString();
  const sessions: Session[] = [];
  const agents = new Map<string, Agent[]>();
  const tools = new Map<string, ToolUse[]>();
  for (const d of DEMO) {
    sessions.push({
      id: d.id,
      name: d.name,
      status: "active",
      cwd: null,
      model: null,
      started_at: now,
      ended_at: null,
    } as Session);
    const base = {
      session_id: d.id,
      task: null,
      current_tool: null,
      started_at: now,
      ended_at: null,
      updated_at: now,
      metadata: null,
    };
    agents.set(d.id, [
      {
        ...base,
        id: `${d.id}-main`,
        name: "Main",
        type: "main",
        subagent_type: null,
        status: "working",
        parent_agent_id: null,
      } as Agent,
      ...d.agents.map(
        ([name, status], i) =>
          ({
            ...base,
            id: `${d.id}-a${i}`,
            name,
            type: "subagent",
            subagent_type: name,
            status,
            parent_agent_id: `${d.id}-main`,
          }) as Agent
      ),
    ]);
    tools.set(
      d.id,
      d.tools.map((name, i) => ({ name, count: 3 + ((i * 7) % 11), lastAt: 0 }))
    );
  }
  return { sessions, agents, tools };
}

/** Tools shown on a card's outer ring, most recent first. */
const MAX_TOOLS = 10;
/** Events kept in the side feed. */
const FEED_SIZE = 30;
/** How long one pulse travels, in ms. */
const PULSE_MS = 900;
/** Active sessions drawn at once. */
const MAX_SESSIONS = 12;

/** Colours per agent state, shared by nodes, pulses and the legend. */
const STATUS_COLOR: Record<AgentStatus, string> = {
  working: "#34d399",
  waiting: "#fbbf24",
  completed: "#60a5fa",
  error: "#f87171",
};

/** One tool on a session's outer ring. */
interface ToolUse {
  name: string;
  count: number;
  lastAt: number;
}

/** One animated pulse between an agent node and a tool node. */
interface Pulse {
  id: number;
  sessionId: string;
  agentId: string;
  tool: string;
  outbound: boolean;
}

/**
 * Shorten a tool name for a node label: `mcp__github__list_issues` becomes `github`.
 *
 * @param name - Raw tool name from the event.
 * @returns A label of at most ten characters.
 */
function toolLabel(name: string): string {
  const mcp = /^mcp__([^_]+(?:_[^_]+)*?)__/.exec(name);
  const base = mcp ? (mcp[1] ?? name) : name;
  return base.length > 10 ? `${base.slice(0, 9)}…` : base;
}

/**
 * Position on a ring around the card centre.
 *
 * @param index - Slot number.
 * @param total - Slots on the ring.
 * @param radius - Ring radius in SVG units.
 * @returns x/y in the card's -150..150 coordinate space.
 */
function ringPos(index: number, total: number, radius: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / Math.max(total, 1);
  return { x: +(radius * Math.cos(angle)).toFixed(1), y: +(radius * Math.sin(angle)).toFixed(1) };
}

/**
 * Pick the agent an event belongs to, falling back to the session's main agent.
 *
 * @param event - Incoming event.
 * @param agents - Agents known for the event's session.
 * @returns The agent id to animate from, or null when the session has no agents yet.
 */
function agentFor(event: DashboardEvent, agents: Agent[]): string | null {
  if (event.agent_id && agents.some((a) => a.id === event.agent_id)) return event.agent_id;
  const main = agents.find((a) => a.type === "main");
  return main?.id ?? agents[0]?.id ?? null;
}

/** Props for {@link SessionFlowCard}. */
interface SessionFlowCardProps {
  session: Session;
  agents: Agent[];
  tools: ToolUse[];
  pulses: Pulse[];
  lastEvent: DashboardEvent | undefined;
  reducedMotion: boolean;
  onOpen: (id: string) => void;
}

/**
 * One session drawn as a small orbit diagram with live pulses.
 *
 * @param props - See {@link SessionFlowCardProps}.
 * @returns The card element.
 */
function SessionFlowCard({
  session,
  agents,
  tools,
  pulses,
  lastEvent,
  reducedMotion,
  onOpen,
}: SessionFlowCardProps) {
  const { t } = useTranslation(["dashboard", "common"]);
  const main = agents.find((a) => a.type === "main") ?? agents[0];
  const subs = agents.filter((a) => a !== main).slice(0, 8);

  const agentPos = new Map<string, { x: number; y: number }>();
  if (main) agentPos.set(main.id, { x: 0, y: 0 });
  subs.forEach((a, i) => agentPos.set(a.id, ringPos(i, subs.length, 62)));
  const toolPos = new Map<string, { x: number; y: number }>();
  tools.forEach((tool, i) => toolPos.set(tool.name, ringPos(i, tools.length, 118)));

  const title =
    session.name ||
    (session.cwd ? session.cwd.split(/[\\/]/).filter(Boolean).pop() : null) ||
    session.id.slice(0, 8);
  const mainStatus: AgentStatus = main?.status ?? "waiting";

  return (
    <button
      type="button"
      onClick={() => onOpen(session.id)}
      className="flow-card group flex flex-col gap-2 rounded-xl border border-border bg-surface-1 p-3 text-start transition-colors hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/30"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-gray-100" title={title}>
          {title}
        </span>
        <span
          className="flex flex-shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]"
          style={{ borderColor: STATUS_COLOR[mainStatus], color: STATUS_COLOR[mainStatus] }}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${mainStatus === "working" ? "animate-pulse" : ""}`}
            style={{ background: STATUS_COLOR[mainStatus] }}
          />
          {t(`common:status.${mainStatus}`)}
        </span>
      </div>

      <svg viewBox="-150 -150 300 300" className="w-full" role="img" aria-label={title}>
        <circle r="118" fill="none" stroke="#273449" strokeDasharray="1 6" />
        <circle r="62" fill="none" stroke="#273449" strokeDasharray="1 6" />

        {tools.map((tool) => {
          const p = toolPos.get(tool.name);
          return p ? (
            <line
              key={`l-${tool.name}`}
              x1={0}
              y1={0}
              x2={p.x}
              y2={p.y}
              stroke="#2a3a55"
              strokeWidth={Math.min(1 + tool.count / 6, 3)}
            />
          ) : null;
        })}

        {subs.map((a) => {
          const p = agentPos.get(a.id);
          return p ? (
            <line key={`s-${a.id}`} x1={0} y1={0} x2={p.x} y2={p.y} stroke="#3b4c6b" />
          ) : null;
        })}

        {tools.map((tool) => {
          const p = toolPos.get(tool.name);
          if (!p) return null;
          const fresh = Date.now() - tool.lastAt < 4000;
          return (
            <g key={`t-${tool.name}`} transform={`translate(${p.x} ${p.y})`}>
              <circle
                r="11"
                fill={fresh ? "#1e3a5f" : "#141c2b"}
                stroke={fresh ? "#7dd3fc" : "#3b4c6b"}
                strokeWidth={fresh ? 2 : 1}
              />
              <text y="24" textAnchor="middle" fontSize="9" fill="#94a3b8">
                {toolLabel(tool.name)}
              </text>
              <text y="3.5" textAnchor="middle" fontSize="8" fill="#cbd5e1">
                {tool.count > 99 ? "99+" : tool.count}
              </text>
            </g>
          );
        })}

        {subs.map((a) => {
          const p = agentPos.get(a.id);
          if (!p) return null;
          return (
            <g key={`a-${a.id}`} transform={`translate(${p.x} ${p.y})`}>
              {a.status === "working" && !reducedMotion && (
                <circle r="13" fill={STATUS_COLOR.working} className="flow-halo" />
              )}
              <circle r="10" fill="#141c2b" stroke={STATUS_COLOR[a.status]} strokeWidth="2" />
              <text y="21" textAnchor="middle" fontSize="8" fill="#94a3b8">
                {toolLabel(a.subagent_type || a.name)}
              </text>
            </g>
          );
        })}

        {main && (
          <g>
            {main.status === "working" && !reducedMotion && (
              <circle r="30" fill={STATUS_COLOR.working} className="flow-halo" />
            )}
            <circle r="24" fill="#141c2b" stroke={STATUS_COLOR[main.status]} strokeWidth="3" />
            <text y="4" textAnchor="middle" fontSize="10" fontWeight="600" fill="#e2e8f0">
              {t("dashboard:flow.mainAgent")}
            </text>
          </g>
        )}

        {!reducedMotion &&
          pulses.map((pulse) => {
            const from = agentPos.get(pulse.agentId) ?? { x: 0, y: 0 };
            const to = toolPos.get(pulse.tool);
            if (!to) return null;
            const [a, b] = pulse.outbound ? [from, to] : [to, from];
            return (
              <circle
                key={pulse.id}
                r="4"
                fill={pulse.outbound ? "#7dd3fc" : "#34d399"}
                className="flow-pulse"
              >
                <animateMotion
                  dur={`${PULSE_MS}ms`}
                  fill="freeze"
                  path={`M${a.x},${a.y} L${b.x},${b.y}`}
                />
              </circle>
            );
          })}
      </svg>

      <div className="w-full truncate text-xs text-gray-400" dir="auto">
        {lastEvent ? (
          <>
            <span className="text-gray-500">{timeAgo(lastEvent.created_at)} · </span>
            {lastEvent.summary || lastEvent.tool_name || lastEvent.event_type}
          </>
        ) : (
          t("dashboard:flow.idle")
        )}
      </div>
      <div className="flex w-full gap-3 text-[11px] text-gray-500">
        <span>
          {t("dashboard:flow.agents")}: {agents.length}
        </span>
        <span>
          {t("dashboard:flow.tools")}: {tools.length}
        </span>
      </div>
    </button>
  );
}

/**
 * The Flow page.
 *
 * @returns The live flow view.
 */
export function Flow() {
  const { t } = useTranslation(["dashboard", "common"]);
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [agents, setAgents] = useState<Map<string, Agent[]>>(new Map());
  const [tools, setTools] = useState<Map<string, ToolUse[]>>(new Map());
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [feed, setFeed] = useState<DashboardEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const pulseId = useRef(0);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [view, setViewState] = useState<FlowView>(readView);
  const [demo, setDemo] = useState(false);
  const [demoState, setDemoState] = useState<ReturnType<typeof demoData> | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const stageBoxRef = useRef<HTMLDivElement | null>(null);

  const setView = useCallback((v: FlowView) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* storage blocked */
    }
  }, []);

  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const addTool = useCallback((sessionId: string, name: string, at: number) => {
    setTools((prev) => {
      const next = new Map(prev);
      const list = [...(next.get(sessionId) ?? [])];
      const hit = list.find((x) => x.name === name);
      if (hit) {
        hit.count += 1;
        hit.lastAt = Math.max(hit.lastAt, at);
      } else {
        list.push({ name, count: 1, lastAt: at });
      }
      list.sort((a, b) => b.lastAt - a.lastAt);
      next.set(sessionId, list.slice(0, MAX_TOOLS));
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.sessions.list({
        status: "active",
        limit: MAX_SESSIONS,
        include_transient: true,
      });
      const list = res.sessions.slice(0, MAX_SESSIONS);
      const ids = list.map((s) => s.id);
      const [agentResults, eventsRes] = await Promise.all([
        Promise.all(ids.map((id) => api.agents.list({ session_id: id, limit: 50 }))),
        ids.length > 0
          ? api.events.list({ session_id: ids, limit: 200 })
          : Promise.resolve({ events: [] as DashboardEvent[] }),
      ]);
      const agentMap = new Map<string, Agent[]>();
      ids.forEach((id, i) => agentMap.set(id, agentResults[i]?.agents ?? []));
      const toolMap = new Map<string, ToolUse[]>();
      for (const ev of [...eventsRes.events].reverse()) {
        if (!ev.tool_name) continue;
        const at = new Date(ev.created_at).getTime() - 10_000;
        const list = toolMap.get(ev.session_id) ?? [];
        const hit = list.find((x) => x.name === ev.tool_name);
        if (hit) {
          hit.count += 1;
          hit.lastAt = Math.max(hit.lastAt, at);
        } else list.push({ name: ev.tool_name, count: 1, lastAt: at });
        toolMap.set(ev.session_id, list);
      }
      for (const [sid, list] of toolMap) {
        toolMap.set(sid, list.sort((a, b) => b.lastAt - a.lastAt).slice(0, MAX_TOOLS));
      }
      setSessions(list);
      setAgents(agentMap);
      setTools(toolMap);
      setFeed(eventsRes.events.slice(0, FEED_SIZE));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboard:flow.failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const scheduleReload = () => {
      if (reloadTimer.current) return;
      reloadTimer.current = setTimeout(() => {
        reloadTimer.current = null;
        void load();
      }, 1500);
    };
    const unsubscribe = eventBus.subscribe((msg: WSMessage) => {
      if (msg.type === "session_created" || msg.type === "session_updated") {
        scheduleReload();
        return;
      }
      if (msg.type === "agent_created" || msg.type === "agent_updated") {
        const agent = msg.data as Agent;
        setAgents((prev) => {
          if (!prev.has(agent.session_id)) return prev;
          const next = new Map(prev);
          const list = [...(next.get(agent.session_id) ?? [])];
          const idx = list.findIndex((a) => a.id === agent.id);
          if (idx >= 0) list[idx] = agent;
          else list.push(agent);
          next.set(agent.session_id, list);
          return next;
        });
        return;
      }
      if (msg.type !== "new_event") return;
      const ev = msg.data as DashboardEvent;
      setFeed((prev) =>
        ev.id && prev.some((e) => e.id === ev.id) ? prev : [ev, ...prev].slice(0, FEED_SIZE)
      );
      const sessionAgents = agentsRef.current.get(ev.session_id);
      if (!sessionAgents) {
        scheduleReload();
        return;
      }
      if (!ev.tool_name) return;
      addTool(ev.session_id, ev.tool_name, Date.now());
      const agentId = agentFor(ev, sessionAgents);
      if (!agentId) return;
      const outbound = ev.event_type !== "PostToolUse" && !/_end$|result/i.test(ev.event_type);
      const id = ++pulseId.current;
      setPulses((prev) => [
        ...prev.slice(-40),
        { id, sessionId: ev.session_id, agentId, tool: ev.tool_name ?? "", outbound },
      ]);
      setTimeout(() => setPulses((prev) => prev.filter((p) => p.id !== id)), PULSE_MS + 150);
    });
    return () => {
      unsubscribe();
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [load, addTool]);

  // Demo mode: synthetic sessions plus a stream of fake tool calls, so every theme can be seen
  // with nothing running. Real data is untouched and comes back when demo mode is turned off.
  useEffect(() => {
    if (!demo) {
      setDemoState(null);
      return;
    }
    const data = demoData();
    setDemoState(data);
    let n = 0;
    const timer = setInterval(() => {
      const d = DEMO[Math.floor(Math.random() * DEMO.length)];
      if (!d) return;
      const list = data.agents.get(d.id) ?? [];
      const agent = list[Math.floor(Math.random() * list.length)];
      const tool = d.tools[Math.floor(Math.random() * d.tools.length)];
      if (!agent || !tool) return;
      const outbound = Math.random() > 0.35;
      const id = ++pulseId.current;
      setPulses((prev) => [
        ...prev.slice(-40),
        { id, sessionId: d.id, agentId: agent.id, tool, outbound },
      ]);
      setTimeout(() => setPulses((prev) => prev.filter((p) => p.id !== id)), PULSE_MS + 150);
      n += 1;
      if (n % 2 === 0) {
        const ev = {
          id: -n,
          session_id: d.id,
          agent_id: agent.id,
          event_type: outbound ? "PreToolUse" : "PostToolUse",
          tool_name: tool,
          summary: `${agent.subagent_type ?? agent.name} → ${tool}`,
          data: null,
          created_at: new Date().toISOString(),
        } as DashboardEvent;
        setFeed((prev) => [ev, ...prev].slice(0, FEED_SIZE));
      }
    }, 260);
    return () => {
      clearInterval(timer);
      setFeed((prev) => prev.filter((e) => e.id > 0));
    };
  }, [demo]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = stageBoxRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void el.requestFullscreen?.().catch(() => setFullscreen((f) => !f));
  }, []);

  const shownSessions = demoState ? demoState.sessions : sessions;
  const shownAgents = demoState ? demoState.agents : agents;
  const shownTools = demoState ? demoState.tools : tools;

  const lastBySession = useMemo(() => {
    const map = new Map<string, DashboardEvent>();
    for (const ev of feed) if (!map.has(ev.session_id)) map.set(ev.session_id, ev);
    return map;
  }, [feed]);

  const sessionName = useCallback(
    (id: string) => {
      const s = shownSessions.find((x) => x.id === id);
      return (
        s?.name || (s?.cwd ? s.cwd.split(/[\\/]/).filter(Boolean).pop() : null) || id.slice(0, 8)
      );
    },
    [shownSessions]
  );

  const stageSessions = useMemo<StageSession[]>(
    () =>
      shownSessions.map((s) => ({
        id: s.id,
        name: sessionName(s.id),
        agents: (shownAgents.get(s.id) ?? []).map((a) => ({
          id: a.id,
          label: a.subagent_type || a.name,
          status: a.status,
          main: a.type === "main",
        })),
        tools: (shownTools.get(s.id) ?? []).map((tool) => ({ name: tool.name, count: tool.count })),
      })),
    [shownSessions, shownAgents, shownTools, sessionName]
  );

  const agentTotal = useMemo(
    () => shownSessions.reduce((n, s) => n + (shownAgents.get(s.id)?.length ?? 0), 0),
    [shownSessions, shownAgents]
  );

  const isStage = view !== "classic";
  const ticker = feed.slice(0, 5);

  return (
    <div className="flex flex-col gap-3 sm:gap-5">
      <div className="flex items-center justify-between gap-3 sm:items-start">
        <div className="flex min-w-0 items-center gap-3 sm:items-start">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Waypoints className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="whitespace-nowrap text-xl font-semibold text-gray-100">
              {t("dashboard:flow.title")}
            </h1>
            <p className="hidden text-sm text-gray-400 sm:block">{t("dashboard:flow.subtitle")}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDemo((d) => !d)}
          aria-pressed={demo}
          className={`flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${demo ? "border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-200" : "border-border bg-surface-1 text-gray-300 hover:border-accent/50"}`}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {demo ? t("dashboard:flow.demoStop") : t("dashboard:flow.demo")}
        </button>
      </div>

      <div
        role="tablist"
        aria-label={t("dashboard:flow.themePicker")}
        className="flow-theme-row flex flex-wrap gap-2"
      >
        {FLOW_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`flow-theme-chip flow-theme-chip--${v} rounded-full border px-3 py-1 text-xs font-medium transition-all ${view === v ? "flow-theme-chip--on" : "border-border bg-surface-1 text-gray-400 hover:text-gray-200"}`}
          >
            {t(`dashboard:flow.themes.${v}`)}
          </button>
        ))}
      </div>

      {demo && (
        <div className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-2 text-xs text-fuchsia-200">
          {t("dashboard:flow.demoNote")}
        </div>
      )}

      {error && !demo && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {isStage ? (
            <div
              ref={stageBoxRef}
              className={`relative overflow-hidden border border-border bg-black ${fullscreen ? "fixed inset-0 z-50 h-screen w-screen rounded-none" : "h-[68vh] min-h-[380px] rounded-xl sm:h-[72vh] sm:min-h-[420px]"}`}
            >
              {(GL_THEMES as string[]).includes(view) ? (
                <FlowStageGL
                  key={view}
                  sessions={stageSessions}
                  shots={pulses}
                  theme={view as GLThemeId}
                  reducedMotion={reducedMotion}
                  label={t("dashboard:flow.title")}
                />
              ) : (
                <FlowStage
                  sessions={stageSessions}
                  shots={pulses}
                  theme={view as StageThemeId}
                  reducedMotion={reducedMotion}
                  label={t("dashboard:flow.title")}
                />
              )}
              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
                <div className="flow-hud rounded-md px-2.5 py-1.5 font-mono text-[11px] leading-5">
                  <div>
                    {t("dashboard:flow.sessions")}: {shownSessions.length}
                  </div>
                  <div>
                    {t("dashboard:flow.agents")}: {agentTotal}
                  </div>
                  <div>
                    {t("dashboard:flow.inFlight")}: {pulses.length}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="flow-hud pointer-events-auto flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px]"
                >
                  {fullscreen ? (
                    <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {fullscreen ? t("dashboard:flow.exitFullscreen") : t("dashboard:flow.fullscreen")}
                </button>
              </div>
              {!loading && shownSessions.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                  <p className="flow-hud rounded-md px-3 py-1.5 font-medium">
                    {t("dashboard:flow.empty")}
                  </p>
                  <p className="text-xs text-gray-400">{t("dashboard:flow.emptyStageHint")}</p>
                </div>
              )}
              <ul className="pointer-events-none absolute bottom-3 start-3 flex max-w-[70%] flex-col gap-1">
                {ticker.map((ev) => (
                  <li
                    key={ev.id}
                    className="flow-hud flow-feed-row truncate rounded px-2 py-0.5 font-mono text-[11px]"
                    dir="auto"
                  >
                    {sessionName(ev.session_id)} ·{" "}
                    {ev.tool_name ? toolLabel(ev.tool_name) : ev.event_type}
                  </li>
                ))}
              </ul>
            </div>
          ) : loading ? (
            <p className="text-sm text-gray-500">{t("common:loading")}</p>
          ) : shownSessions.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface-1 p-8 text-center">
              <p className="font-medium text-gray-200">{t("dashboard:flow.empty")}</p>
              <p className="mt-1 text-sm text-gray-500">{t("dashboard:flow.emptyDesc")}</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-4 text-xs text-gray-400">
                {(Object.keys(STATUS_COLOR) as AgentStatus[]).map((status) => (
                  <span key={status} className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: STATUS_COLOR[status] }}
                    />
                    {t(`common:status.${status}`)}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: "#7dd3fc" }} />
                  {t("dashboard:flow.toolCall")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: "#34d399" }} />
                  {t("dashboard:flow.toolResult")}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {shownSessions.map((s) => (
                  <SessionFlowCard
                    key={s.id}
                    session={s}
                    agents={shownAgents.get(s.id) ?? []}
                    tools={shownTools.get(s.id) ?? []}
                    pulses={pulses.filter((p) => p.sessionId === s.id)}
                    lastEvent={lastBySession.get(s.id)}
                    reducedMotion={reducedMotion}
                    onOpen={(id) => {
                      if (!id.startsWith("demo-")) navigate(`/sessions/${id}`);
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <aside className="rounded-xl border border-border bg-surface-1 p-3">
          <h2 className="mb-2 text-sm font-semibold text-gray-200">
            {t("dashboard:flow.liveFeed")}
          </h2>
          {feed.length === 0 ? (
            <p className="text-xs text-gray-500">{t("dashboard:flow.noEvents")}</p>
          ) : (
            <ul className="flex max-h-[70vh] flex-col gap-1.5 overflow-y-auto">
              {feed.map((ev) => (
                <li
                  key={ev.id}
                  className="flow-feed-row rounded-md border border-border/60 bg-surface-2 px-2 py-1.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2 text-gray-500">
                    <span className="truncate" dir="auto">
                      {sessionName(ev.session_id)}
                    </span>
                    <span className="flex-shrink-0">{timeAgo(ev.created_at)}</span>
                  </div>
                  <div className="mt-0.5 truncate text-gray-300" dir="auto">
                    {ev.tool_name ? (
                      <span className="font-mono text-sky-300">{toolLabel(ev.tool_name)} </span>
                    ) : null}
                    {ev.summary || ev.event_type}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

export default Flow;
