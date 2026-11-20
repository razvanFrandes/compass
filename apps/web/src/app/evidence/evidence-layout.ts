import { Component, DestroyRef, DOCUMENT, ElementRef, Injector, afterNextRender, computed, effect, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorSidebarSimpleLight, phosphorXLight } from '@ng-icons/phosphor-icons/light';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { EvidencePanel } from './evidence-panel';
import { SplitPane } from './split-pane';
import type { EvidenceEntry } from './types';

/** From this width the evidence sits beside the conversation; below it, it opens as a bottom sheet. */
const DESKTOP = '(min-width: 1024px)';

/**
 * A conversation with its evidence. Whatever is projected (the conversation) takes the first pane. On wide
 * screens "How this was computed" is the second pane, behind a divider that can be dragged, moved with the
 * keyboard, reset and collapsed. On phones it is a bottom sheet: a modal dialog, so focus stays inside it and Esc
 * or a tap outside closes it.
 *
 * Call `open(callId?)` to show the evidence (it un-collapses the pane, or opens the sheet) and, with a call id,
 * to open that tool call's card.
 */
@Component({
  selector: 'juyo-evidence-layout',
  imports: [NgIcon, HlmButtonImports, SplitPane, EvidencePanel],
  providers: [provideIcons({ phosphorSidebarSimpleLight, phosphorXLight })],
  host: { class: 'flex h-full min-h-0 w-full min-w-0' },
  styles: `
    .ev-sheet {
      position: fixed;
      inset: auto 0 0 0;
      display: none;
      width: 100%;
      max-width: none;
      height: min(88dvh, 760px);
      max-height: none;
      margin: 0;
      padding: 0;
      flex-direction: column;
      /* clip, not hidden: the sheet itself must never scroll, only its body */
      overflow: clip;
      border: 0;
      border-top: 1px solid var(--input);
      border-radius: var(--radius-overlay, 18px) var(--radius-overlay, 18px) 0 0;
      background: var(--background);
      color: var(--foreground);
      box-shadow: var(--dialog-shadow, 0 -24px 60px -12px rgb(0 0 0 / 0.6));
    }
    .ev-sheet[open] {
      display: flex;
      animation: ev-sheet-in 280ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }
    .ev-sheet::backdrop {
      background: var(--scrim, rgb(4 7 11 / 0.62));
      animation: ev-backdrop-in 200ms ease-out both;
    }
    .ev-grab {
      flex: none;
      width: 36px;
      height: 4px;
      margin: 8px auto 0;
      border-radius: 2px;
      background: var(--input);
    }
    @keyframes ev-sheet-in {
      from {
        transform: translateY(24px);
        opacity: 0;
      }
    }
    @keyframes ev-backdrop-in {
      from {
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .ev-sheet[open],
      .ev-sheet::backdrop {
        animation: none;
      }
    }
  `,
  template: `
    <juyo-split-pane
      #split
      [storageKey]="storageKey()"
      [single]="!desktop()"
      [(collapsed)]="collapsed"
      label="Resize the conversation and how this was computed"
      startLabel="conversation"
      endLabel="how this was computed"
    >
      <div paneStart class="flex h-full min-h-0 min-w-0 flex-1 flex-col"><ng-content /></div>
      @if (desktop()) {
        <aside paneEnd class="flex h-full min-h-0 min-w-0 flex-1 flex-col" aria-label="How this was computed">
          <header class="border-border/70 flex h-14 shrink-0 items-center gap-2 border-b pr-3 pl-5">
            <div class="min-w-0 flex-1">
              <h2 class="truncate text-[14px]/5 font-medium">How this was computed</h2>
              @if (subject(); as about) {
                <p class="text-muted-foreground truncate text-[12.5px]/[18px]" [attr.title]="about">{{ about }}</p>
              }
            </div>
            <button hlmBtn variant="ghost" size="icon-sm" class="text-muted-foreground shrink-0" aria-label="Hide how this was computed" title="Hide" (click)="split.collapse()">
              <ng-icon name="phosphorSidebarSimpleLight" class="-scale-x-100 text-[18px]" />
            </button>
          </header>
          <div class="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-8">
            <juyo-evidence-panel [entries]="entries()" [answer]="answer()" [focusCallId]="focus()" [focusColumns]="focusColumns()" [empty]="empty()" />
          </div>
        </aside>
      }
    </juyo-split-pane>

    @if (!desktop()) {
      <dialog #sheet class="ev-sheet" [attr.aria-labelledby]="uid + '-title'" (close)="sheetOpen.set(false)" (click)="backdrop($event)">
        <span class="ev-grab" aria-hidden="true"></span>
        <header class="flex shrink-0 items-center gap-2 pt-1 pr-2 pb-2 pl-4">
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-[15px]/6 font-semibold" [id]="uid + '-title'">How this was computed</h2>
            @if (subject(); as about) {
              <p class="text-muted-foreground truncate text-[12.5px]/[18px]">{{ about }}</p>
            }
          </div>
          <button hlmBtn variant="ghost" size="icon-lg" class="shrink-0" aria-label="Close" (click)="closeSheet()"><ng-icon name="phosphorXLight" /></button>
        </header>
        <div class="border-border/70 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t px-4 pt-4 pb-[max(24px,env(safe-area-inset-bottom,0px))]">
          @if (sheetOpen()) {
            <juyo-evidence-panel [entries]="entries()" [answer]="answer()" [focusCallId]="focus()" [focusColumns]="focusColumns()" [empty]="empty()" />
          }
        </div>
      </dialog>
    }
  `,
})
export class EvidenceLayout {
  /** The tool calls of the answer being explained (`ChatStep[]` fits). */
  readonly entries = input.required<readonly EvidenceEntry[]>();
  /** That answer's final text, so its numbers can be traced to rows. */
  readonly answer = input<string | null | undefined>(null);
  /** The question that answer replied to: the header says which answer is explained. */
  readonly question = input<string | null | undefined>(null);
  /** The title of the chart that was asked about, when one was: the header names it instead of the question. */
  readonly chart = input<string | null | undefined>(null);
  /** The columns that chart draws from the focused call: its table keeps them on screen. */
  readonly focusColumns = input<readonly string[]>([]);
  /** A tool call to open. Same as calling `open(callId)`, for callers that prefer a binding. */
  readonly focusCallId = input<string | null>(null);
  /** Shown while there is no evidence yet. */
  readonly empty = input('Numbers in the answer will show where they came from here.');
  /** Where the split is remembered. */
  readonly storageKey = input<string | null>('compass.evidence.split');

