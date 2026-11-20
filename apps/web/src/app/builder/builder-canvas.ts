import { NgTemplateOutlet } from '@angular/common';
import { Component, DOCUMENT, computed, inject, input, output, signal } from '@angular/core';
import type { WorkflowDraft, WorkflowGraph, WorkflowNode, WorkflowNodeKind } from '@compass/contracts';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorCheckCircleFill, phosphorWarningFill, phosphorXCircleFill } from '@ng-icons/phosphor-icons/fill';
import {
  phosphorBuildingsLight,
  phosphorChartLineLight,
  phosphorCircleNotchLight,
  phosphorClockLight,
  phosphorEnvelopeSimpleLight,
  phosphorPencilSimpleLight,
  phosphorUserCheckLight,
} from '@ng-icons/phosphor-icons/light';
import { WorkflowNodeEditor } from './builder-node-editor';
import type { BuilderRun } from './builder-socket';

export type NodeRunState = 'active' | 'done' | 'failed' | null;
export type EdgeFlow = 'placeholder' | 'idle' | 'active' | 'done';

/** How a test run reads on one node. */
export function nodeRunState(run: BuilderRun | null, id: string): NodeRunState {
  if (!run) return null;
  if (run.failed === id) return 'failed';
  if (run.done.includes(id)) return 'done';
  return run.activeNode === id ? 'active' : null;
}

/** The connector into a node: dashed while either end is a placeholder, lit once a test run has reached the node. */
export function edgeFlow(run: BuilderRun | null, from: WorkflowNode, to: WorkflowNode): EdgeFlow {
  const reached = nodeRunState(run, to.id);
  if (reached === 'active') return 'active';
  if (reached) return 'done';
  return from.state === 'empty' || to.state === 'empty' ? 'placeholder' : 'idle';
}

/** Which nodes open a form: every step but the approval, which follows from the action and the autonomy. */
export function isEditable(node: WorkflowNode): boolean {
  return node.kind !== 'approval';
}

const KIND_NAMES: Record<WorkflowNodeKind, string> = { trigger: 'Trigger', scope: 'Hotels', check: 'Check', analyze: 'Analyze', approval: 'Approval', action: 'Action' };
const KIND_ICONS: Record<WorkflowNodeKind, string> = {
  trigger: 'phosphorClockLight',
  scope: 'phosphorBuildingsLight',
  check: 'phosphorChartLineLight',
  analyze: '',
  approval: 'phosphorUserCheckLight',
  action: 'phosphorEnvelopeSimpleLight',
};

export interface CanvasResult {
  tone: 'ok' | 'warn' | 'fail';
  text: string;
  detail?: string;
}

/**
 * The workflow as a chain of nodes on a dotted canvas: trigger → hotels → checks → analyze → [approval] → action.
 * It is an ordered list, top to bottom, so it reads the same on a phone, with a keyboard and with a screen reader.
 * Placeholders are dashed; a node the agent just changed flashes once; a test run lights the nodes in order.
 */
