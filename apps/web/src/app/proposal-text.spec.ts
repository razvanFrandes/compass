import type { Proposal } from '@compass/contracts';
import { HALCYON_HOTELS } from './scope/hotels';
import { decisionView, dismissedToast, handoverMessage, plainDates, plainDay, plainHotels, plainJargon, plainText, sentToast, toReceipt, undoneToast } from './proposal-text';

const TODAY = Date.parse('2026-11-20T00:00:00Z');

/** The decision that waits in the demo, as the agent wrote it. */
const LISBON: Proposal = {
  id: 'prop-1',
  workflowId: 'tpl-pace-guard',
  runId: 'run-1',
  hotel_code: 'LIS',
  action: 'adjust_bar',
  title: "Lower BAR on Lisbon's most overpriced nights to 1.2x comp median",
  rationale:
    'LIS has 2,231 room nights on the books against 2,700 last year for the next 45 nights (-17.4%). The next-largest gap in the group is NYC at -5.3%. Pickup over the last 21 days is 10.9% of capacity, the lowest of the 20 hotels. BAR is above the comp median on every shop night through 2027-01-03, at 1.10x to 1.89x, and no comp is sold out. Priority nights include 11-29 (1.67x), 12-23 (1.60x) and 01-03 (1.89x).',
  change: { before: 'BAR 145–220 EUR, 1.10x–1.89x comp median', after: 'Cap at about 1.2x comp median; biggest cuts on nights above 1.4x', scope: 'LIS, all room types, stay dates 2026-11-20 to 2027-01-03, nights above 1.4x comp median first' },
  impact_eur: 38_187,
  risk: 'high',
  status: 'pending',
  createdAt: '2026-11-20T22:35:00.000Z',
  decidedBy: null,
  decidedAt: null,
  note: null,
};
const view = (over: Partial<Proposal> = {}) => decisionView({ ...LISBON, ...over }, HALCYON_HOTELS, TODAY);

describe('plain words for what an agent wrote', () => {
  it('writes ISO dates as days, and a pair of them as a range', () => {
    expect(plainDay('2026-11-20', TODAY)).toBe('Fri 20 Nov');
    expect(plainDay('2027-01-03', TODAY)).toBe('Sun 3 Jan');
    expect(plainDates('stay dates 2026-11-20 to 2027-01-03', TODAY)).toBe('stay dates Fri 20 Nov – Sun 3 Jan');
    expect(plainDates('through 2027-01-03, at 1.10x', TODAY)).toBe('through Sun 3 Jan, at 1.10x');
    expect(plainDates('nights 11-29 (1.67x) and 01-03 (1.89x)', TODAY)).toBe('nights 29 Nov (1.67x) and 3 Jan (1.89x)');
  });

  it('adds the year only where the day could be misread', () => {
    expect(plainDay('2025-07-15', TODAY)).toBe('Tue 15 Jul 2025');
    expect(plainDay('not a date', TODAY)).toBe('not a date');
  });

  it('leaves a time of day and a count like "10-12 rooms" alone', () => {
    expect(plainDates('10-12 rooms a night', TODAY)).toBe('10-12 rooms a night');
    expect(plainDates('synced 2026-11-17 04:12', TODAY)).toBe('synced 2026-11-17 04:12');
  });

  it('names hotels by place: the city, or the hotel where a city has two', () => {
    expect(plainHotels('LIS trails NYC; DXB1 and DXB2 are ahead', HALCYON_HOTELS)).toBe('Lisbon trails New York; Dubai Marina and Dubai Business Bay are ahead');
    expect(plainHotels('A LISTING, not a code', HALCYON_HOTELS)).toBe('A LISTING, not a code');
  });

  it('turns rate-desk shorthand into rates and the competition', () => {
    expect(plainJargon('Lower BAR to 1.2x comp median')).toBe('Lower rates to 1.2× the competition');
    expect(plainJargon('BAR is above the comp set median, and no comp is sold out')).toBe('The rate is above the competition, and no competitor is sold out');
    expect(plainJargon('1.10x–1.89x comp median')).toBe('up to 1.9× the competition');
    expect(plainJargon('145–220 EUR')).toBe('€145–220');
    expect(plainJargon('665–790 AED')).toBe('665–790 AED');
    expect(plainJargon('estimated at up to 256k EUR at BAR')).toBe('estimated at up to €256k at today’s rate');
    expect(plainJargon('pace (-17.4%) vs STLY, OTB 2,231')).toBe('pace (−17.4%) vs the same time last year, on the books 2,231');
  });

  it('does all of it to a sentence', () => {
    expect(plainText('LIS: BAR is above the comp median through 2027-01-03.', HALCYON_HOTELS, TODAY)).toBe('Lisbon: The rate is above the competition through Sun 3 Jan.');
  });
});

