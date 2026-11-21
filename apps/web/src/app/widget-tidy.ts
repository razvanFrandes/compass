import { tidyWidget } from '@compass/contracts/widget-tidy';
import type { BoardWidget, ChatWidget } from './api';
import { HOTELS } from './filters';

/*
  The web's guard for what a widget shows of its columns (packages/contracts/src/widget-tidy.ts): a column that says
  the same on every row is hidden and said once in the subtitle, and a unit the label says is not repeated. The server
  does this for new widgets; this covers widgets saved before it, on boards and in old conversations. The rows are
  never touched. Memoized, so a chart gets the same object on every live update and is not redrawn.
*/

const NAMES = new Map(HOTELS.map((hotel) => [hotel.code, hotel.name]));
const hotelName = (code: string) => NAMES.get(code);

const chats = new WeakMap<ChatWidget, ChatWidget>();

export function tidyChatWidget(widget: ChatWidget): ChatWidget {
  let tidy = chats.get(widget);
  if (!tidy) {
    const result = tidyWidget(widget, { hotelName });
    const same = result.columns === widget.columns && result.subtitle === widget.subtitle && result.y === widget.y;
    tidy = same ? widget : { ...widget, ...defined(result), columns: result.columns };
    chats.set(widget, tidy);
  }
  return tidy;
}

const boards = new WeakMap<BoardWidget, BoardWidget>();

export function tidyBoardWidget(widget: BoardWidget): BoardWidget {
  let tidy = boards.get(widget);
  if (!tidy) {
    const result = tidyWidget({ ...widget.spec, rows: widget.rows, columns: widget.columns }, { hotelName });
    const same = result.columns === widget.columns && result.subtitle === widget.spec.subtitle && result.y === widget.spec.y;
    tidy = same ? widget : { ...widget, spec: { ...widget.spec, ...defined(result) }, columns: result.columns };
    boards.set(widget, tidy);
  }
  return tidy;
}

function defined({ subtitle, y }: { subtitle?: string; y?: string[] }) {
  return { ...(subtitle === undefined ? {} : { subtitle }), ...(y === undefined ? {} : { y }) };
}
