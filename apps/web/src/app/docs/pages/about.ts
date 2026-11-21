import { Component } from '@angular/core';
import { DOCS_KIT, type DocsCell } from '../docs-kit';

const SHIFTS: readonly (readonly string[])[] = [
  ['From clicking through screens to a conversation', 'Ask: Kassandra', 'Kassandra, in Quick and Thinker modes, typed or spoken'],
  ['From exploring dashboards to the answer coming to you', 'Analyze: Canvas', 'A morning brief as the home screen, and boards you fill from answers'],
  ['From a tool you operate to a partner that works beside you', 'Act: Agent Studio', 'Workflows with approvals, built by talking'],
];

const REAL: readonly DocsCell[] = [
  { title: 'The backend', text: 'One Worker with six Durable Objects, 25 data tools, a cron, and the public MCP server. Every screen in this app talks to it.' },
  { title: 'Kassandra', text: 'Both modes, streaming over a WebSocket, with steps, evidence and the real SQL. Charts, tables and KPIs in answers come from tool rows.' },
  { title: 'The morning brief', text: 'Eight SQL detectors run at 05:00 UTC against the database. The Inbox reads the result live, with the numbers around it (Pulse, the next 14 nights, pickup, revenue on the books, data health) computed in SQL for the hotels in scope.' },
  { title: 'Workflows', text: 'Runs, proposals, decisions (“Send to revenue manager” or “Dismiss”), undo and an audit log. A run really waits for a person, across deploys.' },
  { title: 'The agent builder', text: 'End to end: describe a workflow, watch the chain fill in, edit a node by hand, send a test. The test sends a real email; delivery to an outside address is confirmed.' },
  { title: 'Boards', text: 'Saved on the server. “Add to board” and “Describe a view” store widgets with their rows and evidence.' },
  { title: 'Voice', text: 'Real-time transcription through Soniox with temporary keys, with a browser fallback.' },
  { title: 'Semantic review search', text: 'Review sentences embedded with Workers AI into pgvector, ranked next to the reviews.' },
];

const MOCKED: readonly DocsCell[] = [
  { title: 'All data is fictional', text: 'The hotels, 1.2 million reservations, accounts, reviews and the seven planted stories come from a generator in a repository of its own, `compass-datagen`. The business date is fixed at 20 Nov 2026.' },
  { title: 'Nothing is written to a hotel system', text: 'There is no PMS, RMS or POS integration. A decision sent to the revenue manager is a logged task plus an audit entry; no rate changes and no email is sent. The people it names (the demo team) are fictional.' },
  { title: 'There is no login', text: 'A decision is recorded as made by “Compass user (web)”, not by a person. The flow is real; the control is not.' },
  { title: 'Two boards are computed in the browser', text: 'Portfolio and Dubai Business Bay are drawn from a snapshot extracted from the same database. Saved boards come from the server.' },
  { title: 'A board widget is a copy', text: 'It shows what the answer showed, with its evidence. It does not re-run its query against today’s data.' },
  { title: 'The review corpus is templated', text: '203,791 reviews contain only 51 distinct sentences, so this data does not stress the search.' },
  { title: 'The Inbox has a fallback', text: 'If the brief cannot be loaded, the Inbox shows a saved copy of the 20 Nov brief instead of an empty page.' },
];

const CUT: readonly string[] = [
  'Kassandra’s Strategic tier.',
  'Workflow branches, and builder actions other than email.',
  'A backtest: “this would have fired N times in the last 30 days”.',
  'Board widgets that refresh against today’s data.',
  'PDF export of the brief or a board.',
];

const NEXT: readonly string[] = [
  '**The backtest.** Before you switch a workflow on, see when it would have fired last month and what it would have proposed.',
  '**Live board widgets.** A pinned chart re-runs its query, and its spec can be edited by hand: one spec for people and AI, for charts as it already is for workflows.',
  '**Snapshots of history.** So “what did we believe last Tuesday” has an answer.',
  '**Login and roles.** So an approval becomes a real control, and the hotel scope a real permission.',
];

const HOW: readonly DocsCell[] = [
  { title: 'Plans, contracts, tests', text: 'Built with AI coding agents, inside written plans and shared type contracts. Each area was built on its own branch against those contracts, reviewed, then integrated.' },
  { title: 'Checked like a product', text: 'The web app has more than 900 unit tests. Views are checked with axe on desktop and phone, and these docs pages in three theme and mode combinations. The planted stories run as evals against production.' },
  { title: 'One person answers for it', text: 'The plans, the product decisions and the integration are mine, and I answer for the result.' },
];

/** /docs/about: what was built, what is real, what is mocked or cut, and what comes next. */
@Component({
  selector: 'docs-about',
  imports: [...DOCS_KIT],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-section-lg">
      <docs-head
        eyebrow="Docs · About this build"
        title="A hotel analytics app that tells you first"
        lede="Compass is a concept by Razvan Frandes, built in November 2026 for Juyo’s design lead assignment. It is not a Juyo product. You open it and it tells you what changed overnight and how much money is at stake. You can ask Kassandra why, and every answer shows where its numbers came from. You can then describe a workflow in one sentence."
      />

      <docs-section heading="The idea" anchor="idea" note="Juyo’s introduction describes three shifts. They became the product spec. Most time went into Act, because that is where a take-home can show an opinion of its own.">
        <docs-table caption="Juyo’s three shifts and what Compass does for each" [head]="['Juyo’s shift', 'Juyo’s product', 'In Compass']" [rows]="shifts" [minWidth]="640" />
      </docs-section>

      <docs-section heading="What is real" anchor="real" note="Everything here runs against the live backend at \`juyo.razvanfrandes.com\`.">
        <docs-cells [items]="real" [min]="300" />
      </docs-section>

      <docs-section heading="What is mocked or partial" anchor="mocked" note="Said plainly, so nothing on screen is taken for more than it is.">
        <docs-cells [items]="mocked" [min]="300" />
      </docs-section>

      <div class="grid gap-x-10 gap-y-12 lg:grid-cols-2">
        <docs-section heading="Cut for time" anchor="cut">
          <ul class="docs-panel flex flex-col p-1.5">
            @for (c of cut; track c) {
              <li class="border-border px-3.5 py-2.5 text-[14px] not-last:border-b">{{ c }}</li>
            }
          </ul>
        </docs-section>

        <docs-section heading="Next, in order" anchor="next">
          <ol class="docs-steps">
            @for (n of next; track n) {
              <li><span class="docs-md text-muted-foreground" [innerHTML]="n | md"></span></li>
            }
          </ol>
        </docs-section>
      </div>

      <docs-section heading="How it was built" anchor="how">
        <docs-cells [items]="how" [min]="280" />
      </docs-section>

      <docs-section heading="Where this started" anchor="started">
        <p class="docs-md text-muted-foreground max-w-[76ch] text-[14px]/relaxed" [innerHTML]="started | md"></p>
      </docs-section>
    </div>
  `,
})
export class DocsAbout {
  protected readonly shifts = SHIFTS;
  protected readonly real = REAL;
  protected readonly mocked = MOCKED;
  protected readonly cut = CUT;
  protected readonly next = NEXT;
  protected readonly how = HOW;
  protected readonly started =
    'An earlier Compass was built before the interview: a dashboard with a docked assistant for a three-hotel group, at [compass.razvanfrandes.com](https://compass.razvanfrandes.com). This one is a new codebase. Numbers computed in SQL and read-only model SQL come from the prototype. The brief, the MCP server, the agents, the workflows, the builder and the design system are new.';
}
