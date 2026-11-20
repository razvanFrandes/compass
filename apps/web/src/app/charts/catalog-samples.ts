import type { EvidenceColumn, WidgetRow, WidgetSpec } from './widget-types';

/*
  Sample rows for the /catalog gallery. They are shaped like what the Halcyon tools return (the same hotels,
  the same stories as the morning brief) but are written by hand for the showcase: nothing here is read
  from the database, and the gallery says so.
*/

export interface Specimen {
  id: string;
  spec: WidgetSpec;
  rows: WidgetRow[];
  columns: EvidenceColumn[];
  /** Takes the full row of the gallery grid. */
  wide?: boolean;
  /** What the specimen demonstrates beyond its kind. */
  shows?: string;
}
export interface SpecimenGroup {
  id: string;
  title: string;
  blurb: string;
  items: Specimen[];
}

const col = (key: string, label: string, kind: EvidenceColumn['kind'], unit?: string): EvidenceColumn => ({ key, label, kind, ...(unit ? { unit } : {}) });
const day = (start: string, offset: number) => new Date(Date.parse(`${start}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
/** A repeatable wobble in −1…1, so the samples never change between renders. */
const wobble = (i: number, seed: number) => Math.sin(i * 1.7 + seed * 2.3) * 0.6 + Math.sin(i * 0.61 + seed) * 0.4;
const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
const src = (id: string) => `sample_${id}`;

/* ───────── Figures ───────── */

const groupDaily: WidgetRow[] = Array.from({ length: 14 }, (_, i) => {
  const weekend = [5, 6].includes((i + 4) % 7) ? 1 : 0;
  const occ = 74 + i * 0.35 + weekend * 6 + wobble(i, 1) * 2.2;
  const adr = 182 + i * 0.5 + weekend * 14 + wobble(i, 2) * 4;
  const occLy = occ - 2.1 + wobble(i, 3) * 1.2;
  const adrLy = adr - 6.5 + wobble(i, 4) * 3;
  return {
    stay_date: day('2026-11-06', i),
    occupancy_pct: round(occ, 1),
    occupancy_pct_ly: round(occLy, 1),
    adr: round(adr, 2),
    adr_ly: round(adrLy, 2),
    revpar: round((occ / 100) * adr, 2),
    revpar_ly: round((occLy / 100) * adrLy, 2),
    cancellations: Math.round(118 - i * 1.8 + wobble(i, 5) * 9),
    cancellations_ly: Math.round(104 + wobble(i, 6) * 8),
  };
});
const dailyColumns = [
  col('stay_date', 'Stay date', 'date'),
  col('occupancy_pct', 'Occupancy', 'percent'),
  col('occupancy_pct_ly', 'Last year', 'percent'),
  col('adr', 'ADR', 'currency', 'EUR'),
  col('adr_ly', 'Last year', 'currency', 'EUR'),
  col('revpar', 'RevPAR', 'currency', 'EUR'),
  col('revpar_ly', 'Last year', 'currency', 'EUR'),
  col('cancellations', 'Cancellations', 'count'),
  col('cancellations_ly', 'Last year', 'count'),
];

const SPARK_HOTELS: [string, number, number][] = [
  ['Arbor New York Midtown', 268, -1.9],
  ['Kestrel London Mayfair', 244, 1.2],
  ['Kestrel Dubai Marina', 186, 2.4],
  ['Arbor Lisbon Chiado', 132, -1.4],
  ['Lumen Bali Uluwatu', 121, 0.6],
  ['Tessera Berlin Mitte', 96, 0.1],
];
const sparkRows: WidgetRow[] = SPARK_HOTELS.flatMap(([hotel, base, slope], h) => Array.from({ length: 14 }, (_, i) => ({ hotel, stay_date: day('2026-11-06', i), revpar: round(base + slope * i + wobble(i, h + 7) * base * 0.035, 2) })));

const bulletRows: WidgetRow[] = [
  { hotel: 'Kestrel London Mayfair', revenue: 1_184_000, budget: 1_120_000 },
  { hotel: 'Arbor Paris Opera', revenue: 1_062_000, budget: 1_090_000 },
  { hotel: 'Lumen Barcelona Mar', revenue: 986_000, budget: 1_101_000 },
  { hotel: "Tessera London King's Cross", revenue: 951_000, budget: 930_000 },
  { hotel: 'Arbor Amsterdam Centraal', revenue: 874_000, budget: 956_000 },
  { hotel: 'Kestrel Vienna Ring', revenue: 612_000, budget: 640_000 },
  { hotel: 'Tessera Berlin Mitte', revenue: 588_000, budget: 655_000 },
  { hotel: 'Arbor Lisbon Chiado', revenue: 517_000, budget: 602_000 },
];

/* ───────── Change over time ───────── */

const paceRows: WidgetRow[] = (() => {
  const nights = Array.from({ length: 31 }, (_, i) => {
    const weekend = [4, 5].includes((i + 1) % 7) ? 1 : 0;
    const festive = i >= 23 ? (i - 22) * 3.2 : 0;
    const ly = Math.round(96 + weekend * 14 + festive + wobble(i, 11) * 6);
    return { ly, shape: ly * (0.9 - (i < 20 ? 0.09 : 0.02) + wobble(i, 12) * 0.03) };
  });
  // The month as a whole sits 15.9% behind last year, as the title says; the gap narrows after Christmas.
  const scale = (0.841 * nights.reduce((s, n) => s + n.ly, 0)) / nights.reduce((s, n) => s + n.shape, 0);
  return nights.map((n, i) => ({ stay_date: day('2026-12-01', i), rooms_otb: Math.round(n.shape * scale), rooms_otb_ly: n.ly }));
})();

const pickupRows: WidgetRow[] = (() => {
  let total = 96;
  return Array.from({ length: 30 }, (_, i) => {
    total += i < 17 ? 2 + Math.max(0, wobble(i, 21)) * 2 : 5 + Math.max(0, wobble(i, 22)) * 5;
    return { booking_date: day('2026-10-22', i), rooms_otb: Math.min(216, Math.round(total)) };
  });
})();

const calendarRows: WidgetRow[] = Array.from({ length: 126 }, (_, i) => {
  const date = day('2026-11-23', i);
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const midweek = dow >= 2 && dow <= 4 ? 9 : dow === 5 || dow === 6 ? -6 : 2;
  const techWeek = date >= '2026-12-15' && date <= '2026-12-19' ? 24 : 0;
  const festive = date >= '2026-12-27' && date <= '2027-01-02' ? 18 : 0;
  const lull = date >= '2026-12-20' && date <= '2026-12-25' ? -14 : 0;
  // On the books thins out the further ahead the night is.
  const far = i > 45 ? (i - 45) * 0.42 : 0;
  return { stay_date: date, occupancy_pct: round(Math.min(99, Math.max(18, 66 + midweek + techWeek + festive + lull - far + wobble(i, 31) * 5)), 1) };
});

/* ───────── Comparison ───────── */

const revparRows: WidgetRow[] = [
  { hotel: 'Arbor New York Midtown', revpar: 261.4, revpar_ly: 289.2 },
  { hotel: 'Kestrel London Mayfair', revpar: 252.8, revpar_ly: 236.1 },
  { hotel: 'Arbor Tokyo Ginza', revpar: 214.6, revpar_ly: 201.9 },
  { hotel: 'Kestrel Dubai Marina', revpar: 201.3, revpar_ly: 188.4 },
  { hotel: 'Arbor Paris Opera', revpar: 196.7, revpar_ly: 199.5 },
  { hotel: 'Kestrel Singapore Marina', revpar: 188.2, revpar_ly: 176.0 },
  { hotel: 'Lumen Miami Beach', revpar: 171.5, revpar_ly: 183.3 },
  { hotel: 'Tessera Dubai Business Bay', revpar: 142.9, revpar_ly: 131.7 },
  { hotel: 'Arbor Lisbon Chiado', revpar: 128.4, revpar_ly: 139.8 },
  { hotel: 'Tessera Berlin Mitte', revpar: 97.6, revpar_ly: 95.2 },
];

const budgetRows: WidgetRow[] = [
  { month: '2026-06', revenue: 18_420_000, budget: 17_900_000 },
  { month: '2026-07', revenue: 20_160_000, budget: 19_400_000 },
  { month: '2026-08', revenue: 19_780_000, budget: 19_900_000 },
  { month: '2026-09', revenue: 18_950_000, budget: 18_300_000 },
  { month: '2026-10', revenue: 17_640_000, budget: 18_100_000 },
  { month: '2026-11', revenue: 15_210_000, budget: 16_800_000 },
];

const SEGMENTS: [string, number[]][] = [
  ['Corporate', [4310, 3980, 3120, 4460, 3890, 2640]],
  ['Leisure', [3640, 4720, 5210, 3880, 3920, 4480]],
  ['Group', [1480, 1120, 760, 1690, 1540, 1210]],
  ['Wholesale', [820, 1040, 1180, 790, 730, 810]],
  ['Other', [310, 290, 340, 280, 300, 270]],
];
const MONTHS = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
const segmentRows: WidgetRow[] = MONTHS.flatMap((month, m) => SEGMENTS.map(([segment, nights]) => ({ month, segment, room_nights: nights[m] })));

const bridgeRows: WidgetRow[] = [
  { step: 'Budget GOP', amount: 1_412_000, kind: 'total' },
  { step: 'Rooms revenue', amount: -38_000, kind: 'step' },
  { step: 'F&B revenue', amount: 21_000, kind: 'step' },
  { step: 'Payroll', amount: -112_000, kind: 'step' },
  { step: 'Utilities', amount: -19_000, kind: 'step' },
  { step: 'Other costs', amount: -16_000, kind: 'step' },
  { step: 'Actual GOP', amount: 1_248_000, kind: 'total' },
];

const radarRows: WidgetRow[] = [
  { measure: 'Occupancy (MPI)', hotel_index: 92, compset_index: 100 },
  { measure: 'Rate (ARI)', hotel_index: 108, compset_index: 100 },
  { measure: 'RevPAR (RGI)', hotel_index: 99, compset_index: 100 },
  { measure: 'Direct share', hotel_index: 121, compset_index: 100 },
  { measure: 'Review score', hotel_index: 104, compset_index: 100 },
  { measure: 'Length of stay', hotel_index: 88, compset_index: 100 },
];

/* ───────── Part of a whole and flows ───────── */

const channelRows: WidgetRow[] = [
  { channel: 'Direct web', revenue: 1_180_000 },
  { channel: 'OTA', revenue: 2_060_000 },
  { channel: 'Corporate direct', revenue: 890_000 },
  { channel: 'GDS', revenue: 640_000 },
  { channel: 'Wholesale', revenue: 430_000 },
];
const segmentShareRows: WidgetRow[] = [
  { segment: 'Leisure', room_nights: 4480 },
  { segment: 'Corporate', room_nights: 2640 },
  { segment: 'Group', room_nights: 1210 },
  { segment: 'Other', room_nights: 1080 },
];

const HOTEL_REVENUE: [string, string, number][] = [
  ['Arbor New York Midtown', 'North America', 2_640_000],
  ['Tessera Chicago Loop', 'North America', 1_310_000],
  ['Lumen Miami Beach', 'North America', 1_180_000],
  ['Arbor Toronto Financial District', 'North America', 960_000],
  ['Kestrel London Mayfair', 'Europe', 1_184_000],
  ['Arbor Paris Opera', 'Europe', 1_062_000],
  ['Lumen Barcelona Mar', 'Europe', 986_000],
  ["Tessera London King's Cross", 'Europe', 951_000],
  ['Arbor Amsterdam Centraal', 'Europe', 874_000],
  ['Kestrel Vienna Ring', 'Europe', 612_000],
  ['Tessera Berlin Mitte', 'Europe', 588_000],
  ['Arbor Lisbon Chiado', 'Europe', 517_000],
  ['Kestrel Dubai Marina', 'Middle East', 1_720_000],
  ['Tessera Dubai Business Bay', 'Middle East', 1_140_000],
  ['Arbor Doha West Bay', 'Middle East', 830_000],
  ['Kestrel Singapore Marina', 'Asia', 1_490_000],
  ['Arbor Tokyo Ginza', 'Asia', 1_260_000],
  ['Lumen Bali Uluwatu', 'Asia', 640_000],
  ['Arbor Sao Paulo Faria Lima', 'South America', 520_000],
  ['Tessera Buenos Aires Palermo', 'South America', 310_000],
];
const treemapRows: WidgetRow[] = HOTEL_REVENUE.map(([hotel, region, revenue]) => ({ hotel, region, revenue }));

const funnelRows: WidgetRow[] = [
  { stage: 'Searches', sessions: 48_200 },
  { stage: 'Room viewed', sessions: 21_700 },
  { stage: 'Rate selected', sessions: 9_400 },
  { stage: 'Checkout started', sessions: 3_150 },
  { stage: 'Booked', sessions: 1_010 },
];

const flowRows: WidgetRow[] = [
  { channel: 'OTA', lands_in: 'Net revenue', revenue: 1_648_000 },
  { channel: 'OTA', lands_in: 'Commission', revenue: 412_000 },
  { channel: 'Direct web', lands_in: 'Net revenue', revenue: 1_180_000 },
  { channel: 'Corporate direct', lands_in: 'Net revenue', revenue: 890_000 },
  { channel: 'GDS', lands_in: 'Net revenue', revenue: 576_000 },
  { channel: 'GDS', lands_in: 'Commission', revenue: 64_000 },
  { channel: 'Wholesale', lands_in: 'Net revenue', revenue: 344_000 },
  { channel: 'Wholesale', lands_in: 'Commission', revenue: 86_000 },
];

/* ───────── Relationship and distribution ───────── */

const INDEX: [string, number, number][] = [
  ['New York Midtown', 112, 91],
  ['London Mayfair', 109, 106],
  ['Tokyo Ginza', 104, 108],
  ['Dubai Marina', 106, 103],
  ['Paris Opera', 101, 97],
  ['Singapore Marina', 103, 110],
  ['Miami Beach', 97, 94],
  ['Dubai Business Bay', 78, 118],
  ['Lisbon Chiado', 108, 92],
  ['Berlin Mitte', 93, 101],
  ['Amsterdam Centraal', 99, 96],
  ['Barcelona Mar', 95, 89],
  ['Vienna Ring', 102, 104],
  ['Chicago Loop', 96, 105],
  ['Toronto Financial District', 100, 99],
  ['Doha West Bay', 91, 95],
  ['Bali Uluwatu', 115, 102],
  ["London King's Cross", 94, 109],
  ['Sao Paulo Faria Lima', 98, 93],
  ['Buenos Aires Palermo', 89, 98],
];
const indexRows: WidgetRow[] = INDEX.map(([hotel, ari, mpi]) => ({ hotel, ari, mpi }));

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DOW: [string, number[]][] = [
  ['New York Midtown', [84, 93, 95, 91, 78, 72, 66]],
  ['London Mayfair', [81, 90, 92, 89, 83, 80, 69]],
  ['Dubai Business Bay', [79, 88, 91, 86, 64, 58, 71]],
  ['Berlin Mitte', [68, 79, 82, 77, 66, 61, 52]],
  ['Lisbon Chiado', [58, 63, 66, 69, 84, 88, 71]],
  ['Barcelona Mar', [55, 59, 62, 68, 86, 93, 77]],
  ['Miami Beach', [61, 60, 64, 72, 90, 96, 82]],
  ['Bali Uluwatu', [74, 73, 75, 78, 88, 92, 86]],
];
const dowRows: WidgetRow[] = DOW.flatMap(([hotel, occ]) => WEEKDAYS.map((weekday, i) => ({ hotel, weekday, occupancy_pct: occ[i] })));

/* ───────── Detail ───────── */

const tableRows: WidgetRow[] = [
  { hotel_code: 'NYC', hotel: 'Arbor New York Midtown', stay_month: '2026-12', occupancy_pct: 71.2, rooms_otb: 8386, rooms_otb_ly: 9571, pace_pct: -12.4, adr: 342.5, revenue: 2_872_000 },
  { hotel_code: 'LON1', hotel: 'Kestrel London Mayfair', stay_month: '2026-12', occupancy_pct: 78.9, rooms_otb: 2935, rooms_otb_ly: 2741, pace_pct: 7.1, adr: 318.0, revenue: 933_000 },
  { hotel_code: 'DXB2', hotel: 'Tessera Dubai Business Bay', stay_month: '2026-12', occupancy_pct: 74.3, rooms_otb: 6910, rooms_otb_ly: 6204, pace_pct: 11.4, adr: 171.25, revenue: 1_183_000 },
  { hotel_code: 'TYO', hotel: 'Arbor Tokyo Ginza', stay_month: '2026-12', occupancy_pct: 81.6, rooms_otb: 5312, rooms_otb_ly: 5106, pace_pct: 4.0, adr: 254.0, revenue: 1_349_000 },
  { hotel_code: 'PAR', hotel: 'Arbor Paris Opera', stay_month: '2026-12', occupancy_pct: 69.8, rooms_otb: 3895, rooms_otb_ly: 3978, pace_pct: -2.1, adr: 276.4, revenue: 1_077_000 },
  { hotel_code: 'LIS', hotel: 'Arbor Lisbon Chiado', stay_month: '2026-12', occupancy_pct: 58.4, rooms_otb: 2716, rooms_otb_ly: 3229, pace_pct: -15.9, adr: 148.9, revenue: 404_000 },
  { hotel_code: 'BCN', hotel: 'Lumen Barcelona Mar', stay_month: '2026-12', occupancy_pct: 52.1, rooms_otb: 4845, rooms_otb_ly: 5012, pace_pct: -3.3, adr: 139.5, revenue: 676_000 },
  { hotel_code: 'BER', hotel: 'Tessera Berlin Mitte', stay_month: '2026-12', occupancy_pct: 61.7, rooms_otb: 4590, rooms_otb_ly: null, pace_pct: null, adr: 121.0, revenue: 555_000 },
  { hotel_code: 'MIA', hotel: 'Lumen Miami Beach', stay_month: '2026-12', occupancy_pct: 83.5, rooms_otb: 6730, rooms_otb_ly: 6512, pace_pct: 3.3, adr: 289.75, revenue: 1_950_000 },
  { hotel_code: 'DPS', hotel: 'Lumen Bali Uluwatu', stay_month: '2026-12', occupancy_pct: 88.2, rooms_otb: 5468, rooms_otb_ly: 5190, pace_pct: 5.4, adr: 198.0, revenue: 1_083_000 },
];

const europeRevenue: WidgetRow[] = HOTEL_REVENUE.filter(([, region]) => region === 'Europe').map(([hotel, , revenue]) => ({ hotel, revenue }));

export const SPECIMENS: SpecimenGroup[] = [
  {
    id: 'figures',
    title: 'Figures',
    blurb: 'When the answer is a number. The value leads, the change carries an arrow as well as a colour, and a trend rides along only when the rows have one.',
    items: [
      {
        id: 'kpi',
        spec: { kind: 'kpi', title: 'Group RevPAR is €148, 8.3% ahead of last year', subtitle: 'All 20 hotels · Thu 19 Nov 2026', sourceCallId: src('kpi'), x: 'stay_date', y: ['revpar'], compare: 'revpar_ly' },
        rows: groupDaily,
        columns: dailyColumns,
        shows: 'Latest row of a time series, change against the compare column, trend from the rows.',
      },
      {
        id: 'gauge',
        spec: { kind: 'gauge', title: 'Lisbon Chiado is at 71.6% for December against an 80% budget', subtitle: 'Arbor Lisbon Chiado · stays 1–31 Dec 2026', sourceCallId: src('gauge'), y: ['occupancy_pct'], compare: 'budget_occupancy_pct' },
        rows: [{ stay_month: '2026-12', occupancy_pct: 71.6, budget_occupancy_pct: 80 }],
        columns: [col('stay_month', 'Month', 'month'), col('occupancy_pct', 'Occupancy', 'percent'), col('budget_occupancy_pct', 'Budget', 'percent')],
      },
      {
        id: 'kpi_row',
        wide: true,
        spec: { kind: 'kpi_row', title: 'Rate and occupancy are ahead of last year; cancellations are falling', subtitle: 'All 20 hotels · 6–19 Nov 2026 vs the same days last year', sourceCallId: src('kpi_row'), x: 'stay_date', y: ['occupancy_pct', 'adr', 'revpar', 'cancellations'] },
        rows: groupDaily,
        columns: dailyColumns,
        shows: 'One tile per y column; each finds its own “_ly” column. Fewer cancellations read as good news.',
      },
      {
        id: 'sparkline_list',
        spec: { kind: 'sparkline_list', title: 'New York and Lisbon are sliding; Dubai Marina keeps climbing', subtitle: 'RevPAR by hotel · 6–19 Nov 2026', sourceCallId: src('sparkline_list'), x: 'stay_date', y: ['revpar'], group: 'hotel' },
        rows: sparkRows,
        columns: [col('hotel', 'Hotel', 'hotel'), col('stay_date', 'Stay date', 'date'), col('revpar', 'RevPAR', 'currency', 'EUR')],
      },
      {
        id: 'bullet',
        spec: { kind: 'bullet', title: 'Six of eight European hotels are behind their November budget', subtitle: 'Room revenue, month to date · Europe', sourceCallId: src('bullet'), x: 'hotel', y: ['revenue'], compare: 'budget' },
        rows: bulletRows,
        columns: [col('hotel', 'Hotel', 'hotel'), col('revenue', 'Revenue', 'currency', 'EUR'), col('budget', 'Budget', 'currency', 'EUR')],
      },
    ],
  },
  {
    id: 'time',
    title: 'Change over time',
    blurb: 'This year is solid blue, the comparison is dashed purple, and the series are named on the line ends instead of in a legend.',
    items: [
      {
        id: 'line',
        spec: { kind: 'line', title: 'Lisbon is 15.9% behind last year for December', subtitle: 'Arbor Lisbon Chiado · rooms on the books by stay date, as of 20 Nov', sourceCallId: src('line'), x: 'stay_date', y: ['rooms_otb'], compare: 'rooms_otb_ly' },
        rows: paceRows,
        columns: [col('stay_date', 'Stay date', 'date'), col('rooms_otb', 'On the books', 'count', 'rooms'), col('rooms_otb_ly', 'Same time last year', 'count', 'rooms')],
      },
      {
        id: 'area',
        spec: { kind: 'area', title: 'Pickup for 16 Dec doubled once Gulf Tech Week was announced', subtitle: 'Tessera Dubai Business Bay · rooms on the books by booking date', sourceCallId: src('area'), x: 'booking_date', y: ['rooms_otb'] },
        rows: pickupRows,
        columns: [col('booking_date', 'Booking date', 'date'), col('rooms_otb', 'On the books', 'count', 'rooms')],
      },
      {
        id: 'calendar_heatmap',
        wide: true,
        spec: { kind: 'calendar_heatmap', title: 'Gulf Tech Week and New Year are close to full; from February the books are still thin', subtitle: 'Tessera Dubai Business Bay · occupancy on the books by night, 23 Nov 2026 – 28 Mar 2027', sourceCallId: src('calendar_heatmap'), x: 'stay_date', y: ['occupancy_pct'] },
        rows: calendarRows,
        columns: [col('stay_date', 'Night', 'date'), col('occupancy_pct', 'Occupancy', 'percent')],
      },
    ],
  },
  {
    id: 'comparison',
    title: 'Comparison',
    blurb: 'Bars lie down when the categories are names, so the names read. The comparison is a purple tick or a purple bar, never a second axis.',
    items: [
      {
        id: 'bar',
        spec: { kind: 'bar', title: 'New York leads on RevPAR but is the furthest below last year', subtitle: 'Top 10 hotels · November to date · tick = last year', sourceCallId: src('bar'), x: 'hotel', y: ['revpar'], compare: 'revpar_ly' },
        rows: revparRows,
        columns: [col('hotel', 'Hotel', 'hotel'), col('revpar', 'RevPAR', 'currency', 'EUR'), col('revpar_ly', 'Last year', 'currency', 'EUR')],
      },
      {
        id: 'grouped_bar',
        spec: { kind: 'grouped_bar', title: 'Revenue has missed budget three months out of the last four', subtitle: 'Group room revenue · Jun–Nov 2026', sourceCallId: src('grouped_bar'), x: 'month', y: ['revenue'], compare: 'budget' },
        rows: budgetRows,
        columns: [col('month', 'Month', 'month'), col('revenue', 'Revenue', 'currency', 'EUR'), col('budget', 'Budget', 'currency', 'EUR')],
      },
      {
        id: 'stacked_bar',
        spec: { kind: 'stacked_bar', title: 'Corporate nights fell by a third in November; leisure filled part of the gap', subtitle: 'Arbor New York Midtown · room nights by segment', sourceCallId: src('stacked_bar'), x: 'month', y: ['room_nights'], group: 'segment' },
        rows: segmentRows,
        columns: [col('month', 'Month', 'month'), col('segment', 'Segment', 'text'), col('room_nights', 'Room nights', 'count', 'nights')],
      },
      {
        id: 'waterfall',
        spec: { kind: 'waterfall', title: 'Miami Beach GOP is €164k under budget, and payroll is most of it', subtitle: 'Lumen Miami Beach · October 2026, budget to actual', sourceCallId: src('waterfall'), x: 'step', y: ['amount'] },
        rows: bridgeRows,
        columns: [col('step', 'Step', 'text'), col('amount', 'GOP', 'currency', 'EUR'), { ...col('kind', 'Kind', 'text'), hidden: true }],
      },
      {
        id: 'radar',
        spec: { kind: 'radar', title: 'Lisbon Chiado holds its rate but gives up occupancy and length of stay', subtitle: 'Arbor Lisbon Chiado vs comp set · index, 100 = parity', sourceCallId: src('radar'), x: 'measure', y: ['hotel_index'], compare: 'compset_index' },
        rows: radarRows,
        columns: [col('measure', 'Measure', 'text'), col('hotel_index', 'Lisbon Chiado', 'number', 'index'), col('compset_index', 'Comp set', 'number', 'index')],
      },
    ],
  },
  {
    id: 'parts',
    title: 'Part of a whole and flows',
    blurb: 'Pies and donuts are kept for two to seven parts of one whole. Parts are separated by a gap in the surface colour, and named on the chart.',
    items: [
      {
        id: 'donut',
        spec: { kind: 'donut', title: 'OTAs bring 40% of December revenue; direct web is second', subtitle: 'Group room revenue by channel · stays in Dec 2026', sourceCallId: src('donut'), group: 'channel', y: ['revenue'] },
        rows: channelRows,
        columns: [col('channel', 'Channel', 'text'), col('revenue', 'Revenue', 'currency', 'EUR')],
      },
      {
        id: 'pie',
        spec: { kind: 'pie', title: 'Leisure is now almost half of New York’s room nights', subtitle: 'Arbor New York Midtown · November 2026', sourceCallId: src('pie'), group: 'segment', y: ['room_nights'] },
        rows: segmentShareRows,
        columns: [col('segment', 'Segment', 'text'), col('room_nights', 'Room nights', 'count', 'nights')],
      },
      {
        id: 'treemap',
        spec: { kind: 'treemap', title: 'Europe earns the most as a region; New York is the largest single hotel', subtitle: 'Room revenue by region and hotel · November to date', sourceCallId: src('treemap'), x: 'hotel', group: 'region', y: ['revenue'] },
        rows: treemapRows,
        columns: [col('hotel', 'Hotel', 'hotel'), col('region', 'Region', 'text'), col('revenue', 'Revenue', 'currency', 'EUR')],
      },
      {
        id: 'funnel',
        spec: { kind: 'funnel', title: 'Amsterdam mobile: two in a hundred searches end in a booking', subtitle: 'Arbor Amsterdam Centraal · mobile web sessions, last 28 days', sourceCallId: src('funnel'), x: 'stage', y: ['sessions'] },
        rows: funnelRows,
        columns: [col('stage', 'Stage', 'text'), col('sessions', 'Sessions', 'count')],
      },
      {
        id: 'sankey',
        wide: true,
        spec: { kind: 'sankey', title: 'OTAs pay €412k in commission, three quarters of all commission paid', subtitle: 'Group room revenue by channel, and where it lands · stays in Dec 2026', sourceCallId: src('sankey'), x: 'channel', group: 'lands_in', y: ['revenue'] },
        rows: flowRows,
        columns: [col('channel', 'Channel', 'text'), col('lands_in', 'Lands in', 'text'), col('revenue', 'Revenue', 'currency', 'EUR')],
      },
    ],
  },
  {
    id: 'relationship',
    title: 'Relationship and distribution',
    blurb: 'Magnitude is one hue, light to strong. Reference lines say what “fair” is, so a point’s position has a meaning.',
    items: [
      {
        id: 'scatter',
        spec: { kind: 'scatter', title: 'Dubai Business Bay wins share by pricing 22% under its comp set', subtitle: 'All 20 hotels · rate index against share index, last 28 days', sourceCallId: src('scatter'), x: 'ari', y: ['mpi'], group: 'hotel' },
        rows: indexRows,
        columns: [col('hotel', 'Hotel', 'hotel'), col('ari', 'ARI (rate index)', 'number', 'index'), col('mpi', 'MPI (share index)', 'number', 'index')],
      },
      {
        id: 'heatmap',
        spec: { kind: 'heatmap', title: 'City hotels peak midweek; the resorts fill on Friday and Saturday', subtitle: 'Occupancy by weekday · last 8 weeks', sourceCallId: src('heatmap'), x: 'weekday', group: 'hotel', y: ['occupancy_pct'] },
        rows: dowRows,
        columns: [col('hotel', 'Hotel', 'hotel'), col('weekday', 'Weekday', 'text'), col('occupancy_pct', 'Occupancy', 'percent')],
      },
    ],
  },
  {
    id: 'detail',
    title: 'Detail',
    blurb: 'Every chart can be read as this table. Columns sort, numbers are formatted by their kind and line up, and the first column stays in view.',
    items: [
      {
        id: 'table',
        wide: true,
        spec: { kind: 'table', title: 'Lisbon and New York are the two hotels well behind last year’s pace', subtitle: 'On the books for December 2026, as of 20 Nov', sourceCallId: src('table') },
        rows: tableRows,
        columns: [
          { ...col('hotel_code', 'Code', 'id'), hidden: true },
          col('hotel', 'Hotel', 'hotel'),
          col('stay_month', 'Month', 'month'),
          col('occupancy_pct', 'Occupancy', 'percent'),
          col('rooms_otb', 'On the books', 'count', 'rooms'),
          col('rooms_otb_ly', 'Last year', 'count', 'rooms'),
          col('pace_pct', 'Pace', 'percent'),
          col('adr', 'ADR', 'currency', 'EUR'),
          col('revenue', 'Revenue', 'currency', 'EUR'),
        ],
      },
    ],
  },
  {
    id: 'fallbacks',
    title: 'Fallbacks and states',
    blurb: 'A chart never fails silently: it says what it changed and why, an empty result is a sentence, and the skeleton keeps the exact box of the finished chart.',
    items: [
      {
        id: 'donut-fallback',
        spec: { kind: 'donut', title: 'Mayfair and Paris lead Europe’s room revenue', subtitle: 'Asked for as a donut · 8 hotels', sourceCallId: src('donut_fallback'), group: 'hotel', y: ['revenue'] },
        rows: europeRevenue,
        columns: [col('hotel', 'Hotel', 'hotel'), col('revenue', 'Revenue', 'currency', 'EUR')],
      },
      {
        id: 'empty',
        spec: { kind: 'line', title: 'No group bookings on the books for Doha in February', subtitle: 'Arbor Doha West Bay · group segment · Feb 2027', sourceCallId: src('empty'), x: 'stay_date', y: ['rooms_otb'] },
        rows: [],
        columns: [col('stay_date', 'Stay date', 'date'), col('rooms_otb', 'On the books', 'count', 'rooms')],
      },
    ],
  },
];
