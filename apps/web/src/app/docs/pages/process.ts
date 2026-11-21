import { Component, inject } from '@angular/core';
import { DOCS_KIT, type DocsCell } from '../docs-kit';
import { type DocsPageId, docsPath } from '../docs-pages';
import { DocsRouter } from '../docs-router';
import { JUYO_COLOUR_SHIFTS, PROCESS_VISUALS, type TimelinePhase } from './process-visuals';

const SECTIONS = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'juyo', label: 'Juyo’s product' },
  { id: 'research', label: 'Research' },
  { id: 'design', label: 'Design system' },
  { id: 'model', label: 'Interaction model' },
  { id: 'claude', label: 'Working with Claude' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'changed', label: 'What changed' },
  { id: 'next', label: 'Next' },
] as const;

const FACTS = [
  { value: '24 h', label: 'the assignment window', note: 'first commit on 20 Nov at 15:42' },
  { value: '6', label: 'research rounds', note: 'each one before the decision it informed' },
  { value: '3', label: 'waves of parallel branches', note: 'built by coding agents against shared contracts' },
  { value: '7 of 7', label: 'planted stories found', note: 'the evals, run against production' },
] as const;

const TIMELINE: readonly TimelinePhase[] = [
  {
    when: 'Before the interview',
    title: 'A prototype, and what it taught me',
    text: 'The first Compass was a dashboard for a three-hotel group with an assistant docked beside it. Two ideas from it survived: numbers come from SQL, and SQL written by a model runs read-only. It also showed me what I had built, which was a chat panel beside a dashboard.',
    evidence: ['Angular, Hono, PGlite, Zard UI', 'kept: SQL computes, read-only SQL', 'dropped: the UI layer and the docked assistant'],
  },
  {
    when: 'Before any code',
    title: 'Understanding Juyo’s product first',
    text: 'I read everything Juyo publishes: the pricing page, the product pages, the assignment brief and the blog. I wanted to know what they sell, what they have announced and not shipped, and what they believe. The scope of Compass comes from that reading.',
    evidence: ['pricing page', 'product pages', 'the assignment brief', 'four blog posts'],
  },
  {
    when: '20 Nov, 15:42',
    title: 'A clean restart',
    text: 'A new repository. The first commit holds the context and the decisions, and no code. The plan has eight phases, and one rule: each task is small, ends in something that can be checked, and gets a commit.',
    evidence: ['docs/decisions.md', 'docs/plan.md'],
  },
  {
    when: 'From the first commit',
    title: 'Accessibility as a rule, not a pass at the end',
    text: 'The project rules say every view must pass axe and meet WCAG AA. Because the rule is in the repository, every agent that wrote code had it as an acceptance check. It shaped the palette, the charts and the components from the start.',
    evidence: ['WCAG 2.2 AA', '0 axe violations to merge', '▲ ▼ as well as colour'],
  },
  {
    when: '20 Nov, 18:08 to 18:49',
    title: 'The data, then the one door to it',
    text: 'The data layer came first, then the public read-only MCP server two minutes later. Kassandra went on top of the same tools. Forty minutes after the data layer, the seven story evals passed on production.',
    evidence: ['18:10 MCP server', '18:23 deployed over Hyperdrive', '18:33 Kassandra on Pi Durable', '18:49 evals 7 of 7'],
  },
  {
    when: '20 Nov, 19:01 to 21:39',
    title: 'The brief, the agents and a security review',
    text: 'The morning brief, then agents with approvals that survive a deploy, then the builder you talk to. Three agent branches ran beside this: finance tools, review search and security. The security review found ways around the SQL guard, and they were closed the same hour.',
    evidence: ['19:01 morning brief', '19:25 durable approvals', '19:35 SQL guard bypasses closed', '20:44 agent builder'],
  },
  {
    when: 'Before each UI round',
    title: 'Research first',
    text: 'Six rounds of research, each tied to a decision. The rule I set for the AI patterns: if a behaviour is not in the research with a source, it does not ship.',
    evidence: ['82 screens studied', 'Tableau Pulse, Power BI, Cloudscape, Carbon, Primer'],
  },
  {
    when: '20 Nov, 21:59 to 22:28',
    title: 'The interface meets the live API',
    text: 'The second version of the interface came in, with the filter bar and the chart catalogue. Half an hour later the Inbox, the Thread and the agents were reading the live backend.',
  },
  {
    when: '20 Nov, 22:30 to 23:22',
    title: 'An audit of my own work',
    text: 'I reviewed the live app with screenshots and had it audited end to end. The list was long: 5 blockers, 35 important issues, 45 polish items and 14 product gaps. That list became the plan for Round 2, with one goal: nothing on screen is fake.',
    evidence: ['docs/plan-round2.md', 'docs/round2-contracts.md'],
  },
  {
    when: '21 Nov, 00:08 to 00:26',
    title: 'Round 2: seven branches in eighteen minutes',
    text: 'One agent wrote the shared contracts first. Then backend and frontend branches were built in parallel, by area, with no shared files, and merged one after another: hotel scope and voice, charts in answers and saved boards, the evidence panel, the orb, the chart catalogue, one Kassandra everywhere.',
    evidence: ['2 backend branches', '5 frontend branches', 'tests first', 'a reviewer per area'],
  },
  {
    when: '21 Nov, 00:37 to 01:03',
    title: 'The concept theme',
    text: 'Light and Dark are inspired by Juyo’s mobile app colours, then adjusted for WCAG AA. The third theme is my own reading of the brand: one system for their light site and their dark product, built on a token architecture the other two can adopt.',
    evidence: ['“Ledger”', 'Archivo', '54 colour pairs checked'],
  },
  {
    when: '21 Nov, 01:29 onwards',
    title: 'Round 3: words, layout and these docs',
    text: 'A copy pass over about 570 strings against a glossary, layout and density research, a collapsible sidebar, and this documentation hub.',
    evidence: ['docs/copy-glossary.md', 'docs/research/layout'],
  },
];

