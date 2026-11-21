import { NgTemplateOutlet } from '@angular/common';
import { Component, DOCUMENT, ElementRef, afterRenderEffect, computed, inject, signal, viewChild } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { Theme } from '../../theme';
import { DOCS_KIT, type DocsCell } from '../docs-kit';
import { DocsRouter } from '../docs-router';
import { EDGES, FLOWS, type FlowId, MAP_SIZE, MAP_SUMMARY, NODES, PI_FRAME, ZONES, nodeHeight, placeRows } from './architecture-map';

const FLOW_KEY = 'compass.docs.flow';

const PRINCIPLES: readonly DocsCell[] = [
  { title: 'The model never computes a number', text: 'Metric definitions live in SQL views and functions. The agents call tools that run that SQL; the model plans the calls and explains the result.' },
  { title: 'Evidence travels with every result', text: 'Each tool result carries its SQL, parameters, period, sources and metric definitions. The chat sends them to the app as `evidence`.' },
  { title: 'One door to the data', text: 'Kassandra, the agent builder, workflow runs and outside MCP clients all use the same catalog of 25 tools, with the same guard.' },
  { title: 'Durable by construction', text: 'The three agents run on Pi Durable. A conversation, a draft or a run survives a deploy or an eviction, and a run that waits for approval holds no compute.' },
  { title: 'Compass only reads', text: 'The database role can only `SELECT`. An approved action becomes an RMS task for the revenue manager and an audit entry. Nothing is written to a source system.' },
  { title: 'A person decides on prices and channels', text: '`adjust_bar`, `close_channel` and `open_channel` are high risk in code, whatever the model says. No autonomy level applies them alone.' },
  { title: 'One spec for people and AI', text: 'The builder agent and a person editing by hand change the same `WorkflowSpec` draft. The graph is derived from it, so every graph can run.' },
  { title: 'The answer comes to you', text: 'A cron runs fixed SQL detectors at 05:00 UTC, before anyone opens the app. The model only writes the sentence that summarises each finding.' },
];

/**
 * /docs/architecture: the system map. Flow tabs light up the parts one request touches and list its steps.
 * Every colour is a theme token, so the map follows both themes in both modes.
 */
