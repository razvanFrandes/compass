import { WIDGET_MAX_ROWS, fitWidget } from '@compass/contracts/widget-fit';
import { column as columnOf } from './builders/shared';
import { isNumericKind } from './format';
import type { EvidenceColumn, WidgetKind, WidgetRow, WidgetSpec } from './widget-types';

/*
  Which kinds of chart can show these rows, and which one to start with. Pure: rows + columns (+ a spec) in, kinds out.

  Two layers decide. The first is the server's own check (`fitWidget` in @compass/contracts, the function behind
  show_widget and "Add to board"): a kind is only ever offered with a spec that check accepts, so a switched chart
  can always be saved. The second is taste the server leaves to the model: a donut only for parts that add up, a
  funnel only for stages, a waterfall only for signed steps. See `docs/api.md` "View as".

  The model never computes a number and neither does this file: a switch re-reads the same rows through other
  column roles. Nothing is aggregated or pivoted, and a kind that draws one number is only offered for a chart of
  one number (with its comparison), so a switch never quietly leaves a series out. The table shows every column.
*/

type Rows = readonly WidgetRow[];
type Columns = readonly EvidenceColumn[];

/** A kind these rows can be shown as, the spec that draws it, and why it fits (for the tooltip and screen readers). */
export interface KindOption {
  kind: WidgetKind;
  reason: string;
  spec: WidgetSpec;
}

/** What is already known about how to read the rows: a spec from Kassandra or a board, or a tool's usual columns. */
export interface KindHint {
  /** Preferred when the rows allow it. */
  kind?: WidgetKind;
  x?: string;
  y?: readonly string[];
  group?: string;
  compare?: string;
}

/** The order kinds are offered in: figures, comparisons, trends, parts, relations, and the table last. */
export const KIND_ORDER: readonly WidgetKind[] = [
  'kpi', 'kpi_row', 'gauge', 'bullet', 'bar', 'grouped_bar', 'stacked_bar', 'line', 'area', 'sparkline_list', 'calendar_heatmap',
  'donut', 'pie', 'treemap', 'funnel', 'waterfall', 'scatter', 'heatmap', 'radar', 'sankey', 'table',
];

export const KIND_LABELS: Record<WidgetKind, string> = {
  kpi: 'Number',
  kpi_row: 'Tiles',
  gauge: 'Gauge',
  bullet: 'Bullet',
  bar: 'Bar',
  grouped_bar: 'Grouped bar',
  stacked_bar: 'Stacked bar',
  line: 'Line',
  area: 'Area',
  sparkline_list: 'Sparklines',
  calendar_heatmap: 'Calendar',
  donut: 'Donut',
  pie: 'Pie',
  treemap: 'Treemap',
  funnel: 'Funnel',
  waterfall: 'Waterfall',
  scatter: 'Scatter',
  heatmap: 'Heatmap',
  radar: 'Radar',
  sankey: 'Flow',
  table: 'Table',
};

/** Kinds that are one another with a different fill: switching between them keeps every column role. */
const FAMILIES: readonly (readonly WidgetKind[])[] = [
  ['line', 'area'],
  ['grouped_bar', 'stacked_bar'],
  ['pie', 'donut'],
];

/* ───────── Reading the rows ───────── */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ORDERED_TEXT = /^\d{4}-\d{2}(-\d{2}([ T]\d{2}:\d{2}.*)?)?$/;
/** Free text (a review, a finding's title) is read, not charted: a column with values this long is not a dimension. */
const PROSE = 60;
/** Number columns that describe the row instead of measuring it. */
const META = /^(months|days|weeks|years|n|rows|rank|year|month_no|week_no)$/i;
/** A column that is the comparison of another: last year, budget, the period before. */
const COMPARISON = /(^|_)(stly|ly|last_year|budget|prev|previous|target|compare|p10|p90)(_|$)/i;
/** A column worked out from two others: the change, the variance. It annotates a figure; it is not the figure. */
const DERIVED = /(^|_)(change|var|variance|delta|diff)(_|$)/i;
/** Averages, rates and scores: they do not add up, so they are never the parts of a whole. */
const RATIO = /(^|_)(adr|revpar|trevpar|goppar|rate|avg|average|mean|median|price|per|index|score|ratio|margin|position)(_|$)/i;
const STAGE = /(stage|step|funnel|phase)/i;
const TOTAL_FLAGS = ['kind', 'type', 'step_kind', 'step_type', 'is_total'];

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const present = (value: unknown) => value !== null && value !== undefined;
const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

