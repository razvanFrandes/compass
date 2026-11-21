import { Service, signal } from '@angular/core';
import { WIDGET_KINDS, type WidgetKind } from './widget-types';

/*
  "View as" is remembered per widget: the kind a person switched a chart to comes back when they return to the
  answer, the board or the page. It is this person's way of reading a chart, so it lives in this browser
  (localStorage), keyed by what the widget is: `answer:<call id>`, `board:<widget id>`. The widget itself is not
  changed: "Add to board" is what saves a chosen kind for everyone.
*/

const STORE = 'compass.view-as.v1';
/** The oldest choices go first: an answer nobody reopened does not need to be remembered for ever. */
const LIMIT = 400;
const KNOWN: ReadonlySet<string> = new Set(WIDGET_KINDS);

function read(): Record<string, WidgetKind> {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage?.getItem(STORE) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, WidgetKind] => typeof entry[1] === 'string' && KNOWN.has(entry[1])));
  } catch {
    return {};
  }
}

@Service()
export class ViewAsMemory {
  private readonly picks = signal<Record<string, WidgetKind>>(read());

  /** The kind chosen for this widget, or null when it shows as it came. A signal read: the chart follows a change. */
  kind(key: string | null | undefined): WidgetKind | null {
    return key ? (this.picks()[key] ?? null) : null;
  }

  /** Remembers a choice; null forgets it (the widget shows as it came again). */
  set(key: string, kind: WidgetKind | null): void {
    this.picks.update((picks) => {
      const { [key]: _previous, ...rest } = picks;
      if (!kind) return rest;
      // Written last, so the newest choices are the ones kept.
      const entries = [...Object.entries(rest), [key, kind] as [string, WidgetKind]];
      return Object.fromEntries(entries.slice(-LIMIT));
    });
    try {
      globalThis.localStorage?.setItem(STORE, JSON.stringify(this.picks()));
    } catch {
      // Storage is full or blocked: the choice still holds for this visit.
    }
  }
}
