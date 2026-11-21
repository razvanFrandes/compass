import { Component, DOCUMENT, Pipe, type PipeTransform, computed, inject, input, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorCheckLight, phosphorCopyLight } from '@ng-icons/phosphor-icons/light';
import { inline } from '../markdown';
import { REPO_URL, repoHref } from './docs-pages';

/*
  The small parts every docs page is made of: a page head, a section, a grid of cells, a table and a copy button.
  Their classes (`docs-*`) are styled once, in the hub (docs-hub.ts), so every page reads the same.
  Text may carry **bold** and `code`; it goes through the app's own Markdown escaper (markdown.ts).
*/

/** One line of Markdown as safe HTML, for `[innerHTML]`. */
@Pipe({ name: 'md' })
export class MdPipe implements PipeTransform {
  transform(text: string): string {
    return inline(text);
  }
}

@Component({
  selector: 'docs-head',
  imports: [MdPipe],
  host: { class: 'block' },
  template: `
    <header class="max-w-[76ch]">
      <p class="text-muted-foreground text-[12px] font-medium tracking-[0.06em] uppercase">{{ eyebrow() }}</p>
      <h1 id="docs-title" tabindex="-1" class="mt-1 text-[26px] font-semibold tracking-[-0.02em] text-balance outline-none">{{ title() }}</h1>
      <p class="docs-md text-muted-foreground mt-2 text-[15px]/relaxed" [innerHTML]="lede() | md"></p>
    </header>
  `,
})
export class DocsHead {
  readonly eyebrow = input('Docs');
  readonly title = input.required<string>();
  readonly lede = input.required<string>();
}

@Component({
  selector: 'docs-section',
  imports: [MdPipe],
  host: { class: 'block' },
  template: `
    <section [attr.aria-labelledby]="'s-' + anchor()" [id]="anchor()" class="scroll-mt-20">
      <h2 [id]="'s-' + anchor()" class="text-[20px] font-semibold tracking-[-0.01em]">{{ heading() }}</h2>
      @if (note()) {
        <p class="docs-md text-muted-foreground mt-1 max-w-[76ch] text-[14px]/relaxed" [innerHTML]="note() | md"></p>
      }
      <div class="mt-4"><ng-content /></div>
    </section>
  `,
})
export class DocsSection {
  readonly heading = input.required<string>();
  readonly anchor = input.required<string>();
  readonly note = input('');
}

export interface DocsCell {
  /** A small label above the title, e.g. "Database". */
  k?: string;
  title: string;
  text: string;
}

/** A grid of short statements separated by hairlines: principles, limits, what is real. */
@Component({
  selector: 'docs-cells',
  imports: [MdPipe],
  host: { class: 'block' },
  template: `
    <ul class="docs-cells" [style.--docs-cell-min]="min() + 'px'">
      @for (c of items(); track c.title) {
        <li>
          @if (c.k) {
            <span class="docs-k">{{ c.k }}</span>
          }
          <strong class="text-[15px] font-semibold">{{ c.title }}</strong>
          <p class="docs-md text-muted-foreground text-[13.5px]/relaxed" [innerHTML]="c.text | md"></p>
        </li>
      }
    </ul>
  `,
})
export class DocsCells {
  readonly items = input.required<readonly DocsCell[]>();
  /** The narrowest a cell may get before the grid drops a column. */
  readonly min = input(280);
}