interface Shape {
  rows: Rows;
  n: number;
  /** Every column of the rows, the ones the backend did not describe inferred from the values. */
  columns: EvidenceColumn[];
  col(key: string | undefined): EvidenceColumn | undefined;
  /** Every value that is there is a number, and one is there: the server's test for a column that can be drawn. */
  numeric(key: string | undefined): boolean;
  distinct(...keys: string[]): number;
  /** Numbers, or ISO days, months or timestamps, with no gap: what a line may run along. */
  ordered(key: string): boolean;
  time(key: string | undefined): boolean;
  values(key: string): number[];
}

function shapeOf(rows: Rows, columns: Columns | null | undefined): Shape {
  const given = columns ?? [];
  const keys = [...new Set([...given.map((c) => c.key), ...rows.slice(0, 50).flatMap((row) => Object.keys(row))])];
  const context = { columns: given, rows, spec: { kind: 'table', title: '', sourceCallId: '' } as WidgetSpec };
  const all = keys.map((key) => columnOf(context, key));
  const byKey = new Map(all.map((c) => [c.key, c]));
  const numericCache = new Map<string, boolean>();
  const numeric = (key: string | undefined) => {
    if (!key) return false;
    let known = numericCache.get(key);
    if (known === undefined) {
      const values = rows.map((row) => row[key]).filter(present);
      known = values.length > 0 && values.every(isNumber);
      numericCache.set(key, known);
    }
    return known;
  };
  const distinct = (...use: string[]) => new Set(rows.map((row) => use.map((key) => String(row[key])).join('\u0000'))).size;
  const ordered = (key: string) => {
    const values = rows.map((row) => row[key]);
    return values.every(isNumber) || values.every((value) => typeof value === 'string' && ORDERED_TEXT.test(value));
  };
  return {
    rows,
    n: rows.length,
    columns: all,
    col: (key) => (key ? byKey.get(key) : undefined),
    numeric,
    distinct,
    ordered,
    time: (key) => !!key && ['date', 'month'].includes(byKey.get(key)?.kind ?? '') && ordered(key),
    values: (key) => rows.map((row) => row[key]).filter(isNumber),
  };
}

/** A column whose values add up to a meaningful total: counts and money, never rates, averages or scores. */
function additive(shape: Shape, key: string | undefined): boolean {
  const col = shape.col(key);
  if (!col || !shape.numeric(col.key)) return false;
  if (col.kind === 'count') return true;
  if (col.kind === 'percent') return sharesOfAWhole(shape, col.key);
  if (col.kind === 'currency') return !RATIO.test(col.key);
  return false;
}

/** Percentages that are the parts of one whole: they add up to it (100, or 1 for fractions). */
function sharesOfAWhole(shape: Shape, key: string): boolean {
  const total = shape.values(key).reduce((sum, value) => sum + value, 0);
  return Math.abs(total - 100) <= 1.5 || Math.abs(total - 1) <= 0.015;
}

const sameScale = (shape: Shape, keys: readonly string[]) => {
  const cols = keys.map((key) => shape.col(key));
  return cols.every((c) => c && c.kind === cols[0]?.kind && (c.unit ?? '') === (cols[0]?.unit ?? ''));
};

/** The columns a spec reads the rows by, whatever its kind calls them. */
interface Roles {
  /** Names each row (or each point along the bottom). */
  label?: string;
  /** Splits the rows into series, or is the second dimension. */
  split?: string;
  measures: string[];
  compare?: string;
}

