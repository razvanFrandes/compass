import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, signal, viewChild } from '@angular/core';
import { pointCount } from './lattice';
import { OrbMotion, type OrbState } from './orb-motion';
import type { OrbRenderer } from './orb-renderer';

export type { OrbState } from './orb-motion';

/** What the still frame shows for each state when motion is reduced: listening is drawn mid-word. */
const STILL_LEVEL: Record<OrbState, number> = { idle: 0, listening: 0.5, thinking: 0, speaking: 0.45 };

/*
  <juyo-orb>: Kassandra's voice orb.

  A sphere made of points, in the Kassandra gradient. Each latitude is a frequency band: the voice pushes
  the points of its bands out from the centre, bass at the equator, highs at the poles.

      <juyo-orb [state]="'listening'" [level]="mic.level()" [bands]="mic.bands()" [size]="200" />

  idle       turns slowly and breathes
  listening  the voice drives it: the bands lift their latitudes, a wave carries the lift from pole to pole,
             highs make the points twinkle, and it turns faster the louder you are
  thinking   quiet: a three-armed spiral winds around it and it turns quickly
  speaking   rings leave the equator in the rhythm of speech; follows `level` if given

  Decorative: aria-hidden, no focus, no pointer events. Say the state in text next to it.
  It stops drawing when off-screen or when the tab is hidden, frees its GL objects on destroy, comes back
  after a lost context, shows a still frame with a gentle opacity pulse under prefers-reduced-motion, and
  falls back to a CSS orb where WebGL2 is missing. The renderer is loaded on demand, outside the main bundle.
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
      transform: scale(calc(1 + var(--orb-level, 0) * 0.1));
    }
    /* A disc of dots in the gradient: the lattice, flat. */
    .fallback-orb {
      width: 56%;
      height: 56%;
      border-radius: 9999px;
      background: linear-gradient(to top, #6fa0fb, #a78cfb 50%, #eb75be);
      -webkit-mask: radial-gradient(circle, #000 0 1px, transparent 1.6px) center / 6px 6px;
      mask: radial-gradient(circle, #000 0 1px, transparent 1.6px) center / 6px 6px;
      clip-path: circle(50%);
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
  /** Width and height in CSS pixels. The resting sphere fills about 57% of it; the rest is room for the voice to push points out. */
  readonly size = input(160);

  /** A WebGL frame is on screen. */
  protected readonly live = signal(false);
  /** prefers-reduced-motion: draw one frame and stop. */
  protected readonly still = signal(false);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly ready = signal(false);
  /** The page behind is light (the app sets `.light` on <html>): dots are drawn deeper and opaque. */
  private readonly light = signal(false);
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

      const root = doc.documentElement;
      const onTheme = () => this.light.set(root.classList.contains('light'));
      onTheme();
      const theme = new MutationObserver(onTheme);
      theme.observe(root, { attributes: true, attributeFilter: ['class'] });

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
        theme.disconnect();
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
      const light = this.light();
      if (this.still()) this.drawStill(state, size, light);
      else this.kick();
    });
  }

  private build() {
    const canvas = this.canvas().nativeElement;
    if (!this.rendererType || this.destroyed) return;
    this.renderer = this.rendererType.create(canvas, pointCount(this.size()));
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
    this.renderer.render(this.motion.step(dt, { state: this.state(), level: this.level(), bands: this.bands() }), this.light());
    if (!this.live()) this.live.set(true);
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Device pixels, with the pixel ratio capped at 2: beyond that the orb only costs more. */
  private fit(size: number) {
    const dpr = Math.min(this.host.ownerDocument.defaultView?.devicePixelRatio || 1, 2);
    this.renderer?.resize(size * dpr, size * dpr);
  }

  /** One settled frame: run the motion forward so the state has taken hold, draw it, and leave it. */
  private drawStill(state: OrbState, size: number, light: boolean) {
    const renderer = this.renderer;
    if (!renderer) return;
    this.stop();
    this.fit(size);
    const motion = new OrbMotion(state);
    const input = { state, level: STILL_LEVEL[state], bands: null };
    let frame = motion.step(1 / 24, input);
    for (let i = 0; i < 40; i++) frame = motion.step(1 / 24, input);
    renderer.render(frame, light);
    this.motion = motion;
    this.live.set(true);
  }
}
