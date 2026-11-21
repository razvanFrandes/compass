import { Component, DOCUMENT, DestroyRef, ElementRef, afterRenderEffect, computed, effect, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorArrowUpBold } from '@ng-icons/phosphor-icons/bold';
import { phosphorStopFill } from '@ng-icons/phosphor-icons/fill';
import { phosphorBrainLight, phosphorCaretDownLight, phosphorLightbulbLight, phosphorLightningLight, phosphorMicrophoneLight, phosphorNewspaperLight } from '@ng-icons/phosphor-icons/light';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmKbdImports } from '@spartan-ng/helm/kbd';
import type { AnswerMode } from '@compass/contracts';
import { ASK_GROUPS, FEATURED_ASKS, KIND_NAMES, type AskExample } from '../charts/ask-examples';
import { KIND_ICONS, KIND_ICON_SET } from '../charts/kind-icons';
import { JuyoOrb, type OrbState } from '../orb/juyo-orb';
import { ScopeSwitcher } from '../scope/scope-switcher';
import { canSend, initialComposer, step, transcript, type ComposerContext, type ComposerEvent } from './composer-machine';
import { VoiceInput } from './voice/voice-input';

/** The effort Kassandra puts into an answer: the composer's model picker. */
export const EFFORTS: readonly { id: AnswerMode; label: string; hint: string; icon: string }[] = [
  { id: 'quick', label: 'Quick', hint: 'Answers in seconds', icon: 'phosphorLightningLight' },
  { id: 'thinker', label: 'Thinker', hint: 'Checks more sources, takes longer', icon: 'phosphorBrainLight' },
];
const BANDS = 8;
/** "Try asking" in the Prompts menu: three examples, and the whole gallery one item away. */
const EXAMPLE_COUNT = ASK_GROUPS.reduce((total, group) => total + group.items.length, 0);
let nextId = 0;

