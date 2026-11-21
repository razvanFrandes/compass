import { isPreviewTool, previewWidget, widgetFromArgs } from './preview';
import { evidence, paceEvidence, paceRows, step } from './testing';

const pace = (patch = {}) => step({ callId: 'c1', name: 'get_pace', args: { hotels: ['LIS', 'AMS', 'PAR'] }, rows: paceRows, evidence: paceEvidence(), ...patch });

describe('previewWidget: a chart from a data result, with no model', () => {
  it('draws the rows as the kind a first look suggests, titled by the tool and scoped by the call', () => {
    const widget = previewWidget(pace())!;
    expect(widget).toMatchObject({ kind: 'bar', x: 'hotel_code', y: ['rooms_otb'], compare: 'rooms_otb_stly', title: 'Pace vs last year', subtitle: 'Lisbon Chiado, Amsterdam Centraal, Paris Opera · 21 Nov – 20 Dec', sourceCallId: 'c1' });
    expect(widget.rows).toBe(paceRows);
    expect(widget.columns.map((column) => column.key)).toEqual(['hotel_code', 'rooms_otb', 'rooms_otb_stly', 'pace_pct']);
    expect(widget.evidence.title).toBe('Pace vs last year');
  });

  it('is the same widget for the same result, however often the turn is mapped', () => {
    const rows = [...paceRows];
    expect(previewWidget(pace({ rows }))).toBe(previewWidget(pace({ rows, callId: 'c1' })));
  });

  it('counts many hotels instead of listing them, and leaves the scope out when the call names none', () => {
    const many = pace({ rows: [...paceRows], args: { hotels: ['LIS', 'AMS', 'PAR', 'BER', 'VIE'] } });
    expect(previewWidget(many)?.subtitle).toBe('5 hotels · 21 Nov – 20 Dec');
    const none = pace({ rows: [...paceRows], args: {}, evidence: paceEvidence({ period: null }) });
    expect(previewWidget(none)).not.toHaveProperty('subtitle');
  });

  it('uses a tool’s usual number where it is not the first column', () => {
    const rows = [
      { stay_date: '2026-12-01', bar_rate: 180, comp_median: 172, bar_vs_comp: 1.05, comps_sold_out: 0 },
      { stay_date: '2026-12-02', bar_rate: 176, comp_median: 181, bar_vs_comp: 0.97, comps_sold_out: 1 },
      { stay_date: '2026-12-03', bar_rate: 190, comp_median: 185, bar_vs_comp: 1.03, comps_sold_out: 0 },
    ];
    const columns = [
      { key: 'stay_date', label: 'Stay date', kind: 'date' as const },
      { key: 'bar_rate', label: 'Our BAR', kind: 'currency' as const, unit: 'local currency' },
      { key: 'comp_median', label: 'Comp set median', kind: 'currency' as const, unit: 'local currency' },
      { key: 'bar_vs_comp', label: 'Our BAR vs comp set median', kind: 'number' as const },
      { key: 'comps_sold_out', label: 'Competitors sold out', kind: 'count' as const },
    ];
    const widget = previewWidget(step({ callId: 'c2', name: 'get_rate_position', args: { hotels: ['LIS'] }, rows, evidence: evidence({ title: 'Rate vs the comp set', columns }) }));
    expect(widget).toMatchObject({ kind: 'line', x: 'stay_date', y: ['bar_rate', 'comp_median'] });
  });

  it('draws one row as a number or as tiles', () => {
    const one = previewWidget(pace({ rows: paceRows.slice(0, 1) }));
    expect(one).toMatchObject({ kind: 'kpi_row', y: ['rooms_otb', 'pace_pct'] });
    const value = [{ period: '2026-12-01', key: 'LIS', value: 72.4, compare_value: 76.1 }];
    const columns = [
      { key: 'period', label: 'Period from', kind: 'date' as const },
      { key: 'key', label: 'Hotel', kind: 'hotel' as const },
      { key: 'value', label: 'Occupancy', kind: 'percent' as const },
      { key: 'compare_value', label: 'Occupancy, same time last year', kind: 'percent' as const },
    ];
    expect(previewWidget(step({ callId: 'c3', name: 'get_metric', args: { metric: 'occupancy' }, rows: value, evidence: evidence({ title: 'Occupancy vs last year', columns }) }))).toMatchObject({ kind: 'kpi', y: ['value'], compare: 'compare_value', title: 'Occupancy vs last year' });
  });

  it('has nothing to draw for lookups, rows that only read as a table, no rows, or too many', () => {
    const hotels = [{ hotel_code: 'LIS', name: 'Arbor Lisbon Chiado', rooms: 150 }, { hotel_code: 'AMS', name: 'Arbor Amsterdam Centraal', rooms: 210 }];
    for (const name of ['list_hotels', 'list_metrics', 'get_data_health', 'get_brief', 'find_reviews', 'search_reviews', 'mcp__compass__list_hotels']) {
      expect(isPreviewTool(name), name).toBe(false);
      expect(previewWidget(step({ name, rows: hotels, evidence: evidence() })), name).toBeNull();
    }
    expect(['get_pace', 'get_metric', 'run_readonly_query', 'mcp__compass__get_mix'].every(isPreviewTool)).toBe(true);
    expect(['show_widget', 'draft_workflow', 'send_email'].some(isPreviewTool)).toBe(false);

    expect(previewWidget(step({ name: 'run_readonly_query', rows: [{ note: 'Late rates.' }, { note: 'New comp set.' }], evidence: evidence() }))).toBeNull();
    expect(previewWidget(pace({ rows: [] }))).toBeNull();
    expect(previewWidget(pace({ rows: undefined }))).toBeNull();
    expect(previewWidget(pace({ rows: [...paceRows], evidence: undefined }))).toBeNull();
    expect(previewWidget(pace({ rows: Array.from({ length: 201 }, (_, i) => ({ hotel_code: `H${i}`, rooms_otb: i })) }))).toBeNull();
  });

  it('reads columns the evidence does not name from the rows themselves', () => {
    const rows = [{ hotel_code: 'LIS', revenue_eur: 120000 }, { hotel_code: 'AMS', revenue_eur: 98000 }];
    expect(previewWidget(step({ name: 'run_readonly_query', args: {}, rows, evidence: evidence() }))).toMatchObject({ kind: 'bar', x: 'hotel_code', y: ['revenue_eur'], title: 'Custom analysis' });
  });
});

describe('widgetFromArgs: Kassandra’s chart before the server confirms it', () => {
  const spec = { kind: 'bar' as const, title: 'Lisbon is 17.4% behind last year', sourceCallId: 'c1', x: 'hotel_code', y: ['pace_pct'] };

  it('is her spec over the source’s rows when the server’s check passes, normalised the way the server does', () => {
    const args = { ...spec };
    const widget = widgetFromArgs(spec, args, pace())!;
    expect(widget).toMatchObject({ kind: 'bar', title: spec.title, x: 'hotel_code', y: ['pace_pct'], format: 'percent', sourceCallId: 'c1' });
    expect(widget.rows).toBe(paceRows);
    expect(widgetFromArgs(spec, args, pace())).toBe(widget);
  });

  it('is null when the server would refuse it, or the source has no rows', () => {
    expect(widgetFromArgs({ ...spec, kind: 'line' }, {}, pace())).toBeNull();
    expect(widgetFromArgs({ ...spec, y: ['nope'] }, {}, pace())).toBeNull();
    expect(widgetFromArgs(spec, {}, pace({ rows: [] }))).toBeNull();
  });
});
