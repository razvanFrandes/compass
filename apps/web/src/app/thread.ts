import { Component, DestroyRef, ElementRef, afterRenderEffect, computed, effect, inject, output, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { EvidenceLayout } from './evidence';
import { KassandraComposer } from './kassandra/kassandra-composer';
import { KassandraConversation, type EvidenceSelection } from './kassandra/kassandra-conversation';
import { evidenceEntries, evidenceTarget, hasEvidence, statedText } from './kassandra/evidence-target';
import { KassandraTryAsking } from './kassandra/kassandra-try-asking';
import { SkeletonHold, evidenceSlots } from './kassandra/live-slots';
import { Live } from './live';
import { CompassStore } from './store';
import * as icons from './icons';

/*
  The thread is a live conversation with Kassandra (KassandraChat over WebSocket), drawn by the Kassandra component
  family: `kassandra-conversation` for the turns (the work collapsed to one line, the answer streaming in, charts
  with "Add to board", next questions) and `kassandra-composer` for the ask bar (voice, Quick or Thinker; the hotel
  scope). On the right, "Behind the numbers" from the evidence every data tool returns.
  Layout (docs/research/layout): the conversation is one column of 68 characters, the evidence a 400 px supporting
  pane. No rules between header, conversation and composer: the composer sits on a fade of the page.
  Explore, a chart click and a KPI tile send their question at once; only /ask?q= fills the composer and waits.
*/
@Component({
  selector: 'app-thread',
  imports: [NgIcon, KassandraComposer, KassandraConversation, KassandraTryAsking, EvidenceLayout, HlmButtonImports],
  providers: [provideIcons({ ...icons })],
  host: { class: 'flex h-full min-h-0' },
  template: `
    <!-- Evidence integration point 1 of 3: the layout wraps the conversation; the evidence is its second pane (a sheet on phones) -->
    <juyo-evidence-layout #evidence [entries]="selectedSteps()" [answer]="selectedAnswer()" [question]="selectedLabel()" [chart]="target().chart?.title" [focusCallId]="target().callId" [focusColumns]="target().chart?.columns ?? []">
      <section class="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Conversation">
        <header class="flex h-14 shrink-0 items-center gap-inline px-page-x">
          <button hlmBtn variant="ghost" size="sm" class="text-muted-foreground -ml-1" (click)="store.go('inbox')"><ng-icon name="phosphorArrowLeftLight" />Inbox</button>
          <span class="text-muted-foreground" aria-hidden="true">/</span>
          <h1 class="min-w-0 flex-1 truncate text-[14px] font-medium">{{ live.title() }}</h1>
          @if (chat.status() === 'reconnecting' || chat.status() === 'connecting') {
            <span class="text-muted-foreground shrink-0 text-[12px]" role="status">{{ chat.status() === 'reconnecting' ? 'Reconnecting…' : 'Connecting…' }}</span>
          }
          @if (turnsWithEvidence().length) {
            <!-- Evidence integration point 2 of 3: on phones the evidence is a sheet, opened from here or from a step -->
            <button hlmBtn variant="ghost" size="icon-sm" class="text-muted-foreground shrink-0 lg:hidden" aria-haspopup="dialog" aria-label="Behind the numbers" title="Behind the numbers" (click)="evidence.open()"><ng-icon name="phosphorDatabaseLight" /></button>
          }
          <button hlmBtn variant="ghost" size="sm" class="shrink-0" (click)="live.newChat()"><ng-icon name="phosphorPlusLight" />New</button>
        </header>

        <div #scroller class="min-h-0 flex-1 overflow-y-auto px-page-x pb-section" tabindex="0" role="group" aria-label="Conversation with Kassandra" (scroll)="onScroll()">
          <div class="k-thread-col mx-auto flex flex-col text-[14.5px]">
            <h2 class="sr-only">Conversation</h2>
            @if (live.scope(); as sc) {
              <div class="flex flex-wrap items-center gap-1.5 pt-stack" role="group" aria-label="What this conversation covers">
                @for (c of sc.chips; track c) {
                  <span class="scope-chip">{{ c }}</span>
                }
                @if (sc.patch && store.scopeDiffers(sc)) {
                  <button hlmBtn variant="ghost" size="sm" class="h-7 px-2 text-[12.5px]" (click)="store.applyScope(sc)"><ng-icon name="phosphorSlidersHorizontalLight" />Show on the Portfolio board</button>
                } @else if (!sc.patch && sc.note) {
                  <span class="text-muted-foreground text-[12px]">{{ sc.note }}</span>
                }
              </div>
            }
            <kassandra-conversation
              [turns]="chat.turns()"
              [phase]="chat.live()?.phase"
              [liveTools]="chat.live()?.tools"
              [drafting]="chat.live()?.drafting"
              [previews]="true"
              [error]="chat.error()"
              [usage]="chat.usage()"
              [suggest]="true"
              [stoppable]="true"
              (evidenceSelected)="showEvidence($event)"
              (suggestionPicked)="live.send($event)"
              (stopped)="chat.abort()"
            >
              @if (restoring()) {
                <!-- An existing conversation while its transcript loads: its shape, not the "Ask Kassandra" start screen -->
                <div class="flex flex-col gap-4 pt-stack" role="status" aria-label="Loading the conversation">
                  <div class="skeleton h-9 w-[min(360px,70%)] self-end rounded-[14px]"></div>
                  <div class="flex flex-col gap-2.5 pt-2">
                    <div class="skeleton h-3.5 w-[92%] rounded"></div>
                    <div class="skeleton h-3.5 w-[84%] rounded"></div>
                    <div class="skeleton h-3.5 w-[60%] rounded"></div>
                  </div>
                  <div class="skeleton h-[180px] w-full rounded-[12px]"></div>
                </div>
              } @else {
              <div class="pt-section-lg">
                <span class="orb-mark block" style="width: 28px; height: 28px" aria-hidden="true"></span>
                <p class="mt-3 text-[20px] font-semibold tracking-[-0.01em]">Ask Kassandra</p>
                <p class="text-muted-foreground mt-1 text-[14px]">About any hotel, night or metric. Every number in the answer shows where it comes from.</p>
                <!-- Examples that show off each kind of widget; a click sends the question at once -->
                <kassandra-try-asking class="mt-8" (picked)="live.send($event)" />
              </div>
              }
            </kassandra-conversation>
          </div>
        </div>

        <footer class="k-dock shrink-0 pt-1 pr-[max(var(--space-page-x),env(safe-area-inset-right,0px))] pb-[max(var(--space-stack),env(safe-area-inset-bottom,0px))] pl-[max(var(--space-page-x),env(safe-area-inset-left,0px))]">
          <div class="k-dock-inner k-thread-dock text-[14.5px]">
            <kassandra-composer
              inputId="thread-ask"
              [docked]="true"
              [briefPrompts]="store.briefPrompts()"
              label="Ask Kassandra"
              [placeholder]="chat.running() ? 'Add to your question…' : chat.turns().length ? 'Ask a follow-up…' : 'Ask about any hotel, night or metric…'"
              [busy]="chat.running()"
              [phase]="chat.live()?.phase"
              [steerable]="true"
              [prefill]="live.composer()"
              [(mode)]="live.mode"
              (submitted)="live.send($event)"
              (stopped)="chat.abort()"
            />
          </div>
        </footer>
      </section>
    </juyo-evidence-layout>
  `,
})
export class ThreadView {
  /** "Behind the numbers" was asked for a tool result: the turn and the call id. */
  readonly evidenceSelected = output<EvidenceSelection>();

  protected readonly store = inject(CompassStore);
  protected readonly live = inject(Live);
  protected readonly chat = this.live.chat;
  /**
   * A conversation from the list was opened and its transcript is not in yet (no snapshot): show a loading shape.
   * A new conversation does not connect until its first question, so it goes straight to the start screen.
   */
  protected readonly restoring = computed(
    () => this.chat.live() === null && this.chat.status() !== 'idle' && !this.chat.error() && this.chat.turns().length === 0 && this.live.conversations().some((c) => c.id === this.chat.conversation()),
  );
  /** What "Behind the numbers" was asked for, and how many turns there were then: a new question lets go of it. */
  private readonly selected = signal<{ selection: EvidenceSelection; turns: number } | null>(null);
  /** The click as the panel reads it: the turn, the card of the tool result, and the chart it was asked on (if any). */
  protected readonly target = computed(() => {
    const turns = this.chat.turns();
    const picked = this.selected();
    return evidenceTarget(turns, picked && picked.turns === turns.length ? picked.selection : null);
  });
  private readonly evidenceLayout = viewChild.required<EvidenceLayout>('evidence');
  private readonly liveTools = computed(() => this.chat.live()?.tools ?? null);
  /** Turns with something to explain. A chart counts: it carries the evidence of the result it draws, even an older one. */
  protected readonly turnsWithEvidence = computed(() => this.chat.turns().filter(hasEvidence));
  /**
   * The turn the panel explains: the one picked; else the answer in the making as soon as it reads data, so the
   * panel follows it; else the latest with evidence.
   */
  private readonly selectedTurn = computed(() => {
    const turns = this.chat.turns();
    const chosen = this.target().turn;
    if (chosen) return chosen;
    const running = turns.find((t) => t.running);
    if (running && evidenceSlots(running, this.liveTools()).length) return running;
    const list = this.turnsWithEvidence();
    return list[list.length - 1] ?? null;
  });
  /** The data calls of that turn as the cards they are becoming: skeletons until each result is in. */
  protected readonly pendingEvidence = computed(() => {
    const turn = this.selectedTurn();
    return turn ? evidenceSlots(turn, this.liveTools()) : [];
  });
  /** A skeleton row that has appeared stays for its minimum time. */
  protected readonly hold = new SkeletonHold();
  /**
   * What the evidence panel is given: the turn's steps, the results its charts draw from when those were read in
   * an earlier turn, and the calls only `live.tools` knows (a panel that draws its own waiting cards shows them
   * from the first moment). A result whose skeleton row is still held is kept back, so the row and its card never
   * show together.
   */
  protected readonly selectedSteps = computed(() => {
    const turn = this.selectedTurn();
    if (!turn) return [];
    const held = this.hold.held();
    return evidenceEntries(this.chat.turns(), turn, this.liveTools()).map((step) => (held.has(step.callId) && step.evidence ? { ...step, evidence: undefined, rows: undefined, status: 'running' } : step));
  });
  protected readonly selectedLabel = computed(() => this.selectedTurn()?.question ?? '');
  /** The text whose numbers are traced: the answer, and the titles of the charts in it. */
  protected readonly selectedAnswer = computed(() => {
    const turn = this.selectedTurn();
    return turn ? statedText(turn) : null;
  });
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  /** The person is at the end of the conversation; false once they scroll up to read. */
  private pinned = true;
  private turnCount = 0;

  constructor() {
    this.chat.connect();
    effect(() => {
      this.hold.show(
        this.pendingEvidence()
          .filter((slot) => slot.phase !== 'ready')
          .map((slot) => slot.callId),
      );
    });
    inject(DestroyRef).onDestroy(() => this.hold.clear());
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

  /**
   * "Behind the numbers" on a step or a chart: the panel follows it. It picks the turn, opens the card of the
   * tool result behind it (for a chart, the result it draws, even one read in an earlier turn) and shows the panel
   * (the sheet on a phone).
   */
  protected showEvidence(selection: EvidenceSelection) {
    this.selected.set({ selection, turns: this.chat.turns().length });
    this.evidenceSelected.emit(selection);
    this.evidenceLayout().open(this.target().callId);
  }
}
