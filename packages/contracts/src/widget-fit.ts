import type { EvidenceColumn } from './evidence.ts';
import { WIDGET_FORMATS, WIDGET_MAX_ROWS } from './widget-limits.ts';
import type { WidgetSpec } from './widgets.ts';

/**
 * Does this widget fit these rows? The model picks a kind and column keys; this checks them against the rows of the
 * tool result it named: the keys exist, the numbers are numbers, and the kind suits the shape (a pie only for 2–7
 * parts of one whole, a line only over an ordered x, a funnel only over stages that shrink).
 *
 * A refusal is a sentence for the model: what is wrong and what to do instead. On success the spec comes back with
 * only the fields the kind uses, and `format` filled from the first y column.
 *
 * It lives in the contracts because both sides run it: the Worker before a widget reaches the client or a board, and
 * the app to offer only the kinds a chart can be switched to ("View as") and to draw the instant preview. One
 * function, so the app never offers what the server would refuse.
 *
 * This module imports types and plain values only (no zod), and has its own entry, `@compass/contracts/widget-fit`,
 * so the app can load it in its first bundle.
 */

/** Expected failures are values, not exceptions (the Worker's `Result`, by shape). */
export type WidgetFit = { ok: true; value: WidgetSpec } | { ok: false; error: string };
const ok = (value: WidgetSpec): WidgetFit => ({ ok: true, value });
const err = (error: string): WidgetFit => ({ ok: false, error });

type Row = Record<string, unknown>;
type Used = Pick<WidgetSpec, 'x' | 'y' | 'group' | 'compare' | 'forecast' | 'band' | 'target' | 'limit'>;
/** A check: null when fine, else the sentence for the model. */
type Check = string | null;

