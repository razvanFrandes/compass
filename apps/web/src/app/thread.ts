import { Component, ElementRef, afterRenderEffect, computed, inject, output, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { EvidencePanel } from './evidence-panel';
import { KassandraComposer } from './kassandra/kassandra-composer';
import { KassandraConversation, type EvidenceSelection } from './kassandra/kassandra-conversation';
import { Live } from './live';
import { CompassStore } from './store';
import * as icons from './icons';

/*
  The thread is a live conversation with Kassandra (KassandraChat over WebSocket), drawn by the Kassandra component
  family: `kassandra-conversation` for the turns (the work collapsed to one line, the answer streaming in, charts
  with "Add to board", next questions) and `kassandra-composer` for the ask bar (voice, Quick or Thinker, the hotel
  scope). On the right, "How this was computed" from the evidence every data tool returns.
  Explore, a chart click and a KPI tile send their question at once; only /ask?q= fills the composer and waits.
*/
@Component({
  selector: 'app-thread',
  imports: [NgIcon, KassandraComposer, KassandraConversation, EvidencePanel, HlmButtonImports],
  providers: [provideIcons({ ...icons })],
  host: { class: 'flex h-full min-h-0' },
  template: `
    <div class="grid min-h-0 w-full grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(380px,1fr)_minmax(0,0.9fr)]">
      <section class="flex min-h-0 min-w-0 flex-col" aria-label="Conversation">
        <header class="border-border/70 flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
          <button hlmBtn variant="ghost" size="sm" class="text-muted-foreground -ml-1" (click)="store.go('inbox')"><ng-icon name="phosphorArrowLeftLight" />Inbox</button>
          <span class="text-muted-foreground" aria-hidden="true">/</span>
          <h1 class="min-w-0 flex-1 truncate text-[14px] font-medium">{{ live.title() }}</h1>
          @if (chat.status() === 'reconnecting' || chat.status() === 'connecting') {
            <span class="text-muted-foreground shrink-0 text-[12px]" role="status">{{ chat.status() === 'reconnecting' ? 'Reconnecting…' : 'Connecting…' }}</span>
          }
          <button hlmBtn variant="ghost" size="sm" class="shrink-0" (click)="live.newChat()"><ng-icon name="phosphorPlusLight" />New</button>
        </header>

        <div #scroller class="min-h-0 flex-1 overflow-y-auto px-4 pb-6" tabindex="0" role="group" aria-label="Conversation with Kassandra" (scroll)="onScroll()">
          <div class="mx-auto flex max-w-[640px] flex-col">
            <h2 class="sr-only">Conversation</h2>
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
            <kassandra-conversation
              [turns]="chat.turns()"
              [phase]="chat.live()?.phase"
              [error]="chat.error()"
              [usage]="chat.usage()"
              [suggest]="true"
              [stoppable]="true"
              (evidenceSelected)="showEvidence($event)"
              (suggestionPicked)="live.send($event)"
              (stopped)="chat.abort()"
            >
              <div class="pt-10">
                <span class="orb-mark block" style="width: 28px; height: 28px" aria-hidden="true"></span>
                <p class="mt-3 text-[20px] font-semibold tracking-[-0.01em]">Ask Kassandra</p>
                <p class="text-muted-foreground mt-1 text-[14px]">About any hotel, night or metric. Every number links to the query behind it.</p>
              </div>
            </kassandra-conversation>
          </div>
        </div>

        <footer class="border-border/70 shrink-0 border-t px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom,0px))]">
          <div class="mx-auto max-w-[640px]">
            <kassandra-composer
              inputId="thread-ask"
              label="Ask Kassandra"
              [placeholder]="chat.running() ? 'Add to the running answer…' : chat.turns().length ? 'Ask a follow-up…' : 'Ask about any hotel, night or metric…'"
              [busy]="chat.running()"
              [steerable]="true"
              [prefill]="live.composer()"
              [(mode)]="live.mode"
              (submitted)="live.send($event)"
              (stopped)="chat.abort()"
            />
          </div>
        </footer>
      </section>

      <!-- The evidence panel's slot. The panel itself belongs to the evidence work; the thread only tells it which
           turn and which tool result were asked for, and re-emits the choice as (evidenceSelected). -->
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
  /** "How this was computed" was asked for a tool result: the turn and the call id. */
  readonly evidenceSelected = output<EvidenceSelection>();

  protected readonly store = inject(CompassStore);
  protected readonly live = inject(Live);
  protected readonly chat = this.live.chat;
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
  /** The person is at the end of the conversation; false once they scroll up to read. */
  private pinned = true;
  private turnCount = 0;

  constructor() {
    this.chat.connect();
    // Follow the conversation as it grows, unless the person scrolled up to read. A new turn always comes into view.
    afterRenderEffect(() => {
      const turns = this.chat.turns();
      const last = turns[turns.length - 1];
      // Read what grows while an answer comes in, so this runs again as it does.
      void [last?.streamingText, last?.steps.length, last?.answer];
      const el = this.scroller()?.nativeElement;
      if (!el) return;
      if (this.pinned || turns.length !== this.turnCount) el.scrollTop = el.scrollHeight;
      this.turnCount = turns.length;
    });
  }

  protected onScroll() {
    const el = this.scroller()?.nativeElement;
    if (el) this.pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  protected showEvidence(selection: EvidenceSelection) {
    this.selected.set(selection.turnKey);
    this.focus.set(selection.callId);
    this.evidenceSelected.emit(selection);
    setTimeout(() => document.getElementById('ev-' + selection.callId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  }
}
