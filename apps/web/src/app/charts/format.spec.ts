import { esc, formatDate, formatDelta, formatNumber, formatValue, humanize, lowerIsBetter, num, parseDate } from './format';

describe('formatValue by column kind', () => {
  it('formats currency in EUR by default, with cents only for small amounts', () => {
    expect(formatValue(1240, { kind: 'currency' })).toBe('€1,240');
    expect(formatValue(142.5, { kind: 'currency', unit: 'EUR' })).toBe('€143');
    expect(formatValue(97.6, { kind: 'currency' })).toBe('€97.60');
    expect(formatValue(1_340_000, { kind: 'currency' })).toBe('€1,340,000');
  });

  it('compacts money to three significant figures and uses a real minus sign', () => {
    expect(formatValue(1_340_000, { kind: 'currency' }, { compact: true })).toBe('€1.34M');
    expect(formatValue(18_420_000, { kind: 'currency' }, { compact: true })).toBe('€18.4M');
    expect(formatValue(-164_000, { kind: 'currency' }, { compact: true })).toBe('−€164k');
    expect(formatValue(43_250, { kind: 'currency' }, { compact: true })).toBe('€43.3k');
    expect(formatValue(97.6, { kind: 'currency' }, { compact: true })).toBe('€98');
    expect(formatValue(2_500_000_000, { kind: 'currency' }, { compact: true })).toBe('€2.5B');
  });

  it('uses the currency the column names', () => {
    expect(formatValue(980, { kind: 'currency', unit: 'AED' })).toBe('AED 980');
    expect(formatValue(1200, { kind: 'currency', unit: 'USD' })).toBe('$1,200');
  });

  it('never writes a unit that is not a currency next to an amount: “local currency 1.2k” reads 1.2k', () => {
    const local = { kind: 'currency' as const, unit: 'local currency' };
    expect(formatValue(1240, local, { axis: true })).toBe('1.2k');
    expect(formatValue(800, local, { axis: true })).toBe('800');
    expect(formatValue(530, local)).toBe('530');
    expect(formatValue(446.2, local)).toBe('446');
    expect(formatValue(43_250, local, { compact: true })).toBe('43.3k');
    expect(formatValue(1240, { kind: 'currency', unit: 'aed' }, { axis: true })).toBe('AED 1.2k');
    expect(formatValue(1240, { kind: 'currency', unit: 'QAR' })).toBe('QAR 1,240');
  });

  it('reads percent columns as 0–100, like the backend sends them, and ratios when the unit says so', () => {
    expect(formatValue(78.44, { kind: 'percent' })).toBe('78.4%');
    expect(formatValue(80, { kind: 'percent' })).toBe('80.0%');
    expect(formatValue(80, { kind: 'percent' }, { axis: true })).toBe('80%');
    expect(formatValue(0.716, { kind: 'percent', unit: 'ratio' })).toBe('71.6%');
    expect(formatValue(-15.9, { kind: 'percent' })).toBe('−15.9%');
  });

  it('formats counts as whole numbers with separators, with their unit unless told not to', () => {
    expect(formatValue(8386, { kind: 'count' })).toBe('8,386');
    expect(formatValue(8386.4, { kind: 'count', unit: 'rooms' })).toBe('8,386 rooms');
    expect(formatValue(8386, { kind: 'count', unit: 'rooms' }, { unit: false })).toBe('8,386');
    expect(formatValue(48_200, { kind: 'count' }, { compact: true })).toBe('48.2k');
    expect(formatValue(9410, { kind: 'count' }, { compact: true })).toBe('9,410');
  });

  it('compacts axis ticks from 1,000 up and drops their trailing zeros', () => {
    expect(formatNumber(9000, { kind: 'count' }, { axis: true })).toBe('9k');
    expect(formatNumber(1_500_000, { kind: 'currency' }, { axis: true })).toBe('€1.5M');
    expect(formatNumber(100, { kind: 'number', unit: 'index' }, { axis: true })).toBe('100');
  });

  it('formats plain numbers with as many decimals as their size needs', () => {
    expect(formatValue(104, { kind: 'number' })).toBe('104');
    expect(formatValue(2.44, { kind: 'number', unit: 'pts' })).toBe('2.44 pts');
    expect(formatValue(12.34, { kind: 'number' })).toBe('12.3');
  });

  it('formats dates and months in UTC, whatever the time zone', () => {
    expect(formatValue('2026-12-16', { kind: 'date' })).toBe('Wed 16 Dec 2026');
    expect(formatValue('2026-12-16', { kind: 'date' }, { axis: true })).toBe('16 Dec');
    expect(formatValue('2026-09-01', { kind: 'date' }, { axis: true })).toBe('1 Sep');
    expect(formatValue('2026-12', { kind: 'month' })).toBe('Dec 2026');
    expect(formatValue('2026-12-01', { kind: 'month' }, { axis: true })).toBe('Dec');
    expect(formatDate('2026-12-16T23:30:00Z', 'date')).toBe('16 Dec');
  });

  it('shows a dash for missing values and passes text through', () => {
    expect(formatValue(null, { kind: 'currency' })).toBe('–');
    expect(formatValue(undefined, { kind: 'date' })).toBe('–');
    expect(formatValue('', { kind: 'text' })).toBe('–');
    expect(formatValue('Arbor Lisbon Chiado', { kind: 'hotel' })).toBe('Arbor Lisbon Chiado');
    expect(formatValue('not a date', { kind: 'date' })).toBe('not a date');
  });
});