@Component({
  selector: 'docs-architecture',
  imports: [...DOCS_KIT, NgTemplateOutlet, HlmButtonImports],
  host: { class: 'block' },
  styles: `
    /* A flow's colour is a role the theme already has: data, a third series, ahead, Kassandra, a decision. */
    .arch {
      --flow-ask: var(--series);
      --flow-brief: var(--series-3);
      --flow-mcp: var(--positive);
      --flow-build: var(--brand);
      --flow-approve: var(--brass);
    }
    .tab {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 36px;
      padding: 6px 13px 6px 11px;
      border: 1px solid var(--border);
      border-radius: var(--radius-control, 8px);
      background: var(--card);
      color: var(--foreground);
      font-size: 13.5px;
      font-weight: 500;
      line-height: 1.2;
      text-align: left;
      transition:
        border-color var(--motion-fast, 150ms) var(--ease-standard, ease),
        background-color var(--motion-fast, 150ms) var(--ease-standard, ease);
    }
    .tab:hover {
      border-color: var(--input);
    }
    .tab:focus-visible,
    .scroller:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }
    .tab[aria-selected='true'] {
      background: var(--muted);
      border-color: var(--c, var(--foreground));
      box-shadow: inset 0 0 0 1px var(--c, var(--foreground));
    }
    .dot {
      flex: none;
      width: 8px;
      height: 8px;
      border-radius: 9999px;
      background: var(--c, var(--muted-foreground));
    }
    .tab small {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 400;
      color: var(--muted-foreground);
    }
    .pi-pill {
      padding: 4px 9px;
      border-radius: 9999px;
      background: var(--primary);
      color: var(--primary-foreground);
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      line-height: 1;
      text-transform: uppercase;
    }
    @media (pointer: coarse) {
      .tab {
        min-height: 44px;
      }
    }

    .scroller {
      overflow-x: auto;
    }
    /* The expanded view: the same card in a dialog as wide as the window, so the whole map shows at once. */
    .arch-dialog {
      width: calc(100vw - 32px);
      max-width: 1680px;
      max-height: calc(100dvh - 32px);
      margin: auto;
      padding: 0;
      overflow: auto;
      border: 0;
      border-radius: var(--dialog-radius, 16px);
      background: transparent;
      color: var(--foreground);
      box-shadow: var(--elevation-modal, 0 24px 64px -16px rgb(0 0 0 / 0.6));
    }
    .arch-dialog::backdrop {
      background: var(--scrim, rgb(0 0 0 / 0.55));
    }
    .map {
      display: block;
      width: 100%;
      min-width: 1240px;
      height: auto;
    }
    .zone rect {
      fill: color-mix(in srgb, var(--foreground) 2.5%, transparent);
      stroke: var(--border);
      stroke-width: 1;
    }
    .zone.cf rect {
      fill: color-mix(in srgb, var(--brand) 5%, transparent);
      stroke: color-mix(in srgb, var(--brand) 45%, transparent);
    }
    .zone text {
      font: 500 11px var(--font-mono);
      letter-spacing: 0.1em;
      fill: var(--muted-foreground);
    }
    .frame,
    .node,
    .edge {
      transition: opacity 250ms ease;
    }
    .frame-box {
      fill: color-mix(in srgb, var(--brand) 7%, transparent);
      stroke: var(--brand);
      stroke-width: 1.5;
    }
    .frame-note {
      font: 400 10.5px var(--font-mono);
      fill: var(--muted-foreground);
    }
    .pi-badge {
      fill: var(--primary);
    }
    .pi-text {
      font: 600 9.5px var(--font-mono);
      letter-spacing: 0.08em;
      fill: var(--primary-foreground);
    }
    .box {
      fill: var(--muted);
      stroke: var(--field-border-hover);
      stroke-width: 1;
      transition: stroke 250ms ease;
    }
    .title {
      font: 600 15px var(--font-sans);
      fill: var(--foreground);
    }
    .sub {
      font: 400 11.5px var(--font-mono);
      fill: var(--muted-foreground);
    }
    .row {
      font: 400 12.5px var(--font-sans);
      fill: var(--foreground);
    }
    .row.mono {
      font: 400 12px var(--font-mono);
    }
    .row.dim {
      fill: var(--muted-foreground);
    }
    .sep {
      stroke: var(--field-border-hover);
    }
    .group {
      font: 500 10px var(--font-mono);
      letter-spacing: 0.1em;
      fill: var(--muted-foreground);
    }
    .bullet {
      fill: var(--muted-foreground);
    }
    .edge path {
      fill: none;
      stroke: var(--series-muted);
      stroke-width: 1.5;
      marker-end: url(#arch-m-base);
      transition: stroke 250ms ease;
    }
    .lbl-bg {
      fill: var(--card);
    }
    .lbl {
      font: 400 11px var(--font-mono);
      fill: var(--muted-foreground);
    }
    .map[data-flow] .node:not(.on),
    .map[data-flow] .frame:not(.on) {
      opacity: 0.3;
    }
    .map[data-flow] .edge:not(.on) {
      opacity: 0.14;
    }
    .map[data-flow] .edge.on path {
      stroke: var(--fc);
      stroke-width: 2;
      marker-end: var(--fm);
      stroke-dasharray: 6 5;
      animation: arch-flow 1s linear infinite;
    }
    .map[data-flow] .edge.on .lbl {
      fill: var(--foreground);
    }
    .map[data-flow] .node.on .box {
      stroke: var(--fc);
      stroke-width: 1.5;
    }
    .map[data-flow='ask'] {
      --fc: var(--flow-ask);
      --fm: url(#arch-m-ask);
    }
    .map[data-flow='brief'] {
      --fc: var(--flow-brief);
      --fm: url(#arch-m-brief);
    }
    .map[data-flow='mcp'] {
      --fc: var(--flow-mcp);
      --fm: url(#arch-m-mcp);
    }
    .map[data-flow='build'] {
      --fc: var(--flow-build);
      --fm: url(#arch-m-build);
    }
    .map[data-flow='approve'] {
      --fc: var(--flow-approve);
      --fm: url(#arch-m-approve);
    }
    @keyframes arch-flow {
      to {
        stroke-dashoffset: -22;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .map[data-flow] .edge.on path {
        animation: none;
        stroke-dasharray: none;
      }
      .frame,
      .node,
      .edge,
      .tab,
      .box,
      .edge path {
        transition: none;
      }
    }
  `,
  template: `
    <div class="arch flex flex-col gap-12">
      <docs-head
        eyebrow="Docs · Architecture"
        title="One Worker, three Pi Durable agents, one read-only database"
        lede="Everything on \`juyo.razvanfrandes.com\` is one Cloudflare Worker: this app, the API, the agents, the cron and the MCP server. Three Durable Objects run their agent loop on Pi Durable. Every number comes from SQL in a Postgres database that the Worker reaches through Hyperdrive and a Cloudflare Tunnel, with a role that can only read."
      />

      @if (expanded()) {
        <p class="docs-panel text-muted-foreground p-5 text-[14px]">The map is open in the expanded view.</p>
      } @else {
        <ng-container [ngTemplateOutlet]="card" />
      }

      <dialog #dialog class="arch-dialog" aria-label="System map, expanded" (close)="expanded.set(false)">
        @if (expanded()) {
          <ng-container [ngTemplateOutlet]="card" />
        }
      </dialog>

      <ng-template #card>
        <div class="docs-panel grid grid-cols-[minmax(0,1fr)] overflow-hidden">
          <div class="border-border flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b p-4">
            <div class="flex flex-wrap gap-2" role="tablist" aria-label="Request flows">
              @for (f of flows; track f.id; let i = $index) {
                <button
                  type="button"
                  class="tab"
                  role="tab"
                  [id]="'arch-tab-' + (f.id || 'all')"
                  aria-controls="arch-steps"
                  [attr.aria-selected]="flow() === f.id"
                  [attr.tabindex]="flow() === f.id ? 0 : -1"
                  [style.--c]="f.id ? 'var(--flow-' + f.id + ')' : null"
                  (click)="select(f.id)"
                  (keydown)="tabKey($event, i)"
                >
                  @if (f.id) {
                    <span class="dot" aria-hidden="true"></span>
                  }
                  {{ f.tab }}
                  @if (f.hint) {
                    <small>{{ f.hint }}</small>
                  }
                </button>
              }
            </div>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p class="text-muted-foreground flex items-center gap-2 text-[12.5px]"><span class="pi-pill">Pi Durable</span>an agent loop that runs inside a Durable Object</p>
              <button hlmBtn variant="secondary" size="sm" class="max-md:hidden" (click)="toggleExpanded()">{{ expanded() ? 'Close' : 'Expand the map' }}</button>
            </div>
          </div>

          <div class="scroller" tabindex="0" role="group" aria-label="System map. It scrolls sideways on a narrow screen.">
            <svg #map class="map" [attr.viewBox]="'0 0 ' + size.width + ' ' + size.height" role="img" aria-labelledby="arch-map-title" [attr.data-flow]="flow() || null">
              <title id="arch-map-title">{{ summary }}</title>
              <defs>
                <marker id="arch-m-base" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L9 5 L0 9 z" style="fill: var(--series-muted)" /></marker>
                @for (id of flowIds; track id) {
                  <marker [attr.id]="'arch-m-' + id" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L9 5 L0 9 z" [style.fill]="'var(--flow-' + id + ')'" /></marker>
                }
              </defs>

              @for (z of zones; track z.id) {
                <g class="zone" [class.cf]="z.cf">
                  <rect [attr.x]="z.x" [attr.y]="z.y" [attr.width]="z.w" [attr.height]="z.h" rx="18" />
                  <text [attr.x]="z.x + 18" [attr.y]="z.y + 26">{{ z.label }}</text>
                </g>
              }

              <g class="frame" [class.on]="!!flow() && frame.flows.includes($any(flow()))">
                <rect class="frame-box" [attr.x]="frame.x" [attr.y]="frame.y" [attr.width]="frame.w" [attr.height]="frame.h" rx="16" />
                <rect class="pi-badge" [attr.x]="frame.x + 12" [attr.y]="frame.y + 8" width="92" height="20" rx="10" />
                <text class="pi-text" [attr.x]="frame.x + 58" [attr.y]="frame.y + 22" text-anchor="middle">PI DURABLE</text>
                <text class="frame-note" [attr.x]="frame.x + 114" [attr.y]="frame.y + 22" data-max="194">PiHarness · durable agent loop</text>
              </g>

              @for (e of edges; track e.d) {
                <g class="edge" [class.on]="!!flow() && e.flows.includes($any(flow()))">
                  <path [attr.d]="e.d" />
                  @if (e.label) {
                    <rect class="lbl-bg" rx="4" />
                    <text class="lbl" [attr.x]="e.lx" [attr.y]="(e.ly ?? 0) + 4" text-anchor="middle">{{ e.label }}</text>
                  }
                </g>
              }

              @for (n of nodes; track n.id) {
                <g class="node" [class.on]="!!flow() && n.flows.includes($any(flow()))">
                  <rect class="box" [attr.x]="n.x" [attr.y]="n.y" [attr.width]="n.w" [attr.height]="n.height" rx="12" />
                  @if (n.pi) {
                    <rect class="pi-badge" [attr.x]="n.x + n.w - 98" [attr.y]="n.y + 11" width="86" height="20" rx="10" />
                    <text class="pi-text" [attr.x]="n.x + n.w - 55" [attr.y]="n.y + 25" text-anchor="middle">PI DURABLE</text>
                  }
                  <text class="title" [attr.x]="n.x + 16" [attr.y]="n.y + 27" [attr.data-max]="n.w - 32 - (n.pi ? 96 : 0)">{{ n.title }}</text>
                  <text class="sub" [attr.x]="n.x + 16" [attr.y]="n.y + 45" [attr.data-max]="n.w - 32">{{ n.sub }}</text>
                  <line class="sep" [attr.x1]="n.x + 16" [attr.x2]="n.x + n.w - 16" [attr.y1]="n.y + 58" [attr.y2]="n.y + 58" />
                  @for (r of n.placed; track $index) {
                    @if (r.kind === 'group') {
                      <text class="group" [attr.x]="n.x + 16" [attr.y]="r.y" [attr.data-max]="n.w - 32">{{ r.text }}</text>
                    } @else {
                      <circle class="bullet" [attr.cx]="n.x + 19" [attr.cy]="r.y - 4" r="1.6" />
                      <text class="row" [class.mono]="r.mono" [class.dim]="r.dim" [attr.x]="n.x + 28" [attr.y]="r.y" [attr.data-max]="n.w - 40">{{ r.text }}</text>
                    }
                  }
                </g>
              }
            </svg>
          </div>

          <div id="arch-steps" role="tabpanel" [attr.aria-labelledby]="'arch-tab-' + (flow() || 'all')" class="border-border grid gap-x-12 gap-y-5 border-t p-5 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]" [style.--docs-step-colour]="flow() ? 'var(--flow-' + flow() + ')' : null">
            <div class="flex flex-col gap-1.5">
              <p class="docs-k flex items-center gap-2">
                @if (flow()) {
                  <span class="dot" aria-hidden="true" [style.--c]="'var(--flow-' + flow() + ')'"></span>
                }
                {{ active().tag }}
              </p>
              <h2 class="text-[20px] font-semibold tracking-[-0.01em]">{{ active().title }}</h2>
              <p class="text-muted-foreground text-[14px]">{{ active().note }}</p>
            </div>
            <ol class="docs-steps">
              @for (s of active().steps; track s) {
                <li><span class="docs-md" [innerHTML]="s | md"></span></li>
              }
            </ol>
          </div>
        </div>
      </ng-template>

      <docs-section heading="Principles enforced by the architecture" anchor="principles" note="Each of these is a property of how the parts are wired, not a rule the model is asked to follow.">
        <docs-cells [items]="principles" [min]="300" />
      </docs-section>

      <p class="text-muted-foreground text-[14px]">
        Next: <a class="docs-link" href="/docs/security" (click)="open($event, 'security')">how the public demo stays safe</a>, or <a class="docs-link" href="/docs/kassandra" (click)="open($event, 'kassandra')">how Kassandra and the agents work</a>.
      </p>
    </div>
  `,
})
export class DocsArchitecture {
  private readonly doc = inject(DOCUMENT);
  private readonly theme = inject(Theme);
  private readonly router = inject(DocsRouter);
  private readonly map = viewChild<ElementRef<SVGSVGElement>>('map');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  /** The map is shown in a dialog as wide as the window. */
  protected readonly expanded = signal(false);