/* ───────────── Understanding Juyo's product ───────────── */

const SOURCES: readonly DocsCell[] = [
  { k: 'Pricing page', title: 'What they charge for', text: 'HotelGPT at €0.05 per Kassandra token, pay as you go. Pro from €200 per hotel per month. Enterprise. Under Pro and Enterprise, “Agents / Workflow Automations” are marked **Coming Soon**.' },
  { k: 'Product pages', title: 'What they sell', text: 'Ask → Analyze → Act. Kassandra in three tiers: Quick, Thinker, Strategic. Canvas, Agent Studio, Pulse, Exploration and Deep Dive, Table Designer, Iris charts, Forecast Builder, Briefings, Data Drop. Four modules: Commercial, Finance, F&B, M&E.' },
  { k: 'The assignment', title: 'Where they are going', text: 'Three shifts: from clicking through screens to a conversation, from exploring dashboards to the answer coming to you, from a tool you operate to a partner that works beside you.' },
  { k: 'The blog', title: 'What they believe', text: 'That the definitions are the product, not the code. That accuracy is what trust is paid in. That money matters more than percentages. That hotel systems overwrite history, so you need snapshots.' },
];

const BUILT = '● Built';
const PARTIAL = '◐ Partial';
const NOT_BUILT = '○ Not built';

export const PRODUCT_MAP: readonly (readonly string[])[] = [
  ['Kassandra Quick and Thinker', 'Kassandra’s two modes: Quick on a small set of governed metrics, Thinker across every source.', BUILT],
  ['Kassandra Strategic', 'A council of agents that argues every angle. I planned a light version and cut it.', NOT_BUILT],
  ['HotelGPT, one hotel', 'The hotel scope: pick one hotel, or any set, and every tool is cut down to it. Tokens and cost show under each answer. There is no billing.', BUILT],
  ['Canvas', 'Boards, “Describe a view”, and charts from an answer added to a board. A saved chart is a copy: it does not refresh yet.', BUILT],
  ['Agent Studio (Coming Soon at Juyo)', 'Agent Studio: agents built by talking, approvals, an audit log, email. No branches, and email is the only action the builder sets up.', BUILT],
  ['Pulse', 'The KPI rail on the Inbox: four figures for the next 30 nights, each one a question you can ask.', BUILT],
  ['Briefings', 'The morning brief, ranked by money. Export to PDF, PowerPoint or Word is not built.', PARTIAL],
  ['Exploration and Deep Dive', 'A click on a chart mark asks Kassandra about that hotel, channel or segment. There is no free slice-and-dice explorer.', PARTIAL],
  ['Table Designer and Iris charts', 'Kassandra picks from a catalogue of 21 chart kinds, and every chart can be viewed as a table. There is no designer to build one by hand.', PARTIAL],
  ['Forecast Builder', 'The data has a forecast range, P10 to P90, and a tool reads it. Scenarios and what-if are not built.', PARTIAL],
  ['Driver decomposition', 'Thinker links sources to explain a change, and a waterfall chart can show budget to actual. There is no dedicated driver view.', PARTIAL],
  ['Modules: Commercial, Finance, F&B, M&E', 'Data and tools for all four. No module pages or filters in the app.', PARTIAL],
  ['Integrations', 'Twelve hotel systems are simulated by the data generator. Nothing connects to a real PMS, RMS or POS.', NOT_BUILT],
  ['Data Drop', 'Uploading a file of your own.', NOT_BUILT],
];