function rolesOf(spec: KindHint, shape: Shape): Roles {
  const measures = (spec.y ?? []).filter((key) => shape.numeric(key));
  const compare = shape.numeric(spec.compare) ? spec.compare : undefined;
  if (spec.kind === 'scatter') {
    // Two numbers per point; the point's name is the label.
    return { label: spec.group, measures: [...measures, ...(shape.numeric(spec.x) && spec.x ? [spec.x] : [])], compare };
  }
  if (spec.x && spec.group && spec.x !== spec.group) {
    // A column with a value of its own on every row names the rows by itself: the other one is its parent (a
    // treemap's region around its hotels), not a second dimension to cross it with.
    if (shape.distinct(spec.x) === shape.n) return { label: spec.x, measures, compare };
    if (shape.distinct(spec.group) === shape.n) return { label: spec.group, measures, compare };
    return { label: spec.x, split: spec.group, measures, compare };
  }
  return { label: spec.x ?? spec.group, measures, compare };
}

/* ───────── What a kind would read ───────── */

type Proposal = Pick<WidgetSpec, 'x' | 'y' | 'group' | 'compare'> & { reason: string };

/** The spec that shows these roles as `kind`, or null when the kind does not suit the shape. */
function propose(kind: WidgetKind, roles: Roles, shape: Shape, stageLike: boolean): Proposal | null {
  const { n } = shape;
  const { label, split, measures, compare } = roles;
  const first = measures[0];
  if (kind === 'table') return { reason: n === 1 ? 'The exact row.' : `The exact ${n} rows.` };
  if (!first) return null;

  const labelCol = shape.col(label);
  const named = labelCol ? lower(labelCol.label) : 'row';
  const firstCol = shape.col(first);
  const unique = !!label && !split && shape.distinct(label) === n;
  const categorical = !!label && !shape.time(label) && !shape.numeric(label);
  const values = shape.values(first);
  const noNegatives = values.every((value) => value >= 0);
  const cells = !!label && !!split && shape.distinct(label, split) === n;
  const series = split ? shape.distinct(split) : 0;
  /** The chart is about one number: only then may a kind that draws a single number stand in for it. */
  const one = measures.length === 1;

  switch (kind) {
    case 'kpi':
      return n === 1 && measures.length === 1 ? { y: [first], compare, reason: 'One number.' } : null;

    case 'kpi_row':
      if (n === 1) return measures.length >= 2 && measures.length <= 4 ? { y: measures, reason: `${measures.length} numbers side by side.` } : null;
      return one && unique && categorical && n <= 4 ? { x: label, y: [first], compare, reason: `One tile per ${named}.` } : null;

    case 'gauge': {
      if (n !== 1 || measures.length !== 1) return null;
      const value = values[0] ?? 0;
      if (firstCol?.kind === 'percent' && value >= 0 && value <= 100) return { y: [first], compare, reason: 'A percentage, against 100%.' };
      const target = compare ? (shape.values(compare)[0] ?? 0) : 0;
      return compare && value >= 0 && target > 0 ? { y: [first], compare, reason: `Against ${lower(shape.col(compare)?.label ?? 'the target')}.` } : null;
    }

    case 'bullet':
      if (!one || !compare || n > 20) return null;
      if (n === 1) return label ? { x: label, y: [first], compare, reason: `Actual against ${lower(shape.col(compare)?.label ?? 'the target')}.` } : null;
      return unique && categorical ? { x: label, y: [first], compare, reason: `Actual against ${lower(shape.col(compare)?.label ?? 'the target')}, per ${named}.` } : null;

    case 'bar':
      if (!one || !unique || n < 2 || n > 50) return null;
      if (!categorical && n > 31) return null;
      return { x: label, y: [first], compare, reason: `One bar per ${named}.` };

    case 'grouped_bar':
    case 'stacked_bar': {
      if (!label) return null;
      const stacked = kind === 'stacked_bar';
      if (split) {
        if (!one || !cells || series < 2 || series > 6 || shape.distinct(label) > 24) return null;
        if (stacked && (!additive(shape, first) || !noNegatives)) return null;
        return { x: label, y: [first], group: split, reason: stacked ? `Each ${named} split into ${lower(shape.col(split)?.label ?? 'parts')}.` : `${shape.col(split)?.label ?? 'Series'} side by side for each ${named}.` };
      }
      if (!unique || n > 24) return null;
      if (stacked) {
        // Columns stack only when each is a part: counts or money that add up, none below zero.
        const parts = measures.slice(0, 6);
        const adds = !stageLike && parts.length >= 2 && sameScale(shape, parts) && parts.every((key) => additive(shape, key) && shape.values(key).every((value) => value >= 0));
        return adds ? { x: label, y: parts, reason: `${parts.length} numbers stacked into a total for each ${named}.` } : null;
      }
      const side = measures.length >= 2 ? measures.slice(0, 6) : compare ? [first, compare] : [];
      return side.length >= 2 && sameScale(shape, side) ? { x: label, y: side, reason: `${side.length} numbers side by side for each ${named}.` } : null;
    }

    case 'line':
    case 'area': {
      if (!label || !shape.ordered(label) || shape.distinct(label) < 2) return null;
      const reason = kind === 'line' ? `${labelCol?.label ?? 'The axis'} is in order, so the values read as a trend.` : `A trend over ${named}, filled.`;
      // Six lines is what the chart draws; more would be dropped without a word.
      if (split) return one && cells && series <= 6 ? { x: label, y: [first], group: split, reason } : null;
      if (!unique) return null;
      const lines = measures.length > 1 && sameScale(shape, measures) ? measures.slice(0, 6) : [first];
      return { x: label, y: lines, compare: lines.length === 1 ? compare : undefined, reason };
    }

    case 'sparkline_list':
      return one && label && split && shape.ordered(label) && cells && series <= 30 && shape.distinct(label) >= 2 ? { x: label, y: [first], group: split, reason: `A small trend for each ${lower(shape.col(split)?.label ?? 'series')}.` } : null;

    case 'calendar_heatmap':
      return one && unique && n >= 7 && shape.rows.every((row) => typeof row[label!] === 'string' && DAY.test(row[label!] as string)) ? { x: label, y: [first], reason: 'One value per day, laid out as a calendar.' } : null;

    case 'pie':
    case 'donut':
      // Stages sit inside one another: they are not the parts of a whole.
      if (!one || stageLike || !unique || !categorical || n < 2 || n > 7 || !additive(shape, first) || !noNegatives || values.filter((value) => value > 0).length < 2) return null;
      return { group: label, y: [first], reason: `${n} parts of one whole.` };

    case 'treemap':
      if (!one || stageLike || !unique || !categorical || n < 3 || n > 60 || !additive(shape, first) || !noNegatives || values.filter((value) => value > 0).length < 2) return null;
      return { group: label, y: [first], reason: `${n} parts, sized by their share.` };

    case 'funnel': {
      if (!one || !unique || !categorical || n < 2 || n > 8 || !noNegatives || !stageLike) return null;
      const shrinking = values.length === n && values.every((value, i) => i === 0 || value <= values[i - 1]!) && values[0]! > values[n - 1]!;
      return shrinking ? { x: label, y: [first], reason: `${n} stages that only shrink.` } : null;
    }

    case 'waterfall': {
      if (!one || !unique || !categorical || n < 2 || n > 20 || firstCol?.kind === 'percent') return null;
      const flagged = TOTAL_FLAGS.some((key) => shape.rows.some((row) => row[key] !== undefined));
      const signed = values.some((value) => value < 0) && values.some((value) => value > 0);
      return flagged || signed ? { x: label, y: [first], reason: 'Signed steps, in order, that add up.' } : null;
    }

    case 'scatter': {
      // Two different numbers: this year against last year is a comparison, not a relation.
      const across = measures[1];
      if (!across || n < 3 || (label && !categorical)) return null;
      return { x: across, y: [first], group: label, reason: `Two numbers per ${named}: ${lower(shape.col(across)?.label ?? across)} across, ${lower(firstCol?.label ?? first)} up.` };
    }

    case 'heatmap':
      if (!one || !label || !split || !cells || shape.distinct(label) < 2 || series < 2) return null;
      return { x: label, y: [first], group: split, reason: `${labelCol?.label ?? 'One column'} across, ${lower(shape.col(split)?.label ?? 'the other')} down, one number per cell.` };

    // A radar and a flow are drawn only when Kassandra asked for one: nothing in the rows says they would read well.
    case 'radar':
    case 'sankey':
      return null;
  }
}

