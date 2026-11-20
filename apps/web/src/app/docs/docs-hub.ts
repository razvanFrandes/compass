import { Component, DOCUMENT, ViewEncapsulation, effect, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  phosphorArrowUpRightLight,
  phosphorBookOpenTextLight,
  phosphorDatabaseLight,
  phosphorInfoLight,
  phosphorPaletteLight,
  phosphorPuzzlePieceLight,
  phosphorRobotLight,
  phosphorShieldCheckLight,
  phosphorSignpostLight,
  phosphorTreeStructureLight,
} from '@ng-icons/phosphor-icons/light';
import { CompassStore, type View } from '../store';
import { DOCS_PAGES, type DocsPageId, SHOWCASES, docsPath } from './docs-pages';
import { DocsRouter } from './docs-router';
import { DocsAbout } from './pages/about';
import { DocsArchitecture } from './pages/architecture';
import { DocsComponents } from './pages/components';
import { DocsData } from './pages/data';
import { DocsDecisions } from './pages/decisions';
import { DocsDesignSystem } from './pages/design-system';
import { DocsIndex } from './pages/index';
import { DocsKassandra } from './pages/kassandra';
import { DocsSecurity } from './pages/security';

/**
 * /docs/*: the documentation hub. A left navigation on wide screens and a selector on a phone, with the page
 * beside it. The page is chosen by the address (DocsRouter). The `docs-*` classes the pages share are styled here.
 */