const POSITIONS: readonly (readonly string[])[] = [
  ['“The code is trivial. The definitions are the product.”', 'The model never computes a number. Every metric is defined once, in a SQL view, and the model can only ask for it.', 'data'],
  ['“Accuracy is the exchange rate of trust.”', 'Every answer opens “Behind the numbers”: the sources, the definition, the period and the real SQL.', 'kassandra'],
  ['“Money not percentages”', 'Every finding in the brief carries what it is worth in euros, and the brief is ordered by it.', 'kassandra'],
  ['Hotel systems overwrite history; you need snapshots', 'Each booking keeps when it was made and cancelled, so `otb_as_of()` and `pace_vs_stly()` rebuild any past day. Stored snapshots are next, not built.', 'data'],
  ['Build with AI “inside a governed environment… with a named human who answers for the output”', 'How this project was run: plans, contracts, tests and reviews around the agents, and my name on the result.', 'process'],
];

/* ───────────── Research ───────────── */

interface Round {
  name: string;
  where: string;
  asked: string;
  found: string;
  changed: string;
}

const ROUNDS: readonly Round[] = [
  {
    name: 'AI interaction patterns',
    where: 'docs/research/ai-ux',
    asked: 'Which AI behaviours are already proven in analytics products, so I do not invent new ones?',
    found: 'Tableau Pulse computes with statistics first and lets the model write after. A collapsed “show your work” recurs in seven products. People rarely click citations, and a cited look inflates trust. Cloudscape has the most concrete approval spec.',
    changed: 'Steps stay collapsed above an answer. Evidence is a panel with the real query, not a row of citation chips. Approval is an inline card.',
  },
  {
    name: 'Juyo’s brand, colour and type',
    where: 'docs/research/ui-refinement',
    asked: 'What do Juyo’s mobile app and web app look like, and what has to change for the colours to pass contrast?',
    found: 'Juyo runs two design systems that share no tokens: a light site and a dark product. Its own muted text is 2.84:1. Raleway’s figures do not line up in columns. Tooltip delays in Radix and Base UI are 600 to 700 ms; Spartan’s default is 0.',
    changed: 'Dark first, in a palette inspired by Juyo’s mobile app colours, then adjusted for WCAG AA. Inter with tabular figures. Tooltips wait 600 ms and never show on touch.',
  },
  {
    name: 'Four things I had rejected',
    where: 'docs/research/ui-round3',
    asked: 'Each file starts from something I turned down in the first interface: the ask bar, the tables, the agent list, the brief.',
    found: 'None of 23 composers studied has a gradient or an animated border. The table failed on hierarchy, not on styling. Revenue tools show future nights as a month grid. Sentry’s cron strip shows runs at a glance, and autonomy ladders start low.',
    changed: 'A calm ask bar with the orb as its only colour. A rate calendar for future nights. Agent cards with a run strip. Autonomy that starts at “suggest”.',
  },
  {
    name: 'Component kits, filters and charts',
    where: 'docs/research/notes and reports',
    asked: 'Which Angular kit, and how should a model choose a chart?',
    found: 'The report recommended staying on Zard and earning “premium” through tokens. On charts: let the model name the intent and let code pick the chart; one vendor cut latency from 10.3 s to 1.3 s by enumerating chart kinds.',
    changed: 'I chose Spartan anyway (see below). Filters are one typed state in the address. The chart catalogue is closed, and the server checks that a kind fits its rows.',
  },
  {
    name: 'A theme of my own',
    where: 'docs/research/theme',
    asked: 'Can one system serve both Juyo’s light site and its dark product?',
    found: 'Design systems agree on three token tiers. Dark text on a light surface is read more accurately as type gets smaller. The app had 21 font sizes, 11 radii, five focus rings and twelve durations, none of them tokens.',
    changed: 'The Juyo concept theme: primitive, semantic and component tokens, and a bridge that maps 20 literal sizes onto 8 steps without editing a component.',
  },
  {
    name: 'Layout and density',
    where: 'docs/research/layout',
    asked: 'How dense should a screen for revenue managers be?',
    found: 'At most four KPI tiles or three charts in a row. Rows of 40 px or 32 px, as Carbon sets them. Most viewing time is spent above the fold.',
    changed: 'A rule: comfortable by default, compact where the data is (tables, filters, evidence), and never by shrinking the type.',
  },
];

