import { Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorCompassFill } from '@ng-icons/phosphor-icons/fill';

/** The product's name, as the logo says it and as page titles end ("Boards · Compass"). */
export const BRAND = 'Compass';

/**
 * The Compass logo: Phosphor's compass on a rounded tile in the brand accent, then the wordmark in the theme's
 * display face. `variant="mark"` is the tile alone (the sidebar rail, tight headers); `size` is the tile's side
 * in px, and the wordmark scales with it.
 *
 * The glyph is the Fill weight. At 16–24 px the tile leaves it 12–18 px: a solid disc with the needle cut out
 * keeps its shape there, while the outline weights (and the duotone's 20 % layer) blur into the tile.
 * public/favicon.svg and the PNG icons are generated from the same path (scripts/brand-icons.mjs).
 *
 * Colours come from the theme: `--logo-tile` and `--logo-ink` (styles.css, themes/juyo-concept/tokens.css),
 * which fall back to the primary pair. The glyph is ≥ 3:1 on the tile and the tile ≥ 3:1 on the surfaces it
 * sits on, in every theme. The wordmark takes the colour of the text around it.
 *
 * The host is one image named "Compass". Inside a link, give the link its own label ("Compass, morning brief").
 */
@Component({
  selector: 'app-compass-logo',
  imports: [NgIcon],
  providers: [provideIcons({ phosphorCompassFill })],
  host: {
    role: 'img',
    '[attr.aria-label]': 'brand',
    '[attr.data-variant]': 'variant()',
    '[style.--logo-size]': 'size() + "px"',
  },
  styles: `
    :host { display: inline-flex; flex-shrink: 0; align-items: center; gap: calc(var(--logo-size) * 0.36); vertical-align: middle; }
    .tile {
      display: grid; flex-shrink: 0; width: var(--logo-size); height: var(--logo-size); place-items: center;
      border-radius: calc(var(--logo-size) * 0.25);
      background: var(--logo-tile, var(--primary)); color: var(--logo-ink, var(--primary-foreground));
      font-size: calc(var(--logo-size) * 0.75);
    }
    .word {
      font-family: var(--font-display, var(--font-sans)); font-stretch: var(--font-width-display, normal);
      font-size: calc(var(--logo-size) * 0.8); font-weight: var(--type-display-weight, 600); line-height: 1; letter-spacing: -0.02em; white-space: nowrap;
    }
    /* Forced colours drop the tile's fill: a border keeps its shape, and the glyph takes the text colour. */
    @media (forced-colors: active) {
      .tile { border: 1px solid CanvasText; }
    }
  `,
  template: `
    <span class="tile" aria-hidden="true"><ng-icon name="phosphorCompassFill" /></span>
    @if (variant() === 'full') {
      <span class="word" aria-hidden="true">{{ brand }}</span>
    }
  `,
})
export class CompassLogo {
  /** `full` is the tile and the wordmark; `mark` is the tile alone. */
  readonly variant = input<'full' | 'mark'>('full');
  /** The tile's side, in px. */
  readonly size = input(22);

  protected readonly brand = BRAND;
}
