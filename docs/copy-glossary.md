# Copy glossary

How Compass talks. One reader: a revenue manager or general manager who knows hotels and has no interest in how the software is built. Every string in the app, in the emails and in what Kassandra and the agents write follows this page.

## Voice

1. **Money first, then the percentage.** "−€115k of room revenue at risk", then "26 of 300 rooms out of order". A percentage on its own is a detail, not a headline.
2. **Say the specific thing.** Name the hotel, the nights and the figure. "Lisbon Chiado is 17% behind last year for the next 45 nights" beats "pace alert".
3. **Short and active.** The subject does something: "Kassandra builds the board", "The agent emails you". No "is being", no "has been successfully".
4. **Calm.** No exclamation marks, no "oops", no "please", no "successfully", no "simply". A full stop is enough.
5. **The answer comes to you.** Screens open on what was found and what it is worth. Empty states say what will appear and what to do next, in one or two sentences.
6. **Sentence case everywhere.** Headings, buttons, menu items and table headers. Product names keep their capitals.
7. **Nothing internal.** No tool names, table names, column names, hotel codes, ISO dates, status codes or the words "tool", "spec", "widget", "node", "payload", "workflow". "Query" is allowed in one place: the control that shows the SQL behind a number. "Rows" is fine for the rows of a table the reader can see. If the reader cannot act on a word, it goes.
8. **Errors say what happened and what to do.** "Couldn’t save the agent. Check your connection and try again." Never the raw error alone, never blame.
9. **Buttons are verbs, and say what really happens.** "Send to revenue manager", "Dismiss", "Run now", "Save agent". The same action has the same label everywhere. Compass is read-only, so no button may read as if it changed a rate, a channel or a booking.
10. **Toasts are a title and, when needed, one sentence.** The title says what happened, with the name, and has no full stop: "Pace guard paused", "Couldn’t save the agent". The sentence under it says what to do or where it went.
11. **One word per thing.** The table below is the whole vocabulary. If two words mean the same thing, one of them is wrong.

## Terms

| Term | Meaning | Don’t say |
|---|---|---|
| **Kassandra** | The assistant. You ask in everyday language; every number in the answer shows where it comes from. | the AI, the assistant, the bot, the model |
| **Quick / Thinker** | Kassandra’s two answer modes. Quick: a fast answer from one trusted source. Thinker: works across several sources and takes longer. | governed metrics, fast mode, deep mode |
| **Agent Studio** | Where agents are created, run and reviewed. | Watchers, Workflows, Automations |
| **agent** | Something that watches the numbers for you, proposes an action and acts once you approve. | workflow, watcher, monitor, automation, bot |
| **step** | One part of an agent in the builder: when it runs, hotels, data, what to watch for, approval, action. | node, block, stage |
| **run** | One time an agent did its work. A **test run** is one you start by hand before saving. | execution, job, invocation |
| **finding** | Something the morning brief or an agent found that is worth money or a decision. | insight, alert, anomaly, detection, result |
| **decision** | Something an agent suggests that waits for you. You **send it to the revenue manager** (it becomes a task for them and a line in the audit log) or **dismiss** it. Compass never changes anything itself, and the card says so. | proposal, pending approval, request, approve, decline, deny, reject (on the card and its buttons) |
| **morning brief** | The findings of the day, the biggest money first. "The brief" on second mention. | briefing, digest, feed, report |
| **board** | A page of charts you keep. Kassandra builds one from a description, or you add charts to it from an answer. (Juyo’s Canvas.) | dashboard, view, canvas, workspace |
| **chart** | Anything on a board or in an answer: a line, a table, a single figure. | widget, visual, tile, component, artifact |
| **scope** | The hotels a question, a board or an agent covers. On screen it reads as the hotels themselves: "All 20 hotels", "Lisbon Chiado + 2". | filter, context, selection, property set |
| **hotel** | One property. Always by name ("Lisbon Chiado"), never by code. | property, LIS, DXB2 |
| **on the books** | Rooms or revenue already booked for future nights. | OTB, booked position |
| **last year** | The comparison period: the same weekday 364 days earlier. "Same time last year" only where lead time is the point (pace). | STLY, LY, YoY, prior year |
| **comp set** | The competing hotels a hotel is priced against. "Comp set median" for their middle rate. On a decision card, which the person who decides reads, it is **the competition**. | compset, comp-set, comps, the market, competitors’ median |
| **pace** | On the books now against on the books at the same time last year. | OTB variance |
| **pickup** | New bookings in a recent window for future nights. | bookings delta |
| **pts** | Percentage points, for a change in a percentage: "▲ 3.1 pts". | pp, ppt, % points |
| **BAR, ADR, RevPAR, GOP** | Kept as they are: the reader uses them daily. Spell out anything rarer on first use (GOPPAR, TRevPAR). | rate (for BAR, when the level matters) |
| **Behind the numbers** | The panel beside an answer: source, period, definition and the table for each number. | How this was computed, evidence, provenance, query |
| **autonomy** | How far an agent may go: **Suggest** (only proposes), **Ask first** (acts after you approve), **Act alone** (acts on low-risk actions, asks for the rest). | level, mode, permission tier |

