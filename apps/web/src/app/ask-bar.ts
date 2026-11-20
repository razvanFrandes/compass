import { Component, DOCUMENT, DestroyRef, ElementRef, afterRenderEffect, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmKbdImports } from '@spartan-ng/helm/kbd';
import { KassandraOrb } from './orb';
import { phosphorArrowUpBold, phosphorMicrophoneLight, phosphorStopFill, phosphorXLight } from './icons';

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  abort(): void;
}

type VoiceState = 'off' | 'asking' | 'listening' | 'sending' | 'blocked';
const DEMO_PHRASE = 'Which nights next month are furthest behind last year?';

/*
  Ask bar (research: docs/research/ui-round3/voice_and_composer.md).
  At rest it is quiet, like every composer we studied (23 on Mobbin, none with a gradient):
  56 px, 12 px radius, one surface step lighter than the page, hairline border, neutral mic, send only when there
  is text, a static purple focus ring. The Kassandra gradient lives only in the 18 px orb mark.
  Voice expands the bar in place (Gemini Live, ChatGPT in-chat voice); on phones it opens a full-screen sheet.
*/
@Component({
  selector: 'app-ask-bar',
  imports: [NgIcon, KassandraOrb, HlmButtonImports, HlmKbdImports],
  providers: [provideIcons({ phosphorArrowUpBold, phosphorMicrophoneLight, phosphorStopFill, phosphorXLight })],
  host: { class: 'block', '(keydown.escape)': 'cancel()' },
  template: `
    <form
      class="ask-field group"
      [class.ask-field--voice]="voice() !== 'off' && !sheet()"
      (submit)="$event.preventDefault(); voice() === 'off' ? send() : finish()"
    >
      @if (voice() === 'off' || sheet()) {
        <div class="flex h-full items-center gap-2.5 pr-2 pl-3.5">
          <span class="orb-mark shrink-0" [class.orb-mark--busy]="busy()" aria-hidden="true"></span>
          <label [for]="inputId()" class="sr-only">{{ label() }}</label>
          <input
            #field
            [id]="inputId()"
            class="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-[16px] outline-none sm:text-[15px]"
            [placeholder]="placeholder()"
            autocomplete="off"
            enterkeyhint="send"
            [value]="draft()"
            (input)="draft.set($any($event.target).value)"
          />
          @if (shortcut()) {
            <kbd hlmKbd class="hidden group-focus-within:hidden sm:inline-flex">⌘K</kbd>
          }
          <button hlmBtn type="button" variant="ghost" size="icon-sm" class="ask-mic" aria-label="Ask with your voice" (click)="startVoice()">
            <ng-icon name="phosphorMicrophoneLight" class="text-[18px]" />
          </button>
          @if (busy()) {
            <button hlmBtn type="button" size="icon-sm" aria-label="Stop" (click)="stopped.emit()"><ng-icon name="phosphorStopFill" class="text-[11px]" /></button>
          } @else if (draft().trim()) {
            <button hlmBtn type="submit" size="icon-sm" class="ask-send" aria-label="Send"><ng-icon name="phosphorArrowUpBold" class="text-[14px]" /></button>
          }
        </div>
      } @else {
        <!-- Desktop voice: the bar grows in place; the mark becomes the orb -->
        <div class="flex h-full items-center gap-3 pr-3 pl-2">
          <app-kassandra-orb class="size-[104px] shrink-0" [levelSource]="levelFn" [active]="voice() === 'listening'" />
          <div class="min-w-0 flex-1">
            <p class="text-muted-foreground text-[12px] font-medium" role="status">{{ statusText() }}</p>
            <p class="mt-0.5 line-clamp-2 text-[16px]/snug" [class.text-muted-foreground]="!transcript()">{{ transcript() || 'Speak your question' }}</p>
          </div>
          <button #cancelBtn hlmBtn type="button" variant="ghost" size="icon-sm" aria-label="Cancel voice input" (click)="cancel()"><ng-icon name="phosphorXLight" class="text-[18px]" /></button>
          <button hlmBtn type="submit" size="icon-sm" class="ask-send" aria-label="Send what I said" [disabled]="!transcript().trim()"><ng-icon name="phosphorArrowUpBold" class="text-[14px]" /></button>
        </div>
      }
    </form>

    @if (voice() !== 'off' && sheet()) {
      <!-- Phone voice: a calm full-screen sheet, controls at the bottom. A native modal dialog sits in the
           top layer, so no parent stacking context (the docked bar, the tab bar) can cover it; Esc and the
           Android back gesture cancel it, and the page behind is inert. -->
      <dialog #sheetDlg class="voice-sheet text-foreground m-0 hidden h-dvh max-h-none w-full max-w-none flex-col border-0 bg-(--background) px-6 pt-[max(24px,env(safe-area-inset-top,0px))] pb-[max(24px,env(safe-area-inset-bottom,0px))] open:flex" aria-label="Voice question" (cancel)="$event.preventDefault(); cancel()" (close)="voice() !== 'off' && cancel()">
        <div class="flex flex-1 flex-col items-center justify-center gap-6 pb-[10vh]">
          <app-kassandra-orb class="size-[200px]" [levelSource]="levelFn" [active]="voice() === 'listening'" />
          <div class="max-w-[22rem] text-center">
            <p class="text-muted-foreground text-[13px] font-medium" role="status">{{ statusText() }}</p>
            <p class="mt-2 text-[20px]/snug font-medium" [class.text-muted-foreground]="!transcript()">{{ transcript() || 'Speak your question' }}</p>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <button hlmBtn type="button" variant="secondary" size="icon-lg" class="size-14 rounded-full" aria-label="Cancel voice input" (click)="cancel()"><ng-icon name="phosphorXLight" class="text-[22px]" /></button>
          <button hlmBtn type="button" size="icon-lg" class="ask-send size-14 rounded-full" aria-label="Send what I said" [disabled]="!transcript().trim()" (click)="finish()"><ng-icon name="phosphorArrowUpBold" class="text-[20px]" /></button>
        </div>
      </dialog>
    }
  `,
})
export class AskBar {
  readonly placeholder = input('Ask anything');
  readonly label = input('Ask Compass');
  readonly inputId = input<string>(`ask-${Math.random().toString(36).slice(2, 7)}`);
  readonly shortcut = input(false);
  readonly busy = input(false);
  readonly submitted = output<string>();
  readonly stopped = output<void>();

