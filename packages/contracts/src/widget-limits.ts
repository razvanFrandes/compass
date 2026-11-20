/*
  Plain values of the widget contract, with no schema library behind them: the app's first bundle reads these (and
  `fitWidget`) through `@compass/contracts/widget-fit` without loading zod.
*/

export const WIDGET_FORMATS = ['number', 'percent', 'currency', 'count'] as const;

/** A widget never carries more rows than this; a board widget neither. */
export const WIDGET_MAX_ROWS = 200;
