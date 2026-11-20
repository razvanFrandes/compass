import { icosphere } from './icosphere';
import type { OrbFrame } from './orb-motion';
import { COMPOSITE_FS, FEEDBACK_FS, QUAD_VS, SCENE_FS, SCENE_VS } from './orb-shaders';

/*
  Draws OrbFrames with raw WebGL2: no library, about 7 kB gzipped with the shaders.

  Per frame: the orb into a 4× multisampled buffer → resolve → the trail buffer (half resolution, ping-pong)
  → composite to the canvas. One draw call each. The trail buffer is 16-bit float where the GPU allows it, so
  long fades do not band or leave residue; otherwise 8-bit with a small subtractive fade.
*/

/** Kassandra gradient. */
const C1 = [0x6f / 255, 0xa0 / 255, 0xfb / 255];
const C2 = [0xa7 / 255, 0x8c / 255, 0xfb / 255];
const C3 = [0xeb / 255, 0x75 / 255, 0xbe / 255];

/** Camera distance in orb radii, and the share of the half-canvas the resting orb fills. */
const DIST = 4.2;
export const ORB_FILL = 0.54;
const FOCAL = ORB_FILL * Math.sqrt(DIST * DIST - 1);
/** Trails cool with age: per frame at 60 fps. */
const TINT_60 = [0.988, 0.984, 1.0];
const MAX_PIXELS = 1024;

interface Program {
  program: WebGLProgram;
  u: Record<string, WebGLUniformLocation>;
}

