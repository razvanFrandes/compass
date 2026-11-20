import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, signal, viewChild } from '@angular/core';
import { OrbMotion, type OrbState } from './orb-motion';
import type { OrbRenderer } from './orb-renderer';

export type { OrbState } from './orb-motion';

/** What the still frame shows for each state when motion is reduced: listening is drawn mid-word. */
const STILL_LEVEL: Record<OrbState, number> = { idle: 0, listening: 0.5, thinking: 0, speaking: 0.45 };

/*
  <juyo-orb>: Kassandra's voice orb.

  A living sphere in WebGL2: its surface morphs (simplex noise + spherical harmonics), plasma flows inside
  the glass, the rim glows in the Kassandra gradient, and a feedback buffer leaves trails around it, in the
  spirit of the MilkDrop visualiser (each frame is last frame, zoomed, turned, warped and faded).

      <juyo-orb [state]="'listening'" [level]="mic.level()" [bands]="mic.bands()" [size]="200" />

  idle       slow breathing morph
  listening  the voice drives it: bass bulges the body, mids ripple the surface, highs sparkle on the rim,
             and a waveform ring leaves ripples in the trails
  thinking   a calmer, twisting, rotating swirl
  speaking   rhythmic rings over the surface; follows `level` if given, a speech-like rhythm if not

  Decorative: aria-hidden, no focus, no pointer events. Say the state in text next to it.
  It stops drawing when off-screen or when the tab is hidden, frees its GL objects on destroy, comes back
  after a lost context, shows a still frame with a gentle opacity pulse under prefers-reduced-motion, and
  falls back to a CSS orb where WebGL2 is missing. The renderer (7 kB gzipped) is loaded on demand,
  outside the main bundle.
*/
@Component({
  selector: 'juyo-orb',
  host: {
    class: 'juyo-orb',
    'aria-hidden': 'true',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[attr.data-state]': 'state()',
    '[class.juyo-orb--live]': 'live()',
    '[class.juyo-orb--still]': 'still()',
    '[style.--orb-level]': 'live() ? null : level()',
  },
  template: `
    <span class="fallback"><span class="fallback-orb"></span></span>
    <canvas #canvas></canvas>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      flex: none;
      pointer-events: none;
      contain: strict;
    }
    canvas,
    .fallback {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      transition: opacity 420ms ease;
    }
    canvas {
      opacity: 0;
    }
    :host(.juyo-orb--live) canvas {
      opacity: 1;
    }
    :host(.juyo-orb--live) .fallback {
      opacity: 0;
      visibility: hidden;
      transition:
        opacity 420ms ease,
        visibility 0s 420ms;
    }

    /* The CSS orb: shown until the first WebGL frame, and for good where WebGL2 is missing. */
    .fallback {
      display: grid;
      place-items: center;
      /* The halo is a gradient sized by the box, so it scales with the orb and never meets the edge. */
      background: radial-gradient(closest-side, rgb(167 140 251 / 0.42) 54%, rgb(111 160 251 / 0.12) 74%, transparent 96%);
      transform: scale(calc(1 + var(--orb-level, 0) * 0.1));
    }
    .fallback-orb {
      width: 54%;
      height: 54%;
      border-radius: 9999px;
      background:
        radial-gradient(circle at 30% 26%, rgb(255 255 255 / 0.7) 0 6%, transparent 34%),
        radial-gradient(circle at 50% 50%, transparent 52%, rgb(255 255 255 / 0.28) 70%, transparent 71%),
        radial-gradient(circle at 62% 70%, rgb(235 117 190 / 0.9), transparent 62%), linear-gradient(135deg, #6fa0fb, #a78cfb 55%, #eb75be);
      box-shadow: inset 0 -4px 10px rgb(40 24 96 / 0.35);
      animation: orb-breathe 6s ease-in-out infinite;
    }
    @keyframes orb-breathe {
      50% {
        transform: scale(1.035);
      }
    }

    /* Reduced motion: nothing moves; the still frame only breathes in opacity, a little faster while in use. */
    @keyframes orb-pulse {
      50% {
        opacity: 0.8;
      }
    }
    :host(.juyo-orb--still.juyo-orb--live) canvas {
      transition: none;
      animation: orb-pulse 5s ease-in-out infinite;
    }
    :host(.juyo-orb--still[data-state='listening']) canvas,
    :host(.juyo-orb--still[data-state='speaking']) canvas {
      animation-duration: 2.4s;
    }
    :host(.juyo-orb--still[data-state='thinking']) canvas {
      animation-duration: 3.4s;
    }
    @media (prefers-reduced-motion: reduce) {
      .fallback {
        transform: none;
      }
      .fallback-orb {
        animation: orb-pulse 5s ease-in-out infinite;
      }
    }
  `,
})
export class JuyoOrb {
  /** Loudness of the voice, 0..1, already smoothed (see mic-analyser.ts). */
  readonly level = input(0);
  readonly state = input<OrbState>('idle');
  /** Frequency bands, low to high, 0..1 each; any length. Without them the orb derives its detail from `level`. */
  readonly bands = input<Float32Array | null>(null);
  /** Width and height in CSS pixels. The orb itself fills about 54% of it; the rest is room for the halo. */
  readonly size = input(160);

