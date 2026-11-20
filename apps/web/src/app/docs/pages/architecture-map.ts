/*
  The system map as data: the nodes, the edges between them and the request flows that light them up. It was first
  drawn as a standalone page (docs/architecture.html); this is the same map, kept current with the system:
  the Worker now serves the app, Boards is a sixth Durable Object, and voice goes to Soniox.

  Grid: clients x30; Worker x340; Durable Objects x664; services x1050; VM and external x1342.
  Row offsets (`y`) inside the Worker and the web app line a route up with the edge that leaves at that height.
*/

export type FlowId = 'ask' | 'brief' | 'mcp' | 'build' | 'approve';

export interface MapRow {
  t?: string;
  /** A small group label above the rows that follow. */
  group?: string;
  /** Offset from the top of the node, for rows that must meet an edge. */
  y?: number;
  mono?: boolean;
  dim?: boolean;
}

export interface MapNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h?: number;
  title: string;
  sub: string;
  flows: readonly FlowId[];
  /** The node runs its agent loop on Pi Durable. */
  pi?: boolean;
  rows: readonly (string | MapRow)[];
}

export interface MapEdge {
  d: string;
  flows: readonly FlowId[];
  label?: string;
  lx?: number;
  ly?: number;
}

export const MAP_SIZE = { width: 1620, height: 1186 } as const;
export const ROW = 21;

export const ZONES = [
  { id: 'clients', x: 14, y: 40, w: 254, h: 1096, label: 'CLIENTS', cf: false },
  { id: 'cf', x: 286, y: 40, w: 1024, h: 1096, label: 'CLOUDFLARE · ONE WORKER DEPLOY · juyo.razvanfrandes.com', cf: true },
  { id: 'vm', x: 1326, y: 40, w: 280, h: 515, label: 'SELF-HOSTED VM', cf: false },
  { id: 'ext', x: 1326, y: 571, w: 280, h: 324, label: 'EXTERNAL', cf: false },
] as const;

/** The frame around the three agents that run on Pi Durable. */
export const PI_FRAME = { x: 652, y: 237, w: 318, h: 470, flows: ['ask', 'build', 'approve'] as readonly FlowId[] };

