import { LATTICE_DIST, LATTICE_FOCAL, MARK_COUNT } from './lattice';
import type { OrbFrame } from './orb-motion';
import { POINTS_FS, POINTS_VS } from './orb-shaders';

/*
  Draws OrbFrames with raw WebGL2: no library, no buffers, no textures.
  One program, one draw call of `count` points per frame; the vertex shader builds the sphere from the
  vertex index. Blending is the only GL state.
  One renderer (one WebGL2 context) serves every orb on the page: each draw sets its own size and point
  count and lands in the bottom-left corner of the shared canvas, which the orb then copies (orb-stage.ts).
*/

const MAX_PIXELS = 1024;
/** Point sizes are tuned for 2,600 points; with fewer, each one is a little larger. */
const REFERENCE_COUNT = 2600;

export class OrbRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly u: Record<string, WebGLUniformLocation> = {};
  private width = 0;
  private height = 0;
  private count = 0;

  /** Returns null when WebGL2 is missing or a shader does not compile: the caller keeps its CSS orb. */
  static create(canvas: HTMLCanvasElement): OrbRenderer | null {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
    if (!gl) return null;
    try {
      return new OrbRenderer(gl);
    } catch (err) {
      console.warn('[juyo-orb] WebGL setup failed; showing the CSS orb.', err);
      return null;
    }
  }

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = this.link(POINTS_VS, POINTS_FS);
    this.vao = gl.createVertexArray()!; // points need no attributes, but WebGL2 still wants a vertex array bound
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniform1f(this.u['uDist'], LATTICE_DIST);
    gl.uniform1f(this.u['uFocal'], LATTICE_FOCAL);
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied "over"
  }

  get canvas() {
    return this.gl.canvas as HTMLCanvasElement;
  }

  get lost() {
    return this.gl.isContextLost();
  }

  /**
   * Sets the size of the next draws in device pixels (capped at 1024) and their number of points. The shared
   * canvas only grows; the draw fills its bottom-left `width × height` corner.
   */
  resize(width: number, height: number, count: number) {
    const w = Math.max(2, Math.min(MAX_PIXELS, Math.round(width)));
    const h = Math.max(2, Math.min(MAX_PIXELS, Math.round(height)));
    const gl = this.gl;
    if (gl.canvas.width < w) gl.canvas.width = w;
    if (gl.canvas.height < h) gl.canvas.height = h;
    this.width = w;
    this.height = h;
    gl.viewport(0, 0, w, h);
    if (count !== this.count) {
      this.count = count;
      gl.uniform1f(this.u['uCount'], count);
      // A mark-sized orb (a few hundred points) gets fuller dots, so at 18 px it reads as the orb, not as dust.
      gl.uniform1f(this.u['uDotBase'], Math.pow(REFERENCE_COUNT / count, 0.35) * (count <= MARK_COUNT ? 1.6 : 1));
    }
    return { width: w, height: h };
  }

  /** `light`: the page behind is light, so the dots are drawn deeper and opaque instead of glowing. */
  render(f: OrbFrame, light: boolean) {
    const gl = this.gl;
    if (!this.width || !this.count || gl.isContextLost()) return;
    const p = f.params;
    const u = this.u;
    gl.uniform2f(u['uRes'], this.width, this.height);
    gl.uniform1f(u['uScale'], p.scale);
    gl.uniform1f(u['uLift'], p.lift);
    gl.uniform1f(u['uWave'], p.wave);
    gl.uniform1f(u['uRipple'], p.ripple);
    gl.uniform1f(u['uPulse'], p.pulse);
    gl.uniform1f(u['uSpiral'], p.spiral);
    gl.uniform1f(u['uDot'], p.dot);
    gl.uniform1f(u['uSparkle'], p.sparkle);
    gl.uniform1f(u['uGlow'], p.glow);
    gl.uniform1f(u['uSpinT'], f.spinT);
    gl.uniform1f(u['uWaveT'], f.waveT);
    gl.uniform1f(u['uPulseT'], f.pulseT);
    gl.uniform1f(u['uSpiralT'], f.spiralT);
    gl.uniform1f(u['uTwinkleT'], f.twinkleT);
    gl.uniform1f(u['uTime'], f.time);
    // The colour cycle sways rather than runs: a full turn would swap the blue and pink ends.
    gl.uniform1f(u['uHue'], 0.06 * Math.sin(f.hueT * 2 * Math.PI));
    gl.uniform1f(u['uLight'], light ? 1 : 0);
    gl.uniform1fv(u['uBands[0]'] ?? u['uBands'], f.bands);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, this.count);
  }

  /** Frees the GL objects. With `release`, also gives the context back to the browser at once. */
  dispose(release = true) {
    const gl = this.gl;
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
    if (release) gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  private link(vsSource: string, fsSource: string): WebGLProgram {
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
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i);
      const loc = info && gl.getUniformLocation(program, info.name);
      if (info && loc) this.u[info.name] = loc;
    }
    return program;
  }
}
