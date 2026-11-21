import { Component, computed, input } from '@angular/core';
import { TILE_H, TILE_W, type CardHeadline, type MiniTile } from './board-preview-model';

/** A sparkline across the card: this year solid, the comparison dashed (the built-in boards). */
export interface CardSpark {
  line: string;
  ly: string;
}

/**
 * The picture on a board's card, the same height on every card so the grid lines up: a headline figure (label, the
 * number, the change beside it on one line) over a sparkline or a row of tiny charts, or, without a headline, a
 * mosaic of up to four tiny charts. With nothing to draw it shows a faint placeholder mosaic. Decorative: the card
 * says in words what the board holds.
 */
@Component({
  selector: 'app-board-card-visual',
  host: { class: 'board-visual', 'aria-hidden': 'true' },
  template: `
    @let h = headline();
    @if (h) {
      <span class="board-visual-head">
        <span class="board-visual-label">{{ h.label }}</span>
        <span class="board-visual-figure">
          <span class="board-visual-value">{{ h.value }}</span>
          @if (h.delta) {
            <span class="board-visual-delta">{{ h.delta }} {{ h.versus }}</span>
          }
        </span>
      </span>
    }
    @if (spark(); as s) {
      <svg [attr.viewBox]="'0 0 300 64'" preserveAspectRatio="none" class="board-visual-spark">
        <path [attr.d]="s.ly" fill="none" class="stroke-(--series-cmp)" stroke-width="1.25" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
        <path [attr.d]="s.line" fill="none" class="stroke-(--series)" stroke-width="1.75" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
      </svg>
    } @else if (tiles().length) {
      <span class="board-visual-tiles" [attr.data-layout]="layout()">
        @for (t of tiles(); track $index) {
          <span class="board-tile" [attr.data-kind]="t.kind">
            @switch (t.kind) {
              @case ('line') {
                <svg [attr.viewBox]="box" preserveAspectRatio="none">
                  <path [attr.d]="t.area" class="board-tile-area" />
                  @if (t.cmp) {
                    <path [attr.d]="t.cmp" class="board-tile-cmp" vector-effect="non-scaling-stroke" />
                  }
                  <path [attr.d]="t.line" class="board-tile-line" vector-effect="non-scaling-stroke" />
                </svg>
              }
              @case ('bars') {
                <svg [attr.viewBox]="box" preserveAspectRatio="none">
                  @for (b of t.bars; track $index) {
                    <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="0.6" [class.board-tile-neg]="b.neg" class="board-tile-bar" />
                  }
                  <line x1="0" x2="100" [attr.y1]="t.zero" [attr.y2]="t.zero" class="board-tile-zero" vector-effect="non-scaling-stroke" />
                </svg>
              }
              @case ('donut') {
                <svg viewBox="0 0 40 40" preserveAspectRatio="xMidYMid meet">
                  @for (a of t.arcs; track $index) {
                    <path [attr.d]="a.d" [style.fill]="arcColor(a.i)" />
                  }
                </svg>
              }
              @case ('cells') {
                <svg [attr.viewBox]="'0 0 ' + t.cols * 6 + ' ' + t.rows * 6" preserveAspectRatio="xMidYMid meet">
                  @for (c of t.cells; track $index) {
                    <rect [attr.x]="c.col * 6" [attr.y]="c.row * 6" width="5" height="5" rx="1" [style.fill]="cellColor(c.level)" />
                  }
                </svg>
              }
              @case ('figure') {
                <span class="board-tile-figure">{{ t.value }}</span>
              }
              @case ('rows') {
                <span class="board-tile-rows">
                  @for (w of t.widths; track $index) {
                    <i [style.width.%]="w"></i>
                  }
                </span>
              }
            }
          </span>
        }
      </span>
    } @else if (placeholder()) {
      <span class="board-visual-tiles board-visual-tiles--empty" data-layout="grid">
        <span class="board-tile board-tile--ghost"><svg [attr.viewBox]="box" preserveAspectRatio="none"><path d="M0,30 L20,24 L40,27 L60,16 L80,19 L100,9" vector-effect="non-scaling-stroke" /></svg></span>
        <span class="board-tile board-tile--ghost"><svg [attr.viewBox]="box" preserveAspectRatio="none"><rect x="8" y="18" width="12" height="22" /><rect x="30" y="8" width="12" height="32" /><rect x="52" y="24" width="12" height="16" /><rect x="74" y="13" width="12" height="27" /></svg></span>
        <span class="board-tile board-tile--ghost"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="13.5" fill="none" stroke-width="6.5" /></svg></span>
        <span class="board-tile board-tile--ghost"><span class="board-tile-rows"><i style="width: 90%"></i><i style="width: 70%"></i><i style="width: 80%"></i></span></span>
      </span>
    }
  `,
})
export class BoardCardVisual {
  readonly headline = input<CardHeadline | null>(null);
  readonly tiles = input<readonly MiniTile[]>([]);
  readonly spark = input<CardSpark | null>(null);
  /** Nothing to draw: the faint placeholder mosaic. */
  readonly placeholder = input(false);

  protected readonly box = `0 0 ${TILE_W} ${TILE_H}`;
  /** Under a headline the tiles share one row; alone they make a mosaic (two by two when there are four). */
  protected readonly layout = computed(() => (this.headline() ? 'row' : this.tiles().length === 4 ? 'grid' : 'row-tall'));

  protected arcColor(i: number): string {
    if (i < 0) return 'var(--series-muted, #8c959f)';
    const fallback = ['var(--series)', 'var(--series-3, #32bebf)', 'var(--series-cmp)', '#d9a441', '#e07bb0'][i] ?? 'var(--series-muted)';
    return `var(--cat-${i + 1}, ${fallback})`;
  }
  protected cellColor(level: number): string {
    return `color-mix(in srgb, var(--series) ${18 + level * 20}%, var(--card))`;
  }
}
