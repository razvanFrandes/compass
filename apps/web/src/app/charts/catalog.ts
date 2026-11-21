import { Component, DOCUMENT, DestroyRef, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { Live } from '../live';
import { ASK_BY_KIND } from './ask-examples';
import { SPECIMENS, type Specimen } from './catalog-samples';
import { KIND_ICONS, KIND_ICON_SET } from './kind-icons';
import { CONCEPT_ONLY } from '../theme-lab/tokens';
import { WIDGET_THEME_SCOPE, WidgetChart, type WidgetLoading } from './widget-chart';

type Preview = 'app' | 'dark' | 'light' | 'juyo-concept' | 'both';
type Scope = 'app' | 'dark' | 'light' | 'juyo-concept';

/** Bumps when the gallery changes its preview theme, so the widgets re-read their colours. */
const previewTick = signal(0);

/** A Light or Dark preview inside a concept page must not inherit the tokens only the concept theme declares. */
const RESET = Object.fromEntries(CONCEPT_ONLY.map((name) => [name, 'initial']));

/**
 * /catalog: every widget kind with sample rows, in any of the three themes or all side by side, at both densities and
 * as skeletons. The design-system page for the chart catalogue.
 */
@Component({
  selector: 'app-catalog',
  imports: [WidgetChart, NgIcon],
  providers: [{ provide: WIDGET_THEME_SCOPE, useValue: previewTick }, provideIcons(KIND_ICON_SET)],
  host: { class: 'block' },
  styles: `
    .cat-seg {
      display: inline-flex;
      padding: 2px;
      border-radius: var(--radius-control, 9px);
      background: var(--muted);
    }
    .cat-seg button {
      height: 30px;
      padding: 0 12px;
      border-radius: var(--radius-control, 7px);
      color: var(--muted-foreground);
      font-size: 13px;
      white-space: nowrap;
      transition:
        background-color 150ms ease,
        color 150ms ease;
    }
    .cat-seg button:hover {
      color: var(--foreground);
    }
    .cat-seg button[aria-pressed='true'] {
      background: var(--card);
      color: var(--foreground);
      box-shadow: var(--elevation-raised, 0 1px 2px rgb(0 0 0 / 0.25));
    }
    .cat-play {
      height: 30px;
      padding: 0 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-control, 8px);
      color: var(--foreground);
      font-size: 13px;
      white-space: nowrap;
    }
    .cat-play:hover:not(:disabled) {
      background: var(--overlay-hover);
    }
    .cat-play:disabled {
      color: var(--muted-foreground);
    }
    @media (pointer: coarse) {
      .cat-play {
        height: 44px;
      }
    }
    .cat-seg button:focus-visible,
    .cat-play:focus-visible,
    .cat-ask button:focus-visible,
    .cat-jump:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }
    @media (pointer: coarse) {
      .cat-seg button {
        height: 44px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .cat-seg button {
        transition: none;
      }
    }
    .cat-card {
      height: 100%;
      min-width: 0;
      padding: 20px;
      border: 1px solid var(--border);
      border-radius: var(--radius-container, 14px);
      background: var(--card);
      color: var(--foreground);
    }
    .cat-kind {
      font-family: var(--font-mono);
      font-size: 11.5px;
      line-height: 1.5;
      color: var(--muted-foreground);
    }
    .cat-kind b {
      font-weight: 500;
      color: var(--foreground);
    }
    .cat-kind ng-icon {
      margin-right: 6px;
      vertical-align: -2px;
      font-size: 14px;
      color: var(--foreground);
    }
    .cat-ask {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 2px 6px;
      font-size: 12.5px;
      line-height: 1.5;
      color: var(--muted-foreground);
    }
    .cat-ask button {
      border-radius: 4px;
      color: var(--foreground);
      text-align: left;
      text-decoration: underline;
      text-decoration-color: var(--border);
      text-underline-offset: 4px;
    }
    .cat-ask button:hover {
      text-decoration-color: currentColor;
    }
    @media (pointer: coarse) {
      .cat-ask button {
        min-height: 44px;
      }
    }
    .cat-scope {
      height: 100%;
      min-width: 0;
      border-radius: var(--radius-overlay, 18px);
      background: var(--background);
      color: var(--foreground);
    }
    .cat-scope[data-theme] {
      padding: 12px;
    }
    @media (max-width: 479.98px) {
      .cat-card {
        padding: 16px;
      }
      .cat-scope[data-theme] {
        padding: 8px;
      }
    }
  `,
  template: `
    <div class="bg-background text-foreground min-h-full" [class]="themeClass(canvas())" [attr.data-theme]="themeAttr(canvas())" [style]="themeReset(canvas())">
      <div class="mx-auto flex flex-col gap-10 px-[max(16px,env(safe-area-inset-left,0px))] pt-5 pb-28 sm:px-8 lg:pt-8 lg:pb-16" [class]="both() ? 'max-w-[1640px]' : 'max-w-[1240px]'">
        <header class="flex flex-col gap-5">
          <div>
            <p class="text-muted-foreground text-[12px] font-medium tracking-[0.06em] uppercase">Design system</p>
            <h1 class="mt-1 text-[26px] font-semibold tracking-[-0.02em]">Chart catalogue</h1>
            <p class="text-muted-foreground mt-2 max-w-[68ch] text-[14px]/relaxed">
              Every chart Kassandra can put in an answer or on a board: {{ kinds }} kinds, drawn by one component from one set of colour tokens. Kassandra chooses the kind and the columns; the component formats the values, draws the chart. “View as” under each one lists the other kinds its numbers can be shown as, the table among them. The numbers on this page are samples shaped like Halcyon’s data.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div class="flex items-center gap-2">
              <span id="cat-theme" class="text-muted-foreground text-[12.5px]">Theme</span>
              <div class="cat-seg" role="group" aria-labelledby="cat-theme">
                @for (o of previews; track o.value) {
                  <button type="button" [attr.aria-pressed]="preview() === o.value" (click)="setPreview(o.value)">{{ o.label }}</button>
                }
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span id="cat-density" class="text-muted-foreground text-[12.5px]">Density</span>
              <div class="cat-seg" role="group" aria-labelledby="cat-density">
                <button type="button" [attr.aria-pressed]="!compact()" (click)="compact.set(false)">Regular</button>
                <button type="button" [attr.aria-pressed]="compact()" (click)="compact.set(true)">Compact</button>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span id="cat-state" class="text-muted-foreground text-[12.5px]">State</span>
              <div class="cat-seg" role="group" aria-labelledby="cat-state">
                @for (o of states; track o.value) {
                  <button type="button" [attr.aria-pressed]="loading() === o.value" (click)="setState(o.value)">{{ o.label }}</button>
                }
              </div>
              <button type="button" class="cat-play" [disabled]="playing()" (click)="play()">{{ playing() ? 'Streaming…' : 'Replay stream' }}</button>
            </div>
          </div>
          <nav class="flex flex-wrap gap-x-4 gap-y-1 text-[13px]" aria-label="Sections">
            @for (g of groups; track g.id) {
              <button type="button" class="cat-jump text-muted-foreground hover:text-foreground rounded-sm underline decoration-(--border) underline-offset-4" (click)="jump(g.id)">{{ g.title }}</button>
            }
          </nav>
        </header>

        @for (g of groups; track g.id) {
          <section [attr.aria-labelledby]="'cat-' + g.id" [id]="'sec-' + g.id" class="scroll-mt-6">
            <h2 [id]="'cat-' + g.id" class="text-[17px] font-semibold tracking-[-0.01em]" tabindex="-1">{{ g.title }}</h2>
            <p class="text-muted-foreground mt-1 mb-4 max-w-[72ch] text-[13.5px]/relaxed">{{ g.blurb }}</p>
            <div class="grid gap-4" [class]="both() ? '' : 'lg:grid-cols-2'">
              @for (sp of g.items; track sp.id) {
                <div class="grid min-w-0 gap-4" [class]="both() ? 'lg:grid-cols-3' : sp.wide ? 'lg:col-span-2' : ''">
                  @for (scope of scopes(); track scope) {
                    <div class="cat-scope" [class]="themeClass(scope)" [attr.data-theme]="themeAttr(scope)" [style]="themeReset(scope)">
                      <article class="cat-card" [attr.aria-label]="sp.spec.kind + (both() ? ', ' + themeName(scope) + ' theme' : '')">
                        <p class="cat-kind mb-3"><ng-icon [name]="icons[sp.spec.kind]" aria-hidden="true" /><b>{{ sp.spec.kind }}</b> · {{ mapping(sp) }}</p>
                        <juyo-widget-chart [spec]="sp.spec" [rows]="sp.rows" [columns]="sp.columns" [compact]="compact()" [loading]="loading()" [switcher]="true" />
                        @if (sp.shows) {
                          <p class="text-muted-foreground border-border mt-4 border-t pt-3 text-[12.5px]/relaxed">{{ sp.shows }}</p>
                        }
                        @if (question(sp); as q) {
                          <!-- The question that makes Kassandra answer with this kind; a click asks it in a new thread -->
                          <p class="cat-ask mt-3">Ask Kassandra: <button type="button" (click)="ask(q)">{{ q }}</button></p>
                        }
                      </article>
                    </div>
                  }
                </div>
              }
            </div>
          </section>
        }
      </div>
    </div>
  `,
})
export class CatalogView {
  private readonly doc = inject(DOCUMENT);
  private readonly live = inject(Live);
  protected readonly icons = KIND_ICONS;
  protected readonly groups = SPECIMENS;
  protected readonly kinds = new Set(SPECIMENS.flatMap((g) => g.items.map((i) => i.spec.kind))).size;
  protected readonly previews: { value: Preview; label: string }[] = [
    { value: 'app', label: 'App theme' },
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'juyo-concept', label: 'Juyo concept' },
    { value: 'both', label: 'Side by side' },
  ];

  protected readonly preview = signal<Preview>('app');
  protected readonly compact = signal(false);
  /** The three states a widget goes through while Kassandra streams it: placeholder, title, chart. */
  protected readonly states: { value: WidgetLoading; label: string }[] = [
    { value: 'skeleton', label: 'Skeleton' },
    { value: 'title', label: 'Title' },
    { value: 'none', label: 'Loaded' },
  ];
  protected readonly loading = signal<WidgetLoading>('none');
  protected readonly playing = signal(false);
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  private stop() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.playing.set(false);
  }
  protected setState(state: WidgetLoading) {
    this.stop();
    this.loading.set(state);
  }
  /** Plays the states in order, the way a streamed answer fills in: the box never changes size. */
  protected play() {
    this.stop();
    this.playing.set(true);
    this.loading.set('skeleton');
    this.timers = [setTimeout(() => this.loading.set('title'), 1400), setTimeout(() => this.setState('none'), 2800)];
  }
  protected readonly both = computed(() => this.preview() === 'both');
  /** The theme of the page itself: the chosen one, or the app's when the three are shown side by side. */
  protected readonly canvas = computed<Scope>(() => (this.preview() === 'both' ? 'app' : (this.preview() as Scope)));
  protected readonly scopes = computed<Scope[]>(() => (this.both() ? ['dark', 'light', 'juyo-concept'] : ['app']));

  /**
   * A preview wears a theme the way <html> does: `data-theme` selects the tokens (styles.css and the concept layer
   * both accept it on any element) and the class tells Tailwind's `dark:` variant. "app" adds nothing: it inherits.
   */
  protected themeAttr(scope: Scope): string | null {
    return scope === 'app' ? null : scope;
  }
  protected themeClass(scope: Scope): string {
    return scope === 'app' ? '' : scope === 'dark' ? 'dark' : 'light';
  }
  protected themeReset(scope: Scope): Record<string, string> | null {
    return scope === 'dark' || scope === 'light' ? RESET : null;
  }
  protected themeName(scope: Scope): string {
    return scope === 'juyo-concept' ? 'Juyo concept' : scope;
  }

  protected setPreview(p: Preview) {
    this.preview.set(p);
    previewTick.update((n) => n + 1);
  }

  protected mapping(sp: Specimen): string {
    const s = sp.spec;
    return [s.x ? `x ${s.x}` : '', s.y?.length ? `y ${s.y.join(', ')}` : '', s.group ? `group ${s.group}` : '', s.compare ? `compare ${s.compare}` : ''].filter(Boolean).join(' · ') || 'all columns';
  }

  /** The example question of a specimen's kind. The edge-case specimens repeat a kind and have none. */
  protected question(sp: Specimen): string | null {
    return sp.id === sp.spec.kind ? ASK_BY_KIND[sp.spec.kind] : null;
  }
  /** Asks it in a new conversation, at once, like every other click that stands for a question. */
  protected ask(question: string) {
    this.live.askAbout(question);
  }

  protected jump(id: string) {
    const reduce = this.doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.doc.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    this.doc.getElementById(`cat-${id}`)?.focus({ preventScroll: true });
  }
}
