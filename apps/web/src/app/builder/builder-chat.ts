import { Component, ElementRef, afterRenderEffect, computed, input, output, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorArrowUpBold } from '@ng-icons/phosphor-icons/bold';
import { phosphorStopFill, phosphorWarningFill } from '@ng-icons/phosphor-icons/fill';
import { phosphorCaretDownLight, phosphorCheckLight, phosphorCircleNotchLight, phosphorPencilSimpleLight, phosphorXLight } from '@ng-icons/phosphor-icons/light';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import type { ConversationItem } from './builder-steps';

export const STARTERS = [
  "Email me every morning if Lisbon's pace falls more than 10% behind last year",
  'Every week, email me the hotels priced below their comp set',
  'Email me when the morning brief finds stale data at any hotel',
];

/** `**bold**` is the only Markdown the builder's one-line replies use; everything else stays plain text. */
export function richText(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/\*\*(.+?)\*\*/s)
    .map((part, index) => ({ text: part, bold: index % 2 === 1 }))
    .filter((part) => part.text);
}

/** The conversation with the builder agent, and the composer. */
@Component({
  selector: 'app-builder-chat',
  imports: [NgIcon, HlmButtonImports],
  providers: [
    provideIcons({ phosphorArrowUpBold, phosphorCaretDownLight, phosphorCheckLight, phosphorCircleNotchLight, phosphorPencilSimpleLight, phosphorStopFill, phosphorWarningFill, phosphorXLight }),
  ],
  host: { class: 'flex min-h-0 flex-col' },
  styles: `
    .wb-composer {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      min-height: 56px;
      padding: 9px 9px 9px 14px;
      border-radius: 12px;
      border: 1px solid var(--field-border);
      background: var(--field);
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }
    .wb-composer:hover { border-color: var(--field-border-hover); }
    .wb-composer:focus-within { border-color: var(--focus-brand); box-shadow: 0 0 0 3px rgb(153 106 213 / 0.2); }
    .wb-composer textarea { field-sizing: content; min-height: 24px; max-height: 144px; resize: none; }
    .wb-starter {
      display: block;
      width: 100%;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--field-border);
      background: var(--card);
      font-size: 13.5px;
      line-height: 20px;
      text-align: left;
      outline: none;
      transition: border-color 150ms ease, background-color 150ms ease;
    }
    @media (hover: hover) { .wb-starter:hover { border-color: rgb(169 126 230 / 0.55); background: var(--field); } }
    .wb-starter:focus-visible { box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring); }
    .wb-steps { outline: none; border-radius: 6px; }
    .wb-steps:focus-visible { box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring); }
    .wb-spin { animation: wb-spin 900ms linear infinite; }
    @keyframes wb-spin { to { transform: rotate(360deg); } }
    .wb-caret { transition: transform 150ms ease; }
    @media (prefers-reduced-motion: reduce) {
      .wb-spin { animation: none; }
      .wb-composer, .wb-starter, .wb-caret { transition: none; }
    }
  `,
  template: `
    <div #scroller class="min-h-0 flex-1 overflow-y-auto px-4 max-lg:max-h-[52dvh]" tabindex="0" role="log" aria-label="Conversation with Kassandra" [attr.aria-busy]="running()" (scroll)="onScroll()">
      <div class="mx-auto flex max-w-[620px] flex-col gap-4 py-5">
        @if (!items().length) {
          <div class="gen-in flex flex-col gap-4 pt-2 lg:pt-8">
            <span class="orb-mark" style="width: 28px; height: 28px" aria-hidden="true"></span>
            <div>
              <h2 class="text-[20px]/7 font-semibold tracking-[-0.015em]">What should Compass watch for you?</h2>
              <p class="text-muted-foreground mt-1.5 text-[14px]/relaxed">Describe it in your own words. Kassandra builds the workflow step by step, and you can change any step by hand.</p>
            </div>
            <div>
              <h3 class="card-eyebrow mb-2">Try one of these</h3>
              <ul class="flex flex-col gap-2">
                @for (starter of starters; track starter) {
                  <li><button type="button" class="wb-starter" (click)="useStarter(starter)">{{ starter }}</button></li>
                }
              </ul>
            </div>
          </div>
        }

        @for (item of items(); track item.key) {
          @switch (item.kind) {
            @case ('user') {
              <div class="gen-in ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-(--field) px-3.5 py-2 text-[14px]/relaxed whitespace-pre-wrap">
                <span class="sr-only">You: </span>{{ item.text }}
              </div>
            }
            @case ('steps') {
              <div class="gen-in text-[13px]">
                <button type="button" class="wb-steps text-muted-foreground hover:text-foreground flex w-full items-start gap-2 text-left transition-colors" [attr.aria-expanded]="isOpen(item.key)" (click)="toggle(item.key)">
                  @if (item.running) {
                    <ng-icon name="phosphorCircleNotchLight" class="wb-spin mt-0.5 shrink-0 text-[15px] text-(--brand)" aria-hidden="true" />
                  } @else {
                    <ng-icon name="phosphorCheckLight" class="mt-0.5 shrink-0 text-[15px]" aria-hidden="true" />
                  }
                  <span class="min-w-0 flex-1" [class.line-clamp-2]="!isOpen(item.key)">
                    <span class="sr-only">{{ item.running ? 'Kassandra is working: ' : 'Kassandra did: ' }}</span>{{ item.summary }}{{ item.running ? ' …' : '' }}
                  </span>
                  <ng-icon name="phosphorCaretDownLight" class="wb-caret mt-0.5 shrink-0 text-[14px]" [class.rotate-180]="isOpen(item.key)" aria-hidden="true" />
                </button>
                @if (isOpen(item.key)) {
                  <ol class="border-border mt-2 ml-[7px] flex flex-col gap-1.5 border-l pl-4">
                    @for (step of item.steps; track step.callId) {
                      <li class="flex items-baseline gap-2">
                        <span class="text-foreground shrink-0">{{ step.label }}</span>
                        @if (step.detail) {
                          <span class="text-muted-foreground min-w-0 truncate">{{ step.detail }}</span>
                        }
                        @if (step.status === 'error') {
                          <span class="text-destructive min-w-0">· {{ step.error || 'did not work' }}</span>
                        } @else if (step.status === 'running') {
                          <span class="text-muted-foreground">· working</span>
                        }
                      </li>
                    }
                  </ol>
                }
              </div>
            }
            @case ('assistant') {
              <p class="text-[14px]/relaxed whitespace-pre-wrap" [class.gen-in]="!item.streaming">
                <span class="sr-only">Kassandra: </span>@for (part of rich(item.text); track $index) {<span [class.font-semibold]="part.bold">{{ part.text }}</span>}
              </p>
            }
            @case ('note') {
              <p class="text-muted-foreground gen-in flex items-center gap-2 text-[12.5px]">
                <ng-icon name="phosphorPencilSimpleLight" class="shrink-0 text-[14px]" aria-hidden="true" />{{ item.text }}
              </p>
            }
            @case ('failure') {
              <p class="gen-in flex items-start gap-2 text-[13.5px]/relaxed">
                <ng-icon name="phosphorWarningFill" class="mt-0.5 shrink-0 text-[15px] text-(--decision)" aria-hidden="true" />{{ item.text }}
              </p>
            }
          }
        }

        @if (thinking()) {
          <p class="text-muted-foreground flex items-center gap-2 text-[13px]">
            <span class="orb-mark orb-mark--busy shrink-0" aria-hidden="true"></span>Kassandra is thinking…
          </p>
        }
      </div>
    </div>

    <div class="shrink-0 px-4 pt-1 pb-[max(16px,env(safe-area-inset-bottom,0px))]">
      <form class="wb-composer mx-auto max-w-[620px]" (submit)="$event.preventDefault(); send()">
        <label class="sr-only" [for]="fieldId">Describe the workflow, or ask for a change</label>
        <textarea
          #field
          [id]="fieldId"
          rows="1"
          class="placeholder:text-muted-foreground min-w-0 flex-1 self-center bg-transparent text-[16px]/6 outline-none sm:text-[15px]/6"
          enterkeyhint="send"
          maxlength="4000"
          [placeholder]="items().length ? 'Ask for a change…' : 'Describe a workflow…'"
          [value]="text()"
          (input)="text.set($any($event.target).value)"
          (keydown.enter)="onEnter($event)"
        ></textarea>
        @if (running()) {
          <button hlmBtn type="button" variant="secondary" size="icon" aria-label="Stop Kassandra" (click)="stop.emit()"><ng-icon name="phosphorStopFill" class="text-[12px]" /></button>
        }
        <button hlmBtn type="submit" size="icon" aria-label="Send" [attr.aria-disabled]="canSend() ? null : 'true'" [class.opacity-45]="!canSend()">
          <ng-icon name="phosphorArrowUpBold" class="text-[15px]" />
        </button>
      </form>
    </div>
  `,
})
export class BuilderChat {
  readonly items = input.required<ConversationItem[]>();
  readonly running = input(false);
  /** False while the socket is down: typing stays possible, sending waits. */
  readonly online = input(true);
  readonly ask = output<string>();
  readonly stop = output<void>();

