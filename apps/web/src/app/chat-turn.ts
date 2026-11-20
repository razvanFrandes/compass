import { Component, computed, inject, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import type { WorkflowSpec } from '@compass/contracts';
import type { ChatLive } from '@compass/contracts';
import { ChatStep, ChatTurn, WorkflowsApi } from './api';
import { Markdown } from './markdown';
import { CompassStore } from './store';
import * as icons from './icons';

/** "get_pace_vs_stly" → "Get pace vs stly". */
export const toolLabel = (name: string) => {
  const s = name.replace(/^mcp__\w+__/, '').replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
/** The few arguments worth reading, e.g. "LIS · 2026-11-21 → 2026-12-20". */
export const argsLine = (args: Record<string, unknown>) =>
  Object.entries(args)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && typeof v !== 'object')
    .slice(0, 4)
    .map(([, v]) => String(v))
    .join(' · ');
/** "52.6k tokens · $0.05": the cost, kept quiet (the exact figures are in the tooltip). */
export const usageText = (u: { tokens: number; costUsd: number }) =>
  `${u.tokens >= 1000 ? `${(u.tokens / 1000).toFixed(1)}k` : u.tokens} tokens · $${u.costUsd < 0.01 ? u.costUsd.toFixed(3) : u.costUsd.toFixed(2)}`;
const PHASE_TEXT: Record<string, string> = { waiting: 'Thinking…', thinking: 'Thinking…', tools: 'Checking the data…', writing: 'Writing…' };
const seconds = (ms: number | null) => (ms === null ? '' : ms < 1000 ? '<1s' : `${Math.round(ms / 1000)}s`);
const TRIGGER = (w: WorkflowSpec) => (w.trigger.kind === 'schedule' ? `Every ${w.trigger.every}` : w.trigger.kind === 'brief' ? `When the brief finds ${w.trigger.finding.replace(/_/g, ' ')}` : 'When you run it');

/**
 * One turn of a Kassandra conversation (or of a workflow run's log): the question, the work collapsed to one line
 * ("Worked for 4s · 3 steps"), the answer streaming in, a failure in plain words, and a drafted workflow as a card
 * with Save. The agent's narration between tool rounds is shown as a step, never as the answer.
 */
@Component({
  selector: 'app-chat-turn',
  imports: [NgIcon, HlmButtonImports, Markdown],
  providers: [provideIcons({ ...icons })],
  host: { class: 'flex flex-col gap-3 pt-5' },
  template: `
    @let t = turn();
    @if (t.question) {
      <div class="flex justify-end">
        <p class="bg-muted max-w-[85%] rounded-[14px] rounded-br-[4px] px-3.5 py-2 text-[14px]/relaxed" [class.opacity-60]="t.pending">
          {{ t.question }}
          @if (t.pending) {
            <span class="text-muted-foreground block text-[11.5px]">Sending…</span>
          }
        </p>
      </div>
    }

    @if (t.steps.length) {
      <div>
        <button type="button" class="text-muted-foreground hover:text-foreground group flex items-center gap-1.5 text-[12.5px] transition-colors" [attr.aria-expanded]="open()" (click)="open.set(!open())">
          @if (t.running) {
            <ng-icon name="phosphorCircleNotchLight" class="animate-spin motion-reduce:animate-none" />
            {{ runningLabel() }}
          } @else {
            Worked for {{ worked() }} · {{ t.steps.length }} {{ t.steps.length === 1 ? 'step' : 'steps' }}
          }
          <ng-icon name="phosphorCaretDownLight" class="transition-transform" [class.rotate-180]="open()" />
        </button>
        @if (open()) {
          <ol class="border-border mt-2 ml-1.5 flex flex-col gap-2 border-l pl-4 text-[13px]">
            @for (s of t.steps; track s.callId) {
              <li class="relative">
                <span class="absolute top-1.5 -left-[21px] size-2 rounded-full" [class]="s.status === 'error' ? 'bg-(--negative)' : s.status === 'done' ? 'bg-(--series-muted)' : 'bg-(--series) animate-pulse motion-reduce:animate-none'" aria-hidden="true"></span>
                @if (s.narration) {
                  <p class="text-muted-foreground mb-0.5 italic">{{ s.narration }}</p>
                }
                <p>
                  <span class="font-medium">{{ label(s.name) }}</span>
                  @if (args(s); as a) {
                    <span class="text-muted-foreground"> · {{ a }}</span>
                  }
                  <span class="text-muted-foreground"> · {{ statusText(s) }}</span>
                </p>
                @if (s.error) {
                  <p class="text-(--negative) text-[12.5px]">{{ s.error }}</p>
                }
                @if (s.evidence && showEvidence()) {
                  <button type="button" class="text-muted-foreground hover:text-foreground mt-0.5 text-[12px] underline underline-offset-2" (click)="evidence.emit(s.callId)">How this was computed</button>
                }
              </li>
            }
          </ol>
        }
      </div>
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
          <dd>{{ d.draft.action.type.replace('_', ' ') }} · {{ d.draft.autonomy === 'suggest' ? 'suggest only' : d.draft.autonomy === 'approve' ? 'after you approve' : 'low-risk on its own' }}</dd>
        </dl>
        <div class="mt-3 flex gap-2">
          @if (saved()[d.callId]; as id) {
            <button hlmBtn variant="secondary" size="sm" (click)="openWorkflow(id)"><ng-icon name="phosphorCheckLight" />Saved · open</button>
          } @else {
            <button hlmBtn size="sm" [disabled]="saving()" (click)="save(d.callId, d.draft)">{{ saving() ? 'Saving…' : 'Save workflow' }}</button>
          }
        </div>
      </article>
    }

    @if (waitingText(); as w) {
      <!-- Thinker answers arrive in one piece at the end (provider behaviour), so say what is happening meanwhile -->
      <p class="text-muted-foreground flex items-center gap-2 text-[14px]" role="status">
        <span class="phase-dots" aria-hidden="true"><i></i><i></i><i></i></span>{{ w }}
      </p>
    }
    @if (t.answer) {
      <app-markdown class="text-[14.5px]/[1.65]" [text]="t.answer" />
    } @else if (t.streamingText) {
      <app-markdown class="text-[14.5px]/[1.65]" [text]="t.streamingText" aria-live="polite" />
    }
    @if (t.failure; as f) {
      <p role="alert" class="border-border text-[13.5px] rounded-[10px] border border-dashed p-3">
        <span class="font-medium">No answer this time:</span> {{ failureText(f.reason) }}@if (f.detail) {<span class="text-muted-foreground"> ({{ f.detail }})</span>}
      </p>
    }
    @if (!t.running && (t.answer || t.steps.length) && t.model) {
      <p class="text-muted-foreground/80 text-[11.5px] tabular-nums" [title]="t.model + ' · ' + tokens() + ' tokens · $' + t.usage.costUsd.toFixed(4)">{{ modeOf(t.model) }} · {{ usage() }}</p>
    }
  `,
})
export class ChatTurnView {
  readonly turn = input.required<ChatTurn>();
  readonly showEvidence = input(true);
  /** What the agent is doing right now (`live.phase`), for the running turn only. */
  readonly phase = input<ChatLive['phase'] | null>(null);
  /** "How this was computed" for one step: the thread opens its evidence panel on it. */
  readonly evidence = output<string>();
  private readonly api = inject(WorkflowsApi);
  private readonly store = inject(CompassStore);
  protected readonly open = signal(false);
  protected readonly saving = signal(false);
  protected readonly saved = signal<Record<string, string>>({});
  protected readonly label = toolLabel;
  protected readonly trigger = TRIGGER;
  protected readonly worked = computed(() => seconds(this.turn().workedMs) || '—');
  protected readonly tokens = computed(() => this.turn().usage.tokens.toLocaleString('en-GB'));
  protected readonly usage = computed(() => usageText(this.turn().usage));
  /** The answer mode, read from the model that wrote it: Quick runs on Haiku, Thinker on Sonnet. */
  protected modeOf(model: string) {
    return /haiku/i.test(model) ? 'Quick' : /sonnet|opus/i.test(model) ? 'Thinker' : model.replace(/^.*\//, '');
  }
  protected readonly drafts = computed(() => this.turn().steps.filter((s): s is ChatStep & { draft: WorkflowSpec } => !!s.draft).map((s) => ({ callId: s.callId, draft: s.draft })));
  /** Shown in the answer's place while a run is going and no text has arrived yet. */
  protected readonly waitingText = computed(() => {
    const t = this.turn();
    if (!t.running || t.answer || t.streamingText) return null;
    return PHASE_TEXT[this.phase() ?? ''] ?? (t.steps.some((s) => s.status !== 'done' && s.status !== 'error') ? 'Checking the data…' : 'Thinking…');
  });
  /** The collapsed steps while the run goes on; what it is doing right now is the status line below. */
  protected readonly runningLabel = computed(() => {
    const n = this.turn().steps.length;
    return `Working · ${n} ${n === 1 ? 'step' : 'steps'} so far`;
  });

  protected args(s: ChatStep) {
    return argsLine(s.args);
  }
  protected statusText(s: ChatStep) {
    if (s.status === 'done') return s.rows ? `${s.rows.length} ${s.rows.length === 1 ? 'row' : 'rows'}` : s.sent === false ? 'nothing sent' : s.sent ? 'sent' : 'done';
    if (s.status === 'error') return 'failed';
    return String(s.status);
  }
  protected failureText(reason: string) {
    return (
      ({ aborted: 'you stopped it', model_error: 'the model returned an error', turn_limit: 'it took too many steps', budget: 'today’s budget is used up' } as Record<string, string>)[reason] ?? reason.replace(/_/g, ' ')
    );
  }
  protected async save(callId: string, draft: WorkflowSpec) {
    this.saving.set(true);
    const r = await this.api.create(draft);
    this.saving.set(false);
    if (!r.ok) {
      toast('The workflow wasn’t saved', { description: r.error.message, duration: 8000 });
      return;
    }
    this.saved.update((m) => ({ ...m, [callId]: r.value.id }));
    toast(`${r.value.name} saved`, { description: 'It runs on its trigger from now on.', duration: 6000, action: { label: 'Open', onClick: () => this.openWorkflow(r.value.id) } });
  }
  protected openWorkflow(id: string) {
    this.store.activeWatcherId.set(id);
    this.store.go('watcher');
  }
}