/* ───────────── Design system ───────────── */

interface Choice {
  title: string;
  chose: string;
  why: string;
  evidence: string;
}

const DESIGN: readonly Choice[] = [
  {
    title: 'Spartan UI, not Zard',
    chose: 'Spartan’s unstyled “brain” primitives with a styled “helm” layer that I own.',
    why: 'My own research report said to stay on Zard. I went the other way. Spartan is more mature, its headless layer is structurally safer for an “every view passes axe” rule, and it already has parts for AI interfaces: message, trace, skeleton.',
    evidence: 'About 3,000 stars against 1,200, and in the Thoughtworks Radar “Assess” ring.',
  },
  {
    title: 'Phosphor, and not Lucide',
    chose: 'Phosphor through ng-icons, with its weights used as a system.',
    why: 'Lucide is on every shadcn-style app, so a product that uses it looks like a template before you read a word. Phosphor has six weights, and a weight can mean something: Light for navigation, Bold for small marks, Fill for where you are.',
    evidence: 'The picture below: the same four icons in both sets.',
  },
  {
    title: 'Inspired by Juyo’s mobile app colours, then adjusted for WCAG AA',
    chose: 'The palette was taken from Juyo’s own mobile app: screenshots of the Juyo app on Google Play, plus the CSS of their web app. Each colour was then moved by the smallest step that passes.',
    why: 'I wanted the product to feel like Juyo’s, and I was not willing to ship text that fails contrast. Where the two disagreed, contrast won. Change is never colour alone: every figure that moved carries ▲ or ▼.',
    evidence: 'The sampling is in docs/research/ui-refinement/juyo_brand.md. The ratios below are computed on this page from the hex values.',
  },
  {
    title: 'Inter first, then Archivo',
    chose: 'Inter with tabular figures for Light and Dark. Archivo on its width axis for the concept theme.',
    why: 'Juyo’s typeface is commercial, and Raleway’s digits do not line up in a column. In the concept theme one family does three jobs: wide for headings, normal for text, condensed tabular figures for money.',
    evidence: 'Instrument Sans was dropped: its digits are 16% wider than Archivo’s.',
  },
  {
    title: 'Density is a token',
    chose: 'Control heights and row heights as tokens: 24, 28, 32 and 36 px, and 44 px on touch.',
    why: 'A revenue manager reads small figures for hours. Density should come from the row and the type’s width, not from shrinking the text.',
    evidence: 'A 13 px column of figures takes the room an 11.5 px one did.',
  },
  {
    title: 'Three themes, one token architecture',
    chose: 'Light, Dark and the Juyo concept share 47 colour role names. A theme is a new mapping of them.',
    why: 'A component reads a role and never a raw value, so it follows any theme without an edit. The concept theme was added without changing a component template.',
    evidence: 'The three strips below read their own values from the page.',
  },
];

/** The before and after pairs, shared with the accessibility page. */
export const PROCESS_SHIFTS = JUYO_COLOUR_SHIFTS;

/* ───────────── Working with Claude ───────────── */

const LOOP = [
  { title: 'Frame', text: 'I say what the problem is and who it is for. We argue about it until the question is right.' },
  { title: 'Research', text: 'Claude reads products, design systems and papers, and comes back with sources I can check.' },
  { title: 'Choose', text: 'I decide. Sometimes against the research, and then the reason is written down.' },
  { title: 'Build', text: 'Agents build on separate branches, against written contracts, tests first.' },
  { title: 'Check', text: 'Tests, axe, a reviewer per area, the story evals. I look at the screens myself.' },
] as const;