  private static next = 0;
  protected readonly fieldId = `wb-composer-${BuilderChat.next++}`;
  protected readonly starters = STARTERS;
  protected readonly text = signal('');
  private readonly opened = signal<ReadonlySet<string>>(new Set());
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly field = viewChild.required<ElementRef<HTMLTextAreaElement>>('field');

  protected readonly canSend = computed(() => this.online() && this.text().trim().length > 0);
  /** Running, with nothing on screen for it yet: no step in progress and no text being written. */
  protected readonly thinking = computed(() => {
    if (!this.running()) return false;
    const last = this.items().at(-1);
    return !(last && ((last.kind === 'steps' && last.running) || (last.kind === 'assistant' && last.streaming)));
  });

  constructor() {
    // Follow the conversation while the person is at its end; leave them alone when they scrolled up to read.
    afterRenderEffect({
      write: () => {
        this.items();
        this.thinking();
        const el = this.scroller().nativeElement;
        if (this.pinned) el.scrollTop = el.scrollHeight;
      },
    });
  }

  private pinned = true;
  protected onScroll() {
    const el = this.scroller().nativeElement;
    this.pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  protected rich = richText;

  protected isOpen(key: string) {
    return this.opened().has(key);
  }

  protected toggle(key: string) {
    this.opened.update((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  /** A starter fills the composer instead of sending: the person adds what is theirs (an address) and presses send. */
  protected useStarter(starter: string) {
    this.text.set(starter);
    const field = this.field().nativeElement;
    field.value = starter;
    field.focus();
    field.setSelectionRange(starter.length, starter.length);
  }

  protected onEnter(event: Event) {
    const key = event as KeyboardEvent;
    if (key.shiftKey || key.isComposing) return;
    key.preventDefault();
    this.send();
  }

  protected send() {
    const text = this.text().trim();
    if (!text || !this.online()) return;
    this.ask.emit(text);
    this.text.set('');
    this.field().nativeElement.value = '';
  }
}
