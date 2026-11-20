import type { Evidence, WidgetSpec } from '@compass/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HotelData } from '../src/application/hotel-data.ts';
import { columnsFor } from '../src/application/widgets/columns.ts';
import { fitWidget } from '../src/application/widgets/fit.ts';
import { openPostgres, type PostgresDb } from '../src/infrastructure/postgres.ts';
import { DATA_TOOLS, type DataTool } from '../src/presentation/tools/catalog.ts';

// The recipes the prompt gives Kassandra (presentation/agents/widgets.ts, "Pick the kind by what the rows say"): each
// names a tool call and the columns of a widget. Here every recipe runs for real against the local Halcyon database
// and its widget passes show_widget's checks, so a renamed column or a changed shape fails here and not in a demo.
process.loadEnvFile(new URL('../.env.local', import.meta.url).pathname);

let db: PostgresDb;
let data: HotelData;
beforeAll(() => {
  db = openPostgres(process.env['DATABASE_URL']!);
  data = new HotelData(db);
});
afterAll(() => db.close());

const october = { from: '2026-10-01', to: '2026-10-31' };
const december = { from: '2026-12-01', to: '2026-12-31' };
type Fields = Pick<WidgetSpec, 'kind' | 'x' | 'y' | 'group' | 'compare'>;

const RECIPES: { name: string; tool: string; args: Record<string, unknown>; widget: Fields; rows?: number }[] = [
  { name: 'headline KPIs of a region', tool: 'get_kpis', args: { by: 'region', region: 'Asia', ...october }, widget: { kind: 'kpi_row', y: ['occupancy_pct', 'adr_eur', 'revpar_eur', 'room_revenue_eur'] }, rows: 1 },
  { name: 'a metric over time against last year', tool: 'get_metric', args: { metric: 'occupancy', by: 'group', grain: 'day', compare: 'stly', ...october }, widget: { kind: 'line', x: 'period', y: ['value'], compare: 'compare_value' }, rows: 31 },
  { name: 'pace for a month, night by night', tool: 'get_pace', args: { hotels: ['LIS'], grain: 'day', ...december }, widget: { kind: 'area', x: 'stay_date', y: ['rooms_otb'], compare: 'rooms_otb_stly' }, rows: 31 },
  { name: 'a ranking of hotels against last year', tool: 'get_pace', args: { daysAhead: 45 }, widget: { kind: 'bar', x: 'hotel_code', y: ['rooms_otb'], compare: 'rooms_otb_stly' }, rows: 20 },
  { name: 'the channel mix of one hotel', tool: 'get_channel_mix', args: { hotels: ['BCN'], ...october }, widget: { kind: 'donut', group: 'channel', y: ['net_revenue_eur'] } },
  { name: 'the channel mix of the group', tool: 'get_channel_mix', args: { shape: 'total', ...october }, widget: { kind: 'donut', group: 'channel', y: ['net_revenue_eur'] } },
  { name: 'the segment mix of the group', tool: 'get_mix', args: { by: 'channel_type', grain: 'total', rollUp: true, ...october }, widget: { kind: 'pie', group: 'key', y: ['room_nights'] } },
  { name: 'a mix over time', tool: 'get_mix', args: { hotels: ['NYC'], by: 'segment', grain: 'month', from: '2026-06-01', to: '2026-10-31' }, widget: { kind: 'stacked_bar', x: 'period', y: ['share_pct'], group: 'key' } },
  { name: 'room revenue by hotel inside its region', tool: 'get_kpis', args: { by: 'hotel', ...october }, widget: { kind: 'treemap', x: 'key', group: 'region', y: ['room_revenue_eur'] }, rows: 20 },
  { name: 'the GOP bridge from budget', tool: 'get_pnl', args: { by: 'group', view: 'bridge', ...october }, widget: { kind: 'waterfall', x: 'step', y: ['amount_eur'] } },
  { name: 'the booking funnel by device', tool: 'get_web_funnel', args: { hotels: ['AMS'], by: 'device', grain: 'total', ...october }, widget: { kind: 'funnel', x: 'key', y: ['sessions', 'searches', 'checkout_starts', 'bookings'] } },
  { name: 'GOP against budget per hotel', tool: 'get_pnl', args: { hotels: ['LIS', 'BCN', 'PAR', 'AMS'], grain: 'total', ...october }, widget: { kind: 'bullet', x: 'key', y: ['gop_eur'], compare: 'gop_budget_eur' }, rows: 4 },
  { name: 'average rate against the comp set', tool: 'get_rate_position', args: { hotels: ['DXB1', 'DXB2'], from: '2026-11-21', to: '2026-12-20', grain: 'total' }, widget: { kind: 'bullet', x: 'hotel_code', y: ['bar_rate'], compare: 'comp_median' }, rows: 2 },
  { name: 'the 20 hotels over 14 nights', tool: 'get_metric', args: { metric: 'occupancy', by: 'hotel', grain: 'day', from: '2026-11-20', to: '2026-12-03' }, widget: { kind: 'heatmap', x: 'period', group: 'key', y: ['value'] }, rows: 280 },
  { name: 'the nights of one hotel', tool: 'get_metric', args: { metric: 'occupancy', hotels: ['DXB2'], grain: 'day', from: '2026-11-20', to: '2027-01-31' }, widget: { kind: 'calendar_heatmap', x: 'period', y: ['value'] } },
  { name: 'ARI against MPI per hotel', tool: 'get_kpis', args: { by: 'hotel', ...october }, widget: { kind: 'scatter', x: 'ari', y: ['mpi'], group: 'key' }, rows: 20 },
  { name: 'rate against demand per night', tool: 'get_rate_position', args: { hotels: ['DXB1', 'DXB2'], from: '2026-11-21', to: '2026-12-20' }, widget: { kind: 'scatter', x: 'occupancy_otb_pct', y: ['bar_vs_comp'], group: 'hotel_code' }, rows: 60 },
  { name: 'channel revenue to net and commission', tool: 'get_channel_mix', args: { shape: 'flows', ...october }, widget: { kind: 'sankey', x: 'channel', group: 'lands_in', y: ['amount_eur'] } },
];

