import { Component, DOCUMENT, DestroyRef, computed, inject, signal } from '@angular/core';
import { JuyoOrb } from './juyo-orb';
import { type MicAnalyser, createMicAnalyser, envelope } from './mic-analyser';
import { ORB_BANDS, ORB_STATES, type OrbState, simulatedVoice } from './orb-motion';

type Source = 'sliders' | 'simulated' | 'microphone';

const STATE_NOTES: Record<OrbState, string> = {
  idle: 'A slow breathing morph. Nothing asks for attention.',
  listening: 'Your voice drives it: bass bulges the body, mids ripple the surface, highs sparkle on the rim, and the waveform leaves ripples in the halo.',
  thinking: 'A calmer swirl: the surface twists, the orb turns, the trails wind around it.',
  speaking: 'Rings travel over the surface in the rhythm of speech. It follows the level when one is given.',
};

/*
  /orb-lab: a page to see and judge <juyo-orb> on its own.
  Every control maps to one input of the component. The address can preset them, which is how the
  screenshots are taken: /orb-lab?state=listening&source=simulated&size=320&theme=light&bare=1
*/
@Component({
  selector: 'app-orb-lab',
  imports: [JuyoOrb],
  host: { class: 'bg-background text-foreground block min-h-dvh' },
  template: `
    <main class="mx-auto grid min-h-dvh max-w-[1120px] items-center gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12 lg:px-10">
      <section class="flex min-w-0 flex-col items-center gap-6" aria-label="Preview">
        <div class="grid aspect-square w-full max-w-[520px] place-items-center overflow-hidden">
          <juyo-orb [state]="state()" [level]="level()" [bands]="bands()" [size]="size()" />
        </div>
        @if (!bare()) {
          <p class="text-muted-foreground max-w-[44ch] text-center text-[14px]/relaxed" aria-live="polite">
            <span class="text-foreground font-medium capitalize">{{ state() }}.</span> {{ note() }}
          </p>

          <div class="border-border/70 w-full max-w-[520px] border-t pt-5">
            <p class="text-muted-foreground mb-3 text-[12px] font-medium tracking-[0.04em] uppercase">At composer size · 104 px</p>
            <ul class="grid grid-cols-4 gap-2">
              @for (s of states; track s) {
                <li class="flex flex-col items-center gap-1">
                  <juyo-orb [state]="s" [level]="level()" [bands]="bands()" [size]="104" />
                  <span class="text-muted-foreground text-[12px] capitalize">{{ s }}</span>
                </li>
              }
            </ul>
          </div>
        }
      </section>

      @if (!bare()) {
        <section class="bg-card border-border/70 flex flex-col gap-6 rounded-2xl border p-5" aria-label="Controls">
          <header>
            <h1 class="text-[18px] font-semibold tracking-[-0.01em]">Kassandra orb</h1>
            <p class="text-muted-foreground mt-1 text-[13px]/relaxed">The voice orb on its own. Each control below is one input of <code class="font-mono text-[12px]">&lt;juyo-orb&gt;</code>.</p>
          </header>

          <fieldset>
            <legend class="mb-2 text-[13px] font-medium">State</legend>
            <div class="bg-(--field) grid grid-cols-4 gap-1 rounded-lg p-1">
              @for (s of states; track s) {
                <button
                  type="button"
                  class="focus-visible:ring-ring rounded-md px-1 py-1.5 text-[13px] capitalize outline-none focus-visible:ring-2"
                  [class]="state() === s ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'"
                  [attr.aria-pressed]="state() === s"
                  (click)="state.set(s)"
                >
                  {{ s }}
                </button>
              }
            </div>
          </fieldset>

          <fieldset>
            <legend class="mb-2 text-[13px] font-medium">Voice</legend>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="lab-btn" [attr.aria-pressed]="source() === 'microphone'" (click)="toggleMic()">
                {{ source() === 'microphone' ? 'Stop microphone' : 'Use microphone' }}
              </button>
              <button type="button" class="lab-btn" [attr.aria-pressed]="source() === 'simulated'" (click)="toggleSimulated()">
                {{ source() === 'simulated' ? 'Stop simulated voice' : 'Simulate a voice' }}
              </button>
            </div>
            <p class="text-muted-foreground mt-2 min-h-[2lh] text-[12px]/relaxed" role="status">{{ sourceNote() }}</p>
          </fieldset>

          <div class="flex flex-col gap-4">
            <label class="lab-row">
              <span>Level</span>
              <input type="range" min="0" max="1" step="0.01" [value]="level()" [disabled]="source() !== 'sliders'" (input)="manualLevel.set(num($event))" />
              <output>{{ level().toFixed(2) }}</output>
            </label>

            <label class="flex items-center gap-2 text-[13px]">
              <input type="checkbox" class="accent-(--primary) size-4" [checked]="sendBands()" [disabled]="source() !== 'sliders'" (change)="sendBands.set($any($event.target).checked)" />
              Send frequency bands too
            </label>
            @if (source() !== 'sliders' || sendBands()) {
              @for (b of bandRows(); track b.key) {
                <label class="lab-row">
                  <span>{{ b.label }}</span>
                  <input type="range" min="0" max="1" step="0.01" [value]="b.value" [disabled]="source() !== 'sliders'" (input)="b.set(num($event))" />
                  <output>{{ b.value.toFixed(2) }}</output>
                </label>
              }
            }

            <label class="lab-row">
              <span>Size</span>
              <input type="range" min="64" max="480" step="4" [value]="size()" (input)="size.set(num($event))" />
              <output>{{ size() }} px</output>
            </label>
          </div>

          <p class="text-muted-foreground border-border/70 border-t pt-4 text-[12px]/relaxed">
            With “reduce motion” on in your system settings the orb shows one still frame with a slow opacity pulse. Without WebGL2 it becomes a CSS orb. It is decorative, so screen readers skip it.
          </p>
        </section>
      }
    </main>
  `,
  styles: `
    .lab-btn {
      border-radius: 8px;
      border: 1px solid var(--field-border);
      background: var(--field);
      padding: 7px 12px;
      font-size: 13px;
      outline: none;
    }
    .lab-btn:hover {
      border-color: var(--field-border-hover);
    }
    .lab-btn:focus-visible {
      box-shadow: 0 0 0 2px var(--ring);
    }
    .lab-btn[aria-pressed='true'] {
      background: var(--primary);
      border-color: var(--primary);
      color: var(--primary-foreground);
    }
    .lab-row {
      display: grid;
      grid-template-columns: 52px minmax(0, 1fr) 56px;
      align-items: center;
      gap: 12px;
      font-size: 13px;
    }
    .lab-row input {
      width: 100%;
      accent-color: var(--brand);
    }
    .lab-row input:disabled {
      opacity: 0.55;
    }
    .lab-row output {
      text-align: right;
      font-variant-numeric: tabular-nums;
      color: var(--muted-foreground);
    }
  `,
})
export class OrbLab {
  private readonly doc = inject(DOCUMENT);
  private readonly params = new URLSearchParams(this.doc.defaultView?.location.search ?? '');

