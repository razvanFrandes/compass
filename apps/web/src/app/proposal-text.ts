import { TEAM_ROLE_LABEL, handoverRole, recipientFor, type ActionType, type DecisionReceipt, type Handover, type Proposal } from '@compass/contracts';
import { BUSINESS_DAY } from './data';
import type { HotelRef } from './scope/hotels';
import { shortName } from './scope/hotels';
import { firstSentences } from './studio/studio';
import { humanizeText } from './text';

/*
  A decision, in the words of the person who decides.

  An agent writes a proposal for a revenue system: "Lower BAR to 1.2x comp median", "LIS", "2026-11-20 to
  2027-01-03". A general manager reads the card. Everything here turns the first into the second, by rule: hotel
  codes become places, ISO dates become days, rate jargon becomes "rates" and "the competition", and the card says
  what sending it does. Compass is read-only: sending hands a task to the revenue manager and writes the audit log;
  nothing in the hotel's systems changes. No number is computed here: figures are only re-worded and rounded.
*/

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const DAY_YEAR = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const NEAR = 330 * 86_400_000;

/** "Fri 20 Nov"; the year only when the day is most of a year away from today, where it could be misread. */
export function plainDay(iso: string, today = BUSINESS_DAY): string {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) return iso;
  return (Math.abs(t - today) < NEAR ? DAY : DAY_YEAR).format(t).replace(/,/g, '');
}

const ISO = String.raw`\d{4}-\d{2}-\d{2}`;

