import { Component, ElementRef, OnInit, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import type { WorkflowDraft, WorkflowNode } from '@compass/contracts';
import { CHECK_LABELS } from '@compass/contracts';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HotelPicker } from '../scope/hotel-picker';
import { ScopeService } from '../scope/scope.service';

type TriggerChoice = 'day' | 'week' | 'manual' | 'brief';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** At most this many checks in a workflow (docs/api.md, `edit`). */
export const MAX_CHECKS = 8;

/** An address as everyone but its owner sees it: `si****@gmail.com`. A saved workflow opens with it masked. */
export const isMasked = (address: string | undefined) => !!address && address.includes('****');

/** What each labelled check reads, in a hotelier's words. The labels themselves are `CHECK_LABELS`. */
export const CHECK_HINTS: Record<string, string> = {
  get_pace: 'Rooms and revenue on the books against the same time last year',
  get_pickup: 'What was booked in the last days, by stay night',
  get_rate_position: 'Your rate against the comp set, night by night',
  get_channel_mix: 'Where the bookings come from and what each channel costs',
  get_mix: 'Segments and channels of the business on the books',
  get_metric: 'Occupancy, ADR, RevPAR or revenue for a period',
  get_forecast: 'The forecast range against the books and the budget',
  get_pnl: 'Revenue, costs and GOP against budget and last year',
  get_data_health: 'Whether every source system has synced',
  get_web_funnel: 'Searches, checkout starts and bookings on the website',
  get_account_production: 'Room nights and revenue of each corporate account',
  get_review_scores: 'Guest review scores, by source and by topic',
  find_reviews: 'Reviews about a subject, found by meaning',
  get_brief: 'Today’s findings from the morning brief',
};

export interface CheckOption {
  tool: string;
  label: string;
  hint: string;
}

/** The checks a person can pick by hand: the labelled ones, then any other tool the draft already reads. */
export function checkOptions(draft: WorkflowDraft): CheckOption[] {
  const extra = (draft.checks ?? []).filter((tool) => !(tool in CHECK_LABELS));
  return [...Object.keys(CHECK_LABELS), ...new Set(extra)].map((tool) => ({
    tool,
    label: CHECK_LABELS[tool] ?? tool.replace(/^get_/, '').replace(/_/g, ' '),
    hint: CHECK_HINTS[tool] ?? 'Chosen by Kassandra',
  }));
}

export interface EditorValues {
  trigger: TriggerChoice | null;
  /** Hotel codes; empty means the whole group (the draft's `['ALL']`). */
  hotels: string[];
  /** Tool names, in the order they run. */
  checks: string[];
  name: string;
  goal: string;
  email: string;
}

/**
 * What a node's editor starts from. Pure, so the editor reads the draft once when it opens.
 * A draft with no hotels yet starts from `scope`, the hotels the person is working on. A masked address starts
 * empty: it cannot be sent back, and leaving the field empty keeps it.
 */
export function editorValues(draft: WorkflowDraft, scope: readonly string[] = []): EditorValues {
  const trigger = draft.trigger;
  const hotels = draft.hotels?.length ? (draft.hotels.includes('ALL') ? [] : [...draft.hotels]) : [...scope];
  const to = draft.delivery?.to ?? '';
  return {
    trigger: !trigger ? null : trigger.kind === 'schedule' ? trigger.every : trigger.kind,
    hotels,
    checks: [...new Set(draft.checks ?? [])],
    name: draft.name ?? '',
    goal: draft.goal ?? '',
    email: isMasked(to) ? '' : to,
  };
}

/**
 * The patch a node's form sends, or the reason it cannot be sent yet. The server validates again; this only
 * catches what the person can fix before a round trip. An empty patch means there is nothing to change.
 */
