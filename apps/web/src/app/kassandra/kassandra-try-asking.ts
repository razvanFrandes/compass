import { NgTemplateOutlet } from '@angular/common';
import { Component, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorCaretDownLight } from '@ng-icons/phosphor-icons/light';
import { ASK_GROUPS, FEATURED_ASKS, KIND_NAMES, type AskExample } from '../charts/ask-examples';
import { KIND_ICONS, KIND_ICON_SET } from '../charts/kind-icons';

let nextId = 0;

/**
 * "Try asking": example questions grouped by what the answer shows (trends, mix, a bridge, a funnel…), each with the
 * icon of the widget Kassandra answers it with. A click reports the question; the host sends it at once.
 *
 * Regular: the whole gallery, for the empty Thread. Compact: three questions and "All N examples", which opens the
 * gallery in place, for the Inbox ask area where the brief should stay in view.
 */
@Component({
  selector: 'kassandra-try-asking',
  imports: [NgIcon, NgTemplateOutlet],
  providers: [provideIcons({ ...KIND_ICON_SET, phosphorCaretDownLight })],
  host: { class: 'block' },
  styles: `
    .try-label {
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted-foreground);
    }
    .try-groups {
      display: grid;
      /* Density tokens (src/density.css): the groups are a stack, a group's name and its questions sit a card gap apart. */
      gap: var(--space-stack, 12px) var(--space-card-gap, 16px);
      margin-top: var(--space-stack, 12px);
    }
    .try-group {
      display: grid;
      gap: 6px;
      grid-template-columns: minmax(0, 1fr);
      align-items: start;
    }
    @media (min-width: 560px) {
      .try-group {
        grid-template-columns: 128px minmax(0, 1fr);
        gap: var(--space-stack, 12px);
      }
    }
    .try-group-name {
      padding-top: 7px;
      font-size: 12.5px;
      line-height: 1.4;
      color: var(--muted-foreground);
    }
    .try-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-width: 0;
    }
    .try-q {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      max-width: 100%;
      min-height: var(--control-h-sm, 32px);
      padding: 4px 12px 4px 5px;
      border: 1px solid var(--field-border, var(--border));
      border-radius: var(--radius-control, 8px);
      background: transparent;
      color: var(--foreground);
      font-size: 13px;
      line-height: 1.35;
      text-align: left;
      outline: none;
      transition:
        border-color 150ms ease,
        background-color 150ms ease;
    }
    .try-icon {
      display: grid;
      flex: none;
      width: 22px;
      height: 22px;
      place-items: center;
      border-radius: calc(var(--radius-control, 8px) - 3px);
      background: var(--muted);
      color: var(--foreground);
      font-size: 14px;
    }
    @media (hover: hover) {
      .try-q:hover:not(:disabled) {
        border-color: var(--field-border-hover, var(--border));
        background: var(--overlay-hover);
      }
      .try-more:hover {
        color: var(--foreground);
      }
    }
    .try-q:active:not(:disabled) {
      transform: scale(0.98);
    }
    .try-q:disabled {
      color: var(--muted-foreground);
      cursor: default;
    }
    .try-q:focus-visible,
    .try-more:focus-visible {
      box-shadow:
        0 0 0 2px var(--background),
        0 0 0 4px var(--ring);
    }
    .try-more {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: var(--control-h-sm, 32px);
      padding: 4px 8px;
      border-radius: var(--radius-control, 8px);
      color: var(--muted-foreground);
      font-size: 13px;
      outline: none;
      white-space: nowrap;
    }
    .try-more ng-icon {
      transition: transform 150ms ease;
    }
    .try-more[aria-expanded='true'] ng-icon {
      transform: rotate(180deg);
    }
    .try-panel {
      margin-top: var(--space-stack, 12px);
      padding-top: var(--space-stack, 12px);
      border-top: 1px solid var(--border);
    }
    @media (pointer: coarse) {
      .try-q,
      .try-more {
        min-height: 44px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .try-q,
      .try-more ng-icon {
        transition: none;
      }
      .try-q:active:not(:disabled) {
        transform: none;
      }
    }
  `,
  template: `
    <ng-template #question let-e>
      <button type="button" class="try-q" [disabled]="disabled()" (click)="picked.emit(e.question)">
        <span class="try-icon"><ng-icon [name]="iconOf(e)" aria-hidden="true" /></span>
        <span class="try-text">{{ e.question }}</span>
        <span class="sr-only">(answers with {{ nameOf(e) }})</span>
      </button>
    </ng-template>

    <ng-template #gallery>
      <div class="try-groups">
        @for (g of groups; track g.title) {
          <div class="try-group">
            <p class="try-group-name" aria-hidden="true">{{ g.title }}</p>
            <ul class="try-list" [attr.aria-label]="g.title">
              @for (e of g.items; track e.kind) {
                <li class="min-w-0"><ng-container [ngTemplateOutlet]="question" [ngTemplateOutletContext]="{ $implicit: e }" /></li>
              }
            </ul>
          </div>
        }
      </div>
    </ng-template>

    <section [attr.aria-labelledby]="uid + '-label'">
      @if (compact()) {
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <p class="try-label mr-1" [id]="uid + '-label'">Try asking</p>
          <ul class="try-list" aria-label="Examples">
            @for (e of featured; track e.kind) {
              <li class="min-w-0"><ng-container [ngTemplateOutlet]="question" [ngTemplateOutletContext]="{ $implicit: e }" /></li>
            }
            <!-- The way to the rest sits with the examples, so it wraps onto their last line -->
            <li>
              <button type="button" class="try-more" [attr.aria-expanded]="open()" [attr.aria-controls]="uid + '-all'" (click)="open.set(!open())">
                All {{ count }} examples<ng-icon name="phosphorCaretDownLight" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </div>
        @if (open()) {
          <div class="try-panel" [id]="uid + '-all'">
            <ng-container [ngTemplateOutlet]="gallery" />
          </div>
        }
      } @else {
        <p class="try-label" [id]="uid + '-label'">Try asking</p>
        <ng-container [ngTemplateOutlet]="gallery" />
      }
    </section>
  `,
})
export class KassandraTryAsking {
  /** Three questions and a way to open the rest, instead of the whole gallery. */
  readonly compact = input(false);
  /** While an answer runs: the questions cannot be sent. */
  readonly disabled = input(false);
  /** The question that was clicked. */
  readonly picked = output<string>();

  protected readonly groups = ASK_GROUPS;
  protected readonly featured: readonly AskExample[] = FEATURED_ASKS;
  protected readonly count = ASK_GROUPS.reduce((total, group) => total + group.items.length, 0);
  /* The question template's context is untyped, so the kind is looked up here. */
  protected iconOf(example: AskExample): string {
    return KIND_ICONS[example.kind];
  }
  protected nameOf(example: AskExample): string {
    return KIND_NAMES[example.kind];
  }
  protected readonly open = signal(false);
  protected readonly uid = `try-asking-${++nextId}`;
}
