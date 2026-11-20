import { Component, DestroyRef, ElementRef, afterRenderEffect, computed, inject, input, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmBubbleImports } from '@spartan-ng/helm/bubble';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCollapsibleImports } from '@spartan-ng/helm/collapsible';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmMessageImports } from '@spartan-ng/helm/message';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { HlmTraceImports } from '@spartan-ng/helm/trace';
import { ArtifactView } from './artifact';
import { AskBar } from './ask-bar';
import { ArtifactSpec, CompassStore, DECISION_DATES, DECISION_UNSOLD, Feedback, TOPICS, Turn } from './store';
import { formatEur } from './data';
import * as icons from './icons';

/** "Add to board ▾": pick the destination, then confirm with a toast that can undo. */
@Component({
  selector: 'app-add-to-board',
  imports: [NgIcon, HlmButtonImports, HlmDropdownMenuImports],
  providers: [provideIcons({ ...icons })],
  template: `
    <button hlmBtn size="sm" [variant]="added() ? 'outline' : 'default'" [hlmDropdownMenuTrigger]="menu" align="end" [disabled]="disabled()">
      <ng-icon [name]="added() ? 'phosphorCheckLight' : 'phosphorSquaresFourLight'" />{{ added() ? 'On a board' : 'Add to board' }}
      <ng-icon name="phosphorCaretDownLight" class="opacity-60" />
    </button>
    <ng-template #menu>
      <hlm-dropdown-menu class="w-56">
        <hlm-dropdown-menu-label>Add to board</hlm-dropdown-menu-label>
        @for (b of store.boards(); track b.id) {
          <button hlmDropdownMenuItem (triggered)="store.addToBoard(b.id, spec(), from())">
            <ng-icon name="phosphorSquaresFourLight" />{{ b.name }}
            <span class="text-muted-foreground ml-auto text-[12px] tabular-nums">{{ b.widgets.length }}</span>
          </button>
        }
        <hlm-dropdown-menu-separator />
        <button hlmDropdownMenuItem (triggered)="store.addToBoard('new', spec(), from())"><ng-icon name="phosphorPlusLight" />New board</button>
      </hlm-dropdown-menu>
    </ng-template>
  `,
})
export class AddToBoard {
  protected readonly store = inject(CompassStore);
  readonly spec = input.required<ArtifactSpec>();
  readonly from = input('Ask Compass');
  readonly disabled = input(false);
  protected readonly added = computed(() => this.store.isOnBoard(this.spec().id));
}

/** Definitions, query and the declarative spec behind an answer. */
@Component({
  selector: 'app-how-computed',
  imports: [NgIcon, HlmCollapsibleImports],
  providers: [provideIcons({ ...icons })],
  template: `
    <div hlmCollapsible [expanded]="open()" class="ring-foreground/8 rounded-lg ring-1">
      <button hlmCollapsibleTrigger class="hover:bg-foreground/3 group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] font-medium transition-colors">
        <span class="flex items-center gap-1.5">How this was computed
          <span class="text-muted-foreground flex items-center gap-1 text-[12px] font-normal"><ng-icon name="phosphorSealCheckFill" />Verified query</span>
        </span>
        <ng-icon name="phosphorCaretDownLight" class="text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </button>
      <div hlmCollapsibleContent>
        <dl class="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-1.5 px-3 pt-1 pb-3 text-[12.5px]">
          @for (d of content().definitions; track d[0]) {
            <dt class="text-muted-foreground">{{ d[0] }}</dt>
            <dd>{{ d[1] }}</dd>
          }
        </dl>
        <div class="mx-3 mb-2 flex gap-1 text-[12px]" role="tablist" aria-label="Show">
          <button type="button" role="tab" [attr.aria-selected]="tab() === 'sql'" class="rounded px-1.5 py-0.5" [class]="tab() === 'sql' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'" (click)="tab.set('sql')">Query</button>
          <button type="button" role="tab" [attr.aria-selected]="tab() === 'spec'" class="rounded px-1.5 py-0.5" [class]="tab() === 'spec' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'" (click)="tab.set('spec')">Chart spec</button>
        </div>
        <pre class="bg-muted/60 mx-3 mb-3 max-h-56 overflow-auto rounded-md p-2.5 font-mono text-[11.5px]/relaxed">{{ tab() === 'sql' ? content().sql : specJson() }}</pre>
      </div>
    </div>
  `,
})
export class HowComputed {
  readonly topic = input.required<Turn['topic']>();
  readonly open = input(false);
  protected readonly tab = signal<'sql' | 'spec'>('sql');
  protected readonly content = computed(() => TOPICS[this.topic()]);
  protected readonly specJson = computed(() => {
    const s = this.content().artifact;
    const { id, ...rest } = s;
    void id;
    return JSON.stringify(rest, null, 2);
  });
}

