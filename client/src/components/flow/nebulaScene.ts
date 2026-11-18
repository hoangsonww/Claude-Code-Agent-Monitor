/**
 * @file nebulaScene.ts
 * @description The "Neural Nebula" Live Flow theme: a cinematic three.js scene. Each session is a
 * living star system — a plasma core (the main agent) wrapped in counter-rotating rings and a
 * curl-noise particle nebula animated on the GPU, orbiting subagent moons and a ring of crystal
 * tools. Every tool call is a comet that arcs from agent to tool with a glowing trail, and lands
 * with a shockwave, a spark burst and a surge of energy through the nebula. Rendered through an
 * UnrealBloom post-processing pass (three.js, MIT).
 */

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { StageSession, StageShot } from "./FlowStage";
import type { StageStatus } from "./flowThemes";

const STATUS_COLOR: Record<StageStatus, THREE.Color> = {
  working: new THREE.Color("#38d9ff"),
  waiting: new THREE.Color("#ffb347"),
  completed: new THREE.Color("#5dffa8"),
  error: new THREE.Color("#ff4d6d"),
};
const OUT_COLOR = new THREE.Color("#7df9ff");
const BACK_COLOR = new THREE.Color("#ff6ad5");
const SHOT_MS = 1100;
const TRAIL = 28;

/** Simplex-style noise + curl helpers shared by the GPU shaders. */
const NOISE = `
vec3 hash3(vec3 p){ p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6)));
  return -1.0 + 2.0*fract(sin(p)*43758.5453123); }
float noise(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); vec3 u = f*f*(3.0-2.0*f);
  return mix(mix(mix(dot(hash3(i+vec3(0,0,0)),f-vec3(0,0,0)), dot(hash3(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),
                 mix(dot(hash3(i+vec3(0,1,0)),f-vec3(0,1,0)), dot(hash3(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),
             mix(mix(dot(hash3(i+vec3(0,0,1)),f-vec3(0,0,1)), dot(hash3(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),
                 mix(dot(hash3(i+vec3(0,1,1)),f-vec3(0,1,1)), dot(hash3(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z); }
vec3 curl(vec3 p){ const float e = 0.1;
  vec3 dx = vec3(e,0,0), dy = vec3(0,e,0), dz = vec3(0,0,e);
  float n1 = noise(p+dy+vec3(31.3)) - noise(p-dy+vec3(31.3)); float n2 = noise(p+dz+vec3(71.7)) - noise(p-dz+vec3(71.7));
  float n3 = noise(p+dz) - noise(p-dz); float n4 = noise(p+dx+vec3(71.7)) - noise(p-dx+vec3(71.7));
  float n5 = noise(p+dx+vec3(31.3)) - noise(p-dx+vec3(31.3)); float n6 = noise(p+dy) - noise(p-dy);
  return vec3(n1 - n2, n3 - n4, n5 - n6) / (2.0*e); }`;

