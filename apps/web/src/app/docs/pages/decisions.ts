import { Component } from '@angular/core';
import { DOCS_KIT } from '../docs-kit';

interface Decision {
  title: string;
  /** What was chosen. */
  chose: string;
  /** What it was chosen over. */
  over: string;
  why: string;
}

const GROUPS: readonly { id: string; heading: string; note: string; items: readonly Decision[] }[] = [
  {
    id: 'product',
    heading: 'Product',
    note: 'Juyo describes three shifts: from clicking to a conversation, from exploring dashboards to the answer coming to you, from a tool to a partner. They were used as the product spec.',
    items: [
      {
        title: 'The home screen is a brief',
        chose: 'Inbox → Thread → Board: findings ranked by money, a conversation that explains one, a board that keeps what matters.',
        over: 'A dashboard with an assistant docked beside it, which is the version the earlier prototype built.',
        why: 'A chat panel beside a dashboard is “SaaS with AI added”. If the answer should come to you, the first screen has to be the answer.',
      },
      {
        title: 'Rank by money',
        chose: 'Every finding carries an EUR impact and the brief is ordered by it. A broken data feed comes first.',
        over: 'Percent changes, or a fixed order by topic.',
        why: 'A 12% drop means nothing until you know of what. And every number below a stale feed depends on it.',
      },
      {
        title: 'Detect with rules, explain with a model',
        chose: 'Eight fixed SQL detectors find the items. A model writes one sentence per item from its facts.',
        over: 'Asking a model to look for anomalies.',
        why: 'The brief has to be the same every time it loads, and a finding has to be reproducible from its query.',
      },
      {
        title: 'A workflow is a chain, built by talking',
        chose: 'One linear chain: trigger → hotels → checks → analysis → approval → action. The agent fills one node per tool call.',
        over: 'A free node canvas with branches.',
        why: 'A free canvas asks the hotelier to think like an integrator. The agent edits a spec and a pure function derives the graph, so it cannot draw a graph the runner cannot execute.',
      },
      {
        title: 'Compass only reads',
        chose: 'An approved action becomes an RMS task for the revenue manager and an audit entry.',
        over: 'Writing rates or closing channels in a source system.',
        why: 'Juyo states that Kassandra runs on an isolated analytics database. An approval is still real: it is logged, attributed and can be undone.',
      },
    ],
  },
  {
    id: 'ai',
    heading: 'AI and data',
    note: 'The rules that keep a figure trustworthy when a model is in the loop.',
    items: [
      {
        title: 'The model never computes a number',
        chose: 'Metric definitions live in SQL views. The model emits tool calls and metric references; components and tools fetch the values.',
        over: 'Letting the model do arithmetic on rows it has read.',
        why: 'A revenue manager acts on these figures. A number that no query returned must not be able to reach the screen.',
      },
      {
        title: 'Generative UI from a closed catalogue',
        chose: '`show_widget` picks one of 21 kinds and names an earlier tool result and its columns. The server copies the rows and checks that the kind fits them.',
        over: 'Model-written markup. Hashbrown was the planned runtime; the shipped version does it with one tool and one spec.',
        why: 'Every answer stays consistent and accessible, a pie can only show parts of a whole, and a widget can be pinned to a board with its evidence.',
      },
      {
        title: 'MCP is the only door to the data',
        chose: 'One catalog of 24 tools serves Kassandra, the workflow agents and outside clients.',
        over: 'A private query layer for the app and a thinner public one.',
        why: 'One guard to harden and one set of definitions. What a reviewer sees in Claude Desktop is what Kassandra sees.',
      },
      {
        title: 'RAG for reviews only',
        chose: 'Embeddings rank review sentences by meaning, in pgvector next to the reviews.',
        over: 'Embedding metrics or documents to “ground” answers.',
        why: 'A metric must be exact. Nearest-neighbour search fits one question here: what do guests say, when they used other words.',
      },
      {
        title: 'Planted stories as evals',
        chose: 'Seven problems are planted in the dataset, and seven fixed questions check that Kassandra finds each one.',
        over: 'Judging answers by reading them.',
        why: 'A change to a prompt or a tool can be checked in a minute, against causes that are known.',
      },
    ],
  },
  {
    id: 'platform',
    heading: 'Platform',
    note: 'Chosen so that one person can run it, and so that an agent can wait days for a human.',
    items: [
      {
        title: 'One Cloudflare Worker',
        chose: 'The app, the API, the agents, the cron, the MCP server and email in one deploy.',
        over: 'A frontend host, an API service and a job runner.',
        why: 'One origin means no CORS and same-origin checks that are simple to reason about. Durable Objects fit agents that sleep and wake.',
      },
      {
        title: 'Agents on Pi Durable',
        chose: 'Each conversation, draft and run is a durable agent session in a Durable Object. An approval is a durable signal.',
        over: 'A stateless request loop with state in a database.',
        why: 'A workflow can wait days for a person without holding compute, and a deploy in the middle of an answer loses nothing.',
      },
      {
        title: 'Postgres on my own VM, behind a tunnel',
        chose: 'Postgres 17 with pgvector, reached through Hyperdrive and a Cloudflare Tunnel.',
        over: 'A managed database, or SQLite in the Worker.',
        why: 'The metric definitions were already SQL views. The tunnel dials out, so the VM opens no inbound port.',
      },
      {
        title: 'No login, bounded spend',
        chose: 'Same-origin writes, per-client rate limits and a daily budget for all visitors together.',
        over: 'An account wall in front of a take-home demo.',
        why: 'Reviewers must be able to try it in one click. What is given up is written down on the Security page.',
      },
    ],
  },
  {
    id: 'design',
    heading: 'Design system',
    note: 'The stack follows Juyo’s own: their product is Angular.',
    items: [
      {
        title: 'Angular 22, Tailwind v4, Spartan UI',
        chose: 'Standalone components and signals, with Spartan’s unstyled primitives and a styled layer the project owns.',
        over: 'A kit that ships its own look.',
        why: 'The accessibility of a menu or a tooltip comes solved, and every pixel of the surface is still a decision made here.',
      },
      {
        title: 'A colour budget',
        chose: 'One hue for data. Orange only for “needs your decision”. Red only for a failure. Purple for actions and selection in the default themes, and for Kassandra alone in the concept theme.',
        over: 'A colour per category.',
        why: 'When colour changes only with meaning, an orange thing on screen is always the thing that waits for you. Changes also carry ▲ and ▼.',
      },
      {
        title: 'Phosphor icons, never Lucide',
        chose: 'Light for navigation and calm UI, Bold for small high-emphasis marks, Fill for the current place.',
        over: 'The icon set every shadcn-style app ships.',
        why: 'Six weights work as a system, and the product does not look like a template.',
      },
      {
        title: 'ECharts behind our own spec',
        chose: 'A `WidgetSpec` sits between the model and the chart library. One component draws every kind.',
        over: 'Prompting the model with a chart library’s options.',
        why: 'The library can be swapped without touching a prompt, and each kind gets a skeleton with the same dimensions as the chart.',
      },
      {
        title: 'Three themes, one set of token names',
        chose: 'Light, Dark and the Juyo concept. The concept theme is an added layer: primitive → semantic → component.',
        over: 'A fork of the components per theme.',
        why: 'A theme is a new mapping of the semantic tier, so every component follows without an edit. The theme lab reads its values from the rendered page.',
      },
      {
        title: 'One Kassandra',
        chose: 'One composer and one conversation component, used in the Inbox, the Thread, the builder, an agent’s page and a board.',
        over: 'A chat per screen.',
        why: 'Voice, modes, steps, widgets and evidence behave the same everywhere, and are fixed once.',
      },
    ],
  },
];