/*
  Kassandra's composer: the one ask bar of the app (Inbox, Thread, workflow builder, a workflow's page, a board).
  Two rows in one field: the question on top, with the Lattice orb as the mark (sharing one WebGL context with
  every other orb on the page); under it, on the left, "Prompts" (questions about today's brief and examples that
  show off each kind of answer) and the hotel scope; on the right, the effort (Quick or Thinker, a model picker),
  the mic and Send. A light runs round the border only while Kassandra works (listening, thinking, writing); at
  rest the field has a still, faint glow. A prompt fills the field and waits: nothing is ever sent but by Send.
  Voice grows the bar in place; on a phone it opens a full-screen sheet. The words appear while they are spoken
  (Soniox, English and Romanian) and keep adding up through any pause. Voice never sends on its own: the question
  goes when the person taps Send (or presses Enter); Stop or Esc leaves the words in the field, to edit and send.
*/
@Component({
  selector: 'kassandra-composer',
  imports: [NgIcon, JuyoOrb, ScopeSwitcher, HlmButtonImports, HlmDropdownMenuImports, HlmKbdImports],
  providers: [
    VoiceInput,
    provideIcons({ ...KIND_ICON_SET, phosphorArrowUpBold, phosphorBrainLight, phosphorCaretDownLight, phosphorLightbulbLight, phosphorLightningLight, phosphorMicrophoneLight, phosphorNewspaperLight, phosphorStopFill }),
  ],
  host: { class: 'block', '(document:keydown.escape)': 'onEscape($event)' },
  template: `
    <form
      class="ask-field group"
      [class.ask-field--voice]="voiceOn() && !sheet()"
      [class.ask-field--large]="size() === 'large'"
      [attr.data-working]="working() ? '' : null"
      (submit)="$event.preventDefault(); voiceOn() ? sendVoice() : dispatch({ type: 'submit' })"
    >
      @if (!voiceOn() || sheet()) {
        <div class="ask-top flex items-start gap-2.5 pt-2.5 pr-3 pl-3">
          <!-- The mark is the Lattice orb, 32 px: it breathes at rest, winds while Kassandra thinks and sends rings while she writes -->
          <juyo-orb class="-my-px shrink-0" [size]="32" [state]="orbState()" />
          <label [for]="inputId()" class="sr-only">{{ label() }}</label>
          <!-- A textarea that grows with its text: a pre-filled question can be long, and on a phone a one-line input shows only its end -->
          <textarea
            #field
            rows="1"
            [id]="inputId()"
            class="ask-textarea placeholder:text-muted-foreground min-w-0 flex-1 resize-none bg-transparent py-[5px] text-[16px]/[1.45] outline-none sm:text-[15px]/[1.45]"
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
            <kbd hlmKbd class="mt-1.5 hidden group-focus-within:hidden sm:inline-flex">⌘K</kbd>
          }
        </div>
        <div #bar class="ask-bar flex min-w-0 items-center gap-1 pt-1 pr-2 pb-2 pl-2">
          @if (showPrompts()) {
            <button type="button" class="ask-tool" [hlmDropdownMenuTrigger]="promptsMenu" [side]="menuSide()" align="start" aria-haspopup="menu">
              <ng-icon name="phosphorLightbulbLight" class="text-[16px]" aria-hidden="true" />
              <span class="max-sm:sr-only">Prompts</span>
              <ng-icon name="phosphorCaretDownLight" class="ask-caret text-[11px]" aria-hidden="true" />
            </button>
          }
          @if (showScope()) {
            <!-- The hotel scope goes with every question; on a phone it is in the top bar -->
            <app-scope-switcher class="ask-scope min-w-0 max-sm:hidden" />
          }
          <span class="min-w-0 flex-1"></span>
          @if (showMode()) {
            <button type="button" class="ask-tool ask-effort" [hlmDropdownMenuTrigger]="effortMenu" [side]="menuSide()" align="end" aria-haspopup="menu" [attr.aria-label]="'Kassandra · ' + effort().label + '. Effort: change'">
              <span class="text-muted-foreground max-sm:hidden" aria-hidden="true">Kassandra · </span>
              <span aria-hidden="true">{{ effort().label }}</span>
              <ng-icon name="phosphorCaretDownLight" class="ask-caret text-[11px]" aria-hidden="true" />
            </button>
          }
          <button hlmBtn type="button" variant="ghost" size="icon-sm" class="ask-mic" aria-label="Ask with your voice" (click)="dispatch({ type: 'voice.start' })">
            <ng-icon name="phosphorMicrophoneLight" class="text-[18px]" />
          </button>
          @if (busy() && !(steerable() && hasText())) {
            <button hlmBtn type="button" size="icon-sm" aria-label="Stop Kassandra" (click)="stopped.emit()"><ng-icon name="phosphorStopFill" class="text-[11px]" /></button>
          } @else {
            <button hlmBtn type="submit" size="icon-sm" class="ask-send" aria-label="Send" [attr.aria-disabled]="sendable() && hasText() ? null : 'true'" [class.ask-send--idle]="!(sendable() && hasText())"><ng-icon name="phosphorArrowUpBold" class="text-[14px]" /></button>
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

    <ng-template #promptsMenu>
      <hlm-dropdown-menu class="ask-menu w-[min(26rem,calc(100vw-24px))]" [sideOffset]="menuOffset()">
        @if (briefPrompts().length) {
          <hlm-dropdown-menu-group [attr.aria-labelledby]="uid + '-brief'">
            <hlm-dropdown-menu-label [id]="uid + '-brief'">About today’s brief</hlm-dropdown-menu-label>
            @for (q of briefPrompts(); track q) {
              <button hlmDropdownMenuItem class="ask-prompt" (triggered)="choose(q)">
                <span class="ask-prompt-icon"><ng-icon name="phosphorNewspaperLight" aria-hidden="true" /></span><span class="min-w-0 flex-1">{{ q }}</span>
              </button>
            }
          </hlm-dropdown-menu-group>
          <hlm-dropdown-menu-separator />
        }
        <hlm-dropdown-menu-group [attr.aria-labelledby]="uid + '-try'">
          <hlm-dropdown-menu-label [id]="uid + '-try'">Try asking</hlm-dropdown-menu-label>
          @for (e of examples(); track e.question) {
            <button hlmDropdownMenuItem class="ask-prompt" (triggered)="choose(e.question)">
              <span class="ask-prompt-icon"><ng-icon [name]="iconOf(e)" aria-hidden="true" /></span><span class="min-w-0 flex-1">{{ e.question }}<span class="sr-only"> (answers with {{ nameOf(e) }})</span></span>
            </button>
          }
        </hlm-dropdown-menu-group>
        <hlm-dropdown-menu-separator />
        <button hlmDropdownMenuCheckbox class="ask-prompt-more" [checked]="allExamples()" (triggered)="allExamples.set(!allExamples())">
          All {{ exampleCount }} examples<ng-icon name="phosphorCaretDownLight" class="ask-caret ms-auto text-[11px]" aria-hidden="true" />
        </button>
      </hlm-dropdown-menu>
    </ng-template>

    <ng-template #effortMenu>
      <hlm-dropdown-menu class="ask-menu w-72" [sideOffset]="menuOffset()">
        <hlm-dropdown-menu-group [attr.aria-labelledby]="uid + '-effort'">
          <hlm-dropdown-menu-label [id]="uid + '-effort'">Effort</hlm-dropdown-menu-label>
          @for (m of efforts; track m.id) {
            <button hlmDropdownMenuRadio class="ask-effort-item" [checked]="mode() === m.id" [keepOpen]="false" (triggered)="mode.set(m.id)">
              <ng-icon [name]="m.icon" class="text-[16px]" aria-hidden="true" />
              <span class="min-w-0 flex-1 text-left">
                <span class="block text-[13px] font-medium">{{ m.label }}</span>
                <span class="text-muted-foreground block text-[12px]">{{ m.hint }}</span>
              </span>
              <hlm-dropdown-menu-radio-indicator />
            </button>
          }
        </hlm-dropdown-menu-group>
      </hlm-dropdown-menu>
    </ng-template>

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
  /** What Kassandra is doing while busy (the live phase): 'writing' turns the orb to speaking. */
  readonly phase = input<string | null | undefined>(null);
  /** While busy, text can still be sent (it joins the running answer); Stop shows when the field is empty. */
  readonly steerable = input(false);
  /** False while the connection is down: typing stays possible, sending waits. */
  readonly online = input(true);
  /** Text placed in the field without sending it; a new `n` places it again. */
  readonly prefill = input<{ text: string; n: number } | null>(null);
  /** Quick or Thinker, two-way. Hidden with `showMode` where the host has one model only (the builder). */
  readonly mode = model<AnswerMode>('thinker');
  readonly showMode = input(true);
  /** The Prompts menu: questions about today's brief and examples. */
  readonly showPrompts = input(true);
  /** The hotel scope button. Off where the question is not about the scope (the agent builder). */
  readonly showScope = input(true);
  /** Questions about today's brief, the first group of the Prompts menu (none: the group is left out). */
  readonly briefPrompts = input<readonly string[]>([]);
  /** Large on the Inbox's start page: a taller field and larger text. */
  readonly size = input<'regular' | 'large'>('regular');
  /** Docked at the bottom of the page: its menus open upward. */
  readonly docked = input(false);
  readonly maxLength = input<number | null>(null);
  readonly submitted = output<string>();
  readonly stopped = output<void>();

  protected readonly uid = `kassandra-composer-${nextId}`;
  protected readonly noticeId = `kassandra-notice-${nextId}`;
  protected readonly efforts = EFFORTS;
  protected readonly effort = computed(() => EFFORTS.find((e) => e.id === this.mode()) ?? EFFORTS[1]!);
  /** How far down the field the bottom row sits: a docked menu opens upward clear of the whole field. */
  private readonly barTop = signal(0);
  /** The menus' offset from their button, in 4 px steps (the menu's unit): docked, up past the question being typed. */
  protected readonly menuOffset = computed(() => (this.docked() ? Math.ceil((this.barTop() + 10) / 4) : 1));
  protected readonly menuSide = computed(() => (this.docked() ? 'top' : 'bottom'));
  protected readonly exampleCount = EXAMPLE_COUNT;
  /** The Prompts menu shows three examples until "All N examples" is checked. */
  protected readonly allExamples = signal(false);
  protected readonly examples = computed<readonly AskExample[]>(() => (this.allExamples() ? ASK_GROUPS.flatMap((group) => group.items) : FEATURED_ASKS));
  protected iconOf(example: AskExample): string {
    return KIND_ICONS[example.kind];
  }
  protected nameOf(example: AskExample): string {
    return KIND_NAMES[example.kind];
  }

  protected readonly state = signal(initialComposer());
  protected readonly sheet = signal(false);
  protected readonly level = signal(0);
  protected readonly bands = signal<Float32Array | null>(null);

  protected readonly voiceOn = computed(() => this.state().voice !== 'off');
  /** Kassandra is at work (listening, thinking or writing): the light runs round the border. */
  protected readonly working = computed(() => this.voiceOn() || this.busy());
  protected readonly heard = computed(() => this.state().heard);
  protected readonly partial = computed(() => this.state().partial);
  protected readonly heardAnything = computed(() => !!transcript(this.state()));
  protected readonly hasText = computed(() => !!this.state().draft.trim());
  protected readonly sendable = computed(() => canSend(this.context()));
  /** What a screen reader hears when voice starts and stops. */
  protected readonly announcement = signal('');
  protected readonly voiceHint = computed(() => (this.state().voice === 'listening' ? 'Send when you’re done' : ''));
  protected readonly orbState = computed<OrbState>(() => {
    const voice = this.state().voice;
    if (voice === 'starting' || voice === 'listening') return 'listening';
    if (voice === 'sending') return 'thinking';
    if (!this.busy()) return 'idle';
    return this.phase() === 'writing' ? 'speaking' : 'thinking';
  });
  protected readonly statusText = computed(() => {
    const { voice, engine } = this.state();
    if (voice === 'starting') return 'Allow the microphone to talk to Kassandra';
    if (voice === 'sending') return 'Sending…';
    return engine === 'demo' ? 'No microphone found · this is a sample question' : 'Listening…';
  });

  private readonly doc = inject(DOCUMENT);
  private readonly voice = inject(VoiceInput);
  private readonly field = viewChild<ElementRef<HTMLTextAreaElement>>('field');
  private readonly bar = viewChild<ElementRef<HTMLElement>>('bar');
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
      void [this.state().draft, this.placeholder(), this.voiceOn(), this.size()];
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

  /** A prompt fills the field and waits for Send: it is never sent on its own. */
  protected choose(question: string) {
    this.dispatch({ type: 'prefill', text: question });
  }

  /** Height follows the text, up to six lines; then it scrolls. */
  private fit() {
    const el = this.field()?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 6 * 22 + 8)}px`;
    this.barTop.set(this.bar()?.nativeElement.offsetTop ?? 0);
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