export function nodePatch(node: Pick<WorkflowNode, 'id' | 'kind'>, draft: WorkflowDraft, values: EditorValues): { patch: WorkflowDraft } | { error: string } {
  switch (node.kind) {
    case 'trigger': {
      if (!values.trigger) return { error: 'Choose when it runs.' };
      if (values.trigger === 'manual') return { patch: { trigger: { kind: 'manual' } } };
      if (values.trigger === 'brief') return draft.trigger ? { patch: { trigger: draft.trigger } } : { error: 'Choose when it runs.' };
      return { patch: { trigger: { kind: 'schedule', every: values.trigger } } };
    }
    case 'scope':
      return { patch: { hotels: values.hotels.length ? [...values.hotels] : ['ALL'] } };
    case 'check': {
      const checks = [...new Set(values.checks)];
      if (checks.length > MAX_CHECKS) return { error: `Choose at most ${MAX_CHECKS} checks.` };
      return { patch: { checks } };
    }
    case 'analyze': {
      const name = values.name.trim();
      const goal = values.goal.trim();
      if (name.length < 3 || name.length > 80) return { error: 'Give it a name of 3 to 80 characters.' };
      if (goal.length < 10 || goal.length > 1000) return { error: 'Describe the goal in 10 to 1,000 characters.' };
      return { patch: { name, goal } };
    }
    case 'action': {
      const to = values.email.trim();
      // A saved workflow shows its address masked; an empty field keeps that address.
      if (!to && draft.action?.type === 'email' && isMasked(draft.delivery?.to)) return { patch: {} };
      if (!EMAIL.test(to) || to.length > 254) return { error: 'Enter one email address, like ana@example.com.' };
      const guidance = draft.action?.type === 'email' ? (draft.action.guidance ?? '') : '';
      return { patch: { action: { type: 'email', guidance }, delivery: { channel: 'email', to } } };
    }
    default:
      return { error: 'This step cannot be edited by hand.' };
  }
}