/** A table that scrolls sideways inside its own box on a narrow screen. The first column is the row header. */
@Component({
  selector: 'docs-table',
  imports: [MdPipe],
  host: { class: 'block' },
  template: `
    <div class="docs-table" tabindex="0" role="region" [attr.aria-label]="caption()">
      <table [style.min-width.px]="minWidth()">
        <caption class="sr-only">{{ caption() }}</caption>
        <thead>
          <tr>
            @for (h of head(); track h; let i = $index) {
              <th scope="col" [class.docs-num]="numeric().includes(i)">{{ h }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (r of rows(); track $index) {
            <tr>
              @for (c of r; track $index; let i = $index) {
                @if (i === 0) {
                  <th scope="row" class="docs-md" [innerHTML]="c | md"></th>
                } @else {
                  <td class="docs-md" [class.docs-num]="numeric().includes(i)" [class.docs-nowrap]="nowrap().includes(i)" [innerHTML]="c | md"></td>
                }
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class DocsTable {
  readonly caption = input.required<string>();
  readonly head = input.required<readonly string[]>();
  readonly rows = input.required<readonly (readonly string[])[]>();
  /** Column indexes set as figures: right-aligned, tabular. */
  readonly numeric = input<readonly number[]>([]);
  /** Column indexes that hold one short token (a key, a view name) and must not break across lines. */
  readonly nowrap = input<readonly number[]>([]);
  readonly minWidth = input(520);
}

/** A value in a monospace field with a Copy button; the result is announced. */
@Component({
  selector: 'docs-copy',
  imports: [NgIcon],
  providers: [provideIcons({ phosphorCheckLight, phosphorCopyLight })],
  host: { class: 'block' },
  template: `
    <div class="docs-copy" [class.docs-copy--block]="block()">
      @if (block()) {
        <pre class="min-w-0 flex-1" tabindex="0" role="region" [attr.aria-label]="label()"><code>{{ value() }}</code></pre>
      } @else {
        <code class="min-w-0 flex-1 truncate" [attr.title]="value()">{{ value() }}</code>
      }
      <button type="button" class="docs-copy__btn" [attr.aria-label]="'Copy ' + label()" (click)="copy()">
        <ng-icon [name]="state() === 'copied' ? 'phosphorCheckLight' : 'phosphorCopyLight'" aria-hidden="true" />
        <span>{{ state() === 'copied' ? 'Copied' : state() === 'failed' ? 'Select and copy' : 'Copy' }}</span>
      </button>
      <span class="sr-only" role="status">{{ state() === 'copied' ? label() + ' copied' : state() === 'failed' ? 'Copying is blocked here. Select the text and copy it.' : '' }}</span>
    </div>
  `,
})
export class DocsCopy {
  readonly value = input.required<string>();
  /** What is copied, for the button's name: "the MCP URL". */
  readonly label = input('the value');
  /** Several lines (shell commands): shown as a block that scrolls sideways, not cut to one line. */
  readonly block = input(false);
  protected readonly state = signal<'idle' | 'copied' | 'failed'>('idle');
  private readonly view = inject(DOCUMENT).defaultView;
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected async copy() {
    clearTimeout(this.timer);
    try {
      await this.view?.navigator.clipboard.writeText(this.value());
      this.state.set('copied');
    } catch {
      this.state.set('failed');
    }
    this.timer = setTimeout(() => this.state.set('idle'), 2400);
  }
}

/** A path in the repository: a link to its source once the repository is public (`REPO_URL`), plain text until then. */
@Component({
  selector: 'docs-source',
  template: `
    @if (href(); as url) {
      <a class="docs-link" [href]="url" target="_blank" rel="noopener noreferrer"><code class="docs-code">{{ path() }}</code><span class="sr-only"> (opens the source in a new tab)</span></a>
    } @else {
      <code class="docs-code">{{ path() }}</code>
    }
  `,
})
export class DocsSource {
  readonly path = input.required<string>();
  /** A folder (`tree`) or a file (`blob`). */
  readonly kind = input<'tree' | 'blob'>('tree');
  /** The repository's address; the docs pass nothing and get `REPO_URL`. */
  readonly repo = input(REPO_URL);
  protected readonly href = computed(() => repoHref(this.path(), this.kind(), this.repo()));
}

export const DOCS_KIT = [DocsHead, DocsSection, DocsCells, DocsTable, DocsCopy, DocsSource, MdPipe] as const;
