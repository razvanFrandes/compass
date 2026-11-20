import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorStopFill } from '@ng-icons/phosphor-icons/fill';
import { phosphorArrowUpRightLight, phosphorCaretDownLight, phosphorCheckLight, phosphorCircleNotchLight } from '@ng-icons/phosphor-icons/light';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import type { ChatLive, WorkflowSpec } from '@compass/contracts';
import { WorkflowsApi, type ChatStep, type ChatTurn, type Usage } from '../api';
import { usageText } from '../chat-turn';
import { Markdown } from '../markdown';
import { CompassStore } from '../store';
import { KassandraWidget } from './kassandra-widget';
import { SkeletonHold, shownPhase, stepCount, widgetSlots } from './live-slots';
import { failureText, followUps, modeOf, phaseText, stepDetail, stepStatus, stepTitle, workedText } from './turn-text';

/** "How this was computed" was asked for one tool result of one turn. */
export interface EvidenceSelection {
  turnKey: string;
  callId: string;
}

let nextSteps = 0;
const TRIGGER = (w: WorkflowSpec) => (w.trigger.kind === 'schedule' ? `Every ${w.trigger.every}` : w.trigger.kind === 'brief' ? `When the brief finds ${w.trigger.finding.replace(/_/g, ' ')}` : 'When you run it');
const AUTONOMY: Record<string, string> = { suggest: 'suggest only', approve: 'after you approve', auto_low_risk: 'low-risk on its own' };

/**
 * One turn: the question, the work collapsed to one line ("Worked for 4s · 3 steps"), what Kassandra is doing right
 * now, the charts she showed (a skeleton from the moment she starts one), the answer as Markdown, a failure in plain
 * words, and a drafted workflow as a card.
 * Her narration between tool rounds is a step, never the answer. Tokens and cost sit behind "Details".
 */