const KEPT: Partial<Record<WidgetKind, string>> = {
  radar: 'One shape across several axes.',
  sankey: 'Flows from one side to the other.',
};

const base = (spec: WidgetSpec): Pick<WidgetSpec, 'title' | 'sourceCallId' | 'subtitle'> => ({ title: spec.title, sourceCallId: spec.sourceCallId, ...(spec.subtitle ? { subtitle: spec.subtitle } : {}) });

function fitted(kind: WidgetKind, spec: WidgetSpec, proposal: Proposal, shape: Shape): WidgetSpec | null {
  const { reason: _reason, ...roles } = proposal;
  const candidate: WidgetSpec = {
    kind,
    ...base(spec),
    ...(roles.x ? { x: roles.x } : {}),
    ...(roles.y?.length ? { y: [...roles.y] } : {}),
    ...(roles.group ? { group: roles.group } : {}),
    ...(roles.compare ? { compare: roles.compare } : {}),
    // The format follows the first number drawn: keep the spec's only while that column is the same.
    ...(spec.format && roles.y?.[0] === spec.y?.[0] && kind !== 'table' ? { format: spec.format } : {}),
  };
  const result = fitWidget(candidate, { rows: shape.rows as Record<string, unknown>[], columns: shape.columns });
  return result.ok ? (result.value as WidgetSpec) : null;
}

