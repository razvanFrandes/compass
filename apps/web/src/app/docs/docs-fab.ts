import { Component, DOCUMENT, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  phosphorBookOpenTextLight,
  phosphorDatabaseLight,
  phosphorInfoLight,
  phosphorPaletteLight,
  phosphorPuzzlePieceLight,
  phosphorRobotLight,
  phosphorShieldCheckLight,
  phosphorSignpostLight,
  phosphorTreeStructureLight,
  phosphorXLight,
} from '@ng-icons/phosphor-icons/light';
import { CompassStore } from '../store';
import { DOCS_PAGES, type DocsPageId, docsPath } from './docs-pages';
import { DocsRouter } from './docs-router';
import { type Box, fabLift, isTypingTarget } from './fab-position';

/** What the button must never cover. The phone tab bar is the fixed "Main" navigation of the shell. */
const AVOID = 'kassandra-composer, [data-sonner-toast], nav[aria-label="Main"].fixed, [data-docs-avoid]';

/**
 * The floating Docs button, on every screen. It opens a panel with the sections of the documentation hub; "?"
 * opens it from the keyboard. It sits bottom right and moves above a composer, a toast or the phone tab bar.
 */
@Component({
  selector: 'app-docs-fab',
  imports: [NgIcon],
  providers: [
    provideIcons({
      phosphorBookOpenTextLight,
      phosphorDatabaseLight,
      phosphorInfoLight,
      phosphorPaletteLight,
      phosphorPuzzlePieceLight,
      phosphorRobotLight,
      phosphorShieldCheckLight,
      phosphorSignpostLight,
      phosphorTreeStructureLight,
      phosphorXLight,
    }),
  ],
  host: { '(document:keydown)': 'onKey($event)', '(document:pointerdown)': 'onPointer($event)' },
  styles: `
    .fab {
      position: fixed;
      z-index: 40;
      right: max(16px, env(safe-area-inset-right, 0px));
      bottom: calc(var(--docs-fab-lift, 16px) + env(safe-area-inset-bottom, 0px));
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      pointer-events: none;
      transition: bottom var(--motion-moderate, 180ms) var(--ease-standard, ease);
    }
    .fab > * {
      pointer-events: auto;
    }
    @media (min-width: 1024px) {
      .fab {
        right: max(24px, env(safe-area-inset-right, 0px));
      }
    }
    .fab__btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 40px;
      padding: 0 16px 0 13px;
      border: 1px solid var(--field-border-hover);
      border-radius: var(--button-radius, 9999px);
      background: var(--popover);
      color: var(--foreground);
      font-size: 14px;
      font-weight: 500;
      box-shadow: var(--elevation-overlay, 0 8px 24px -10px rgb(0 0 0 / 0.45), 0 1px 2px rgb(0 0 0 / 0.12));
      transition:
        border-color var(--motion-fast, 150ms) var(--ease-standard, ease),
        background-color var(--motion-fast, 150ms) var(--ease-standard, ease);
    }
    .fab__btn ng-icon {
      font-size: 18px;
      color: var(--brand);
    }
    .fab__btn:hover,
    .fab__btn[aria-expanded='true'] {
      border-color: var(--input);
      background: color-mix(in srgb, var(--foreground) 5%, var(--popover));
    }
    .fab__btn:focus-visible,
    .fab__link:focus-visible,
    .fab__close:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }
    .fab__key {
      display: inline-grid;
      place-items: center;
      min-width: 20px;
      height: 20px;
      padding: 0 5px;
      border: 1px solid var(--field-border-hover);
      border-radius: var(--radius-mark, 5px);
      color: var(--muted-foreground);
      font-family: var(--font-mono);
      font-size: 11.5px;
      line-height: 1;
    }
    .fab__panel {
      width: min(360px, calc(100vw - 32px));
      /* As tall as its eight sections when the screen allows; it scrolls only on a short screen. */
      max-height: calc(100dvh - var(--docs-fab-lift, 16px) - env(safe-area-inset-bottom, 0px) - 76px);
      overflow-y: auto;
      padding: 12px 8px 6px;
      border: 1px solid var(--field-border-hover);
      border-radius: var(--popover-radius, 14px);
      background: var(--popover);
      color: var(--foreground);
      box-shadow: var(--elevation-modal, 0 18px 48px -16px rgb(0 0 0 / 0.55), 0 2px 6px rgb(0 0 0 / 0.14));
      animation: fab-in var(--motion-moderate, 180ms) var(--ease-enter, ease-out);
    }
    @keyframes fab-in {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
    }
    .fab__link {
      display: grid;
      grid-template-columns: 20px minmax(0, 1fr);
      gap: 1px 10px;
      padding: 6px 10px;
      border-radius: var(--radius-control, 8px);
    }
    .fab__link ng-icon {
      grid-row: span 2;
      margin-top: 1px;
      font-size: 18px;
      color: var(--icon-quiet);
    }
    .fab__link:hover {
      background: var(--overlay-hover);
    }
    .fab__link[aria-current='page'] {
      background: var(--overlay-pressed);
    }
    .fab__close {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: var(--radius-control, 8px);
      color: var(--muted-foreground);
    }
    .fab__close:hover {
      background: var(--overlay-hover);
      color: var(--foreground);
    }
    @media (pointer: coarse) {
      .fab__btn {
        height: 44px;
      }
      .fab__close {
        width: 44px;
        height: 44px;
      }
      .fab__key {
        display: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .fab,
      .fab__btn {
        transition: none;
      }
      .fab__panel {
        animation: none;
      }
    }
    @media print {
      .fab {
        display: none;
      }
    }
  `,
  template: `
    @if (!bare) {
      <div #root class="fab" [style.--docs-fab-lift.px]="lift()">
        @if (open()) {
          <nav id="docs-fab-panel" class="fab__panel" aria-label="Documentation">
            <div class="flex items-start justify-between gap-3 px-2.5 pb-1.5">
              <div>
                <p class="text-[15px] font-semibold tracking-[-0.01em]">Documentation</p>
                <p class="text-muted-foreground mt-0.5 text-[12.5px]">How this demo is designed and built.</p>
              </div>
              <button type="button" class="fab__close" aria-label="Close the documentation panel" (click)="close(true)"><ng-icon name="phosphorXLight" aria-hidden="true" /></button>
            </div>
            <ul class="flex flex-col gap-px">
              @for (p of pages; track p.id) {
                <li>
                  <a class="fab__link" [href]="path(p.id)" [attr.aria-current]="current() === p.id ? 'page' : null" (click)="go($event, p.id)">
                    <ng-icon [name]="p.icon" aria-hidden="true" />
                    <span class="text-[14px] font-medium">{{ p.label }}</span>
                    <span class="text-muted-foreground text-[12.5px]/snug">{{ p.blurb }}</span>
                  </a>
                </li>
              }
            </ul>
            <p class="text-muted-foreground border-border mx-2.5 mt-2 flex items-center gap-1.5 border-t pt-2.5 pb-1 text-[12px] max-[1023px]:hidden"><kbd class="fab__key">?</kbd> opens this panel <span aria-hidden="true">·</span> <kbd class="fab__key">Esc</kbd> closes it</p>
          </nav>
        }
        <button #button type="button" class="fab__btn" aria-label="Docs: how this demo is built" aria-keyshortcuts="?" [attr.aria-expanded]="open()" [attr.aria-controls]="open() ? 'docs-fab-panel' : null" (click)="toggle()">
          <ng-icon name="phosphorBookOpenTextLight" aria-hidden="true" />
          <span>Docs</span>
          <kbd class="fab__key" aria-hidden="true">?</kbd>
        </button>
      </div>
    }
  `,
})
export class DocsFab {
  private readonly doc = inject(DOCUMENT);
  private readonly view = this.doc.defaultView;
  private readonly store = inject(CompassStore);
  private readonly router = inject(DocsRouter);
  private readonly destroy = inject(DestroyRef);
  private readonly root = viewChild<ElementRef<HTMLElement>>('root');
  private readonly button = viewChild<ElementRef<HTMLButtonElement>>('button');