  protected readonly draft = signal('');
  protected readonly voice = signal<VoiceState>('off');
  protected readonly transcript = signal('');
  protected readonly demo = signal(false);
  protected readonly sheet = signal(false);
  protected readonly statusText = computed(() => {
    switch (this.voice()) {
      case 'asking':
        return 'Allow the microphone to talk to Kassandra';
      case 'sending':
        return 'Sending…';
      case 'blocked':
        return 'Microphone not available here · demo voice';
      default:
        return this.demo() ? 'Listening… · demo transcript' : 'Listening…';
    }
  });

  /** The orb reads this every frame. */
  protected readonly levelFn = () => this.level;
  private level = 0;

  private readonly doc = inject(DOCUMENT);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  private readonly cancelBtn = viewChild<ElementRef<HTMLButtonElement>>('cancelBtn');
  private stream?: MediaStream;
  private audio?: AudioContext;
  private raf = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private recognition?: SpeechRecognitionLike;

  private readonly sheetDlg = viewChild<ElementRef<HTMLDialogElement>>('sheetDlg');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.teardown());
    // Open the phone sheet as a modal as soon as it renders.
    afterRenderEffect(() => {
      const d = this.sheetDlg()?.nativeElement;
      if (d && !d.open) d.showModal();
    });
  }

  focus() {
    this.field()?.nativeElement.focus();
  }

  protected send() {
    const q = this.draft().trim();
    if (!q || this.busy()) return;
    this.draft.set('');
    this.submitted.emit(q);
  }

  async startVoice() {
    if (this.voice() !== 'off') return;
    this.sheet.set(this.doc.defaultView?.matchMedia('(max-width: 640px)').matches ?? false);
    this.transcript.set('');
    this.demo.set(false);
    this.voice.set('asking');
    setTimeout(() => this.cancelBtn()?.nativeElement.focus(), 60);
    try {
      // getUserMedia and AudioContext.resume() run inside the click (autoplay rules).
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      this.audio = new AudioContext();
      await this.audio.resume();
      const analyser = this.audio.createAnalyser();
      analyser.fftSize = 1024;
      this.audio.createMediaStreamSource(this.stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      this.voice.set('listening');
      let last = performance.now();
      const loop = (now: number) => {
        const dt = (now - last) / 1000;
        last = now;
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const db = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-8);
        const target = Math.min(1, Math.max(0, (db + 55) / 40));
        // Fast attack (60 ms), slow release (300 ms), frame-rate independent.
        const tau = target > this.level ? 0.06 : 0.3;
        this.level += (target - this.level) * (1 - Math.exp(-dt / tau));
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
      this.startRecognition();
    } catch {
      this.voice.set('blocked');
      this.runDemo();
    }
  }

  private startRecognition() {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!SR) {
      this.typeDemo();
      return;
    }
    const r = new SR();
    r.lang = 'en-US';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      this.transcript.set(text);
    };
    // Ends after a pause in speech: send, like Google voice search.
    r.onend = () => this.finish();
    r.onerror = () => this.typeDemo();
    this.recognition = r;
    r.start();
  }

  /** No microphone (e.g. a sandboxed preview): a believable voice level and a sample question, clearly labelled. */
  private runDemo() {
    let t = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      t += dt;
      const speaking = this.transcript().length > 0 && this.transcript().length < DEMO_PHRASE.length;
      const target = speaking ? Math.max(0, 0.45 + 0.35 * Math.sin(t * 9) * Math.sin(t * 2.3)) : 0;
      const tau = target > this.level ? 0.06 : 0.3;
      this.level += (target - this.level) * (1 - Math.exp(-dt / tau));
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.timers.push(setTimeout(() => this.voice() === 'blocked' && this.voice.set('listening'), 1400));
    this.typeDemo(1400);
  }

  private typeDemo(delay = 0) {
    this.demo.set(true);
    let i = 0;
    const step = () => {
      i += 2;
      this.transcript.set(DEMO_PHRASE.slice(0, i));
      if (i < DEMO_PHRASE.length) this.timers.push(setTimeout(step, 65));
      else this.timers.push(setTimeout(() => this.finish(), 1200));
    };
    this.timers.push(setTimeout(step, delay));
  }

  /** Stop listening and send what was heard. */
  finish() {
    if (this.voice() === 'off' || this.voice() === 'sending') return;
    const text = this.transcript().trim();
    if (!text) return this.cancel();
    this.voice.set('sending');
    if (this.recognition) {
      this.recognition.onend = null;
      this.recognition.abort();
      this.recognition = undefined;
    }
    this.timers.push(
      setTimeout(() => {
        this.teardown();
        this.submitted.emit(text);
      }, 280),
    );
  }

  cancel() {
    if (this.voice() === 'off') return;
    this.teardown();
    setTimeout(() => this.focus());
  }

  private teardown() {
    this.voice.set('off');
    cancelAnimationFrame(this.raf);
    this.timers.forEach(clearTimeout);
    this.timers = [];
    if (this.recognition) {
      this.recognition.onend = null;
      this.recognition.abort();
    }
    this.recognition = undefined;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.audio?.close().catch(() => undefined);
    this.audio = undefined;
    this.level = 0;
  }
}