export const NODES: readonly MapNode[] = [
  { id: 'mcpc', x: 30, y: 104, w: 224, title: 'MCP clients', sub: 'Claude Desktop, any client', flows: ['mcp'], rows: ['Streamable HTTP · no login', 'bring their own model'] },
  {
    id: 'web',
    x: 30,
    y: 243,
    w: 224,
    h: 477,
    title: 'Web app',
    sub: 'Angular 22 · signals',
    flows: ['ask', 'brief', 'build', 'approve'],
    rows: [
      { t: 'Kassandra chat', y: 91 },
      { group: 'STACK', y: 140 },
      { t: 'Spartan UI · Phosphor · ECharts', y: 158, dim: true },
      { t: 'Inbox → Thread → Board', y: 179, dim: true },
      { t: 'Agent builder', y: 233 },
      { group: 'CONTRACT', y: 282 },
      { t: '@compass/contracts types', y: 300, dim: true },
      { t: 'Brief · boards · approvals', y: 386 },
      { group: 'VOICE', y: 425 },
      { t: 'mic → 16 kHz PCM worklet', y: 443, dim: true },
      { t: 'streams straight to Soniox', y: 464, dim: true },
    ],
  },
  {
    id: 'worker',
    x: 340,
    y: 104,
    w: 250,
    h: 690,
    title: 'Worker',
    sub: 'compass-juyo · nodejs_compat',
    flows: ['ask', 'brief', 'mcp', 'build', 'approve'],
    rows: [
      { t: '/mcp', y: 80, mono: true },
      { t: '/api/budget', y: 105, mono: true },
      { t: 'ASSETS · the app, deep links', y: 136, mono: true },
      { t: '/api/kassandra/ws', y: 230, mono: true },
      { t: 'POST /api/kassandra/ask', y: 251, mono: true, dim: true },
      { group: 'GUARDS', y: 286 },
      { t: 'Origin check on every write', y: 304, dim: true },
      { t: 'JSON ≤ 16 KB · /mcp ≤ 64 KB', y: 325, dim: true },
      { t: '/api/workflows/builder/ws', y: 372, mono: true },
      { group: 'RATE LIMITS · PER CLIENT', y: 418 },
      { t: '6 questions per minute', y: 436, dim: true },
      { t: '60 MCP requests per minute', y: 457, dim: true },
      { t: '/api/workflows · /api/runs', y: 504, mono: true },
      { t: '/api/proposals', y: 525, mono: true },
      { t: '/api/audit', y: 546, mono: true },
      { t: '/api/brief (+ /refresh)', y: 596, mono: true },
      { t: '/api/boards', y: 644, mono: true },
      { t: '/api/voice/token · /api/hotels', y: 670, mono: true, dim: true },
    ],
  },
  { id: 'cron', x: 340, y: 895, w: 250, title: 'Cron trigger', sub: '0 5 * * * · 05:00 UTC', flows: ['brief'], rows: ['brief first, then workflows'] },

  { id: 'budget', x: 664, y: 104, w: 292, title: 'Budget', sub: 'one DO · all visitors · UTC day', flows: ['mcp'], rows: ['300 questions · 60 runs · 120 decisions', '2000 embeddings · 300 voice keys'] },
  { id: 'kass', x: 664, y: 271, w: 292, pi: true, title: 'Kassandra', sub: 'one DO per conversation · SQLite', flows: ['ask'], rows: ['Quick → Haiku 5.5 · 10 tools', 'Thinker → Sonnet 5.5 · 24 tools'] },
  { id: 'builder', x: 664, y: 414, w: 292, pi: true, title: 'WorkflowBuilder', sub: 'one DO per draft · Sonnet 5.5', flows: ['build'], rows: ['7 draft tools, one node per call', 'graph = specToGraph(draft)'] },
  {
    id: 'wf',
    x: 664,
    y: 557,
    w: 292,
    pi: true,
    title: 'WorkflowAgents',
    sub: 'one DO · Sonnet 5.5 · SQLite',
    flows: ['brief', 'build', 'approve'],
    rows: ['each run is a durable Pi session', 'approval parks on a durable signal', 'apply_action → RMS task + audit log'],
  },
  { id: 'email', x: 664, y: 735, w: 292, title: 'Email Service', sub: 'binding EMAIL · one sender', flows: ['build'], rows: [{ t: 'alerts@compass.razvanfrandes.com', mono: true }, '3/h · 6/day per address · 50/day'] },
  { id: 'briefs', x: 664, y: 874, w: 292, title: 'Briefs', sub: 'one DO · group halcyon', flows: ['brief'], rows: ['8 fixed SQL detectors, ranked by €', 'Haiku 5.5 writes the summary only'] },
  { id: 'boards', x: 664, y: 1005, w: 292, title: 'Boards', sub: 'one DO · group halcyon', flows: ['ask'], rows: ['50 boards · 24 widgets each', 'a widget is a copy, with its evidence'] },

  { id: 'wai', x: 1050, y: 104, w: 240, title: 'Workers AI', sub: '@cf/baai/bge-m3 · env.AI', flows: ['mcp'], rows: ['embeds find_reviews questions'] },
  {
    id: 'tools',
    x: 1050,
    y: 222,
    w: 240,
    title: 'Data tools',
    sub: '24 read-only tools',
    flows: ['ask', 'mcp', 'build', 'approve'],
    rows: ['used by /mcp and the agents', 'SQL guard · 200 rows · 5 s', '<untrusted_data> wrapping', 'evidence: SQL, period, source', 'model reads at most 60 rows'],
  },
  { id: 'hyper', x: 1050, y: 424, w: 240, title: 'Hyperdrive', sub: 'compass-db · env.HYPERDRIVE', flows: ['ask', 'brief', 'mcp', 'build', 'approve'], rows: ['pooling + query cache', 'Workers VPC service → tunnel'] },
  { id: 'aigw', x: 1050, y: 615, w: 240, title: 'AI Gateway', sub: 'compass · env.AI', flows: ['ask', 'brief', 'build', 'approve'], rows: ['BYOK: the key stays here', 'logs each model call'] },

  {
    id: 'pg',
    x: 1342,
    y: 104,
    w: 248,
    h: 296,
    title: 'Postgres 17 + pgvector',
    sub: '127.0.0.1:5433 · TLS · scram',
    flows: ['ask', 'brief', 'mcp', 'build', 'approve'],
    rows: ['schema hotel · 20 hotels', '1.2M reservations', 'metrics live in SQL views', 'review_passages · vector(1024)', { group: 'ROLE compass_ro' }, 'SELECT on schema hotel only', 'read-only transactions', 'statement_timeout = 5 s'],
  },
  { id: 'tunnel', x: 1342, y: 424, w: 248, title: 'Cloudflare Tunnel', sub: 'cloudflared · outbound only', flows: ['ask', 'brief', 'mcp', 'build', 'approve'], rows: ['dials out to Cloudflare', 'no inbound port on the VM'] },
  { id: 'claude', x: 1342, y: 615, w: 248, title: 'Claude API', sub: 'Anthropic', flows: ['ask', 'brief', 'build', 'approve'], rows: ['Haiku 5.5 · Quick, brief text', 'Sonnet 5.5 · Thinker, workflows'] },
  { id: 'soniox', x: 1342, y: 760, w: 248, title: 'Soniox', sub: 'real-time speech to text', flows: ['ask'], rows: ['temporary key: single use, 180 s', 'audio never passes the Worker'] },
];

