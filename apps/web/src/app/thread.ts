import { Component, ElementRef, afterRenderEffect, computed, inject, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import type { AnswerMode } from '@compass/contracts';
import { AskBar } from './ask-bar';
import { ChatTurnView, usageText } from './chat-turn';
import { EvidencePanel } from './evidence-panel';
import { Live } from './live';
import { CompassStore } from './store';
import * as icons from './icons';

/*
  The thread is a live conversation with Kassandra (KassandraChat over WebSocket): the question, the work
  collapsed to one line, the answer streaming in, and on the right "How this was computed" from the evidence
  every data tool returns. Quick answers from governed metrics; Thinker reasons across every source.
  Explore, /ask?q= and chart drills only fill the composer: nothing is sent until the person sends it.
*/
@Component({
  selector: 'app-thread',
  imports: [NgIcon, AskBar, ChatTurnView, EvidencePanel, HlmButtonImports],
  providers: [provideIcons({ ...icons })],
  host: { class: 'flex h-full min-h-0' },
  template: `
    <div class="grid min-h-0 w-full grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(380px,1fr)_minmax(0,0.9fr)]">
      <section class="flex min-h-0 min-w-0 flex-col" aria-label="Conversation">
        <header class="border-border/70 flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
          <button hlmBtn variant="ghost" size="sm" class="text-muted-foreground -ml-1" (click)="store.go('inbox')"><ng-icon name="phosphorArrowLeftLight" />Inbox</button>
          <span class="text-muted-foreground">/</span>
          <h1 class="min-w-0 flex-1 truncate text-[14px] font-medium">{{ live.title() }}</h1>
          @if (chat.status() === 'reconnecting' || chat.status() === 'connecting') {
            <span class="text-muted-foreground shrink-0 text-[12px]" role="status">{{ chat.status() === 'reconnecting' ? 'Reconnecting…' : 'Connecting…' }}</span>
          }
          <button hlmBtn variant="ghost" size="sm" class="shrink-0" (click)="live.newChat()"><ng-icon name="phosphorPlusLight" />New</button>
        </header>

        <div #scroller class="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          <div class="mx-auto flex max-w-[640px] flex-col">
            @if (live.scope(); as sc) {
              <div class="flex flex-wrap items-center gap-1.5 pt-4" role="group" aria-label="Scope of this conversation">
                @for (c of sc.chips; track c) {
                  <span class="scope-chip">{{ c }}</span>
                }
                @if (sc.patch && store.scopeDiffers(sc)) {
                  <button hlmBtn variant="ghost" size="sm" class="h-7 px-2 text-[12.5px]" (click)="store.applyScope(sc)"><ng-icon name="phosphorSlidersHorizontalLight" />Apply to dashboard</button>
                } @else if (!sc.patch && sc.note) {
                  <span class="text-muted-foreground text-[12px]">{{ sc.note }}</span>
                }
              </div>
            }
            @for (t of chat.turns(); track t.key) {
              <app-chat-turn [turn]="t" [phase]="t.running ? (chat.live()?.phase ?? null) : null" (evidence)="showEvidence(t.key, $event)" />
            } @empty {
              <div class="pt-10">
                <span class="orb-mark" aria-hidden="true"></span>
                <h2 class="mt-3 text-[20px] font-semibold tracking-[-0.01em]">Ask Kassandra</h2>
                <p class="text-muted-foreground mt-1 text-[14px]">About any hotel, night or metric. Every number links to the query behind it.</p>
              </div>
            }
            @if (chat.error(); as e) {
              <p role="alert" class="border-border mt-4 rounded-[10px] border border-dashed p-3 text-[13.5px]">{{ e }}</p>
            }
          </div>
        </div>

        <footer class="border-border/70 shrink-0 border-t px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom,0px))]">
          <div class="mx-auto flex max-w-[640px] flex-col gap-2">
            <app-ask-bar
              inputId="thread-ask"
              label="Ask Kassandra"
              [placeholder]="chat.running() ? 'Add to the running answer…' : 'Ask a follow-up…'"
              [busy]="chat.running()"
              [steerable]="true"
              [prefill]="live.composer()"
              (submitted)="live.send($event)"
              (stopped)="chat.abort()"
            />
            <div class="flex items-center justify-between gap-3">
              <div class="op-toggle" role="radiogroup" aria-label="Answer mode">
                @for (m of modes; track m.id) {
                  <button type="button" role="radio" [attr.aria-checked]="live.mode() === m.id" [attr.tabindex]="live.mode() === m.id ? 0 : -1" [title]="m.hint" (click)="live.mode.set(m.id)" (keydown)="modeKey($event)">{{ m.label }}</button>
                }
              </div>
              <span class="text-muted-foreground text-[12px] tabular-nums" [title]="usageTitle()">{{ modeHint() }}@if (chat.usage().tokens) { · {{ usageShort() }}}</span>
            </div>
          </div>
        </footer>
      </section>

      <aside class="border-border/70 hidden min-h-0 flex-col border-l lg:flex" aria-label="How this was computed">
        <header class="border-border/70 flex h-14 shrink-0 items-center border-b px-5">
          <h2 class="text-[14px] font-medium">How this was computed</h2>
          @if (turnsWithEvidence().length > 1) {
            <span class="text-muted-foreground ml-2 text-[12.5px]">· {{ selectedLabel() }}</span>
          }
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <app-evidence-panel [allSteps]="selectedSteps()" [focus]="focus()" />
        </div>
      </aside>
    </div>
  `,
})
export class ThreadView {
  protected readonly store = inject(CompassStore);
  protected readonly live = inject(Live);
  protected readonly chat = this.live.chat;
  protected readonly modes: { id: AnswerMode; label: string; hint: string }[] = [
    { id: 'quick', label: 'Quick', hint: 'A fast answer from governed metrics' },
    { id: 'thinker', label: 'Thinker', hint: 'Reasons across every source; slower' },
  ];
  protected readonly modeHint = computed(() => (this.live.mode() === 'quick' ? 'Fast, governed metrics' : 'Reasons across every source'));
  private readonly selected = signal<string | null>(null);
  protected readonly focus = signal<string | null>(null);
  protected readonly turnsWithEvidence = computed(() => this.chat.turns().filter((t) => t.steps.some((s) => s.evidence)));
  /** The turn the panel explains: the one picked, else the latest with evidence. */
  private readonly selectedTurn = computed(() => {
    const list = this.turnsWithEvidence();
    return list.find((t) => t.key === this.selected()) ?? list[list.length - 1] ?? null;
  });
  protected readonly selectedSteps = computed(() => this.selectedTurn()?.steps ?? []);
  protected readonly selectedLabel = computed(() => this.selectedTurn()?.question ?? '');
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private lastCount = 0;

  constructor() {
    this.chat.connect();
    // Follow the conversation as it grows, unless the person scrolled up to read.
    afterRenderEffect(() => {
      const turns = this.chat.turns();
      const last = turns[turns.length - 1];
      const size = turns.length + (last?.streamingText.length ?? 0) + (last?.steps.length ?? 0);
      const el = this.scroller()?.nativeElement;
      if (!el || size === this.lastCount) return;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
      if (nearBottom || turns.length !== this.lastCount) el.scrollTop = el.scrollHeight;
      this.lastCount = size;
    });
  }

  protected readonly usageShort = computed(() => usageText(this.chat.usage()));
  protected readonly usageTitle = computed(() => `This conversation: ${this.chat.usage().tokens.toLocaleString('en-GB')} tokens · $${this.chat.usage().costUsd.toFixed(4)}`);

  /** Arrow keys move between Quick and Thinker, as in any radio group. */
  protected modeKey(e: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next: AnswerMode = this.live.mode() === 'quick' ? 'thinker' : 'quick';
    this.live.mode.set(next);
    const group = (e.currentTarget as HTMLElement).parentElement;
    setTimeout(() => group?.querySelector<HTMLElement>('[aria-checked=true]')?.focus(), 0);
  }

  protected showEvidence(turnKey: string, callId: string) {
    this.selected.set(turnKey);
    this.focus.set(callId);
    setTimeout(() => document.getElementById('ev-' + callId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  }
}