export class OrbRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly scene: Program;
  private readonly feedback: Program;
  private readonly composite: Program;
  private readonly sphere: WebGLVertexArrayObject;
  private readonly quad: WebGLVertexArrayObject;
  private readonly buffers: WebGLBuffer[] = [];
  private readonly indexCount: number;
  private readonly floatTrails: boolean;
  private readonly samples: number;

  private msaa: { fbo: WebGLFramebuffer; color: WebGLRenderbuffer; depth: WebGLRenderbuffer } | null = null;
  private resolve: { fbo: WebGLFramebuffer; tex: WebGLTexture; depth: WebGLRenderbuffer | null } | null = null;
  private trails: { fbo: WebGLFramebuffer; tex: WebGLTexture }[] = [];
  private flip = 0;
  private width = 0;
  private height = 0;
  private trailW = 0;
  private trailH = 0;
  private readonly rot = new Float32Array(9);
  private readonly rotT = new Float32Array(9);
  private readonly tint = new Float32Array(3);

  /** Returns null when WebGL2 is missing or a shader does not compile: the caller keeps its CSS orb. */
  static create(canvas: HTMLCanvasElement, detail: number): OrbRenderer | null {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
    if (!gl) return null;
    try {
      return new OrbRenderer(gl, detail);
    } catch (err) {
      console.warn('[juyo-orb] WebGL setup failed; showing the CSS orb.', err);
      return null;
    }
  }

  private constructor(gl: WebGL2RenderingContext, detail: number) {
    this.gl = gl;
    this.floatTrails = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    this.samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) as number);

    this.scene = this.link(SCENE_VS, SCENE_FS);
    this.feedback = this.link(QUAD_VS, FEEDBACK_FS);
    this.composite = this.link(QUAD_VS, COMPOSITE_FS);

    const mesh = icosphere(detail);
    this.indexCount = mesh.indices.length;
    this.sphere = gl.createVertexArray()!;
    gl.bindVertexArray(this.sphere);
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const ibo = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    this.buffers.push(vbo, ibo);
    this.quad = gl.createVertexArray()!; // the full-screen triangle needs no attributes
    gl.bindVertexArray(null);

    for (const p of [this.scene, this.feedback, this.composite]) {
      gl.useProgram(p.program);
      if (p.u['uC1']) {
        gl.uniform3fv(p.u['uC1'], C1);
        gl.uniform3fv(p.u['uC2'], C2);
        gl.uniform3fv(p.u['uC3'], C3);
      }
    }
    gl.useProgram(this.scene.program);
    gl.uniform1f(this.scene.u['uFocal'], FOCAL);
    gl.uniform1f(this.scene.u['uDist'], DIST);
    gl.useProgram(this.feedback.program);
    gl.uniform1i(this.feedback.u['uPrev'], 0);
    gl.uniform1i(this.feedback.u['uScene'], 1);
    gl.useProgram(this.composite.program);
    gl.uniform1i(this.composite.u['uScene'], 0);
    gl.uniform1i(this.composite.u['uTrail'], 1);

    gl.clearColor(0, 0, 0, 0);
    gl.disable(gl.BLEND);
    gl.cullFace(gl.BACK);
  }

  /** Sets the drawing size in device pixels. Returns the size actually used (capped at 1024). */
  resize(width: number, height: number) {
    const w = Math.max(2, Math.min(MAX_PIXELS, Math.round(width)));
    const h = Math.max(2, Math.min(MAX_PIXELS, Math.round(height)));
    if (w === this.width && h === this.height) return;
    const gl = this.gl;
    this.width = gl.canvas.width = w;
    this.height = gl.canvas.height = h;
    this.freeTargets();

    // Orb: multisampled colour + depth, resolved into a texture the other passes read.
    const tex = this.texture(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    const resolveFbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, resolveFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    this.resolve = { fbo: resolveFbo, tex, depth: null };
    if (this.samples > 1) {
      const fbo = gl.createFramebuffer()!;
      const color = gl.createRenderbuffer()!;
      const depth = gl.createRenderbuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.bindRenderbuffer(gl.RENDERBUFFER, color);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, gl.RGBA8, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, color);
      gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, gl.DEPTH_COMPONENT16, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) this.msaa = { fbo, color, depth };
      else {
        gl.deleteFramebuffer(fbo);
        gl.deleteRenderbuffer(color);
        gl.deleteRenderbuffer(depth);
      }
    }
    if (!this.msaa) {
      // No multisampling: draw straight into the texture, with a depth buffer of its own.
      const depth = gl.createRenderbuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, resolveFbo);
      gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
      this.resolve.depth = depth;
    }

    // Trails: half resolution is plenty for something soft, and a quarter of the fill cost.
    this.trailW = Math.max(64, w >> 1);
    this.trailH = Math.max(64, h >> 1);
    for (let i = 0; i < 2; i++) {
      const t = this.floatTrails ? this.texture(this.trailW, this.trailH, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT) : this.texture(this.trailW, this.trailH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.trails.push({ fbo, tex: t });
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  }

  render(f: OrbFrame) {
    const gl = this.gl;
    if (!this.resolve || this.trails.length < 2 || gl.isContextLost()) return;
    const p = f.params;

    // Orientation: a steady turn around a slightly tilted axis, with a slow nod.
    this.orient(f.spinT, 0.32 + 0.1 * Math.sin(f.time * 0.23), 0.12 * Math.sin(f.time * 0.17));

    // 1 ─ the orb
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaa ? this.msaa.fbo : this.resolve.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const s = this.scene;
    gl.useProgram(s.program);
    gl.uniformMatrix3fv(s.u['uRot'], false, this.rot);
    gl.uniformMatrix3fv(s.u['uRotT'], false, this.rotT);
    // The pole that faces the camera, in the orb's own space: the third row of the rotation.
    gl.uniform3f(s.u['uPole'], this.rot[2], this.rot[5], this.rot[8]);
    gl.uniform1f(s.u['uScale'], p.scale);
    gl.uniform1f(s.u['uAmp'], p.amp);
    gl.uniform1f(s.u['uFreq'], p.freq);
    gl.uniform1f(s.u['uFlowT'], f.flowT);
    gl.uniform1f(s.u['uRipple'], p.ripple);
    gl.uniform1f(s.u['uRippleT'], f.rippleT);
    gl.uniform1f(s.u['uPulse'], p.pulse);
    gl.uniform1f(s.u['uPulseT'], f.pulseT);
    gl.uniform1f(s.u['uTwist'], p.twist);
    // The ripple train crosses the body along a direction that wanders slowly.
    gl.uniform3f(s.u['uWaveA'], Math.cos(f.time * 0.13), Math.sin(f.time * 0.13) * 0.8, 0.6);
    gl.uniform1fv(s.u['uSH[0]'] ?? s.u['uSH'], f.sh);
    gl.uniform1f(s.u['uPlasmaT'], f.plasmaT);
    // On the orb the colour cycle sways rather than runs: a full turn would park it on pink and lose the blue.
    gl.uniform1f(s.u['uHueT'], 0.07 * Math.sin(f.hueT * 2 * Math.PI));
    gl.uniform1f(s.u['uGlow'], p.glow);
    gl.uniform1f(s.u['uRim'], p.rim);
    gl.uniform1f(s.u['uSparkle'], p.sparkle);
    gl.uniform1f(s.u['uTime'], f.time);
    gl.bindVertexArray(this.sphere);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
    if (this.msaa) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msaa.fbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.resolve.fbo);
      gl.blitFramebuffer(0, 0, this.width, this.height, 0, 0, this.width, this.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    }
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    // 2 ─ trails: last frame warped and faded, plus this frame
    const src = this.trails[this.flip];
    const dst = this.trails[1 - this.flip];
    this.flip = 1 - this.flip;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
    gl.viewport(0, 0, this.trailW, this.trailH);
    const fb = this.feedback;
    gl.useProgram(fb.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.resolve.tex);
    gl.uniform2f(fb.u['uTexel'], 1 / this.trailW, 1 / this.trailH);
    gl.uniform1f(fb.u['uDecay'], f.decay);
    gl.uniform1f(fb.u['uZoom'], f.zoom);
    gl.uniform1f(fb.u['uRot'], f.rotate);
    gl.uniform1f(fb.u['uWarp'], p.trailWarp);
    gl.uniform1f(fb.u['uTime'], f.time);
    // Inject in proportion to what the fade removes, so brightness under the orb settles near the orb's own.
    gl.uniform1f(fb.u['uInject'], (1 - f.decay) * 0.95);
    gl.uniform1f(fb.u['uRing'], p.ring);
    gl.uniform1f(fb.u['uRingR'], ORB_FILL * p.scale * (1.07 + p.amp * 0.55));
    gl.uniform1f(fb.u['uHueT'], f.hueT);
    for (let i = 0; i < 3; i++) this.tint[i] = Math.pow(TINT_60[i], f.frames);
    gl.uniform3fv(fb.u['uTint'], this.tint);
    gl.uniform1fv(fb.u['uBands[0]'] ?? fb.u['uBands'], f.bands);
    gl.bindVertexArray(this.quad);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 3 ─ composite to the canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    const c = this.composite;
    gl.useProgram(c.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.resolve.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, dst.tex);
    gl.uniform1f(c.u['uHalo'], p.halo);
    gl.uniform1f(c.u['uBloom'], 0.06);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  /** Forget the trails (after a resize or a jump in time). */
  clearTrails() {
    const gl = this.gl;
    for (const t of this.trails) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Frees every GL object. With `release`, also gives the context back to the browser at once. */
  dispose(release = true) {
    const gl = this.gl;
    this.freeTargets();
    for (const b of this.buffers) gl.deleteBuffer(b);
    gl.deleteVertexArray(this.sphere);
    gl.deleteVertexArray(this.quad);
    for (const p of [this.scene, this.feedback, this.composite]) gl.deleteProgram(p.program);
    if (release) gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  /** Column-major rotation: yaw around Y, then a fixed tilt around X, then a small roll around Z. */
  private orient(yaw: number, pitch: number, roll: number) {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cx = Math.cos(pitch);
    const sx = Math.sin(pitch);
    const cz = Math.cos(roll);
    const sz = Math.sin(roll);
    // R = Rz · Rx · Ry
    const m00 = cz * cy - sz * sx * sy;
    const m01 = -sz * cx;
    const m02 = cz * sy + sz * sx * cy;
    const m10 = sz * cy + cz * sx * sy;
    const m11 = cz * cx;
    const m12 = sz * sy - cz * sx * cy;
    const m20 = -cx * sy;
    const m21 = sx;
    const m22 = cx * cy;
    const r = this.rot;
    r[0] = m00; r[1] = m10; r[2] = m20;
    r[3] = m01; r[4] = m11; r[5] = m21;
    r[6] = m02; r[7] = m12; r[8] = m22;
    const t = this.rotT;
    t[0] = m00; t[1] = m01; t[2] = m02;
    t[3] = m10; t[4] = m11; t[5] = m12;
    t[6] = m20; t[7] = m21; t[8] = m22;
  }

  private texture(w: number, h: number, internal: number, format: number, type: number) {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  private freeTargets() {
    const gl = this.gl;
    if (this.msaa) {
      gl.deleteFramebuffer(this.msaa.fbo);
      gl.deleteRenderbuffer(this.msaa.color);
      gl.deleteRenderbuffer(this.msaa.depth);
      this.msaa = null;
    }
    if (this.resolve) {
      gl.deleteFramebuffer(this.resolve.fbo);
      gl.deleteTexture(this.resolve.tex);
      if (this.resolve.depth) gl.deleteRenderbuffer(this.resolve.depth);
      this.resolve = null;
    }
    for (const t of this.trails) {
      gl.deleteFramebuffer(t.fbo);
      gl.deleteTexture(t.tex);
    }
    this.trails = [];
    this.flip = 0;
  }

  private link(vsSource: string, fsSource: string): Program {
    const gl = this.gl;
    const compile = (type: number, source: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, source);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error(`shader: ${log}`);
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, vsSource);
    const fs = compile(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`program: ${log}`);
    }
    const u: Record<string, WebGLUniformLocation> = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i);
      const loc = info && gl.getUniformLocation(program, info.name);
      if (info && loc) u[info.name] = loc;
    }
    return { program, u };
  }
}