export const EDGES: readonly MapEdge[] = [
  { d: 'M254 180 H340', flows: ['mcp'], label: 'MCP', lx: 297, ly: 180 },
  { d: 'M254 330 H340', flows: ['ask'], label: 'WebSocket', lx: 297, ly: 330 },
  { d: 'M254 472 H340', flows: ['build'], label: 'WebSocket', lx: 297, ly: 472 },
  { d: 'M254 625 H340', flows: ['brief', 'approve', 'ask'], label: 'HTTPS', lx: 297, ly: 625 },
  { d: 'M540 104 V84 H1020 V250 H1050', flows: ['mcp'], label: '/mcp · createMcpHandler', lx: 790, ly: 84 },
  { d: 'M590 205 H664', flows: ['mcp'] },
  { d: 'M590 330 H664', flows: ['ask'] },
  { d: 'M590 472 H664', flows: ['build'] },
  { d: 'M590 625 H664', flows: ['approve'] },
  { d: 'M590 696 H616 V925 H664', flows: ['brief'] },
  { d: 'M590 960 H664', flows: ['brief'] },
  { d: 'M664 895 H636 V670 H664', flows: ['brief'] },
  { d: 'M590 744 H604 V1062 H664', flows: ['ask'] },
  { d: 'M810 529 V557', flows: ['build'], label: 'save · test run', lx: 884, ly: 543 },
  { d: 'M810 693 V735', flows: ['build'], label: 'send_email', lx: 870, ly: 722 },
  { d: 'M970 310 H1050', flows: ['ask', 'build', 'approve'], label: 'tools', lx: 1010, ly: 310 },
  { d: 'M1170 222 V198', flows: ['mcp'], label: 'embed question', lx: 1234, ly: 210 },
  { d: 'M1170 400 V424', flows: ['ask', 'mcp', 'build', 'approve'], label: 'compass_ro', lx: 1224, ly: 412 },
  { d: 'M1290 481 H1342', flows: ['ask', 'brief', 'mcp', 'build', 'approve'] },
  { d: 'M1466 424 V400', flows: ['ask', 'brief', 'mcp', 'build', 'approve'], label: 'localhost only', lx: 1528, ly: 412 },
  { d: 'M970 660 H1050', flows: ['ask', 'build', 'approve'], label: 'model', lx: 1026, ly: 660 },
  { d: 'M1290 672 H1342', flows: ['ask', 'brief', 'build', 'approve'] },
  { d: 'M956 905 H995 V510 H1050', flows: ['brief'] },
  { d: 'M956 930 H1020 V700 H1050', flows: ['brief'] },
  { d: 'M142 720 V1160 H1466 V875', flows: ['ask'], label: 'voice · microphone audio straight to Soniox, on a temporary key', lx: 800, ly: 1160 },
];

export interface Flow {
  id: FlowId | '';
  /** The tab's name and the small word after it (Juyo's Ask, Analyze, Act). */
  tab: string;
  hint: string;
  tag: string;
  title: string;
  note: string;
  /** Steps as one line of Markdown each. */
  steps: readonly string[];
}