const FEEDBACK_REASONS = ['Wrong numbers', 'Out of date', 'Wrong sources', 'Not what I asked'];

/** A conversation on the left, the artifact it produced on the right. */
@Component({
  selector: 'app-thread',
  imports: [
    NgIcon,
    ArtifactView,
    AskBar,
    AddToBoard,
    HowComputed,
    HlmBubbleImports,
    HlmButtonImports,
    HlmCollapsibleImports,
    HlmMessageImports,
    HlmTooltipImports,
    HlmTraceImports,
  ],
  providers: [provideIcons({ ...icons })],
  host: { class: 'flex h-full min-h-0' },
  template: `
    @if (thread(); as th) {
      <div class="grid min-h-0 w-full grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(380px,0.9fr)_minmax(0,1.1fr)]">
        <!-- Conversation -->
        <section class="flex min-h-0 min-w-0 flex-col" aria-label="Conversation">
          <header class="border-border/70 flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
            <button hlmBtn variant="ghost" size="sm" class="text-muted-foreground -ml-1" (click)="store.go('inbox')"><ng-icon name="phosphorArrowLeftLight" />Inbox</button>
            <span class="text-muted-foreground">/</span>
            <h1 class="min-w-0 truncate text-[14px] font-medium">{{ th.title }}</h1>
          </header>

          <div #scroller class="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            <div class="mx-auto flex max-w-[620px] flex-col">
              @for (t of th.turns; track t.id; let last = $last) {
                <article class="flex flex-col gap-3 pt-5" [attr.aria-busy]="!t.answerVisible && !t.stopped">
                  <div hlmMessage align="end">
                    <div hlmMessageContent>
                      <div hlmBubble variant="muted"><div hlmBubbleContent class="text-[14px]/relaxed">{{ t.question }}</div></div>
                    </div>
                  </div>

                  @if (t.answerVisible || t.stopped) {
                    <div hlmCollapsible>
                      <button hlmCollapsibleTrigger class="text-muted-foreground hover:text-foreground group flex items-center gap-1.5 text-[12.5px] transition-colors">
                        {{ t.stopped ? 'Stopped after' : 'Worked for' }} {{ t.seconds }}s · {{ done(t) }} steps
                        <ng-icon name="phosphorCaretDownLight" class="transition-transform group-data-[state=open]:rotate-180" />
                      </button>
                      <div hlmCollapsibleContent>
                        <div hlmTrace class="pt-2 pl-0.5">
                          @for (s of t.steps; track s.title) {
                            <div hlmTraceLine [status]="s.status === 'pending' ? 'pending' : undefined">
                              <span hlmTraceIcon><ng-icon [name]="s.status === 'done' ? 'phosphorCheckLight' : 'phosphorXCircleLight'" /></span>
                              <span hlmTraceTitle>{{ s.title }}</span>
                              <span hlmTraceDescription>{{ s.status === 'done' ? s.detail : 'skipped' }}</span>
                            </div>
                          }
                        </div>
                      </div>
                    </div>
                  } @else {
                    <div hlmTrace class="pl-0.5" aria-live="polite">
                      @for (s of t.steps; track s.title) {
                        <div hlmTraceLine [status]="s.status === 'done' ? undefined : s.status">
                          <span hlmTraceIcon>
                            @if (s.status === 'done') {
                              <ng-icon name="phosphorCheckLight" />
                            } @else {
                              <ng-icon name="phosphorCircleNotchLight" class="motion-safe:animate-spin" />
                            }
                          </span>
                          <span hlmTraceTitle>{{ s.title }}</span>
                          <span hlmTraceDescription>{{ s.status === 'done' ? s.detail : '' }}</span>
                        </div>
                      }
                    </div>
                  }

                  @if (!t.stopped && (t.phase !== 'choosing' || t.steps[0].status !== 'pending')) {
                    <!-- Desktop: a reference card that opens the artifact on the right. Phone: the artifact inline. -->
                    <button
                      type="button"
                      class="ring-foreground/10 hover:ring-foreground/25 bg-card hidden items-center gap-3 rounded-xl p-2.5 pr-3 text-left ring-1 transition-shadow lg:flex"
                      [class]="selected()?.id === t.id ? 'ring-foreground/40' : ''"
                      (click)="selectedId.set(t.id)"
                    >
                      <span class="bg-muted grid size-9 shrink-0 place-items-center rounded-lg">
                        <ng-icon [name]="artifactOf(t).kind === 'bars' ? 'phosphorChartBarLight' : 'phosphorChartLineLight'" class="text-[16px]" />
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-[13px] font-medium">{{ t.phase === 'choosing' ? 'Choosing a component…' : artifactOf(t).title }}</span>
                        <span class="text-muted-foreground block text-[12px]">{{ t.phase === 'done' ? 'Chart · open on the right' : 'Generating…' }}</span>
                      </span>
                      @if (t.phase !== 'done') {
                        <ng-icon name="phosphorCircleNotchLight" class="text-muted-foreground motion-safe:animate-spin" />
                      }
                    </button>
                    <div class="bg-card ring-foreground/8 rounded-xl p-3.5 ring-1 lg:hidden">
                      <app-artifact [spec]="artifactOf(t)" [phase]="t.phase" [height]="170" [editable]="false" />
                      @if (t.phase === 'done') {
                        <div class="mt-3 flex"><app-add-to-board [spec]="artifactOf(t)" [from]="th.title" /></div>
                      }
                    </div>
                  }

                  @if (t.stopped) {
                    <p class="text-muted-foreground text-[13px]">You stopped this answer. Nothing was changed.</p>
                  }

                  @if (t.answerVisible) {
                    <div class="gen-in flex flex-col gap-3.5 text-[14.5px]/[1.65]">
                      <p>
                        @for (s of content(t).answer; track $index) {
                          @if (s.b) {
                            <strong class="font-semibold tabular-nums">{{ s.t }}</strong>
                          } @else {
                            <span>{{ s.t }}</span>
                          }
                        }
                      </p>
                      <div class="flex flex-wrap items-center gap-1.5">
                        @for (s of content(t).sources; track s) {
                          <span class="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11.5px]"><ng-icon name="phosphorDatabaseLight" />{{ s }}</span>
                        }
                      </div>
                      <div class="lg:hidden"><app-how-computed [topic]="t.topic" /></div>

                      @if (content(t).proposal; as p) {
                        <div class="ring-foreground/10 bg-card rounded-xl ring-1" role="group" [attr.aria-label]="p.title">
                          @switch (t.proposal) {
                            @case ('approved') {
                              <div class="flex items-center justify-between gap-2 px-3.5 py-3">
                                <p class="flex items-center gap-2 text-[13px]"><ng-icon name="phosphorCheckCircleFill" class="text-(--positive) shrink-0 text-[15px]" /><span>Approved {{ nights() }} rates, from <span class="tabular-nums">{{ eur(t.target) }}</span>. Sent to the revenue manager as an RMS task · logged 09:14.</span></p>
                                <button hlmBtn size="sm" variant="ghost" (click)="store.decide(th.id, t.id, 'open')">Undo</button>
                              </div>
                            }
                            @case ('denied') {
                              <div class="flex items-center justify-between gap-2 px-3.5 py-3">
                                <p class="text-muted-foreground text-[13px]">Declined and logged. Nothing was sent.</p>
                                <button hlmBtn size="sm" variant="ghost" (click)="store.decide(th.id, t.id, 'open')">Undo</button>
                              </div>
                            }
                            @default {
                              <div class="px-3.5 pt-3">
                                <p class="text-muted-foreground text-[12px] font-medium tracking-[0.04em] uppercase">Recommendation · needs your decision</p>
                                <p class="mt-1 text-[14px] font-medium">{{ p.title }}</p>
                                <div class="mt-2.5 flex items-center gap-2 text-[14px] tabular-nums">
                                  <span class="text-muted-foreground line-through decoration-1">{{ eur(p.from) }}</span>
                                  <span class="text-muted-foreground">→</span>
                                  @if (t.proposal === 'editing') {
                                    <span class="flex items-center gap-1">
                                      <button hlmBtn variant="outline" size="icon-xs" aria-label="Lower by €2" (click)="nudge(th.id, t, -2)">−</button>
                                      <span class="w-12 text-center font-semibold" aria-live="polite">{{ eur(t.target) }}</span>
                                      <button hlmBtn variant="outline" size="icon-xs" aria-label="Raise by €2" (click)="nudge(th.id, t, 2)">+</button>
                                    </span>
                                  } @else {
                                    <span class="font-semibold">{{ eur(t.target) }}</span>
                                  }
                                </div>
                                <dl class="text-muted-foreground mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12.5px] tabular-nums">
                                  <dt>Up to</dt><dd class="text-foreground">+{{ k(impact(t)) }} room revenue <span class="text-muted-foreground">if the {{ unsold }} unsold rooms sell</span></dd>
                                  <dt>Goes to</dt><dd>{{ p.reaches }}</dd>
                                </dl>
                                <p class="text-muted-foreground mt-2 text-[12px]/relaxed">{{ p.why }}</p>
                              </div>
                              <div class="border-border/70 mt-3 flex flex-wrap gap-2 border-t px-3.5 py-2.5">
                                <button hlmBtn size="sm" (click)="store.decide(th.id, t.id, 'approved')">Approve {{ nights() }} rates</button>
                                <button hlmBtn size="sm" variant="outline" (click)="store.decide(th.id, t.id, t.proposal === 'editing' ? 'open' : 'editing')">{{ t.proposal === 'editing' ? 'Done' : 'Adjust' }}</button>
                                <button hlmBtn size="sm" variant="ghost" (click)="store.decide(th.id, t.id, 'denied')">Decline</button>
                              </div>
                            }
                          }
                        </div>
                      }

                      <div class="text-muted-foreground -ml-1.5 flex items-center gap-0.5">
                        <button hlmBtn variant="ghost" size="icon-sm" [attr.aria-label]="t.copied ? 'Copied' : 'Copy answer'" [hlmTooltip]="t.copied ? 'Copied' : 'Copy'" (click)="copy(th.id, t)"><ng-icon [name]="t.copied ? 'phosphorCheckLight' : 'phosphorCopyLight'" /></button>
                        <button hlmBtn variant="ghost" size="icon-sm" aria-label="Good answer" [attr.aria-pressed]="t.feedback === 'up'" hlmTooltip="Good answer" (click)="rate(th.id, t, t.feedback === 'up' ? null : 'up')"><ng-icon [name]="t.feedback === 'up' ? 'phosphorThumbsUpFill' : 'phosphorThumbsUpLight'" /></button>
                        <button hlmBtn variant="ghost" size="icon-sm" aria-label="Bad answer" [attr.aria-pressed]="t.feedback === 'down'" hlmTooltip="Bad answer" (click)="rate(th.id, t, t.feedback === 'down' ? null : 'down')"><ng-icon [name]="t.feedback === 'down' || t.feedback === 'sent' ? 'phosphorThumbsDownFill' : 'phosphorThumbsDownLight'" /></button>
                        <button hlmBtn variant="ghost" size="icon-sm" aria-label="Regenerate" hlmTooltip="Regenerate" (click)="store.ask(t.question)" [disabled]="store.busy()"><ng-icon name="phosphorArrowClockwiseLight" /></button>
                      </div>
                      @if (t.feedback === 'down') {
                        <div class="gen-in -mt-1.5 flex flex-col gap-2">
                          <p class="text-muted-foreground text-[12.5px]">What was wrong?</p>
                          <div class="flex flex-wrap gap-1.5">
                            @for (r of reasons; track r) {
                              <button hlmBtn variant="outline" size="sm" class="font-normal" (click)="rate(th.id, t, 'sent')">{{ r }}</button>
                            }
                          </div>
                        </div>
                      } @else if (t.feedback === 'sent') {
                        <p class="text-muted-foreground -mt-1.5 text-[12.5px]">Thanks. The revenue team will review this answer.</p>
                      }

                      @if (last) {
                        <div class="flex flex-wrap gap-1.5">
                          @for (f of content(t).followUps; track f) {
                            <button hlmBtn variant="outline" size="sm" class="font-normal" (click)="store.ask(f)">{{ f }}</button>
                          }
                        </div>
                      }
                    </div>
                  }
                </article>
              }
            </div>
          </div>

          <div class="mx-auto flex w-full max-w-[652px] shrink-0 flex-col gap-2 px-3 pb-[max(12px,env(safe-area-inset-bottom,0px))]">
            <app-ask-bar label="Ask a follow-up" placeholder="Ask a follow-up" [busy]="store.busy()" (submitted)="store.ask($event)" (stopped)="store.stop()" />
            <div class="flex items-center justify-between gap-3 px-1">
              <div class="bg-muted flex rounded-[8px] p-0.5 text-[12.5px]" role="radiogroup" aria-label="Answer depth">
                @for (d of depths; track d.id) {
                  <button type="button" role="radio" [attr.aria-checked]="store.depth() === d.id" [attr.aria-description]="d.hint" class="rounded-[6px] px-2.5 py-1 transition-colors" [class]="store.depth() === d.id ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'" (click)="store.depth.set(d.id)">{{ d.label }}</button>
                }
              </div>
              <p class="text-muted-foreground text-right text-[12px]">Read-only · can be wrong, check “How this was computed”</p>
            </div>
          </div>
        </section>

        <!-- Artifact pane (desktop) -->
        <section class="bg-(--rail) border-border/70 hidden min-h-0 flex-col border-l lg:flex" aria-label="Artifact">
          @if (selected(); as t) {
            <header class="border-border/70 flex h-14 shrink-0 items-center justify-between gap-3 border-b px-5">
              <p class="text-muted-foreground text-[12.5px]">Artifact {{ artifactIndex() }} of {{ th.turns.length }}</p>
              <app-add-to-board [spec]="artifactOf(t)" [from]="th.title" [disabled]="t.phase !== 'done'" />
            </header>
            <div class="min-h-0 flex-1 overflow-y-auto p-5">
              <div class="bg-card ring-foreground/8 rounded-xl p-4 ring-1">
                <app-artifact [spec]="artifactOf(t)" [phase]="t.phase" [height]="300" />
              </div>
              @if (t.phase === 'done') {
                <div class="gen-in mt-4"><app-how-computed [topic]="t.topic" [open]="true" /></div>
              }
            </div>
          }
        </section>
      </div>
    }
  `,
})
export class ThreadView {
  protected readonly store = inject(CompassStore);
  protected readonly thread = this.store.activeThread;
  protected readonly selectedId = signal<number | null>(null);
  protected readonly reasons = FEEDBACK_REASONS;
  protected readonly eur = formatEur;
  protected readonly k = (n: number) => `€${(n / 1000).toFixed(1)}k`;
  protected readonly nights = () => DECISION_DATES.length;
  protected readonly unsold = DECISION_UNSOLD;
  protected readonly depths = [
    { id: 'quick', label: 'Quick', hint: 'One verified query, under a second' },
    { id: 'thinker', label: 'Thinker', hint: 'Reasons across 2–3 sources' },
  ] as const;

