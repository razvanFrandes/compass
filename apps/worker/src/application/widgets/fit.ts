/**
 * Does a widget fit its rows? The rules live in `@compass/contracts` (widget-fit.ts), because the app runs the same
 * function to offer "View as" kinds and to draw the instant preview. The Worker imports them from here.
 */
export { fitWidget, type WidgetFit, type WidgetSource } from '@compass/contracts';