  protected readonly pages = DOCS_PAGES;
  protected readonly path = docsPath;
  protected readonly open = signal(false);
  /** The page the panel marks as current: only while a docs page is on screen. */
  protected readonly current = computed(() => (this.store.view() === 'docs' ? this.router.page() : null));
  /** Distance from the bottom of the viewport, in px. */
  protected readonly lift = signal(16);
  /** `?bare=1` is how the orb lab is photographed on its own: nothing floats over it. */
  protected readonly bare = new URLSearchParams(this.view?.location.search ?? '').has('bare');

  private frame = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    // A change of screen changes what sits in the corner.
    effect(() => {
      this.store.view();
      this.router.page();
      this.open();
      this.schedule();
    });
    afterNextRender(() => this.watch());
  }

  protected toggle() {
    if (this.open()) this.close(true);
    else this.show();
  }

  private show() {
    this.open.set(true);
    // The panel is a list of links: focus goes to the current page's link, or the first.
    setTimeout(() => {
      const panel = this.root()?.nativeElement.querySelector('#docs-fab-panel');
      (panel?.querySelector<HTMLElement>('a[aria-current="page"]') ?? panel?.querySelector<HTMLElement>('a'))?.focus();
    });
  }

  protected close(refocus: boolean) {
    this.open.set(false);
    if (refocus) this.button()?.nativeElement.focus();
  }

  protected go(event: MouseEvent, id: DocsPageId) {
    // A modified click opens the page in a new tab, as any link does.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    this.close(false);
    this.router.open(id);
  }

  protected onKey(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.open()) {
      event.preventDefault();
      return this.close(true);
    }
    if (event.key !== '?' || event.metaKey || event.ctrlKey || event.altKey || this.bare) return;
    if (isTypingTarget(event.target) || this.doc.querySelector('dialog[open]')) return;
    event.preventDefault();
    this.toggle();
  }

  protected onPointer(event: Event) {
    if (!this.open()) return;
    const root = this.root()?.nativeElement;
    if (root && !root.contains(event.target as Node)) this.close(false);
  }

  /** Re-measures on the next frame, and once more when entry animations (a toast sliding in) have settled. */
  private schedule() {
    const view = this.view;
    if (!view?.requestAnimationFrame) return;
    view.cancelAnimationFrame(this.frame);
    this.frame = view.requestAnimationFrame(() => this.measure());
    this.timers.forEach(clearTimeout);
    this.timers = [setTimeout(() => this.measure(), 220), setTimeout(() => this.measure(), 520)];
  }

  private watch() {
    const view = this.view;
    if (!view) return;
    const onChange = () => this.schedule();
    view.addEventListener('resize', onChange);
    view.addEventListener('scroll', onChange, { capture: true, passive: true });
    // A toast arriving, a composer growing with its text, a sheet opening: all are changes to the page's tree.
    const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(onChange);
    observer?.observe(this.doc.body, { childList: true, subtree: true });
    this.destroy.onDestroy(() => {
      view.removeEventListener('resize', onChange);
      view.removeEventListener('scroll', onChange, { capture: true });
      observer?.disconnect();
      view.cancelAnimationFrame?.(this.frame);
      this.timers.forEach(clearTimeout);
    });
    this.schedule();
  }

  private measure() {
    const view = this.view;
    const button = this.button()?.nativeElement;
    const root = this.root()?.nativeElement;
    if (!view || !button || !root) return;
    const rect = button.getBoundingClientRect();
    if (!rect.width) return;
    const base = view.innerWidth >= 1024 ? 24 : 16;
    const obstacles: Box[] = [];
    for (const el of Array.from(this.doc.querySelectorAll(AVOID))) {
      if (root.contains(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width && r.height) obstacles.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    }
    const lift = fabLift({ viewportHeight: view.innerHeight, left: rect.left, right: rect.right, height: rect.height, base, gap: 12, obstacles, max: view.innerHeight * 0.6 });
    if (lift !== this.lift()) this.lift.set(lift);
  }
}