/** The small form inside a node: it sends one `edit` patch and closes. */
@Component({
  selector: 'app-workflow-node-editor',
  imports: [HlmButtonImports, HotelPicker],
  host: { class: 'block', '(keydown.escape)': '$event.stopPropagation(); closed.emit()' },
  styles: `
    .wb-input {
      width: 100%;
      min-height: 36px;
      padding: 7px 10px;
      border-radius: var(--radius-control, 8px);
      border: 1px solid var(--input);
      background: var(--field);
      color: var(--foreground);
      font-size: 14px;
      line-height: 20px;
      outline: none;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }
    @media (pointer: coarse) {
      .wb-input { min-height: 44px; font-size: 16px; }
    }
    .wb-input::placeholder { color: var(--muted-foreground); }
    .wb-input:focus-visible { border-color: var(--focus-brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus-brand) 28%, transparent); }
    .wb-input[aria-invalid='true'] { border-color: var(--destructive); }
    textarea.wb-input { resize: vertical; min-height: 96px; }
    .wb-choice {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 40px;
      padding: 8px 10px;
      border-radius: var(--radius-control, 8px);
      border: 1px solid var(--input);
      font-size: 14px;
      cursor: pointer;
      transition: border-color 150ms ease, background-color 150ms ease;
    }
    .wb-choice:has(input:checked) { border-color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
    .wb-choice:has(input:focus-visible) { box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring); }
    .wb-choice input { accent-color: var(--primary); width: 16px; height: 16px; flex-shrink: 0; }
    .wb-checks { display: flex; flex-direction: column; gap: 6px; max-height: 340px; overflow-y: auto; overscroll-behavior: contain; margin: 0 -4px; padding: 2px 4px; }
    .wb-choice:has(input:disabled) { opacity: 0.55; cursor: default; }
    .wb-checks .wb-choice { flex-shrink: 0; }
    .wb-picker { height: 460px; max-height: 64dvh; }
    @media (prefers-reduced-motion: reduce) {
      .wb-input, .wb-choice { transition: none; }
    }
  `,
  template: `
    <form class="flex flex-col gap-3 px-3.5 pt-1 pb-3.5" novalidate (submit)="$event.preventDefault(); submit()">
      @switch (node().kind) {
        @case ('trigger') {
          <fieldset class="flex flex-col gap-1.5">
            <legend class="mb-1.5 text-[13px] font-medium">When should it run?</legend>
            @for (option of triggerOptions(); track option.value) {
              <label class="wb-choice">
                <input type="radio" [name]="uid + '-trigger'" [value]="option.value" [checked]="trigger() === option.value" (change)="trigger.set(option.value)" />
                <span>
                  <span class="block">{{ option.label }}</span>
                  <span class="text-muted-foreground block text-[12.5px]">{{ option.hint }}</span>
                </span>
              </label>
            }
          </fieldset>
        }
        @case ('scope') {
          <div class="flex flex-col gap-2">
            <p class="text-[13px] font-medium">Which hotels should it watch?</p>
            <app-hotel-picker class="wb-picker" label="Search the hotels to watch" [hotels]="scope.catalog()" [(value)]="hotels" />
            <p class="text-muted-foreground text-[12.5px]" role="status">{{ hotelsSummary() }}</p>
          </div>
        }
        @case ('check') {
          <fieldset class="flex flex-col">
            <legend class="text-[13px] font-medium">What should it read first?</legend>
            <p class="text-muted-foreground mt-0.5 mb-2 text-[12.5px]" [id]="uid + '-checks-hint'">Kassandra reads these on every run, then looks further if she needs to. Up to {{ maxChecks }}.</p>
            <div class="wb-checks">
              @for (option of checkOptions(); track option.tool) {
                <label class="wb-choice">
                  <input type="checkbox" [checked]="checks().includes(option.tool)" [disabled]="!checks().includes(option.tool) && checks().length >= maxChecks" [attr.aria-describedby]="uid + '-checks-hint'" (change)="toggleCheck(option.tool, $any($event.target).checked)" />
                  <span>
                    <span class="block">{{ option.label }}</span>
                    <span class="text-muted-foreground block text-[12.5px]">{{ option.hint }}</span>
                  </span>
                </label>
              }
            </div>
            <p class="text-muted-foreground mt-2 text-[12.5px]" role="status">{{ checksSummary() }}</p>
          </fieldset>
        }
        @case ('analyze') {
          <div class="flex flex-col gap-1.5">
            <label class="text-[13px] font-medium" [for]="uid + '-name'">Name</label>
            <input class="wb-input" [id]="uid + '-name'" autocomplete="off" maxlength="80" placeholder="Lisbon pace alert" [value]="name()" (input)="name.set($any($event.target).value)" [attr.aria-describedby]="error() ? uid + '-error' : null" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[13px] font-medium" [for]="uid + '-goal'">Goal</label>
            <textarea
              class="wb-input"
              [id]="uid + '-goal'"
              rows="4"
              maxlength="1000"
              placeholder="What should it watch, and when should it act?"
              [value]="goal()"
              (input)="goal.set($any($event.target).value)"
              [attr.aria-describedby]="uid + '-goal-hint' + (error() ? ' ' + uid + '-error' : '')"
            ></textarea>
            <p class="text-muted-foreground text-[12.5px]" [id]="uid + '-goal-hint'">Plain language: what to watch, the threshold, and when to act.</p>
          </div>
        }
        @case ('action') {
          <div class="flex flex-col gap-1.5">
            <label class="text-[13px] font-medium" [for]="uid + '-email'">Send an email to</label>
            <input
              class="wb-input"
              type="email"
              inputmode="email"
              autocomplete="email"
              spellcheck="false"
              [id]="uid + '-email'"
              [placeholder]="keptAddress() || 'you@example.com'"
              [value]="email()"
              (input)="email.set($any($event.target).value)"
              [attr.aria-invalid]="error() ? 'true' : null"
              [attr.aria-describedby]="uid + '-email-hint' + (error() ? ' ' + uid + '-error' : '')"
            />
            @if (keptAddress(); as kept) {
              <p class="text-muted-foreground text-[12.5px]" [id]="uid + '-email-hint'">It sends to {{ kept }} now. Leave this empty to keep it. A new address is saved as a new agent, and this one is turned off.</p>
            } @else {
              <p class="text-muted-foreground text-[12.5px]" [id]="uid + '-email-hint'">One address. Only you see it in full.</p>
            }
          </div>
        }
      }

      @if (error(); as message) {
        <p class="text-destructive text-[13px]" role="alert" [id]="uid + '-error'">{{ message }}</p>
      }

      <div class="flex items-center justify-end gap-2">
        <button hlmBtn type="button" variant="ghost" size="sm" (click)="closed.emit()">Cancel</button>
        <button hlmBtn type="submit" size="sm">Apply</button>
      </div>
    </form>
  `,
})
export class WorkflowNodeEditor implements OnInit {
  readonly node = input.required<WorkflowNode>();
  readonly draft = input.required<WorkflowDraft>();
  readonly patch = output<WorkflowDraft>();
  readonly closed = output<void>();

