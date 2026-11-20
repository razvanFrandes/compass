import { Component, DOCUMENT, ElementRef, afterRenderEffect, computed, inject, input, signal, viewChildren } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { CompassStore, type View } from '../../store';
import { THEMES, Theme } from '../../theme';
import { CONCEPT_ONLY, SCALES } from '../../theme-lab/tokens';
import { DOCS_KIT, type DocsCell } from '../docs-kit';
import { type TokenValue, readTokensOf, shortValue, toMs, toPx } from '../token-reader';

/** Re-read the page's tokens when the theme changes or the web fonts arrive. */
function useThemeVersion() {
  const theme = inject(Theme);
  const fonts = signal(0);
  inject(DOCUMENT).fonts?.ready.then(() => fonts.update((n) => n + 1));
  return computed(() => `${theme.id()}:${fonts()}`);
}

/**
 * Token names with the value the element they sit in resolves them to. A colour gets a swatch. Names the theme
 * does not define are counted in one line, not listed: the default themes carry those values in their components.
 */
@Component({
  selector: 'docs-token-table',
  host: { class: 'block' },
  template: `
    @if (set().length) {
      <table class="w-full table-fixed text-[12.5px]">
        <caption class="sr-only">{{ caption() }}</caption>
        <thead class="sr-only">
          <tr><th scope="col">Token</th><th scope="col">Value in this theme</th></tr>
        </thead>
        <tbody>
          @for (r of set(); track r.name) {
            <tr>
              <th scope="row" class="border-border w-[46%] truncate border-b py-1.5 pr-3 text-left font-mono text-[12px] font-normal">{{ r.name }}</th>
              <td class="border-border border-b py-1.5">
                <span class="flex min-w-0 items-center gap-2">
                  @if (r.kind === 'colour') {
                    <span class="border-border size-3.5 shrink-0 rounded-[2px] border" [style.background]="r.value"></span>
                  }
                  <span class="min-w-0 truncate tabular-nums" [attr.title]="r.value">{{ short(r.value) }}</span>
                </span>
              </td>
            </tr>
          }
        </tbody>
      </table>
    }
    @if (unset().length) {
      <p class="text-muted-foreground text-[12.5px]/relaxed" [class.mt-2]="set().length">
        {{ set().length ? 'Not tokens in this theme' : 'This theme has no ' + what() + ' tokens' }}: <span class="font-mono text-[12px]">{{ unset().join(', ') }}</span>. {{ set().length ? 'The' : 'Its components write these values, and the' }} Juyo concept theme defines them.
      </p>
    }
  `,
})
export class DocsTokenTable {
  readonly names = input.required<readonly string[]>();
  readonly caption = input('Design tokens and their values');
  /** What the tokens are, for the sentence shown when the theme has none: "motion", "elevation". */
  readonly what = input('such');
  private readonly rows = signal<TokenValue[]>([]);
  protected readonly set = computed(() => this.rows().filter((r) => r.kind !== 'unset'));
  protected readonly unset = computed(() => this.rows().filter((r) => r.kind === 'unset').map((r) => r.name));
  protected readonly short = shortValue;

  constructor() {
    const host: ElementRef<HTMLElement> = inject(ElementRef);
    const version = useThemeVersion();
    afterRenderEffect(() => {
      version();
      this.rows.set(readTokensOf(host.nativeElement, this.names()));
    });
  }
}

/** Colour roles as swatches: the fill is the token itself, the text under it is the value read from the page. */
@Component({
  selector: 'docs-swatches',
  host: { class: 'block' },
  template: `
    <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      @for (t of rows(); track t.name) {
        <li class="min-w-0">
          <span class="border-border block h-12 rounded-md border" [style.background]="'var(' + t.name + ')'"></span>
          <span class="mt-1.5 block truncate text-[13px] font-medium">{{ t.job }}</span>
          <span class="text-muted-foreground block truncate font-mono text-[11.5px]">{{ t.name }}</span>
          <span class="text-muted-foreground block truncate text-[11.5px] tabular-nums" [attr.title]="t.value">{{ t.value || 'not set' }}</span>
        </li>
      }
    </ul>
  `,
})
export class DocsSwatches {
  /** `[token, job]` pairs. */
  readonly tokens = input.required<readonly (readonly [string, string])[]>();
  protected readonly rows = signal<{ name: string; job: string; value: string }[]>([]);

