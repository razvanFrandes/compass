import { Component, DOCUMENT, DestroyRef, ElementRef, afterRenderEffect, computed, effect, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorArrowUpBold } from '@ng-icons/phosphor-icons/bold';
import { phosphorStopFill } from '@ng-icons/phosphor-icons/fill';
import { phosphorMicrophoneLight } from '@ng-icons/phosphor-icons/light';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmKbdImports } from '@spartan-ng/helm/kbd';
import type { AnswerMode } from '@compass/contracts';
import { JuyoOrb, type OrbState } from '../orb/juyo-orb';
import { ScopeService } from '../scope/scope.service';
import { canSend, initialComposer, step, transcript, type ComposerContext, type ComposerEvent } from './composer-machine';
import { VoiceInput } from './voice/voice-input';

const MODES: { id: AnswerMode; label: string; hint: string }[] = [
  { id: 'quick', label: 'Quick', hint: 'A fast answer from one trusted source' },
  { id: 'thinker', label: 'Thinker', hint: 'Works across several sources; takes longer' },
];
const BANDS = 8;
let nextId = 0;

/*
  Kassandra's composer: the one ask bar of the app (Inbox, Thread, workflow builder, a workflow's page, a board).
  At rest it is quiet, like every composer we studied (docs/research/ui-round3/voice_and_composer.md): 56 px,
  12 px radius, hairline border, the orb as the only colour, a neutral mic, Send only when there is text. Under
  it, one line says what the question is asked for (the hotel scope) and how (Quick or Thinker).
  Voice grows the bar in place; on a phone it opens a full-screen sheet. The words appear while they are spoken
  (Soniox, English and Romanian) and keep adding up through any pause. Voice never sends on its own: the question
  goes when the person taps Send (or presses Enter); Stop or Esc leaves the words in the field, to edit and send.
*/
@Component({
  selector: 'kassandra-composer',
  imports: [NgIcon, JuyoOrb, HlmButtonImports, HlmKbdImports],
  providers: [VoiceInput, provideIcons({ phosphorArrowUpBold, phosphorMicrophoneLight, phosphorStopFill })],
  host: { class: 'block', '(document:keydown.escape)': 'onEscape($event)' },
  template: `
    <form class="ask-field group" [class.ask-field--voice]="voiceOn() && !sheet()" (submit)="$event.preventDefault(); voiceOn() ? sendVoice() : dispatch({ type: 'submit' })">
      @if (!voiceOn() || sheet()) {
        <div class="flex min-h-[54px] items-center gap-2.5 py-1.5 pr-2 pl-3.5 max-sm:min-h-[50px]">
          <!-- At rest the mark is CSS: the WebGL orb exists only while voice is on -->
          <span class="orb-mark shrink-0" [class.orb-mark--busy]="orbState() === 'thinking'" aria-hidden="true"></span>
          <label [for]="inputId()" class="sr-only">{{ label() }}</label>
          <!-- A textarea that grows with its text: a pre-filled question can be long, and on a phone a one-line input shows only its end -->
          <textarea
            #field
            rows="1"
            [id]="inputId()"
            class="ask-textarea placeholder:text-muted-foreground min-w-0 flex-1 resize-none bg-transparent py-1 text-[16px]/[1.45] outline-none sm:text-[15px]/[1.45]"
            [placeholder]="placeholder()"
            [attr.maxlength]="maxLength()"
            [attr.aria-describedby]="state().notice ? noticeId : null"
            autocomplete="off"
            enterkeyhint="send"
            [value]="state().draft"
            (input)="dispatch({ type: 'input', text: $any($event.target).value })"
            (keydown.enter)="onEnter($event)"
          ></textarea>
          @if (shortcut()) {
            <kbd hlmKbd class="hidden group-focus-within:hidden sm:inline-flex">⌘K</kbd>
          }
          <button hlmBtn type="button" variant="ghost" size="icon-sm" class="ask-mic" aria-label="Ask with your voice" (click)="dispatch({ type: 'voice.start' })">
            <ng-icon name="phosphorMicrophoneLight" class="text-[18px]" />
          </button>
          @if (busy() && !(steerable() && hasText())) {
            <button hlmBtn type="button" size="icon-sm" aria-label="Stop Kassandra" (click)="stopped.emit()"><ng-icon name="phosphorStopFill" class="text-[11px]" /></button>
          } @else if (hasText()) {
            <button hlmBtn type="submit" size="icon-sm" class="ask-send" aria-label="Send" [attr.aria-disabled]="sendable() ? null : 'true'" [class.opacity-45]="!sendable()"><ng-icon name="phosphorArrowUpBold" class="text-[14px]" /></button>
          }
        </div>
      } @else {
        <!-- Desktop voice: the bar grows in place and the mark becomes the orb. Stop and Send stay in view. -->
        <div class="flex h-full items-center gap-3 pr-3 pl-2">
          <juyo-orb class="shrink-0" [size]="104" [level]="level()" [bands]="bands()" [state]="orbState()" />
          <div class="min-w-0 flex-1">
            <p class="text-muted-foreground text-[12px] font-medium">{{ statusText() }}</p>
            <!-- Two lines, and always the latest ones: a long question keeps its end in view -->
            <div class="mt-0.5 flex max-h-[44px] flex-col-reverse overflow-hidden">
              <p class="voice-words text-[16px]/[22px]">
                @if (heard() || partial()) {
                  <span>{{ heard() }}</span><span class="text-muted-foreground">{{ partial() }}</span>
                } @else {
                  <span class="text-muted-foreground">Speak your question</span>
                }
              </p>
            </div>
            <p class="voice-hint text-muted-foreground mt-0.5 truncate text-[12px]">{{ voiceHint() }}</p>
          </div>
          <button hlmBtn type="button" variant="outline" size="sm" class="shrink-0 gap-1.5" aria-label="Stop listening" (click)="dispatch({ type: 'voice.stop' })"><ng-icon name="phosphorStopFill" class="text-[11px]" />Stop</button>
          <button #sendBtn hlmBtn type="submit" size="icon-sm" class="ask-send shrink-0" aria-label="Send what I said" [attr.aria-disabled]="heardAnything() ? null : 'true'" [class.opacity-45]="!heardAnything()"><ng-icon name="phosphorArrowUpBold" class="text-[14px]" /></button>
        </div>
      }
    </form>

    <!-- Always in the page, so a screen reader hears voice start and stop -->
    <p class="voice-announcer sr-only" role="status">{{ announcement() }}</p>

    @if (state().notice; as notice) {
      <p [id]="noticeId" class="text-muted-foreground mt-1.5 px-1 text-[12.5px]" role="status">{{ notice }}</p>
    }

    @if (showScope() || showMode()) {
      <div class="mt-2 flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        @if (showScope()) {
          <ul class="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="Hotels this question covers">
            @for (chip of chips(); track chip) {
              <li class="scope-chip max-w-[16rem] truncate">{{ chip }}</li>
            }
          </ul>
        }
        @if (showMode()) {
          <div class="ml-auto flex items-center gap-2.5">
            <span class="text-muted-foreground text-[12px] max-sm:hidden" [id]="hintId">{{ modeHint() }}</span>
            <div class="op-toggle" role="radiogroup" aria-label="Answer mode" [attr.aria-describedby]="hintId">
              @for (m of modes; track m.id) {
                <button type="button" role="radio" [attr.aria-checked]="mode() === m.id" [attr.tabindex]="mode() === m.id ? 0 : -1" [title]="m.hint" (click)="mode.set(m.id)" (keydown)="modeKey($event)">{{ m.label }}</button>
              }
            </div>
          </div>
        }
      </div>
    }

    @if (voiceOn() && sheet()) {
      <!-- Phone voice: a calm full-screen sheet with the controls at the bottom. A native modal dialog sits in the
           top layer, so no stacking context (the docked bar, the tab bar) can cover it; Esc and the Android back
           gesture stop listening (the words stay in the field), and the page behind is inert. -->
      <dialog #sheetDlg class="voice-sheet text-foreground m-0 hidden h-dvh max-h-none w-full max-w-none flex-col border-0 bg-(--background) px-6 pt-[max(24px,env(safe-area-inset-top,0px))] pb-[max(24px,env(safe-area-inset-bottom,0px))] open:flex" aria-label="Voice question" (cancel)="$event.preventDefault(); dispatch({ type: 'voice.stop' })" (close)="voiceOn() && dispatch({ type: 'voice.stop' })">
        <div class="flex flex-1 flex-col items-center justify-center gap-6 pb-[10vh]">
          <juyo-orb [size]="200" [level]="level()" [bands]="bands()" [state]="orbState()" />
          <div class="max-w-[22rem] text-center">
            <p class="text-muted-foreground text-[13px] font-medium" role="status">{{ statusText() }}</p>
            <div class="mt-2 flex max-h-[40dvh] flex-col-reverse overflow-hidden">
              <p class="voice-words text-[20px]/snug font-medium">
                @if (heard() || partial()) {
                  <span>{{ heard() }}</span><span class="text-muted-foreground">{{ partial() }}</span>
                } @else {
                  <span class="text-muted-foreground">Speak your question</span>
                }
              </p>
            </div>
          </div>
        </div>
        <p class="voice-hint text-muted-foreground mb-4 text-center text-[14px]">{{ voiceHint() }}</p>
        <div class="flex items-center justify-between">
          <button hlmBtn type="button" variant="secondary" class="h-14 gap-2 rounded-full px-6 text-[16px]" aria-label="Stop listening" (click)="dispatch({ type: 'voice.stop' })"><ng-icon name="phosphorStopFill" class="text-[14px]" />Stop</button>
          <button hlmBtn type="button" size="icon-lg" class="ask-send size-14 rounded-full" autofocus aria-label="Send what I said" [attr.aria-disabled]="heardAnything() ? null : 'true'" [class.opacity-45]="!heardAnything()" (click)="sendVoice()"><ng-icon name="phosphorArrowUpBold" class="text-[20px]" /></button>
        </div>
      </dialog>
    }
  `,
})
export class KassandraComposer {
  readonly placeholder = input('Ask anything');
  readonly label = input('Ask Kassandra');
  readonly inputId = input<string>(`kassandra-ask-${nextId++}`);
  /** Shows the ⌘K hint (the shell focuses the field with that id). */
  readonly shortcut = input(false);
  /** Kassandra is answering: the orb turns and Stop takes Send's place. */
  readonly busy = input(false);
  /** While busy, text can still be sent (it joins the running answer); Stop shows when the field is empty. */
  readonly steerable = input(false);
  /** False while the connection is down: typing stays possible, sending waits. */
  readonly online = input(true);
  /** Text placed in the field without sending it; a new `n` places it again. */
  readonly prefill = input<{ text: string; n: number } | null>(null);
  /** Quick or Thinker, two-way. Hidden with `showMode` where the host has one model only (the builder). */
  readonly mode = model<AnswerMode>('thinker');
  readonly showMode = input(true);
  /** What the question is asked for. Null shows the global hotel scope. */
  readonly scope = input<readonly string[] | null>(null);
  readonly showScope = input(true);
  readonly maxLength = input<number | null>(null);
  readonly submitted = output<string>();
  readonly stopped = output<void>();

