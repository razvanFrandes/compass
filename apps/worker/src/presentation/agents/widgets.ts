import { EvidenceColumn, WidgetSpec, type ChatEntry, type Evidence, type Widget } from '@compass/contracts';
import type { Context } from '@earendil-works/chord/context';
import type { Extension, PromptSection, ToolExecutionApi, ToolRegistration } from '@earendil-works/pi-durable';
import { z } from 'zod';
import { inferColumns } from '../../application/widgets/columns.ts';
import { fitWidget } from '../../application/widgets/fit.ts';

/**
 * Widgets in answers (docs/round2-contracts.md §3): Kassandra's `show_widget` tool.
 *
 * The model names a data tool result of the conversation and its column keys. The tool reads that result back from
 * the durable transcript, checks the keys and the kind against its rows (application/widgets/fit.ts) and copies the
 * rows, columns and evidence into its own result as `details.widget`. The model never supplies a number, and it only
 * reads a one-line receipt.
 *
 * `withWidgets` turns the data extension into the one Kassandra uses: every data result ends with its "Result id"
 * (the tool call id, which a model cannot be trusted to see otherwise), and show_widget and its prompt sections are added.
 */

export const SHOW_WIDGET = 'show_widget';
/** A hard stop above what the prompt asks for (3 in an answer, 2–4 in a board view): each widget copies up to 200 rows. */
export const MAX_WIDGETS_PER_ANSWER = 4;

type Row = Record<string, unknown>;

const shape = WidgetSpec.shape;
const ShowWidgetArgs = z.object({
  kind: shape.kind.describe('The kind of widget. Prefer the simplest that fits.'),
  title: shape.title.describe('The conclusion the widget shows, with its number, e.g. "Lisbon is 15.9% behind last year for December"'),
  subtitle: shape.subtitle.describe('The scope: hotels and period, e.g. "All hotels, next 45 nights"'),
  sourceCallId: shape.sourceCallId.describe('The "Result id" printed at the end of the data tool result whose rows the widget draws'),
  x: shape.x.describe('Column name: the axis, the category or the source, by kind'),
  y: shape.y.describe('Column names: the numbers to draw, the stages in order, or the columns of a table'),
  group: shape.group.describe('Column name: splits the rows into series, names the parts, or is the target of a flow'),
  compare: shape.compare.describe('Column name: the comparison, e.g. last year or budget'),
  format: shape.format.describe('How to format y. Leave it out: it is read from the column.'),
});

const DESCRIPTION = [
  'Show a chart, a table or a KPI tile under your answer, drawn from the rows of a data tool result of this conversation. ' +
    'You choose the kind, the title and the columns; the rows are copied from that result, so you never type a number into a widget. ' +
    'Call it after the data tool, with the "Result id" printed at the end of that result. x, y, group and compare are column names of that result.',
  'Kinds and what they need:',
  '- kpi: one number. 1 row; y: the number; compare: last year or budget (optional).',
  '- kpi_row: 2–6 tiles. 1 row with y: 2–6 number columns; or 2–6 rows with x: the tile name and y: one number.',
  '- bar: rank or compare categories. x: the category (e.g. the hotel), y: one number, compare (optional). One row per category.',
  '- grouped_bar, stacked_bar: x, and y: 2–8 number columns; or y: one number with group: the column that splits it.',
  '- line, area: a trend. x: a date, month or number column; y: 1–6 number columns, or one number with group (a line per hotel); compare (optional, with one y).',
  '- sparkline_list: a small trend per group value. x: ordered, y: one number, group.',
  '- pie, donut: only for 2–7 parts of one whole. group: the part name, y: one number that adds up to the whole.',
  '- treemap: 2–60 parts. group: the part name, y: one number.',
  '- table: the exact rows. y: the columns to show (optional).',
  '- heatmap: x across, group down, y: the number in each cell. calendar_heatmap: x: a day column, y: one number, one row per day.',
  '- funnel: stages that only shrink. y: 2–8 stage columns in order (x names each funnel when there are 2–4 rows); or x: the stage name and y: one number, one row per stage.',
  '- waterfall: x: the step name, y: the change of each step.',
  '- bullet: actual against target. y: the actual, compare: the target, x: the name when there are several rows.',
  '- gauge: 1 row. y: a percent; or y with compare: the target.',
  '- scatter: x and y: number columns; group: the name of each point (optional).',
  '- radar: y: 3–8 number columns on one scale; one row per shape, named by x.',
  '- sankey: x: the source, group: the target, y: the size of each flow.',
  'If the result has the wrong shape for the kind (too many rows, a row per hotel where one row is needed), call the data tool again narrower.',
].join('\n');