/** ISO dates as days: a pair joined by "to" or a dash becomes "Fri 20 Nov – Sun 3 Jan". */
export function plainDates(text: string, today = BUSINESS_DAY): string {
  return text
    .replace(new RegExp(String.raw`\b(${ISO})\s*(?:to|through|until|–|—|-|\.\.)\s*(${ISO})\b`, 'g'), (_, a: string, b: string) => `${plainDay(a, today)} – ${plainDay(b, today)}`)
    .replace(new RegExp(String.raw`\b(${ISO})\b(?![ T]\d{2}:)`, 'g'), (_, a: string) => plainDay(a, today))
    // "11-29 (1.67x)": a night written as month-day in a list of nights.
    .replace(/\b(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(?=\s*\()/g, (_, m: string, d: string) => SHORT.format(Date.UTC(new Date(today).getUTCFullYear(), Number(m) - 1, Number(d))));
}

/** Hotel codes as places: the city where it names one hotel ("Lisbon"), else the hotel without its brand ("Dubai Marina"). */
export function plainHotels(text: string, hotels: readonly HotelRef[]): string {
  let out = text;
  for (const hotel of hotels) {
    const alone = hotels.filter((h) => h.city === hotel.city).length === 1;
    out = out.replace(new RegExp(String.raw`\b${hotel.code}\b`, 'g'), alone ? hotel.city : shortName(hotel));
  }
  return out;
}

/** A multiple with one decimal is enough for a decision: 1.89× reads 1.9×. */
const multiple = (n: string) => `${Number(Number(n).toFixed(1))}×`;

/** Rate-desk shorthand as plain words. */
export function plainJargon(text: string): string {
  return (
    text
      // A range of multiples reads as its top: "1.10x–1.89x comp median" → "up to 1.9× the competition".
      .replace(/\b\d+(?:\.\d+)?x\s*(?:–|-|to)\s*(\d+(?:\.\d+)?)x\b/g, (_, top: string) => `up to ${multiple(top)}`)
      .replace(/\b(\d+(?:\.\d+)?)x\b/g, (_, n: string) => multiple(n))
      .replace(/\b(?:the\s+)?comp(?:etitive)?[- ]?set(?:\s+median)?(?:\s+rate)?\b/gi, 'the competition')
      .replace(/\b(?:the\s+)?comp\s+median\b/gi, 'the competition')
      .replace(/\bcomps\b/g, 'competitors')
      .replace(/\bcomp\b/g, 'competitor')
      .replace(/\bat BAR\b/g, 'at today’s rate')
      .replace(/(^|[.!?;:]\s+)BAR\b/g, '$1The rate')
      .replace(/\b(lower|raise|cut|increase|reduce|adjust|cap|hold|keep|move|bring)\s+BAR\b/gi, '$1 rates')
      .replace(/\bBAR\b/g, 'the rate')
      .replace(/\bOTB\b/g, 'on the books')
      .replace(/\bSTLY\b/g, 'the same time last year')
      .replace(/\bLY\b/g, 'last year')
      .replace(/\bRMS task\b/g, 'task')
      .replace(/\bshop nights?\b/g, (m) => (m.endsWith('s') ? 'nights we checked' : 'night we checked'))
      // Money in euros reads with its sign in front: "145–220 EUR" → "€145–220".
      .replace(/(\d[\d,.]*[kKmM]?(?:\s*[–-]\s*\d[\d,.]*[kKmM]?)?)\s*EUR\b/g, (_, n: string) => `€${n.replace(/\s*-\s*/, '–')}`)
      // A hyphen before a figure is a minus.
      .replace(/(^|[\s(])-(?=\d)/g, '$1−')
      .replace(/\s{2,}/g, ' ')
  );
}

/** Everything at once, for a sentence an agent wrote. */
export function plainText(text: string, hotels: readonly HotelRef[], today = BUSINESS_DAY): string {
  // Dates first: the shared humaniser would write them without their weekday, and with the year.
  return plainJargon(plainHotels(humanizeText(plainDates(text, today)), hotels)).trim();
}

const lowerFirst = (s: string) => (s && /^[A-Z][a-z]/.test(s) ? s[0]!.toLowerCase() + s.slice(1) : s);
const upperFirst = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** What kind of thing is suggested, and who it needs. Price and channel changes always need a person. */
const KIND: Record<ActionType, string> = {
  adjust_bar: 'Price change',
  close_channel: 'Channel change',
  open_channel: 'Channel change',
  contact_account: 'Account follow-up',
  create_task: 'Task',
  notify: 'Note to the team',
  email: 'Email',
};
/** What Compass does not do, said for the action at hand. */
const NEVER: Record<ActionType, string> = {
  adjust_bar: 'Compass never changes your rates.',
  close_channel: 'Compass never closes or opens a channel.',
  open_channel: 'Compass never closes or opens a channel.',
  contact_account: 'Compass never contacts an account for you.',
  create_task: 'Compass changes nothing in your hotel systems.',
  notify: 'Compass changes nothing in your hotel systems.',
  email: 'Compass changes nothing in your hotel systems.',
};

/** "revenue manager" or "general manager": whose job this kind of action is (the roster's rule). */
export const roleFor = (action: ActionType) => TEAM_ROLE_LABEL[handoverRole(action)].toLowerCase();

const status = (p: Pick<Proposal, 'status' | 'action'>): string =>
  ({
    pending: 'Waiting for your decision',
    approved: `Sent to the ${roleFor(p.action)}`,
    applied: `Sent to the ${roleFor(p.action)}`,
    auto_approved: 'Sent by the agent',
    denied: 'Dismissed',
    suggested: 'Suggestion only',
    undone: 'Taken back',
    superseded: 'Replaced by a newer suggestion',
  })[p.status];
/** What happened after the decision, in a few words. */
const OUTCOME: Record<Proposal['status'], string> = {
  pending: '',
  approved: 'logged',
  applied: 'logged',
  auto_approved: 'low risk · logged',
  denied: 'nothing was sent',
  suggested: 'nothing was sent',
  undone: 'logged',
  superseded: 'nothing was sent',
};

export interface DecisionView {
  /** "Waiting for your decision", "Sent to the revenue manager". */
  status: string;
  /** "logged", "nothing was sent": what the status left behind. Empty while it waits. */
  outcome: string;
  /** "Price change · needs a person". */
  kind: string;
  /** "Suggestion: lower rates on Lisbon’s most overpriced nights". */
  title: string;
  /** One or two plain sentences on why, then what it could be worth. */
  summary: string;
  /** "This goes to your revenue manager as a task. Compass never changes your rates." */
  promise: string;
  /** The button that sends it on: "Send to revenue manager", or the general manager for a task for the house. */
  send: string;
  /** One level down, behind "See the reasoning". */
  reasoning: { today: string; suggested: string; covers: string; why: string };
  /** A sent suggestion can be taken back. */
  canUndo: boolean;
}

/** "about €38k", from the agent's own estimate. */
const about = (eur: number) => {
  const n = Math.abs(eur);
  return `about €${n >= 999_500 ? `${(n / 1e6).toFixed(2)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : Math.round(n)}`;
};

function worth(p: Pick<Proposal, 'impact_eur' | 'rationale' | 'title'>): string {
  if (p.impact_eur === null || p.impact_eur === 0) return '';
  if (p.impact_eur < 0) return `${upperFirst(about(p.impact_eur))} is at risk.`;
  // Money that was there last year, or that a lower price would bring back, is won back; the rest is new.
  const back = /\b(behind|lost|lower|win back|fell|drop|down from|regret)/i.test(`${p.title} ${p.rationale}`);
  return `This could ${back ? 'win back' : 'bring in'} ${about(p.impact_eur)}.`;
}

/**
 * The one or two sentences of the agent's reasoning that the card leads with: its first, and for a price change the
 * one that says where the rate stands against the competition, since that is what the suggestion is about. The rest
 * is one step down.
 */
function lead(why: string, action: ActionType): string {
  const sentences = why.match(/.+?[.!?]+(?=\s|$)|.+$/g)?.map((x) => x.trim()) ?? [why];
  const first = sentences[0] ?? '';
  const rate = action === 'adjust_bar' ? sentences.slice(1).find((x) => /the competition/i.test(x)) : undefined;
  return rate && first.length + rate.length <= 340 ? `${first} ${rate}` : firstSentences(why, 190);
}

/** The state before or after, as a plan reads it: no label in front, a rate as "a night". */
function plan(text: string, action: ActionType, hotels: readonly HotelRef[], today: number): string {
  const plain = plainText(text, hotels, today).replace(/^(?:the\s+)?rates?\s+(?=[€\d])/i, '');
  const nightly = action === 'adjust_bar' ? plain.replace(/^((?:€\s?)?\d[\d,.]*(?:\s*–\s*\d[\d,.]*)?(?:\s?[A-Z]{3})?)(?=,|$)/, '$1 a night') : plain;
  return upperFirst(nightly);
}

export function decisionView(p: Proposal, hotels: readonly HotelRef[], today = BUSINESS_DAY): DecisionView {
  const plain = (text: string) => plainText(text, hotels, today);
  // The target ("to 1.2× the competition") is detail: it lives in the reasoning, one level down.
  const what = plain(p.title).replace(/\s+to\s+(?:about\s+)?\d+(?:\.\d+)?×(?:\s+the competition)?\.?$/i, '').replace(/[.]$/, '');
  const why = plain(p.rationale);
  const sent = p.status === 'approved' || p.status === 'applied' || p.status === 'auto_approved';
  return {
    status: status(p),
    outcome: OUTCOME[p.status],
    kind: `${KIND[p.action] ?? 'Action'} · ${p.risk === 'high' ? 'needs a person' : 'low risk'}`,
    title: `Suggestion: ${lowerFirst(what)}`,
    summary: [lead(why, p.action), worth(p)].filter(Boolean).join(' '),
    promise: `${p.status === 'pending' ? 'This goes' : sent ? 'This went' : 'This would go'} to your ${roleFor(p.action)} as a task. ${NEVER[p.action] ?? NEVER.create_task}`,
    send: `Send to ${roleFor(p.action)}`,
    reasoning: { today: plan(p.change.before, p.action, hotels, today), suggested: plan(p.change.after, p.action, hotels, today), covers: plain(p.change.scope), why },
    canUndo: sent,
  };
}


/* ───────── After the decision: what the toast says, and the message as it was handed over ───────── */

/** What a decision left behind, as the server answers it; an older server answers with the proposal alone. */
export function toReceipt(answer: DecisionReceipt | Proposal, asked: Proposal, approved: boolean): DecisionReceipt {
  if ('proposal' in answer) return answer;
  return { proposal: { ...asked, ...answer }, handedTo: approved ? recipientFor(asked.hotel_code, asked.action) : null, receipt: '' };
}

/** What the handover is about, for "Task created for …". */
const SUBJECT: Partial<Record<ActionType, string>> = {
  adjust_bar: 'the rate change',
  close_channel: 'the channel change',
  open_channel: 'the channel change',
  contact_account: 'the account follow-up',
};

export interface DecisionToast {
  title: string;
  description: string;
}

/** "Sent to Ana Pop, Revenue manager · Arbor Lisbon Chiado" / "Task created for the rate change · logged in the audit trail". */
export function sentToast(outcome: DecisionReceipt, hotelName: string): DecisionToast {
  const to = outcome.handedTo;
  const about = SUBJECT[outcome.proposal.action];
  return {
    title: to ? `Sent to ${to.name}, ${to.roleLabel} · ${to.hotel}` : `Sent to the ${roleFor(outcome.proposal.action)} · ${hotelName}`,
    description: `Task created${about ? ` for ${about}` : ''} · logged in the audit trail`,
  };
}
export const dismissedToast = (hotelName: string): DecisionToast => ({ title: `Dismissed · ${hotelName}`, description: 'Nothing was sent · logged in the audit trail' });
/** After Undo: what was taken back, and what that did. */
export function undoneToast(before: Proposal['status'], to: Handover | null, hotelName: string): DecisionToast {
  if (before === 'denied') return { title: `Back in Decisions waiting · ${hotelName}`, description: 'The dismissal was taken back · logged in the audit trail' };
  return { title: `Taken back · ${hotelName}`, description: `${to ? to.name : 'The person who got it'} has a task to reverse it · logged in the audit trail` };
}

/** The message as it was handed over: what "View message" shows. */
export interface HandoverMessage {
  subject: string;
  /** Null when the roster has no one for that hotel. */
  to: Handover | null;
  /** The role it went to, for when there is no name. */
  role: string;
  hotel: string;
  /** "Sat 21 Nov 2026, 02:45". */
  sent: string;
  /** "rms-mwp…": the task's reference, when the receipt has one. */
  task: string;
  suggestion: string;
  summary: string;
  reasoning: DecisionView['reasoning'];
  /** Where the agent's own working is: its page in Agent Studio. */
  evidenceHref: string;
  workflowId: string;
  /** Said at the foot of the sheet, so nobody takes the demo for more than it is. */
  footnote: string;
}

const SENT: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };

export function handoverMessage(outcome: DecisionReceipt, hotelName: string, hotels: readonly HotelRef[], today = BUSINESS_DAY, timeZone?: string): HandoverMessage {
  const p = outcome.proposal;
  const view = decisionView(p, hotels, today);
  const suggestion = upperFirst(view.title.replace(/^Suggestion:\s*/, ''));
  const at = Date.parse(p.decidedAt ?? p.createdAt);
  const format = new Intl.DateTimeFormat('en-GB', timeZone ? { ...SENT, timeZone } : SENT);
  const never = NEVER[p.action] ?? NEVER.create_task;
  return {
    subject: `Suggestion for ${outcome.handedTo?.hotel ?? hotelName}: ${lowerFirst(suggestion)}`,
    to: outcome.handedTo,
    role: TEAM_ROLE_LABEL[handoverRole(p.action)],
    hotel: outcome.handedTo?.hotel ?? hotelName,
    sent: Number.isNaN(at) ? '' : format.format(at).replace(/^(\w{3}),/, '$1'),
    task: /\b(rms-[\w-]+)/.exec(outcome.receipt)?.[1] ?? '',
    suggestion,
    summary: view.summary,
    reasoning: view.reasoning,
    evidenceHref: `/studio/${encodeURIComponent(p.workflowId)}`,
    workflowId: p.workflowId,
    footnote: `Demo: Compass hands this to your RMS and ${roleFor(p.action)} as a task. ${never} No email is sent, and the people in the demo team are fictional.`,
  };
}