const METHOD: readonly DocsCell[] = [
  { title: 'Agents in parallel, on their own branches', text: 'Three waves: three backend agents on the first evening, nine areas in Round 2, and more in Round 3. Each area owned its files, so two agents never edited the same one.' },
  { title: 'Contracts before code', text: 'One agent wrote the shared types first; the plan gave it about twenty minutes. Every branch then built against those shapes. A branch that needed to change one had to say so in its report.' },
  { title: 'Checks an agent cannot argue with', text: 'Tests written first. axe clean on desktop and phone. A reviewer for each area. Seven planted stories that Kassandra must find. More than 600 unit tests in the web app.' },
  { title: 'The calls were mine', text: 'I rejected the gradient ask bar as too loud, and the first orb as “a dot that inflates and that’s it”. I asked for voice to stop sending on its own. I chose what was cut.' },
];

/* ───────────── Engineering ───────────── */

interface Engineering {
  title: string;
  why: string;
  evidence: string;
  page: DocsPageId;
  link: string;
}

const ENGINEERING: readonly Engineering[] = [
  { title: 'One Cloudflare Worker', why: 'The app, the API, the agents, the cron, the MCP server and email in one deploy. One origin means no CORS, and same-origin checks I can reason about. One person can run it.', evidence: 'The prototype needed a Worker, a Container and a Durable Object to do less.', page: 'architecture', link: 'The system map' },
  { title: 'Agents on Pi Durable', why: 'An agent that waits two days for an approval should not hold compute, or lose its place in a deploy. My own notes warned that two agent loops in one conversation would fight, so I kept one loop and dropped the second runtime.', evidence: 'The plan had a two-hour spike with a fallback. The spike held.', page: 'kassandra', link: 'Kassandra and the agents' },
  { title: 'MCP is the only door to the data', why: 'Kassandra, the agents and an outside AI call the same 24 tools. One guard to harden, one set of definitions. What you see in Claude Desktop is what Kassandra sees.', evidence: 'The MCP server was committed two minutes after the data layer.', page: 'data', link: 'Connect your own AI' },
  { title: 'The model never computes a number', why: 'A revenue manager acts on these figures. SQL holds the definitions; the model plans, picks tools and explains. A chart can only show rows a tool returned.', evidence: 'Seven planted stories, found 7 of 7 on production.', page: 'data', link: 'The planted stories' },
  { title: 'An evidence panel on every answer', why: 'Trust comes from being able to check. The panel leads with the figures the answer used, then the sources, the definition, the period and the query.', evidence: 'People rarely click citation chips, so a chip row would only look trustworthy.', page: 'components', link: 'The evidence panel, live' },
  { title: 'A read-only database on my own VM', why: 'The metric definitions were already SQL views, so I kept Postgres. The plan said a managed database; I used a VM I already run. Hyperdrive and a Cloudflare Tunnel make that safe: the tunnel dials out, so the VM opens no port.', evidence: 'The role can only SELECT on one schema, in read-only transactions, with a 5 s timeout.', page: 'security', link: 'The security posture' },
  { title: 'Voice through Soniox', why: 'It started on the browser’s own speech recognition. Soniox streams words as they are spoken, in English and Romanian. The key the browser gets works once, for three minutes of audio.', evidence: 'I changed voice so it never sends on its own: you tap send.', page: 'kassandra', link: 'Voice' },
  { title: 'A public demo, bounded', why: 'Reviewers must be able to try it in one click, so there is no login. That makes spend and abuse the design problem: a daily budget for everyone, rate limits, and email that cannot be turned into a relay.', evidence: 'A review found eleven ways past the SQL guard. All are refused now.', page: 'security', link: 'What the demo does not prevent' },
  { title: 'A data generator with planted stories', why: 'To test whether an analyst finds the cause, you need data where you know the cause. So the generator plants seven, and the same seven are the evals.', evidence: 'Bookings are simulated day by day against rates and capacity.', page: 'data', link: 'How the data was made' },
];