describe('the decision card’s words', () => {
  it('titles the card as a suggestion, without the jargon and without the target', () => {
    expect(view().title).toBe("Suggestion: lower rates on Lisbon's most overpriced nights");
    expect(view({ title: 'Raise BAR for 16–18 Dec toward comp median' }).title).toBe('Suggestion: raise rates for 16–18 Dec toward the competition');
    expect(view({ title: 'Notify BER team and IT: Lightspeed POS feed stale 3 days' }).title).toBe('Suggestion: notify Berlin team and IT: Lightspeed POS feed stale 3 days');
  });

  it('says why in a sentence or two of plain words, then what it could win back', () => {
    // The first sentence, then the one about the rate against the competition: what the suggestion is about.
    expect(view().summary).toBe(
      'Lisbon has 2,231 room nights on the books against 2,700 last year for the next 45 nights (−17.4%). The rate is above the competition on every night we checked through Sun 3 Jan, at up to 1.9×, and no competitor is sold out. This could win back about €38k.',
    );
    expect(view({ action: 'contact_account' }).summary).toBe('Lisbon has 2,231 room nights on the books against 2,700 last year for the next 45 nights (−17.4%). The next-largest gap in the group is New York at −5.3%. This could win back about €38k.');
    expect(view({ impact_eur: null }).summary).not.toContain('€');
    expect(view({ title: 'Raise BAR for Gulf Tech Week', rationale: 'Three competitors are sold out on 16–18 Dec.', impact_eur: 42_677 }).summary).toBe('Three competitors are sold out on 16–18 Dec. This could bring in about €43k.');
    expect(view({ impact_eur: -115_000 }).summary).toMatch(/About €115k is at risk\.$/);
  });

  it('says what sending does, and what Compass never does, for the action at hand', () => {
    expect(view().promise).toBe('This goes to your revenue manager as a task. Compass never changes your rates.');
    expect(view({ action: 'close_channel' }).promise).toBe('This goes to your revenue manager as a task. Compass never closes or opens a channel.');
    expect(view({ action: 'create_task', risk: 'low' }).promise).toContain('Compass changes nothing in your hotel systems.');
  });

  it('labels the kind and who it needs, never "high risk"', () => {
    expect(view().kind).toBe('Price change · needs a person');
    expect(view({ action: 'open_channel' }).kind).toBe('Channel change · needs a person');
    expect(view({ action: 'notify', risk: 'low' }).kind).toBe('Note to the team · low risk');
  });

  it('keeps today → suggested for the reasoning, in plain words with human dates', () => {
    expect(view().reasoning).toEqual({
      today: '€145–220 a night, up to 1.9× the competition',
      suggested: 'Cap at about 1.2× the competition; biggest cuts on nights above 1.4×',
      covers: 'Lisbon, all room types, stay dates Fri 20 Nov – Sun 3 Jan, nights above 1.4× the competition first',
      why: expect.stringContaining('The rate is above the competition on every night we checked through Sun 3 Jan, at up to 1.9×, and no competitor is sold out. Priority nights include 29 Nov (1.7×), 23 Dec (1.6×) and 3 Jan (1.9×).'),
    });
    expect(view({ change: { before: '665–790 AED', after: '900–1,050 AED', scope: '16–18 Dec' } }).reasoning).toMatchObject({ today: '665–790 AED a night', suggested: '900–1,050 AED a night' });
  });

  it('says what became of it: sent and logged with Undo, dismissed, or only suggested', () => {
    expect(view()).toMatchObject({ status: 'Waiting for your decision', outcome: '', canUndo: false });
    expect(view({ status: 'applied' })).toMatchObject({ status: 'Sent to the revenue manager', outcome: 'logged', canUndo: true, promise: expect.stringMatching(/^This went to your revenue manager/) });
    expect(view({ status: 'approved' })).toMatchObject({ status: 'Sent to the revenue manager', canUndo: true });
    expect(view({ status: 'auto_approved' })).toMatchObject({ status: 'Sent by the agent', outcome: 'low risk · logged', canUndo: true });
    expect(view({ status: 'denied' })).toMatchObject({ status: 'Dismissed', outcome: 'nothing was sent', canUndo: false, promise: expect.stringMatching(/^This would go/) });
    expect(view({ status: 'suggested' })).toMatchObject({ status: 'Suggestion only', canUndo: false });
    expect(view({ status: 'undone' }).status).toBe('Taken back');
  });

  it('names the role the action goes to: the general manager for a task for the house', () => {
    expect(view()).toMatchObject({ send: 'Send to revenue manager' });
    const task = view({ action: 'create_task', risk: 'low', hotel_code: 'DPS' });
    expect(task.send).toBe('Send to general manager');
    expect(task.promise).toBe('This goes to your general manager as a task. Compass changes nothing in your hotel systems.');
    expect(view({ action: 'create_task', status: 'applied' }).status).toBe('Sent to the general manager');
  });

  it('never shows a hotel code, an ISO date, "BAR", "comp" or "risk: high" anywhere on the card', () => {
    const v = view();
    const all = [v.status, v.kind, v.title, v.summary, v.promise, ...Object.values(v.reasoning)].join(' ');
    expect(all).not.toMatch(/\bLIS\b|\bNYC\b|\d{4}-\d{2}-\d{2}|\bBAR\b|\bcomp\b|comp median|high risk|\d\.\d+x\b/);
  });
});

