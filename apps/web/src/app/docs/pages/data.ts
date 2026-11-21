import { Component } from '@angular/core';
import type { EvidenceColumn, WidgetSpec } from '@compass/contracts';
import { WidgetChart } from '../../charts/widget-chart';
import { DOCS_KIT, type DocsCell } from '../docs-kit';
import { DATAGEN_REPO } from '../docs-pages';

export const MCP_URL = 'https://juyo.razvanfrandes.com/mcp';

const FACTS = [
  { value: '20', label: 'hotels', note: 'in 20 cities and 5 regions, under 4 brands: Kestrel, Arbor, Tessera, Lumen' },
  { value: '34', label: 'tables', note: 'about 5.76 million rows in one Postgres schema' },
  { value: '29', label: 'months of stays', note: 'from 1 Jan 2025 to 31 May 2027' },
  { value: '20 Nov 2026', label: 'business date', note: 'earlier stays are actuals, later ones are on the books' },
] as const;

/* ───────────── How the data was made (the compass-datagen repository) ───────────── */

const PIPELINE = [
  { title: 'Config', file: 'config.py', text: 'Hotels, segments, channels, events, and the planted stories with the size of each effect.' },
  { title: 'World', file: 'world.py', text: 'The calendar, seasonality in both hemispheres, city events, holidays, weather and FX.' },
  { title: 'Bookings simulation', file: 'bookings.py', text: 'The core. Day by day, in the order bookings were made, against rates and capacity.' },
  { title: 'Market, operations, finance', file: 'market.py · ops.py · finance.py', text: 'Everything that follows from the bookings: rate shops, F&B, labour, web, reviews, the P&L.' },
  { title: 'Postgres', file: 'db/load.sh', text: 'One database, schema `hotel`: 34 tables, loaded in about a minute.' },
  { title: 'Views', file: 'db/schema.sql', text: 'The metric definitions, as SQL views and functions over those tables.' },
] as const;

const SIMULATION: readonly DocsCell[] = [
  { title: 'Cancellations release their rooms', text: 'A cancelled booking gives its nights back, so a later guest can take them.' },
  { title: 'A revenue system reprices overnight', text: 'Future nights are repriced from pickup against the booking curve, in steps of at most 10%.' },
  { title: 'Guests compare prices', text: 'A guest on a public rate compares BAR with the comp-set median and may walk away. That is where lost business comes from.' },
  { title: 'Capacity is real', text: 'It is checked by room type on every night of the stay, with a free upgrade when the booked type is full.' },
  { title: 'No stored snapshots', text: 'Each reservation keeps `created_at` and `cancelled_at`, so the position on the books on any past day comes from plain SQL. Pace, pickup and last year follow from that.' },
  { title: 'Stable randomness', text: 'Every random mechanism has its own seed stream, so a change to one does not reshuffle the others.' },
];

const CALIBRATION = [
  { value: '63–79%', label: 'occupancy', note: 'by hotel' },
  { value: '92–110', label: 'ARI', note: 'rate index against the comp set' },
  { value: '18%', label: 'cancellations', note: 'and about 2% no-shows' },
  { value: '31–44%', label: 'GOP margin', note: 'payroll set to regional shares' },
] as const;

/** Rows per table in the loaded database, as the owner counted them. The 13 tables not listed are reference tables. */
const TABLE_SIZES: readonly (readonly [table: string, system: string, rows: number])[] = [
  ['reservation_nights', 'PMS', 2_412_233],
  ['reservations', 'PMS', 1_211_449],
  ['guests', 'PMS', 982_981],
  ['group_blocks', 'PMS', 7_374],
  ['room_inventory_daily', 'PMS', 17_620],
  ['rate_changes', 'RMS', 224_796],
  ['lost_business', 'RMS', 183_328],
  ['rates_daily', 'RMS', 17_620],
  ['forecasts', 'RMS', 3_860],
  ['budgets', 'RMS', 580],
  ['comp_rates', 'Market', 116_720],
  ['comp_set_daily', 'Market', 13_760],
  ['reviews', 'Operations', 203_791],
  ['web_daily', 'Operations', 126_131],
  ['labor_daily', 'Operations', 92_400],
  ['fnb_daily', 'Operations', 55_007],
  ['marketing_spend', 'Operations', 46_331],
  ['me_events', 'Operations', 8_521],
  ['pnl_monthly', 'Finance', 15_080],
  ['weather_daily', 'Reference', 13_760],
  ['fx_rates', 'Reference', 6_201],
];