export const FLOWS: readonly Flow[] = [
  {
    id: '',
    tab: 'All parts',
    hint: '',
    tag: 'Overview',
    title: 'What runs where',
    note: 'Pick a flow above to trace one request through the system.',
    steps: [
      'One **Worker**, `compass-juyo`, answers everything on `juyo.razvanfrandes.com`: the Angular app as static assets, every `/api` route and `/mcp`. An unknown path gets `index.html`, so a deep link such as `/docs/architecture` survives a reload.',
      'Three Durable Objects run their agent loop on **Pi Durable** (`@earendil-works/pi-durable`, through `PiHarness`): **Kassandra**, **WorkflowBuilder** and **WorkflowAgents**. A conversation, a draft or a run survives a deploy or an eviction.',
      'The agents and outside MCP clients read the hotel data through the same **24 data tools**. Each tool call runs SQL through **Hyperdrive**, a Workers VPC service and a **Cloudflare Tunnel** to Postgres 17 on a VM. The VM opens no inbound port.',
      'Claude is called through **AI Gateway** `compass` with a stored key (BYOK), so the key is in neither the Worker nor the browser. **Workers AI** embeds the question for `find_reviews`.',
      'Three more objects hold shared state: **Briefs** has the morning brief, **Boards** the saved boards and **Budget** the demo’s daily usage. The Worker and the agents ask Budget before they spend a model call.',
      'Voice goes around the Worker. It mints a temporary **Soniox** key, and the browser streams the microphone to Soniox itself.',
      'Compass only reads. The database role is `compass_ro`, and an approved action becomes an RMS task and an audit entry.',
    ],
  },
  {
    id: 'ask',
    tab: 'Ask Kassandra',
    hint: 'Ask',
    tag: 'Ask · Kassandra',
    title: 'A question in the chat',
    note: 'One Durable Object per conversation, running Pi Durable.',
    steps: [
      'The app opens `wss://juyo.razvanfrandes.com/api/kassandra/ws?conversation=<id>`. The Worker checks the Origin and passes the socket to the **Kassandra** object for that id.',
      'The app sends `ask` with a mode and the hotel scope. The object checks the rate limit (6 questions per minute per client) and the daily budget, then starts a Pi Durable turn. A spoken question is transcribed first: the Worker mints a single-use **Soniox** key and the browser streams the audio there.',
      '**Quick** uses Haiku 5.5 with 10 governed-metric tools and at most 5 turns. **Thinker** uses Sonnet 5.5 with all 24 tools and at most 10 turns. Both go through AI Gateway.',
      'Each tool call opens a Hyperdrive client and runs SQL as `compass_ro`, cut down to the hotel scope in code. The data tools are marked `replay: "safe"`, so Pi runs a call again if the object is evicted in the middle of it.',
      'The model reads a capped text of the rows, with outside free text inside `<untrusted_data>`. The full rows and the evidence (SQL, period, definitions, column labels) go to the app only.',
      '`show_widget` names an earlier tool result and its column keys, and the server copies the rows. A chart cannot show a number that no tool returned. **Add to board** saves the widget, with its evidence, in the **Boards** object.',
      'The socket streams the answer as `live` and commits finished turns as `entries`. Reconnecting with the same id returns a snapshot of the transcript.',
    ],
  },
  {
    id: 'brief',
    tab: 'Morning brief',
    hint: 'Analyze',
    tag: 'Analyze · the answer comes to you',
    title: 'The morning brief',
    note: 'Detectors are fixed SQL. The model writes one sentence per finding.',
    steps: [
      'At 05:00 UTC the cron trigger runs the Worker’s `scheduled()` handler, which asks the **Briefs** object to regenerate.',
      'Briefs runs 8 fixed SQL detectors through Hyperdrive: stale data feed, pace behind, underpriced demand, account loss, web conversion drop, staffing gap, rooms out of order and GOP miss.',
      'The findings are ranked: a stale feed first, then by absolute EUR impact.',
      'Haiku 5.5, through AI Gateway, writes a `summary` for each item from that item’s facts. If the model fails, the item keeps its title and has no summary.',
      'The Worker then hands the brief to **WorkflowAgents**, which runs the enabled workflows whose trigger matches a finding, plus the scheduled ones that are due.',
      'The app reads `GET /api/brief` and filters it by the hotel scope. `POST /api/brief/refresh` regenerates it on demand, within the rate limit and 24 refreshes per day.',
    ],
  },
  {
    id: 'mcp',
    tab: 'Any AI via MCP',
    hint: '/mcp',
    tag: 'MCP · public, read-only',
    title: 'Ask the hotel data from any AI',
    note: 'The same 24 tools the agents use, with no login.',
    steps: [
      'A reviewer adds `https://juyo.razvanfrandes.com/mcp` to Claude Desktop as a custom connector (Streamable HTTP).',
      'The Worker allows 60 requests per minute per client and bodies up to 64 KB. Browser requests from another origin get 403, and responses carry no CORS headers.',
      '`createMcpHandler` serves the tool catalog that Kassandra and the workflows use. The client brings its own model, so these calls spend no Claude tokens of ours.',
      'A tool runs SQL as `compass_ro` through Hyperdrive and the tunnel. `run_readonly_query` first passes the SQL guard and is capped at 200 rows, 32 KB per row and 5 s.',
      '`find_reviews` embeds the question with Workers AI `bge-m3`, then ranks review sentences by cosine distance in pgvector. Each call takes one of 2000 daily embeddings from **Budget**; when they are spent the tool points to `search_reviews`.',
    ],
  },
  {
    id: 'build',
    tab: 'Build a workflow by talking',
    hint: 'Act',
    tag: 'Act · agent builder',
    title: 'Build a workflow by talking',
    note: 'The agent fills in one node per tool call. The person can edit the same draft.',
    steps: [
      'The app opens `/api/workflows/builder/ws?draft=<id>` with a random id. Each draft is one **WorkflowBuilder** object that keeps the conversation, the draft and the id of the saved workflow. `&workflow=<id>` loads a saved workflow into the draft for editing.',
      'The person describes what to watch. The builder runs Sonnet 5.5 on Pi Durable and can call the data tools to look at the numbers first.',
      'The agent changes the draft through tool calls: `set_trigger`, `set_hotels`, `add_check`, `remove_check`, `set_goal`, `set_action`, `set_email`.',
      'After every change the socket sends `draft` with the graph from `specToGraph(draft)`: trigger → scope → checks → analyze → approval, if needed → action. A manual `edit` is validated the same way and reaches the agent as one `app.edit` event on its next turn.',
      '`save` creates the workflow in **WorkflowAgents** once the draft has no issues.',
      '`test` saves if needed and runs the workflow once, against the daily workflow-run budget. The builder follows the run and sends `run` messages with the active node.',
      'The run agent calls `send_email`, once per run. The mail leaves from `alerts@compass.razvanfrandes.com` with a fixed template, one recipient and no outside links, within the email limits.',
    ],
  },
  {
    id: 'approve',
    tab: 'Approve an action',
    hint: 'Act',
    tag: 'Act · durable approval',
    title: 'Approve an action',
    note: 'The run waits on a durable signal and holds no compute while it waits.',
    steps: [
      'A run starts from the morning cron, a brief finding or `POST /api/workflows/:id/run`. Each run is a durable Pi session inside **WorkflowAgents**.',
      'The agent runs the workflow’s checks through the data tools and Sonnet 5.5 explains what it found.',
      '`propose_action` records a proposal with the change (before, after, scope), the rationale, the EUR impact and the risk. Price and channel actions are high risk in code.',
      'Under `approve` autonomy the tool call parks on a durable signal. The run shows `waiting_approval`, and the wait survives deploys.',
      'The app lists `GET /api/proposals?status=pending`. `POST /api/proposals/:id/decision` delivers the signal and counts against the daily decision budget.',
      'On approval, `apply_action` hands the action to the revenue manager as an RMS task and writes the audit log (`GET /api/audit`). `/undo` adds a compensating task. Nothing is written to the hotel data.',
    ],
  },
];