## Formats

- Money: `€1.34M`, `€115k`, `−€38k`. A true minus sign (−), never a hyphen. Euros unless the hotel’s own currency is the point.
- Changes: `▲ 4.2%`, `▼ 2.0%`, `▲ 3.1 pts`. Always against something named: "vs last year", "vs budget".
- Dates: `Fri 20 Nov`, `16–18 Dec`, `20 Nov 2026` when the year matters. Never `2026-11-20`.
- Times: `07:00`. Relative when recent: "32 min ago", "3 h ago".
- Multiples of the comp set read as a percentage: "26% under the comp set median", not "0.74x". A decision card may say "up to 1.9× the competition": one decimal, a true ×.
- Loading: say what is loading and end with an ellipsis character: "Loading agents…".
- Quotes and apostrophes are curly (’ “ ”). Ranges use an en dash (–).
- Spelling is British: colour, catalogue, labour.
- A retry is always "Try again".

## Where the words live

Most strings sit in the component that shows them. The ones shared across the app, the worker and the emails are kept in step by hand:

| What | Where |
|---|---|
| Names of the data an answer or an agent reads ("Pace vs last year", "Recent pickup") | `apps/worker/src/presentation/tools/tool-views.ts` (what the server sends), `apps/web/src/app/evidence/labels.ts` and `kassandra/turn-text.ts` (fallbacks), `packages/contracts/src/workflow-graph.ts` `CHECK_LABELS`, `apps/web/src/app/builder/builder-steps.ts` |
| Finding names after "When the brief finds …" | `packages/contracts/src/workflow-graph.ts` `FINDING_LABELS`, `apps/web/src/app/studio/studio.ts` `FINDING_LABEL` |
| Action names | `packages/contracts/src/workflow-graph.ts` `ACTION_LABELS`, `apps/web/src/app/proposal-card.ts` `ACTION_LABEL` |
| The decision card: its labels, what sending does, and the rules that turn an agent’s wording into plain words | `apps/web/src/app/proposal-text.ts` |
| The morning brief: headline, chips, section names, finding kinds, "Watch this" descriptions | `apps/web/src/app/inbox.ts`, `apps/web/src/app/brief/brief-model.ts` |
| Autonomy levels | `apps/web/src/app/studio/studio.ts` |
| Voice rules for what Kassandra, the brief and the agents write | `apps/worker/src/presentation/agents/kassandra-prompt.ts`, `apps/worker/src/application/brief.ts`, `apps/worker/src/application/workflows/templates.ts` (`VOICE`), `apps/worker/src/presentation/agents/builder-prompt.ts` |
| Email subject, body and footer | `apps/worker/src/application/workflows/email.ts` |

Text a model wrote before these rules (a decision already waiting, an old run summary) keeps its old wording until the next brief or run.

## Before → after

The changes that matter most, from the pass of 21 Nov 2026 (about 570 strings).