export const SIZE_ROWS = TABLE_SIZES.map(([table, system, rows]) => ({ table, system, rows }));
const SIZE_COLUMNS: EvidenceColumn[] = [
  { key: 'table', label: 'Table', kind: 'text' },
  { key: 'system', label: 'System', kind: 'text' },
  { key: 'rows', label: 'Rows', kind: 'count' },
];
const SIZE_SPEC: WidgetSpec = {
  kind: 'treemap',
  title: 'Bookings and guests are four fifths of the 5.76 million rows',
  subtitle: 'Rows per table, grouped by system · 21 of the 34 tables; the other 13 are reference tables',
  sourceCallId: 'docs-table-sizes',
  x: 'table',
  group: 'system',
  y: ['rows'],
  format: 'count',
};

const SYSTEMS: readonly DocsCell[] = [
  { k: 'PMS', title: 'Bookings and inventory', text: '`reservations` `reservation_nights` `guests` `group_blocks` `room_inventory_daily`. Each booking has its created and cancelled time, segment, channel, rate plan and room type.' },
  { k: 'RMS', title: 'Prices and forecast', text: '`rates_daily` `rate_changes` `forecasts` `budgets` `lost_business`. Every rate change is kept, automatic or manual; the forecast is a P10 to P90 range.' },
  { k: 'Rate shopper', title: 'What competitors charge', text: '`competitors` `comp_rates`. Rate shops by shop date, so a rate position has a history.' },
  { k: 'Comp-set benchmark', title: 'How the market performed', text: '`comp_set_daily`. The benchmark feed behind MPI, ARI and RGI.' },
  { k: 'POS', title: 'Food and beverage', text: '`outlets` `fnb_daily`. Covers and revenue per outlet and day.' },
  { k: 'M&E', title: 'Meetings and events', text: '`meeting_rooms` `me_events`.' },
  { k: 'Labour', title: 'Hours by department', text: '`labor_daily`. Required, scheduled and worked hours, so a staffing gap is a number.' },
  { k: 'Web analytics', title: 'The booking funnel', text: '`web_daily`. Sessions to bookings, by source and device.' },
  { k: 'Marketing', title: 'Spend', text: '`marketing_spend`.' },
  { k: 'Reviews', title: 'Scores and text', text: '`reviews`. In production each distinct sentence also has an embedding, for the semantic search below.' },
  { k: 'Finance', title: 'USALI P&L', text: '`pnl_monthly`. Actual, budget and forecast per line and month.' },
  { k: 'Data-source health', title: 'Can the numbers be trusted', text: '`data_sources`. Last sync and status per system and hotel. A stale feed is the first item of the brief.' },
];

const HELPERS: readonly (readonly string[])[] = [
  ['`v_hotel_day`', 'Occupancy, ADR and RevPAR per hotel and day, in local currency and EUR'],
  ['`v_comp_set_index`', 'MPI, ARI and RGI against the comp set'],
  ['`v_channel_month`', 'Gross revenue, commission and net revenue by channel'],
  ['`v_rate_position`', 'BAR against the comp-set median, per night'],
  ['`otb_as_of(date)`', 'The position on the books as of any past day'],
  ['`pace_vs_stly()`', 'On the books against the same time last year'],
  ['`eur_rate()`', 'Currency conversion, by date'],
  ['`business_date()`', 'The data’s “today”'],
];

const REGENERATE = `git clone ${DATAGEN_REPO.url}.git
cd ${DATAGEN_REPO.name}
uv sync
uv run python -m datagen --preview   # about 10 reservations per hotel, in seconds
uv run python -m datagen             # the full run: about 1.2M reservations, about 2 minutes
db/load.sh                           # creates the database and schema hotel, loads the full run
uv run python tests/check.py         # integrity, realism and the seven planted stories`;

/* ───────────── Metrics, stories, search, MCP ───────────── */

const LAYERS = [
  { title: 'Source tables', text: 'What the hotel systems produce: reservations, rates, inventory, P&L, labour, reviews.' },
  { title: 'Governed views and functions', text: 'A metric is defined once, in SQL: `v_hotel_day`, `v_rate_position`, `pace_vs_stly()`, `otb_as_of()`.' },
  { title: '24 data tools', text: 'Each tool runs that SQL with typed arguments and returns rows plus evidence. The role can only `SELECT`.' },
  { title: 'Kassandra, agents, MCP', text: 'Every reader goes through the tools. The model picks and explains; it never computes.' },
] as const;

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

