# Density and layout tokens

The contract between the screens. Research and reasons: `layout-and-density.md`. The values live in
`apps/web/src/density.css`; `apps/web/src/app/theme/density.ts` is the catalogue the tests and the theme lab read
(`density-tokens.spec.ts` fails when the two disagree). `/theme-lab` → Density shows every token at both densities.

## How density is set

- `data-density="comfortable" | "compact"` on `<html>` is the person's choice. Comfortable is the default. The
  switch is `<app-density-switch>` (`src/app/theme/density-switch.ts`), in the sidebar under the theme; the choice
  is kept in `localStorage["compass.density"]` by the `Density` service (`src/app/theme/density.ts`).
- The same attribute on any element makes that region denser or roomier than the page:
  `<section data-density="compact">`. Regions that are compact whatever the page is: the Behind the numbers panel,
  `<juyo-data-table>`, the Portfolio filter bar, the audit log, the builder's top bar. The builder's inspector is
  always comfortable (it is a form).
- Density is separate from `data-theme`. A theme sets colour, type and shape and never these tokens.
- Density changes heights, padding and gaps. It never changes a font size.
- Overlays stay comfortable: `dialog`, `[role=dialog]`, `[role=menu]`, `[role=listbox]`, `[popover]`,
  `[data-overlay]`, the CDK overlay container.
- Touch (`pointer: coarse`): rows and controls are 44 px at both densities (48 px for large controls).
- Under 600 px wide the page gutter and card padding are 16 px at both densities.

## Density tokens

| Token | Tailwind utility | Comfortable | Compact | Use |
|---|---|---|---|---|
| `--space-page-x` | `px-page-x` | 24 px | 16 px | Page gutter |
| `--space-section` | `gap-section`, `pt-section` | 32 px | 24 px | Between the sections of a page |
| `--space-section-lg` | `gap-section-lg`, `py-section-lg` | 48 px | 32 px | Around a page's hero: the brief's summary and KPI rail |
| `--space-card-gap` | `gap-card-gap` | 16 px | 8 px | Between cards in a grid |
| `--space-card-pad` | `p-card-pad` | 24 px | 16 px | Inside a card |
| `--space-stack` | `gap-stack`, `mt-stack` | 12 px | 8 px | A title to its content; rows of a stack |
| `--space-inline` | `gap-inline` | 8 px | 4 px | Items on one line |
| `--row-h` | `h-row` | 40 px | 32 px | Table and list rows; a two-line row is `calc(var(--row-h) + 1.5rem)` |
| `--control-h-xs` | `h-control-xs` | 28 px | 24 px | Extra-small buttons, segments |
| `--control-h-sm` | `h-control-sm` | 32 px | 28 px | Small buttons, chips |
| `--control-h` | `h-control` | 36 px | 32 px | Buttons, fields, selects |
| `--control-h-lg` | `h-control-lg` | 40 px | 36 px | Prominent actions |
| `--cell-pad-x` | `px-cell-x` | 16 px | 12 px | Table cells |
| `--leading-body` | (line height of `text-body`) | 20 px | 18 px | 14 px text in rows |

Any spacing utility works with these names: `p-`, `px-`, `py-`, `m-`, `gap-`, `h-`, `min-h-`, `size-`, `inset-`.

## Constants (the same at both densities)

| Token | Tailwind utility | Value | Use |
|---|---|---|---|
| `--chart-h` | `h-chart` | 180 px | A chart in an overview. `CHART_HEIGHT.overview` for a chart drawn on a canvas |
| `--chart-h-hero` | `h-chart-hero` | 320 px | The featured chart of a page. `CHART_HEIGHT.hero` |
| `--spark-w` / `--spark-h` | `w-(--spark-w)` / `h-(--spark-h)` | 80 × 24 px | Sparkline beside a KPI figure |
| `--content-max` | `max-w-content` | 1280 px | Reading pages. Boards and the builder are full width |
| `--measure` | `max-w-measure` | 68ch | A line of prose. It is measured in the element's own font size |
| `--tile-min` | `min-w-tile` | 200 px | The least width of a KPI tile or a chart |
| `--pane-evidence` | `w-evidence` | 400 px | Behind the numbers beside a conversation |

## Type roles (never change with density)

| Token | Tailwind utility | Size / line | Use |
|---|---|---|---|
| `--text-label` | `text-label` | 12 / 16 | The label of a figure, weight 500, `text-muted-foreground` |
| `--text-body` | `text-body` | 14 / `--leading-body` | Text in rows |
| `--text-card-title` | `text-card-title` | 16 / 24 | The title of a card |
| `--text-section` | `text-section` | 20 / 28 | The title of a section |
| `--text-kpi` | `text-kpi` | 32 / 40 | The figure on the main KPI rail |
| `--text-kpi-sm` | `text-kpi-sm` | 24 / 32 | The figure on a secondary tile |

`.num` sets tabular lining figures.

## Layout classes

| Class | What it does |
|---|---|
| `.page` | The gutter (`--space-page-x`) and the 1280 px ceiling, centred. `.page--wide` removes the ceiling (boards) |
| `.page-sections` | A column with `--space-section` between its children |
| `.stack` | A column with `--space-stack` between its children |
| `.grid-12` | Twelve columns, `--space-card-gap` apart. Children span with `col-span-*` |
| `.kpi-row` | KPI tiles: as many as fit at 200 px or more, never more than four on a row |
| `.chart-row` | Charts or cards: as many as fit at 200 px or more, never more than three on a row |
| `.surface` | A flat card: the card tone, a hairline, `--space-card-pad` inside, no shadow. `.surface--flush` drops the padding (a table inside) |
| `.section-title` | 16 / 24, weight 600: the title above a section |

## Rules the screens follow

1. The ladder: sections are `--space-section` apart, cards `--space-card-gap`, the rows inside a card
   `--space-stack`. An inner gap never equals the gap that separates its parent from its neighbours.
2. Cards are flat: tone or a hairline. A shadow means the thing floats (popover, dialog, sheet, toast).
3. Lines separate rows of a table or a list, and nothing else. Groups are separated by space.
4. A row holds at most four KPI tiles or three charts; a tile or a chart is 200 px wide at least.
5. A chart is 180 px tall among others and 320 px when it is the featured one. A bar chart with a bar per row
   keeps its own height.
6. One hero per screen.

## For the morning brief (branch `r3/brief`)

Everything the research's CSS block names exists with the same name: `--space-page-x`, `--space-section`,
`--space-card-gap`, `--space-card-pad`, `--space-stack`, `--space-inline`, `--row-h`, `--control-h`, `--cell-pad-x`,
`--leading-body`, `--chart-h`, `--chart-h-hero`, `--spark-w`, `--spark-h`, `--content-max`, `--measure`,
`--text-label`, `--text-body`, `--text-card-title`, `--text-section`, `--text-kpi`, `--text-kpi-sm`, the utilities
`px-page-x`, `gap-section`, `gap-card-gap`, `p-card-pad`, `gap-stack`, and `.num`.

For the brief's layout: `.page` for the 1280 px column, `py-section-lg` around the summary and the KPI rail (48 px,
the only place with that much air), `.kpi-row` for the four tiles with `text-kpi` figures, then a `.grid-12` with
`col-span-12 lg:col-span-8` and `lg:col-span-4` for the 2/3 + 1/3 split, charts at `h-chart`.
