# Compass API (for the Angular app)

Base URL: `https://juyo.razvanfrandes.com`. Locally, `wrangler dev` in `apps/worker` serves `http://localhost:8787`.

## Rules for every call

- **Same origin.** `POST`, `PATCH`, `PUT` and `DELETE` under `/api/` are refused (403) when `Origin` is another site. CORS is allowed only for the Angular dev server (`http://localhost:4200`), and never on `/mcp`.
- **Body size.** JSON bodies are at most 16 KB (413). Invalid JSON gets 400. A board widget (`POST /api/boards/:id/widgets`) may be up to 256 KB, because it carries its rows.
- **Errors** are `{ "error": "…" }`. A 500 never carries internals.
- **Daily budget.** Questions, workflow runs, decisions, brief refreshes, voice dictations and board changes are counted per UTC day for all visitors together. Over the limit: 429 with `{ error, resetsAt }` and `Retry-After`. Show `error` as is. See `docs/security.md`.
- **`GET /api/budget`** returns today's usage: `{ question: { used, limit }, workflow_run: …, decision: …, brief_refresh: …, embedding: …, voice: …, board_write: … }`. `embedding` counts `find_reviews` calls made through `/mcp`; `voice` counts the temporary keys of `POST /api/voice/token`; `board_write` counts changes to boards.

The types live in `packages/contracts` (`@compass/contracts`). Import them instead of redefining them.

## Hotels and scope

**`GET /api/hotels`** returns the group's hotels, `HotelRef[]` (`@compass/contracts` hotels.ts), for the scope switcher and the hotel pickers:

```json
[{ "code": "LIS", "name": "Arbor Lisbon Chiado", "city": "Lisbon", "country": "PT", "region": "Europe", "brand": "Arbor", "rooms": 150 }]
```

- 20 hotels, ordered by region, then code. `country` is the ISO code as the database has it. Codes are 3–4 characters (`LIS`, `DXB1`, `LON2`).
- Read from the database and kept in the Worker's memory for 10 minutes; the answer carries `Cache-Control: public, max-age=300`. If the database cannot be read and nothing is in memory: 503 `{ error }`.

**Scope.** A question may carry the hotels the person works on: `scope: { hotels: ["LIS", "AMS"] }` on `ask` (Kassandra socket and builder socket) and on `POST /api/kassandra/ask`. No scope, an empty list, or every hotel of the group is the whole group.

- **Checked on the server.** Codes are matched against the hotel list (letter case and spaces do not matter). A code the group does not have, more than 50 codes, or another shape is refused before the question takes from the budget: an `error` message on a socket, 400 on HTTP ("The scope names a hotel the group does not have: XXX.").
- **In the prompt.** The conversation's instructions say "You are answering for: Arbor Lisbon Chiado (LIS), Arbor Amsterdam Centraal (AMS)." with names from the hotel list, never from the client.
- **On every data tool.** A call's `hotels` are cut down to the scope; a call without `hotels` reads the scope; a call only for hotels outside it fails with a message the model reads ("PAR is outside the hotels you are answering for (LIS, AMS). Use only those hotels."). `list_hotels` and `get_brief` return only the scope's rows. `run_readonly_query` must return a `hotel_code` column and keeps only the scope's rows. `list_metrics` and `get_schema` are unchanged.
- **In the evidence.** A scoped result has a note `Limited to the hotels selected: LIS, AMS.` (plus `Left out, not among them: PAR.` when the call asked for more), in `evidence.notes` and in the text the model reads.
- **Roll-ups.** With `by: region | brand | group`, a row is the roll-up of the scope's hotels only, under the region's, brand's or group's name. The scope note says so.
- **When it applies.** The scope goes with a question. A question sent while an answer is running keeps the scope (and mode) of that answer, like `mode`. `steer` has no scope.
- **Not access control.** There is no login: the scope is the person's working mode, not a permission. The public `/mcp` server has no scope.
- **The brief** is not scoped on the server: filter `GET /api/brief` by `hotel_code` on the client. The numbers around it are: `GET /api/brief/overview?hotels=` (see "Morning brief").

## Kassandra chat: WebSocket

```
wss://juyo.razvanfrandes.com/api/kassandra/ws?conversation=<id>
```

- **Conversation id:** 1–64 letters, digits, `-` or `_`. Pick it on the client (e.g. `crypto.randomUUID()`) and keep it in the URL or in local storage to come back to the conversation.
- **Persistence:** each conversation is one Durable Object. The transcript is durable: it survives reloads, deploys and evictions.
- **Origins:** the socket is accepted from `juyo.razvanfrandes.com` and `localhost`.

### Server → client (`ChatServerMessage`)

| `type` | When | Payload |
|---|---|---|
| `snapshot` | right after connecting | `entries: ChatEntry[]` (newest ≤ 50), `live: ChatLive` |
| `entries` | a new transcript entry was committed | `entries: ChatEntry[]`. Entries never change. Append them by `id`. |
| `live` | the run state changed | `live: ChatLive`. Replace the previous one. |
| `error` | a rejected message (rate limit, daily budget, empty question) | `message: string` |

`ChatEntry` (discriminated by `kind`):
- `user` — `{ text }`
- `assistant` — `{ text, toolCalls: [{ callId, name, args }], model, usage: { tokens, costUsd }, stopReason }`
  - `stopReason: 'toolUse'` means tool calls follow. The interim `text` of such a turn is the agent narrating its steps: show it as a step, not as the answer.
  - `stopReason: 'stop'` is the final answer, in Markdown.
- `tool_result` — `{ callId, name, isError, error?, rows?, evidence?, sent?, widget? }`
  - `rows` and `evidence` feed widgets and the "How this was computed" panel.
  - `evidence` holds: `sources`, `definitions`, `period`, `sql`, `params`, `businessDate`, `notes`, and what the panel needs to show the rows: `title`, `columns`, `sourceLabels` (see "Evidence: titles and columns").
  - `sent` is on `send_email` results only (workflow run logs): whether a mail went out. It is `false` when a limit refused it or there was nothing to report.
  - `widget` is on `show_widget` results only: a chart, table or KPI to draw under the answer. See "Widgets in answers".
