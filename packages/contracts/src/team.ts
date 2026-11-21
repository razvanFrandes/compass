import type { ActionType } from './workflows.ts';

/**
 * Who a decision is handed to. Compass is read-only: sending a suggestion on gives a person a task (and writes the
 * audit log); it never changes a rate, a channel or a booking itself. So every handover has a name on it.
 *
 * The roster is fictional, like the Halcyon group: invented people, one revenue manager and one general manager per
 * hotel, with addresses on example.com (reserved by RFC 2606, so nothing can ever be delivered there). No email is
 * sent for a decision; the address is shown so the handover reads like the real thing would.
 */

export type TeamRole = 'revenue_manager' | 'general_manager';
export const TEAM_ROLE_LABEL: Record<TeamRole, string> = { revenue_manager: 'Revenue manager', general_manager: 'General manager' };

export interface TeamMember {
  name: string;
  email: string;
}

export interface HotelTeam {
  /** The hotel's name, so a handover can say it without a second lookup. */
  hotel: string;
  revenueManager: TeamMember;
  gm: TeamMember;
}

const person = (name: string): TeamMember => ({
  name,
  email: `${name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '.')
    .replace(/^\.|\.$/g, '')}@halcyon.example.com`,
});
const team = (hotel: string, revenueManager: string, gm: string): HotelTeam => ({ hotel, revenueManager: person(revenueManager), gm: person(gm) });

/** The demo team, by hotel code. Fictional. */
export const DEMO_TEAM: Readonly<Record<string, HotelTeam>> = {
  TYO: team('Arbor Tokyo Ginza', 'Aiko Tanaka', 'Kenji Mori'),
  SIN: team('Kestrel Singapore Marina', 'Wei Ling Tan', 'Daniel Lim'),
  DPS: team('Lumen Bali Uluwatu', 'Putu Ayu', 'Made Surya'),
  AMS: team('Arbor Amsterdam Centraal', 'Sanne de Wit', 'Pieter Bakker'),
  LIS: team('Arbor Lisbon Chiado', 'Ana Pop', 'Miguel Faria'),
  PAR: team('Arbor Paris Opera', 'Camille Laurent', 'Antoine Mercier'),
  LON1: team('Kestrel London Mayfair', 'Priya Shah', 'Edward Hale'),
  VIE: team('Kestrel Vienna Ring', 'Lena Hofer', 'Markus Steiner'),
  BCN: team('Lumen Barcelona Mar', 'Marta Soler', 'Jordi Vidal'),
  BER: team('Tessera Berlin Mitte', 'Jonas Keller', 'Katrin Vogel'),
  LON2: team("Tessera London King's Cross", 'Oliver Grant', 'Hannah Reid'),
  DOH: team('Arbor Doha West Bay', 'Noor Al-Sayed', 'Khalid Rahman'),
  DXB1: team('Kestrel Dubai Marina', 'Layla Haddad', 'Omar Nasser'),
  DXB2: team('Tessera Dubai Business Bay', 'Rania Aziz', 'Samir Khoury'),
  NYC: team('Arbor New York Midtown', 'Maya Brooks', 'James Carter'),
  YYZ: team('Arbor Toronto Financial District', 'Chloe Martin', 'Liam Fraser'),
  MIA: team('Lumen Miami Beach', 'Sofia Reyes', 'Marcus Hill'),
  CHI: team('Tessera Chicago Loop', 'Emily Novak', 'Andre Walker'),
  GRU: team('Arbor Sao Paulo Faria Lima', 'Beatriz Rocha', 'Rafael Lima'),
  EZE: team('Tessera Buenos Aires Palermo', 'Lucia Ferrer', 'Tomas Ibarra'),
};

/**
 * Who gets which kind of action: rates, channels and accounts are the revenue manager's; a task for the house or a
 * note to the team (a kitchen short of hours, rooms out of order, a feed that is behind) is the general manager's.
 */
export function handoverRole(action: ActionType): TeamRole {
  return action === 'create_task' || action === 'notify' ? 'general_manager' : 'revenue_manager';
}

/** The person a decision was handed to, as the audit log and the app show them. */
export interface Handover {
  name: string;
  email: string;
  role: TeamRole;
  /** "Revenue manager", "General manager". */
  roleLabel: string;
  /** The hotel's name. */
  hotel: string;
  hotel_code: string;
}

/** The person at that hotel who gets that kind of action, or null for a hotel the roster does not know. */
export function recipientFor(hotelCode: string, action: ActionType): Handover | null {
  const code = hotelCode.trim().toUpperCase();
  const entry = DEMO_TEAM[code];
  if (!entry) return null;
  const role = handoverRole(action);
  const member = role === 'general_manager' ? entry.gm : entry.revenueManager;
  return { name: member.name, email: member.email, role, roleLabel: TEAM_ROLE_LABEL[role], hotel: entry.hotel, hotel_code: code };
}