  constructor() {
    const host: ElementRef<HTMLElement> = inject(ElementRef);
    const version = useThemeVersion();
    afterRenderEffect(() => {
      version();
      const values = readTokensOf(
        host.nativeElement,
        this.tokens().map(([name]) => name),
      );
      this.rows.set(this.tokens().map(([name, job], i) => ({ name, job, value: shortValue(values[i]!.value, 40) })));
    });
  }
}

/** Shows a computed CSS property of the element projected into it: what a class really produces in this theme. */
@Component({
  selector: 'docs-probe',
  host: { class: 'flex min-w-0 flex-col items-start gap-1.5' },
  template: `
    <ng-content />
    <span class="text-muted-foreground max-w-full text-[12px] tabular-nums">{{ label() }} <span class="text-foreground">{{ value() }}</span></span>
  `,
})
export class DocsProbe {
  readonly read = input.required<string>();
  readonly label = input('');
  protected readonly value = signal('');

  constructor() {
    const host: ElementRef<HTMLElement> = inject(ElementRef);
    const version = useThemeVersion();
    afterRenderEffect(() => {
      version();
      const target = host.nativeElement.firstElementChild;
      if (!target) return;
      const v = getComputedStyle(target).getPropertyValue(this.read()).trim();
      this.value.set(/^-?[\d.]+px$/.test(v) ? `${+Number.parseFloat(v).toFixed(2)}px` : v === '' || v === 'none' ? 'none' : shortValue(v, 44));
    });
  }
}

const COLOUR_GROUPS: readonly { title: string; tokens: readonly (readonly [string, string])[] }[] = [
  { title: 'Surfaces', tokens: [['--background', 'Canvas'], ['--card', 'Card'], ['--popover', 'Popover'], ['--muted', 'Quiet fill'], ['--field', 'Field'], ['--rail', 'Rail']] },
  { title: 'Text, lines and focus', tokens: [['--foreground', 'Text'], ['--muted-foreground', 'Secondary text'], ['--border', 'Hairline'], ['--input', 'Control border'], ['--field-border', 'Field border'], ['--ring', 'Focus ring']] },
  { title: 'Meaning', tokens: [['--primary', 'Main action'], ['--brand', 'Kassandra'], ['--decision', 'Needs your decision'], ['--decision-tint', 'Decision tint'], ['--positive', 'Ahead'], ['--negative', 'Behind, failed']] },
  { title: 'Data', tokens: [['--series', 'This period'], ['--series-cmp', 'Comparison period'], ['--series-ref', 'Reference: budget'], ['--series-3', 'Third series'], ['--series-muted', 'Muted marks'], ['--brass', 'Decision mark']] },
];

const TYPE_SAMPLES = [
  { role: 'Page title', cls: 'text-[26px] font-semibold tracking-[-0.02em]', text: 'Morning brief' },
  { role: 'Section', cls: 'text-[20px] font-semibold tracking-[-0.01em]', text: 'Needs your decision' },
  { role: 'Card title', cls: 'text-[16px] font-semibold tracking-[-0.01em]', text: 'Lisbon Chiado is 15.9% behind last year' },
  { role: 'Body', cls: 'text-[14px]', text: 'Rooms on the books for the next 45 nights, against the same time last year.' },
  { role: 'Dense', cls: 'text-[13px]', text: 'Arbor Lisbon Chiado · stays 1–31 Dec 2026' },
  { role: 'Label', cls: 'text-[12px] font-medium', text: 'On the books' },
  { role: 'Figure', cls: 'text-[24px] font-semibold tracking-[-0.02em] tabular-nums', text: '€1,284,560' },
  { role: 'Code', cls: 'font-mono text-[12.5px]', text: 'select sum(room_revenue) from hotel.v_hotel_day' },
] as const;

const SPACE_STEPS = [1, 2, 3, 4, 6, 8, 12, 16] as const;

const MOTION_TOKENS = ['--motion-instant', '--motion-fast', '--motion-moderate', '--motion-slow', '--motion-chart'] as const;
const MOTION_JOBS: Record<string, string> = { '--motion-instant': 'Hover', '--motion-fast': 'Toggles, selection', '--motion-moderate': 'Popover, new content', '--motion-slow': 'Panel, sheet', '--motion-chart': 'A chart draws' };
/** The default themes have no motion tokens: these are the durations their components write. */
const MOTION_LITERALS = [
  { name: 'Hover and press', ms: 175, text: '120–175 ms' },
  { name: 'Popover, sheet', ms: 260, text: '200–260 ms' },
  { name: 'Generated content', ms: 320, text: '320 ms' },
  { name: 'A chart draws', ms: 700, text: '600–700 ms' },
] as const;