  /** A WebGL frame is on screen. */
  protected readonly live = signal(false);
  /** prefers-reduced-motion: draw one frame and stop. */
  protected readonly still = signal(false);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly ready = signal(false);
  private rendererType: typeof OrbRenderer | null = null;
  private renderer: OrbRenderer | null = null;
  private motion = new OrbMotion();
  private raf = 0;
  private last = 0;
  private onScreen = true;
  private destroyed = false;

  constructor() {
    const destroy = inject(DestroyRef);

    afterNextRender(() => {
      const canvas = this.canvas().nativeElement;
      const doc = canvas.ownerDocument;
      const view = doc.defaultView;
      if (!view) return;

      const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
      const onReduced = () => this.still.set(reduced.matches);
      onReduced();
      reduced.addEventListener('change', onReduced);

      const onVisibility = () => this.kick();
      doc.addEventListener('visibilitychange', onVisibility);

      const observer = new IntersectionObserver((entries) => {
        this.onScreen = entries[entries.length - 1].isIntersecting;
        this.kick();
      });
      observer.observe(this.host);

      // The GPU can take the context away (driver reset, too many contexts). Show the CSS orb meanwhile
      // and rebuild when it comes back; the old objects died with the old context.
      const onLost = (e: Event) => {
        e.preventDefault();
        this.stop();
        this.renderer = null;
        this.ready.set(false);
        this.live.set(false);
      };
      const onRestored = () => this.build();
      canvas.addEventListener('webglcontextlost', onLost);
      canvas.addEventListener('webglcontextrestored', onRestored);

      void import('./orb-renderer').then((m) => {
        if (this.destroyed) return;
        this.rendererType = m.OrbRenderer;
        this.build();
      });

      destroy.onDestroy(() => {
        this.destroyed = true;
        this.stop();
        observer.disconnect();
        reduced.removeEventListener('change', onReduced);
        doc.removeEventListener('visibilitychange', onVisibility);
        canvas.removeEventListener('webglcontextlost', onLost);
        canvas.removeEventListener('webglcontextrestored', onRestored);
        this.renderer?.dispose();
        this.renderer = null;
      });
    });

    // Moving: (re)start the loop when something that gates it changes. Still: redraw the one frame
    // whenever the state or the size changes.
    effect(() => {
      if (!this.ready()) return;
      const size = this.size();
      const state = this.state();
      if (this.still()) this.drawStill(state, size);
      else this.kick();
    });
  }

  private build() {
    const canvas = this.canvas().nativeElement;
    if (!this.rendererType || this.destroyed) return;
    // 2,562 vertices are plenty for a small orb; a large one gets 10,242.
    this.renderer = this.rendererType.create(canvas, this.size() <= 96 ? 4 : 5);
    if (!this.renderer) return; // no WebGL2: the CSS orb stays
    this.motion = new OrbMotion(this.state());
    this.ready.set(true);
  }

  private get running() {
    return !!this.renderer && !this.still() && this.onScreen && !this.host.ownerDocument.hidden;
  }

  private kick() {
    if (this.raf || !this.running) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private readonly frame = (now: number) => {
    this.raf = 0;
    if (!this.running || !this.renderer) return;
    // A long gap (a stalled tab) is treated as one 50 ms step, so nothing lurches.
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.fit(this.size());
    this.renderer.render(this.motion.step(dt, { state: this.state(), level: this.level(), bands: this.bands() }));
    if (!this.live()) this.live.set(true);
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Device pixels, with the pixel ratio capped at 2: beyond that the orb only costs more. */
  private fit(size: number) {
    const dpr = Math.min(this.host.ownerDocument.defaultView?.devicePixelRatio || 1, 2);
    this.renderer?.resize(size * dpr, size * dpr);
  }

  /** One settled frame: run the simulation forward off-screen so the trails exist, then leave it. */
  private drawStill(state: OrbState, size: number) {
    const renderer = this.renderer;
    if (!renderer) return;
    this.stop();
    this.fit(size);
    renderer.clearTrails();
    const motion = new OrbMotion(state);
    const input = { state, level: STILL_LEVEL[state], bands: null };
    for (let i = 0; i < 40; i++) renderer.render(motion.step(1 / 24, input));
    this.motion = motion;
    this.live.set(true);
  }
}