  protected readonly noticeId = `kassandra-notice-${nextId}`;
  protected readonly hintId = `kassandra-mode-${nextId}`;
  protected readonly modes = MODES;

  protected readonly state = signal(initialComposer());
  protected readonly sheet = signal(false);
  protected readonly level = signal(0);
  protected readonly bands = signal<Float32Array | null>(null);

  protected readonly voiceOn = computed(() => this.state().voice !== 'off');
  protected readonly heard = computed(() => this.state().heard);
  protected readonly partial = computed(() => this.state().partial);
  protected readonly heardAnything = computed(() => !!transcript(this.state()));
  protected readonly hasText = computed(() => !!this.state().draft.trim());
  protected readonly sendable = computed(() => canSend(this.context()));
  protected readonly modeHint = computed(() => MODES.find((m) => m.id === this.mode())!.hint);
  /** What a screen reader hears when voice starts and stops. */
  protected readonly announcement = signal('');
  protected readonly voiceHint = computed(() => (this.state().voice === 'listening' ? 'Send when you’re done' : ''));
  protected readonly orbState = computed<OrbState>(() => {
    const voice = this.state().voice;
    if (voice === 'starting' || voice === 'listening') return 'listening';
    return voice === 'sending' || this.busy() ? 'thinking' : 'idle';
  });
  protected readonly statusText = computed(() => {
    const { voice, engine } = this.state();
    if (voice === 'starting') return 'Allow the microphone to talk to Kassandra';
    if (voice === 'sending') return 'Sending…';
    return engine === 'demo' ? 'No microphone found · this is a sample question' : 'Listening…';
  });
  private readonly globalScope = inject(ScopeService);
  protected readonly chips = computed(() => this.scope() ?? [this.globalScope.label()]);

