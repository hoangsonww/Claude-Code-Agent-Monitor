/**
 * @file FlowStageGL.tsx
 * @description WebGL stages for Live Flow: "Neural Nebula" (three.js scene with GPU curl-noise
 * nebulae, comets and bloom — see nebulaScene.ts) and "Fluid" (GPU Navier–Stokes ink driven by
 * tool calls — see fluidSim.ts). Falls back to the 2D canvas stage when WebGL is unavailable.
 */

import { useEffect, useRef, useState } from "react";
import { FlowStage, layout, shortName, type FlowStageProps, type StageShot } from "./FlowStage";
import { NebulaScene } from "./nebulaScene";
import { FluidSim } from "./fluidSim";

/** WebGL theme ids. */
export type GLThemeId = "nebula" | "fluid";
export const GL_THEMES: GLThemeId[] = ["nebula", "fluid"];

/** Props: same data as the 2D stage, different theme ids. */
export interface FlowStageGLProps extends Omit<FlowStageProps, "theme"> {
  theme: GLThemeId;
}

/** Phones and small screens get lighter settings. */
function isLow(): boolean {
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const touch = typeof navigator !== "undefined" && (navigator.maxTouchPoints ?? 0) > 1;
  return small || touch;
}

/**
 * The WebGL stage.
 *
 * @param props - See {@link FlowStageGLProps}.
 */
export function FlowStageGL(props: FlowStageGLProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return <FlowStage {...props} theme="reactor" />;
  return props.theme === "nebula" ? (
    <NebulaStage {...props} onFail={() => setFailed(true)} />
  ) : (
    <FluidStage {...props} onFail={() => setFailed(true)} />
  );
}

type InnerProps = FlowStageGLProps & { onFail: () => void };

function NebulaStage({ sessions, shots, reducedMotion, label, onFail }: InnerProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<NebulaScene | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const labels = labelsRef.current;
    if (!wrap || !canvas || !labels) return;
    let scene: NebulaScene;
    try {
      scene = new NebulaScene(canvas, labels, isLow());
    } catch {
      onFail();
      return;
    }
    sceneRef.current = scene;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      scene.resize(Math.max(200, Math.min(r.width, 4096)), Math.max(200, Math.min(r.height, 4096)));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      if (reducedMotion && now - last < 1000) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      scene.frame(now, dt, reducedMotion);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  useEffect(() => {
    sceneRef.current?.setData(sessions);
  }, [sessions, reducedMotion]);

  useEffect(() => {
    sceneRef.current?.addShots(shots, performance.now());
  }, [shots, reducedMotion]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className="absolute inset-0 block h-full w-full"
      />
      <div
        ref={labelsRef}
        className="nebula-labels pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      />
    </div>
  );
}