/** A node's height: its own, or the header plus its rows. */
export const nodeHeight = (n: MapNode): number => n.h ?? 94 + ROW * (n.rows.length - 1);

export interface PlacedRow {
  kind: 'row' | 'group';
  text: string;
  y: number;
  mono: boolean;
  dim: boolean;
}

/** The rows of a node with their absolute `y`: a row follows the one before it unless it names its own offset. */
export function placeRows(n: MapNode): PlacedRow[] {
  let y = n.y + 80;
  return n.rows.map((raw) => {
    const r: MapRow = typeof raw === 'string' ? { t: raw } : raw;
    const ry = r.y !== undefined ? n.y + r.y : y;
    y = ry + ROW;
    return r.group ? { kind: 'group', text: r.group, y: ry - 1, mono: false, dim: false } : { kind: 'row', text: r.t ?? '', y: ry, mono: !!r.mono, dim: !!r.dim };
  });
}

/** What the map says in one sentence, for people who cannot see it. */
export const MAP_SUMMARY =
  'Compass system map. Clients: the Angular web app and MCP clients. Cloudflare: one Worker that serves the app and the API, six Durable Objects (Kassandra, WorkflowBuilder and WorkflowAgents on Pi Durable, plus Briefs, Budget and Boards), the shared data tools, Hyperdrive, Workers AI, AI Gateway, Email Service and a cron trigger. A self-hosted VM with a Cloudflare Tunnel and Postgres 17 with pgvector. External: the Claude API and Soniox speech to text.';
