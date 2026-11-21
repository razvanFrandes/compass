import { Component } from '@angular/core';
import { DOCS_KIT, type DocsCell } from '../docs-kit';

const ANSWER = [
  { title: 'Question', text: 'Typed or spoken, with a mode and the hotel scope. One Durable Object holds the conversation.' },
  { title: 'Plan', text: 'The model picks data tools. It never writes a number of its own.' },
  { title: 'Tool calls', text: 'Each tool runs fixed SQL as a read-only role and returns rows with their evidence.' },
  { title: 'Answer', text: 'The model explains the rows in plain words. The steps stay collapsed above it.' },
  { title: 'Widgets', text: '`show_widget` points at a tool result. The server copies the rows into a chart, table or KPI.' },
  { title: 'Evidence', text: '“Behind the numbers” opens the sources, definitions, period and the SQL.' },
] as const;

const MODES: readonly (readonly string[])[] = [
  ['Model', 'Claude Haiku 5.5', 'Claude Sonnet 5.5'],
  ['Tools', '11 governed-metric tools, plus `show_widget`', 'All 25 data tools, `show_widget` and `draft_workflow`'],
  ['Turn limit', '5', '12'],
  ['Answer', 'At most three sentences from one or two metrics', 'A diagnosis that crosses sources'],
  ['Good for', '“What is RevPAR in Lisbon this month?”', '“Why is Lisbon pacing behind last year?”'],
];

const PHASES: readonly DocsCell[] = [
  { k: '1 · Chosen', title: 'A card with a skeleton', text: 'The call has started and its arguments are not known yet, so the card shows skeleton lines and a neutral chart shape.' },
  { k: '2 · Described', title: 'The real title, the kind’s skeleton', text: 'The arguments are committed. The title and subtitle are real, and the chart area is the skeleton of that widget kind at its final size.' },
  { k: '3 · Ready', title: 'The chart, in the same box', text: 'The rows arrive. The chart takes the skeleton’s place inside the same element, so nothing below it moves.' },
];

const TOOLS: readonly DocsCell[] = [
  { k: 'Reference', title: 'What exists', text: '`list_hotels` `list_metrics` `get_schema` `get_data_health`' },
  { k: 'Commercial', title: 'Demand, rate and mix', text: '`get_metric` `get_kpis` `get_pace` `get_pickup` `get_rate_position` `get_channel_mix` `get_mix` `get_account_production` `get_inventory` `get_web_funnel`' },
  { k: 'Finance', title: 'P&L and forecast', text: '`get_pnl` `get_forecast` `get_lost_business`' },
  { k: 'Operations and guests', title: 'F&B, M&E, labour, reviews', text: '`get_fnb` `get_labor` `get_meetings_events` `get_review_scores` `find_reviews` `search_reviews`' },
  { k: 'Brief and escape hatch', title: 'The rest', text: '`get_brief` returns the morning brief. `run_readonly_query` runs one guarded `SELECT` when no tool fits.' },
];

const AGENTS: readonly (readonly string[])[] = [
  ['**Kassandra**', 'One per conversation', 'Haiku 5.5 or Sonnet 5.5', 'The data tools, `show_widget`, `draft_workflow`', 'The transcript, the mode and the hotel scope'],
  ['**WorkflowBuilder**', 'One per draft', 'Sonnet 5.5, up to 16 turns', 'The data tools and 7 draft tools: `set_trigger` `set_hotels` `add_check` `remove_check` `set_goal` `set_action` `set_email`', 'The conversation, the draft and the saved workflow’s id'],
  ['**WorkflowAgents**', 'One for the group; each run is a session', 'Sonnet 5.5, up to 12 turns', 'The data tools, `propose_action`, `apply_action`, `send_email`', 'Every run, proposal and audit entry, and a run parked on an approval'],
];

const AUTONOMY: readonly DocsCell[] = [
  { k: 'suggest', title: 'Suggest only', text: 'The agent records a proposal and stops. Nothing waits for anyone.' },
  { k: 'approve', title: 'Wait for approval', text: 'The run parks on a durable signal until a person sends the suggestion on or dismisses it. It holds no compute while it waits, and the wait survives a deploy.' },
  { k: 'auto_low_risk', title: 'Act alone on low risk', text: 'Tasks and notifications are applied without asking. Prices and channels still wait for a person.' },
];

const PROPOSAL = [
  { title: 'pending', text: 'The agent proposed a change: before, after, scope, the reason and the EUR impact.' },
  { title: 'approved', text: 'A person chose “Send to revenue manager”. The server records the handover at once, with the name of the person who gets the task, and the decision wakes the parked run.' },
  { title: 'applied', text: 'The action is an RMS task for the revenue manager (or the general manager, for a task for the house) and an audit entry. No rate or channel changes.' },
  { title: 'undone', text: 'Undo, from the toast or the card, gives the same person a task to reverse it. A dismissal can be taken back too. The audit log keeps both.' },
] as const;

const DETECTORS: readonly (readonly string[])[] = [
  ['`data_stale`', 'A source system has stopped syncing', 'First in the brief: every number below depends on it'],
  ['`pace_behind`', 'Rooms on the books are more than 10% behind last year for the next 45 nights', 'Room revenue at risk'],
  ['`underpriced_demand`', 'BAR is under 0.85× the comp-set median on nights that are already busy', 'Revenue left on the table'],
  ['`account_loss`', 'A corporate account’s room nights fell sharply against the six months before', 'Room revenue lost'],
  ['`web_conversion_drop`', 'A device’s web conversion fell against the 60 days before', 'Lost direct bookings'],
  ['`staffing_gap`', 'A department worked far fewer hours than its workload needed', 'F&B revenue against the month before'],
  ['`rooms_out_of_order`', 'Rooms that cannot be sold in the next 30 days', 'Room revenue at last month’s occupancy and ADR'],
  ['`gop_miss`', 'The last closed month missed its GOP budget', 'GOP short of budget'],
];

