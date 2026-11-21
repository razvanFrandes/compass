# Round 2 contracts (shared by the parallel branches)

Every Round 2 branch builds against these shapes. Backend branches implement them in `packages/contracts` + `apps/worker`; frontend branches code against them (mock until the backend lands). If a branch needs to change a shape, it says so in its report; it does not silently diverge.

Product decisions for Round 2 (owner, 20 Nov late evening):
- Brand: Juyo's logo and wordmark in the app (sidebar, favicon, page titles). The assistant is **Kassandra** everywhere; the watchers area is **Agent Studio**. No "concept by" line.
- Explore, chart clicks and KPI tiles send the question immediately. Only `/ask?q=` (links in emails) pre-fills without sending.
- Voice input uses **Soniox** real-time transcription (server mints a temporary key; the permanent key never reaches the browser). Web Speech is only the fallback when Soniox is unavailable.
- Visual richness: a broad chart catalogue (simple and complex, all beautiful and accessible).

## 1. Hotels and scope

```ts
// GET /api/hotels  →  HotelRef[]
interface HotelRef { code: string; name: string; city: string; country: string; region: string; brand: string; rooms: number }

// Kassandra ask gains an optional scope (absent or empty = the whole group)
type ChatClientMessage =
  | { type: 'ask'; text: string; id?: string; mode?: 'quick' | 'thinker'; scope?: { hotels: string[] } }
  | …existing
```
Server: every data tool's `hotels` argument is intersected with the scope (a tool call without hotels gets the scope); the system prompt states the scope ("You are answering for: Arbor Lisbon Chiado, …"). The brief is filtered client-side by `hotel_code`.

## 2. Evidence column metadata

```ts
interface EvidenceColumn {
  key: string;            // row property
  label: string;          // "Occupancy", "On the books", "Hotel"
  kind: 'text' | 'hotel' | 'date' | 'month' | 'number' | 'percent' | 'currency' | 'count' | 'id';
  unit?: string;          // "EUR", "nights", "pts"
  hidden?: boolean;       // ids, kinds, internal flags: hidden by default in the UI
}
// Evidence gains: columns?: EvidenceColumn[]; title?: string  (human tool title, e.g. "Pace vs last year")
```
Every catalog tool returns `columns` for its rows (derive from a per-tool map; `run_readonly_query` infers kinds from names/values). Sources gain human labels: `sources: { id: string; label: string }[]` is NOT a breaking change — add `sourceLabels?: Record<string, string>` instead.

## 3. Widgets in answers (generative UI from tool rows)

```ts
type WidgetKind =
  | 'kpi' | 'kpi_row' | 'line' | 'area' | 'bar' | 'stacked_bar' | 'grouped_bar' | 'pie' | 'donut'
  | 'table' | 'heatmap' | 'calendar_heatmap' | 'funnel' | 'waterfall' | 'bullet' | 'sparkline_list'
  | 'scatter' | 'treemap' | 'gauge' | 'radar' | 'sankey';

interface WidgetSpec {
  kind: WidgetKind;
  title: string;            // a conclusion, e.g. "Lisbon is 15.9% behind last year for December"
  subtitle?: string;        // scope line
  sourceCallId: string;     // the tool_result whose rows feed it (the model never supplies numbers)
  x?: string;               // column key
  y?: string[];             // column keys (series)
  group?: string;           // column key for series split / slices
  compare?: string;         // column key for the comparison series (LY, budget)
  format?: 'number' | 'percent' | 'currency' | 'count';
}

// show_widget tool → tool_result entry gains:
//   widget?: WidgetSpec & { rows: object[]; columns: EvidenceColumn[]; evidence: Evidence }
```
Server validates that keys exist in the referenced rows and that the kind fits the data (e.g. pie/donut only for 2–7 parts of one whole), copies the rows from the referenced tool result, and rejects otherwise with a clear message to the model.

## 4. Boards (server-saved Canvas)

```ts
interface BoardWidget { id: string; spec: WidgetSpec; rows: object[]; columns: EvidenceColumn[]; evidence: Evidence; question?: string; addedAt: string }
interface Board { id: string; name: string; description: string; hotels: string[]; widgets: BoardWidget[]; createdAt: string; updatedAt: string }

GET    /api/boards                       → (Board & { preview?: BoardWidgetPreview[] })[] (widgets carry spec + title only; `preview`: the first 4 widgets with only the columns they draw and ≤ 40 rows — a calendar keeps up to 92 days, a table its first 5 rows — for the cards on the Boards page)
POST   /api/boards        {name, description?, hotels?}          → Board
GET    /api/boards/:id                   → Board
PATCH  /api/boards/:id    {name?, description?, hotels?, order?: string[]} → Board
DELETE /api/boards/:id
POST   /api/boards/:id/widgets  {spec, rows, columns, evidence, question?} → BoardWidget
DELETE /api/boards/:id/widgets/:widgetId
```
One group Durable Object; limits: 50 boards, 24 widgets per board, 400 rows per widget (was 200; raised in Round 3 for the hotels × nights heatmap); same origin/body rules as the other `/api` writes. Seed the existing sample boards on first use so the Boards page is never empty.

## 5. Workflows: edit, delete, duplicate

```
GET  /api/workflows/builder/ws?draft=<id>&workflow=<wfId>   // loads an existing workflow into the draft (real address kept server-side, masked to the client until edited)
POST /api/workflows/:id/duplicate   → Workflow   (createdBy 'user', enabled false, " (copy)")
DELETE /api/workflows/:id           → 204 (its runs, proposals and audit entries stay, marked with the deleted workflow's name)
PATCH /api/workflows/:id { enabled?, autonomy?, … }   // existing
```
Brief-triggered workflows run after the 05:00 brief (existing) **and** once on deploy/first use if they have never run, so the Inbox opens with a real pending proposal (Dubai event pricing).

## 6. Voice (Soniox)

```
POST /api/voice/token  → { apiKey: string; expiresAt: string; model: string; wsUrl: string }
```
Mints a Soniox temporary API key from the `SONIOX_API_KEY` Worker secret (check Soniox docs for the temporary-key endpoint and real-time WebSocket API; model with English + Romanian). Rate-limited per client (10/min) and a daily `voice` budget kind. The client streams mic audio straight to Soniox with the temporary key and shows partial/final tokens live in the composer.
