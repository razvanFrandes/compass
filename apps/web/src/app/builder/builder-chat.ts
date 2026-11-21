import { Component, ElementRef, afterRenderEffect, computed, input, output, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorWarningFill } from '@ng-icons/phosphor-icons/fill';
import { phosphorCaretDownLight, phosphorCheckLight, phosphorCircleNotchLight, phosphorPencilSimpleLight, phosphorXLight } from '@ng-icons/phosphor-icons/light';
import { KassandraComposer } from '../kassandra/kassandra-composer';
import type { ConversationItem } from './builder-steps';

export const STARTERS = [
  'Email me every morning if Lisbon’s pace falls more than 10% behind last year',
  'Every week, email me the hotels priced under their comp set',
  'Email me when a data feed stops syncing at any hotel',
];

/** `**bold**` is the only Markdown the builder's one-line replies use; everything else stays plain text. */
export function richText(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/\*\*(.+?)\*\*/s)
    .map((part, index) => ({ text: part, bold: index % 2 === 1 }))
    .filter((part) => part.text);
}

/** The conversation with the builder agent, and Kassandra's composer (the same one as everywhere, without Quick/Thinker). */
@Component({
  selector: 'app-builder-chat',
  imports: [NgIcon, KassandraComposer],
  providers: [
    provideIcons({ phosphorCaretDownLight, phosphorCheckLight, phosphorCircleNotchLight, phosphorPencilSimpleLight, phosphorWarningFill, phosphorXLight }),
  ],
  host: { class: 'flex min-h-0 flex-col' },
  styles: `
    .wb-starter {
      display: block;
      width: 100%;
      padding: var(--space-stack) var(--space-card-gap);
      border-radius: var(--radius-container, 10px);
      border: 1px solid var(--field-border);
      background: var(--card);
      font-size: 13.5px;
      line-height: 20px;
      text-align: left;
      outline: none;
      transition: border-color 150ms ease, background-color 150ms ease;
    }
    @media (hover: hover) { .wb-starter:hover { border-color: color-mix(in srgb, var(--brand) 55%, transparent); background: var(--field); } }
    .wb-starter:focus-visible { box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring); }
    .wb-steps { outline: none; border-radius: var(--radius-control, 6px); }
    .wb-steps:focus-visible { box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring); }
    .wb-spin { animation: wb-spin 900ms linear infinite; }
    @keyframes wb-spin { to { transform: rotate(360deg); } }
    .wb-caret { transition: transform 150ms ease; }
    @media (prefers-reduced-motion: reduce) {
      .wb-spin { animation: none; }
      .wb-starter, .wb-caret { transition: none; }
    }
  `,
  template: `
    <div #scroller class="min-h-0 flex-1 overflow-y-auto px-page-x max-lg:max-h-[52dvh]" tabindex="0" role="log" aria-label="Conversation with Kassandra" [attr.aria-busy]="running()" (scroll)="onScroll()">
      <div class="max-w-measure mx-auto flex flex-col gap-card-gap py-card-pad text-[14.5px]">
        @if (!items().length) {
          <div class="gen-in flex flex-col gap-card-gap pt-2 lg:pt-section">
            <span class="orb-mark" style="width: 28px; height: 28px" aria-hidden="true"></span>
            <div>
              <h2 class="text-[20px]/7 font-semibold tracking-[-0.015em]">What should this agent watch for you?</h2>
              <p class="text-muted-foreground mt-1.5 text-[14px]/relaxed">Describe it in your own words. Kassandra builds the agent step by step, and you can change any step by hand.</p>
            </div>
            <div>
              <h3 class="card-eyebrow mb-stack">Try one of these</h3>
              <ul class="flex flex-col gap-inline">
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
                          <span class="text-destructive min-w-0">· {{ step.error || 'didn’t work' }}</span>
                        } @else if (step.status === 'running') {
                          <span class="text-muted-foreground">· working…</span>
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

    <div class="shrink-0 px-page-x pt-1 pb-[max(var(--space-card-gap),env(safe-area-inset-bottom,0px))]">
      <!-- A spoken description lands in the field instead of being sent: the person adds what is theirs (an address) first -->
      <kassandra-composer
        class="max-w-measure mx-auto block text-[14.5px]"
        label="Describe the agent, or ask for a change"
        [placeholder]="items().length ? 'Ask for a change…' : 'Describe what to watch…'"
        [busy]="running()"
        [steerable]="true"
        [online]="online()"
        [prefill]="prefill()"
        [showMode]="false"
        [showScope]="false"
        [maxLength]="4000"
        (submitted)="ask.emit($event)"
        (stopped)="stop.emit()"
      />
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

  protected readonly starters = STARTERS;
  /** The starter placed in the composer; a new `n` places it again. */
  protected readonly starter = signal<{ text: string; n: number } | null>(null);
  /** A description to open with ("Watch this" on a brief finding). Only an empty conversation takes it. */
  readonly describe = input<string | null>(null);
  /** What goes in the field: the starter the person picked, else the description the page was opened with. */
  protected readonly prefill = computed(() => {
    const describe = this.describe()?.trim();
    return this.starter() ?? (describe && !this.items().length ? { text: describe, n: 0 } : null);
  });
  private readonly opened = signal<ReadonlySet<string>>(new Set());
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
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
    this.starter.update((current) => ({ text: starter, n: (current?.n ?? 0) + 1 }));
  }
}