const RESEARCH: readonly DocsCell[] = [
  { k: 'Direction', title: '“Ledger”', text: 'A light working surface framed by Juyo’s ink rail, set like a well-kept ledger: figures first, quiet rules, nothing decorative.' },
  { k: 'Colour', title: 'Three jobs', text: 'Blue is this period’s data. Violet is Kassandra. Orange is a decision that waits for you. The model never computes a number, so numbers are never violet.' },
  { k: 'Type', title: 'Figures are the display type', text: 'One family, Archivo, on its width axis: wide for headings, normal for text, condensed tabular figures for numbers.' },
  { k: 'Shape', title: 'Lines before shadows', text: 'Layers are separated by tone and a hairline. A shadow means one thing: this floats. Radius follows the size of the thing.' },
  { k: 'Motion', title: 'Fast and quiet', text: 'A state change takes 110 ms on one curve. Nothing blurs, bounces or scales. A chart draws once.' },
  { k: 'Sources', title: 'What was read', text: 'Material 3, Apple HIG, Carbon, Primer, Polaris, Atlassian and Radix Colors for token structure; Tufte and Few for charts; WCAG 2.2 and APCA for contrast. The research and the spec are in `docs/research/theme/`.' },
];

const RESET = Object.fromEntries(CONCEPT_ONLY.map((name) => [name, 'initial']));

/**
 * /docs/design-system: the tokens of the theme on screen, read from the rendered CSS, then the three themes side
 * by side. The page holds token names only, so it cannot disagree with the stylesheets.
 */
