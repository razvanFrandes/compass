import { Component, inject } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { CompassStore, type View } from '../../store';
import { DOCS_KIT } from '../docs-kit';
import { DOCS_PAGES, type DocsPageId, SHOWCASES, docsPath } from '../docs-pages';
import { DocsRouter } from '../docs-router';
import { CompassLogo } from '../../shell/compass-logo';

const FACTS = [
  { value: '1', label: 'Cloudflare Worker', note: 'app, API, agents, cron and MCP in one deploy' },
  { value: '3', label: 'durable agents', note: 'Kassandra, the agent builder and the workflow runs' },
  { value: '24', label: 'read-only data tools', note: 'the same set for Kassandra, agents and MCP clients' },
  { value: '21', label: 'widget kinds', note: 'drawn by one component from one spec' },
  { value: '2', label: 'themes', note: 'Default and the Juyo concept, each in light and dark, on one set of token names' },
  { value: '7 / 7', label: 'planted stories found', note: 'the eval run against production on 20 Nov 2026' },
] as const;

/** /docs: where to start, and every page of the hub. */
@Component({
  selector: 'docs-index',
  imports: [NgIcon, CompassLogo, ...DOCS_KIT],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-12">
      <div>
      <app-compass-logo class="mb-5" [size]="28" />
      <docs-head
        eyebrow="Docs"
        title="How Compass is designed and built"
        lede="Compass is a concept for Juyo: a hotel analytics app that tells you what changed overnight, lets you ask Kassandra why, and lets an agent act once you approve. These pages show the system from the inside: the architecture, the components, the design tokens and the decisions behind them. The examples on them are the app’s own components."
      />
      </div>

      <dl class="docs-cells" style="--docs-cell-min: 200px">
        @for (f of facts; track f.label) {
          <div>
            <dt class="order-2 text-[14px] font-medium">{{ f.label }}</dt>
            <dd class="order-1 text-[26px]/tight font-semibold tracking-[-0.02em] tabular-nums">{{ f.value }}</dd>
            <dd class="text-muted-foreground order-3 text-[13px]/snug">{{ f.note }}</dd>
          </div>
        }
      </dl>

      <docs-section heading="Pages" anchor="pages">
        <ul class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          @for (p of pages; track p.id) {
            <li class="flex">
              <a class="docs-card flex-1" [href]="path(p.id)" (click)="open($event, p.id)">
                <ng-icon [name]="p.icon" class="text-(--icon-quiet) mb-1 text-[20px]" aria-hidden="true" />
                <span class="text-[15px] font-semibold">{{ p.label }}</span>
                <span class="text-muted-foreground text-[13.5px]/snug">{{ p.blurb }}</span>
              </a>
            </li>
          }
        </ul>
      </docs-section>

      <docs-section heading="Showcases" anchor="showcases" note="Three views of the app that exist to be looked at. Each one is built from the same components and tokens as the product.">
        <ul class="grid gap-3 sm:grid-cols-3">
          @for (s of showcases; track s.href) {
            <li class="flex">
              <a class="docs-card flex-1" [href]="s.href" (click)="show($event, s.view)">
                <span class="flex items-center justify-between gap-2 text-[15px] font-semibold">{{ s.label }}<ng-icon name="phosphorArrowUpRightLight" class="text-muted-foreground text-[16px]" aria-hidden="true" /></span>
                <span class="text-muted-foreground text-[13.5px]/snug">{{ s.note }}</span>
              </a>
            </li>
          }
        </ul>
      </docs-section>

      <p class="text-muted-foreground max-w-[76ch] text-[13.5px]/relaxed">Compass is the name of this product. Juyo is the company it was built for, and whose product it interprets: Compass is not a Juyo product. Halcyon Hospitality Group, its 20 hotels and every number in this app are fictional and generated. The business date is fixed at Fri 20 Nov 2026.</p>
    </div>
  `,
})
export class DocsIndex {
  private readonly router = inject(DocsRouter);
  private readonly store = inject(CompassStore);
  protected readonly facts = FACTS;
  protected readonly pages = DOCS_PAGES;
  protected readonly showcases = SHOWCASES;
  protected readonly path = docsPath;

  protected open(event: MouseEvent, id: DocsPageId) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    this.router.open(id);
  }

  protected show(event: MouseEvent, view: View | null) {
    if (!view || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    this.store.go(view);
  }
}
