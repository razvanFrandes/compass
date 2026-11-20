import type { Evidence } from '@compass/contracts';
import type { ChatStep, ChatTurn, ChatWidget } from '../api';

/** Test helpers for the Kassandra components. Not used by the app. */

export const evidence = (patch: Partial<Evidence> = {}): Evidence => ({
  sources: ['hotel.v_hotel_day'],
  definitions: {},
  period: { from: '2026-12-01', to: '2026-12-31' },
  sql: 'select 1',
  params: [],
  rowCount: 2,
  businessDate: '2026-11-20',
  notes: [],
  ...patch,
});

export const turn = (patch: Partial<ChatTurn> = {}): ChatTurn => ({
  key: 't1',
  question: 'Why is Lisbon behind?',
  pending: false,
  steps: [],
  answer: null,
  streamingText: '',
  running: false,
  failure: null,
  workedMs: null,
  model: null,
  usage: { tokens: 0, costUsd: 0 },
  events: [],
  ...patch,
});

export const step = (patch: Partial<ChatStep> = {}): ChatStep => ({ callId: 'c1', name: 'get_pace', args: { hotels: ['LIS'] }, status: 'done', narration: '', ...patch });

export const widget = (patch: Partial<ChatWidget> = {}): ChatWidget => ({
  kind: 'bar',
  title: 'Lisbon is 15.9% behind last year for December',
  subtitle: 'Arbor Lisbon Chiado · December 2026',
  sourceCallId: 'c1',
  x: 'segment',
  y: ['rooms'],
  rows: [
    { segment: 'Corporate', rooms: 412 },
    { segment: 'Leisure', rooms: 980 },
  ],
  columns: [
    { key: 'segment', label: 'Segment', kind: 'text' },
    { key: 'rooms', label: 'Room nights', kind: 'count' },
  ],
  evidence: evidence(),
  ...patch,
});