  /** The selected artifact, or the latest one. */
  protected readonly selected = computed(() => {
    const turns = (this.thread()?.turns ?? []).filter((t) => !t.stopped);
    return turns.find((t) => t.id === this.selectedId()) ?? turns[turns.length - 1] ?? null;
  });
  protected readonly artifactIndex = computed(() => (this.thread()?.turns ?? []).findIndex((t) => t.id === this.selected()?.id) + 1);

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private copyTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.copyTimer));
    let lastCount = 0;
    afterRenderEffect(() => {
      const turns = this.thread()?.turns ?? [];
      const el = this.scroller()?.nativeElement;
      if (turns.length !== lastCount) this.selectedId.set(null);
      lastCount = turns.length;
      if (el) el.scrollTo({ top: el.scrollHeight });
    });
  }

  protected content(t: Turn) {
    return TOPICS[t.topic];
  }
  protected artifactOf(t: Turn) {
    return TOPICS[t.topic].artifact;
  }
  protected done(t: Turn) {
    return t.steps.filter((s) => s.status === 'done').length;
  }
  protected impact(t: Turn) {
    const p = TOPICS[t.topic].proposal;
    if (!p) return 0;
    // The ceiling moves with the price: each € on the first night is a € on every unsold room.
    return Math.max(0, Math.round(p.impact + (t.target - p.to) * DECISION_UNSOLD));
  }
  protected nudge(threadId: string, t: Turn, by: number) {
    const p = TOPICS[t.topic].proposal;
    const lo = p ? p.from : 0;
    const hi = p ? p.to * 1.3 : Number.POSITIVE_INFINITY;
    this.store.patchTurn(threadId, t.id, (x) => ({ ...x, target: Math.max(lo, Math.min(hi, x.target + by)) }));
  }
  protected rate(threadId: string, t: Turn, feedback: Feedback) {
    this.store.patchTurn(threadId, t.id, (x) => ({ ...x, feedback }));
  }
  protected copy(threadId: string, t: Turn) {
    const text = TOPICS[t.topic].answer.map((s) => s.t).join('');
    navigator.clipboard?.writeText(text).catch(() => undefined);
    this.store.patchTurn(threadId, t.id, (x) => ({ ...x, copied: true }));
    this.copyTimer = setTimeout(() => this.store.patchTurn(threadId, t.id, (x) => ({ ...x, copied: false })), 1500);
  }
}
