import { Component, DOCUMENT, computed, inject, signal } from '@angular/core';
import { SPECIMENS, type Specimen } from './catalog-samples';
import { WIDGET_THEME_SCOPE, WidgetChart } from './widget-chart';

type Preview = 'app' | 'dark' | 'light' | 'both';
type Scope = 'app' | 'dark' | 'light';

/** Bumps when the gallery changes its preview theme, so the widgets re-read their colours. */
const previewTick = signal(0);

/**
 * The design tokens of each theme, read from the stylesheet (`:root` is dark, `:root.light` overrides it), so a
 * preview can wear a theme without the gallery keeping a second copy of the palette.
 */
function readThemeTokens(doc: Document): Record<'dark' | 'light', Record<string, string>> {
  const out: Record<'dark' | 'light', Record<string, string>> = { dark: {}, light: {} };
  const visit = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      const styled = rule as Partial<CSSStyleRule>;
      if (styled.selectorText && styled.style) {
        const selectors = styled.selectorText.split(',').map((x) => x.trim());
        const target = selectors.includes(':root.light') ? out.light : selectors.includes(':root') ? out.dark : null;
        if (target && styled.style.getPropertyValue('--background')) {
          for (const name of Array.from(styled.style)) if (name.startsWith('--')) target[name] = styled.style.getPropertyValue(name).trim();
        }
      }
      const nested = (rule as Partial<CSSGroupingRule>).cssRules;
      if (nested) visit(nested);
    }
  };
  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      visit(sheet.cssRules);
    } catch {
      // A stylesheet from another origin (the font CSS) can't be read; it has no tokens.
    }
  }
  return out;
}

/**
 * /catalog: every widget kind with sample rows, in either theme or both side by side, at both densities and
 * as skeletons. The design-system page for the chart catalogue.
 */
@Component({
  selector: 'app-catalog',
  imports: [WidgetChart],
  providers: [{ provide: WIDGET_THEME_SCOPE, useValue: previewTick }],
  host: { class: 'block' },
  styles: `
    .cat-seg {
      display: inline-flex;
      padding: 2px;
      border-radius: 9px;
      background: var(--muted);
    }
    .cat-seg button {
      height: 30px;
      padding: 0 12px;
      border-radius: 7px;
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
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
    }
    .cat-seg button:focus-visible,
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
      border-radius: 14px;
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
    .cat-scope {
      height: 100%;
      min-width: 0;
      border-radius: 18px;
      background: var(--background);
      color: var(--foreground);
    }
    .cat-scope[data-scope='dark'],
    .cat-scope[data-scope='light'] {
      padding: 12px;
    }
    @media (max-width: 479.98px) {
      .cat-card {
        padding: 16px;
      }
      .cat-scope[data-scope='dark'],
      .cat-scope[data-scope='light'] {
        padding: 8px;
      }
    }
  `,
  template: `
    <div class="bg-background text-foreground min-h-full" [style]="vars(canvas())">
      <div class="mx-auto flex max-w-[1240px] flex-col gap-10 px-[max(16px,env(safe-area-inset-left,0px))] pt-5 pb-28 sm:px-8 lg:pt-8 lg:pb-16">
        <header class="flex flex-col gap-5">
          <div>
            <p class="text-muted-foreground text-[12px] font-medium tracking-[0.06em] uppercase">Design system</p>
            <h1 class="mt-1 text-[26px] font-semibold tracking-[-0.02em]">Chart catalogue</h1>
            <p class="text-muted-foreground mt-2 max-w-[68ch] text-[14px]/relaxed">
              Every widget Kassandra can put in an answer or on a board: {{ kinds }} kinds drawn by one component from one set of colour tokens. She chooses the kind and the columns; the component formats the values, draws the chart and offers the same rows as a table. The rows on this page are samples shaped like Halcyon’s data.
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
                <button type="button" [attr.aria-pressed]="!loading()" (click)="loading.set(false)">Loaded</button>
                <button type="button" [attr.aria-pressed]="loading()" (click)="loading.set(true)">Loading</button>
              </div>
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
                <div class="grid min-w-0 gap-4" [class]="both() ? 'lg:grid-cols-2' : sp.wide ? 'lg:col-span-2' : ''">
                  @for (scope of scopes(); track scope) {
                    <div class="cat-scope" [attr.data-scope]="scope" [style]="vars(scope)">
                      <article class="cat-card" [attr.aria-label]="sp.spec.kind + (both() ? ', ' + scope + ' theme' : '')">
                        <p class="cat-kind mb-3"><b>{{ sp.spec.kind }}</b> · {{ mapping(sp) }}</p>
                        <juyo-widget-chart [spec]="sp.spec" [rows]="sp.rows" [columns]="sp.columns" [compact]="compact()" [loading]="loading()" />
                        @if (sp.shows) {
                          <p class="text-muted-foreground border-border mt-4 border-t pt-3 text-[12.5px]/relaxed">{{ sp.shows }}</p>
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
  protected readonly groups = SPECIMENS;
  protected readonly kinds = new Set(SPECIMENS.flatMap((g) => g.items.map((i) => i.spec.kind))).size;
  protected readonly previews: { value: Preview; label: string }[] = [
    { value: 'app', label: 'App theme' },
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'both', label: 'Side by side' },
  ];

  protected readonly preview = signal<Preview>('app');
  protected readonly compact = signal(false);
  protected readonly loading = signal(false);
  protected readonly both = computed(() => this.preview() === 'both');
  /** The theme of the page itself: the chosen one, or the app's when both are shown side by side. */
  protected readonly canvas = computed<Scope>(() => (this.preview() === 'both' ? 'app' : (this.preview() as Scope)));
  protected readonly scopes = computed<Scope[]>(() => (this.both() ? ['dark', 'light'] : ['app']));

  private tokens?: Record<'dark' | 'light', Record<string, string>>;

  /** Inline custom properties that put a subtree in a theme. "app" adds nothing: it inherits. */
  protected vars(scope: Scope): Record<string, string> | null {
    if (scope === 'app') return null;
    this.tokens ??= readThemeTokens(this.doc);
    const { dark, light } = this.tokens;
    if (scope === 'dark') return { ...dark, 'color-scheme': 'dark' };
    // Light overrides dark; tokens that point at other tokens are declared again so they resolve in this scope.
    const derived = Object.fromEntries(Object.entries(dark).filter(([name, value]) => value.includes('var(') && !(name in light)));
    return { ...derived, ...light, 'color-scheme': 'light' };
  }

  protected setPreview(p: Preview) {
    this.preview.set(p);
    previewTick.update((n) => n + 1);
  }

  protected mapping(sp: Specimen): string {
    const s = sp.spec;
    return [s.x ? `x ${s.x}` : '', s.y?.length ? `y ${s.y.join(', ')}` : '', s.group ? `group ${s.group}` : '', s.compare ? `compare ${s.compare}` : ''].filter(Boolean).join(' · ') || 'all columns';
  }

  protected jump(id: string) {
    const reduce = this.doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.doc.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    this.doc.getElementById(`cat-${id}`)?.focus({ preventScroll: true });
  }
}
