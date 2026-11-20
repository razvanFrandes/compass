import { Component, ElementRef, OnInit, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import type { WorkflowDraft, WorkflowNode } from '@compass/contracts';
import { HlmButtonImports } from '@spartan-ng/helm/button';

type TriggerChoice = 'day' | 'week' | 'manual' | 'brief';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What a node's editor starts from. Pure, so the editor reads the draft once when it opens. */
export function editorValues(draft: WorkflowDraft): { trigger: TriggerChoice | null; hotels: string; name: string; goal: string; email: string } {
  const trigger = draft.trigger;
  return {
    trigger: !trigger ? null : trigger.kind === 'schedule' ? trigger.every : trigger.kind,
    hotels: (draft.hotels ?? []).join(', '),
    name: draft.name ?? '',
    goal: draft.goal ?? '',
    email: draft.delivery?.to ?? '',
  };
}

/** "lis, opo" → ["LIS", "OPO"]; "all" → ["ALL"]. */
export function parseHotels(value: string): string[] {
  const codes = [...new Set(value.split(/[\s,;]+/).map((code) => code.trim().toUpperCase()).filter(Boolean))];
  return codes.includes('ALL') ? ['ALL'] : codes;
}

/**
 * The patch a node's form sends, or the reason it cannot be sent yet. The server validates again; this only
 * catches what the person can fix before a round trip.
 */
export function nodePatch(
  node: Pick<WorkflowNode, 'id' | 'kind'>,
  draft: WorkflowDraft,
  values: { trigger: TriggerChoice | null; hotels: string; name: string; goal: string; email: string },
): { patch: WorkflowDraft } | { error: string } {
  switch (node.kind) {
    case 'trigger': {
      if (!values.trigger) return { error: 'Choose when it runs.' };
      if (values.trigger === 'manual') return { patch: { trigger: { kind: 'manual' } } };
      if (values.trigger === 'brief') return draft.trigger ? { patch: { trigger: draft.trigger } } : { error: 'Choose when it runs.' };
      return { patch: { trigger: { kind: 'schedule', every: values.trigger } } };
    }
    case 'scope': {
      const hotels = parseHotels(values.hotels);
      return hotels.length ? { patch: { hotels } } : { error: 'Enter at least one hotel code, or ALL.' };
    }
    case 'check':
      return { patch: { checks: (draft.checks ?? []).filter((tool) => `check:${tool}` !== node.id) } };
    case 'analyze': {
      const name = values.name.trim();
      const goal = values.goal.trim();
      if (name.length < 3 || name.length > 80) return { error: 'Give it a name of 3 to 80 characters.' };
      if (goal.length < 10 || goal.length > 1000) return { error: 'Describe the goal in 10 to 1,000 characters.' };
      return { patch: { name, goal } };
    }
    case 'action': {
      const to = values.email.trim();
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
  imports: [HlmButtonImports],
  host: { class: 'block', '(keydown.escape)': '$event.stopPropagation(); closed.emit()' },
  styles: `
    .wb-input {
      width: 100%;
      min-height: 36px;
      padding: 7px 10px;
      border-radius: 8px;
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
    .wb-input:focus-visible { border-color: var(--focus-brand); box-shadow: 0 0 0 3px rgb(153 106 213 / 0.28); }
    .wb-input[aria-invalid='true'] { border-color: var(--destructive); }
    textarea.wb-input { resize: vertical; min-height: 96px; }
    .wb-choice {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 40px;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid var(--input);
      font-size: 14px;
      cursor: pointer;
      transition: border-color 150ms ease, background-color 150ms ease;
    }
    .wb-choice:has(input:checked) { border-color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
    .wb-choice:has(input:focus-visible) { box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring); }
    .wb-choice input { accent-color: var(--primary); width: 16px; height: 16px; }
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
          <div class="flex flex-col gap-1.5">
            <label class="text-[13px] font-medium" [for]="uid + '-hotels'">Hotels</label>
            <input
              class="wb-input uppercase placeholder:normal-case"
              [id]="uid + '-hotels'"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              placeholder="LIS, OPO or ALL"
              [value]="hotels()"
              (input)="hotels.set($any($event.target).value)"
              [attr.aria-invalid]="error() ? 'true' : null"
              [attr.aria-describedby]="uid + '-hotels-hint' + (error() ? ' ' + uid + '-error' : '')"
            />
            <p class="text-muted-foreground text-[12.5px]" [id]="uid + '-hotels-hint'">Hotel codes separated by commas, or ALL for the whole group.</p>
          </div>
        }
        @case ('check') {
          <p class="text-muted-foreground text-[13px]/relaxed">Kassandra reads this first on every run. Ask in the chat to add another check.</p>
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
              placeholder="you@example.com"
              [value]="email()"
              (input)="email.set($any($event.target).value)"
              [attr.aria-invalid]="error() ? 'true' : null"
              [attr.aria-describedby]="uid + '-email-hint' + (error() ? ' ' + uid + '-error' : '')"
            />
            <p class="text-muted-foreground text-[12.5px]" [id]="uid + '-email-hint'">One address. Only you see it in full.</p>
          </div>
        }
      }

      @if (error(); as message) {
        <p class="text-destructive text-[13px]" role="alert" [id]="uid + '-error'">{{ message }}</p>
      }

      <div class="flex items-center justify-end gap-2">
        <button hlmBtn type="button" variant="ghost" size="sm" (click)="closed.emit()">Cancel</button>
        @if (node().kind === 'check') {
          <button hlmBtn type="submit" variant="outline" size="sm">Remove check</button>
        } @else {
          <button hlmBtn type="submit" size="sm">Apply</button>
        }
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

  protected readonly trigger = signal<TriggerChoice | null>(null);
  protected readonly hotels = signal('');
  protected readonly name = signal('');
  protected readonly goal = signal('');
  protected readonly email = signal('');
  protected readonly error = signal<string | null>(null);

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
      const target = root.querySelector<HTMLElement>('input:checked, input:not([type=radio]), textarea') ?? root.querySelector<HTMLElement>('input, button');
      target?.focus();
    });
  }

  /** The form reads the draft once, when it opens: a change from the chat must not overwrite what is being typed. */
  ngOnInit() {
    const values = editorValues(this.draft());
    this.trigger.set(values.trigger);
    this.hotels.set(values.hotels);
    this.name.set(values.name);
    this.goal.set(values.goal);
    this.email.set(values.email);
  }

  protected submit() {
    const result = nodePatch(this.node(), this.draft(), { trigger: this.trigger(), hotels: this.hotels(), name: this.name(), goal: this.goal(), email: this.email() });
    if ('error' in result) {
      this.error.set(result.error);
      return;
    }
    this.error.set(null);
    this.patch.emit(result.patch);
    this.closed.emit();
  }
}
