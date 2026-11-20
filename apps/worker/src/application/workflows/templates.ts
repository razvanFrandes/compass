import type { Workflow, WorkflowSpecInput } from '@compass/contracts';
import { WorkflowSpec } from '@compass/contracts';

/** Ready-made workflows, one per kind of morning-brief finding. Each starts enabled, with a person approving. */
const TEMPLATES: (WorkflowSpecInput & { id: string })[] = [
  {
    id: 'tpl-event-pricing',
    name: 'Event pricing watch',
    description: 'Catches high-demand nights sold below the market, such as a city event missing from the pricing calendar.',
    hotels: ['ALL'],
    trigger: { kind: 'brief', finding: 'underpriced_demand' },
    goal:
      'When a hotel sells high-demand nights below its comp set median, check the rate position and what is on the books ' +
      'for those nights, and propose a BAR change that brings the unsold rooms closer to the comp set median.',
    checks: ['get_rate_position', 'get_pace', 'get_pickup'],
    action: { type: 'adjust_bar', guidance: 'Propose a rate range per night, never above the comp set maximum. Rooms already sold keep their rate.' },
    autonomy: 'approve',
  },
  {
    id: 'tpl-pace-guard',
    name: 'Pace guard',
    description: 'Watches the next 45 nights and acts when a hotel falls well behind last year.',
    hotels: ['ALL'],
    trigger: { kind: 'brief', finding: 'pace_behind' },
    goal:
      'When a hotel is more than 10% behind last year on the books for the next 45 nights, find out why (pickup, rate ' +
      'position against the comp set) and propose the one change most likely to recover room nights.',
    checks: ['get_pace', 'get_pickup', 'get_rate_position'],
    action: { type: 'adjust_bar', guidance: 'If the hotel is priced well above its comp set, propose a lower BAR for the weakest nights.' },
    autonomy: 'approve',
  },
  {
    id: 'tpl-key-accounts',
    name: 'Key account watch',
    description: 'Flags corporate and wholesale accounts that stop producing, so sales can call them.',
    hotels: ['ALL'],
    trigger: { kind: 'brief', finding: 'account_loss' },
    goal:
      'When a corporate or wholesale account produces less than half its earlier room nights, size the loss and what ' +
      'replaced it (business mix), and propose that sales contacts the account.',
    checks: ['get_account_production', 'get_mix'],
    action: { type: 'contact_account', guidance: 'A task for the sales team with the account, the loss in EUR and a talking point.' },
    autonomy: 'auto_low_risk',
  },
  {
    id: 'tpl-booking-engine',
    name: 'Booking engine monitor',
    description: 'Spots a broken booking journey on the hotel website before it shows up in OTA commissions.',
    hotels: ['ALL'],
    trigger: { kind: 'brief', finding: 'web_conversion_drop' },
    goal:
      'When website conversion drops on one device, check the funnel (checkout completion) and where the bookings went ' +
      '(mix by booking date), and propose a task for the e-commerce team with the evidence.',
    checks: ['get_web_funnel', 'get_mix'],
    action: { type: 'create_task', guidance: 'A task for the e-commerce team: device, step of the funnel, size of the loss.' },
    autonomy: 'auto_low_risk',
  },
  {
    id: 'tpl-data-feeds',
    name: 'Data feed monitor',
    description: 'Tells the team when a source system stops syncing, so nobody acts on incomplete numbers.',
    hotels: ['ALL'],
    trigger: { kind: 'brief', finding: 'data_stale' },
    goal: 'When a source system has not synced, say which figures are affected and notify the hotel team and IT.',
    checks: ['get_data_health'],
    action: { type: 'notify', guidance: 'One notification per stale feed: system, vendor, since when, which reports are incomplete.' },
    autonomy: 'auto_low_risk',
  },
];

export function templateWorkflows(createdAt: string): Workflow[] {
  return TEMPLATES.map(({ id, ...spec }) => ({ ...WorkflowSpec.parse(spec), id, createdAt, createdBy: 'template', lastRun: null }));
}

/** The run brief a workflow agent starts from: its spec as instructions. */
export function workflowInstructions(workflow: Workflow): string {
  const hotels = workflow.hotels.includes('ALL') ? 'all 20 hotels' : workflow.hotels.join(', ');
  return [
    `You are running the Compass workflow "${workflow.name}" unattended, for ${hotels}.`,
    `Goal: ${workflow.goal}`,
    workflow.checks.length ? `Check first with: ${workflow.checks.join(', ')}. Start from get_brief when the trigger is a brief finding.` : '',
    `You may propose: ${workflow.action.type}. ${workflow.action.guidance}`,
    `Approver: the ${workflow.approver === 'gm' ? 'general manager' : 'revenue manager'}. Autonomy: ${workflow.autonomy}.`,
    'Steps: 1) check the data with tools, comparing windows of equal length; 2) if an action is warranted, call ' +
      'propose_action once per hotel, quoting numbers from tool results; 3) when a proposal is approved, call apply_action; ' +
      '4) end with two or three sentences on what you found and what was done. If nothing needs action, say so and propose nothing.',
  ]
    .filter(Boolean)
    .join('\n');
}