/**
 * The kinds these rows can be shown as, starting from a spec: each with the spec that draws it and the reason it
 * fits. The spec's own kind is always among them, as it is. The others read the same columns in other roles and
 * pass the server's check, so any of them can be saved to a board.
 */
export function compatibleKinds(spec: WidgetSpec, rows: Rows | null | undefined, columns?: Columns | null): KindOption[] {
  const current: KindOption = { kind: spec.kind, reason: 'How it was drawn.', spec };
  if (!rows?.length || rows.length > WIDGET_MAX_ROWS) return [current];
  const shape = shapeOf(rows, columns);

  // A table names columns, not roles: read the roles the way a first look at the rows would.
  const read = spec.kind === 'table' ? (recommendSpec(rows, columns, { y: spec.y?.filter((key) => shape.numeric(key)) }) ?? spec) : spec;
  const roles = fillRoles(rolesOf(read, shape), shape);
  const stageLike = spec.kind === 'funnel' || STAGE.test(`${roles.label ?? ''} ${shape.col(roles.label)?.label ?? ''}`);
  const family = FAMILIES.find((kinds) => kinds.includes(spec.kind)) ?? [];

  const options: KindOption[] = [];
  for (const kind of KIND_ORDER) {
    if (kind === spec.kind) {
      const proposal = propose(kind, roles, shape, stageLike);
      options.push({ ...current, reason: proposal?.reason ?? KEPT[kind] ?? current.reason });
      continue;
    }
    if (family.includes(kind)) {
      // The same chart with another fill keeps every role; a stack still needs parts that add up.
      const proposal = propose(kind, roles, shape, stageLike);
      const same = proposal ? fitted(kind, spec, { ...proposal, x: spec.x, y: spec.y, group: spec.group, compare: spec.compare }, shape) : null;
      if (proposal && same) options.push({ kind, reason: proposal.reason, spec: same });
      continue;
    }
    const proposal = propose(kind, roles, shape, stageLike);
    const next = proposal ? fitted(kind, spec, proposal, shape) : null;
    if (proposal && next) options.push({ kind, reason: proposal.reason, spec: next });
  }
  return options;
}

/** The spec that shows a widget as `kind`, when these rows allow it. */
export function specAs(spec: WidgetSpec, kind: WidgetKind | null | undefined, rows: Rows | null | undefined, columns?: Columns | null): WidgetSpec {
  if (!kind || kind === spec.kind) return spec;
  return compatibleKinds(spec, rows, columns).find((option) => option.kind === kind)?.spec ?? spec;
}

/* ───────── A first look at rows nobody described ───────── */

/** The comparison column of a value: `rooms_otb_stly` for `rooms_otb`, `compare_value` for `value`. */
function companion(shape: Shape, key: string): string | undefined {
  const stem = key.replace(/_(pct|eur)$/, '');
  const tail = key.slice(stem.length);
  const candidates = [
    ...['stly', 'ly', 'last_year', 'budget', 'previous', 'prev', 'target'].flatMap((word) => [`${key}_${word}`, `${stem}_${word}${tail}`, `${word}_${key}`, `${stem}_${word}`]),
    ...(key === 'value' ? ['compare_value'] : []),
    ...(key === 'value_eur' ? ['budget_eur', 'ly_eur'] : []),
  ];
  return candidates.find((candidate) => candidate !== key && shape.numeric(candidate) && shape.col(candidate)?.kind === shape.col(key)?.kind);
}