  protected readonly states = ORB_STATES;
  protected readonly state = signal<OrbState>(this.paramState());
  protected readonly size = signal(this.paramNumber('size', 320, 64, 480));
  protected readonly bare = signal(this.params.has('bare'));
  protected readonly source = signal<Source>(this.params.get('source') === 'simulated' ? 'simulated' : 'sliders');
  protected readonly sendBands = signal(['bass', 'mid', 'high'].some((k) => this.params.has(k)));
  protected readonly micError = signal('');

  protected readonly manualLevel = signal(this.paramNumber('level', 0, 0, 1));
  private readonly bass = signal(this.paramNumber('bass', 0, 0, 1));
  private readonly mid = signal(this.paramNumber('mid', 0, 0, 1));
  private readonly high = signal(this.paramNumber('high', 0, 0, 1));
  private readonly mic = signal<MicAnalyser | null>(null);
  private readonly simLevel = signal(0);
  private readonly simBands = signal(new Float32Array(ORB_BANDS), { equal: () => false });

  protected readonly level = computed(() => {
    switch (this.source()) {
      case 'microphone':
        return this.mic()?.level() ?? 0;
      case 'simulated':
        return this.simLevel();
      default:
        return this.manualLevel();
    }
  });

  protected readonly bands = computed<Float32Array | null>(
    () => {
    switch (this.source()) {
      case 'microphone':
        return this.mic()?.bands() ?? null;
      case 'simulated':
        return this.simBands();
      default: {
        if (!this.sendBands()) return null;
        const [b, m, h] = [this.bass(), this.mid(), this.high()];
        return Float32Array.of(b, b, m, m, m, h, h, h);
      }
    }
    // A live source reuses one array, so "same array" must still count as a change.
  }, { equal: () => false });

