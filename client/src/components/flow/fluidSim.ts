/**
 * @file fluidSim.ts
 * @description Real-time GPU fluid (Navier–Stokes on a WebGL2 grid) with vorticity, pressure
 * projection, shaded dye and bloom. Used by the "Fluid" Live Flow theme: every tool call injects a
 * jet of coloured dye from the agent towards the tool.
 *
 * Adapted from PavelDoGreat/WebGL-Fluid-Simulation (https://github.com/PavelDoGreat/WebGL-Fluid-Simulation)
 * MIT License — Copyright (c) 2017 Pavel Dobryakov. Permission is hereby granted, free of charge, to
 * any person obtaining a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation the rights to use, copy,
 * modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, subject to the
 * condition that the above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY
 * OF ANY KIND.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

type UniformName =
  | "texelSize"
  | "uTexture"
  | "value"
  | "uTarget"
  | "aspectRatio"
  | "color"
  | "point"
  | "radius"
  | "uVelocity"
  | "uSource"
  | "dt"
  | "dissipation"
  | "uCurl"
  | "curl"
  | "uPressure"
  | "uDivergence"
  | "uBloom"
  | "curve"
  | "threshold"
  | "intensity";
type Uniforms = Record<UniformName, WebGLUniformLocation | null>;

interface Fbo {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
  tx: number;
  ty: number;
  attach(id: number): number;
}

interface DoubleFbo {
  width: number;
  height: number;
  tx: number;
  ty: number;
  read: Fbo;
  write: Fbo;
  swap(): void;
}

class Program {
  program: WebGLProgram;
  u = {} as Uniforms;
  constructor(
    private gl: WebGL2RenderingContext,
    vs: WebGLShader,
    fs: WebGLShader
  ) {
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, "aPosition");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p) ?? "link");
    this.program = p;
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i)!.name;
      this.u[name as UniformName] = gl.getUniformLocation(p, name);
    }
  }
  bind() {
    this.gl.useProgram(this.program);
  }
}

const VS = `precision highp float;
attribute vec2 aPosition;
varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
uniform vec2 texelSize;
void main () {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0); vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y); vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const HEAD = `precision highp float; precision highp sampler2D;
varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;`;

const FS = {
  copy: `${HEAD} uniform sampler2D uTexture; uniform float value;
    void main(){ gl_FragColor = value * texture2D(uTexture, vUv); }`,
  splat: `${HEAD} uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color; uniform vec2 point; uniform float radius;
    void main(){ vec2 p = vUv - point.xy; p.x *= aspectRatio;
      vec3 s = exp(-dot(p, p) / radius) * color; vec3 base = texture2D(uTarget, vUv).xyz;
      gl_FragColor = vec4(base + s, 1.0); }`,
  advection: `${HEAD} uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 texelSize; uniform float dt; uniform float dissipation;
    void main(){ vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
      vec4 result = texture2D(uSource, coord); float decay = 1.0 + dissipation * dt;
      gl_FragColor = result / decay; }`,
  divergence: `${HEAD} uniform sampler2D uVelocity;
    void main(){ float L = texture2D(uVelocity, vL).x; float R = texture2D(uVelocity, vR).x;
      float T = texture2D(uVelocity, vT).y; float B = texture2D(uVelocity, vB).y;
      vec2 C = texture2D(uVelocity, vUv).xy;
      if (vL.x < 0.0) { L = -C.x; } if (vR.x > 1.0) { R = -C.x; }
      if (vT.y > 1.0) { T = -C.y; } if (vB.y < 0.0) { B = -C.y; }
      gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0); }`,
  curl: `${HEAD} uniform sampler2D uVelocity;
    void main(){ float L = texture2D(uVelocity, vL).y; float R = texture2D(uVelocity, vR).y;
      float T = texture2D(uVelocity, vT).x; float B = texture2D(uVelocity, vB).x;
      gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0); }`,
  vorticity: `${HEAD} uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;
    void main(){ float L = texture2D(uCurl, vL).x; float R = texture2D(uCurl, vR).x;
      float T = texture2D(uCurl, vT).x; float B = texture2D(uCurl, vB).x; float C = texture2D(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      force /= length(force) + 0.0001; force *= curl * C; force.y *= -1.0;
      vec2 v = texture2D(uVelocity, vUv).xy + force * dt;
      v = min(max(v, -1000.0), 1000.0); gl_FragColor = vec4(v, 0.0, 1.0); }`,
  pressure: `${HEAD} uniform sampler2D uPressure; uniform sampler2D uDivergence;
    void main(){ float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;
      float d = texture2D(uDivergence, vUv).x;
      gl_FragColor = vec4((L + R + B + T - d) * 0.25, 0.0, 0.0, 1.0); }`,
  gradient: `${HEAD} uniform sampler2D uPressure; uniform sampler2D uVelocity;
    void main(){ float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;
      vec2 v = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
      gl_FragColor = vec4(v, 0.0, 1.0); }`,
  display: `${HEAD} uniform sampler2D uTexture; uniform sampler2D uBloom; uniform vec2 texelSize;
    void main(){ vec3 c = texture2D(uTexture, vUv).rgb;
      vec3 lc = texture2D(uTexture, vL).rgb; vec3 rc = texture2D(uTexture, vR).rgb;
      vec3 tc = texture2D(uTexture, vT).rgb; vec3 bc = texture2D(uTexture, vB).rgb;
      float dx = length(rc) - length(lc); float dy = length(tc) - length(bc);
      vec3 n = normalize(vec3(dx, dy, length(texelSize)));
      float diffuse = clamp(dot(n, vec3(0.0, 0.0, 1.0)) + 0.7, 0.7, 1.0);
      c *= diffuse;
      vec3 bloom = texture2D(uBloom, vUv).rgb;
      bloom = max(1.055 * pow(max(bloom, vec3(0.0)), vec3(0.416666667)) - 0.055, vec3(0.0));
      c += bloom;
      gl_FragColor = vec4(c, 1.0); }`,
  bloomPrefilter: `${HEAD} uniform sampler2D uTexture; uniform vec3 curve; uniform float threshold;
    void main(){ vec3 c = texture2D(uTexture, vUv).rgb; float br = max(c.r, max(c.g, c.b));
      float rq = clamp(br - curve.x, 0.0, curve.y); rq = curve.z * rq * rq;
      c *= max(rq, br - threshold) / max(br, 0.0001); gl_FragColor = vec4(c, 0.0); }`,
  bloomBlur: `${HEAD} uniform sampler2D uTexture;
    void main(){ vec4 s = texture2D(uTexture, vL) + texture2D(uTexture, vR) + texture2D(uTexture, vT) + texture2D(uTexture, vB);
      gl_FragColor = s * 0.25; }`,
  bloomFinal: `${HEAD} uniform sampler2D uTexture; uniform float intensity;
    void main(){ vec4 s = texture2D(uTexture, vL) + texture2D(uTexture, vR) + texture2D(uTexture, vT) + texture2D(uTexture, vB);
      gl_FragColor = s * 0.25 * intensity; }`,
};

/** Tunables (Pavel's defaults, tuned for an always-on ambient display). */
const CONFIG = {
  densityDissipation: 1.0,
  velocityDissipation: 0.3,
  pressure: 0.8,
  pressureIterations: 20,
  curl: 28,
  splatRadius: 0.18,
  bloomIntensity: 0.85,
  bloomThreshold: 0.5,
  bloomSoftKnee: 0.7,
};