  protected readonly size = MAP_SIZE;
  protected readonly summary = MAP_SUMMARY;
  protected readonly zones = ZONES;
  protected readonly frame = PI_FRAME;
  protected readonly edges = EDGES;
  protected readonly nodes = NODES.map((n) => ({ ...n, height: nodeHeight(n), placed: placeRows(n) }));
  protected readonly flows = FLOWS;
  protected readonly flowIds: readonly FlowId[] = ['ask', 'brief', 'mcp', 'build', 'approve'];
  protected readonly principles = PRINCIPLES;

  protected readonly flow = signal<FlowId | ''>(savedFlow(this.doc.defaultView));
  protected readonly active = computed(() => FLOWS.find((f) => f.id === this.flow()) ?? FLOWS[0]!);
  /** Bumped when the web fonts arrive: text is measured once with the fallback font and again with the real one. */
  private readonly fonts = signal(0);

  constructor() {
    this.doc.fonts?.ready.then(() => this.fonts.update((n) => n + 1));
    afterRenderEffect(() => {
      // The concept theme sets another typeface, so the text is fitted again when the theme changes.
      this.theme.id();
      this.fonts();
      const map = this.map()?.nativeElement;
      if (map) this.fit(map);
    });
  }

  protected select(flow: FlowId | '') {
    this.flow.set(flow);
    try {
      this.doc.defaultView?.localStorage.setItem(FLOW_KEY, flow);
    } catch {
      /* private mode: the choice lasts for this visit */
    }
  }