  /** Bass / mid / high as shown next to the sliders: the sliders themselves, or what the live source is sending. */
  protected readonly bandRows = computed(() => {
    const live = this.source() === 'sliders' ? null : this.bands();
    const mean = (from: number, to: number) => {
      if (!live) return 0;
      let sum = 0;
      for (let i = from; i < to; i++) sum += live[i];
      return sum / (to - from);
    };
    return [
      { key: 'bass', label: 'Bass', value: live ? mean(0, 2) : this.bass(), set: (v: number) => this.bass.set(v) },
      { key: 'mid', label: 'Mids', value: live ? mean(2, 5) : this.mid(), set: (v: number) => this.mid.set(v) },
      { key: 'high', label: 'Highs', value: live ? mean(5, 8) : this.high(), set: (v: number) => this.high.set(v) },
    ];
  });

  protected readonly note = computed(() => STATE_NOTES[this.state()]);
  protected readonly sourceNote = computed(() => {
    if (this.micError()) return this.micError();
    switch (this.source()) {
      case 'microphone':
        return 'Listening to your microphone. The sound is measured in this page and never leaves it.';
      case 'simulated':
        return 'A synthetic voice: syllables, moving vowels and the odd “s”. No microphone needed.';
      default:
        return 'The sliders set the level by hand.';
    }
  });

  private stream: MediaStream | null = null;
  private raf = 0;

  constructor() {
    const theme = this.params.get('theme');
    if (theme === 'light' || theme === 'dark') this.doc.documentElement.dataset['theme'] = theme;
    this.doc.title = 'Kassandra orb · Juyo';
    if (this.source() === 'simulated') this.startSimulated();
    inject(DestroyRef).onDestroy(() => {
      this.stopMic();
      cancelAnimationFrame(this.raf);
    });
  }

  protected num(e: Event) {
    return Number((e.target as HTMLInputElement).value);
  }

  protected async toggleMic() {
    if (this.source() === 'microphone') {
      this.stopMic();
      this.source.set('sliders');
      return;
    }
    this.stopSimulated();
    this.micError.set('');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      this.mic.set(createMicAnalyser(this.stream));
      this.source.set('microphone');
      if (this.state() === 'idle') this.state.set('listening');
    } catch {
      this.micError.set('The microphone is not available here. Try “Simulate a voice”.');
      this.source.set('sliders');
    }
  }

  protected toggleSimulated() {
    if (this.source() === 'simulated') {
      this.stopSimulated();
      this.source.set('sliders');
      return;
    }
    this.stopMic();
    this.micError.set('');
    this.source.set('simulated');
    if (this.state() === 'idle') this.state.set('listening');
    this.startSimulated();
  }

  private startSimulated() {
    const bands = new Float32Array(ORB_BANDS);
    const target = new Float32Array(ORB_BANDS);
    let level = 0;
    let t = this.paramNumber('t', 0, 0, 1e6);
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt;
      // The same 60 ms / 300 ms envelope the microphone gets.
      level = envelope(level, simulatedVoice(t, target), dt);
      for (let i = 0; i < ORB_BANDS; i++) bands[i] = envelope(bands[i], target[i], dt);
      this.simLevel.set(level);
      this.simBands.set(bands);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stopSimulated() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.simLevel.set(0);
  }

  private stopMic() {
    this.mic()?.stop();
    this.mic.set(null);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  private paramState(): OrbState {
    const s = this.params.get('state');
    return ORB_STATES.find((x) => x === s) ?? 'idle';
  }

  private paramNumber(key: string, fallback: number, min: number, max: number) {
    const raw = this.params.get(key);
    const v = raw === null ? NaN : Number(raw);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  }
}