/** Soft round sprite generated once. */
function glowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.18, "rgba(255,255,255,0.85)");
  grd.addColorStop(0.45, "rgba(255,255,255,0.22)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Thin shockwave ring sprite. */
function ringTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 40, 64, 64, 62);
  grd.addColorStop(0, "rgba(255,255,255,0)");
  grd.addColorStop(0.75, "rgba(255,255,255,0.9)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

interface ToolNode {
  name: string;
  mesh: THREE.Mesh;
  halo: THREE.Sprite;
  link: THREE.Line;
  flash: number;
  label: HTMLDivElement;
}

interface AgentNode {
  id: string;
  mesh: THREE.Mesh;
  halo: THREE.Sprite;
  label: HTMLDivElement;
  phase: number;
}

interface Cluster {
  id: string;
  group: THREE.Group;
  core: THREE.Mesh;
  coreMat: THREE.ShaderMaterial;
  rings: THREE.Mesh[];
  halo: THREE.Sprite;
  nebula: THREE.Points;
  nebulaMat: THREE.ShaderMaterial;
  energy: number;
  agents: Map<string, AgentNode>;
  mainId: string;
  tools: Map<string, ToolNode>;
  title: HTMLDivElement;
}

interface Comet {
  shot: StageShot;
  born: number;
  head: THREE.Sprite;
  trail: THREE.Points;
  history: THREE.Vector3[];
  color: THREE.Color;
}

interface Wave {
  sprite: THREE.Sprite;
  born: number;
}

/** The whole scene. Owns the renderer; React only feeds it data. */
export class NebulaScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 1, 0.1, 600);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private glow = glowTexture();
  private ring = ringTexture();
  private clusters = new Map<string, Cluster>();
  private order: string[] = [];
  private comets: Comet[] = [];
  private waves: Wave[] = [];
  private seen = new Set<number>();
  private sparks: THREE.Points;
  private sparkPos: Float32Array;
  private sparkVel: Float32Array;
  private sparkCol: Float32Array;
  private sparkLife: Float32Array;
  private sparkCursor = 0;
  private stars: THREE.Points;
  private low: boolean;
  private w = 1;
  private h = 1;
  private orbit = 0;
  private radius = 0;
  private tmp = new THREE.Vector3();

  constructor(
    canvas: HTMLCanvasElement,
    private labels: HTMLDivElement,
    low: boolean
  ) {
    this.low = low;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !low,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(low ? 1.25 : 2, window.devicePixelRatio || 1));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.scene.background = new THREE.Color("#02030a");
    this.scene.fog = new THREE.FogExp2("#02030a", 0.006);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.95, 0.5, 0.45);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.stars = this.makeStars(low ? 1500 : 4000);
    this.scene.add(this.stars);
    this.scene.add(this.makeDust(low ? 1200 : 3000));

    const N = low ? 900 : 2400;
    this.sparkPos = new Float32Array(N * 3);
    this.sparkVel = new Float32Array(N * 3);
    this.sparkCol = new Float32Array(N * 3);
    this.sparkLife = new Float32Array(N);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.sparkPos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.sparkCol, 3));
    this.sparks = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.32,
        map: this.glow,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.sparks.frustumCulled = false;
    this.scene.add(this.sparks);
  }

  private makeStars(n: number): THREE.Points {
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = 180 + Math.random() * 200;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uMap: { value: this.glow } },
      vertexShader: `attribute float seed; uniform float uTime; varying float vA; varying vec3 vC;
        void main(){ vA = 0.35 + 0.65*abs(sin(uTime*(0.4+seed*1.6) + seed*40.0));
          vC = mix(vec3(0.55,0.7,1.0), vec3(1.0,0.8,0.95), seed);
          vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = (1.2+seed*2.4)*(300.0/-mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uMap; varying float vA; varying vec3 vC;
        void main(){ gl_FragColor = vec4(vC, texture2D(uMap, gl_PointCoord).a * vA); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    return new THREE.Points(geo, mat);
  }

  /** Huge slow galactic dust lanes behind everything. */
  private makeDust(n: number): THREE.Points {
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const a = new THREE.Color("#3b1d8f");
    const b = new THREE.Color("#0e6aa8");
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const arm = i % 3;
      const r = 20 + Math.pow(Math.random(), 0.7) * 110;
      const th = arm * ((Math.PI * 2) / 3) + r * 0.045 + (Math.random() - 0.5) * 0.6;
      pos[i * 3] = Math.cos(th) * r;
      pos[i * 3 + 1] = -28 + (Math.random() - 0.5) * 8;
      pos[i * 3 + 2] = Math.sin(th) * r;
      c.copy(a).lerp(b, Math.random());
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 2.4,
        map: this.glow,
        vertexColors: true,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    pts.userData.spin = true;
    return pts;
  }

  private makeLabel(text: string, cls: string): HTMLDivElement {
    const d = document.createElement("div");
    d.className = `nebula-label ${cls}`;
    d.textContent = text;
    d.dir = "auto";
    this.labels.appendChild(d);
    return d;
  }

  private makeCluster(s: StageSession): Cluster {
    const group = new THREE.Group();
    const coreMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: STATUS_COLOR.working.clone() },
        uEnergy: { value: 0 },
      },
      vertexShader: `${NOISE}
        uniform float uTime; uniform float uEnergy; varying vec3 vN; varying vec3 vV; varying float vNoise;
        void main(){ float n = noise(normal*2.2 + uTime*0.6); vNoise = n;
          vec3 p = position + normal*(n*0.22 + uEnergy*0.25*sin(uTime*30.0 + position.y*8.0));
          vec4 mv = modelViewMatrix*vec4(p,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uEnergy; varying vec3 vN; varying vec3 vV; varying float vNoise;
        void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.2);
          vec3 hot = mix(uColor*0.6, vec3(1.0), 0.15 + 0.35*vNoise);
          vec3 c = hot*(0.25 + vNoise*0.35) + uColor*f*1.5 + vec3(1.0)*uEnergy*0.5;
          gl_FragColor = vec4(c, 1.0); }`,
    });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, this.low ? 4 : 6), coreMat);
    group.add(core);

    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.9 + i * 0.45, 0.022 + (i === 1 ? 0.02 : 0), 8, 160),
        new THREE.MeshBasicMaterial({
          color: STATUS_COLOR.working.clone(),
          transparent: true,
          opacity: 0.75 - i * 0.18,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      ring.rotation.set(Math.PI / 2 + (i - 1) * 0.5, i * 0.7, 0);
      rings.push(ring);
      group.add(ring);
    }

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glow,
        color: STATUS_COLOR.working.clone(),
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    halo.scale.setScalar(6);
    group.add(halo);

    // GPU curl-noise nebula: every particle's path is computed in the vertex shader.
    const n = this.low ? 1100 : 2600;
    const seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      seed[i * 4] = 1.6 + Math.pow(Math.random(), 1.6) * 6.5;
      seed[i * 4 + 1] = Math.random() * Math.PI * 2;
      seed[i * 4 + 2] = (Math.random() - 0.5) * 2;
      seed[i * 4 + 3] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute("seed", new THREE.BufferAttribute(seed, 4));
    const nebulaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uEnergy: { value: 0 },
        uA: { value: STATUS_COLOR.working.clone() },
        uB: { value: new THREE.Color("#8a5cff") },
        uMap: { value: this.glow },
        uScale: { value: 1 },
      },
      vertexShader: `${NOISE}
        attribute vec4 seed; uniform float uTime; uniform float uEnergy; uniform float uScale; varying vec3 vC; varying float vA;
        uniform vec3 uA; uniform vec3 uB;
        void main(){ float r = seed.x; float a = seed.y + uTime*(0.55/sqrt(r)) ; float h = seed.z;
          vec3 p = vec3(cos(a)*r, h*(0.25 + r*0.12), sin(a)*r);
          vec3 c = curl(p*0.28 + vec3(0.0, uTime*0.12, seed.w*10.0));
          p += c*(0.55 + uEnergy*1.4);
          p *= 1.0 + uEnergy*0.12;
          vC = mix(uA, uB, smoothstep(1.5, 6.5, r)) * (0.55 + uEnergy*1.4);
          vA = (0.05 + 0.5*seed.w*seed.w) * (1.0 - smoothstep(6.0, 8.5, r)) * (1.0 + uEnergy);
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          gl_PointSize = uScale*(0.5 + seed.w*1.1 + uEnergy*1.0)*(16.0/-mv.z);
          gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uMap; varying vec3 vC; varying float vA;
        void main(){ gl_FragColor = vec4(vC, texture2D(uMap, gl_PointCoord).a*vA); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const nebula = new THREE.Points(geo, nebulaMat);
    nebula.frustumCulled = false;
    nebula.rotation.x = 0.18;
    group.add(nebula);

    this.scene.add(group);
    return {
      id: s.id,
      group,
      core,
      coreMat,
      rings,
      halo,
      nebula,
      nebulaMat,
      energy: 0,
      agents: new Map(),
      mainId: "",
      tools: new Map(),
      title: this.makeLabel(s.name, "nebula-label--title"),
    };
  }

  private disposeObject(o: THREE.Object3D) {
    o.traverse((x) => {
      const m = x as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((q) => q.dispose());
      else mat?.dispose();
    });
  }

  /** Sync the scene graph with the latest sessions. */
  setData(sessions: StageSession[]) {
    const ids = new Set(sessions.map((s) => s.id));
    for (const [id, c] of this.clusters) {
      if (ids.has(id)) continue;
      this.scene.remove(c.group);
      this.disposeObject(c.group);
      c.title.remove();
      c.agents.forEach((a) => a.label.remove());
      c.tools.forEach((t) => t.label.remove());
      this.clusters.delete(id);
    }
    this.order = sessions.map((s) => s.id);
    const n = sessions.length;
    this.radius = n <= 1 ? 0 : Math.max(16, n * 6.2);

    sessions.forEach((s, i) => {
      let c = this.clusters.get(s.id);
      if (!c) {
        c = this.makeCluster(s);
        this.clusters.set(s.id, c);
      }
      c.title.textContent = s.name;
      const ang = (i / Math.max(1, n)) * Math.PI * 2;
      if (!c.group.userData.placed) {
        c.group.position.set(Math.cos(ang) * this.radius, 0, Math.sin(ang) * this.radius);
      }
      const main = s.agents.find((a) => a.main) ?? s.agents[0];
      c.mainId = main?.id ?? "";
      const col = STATUS_COLOR[main?.status ?? "waiting"];
      c.coreMat.uniforms.uColor!.value.lerp(col, 1);
      (c.halo.material as THREE.SpriteMaterial).color.copy(col);
      c.rings.forEach((r) => (r.material as THREE.MeshBasicMaterial).color.copy(col));
      (c.nebulaMat.uniforms.uA!.value as THREE.Color).copy(col);

      // Subagent moons
      const subs = s.agents.filter((a) => a !== main).slice(0, 10);
      const subIds = new Set(subs.map((a) => a.id));
      for (const [id, a] of c.agents) {
        if (subIds.has(id)) continue;
        c.group.remove(a.mesh, a.halo);
        a.mesh.geometry.dispose();
        a.label.remove();
        c.agents.delete(id);
      }
      subs.forEach((a, k) => {
        let node = c.agents.get(a.id);
        if (!node) {
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.32, 24, 16),
            new THREE.MeshBasicMaterial({ color: STATUS_COLOR[a.status].clone() })
          );
          const halo = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: this.glow,
              color: STATUS_COLOR[a.status].clone(),
              transparent: true,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            })
          );
          halo.scale.setScalar(1.5);
          (halo.material as THREE.SpriteMaterial).opacity = 0.45;
          c.group.add(mesh, halo);
          node = {
            id: a.id,
            mesh,
            halo,
            label: this.makeLabel(a.label, "nebula-label--agent"),
            phase: k,
          };
          c.agents.set(a.id, node);
        }
        node.phase = (k / subs.length) * Math.PI * 2;
        (node.mesh.material as THREE.MeshBasicMaterial).color.copy(STATUS_COLOR[a.status]);
        (node.halo.material as THREE.SpriteMaterial).color.copy(STATUS_COLOR[a.status]);
        node.label.textContent = a.label;
      });

      // Tool crystals
      const tools = s.tools.slice(0, 12);
      const toolIds = new Set(tools.map((t) => t.name));
      for (const [name, t] of c.tools) {
        if (toolIds.has(name)) continue;
        c.group.remove(t.mesh, t.halo, t.link);
        t.mesh.geometry.dispose();
        t.link.geometry.dispose();
        t.label.remove();
        c.tools.delete(name);
      }
      tools.forEach((t) => {
        if (c.tools.has(t.name)) return;
        const mesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.42, 0),
          new THREE.MeshBasicMaterial({
            color: "#7fb2ff",
            wireframe: true,
            transparent: true,
            opacity: 0.85,
          })
        );
        const inner = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.2, 0),
          new THREE.MeshBasicMaterial({ color: "#5b8cff" })
        );
        mesh.add(inner);
        const halo = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.glow,
            color: OUT_COLOR.clone(),
            transparent: true,
            opacity: 0.12,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        halo.scale.setScalar(1.8);
        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
        const link = new THREE.Line(
          lineGeo,
          new THREE.LineBasicMaterial({
            color: "#4f7dff",
            transparent: true,
            opacity: 0.12,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        link.frustumCulled = false;
        c.group.add(mesh, halo, link);
        c.tools.set(t.name, {
          name: t.name,
          mesh,
          halo,
          link,
          flash: 0,
          label: this.makeLabel(t.name, "nebula-label--tool"),
        });
      });
      let k = 0;
      const total = c.tools.size;
      for (const t of c.tools.values()) {
        t.mesh.userData.angle = (k++ / total) * Math.PI * 2;
        t.label.textContent = shortTool(t.name);
      }
    });
  }

  /** Queue new tool calls. */
  addShots(shots: StageShot[], now: number) {
    for (const shot of shots) {
      if (this.seen.has(shot.id)) continue;
      this.seen.add(shot.id);
      if (this.comets.length > (this.low ? 30 : 70)) continue;
      const color = (shot.outbound ? OUT_COLOR : BACK_COLOR).clone();
      const head = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glow,
          color,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      head.scale.setScalar(1.4);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
      const fade = new Float32Array(TRAIL);
      for (let i = 0; i < TRAIL; i++) fade[i] = 1 - i / TRAIL;
      geo.setAttribute("fade", new THREE.BufferAttribute(fade, 1));
      const trail = new THREE.Points(
        geo,
        new THREE.ShaderMaterial({
          uniforms: { uColor: { value: color }, uMap: { value: this.glow } },
          vertexShader: `attribute float fade; varying float vF;
            void main(){ vF = fade; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = (2.0+fade*9.0)*(40.0/-mv.z); gl_Position = projectionMatrix*mv; }`,
          fragmentShader: `uniform vec3 uColor; uniform sampler2D uMap; varying float vF;
            void main(){ gl_FragColor = vec4(mix(uColor, vec3(1.0), vF*0.5), texture2D(uMap, gl_PointCoord).a*vF*vF); }`,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      trail.frustumCulled = false;
      this.scene.add(head, trail);
      this.comets.push({ shot, born: now, head, trail, history: [], color });
    }
    if (this.seen.size > 3000) this.seen = new Set(shots.map((s) => s.id));
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.bloom.resolution.set(w * pr * 0.5, h * pr * 0.5);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private worldOf(
    sessionId: string,
    agentId: string | null,
    tool: string | null,
    out: THREE.Vector3
  ): boolean {
    const c = this.clusters.get(sessionId);
    if (!c) return false;
    if (tool) {
      const t = c.tools.get(tool);
      if (!t) return false;
      return !!t.mesh.getWorldPosition(out);
    }
    const a = agentId ? c.agents.get(agentId) : undefined;
    if (a && agentId !== c.mainId) return !!a.mesh.getWorldPosition(out);
    return !!c.core.getWorldPosition(out);
  }

  private burst(at: THREE.Vector3, color: THREE.Color, count: number) {
    const N = this.sparkLife.length;
    for (let i = 0; i < count; i++) {
      const k = this.sparkCursor;
      this.sparkCursor = (this.sparkCursor + 1) % N;
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const v = 2.5 + Math.random() * 7;
      this.sparkPos.set([at.x, at.y, at.z], k * 3);
      this.sparkVel.set([s * Math.cos(th) * v, u * v, s * Math.sin(th) * v], k * 3);
      this.sparkLife[k] = 0.6 + Math.random() * 0.7;
      this.sparkCol.set([color.r, color.g, color.b], k * 3);
    }
    const wave = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.ring,
        color: color.clone(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    wave.position.copy(at);
    this.scene.add(wave);
    this.waves.push({ sprite: wave, born: performance.now() });
  }

  /** Advance and draw one frame. */
  frame(now: number, dt: number, still: boolean) {
    const t = now / 1000;
    if (!still) this.orbit += dt * 0.045;
    const n = this.order.length;
    const cam = this.camera;
    const aspect = this.w / this.h;
    // Portrait phones: stack the systems top-to-bottom, each tilted towards the viewer, and let the
    // camera sway gently in front instead of orbiting a wide horizontal ring.
    const portrait = aspect < 0.9 && n > 1;
    const step = 11;
    const ease = 1 - Math.exp(-dt * 3);
    this.order.forEach((id, i) => {
      const c = this.clusters.get(id);
      if (!c) return;
      if (portrait) {
        this.tmp.set(i % 2 ? 1.6 : -1.6, ((n - 1) / 2 - i) * step, 0);
      } else {
        const ang = (i / Math.max(1, n)) * Math.PI * 2;
        this.tmp.set(Math.cos(ang) * this.radius, 0, Math.sin(ang) * this.radius);
      }
      if (!c.group.userData.placed) {
        c.group.position.copy(this.tmp);
        c.group.userData.placed = true;
      } else c.group.position.lerp(this.tmp, ease);
      c.group.rotation.x += ((portrait ? 0.85 : 0) - c.group.rotation.x) * ease;
    });
    if (portrait) {
      const half = (n * step) / 2 + 3;
      const fit = half / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      const sway = Math.sin(this.orbit * 3) * 0.35;
      cam.position.set(Math.sin(sway) * fit, 2 + Math.sin(t * 0.13), Math.cos(sway) * fit);
      cam.lookAt(0, 0, 0);
    } else {
      const dist = n <= 1 ? 15 : this.radius * 1.05 + 10;
      const boost = aspect < 1 ? 1.25 / aspect : 1;
      cam.position.set(
        Math.cos(this.orbit) * dist * boost,
        dist * 0.48 + Math.sin(t * 0.13) * 2,
        Math.sin(this.orbit) * dist * boost
      );
      cam.lookAt(0, n <= 1 ? 0 : -1.5, 0);
    }
    (this.stars.material as THREE.ShaderMaterial).uniforms.uTime!.value = t;
    this.scene.children.forEach((o) => {
      if (o.userData.spin) o.rotation.y = t * 0.01;
    });

    // Clusters
    for (const c of this.clusters.values()) {
      c.energy = Math.max(0, c.energy - dt * 0.9);
      c.coreMat.uniforms.uTime!.value = t;
      c.coreMat.uniforms.uEnergy!.value = c.energy;
      c.nebulaMat.uniforms.uTime!.value = t;
      c.nebulaMat.uniforms.uEnergy!.value = c.energy;
      c.nebulaMat.uniforms.uScale!.value = this.renderer.getPixelRatio() * (this.h / 700);
      c.core.rotation.y = t * 0.25;
      c.rings.forEach((r, i) => {
        r.rotation.z = t * (0.35 + i * 0.22) * (i % 2 ? -1 : 1);
      });
      c.halo.scale.setScalar(5.5 + Math.sin(t * 2.2) * 0.3 + c.energy * 3);
      c.agents.forEach((a) => {
        const ang = a.phase + t * 0.55;
        a.mesh.position.set(Math.cos(ang) * 3.4, Math.sin(ang * 1.3) * 0.9, Math.sin(ang) * 3.4);
        a.halo.position.copy(a.mesh.position);
      });
      c.tools.forEach((tl) => {
        const ang = (tl.mesh.userData.angle as number) - t * 0.06;
        tl.mesh.position.set(
          Math.cos(ang) * 6.6,
          Math.sin(ang * 2 + t * 0.5) * 0.6,
          Math.sin(ang) * 6.6
        );
        tl.mesh.rotation.y = t * 1.2;
        tl.mesh.rotation.x = t * 0.7;
        tl.flash = Math.max(0, tl.flash - dt * 1.4);
        tl.halo.position.copy(tl.mesh.position);
        tl.halo.scale.setScalar(1.8 + tl.flash * 4.5);
        (tl.halo.material as THREE.SpriteMaterial).opacity = 0.1 + tl.flash * 0.85;
        tl.mesh.scale.setScalar(1 + tl.flash * 0.6);
        const arr = tl.link.geometry.getAttribute("position") as THREE.BufferAttribute;
        const p = tl.mesh.position;
        for (let i = 0; i < 24; i++) {
          const u = i / 23;
          const lift = Math.sin(u * Math.PI) * 1.6;
          arr.setXYZ(i, p.x * u, p.y * u + lift, p.z * u);
        }
        arr.needsUpdate = true;
        (tl.link.material as THREE.LineBasicMaterial).opacity = 0.16 + tl.flash * 0.7;
      });
    }

    // Comets
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const ctrl = new THREE.Vector3();
    const pos = new THREE.Vector3();
    this.comets = this.comets.filter((cm) => {
      const s = cm.shot;
      const okA = this.worldOf(s.sessionId, s.agentId, null, a);
      const okB = this.worldOf(s.sessionId, null, s.tool, b);
      const done = () => {
        this.scene.remove(cm.head, cm.trail);
        cm.trail.geometry.dispose();
        (cm.trail.material as THREE.Material).dispose();
        (cm.head.material as THREE.Material).dispose();
      };
      if (!okA || !okB) {
        done();
        return false;
      }
      const [from, to] = s.outbound ? [a, b] : [b, a];
      const p = still ? 1 : Math.min(1, (now - cm.born) / SHOT_MS);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      ctrl.copy(from).add(to).multiplyScalar(0.5);
      ctrl.y += from.distanceTo(to) * 0.45 + 1.2;
      pos
        .copy(from)
        .multiplyScalar((1 - e) * (1 - e))
        .addScaledVector(ctrl, 2 * (1 - e) * e)
        .addScaledVector(to, e * e);
      cm.head.position.copy(pos);
      cm.head.scale.setScalar(1.1 + Math.sin(p * Math.PI) * 1.2);
      cm.history.unshift(pos.clone());
      if (cm.history.length > TRAIL) cm.history.length = TRAIL;
      const attr = cm.trail.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < TRAIL; i++) {
        const h = cm.history[Math.min(i, cm.history.length - 1)]!;
        attr.setXYZ(i, h.x, h.y, h.z);
      }
      attr.needsUpdate = true;
      if (p >= 1) {
        const c = this.clusters.get(s.sessionId);
        if (c) {
          c.energy = Math.min(1.6, c.energy + 0.35);
          const tl = c.tools.get(s.tool);
          if (tl && s.outbound) tl.flash = 1;
        }
        this.burst(to, cm.color, still ? 0 : this.low ? 26 : 60);
        done();
        return false;
      }
      return true;
    });

    // Shockwaves
    this.waves = this.waves.filter((w) => {
      const k = (now - w.born) / 700;
      if (k >= 1) {
        this.scene.remove(w.sprite);
        (w.sprite.material as THREE.Material).dispose();
        return false;
      }
      w.sprite.scale.setScalar(0.5 + k * 5);
      (w.sprite.material as THREE.SpriteMaterial).opacity = (1 - k) * 0.9;
      return true;
    });

    // Sparks
    const N = this.sparkLife.length;
    for (let i = 0; i < N; i++) {
      if (this.sparkLife[i]! <= 0) {
        this.sparkPos[i * 3 + 1] = -9999;
        continue;
      }
      this.sparkLife[i]! -= dt;
      const life = Math.max(0, this.sparkLife[i]!);
      for (let k = 0; k < 3; k++) {
        this.sparkPos[i * 3 + k]! += this.sparkVel[i * 3 + k]! * dt;
        this.sparkVel[i * 3 + k]! *= 0.93;
      }
      this.sparkVel[i * 3 + 1]! -= 2.5 * dt;
      const f = Math.min(1, life * 1.6);
      this.sparkCol[i * 3]! *= 0.985 + 0.015 * f;
      this.sparkCol[i * 3 + 1]! *= 0.985 + 0.015 * f;
      this.sparkCol[i * 3 + 2]! *= 0.985 + 0.015 * f;
    }
    (this.sparks.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (this.sparks.geometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;

    this.composer.render();
    this.placeLabels();
  }

  private place(el: HTMLDivElement, obj: THREE.Object3D, dy: number) {
    obj.getWorldPosition(this.tmp);
    this.tmp.y += dy;
    const d = this.tmp.distanceTo(this.camera.position);
    this.tmp.project(this.camera);
    if (this.tmp.z > 1) {
      el.style.opacity = "0";
      return;
    }
    const x = (this.tmp.x * 0.5 + 0.5) * this.w;
    const y = (-this.tmp.y * 0.5 + 0.5) * this.h;
    el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    el.style.opacity = String(Math.max(0.15, Math.min(1, 46 / d)));
  }

  private placeLabels() {
    for (const c of this.clusters.values()) {
      this.place(c.title, c.core, 4.2);
      c.agents.forEach((a) => this.place(a.label, a.mesh, -0.85));
      c.tools.forEach((tl) => this.place(tl.label, tl.mesh, -0.95));
    }
  }

  dispose() {
    this.clusters.forEach((c) => {
      this.disposeObject(c.group);
      c.title.remove();
      c.agents.forEach((a) => a.label.remove());
      c.tools.forEach((t) => t.label.remove());
    });
    this.comets.forEach((c) => this.disposeObject(c.trail));
    this.disposeObject(this.scene);
    this.glow.dispose();
    this.ring.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}

/** `mcp__github__list_issues` → `github`; long names shortened. */
export function shortTool(name: string): string {
  const mcp = /^mcp__(.+?)__/.exec(name);
  const base = mcp ? (mcp[1] ?? name) : name;
  return base.length > 14 ? `${base.slice(0, 13)}…` : base;
}