export const WIDGET_SECTIONS: PromptSection[] = [
  {
    key: 'widgets',
    render: () =>
      [
        '- When a chart, a table or a KPI tile makes the answer clearer (a trend, a ranking, a comparison, a mix, a funnel), call ' +
          'show_widget after the data tool. Pass the "Result id" printed at the end of that tool result as sourceCallId and its ' +
          'column names as x, y, group and compare. The widget draws the rows of that result: you never type a number into it.',
        '- The title is a conclusion with its number ("Lisbon is 15.9% behind last year for December"), never a label ("Pace by hotel"). ' +
          'The subtitle names the hotels and the period.',
        '- Prefer the simplest kind that fits: kpi for one number, bar to rank or compare, line for a trend over time, table when the ' +
          'reader needs the exact rows. Use pie or donut only for 2–7 parts of one whole. Use the other kinds only for the case their description names.',
        '- If a result has the wrong shape for the kind, call the data tool again narrower (fewer hotels, grain total, a roll-up) ' +
          'instead of forcing the kind. If show_widget fails twice, answer without the widget.',
        '- At most 3 widgets per answer, and none when the answer is one number or a yes or no.',
        '- A widget does not replace the answer: still write it, but do not repeat the rows of a widget as a list or a table.',
      ].join('\n'),
  },
  {
    key: 'board_view',
    render: () =>
      [
        'A message that starts with "Build a board view:" is not a question: the user is composing a board (a saved dashboard) ' +
          'and the text after the colon describes what it should show.',
        '- Get the data the description needs, one data tool call per widget (in the same turn when you can), then call show_widget ' +
          '2 to 4 times so that the widgets together cover the description: the headline number or the ranking first, then the trend, then the breakdown.',
        '- Each title says what the widget shows now, with its number. Each subtitle names the hotels and the period.',
        '- Then reply with one short sentence that names what the view shows. No analysis, no drivers, no next move.',
        '- If the data cannot show what was asked, say so in one sentence and show the widgets that are possible.',
      ].join('\n'),
  },
];

/** The rows and evidence of a data tool result, when it has rows a widget could draw. */
function chartable(details: unknown): { rows: Row[]; evidence: Evidence } | null {
  const { rows, evidence } = (details ?? {}) as { rows?: unknown; evidence?: unknown };
  if (!Array.isArray(rows) || rows.length === 0 || !evidence || typeof evidence !== 'object') return null;
  if (!rows.every((row) => row !== null && typeof row === 'object' && !Array.isArray(row))) return null;
  return { rows: rows as Row[], evidence: evidence as Evidence };
}

/** A data tool whose result ends with its id, so the model can name it in show_widget. */
function withResultId(tool: ToolRegistration): ToolRegistration {
  return {
    ...tool,
    async execute(args, api, context) {
      const result = await tool.execute(args, api, context);
      if (!('output' in result) || !result.output || !chartable(result.details)) return result;
      const note = `\nResult id: ${api.callId} (pass it to ${SHOW_WIDGET} as sourceCallId to chart or tabulate these rows).`;
      return { ...result, output: [...result.output, { type: 'text', text: note }] };
    },
  } as ToolRegistration;
}

interface ToolResultMessage {
  role?: string;
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
  details?: unknown;
}

interface TranscriptScan {
  /** The result `sourceCallId` names, when it is in the conversation. */
  source: ToolResultMessage | null;
  /** Widgets already shown since the last question. */
  shown: number;
  /** The newest results a widget could draw, for the message when the id is unknown. */
  candidates: string[];
}

