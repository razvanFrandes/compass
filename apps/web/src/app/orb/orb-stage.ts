import type { OrbFrame } from './orb-motion';
import { OrbRenderer } from './orb-renderer';

/*
  The one WebGL2 context behind every <juyo-orb> on the page.

  A page can show several orbs at once: every Kassandra composer has one at rest (the Inbox ask bar and its
  phone dock, the board, the builder chat), plus the voice orb. Browsers allow a dozen or so WebGL contexts,
  and each costs memory and a compositor layer, so the orbs share one. Each orb is a view with a 2D canvas
  of its own: the stage draws it into the corner of a hidden canvas and copies it across at once. One
  requestAnimationFrame loop drives every view that is running (on screen, tab visible, motion allowed).

  Loaded on demand with the renderer, outside the main bundle.
*/

export interface OrbView {
  /** The orb's own canvas; the stage sets its size in device pixels. */
  readonly canvas: HTMLCanvasElement;
  /** Size in device pixels (capped at 1024 by the renderer). */
  pixels(): number;
  /** How many points to draw. */
  count(): number;
  /** The page behind is light. */
  light(): boolean;
  /** Should the loop draw it now. */
  running(): boolean;
  /** Seconds between frames: a small resting orb draws at 30 fps, the rest at the display's rate. */
  interval(): number;
  /** The next frame, `dt` seconds after the last one. */
  step(dt: number): OrbFrame;
  /** The context was lost (false), or a frame is on screen (true). */
  live(on: boolean): void;
}

interface Slot {
  ctx: CanvasRenderingContext2D;
  last: number;
  wait: number;
}

export class OrbStage {
  private renderer: OrbRenderer | null;
  private readonly slots = new Map<OrbView, Slot>();
  private raf = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = OrbRenderer.create(canvas);
    canvas.addEventListener('webglcontextlost', (e) => {
      // The GPU took the context away (a driver reset). The orbs show their CSS face until it comes back.
      e.preventDefault();
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.renderer = null;
      for (const view of this.slots.keys()) view.live(false);
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.renderer = OrbRenderer.create(canvas);
      this.kick();
    });
  }

  get ok() {
    return !!this.renderer;
  }

  get size() {
    return this.slots.size;
  }

  add(view: OrbView): boolean {
    const ctx = view.canvas.getContext('2d');
    if (!this.renderer || !ctx) return false;
    this.slots.set(view, { ctx, last: 0, wait: 0 });
    this.kick();
    return true;
  }

  remove(view: OrbView) {
    this.slots.delete(view);
  }

  /** (Re)starts the loop if any view is running. */
  kick() {
    if (this.raf || !this.renderer) return;
    for (const view of this.slots.keys()) {
      if (view.running()) {
        this.raf = requestAnimationFrame(this.frame);
        return;
      }
    }
  }

  /** Draws one frame of a view now (the still frame under reduced motion). */
  draw(view: OrbView, frame: OrbFrame) {
    const slot = this.slots.get(view);
    if (slot) this.paint(view, slot, frame);
  }

  private readonly frame = (now: number) => {
    this.raf = 0;
    if (!this.renderer || this.renderer.lost) return;
    let any = false;
    for (const [view, slot] of this.slots) {
      if (!view.running()) {
        slot.last = 0;
        continue;
      }
      any = true;
      // A long gap (a stalled tab, a view back on screen) counts as one 50 ms step, so nothing lurches.
      const dt = slot.last ? Math.min(0.05, Math.max(0, (now - slot.last) / 1000)) : 1 / 60;
      slot.last = now;
      slot.wait += dt;
      if (slot.wait + 0.004 < view.interval()) continue;
      const step = Math.min(0.05, slot.wait);
      slot.wait = 0;
      this.paint(view, slot, view.step(step));
    }
    if (any) this.raf = requestAnimationFrame(this.frame);
  };

  private paint(view: OrbView, slot: Slot, frame: OrbFrame) {
    const renderer = this.renderer;
    if (!renderer) return;
    const px = view.pixels();
    const { width: w, height: h } = renderer.resize(px, px, view.count());
    renderer.render(frame, view.light());
    const own = view.canvas;
    if (own.width !== w || own.height !== h) {
      own.width = w;
      own.height = h;
    } else slot.ctx.clearRect(0, 0, w, h);
    // GL draws from the bottom-left corner: in canvas coordinates that square ends at the bottom edge.
    slot.ctx.drawImage(this.canvas, 0, this.canvas.height - h, w, h, 0, 0, w, h);
    view.live(true);
  }
}

let stage: OrbStage | null | undefined;

/** The page's stage, made on first use; null where WebGL2 is missing (the orbs keep their CSS face). */
export function orbStage(doc: Document): OrbStage | null {
  if (stage === undefined) {
    const s = new OrbStage(doc.createElement('canvas'));
    stage = s.ok ? s : null;
  }
  return stage;
}
