import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, signal, viewChild } from '@angular/core';
import { pointCount } from './lattice';
import { OrbMotion, type OrbState } from './orb-motion';
import type { OrbStage, OrbView } from './orb-stage';

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
  Every orb on the page shares one WebGL2 context and one animation loop (orb-stage.ts) and copies its frame
  into a 2D canvas of its own, so a composer can show one at rest everywhere. It stops drawing when
  off-screen or when the tab is hidden, caps the pixel ratio at 2, draws a small resting orb at 30 fps, comes
  back after a lost context, shows a still frame with a gentle opacity pulse under prefers-reduced-motion,
  and falls back to a CSS orb where WebGL2 is missing. The renderer is loaded on demand, outside the main
  bundle.
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
    '[class.juyo-orb--small]': 'size() <= 48',
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
    /* A mark-sized orb has too little room for dots: the fallback is the plain gradient mark. */
    :host(.juyo-orb--small) .fallback-orb {
      background:
        radial-gradient(circle at 32% 28%, rgb(255 255 255 / 0.75) 0 12%, transparent 42%),
        linear-gradient(135deg, #6fa0fb, #a78cfb 55%, #eb75be);
      -webkit-mask: none;
      mask: none;
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
  private stage: OrbStage | null = null;
  private motion = new OrbMotion();
  private onScreen = true;
  private view: OrbView | null = null;

  constructor() {
    const destroy = inject(DestroyRef);
    let destroyed = false;
    destroy.onDestroy(() => (destroyed = true));

    afterNextRender(() => {
      const canvas = this.canvas().nativeElement;
      const doc = canvas.ownerDocument;
      const win = doc.defaultView;
      if (!win) return;

      const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
      const onReduced = () => this.still.set(reduced.matches);
      onReduced();
      reduced.addEventListener('change', onReduced);

      const onVisibility = () => this.stage?.kick();
      doc.addEventListener('visibilitychange', onVisibility);

      const root = doc.documentElement;
      const onTheme = () => this.light.set(root.classList.contains('light'));
      onTheme();
      const theme = new MutationObserver(onTheme);
      theme.observe(root, { attributes: true, attributeFilter: ['class'] });

      const observer = new IntersectionObserver((entries) => {
        this.onScreen = entries[entries.length - 1].isIntersecting;
        this.stage?.kick();
      });
      observer.observe(this.host);

      // What the shared stage needs from this orb.
      this.view = {
        canvas,
        // Device pixels, with the pixel ratio capped at 2: beyond that the orb only costs more.
        pixels: () => this.size() * Math.min(win.devicePixelRatio || 1, 2),
        count: () => pointCount(this.size()),
        light: () => this.light(),
        running: () => !this.still() && this.onScreen && !doc.hidden,
        // A small resting orb only breathes: 30 frames a second are plenty, at half the cost.
        interval: () => (this.size() <= 48 && this.state() === 'idle' ? 1 / 30 : 0),
        step: (dt) => this.motion.step(dt, { state: this.state(), level: this.level(), bands: this.bands() }),
        live: (on) => this.live.set(on),
      };

      void import('./orb-stage').then((m) => {
        if (destroyed || !this.view) return;
        const stage = m.orbStage(doc);
        this.motion = new OrbMotion(this.state());
        if (!stage?.add(this.view)) return; // no WebGL2: the CSS orb stays
        this.stage = stage;
        this.ready.set(true);
      });

      destroy.onDestroy(() => {
        observer.disconnect();
        theme.disconnect();
        reduced.removeEventListener('change', onReduced);
        doc.removeEventListener('visibilitychange', onVisibility);
        if (this.view) this.stage?.remove(this.view);
        this.stage = null;
      });
    });

    // Moving: (re)start the shared loop when something that gates it changes. Still: redraw the one
    // frame whenever the state, the size or the theme changes.
    effect(() => {
      if (!this.ready()) return;
      const state = this.state();
      void [this.size(), this.light()];
      if (this.still()) this.drawStill(state);
      else this.stage?.kick();
    });
  }

  /** One settled frame: run the motion forward so the state has taken hold, draw it, and leave it. */
  private drawStill(state: OrbState) {
    if (!this.stage || !this.view) return;
    const motion = new OrbMotion(state);
    const input = { state, level: STILL_LEVEL[state], bands: null };
    let frame = motion.step(1 / 24, input);
    for (let i = 0; i < 40; i++) frame = motion.step(1 / 24, input);
    this.stage.draw(this.view, frame);
    this.motion = motion;
  }
}