@Component({
  selector: 'docs-design-system',
  imports: [...DOCS_KIT, HlmButtonImports, DocsTokenTable, DocsSwatches, DocsProbe],
  host: { class: 'block' },
  styles: `
    .ramp {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(0, 1fr);
      height: 28px;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: var(--radius-control, 6px);
    }
    .space-bar {
      height: 10px;
      border-radius: var(--radius-mark, 2px);
      background: var(--series);
    }
    .sample-box {
      width: 64px;
      height: 44px;
      border: 1px solid var(--field-border-hover);
      background: var(--card);
    }
    .track {
      position: relative;
      height: 6px;
      border-radius: var(--radius-mark, 3px);
      background: var(--muted);
    }
    .track > i {
      position: absolute;
      inset: 0 auto 0 0;
      width: 0;
      border-radius: inherit;
      background: var(--series);
      transition-property: width;
      transition-timing-function: var(--ease-standard, ease);
    }
    @media (prefers-reduced-motion: reduce) {
      .track > i {
        transition: none;
      }
    }
    .pane {
      min-width: 0;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-container, 14px);
      background: var(--background);
      color: var(--foreground);
      /* A pane starts from its own theme's type, not from the page around it. */
      font-family: var(--font-sans);
      font-size: 1rem;
      font-stretch: normal;
      letter-spacing: normal;
    }
  `,
  template: `
    <div class="flex flex-col gap-12">
      <docs-head
        eyebrow="Docs · Design system"
        title="Tokens first, read from the page"
        lede="Compass has three themes that share one set of token names: Light, Dark and the Juyo concept. Every value on this page is read from the CSS as it renders, with \`getComputedStyle\`. Switch the theme and the page reads itself again."
      />

      <div class="docs-panel flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
        <p id="ds-theme" class="text-[14px] font-medium">Theme on screen</p>
        <div class="seg" role="radiogroup" aria-labelledby="ds-theme">
          @for (t of themes; track t.id) {
            <button type="button" role="radio" [attr.aria-checked]="theme.id() === t.id" (click)="theme.set(t.id)">{{ t.label }}</button>
          }
        </div>
        <p class="text-muted-foreground text-[13px]">
          More depth: <a class="docs-link" href="/theme-lab" (click)="go($event, 'theme-lab')">the theme lab</a> (contrast audit, both themes side by side) and <a class="docs-link" href="/catalog" (click)="go($event, 'catalog')">the chart catalogue</a>.
        </p>
      </div>

      <docs-section heading="Colour" anchor="colour" note="Components read roles, never raw values. The same role names exist in every theme; a theme is a new mapping of them. Each text role passes WCAG AA (4.5:1) on its surface and each chart role 3:1.">
        <div class="flex flex-col gap-6">
          @for (g of colours; track g.title) {
            <div>
              <h3 class="mb-2.5 text-[14px] font-semibold">{{ g.title }}</h3>
              <docs-swatches [tokens]="g.tokens" />
            </div>
          }
        </div>

        <h3 class="mt-8 mb-1 text-[14px] font-semibold">Colour scales</h3>
        @if (hasScales()) {
          <p class="text-muted-foreground mb-3 max-w-[76ch] text-[13.5px]/relaxed">The concept theme builds its roles from scales in OKLCH. A step has the same job in every scale (1–3 tinted surfaces, 5 graphics, 6 text), so contrast follows from the step number.</p>
          <ul class="grid gap-x-8 gap-y-3 md:grid-cols-2">
            @for (s of scales; track s.name) {
              <li class="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-3">
                <span class="font-mono text-[12px]">{{ s.name }}</span>
                <span class="ramp" role="img" [attr.aria-label]="s.name + ' scale, ' + s.steps.length + ' steps: ' + s.note">
                  @for (step of s.steps; track step) {
                    <i [style.background]="'var(--jc-' + s.name + '-' + step + ')'"></i>
                  }
                </span>
                <span class="text-muted-foreground col-start-2 text-[12px]">{{ s.note }}</span>
              </li>
            }
          </ul>
        } @else {
          <p class="text-muted-foreground max-w-[76ch] text-[13.5px]/relaxed">Light and Dark map each role straight to a value sampled from Juyo’s own product. The Juyo concept theme adds eleven primitive scales under the roles. <button type="button" class="docs-link" (click)="theme.set('juyo-concept')">Switch to the concept theme</button> to see them here.</p>
        }
      </docs-section>

      <docs-section heading="Type" anchor="type" note="The left column is the text as the app sets it. The right column is what the browser measured: size over line height, weight and family.">
        <div class="docs-panel overflow-hidden">
          <table class="w-full">
            <caption class="sr-only">The type scale, as rendered in this theme</caption>
            <thead class="sr-only">
              <tr><th scope="col">Role</th><th scope="col">Sample</th><th scope="col">Measured</th></tr>
            </thead>
            <tbody>
              @for (s of typeSamples; track s.role; let i = $index) {
                <tr class="border-border border-b last:border-b-0">
                  <th scope="row" class="text-muted-foreground w-[92px] px-4 py-2.5 text-left align-baseline text-[12px] font-normal max-sm:hidden">{{ s.role }}</th>
                  <td class="min-w-0 px-4 py-2.5 align-baseline sm:pl-0"><span #sample class="block" [class]="s.cls">{{ s.text }}</span></td>
                  <td class="text-muted-foreground w-[38%] px-4 py-2.5 text-right align-baseline text-[12px] tabular-nums sm:w-[240px]">{{ measured()[i] }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="mt-4 grid gap-x-8 gap-y-2 md:grid-cols-2">
          <docs-token-table [names]="['--font-sans', '--font-mono', '--font-display', '--font-numeric']" caption="Font family tokens" what="font" />
          <docs-token-table [names]="['--type-body-size', '--type-body-line', '--type-title-size', '--type-display-size']" caption="Type scale tokens" what="type scale" />
        </div>
      </docs-section>

      <docs-section heading="Spacing and density" anchor="spacing" [note]="'Every gap is a multiple of one unit, ' + (unit() || '0.25rem') + ', read from \`--spacing\`. Touch targets are at least 44px on a coarse pointer in every theme.'">
        <div class="grid gap-x-8 gap-y-5 md:grid-cols-2">
          <ul class="flex flex-col gap-2.5">
            @for (s of space(); track s.n) {
              <li class="grid grid-cols-[28px_minmax(0,1fr)_48px] items-center gap-3 text-[12px] tabular-nums">
                <span class="font-mono">{{ s.n }}</span>
                <span class="space-bar" [style.width.px]="s.px"></span>
                <span class="text-muted-foreground text-right">{{ s.px }}px</span>
              </li>
            }
          </ul>
          <docs-token-table [names]="['--spacing', '--control-height-sm', '--control-height-md', '--control-height-lg', '--row-height']" caption="Spacing and density tokens" what="density" />
        </div>
      </docs-section>

      <docs-section heading="Radii" anchor="radii" note="Radius follows the size of the thing. The value under each sample is measured from the class the app uses.">
        <div class="grid gap-x-8 gap-y-5 md:grid-cols-2">
          <div class="flex flex-wrap items-start gap-5">
            <docs-probe read="border-top-left-radius" label="mark"><span class="sample-box block rounded-sm"></span></docs-probe>
            <docs-probe read="border-top-left-radius" label="control"><span class="sample-box block rounded-md"></span></docs-probe>
            <docs-probe read="border-top-left-radius" label="container"><span class="sample-box block rounded-xl"></span></docs-probe>
            <docs-probe read="border-top-left-radius" label="overlay"><span class="sample-box block rounded-2xl"></span></docs-probe>
          </div>
          <docs-token-table [names]="['--radius', '--radius-mark', '--radius-control', '--radius-container', '--radius-overlay']" caption="Radius tokens" what="radius" />
        </div>
      </docs-section>

      <docs-section heading="Elevation" anchor="elevation" note="Three levels above the canvas, shown with the app’s own classes: a card, a popover, a dialog.">
        <div class="grid gap-x-8 gap-y-5 md:grid-cols-2">
          <div class="grid gap-5 sm:grid-cols-3">
            <docs-probe read="box-shadow" label="shadow"><div class="insight-card w-full p-3"><p class="text-[13px] font-medium">Card</p><p class="text-muted-foreground text-[12px]">On the canvas</p></div></docs-probe>
            <docs-probe read="box-shadow" label="shadow"><div class="filter-pop static! w-full"><p class="text-[13px] font-medium">Popover</p><p class="text-muted-foreground text-[12px]">Floats over a card</p></div></docs-probe>
            <docs-probe read="box-shadow" label="shadow"><div class="confirm-dialog w-full p-3!"><p class="text-[13px] font-medium">Dialog</p><p class="text-muted-foreground text-[12px]">Takes over</p></div></docs-probe>
          </div>
          <docs-token-table [names]="['--elevation-raised', '--elevation-overlay', '--elevation-modal']" caption="Elevation tokens" what="elevation" />
        </div>
      </docs-section>

      <docs-section heading="Motion" anchor="motion" note="Motion answers an action and then gets out of the way. With reduced motion on, nothing here animates.">
        <div class="grid gap-x-8 gap-y-5 md:grid-cols-2">
          <div>
            <ul class="flex flex-col gap-3">
              @for (m of motion(); track m.name) {
                <li>
                  <span class="flex justify-between gap-3 text-[12.5px]"><span>{{ m.name }}</span><span class="text-muted-foreground tabular-nums">{{ m.text }}</span></span>
                  <span class="track mt-1.5 block"><i [style.width.%]="run() ? m.pct : 0" [style.transition-duration.ms]="run() ? m.ms : 0"></i></span>
                </li>
              }
            </ul>
            <button hlmBtn variant="secondary" size="sm" class="mt-4" (click)="play()">Play</button>
          </div>
          <docs-token-table [names]="motionNames" caption="Motion tokens" what="motion" />
        </div>
      </docs-section>

      <docs-section heading="The three themes, side by side" anchor="themes" note="The same markup three times. Each pane sets \`data-theme\`, and the swatches under it read that pane’s own values.">
        <div class="grid gap-4 xl:grid-cols-3">
          @for (t of themes; track t.id) {
            <div class="pane" [class]="t.id === 'dark' ? 'dark' : 'light'" [attr.data-theme]="t.id" [style]="t.id === 'juyo-concept' ? null : reset" role="group" [attr.aria-label]="t.label + ' theme'">
              <p class="text-muted-foreground mb-3 text-[12px]">{{ t.label }}</p>
              <article class="insight-card p-4">
                <div class="flex items-start justify-between gap-3">
                  <h3 class="text-[15px] font-semibold">Barcelona Mar has 26 of 300 rooms out of order</h3>
                  <span class="money-chip shrink-0">−€115k</span>
                </div>
                <p class="text-muted-foreground mt-1.5 text-[13.5px]">About €115k of room revenue is at risk over the next 30 days. <span class="ai-tag">AI</span></p>
                <div class="mt-3 flex flex-col gap-1.5" role="img" aria-label="Three bars: this period, the comparison period and a decision mark">
                  <span class="block h-2 w-[86%] rounded-[2px] bg-(--series)"></span>
                  <span class="block h-2 w-[64%] rounded-[2px] bg-(--series-cmp)"></span>
                  <span class="block h-2 w-[28%] rounded-[2px] bg-(--brass)"></span>
                </div>
                <div class="mt-4 flex flex-wrap items-center gap-2">
                  <button hlmBtn size="sm">Explore</button>
                  <button hlmBtn variant="secondary" size="sm">Add to board</button>
                  <span class="status-chip status-chip--needs">Needs you</span>
                </div>
              </article>
              <docs-token-table class="mt-3" [names]="['--background', '--card', '--foreground', '--primary', '--brand', '--series', '--decision', '--font-sans']" [caption]="'Key tokens of the ' + t.label + ' theme'" />
            </div>
          }
        </div>
      </docs-section>

      <docs-section heading="The thinking behind the concept theme" anchor="research" note="Juyo runs two design systems that share no tokens: a light marketing site and a dark product. The concept is one system for both, built from the brand’s own ink, off-white, blue, violet and orange.">
        <docs-cells [items]="research" [min]="280" />
      </docs-section>
    </div>
  `,
})
export class DocsDesignSystem {
  protected readonly theme = inject(Theme);
  private readonly store = inject(CompassStore);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly samples = viewChildren<ElementRef<HTMLElement>>('sample');
  private readonly version = useThemeVersion();