const ANA = { name: 'Ana Pop', email: 'ana.pop@halcyon.example.com', role: 'revenue_manager' as const, roleLabel: 'Revenue manager', hotel: 'Arbor Lisbon Chiado', hotel_code: 'LIS' };
const SENT = { ...LISBON, status: 'applied' as const, decidedBy: 'Compass user (web)', decidedAt: '2026-11-21T00:45:00.000Z' };
const RECEIPT = { proposal: SENT, handedTo: ANA, receipt: "RMS task rms-mwpk3x-4 for Ana Pop (Revenue manager, Arbor Lisbon Chiado): Lower BAR on Lisbon's most overpriced nights to 1.2x comp median (…)." };

describe('after the decision', () => {
  it('the toast says what happened and to whom', () => {
    expect(sentToast(RECEIPT, 'Arbor Lisbon Chiado')).toEqual({ title: 'Sent to Ana Pop, Revenue manager · Arbor Lisbon Chiado', description: 'Task created for the rate change · logged in the audit trail' });
    expect(sentToast({ ...RECEIPT, proposal: { ...SENT, action: 'create_task' }, handedTo: { ...ANA, name: 'Miguel Faria', role: 'general_manager', roleLabel: 'General manager' } }, 'Arbor Lisbon Chiado')).toEqual({
      title: 'Sent to Miguel Faria, General manager · Arbor Lisbon Chiado',
      description: 'Task created · logged in the audit trail',
    });
    // A hotel the roster does not know still says the role and the hotel.
    expect(sentToast({ ...RECEIPT, handedTo: null }, 'Porto Ribeira').title).toBe('Sent to the revenue manager · Porto Ribeira');
  });

  it('a dismissal gets the same kind of toast: nothing was sent, and it is logged', () => {
    expect(dismissedToast('Arbor Lisbon Chiado')).toEqual({ title: 'Dismissed · Arbor Lisbon Chiado', description: 'Nothing was sent · logged in the audit trail' });
  });

  it('Undo says what was taken back', () => {
    expect(undoneToast('applied', ANA, 'Arbor Lisbon Chiado')).toEqual({ title: 'Taken back · Arbor Lisbon Chiado', description: 'Ana Pop has a task to reverse it · logged in the audit trail' });
    expect(undoneToast('denied', null, 'Arbor Lisbon Chiado')).toEqual({ title: 'Back in Decisions waiting · Arbor Lisbon Chiado', description: 'The dismissal was taken back · logged in the audit trail' });
  });

  it('reads the server’s answer, and an older server’s plain proposal, the same way', () => {
    expect(toReceipt(RECEIPT, LISBON, true)).toBe(RECEIPT);
    const legacy = toReceipt({ ...LISBON, status: 'approved' }, LISBON, true);
    expect(legacy).toMatchObject({ proposal: { status: 'approved' }, handedTo: { name: 'Ana Pop', hotel: 'Arbor Lisbon Chiado' }, receipt: '' });
    expect(toReceipt({ ...LISBON, status: 'denied' }, LISBON, false).handedTo).toBeNull();
  });

  it('the message as it was handed over: who, when, the suggestion, the reasoning with its numbers, the evidence', () => {
    const m = handoverMessage(RECEIPT, 'Arbor Lisbon Chiado', HALCYON_HOTELS, TODAY, 'UTC');
    expect(m).toMatchObject({
      subject: "Suggestion for Arbor Lisbon Chiado: lower rates on Lisbon's most overpriced nights",
      to: ANA,
      role: 'Revenue manager',
      hotel: 'Arbor Lisbon Chiado',
      sent: 'Sat 21 Nov 2026, 00:45',
      task: 'rms-mwpk3x-4',
      suggestion: "Lower rates on Lisbon's most overpriced nights",
      evidenceHref: '/studio/tpl-pace-guard',
    });
    expect(m.summary).toContain('This could win back about €38k.');
    expect(m.reasoning.today).toBe('€145–220 a night, up to 1.9× the competition');
    expect(m.reasoning.why).toContain('2,231 room nights on the books against 2,700 last year');
    expect(m.footnote).toBe('Demo: Compass hands this to your RMS and revenue manager as a task. Compass never changes your rates. No email is sent, and the people in the demo team are fictional.');
    expect(JSON.stringify(m)).not.toMatch(/\bLIS,|\d{4}-\d{2}-\d{2}T?(?!\d{2}:)|\bBAR\b|comp median/);
  });

  it('a message without a roster entry or a receipt still reads', () => {
    const m = handoverMessage({ proposal: { ...SENT, hotel_code: 'OPO' }, handedTo: null, receipt: '' }, 'Porto Ribeira', HALCYON_HOTELS, TODAY, 'UTC');
    expect(m).toMatchObject({ to: null, role: 'Revenue manager', hotel: 'Porto Ribeira', task: '', subject: expect.stringMatching(/^Suggestion for Porto Ribeira: /) });
  });
});