interface Story {
  id: string;
  hotel: string;
  title: string;
  /** What `STORIES` in config.py plants. */
  planted: string;
  /** What the loaded data shows as a result. */
  shows: string;
  /** How tests/check.py recovers it with SQL. */
  check: string;
  /** The fixed question Kassandra is asked, and how long the answer took on 20 Nov 2026. */
  question: string;
  seconds: string;
}

export const STORIES: readonly Story[] = [
  {
    id: 'S1',
    hotel: 'Arbor Lisbon Chiado',
    title: 'A manual rate override',
    planted: 'A manual BAR override of +22% on the next 45 nights, made 21 days before the business date by `rm.lisbon`.',
    shows: '21-day pickup of 11% against 18% for European peers, and pace 20% behind the same time last year.',
    check: 'Pickup under 70% of the European median, BAR over 25% above the comp-set median, and the change is a manual one.',
    question: 'Why is Lisbon pacing behind last year?',
    seconds: '10.5 s',
  },
  {
    id: 'S2',
    hotel: 'Arbor New York Midtown',
    title: 'The biggest corporate account left',
    planted: 'Vantor Consulting moved its travel programme elsewhere six months before the business date. Booking.com and Expedia refill the weekday rooms.',
    shows: 'Corporate share falls from 30% to 21%, OTA share rises, and net ADR after commission is lower.',
    check: 'Corporate share of room nights down by over a quarter, OTA share up, and no Vantor stays after it left.',
    question: 'Which hotel lost its biggest corporate account, and what did it cost?',
    seconds: '8.5 s',
  },
  {
    id: 'S3',
    hotel: 'Lumen Bali Uluwatu',
    title: 'A kitchen short of staff',
    planted: 'The kitchen runs at 68% of the hours it needs for five weeks. Restaurant capture and in-room dining fall.',
    shows: 'Dinner covers per occupied room down 40%, the food score from 8.6 to 6.0, and slow service in the review text.',
    check: 'Worked hours under 75% of required, covers per occupied room down by over a quarter, the food score down by over 1.5 points.',
    question: 'Why are food scores dropping in Bali?',
    seconds: '11.4 s',
  },
  {
    id: 'S4',
    hotel: 'Arbor Amsterdam Centraal',
    title: 'A release broke mobile checkout',
    planted: 'A booking-engine release, 30 days before the business date, breaks part of the mobile checkout. Most of the lost guests book the same hotel on Booking.com.',
    shows: 'Mobile conversion from 1.8% to 0.8%, and Booking.com’s share from 39% to 49%.',
    check: 'Mobile conversion below 60% of its earlier level, desktop within 25% of its own, Booking.com’s share of new bookings up.',
    question: 'Amsterdam is getting more Booking.com bookings lately. Why?',
    seconds: '16.2 s',
  },
  {
    id: 'S5',
    hotel: 'Lumen Barcelona Mar',
    title: 'A floor under renovation',
    planted: 'A floor of 24 standard rooms is out of order, from 60 days before the business date to 30 days after it.',
    shows: 'Fewer rooms available, and guests near the works mention the noise.',
    check: 'At least 24 rooms out of order on every night of the works, and construction noise in the reviews.',
    question: 'Why do guests at Barcelona complain lately?',
    seconds: '14.9 s',
  },
  {
    id: 'S6',
    hotel: 'Tessera Dubai Business Bay',
    title: 'An event missing from the pricing calendar',
    planted: 'Gulf Tech Week is not in the hotel’s pricing calendar. It fills early at normal rates while the comp set prices the week at nearly double.',
    shows: '0.76× the comp set, while 83% full three weeks out.',
    check: 'Under 0.8× the comp set on the event nights, the sister hotel Dubai Marina is not, and over 70% full three weeks out.',
    question: 'How is Dubai Business Bay priced for 15-19 December?',
    seconds: '9.8 s',
  },
  {
    id: 'S7',
    hotel: 'Tessera Berlin Mitte',
    title: 'A stale POS feed',
    planted: 'The point-of-sale feed stopped syncing three days before the business date.',
    shows: 'No F&B rows for the last three days, and the source is flagged stale.',
    check: 'The POS source is flagged stale, and there are no F&B rows for the last three days.',
    question: 'Is anything wrong with the data in Berlin?',
    seconds: '5.6 s',
  },
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

/**
 * /docs/data: how the synthetic data was made (the compass-datagen repository), what is in the database, the governed metrics, the
 * planted stories that double as evals, and the public MCP server.
 */
@Component({
  selector: 'docs-data',
  imports: [...DOCS_KIT, WidgetChart],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-12">
      <docs-head
        eyebrow="Docs · Data & MCP"
        title="A generated hotel group, with the definitions in SQL"
        lede="Halcyon Hospitality Group is fictional. Its data comes from a generator, in a repository of its own, that simulates the systems a hotel analytics platform connects to, and loads them into one Postgres database. Kassandra, the agents and any outside AI read it through the same 24 tools, and no model ever computes a figure."
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

      <docs-section heading="How the data was made" anchor="made">
        <p class="text-muted-foreground -mt-3 mb-4 max-w-[76ch] text-[14px]/relaxed">
          The generator is a repository of its own,
          <a class="docs-link" [href]="repo.url" target="_blank" rel="noopener noreferrer">{{ repo.name }}<span class="sr-only"> (opens in a new tab)</span></a>: one config file, a world built first, a core simulation of bookings, then the areas that follow from it. Everything in it is fictional: the hotels, the companies, the competitors and the city events. Its architecture follows
          <a class="docs-link" href="https://github.com/chadwambles/isla-velaluz" target="_blank" rel="noopener noreferrer">Isla Velaluz<span class="sr-only"> (opens in a new tab)</span></a>
          (MIT). The booking model is new.
          @if (!repo.public) {
            The repository is private for now, so its links open only for people with access.
          }
        </p>
        <ol class="docs-flow">
          @for (p of pipeline; track p.title) {
            <li>
              <strong class="block text-[14px] font-semibold">{{ p.title }}</strong>
              <code class="text-muted-foreground mt-0.5 block font-mono text-[11.5px]">{{ p.file }}</code>
              <p class="docs-md text-muted-foreground mt-1.5 text-[13px]/snug" [innerHTML]="p.text | md"></p>
            </li>
          }
        </ol>

        <h3 class="mt-8 mb-1 text-[16px] font-semibold tracking-[-0.01em]">The booking simulation</h3>
        <p class="text-muted-foreground mb-3 max-w-[76ch] text-[14px]/relaxed">Bookings are not sampled from a distribution. They are made one day at a time, against the rates and the rooms that exist on that day, which is why pace, pickup and lost business behave like the real thing.</p>
        <docs-cells [items]="simulation" [min]="280" />

        <h3 class="mt-8 mb-1 text-[16px] font-semibold tracking-[-0.01em]">Calibrated against what hotels look like</h3>
        <p class="text-muted-foreground mb-3 max-w-[76ch] text-[14px]/relaxed">Measured on the last 12 months of actuals in the generated data.</p>
        <dl class="docs-cells" style="--docs-cell-min: 180px">
          @for (c of calibration; track c.label) {
            <div>
              <dt class="order-2 text-[14px] font-medium">{{ c.label }}</dt>
              <dd class="order-1 text-[22px]/tight font-semibold tracking-[-0.02em] tabular-nums">{{ c.value }}</dd>
              <dd class="text-muted-foreground order-3 text-[13px]/snug">{{ c.note }}</dd>
            </div>
          }
        </dl>
      </docs-section>

      <docs-section heading="What is in the database" anchor="tables" note="Twelve simulated systems and a set of reference tables (hotels, brands, room types, segments, channels, accounts, FX, holidays, city events, weather). Amounts are in each hotel’s own currency unless a column ends in \`_eur\`.">
        <div class="docs-panel p-4 sm:p-5">
          <juyo-widget-chart [spec]="sizeSpec" [rows]="sizeRows" [columns]="sizeColumns" />
        </div>
        <docs-cells class="mt-4" [items]="systems" [min]="300" />
      </docs-section>

      <docs-section heading="Regenerate it" anchor="regenerate" note="The generator runs with uv, outside this app. The full run takes about two minutes and the load about one. \`db/load.sh\` uses \`DATABASE_URL\` when it is set, so it loads into any Postgres server.">
        <docs-copy [value]="regenerate" label="the commands" [block]="true" />
      </docs-section>

      <docs-section heading="Definitions live in SQL" anchor="metrics" note="The app holds no formulas. These views and functions are part of the schema, and the eight governed metrics below are read from them.">
        <docs-table caption="The views and functions that hold the metric definitions" [head]="['View or function', 'What it gives']" [rows]="helpers" [minWidth]="480" />

        <h3 class="mt-8 mb-1 text-[16px] font-semibold tracking-[-0.01em]">Governed metrics</h3>
        <p class="docs-md text-muted-foreground mb-3 max-w-[76ch] text-[14px]/relaxed" [innerHTML]="metricsNote | md"></p>
        <docs-table caption="The eight governed metrics" [head]="['Metric', 'Key', 'Definition', 'Source']" [rows]="metrics" [nowrap]="[1, 3]" [minWidth]="720" />

        <h3 class="mt-8 mb-3 text-[16px] font-semibold tracking-[-0.01em]">From a table to an answer</h3>
        <ol class="docs-flow">
          @for (l of layers; track l.title) {
            <li>
              <strong class="text-[14px] font-semibold">{{ l.title }}</strong>
              <p class="docs-md text-muted-foreground mt-1 text-[13px]/snug" [innerHTML]="l.text | md"></p>
            </li>
          }
        </ol>
      </docs-section>

      <docs-section heading="Seven planted stories, seven evals: 7 of 7" anchor="evals">
        <p class="text-muted-foreground -mt-3 mb-4 max-w-[76ch] text-[14px]/relaxed">
          Each story is a cause written into the generator’s <docs-source path="datagen/config.py" kind="blob" [repo]="repo.url" />, with the size of its effect. Its <docs-source path="tests/check.py" kind="blob" [repo]="repo.url" /> recovers each one with SQL, so it is the answer key. The same seven are Kassandra’s evals: a fixed question per story, which passes when the answer names the hotel and the planted cause. On 20 Nov 2026, against production, she found 7 of 7.
        </p>
        <ul class="grid gap-3 xl:grid-cols-2">
          @for (s of stories; track s.id) {
            <li class="docs-panel flex flex-col gap-3 p-5">
              <div>
                <p class="text-muted-foreground flex flex-wrap items-baseline gap-x-2 text-[12.5px]"><span class="text-foreground font-mono text-[12px]">{{ s.id }}</span><span>{{ s.hotel }}</span></p>
                <h3 class="mt-1 text-[16px] font-semibold tracking-[-0.01em]">{{ s.title }}</h3>
              </div>
              <dl class="grid grid-cols-[96px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[13.5px]/relaxed">
                <dt class="docs-k pt-0.5">Planted</dt>
                <dd class="docs-md" [innerHTML]="s.planted | md"></dd>
                <dt class="docs-k pt-0.5">Data shows</dt>
                <dd class="text-muted-foreground">{{ s.shows }}</dd>
                <dt class="docs-k pt-0.5">Check</dt>
                <dd class="text-muted-foreground">{{ s.check }}</dd>
                <dt class="docs-k pt-0.5">Eval</dt>
                <dd>
                  <span class="text-muted-foreground">“{{ s.question }}”</span>
                  <span class="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-(--positive)"><span aria-hidden="true">✓</span>Found, in {{ s.seconds }}</span>
                </dd>
              </dl>
            </li>
          }
        </ul>
        <p class="text-muted-foreground mt-3 text-[13px]">Result file: <code class="docs-code">apps/worker/evals/results/2026-11-20T19-30-03-730Z.json</code>. Answers took 5.6 to 16.2 seconds.</p>
      </docs-section>

      <docs-section heading="What guests say: semantic search" anchor="search">
        <docs-cells [items]="search" [min]="300" />
      </docs-section>

      <docs-section heading="Connect your own AI" anchor="mcp" note="The same tools are a public MCP server. It is read-only and needs no login.">
        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div class="docs-panel flex flex-col gap-4 p-5">
            <div>
              <p class="docs-k mb-1.5">MCP server URL</p>
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
  protected readonly repo = DATAGEN_REPO;
  protected readonly facts = FACTS;
  protected readonly pipeline = PIPELINE;
  protected readonly simulation = SIMULATION;
  protected readonly calibration = CALIBRATION;
  protected readonly sizeSpec = SIZE_SPEC;
  protected readonly sizeRows = SIZE_ROWS;
  protected readonly sizeColumns = SIZE_COLUMNS;
  protected readonly systems = SYSTEMS;
  protected readonly regenerate = REGENERATE;
  protected readonly helpers = HELPERS;
  protected readonly metrics = METRICS;
  protected readonly metricsNote =
    'The eight metrics a question can reference by key. The model emits the key, the hotels and the period; the tool returns the value with this definition as evidence. `stly` compares with the same weekday 364 days earlier, at the same lead time.';
  protected readonly layers = LAYERS;
  protected readonly stories = STORIES;
  protected readonly search = SEARCH;
  protected readonly mcpSteps = MCP_STEPS;
  protected readonly mcpRules = MCP_RULES;
}