const CHANGED: readonly DocsCell[] = [
  { title: 'I went against my own research, three times', text: 'It said to keep Zard; I chose Spartan. It preferred graphite and brass with Geist; I took Juyo’s palette and Inter. It called a side panel for the assistant “the norm”; I made the answer the first screen.' },
  { title: 'A dependency came out', text: 'Hashbrown was the first pick for generative UI. It and the agent loop both wanted to own the conversation, so it came out. One tool and one spec do the job.' },
  { title: 'Things I built and then replaced', text: 'The gradient ask bar. The first orb. Boards as rows. Voice that sent the question when you stopped speaking.' },
  { title: 'The builder became a canvas after all', text: 'The plan said no node graph. The builder has one, but it is a single chain that a pure function derives from the spec, so it cannot draw something that will not run.' },
  { title: 'Reviews found real problems', text: 'Ways around the SQL guard. An audit with 5 blockers. Contrast failures in the light theme. Each is in the history with its fix.' },
  { title: 'What is still not true', text: 'There is no login. Nothing is written to a hotel system. The review text is templated. A chart on a board is a copy. Juyo’s Strategic tier is not built.' },
];

const NEXT: readonly string[] = [
  '**A backtest.** Before you switch an agent on, see when it would have fired last month and what it would have proposed.',
  '**Live board charts.** A saved chart re-runs its query, and you can edit its spec by hand.',
  '**Snapshots of history.** So “what did we believe last Tuesday” has an answer that does not depend on the source keeping its past.',
  '**Login and roles.** So an approval is a real control and the hotel scope is a real permission.',
  '**A session with people who use a screen reader.** axe is a floor, not proof.',
  '**The Strategic tier.** Three points of view on one question, and a synthesis that names where they disagree.',
];

/**
 * /docs/process: how Compass was built, in order, in the owner's voice. A timeline, then the decisions with what
 * each one rests on. Facts come from the repository's own documents and history.
 */
