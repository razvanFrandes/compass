import { Component } from '@angular/core';
import { DOCS_KIT, type DocsCell } from '../docs-kit';

export const MCP_URL = 'https://juyo.razvanfrandes.com/mcp';

const FACTS = [
  { value: '20', label: 'hotels', note: '5 regions, 4 brands, one fictional group' },
  { value: '1.2M', label: 'reservations', note: 'with nights, rates, channels and accounts' },
  { value: '203,791', label: 'guest reviews', note: 'searchable by meaning with pgvector' },
  { value: '20 Nov 2026', label: 'business date', note: 'fixed, so every visit sees the same day' },
] as const;

const LAYERS = [
  { title: 'Source tables', text: 'Reservations, rates, inventory, P&L, labour, F&B, web sessions, reviews. Schema `hotel`, Postgres 17.' },
  { title: 'Governed views and functions', text: 'A metric is defined once, in SQL: `v_hotel_day`, `v_rate_position`, `pace_vs_stly()`, `otb_as_of()`.' },
  { title: '24 data tools', text: 'Each tool runs that SQL with typed arguments and returns rows plus evidence. The role can only `SELECT`.' },
  { title: 'Kassandra, agents, MCP', text: 'Every reader goes through the tools. The model picks and explains; it never computes.' },
] as const;

const TABLES: readonly DocsCell[] = [
  { k: 'Reference', title: 'Who and what', text: '`hotels` `brands` `channels` `accounts` `outlets` `meeting_rooms`' },
  { k: 'Commercial', title: 'Demand and price', text: '`reservations` `reservation_nights` `rates_daily` `comp_set_daily` `room_inventory_daily` `lost_business` `web_daily`' },
  { k: 'Finance', title: 'Plan and result', text: '`pnl_monthly` (USALI lines) `budgets` `forecasts` (P10 to P90)' },
  { k: 'Operations and guests', title: 'What happened on property', text: '`fnb_daily` `labor_daily` `me_events` `reviews` `review_passages` (one embedding per distinct sentence)' },
  { k: 'Health', title: 'Can the numbers be trusted', text: '`data_sources` lists 140 feeds with their last sync. A stale feed is the first item of the brief.' },
  { k: 'Governed layer', title: 'Where definitions live', text: '`v_hotel_day` `v_rate_position` `v_channel_month` `pace_vs_stly()` `otb_as_of()` `eur_rate()`' },
];

const METRICS: readonly (readonly string[])[] = [
  ['Occupancy', '`occupancy`', 'Rooms sold ÷ rooms available, in %. Out-of-order rooms are excluded. Future dates show what is on the books.', '`v_hotel_day`'],
  ['ADR', '`adr`', 'Average daily rate: room revenue ÷ rooms sold, in EUR.', '`v_hotel_day`'],
  ['RevPAR', '`revpar`', 'Revenue per available room: room revenue ÷ rooms available, in EUR.', '`v_hotel_day`'],
  ['Room revenue', '`room_revenue`', 'Room revenue of the stay nights in the period, in EUR, before commission.', '`v_hotel_day`'],
  ['Rooms sold', '`rooms_sold`', 'Room nights sold. Cancelled and no-show reservations are excluded.', '`v_hotel_day`'],
  ['MPI', '`mpi`', 'Market penetration index: our occupancy ÷ comp-set occupancy × 100. 100 is fair share.', '`comp_set_daily`'],
  ['ARI', '`ari`', 'Average rate index: our ADR ÷ comp-set ADR × 100, in local currency.', '`comp_set_daily`'],
  ['RGI', '`rgi`', 'Revenue generation index: our RevPAR ÷ comp-set RevPAR × 100.', '`comp_set_daily`'],
];

const EVALS: readonly (readonly string[])[] = [
  ['S1', 'Why is Lisbon pacing behind last year?', 'A manual BAR override, 22% above the comp set, slows pickup.', 'Found', '10.5 s'],
  ['S2', 'Which hotel lost its biggest corporate account, and what did it cost?', 'Vantor Consulting left Arbor New York Midtown.', 'Found', '8.5 s'],
  ['S3', 'Why are food scores dropping in Bali?', 'The kitchen ran at 68% of its required hours for five weeks.', 'Found', '11.4 s'],
  ['S4', 'Amsterdam is getting more Booking.com bookings lately. Why?', 'A booking-engine release broke mobile checkout.', 'Found', '16.2 s'],
  ['S5', 'Why do guests at Barcelona complain lately?', '24 rooms are out of order for a renovation; reviews mention the noise.', 'Found', '14.9 s'],
  ['S6', 'How is Dubai Business Bay priced for 15-19 December?', 'Gulf Tech Week is missing from the pricing calendar: 0.76× the comp set.', 'Found', '9.8 s'],
  ['S7', 'Is anything wrong with the data in Berlin?', 'The POS feed is stale: no F&B rows for three days.', 'Found', '5.6 s'],
];

const SEARCH: readonly DocsCell[] = [
  { title: 'RAG for text, SQL for numbers', text: 'A metric must be computed exactly from sums, and a nearest-neighbour lookup can only approximate it. Embeddings are used for one thing: what guests say, when the wording varies.' },
  { title: 'Sentences, next to the reviews', text: 'Workers AI `bge-m3` embeds each distinct review sentence (1024 dimensions) into pgvector, in the same Postgres. One query filters by hotel and period, ranks by meaning and counts the mentions.' },
  { title: 'An honest limit', text: 'The generated reviews are templated: 203,791 reviews contain only 51 distinct sentences. The search works, but this data does not stress it.' },
];

