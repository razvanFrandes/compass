import type { RunOutcome, Watcher, WatcherDraft, WatcherStatus } from './store';
import { HOTELS } from './halcyon-data';

/** Autonomy ladder (agents_pattern.md §5.3.7): named stopping points, starting low; the third is shown locked. */
export const LEVELS = [
  { level: 1 as const, name: 'Alerts only', short: 'Alerts only', text: 'Tells you what changed. Never proposes a number.' },
  { level: 2 as const, name: 'Recommends · you decide', short: 'Recommends', text: 'Proposes a rate with its reasons. Nothing happens until you approve; approving logs a task for the revenue manager.' },
  { level: 3 as const, name: 'Acts within limits', short: 'Acts within limits', text: 'Not available: Compass never changes rates in your systems.' },
];

export const STATUS: Record<WatcherStatus, { label: string; cls: string }> = {
  needs: { label: 'Needs your decision', cls: 'status-chip--needs' },
  running: { label: 'Running…', cls: 'status-chip--running' },
  watching: { label: 'Watching', cls: '' },
  paused: { label: 'Paused', cls: '' },
  failed: { label: 'Couldn’t run', cls: 'status-chip--failed' },
};

export const OUTCOME_LABEL: Record<RunOutcome, string> = { none: 'No change', finding: 'Found something', pending: 'Needs you', failed: 'Couldn’t run', skipped: 'Skipped' };

/*
  Run history for the watcher page (docs/research/ui-round3/agents_pattern.md §5.7). The watchers are built on the
  stories in compass_hotels (S6 rates, S1 pace, S7 feeds); older runs are simulated deterministically from the watcher id,
  so the page is the same on every load, and the newest 14 runs are exactly the strip on the card.
*/

export interface RunRecord {
  i: number; // position in the history, 0 = oldest
  at: number; // UTC ms
  outcome: RunOutcome;
  duration: string;
  text: string;
  steps: string[];
  verdict?: 'approved' | 'kept';
}

const H = 3_600_000;
/** When each built-in watcher last ran, and how often (Fri 20 Nov 2026 is the business date). */
const CADENCE: Record<string, { newest: number; stepH: number; count: number }> = {
  rate: { newest: Date.UTC(2026, 10, 20, 6, 0), stepH: 24, count: 120 }, // daily since Fri 24 Jul
  pace: { newest: Date.UTC(2026, 10, 20, 7, 0), stepH: 24, count: 120 }, // daily since Fri 24 Jul
  feeds: { newest: Date.UTC(2026, 10, 20, 8, 0), stepH: 1, count: 120 }, // hourly; history keeps 5 days
};
/** Rate vs comp set only alerted until autonomy was raised to Recommends on Mon 3 Aug. */
const RATE_RECOMMENDS_FROM = Date.UTC(2026, 7, 3);
/** Berlin's POS feed last synced Tue 17 Nov 04:12 (data_sources). */
const BER_STALE_FROM = Date.UTC(2026, 10, 17, 10, 0);
const OTHER_HOTELS = HOTELS.map((h) => h.name.replace(/^(Arbor|Lumen|Tessera|Kestrel) /, '')).filter((n) => n !== 'Dubai Business Bay');

const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
export const runDay = (ms: number) => dayFmt.format(ms).replace('Sept', 'Sep');
export const runTime = (ms: number) => timeFmt.format(ms);
export const runWhen = (ms: number) => `${runDay(ms)} · ${timeFmt.format(ms)}`;