- `event` — our own labelled inputs (e.g. `app.approval`, the builder's `app.edit`), `{ type, data }`.

`ChatLive`:
- `running` — show the Stop button while it is true;
- `phase` — what the agent is doing: `idle | waiting | thinking | writing | tools`.
  - `waiting`: the model has sent nothing yet. `thinking`: it is reasoning, with no answer text yet. `writing`: `streamingText` is growing. `tools`: it is calling tools.
  - Thinker (Sonnet) answers mostly do not stream: the provider sends the reasoning, then the whole answer text within a few milliseconds at the end of the turn. `streamingText` stays empty for a few seconds while `phase` is `thinking`, then the `assistant` entry lands. Show a "Thinking…" state from `phase`, not from an empty `streamingText`.
- `streamingText` — the answer being written, before it lands as an `assistant` entry;
- `tools: [{ callId, name, status }]`, where `status` is `pending | running | done | sleeping | waiting`;
- `drafting: [{ callId, name, args }]` (optional) — tool calls the model is **still writing**, with their arguments as far as they have streamed. A string may be cut mid-word and later keys may be missing. Absent when there is none. A call leaves the list when its `assistant` entry is committed; from then on it is in `tools`. The app starts a chart's skeleton from a drafted data call, and shows the title of a drafted `show_widget` over the preview while she writes it. Use `kind` and the column keys only from the committed entry;
- `turns`;
- `failure: { reason, detail? } | null`, e.g. `model_error`, `turn_limit`, `aborted`;
- `usage: { tokens, costUsd }` — the conversation total, for the cost meter.

### Client → server (`ChatClientMessage`)

```json
{ "type": "ask", "text": "Why is Lisbon pacing behind?", "id": "q-123", "mode": "thinker", "scope": { "hotels": ["LIS"] } }
{ "type": "steer", "text": "Use the last 30 days instead" }
{ "type": "abort" }
```

- **`ask`:** pass an `id` so a resend after a dropped connection is not asked twice. Sent while busy, it is queued as a follow-up.
- **`scope`** (optional): the hotels the answer is for. See "Hotels and scope". Send it with every question while a scope is selected; a question without it is for the whole group.
- **`mode`** (the Quick / Thinker selector in the composer):
  - **`quick`:** Claude Haiku 5.5, only the governed-metric tools (plus `get_kpis`, `get_pnl`, `get_forecast` and `show_widget`), at most 5 turns, three sentences. About 5–10 s and a few cents; it shows one widget (two at most) from the result it already has.
  - **`thinker`** (default): Claude Sonnet 5.5, all 25 data tools and `show_widget`, cross-source diagnosis, at most 12 turns. It may call a data tool only to feed a widget. About 10–20 s.
  - **Visual by default (both modes):** an answer that holds a comparison, a trend, a split, a ranking or a few headline figures comes with at least one widget, and at most three; the text stays short and points at them. Only a single number, a yes or no, or an answer with nothing to draw has none.
  - The mode applies from the next question. A question sent while an answer is running keeps the current mode.
- **Rate limit:** 6 questions per minute per client, and the daily budget (`steer` counts as a question). Over a limit, the server sends an `error` message.

### Rendering a turn

```
user entry
  └ assistant (stopReason toolUse)       → "Worked for 4s · 3 steps" (collapsed), one step per toolCall
      └ tool_result (matched by callId)  → step done ✓ / error; rows + evidence for the evidence panel
      └ tool_result with `widget`        → a chart, table or KPI under the answer, with "Add to board"
  └ assistant (stopReason stop)          → the answer (Markdown)
live.phase                               → "Thinking…" / "Writing…" / tool steps while the run is going
live.streamingText                       → the answer while it is being written
```

### Reconnecting

Open a new socket with the same `conversation`. You get a fresh `snapshot`; merge it by entry `id`.

## Kassandra: conversations (the sidebar)

Each conversation is its Kassandra object; the list of them lives in the browser. After a conversation's first answer, the
object writes its `ThreadMeta` once with the Quick model (Haiku): a short `title` ("Tessera Dubai: business mix"), the
answer's `summary` ("Corporate down 12% vs last year", or null), the `kind` the answer showed (`chart`, `table`, `text`)
and the `hotel` when the scope was one hotel. The call is taken from the daily budget `thread_title`; with none left, or if
the model fails, the title is the cleaned question. A title the person gave (`renamed`) is never replaced.

- Over the socket: `{ type: 'meta', meta }` on connect when there is one, and once the first answer has one.
- `GET /api/kassandra/conversations?ids=a,b` (1–30 ids): `{ [id]: ThreadMeta }` for those that have one; writes a missing one.
- `PATCH /api/kassandra/conversations/:id` with `{ title }` (1–120 characters): the renamed `ThreadMeta`.
- `DELETE /api/kassandra/conversations/:id`: 204; the transcript, scope and meta are deleted. The app sends it once its Undo is gone.

All three: 60 requests a minute per client (`CONVERSATION_RATE_LIMIT`), the same cross-site and body rules as other writes.

## Kassandra: one-shot HTTP (scripts, evals)

`POST /api/kassandra/ask` with body `{ "conversation"?: string, "question": string, "mode"?: "quick" | "thinker", "scope"?: { "hotels": string[] } }` returns:

```json
{ "conversation": "…", "status": "done" | "unanswered", "text": "…", "reason": null, "durationMs": 7379, "mode": "thinker", "scope": ["AMS", "LIS"], "widgets": [] }
```

It waits for the whole answer, with no streaming. Use the WebSocket in the UI. `scope` in the answer is the scope that was applied (hotel codes; empty for the whole group). An invalid scope gets 400. `widgets` holds the widgets of this answer (`Widget[]`, the same objects the socket sends as `tool_result.widget`), in the order they were shown.

## Evidence: titles and columns

Every data tool's `evidence` says how to show its rows, so the panel never guesses from property names (`@compass/contracts` evidence.ts):

```json
{ "title": "Pace vs last year",
  "columns": [
    { "key": "hotel_code", "label": "Hotel", "kind": "hotel" },
    { "key": "rooms_otb", "label": "On the books", "kind": "count", "unit": "room nights" },
    { "key": "pace_pct", "label": "Pace vs last year", "kind": "percent" },
    { "key": "revenue_otb", "label": "Revenue on the books", "kind": "currency", "unit": "local currency" } ],
  "sourceLabels": { "hotel.pace_vs_stly()": "Pace against the same time last year" } }
```

- **`title`:** the tool's card title. It follows the call where a tool can show different things: `get_metric` → "Occupancy", "ADR vs last year"; `get_mix` → "Business mix by channel type"; `get_pnl` → "Profit and loss by line".
- **`columns`:** one entry per row property, in display order. A column never names a property the rows do not have, and every property has a column (a test runs every tool against the database for this).

| `kind` | The value | Show |
|---|---|---|
| `hotel` | a hotel code | the hotel's name from `GET /api/hotels` |
| `text` | a string; sometimes a boolean (`favourable`) or an object (`facts`, `mentions_by_hotel`, both hidden) | as it is |
| `date` | `YYYY-MM-DD` (`last_sync_at` is `YYYY-MM-DD HH:MM`) | a date; the label says what it is ("Week starting", "Period from") |
| `month` | the first day of a month, `YYYY-MM-01` | "Oct 2026" |
| `number` | a number that is not a count | with its decimals and `unit` ("index", "pts", "out of 10", "hours", "sqm") |
| `percent` | a percentage already in percent: `81.2` means 81.2% | with a `%` sign |
| `currency` | an amount | `unit` is `EUR`, or `local currency` where the tool returns the hotel's own currency |
| `count` | a whole number | grouped thousands; `unit` such as "room nights" |
| `id` | an identifier | hidden |

- **`hidden: true`** marks plumbing (ids, internal kinds, raw objects): leave it out of the table by default.
- **`pickup_pct`** of `get_pickup` is a share between 0 and 1 (`0.031` is 3.1% of capacity), not a percentage. Its column is `number` with the unit "of capacity (1 = all rooms)". Multiply by 100 to show it as a percentage.
- **`change`** of `get_metric` with `compare: "stly"` is in the metric's own unit; for a percentage metric it is in points (`kind: "number"`, `unit: "pts"`).
- **`sourceLabels`:** a human name for each entry of `sources` ("Daily hotel performance" for `hotel.v_hotel_day`). Show the label; keep the id for the SQL view.
- **`run_readonly_query`:** the columns are inferred from the property names and the values (`hotel_code` → `hotel`, `…_eur` → `currency` in EUR, `…_pct` → `percent`, `…_id` → hidden `id`, ISO dates → `date`, whole numbers → `count`). The labels are the property names in words ("Room revenue"). Treat them as a best guess.
- **`list_metrics`** now has an `evidence` too (title "Governed metrics"). `get_schema` returns no rows and has none.

## Widgets in answers

When a chart, a table or a KPI tile makes an answer clearer, Kassandra calls the `show_widget` tool after a data tool. The `tool_result` entry of that call carries `widget` (`Widget` in `@compass/contracts`):

```ts
type Widget = WidgetSpec & { rows: Record<string, unknown>[]; columns: EvidenceColumn[]; evidence: Evidence };

interface WidgetSpec {
  kind: WidgetKind;        // one of the 21 kinds below
  title: string;           // a conclusion: "Lisbon is 17.4% behind last year; 5 more hotels trail"
  subtitle?: string;       // the scope: hotels and period
  sourceCallId: string;    // the callId of the data tool_result the rows came from
  x?: string;              // column keys of `rows`; what they mean depends on the kind
  y?: string[];
  group?: string;
  compare?: string;
  forecast?: string;       // the forecast (P50) of the first y
  band?: [string, string]; // the likely range: low (P10), high (P90)
  target?: string;         // the budget or target
  limit?: string;          // a ceiling such as capacity
  format?: 'number' | 'percent' | 'currency' | 'count';
}
```

- **The model never supplies a number.** It picks the kind, the title, the subtitle and the column keys. The server reads the tool result that `sourceCallId` names back from the transcript and copies its `rows`, `columns` and `evidence` into the widget. So `widget.rows` are the rows of that data `tool_result`, and "How this was computed" for a widget is `widget.evidence`.
- **The server checks the fit.** Every key must be a column of those rows, `y`, `compare`, `forecast`, `band`, `target` and `limit` must be number columns, and the kind must suit the shape (the table below). A widget that does not fit never reaches the client: the model gets a sentence saying what is wrong and tries again or answers without it.
- **The spec is normalised.** It holds only the fields its kind uses. `format` is filled from the kind of the first `y` column when the model leaves it out (absent for a table, and for a plain number column).
- **`columns`** describe every column of the rows: `{ key, label, kind, unit?, hidden? }` with `kind` one of `text | hotel | date | month | number | percent | currency | count | id`. Use `label` for axis and legend names and `kind` and `unit` to format values. They come from the data tool's evidence when it names them, else they are read from the rows (key names and values).
- **Limits:** at most 400 rows per widget (20 hotels over 20 nights), at most 4 widgets per answer (the prompt asks for at most 3; a board view may show 4).
- **Order:** a widget belongs to the answer of its run. Show the widgets of a run under its final `assistant` entry, in the order of their entries.
- **Skeleton:** `live.tools` shows `show_widget` as `running` while the widget is being built.
- **Add to board:** send the widget to `POST /api/boards/:id/widgets` (see "Boards"), with the kind chosen in "View as" when the person switched it.

What each kind takes. `x`, `y`, `group` and `compare` are column keys; "label" columns are text, the rest are numbers.

| `kind` | Rows | `x` | `y` | `group` | `compare` |
|---|---|---|---|---|---|
| `kpi` | 1 | – | 1: the number | – | optional: last year, budget |
| `kpi_row` | 1 | – | 2–6: one tile per column (labels from `columns`) | – | – |
| `kpi_row` | 2–6 | label of each tile | 1: the number | – | optional |
| `gauge` | 1 | – | 1: a percent, or any number with `compare` | – | the target or maximum |
| `line`, `area` | ≥ 2 points | ordered: date, month or number | 1–6 lines; exactly 1 with `group` | optional: one line per value (≤ 20) | optional, with one `y` and no `group` |
| `sparkline_list` | ≥ 2 points per group | ordered | 1 | one sparkline per value (≤ 30) | – |
| `calendar_heatmap` | one per day | a day column (`YYYY-MM-DD`) | 1 | – | – |
| `bar` | 2–50, one per category | the category | 1 | – | optional |
| `grouped_bar`, `stacked_bar` | one per `x` (and `group`) | the category or period | 2–8 series; exactly 1 with `group` | optional: one series per value (≤ 12) | – |
| `pie`, `donut` | 2–7 parts of one whole | – | 1, not negative; a percent column must add up to 100 | the part's label | – |
| `treemap` | 2–60 parts | optional: the part's label when `group` is its parent (hotels inside regions) | 1, not negative | the part's label, or the parent when `x` is given | – |
| `table` | any | – | optional: the columns to show, in order (any kind) | – | – |
| `heatmap` | one per cell | across | 1: the cell value | down | – |
| `funnel` | 1–4, one funnel per row | label of each funnel (when > 1 row) | 2–8 stage columns in order, never growing | – | – |
| `funnel` | 2–8, one stage per row | the stage's label | 1, never growing down the rows | – | – |
| `waterfall` | 2–20, one step per row | the step's label | 1: the change (may be negative) | – | – |
| `bullet` | 1–20 | label (when > 1 row) | 1: the actual | – | required: the target |
| `scatter` | ≥ 3 | a number | 1 | optional: the point's label | – |
| `radar` | 1–6, one shape per row | label (when > 1 row) | 3–8 axes on one scale | – | – |
| `sankey` | 2–100, one per flow | the source | 1: the flow, not negative | the target | – |

A table without `y` shows every column that is not `hidden`.

**Forecast, range, budget and capacity.** Four optional column keys draw on top of a `line`, `area`, `bar` or `bullet`. Like the others they are columns of the rows, so the forecast is the data tool's, never the model's. A kind that does not draw one drops it.

| Field | `line`, `area` | `bar` | `bullet` |
|---|---|---|---|
| `forecast` | a dotted projection where the actuals stop: rows after today have `y` empty and `forecast` set, and a "Today" line marks where `y` stops | a dotted P50 line over the columns; `x` must be ordered (dates, months) | a hatched extension from the actual to the forecast |
| `band` | `[low, high]`, the P10–P90 range as a shaded band; low is never above high | the same; `x` must be ordered | – |
| `target` | `line` only: a labelled step line | a labelled step line | each row is drawn as a % of its own target (above 0 on every row), with a 100% line; `compare` is then last year, as a tick |
| `limit` | one labelled flat line at the first value in the column (capacity) | the same | – |

With `group` (a line per hotel) a line keeps only `limit`. A `bullet` needs `target` or `compare`; with `compare` alone, `compare` is the target, as before. Examples from `get_forecast`: by month, a `bar` with `y: rooms_on_books`, `forecast: rooms_p50`, `band: [rooms_p10, rooms_p90]`, `target: budget_rooms_sold`; by hotel with grain `total`, a `bullet` with `target: budget_rooms_sold`, `forecast: rooms_p50`, `compare: rooms_on_books_stly`.

**One check, both sides.** These rules are `fitWidget(spec, { rows, columns })` in `@compass/contracts` (`widget-fit.ts`; the entry `@compass/contracts/widget-fit` loads it without zod). The Worker runs it in `show_widget` and on `POST /api/boards/:id/widgets`; the app runs the same function for "View as" and for the instant preview.

### "View as": other kinds for the same rows

Under every chart (answers, boards, `/catalog`) a row of buttons lists the kinds its rows can be shown as. It is client-side and instant: the rows do not change, only the column roles (`charts/kinds.ts` in the app).

- `compatibleKinds(spec, rows, columns)` → `{ kind, reason, spec }[]`. Each option carries a spec that passes `fitWidget`, so a switched chart can always be saved. The widget's own kind is always there, as it is, and marked **Recommended**: Kassandra's choice, or the preview's.
- `recommendKind(rows, columns, hint?)` is the first look at rows nobody described (the instant preview). `hint` carries a kind and columns already known; its kind wins when the rows allow it.
- Nothing is computed, aggregated or pivoted. A kind that draws one number is offered only for a chart of one number (with its comparison), so a switch never leaves a series out. The table shows every column.
- The choice is remembered per widget in this browser (`localStorage`, key `compass.view-as.v1`: `answer:<call id>`, `board:<widget id>`). **Add to board** sends the spec on screen, with the chosen kind.

What a kind needs before it is offered, on top of the table above:

| Kind | Offered when |
|---|---|
| Table | always (any rows, up to 200) |
| Number (`kpi`), Gauge | one row and one number; a gauge needs a percentage between 0 and 100, or a comparison to hold it against |
| Tiles (`kpi_row`) | one row with 2–4 numbers; or 2–4 named rows of one number |
| Bullet | one number with a comparison (budget, last year), up to 20 named rows |
| Bar | one number, one row per category, 2–50 rows (up to 31 along a date) |
| Grouped bar | 2–6 numbers on one scale per category, or one number split by a second column into 2–6 series; up to 24 categories |
| Stacked bar | as grouped, and only parts that add up: counts or money, none below zero |
| Line, Area | an ordered x (date, month or number) with at least 2 points; up to 6 lines |
| Sparklines | an ordered x and a second column that splits one number into up to 30 series |
| Calendar | one number per day (`YYYY-MM-DD`), at least 7 days |
| Donut, Pie | 2–7 parts of one whole: counts or money (never a rate, an average or a score), or percentages that add up to 100; none below zero, at least two above |
| Treemap | 3–60 parts, same rule for what a part is |
| Funnel | 2–8 stages in order that only shrink, in a column that names stages |
| Waterfall | 2–20 ordered steps that add up, with both signs or rows that mark their totals; never percentages |
| Scatter | two different numbers per row, at least 3 rows |
| Heatmap | two columns that together name each row, at least 2 values each, and one number |
| Radar, Flow (`sankey`) | only when the widget came as one |

### Instant previews in the Thread

In the Thread a chart does not wait for `show_widget` (`kassandra/live-slots.ts` and `kassandra/preview.ts` in the app; no model, no server change):

1. A data tool call starts (`live.drafting`, then `live.tools`): a neutral skeleton takes its place in the answer.
2. Its `tool_result` lands with `rows` and `evidence.columns`: the skeleton becomes a chart of the kind `recommendKind` picks, titled by `evidence.title`, marked "Preview". The numbers are the tool's rows.
3. Kassandra's `show_widget` for that result (`sourceCallId`) lands: the same card takes her kind, title and subtitle. If the kind is the same, only the words change. While she is still writing the call, her title shows over the preview (`live.drafting`); once the call is committed the app runs `fitWidget` on her arguments and draws her chart before the result confirms it.
4. If she shows no widget for a result, its preview stays as the answer's chart once the answer is final.

- **No preview** for reference tools (`list_hotels`, `list_metrics`, `get_schema`, `get_data_health`, `get_brief`, `find_reviews`, `search_reviews`), for rows that only read as a table, for no rows or more than 200, and for a run that stopped without an answer.
- **A re-read redraws in place.** A second call of the same tool with the same arguments apart from its scope (`hotels`, `from`, `to`, `daysAhead`, `limit`, …) is the same reading: its rows replace the earlier preview in the same card.
- **At most 3 charts per answer.** Kassandra's own widgets always show (a board view may have 4); previews take what is left, first come first.
- Previews are on in the Thread only (`<kassandra-conversation [previews]="true">`). A workflow's run log and a board's "Describe a view" show only what Kassandra chose.

## Boards

Boards are saved on the server, one set for the whole group (no login: every visitor sees and edits the same boards). A board holds widgets copied from answers. Types: `Board`, `BoardWidget`, `BoardSummary`, `BOARD_LIMITS` and the request schemas `BoardCreate`, `BoardPatch`, `BoardWidgetCreate` in `@compass/contracts`.

```ts
interface Board { id: string; name: string; description: string; hotels: string[]; widgets: BoardWidget[]; createdAt: string; updatedAt: string }
interface BoardWidget { id: string; spec: WidgetSpec; rows: Record<string, unknown>[]; columns: EvidenceColumn[]; evidence: Evidence; question?: string; addedAt: string }
```

| Method | Path | Body | Answer |
|---|---|---|---|
| GET | `/api/boards` | – | `BoardListItem[]`, oldest first. Each widget is `{ id, spec, question?, addedAt }`: no rows, columns or evidence. `preview` holds the first 4 widgets as `{ id, spec, columns, rows }` with only the columns the spec draws and at most 40 rows (a long series thinned evenly; a calendar whole up to 92 days; a table its first 5 rows): what the board's card draws. |
| POST | `/api/boards` | `{ name, description?, hotels? }` | 201 `Board` (no widgets yet) |
| GET | `/api/boards/:id` | – | `Board` with every widget in full |
| PATCH | `/api/boards/:id` | `{ name?, description?, hotels?, order? }` | `Board` |
| DELETE | `/api/boards/:id` | – | 204 |
| POST | `/api/boards/:id/widgets` | `{ spec, rows, columns, evidence, question? }` | 201 `BoardWidget` |
| DELETE | `/api/boards/:id/widgets/:widgetId` | – | 204 |

- **Fields.** `name` is 1–80 characters, `description` at most 300, `hotels` at most 40 hotel codes (empty = the whole group). Unknown fields are refused.
- **`order`** reorders the widgets: it must list every widget id of the board exactly once.
- **Add to board.** Send a `Widget` from an answer: `spec` is the widget without `rows`, `columns` and `evidence`, which go next to it; `question` is the question that was asked (at most 2000 characters). The server checks the widget against its rows with the same rules as `show_widget`, so a widget that came from an answer always passes. The answer is the stored `BoardWidget` with its new `id`. "Undo" is `DELETE` on that id.
- **Limits.** 50 boards, 24 widgets per board, 400 rows per widget, 256 KB per widget body.
- **Errors.** 400 with the reason (`{ "error": "name: Too small: …" }`) for an invalid body or a widget that does not fit its rows; 404 for an unknown board or widget; 409 at a limit ("A board holds at most 24 widgets. Remove one and try again."); 413 for a body over the limit; 429 from the rate limit or the daily budget.
- **Write limits.** Writes follow the same-origin rule above, a rate limit of 60 changes per minute per client, and the daily `board_write` budget (600 per UTC day for all visitors). Reads are not limited. A body with the wrong shape is refused before it counts against the budget.
- **Sample boards.** The first request seeds three boards from the database, so the page is never empty: `portfolio` ("Portfolio overview", 5 widgets), `dubai-business-bay` (4) and `amsterdam-web` (4). Their widgets are built by the same data tools Kassandra uses, with periods relative to the business date at the time of seeding; their `sourceCallId` starts with `seed:` and `question` is the question that gives the same view in Kassandra. That first request takes a few seconds. A sample board that is deleted stays deleted.
- **`sourceCallId` on a board** names the tool call in the conversation the widget came from. It is kept for reference only: the board has its own copy of the rows.

### "Describe a view"

The person describes what a board should show; Kassandra answers with widgets, and the client adds them to the board.

1. Ask Kassandra with the text `Build a board view: <the description>` (Thinker mode). Use the chat socket, so the person sees the steps, or `POST /api/kassandra/ask`, whose answer has `widgets`. It counts as one question.
2. For that prefix Kassandra returns 2 to 4 widgets (a headline number or ranking, a trend, a breakdown) and one or two sentences that name what the view shows. A hotel scope on the question applies as to any other question.
3. For each `widget` of the answer, `POST /api/boards/:id/widgets` with `{ spec, rows, columns, evidence, question: <the description> }`. Keep the returned ids for the receipt and its Undo (`DELETE` each).
4. If the answer has no widget (the data cannot show what was asked), show its text.

The description is the person's own text; send it only on their action, like any question.

## Morning brief

- **`GET /api/brief`** returns the latest `Brief` (`@compass/contracts` brief.ts):
  - `{ businessDate, generatedAt, items, model, usage }`;
  - each item is `{ id, kind, hotel_code, hotel_name, severity, impact_eur, impact_basis, title, facts, question, sources, summary? }`.
- **Order:** `critical` items (a stale data feed) come first, then items by absolute EUR impact.
  - `impact_eur < 0` is revenue lost or at risk;
  - `impact_eur > 0` is revenue left on the table.
- **What the AI does:** fixed SQL detectors find the items. The model (Claude Haiku) only writes `summary` from the item's facts, so show the AI label on `summary`. If the model fails, `summary` is absent: fall back to `title`.
- **"Explore":** open Kassandra with `item.question`.
- **Regeneration:** a cron regenerates the brief every morning at 05:00 UTC. `POST /api/brief/refresh` regenerates it now (rate-limited).

### The numbers around the brief: `GET /api/brief/overview?hotels=LIS,AMS`

Everything the brief page shows besides the findings, for a hotel scope, in one read: `BriefOverview` (`@compass/contracts` brief-overview.ts). About fifteen read-only queries, no model: every number is computed in SQL.

- **`hotels`** (optional): hotel codes separated by commas, in any letter case. Left out, empty, or naming every hotel: the whole group. A code the group does not have gets 400 with the scope's own message ("The scope names a hotel the group does not have: XXX.").
- **Limits:** 30 reads per minute per client (429 `{ error }`). The answer is kept for a minute per scope and carries `Cache-Control: private, max-age=60`.
- **Conventions:** ratios come from sums over the scope's hotels, never from averaging hotel ratios. Money is in EUR at the business date's rate, for this year and for last year alike, so a move in a currency does not read as a move in trade. "Last year" for nights on the books is the same weekday 364 days earlier at the same lead time (STLY).

```ts
interface BriefOverview {
  businessDate: string;             // the data's "today"
  hotels: string[];                 // the scope applied; [] is the whole group
  pulse: BriefPulse | null;
  nights: BriefNights | null;
  pickup: BriefPickup | null;
  money: BriefMoney | null;
  health: BriefFeed[] | null;
  charts: Record<string, BriefChart>; // by brief item id
  failed: string[];                 // parts that could not be read
}
```

- **A part that fails is `null` and named in `failed`** (`pulse`, `nights`, `pickup`, `money`, `health`, or `chart:<item id>`); the rest still answers with 200. Show an error with Retry for that part only. If the database cannot be reached at all, every part is failed and `businessDate` is `""`.
- **`pulse.tiles`** (`PulseTile[]`), in this order:

  | `key` | What | `unit` | Period | Compared with |
  |---|---|---|---|---|
  | `occupancy` | rooms on the books ÷ rooms available | `percent` | next 30 nights | same time last year, in points (`deltaUnit: 'pp'`) |
  | `adr`, `revpar`, `room_revenue` | on the books | `eur` | next 30 nights | same time last year, in % |
  | `pace` | room nights on the books | `count` | next 30 nights | same time last year, in % |
  | `total_revenue`, `trevpar`, `gop` | the P&L | `eur` | the last closed month | the same month a year earlier, and `also` the month's budget |
  | `gop_margin` | GOP ÷ total revenue | `percent` | the last closed month | a year earlier and `also` budget, in points |

  Each tile has `value`, `compare`, `delta` with its `deltaUnit`, `period` ("Next 30 nights", "Oct 2026"), `basis` ("same time last year", "Oct 2025"), a one-sentence `definition`, and `series` (a point per night, or per month for the last twelve closed months, each `{ x, value, compare }`). The P&L tiles are left out when the scope has no closed month. A percentage is already in percent (`53` is 53%).
- **`nights`**: the next 14 nights. `total` has a row per night for the scope (`rooms_available`, `rooms_otb`, `rooms_otb_stly`, `occupancy_pct`, `occupancy_stly_pct`, and how many hotels have an event or a flagged rate: `events`, `rate_flags`). `hotels` has a row per hotel and night, with `bar_rate` in the hotel's `currency`, `bar_vs_comp` (1.00 = at the comp set's median), `comps_sold_out`, the city `event` if there is one, and `rate_flag`:
  - `underpriced`: under 0.85× the median while two or more competitors are sold out or the night is over 70% full (the brief detector's own rule);
  - `overpriced`: over 1.25× the median while the night has under 85% of last year's rooms on the books.
- **`pickup`**: the 7 days up to the business date. `byDay` has room nights `booked` and `cancelled` on each booking day, `net`, and `net_ly` (the same weekday last year). `byHotel` has the same for the 7 days per hotel, with `revenue_eur` booked.
- **`money`**: room revenue on the books for the next 30 nights. `byHotel` has `revenue_eur`, `revenue_stly_eur`, `change_eur`, `change_pct` and the hotel's `region`; `byWeek` has the scope's revenue per stay week (weeks start on Monday).
- **`health`**: every source system of the scope's hotels (`system`, `vendor`, `status`, `last_sync_at`, `days_behind`), the ones that are not `ok` first.
- **`charts`**: one chart per brief finding in scope, by the finding's `id`. A `BriefChart` is a widget of the catalogue without `sourceCallId`: `{ kind, title, subtitle?, x?, y?, group?, compare?, format?, rows, columns, sources }`. Draw it with `<juyo-widget-chart>` like any other widget; every chart passes the fit rules of "Widgets in answers" (a test checks this).

  | Finding | `kind` | Rows |
  |---|---|---|
  | `pace_behind` | `line` | room nights on the books for the next 45 nights as of each of the last 57 days, with the same point last year as `compare` |
  | `underpriced_demand` | `bullet` | our rate against the comp set's median per flagged night (and a night either side), in the hotel's currency |
  | `account_loss` | `bar` | the account's room nights per month, for the last twelve full months |
  | `web_conversion_drop` | `funnel` | sessions → searches → checkout starts → bookings on that device for the last 30 days; the 30 days before are in the rows (`visits_before`) and in the `subtitle` |
  | `staffing_gap` | `grouped_bar` | hours needed and hours worked per week, for the last eight whole weeks |
  | `rooms_out_of_order` | `calendar_heatmap` | rooms out of order per day, from two weeks back to eleven weeks ahead |
  | `gop_miss` | `waterfall` | budgeted GOP → each revenue line against budget → all costs → actual GOP (`kind` marks the totals; an `Unallocated` step holds what the budget does not split by line) |
  | `data_stale` | `bar` | for a POS feed, F&B covers per day for the last 14 days; other feeds have no chart |

  The findings come from the stored brief (`GET /api/brief`), so the ids match the items the page shows. A finding with fewer than two rows to draw has no chart.

## Workflows (Act)

Agents that watch the numbers, propose an action and act once a person approves. Each run is a durable Pi session. While it waits for approval it holds no compute, and the wait survives deploys. Compass is read-only: an approved action is handed to the revenue manager as an RMS task and written to the audit log.

| Method | Path | What |
|---|---|---|
| GET | `/api/workflows` | `Workflow[]`. Five templates are seeded on first use, one per brief finding. |
| POST | `/api/workflows` | Create from a `WorkflowSpec` (e.g. a Kassandra draft). Returns `Workflow`. At most 30 **enabled** workflows: a create (or a PATCH that turns one on) beyond that gets 409 "The demo runs at most 30 active workflows. Turn one off and try again." Workflows that are off do not count. At 100 stored workflows, a create deletes the oldest one that is off and was not a template. |
| GET | `/api/workflows/:id` | `{ workflow, runs, proposals }` |
| PATCH | `/api/workflows/:id` | Change fields, e.g. `{ "enabled": false }` or `{ "autonomy": "suggest" }`. The recipient of an email workflow cannot be changed (400). |
| POST | `/api/workflows/:id/duplicate` | A copy as a new `Workflow`: `createdBy: "user"`, `enabled: false`, the name with " (copy)" (cut to 80 characters), no runs and no emails counted. An email workflow's copy keeps the recipient (masked in the answer). 404 for an unknown id. |
| DELETE | `/api/workflows/:id` | 204. The workflow is gone; its runs, proposals and audit entries stay, each with `deletedWorkflowName`. 409 while a run of it is in progress or a proposal of it waits for a decision: decide it first. 404 for an unknown id. |
| POST | `/api/workflows/:id/run` | Run now ("Run now" button). Returns `WorkflowRun`. Rate-limited and budgeted. 409 while the workflow has a run in progress. |
| GET | `/api/runs/:runId` | `{ run, entries: ChatEntry[] }`: the run's log, projected like the chat. |
| GET | `/api/proposals?status=pending` | The approval inbox: `Proposal[]` with `change: { before, after, scope }`, `rationale`, `impact_eur`, `risk`. |
| POST | `/api/proposals/:id/decision` | `{ "approved": true, "by": "Compass user (web)", "note": "" }` → `DecisionReceipt`: `{ proposal, handedTo, receipt }`. See "Decisions". Budgeted. |
| POST | `/api/proposals/:id/undo` | `{ "by": "…" }` takes a decision back: a sent one gets a task to reverse it, a dismissed one waits for a decision again. Answers the `AuditEntry` it wrote. |
| GET | `/api/audit` | `AuditEntry[]`, newest first. |

### Decisions

Compass is read-only. Sending a decision on changes no rate, channel or booking: it hands a task to a named person at the hotel and writes the audit log. **No email is sent for a decision.**

- **`POST /api/proposals/:id/decision`** with `approved: true` ("Send to revenue manager" in the app) records the handover at once and answers:

  ```json
  { "proposal": { "id": "prop-…", "status": "applied", "decidedBy": "Compass user (web)", "decidedAt": "2026-11-21T00:49:01.000Z", "…": "…" },
    "handedTo": { "name": "Ana Pop", "email": "ana.pop@halcyon.example.com", "role": "revenue_manager", "roleLabel": "Revenue manager", "hotel": "Arbor Lisbon Chiado", "hotel_code": "LIS" },
    "receipt": "RMS task rms-mwpowu03-8 for Ana Pop (Revenue manager, Arbor Lisbon Chiado): Lower BAR … (BAR 145–220 EUR → Cap at about 1.2x comp median, …)." }
  ```

  - `proposal.status` is `applied` straight away (it used to be `approved` until the agent woke and applied it). The agent behind it still gets the decision as a durable signal; it is told the task is already handed over and writes nothing over it.
  - `handedTo` is the person whose job that kind of action is: the hotel's **revenue manager** for `adjust_bar`, `close_channel`, `open_channel` and `contact_account`, its **general manager** for `create_task` and `notify`. It is `null` for a hotel the roster does not know; the receipt then names the role and the hotel code.
  - The same entry goes to the audit log (`outcome: "sent_to_rms"`) with `handedTo` on it. Actions an agent applies on its own (`auto_low_risk`) are logged the same way.
- **With `approved: false`** ("Dismiss") nothing is sent: the proposal becomes `denied`, the audit log gets an entry with `outcome: "dismissed"`, and the answer is `{ proposal, handedTo: null, receipt: "Dismissed. Nothing was sent." }`.
- **`POST /api/proposals/:id/undo`** takes either back and answers the audit entry it wrote (`outcome: "undone"`):
  - a sent one (`applied`): the same person gets a task to reverse it (`handedTo` on the entry), and the proposal becomes `undone`;
  - a dismissed one (`denied`): the proposal is `pending` again and can be decided again. By then its agent's run has usually ended; the decision is then recorded without a signal.
  - anything else: 409 "Only a decision that was sent or dismissed can be taken back."
- **Errors:** 404 for an unknown proposal; 409 "This decision has already been made. Reload to see the latest." for one that is not `pending`; 409 when the agent is still waiting and the signal could not be delivered.
- **The roster** is `DEMO_TEAM` in `@compass/contracts` (team.ts): a fictional revenue manager and general manager per hotel, with addresses on `halcyon.example.com` (a reserved domain: nothing can be delivered there). `recipientFor(hotelCode, action)` gives the `Handover` for a decision; the app uses the same constant when it talks to a server from before this change.
- **`AuditEntry`** gained `handedTo?: Handover` and the outcome `dismissed`.

**Autonomy** (per workflow) is how trust is earned gradually:
- `suggest` only records proposals;
- `approve` waits for a person;
- `auto_low_risk` applies low-risk actions (tasks, notifications) alone and asks for prices or channels. `adjust_bar`, `close_channel` and `open_channel` are always high risk, whatever the agent says.

**Proposal status:** `pending → applied` when a person sends it on (`approved` is only seen on the agent's own path, between its approval and its `apply_action`), or `denied` (dismissed), `auto_approved`, `suggested`, `undone`. `superseded` means the agent replaced the proposal with an amended one, for example to meet a condition in the approver's note.

**Run status:** `running → waiting_approval → running → done | failed`. Poll `/api/runs/:id` or `/api/proposals?status=pending` every few seconds. A run that stopped without being recorded (a deploy in the middle of it) is settled the next time it is read or its workflow is run: after 15 minutes with no live session it becomes `failed`.

**After a delete:** `GET /api/proposals`, `GET /api/audit` and `GET /api/runs/:runId` still return what the workflow did. `workflowId` no longer resolves (`GET /api/workflows/:id` is 404), so show `deletedWorkflowName` ("Event pricing watch") in its place. The five templates are created once: deleting them all leaves an empty list.

**First runs.** The first time the workflows or the proposals are read, each enabled workflow that waits for a brief finding, has never run and has its finding in today's brief runs once, in the background. So the approval inbox has a real pending proposal (Dubai Business Bay's event nights priced under the market) without waiting for the 05:00 cron: poll `GET /api/proposals?status=pending`. In a local run the proposal was there about 15 seconds after that first read; allow up to a minute. It happens once. Email workflows are never started this way, at most five runs start, and each takes from the daily `workflow_run` budget; if that is spent the rest waits (retried at most every 10 minutes).

**From chat:** Kassandra's `draft_workflow` tool returns a `tool_result` entry with `draft: WorkflowSpec`. Show it as an editable card; **Save** sends it to `POST /api/workflows`.

**Schedule:** every morning at 05:00 UTC the cron regenerates the brief, then runs the enabled workflows whose trigger matches a brief finding for their hotels, plus the scheduled ones that are due. A daily workflow (`every: 'day'`) is due every morning. A weekly one (`every: 'week'`) first runs at the first 05:00 UTC cron after it was created, then again when 7 days have passed since its last run. The check allows 12 hours of tolerance (6.5 days), so a cron that fires a few seconds early does not push the week to 8 days. "Last run" is the latest run that was not a test, whoever started it and however it ended: a run that failed and a run that found nothing to send both count, so the workflow then waits a week.

## Workflow builder: WebSocket

```
wss://juyo.razvanfrandes.com/api/workflows/builder/ws?draft=<id>
wss://juyo.razvanfrandes.com/api/workflows/builder/ws?draft=<new id>&workflow=<workflow id>     (edit a saved workflow)
```

Kassandra builds a workflow with the person. The chat is on one side and the workflow, as a chain of nodes, on the other. The agent fills in one node per tool call; the person can also edit a node by hand.

- **Draft id:** 16–64 letters, digits, `-` or `_` (400 otherwise). Pick it on the client with `crypto.randomUUID()` and keep it in the URL to come back to the draft. Each draft is one Durable Object, which keeps the conversation, the draft and the id of the workflow it was saved as.
- **Keep the id private.** The id is the only key to the draft: whoever has it sees the conversation and the draft, including the email address in full. That is accepted because the holder is the person who typed the address, and a random UUID cannot be guessed. Never use a short or predictable id, and do not list or share draft ids.
- **Origins:** as the Kassandra socket.
- **Chat:** the socket speaks the Kassandra protocol above (`snapshot`, `entries`, `live`, `error`; `ask`, `steer`, `abort`), so the chat UI is reused. `snapshot.conversation` is the draft id. `ask` takes no `mode`: the builder always uses Claude Sonnet 5.5.
- **Scope:** `ask` takes the same `scope` as Kassandra's. The data tools then read only those hotels, and the agent sets those hotels on a new workflow unless the person names others.
- **Types:** `BuilderServerMessage`, `BuilderClientMessage`, `WorkflowDraft`, `WorkflowGraph`, `specToGraph` in `@compass/contracts`.

### Editing a saved workflow

"Edit" on a workflow opens the builder with a **new** draft id and `&workflow=<id>` (1–64 letters, digits, `-` or `_`; 400 otherwise).

- The server loads the workflow into the draft and binds the draft to it: the first `draft` message has the whole chain, `workflowId` set to that workflow, and no `issues`.
- **Save** then updates that workflow. If the person types another address, the save creates a new workflow and turns the old one off, as for any draft.
- **The address stays on the server.** The draft holds the real recipient, but `draft.delivery.to` reads masked (`si****@gmail.com`) for as long as it is the saved one. An address the person types in this draft shows in full. To keep the address, leave `delivery` out of an `edit`, or send the masked one back: the server reads it as the saved address.
- The transcript gets one `event` entry, `app.loaded`, with `data: { name, chain }`, so the agent knows what is on the canvas. Show it like `app.edit` or leave it out.
- `&workflow=` only loads into an empty draft. Reconnecting with the same URL keeps the draft as the person left it. If the workflow is gone, the draft stays empty and you get an `error` message ("That workflow no longer exists.").

### Server → client, on top of the chat messages

| `type` | When | Payload |
|---|---|---|
| `draft` | right after the snapshot, and after every change (a tool call, an `edit`, a `save`) | `draft`, `graph`, `changed`, `workflowId`, `issues` |
| `run` | while a test run is going, each time its place on the graph changes | `runId`, `status`, `activeNode`, `done`, `failed` |

`draft`:
- `draft: WorkflowDraft` — a `WorkflowSpec` with any part still missing. Replace the previous one.
- `graph: { nodes, edges }` — the same draft as a chain (`specToGraph(draft)`; you can also compute it on the client). Positions are the canvas's job.
- `changed: string[]` — ids of the nodes that are new or read differently. Highlight or animate them. Empty on connect and after a save.
- `workflowId: string | null` — set once the draft is saved.
- `issues: string[]` — why it cannot be saved yet, as `path: message`. Enable **Save** and **Send test** when it is empty.

Nodes, in chain order:

| `id` | `kind` | From the draft | Example `label` |
|---|---|---|---|
| `trigger` | `trigger` | `trigger` | "Every morning, after the brief" |
| `scope` | `scope` | `hotels` | "LIS" / "All 20 hotels" |
| `check:<tool>`, one per check (`check` while there is none) | `check` | `checks[]` | "Pace vs last year" (from `CHECK_LABELS`; the tool name is only in the `id`, the `detail` is "Read first on every run") |
| `analyze` | `analyze` | `goal` | "Kassandra explains why" |
| `approval` | `approval` | `autonomy`, `approver` | only when the action needs approval; an email does not |
| `action` | `action` | `action`, `delivery` | "Email si****@gmail.com" |

Each node is `{ id, kind, label, detail, state }`. `state` is `empty` (a placeholder: nothing chosen yet), `draft` (a value that is not complete or valid yet) or `complete`. The whole chain is there from the first message and fills in. Ids are stable across edits. Labels show the address masked.

`run`:
- `status` — the run's status (`running`, `done`, `failed`; `waiting_approval` for a workflow whose action needs approval);
- `activeNode` — the node the run is on, or `null` once it has ended (or the mail is out and the agent is writing its summary);
- `done` — the nodes it finished, in chain order;
- `failed` — the node a failed run stopped on, else `null`.

A run walks the chain: `trigger` and `scope` are done at once; a check is active from its tool call to its result; `analyze` is active while the agent thinks or reads other data, but only once a check has finished (or the workflow has no check): before that, text and other tool calls keep the first check active, so the active node never moves backwards; `action` is active while the mail is being sent, and done **only when a mail went out**. A test that reaches the hourly limit ends `done` without `action` in `done`; read why in `GET /api/runs/:runId` (`run.summary`). The server polls the run once a second, so a quick step can be skipped. It follows a run for at most 3 minutes, and stops when no socket is open on the draft. A run that reaches `waiting_approval` is not followed further: the `run` message with that status is the last one, and the approval inbox takes over. After 3 minutes you get a last `run` message with `status: 'failed'` and `failed` set to the node the run was on, and an `error` message ("The test run is taking too long; check the run log."). The run itself may still finish: `GET /api/runs/:runId` has the truth.

### Client → server, on top of the chat messages

```json
{ "type": "edit", "patch": { "trigger": { "kind": "schedule", "every": "week" } } }
{ "type": "edit", "patch": { "action": { "type": "notify" }, "delivery": null } }
{ "type": "save" }
{ "type": "test" }
```

- **`edit`:** a manual change on the canvas.
  - `patch` holds whole fields of the workflow (`trigger`, `hotels`, `checks`, `name`, `goal`, `action`, `delivery`, `approver`, `autonomy`, `enabled`, `description`). A field set to `null` is removed.
  - Every field is validated. If one is invalid, nothing is applied and you get an `error` message with the reason.
  - On success everyone on the draft gets a `draft` message. Nothing is added to the transcript at that moment.
  - With the next `ask` or `steer`, the transcript gets **one** `event` entry `app.edit` for all the edits since the last question, with `data: { changed, chain }` (the nodes edited and the chain as it now reads). The agent reads it, so it builds on the edits.
  - At most 30 edits per minute per client; over that you get an `error` message.
  - `checks` may only name data tools (the 25 tools of `/mcp`), at most 8.
- **`save`:** saves the draft as a workflow. Refused with an `error` while `issues` is not empty. The first save creates the workflow; you get a `draft` message with its `workflowId`. A later save updates that workflow; a field removed from the draft since the last save goes back to its default in the workflow too. If the address changed (or was added or removed), the save creates a **new** workflow, turns the old one off, and `workflowId` changes. If the old one cannot be turned off you get the `draft` message with the new id and then an `error` saying so.
- **`test`** ("Run a test"): saves if needed, then runs the workflow once as a test and sends `run` messages. An email workflow always sends on a test, with the subject `Test run · <name> · Compass`, and the mail says whether the workflow would have fired today.
  - One test at a time: a `test` sent while a run is going gets an `error` message, and the socket stays open.
- **Limits:** `ask` and `steer` share Kassandra's limit (6 per minute per client) and the daily `question` budget. `test` counts against the daily `workflow_run` budget and has no per-minute limit: it is bounded by that budget, by one test at a time per draft, and by the email limits below. A message is at most 16 KB. Over a limit, the server sends an `error` message.

### Email workflows

- **One recipient** per workflow, set when it is saved. `PATCH` cannot change it.
- **Masked everywhere outside the builder socket:** `GET /api/workflows`, `/api/workflows/:id`, the answers of `POST` and `PATCH`, the audit log and the graph labels show `si****@gmail.com`.
- **Fixed template:** the model writes the summary (at most 500 characters) and picks the facts; it never chooses the recipient, the subject or the layout. The subject is always `<name> · Compass` (the name cut to 60 characters). Every link and domain in the name and in what the model wrote is replaced by `[link removed]`; only links to the app itself stay. The channel names written like a domain (`Booking.com`, `Expedia.com`, `Hotels.com`) stay as plain words, in any letter case; with a scheme, `www.`, a subdomain, a port, a path or an `@` they are removed like any link.
- **Limits:** 3 emails per hour and 6 per UTC day per address, 10 per hour per client, 50 per UTC day for the whole demo. "Run now" and a test count for the client that asked; the morning cron's runs have no per-client limit. Over a limit, the run ends `done`, sends nothing and says so in its summary.
- **Lifetime:** a scheduled email workflow turns itself off after 7 days or 5 emails, whichever comes first. The last mail says so, also when the 7 days will be over before the workflow's next run. The next run is the next 05:00 UTC cron for a daily workflow and for one on a brief finding, also when a person started this run. For a weekly workflow it is the first 05:00 UTC cron at least 6.5 days after this run started: 7 days after a morning run, up to 8 after a run started later in the day. So a weekly email workflow that nobody runs by hand sends one mail, the morning after it was created, and that mail says it is the last: the next weekly run would fall after the 7 days. When a person runs it first, the cron's run about a week later can still fall inside the 7 days, and then that one is the last. Test runs are not counted, only the hourly and daily limits.
- **`/workflows/new?describe=<text>`** opens the builder on a new draft with `describe` in the chat's field (at most 600 characters). Like `/ask?q=`, it only fills the field: the person edits it, adds what is theirs (an address) and presses send. "Watch this" on a brief finding uses it.
- **"Ask Kassandra about this"** in the mail links to `https://juyo.razvanfrandes.com/ask?q=<question, URL-encoded>`. This is a contract for the app: the route `/ask` must open Kassandra and **pre-fill** the composer with the question from `q`. It must not send it: the person reads the question and presses send. (Anyone can make such a link, so opening one must never spend a question or act on its own.)

## Voice input (Soniox)

**`POST /api/voice/token`** (no body) returns a `VoiceToken` (`@compass/contracts` voice.ts) for one dictation:

```json
{ "apiKey": "snx_temp_…", "expiresAt": "2026-11-21T10:02:00.000Z", "model": "stt-rt-v6", "wsUrl": "wss://stt-rt.soniox.com/transcribe-websocket" }
```

- **The key** is a temporary Soniox key: single use (one connection), to be used before `expiresAt` (120 seconds), for at most 180 seconds of audio. Ask for one when the person presses the microphone, after the browser has granted it. Never store it. The answer is `Cache-Control: no-store`.
- **Limits:** 10 per minute per client (429 `{ error }`), and the daily `voice` budget of 300 for all visitors (429 with `resetsAt`).
- **Not available:** 503 `{ "error": "Voice input is not available right now. Type your question instead." }` when the Worker has no Soniox key or Soniox refuses. Fall back to Web Speech, or hide the microphone.
- **Using it** (Soniox's real-time API, as documented on 2026-11-20):
  1. `new WebSocket(wsUrl, ['soniox-api-key', apiKey])`. The key goes in the subprotocol list; do not put it in the first message (`api_key` there is deprecated).
  2. Send one JSON text message: `{ "model": model, "audio_format": "auto", "language_hints": ["en", "ro"], "enable_language_identification": true, "enable_endpoint_detection": true }`.
  3. Send the microphone audio as binary frames (`MediaRecorder` chunks). `auto` detects webm and ogg among others; Soniox's list does not name mp4, which Safari records, so test Safari or send raw PCM (a raw format needs `sample_rate` and `num_channels`; see Soniox's audio formats).
  4. Read `{ "tokens": [{ "text", "is_final", … }] }` messages: show the non-final tokens as the live tail and append the final ones to the composer.
  5. End with an empty text frame (`ws.send('')`) and wait for `{ "finished": true }`. An error arrives as `{ "error_code", "error_type", "error_message" }` and the socket closes.
- **Content Security Policy:** the app's `connect-src` (`apps/web/public/_headers`) must allow `wss://stt-rt.soniox.com`, or the browser refuses the socket.

## MCP (public, read-only)

`https://juyo.razvanfrandes.com/mcp` (Streamable HTTP) exposes 25 data tools. Kassandra uses the same tools.

- **Reference:** `list_hotels`, `list_metrics`, `get_schema`, `get_data_health`.
- **Commercial:** `get_metric`, `get_kpis` (the headline figures in one row, with last year), `get_pace`, `get_pickup`, `get_rate_position`, `get_channel_mix`, `get_mix`, `get_account_production`, `get_inventory`, `get_web_funnel`.
- **Finance and forecast:** `get_pnl` (USALI P&L vs budget and last year, GOP margin, flowthrough), `get_forecast` (P10–P90 range vs on the books and budget), `get_lost_business` (price regrets vs denials).
- **F&B, M&E and guests:** `get_fnb`, `get_labor`, `get_meetings_events`, `get_review_scores`, `find_reviews` (by meaning), `search_reviews` (exact phrase).
- **Brief and escape hatch:** `get_brief`, `run_readonly_query`.
- **Shapes for charts.** Some tools return the same numbers in the shape a widget needs, always computed in SQL:
  - `get_pnl` with `view: "bridge"` (and `against: "budget" | "ly"`): the steps from budget GOP to GOP for one hotel or roll-up (`step`, `kind`, `amount_eur`), which a waterfall draws. The budget plans GOP on its own, so what its lines do not add up to is the step "Unallocated in budget".
  - `get_channel_mix` with `shape: "total"` (one row per channel over the hotels) or `"flows"` (`channel`, `lands_in`: Net revenue or Commission, `amount_eur`), which a sankey draws. Both state the gross, commission and net totals in `evidence.notes`, computed by the same query; every channel row has `commission_pct` (commission ÷ gross).
  - `get_mix` with `rollUp: true`: one row per period and key over the hotels.
  - `get_pace` with `from`, `to` and `grain: "day"`: rooms on the books per stay date against the same time last year (the pace curve).
  - `get_rate_position` adds `occupancy_otb_pct` per night; `grain: "total"` gives one row per hotel (average BAR against the average comp set median).
  - `get_kpis` per hotel adds `region` and the comp set indices, for a treemap or a scatter of ARI against MPI.

Connect Claude Desktop to it under Settings → Connectors → Add custom connector. Rate limit: 60 requests per minute per client. Bodies at most 64 KB. Browser requests from other origins get 403, and responses carry no CORS headers: MCP clients are not browsers.

Tools that return outside free text (`find_reviews`, `search_reviews`, `get_account_production`, `get_brief`, `run_readonly_query`) wrap their rows in `<untrusted_data>` in the text content. `structuredContent` is not wrapped. Its `evidence` has the `title`, `columns` and `sourceLabels` described under "Evidence: titles and columns". The MCP server has no hotel scope.

- **Text cap.** The text content holds at most 60 rows and at most 50,000 characters of rows, then ends the rows with `… N more rows not shown.` `structuredContent` keeps every row.
- **Errors.** A failed call has `isError: true`. Only `run_readonly_query` returns the database's error text, with a hint to fix the query, and only for SQL errors (syntax, missing column, timeout). A connection failure there, and any database failure in another tool, answers `The data source failed to answer. Try again in a moment, or use another tool.`
- **Embedding budget.** Each `find_reviews` call through `/mcp` takes one of 2000 daily embeddings (all clients together, per UTC day). When they are spent, or the embedder fails, the tool answers `Semantic search is unavailable right now. Use search_reviews with a phrase.`

### `find_reviews`: guest reviews by meaning

The tool answers "what do guests say about breakfast in Bali?" even when the guests used other words. `search_reviews` stays for an exact phrase.

| Argument | Type | Default | Meaning |
|---|---|---|---|
| `question` | string, 2–300 chars | required | What to look for, in plain words |
| `hotels` | string[] | whole group | Hotel codes |
| `from`, `to` | ISO date | the 90 days up to the business date | Review dates, inclusive |
| `sentiment` | `complaint` \| `praise` \| `any` | `any` | `complaint` searches `negative_text`, `praise` searches `positive_text` |
| `k` | 1–20 | 8 | How many distinct sentences to return |

Each row is one distinct review sentence:

```json
{ "sentiment": "complaint", "quote": "Construction noise from the floor below started early every morning.",
  "similarity": 0.752, "mentions": 331, "share_pct": 20.5, "first_date": "2026-09-23", "last_date": "2026-11-19",
  "mentions_by_hotel": { "BCN": 331 },
  "hotel_code": "BCN", "review_date": "2026-11-19", "source": "Booking.com", "overall_score": 8.1,
  "review_text": "Construction noise from the floor below started early every morning." }
```

- **`similarity`:** cosine similarity of the question and the sentence (bge-m3). Only hits of 0.55 or more are returned.
- **Counts:** `mentions` counts the reviews in scope that contain the sentence, and `share_pct` is their share of all reviews in scope. Both are computed in SQL.
- **Latest review:** `hotel_code`, `review_date`, `source`, `overall_score` and `review_text` come from the newest review that contains the sentence.
- **`quote` and `review_text`:** guest free text. Treat them as untrusted, and escape them when rendering.
- **Evidence:**
  - `sources` are `hotel.reviews` and `hotel.review_passages`;
  - `definitions` cover similarity, mentions and share;
  - `period` and `sql` are included;
  - `params[0]` names the embedded question instead of listing 1024 numbers;
  - `notes` give the model, the similarity floor and coverage, e.g. "51 of 51 distinct sentences from 28172 reviews in scope are embedded (reviews dated 2026-08-22 to 2026-11-19)".
- **No match:** if no sentence is close enough, `rows` is empty and a note says so.

## Health

`GET /api/health` returns `{ "ok": true, "businessDate": "2026-11-20" }`.
