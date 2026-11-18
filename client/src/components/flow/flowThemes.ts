/**
 * @file flowThemes.ts
 * @description Visual themes for the Live Flow canvas stage. Each theme draws the background, the
 * per-session frame, the core (main agent), subagents, tools, connection links and the animated
 * "shots" that travel between an agent and a tool on every call. Themes: Arc Reactor (HUD),
 * Synthwave, Matrix, Galaxy and Plasma Storm. Pure Canvas 2D drawing, no dependencies.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

/** Identifier of a canvas theme. */
export type StageThemeId = "reactor" | "synthwave" | "matrix" | "galaxy" | "storm";

/** Every canvas theme, in picker order. */
export const STAGE_THEMES: StageThemeId[] = ["reactor", "synthwave", "matrix", "galaxy", "storm"];

/** Agent state as the stage understands it. */
export type StageStatus = "working" | "waiting" | "completed" | "error";

/** Per-theme scratch state built on resize (offscreen layers, star fields, rain columns). */
export interface ThemeState {
  w: number;
  h: number;
  layer: HTMLCanvasElement | null;
  stars: { x: number; y: number; r: number; p: number }[];
  drops: number[];
  rain: HTMLCanvasElement | null;
}

/** Drawing hooks a theme implements. */
export interface StageTheme {
  id: StageThemeId;
  /** Vertical squash of orbits (1 = circles, < 1 = tilted ellipses). */
  tilt: number;
  /** Colours for status, shots and labels. */
  status: Record<StageStatus, string>;
  out: string;
  back: string;
  text: string;
  init(st: ThemeState): void;
  background(ctx: CanvasRenderingContext2D, st: ThemeState, t: number): void;
  frame(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void;
  link(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number): void;
  core(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    t: number,
    st: StageStatus
  ): void;
  agent(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    t: number,
    st: StageStatus
  ): void;
  tool(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    t: number,
    flash: number
  ): void;
  shot(
    ctx: CanvasRenderingContext2D,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    p: number,
    outbound: boolean,
    t: number
  ): void;
  label(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    size: number,
    main?: boolean
  ): void;
}

const TAU = Math.PI * 2;

/** Create an offscreen canvas, or null outside a browser. */
function offscreen(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.floor(w));
  c.height = Math.max(1, Math.floor(h));
  return c;
}

/** Deterministic pseudo random generator so star fields do not jump on resize. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Glowing filled circle. */
function glowDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  blur: number
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Point along a straight line. */
function lerp(ax: number, ay: number, bx: number, by: number, p: number): [number, number] {
  return [ax + (bx - ax) * p, ay + (by - ay) * p];
}

