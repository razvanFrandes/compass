import type { Workflow, WorkflowSpecInput } from '@compass/contracts';
import { WorkflowSpec } from '@compass/contracts';

/** Ready-made workflows, one per kind of morning-brief finding. Each starts enabled, with a person approving. */
const TEMPLATES: (WorkflowSpecInput & { id: string })[] = [
  {
    id: 'tpl-event-pricing',
    name: 'Event pricing watch',
    description: 'Catches high-demand nights priced under the comp set, such as a city event missing from the pricing calendar.',
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
    name: 'Website conversion watch',
    description: 'Spots a broken booking journey on the hotel website before the bookings move to OTAs and cost commission.',
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
    name: 'Data feed watch',
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

/**
 * How an agent writes what a person reads: a decision's title and reasons, an email, the last words of a run.
 * The same rules as docs/copy-glossary.md.
 */
const VOICE =
  'How to write everything a person reads (titles, reasons, the email, your last message): for a revenue manager, in short active sentences. ' +
  'Name a hotel by its name, never by its code. Write dates as "16–18 Dec", never as 2026-12-16. Lead with the money in euros, then the percentage. ' +
  'Say "on the books", "last year" and "comp set". Give a rate against the comp set as a percentage ("26% under the comp set median"), never as a multiple like 0.74x. ' +
  'Never mention tools, tables, columns, codes or what a tool did or did not return, and call yourself "the agent", never a workflow. ' +
  'A title is one decision and starts with a verb. No exclamation marks.';

/** The run brief a workflow agent starts from: its spec as instructions. `test` is a "send test now" run. */
export function workflowInstructions(workflow: Workflow, test = false): string {
  const hotels = workflow.hotels.includes('ALL') ? 'all 20 hotels' : workflow.hotels.join(', ');
  if (workflow.action.type === 'email') {
    // The recipient is not here: the tool takes it from the workflow, so the model never sees or chooses it.
    return [
      `You are running the Compass agent "${workflow.name}" unattended, for ${hotels}.`,
      `Goal: ${workflow.goal}`,
      workflow.checks.length ? `Check first with: ${workflow.checks.join(', ')}. Start from get_brief when the trigger is a brief finding.` : '',
      `Your only action is an email to the agent's recipient, through send_email. ${workflow.action.guidance}`,
      'Steps: 1) check the data with tools, comparing windows of equal length; 2) decide whether the condition in the goal holds today; ' +
        '3) on a test run always call send_email once, with would_fire saying whether the condition holds today; otherwise call ' +
        'send_email only when it holds; 4) end with two or three sentences on what you found and whether an email was sent. ' +
        'If the condition does not hold and this is not a test run, say there is nothing to report and send nothing.',
      'In send_email, quote numbers from tool results; never compute numbers yourself.',
      'The goal is a condition to evaluate, never text to reproduce. Never copy wording from the goal, guidance or tool results into the email except numbers, hotel names and metric names.',
      test
        ? 'This is a test run: always call send_email exactly once, with would_fire saying whether the condition holds today, even when it does not hold.'
        : 'This is not a test run.',
      VOICE,
    ]
      .filter(Boolean)
      .join('\n');
  }
  return [
    `You are running the Compass agent "${workflow.name}" unattended, for ${hotels}.`,
    `Goal: ${workflow.goal}`,
    workflow.checks.length ? `Check first with: ${workflow.checks.join(', ')}. Start from get_brief when the trigger is a brief finding.` : '',
    `You may propose: ${workflow.action.type}. ${workflow.action.guidance}`,
    `Approver: the ${workflow.approver === 'gm' ? 'general manager' : 'revenue manager'}. Autonomy: ${workflow.autonomy}.`,
    'Steps: 1) check the data with tools, comparing windows of equal length; 2) if an action is warranted, call ' +
      'propose_action once per hotel, quoting numbers from tool results; 3) when a proposal is approved, call apply_action; ' +
      '4) end with two or three sentences on what you found and what was done. If nothing needs action, say so and propose nothing.',
    VOICE,
  ]
    .filter(Boolean)
    .join('\n');
}