@Component({
  selector: 'kassandra-turn',
  imports: [NgIcon, HlmButtonImports, Markdown, KassandraWidget],
  providers: [provideIcons({ phosphorArrowUpRightLight, phosphorCaretDownLight, phosphorCheckLight, phosphorCircleNotchLight, phosphorStopFill })],
  host: { class: 'flex flex-col gap-3 pt-5' },
  template: `
    @let t = turn();
    @if (t.question) {
      <div class="flex justify-end">
        <p class="bg-muted max-w-[85%] rounded-[14px] rounded-br-[4px] px-3.5 py-2 text-[14px]/relaxed whitespace-pre-wrap" [class.opacity-60]="t.pending">
          <span class="sr-only">You asked: </span>{{ t.question }}
          @if (t.pending) {
            <span class="text-muted-foreground block text-[11.5px]">Sending…</span>
          }
        </p>
      </div>
    }

    <!-- The line is there from the first tool call, before its entry is committed, so what follows does not jump down -->
    @if (count(); as n) {
      <div>
        <button type="button" class="k-link text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded text-[12.5px] transition-colors" [attr.aria-expanded]="open()" [attr.aria-controls]="stepsId" (click)="open.set(!open())">
          @if (t.running) {
            <ng-icon name="phosphorCircleNotchLight" class="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Working · {{ n }} {{ n === 1 ? 'step' : 'steps' }} so far
          } @else {
            <ng-icon name="phosphorCheckLight" aria-hidden="true" />
            Worked for {{ worked() }} · {{ n }} {{ n === 1 ? 'step' : 'steps' }}
          }
          <ng-icon name="phosphorCaretDownLight" class="transition-transform motion-reduce:transition-none" [class.rotate-180]="open()" aria-hidden="true" />
        </button>
        @if (open()) {
          <ol [id]="stepsId" class="border-border mt-2 ml-1.5 flex flex-col gap-2 border-l pl-4 text-[13px]">
            @for (s of t.steps; track s.callId) {
              <li class="relative">
                <span class="absolute top-1.5 -left-[21px] size-2 rounded-full" [class]="s.status === 'error' ? 'bg-(--negative)' : s.status === 'done' ? 'bg-(--series-muted)' : 'bg-(--series) animate-pulse motion-reduce:animate-none'" aria-hidden="true"></span>
                @if (s.narration) {
                  <p class="text-muted-foreground mb-0.5 italic">{{ s.narration }}</p>
                }
                <p>
                  <span class="font-medium">{{ title(s) }}</span>
                  @if (detail(s); as d) {
                    <span class="text-muted-foreground"> · {{ d }}</span>
                  }
                  @if (status(s); as st) {
                    <span class="text-muted-foreground"> · {{ st }}</span>
                  }
                </p>
                @if (s.error) {
                  <p class="text-[12.5px] text-(--negative)">{{ s.error }}</p>
                }
                @if (s.evidence && showEvidence()) {
                  <button type="button" class="k-link text-muted-foreground hover:text-foreground mt-0.5 rounded text-[12px] underline underline-offset-2" (click)="evidenceSelected.emit(s.callId)">How this was computed</button>
                }
              </li>
            }
          </ol>
        }
      </div>
    }

    @for (w of widgets(); track w.callId) {
      <kassandra-widget [slot]="w" [held]="hold.held().has(w.callId)" [question]="t.question" [showEvidence]="showEvidence()" [addable]="addToBoard()" (evidence)="evidenceSelected.emit($event)" />
    }

    @for (d of drafts(); track d.callId) {
      <article class="insight-card p-4">
        <p class="card-eyebrow text-muted-foreground">Workflow draft</p>
        <h3 class="mt-1 text-[15px] font-semibold">{{ d.draft.name }}</h3>
        <p class="text-muted-foreground mt-1 text-[13px]">{{ d.draft.goal }}</p>
        <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
          <dt class="text-muted-foreground">When</dt>
          <dd>{{ trigger(d.draft) }}</dd>
          <dt class="text-muted-foreground">Hotels</dt>
          <dd>{{ d.draft.hotels.join(', ') }}</dd>
          <dt class="text-muted-foreground">Action</dt>
          <dd>{{ d.draft.action.type.replace('_', ' ') }} · {{ autonomy(d.draft) }}</dd>
        </dl>
        <div class="mt-3 flex gap-2">
          @if (saved()[d.callId]; as id) {
            <button hlmBtn variant="secondary" size="sm" (click)="openWorkflow(id)"><ng-icon name="phosphorCheckLight" aria-hidden="true" />Saved · open</button>
          } @else {
            <button hlmBtn size="sm" [disabled]="saving()" (click)="save(d.callId, d.draft)">{{ saving() ? 'Saving…' : 'Save workflow' }}</button>
          }
        </div>
      </article>
    }

    <!-- The answer is announced once, when it is whole: not token by token -->
    <div aria-live="polite" [attr.aria-busy]="t.running" class="contents">
      @if (t.answer) {
        <app-markdown class="text-[14.5px]/[1.65]" [text]="t.answer" />
      } @else if (t.streamingText) {
        <app-markdown class="text-[14.5px]/[1.65]" [text]="t.streamingText" />
      }
    </div>

    @if (doing(); as text) {
      <div class="flex min-h-7 items-center gap-3">
        <p class="text-muted-foreground flex items-center gap-2 text-[14px]" role="status"><span class="phase-dots" aria-hidden="true"><i></i><i></i><i></i></span>{{ text }}</p>
        @if (stoppable()) {
          <button hlmBtn type="button" variant="ghost" size="sm" class="text-muted-foreground h-7 px-2 text-[12.5px]" (click)="stopped.emit()"><ng-icon name="phosphorStopFill" class="text-[10px]" aria-hidden="true" />Stop</button>
        }
      </div>
    }

    @if (t.failure; as f) {
      <p role="alert" class="border-border rounded-[10px] border border-dashed p-3 text-[13.5px]">
        <span class="font-medium">No answer this time:</span> {{ failure(f.reason) }}@if (f.detail) {<span class="text-muted-foreground"> ({{ f.detail }})</span>}
      </p>
    }

    @if (suggestions().length) {
      <ul class="flex flex-wrap gap-2 pt-1" aria-label="Ask next">
        @for (s of suggestions(); track s) {
          <li><button type="button" class="k-suggestion" (click)="suggestionPicked.emit(s)">{{ s }}<ng-icon name="phosphorArrowUpRightLight" class="text-muted-foreground shrink-0" aria-hidden="true" /></button></li>
        }
      </ul>
    }

    @if (!t.running && (t.answer || t.steps.length) && t.model) {
      <details class="k-details text-muted-foreground text-[12px]">
        <summary class="k-link w-fit cursor-pointer rounded select-none">Details</summary>
        <dl class="mt-1.5 grid w-fit grid-cols-[auto_auto] gap-x-4 gap-y-0.5 tabular-nums">
          <dt>Answered by</dt>
          <dd>{{ mode(t.model) }} <span class="opacity-80">({{ t.model }})</span></dd>
          @if (t.workedMs !== null) {
            <dt>Time</dt>
            <dd>{{ worked() }}</dd>
          }
          <dt>This answer</dt>
          <dd>{{ usage(t.usage) }}</dd>
          @if (conversationUsage(); as total) {
            <dt>Conversation so far</dt>
            <dd>{{ usage(total) }}</dd>
          }
        </dl>
      </details>
    }
  `,
})
export class KassandraTurn {
  readonly turn = input.required<ChatTurn>();
  /** What the agent is doing right now (`live.phase`), for the running turn only. */
  readonly phase = input<ChatLive['phase'] | null>(null);
  /** The tool calls of the run in progress (`live.tools`), for the running turn only: a chart gets its skeleton here. */
  readonly liveTools = input<ChatLive['tools'] | null | undefined>(null);
  /** "How this was computed" links are shown. */
  readonly showEvidence = input(true);
  /** Widgets offer "Add to board". */
  readonly addToBoard = input(true);
  /** The running answer can be stopped from here. */
  readonly stoppable = input(false);
  /** Next questions to offer under the answer. */
  readonly suggestions = input<string[]>([]);
  /** The whole conversation's spend, shown in the last turn's details. */
  readonly conversationUsage = input<Usage | null>(null);
  /** "How this was computed" for one tool result (its call id). */
  readonly evidenceSelected = output<string>();
  readonly suggestionPicked = output<string>();
  readonly stopped = output<void>();