const MCP_STEPS = [
  'Open Claude Desktop and go to **Settings → Connectors**.',
  'Choose **Add custom connector**, and paste the URL above. No key and no login are needed.',
  'Ask in plain words: “Using Compass, why is Lisbon pacing behind last year?” Claude calls the same tools Kassandra uses.',
] as const;

const MCP_RULES: readonly DocsCell[] = [
  { k: 'Transport', title: 'Streamable HTTP', text: 'Any MCP client works. The client brings its own model, so these calls spend no model tokens of ours.' },
  { k: 'Scope', title: 'Read-only, whole group', text: '24 tools, the read-only role, the SQL guard. The public server has no hotel scope and no write.' },
  { k: 'Limits', title: '60 requests a minute', text: 'Per client. Bodies up to 64 KB. A text answer holds at most 60 rows; `structuredContent` keeps them all.' },
  { k: 'Browsers', title: 'No CORS', text: 'A browser request from another origin gets 403, and responses carry no `Access-Control-*` headers. A web page cannot read an MCP answer.' },
];

/** /docs/data: the data model, the governed metrics, the story evals and the public MCP server. */
@Component({
  selector: 'docs-data',
  imports: [...DOCS_KIT],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-12">
      <docs-head
        eyebrow="Docs · Data & MCP"
        title="Definitions live in SQL, and there is one door to the data"
        lede="Halcyon Hospitality Group is fictional: 20 hotels with generated reservations, rates, P&L, labour and reviews. The data sits in one Postgres schema on a VM. Kassandra, the agents and any outside AI read it through the same 24 tools, and no model ever computes a figure."
      />

      <dl class="docs-cells" style="--docs-cell-min: 200px">
        @for (f of facts; track f.label) {
          <div>
            <dt class="order-2 text-[14px] font-medium">{{ f.label }}</dt>
            <dd class="order-1 text-[26px]/tight font-semibold tracking-[-0.02em] tabular-nums">{{ f.value }}</dd>
            <dd class="text-muted-foreground order-3 text-[13px]/snug">{{ f.note }}</dd>
          </div>
        }
      </dl>

      <docs-section heading="From a table to an answer" anchor="layers" note="Four layers. A number is fixed in the second one and only passed along after that.">
        <ol class="docs-flow">
          @for (l of layers; track l.title) {
            <li>
              <strong class="text-[14px] font-semibold">{{ l.title }}</strong>
              <p class="docs-md text-muted-foreground mt-1 text-[13px]/snug" [innerHTML]="l.text | md"></p>
            </li>
          }
        </ol>
      </docs-section>

      <docs-section heading="The data model" anchor="model" note="Schema \`hotel\`, by subject. Amounts are stored in the hotel’s own currency and converted to EUR with \`eur_rate()\` when hotels are compared.">
        <docs-cells [items]="tables" [min]="320" />
      </docs-section>

      <docs-section heading="Governed metrics" anchor="metrics" note="The eight metrics a question can reference by key. The model emits the key, the hotels and the period; the tool returns the value with this definition as evidence. \`stly\` compares with the same weekday 364 days earlier, at the same lead time.">
        <docs-table caption="The eight governed metrics" [head]="['Metric', 'Key', 'Definition', 'Source']" [rows]="metrics" [minWidth]="680" />
      </docs-section>

      <docs-section heading="Story evals: 7 of 7" anchor="evals" note="The dataset contains seven planted problems. Seven fixed questions check that Kassandra finds each one: an answer passes when it names the hotel and the planted cause. This is the run against production on 20 Nov 2026.">
        <docs-table caption="The seven story evals and their results" [head]="['Story', 'Question', 'Planted cause', 'Result', 'Answered in']" [rows]="evals" [numeric]="[4]" [minWidth]="760" />
        <p class="text-muted-foreground mt-3 text-[13px]">Result file: <code class="docs-code">apps/worker/evals/results/2026-11-20T19-30-03-730Z.json</code>. Answers took 5.6 to 16.2 seconds.</p>
      </docs-section>

      <docs-section heading="What guests say: semantic search" anchor="search">
        <docs-cells [items]="search" [min]="300" />
      </docs-section>

      <docs-section heading="Connect your own AI" anchor="mcp" note="The same tools are a public MCP server. It is read-only and needs no login.">
        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div class="docs-panel flex flex-col gap-4 p-5">
            <div>
              <p id="mcp-url-label" class="docs-k mb-1.5">MCP server URL</p>
              <docs-copy [value]="url" label="the MCP URL" />
            </div>
            <div>
              <p class="mb-2 text-[14px] font-semibold">In Claude Desktop</p>
              <ol class="docs-steps">
                @for (s of mcpSteps; track s) {
                  <li><span class="docs-md" [innerHTML]="s | md"></span></li>
                }
              </ol>
            </div>
          </div>
          <docs-cells [items]="mcpRules" [min]="220" />
        </div>
      </docs-section>
    </div>
  `,
})
export class DocsData {
  protected readonly url = MCP_URL;
  protected readonly facts = FACTS;
  protected readonly layers = LAYERS;
  protected readonly tables = TABLES;
  protected readonly metrics = METRICS;
  protected readonly evals = EVALS;
  protected readonly search = SEARCH;
  protected readonly mcpSteps = MCP_STEPS;
  protected readonly mcpRules = MCP_RULES;
}