  protected readonly themes = THEMES;
  protected readonly colours = COLOUR_GROUPS;
  protected readonly scales = SCALES;
  protected readonly typeSamples = TYPE_SAMPLES;
  protected readonly research = RESEARCH;
  protected readonly motionNames = [...MOTION_TOKENS, '--ease-standard'];
  protected readonly reset = RESET;

  /** What the page reads from itself after each render. */
  private readonly read = signal<{ scales: boolean; unit: string; motion: TokenValue[] }>({ scales: false, unit: '', motion: [] });
  protected readonly measured = signal<string[]>([]);
  protected readonly hasScales = computed(() => this.read().scales);
  protected readonly unit = computed(() => this.read().unit);
  protected readonly space = computed(() => {
    const base = toPx(this.unit() || '0.25rem') ?? 4;
    return SPACE_STEPS.map((n) => ({ n, px: +(n * base).toFixed(1) }));
  });
  protected readonly motion = computed(() => {
    const tokens = this.read().motion.filter((m) => m.kind === 'time');
    // A bar's length is its duration, on one scale for every theme (700 ms is the longest any theme uses).
    const pct = (ms: number) => Math.max(4, Math.min(100, Math.round(ms / 7)));
    if (!tokens.length) return MOTION_LITERALS.map((m) => ({ name: m.name, ms: m.ms, text: m.text, pct: pct(m.ms) }));
    return tokens.map((m) => ({ name: MOTION_JOBS[m.name] ?? m.name, ms: toMs(m.value) ?? 0, text: `${toMs(m.value)} ms`, pct: pct(toMs(m.value) ?? 0) }));
  });
  /** False for a moment when Play is pressed: the bars drop to zero, then grow again at their own speed. */
  protected readonly run = signal(true);

  constructor() {
    afterRenderEffect(() => {
      this.version();
      const el = this.host.nativeElement;
      const [ink, unit, ...motion] = readTokensOf(el, ['--jc-ink-0', '--spacing', ...MOTION_TOKENS]);
      this.read.set({ scales: ink!.kind !== 'unset', unit: unit!.value, motion });
      this.measured.set(
        this.samples().map((s) => {
          const cs = getComputedStyle(s.nativeElement);
          const family = cs.fontFamily.split(',')[0]!.replace(/['"]/g, '').trim();
          return `${px(cs.fontSize)} / ${px(cs.lineHeight)} · ${cs.fontWeight} · ${family}`;
        }),
      );
    });
  }

  protected play() {
    this.run.set(false);
    // Two frames: the bars snap back to zero first, then fill at their own duration.
    const view = this.host.nativeElement.ownerDocument.defaultView;
    view?.requestAnimationFrame(() => view.requestAnimationFrame(() => this.run.set(true)));
  }

  protected go(event: MouseEvent, view: View) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    this.store.go(view);
  }
}

/** "22.4px" → "22.4", "normal" stays. */
const px = (v: string) => (/px$/.test(v) ? `${+Number.parseFloat(v).toFixed(1)}` : v);