/** Stable vivid colour per tool name. */
function toolColor(name: string): [number, number, number] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = (h % 360) / 360;
  const f = (n: number) => {
    const k = (n + hue * 6) % 6;
    return 1 - Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

const STATUS_RGB: Record<string, [number, number, number]> = {
  working: [0.1, 0.65, 1],
  waiting: [1, 0.6, 0.15],
  completed: [0.2, 1, 0.55],
  error: [1, 0.15, 0.3],
};

interface FluidShot extends StageShot {
  born: number;
}

function FluidStage({ sessions, shots, reducedMotion, label, onFail }: InnerProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const glRef = useRef<HTMLCanvasElement | null>(null);
  const uiRef = useRef<HTMLCanvasElement | null>(null);
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const activeRef = useRef<FluidShot[]>([]);
  const seenRef = useRef<Set<number>>(new Set());
  const flashRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const now = performance.now();
    for (const s of shots) {
      if (seenRef.current.has(s.id)) continue;
      seenRef.current.add(s.id);
      activeRef.current.push({ ...s, born: now });
    }
    if (seenRef.current.size > 3000) seenRef.current = new Set(shots.map((s) => s.id));
    if (activeRef.current.length > 60) activeRef.current = activeRef.current.slice(-60);
  }, [shots]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const glc = glRef.current;
    const ui = uiRef.current;
    if (!wrap || !glc || !ui) return;
    const low = isLow();
    const sim = FluidSim.create(glc, low);
    const g = ui.getContext("2d");
    if (!sim || !g) {
      onFail();
      return;
    }
    let w = 1;
    let h = 1;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      w = Math.max(200, Math.min(r.width, 4096));
      h = Math.max(200, Math.min(r.height, 4096));
      const dpr = Math.min(low ? 1 : 1.5, window.devicePixelRatio || 1);
      glc.width = Math.floor(w * dpr);
      glc.height = Math.floor(h * dpr);
      const udpr = Math.min(2, window.devicePixelRatio || 1);
      ui.width = Math.floor(w * udpr);
      ui.height = Math.floor(h * udpr);
      g.setTransform(udpr, 0, 0, udpr, 0, 0);
      sim.resize();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const SHOT_MS = 900;
    const force = 5200;
    const splatPx = (
      x: number,
      y: number,
      dx: number,
      dy: number,
      c: [number, number, number],
      k: number,
      r = 1
    ) => sim.splat(x / w, 1 - y / h, dx * force, -dy * force, [c[0] * k, c[1] * k, c[2] * k], r);

    let raf = 0;
    let last = 0;
    let ambient = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      if (reducedMotion && now - last < 1000) return;
      const dt = last ? Math.min(0.033, (now - last) / 1000) : 0.016;
      last = now;
      const t = now / 1000;
      const list = sessionsRef.current;
      const spots = layout(w, h, list.length);
      const agentPos = new Map<string, [number, number]>();
      const toolPos = new Map<string, [number, number]>();
      const corePos = new Map<string, [number, number]>();
      list.forEach((s, i) => {
        const sp = spots[i];
        if (!sp) return;
        corePos.set(s.id, [sp.x, sp.y]);
        const main = s.agents.find((a) => a.main) ?? s.agents[0];
        if (main) agentPos.set(`${s.id}|${main.id}`, [sp.x, sp.y]);
        const subs = s.agents.filter((a) => a !== main).slice(0, 10);
        subs.forEach((a, k) => {
          const ang = (k * Math.PI * 2) / subs.length + t * 0.25 + i;
          agentPos.set(`${s.id}|${a.id}`, [
            sp.x + Math.cos(ang) * 58 * sp.s,
            sp.y + Math.sin(ang) * 58 * sp.s,
          ]);
        });
        const tools = s.tools.slice(0, 12);
        tools.forEach((tool, k) => {
          const ang = (k * Math.PI * 2) / tools.length - t * 0.04 - Math.PI / 2;
          toolPos.set(`${s.id}|${tool.name}`, [
            sp.x + Math.cos(ang) * 120 * sp.s,
            sp.y + Math.sin(ang) * 120 * sp.s,
          ]);
        });
      });

      // Ambient vortices: each core slowly stirs ink in its status colour.
      ambient += dt;
      if (ambient > 0.12 && !reducedMotion) {
        ambient = 0;
        list.forEach((s, i) => {
          const p = corePos.get(s.id);
          if (!p) return;
          const main = s.agents.find((a) => a.main) ?? s.agents[0];
          const col = STATUS_RGB[main?.status ?? "waiting"] ?? STATUS_RGB.waiting!;
          const a = t * 1.7 + i * 2.1;
          const r = 26;
          splatPx(
            p[0] + Math.cos(a) * r,
            p[1] + Math.sin(a) * r,
            -Math.sin(a) * 0.12,
            Math.cos(a) * 0.12,
            col,
            0.07,
            0.55
          );
        });
      }

      // Tool calls: a jet of ink from agent to tool, then a bloom of colour on arrival.
      const keep: FluidShot[] = [];
      for (const s of activeRef.current) {
        const a = agentPos.get(`${s.sessionId}|${s.agentId}`) ?? corePos.get(s.sessionId);
        const b = toolPos.get(`${s.sessionId}|${s.tool}`);
        if (!a || !b) continue;
        const [from, to] = s.outbound ? [a, b] : [b, a];
        const p = reducedMotion ? 1 : (now - s.born) / SHOT_MS;
        const tc = toolColor(s.tool);
        const col: [number, number, number] = s.outbound ? tc : [tc[2], tc[0], tc[1]];
        if (p >= 1) {
          if (!reducedMotion) {
            for (let k = 0; k < 7; k++) {
              const ang = (k / 7) * Math.PI * 2 + Math.random();
              splatPx(to[0], to[1], Math.cos(ang) * 0.35, Math.sin(ang) * 0.35, col, 0.28, 0.65);
            }
          }
          if (s.outbound) flashRef.current.set(`${s.sessionId}|${s.tool}`, now);
          continue;
        }
        const e = 1 - Math.pow(1 - p, 2);
        const x = from[0] + (to[0] - from[0]) * e;
        const y = from[1] + (to[1] - from[1]) * e;
        const len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
        splatPx(
          x,
          y,
          ((to[0] - from[0]) / len) * 0.5,
          ((to[1] - from[1]) / len) * 0.5,
          col,
          0.2,
          0.55
        );
        keep.push(s);
      }
      activeRef.current = keep;

      sim.step(dt);
      sim.render();

      // Crisp node overlay on top of the ink.
      g.clearRect(0, 0, w, h);
      g.save();
      g.globalCompositeOperation = "lighter";
      list.forEach((s, i) => {
        const sp = spots[i];
        if (!sp) return;
        const main = s.agents.find((a) => a.main) ?? s.agents[0];
        const col = STATUS_RGB[main?.status ?? "waiting"] ?? STATUS_RGB.waiting!;
        const css = `rgb(${col.map((v) => Math.round(v * 255)).join(",")})`;
        const r = 16 * Math.max(sp.s, 0.7);
        g.strokeStyle = css;
        g.lineWidth = 1.5;
        g.globalAlpha = 0.9;
        g.beginPath();
        g.arc(sp.x, sp.y, r + Math.sin(t * 2.4) * 2, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 0.35;
        g.beginPath();
        g.arc(sp.x, sp.y, r * 1.9, t % (Math.PI * 2), (t % (Math.PI * 2)) + Math.PI * 1.2);
        g.stroke();
        g.globalAlpha = 1;
        g.fillStyle = "#fff";
        g.beginPath();
        g.arc(sp.x, sp.y, 3.5, 0, Math.PI * 2);
        g.fill();
      });
      g.restore();
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.shadowColor = "rgba(0,0,0,0.9)";
      g.shadowBlur = 6;
      list.forEach((s, i) => {
        const sp = spots[i];
        if (!sp) return;
        g.font = `600 ${Math.round(13 * Math.max(sp.s, 0.9))}px system-ui, sans-serif`;
        g.fillStyle = "rgba(255,255,255,0.95)";
        g.fillText(s.name, sp.x, sp.y - 150 * sp.s);
        s.tools.slice(0, 12).forEach((tool) => {
          const key = `${s.id}|${tool.name}`;
          const p = toolPos.get(key);
          if (!p) return;
          const f = flashRef.current.get(key);
          const fl = f ? Math.max(0, 1 - (now - f) / 900) : 0;
          const c = toolColor(tool.name);
          g.fillStyle = `rgba(${c.map((v) => Math.round(150 + v * 105)).join(",")},${0.55 + fl * 0.45})`;
          g.beginPath();
          g.arc(p[0], p[1], 4 + fl * 6, 0, Math.PI * 2);
          g.fill();
          g.font = `500 ${Math.round(10 * Math.max(sp.s, 0.85))}px ui-monospace, monospace`;
          g.fillStyle = `rgba(230,240,255,${0.6 + fl * 0.4})`;
          g.fillText(shortName(tool.name), p[0], p[1] + 16 * Math.max(sp.s, 0.7));
        });
        const main = s.agents.find((a) => a.main) ?? s.agents[0];
        s.agents
          .filter((a) => a !== main)
          .slice(0, 10)
          .forEach((a) => {
            const p = agentPos.get(`${s.id}|${a.id}`);
            if (!p) return;
            const c = STATUS_RGB[a.status] ?? STATUS_RGB.waiting!;
            g.fillStyle = `rgb(${c.map((v) => Math.round(v * 255)).join(",")})`;
            g.beginPath();
            g.arc(p[0], p[1], 5, 0, Math.PI * 2);
            g.fill();
            g.font = `500 ${Math.round(9 * Math.max(sp.s, 0.85))}px ui-monospace, monospace`;
            g.fillStyle = "rgba(255,255,255,0.8)";
            g.fillText(shortName(a.label), p[0], p[1] + 14);
          });
      });
      g.shadowBlur = 0;
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      sim.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas
        ref={glRef}
        role="img"
        aria-label={label}
        className="absolute inset-0 block h-full w-full"
      />
      <canvas
        ref={uiRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
    </div>
  );
}

export default FlowStageGL;