@Component({
  selector: 'app-workflow-canvas',
  imports: [NgIcon, NgTemplateOutlet, WorkflowNodeEditor],
  providers: [
    provideIcons({
      phosphorBuildingsLight,
      phosphorChartLineLight,
      phosphorCheckCircleFill,
      phosphorCircleNotchLight,
      phosphorClockLight,
      phosphorEnvelopeSimpleLight,
      phosphorPencilSimpleLight,
      phosphorUserCheckLight,
      phosphorWarningFill,
      phosphorXCircleFill,
    }),
  ],
  host: { class: 'wb-canvas relative flex flex-col' },
  styles: `
    :host {
      --wb-dot: rgb(255 255 255 / 0.1);
      --wb-edge: #4a525c;
      --wb-dash: #5d6672;
      background-color: var(--background);
      background-image: radial-gradient(var(--wb-dot) 1px, transparent 1px);
      background-size: 22px 22px;
      background-position: 11px 11px;
    }
    :host-context(:root.light) {
      --wb-dot: rgb(16 20 24 / 0.14);
      --wb-edge: #b3bac3;
      --wb-dash: #9aa3ad;
    }

    .wb-item { display: flex; flex-direction: column; align-items: center; animation: wb-enter 360ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
    @keyframes wb-enter {
      from { opacity: 0; transform: translateY(6px) scale(0.985); }
    }

    .wb-edge { display: block; width: 24px; height: 34px; overflow: visible; color: var(--wb-edge); }
    .wb-edge path { fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; transition: stroke 200ms ease; }
    .wb-edge[data-flow='placeholder'] { color: var(--wb-dash); }
    .wb-edge[data-flow='placeholder'] .wb-edge-line { stroke-dasharray: 3 5; }
    .wb-edge[data-flow='done'], .wb-edge[data-flow='active'] { color: var(--brand); }
    .wb-edge[data-flow='active'] .wb-edge-line { stroke-dasharray: 4 5; animation: wb-flow 600ms linear infinite; }
    @keyframes wb-flow { to { stroke-dashoffset: -9; } }

    .wb-node {
      --k: var(--brand);
      position: relative;
      width: 100%;
      border-radius: var(--radius-container, 14px);
      border: 1px solid var(--field-border);
      background: var(--card);
      box-shadow: var(--elevation-raised, 0 1px 0 rgb(255 255 255 / 0.03) inset, 0 10px 24px -18px rgb(0 0 0 / 0.7));
      transition: border-color 200ms ease, box-shadow 200ms ease, background-color 200ms ease;
    }
    .wb-node[data-kind='scope'] { --k: var(--series); }
    .wb-node[data-kind='check'] { --k: var(--series-3); }
    .wb-node[data-kind='approval'] { --k: var(--decision); }
    .wb-node[data-state='empty'] { border-style: dashed; border-color: var(--wb-dash); background: color-mix(in srgb, var(--card) 45%, transparent); box-shadow: none; }
    .wb-node[data-state='draft'] { border-color: color-mix(in srgb, var(--decision) 60%, transparent); }
    .wb-node--open { border-style: solid !important; border-color: var(--brand) !important; background: var(--card) !important; }
    .wb-node[data-run='active'] { border-color: var(--brand); animation: wb-pulse 1.6s ease-in-out infinite; }
    .wb-node[data-run='failed'] { border-color: var(--negative); }
    @keyframes wb-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgb(169 126 230 / 0.5); }
      50% { box-shadow: 0 0 0 7px rgb(169 126 230 / 0); }
    }

    /* Ports, as on a node editor: where a connector leaves and lands. */
    .wb-node::before, .wb-node::after {
      content: '';
      position: absolute;
      left: 50%;
      width: 8px;
      height: 8px;
      margin-left: -4px;
      border-radius: 9999px;
      background: var(--background);
      border: 1.5px solid var(--wb-edge);
      pointer-events: none;
    }
    .wb-node::before { top: -5px; }
    .wb-node::after { bottom: -5px; }
    .wb-item:first-child .wb-node::before, .wb-item:last-child .wb-node::after { display: none; }
    .wb-node[data-run='done']::before, .wb-node[data-run='done']::after, .wb-node[data-run='active']::before { border-color: var(--brand); background: var(--brand); }

    .wb-body { display: flex; width: 100%; align-items: flex-start; gap: 12px; padding: 12px 14px; border-radius: 13px; text-align: left; outline: none; }
    button.wb-body { cursor: pointer; transition: background-color 130ms ease; }
    @media (hover: hover) { button.wb-body:not([aria-disabled='true']):hover { background: var(--overlay-hover); } }
    button.wb-body:focus-visible { box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring); }
    button.wb-body[aria-disabled='true'] { cursor: default; }

    .wb-glyph {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      flex-shrink: 0;
      border-radius: var(--radius-control, 8px);
      font-size: 18px;
      color: var(--k);
      background: color-mix(in srgb, var(--k) 15%, transparent);
    }
    .wb-node[data-state='empty'] .wb-glyph { color: var(--muted-foreground); background: var(--overlay-hover); }
    .wb-node[data-state='empty'] .wb-glyph .orb-mark { filter: grayscale(1); opacity: 0.6; }
    .wb-eyebrow { display: block; font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted-foreground); }
    .wb-label { display: block; margin-top: 1px; font-size: 14px; line-height: 20px; font-weight: 500; color: var(--text-1); overflow-wrap: anywhere; }
    .wb-node[data-state='empty'] .wb-label { font-weight: 400; color: var(--muted-foreground); }
    .wb-detail { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; margin-top: 2px; font-size: 12.5px; line-height: 18px; color: var(--muted-foreground); overflow-wrap: anywhere; }
    .wb-node--open .wb-detail { -webkit-line-clamp: unset; }
    .wb-status { display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; min-height: 20px; font-size: 12px; font-weight: 500; color: var(--muted-foreground); }
    .wb-status[data-run='active'] { color: var(--brand); }
    .wb-status[data-run='done'] { color: var(--positive); }
    .wb-status[data-run='failed'] { color: var(--negative); }
    .wb-spin { animation: wb-spin 900ms linear infinite; }
    @keyframes wb-spin { to { transform: rotate(360deg); } }

    .wb-flash { position: absolute; inset: -1px; border-radius: inherit; border: 1.5px solid var(--brand); pointer-events: none; animation: wb-flash 1100ms ease-out both; }
    @keyframes wb-flash {
      0% { opacity: 1; box-shadow: 0 0 0 0 rgb(169 126 230 / 0.55), 0 0 28px -4px rgb(169 126 230 / 0.5); }
      100% { opacity: 0; box-shadow: 0 0 0 10px rgb(169 126 230 / 0), 0 0 28px -4px rgb(169 126 230 / 0); }
    }

    .wb-result {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 14px;
      border-radius: var(--radius-container, 12px);
      border: 1px solid var(--field-border);
      background: var(--popover);
      box-shadow: var(--popover-shadow, 0 16px 40px -20px rgb(0 0 0 / 0.8));
      font-size: 13.5px;
      line-height: 20px;
    }
    .wb-result[data-tone='ok'] { border-color: color-mix(in srgb, var(--positive) 55%, transparent); }
    .wb-result[data-tone='ok'] ng-icon { color: var(--positive); }
    .wb-result[data-tone='warn'] { border-color: color-mix(in srgb, var(--decision) 55%, transparent); }
    .wb-result[data-tone='warn'] ng-icon { color: var(--decision); }
    .wb-result[data-tone='fail'] { border-color: color-mix(in srgb, var(--negative) 60%, transparent); }
    .wb-result[data-tone='fail'] ng-icon { color: var(--negative); }

    @media (prefers-reduced-motion: reduce) {
      .wb-item, .wb-node[data-run='active'], .wb-edge[data-flow='active'] .wb-edge-line, .wb-spin { animation: none; }
      .wb-flash { display: none; }
      .wb-node, .wb-edge path, button.wb-body { transition: none; }
    }
  `,
  template: `
    <ng-template #body let-node>
      <span class="wb-glyph" aria-hidden="true">
        @if (node.kind === 'analyze') {
          <span class="orb-mark"></span>
        } @else {
          <ng-icon [name]="iconOf(node.kind)" />
        }
      </span>
      <span class="min-w-0 flex-1">
        <span class="wb-eyebrow">
          {{ nameOf(node.kind) }}
          @if (node.state === 'draft') {
            <span class="text-(--decision) normal-case tracking-normal"> · Not complete yet</span>
          }
        </span>
        @for (version of [node.label + '|' + node.detail]; track version) {
          <span class="wb-label gen-in">{{ node.label }}</span>
          @if (node.detail) {
            <span class="wb-detail gen-in">{{ node.detail }}</span>
          }
        }
      </span>
      @switch (runState(node.id)) {
        @case ('active') {
          <span class="wb-status" data-run="active"><ng-icon name="phosphorCircleNotchLight" class="wb-spin text-[15px]" aria-hidden="true" />Running</span>
        }
        @case ('done') {
          <span class="wb-status" data-run="done"><ng-icon name="phosphorCheckCircleFill" class="text-[15px]" aria-hidden="true" />Done</span>
        }
        @case ('failed') {
          <span class="wb-status" data-run="failed"><ng-icon name="phosphorXCircleFill" class="text-[15px]" aria-hidden="true" />Failed</span>
        }
        @default {
          @if (editable(node) && !locked()) {
            <span class="wb-status" aria-hidden="true"><ng-icon name="phosphorPencilSimpleLight" class="text-[15px]" /></span>
          }
        }
      }
    </ng-template>

    <div class="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-4 pt-6 pb-10 sm:px-6 lg:pt-10 lg:pb-16">
      @if (blank()) {
        <div class="gen-in mb-6 text-center">
          <h2 class="text-[15px] font-medium">Your agent takes shape here</h2>
          <p class="text-muted-foreground mx-auto mt-1 max-w-[34ch] text-[13.5px]/relaxed">Describe it in the chat and watch each step fill in, or select a step to set it by hand.</p>
        </div>
      } @else {
        <h2 class="sr-only">Agent steps</h2>
      }

      <ol class="flex flex-col" aria-label="Agent steps, in the order they run">
        @for (node of graph().nodes; track node.id; let i = $index) {
          <li class="wb-item">
            @if (i > 0) {
              <svg class="wb-edge" viewBox="0 0 24 34" aria-hidden="true" [attr.data-flow]="flow(i)">
                <path class="wb-edge-line" d="M12 5 V26" />
                <path d="M8 23 L12 27.5 L16 23" />
              </svg>
            }
            <div class="wb-node" [class.wb-node--open]="openId() === node.id" [attr.data-kind]="node.kind" [attr.data-state]="node.state" [attr.data-run]="runState(node.id)">
              @if (changed().includes(node.id)) {
                @for (tick of [revision()]; track tick) {
                  <span class="wb-flash" aria-hidden="true"></span>
                }
              }
              @if (editable(node)) {
                <button
                  type="button"
                  class="wb-body"
                  [id]="buttonId(i)"
                  [attr.aria-expanded]="openId() === node.id"
                  [attr.aria-controls]="openId() === node.id ? editorId(i) : null"
                  [attr.aria-disabled]="locked() ? 'true' : null"
                  [attr.aria-describedby]="locked() ? lockId : null"
                  (click)="toggle(node)"
                >
                  <span class="sr-only">Edit step {{ i + 1 }}: </span>
                  <ng-container *ngTemplateOutlet="body; context: { $implicit: node }" />
                </button>
              } @else {
                <div class="wb-body">
                  <span class="sr-only">Step {{ i + 1 }}: </span>
                  <ng-container *ngTemplateOutlet="body; context: { $implicit: node }" />
                </div>
              }
              @if (openId() === node.id) {
                <app-workflow-node-editor [id]="editorId(i)" [node]="node" [draft]="draft()" (patch)="edit.emit($event)" (closed)="close(i)" />
              }
            </div>
          </li>
        }
      </ol>
      <p class="sr-only" [id]="lockId">{{ lockReason() }}</p>
    </div>

    <!-- One polite live region: what the agent just changed, where a test run is, and how it ended. -->
    <p class="sr-only" role="status">{{ announcement() }}</p>

    @if (result(); as outcome) {
      <div class="pointer-events-none flex justify-center px-4 max-lg:order-first max-lg:pt-5 lg:sticky lg:bottom-0 lg:pb-5">
        <div class="wb-result gen-in pointer-events-auto max-w-[440px]" [attr.data-tone]="outcome.tone">
          <ng-icon [name]="outcome.tone === 'ok' ? 'phosphorCheckCircleFill' : outcome.tone === 'warn' ? 'phosphorWarningFill' : 'phosphorXCircleFill'" class="mt-0.5 shrink-0 text-[17px]" aria-hidden="true" />
          <p class="min-w-0">
            <span class="font-medium">{{ outcome.text }}</span>
            @if (outcome.detail) {
              <span class="text-muted-foreground block">{{ outcome.detail }}</span>
            }
          </p>
        </div>
      </div>
    }
  `,
})
export class WorkflowCanvas {
  readonly graph = input.required<WorkflowGraph>();
  readonly draft = input.required<WorkflowDraft>();
  /** Node ids the last change touched, and a counter that moves with every change. */
  readonly changed = input<string[]>([]);
  readonly revision = input(0);
  readonly run = input<BuilderRun | null>(null);
  readonly result = input<CanvasResult | null>(null);
  /** Why the nodes cannot be edited right now (no connection, a test in progress); empty when they can. */
  readonly lockReason = input('');
  readonly edit = output<WorkflowDraft>();