/** Ease-in-out cubic. */
function ease(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

/** Common label renderer: centred text with a soft shadow. */
function baseLabel(color: string, font: string) {
  return (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    size: number,
    main = false
  ) => {
    ctx.save();
    ctx.font = `${main ? 600 : 500} ${Math.round(size)}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 4;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  };
}

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SANS = "Inter, system-ui, sans-serif";

// ─────────────────────────────── Arc Reactor (HUD) ───────────────────────────────

const reactor: StageTheme = {
  id: "reactor",
  tilt: 1,
  status: { working: "#5ff2ff", waiting: "#ffb238", completed: "#7aa2ff", error: "#ff4d6d" },
  out: "#5ff2ff",
  back: "#ffb238",
  text: "#bdf6ff",
  init(st) {
    const layer = offscreen(st.w, st.h);
    st.layer = layer;
    const c = layer?.getContext("2d");
    if (!c) return;
    const g = c.createRadialGradient(
      st.w / 2,
      st.h / 2,
      0,
      st.w / 2,
      st.h / 2,
      Math.max(st.w, st.h) * 0.7
    );
    g.addColorStop(0, "#04182b");
    g.addColorStop(1, "#01040a");
    c.fillStyle = g;
    c.fillRect(0, 0, st.w, st.h);
    // Hex grid
    const size = 22;
    const hh = Math.sqrt(3) * size;
    c.strokeStyle = "rgba(95,242,255,0.06)";
    c.lineWidth = 1;
    for (let row = -1; row * hh < st.h + hh; row++) {
      for (let col = -1; col * size * 1.5 < st.w + size * 2; col++) {
        const x = col * size * 1.5;
        const y = row * hh + (col % 2 ? hh / 2 : 0);
        c.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k * TAU) / 6;
          const px = x + size * Math.cos(a);
          const py = y + size * Math.sin(a);
          if (k === 0) c.moveTo(px, py);
          else c.lineTo(px, py);
        }
        c.closePath();
        c.stroke();
      }
    }
    // Corner brackets
    c.strokeStyle = "rgba(95,242,255,0.35)";
    c.lineWidth = 2;
    const m = 14;
    const L = 40;
    for (const [x, y, dx, dy] of [
      [m, m, 1, 1],
      [st.w - m, m, -1, 1],
      [m, st.h - m, 1, -1],
      [st.w - m, st.h - m, -1, -1],
    ] as const) {
      c.beginPath();
      c.moveTo(x, y + dy * L);
      c.lineTo(x, y);
      c.lineTo(x + dx * L, y);
      c.stroke();
    }
  },
  background(ctx, st, t) {
    if (st.layer) ctx.drawImage(st.layer, 0, 0, st.w, st.h);
    else {
      ctx.fillStyle = "#01040a";
      ctx.fillRect(0, 0, st.w, st.h);
    }
    // Radar sweep from the centre
    const cx = st.w / 2;
    const cy = st.h / 2;
    const R = Math.hypot(st.w, st.h) / 2;
    const a = (t * 0.6) % TAU;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = `rgba(95,242,255,${0.035 * (1 - i / 24)})`;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a - (i + 1) * 0.02, a - i * 0.02);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // Horizontal scan line
    const sy = ((t * 80) % (st.h + 40)) - 20;
    const g = ctx.createLinearGradient(0, sy - 20, 0, sy + 2);
    g.addColorStop(0, "rgba(95,242,255,0)");
    g.addColorStop(1, "rgba(95,242,255,0.12)");
    ctx.fillStyle = g;
    ctx.fillRect(0, sy - 20, st.w, 22);
  },
  frame(ctx, x, y, s, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = 1.5 * s;
    // Outer segmented ring, rotating
    ctx.rotate(t * 0.25);
    ctx.strokeStyle = "rgba(95,242,255,0.45)";
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 118 * s, (i * TAU) / 12, (i * TAU) / 12 + TAU / 18);
      ctx.stroke();
    }
    ctx.rotate(-t * 0.6);
    ctx.strokeStyle = "rgba(255,178,56,0.35)";
    ctx.setLineDash([2 * s, 6 * s]);
    ctx.beginPath();
    ctx.arc(0, 0, 132 * s, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    // Tick marks
    ctx.strokeStyle = "rgba(95,242,255,0.25)";
    for (let i = 0; i < 60; i++) {
      const a = (i * TAU) / 60;
      const r1 = 140 * s;
      const r2 = (i % 5 === 0 ? 148 : 144) * s;
      ctx.beginPath();
      ctx.moveTo(r1 * Math.cos(a), r1 * Math.sin(a));
      ctx.lineTo(r2 * Math.cos(a), r2 * Math.sin(a));
      ctx.stroke();
    }
    ctx.rotate(t * 0.35);
    ctx.strokeStyle = "rgba(95,242,255,0.18)";
    ctx.beginPath();
    ctx.arc(0, 0, 62 * s, 0, TAU);
    ctx.stroke();
    ctx.restore();
  },
  link(ctx, ax, ay, bx, by) {
    ctx.strokeStyle = "rgba(95,242,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  },
  core(ctx, x, y, r, t, st) {
    const c = this.status[st];
    ctx.save();
    ctx.translate(x, y);
    const pulse = 1 + 0.08 * Math.sin(t * 4);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.4 * pulse);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.25, c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.4 * pulse, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    // Reactor segments
    ctx.rotate(-t * 1.2);
    ctx.fillStyle = c;
    ctx.shadowColor = c;
    ctx.shadowBlur = 12;
    for (let i = 0; i < 10; i++) {
      ctx.rotate(TAU / 10);
      ctx.beginPath();
      ctx.moveTo(r * 0.62, -r * 0.12);
      ctx.lineTo(r * 1.05, -r * 0.2);
      ctx.lineTo(r * 1.05, r * 0.2);
      ctx.lineTo(r * 0.62, r * 0.12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.25, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = "#eaffff";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.38, 0, TAU);
    ctx.fill();
    ctx.restore();
  },
  agent(ctx, x, y, r, t, st) {
    const c = this.status[st];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * (st === "working" ? 2 : 0.4));
    ctx.strokeStyle = c;
    ctx.shadowColor = c;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = (k * TAU) / 3;
      if (k === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
      else ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
  },
  tool(ctx, x, y, r, t, flash) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = flash > 0 ? "#ffffff" : "rgba(95,242,255,0.7)";
    ctx.lineWidth = 1.5 + flash * 2;
    ctx.shadowColor = "#5ff2ff";
    ctx.shadowBlur = 6 + flash * 20;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k * TAU) / 6 + Math.PI / 6;
      if (k === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
      else ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    ctx.closePath();
    ctx.stroke();
    if (flash > 0) {
      // Target-lock brackets
      const b = r * (1.8 - flash * 0.6);
      ctx.strokeStyle = `rgba(255,178,56,${flash})`;
      for (const [sx, sy] of [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(sx * b, sy * b * 0.5);
        ctx.lineTo(sx * b, sy * b);
        ctx.lineTo(sx * b * 0.5, sy * b);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "rgba(95,242,255,0.15)";
    ctx.fill();
    void t;
    ctx.restore();
  },
  shot(ctx, ax, ay, bx, by, p, outbound, t) {
    const c = outbound ? this.out : this.back;
    const e = ease(p);
    const [hx, hy] = lerp(ax, ay, bx, by, e);
    const [tx, ty] = lerp(ax, ay, bx, by, Math.max(0, e - 0.35));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(tx, ty, hx, hy);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, c);
    ctx.strokeStyle = g;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    glowDot(ctx, hx, hy, 3.5, "#ffffff", 18);
    void t;
    ctx.restore();
  },
  label: baseLabel("#bdf6ff", MONO),
};

// ─────────────────────────────── Synthwave ───────────────────────────────

const synthwave: StageTheme = {
  id: "synthwave",
  tilt: 0.8,
  status: { working: "#26f7fd", waiting: "#ffb347", completed: "#b388ff", error: "#ff3864" },
  out: "#ff2fd6",
  back: "#26f7fd",
  text: "#ffe1fb",
  init(st) {
    const r = rng(7);
    st.stars = Array.from({ length: 90 }, () => ({
      x: r() * st.w,
      y: r() * st.h * 0.6,
      r: r() * 1.3 + 0.2,
      p: r() * TAU,
    }));
  },
  background(ctx, st, t) {
    const { w, h } = st;
    const horizon = h * 0.62;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#0b0020");
    sky.addColorStop(0.6, "#2b0050");
    sky.addColorStop(1, "#ff2d95");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon);
    for (const s of st.stars) {
      ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(t * 2 + s.p)})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    // Striped sun
    const sr = Math.min(w, h) * 0.22;
    const sx = w / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, horizon, sr, Math.PI, TAU);
    ctx.clip();
    const sun = ctx.createLinearGradient(0, horizon - sr, 0, horizon);
    sun.addColorStop(0, "#ffe66d");
    sun.addColorStop(1, "#ff2d95");
    ctx.fillStyle = sun;
    ctx.fillRect(sx - sr, horizon - sr, sr * 2, sr);
    ctx.fillStyle = "#2b0050";
    for (let i = 0; i < 7; i++) {
      const y = horizon - sr * 0.08 - i * sr * 0.12 - ((t * 10) % (sr * 0.12));
      ctx.fillRect(sx - sr, y, sr * 2, 2 + (7 - i) * 0.9);
    }
    ctx.restore();
    // Floor
    ctx.fillStyle = "#0a0016";
    ctx.fillRect(0, horizon, w, h - horizon);
    ctx.save();
    ctx.strokeStyle = "rgba(255,47,214,0.6)";
    ctx.shadowColor = "#ff2fd6";
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.2;
    const vx = w / 2;
    for (let i = -20; i <= 20; i++) {
      ctx.beginPath();
      ctx.moveTo(vx + i * 8, horizon);
      ctx.lineTo(vx + i * w * 0.18, h);
      ctx.stroke();
    }
    const off = (t * 0.6) % 1;
    for (let i = 0; i < 14; i++) {
      const z = (i + off) / 14;
      const y = horizon + (h - horizon) * z * z;
      ctx.globalAlpha = z;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  },
  frame(ctx, x, y, s, t) {
    ctx.save();
    ctx.strokeStyle = "rgba(38,247,253,0.35)";
    ctx.shadowColor = "#26f7fd";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y, 118 * s, 118 * s * this.tilt, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,47,214,0.35)";
    ctx.setLineDash([10 * s, 8 * s]);
    ctx.lineDashOffset = -t * 30;
    ctx.beginPath();
    ctx.ellipse(x, y, 62 * s, 62 * s * this.tilt, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  },
  link(ctx, ax, ay, bx, by) {
    ctx.strokeStyle = "rgba(255,47,214,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  },
  core(ctx, x, y, r, t, st) {
    const c = this.status[st];
    const p = 1 + 0.1 * Math.sin(t * 3);
    glowDot(ctx, x, y, r * 1.1 * p, "#ff2fd6", 40);
    glowDot(ctx, x, y, r * 0.75, c, 25);
    glowDot(ctx, x, y, r * 0.35, "#ffffff", 10);
  },
  agent(ctx, x, y, r, t, st) {
    const c = this.status[st];
    ctx.save();
    ctx.strokeStyle = c;
    ctx.shadowColor = c;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.stroke();
    if (st === "working") glowDot(ctx, x, y, r * 0.35 * (1 + 0.3 * Math.sin(t * 8)), c, 10);
    ctx.restore();
  },
  tool(ctx, x, y, r, t, flash) {
    ctx.save();
    ctx.strokeStyle = flash > 0 ? "#ffffff" : "#ffb347";
    ctx.shadowColor = "#ffb347";
    ctx.shadowBlur = 8 + flash * 30;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - r, y - r, r * 2, r * 2);
    if (flash > 0) {
      ctx.globalAlpha = flash;
      ctx.strokeRect(
        x - r * (1 + (1 - flash) * 1.5),
        y - r * (1 + (1 - flash) * 1.5),
        r * 2 * (1 + (1 - flash) * 1.5),
        r * 2 * (1 + (1 - flash) * 1.5)
      );
    }
    void t;
    ctx.restore();
  },
  shot(ctx, ax, ay, bx, by, p, outbound, t) {
    const c = outbound ? this.out : this.back;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 8; i++) {
      const q = Math.max(0, p - i * 0.035);
      const [x, y] = lerp(ax, ay, bx, by, ease(q));
      ctx.globalAlpha = 1 - i / 8;
      glowDot(ctx, x, y, 4 - i * 0.35, c, 16);
    }
    void t;
    ctx.restore();
  },
  label: baseLabel("#ffe1fb", SANS),
};

// ─────────────────────────────── Matrix ───────────────────────────────

const GLYPHS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF";

const matrix: StageTheme = {
  id: "matrix",
  tilt: 1,
  status: { working: "#39ff14", waiting: "#d4ff3a", completed: "#00c8a0", error: "#ff3b3b" },
  out: "#9dff8a",
  back: "#ffffff",
  text: "#b6ffb0",
  init(st) {
    st.rain = offscreen(st.w, st.h);
    const cols = Math.ceil(st.w / 14);
    const r = rng(3);
    st.drops = Array.from({ length: cols }, () => Math.floor(r() * -60));
    const c = st.rain?.getContext("2d");
    if (c) {
      c.fillStyle = "#000";
      c.fillRect(0, 0, st.w, st.h);
    }
  },
  background(ctx, st, t) {
    const c = st.rain?.getContext("2d");
    if (c && st.rain) {
      c.fillStyle = "rgba(0,0,0,0.09)";
      c.fillRect(0, 0, st.w, st.h);
      c.font = `14px ${MONO}`;
      for (let i = 0; i < st.drops.length; i++) {
        const d = st.drops[i] ?? 0;
        const ch =
          GLYPHS[Math.floor((Math.sin(i * 12.9 + d * 78.2 + t) * 0.5 + 0.5) * GLYPHS.length)] ??
          "0";
        c.fillStyle = d % 9 === 0 ? "#d9ffd4" : "#1fcc3a";
        c.fillText(ch, i * 14, d * 14);
        st.drops[i] = d * 14 > st.h && Math.random() > 0.975 ? 0 : d + 1;
      }
      ctx.drawImage(st.rain, 0, 0, st.w, st.h);
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, st.w, st.h);
    }
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, st.w, st.h);
  },
  frame(ctx, x, y, s, t) {
    ctx.save();
    ctx.strokeStyle = "rgba(57,255,20,0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.lineDashOffset = t * 20;
    ctx.strokeRect(x - 128 * s, y - 128 * s, 256 * s, 256 * s);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(57,255,20,0.5)";
    ctx.font = `${Math.round(9 * Math.max(s, 0.8))}px ${MONO}`;
    ctx.fillText(
      `0x${Math.floor(t * 1000)
        .toString(16)
        .slice(-6)
        .toUpperCase()}`,
      x - 124 * s,
      y - 116 * s
    );
    ctx.restore();
  },
  link(ctx, ax, ay, bx, by) {
    ctx.strokeStyle = "rgba(57,255,20,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  },
  core(ctx, x, y, r, t, st) {
    const c = this.status[st];
    ctx.save();
    ctx.shadowColor = c;
    ctx.shadowBlur = 25;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = "rgba(0,30,0,0.85)";
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = c;
    ctx.font = `bold ${Math.round(r)}px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(GLYPHS[Math.floor(t * 6) % GLYPHS.length] ?? "0", x, y);
    ctx.restore();
  },
  agent(ctx, x, y, r, t, st) {
    const c = this.status[st];
    ctx.save();
    ctx.fillStyle = c;
    ctx.shadowColor = c;
    ctx.shadowBlur = 12;
    ctx.font = `bold ${Math.round(r * 1.8)}px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      GLYPHS[Math.floor(t * (st === "working" ? 10 : 2) + x) % GLYPHS.length] ?? "0",
      x,
      y
    );
    ctx.restore();
  },
  tool(ctx, x, y, r, t, flash) {
    ctx.save();
    ctx.strokeStyle = flash > 0 ? "#ffffff" : "rgba(57,255,20,0.75)";
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = flash * 25;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - r, y - r, r * 2, r * 2);
    void t;
    ctx.restore();
  },
  shot(ctx, ax, ay, bx, by, p, outbound, t) {
    ctx.save();
    ctx.font = `bold 12px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 7; i++) {
      const q = Math.max(0, p - i * 0.05);
      const [x, y] = lerp(ax, ay, bx, by, q);
      ctx.fillStyle = i === 0 ? (outbound ? "#ffffff" : "#d4ff3a") : `rgba(57,255,20,${1 - i / 7})`;
      ctx.shadowColor = "#39ff14";
      ctx.shadowBlur = i === 0 ? 15 : 0;
      ctx.fillText(GLYPHS[Math.floor(t * 20 + i * 7) % GLYPHS.length] ?? "1", x, y);
    }
    ctx.restore();
  },
  label: baseLabel("#b6ffb0", MONO),
};