describe('num and parseDate', () => {
  it('reads numbers and numeric strings, nothing else', () => {
    expect(num(12.5)).toBe(12.5);
    expect(num('1284.50')).toBe(1284.5);
    expect(num('-3')).toBe(-3);
    expect(num('12 rooms')).toBeNull();
    expect(num('')).toBeNull();
    expect(num(null)).toBeNull();
    expect(num(Number.NaN)).toBeNull();
  });

  it('parses days and months as UTC', () => {
    expect(parseDate('2026-12-16')).toBe(Date.UTC(2026, 11, 16));
    expect(parseDate('2026-12')).toBe(Date.UTC(2026, 11, 1));
    expect(parseDate('Dec 16')).toBeNull();
  });
});

describe('formatDelta', () => {
  it('gives a percentage change with an arrow, never colour alone', () => {
    const d = formatDelta(148, 136.7, 'currency');
    expect(d?.text).toBe('▲ 8.3%');
    expect(d?.spoken).toBe('up 8.3%');
    expect(d?.dir).toBe('up');
    expect(d?.tone).toBe('good');
  });

  it('compares percent columns in points', () => {
    expect(formatDelta(71.6, 80, 'percent')?.text).toBe('▼ 8.4 pts');
    expect(formatDelta(0.716, 0.8, 'percent', 'ratio')?.text).toBe('▼ 8.4 pts');
  });

  it('reads a fall as good news for costs and cancellations', () => {
    expect(lowerIsBetter({ key: 'cancellations' })).toBe(true);
    expect(lowerIsBetter({ key: 'revpar' })).toBe(false);
    expect(formatDelta(100, 102, 'count', undefined, true)?.tone).toBe('good');
    expect(formatDelta(100, 102, 'count')?.tone).toBe('bad');
  });

  it('says when nothing changed and gives nothing when it cannot compare', () => {
    expect(formatDelta(100, 100, 'count')).toMatchObject({ dir: 'flat', tone: 'flat', text: '• 0.0%' });
    expect(formatDelta(100, 0, 'count')).toBeNull();
    expect(formatDelta(null, 5, 'count')).toBeNull();
  });
});

describe('esc and humanize', () => {
  it('escapes HTML, so a row can never inject markup into a tooltip', () => {
    expect(esc('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(esc("Tessera London King's Cross & Co")).toBe('Tessera London King&#39;s Cross &amp; Co');
  });

  it('turns a column key into a label when the backend sent none', () => {
    expect(humanize('rooms_otb_ly')).toBe('Rooms otb ly');
  });
});