  private static count = 0;
  protected readonly uid = `evl${++EvidenceLayout.count}`;
  private readonly injector = inject(Injector);
  private readonly view = inject(DOCUMENT).defaultView;
  private readonly panel = viewChild(EvidencePanel);
  private readonly sheet = viewChild<ElementRef<HTMLDialogElement>>('sheet');

  /** Wide enough for the evidence to sit beside the conversation. */
  readonly desktop = signal(true);
  /** The evidence pane is folded away (wide screens). Remembered with the split. */
  readonly collapsed = signal(false);
  /** The bottom sheet is open (phones). */
  readonly sheetOpen = signal(false);
  protected readonly focus = linkedSignal(() => this.focusCallId());
  /** What is being explained, in words: the chart that was clicked, else the answer to the question. */
  protected readonly subject = computed(() => {
    const chart = this.chart()?.trim();
    if (chart) return `For the chart “${chart}”`;
    const question = this.question()?.trim();
    return question ? `For the answer to “${question}”` : '';
  });

  constructor() {
    const query = this.view?.matchMedia?.(DESKTOP);
    if (query) {
      this.desktop.set(query.matches);
      const onChange = (event: MediaQueryListEvent) => {
        this.desktop.set(event.matches);
        if (event.matches) this.sheetOpen.set(false);
      };
      query.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => query.removeEventListener('change', onChange));
    }
    // The dialog element follows the signal: showModal() traps focus and wires Esc; close() gives focus back.
    effect(() => {
      const dialog = this.sheet()?.nativeElement;
      const open = this.sheetOpen();
      if (!dialog) return;
      if (open && !dialog.open) dialog.showModal?.();
      else if (!open && dialog.open) dialog.close();
    });
  }

  /** Shows the evidence: un-collapses the pane, or opens the sheet on a phone. With a call id, opens that card. */
  open(callId?: string | null): void {
    if (callId) this.focus.set(callId);
    if (this.desktop()) this.collapsed.set(false);
    else this.sheetOpen.set(true);
    if (callId) afterNextRender(() => this.panel()?.reveal(callId), { injector: this.injector });
  }

  protected closeSheet(): void {
    this.sheetOpen.set(false);
  }

  /** A tap on the dimmed area outside the sheet closes it (the dialog element itself is the only target there). */
  protected backdrop(event: MouseEvent): void {
    if (event.target === this.sheet()?.nativeElement) this.closeSheet();
  }
}