// ─────────────────────────────── Galaxy ───────────────────────────────

const galaxy: StageTheme = {
  id: "galaxy",
  tilt: 0.5,
  status: { working: "#ffd36e", waiting: "#8ec5ff", completed: "#c39bff", error: "#ff6b6b" },
  out: "#9be7ff",
  back: "#ffd36e",
  text: "#e8ecff",
  init(st) {
    const r = rng(11);
    st.stars = Array.from({ length: 260 }, () => ({
      x: r() * st.w,
      y: r() * st.h,
      r: r() * 1.4 + 0.2,
      p: r() * TAU,
    }));
    const layer = offscreen(st.w, st.h);
    st.layer = layer;
    const c = layer?.getContext("2d");
    if (!c) return;
    c.fillStyle = "#030512";
    c.fillRect(0, 0, st.w, st.h);
    c.globalCompositeOperation = "lighter";
    const blobs: [number, number, number, string][] = [
      [0.25, 0.3, 0.45, "rgba(120,60,200,0.22)"],
      [0.75, 0.65, 0.5, "rgba(30,90,200,0.22)"],
      [0.55, 0.2, 0.3, "rgba(200,60,140,0.15)"],
      [0.15, 0.8, 0.3, "rgba(40,160,180,0.14)"],
    ];
    for (const [bx, by, br, col] of blobs) {
      const R = br * Math.max(st.w, st.h);
      const g = c.createRadialGradient(bx * st.w, by * st.h, 0, bx * st.w, by * st.h, R);
      g.addColorStop(0, col);
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, st.w, st.h);
    }
  },
  background(ctx, st, t) {
    if (st.layer) ctx.drawImage(st.layer, 0, 0, st.w, st.h);
    else {
      ctx.fillStyle = "#030512";
      ctx.fillRect(0, 0, st.w, st.h);
    }
    for (const s of st.stars) {
      const a = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.5 + s.p));
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc((s.x + t * 2 * s.r) % st.w, s.y, s.r, 0, TAU);
      ctx.fill();
    }
  },
  frame(ctx, x, y, s, t) {
    ctx.save();
    ctx.strokeStyle = "rgba(160,180,255,0.18)";
    ctx.lineWidth = 1;
    for (const R of [62, 118]) {
      ctx.beginPath();
      ctx.ellipse(x, y, R * s, R * s * this.tilt, 0, 0, TAU);
      ctx.stroke();
    }
    // Accretion disk
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 40; i++) {
      const a = (i * TAU) / 40 + t * 0.4;
      const R = (34 + (i % 4) * 4) * s;
      ctx.fillStyle = `rgba(255,200,120,${0.12 + 0.1 * Math.sin(i + t)})`;
      ctx.beginPath();
      ctx.arc(x + R * Math.cos(a), y + R * Math.sin(a) * this.tilt, 1.4 * s, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },
  link() {
    /* galaxies do not draw straight links; orbits carry the structure */
  },
  core(ctx, x, y, r, t, st) {
    const c = this.status[st];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const R = r * (2.8 + 0.2 * Math.sin(t * 2));
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.2, c);
    g.addColorStop(0.5, "rgba(255,120,60,0.25)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fill();
    // Lens flare spikes
    ctx.strokeStyle = "rgba(255,240,200,0.35)";
    ctx.lineWidth = 1;
    for (const a of [0, Math.PI / 2]) {
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * R * 1.6, y - Math.sin(a) * R * 1.6);
      ctx.lineTo(x + Math.cos(a) * R * 1.6, y + Math.sin(a) * R * 1.6);
      ctx.stroke();
    }
    ctx.restore();
  },
  agent(ctx, x, y, r, t, st) {
    const c = this.status[st];
    ctx.save();
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, c);
    g.addColorStop(1, "#10142a");
    ctx.shadowColor = c;
    ctx.shadowBlur = 14;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,0.35)`;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.7, r * 0.45, -0.3 + Math.sin(t) * 0.05, 0, TAU);
    ctx.stroke();
    ctx.restore();
  },
  tool(ctx, x, y, r, t, flash) {
    ctx.save();
    ctx.fillStyle = flash > 0 ? "#ffffff" : "#8d97c2";
    ctx.shadowColor = "#9be7ff";
    ctx.shadowBlur = 4 + flash * 25;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.65 * (1 + flash * 0.5), 0, TAU);
    ctx.fill();
    void t;
    ctx.restore();
  },
  shot(ctx, ax, ay, bx, by, p, outbound, t) {
    const c = outbound ? this.out : this.back;
    // Comet on a gentle arc
    const mx = (ax + bx) / 2 - (by - ay) * 0.25;
    const my = (ay + by) / 2 + (bx - ax) * 0.25;
    const at = (q: number): [number, number] => {
      const u = 1 - q;
      return [u * u * ax + 2 * u * q * mx + q * q * bx, u * u * ay + 2 * u * q * my + q * q * by];
    };
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const e = ease(p);
    for (let i = 0; i < 18; i++) {
      const q = Math.max(0, e - i * 0.018);
      const [x, y] = at(q);
      ctx.globalAlpha = (1 - i / 18) * 0.9;
      glowDot(ctx, x, y, 3.2 * (1 - i / 22), c, 12);
    }
    void t;
    ctx.restore();
  },
  label: baseLabel("#e8ecff", SANS),
};

// ─────────────────────────────── Plasma Storm ───────────────────────────────

/** Draw a jagged lightning bolt between two points. */
function bolt(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  color: string,
  jag: number
): void {
  const segs = 10;
  const nx = -(by - ay);
  const ny = bx - ax;
  const len = Math.hypot(nx, ny) || 1;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  for (let i = 1; i < segs; i++) {
    const q = i / segs;
    const off = (Math.random() - 0.5) * jag * Math.sin(q * Math.PI);
    ctx.lineTo(ax + (bx - ax) * q + (nx / len) * off, ay + (by - ay) * q + (ny / len) * off);
  }
  ctx.lineTo(bx, by);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

const storm: StageTheme = {
  id: "storm",
  tilt: 1,
  status: { working: "#c77dff", waiting: "#4cc9f0", completed: "#80ffdb", error: "#ff477e" },
  out: "#c77dff",
  back: "#4cc9f0",
  text: "#f1e4ff",
  init() {
    /* nothing precomputed */
  },
  background(ctx, st, t) {
    ctx.fillStyle = "#07020f";
    ctx.fillRect(0, 0, st.w, st.h);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const blobs: [number, number, string][] = [
      [0.3, 0.4, "rgba(150,40,255,0.22)"],
      [0.7, 0.6, "rgba(40,120,255,0.2)"],
      [0.5, 0.2, "rgba(255,40,160,0.14)"],
    ];
    blobs.forEach(([bx, by, col], i) => {
      const x = st.w * (bx + 0.12 * Math.sin(t * 0.3 + i * 2));
      const y = st.h * (by + 0.1 * Math.cos(t * 0.25 + i));
      const R = Math.max(st.w, st.h) * 0.45;
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, col);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, st.w, st.h);
    });
    ctx.restore();
    // Sheet-lightning flash every few seconds
    const f = Math.max(0, Math.sin(t * 0.9) - 0.985) * 40;
    if (f > 0) {
      ctx.fillStyle = `rgba(200,160,255,${f * 0.25})`;
      ctx.fillRect(0, 0, st.w, st.h);
    }
  },
  frame(ctx, x, y, s, t) {
    ctx.save();
    ctx.strokeStyle = "rgba(199,125,255,0.25)";
    ctx.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      const R = (118 + k * 6) * s;
      ctx.arc(x, y, R, t * (0.5 + k * 0.3), t * (0.5 + k * 0.3) + Math.PI * 1.2);
      ctx.stroke();
    }
    // Idle crackle around the core
    if (Math.random() < 0.08) {
      const a = Math.random() * TAU;
      bolt(ctx, x, y, x + Math.cos(a) * 60 * s, y + Math.sin(a) * 60 * s, "#9d4edd", 14 * s);
    }
    ctx.restore();
  },
  link(ctx, ax, ay, bx, by) {
    ctx.strokeStyle = "rgba(199,125,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  },
  core(ctx, x, y, r, t, st) {
    const c = this.status[st];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const flick = 0.85 + Math.random() * 0.3;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6 * flick);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.3, c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.6 * flick, 0, TAU);
    ctx.fill();
    void t;
    ctx.restore();
  },
  agent(ctx, x, y, r, t, st) {
    const c = this.status[st];
    const flick = st === "working" ? 0.8 + Math.random() * 0.4 : 1;
    glowDot(ctx, x, y, r * 0.8 * flick, c, 22);
    glowDot(ctx, x, y, r * 0.35, "#ffffff", 6);
    void t;
  },
  tool(ctx, x, y, r, t, flash) {
    ctx.save();
    ctx.strokeStyle = flash > 0 ? "#ffffff" : "rgba(76,201,240,0.8)";
    ctx.shadowColor = "#4cc9f0";
    ctx.shadowBlur = 8 + flash * 30;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    if (flash > 0.5)
      bolt(
        ctx,
        x,
        y,
        x + (Math.random() - 0.5) * r * 5,
        y + (Math.random() - 0.5) * r * 5,
        "#4cc9f0",
        r
      );
    void t;
    ctx.restore();
  },
  shot(ctx, ax, ay, bx, by, p, outbound) {
    const c = outbound ? this.out : this.back;
    const [hx, hy] = lerp(ax, ay, bx, by, Math.min(1, p * 1.6));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = p < 0.65 ? 1 : 1 - (p - 0.65) / 0.35;
    bolt(ctx, ax, ay, hx, hy, c, 26);
    glowDot(ctx, hx, hy, 4, "#ffffff", 20);
    ctx.restore();
  },
  label: baseLabel("#f1e4ff", SANS),
};

/** Lookup of every theme by id. */
export const THEMES: Record<StageThemeId, StageTheme> = {
  reactor,
  synthwave,
  matrix,
  galaxy,
  storm,
};

/** Fresh scratch state for a stage of the given size. */
export function makeThemeState(w: number, h: number): ThemeState {
  return { w, h, layer: null, stars: [], drops: [], rain: null };
}