const VOICE: readonly DocsCell[] = [
  { title: 'A temporary key per dictation', text: '`POST /api/voice/token` mints a Soniox key that works once, must connect within 120 s and carries at most 180 s of audio. The permanent key never leaves the Worker.' },
  { title: 'Audio goes straight to Soniox', text: 'An AudioWorklet turns the microphone into 16 kHz mono PCM, and the browser streams it over Soniox’s WebSocket. The Worker never sees the audio.' },
  { title: 'Voice never sends on its own', text: 'Words appear as they are spoken. The person taps send, or stop, so a misheard question is never asked.' },
  { title: 'Fallbacks', text: 'If the token call or the stream fails before a word is heard, the browser’s own recognition takes over. A blocked microphone says so.' },
];

/** /docs/kassandra: how a question is answered, the agents that run on Pi Durable, autonomy and the brief. */
@Component({
  selector: 'docs-kassandra',
  imports: [...DOCS_KIT],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-section-lg">
      <docs-head
        eyebrow="Docs · Kassandra & agents"
        title="The model plans and explains. SQL computes."
        lede="Kassandra is the analyst you talk to. Two more agents work beside her: one builds a workflow while you describe it, and one runs workflows and waits for your approval. All three are Durable Objects running an agent loop on Pi Durable, and all three reach the data through the same 25 tools."
      />

      <docs-section heading="How an answer is made" anchor="answer" note="The same six parts for every question. The model takes part in three of them: the plan, the answer text and the choice of widget.">
        <ol class="docs-flow">
          @for (s of answer; track s.title) {
            <li>
              <strong class="text-[14px] font-semibold">{{ s.title }}</strong>
              <p class="docs-md text-muted-foreground mt-1 text-[13px]/snug" [innerHTML]="s.text | md"></p>
            </li>
          }
        </ol>
      </docs-section>

      <docs-section heading="Two modes" anchor="modes" note="They follow Juyo’s own tiers. A mode is a per-question change of model, tools, turn limit and instructions.">
        <docs-table caption="Quick and Thinker modes compared" [head]="['Setting', 'Quick', 'Thinker']" [rows]="modes" />
      </docs-section>

      <docs-section heading="A widget arrives in three phases" anchor="widgets" note="Generative UI here means: the model chooses a component from the catalogue and names the data. The card it lands in never changes size. A skeleton stays at least 300 ms, so a fast result does not flicker.">
        <docs-cells [items]="phases" [min]="260" />
      </docs-section>

      <docs-section heading="The 25 data tools" anchor="tools" note="One catalog. Kassandra, the workflow agents and outside MCP clients call the same tools through the same guard, and every result carries its evidence.">
        <docs-cells [items]="tools" [min]="320" />
      </docs-section>

      <docs-section heading="Three agents on Pi Durable" anchor="agents" note="Each is a Durable Object with SQLite storage. A conversation, a draft or a run survives a deploy or an eviction.">
        <docs-table caption="The three agents" [head]="['Agent', 'Objects', 'Model', 'Tools', 'What it keeps']" [rows]="agents" [minWidth]="860" />
      </docs-section>

      <docs-section heading="Autonomy is earned in steps" anchor="autonomy" note="Each workflow has a level. Raising it asks for confirmation; lowering it is immediate and offers Undo. \`adjust_bar\`, \`close_channel\` and \`open_channel\` are always high risk in code, whatever the model says.">
        <docs-cells [items]="autonomy" [min]="260" />
      </docs-section>

      <docs-section heading="The life of a proposal" anchor="proposal" note="Compass never writes to a hotel system. “Applied” means a task for a person and a line in the audit log. The answer to a decision is \`{ proposal, handedTo, receipt }\`; the recipient comes from \`DEMO_TEAM\`, a fictional roster, and no email is sent. A proposal can also end as \`denied\` (“Dismiss”), \`suggested\`, \`auto_approved\` or \`superseded\`, when the agent replaces it with an amended one.">
        <ol class="docs-flow">
          @for (s of proposal; track s.title) {
            <li>
              <code class="docs-code">{{ s.title }}</code>
              <p class="text-muted-foreground mt-1.5 text-[13px]/snug">{{ s.text }}</p>
            </li>
          }
        </ol>
      </docs-section>

      <docs-section heading="The morning brief: detect with rules, explain with a model" anchor="brief" note="Eight fixed SQL detectors run at 05:00 UTC, so the brief is the same every time you load it. Haiku writes one summary sentence per item from that item’s facts; the summary carries an AI label. The largest in money comes first, and a broken data feed leads. The numbers around the findings (Pulse, the next 14 nights, pickup, revenue on the books, data health) come from \`GET /api/brief/overview\`, computed in SQL for the hotels in scope.">
        <docs-table caption="The eight brief detectors" [head]="['Detector', 'Fires when', 'Impact is']" [rows]="detectors" [minWidth]="640" />
      </docs-section>

      <docs-section heading="Voice" anchor="voice">
        <docs-cells [items]="voice" [min]="300" />
      </docs-section>
    </div>
  `,
})
export class DocsKassandra {
  protected readonly answer = ANSWER;
  protected readonly modes = MODES;
  protected readonly phases = PHASES;
  protected readonly tools = TOOLS;
  protected readonly agents = AGENTS;
  protected readonly autonomy = AUTONOMY;
  protected readonly proposal = PROPOSAL;
  protected readonly detectors = DETECTORS;
  protected readonly voice = VOICE;
}