  private static next = 0;
  private readonly uid = `wb-${WorkflowCanvas.next++}`;
  private readonly doc = inject(DOCUMENT);
  protected readonly lockId = `${this.uid}-lock`;
  protected readonly openId = signal<string | null>(null);

  protected readonly locked = computed(() => this.lockReason() !== '');
  protected readonly blank = computed(() => this.graph().nodes.every((node) => node.state === 'empty'));

  protected readonly announcement = computed(() => {
    const run = this.run();
    const nodes = this.graph().nodes;
    const label = (id: string | null) => nodes.find((node) => node.id === id)?.label ?? '';
    if (run) {
      if (run.status === 'running' && run.activeNode) return `Test run: ${label(run.activeNode)}.`;
      const outcome = this.result();
      if (outcome) return [outcome.text, outcome.detail].filter(Boolean).join(' ');
    }
    const changed = this.changed();
    if (!changed.length) return '';
    return `Updated ${changed.map((id) => nodes.find((node) => node.id === id)).filter((node) => !!node).map((node) => `${KIND_NAMES[node.kind]}: ${node.label}`).join('. ')}.`;
  });

  protected editable = isEditable;
  protected nameOf(kind: WorkflowNodeKind) {
    return KIND_NAMES[kind];
  }
  protected iconOf(kind: WorkflowNodeKind) {
    return KIND_ICONS[kind];
  }
  protected runState(id: string) {
    return nodeRunState(this.run(), id);
  }
  protected flow(index: number) {
    const nodes = this.graph().nodes;
    return edgeFlow(this.run(), nodes[index - 1]!, nodes[index]!);
  }
  protected buttonId(index: number) {
    return `${this.uid}-node-${index}`;
  }
  protected editorId(index: number) {
    return `${this.uid}-editor-${index}`;
  }

  protected toggle(node: WorkflowNode) {
    if (this.locked()) return;
    this.openId.update((open) => (open === node.id ? null : node.id));
  }

  /** Closing hands focus back to the node, so the keyboard stays where the person was. */
  protected close(index: number) {
    this.openId.set(null);
    // A removed check takes its node with it; then the chain has no button with this index, and focus stays put.
    queueMicrotask(() => this.doc.getElementById(this.buttonId(index))?.focus());
  }
}