export interface WidgetSource {
  rows: Row[];
  columns: EvidenceColumn[];
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ORDERED_TEXT = /^\d{4}-\d{2}(-\d{2}([ T]\d{2}:\d{2}.*)?)?$/;
const NARROW = 'Call the data tool again narrower: fewer hotels, a shorter period, a coarser grain or a roll-up.';
const ONE_ROW = 'Call the data tool again for one hotel or a roll-up with grain "total", or use bar or table.';

const quote = (key: string) => `"${key}"`;
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const present = (value: unknown) => value !== null && value !== undefined;

/** A number column: every value that is there is a number, and at least one is there. */
function isNumeric(rows: Row[], key: string): boolean {
  const values = rows.map((row) => row[key]).filter(present);
  return values.length > 0 && values.every(isNumber);
}

/** An ordered column: numbers, or ISO days, months or timestamps, with no gap. */
function isOrdered(rows: Row[], key: string): boolean {
  const values = rows.map((row) => row[key]);
  return values.every(isNumber) || values.every((value) => typeof value === 'string' && ORDERED_TEXT.test(value));
}

const distinct = (rows: Row[], keys: string[]) => new Set(rows.map((row) => keys.map((key) => String(row[key])).join('\u0000'))).size;
const sum = (rows: Row[], key: string) => rows.reduce((total, row) => total + (isNumber(row[key]) ? (row[key] as number) : 0), 0);
const range = (min: number, max: number) => (min === max ? String(min) : `${min}–${max}`);
const plural = (count: number, word: string) => `${word}${count === 1 ? '' : 's'}`;

export function fitWidget(spec: WidgetSpec, source: WidgetSource): WidgetFit {
  const { rows, columns } = source;
  if (rows.length === 0) return err('That result has no rows, so there is nothing to show. Answer in text.');
  if (rows.length > WIDGET_MAX_ROWS) {
    return err(`That result has ${rows.length} rows; a widget shows at most ${WIDGET_MAX_ROWS}. ${NARROW}`);
  }

  const known = [...new Set([...columns.map((column) => column.key), ...rows.flatMap((row) => Object.keys(row))])];
  const named = [spec.x, ...(spec.y ?? []), spec.group, spec.compare, spec.forecast, ...(spec.band ?? []), spec.target, spec.limit].filter(
    (key): key is string => key !== undefined,
  );
  const unknown = named.filter((key) => !known.includes(key));
  if (unknown.length) return err(`Unknown ${plural(unknown.length, 'column')} ${unknown.map(quote).join(', ')}. Columns of that result: ${known.join(', ')}.`);

  const numeric = known.filter((key) => isNumeric(rows, key));
  // A table lists any columns; everywhere else y is drawn, so it has to be a number.
  const extra = (role: string, key: string | undefined) => (key ? [[role, key] as const] : []);
  const drawn = [
    ...(spec.kind === 'table' ? [] : (spec.y ?? []).map((key) => ['y', key] as const)),
    ...extra('compare', spec.compare),
    ...extra('forecast', spec.forecast),
    ...extra('the low end of band', spec.band?.[0]),
    ...extra('the high end of band', spec.band?.[1]),
    ...extra('target', spec.target),
    ...extra('limit', spec.limit),
  ];
  for (const [role, key] of drawn) {
    if (!numeric.includes(key)) return err(`${quote(key)} is not a number column, so it cannot be ${role}. Number columns of that result: ${numeric.join(', ') || 'none'}.`);
  }

  const used = rulesFor(spec, rows, columns);
  if (typeof used === 'string') return err(used);

  const firstY = spec.kind === 'table' ? undefined : used.y?.[0];
  const columnKind = columns.find((column) => column.key === firstY)?.kind;
  const format = spec.format ?? WIDGET_FORMATS.find((candidate) => candidate === columnKind);
  return ok({
    kind: spec.kind,
    title: spec.title,
    ...(spec.subtitle ? { subtitle: spec.subtitle } : {}),
    sourceCallId: spec.sourceCallId,
    ...(used.x ? { x: used.x } : {}),
    ...(used.y?.length ? { y: used.y } : {}),
    ...(used.group ? { group: used.group } : {}),
    ...(used.compare ? { compare: used.compare } : {}),
    ...(used.forecast ? { forecast: used.forecast } : {}),
    ...(used.band ? { band: used.band } : {}),
    ...(used.target ? { target: used.target } : {}),
    ...(used.limit ? { limit: used.limit } : {}),
    ...(format ? { format } : {}),
  });
}

/** The fields the kind uses, or why the kind does not fit these rows. */
function rulesFor(spec: WidgetSpec, rows: Row[], columns: EvidenceColumn[]): Used | string {
  const { kind, x, group, compare, forecast, band, target, limit } = spec;
  const y = spec.y ?? [];
  const n = rows.length;
  const kindOf = (key: string | undefined) => columns.find((column) => column.key === key)?.kind;
  const first = (...checks: Check[]): Check => checks.find((check) => check !== null) ?? null;

  const needX = (what: string): Check => (x ? null : `${kind} needs x: ${what}.`);
  const needGroup = (what: string): Check => (group ? null : `${kind} needs group: ${what}.`);
  const yCount = (min: number, max: number, what: string): Check =>
    y.length >= min && y.length <= max ? null : `${kind} needs ${range(min, max)} y ${plural(max, 'column')}: ${what}. You passed ${y.length}.`;
  const rowCount = (min: number, max: number, hint: string): Check =>
    n >= min && n <= max ? null : `${kind} fits ${range(min, max)} ${plural(max, 'row')}; that result has ${n}. ${hint}`;
  const orderedX = (): Check =>
    !x || isOrdered(rows, x) ? null : `${kind} needs an ordered x: a date, month or number column. ${quote(x)} is not one. Use bar for categories.`;
  const points = (): Check => (!x || distinct(rows, [x]) >= 2 ? null : `${kind} needs at least 2 points on x; that result has 1. Use kpi.`);
  /** One row per value of these columns. */
  const unique = (keys: (string | undefined)[], hint: string): Check => {
    const given = keys.filter((key): key is string => key !== undefined);
    return given.length === 0 || distinct(rows, given) === n ? null : `${given.map(quote).join(' + ')} repeats in that result. ${hint}`;
  };
  const series = (max: number): Check => {
    const count = group ? distinct(rows, [group]) : 0;
    return count <= max ? null : `${kind} would get ${count} series from ${quote(group ?? '')}; more than ${max} cannot be read. Call the data tool for fewer hotels or a roll-up, or use table.`;
  };
  const notNegative = (key: string | undefined): Check =>
    key && rows.some((row) => isNumber(row[key]) && (row[key] as number) < 0) ? `${kind} cannot show negative values, and ${quote(key)} has some. Use bar.` : null;
  const labelled = (what: string): Check => (n === 1 ? null : first(needX(what), unique([x], 'Each row needs its own x value.')));
  /** The low end of the band is never above the high end. */
  const bandInOrder = (): Check => {
    if (!band) return null;
    const [low, high] = band;
    if (low === high) return `band needs two different columns: the low end (P10) and the high end (P90). You passed ${quote(low)} twice.`;
    const crossed = rows.some((row) => isNumber(row[low]) && isNumber(row[high]) && (row[low] as number) > (row[high] as number));
    return crossed ? `band is [low, high], and ${quote(low)} is above ${quote(high)} on some rows. Pass them the other way round.` : null;
  };
  /** The overlays a line, an area or a bar draws: with group (a line per hotel) only the limit, which is one flat line. */
  const overlays = (): Pick<Used, 'forecast' | 'band' | 'target' | 'limit'> => (group ? { limit } : { forecast, band, target, limit });
  /** Stages only shrink: `values` in stage order, `names` to say which one grew. */
  const shrinking = (values: unknown[], names: string[]): Check => {
    for (let i = 1; i < values.length; i++) {
      const [before, after] = [values[i - 1], values[i]];
      if (isNumber(before) && isNumber(after) && after > before) {
        return `funnel needs stages in order that only shrink; ${quote(names[i - 1] ?? '')} (${before}) is followed by a larger ${quote(names[i] ?? '')} (${after}). Put the stages in order, or use bar.`;
      }
    }
    return null;
  };

  switch (kind) {
    case 'kpi':
      return first(yCount(1, 1, 'the number'), rowCount(1, 1, ONE_ROW)) ?? { y, compare };

    case 'kpi_row':
      // One row with a tile per column, or a few rows with a tile each.
      if (n === 1) return first(yCount(2, 6, 'one tile per column')) ?? { y };
      return (
        first(rowCount(2, 6, 'Use bar or table for more.'), yCount(1, 1, 'the number of each tile'), needX('the column that names each tile'), unique([x], 'Each tile needs its own x value.')) ?? { x, y, compare }
      );

    case 'gauge':
      return (
        first(
          yCount(1, 1, 'the number'),
          rowCount(1, 1, ONE_ROW),
          kindOf(y[0]) === 'percent' || compare ? null : 'gauge needs a percent column as y, or compare: the column with the target or the maximum. Use kpi for a plain number.',
        ) ?? { y, compare }
      );

    case 'line':
    case 'area':
      return (
        first(
          needX('the date, month or number column along the bottom'),
          orderedX(),
          group ? yCount(1, 1, 'with group, one number split into a line per group value') : yCount(1, 6, 'one line per column'),
          series(20),
          unique([x, group], group ? 'Each line needs one row per x value.' : 'Pass group (the column that splits the rows into lines, e.g. the hotel), or call the data tool for one hotel or a roll-up.'),
          points(),
          bandInOrder(),
        ) ?? { x, y, group, compare: group || y.length > 1 ? undefined : compare, ...overlays(), target: group || kind === 'area' ? undefined : target }
      );

    case 'sparkline_list':
      return (
        first(
          needX('the date, month or number column along the bottom'),
          orderedX(),
          needGroup('the column that names each sparkline, e.g. the hotel'),
          yCount(1, 1, 'the number each sparkline follows'),
          series(30),
          unique([x, group], 'Each sparkline needs one row per x value.'),
          points(),
        ) ?? { x, y, group }
      );

    case 'calendar_heatmap':
      return (
        first(
          needX('the day column'),
          !x || rows.every((row) => typeof row[x] === 'string' && DAY.test(row[x] as string)) ? null : `calendar_heatmap needs a day column (YYYY-MM-DD) as x. ${quote(x ?? '')} is not one. Use bar or table.`,
          yCount(1, 1, 'the number of each day'),
          unique([x], 'A calendar needs one row per day: call the data tool for one hotel or a roll-up.'),
          rowCount(2, WIDGET_MAX_ROWS, 'Use kpi for one day.'),
        ) ?? { x, y }
      );

    case 'bar':
      return (
        first(
          needX('the category column, e.g. the hotel'),
          yCount(1, 1, 'the length of each bar'),
          rowCount(2, 50, 'Use kpi for one value and table for more than 50.'),
          unique([x], 'Each bar needs its own x value: use grouped_bar or stacked_bar with group, or call the data tool with grain "total".'),
          (forecast || band) && x && !isOrdered(rows, x)
            ? `bar draws forecast and band over columns in date order, and ${quote(x)} is not a date, month or number column. Leave forecast and band out, or use bullet for a forecast per hotel.`
            : null,
          bandInOrder(),
        ) ?? { x, y, compare, forecast, band, target, limit }
      );

    case 'stacked_bar':
    case 'grouped_bar':
      return (
        first(
          needX('the category or period column'),
          group ? yCount(1, 1, 'with group, one number split into a series per group value') : yCount(2, 8, 'one series per column, or one column with group'),
          series(12),
          unique([x, group], group ? 'Each series needs one row per x value.' : 'Pass group, or call the data tool with grain "total".'),
          !x || distinct(rows, [x]) <= 50 ? null : `${kind} would get more than 50 groups of bars. ${NARROW}`,
        ) ?? { x, y, group }
      );

    case 'pie':
    case 'donut':
    case 'treemap': {
      // A treemap with both x and group is nested: each part (x) sits inside its parent (group), e.g. hotels in regions.
      if (kind === 'treemap' && x && group && x !== group) {
        return (
          first(
            yCount(1, 1, 'the size of each part'),
            rowCount(2, 60, 'Use table for more.'),
            unique([x], 'Each part needs its own row: call the data tool with grain "total".'),
            notNegative(y[0]),
            y[0] === undefined || sum(rows, y[0]) > 0 ? null : `${quote(y[0] ?? '')} adds up to 0, so there is nothing to split.`,
          ) ?? { x, y, group }
        );
      }
      // The slice label is `group`; a label passed as x is taken too.
      const label = group ?? x;
      const whole = kind === 'treemap' ? null : partsOfAWhole(rows, y[0], kindOf(y[0]));
      return (
        first(
          label ? null : `${kind} needs group: the column that names each part.`,
          yCount(1, 1, 'the size of each part'),
          rowCount(2, kind === 'treemap' ? 60 : 7, kind === 'treemap' ? 'Use table for more.' : `${kind} is only for 2–7 parts of one whole: use bar, or treemap for many parts.`),
          unique([label], 'Each part needs its own row: call the data tool for one hotel or a roll-up with grain "total".'),
          notNegative(y[0]),
          y[0] === undefined || sum(rows, y[0]) > 0 ? null : `${quote(y[0] ?? '')} adds up to 0, so there is nothing to split.`,
          whole,
        ) ?? { y, group: label }
      );
    }

    case 'table':
      return { y: spec.y };

    case 'heatmap':
      return (
        first(
          needX('the column across'),
          needGroup('the column down'),
          yCount(1, 1, 'the number in each cell'),
          unique([x, group], 'A heatmap needs one row per cell.'),
          !x || !group || (distinct(rows, [x]) >= 2 && distinct(rows, [group]) >= 2) ? null : 'heatmap needs at least 2 values across and 2 down. Use bar.',
        ) ?? { x, y, group }
      );

    case 'funnel':
      if (y.length >= 2) {
        // Stages are columns, in the order of y; each row is one funnel (mobile next to desktop).
        return (
          first(
            yCount(2, 8, 'the stages in order'),
            rowCount(1, 4, 'One funnel per row, at most 4: call the data tool for fewer rows.'),
            labelled('the column that names each funnel'),
            ...rows.map((row) => shrinking(y.map((key) => row[key]), y)),
          ) ?? { x: n > 1 ? x : undefined, y }
        );
      }
      // Stages are rows, in the order of the result.
      return (
        first(
          yCount(1, 1, 'the size of each stage, or 2–8 columns that are the stages in order'),
          needX('the column that names each stage'),
          rowCount(2, 8, 'A funnel has 2–8 stages.'),
          unique([x], 'Each stage needs its own row.'),
          shrinking(rows.map((row) => row[y[0] ?? '']), rows.map((row) => String(row[x ?? '']))),
        ) ?? { x, y }
      );

    case 'waterfall':
      return (
        first(needX('the column that names each step'), yCount(1, 1, 'the change of each step'), rowCount(2, 20, 'Use table for more.'), unique([x], 'Each step needs its own row.')) ?? { x, y }
      );

    case 'bullet':
      return (
        first(
          yCount(1, 1, 'the actual'),
          compare || target ? null : 'bullet needs compare or target: target is the budget (each bar as a % of it), compare the target or last year. Use bar without either.',
          rowCount(1, 20, 'Use table for more.'),
          labelled('the column that names each bar'),
          !target || rows.every((row) => isNumber(row[target]) && (row[target] as number) > 0)
            ? null
            : `bullet draws each row as a % of its own target, and ${quote(target ?? '')} is empty or 0 on some rows. Call the data tool for the hotels that have one, or leave target out and pass the budget as compare.`,
        ) ?? { x: n > 1 ? x : undefined, y, compare, forecast, target }
      );

    case 'scatter':
      return (
        first(
          needX('a number column'),
          !x || isNumeric(rows, x) ? null : `scatter needs a number column as x. ${quote(x ?? '')} is not one. Use bar.`,
          yCount(1, 1, 'the number up the side'),
          rowCount(3, WIDGET_MAX_ROWS, 'Use table for so few points.'),
        ) ?? { x, y, group }
      );

    case 'radar':
      return (
        first(yCount(3, 8, 'one axis per column, all on the same scale'), rowCount(1, 6, 'One shape per row, at most 6: use table for more.'), labelled('the column that names each shape')) ?? {
          x: n > 1 ? x : undefined,
          y,
        }
      );

    case 'sankey':
      return (
        first(
          needX('the column the flow starts from'),
          needGroup('the column the flow goes to'),
          x === group ? 'sankey needs different columns for the source (x) and the target (group).' : null,
          yCount(1, 1, 'the size of each flow'),
          rowCount(2, 100, 'Use table for more.'),
          unique([x, group], 'A sankey needs one row per flow.'),
          notNegative(y[0]),
          x && group && rows.some((row) => String(row[x]) === String(row[group])) ? 'sankey cannot draw a flow from a value to itself.' : null,
        ) ?? { x, y, group }
      );
  }
}

/** Percentages are the parts of one whole only when they add up to it (100, or 1 for fractions). */
function partsOfAWhole(rows: Row[], key: string | undefined, kind: EvidenceColumn['kind'] | undefined): Check {
  if (!key || kind !== 'percent') return null;
  const total = sum(rows, key);
  if (Math.abs(total - 100) <= 1.5 || Math.abs(total - 1) <= 0.015) return null;
  return `${quote(key)} adds up to ${Math.round(total * 10) / 10}%, not 100%, so these rows are not the parts of one whole. Use bar.`;
}

export { WIDGET_MAX_ROWS };