  protected readonly stepsId = `kassandra-steps-${nextSteps++}`;
  private readonly api = inject(WorkflowsApi);
  private readonly store = inject(CompassStore);
  protected readonly open = signal(false);
  protected readonly saving = signal(false);
  protected readonly saved = signal<Record<string, string>>({});
  protected readonly title = stepTitle;
  protected readonly detail = stepDetail;
  protected readonly status = stepStatus;
  protected readonly trigger = TRIGGER;
  protected readonly failure = failureText;
  protected readonly mode = modeOf;
  protected readonly usage = usageText;
  protected readonly worked = computed(() => workedText(this.turn().workedMs) || '—');
  protected readonly doing = computed(() => phaseText(this.turn(), this.phase()));
  protected readonly count = computed(() => stepCount(this.turn(), this.liveTools()));
  /** Charts shown, and one in the making for each `show_widget` call that has started. */
  protected readonly widgets = computed(() => widgetSlots(this.turn(), this.liveTools()));
  /** A skeleton that has appeared stays for its minimum time, so a fast chart does not flicker in. */
  protected readonly hold = new SkeletonHold();

  constructor() {
    effect(() => {
      this.hold.show(
        this.widgets()
          .filter((slot) => shownPhase(slot.phase, false) !== 'ready')
          .map((slot) => slot.callId),
      );
    });
    inject(DestroyRef).onDestroy(() => this.hold.clear());
  }
  protected readonly drafts = computed(() =>
    this.turn()
      .steps.filter((step): step is ChatStep & { draft: WorkflowSpec } => !!step.draft)
      .map((step) => ({ callId: step.callId, draft: step.draft })),
  );

  protected autonomy(draft: WorkflowSpec) {
    return AUTONOMY[draft.autonomy] ?? draft.autonomy;
  }
  protected async save(callId: string, draft: WorkflowSpec) {
    this.saving.set(true);
    const result = await this.api.create(draft);
    this.saving.set(false);
    if (!result.ok) {
      toast('The workflow wasn’t saved', { description: result.error.message, duration: 8000 });
      return;
    }
    this.saved.update((map) => ({ ...map, [callId]: result.value.id }));
    toast(`${result.value.name} saved`, { description: 'It runs on its trigger from now on.', duration: 6000, action: { label: 'Open', onClick: () => this.openWorkflow(result.value.id) } });
  }
  protected openWorkflow(id: string) {
    this.store.activeWatcherId.set(id);
    this.store.go('watcher');
  }
}

/**
 * A conversation with Kassandra, wherever she appears: the Thread, a workflow run's log, a board's "describe a
 * view". The host owns the socket and passes the turns; this draws them and reports what the person asks for
 * (evidence, a next question, Stop). Content placed inside shows while there is no turn yet.
 */
@Component({
  selector: 'kassandra-conversation',
  imports: [KassandraTurn],
  host: { class: 'flex flex-col' },
  template: `
    @for (t of turns(); track t.key; let last = $last) {
      <kassandra-turn
        [turn]="t"
        [phase]="t.running ? phase() : null"
        [liveTools]="t.running ? liveTools() : null"
        [showEvidence]="showEvidence()"
        [addToBoard]="addToBoard()"
        [stoppable]="stoppable()"
        [suggestions]="last && suggest() ? next() : []"
        [conversationUsage]="last && usage()?.tokens ? usage() : null"
        (evidenceSelected)="evidenceSelected.emit({ turnKey: t.key, callId: $event })"
        (suggestionPicked)="suggestionPicked.emit($event)"
        (stopped)="stopped.emit()"
      />
    } @empty {
      <ng-content />
    }
    @if (error(); as e) {
      <p role="alert" class="border-border mt-4 rounded-[10px] border border-dashed p-3 text-[13.5px]">{{ e }}</p>
    }
  `,
})
export class KassandraConversation {
  readonly turns = input.required<ChatTurn[]>();
  /** `live.phase` of the socket: what Kassandra is doing while no answer text has arrived. */
  readonly phase = input<ChatLive['phase'] | null | undefined>(null);
  /** `live.tools` of the socket: a chart Kassandra has started on shows as a skeleton before its entry is committed. */
  readonly liveTools = input<ChatLive['tools'] | null | undefined>(null);
  /** The last message the server rejected (rate limit, budget), shown as is. */
  readonly error = input<string | null>(null);
  /** Tokens and cost of the whole conversation, shown behind the last answer's "Details". */
  readonly usage = input<Usage | null>(null);
  readonly showEvidence = input(true);
  readonly addToBoard = input(true);
  /** Offer next questions under the last answer. */
  readonly suggest = input(false);
  /** Show Stop next to what Kassandra is doing. */
  readonly stoppable = input(false);
  readonly evidenceSelected = output<EvidenceSelection>();
  readonly suggestionPicked = output<string>();
  readonly stopped = output<void>();

  protected readonly next = computed(() => {
    const last = this.turns().at(-1);
    return last ? followUps(last) : [];
  });
}