  private readonly doc = inject(DOCUMENT);
  private readonly voice = inject(VoiceInput);
  private readonly field = viewChild<ElementRef<HTMLTextAreaElement>>('field');
  private readonly sendBtn = viewChild<ElementRef<HTMLButtonElement>>('sendBtn');
  private readonly sheetDlg = viewChild<ElementRef<HTMLDialogElement>>('sheetDlg');
  private raf = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.closeVoice());
    let placed = -1;
    effect(() => {
      const prefill = this.prefill();
      if (!prefill || prefill.n === placed) return;
      placed = prefill.n;
      untracked(() => this.dispatch({ type: 'prefill', text: prefill.text }));
    });
    // The field is as tall as its text, or as its placeholder while empty (a long one wraps on a phone).
    afterRenderEffect(() => {
      void [this.state().draft, this.placeholder(), this.voiceOn()];
      this.fit();
    });
    // The phone sheet opens as a modal as soon as it renders.
    afterRenderEffect(() => {
      const dialog = this.sheetDlg()?.nativeElement;
      if (dialog && !dialog.open) dialog.showModal?.();
    });
  }

  focus() {
    const el = this.field()?.nativeElement;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }

  /** Feeds the state machine and carries out what it asks for. */
  protected dispatch(event: ComposerEvent) {
    const before = this.state().voice;
    const { state, effects } = step(this.state(), event, this.context());
    this.state.set(state);
    if (state.voice !== before) {
      if (state.voice === 'listening') this.announcement.set('Listening');
      else if (state.voice === 'off') this.announcement.set(effects.some((effect) => effect.type === 'emit') ? 'Stopped. Sent.' : 'Stopped');
    }
    for (const effect of effects) {
      switch (effect.type) {
        case 'emit':
          this.submitted.emit(effect.text);
          break;
        case 'voice.open':
          this.openVoice();
          break;
        case 'voice.close':
          this.closeVoice();
          break;
        case 'voice.finish':
          this.voice.finish(() => this.dispatch({ type: 'voice.settled' }));
          break;
        case 'focus':
          setTimeout(() => this.focus(), 30);
          break;
      }
    }
  }

  private context(): ComposerContext {
    return { busy: this.busy(), steerable: this.steerable(), online: this.online() };
  }

  /** Enter sends; Shift+Enter starts a new line; an IME composition is left alone. */
  protected onEnter(event: Event) {
    const key = event as KeyboardEvent;
    if (key.shiftKey || key.isComposing) return;
    key.preventDefault();
    this.dispatch({ type: 'submit' });
  }

  /** Send, or Enter, while listening: the only way a voice question is sent. */
  protected sendVoice() {
    if (this.heardAnything()) this.dispatch({ type: 'voice.done' });
  }

  /** Esc stops listening and keeps the words in the field. */
  protected onEscape(event: Event) {
    if (!this.voiceOn()) return;
    event.preventDefault();
    this.dispatch({ type: 'voice.stop' });
  }

  /** Arrow keys move between Quick and Thinker and select, as in any radio group; Home and End jump to the ends. */
  protected modeKey(event: KeyboardEvent) {
    const at = MODES.findIndex((m) => m.id === this.mode());
    const to =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (at + 1) % MODES.length : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (at - 1 + MODES.length) % MODES.length : event.key === 'Home' ? 0 : event.key === 'End' ? MODES.length - 1 : -1;
    if (to < 0) return;
    event.preventDefault();
    this.mode.set(MODES[to]!.id);
    const group = (event.currentTarget as HTMLElement).parentElement;
    setTimeout(() => group?.querySelectorAll<HTMLElement>('[role=radio]')[to]?.focus());
  }

  /** Height follows the text, up to six lines; then it scrolls. */
  private fit() {
    const el = this.field()?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 6 * 22 + 8)}px`;
  }

  private openVoice() {
    this.sheet.set(this.doc.defaultView?.matchMedia?.('(max-width: 640px)').matches ?? false);
    // Focus goes to Send, so Enter sends; Stop is one Shift+Tab away, and Esc always stops.
    setTimeout(() => this.sendBtn()?.nativeElement.focus(), 60);
    void this.voice.start({
      onListening: (engine) => this.dispatch({ type: 'voice.listening', engine }),
      onEngine: (engine) => this.dispatch({ type: 'voice.engine', engine }),
      onTranscript: (final, partial) => this.dispatch({ type: 'voice.transcript', final, partial }),
      onTimeout: () => this.dispatch({ type: 'voice.timeout' }),
      onUnavailable: (message) => this.dispatch({ type: 'voice.unavailable', message }),
    });
    // The orb follows the voice: loudness and spectrum, once per frame, only while voice is on.
    const frame = () => {
      this.level.set(Math.round(this.voice.level() * 100) / 100);
      this.bands.set(Float32Array.from(this.voice.bands(BANDS)));
      this.raf = requestAnimationFrame(frame);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(frame);
  }

  private closeVoice() {
    cancelAnimationFrame(this.raf);
    this.voice.stop();
    this.level.set(0);
    this.bands.set(null);
  }
}