@Component({
  selector: 'app-docs-hub',
  imports: [NgIcon, DocsIndex, DocsArchitecture, DocsComponents, DocsDesignSystem, DocsKassandra, DocsData, DocsSecurity, DocsDecisions, DocsAbout],
  providers: [
    provideIcons({
      phosphorArrowUpRightLight,
      phosphorBookOpenTextLight,
      phosphorDatabaseLight,
      phosphorInfoLight,
      phosphorPaletteLight,
      phosphorPuzzlePieceLight,
      phosphorRobotLight,
      phosphorShieldCheckLight,
      phosphorSignpostLight,
      phosphorTreeStructureLight,
    }),
  ],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'block' },
  styles: `
    /* Inline Markdown in docs text: code is set apart, bold is the foreground colour. */
    .docs-md code,
    .docs-code {
      font-family: var(--font-mono);
      font-size: 0.88em;
      padding: 1px 5px;
      border-radius: var(--radius-mark, 5px);
      background: var(--muted);
      color: var(--foreground);
      overflow-wrap: anywhere;
    }
    .docs-md strong {
      font-weight: 600;
      color: var(--foreground);
    }
    .docs-md a,
    .docs-link {
      color: var(--foreground);
      text-decoration: underline;
      text-decoration-color: var(--input);
      text-underline-offset: 3px;
    }
    .docs-md a:hover,
    .docs-link:hover {
      text-decoration-color: currentColor;
    }
    .docs-link:focus-visible,
    .docs-nav a:focus-visible,
    .docs-card:focus-visible,
    .docs-table:focus-visible,
    .docs-copy__btn:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }

    /* Left navigation */
    .docs-nav a {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 8px;
      border-radius: var(--nav-item-radius, 6px);
      color: var(--muted-foreground);
      font-size: 14px;
      transition:
        background-color var(--motion-fast, 150ms) var(--ease-standard, ease),
        color var(--motion-fast, 150ms) var(--ease-standard, ease);
    }
    .docs-nav a:hover {
      color: var(--foreground);
      background: var(--overlay-hover);
    }
    .docs-nav a[aria-current='page'] {
      color: var(--foreground);
      font-weight: 500;
      background: var(--overlay-pressed);
    }
    .docs-nav ng-icon {
      font-size: 16px;
    }
    @media (prefers-reduced-motion: reduce) {
      .docs-nav a {
        transition: none;
      }
    }

    /* Small label above a title: sentence case in the concept theme (the bridge), capitals in the others. */
    .docs-k {
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted-foreground);
    }
    [data-theme='juyo-concept'] .docs-k {
      letter-spacing: 0;
      text-transform: none;
      font-size: var(--type-label-size, 12px);
    }

    /* A grid of statements, divided by hairlines */
    .docs-cells {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--docs-cell-min, 280px)), 1fr));
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: var(--radius-container, 14px);
      background: var(--card);
    }
    .docs-cells > * {
      display: grid;
      align-content: start;
      gap: 6px;
      margin: 0 -1px -1px 0;
      padding: 16px 18px;
      border-right: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
    }

    /* A card, and a card that is a link */
    .docs-panel {
      min-width: 0;
      border: 1px solid var(--border);
      border-radius: var(--radius-container, 14px);
      background: var(--card);
    }
    .docs-card {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      padding: 16px 18px;
      border: 1px solid var(--border);
      border-radius: var(--radius-container, 14px);
      background: var(--card);
      transition: border-color var(--motion-fast, 150ms) var(--ease-standard, ease);
    }
    a.docs-card:hover {
      border-color: var(--input);
    }

    /* Tables */
    .docs-table {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius-container, 14px);
      background: var(--card);
    }
    .docs-table table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
      line-height: 1.5;
    }
    .docs-table th,
    .docs-table td {
      padding: 10px 16px;
      text-align: left;
      vertical-align: top;
      border-bottom: 1px solid var(--border);
    }
    .docs-table thead th {
      background: var(--table-header-surface, transparent);
      color: var(--muted-foreground);
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
    }
    .docs-table tbody th {
      font-weight: 500;
      color: var(--foreground);
    }
    .docs-table tbody th code {
      white-space: nowrap;
    }
    .docs-table tbody td {
      color: var(--muted-foreground);
    }
    .docs-table tbody tr:last-child > * {
      border-bottom: 0;
    }
    .docs-table .docs-num {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums lining-nums;
      color: var(--foreground);
    }

    /* A value to copy */
    .docs-copy {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 6px 6px 14px;
      border: 1px solid var(--field-border-hover);
      border-radius: var(--input-radius, 10px);
      background: var(--field);
    }
    .docs-copy code {
      font-family: var(--font-mono);
      font-size: 13.5px;
      color: var(--foreground);
    }
    .docs-copy__btn {
      display: inline-flex;
      flex: none;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 12px;
      border-radius: var(--button-radius, 8px);
      background: var(--secondary);
      color: var(--foreground);
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
    }
    .docs-copy__btn:hover {
      background: color-mix(in srgb, var(--foreground) 8%, var(--secondary));
    }
    @media (pointer: coarse) {
      .docs-copy__btn {
        height: 44px;
      }
      .docs-nav a {
        min-height: 44px;
      }
    }

    /* A flow: numbered boxes, in reading order. On a wide screen they sit in one row, joined by arrows. */
    .docs-flow {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
      gap: 12px;
      counter-reset: docs-flow;
    }
    .docs-flow > li {
      position: relative;
      min-width: 0;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-container, 12px);
      background: var(--card);
      counter-increment: docs-flow;
    }
    .docs-flow > li::before {
      content: counter(docs-flow);
      display: block;
      margin-bottom: 6px;
      color: var(--muted-foreground);
      font-family: var(--font-mono);
      font-size: 11.5px;
      line-height: 1;
    }
    @media (min-width: 1680px) {
      .docs-flow {
        grid-template-columns: none;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
        gap: 26px;
      }
      .docs-flow > li:not(:last-child)::after {
        content: '→';
        position: absolute;
        right: -20px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--muted-foreground);
        font-size: 14px;
        line-height: 20px;
      }
    }

    /* A numbered list of steps */
    .docs-steps {
      display: grid;
      gap: 12px;
      counter-reset: docs-step;
    }
    .docs-steps > li {
      display: grid;
      grid-template-columns: 26px minmax(0, 1fr);
      gap: 12px;
      align-items: baseline;
      max-width: 84ch;
      counter-increment: docs-step;
      font-size: 14px;
      line-height: 1.55;
    }
    .docs-steps > li::before {
      content: counter(docs-step);
      width: 24px;
      height: 24px;
      border: 1px solid var(--docs-step-colour, var(--input));
      border-radius: 9999px;
      color: var(--foreground);
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 22px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
  `,
  template: `
    <div class="mx-auto max-w-[1640px] px-[max(16px,env(safe-area-inset-left,0px))] pt-3 pb-36 sm:px-8 lg:grid lg:grid-cols-[212px_minmax(0,1fr)] lg:gap-10 lg:pt-8 lg:pb-24">
      <aside class="max-lg:hidden">
        <nav class="docs-nav sticky top-8 flex flex-col gap-5" aria-label="Docs">
          <div>
            <a [href]="path('index')" [attr.aria-current]="router.page() === 'index' ? 'page' : null" (click)="go($event, 'index')"><ng-icon name="phosphorBookOpenTextLight" aria-hidden="true" />Overview</a>
            <ul class="mt-1 flex flex-col gap-px">
              @for (p of pages; track p.id) {
                <li>
                  <a [href]="path(p.id)" [attr.aria-current]="router.page() === p.id ? 'page' : null" (click)="go($event, p.id)"><ng-icon [name]="p.icon" aria-hidden="true" />{{ p.label }}</a>
                </li>
              }
            </ul>
          </div>
          <div>
            <p class="docs-k px-2 pb-1">Showcases</p>
            <ul class="flex flex-col gap-px">
              @for (s of showcases; track s.href) {
                <li>
                  <a [href]="s.href" (click)="show($event, s.view)"><ng-icon name="phosphorArrowUpRightLight" aria-hidden="true" />{{ s.label }}</a>
                </li>
              }
            </ul>
          </div>
        </nav>
      </aside>

      <!-- Phone and tablet: one selector in place of the left navigation -->
      <div class="bg-background border-border sticky top-0 z-20 -mx-4 mb-5 border-b px-4 py-2.5 sm:-mx-8 sm:px-8 lg:hidden">
        <label for="docs-page" class="sr-only">Docs page</label>
        <select id="docs-page" class="field-select w-full" [value]="router.page()" (change)="pick($event)">
          <option value="index" [selected]="router.page() === 'index'">Docs · Overview</option>
          @for (p of pages; track p.id) {
            <option [value]="p.id" [selected]="router.page() === p.id">Docs · {{ p.label }}</option>
          }
        </select>
      </div>

      <div class="min-w-0">
        @switch (router.page()) {
          @case ('architecture') {
            <docs-architecture />
          }
          @case ('components') {
            <docs-components />
          }
          @case ('design-system') {
            <docs-design-system />
          }
          @case ('kassandra') {
            <docs-kassandra />
          }
          @case ('data') {
            <docs-data />
          }
          @case ('security') {
            <docs-security />
          }
          @case ('decisions') {
            <docs-decisions />
          }
          @case ('about') {
            <docs-about />
          }
          @default {
            <docs-index />
          }
        }
      </div>
    </div>
  `,
})
export class DocsHub {
  protected readonly router = inject(DocsRouter);
  private readonly store = inject(CompassStore);
  private readonly doc = inject(DOCUMENT);
  protected readonly pages = DOCS_PAGES;
  protected readonly showcases = SHOWCASES;
  protected readonly path = docsPath;

  constructor() {
    // A new page starts at its top, and its heading takes the focus so a screen reader announces it.
    let first = true;
    effect(() => {
      this.router.page();
      if (first) return void (first = false);
      setTimeout(() => {
        const main = this.doc.getElementById('content');
        const view = this.doc.defaultView;
        if (main?.scrollTop) main.scrollTo({ top: 0 });
        if (view?.scrollY) view.scrollTo({ top: 0 });
        this.doc.getElementById('docs-title')?.focus({ preventScroll: true });
      });
    });
  }

  protected go(event: MouseEvent, id: DocsPageId) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    this.router.open(id);
  }

  protected pick(event: Event) {
    this.router.open((event.target as HTMLSelectElement).value as DocsPageId);
  }

  /** The catalogue and the theme lab are views of the app; the orb lab reads its address, so it loads as a page. */
  protected show(event: MouseEvent, view: View | null) {
    if (!view || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    this.store.go(view);
  }
}