  protected toggleExpanded() {
    const dialog = this.dialog().nativeElement;
    if (this.expanded()) return dialog.close();
    this.expanded.set(true);
    dialog.showModal();
  }

  /** Arrow keys, Home and End move between the flow tabs, as in any tab list. */
  protected tabKey(event: KeyboardEvent, index: number) {
    const last = FLOWS.length - 1;
    const to = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? last : null;
    if (to === null) return;
    event.preventDefault();
    const next = FLOWS[(to + FLOWS.length) % FLOWS.length]!;
    this.select(next.id);
    this.doc.getElementById(`arch-tab-${next.id || 'all'}`)?.focus();
  }

  protected open(event: MouseEvent, id: 'security' | 'kassandra') {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    this.router.open(id);
  }

  /** Squeezes a line that is wider than its box, and sizes the backdrop under each edge label. */
  private fit(svg: SVGSVGElement) {
    for (const t of Array.from(svg.querySelectorAll<SVGTextElement>('text[data-max]'))) {
      t.removeAttribute('textLength');
      t.removeAttribute('lengthAdjust');
      const max = Number(t.getAttribute('data-max'));
      try {
        if (t.getComputedTextLength() > max) {
          t.setAttribute('textLength', String(max));
          t.setAttribute('lengthAdjust', 'spacingAndGlyphs');
        }
      } catch {
        /* not laid out (a hidden tab, a test without layout): leave the text as it is */
      }
    }
    for (const g of Array.from(svg.querySelectorAll<SVGGElement>('.edge'))) {
      const label = g.querySelector<SVGTextElement>('.lbl');
      const bg = g.querySelector<SVGRectElement>('.lbl-bg');
      if (!label || !bg) continue;
      try {
        const b = label.getBBox();
        bg.setAttribute('x', String(b.x - 6));
        bg.setAttribute('y', String(b.y - 2));
        bg.setAttribute('width', String(b.width + 12));
        bg.setAttribute('height', String(b.height + 4));
      } catch {
        bg.setAttribute('width', '0');
      }
    }
  }
}

function savedFlow(view: Window | null): FlowId | '' {
  try {
    const saved = view?.localStorage.getItem(FLOW_KEY) ?? '';
    return FLOWS.some((f) => f.id === saved) ? (saved as FlowId | '') : '';
  } catch {
    return '';
  }
}