/** A WebGL2 fluid simulation bound to one canvas. */
export class FluidSim {
  private gl: WebGL2RenderingContext;
  private p: Record<keyof typeof FS, Program>;
  private dye!: DoubleFbo;
  private velocity!: DoubleFbo;
  private pressureF!: DoubleFbo;
  private divergenceF!: Fbo;
  private curlF!: Fbo;
  private bloom!: Fbo;
  private bloomLevels: Fbo[] = [];
  private simRes: number;
  private dyeRes: number;
  private bloomRes: number;

  /** Returns null when the device lacks WebGL2 float render targets. */
  static create(canvas: HTMLCanvasElement, low: boolean): FluidSim | null {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });
    if (!gl || gl.isContextLost() || !gl.getExtension("EXT_color_buffer_float")) return null;
    gl.getExtension("OES_texture_float_linear");
    try {
      return new FluidSim(gl, low);
    } catch {
      return null;
    }
  }

  private constructor(gl: WebGL2RenderingContext, low: boolean) {
    this.gl = gl;
    this.simRes = low ? 96 : 128;
    this.dyeRes = low ? 512 : 1024;
    this.bloomRes = low ? 128 : 256;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VS);
    this.p = Object.fromEntries(
      Object.entries(FS).map(([k, src]) => [
        k,
        new Program(gl, vs, compile(gl.FRAGMENT_SHADER, src)),
      ])
    ) as Record<keyof typeof FS, Program>;

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    this.initFramebuffers();
  }

  private res(r: number) {
    const gl = this.gl;
    let aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspect < 1) aspect = 1 / aspect;
    const min = Math.round(r);
    const max = Math.round(r * aspect);
    return gl.drawingBufferWidth > gl.drawingBufferHeight ? { w: max, h: min } : { w: min, h: max };
  }

  private fbo(w: number, h: number, internal: number, format: number): Fbo {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error("fbo");
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      texture,
      fbo,
      width: w,
      height: h,
      tx: 1 / w,
      ty: 1 / h,
      attach(id: number) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      },
    };
  }

  private double(w: number, h: number, internal: number, format: number): DoubleFbo {
    let a = this.fbo(w, h, internal, format);
    let b = this.fbo(w, h, internal, format);
    return {
      width: w,
      height: h,
      tx: 1 / w,
      ty: 1 / h,
      get read() {
        return a;
      },
      get write() {
        return b;
      },
      swap() {
        const t = a;
        a = b;
        b = t;
      },
    };
  }

  private initFramebuffers() {
    const gl = this.gl;
    const sim = this.res(this.simRes);
    const dye = this.res(this.dyeRes);
    this.dye = this.double(dye.w, dye.h, gl.RGBA16F, gl.RGBA);
    this.velocity = this.double(sim.w, sim.h, gl.RG16F, gl.RG);
    this.divergenceF = this.fbo(sim.w, sim.h, gl.R16F, gl.RED);
    this.curlF = this.fbo(sim.w, sim.h, gl.R16F, gl.RED);
    this.pressureF = this.double(sim.w, sim.h, gl.R16F, gl.RED);
    const br = this.res(this.bloomRes);
    this.bloom = this.fbo(br.w, br.h, gl.RGBA16F, gl.RGBA);
    this.bloomLevels = [];
    for (let i = 0; i < 8; i++) {
      const w = br.w >> (i + 1);
      const h = br.h >> (i + 1);
      if (w < 2 || h < 2) break;
      this.bloomLevels.push(this.fbo(w, h, gl.RGBA16F, gl.RGBA));
    }
  }

  /** Call after the canvas size changes. */
  resize() {
    this.initFramebuffers();
  }

  private blit(target: Fbo | null) {
    const gl = this.gl;
    if (target) {
      gl.viewport(0, 0, target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    } else {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  /**
   * Inject dye and momentum.
   *
   * @param x - 0..1 from the left.
   * @param y - 0..1 from the bottom.
   * @param dx - Horizontal force.
   * @param dy - Vertical force.
   * @param color - Linear RGB, roughly 0..1.
   * @param scale - Radius multiplier.
   */
  splat(x: number, y: number, dx: number, dy: number, color: [number, number, number], scale = 1) {
    const gl = this.gl;
    const s = this.p.splat;
    s.bind();
    const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    let radius = (CONFIG.splatRadius * scale) / 100;
    if (aspect > 1) radius *= aspect;
    gl.uniform1i(s.u.uTarget, this.velocity.read.attach(0));
    gl.uniform1f(s.u.aspectRatio, aspect);
    gl.uniform2f(s.u.point, x, y);
    gl.uniform3f(s.u.color, dx, dy, 0);
    gl.uniform1f(s.u.radius, radius);
    this.blit(this.velocity.write);
    this.velocity.swap();
    gl.uniform1i(s.u.uTarget, this.dye.read.attach(0));
    gl.uniform3f(s.u.color, color[0], color[1], color[2]);
    this.blit(this.dye.write);
    this.dye.swap();
  }

  /** Advance the simulation by dt seconds. */
  step(dt: number) {
    const gl = this.gl;
    const v = this.velocity;
    gl.disable(gl.BLEND);
    const { curl, vorticity, divergence, copy, pressure, gradient, advection } = this.p;

    curl.bind();
    gl.uniform2f(curl.u.texelSize, v.tx, v.ty);
    gl.uniform1i(curl.u.uVelocity, v.read.attach(0));
    this.blit(this.curlF);

    vorticity.bind();
    gl.uniform2f(vorticity.u.texelSize, v.tx, v.ty);
    gl.uniform1i(vorticity.u.uVelocity, v.read.attach(0));
    gl.uniform1i(vorticity.u.uCurl, this.curlF.attach(1));
    gl.uniform1f(vorticity.u.curl, CONFIG.curl);
    gl.uniform1f(vorticity.u.dt, dt);
    this.blit(v.write);
    v.swap();

    divergence.bind();
    gl.uniform2f(divergence.u.texelSize, v.tx, v.ty);
    gl.uniform1i(divergence.u.uVelocity, v.read.attach(0));
    this.blit(this.divergenceF);

    copy.bind();
    gl.uniform1i(copy.u.uTexture, this.pressureF.read.attach(0));
    gl.uniform1f(copy.u.value, CONFIG.pressure);
    this.blit(this.pressureF.write);
    this.pressureF.swap();

    pressure.bind();
    gl.uniform2f(pressure.u.texelSize, v.tx, v.ty);
    gl.uniform1i(pressure.u.uDivergence, this.divergenceF.attach(0));
    for (let i = 0; i < CONFIG.pressureIterations; i++) {
      gl.uniform1i(pressure.u.uPressure, this.pressureF.read.attach(1));
      this.blit(this.pressureF.write);
      this.pressureF.swap();
    }

    gradient.bind();
    gl.uniform2f(gradient.u.texelSize, v.tx, v.ty);
    gl.uniform1i(gradient.u.uPressure, this.pressureF.read.attach(0));
    gl.uniform1i(gradient.u.uVelocity, v.read.attach(1));
    this.blit(v.write);
    v.swap();

    advection.bind();
    gl.uniform2f(advection.u.texelSize, v.tx, v.ty);
    const vid = v.read.attach(0);
    gl.uniform1i(advection.u.uVelocity, vid);
    gl.uniform1i(advection.u.uSource, vid);
    gl.uniform1f(advection.u.dt, dt);
    gl.uniform1f(advection.u.dissipation, CONFIG.velocityDissipation);
    this.blit(v.write);
    v.swap();

    gl.uniform1i(advection.u.uVelocity, v.read.attach(0));
    gl.uniform1i(advection.u.uSource, this.dye.read.attach(1));
    gl.uniform1f(advection.u.dissipation, CONFIG.densityDissipation);
    this.blit(this.dye.write);
    this.dye.swap();
  }

  private applyBloom() {
    const gl = this.gl;
    const { bloomPrefilter, bloomBlur, bloomFinal } = this.p;
    let last = this.bloom;
    gl.disable(gl.BLEND);
    bloomPrefilter.bind();
    const knee = CONFIG.bloomThreshold * CONFIG.bloomSoftKnee + 0.0001;
    gl.uniform3f(bloomPrefilter.u.curve, CONFIG.bloomThreshold - knee, knee * 2, 0.25 / knee);
    gl.uniform1f(bloomPrefilter.u.threshold, CONFIG.bloomThreshold);
    gl.uniform1i(bloomPrefilter.u.uTexture, this.dye.read.attach(0));
    this.blit(last);

    bloomBlur.bind();
    for (const dest of this.bloomLevels) {
      gl.uniform2f(bloomBlur.u.texelSize, last.tx, last.ty);
      gl.uniform1i(bloomBlur.u.uTexture, last.attach(0));
      this.blit(dest);
      last = dest;
    }
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.enable(gl.BLEND);
    for (let i = this.bloomLevels.length - 2; i >= 0; i--) {
      const base = this.bloomLevels[i]!;
      gl.uniform2f(bloomBlur.u.texelSize, last.tx, last.ty);
      gl.uniform1i(bloomBlur.u.uTexture, last.attach(0));
      this.blit(base);
      last = base;
    }
    gl.disable(gl.BLEND);
    bloomFinal.bind();
    gl.uniform2f(bloomFinal.u.texelSize, last.tx, last.ty);
    gl.uniform1i(bloomFinal.u.uTexture, last.attach(0));
    gl.uniform1f(bloomFinal.u.intensity, CONFIG.bloomIntensity);
    this.blit(this.bloom);
  }

  /** Draw the dye to the screen. */
  render() {
    const gl = this.gl;
    this.applyBloom();
    const d = this.p.display;
    d.bind();
    gl.uniform2f(d.u.texelSize, 1 / gl.drawingBufferWidth, 1 / gl.drawingBufferHeight);
    gl.uniform1i(d.u.uTexture, this.dye.read.attach(0));
    gl.uniform1i(d.u.uBloom, this.bloom.attach(1));
    this.blit(null);
  }

  /**
   * Release GPU resources. The context itself is kept: the same canvas may be re-used on remount
   * (React StrictMode mounts effects twice), and a lost context could not compile shaders again.
   */
  dispose() {
    const gl = this.gl;
    const all = [this.dye, this.velocity, this.pressureF];
    for (const d of all) {
      for (const f of [d.read, d.write]) {
        gl.deleteTexture(f.texture);
        gl.deleteFramebuffer(f.fbo);
      }
    }
    for (const f of [this.divergenceF, this.curlF, this.bloom, ...this.bloomLevels]) {
      gl.deleteTexture(f.texture);
      gl.deleteFramebuffer(f.fbo);
    }
    Object.values(this.p).forEach((p) => gl.deleteProgram(p.program));
  }
}