function rng(seed: string) {
  let a = [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 7);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STEPS: Record<string, string[]> = {
  rate: ['Read v_rate_position for 20 hotels × 45 nights', 'Read rooms on the books (otb_as_of)', 'Kept nights under 0.85× the comp-set median', 'Kept the busy ones: 2+ competitors sold out or over 70% full'],
  pace: ['Ran pace_vs_stly() for 20 hotels × 45 nights', 'Compared rooms on the books with the same time last year', 'Flagged hotels more than 10% behind'],
  feeds: ['Read data_sources: 140 feeds', 'Compared each last sync with its schedule'],
};

function record(w: Watcher, outcome: RunOutcome, i: number, at: number, r: () => number): RunRecord {
  const secs = (min: number, spread: number) => `${min + Math.floor(r() * spread)} s`;
  const steps = STEPS[w.id] ?? [];
  if (outcome === 'skipped') return { i, at, outcome, duration: '—', text: 'Skipped · the watcher was paused', steps: ['Did not run: paused by you'] };
  if (outcome === 'failed')
    return { i, at, outcome, duration: '3 s', text: 'Couldn’t run · the nightly data load hadn’t finished', steps: [steps[0], 'Stopped: the analytics copy was still loading', 'Nothing was sent · the next run stays on schedule'] };
  if (w.id === 'rate') {
    if (outcome === 'pending')
      return { i, at, outcome, duration: '44 s', text: 'Raise Dubai Business Bay to the comp-set median for 16–18 Dec · waiting for you', steps: [...steps, 'Recommended the comp-set median for Wed 16 – Fri 18 Dec: Gulf Tech Week, 0.78× the comp set, 3 competitors sold out'] };
    if (outcome === 'finding') {
      const hotel = OTHER_HOTELS[Math.floor(r() * OTHER_HOTELS.length)];
      const night = runDay(at + (10 + Math.floor(r() * 30)) * 24 * H);
      if (at < RATE_RECOMMENDS_FROM)
        return { i, at, outcome, duration: secs(38, 10), text: `Alerted: ${hotel} under the market on ${night}`, steps: [...steps, `Alerted you about ${hotel}, ${night} (Alerts only at the time)`] };
      const verdict = r() < 0.75 ? 'approved' : 'kept';
      return { i, at, outcome, duration: secs(38, 10), verdict, text: `Recommended the comp-set median for ${hotel}, ${night} · ${verdict === 'approved' ? 'you approved' : 'you kept the rate'}`, steps: [...steps, `Recommended the comp-set median for ${hotel}, ${night}`] };
    }
    return { i, at, outcome, duration: secs(36, 10), text: 'Checked 20 hotels · nothing under the market on busy nights', steps: [...steps, 'No busy night under 0.85× its comp-set median'] };
  }
  if (w.id === 'pace') {
    if (outcome === 'finding')
      return i === 119 || at >= Date.UTC(2026, 10, 20)
        ? { i, at, outcome, duration: secs(12, 6), text: 'Lisbon Chiado 17.4% behind last year for the next 45 nights', steps: [...steps, 'Flagged Lisbon Chiado: 2,231 rooms on the books vs 2,700 last year'] }
        : { i, at, outcome, duration: secs(12, 6), text: 'Flagged Lisbon Chiado · more than 10% behind last year', steps: [...steps, 'Flagged Lisbon Chiado'] };
    return { i, at, outcome, duration: secs(11, 6), text: 'Checked 20 hotels · none more than 10% behind', steps: [...steps, 'Every hotel within 10% of last year'] };
  }
  if (w.id === 'feeds') {
    if (outcome === 'finding')
      return { i, at, outcome, duration: secs(2, 3), text: 'Berlin Mitte POS (Lightspeed) stale since Tue 17 Nov 04:12', steps: [...steps, 'Flagged 1 of 140 feeds: Berlin Mitte POS'] };
    return { i, at, outcome, duration: secs(2, 3), text: 'Checked 140 feeds · all synced on schedule', steps: [...steps, 'All 140 feeds synced on schedule'] };
  }
  return { i, at, outcome, duration: '—', text: 'No runs yet', steps: [] };
}

/** Oldest → newest. The last 14 entries are the card's strip. New watchers have no history. */
export function runHistory(w: Watcher): RunRecord[] {
  const c = CADENCE[w.id];
  if (!c) return [];
  const r = rng(w.id);
  const n = Math.max(0, c.count - w.runs.length);
  const older: RunOutcome[] = Array.from({ length: n }, (_, k) => {
    const at = c.newest - (c.count - 1 - k) * c.stepH * H;
    const x = r();
    if (w.id === 'rate') return x < 0.05 ? 'finding' : x < 0.06 ? 'failed' : 'none';
    if (w.id === 'pace') return x < 0.03 ? 'finding' : 'none';
    return at >= BER_STALE_FROM ? 'finding' : 'none';
  });
  const outcomes = [...older, ...w.runs];
  return outcomes.map((o, i) => record(w, o, i, c.newest - (outcomes.length - 1 - i) * c.stepH * H, r));
}

export interface WatcherSettings {
  schedule: { kind: 'days'; days: boolean[]; time: string } | { kind: 'interval'; hours: number };
  scope: string[];
  threshold: { label: string; value: number; unit: string; step: number };
  reads: string[];
  older: { when: string; text: string; by?: boolean }[];
}

export const WATCHER_SETTINGS: Record<string, WatcherSettings> = {
  rate: {
    schedule: { kind: 'days', days: [true, true, true, true, true, true, true], time: '06:00' },
    scope: ['All 20 hotels', 'Next 45 nights', 'Base room BAR'],
    threshold: { label: 'Recommend a rate when BAR is under this share of the comp-set median', value: 85, unit: '%', step: 1 },
    reads: ['v_rate_position', 'otb_as_of()', 'room_inventory_daily'],
    older: [
      { when: 'Mon 3 Aug', text: 'You raised autonomy to Recommends · you decide', by: true },
      { when: 'Thu 23 Jul', text: 'You created Rate vs comp set', by: true },
    ],
  },
  pace: {
    schedule: { kind: 'days', days: [true, true, true, true, true, true, true], time: '07:00' },
    scope: ['All 20 hotels', 'Next 45 nights'],
    threshold: { label: 'Alert when a hotel is behind last year by more than', value: 10, unit: '%', step: 1 },
    reads: ['pace_vs_stly()'],
    older: [{ when: 'Thu 23 Jul', text: 'You created Pace vs last year', by: true }],
  },
  feeds: {
    schedule: { kind: 'interval', hours: 1 },
    scope: ['All 20 hotels', '7 feeds each'],
    threshold: { label: 'Alert when a feed has not synced for more than', value: 6, unit: 'h', step: 1 },
    reads: ['data_sources'],
    older: [
      { when: 'Tue 17 Nov', text: 'Data feeds flagged Berlin Mitte’s POS feed (Lightspeed)' },
      { when: 'Thu 23 Jul', text: 'You created Data feeds · history keeps the last 5 days', by: true },
    ],
  },
};

export const DEFAULT_SETTINGS: WatcherSettings = {
  schedule: { kind: 'days', days: [true, true, true, true, true, true, true], time: '07:00' },
  scope: ['All 20 hotels', 'Next 60 nights'],
  threshold: { label: 'Alert when pickup vs last year falls behind by', value: 10, unit: 'pts', step: 1 },
  reads: ['pace_vs_stly()'],
  older: [],
};

/** Templates on the stories the data holds (the backend plan's workflow templates), starting at Alerts only. */
export const TEMPLATES: WatcherDraft[] = [
  {
    key: 'accounts',
    name: 'Corporate accounts',
    glyph: 'phosphorUsersThreeLight',
    blurb: 'A top account’s room nights fall by half',
    sentence: [{ t: 'Watches the ' }, { t: 'top 20 accounts', b: true }, { t: ' at every hotel and alerts you when one’s room nights ' }, { t: 'fall by half', b: true }, { t: ' against the six months before.' }],
    cadence: 'Weekly, Mon 07:00',
    firstRun: 'Mon 23 Nov 07:00',
    autonomy: 1,
  },
  {
    key: 'web',
    name: 'Web conversion',
    glyph: 'phosphorChartLineLight',
    blurb: 'Conversion falls a third below its usual level',
    sentence: [{ t: 'Checks each hotel’s ' }, { t: 'website conversion', b: true }, { t: ' by device and alerts you when it falls ' }, { t: 'a third below its 60-day level', b: true }, { t: '.' }],
    cadence: 'Daily 08:00',
    firstRun: 'tomorrow 08:00',
    autonomy: 1,
  },
  {
    key: 'staffing',
    name: 'Staffing vs workload',
    glyph: 'phosphorTargetLight',
    blurb: 'A department works under 85% of the hours it needs',
    sentence: [{ t: 'Compares ' }, { t: 'hours worked', b: true }, { t: ' with the hours each department’s workload needs and alerts you under ' }, { t: '85%', b: true }, { t: '.' }],
    cadence: 'Weekly, Mon 07:00',
    firstRun: 'Mon 23 Nov 07:00',
    autonomy: 1,
  },
];