/** Roles with the gaps filled from the rows: the first number that measures something, the column that names each row. */
function fillRoles(roles: Roles, shape: Shape): Roles {
  const visible = shape.columns.filter((c) => !c.hidden && c.kind !== 'id');
  const numbers = visible.filter((c) => isNumericKind(c.kind) && shape.numeric(c.key));
  const varying = shape.n > 1 ? numbers.filter((c) => shape.distinct(c.key) > 1) : numbers;
  const measuring = (varying.length ? varying : numbers).filter((c) => !META.test(c.key));
  const primary = measuring.filter((c) => !COMPARISON.test(c.key) && !DERIVED.test(c.key));
  let measures = roles.measures.length ? roles.measures : (primary.length ? primary : measuring).slice(0, 1).map((c) => c.key);
  // A number drawn next to its own comparison (this year, last year) is one number with a comparison.
  const paired = measures.length === 2 && !roles.compare && companion(shape, measures[0]!) === measures[1] ? measures[1] : undefined;
  if (paired) measures = measures.slice(0, 1);
  const compare = roles.compare ?? paired ?? (measures.length === 1 && measures[0] ? companion(shape, measures[0]) : undefined);
  return { ...roles, measures, compare: compare && !measures.includes(compare) ? compare : undefined };
}

/** The columns that say what a row is: text, hotels, dates. Free text and columns with one value for every row are left out. */
function dimensions(shape: Shape): EvidenceColumn[] {
  return shape.columns.filter((c) => {
    if (c.hidden || c.kind === 'id' || isNumericKind(c.kind)) return false;
    const values = shape.rows.map((row) => row[c.key]).filter(present);
    if (!values.length || !values.every((value) => typeof value === 'string')) return false;
    if (values.some((value) => (value as string).length > PROSE)) return false;
    return shape.n === 1 || shape.distinct(c.key) > 1;
  });
}

const hasProse = (shape: Shape) =>
  shape.columns.some((c) => !c.hidden && shape.rows.some((row) => typeof row[c.key] === 'string' && (row[c.key] as string).length > PROSE));

/**
 * The spec a first look at the rows suggests, with no model: which columns name the rows, which number to draw and
 * as what. Null when nothing fits. `hint` carries what is already known (Kassandra's spec, a tool's usual columns);
 * its kind wins whenever the rows allow it.
 */