/** Reads the conversation's transcript, newest first: the named result, and how many widgets this answer has. */
async function scanTranscript(api: ToolExecutionApi, context: Context, sourceCallId: string): Promise<TranscriptScan> {
  return api.commit(async (tx) => {
    const scan: TranscriptScan = { source: null, shown: 0, candidates: [] };
    let inThisAnswer = true;
    let cursor: Parameters<typeof tx.scanEntries>[2];
    // 500 entries back is far more than a conversation's tool results; a widget of an older result is not worth a longer read.
    for (let page = 0; page < 5; page++) {
      const { items, next } = await tx.scanEntries({ conversationId: api.conversationId, order: 'descending' }, 100, cursor);
      for (const entry of items) {
        const message = (entry.model?.[0] ?? {}) as ToolResultMessage;
        if (message.role === 'user') inThisAnswer = false;
        if (entry.kind !== 'pi.tool-result' || message.isError) continue;
        if (message.toolName === SHOW_WIDGET) {
          if (inThisAnswer && (message.details as { widget?: unknown } | undefined)?.widget) scan.shown++;
          continue;
        }
        const data = chartable(message.details);
        if (!data) continue;
        if (message.toolCallId === sourceCallId) scan.source = message;
        if (scan.candidates.length < 6) scan.candidates.push(`${message.toolCallId} (${message.toolName}, ${data.rows.length} rows)`);
      }
      if (!next || (scan.source && !inThisAnswer)) break;
      cursor = next;
    }
    return scan;
  }, context);
}

function createShowWidgetTool(): ToolRegistration {
  const { $schema: _ignored, ...parameters } = z.toJSONSchema(ShowWidgetArgs, { io: 'input' }) as Record<string, unknown>;
  return {
    name: SHOW_WIDGET,
    description: DESCRIPTION,
    parameters,
    // It only reads the transcript, so it may run again after an eviction.
    replay: 'safe',
    async execute(args: unknown, api: ToolExecutionApi, context: Context) {
      const parsed = ShowWidgetArgs.safeParse(args ?? {});
      if (!parsed.success) throw new Error(`Invalid arguments: ${z.prettifyError(parsed.error)}`);
      const spec = parsed.data;

      const scan = await scanTranscript(api, context, spec.sourceCallId);
      if (scan.shown >= MAX_WIDGETS_PER_ANSWER) {
        throw new Error(`An answer shows at most ${MAX_WIDGETS_PER_ANSWER} widgets, and this one has ${scan.shown}. Write the answer now.`);
      }
      const data = chartable(scan.source?.details);
      if (!data) {
        const usable = scan.candidates.length ? `Results you can use: ${scan.candidates.join('; ')}.` : 'Call a data tool first.';
        throw new Error(`No data tool result with rows has the id "${spec.sourceCallId}". Pass the "Result id" printed at the end of a data tool result. ${usable}`);
      }

      const named = z.array(EvidenceColumn).min(1).safeParse((data.evidence as { columns?: unknown }).columns);
      const columns = named.success ? named.data : inferColumns(data.rows);
      const fitted = fitWidget(spec, { rows: data.rows, columns });
      if (!fitted.ok) throw new Error(fitted.error);

      const widget: Widget = { ...fitted.value, rows: data.rows, columns, evidence: data.evidence };
      return {
        output: [{ type: 'text', text: `Shown to the user: ${widget.kind} "${widget.title}" (${widget.rows.length} rows). Do not repeat its rows in your answer.` }],
        details: { widget },
      };
    },
  } as unknown as ToolRegistration;
}

/** The data extension with result ids on its results, plus show_widget and the prompt sections that say when to use it. */
export function withWidgets(data: Extension): Extension {
  return {
    ...data,
    tools: [...(data.tools ?? []).map((tool) => withResultId(tool as ToolRegistration)), createShowWidgetTool()],
    sections: [...(data.sections ?? []), ...WIDGET_SECTIONS],
  };
}

/** The widgets of the newest answer: those shown since the last question. */
export function widgetsOfLastAnswer(entries: readonly ChatEntry[]): Widget[] {
  const lastQuestion = entries.findLastIndex((entry) => entry.kind === 'user');
  return entries.slice(lastQuestion + 1).flatMap((entry) => (entry.kind === 'tool_result' && entry.widget ? [entry.widget] : []));
}
