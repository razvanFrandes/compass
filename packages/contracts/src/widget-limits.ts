/*
  Plain values of the widget contract, with no schema library behind them: the app's first bundle reads these (and
  `fitWidget`) through `@compass/contracts/widget-fit` without loading zod.
*/

export const WIDGET_FORMATS = ['number', 'percent', 'currency', 'count'] as const;

/**
 * A widget never carries more rows than this; a board widget neither. It leaves room for a grid of the 20 hotels over
 * 20 nights (a heatmap of the group's next two weeks is 280 cells).
 */
export const WIDGET_MAX_ROWS = 400;

/**
 * What a board's card on the Boards page draws (`GET /api/boards` → `preview`): its first widgets, each with only the
 * columns it uses and a few rows (a long series thinned evenly, a calendar whole up to three months, a table's first rows).
 */
export const BOARD_PREVIEW = { widgets: 4, rows: 40, calendarDays: 92, tableRows: 5 } as const;