export function recommendSpec(rows: Rows | null | undefined, columns?: Columns | null, hint: KindHint = {}): Omit<WidgetSpec, 'title' | 'sourceCallId'> | null {
  if (!rows?.length || rows.length > WIDGET_MAX_ROWS) return null;
  const shape = shapeOf(rows, columns);
  const stub: WidgetSpec = { kind: 'table', title: 'Preview', sourceCallId: 'preview' };
  const strip = (spec: WidgetSpec) => {
    const { title: _title, sourceCallId: _source, ...rest } = spec;
    return rest;
  };
  const attempt = (kind: WidgetKind, roles: Roles, stageLike = false) => {
    const proposal = propose(kind, roles, shape, stageLike || kind === hint.kind);
    const spec = proposal ? fitted(kind, stub, proposal, shape) : null;
    return spec ? strip(spec) : null;
  };

  // What the hint says outright, checked as it is: Kassandra's choice of kind and columns.
  if (hint.kind && (hint.x || hint.group || hint.y?.length)) {
    const asGiven = fitWidget({ ...stub, kind: hint.kind, ...(hint.x ? { x: hint.x } : {}), ...(hint.y?.length ? { y: [...hint.y] } : {}), ...(hint.group ? { group: hint.group } : {}), ...(hint.compare ? { compare: hint.compare } : {}) }, { rows: rows as Record<string, unknown>[], columns: shape.columns });
    if (asGiven.ok) return strip(asGiven.value as WidgetSpec);
  }

  const hinted = rolesOf(hint, shape);
  const dims = dimensions(shape);
  const first = (roles: Roles, kinds: readonly (WidgetKind | undefined)[], stageLike = false) => {
    for (const kind of kinds) {
      const spec = kind ? attempt(kind, roles, stageLike) : null;
      if (spec) return spec;
    }
    return null;
  };
  const table = () => (first({ measures: [] }, ['table']) ?? null);

  // One row is a figure: a number, or a few side by side.
  if (shape.n === 1) {
    const roles = fillRoles({ ...hinted, label: hinted.label ?? dims[0]?.key }, shape);
    const figures = hinted.measures.length
      ? hinted.measures
      : shape.columns.filter((c) => !c.hidden && isNumericKind(c.kind) && shape.numeric(c.key) && !META.test(c.key) && !COMPARISON.test(c.key) && !DERIVED.test(c.key)).map((c) => c.key);
    if (figures.length >= 2) return first({ ...roles, measures: figures.slice(0, 4), compare: undefined }, [hint.kind, 'kpi_row']) ?? table();
    return first(roles, [hint.kind, 'kpi']) ?? table();
  }

  // Rows that are text to read (reviews, findings) stay a table.
  if (hasProse(shape) && !hint.kind) return table();

  // The column that names each row: the hint's, else the first one with a value of its own on every row.
  const single = hinted.label && !hinted.split ? hinted.label : dims.find((c) => shape.distinct(c.key) === shape.n)?.key;
  if (single && !hinted.split) {
    const roles = fillRoles({ ...hinted, label: single, split: undefined }, shape);
    if (shape.time(single)) return first(roles, [hint.kind, 'line']) ?? table();
    const stageLike = STAGE.test(`${single} ${shape.col(single)?.label ?? ''}`);
    // A share column next to the number says the rows are the parts of one whole.
    const whole = shape.columns.some((c) => c.kind === 'percent' && shape.numeric(c.key) && sharesOfAWhole(shape, c.key));
    return first(roles, [hint.kind, stageLike ? 'funnel' : undefined, whole ? 'donut' : undefined, 'bar'], stageLike) ?? table();
  }

  // Two columns that together name each row: a trend per series, or a grid.
  const pair = hinted.label && hinted.split ? ([hinted.label, hinted.split] as const) : pairOf(dims, shape);
  if (pair) {
    const [a, b] = pair;
    const across = shape.time(b) && !shape.time(a) ? b : a;
    const down = across === a ? b : a;
    const roles = fillRoles({ ...hinted, label: across, split: down }, shape);
    const series = shape.distinct(down);
    if (shape.time(across)) return first(roles, [hint.kind, series <= 6 ? 'line' : undefined, 'sparkline_list', 'heatmap']) ?? table();
    return first(roles, [hint.kind, 'stacked_bar', series <= 4 ? 'grouped_bar' : undefined, 'heatmap']) ?? table();
  }

  // No column names the rows: two numbers per row is a cloud of points.
  if (!dims.length) {
    const roles = fillRoles(hinted, shape);
    const numbers = shape.columns.filter((c) => !c.hidden && isNumericKind(c.kind) && shape.numeric(c.key) && !META.test(c.key)).map((c) => c.key);
    if (numbers.length >= 2) return first({ ...roles, label: undefined, measures: roles.measures.length >= 2 ? roles.measures : numbers.slice(0, 2) }, [hint.kind, 'scatter']) ?? table();
  }
  return (hint.kind ? first(fillRoles(hinted, shape), [hint.kind]) : null) ?? table();
}

function pairOf(dims: EvidenceColumn[], shape: Shape): readonly [string, string] | null {
  for (let i = 0; i < dims.length; i++) {
    for (let j = i + 1; j < dims.length; j++) {
      const a = dims[i]!.key;
      const b = dims[j]!.key;
      if (shape.distinct(a, b) === shape.n && shape.distinct(a) > 1 && shape.distinct(b) > 1) return [a, b];
    }
  }
  return null;
}

/**
 * The kind to start with for these rows: deterministic, no model. A table when nothing else reads better. With a
 * hint (Kassandra's spec, a board's saved spec) its kind is the recommendation whenever the rows allow it.
 */
export function recommendKind(rows: Rows | null | undefined, columns?: Columns | null, hint?: KindHint): WidgetKind {
  return recommendSpec(rows, columns, hint)?.kind ?? 'table';
}