  private static next = 0;
  protected readonly uid = `wb-editor-${WorkflowNodeEditor.next++}`;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly scope = inject(ScopeService);
  protected readonly maxChecks = MAX_CHECKS;

  protected readonly trigger = signal<TriggerChoice | null>(null);
  protected readonly hotels = signal<string[]>([]);
  protected readonly checks = signal<string[]>([]);
  protected readonly name = signal('');
  protected readonly goal = signal('');
  protected readonly email = signal('');
  protected readonly error = signal<string | null>(null);

  protected readonly checkOptions = computed(() => checkOptions(this.draft()));
  protected readonly hotelsSummary = computed(() => {
    const count = this.hotels().length;
    const all = this.scope.catalog().length;
    return count ? `It will watch ${count} of ${all} hotels.` : `It will watch all ${all} hotels.`;
  });
  protected readonly checksSummary = computed(() => {
    const count = this.checks().length;
    return count === 0 ? 'No check chosen: Kassandra decides what to read.' : count === 1 ? '1 check chosen.' : `${count} checks chosen.`;
  });
  /** The masked address of a saved email workflow, which an empty field keeps. */
  protected readonly keptAddress = computed(() => {
    const draft = this.draft();
    return draft.action?.type === 'email' && isMasked(draft.delivery?.to) ? draft.delivery!.to : '';
  });

  protected readonly triggerOptions = computed(() => {
    const options: { value: TriggerChoice; label: string; hint: string }[] = [
      { value: 'day', label: 'Every morning', hint: 'After the morning brief' },
      { value: 'week', label: 'Every week', hint: 'After the morning brief, once a week' },
      { value: 'manual', label: 'By hand', hint: 'Only when someone starts it' },
    ];
    // A brief finding is chosen in the chat; the editor keeps it as an option instead of dropping it.
    if (this.draft().trigger?.kind === 'brief') options.push({ value: 'brief', label: this.node().label, hint: 'After the morning brief' });
    return options;
  });

  constructor() {
    // Focus lands on the chosen radio, else on the first control, so the keyboard continues inside the form.
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const target = root.querySelector<HTMLElement>('input[type=radio]:checked, input:not([type=radio]), textarea') ?? root.querySelector<HTMLElement>('input, button');
      target?.focus();
    });
  }

  /** The form reads the draft once, when it opens: a change from the chat must not overwrite what is being typed. */
  ngOnInit() {
    const values = editorValues(this.draft(), this.scope.hotels());
    this.trigger.set(values.trigger);
    this.hotels.set(values.hotels);
    this.checks.set(values.checks);
    this.name.set(values.name);
    this.goal.set(values.goal);
    this.email.set(values.email);
  }

  /** A new check goes last, so the checks keep the order they were chosen in. */
  protected toggleCheck(tool: string, on: boolean) {
    this.checks.update((checks) => (on ? [...checks.filter((c) => c !== tool), tool] : checks.filter((c) => c !== tool)));
  }

  protected submit() {
    const result = nodePatch(this.node(), this.draft(), { trigger: this.trigger(), hotels: this.hotels(), checks: this.checks(), name: this.name(), goal: this.goal(), email: this.email() });
    if ('error' in result) {
      this.error.set(result.error);
      return;
    }
    this.error.set(null);
    if (Object.keys(result.patch).length) this.patch.emit(result.patch);
    this.closed.emit();
  }
}
