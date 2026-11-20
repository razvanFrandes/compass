# Round 2: from demo to product (plan, 2026-11-20 evening)

Inputs: the owner's review (screenshots, 20 Nov ~22:30) and a full audit of the live app (5 blockers, 35 important, 45 polish, 14 product gaps; `scratchpad/audit/audit.md`). Deadline: 21 Nov ~14:15.

The goal of this round: nothing on screen is fake, every Kassandra surface is the same component, and the hotelier works on *their* hotels.

## Principles for this round

- **One Kassandra.** One chat component (composer with voice, Quick/Thinker, phases, steps, answer, widgets, evidence) used everywhere Kassandra appears: Inbox ask bar, Thread, workflow builder, watcher detail ("ask about this"), board "describe a view".
- **Scope is global.** A hotel scope chosen in the sidebar applies to the brief, boards, questions and new workflows.
- **No fake state.** Anything that looks saved is saved on the server; anything not built is either built or removed, never "Coming soon".
- **Juyo's world.** Juyo's mark and the name "Kassandra" everywhere; Compass stays only as the project name in the footer.

## Phase A — the owner's list and the blockers (tonight)

| # | Item | What "done" means | Owner |
|---|---|---|---|
| A1 | **Unified Kassandra chat** | One `<kassandra-chat>` component + `<kassandra-composer>` (voice via the existing orb/Web Speech, Quick/Thinker, phase indicator, steps, Markdown answer, widgets, Stop). Replaces the Inbox ask bar, Thread body, builder chat, watcher "ask". | FE-1 |
| A2 | **Explore answers immediately** | Explore / chart click / KPI tile → Thread opens and the question is sent at once (it is the user's click). `/ask?q=` from an email link still only pre-fills. Thread dedupes: the same question from the same card reopens its thread. | FE-1 |
| A3 | **Evidence panel redesign** | Resizable split (drag the divider, keyboard arrows, double-click resets, width remembered). Leads with the numbers quoted in the answer; tool cards collapsed by default with human titles ("Pace vs last year", not "Get pace · 45"). Tables: human column labels and units from the server, internal columns hidden (id, kind, codes → names), numbers/dates formatted, horizontal scroll with sticky first column and edge fade, "Show all N rows". Sources as names; SQL collapsed. Phone: evidence opens as a bottom sheet. | FE-2 + BE-1 (column metadata) |
| A4 | **Hotel scope** | Sidebar switcher with search: whole group, region, brand, or any set of hotels; in the URL; scopes the brief, boards and every Kassandra question (server restricts tools to those hotels = HotelGPT mode). | FE-3 + BE-2 |
| A5 | **Builder: hotels combobox** | Searchable multi-select of the group's hotels (name, city, brand) instead of typing codes; same component as A4. Check step editable by hand (pick from labelled checks). | FE-3 |
| A6 | **Edit workflows** | "Edit" on a workflow opens it in the builder (server loads the workflow into a draft); saving updates it; recipient change still makes a new one. Also Delete, Duplicate, Pause; autonomy change asks for confirmation. | BE-3 + FE-3 |
| A7 | **Answers with charts + Add to board** | Kassandra can show a chart/table/KPI from the catalogue (`show_widget` tool → `WidgetSpec` from tool rows, never model-made numbers) and every widget has Add to board. | BE-4 + FE-1 |
| A8 | **Boards saved on the server; "Describe a view" works** | Boards CRUD on the server (create, rename, delete, add/remove/reorder widgets). "Describe a view" sends the description to Kassandra, which answers with widgets added to that board (receipt + Undo). | BE-5 + FE-4 |
| A9 | **One real decision waiting** | Brief findings trigger their workflows (Dubai event pricing), so the Inbox opens with a real pending proposal; Night Accept/Keep becomes a real proposal decision in the audit log. | BE-3 + FE-4 |
| A10 | **Brand** | Juyo logo in the sidebar and favicon, "Kassandra" for the assistant everywhere, "Agent Studio" for Watchers/Workflows (one name), page titles + Open Graph so the link unfurls. A small "Concept by Razvan for Juyo · fictional data" line in the footer so the public site is not mistaken for Juyo's product. | FE-4 |
| A11 | **Fix wrong numbers and dead states** | Board cards use their own hotel's numbers; brief/watchers show an error with Retry instead of loading forever; phone Portfolio charts fixed; token/$ hidden behind a details toggle; toasts never cover the composer. | FE-4 |

## Phase B — high-impact product gaps (tomorrow morning)

- **Briefing export**: "Download PDF" of the brief and of a board (print stylesheet), "Email me this brief" via the existing mail action.
- **"Watch this"** on any finding, answer or chart → builder pre-filled.
- **Connect your AI** card with the `/mcp` URL and copy button (the MCP bonus becomes visible).
- **Data sources** page from `get_data_health` (Berlin POS outage lands there).
- **Modules** tags (Commercial, Finance, F&B, M&E) on brief items and boards, with a filter.
- **Identity**: a fixed demo persona ("Ana Pop · Revenue manager") used in approvals and the audit log.
- Remaining audit items marked important, then polish.

## Phase C — delivery

Final deploy, a full browser pass on desktop and phone with axe, story evals, write-up updated with what Round 2 added, a 2-minute screen recording, email to Silviu.

## Who does what (parallel, by area, no shared files)

- **BE-1..BE-5** (backend agents, `apps/worker` + `packages/contracts`): evidence column metadata; scope on ask + `GET /api/hotels`; workflow load/delete/duplicate + brief-triggered runs; `show_widget`; boards API. Contracts first (one agent, ~20 min), then the rest in parallel.
- **FE-1** Kassandra component family (`src/app/kassandra/**`), **FE-2** evidence panel + split, **FE-3** scope switcher + hotel combobox + builder edit mode, **FE-4** shell/brand/boards/inbox fixes (the design session, which owns those screens).
- Each agent: tests first, axe clean, phone and desktop; a reviewer per area; I integrate, deploy and run the browser pass.
