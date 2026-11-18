/**
 * @file FlowStage.tsx
 * @description Full-bleed canvas stage for the Live Flow page. Lays out every active session as
 * an animated cluster (core = main agent, orbiting subagents, outer ring of tools) and fires a
 * themed shot from agent to tool on every tool call, with an impact burst and a target flash.
 * One requestAnimationFrame loop; data arrives through props and is read from refs so the loop
 * never restarts on updates. Themes live in `flowThemes.ts`.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useRef } from "react";
import {
  THEMES,
  makeThemeState,
  type StageStatus,
  type StageThemeId,
  type ThemeState,
} from "./flowThemes";

/** One agent on the stage. */
export interface StageAgent {
  id: string;
  label: string;
  status: StageStatus;
  main: boolean;
}

/** One session cluster on the stage. */
export interface StageSession {
  id: string;
  name: string;
  agents: StageAgent[];
  tools: { name: string; count: number }[];
}

/** One tool call or result to animate. */
export interface StageShot {
  id: number;
  sessionId: string;
  agentId: string;
  tool: string;
  outbound: boolean;
}

/** Props for {@link FlowStage}. */
export interface FlowStageProps {
  sessions: StageSession[];
  shots: StageShot[];
  theme: StageThemeId;
  reducedMotion: boolean;
  /** Accessible description of the stage. */
  label: string;
}

/** Live shot being drawn. */
interface ActiveShot extends StageShot {
  born: number;
}

/** Impact particle. */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const SHOT_MS = 750;
const FLASH_MS = 900;
const MAX_PARTICLES = 500;

/**
 * Short label for a tool or agent: `mcp__github__list_issues` becomes `github`.
 *
 * @param name - Raw name.
 * @returns At most 12 characters.
 */
export function shortName(name: string): string {
  const mcp = /^mcp__(.+?)__/.exec(name);
  const base = mcp ? (mcp[1] ?? name) : name;
  return base.length > 12 ? `${base.slice(0, 11)}…` : base;
}

/**
 * Grid placement of N clusters inside a w×h stage.
 *
 * @returns Centre and scale per cluster.
 */
function layout(w: number, h: number, n: number): { x: number; y: number; s: number }[] {
  if (n === 0) return [];
  const cols = Math.max(1, Math.round(Math.sqrt((n * w) / h)));
  const rows = Math.ceil(n / cols);
  const cw = w / cols;
  const ch = h / rows;
  const s = Math.max(0.35, Math.min(1.6, Math.min(cw, ch) / 360));
  const out: { x: number; y: number; s: number }[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const c = i % cols;
    const offset = (w - inRow * cw) / 2;
    out.push({ x: offset + cw * c + cw / 2, y: ch * r + ch / 2, s });
  }
  return out;
}

/**
 * The canvas stage.
 *
 * @param props - See {@link FlowStageProps}.
 * @returns A canvas that fills its parent.
 */