| Where | Before | After |
|---|---|---|
| Kassandra, Quick | A fast answer from governed metrics | A fast answer from one trusted source |
| Kassandra, Thinker | Reasons across every source; slower | Works across several sources; takes longer |
| Conversation, intro | Every number links to the query behind it. | Every number in the answer shows where it comes from. |
| Panel beside an answer | How this was computed | Behind the numbers |
| Panel, empty | Numbers in the answer will show where they came from here. | Each number in the answer shows its source, period and definition here. |
| Kassandra, no answer | No answer this time: the model returned an error | No answer this time. Something went wrong on our side. Ask again in a moment. |
| Kassandra, steps | Pace vs last year · LIS · 2 rows · failed | Pace vs last year · Lisbon Chiado · 2 rows · couldn’t finish |
| Evidence titles | Governed metric · Database schema · Custom query | Metric over time · Available data · Custom analysis |
| Evidence table, empty | No rows came back for this step. | Nothing came back for this. Try a wider period or more hotels. |
| Brief finding title | …sells 3 high-demand nights at 0.78× the comp set (2026-12-16 to 2026-12-18) | …is priced 22% under the comp set median on 3 busy nights, 16–18 Dec |
| Brief finding title | …lost most of Vantor Consulting: 450 room nights in 6 months vs 5414 before | …lost most of Vantor Consulting: 450 room nights in the last 6 months, down from 5,414 |
| Brief finding title | …missed its 2026-10 GOP budget by 12% | …missed its October GOP budget by 12% |
| Boards, intro | Dashboards you keep: the built-in ones, and boards made from charts you add. | The numbers you check every day, kept in one place. Kassandra builds a board from a description, or you add charts from an answer. |
| Boards, new board card | then use “Add to …” on any chart | Describe it to Kassandra, or add charts from an answer |
| Board cards | ▲ +3.1 pp vs LY · ±0.0 pp vs STLY | ▲ +3.1 pts vs last year · ±0.0 pts vs last year |
| Board, describe | Describe a view to add · Kassandra added 3 views | Describe what this board should show · Kassandra added 3 charts |
| Board, errors | The board wasn’t created · 500 Internal Server Error | Couldn’t create the board · The server couldn’t do that just now. Try again in a moment. |
| Chart fallback | “hexbin” is not a chart this version can draw, so the rows are shown as a table. | This kind of chart isn’t available yet, so the numbers are shown as a table. |
| Agent Studio, autonomy | Suggest · Approve · Act alone | Suggest · Ask first · Act alone |
| Agent Studio, card | When the brief finds web conversion drop | When the brief finds a drop in website conversion |
| Agent Studio, card | Reads the next brief today, 07:00 | Next run today, 07:00 · after the brief |
| Agent Studio, run key | ran, nothing to flag · waits for you | Nothing to flag · Needs your decision |
| Agent Studio, audit log | Nothing is written to source systems: approved actions become tasks for the revenue manager | Nothing changes in your hotel systems. An approved action becomes a task for the revenue manager. |
| Agent page | Autonomy · Checks first · Proposals · Done · manual | How far it may go · Data it reads first · Decisions · Finished · run by hand |
| Agent page, run log | Run the workflow now (trigger: manual, test from builder, test run). | Started by hand · test run |
| Decision card, buttons | Approve · Deny · Why, in full | Send to revenue manager · Dismiss · See the reasoning |
| Decision card, title | Lower BAR on Lisbon's most overpriced nights to 1.2x comp median | Suggestion: lower rates on Lisbon's most overpriced nights |
| Decision card, what it does | (nothing said) | This goes to your revenue manager as a task. Compass never changes your rates. |
| Decision card, label | Change the rate · high risk | Price change · needs a person |
| Decision card, the change | ~~BAR 145–220 EUR, 1.10x–1.89x comp median~~ → Cap at about 1.2x comp median · LIS, stay dates 2026-11-20 to 2027-01-03 | behind "See the reasoning": Today €145–220 a night, up to 1.9× the competition → Suggested Cap at about 1.2× the competition · Covers Lisbon, stay dates Fri 20 Nov – Sun 3 Jan |
| Decision card, after | Approved · Sent to the revenue manager | Sent to the revenue manager · Logged · 3 min ago · Undo |
| Decision toast, sent | Approved · Handed to the revenue manager as an RMS task; it shows in the audit log. | Sent to Ana Pop, Revenue manager · Arbor Lisbon Chiado · Task created for the rate change · logged in the audit trail · View message · Undo |
| Decision toast, dismissed | Declined · Nothing changes. | Dismissed · Arbor Lisbon Chiado · Nothing was sent · logged in the audit trail · Undo |
| Message sheet, foot | (none) | Demo: Compass hands this to your RMS and revenue manager as a task. Compass never changes your rates. No email is sent, and the people in the demo team are fictional. |
| Builder, steps | TRIGGER · CHECK · ANALYZE | WHEN · DATA · WATCH FOR |
| Builder, header | Draft · 5 steps to finish · Save · Send test now | Draft · 5 details missing · Save agent · Run a test |
| Builder, to finish | Trigger: not set yet · Goal: Too small | When it runs: not set · What to watch for: too short |
| Builder, chat steps | Set trigger · Added check (LIS, OPO) | Set when it runs · Added data (Lisbon Chiado, …) |
| Agent email | Compass alert · {name} · Would fire today · Explore in Kassandra | {name} · Compass · It would email you today · Ask Kassandra about this |
| Server errors | No such workflow. · This workflow already has a run in progress (run-…) | That agent no longer exists. · This agent is already running. Wait for the run to finish, then try again. |
| Daily limit | The demo's daily budget of 300 questions is used up. It resets at 00:00 UTC. | Today’s limit of 300 questions for this demo is used up. It resets at midnight UTC. |
| Sidebar | Threads · Halcyon Hospitality is a fictional group with generated data. Business date Fri 20 Nov 2026. | Conversations · Halcyon Hospitality is a fictional group. All figures are generated, as of Fri 20 Nov 2026. |

## Not covered by this pass

- Agent Studio still says an agent "acts once you approve" (the autonomy levels, the intro, the audit note). The decision card no longer has an Approve button, so those lines should follow it: "acts once you send it on", or similar.
- The docs hub.