describe('the recipes of the widget rules draw from the real tools', () => {
  for (const recipe of RECIPES) {
    it(`${recipe.widget.kind}: ${recipe.name} (${recipe.tool})`, async () => {
      const tool = (DATA_TOOLS as readonly DataTool[]).find((candidate) => candidate.name === recipe.tool)!;
      const outcome = await tool.run(data, tool.input.parse(recipe.args) as never);
      if (!outcome.ok) throw new Error(outcome.text);
      const { rows, evidence } = outcome.structured as { rows: Record<string, unknown>[]; evidence: Evidence };
      if (recipe.rows) expect(rows).toHaveLength(recipe.rows);

      const fitted = fitWidget({ ...recipe.widget, title: 'A conclusion with its number', sourceCallId: 'call-1' }, { rows, columns: columnsFor(rows, evidence) });
      expect(fitted.ok ? '' : fitted.error).toBe('');
      // The widget keeps every column the recipe names: none is dropped as unused for the kind.
      if (fitted.ok) expect(fitted.value).toMatchObject(recipe.widget);
    });
  }

  it('covers every kind the prompt promises a recipe for', () => {
    const kinds = new Set(RECIPES.map((recipe) => recipe.widget.kind));
    for (const kind of ['kpi_row', 'line', 'area', 'bar', 'donut', 'pie', 'stacked_bar', 'treemap', 'waterfall', 'funnel', 'bullet', 'heatmap', 'calendar_heatmap', 'scatter', 'sankey']) {
      expect(kinds.has(kind as never), kind).toBe(true);
    }
  });
});