export function FlowStage({ sessions, shots, theme, reducedMotion, label }: FlowStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const themeRef = useRef(theme);
  const stateRef = useRef<ThemeState>(makeThemeState(1, 1));
  const activeRef = useRef<ActiveShot[]>([]);
  const seenRef = useRef<Set<number>>(new Set());
  const flashRef = useRef<Map<string, number>>(new Map());
  const particlesRef = useRef<Particle[]>([]);

  // Queue new shots.
  useEffect(() => {
    const now = performance.now();
    for (const shot of shots) {
      if (seenRef.current.has(shot.id)) continue;
      seenRef.current.add(shot.id);
      activeRef.current.push({ ...shot, born: now });
    }
    if (seenRef.current.size > 2000) seenRef.current = new Set(shots.map((s) => s.id));
    if (activeRef.current.length > 80) activeRef.current = activeRef.current.slice(-80);
  }, [shots]);

  // Rebuild theme layers on theme change.
  useEffect(() => {
    themeRef.current = theme;
    const st = stateRef.current;
    const fresh = makeThemeState(st.w, st.h);
    stateRef.current = fresh;
    THEMES[theme].init(fresh);
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      ctx = null;
    }
    if (!ctx) return;
    const g = ctx;
    let raf = 0;
    let last = 0;
    let disposed = false;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(200, rect.width);
      const h = Math.max(200, rect.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const st = makeThemeState(w, h);
      stateRef.current = st;
      THEMES[themeRef.current].init(st);
    };
    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(wrap);
    window.addEventListener("resize", resize);

    const burst = (x: number, y: number, color: string) => {
      const ps = particlesRef.current;
      for (let i = 0; i < 22; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 40 + Math.random() * 160;
        ps.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color });
      }
      if (ps.length > MAX_PARTICLES) ps.splice(0, ps.length - MAX_PARTICLES);
    };

    const draw = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(draw);
      if (reducedMotion && now - last < 1000) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      const t = now / 1000;
      const th = THEMES[themeRef.current];
      const st = stateRef.current;
      const { w, h } = st;
      th.background(g, st, t);

      const list = sessionsRef.current;
      const spots = layout(w, h, list.length);
      const agentPos = new Map<string, [number, number]>();
      const toolPos = new Map<string, [number, number]>();
      const corePos = new Map<string, [number, number]>();

      list.forEach((session, i) => {
        const spot = spots[i];
        if (!spot) return;
        const { x, y, s } = spot;
        corePos.set(session.id, [x, y]);
        th.frame(g, x, y, s, t);
        const main = session.agents.find((a) => a.main) ?? session.agents[0];
        const subs = session.agents.filter((a) => a !== main).slice(0, 10);
        if (main) agentPos.set(`${session.id}|${main.id}`, [x, y]);
        subs.forEach((a, k) => {
          const ang = (k * Math.PI * 2) / subs.length + t * 0.18 + i;
          const p: [number, number] = [
            x + Math.cos(ang) * 62 * s,
            y + Math.sin(ang) * 62 * s * th.tilt,
          ];
          agentPos.set(`${session.id}|${a.id}`, p);
        });
        const tools = session.tools.slice(0, 12);
        tools.forEach((tool, k) => {
          const ang = (k * Math.PI * 2) / tools.length - t * 0.05 - Math.PI / 2;
          toolPos.set(`${session.id}|${tool.name}`, [
            x + Math.cos(ang) * 118 * s,
            y + Math.sin(ang) * 118 * s * th.tilt,
          ]);
        });
        tools.forEach((tool) => {
          const p = toolPos.get(`${session.id}|${tool.name}`);
          if (p) th.link(g, x, y, p[0], p[1]);
        });
        subs.forEach((a) => {
          const p = agentPos.get(`${session.id}|${a.id}`);
          if (p) th.link(g, x, y, p[0], p[1]);
        });
        tools.forEach((tool) => {
          const key = `${session.id}|${tool.name}`;
          const p = toolPos.get(key);
          if (!p) return;
          const f = flashRef.current.get(key);
          const flash = f ? Math.max(0, 1 - (now - f) / FLASH_MS) : 0;
          th.tool(g, p[0], p[1], 9 * Math.max(s, 0.7), t, flash);
          th.label(
            g,
            shortName(tool.name),
            p[0],
            p[1] + 20 * Math.max(s, 0.7),
            10 * Math.max(s, 0.85)
          );
        });
        subs.forEach((a) => {
          const p = agentPos.get(`${session.id}|${a.id}`);
          if (!p) return;
          th.agent(g, p[0], p[1], 9 * Math.max(s, 0.7), t, a.status);
          th.label(
            g,
            shortName(a.label),
            p[0],
            p[1] + 18 * Math.max(s, 0.7),
            9 * Math.max(s, 0.85)
          );
        });
        th.core(g, x, y, 22 * s, t, main?.status ?? "waiting");
        th.label(g, session.name, x, y - 150 * s, 13 * Math.max(s, 0.9), true);
      });

      // Shots
      const keep: ActiveShot[] = [];
      for (const shot of activeRef.current) {
        const p = reducedMotion ? 1 : (now - shot.born) / SHOT_MS;
        const a = agentPos.get(`${shot.sessionId}|${shot.agentId}`) ?? corePos.get(shot.sessionId);
        const b = toolPos.get(`${shot.sessionId}|${shot.tool}`);
        if (!a || !b) continue;
        const [from, to] = shot.outbound ? [a, b] : [b, a];
        if (p >= 1) {
          const key = shot.outbound ? `${shot.sessionId}|${shot.tool}` : null;
          if (key) flashRef.current.set(key, now);
          if (!reducedMotion) burst(to[0], to[1], shot.outbound ? th.out : th.back);
          continue;
        }
        th.shot(g, from[0], from[1], to[0], to[1], p, shot.outbound, t);
        keep.push(shot);
      }
      activeRef.current = keep;

      // Particles
      const ps = particlesRef.current;
      if (ps.length) {
        g.save();
        g.globalCompositeOperation = "lighter";
        let j = 0;
        for (const q of ps) {
          q.life -= dt * 1.6;
          if (q.life <= 0) continue;
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          q.vx *= 0.94;
          q.vy *= 0.94;
          g.globalAlpha = q.life;
          g.fillStyle = q.color;
          g.beginPath();
          g.arc(q.x, q.y, 1.6 + q.life * 1.6, 0, Math.PI * 2);
          g.fill();
          ps[j++] = q;
        }
        ps.length = j;
        g.restore();
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [reducedMotion]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas ref={canvasRef} role="img" aria-label={label} className="block h-full w-full" />
    </div>
  );
}

export default FlowStage;