@Component({
  selector: 'docs-process',
  imports: [...DOCS_KIT, ...PROCESS_VISUALS],
  host: { class: 'block' },
  styles: `
    .jump {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0 10px;
      border: 1px solid var(--border);
      border-radius: var(--chip-radius, 9999px);
      font-size: 12.5px;
      color: var(--muted-foreground);
    }
    .jump:hover {
      color: var(--foreground);
      border-color: var(--input);
    }
    .jump:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }
    @media (pointer: coarse) {
      .jump {
        min-height: 44px;
      }
    }
  `,
  template: `
    <div class="flex flex-col gap-12">
      <div>
        <docs-head
          eyebrow="Docs · How this was built"
          title="How this was built"
          lede="I want you to see how I got here, not only where I ended up. This page is the order things happened in, the decisions I made, and what each one rests on. I built Compass inside the 24 hours of the assignment, with Claude as a thinking partner and a team of coding agents. The product and design calls are mine."
        />
        <nav class="mt-5 flex flex-wrap gap-2" aria-label="Sections of this page">
          @for (s of sections; track s.id) {
            <button type="button" class="jump" (click)="jump(s.id)">{{ s.label }}</button>
          }
        </nav>
      </div>

      <dl class="docs-cells" style="--docs-cell-min: 200px">
        @for (f of facts; track f.label) {
          <div>
            <dt class="order-2 text-[14px] font-medium">{{ f.label }}</dt>
            <dd class="order-1 text-[26px]/tight font-semibold tracking-[-0.02em] tabular-nums">{{ f.value }}</dd>
            <dd class="text-muted-foreground order-3 text-[13px]/snug">{{ f.note }}</dd>
          </div>
        }
      </dl>

      <docs-section heading="The timeline" anchor="timeline" note="Times are from the commit history.">
        <docs-timeline [phases]="timeline" />
      </docs-section>

      <docs-section heading="Understanding Juyo’s product first" anchor="juyo" note="Before I designed anything I worked out what Juyo already has, from what it publishes. One line on the pricing page decided where I would spend my time: agents are announced, and not shipped.">
        <docs-cells [items]="sources" [min]="380" />

        <h3 class="mt-8 mb-1 text-[16px] font-semibold tracking-[-0.01em]">What I built from each part of it</h3>
        <p class="text-muted-foreground mb-3 max-w-[76ch] text-[14px]/relaxed">The left column is Juyo’s. The status is mine, and I have tried to be strict with it.</p>
        <docs-table caption="Juyo’s products, what Compass built from each, and its status" [head]="['Juyo’s product', 'In Compass', 'Status']" [rows]="productMap" [nowrap]="[2]" [minWidth]="720" />

        <h3 class="mt-8 mb-1 text-[16px] font-semibold tracking-[-0.01em]">How their positions became my principles</h3>
        <p class="text-muted-foreground mb-3 max-w-[76ch] text-[14px]/relaxed">The quotes are from Juyo’s blog.</p>
        <div class="docs-table" tabindex="0" role="region" aria-label="Juyo’s positions and the principle each one became">
          <table style="min-width: 680px">
            <caption class="sr-only">Juyo’s positions and the principle each one became in Compass</caption>
            <thead>
              <tr><th scope="col">Juyo’s position</th><th scope="col">What it became</th><th scope="col">See it</th></tr>
            </thead>
            <tbody>
              @for (p of positions; track p[0]) {
                <tr>
                  <th scope="row">{{ p[0] }}</th>
                  <td class="docs-md" [innerHTML]="p[1]! | md"></td>
                  <td class="whitespace-nowrap"><a class="docs-link" [href]="path($any(p[2]))" (click)="open($event, $any(p[2]))">{{ linkName($any(p[2])) }}</a></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </docs-section>

      <docs-section heading="Research first" anchor="research" note="Each round asked one question before the decision it informed. The notes are in the repository, with their sources.">
        <ul class="grid gap-3 xl:grid-cols-2">
          @for (r of rounds; track r.name) {
            <li class="docs-panel flex flex-col gap-3 p-5">
              <div>
                <h3 class="text-[16px] font-semibold tracking-[-0.01em]">{{ r.name }}</h3>
                <p class="text-muted-foreground mt-0.5 font-mono text-[11.5px]">{{ r.where }}</p>
              </div>
              <dl class="grid grid-cols-[76px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[13.5px]/relaxed">
                <dt class="docs-k pt-0.5">Asked</dt>
                <dd>{{ r.asked }}</dd>
                <dt class="docs-k pt-0.5">Found</dt>
                <dd class="text-muted-foreground">{{ r.found }}</dd>
                <dt class="docs-k pt-0.5">Changed</dt>
                <dd class="text-muted-foreground">{{ r.changed }}</dd>
              </dl>
            </li>
          }
        </ul>
      </docs-section>

      <docs-section heading="The design system" anchor="design" note="Six choices. The pictures under them are drawn from the app’s own tokens and icons.">
        <ul class="grid gap-3 xl:grid-cols-2">
          @for (d of design; track d.title) {
            <li class="docs-panel flex flex-col gap-3 p-5">
              <h3 class="text-[16px] font-semibold tracking-[-0.01em]">{{ d.title }}</h3>
              <dl class="grid grid-cols-[76px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[13.5px]/relaxed">
                <dt class="docs-k pt-0.5">Decision</dt>
                <dd>{{ d.chose }}</dd>
                <dt class="docs-k pt-0.5">Why</dt>
                <dd class="text-muted-foreground">{{ d.why }}</dd>
                <dt class="docs-k pt-0.5">Evidence</dt>
                <dd class="text-muted-foreground">{{ d.evidence }}</dd>
              </dl>
            </li>
          }
        </ul>

        <h3 class="mt-8 mb-1 text-[16px] font-semibold tracking-[-0.01em]">The palette: Juyo’s colour → the Compass token</h3>
        <p class="text-muted-foreground mb-3 max-w-[76ch] text-[14px]/relaxed">Inspired by Juyo’s mobile app colours, then adjusted for WCAG AA. On the left of each pair is the colour as sampled; on the right is the token that replaced it, with the contrast of both on the same background.</p>
        <docs-colour-shifts [shifts]="shifts" />

        <h3 class="mt-8 mb-3 text-[16px] font-semibold tracking-[-0.01em]">The icon sets, side by side</h3>
        <docs-icon-sets />

        <h3 class="mt-8 mb-3 text-[16px] font-semibold tracking-[-0.01em]">Three themes from one set of names</h3>
        <docs-theme-strips />
        <p class="text-muted-foreground mt-3 text-[13.5px]">
          More in <a class="docs-link" [href]="path('design-system')" (click)="open($event, 'design-system')">the design system</a>, and in <a class="docs-link" [href]="path('accessibility')" (click)="open($event, 'accessibility')">accessibility</a>, which was a rule from the first day.
        </p>
      </docs-section>

      <docs-section heading="The interaction model" anchor="model" note="Inbox → Thread → Board is Juyo’s Ask → Analyze → Act, in the order a morning actually goes: what changed, why, what I keep.">
        <docs-model-wireframes />
        <p class="text-muted-foreground mt-4 max-w-[76ch] text-[14px]/relaxed">
          I built the first layout in the prototype, and my own research calls a side panel “the norm”. I rejected it for one reason. Juyo says it is moving from people going to the data to the answer coming to them. A dashboard with a chat on the side keeps the old order: you still have to know where to look. Each of the three screens borrows from products that do that one thing well: Tableau Pulse for the digest, Claude Artifacts and Power BI for a conversation that shows its work, ThoughtSpot for pinning an answer to a board.
        </p>
      </docs-section>

      <docs-section heading="Working with Claude" anchor="claude" note="I used Claude as a thinking partner first and a builder second. The same loop ran for every decision on this page.">
        <ol class="docs-flow">
          @for (l of loop; track l.title) {
            <li>
              <strong class="text-[14px] font-semibold">{{ l.title }}</strong>
              <p class="text-muted-foreground mt-1 text-[13px]/snug">{{ l.text }}</p>
            </li>
          }
        </ol>
        <docs-cells class="mt-4" [items]="method" [min]="380" />
        <p class="text-muted-foreground mt-4 max-w-[76ch] text-[14px]/relaxed">
          Juyo’s own position is that it builds with AI too, but “inside a governed environment… with a named human who answers for the output”. That is how I tried to work here. The agents wrote most of the code. The plans, the contracts, the checks and the decisions are what kept it honest, and I answer for the result.
        </p>
      </docs-section>

      <docs-section heading="Engineering decisions" anchor="engineering" note="Each one with its reason and something that backs it.">
        <ul class="grid gap-3 xl:grid-cols-2">
          @for (e of engineering; track e.title) {
            <li class="docs-panel flex flex-col gap-3 p-5">
              <h3 class="text-[16px] font-semibold tracking-[-0.01em]">{{ e.title }}</h3>
              <dl class="grid grid-cols-[76px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[13.5px]/relaxed">
                <dt class="docs-k pt-0.5">Why</dt>
                <dd>{{ e.why }}</dd>
                <dt class="docs-k pt-0.5">Evidence</dt>
                <dd class="text-muted-foreground">{{ e.evidence }}</dd>
              </dl>
              <p class="mt-auto text-[13px]"><a class="docs-link" [href]="path(e.page)" (click)="open($event, e.page)">{{ e.link }}</a></p>
            </li>
          }
        </ul>
      </docs-section>

      <docs-section heading="What changed along the way" anchor="changed" note="A day of work is not a straight line. These are the turns.">
        <docs-cells [items]="changed" [min]="300" />
      </docs-section>

      <docs-section heading="What I would do next" anchor="next">
        <ol class="docs-steps">
          @for (n of next; track n) {
            <li><span class="docs-md text-muted-foreground" [innerHTML]="n | md"></span></li>
          }
        </ol>
      </docs-section>
    </div>
  `,
})
export class DocsProcess {
  private readonly router = inject(DocsRouter);
  protected readonly sections = SECTIONS;
  protected readonly facts = FACTS;
  protected readonly timeline = TIMELINE;
  protected readonly sources = SOURCES;
  protected readonly productMap = PRODUCT_MAP;
  protected readonly positions = POSITIONS;
  protected readonly rounds = ROUNDS;
  protected readonly design = DESIGN;
  protected readonly shifts = PROCESS_SHIFTS;
  protected readonly loop = LOOP;
  protected readonly method = METHOD;
  protected readonly engineering = ENGINEERING;
  protected readonly changed = CHANGED;
  protected readonly next = NEXT;
  protected readonly path = docsPath;

  private readonly names: Partial<Record<DocsPageId, string>> = { data: 'Data & MCP', kassandra: 'Kassandra & agents', process: 'Working with Claude' };
  protected linkName(id: DocsPageId): string {
    return this.names[id] ?? id;
  }

  protected open(event: MouseEvent, id: DocsPageId) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    // A link to this page is a link to a section of it.
    if (id === 'process') return this.jump('claude');
    this.router.open(id);
  }

  protected jump(id: string) {
    const doc = globalThis.document;
    const reduce = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    doc?.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
}