/** /docs/decisions: the choices that shaped the product, each with what it was chosen over and why. */
@Component({
  selector: 'docs-decisions',
  imports: [...DOCS_KIT],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-12">
      <docs-head
        eyebrow="Docs · Decisions"
        title="Twenty decisions, each with its reason"
        lede="A curated list. The full log, with dates and the research behind each entry, is \`docs/decisions.md\` in the repository."
      />

      @for (g of groups; track g.id) {
        <docs-section [heading]="g.heading" [anchor]="g.id" [note]="g.note">
          <ul class="grid gap-3 xl:grid-cols-2">
            @for (d of g.items; track d.title) {
              <li class="docs-panel flex flex-col gap-3 p-5">
                <h3 class="text-[16px] font-semibold tracking-[-0.01em]">{{ d.title }}</h3>
                <dl class="grid grid-cols-[84px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[13.5px]/relaxed">
                  <dt class="docs-k pt-0.5">Chose</dt>
                  <dd class="docs-md" [innerHTML]="d.chose | md"></dd>
                  <dt class="docs-k pt-0.5">Over</dt>
                  <dd class="docs-md text-muted-foreground" [innerHTML]="d.over | md"></dd>
                  <dt class="docs-k pt-0.5">Because</dt>
                  <dd class="docs-md text-muted-foreground" [innerHTML]="d.why | md"></dd>
                </dl>
              </li>
            }
          </ul>
        </docs-section>
      }
    </div>
  `,
})
export class DocsDecisions {
  protected readonly groups = GROUPS;
}
