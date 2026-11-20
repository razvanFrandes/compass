# Best AI product UIs on Mobbin: observed patterns for Compass

Date: 2026-11-20. Source: Mobbin MCP (`search_screens` / `search_flows`), web + iOS, 19 searches at limit 6–8. Every observation below comes from the returned screenshots, not from metadata. Links go to the Mobbin screen/flow.

Compass context: a hotel analytics app whose AI assistant answers over hotel data using generated UI (charts, tables, approval cards), plus a morning brief, pinned widgets and agents that watch metrics. Desktop users are revenue managers; phone users are GMs reading the brief.

> No search result in this session returned an `ai_usage_notice`, so there is no notice to reproduce.

Coverage caveat: Mobbin returned few or no screens for Cursor, Granola, Hex, Ramp, Monarch, Attio, Superhuman, Arc/Dia, Lovable or Intercom Fin on these queries. The examples come from what the index actually returned: ChatGPT, Claude, Gemini, Perplexity (+Comet), Notion, Linear, Shopify Sidekick, Asana, Mercury, v0, Mintlify, Manus, Unify, Copilot, Grok, Mistral, Raycast, Xero, Public, Fey, Productboard Spark and others. Where a big-name example is missing, a smaller app shows the same pattern.

---

## 1. AI chat panel inside a work app

| App | What the screen shows |
|---|---|
| [Linear: Ask Linear floating panel](https://mobbin.com/screens/51c2bd60-f22d-4879-8c28-c5800ac1f4b6?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A small floating card (about 200×300 at preview scale) anchored bottom-right above a status-bar button labelled "Ask Linear". The header holds the conversation title ("Explain project purpose"), a `···` menu and minimise / expand / close icons. The answer uses bullets with **bold** status values ("In Progress", "on track", "77%"). There is a single copy icon under the answer, then a "Reply..." composer with a "Skills ▾" chip, a paperclip and a send arrow. The page behind stays fully usable. |
| [Linear: answer referencing live objects](https://mobbin.com/screens/692145d1-6e38-4386-9a5a-e597c4c120b4?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | The expanded full-page mode of the same assistant. The header shows "Worked for 13 seconds ▸" (collapsible). The answer starts with a sentence ("You currently have 3 open issues assigned to you.") followed by an **inline list of real issue rows** (ID, status icon, title, assignee avatar), the same component the product uses everywhere else. A bullet summary follows. |
| [Notion AI: side panel docked right of page](https://mobbin.com/screens/a1d949f4-fc76-450d-afe8-6477510a848b?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A right-docked panel of about 25% width. The header has a truncated chat title plus new/history/expand icons. A "Thought ›" disclosure sits above the answer. The answer uses headed sections ("What works well", "Where it could be sharper", "Suggested revision:"). The composer footer reads "Ask AI anything..." with `+`, an "Ask mode" chip, a model chip ("Sonnet 4.6") and a mic. A floating ↓ button scrolls to the newest message. |
| [Notion AI: mode/sources popover](https://mobbin.com/screens/0317bced-be59-439c-a6b9-9032b93835b4?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) and [model picker](https://mobbin.com/screens/58188761-2d93-43a2-be51-df5fee96707a?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | The sliders icon in the composer opens a popover with toggles: "Web access", "My sources 2 ›", "Add sources", "**Can make changes**" (off by default) and "Personalize". The model picker is a right-aligned "Auto" text button. Its menu has "Auto ✓" on top, then a model list with Beta tags, then a separate group "Chat directly with models". A context chip with the user's avatar ("samlee") sits above the input text. |
| [Shopify Sidekick: full-height panel, chat history in nav](https://mobbin.com/screens/6ba41d7d-c9c9-4afe-a6e4-8de3977e9a64?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | The assistant replaces the main canvas, and the left nav gains a "Sidekick conversations ›" section listing past chats. The header has a chat-title dropdown plus new / expand / close. Mid-answer it shows a "Asking questions..." status, then a **structured clarifying question docked above the composer**: question text, "2 of 2" pager with ‹ ›, numbered options (1 Same brand, 2 Different brand, 3 Other), "Dismiss" and a purple "Submit ↵". |
| [Asana AI: overlay panel with sections](https://mobbin.com/screens/f2b651ef-bce1-464c-9c47-52f2fb187238?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A right panel over the home page with a soft gradient header, history / expand / close icons and the greeting "Hi Alex, how can I help you?". Suggestions are grouped under small labels "For you", "Insights" and "More", each an outlined row with an icon. The composer has an @ mention icon and a blue send button. |
| [HoneyBook: floating panel](https://mobbin.com/screens/fa243020-70b3-41a7-94c1-50e5d51c7355?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A floating right card with new-chat / history / `⋮` / close icons, an "Explore more ideas" link at the top, and 👍 👎 copy regenerate under the answer. The footer has a small "HoneyBook AI can make mistakes. Learn more" line and a "Beta v1.0" tag. |

**Takeaways:** a right-side panel is the norm for "assist while working" (Linear, Notion, Asana, HoneyBook, Aboard, Fabric, Rows). Every panel has an **expand-to-full-page** affordance in its header. The model picker is small text ("Auto", "Sonnet 4.6", "GPT 5.4") at the right of the composer, never in the header. Context or scope sits *in the composer* (chips, a sources popover), and write access is an explicit toggle ("Can make changes").

---

## 2. Empty state / first-run

| App | What the screen shows |
|---|---|
| [Notion AI: centered home](https://mobbin.com/screens/176a7fae-1de4-4d50-a28b-cb14eef8b18b?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A mascot, the headline "…what's your request?" and a large composer with `+`, sliders, a model chip, mic and send. Under the composer, a row reads "Get better answers from your apps" with connector logos and an × to dismiss. Below that are two columns, **Recent chats** and **Suggested** ("Create custom agent", "Write meeting agenda", "Analyze PDFs or images"). |
| [Productboard Spark](https://mobbin.com/screens/abfc4b86-eb62-486c-85a1-7dbba408d979?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | "Where do we start?" plus a hint line ("Type @ to mention an item… Type / to call any skill"). "Start with a skill ⓘ" shows 4 outlined chips with icons, one tagged Beta, and a "View all ›" link. The composer is docked at the bottom with the disclaimer "Spark AI may make mistakes. Please use with discretion." |
| [Deel AI](https://mobbin.com/screens/db357932-0e83-43e7-89ff-5f47a06ef246?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Two-line headline "Hello Alex, / how can we help?", a one-line explanation of what the assistant does, a pill-shaped input, and 3 **data questions** as text links with an icon ("How much paid time off do I have left?", "Show number of workers by country", "Show number of inactive workers by country"). The left rail holds "My chats (3)". |
| [Lightfield CRM](https://mobbin.com/screens/4cdd315f-a368-4370-9f0a-ebb951255e35?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | "Some ideas…" followed by 9 plain-text prompts separated by hairlines. All of them are domain questions over the user's records ("Which of my opportunities need updating?", "What's the deal value in my active opportunities?", "Prep me for my meetings today"). |
| [Aboard Co-pilot panel](https://mobbin.com/screens/5213a486-dd79-4c04-a769-e72674c736a4?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Panel greeting "Hi there! I'm Co-pilot… Ask me anything." with 5 grey pill chips of real questions ("Who is out of office next week?", "How many vacation days do I have left?"). |
| [Plane AI](https://mobbin.com/screens/8d800a40-7843-4810-95a1-9206c3289efc?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | "What can I do for you?", a composer with a workspace context chip on top ("AS Mobbin"), "Build ▾" mode, model "Claude Sonnet 4.6 ▾", mic and send. "Suggestions" shows 2 rows prefixed with ↳. Footer: "Plane AI can make mistakes, please double-check responses." |
| [Gemini iOS](https://mobbin.com/screens/7097fe26-5a50-4577-a64e-e47ffcf9097f?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) / [Claude iOS](https://mobbin.com/screens/3ecbf36f-0aea-4f7c-846b-703ce03bd2ab?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Gemini: "Hi Alex / Where should we start?" with stacked left-aligned chip buttons. Claude: just the logo and "Evening, Lex" centered, with **no starter prompts**; the composer has a model chip "Sonnet 4.6 Low". |

**Takeaways:** a greeting headline, a centered composer, then 3–9 starter prompts. The best B2B ones (Deel, Lightfield, Aboard, Asana) write their starters as **concrete questions over the user's own data**, not capability categories. Recent chats sit next to the suggestions (Notion, Asana). A one-line "can make mistakes" disclaimer appears under the composer (Productboard, Plane, Dash, Gemini, ChatGPT).

---

## 3. Streaming / thinking / progress states

| App | What the screen shows |
|---|---|
| [Unify: step list with tool calls](https://mobbin.com/screens/b582675c-92ec-417a-ae38-969fe3400d82?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | "Thinking 1m 26s", "View all steps (4)", then ✓ "Retrying clean search", ✓ "Recovering table handle", and a current step "Verifying fit" with a narration line ("I have 25 matches. I'm cleaning the table display and spot-checking the strongest rows before I hand it over."). Sub-items have table icons ("Updated columns", "Applied display sort", "Queried rows", "Displayed table **View table**"). A **right pane shows a skeleton table** loading while this happens. The stop button replaces send in the composer. |
| [ChatGPT deep research: Activity sidebar](https://mobbin.com/screens/b045e2cd-4f54-424a-97f6-4c5954f0c1e1?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | An inline card "Examining matcha's evolution · 2 sources" with a thin progress bar and a ■ stop. A right sidebar has tabs **Activity / 2 Sources**, an alternating timeline of narration ("I'm digging into…"), "Searched for …" with a 🔍 icon and "Read reuters.com" with a favicon. At the bottom are **Stop** and **Update** buttons. A toast reads "Multitasking: Try asking ChatGPT something else while you wait." |
| [ChatGPT: research completed](https://mobbin.com/screens/73833b79-1dd5-4354-8fc4-a2e99c33a75e?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | The Activity panel's last line is "✓ Research completed in 5m · 23 sources", and the tab now says "23 Sources". |
| [Copilot: "See my thinking"](https://mobbin.com/screens/e631b279-cfc4-4c1c-85c9-f06c838b8df2?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | After the answer, a "See my thinking ›" pill opens a right panel with a dotted timeline: "**Searching** reduced sugar bakery 2026" repeated about 15 times, then "**Thinking**" with a paragraph. The verb is bold and the query is regular weight. |
| [Lindy: checklist plus live computer](https://mobbin.com/screens/9f4affd5-f387-4149-860e-95c83f9bbba5?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A tool card "Start computer · Computer started ▾", then a vertical checklist with green ✓ per step ("Create type definitions ›") ending in "Processing…". The right pane shows rotating playful status lines while waiting. |
| [Browserbase: run timeline](https://mobbin.com/screens/38e3e1bc-2a5c-4f7b-aa64-00ab6f736224?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | The run header shows "Running", run ID, "15.0s" and a timestamp, with **Stop** and **Optimize** at the top right. A coloured timeline strip sits above a table of typed rows (Prompt / Reason / Tool tags with timestamps 0:03, 0:05…). The right column holds tool results ("techcrunch.com HTTP probe · HTTP 200"). |
| [Gemini: Thinking steps panel](https://mobbin.com/screens/19fa8a36-4f95-4ea2-ad23-533e31965ddb?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A short side panel with only 2 rows: "Used 3.5 Flash model", "✓ Used Analysis". |
| [Raycast iOS: tool chip](https://mobbin.com/screens/48b8a26f-7d63-40f2-8dc4-7a15edc900af?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | One sentence of intent ("I'll search for some insights on…"), then a bordered row "🌐 Web Search" with a spinner on the right. |
| [TikTok AI search iOS](https://mobbin.com/screens/ff0ac6e3-02aa-489e-8649-8fd4c5cf9ac8?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) / [Grok iOS](https://mobbin.com/screens/6aaee6fc-9ad0-4913-a851-ed94ceae24a7?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) / [DeepSeek iOS](https://mobbin.com/screens/ced078a7-d72c-4208-b954-0ad17b3576fb?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | TikTok: "Keep thinking 2s", then grey indented lines ("Loading Memory", "Understanding Intent", "Got it"). Grok: "⠿ Thinking • 2s" with a live counter. DeepSeek: "Thinking ▾" expanded, with a reasoning paragraph beside a vertical rule. All three swap the send button for a ■ stop. |
| [Otter: "Thought for 11 seconds"](https://mobbin.com/screens/2d1a5d1b-86e0-40d0-af13-4bc3988ccc59?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) / [Grok web](https://mobbin.com/screens/2c3c6c16-1fcd-4323-aa3b-7adff6a2d6f2?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Once finished, the reasoning collapses into a single grey line, "Thought for 11 seconds" or "💡 Thought for 15s", above the answer. |

**Takeaways:** (a) a live line with **verb plus elapsed time** ("Thinking 2s", "Worked for 13 seconds", "Thought for 15s") that collapses to one grey line when done. (b) A **step list with ✓ per completed tool call** and the current step in bold with a spinner. (c) Long runs get a **side activity panel** with a sources count and Stop. (d) Stop replaces Send in the composer for the whole run. (e) Unify paints a skeleton of the result (table) while steps run.

---

## 4. Answers with sources, citations and inline data

| App | What the screen shows |
|---|---|
| [Linear: inline live object rows](https://mobbin.com/screens/692145d1-6e38-4386-9a5a-e597c4c120b4?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | The answer embeds the product's own issue-row component (clickable, with status and assignee) between the lead sentence and the bullets. This is the closest analogue to Compass's generated components. |
| [Gemini Notebook: numbered inline citations](https://mobbin.com/screens/05def46a-970f-46b2-8bf0-e0e83c7dd49e?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Bold lead-ins per bullet with small grey numbered chips (1, 2, 3, 7, 8) after clauses. A left Sources panel has checkboxes ("Select all"). Above the answer is a "Save to note" pill plus copy, 👍, 👎. The composer reads "8 sources". |
| [Cohere: citation chips row](https://mobbin.com/screens/4100675f-3440-45a6-8b20-de1a8c765568?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | The cited spans are highlighted in the text. Below the answer, "Citations:" lists favicon chips with domains and a "+8" overflow chip, with share / copy / 👍 / 👎 on the right. Above the answer, a grey box "Performing multistep reasoning using tools" shows the rationale and the "web-search:" query. |
| [ChatGPT: inline source pills plus Sources button](https://mobbin.com/screens/73833b79-1dd5-4354-8fc4-a2e99c33a75e?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Tiny grey domain pills inline after sentences ("reuters.com", "apnews.com"). At the end, a "Sources" button with stacked favicons. |
| [WRITER: Sources side panel and "Plan: complete task"](https://mobbin.com/screens/4a222df9-9ae9-40a0-972f-b0be9bfaa12f?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A "Plan: complete task" chip, then a result card ("Presentation · ✓ Complete") listing 6 numbered items. A "Sources" pill toggles a right panel of source cards (favicon, domain, bold title, 2-line snippet). Feedback reads "HOW DID WRITER AGENT DO? Nailed it / Missed the mark". |
| [Xero Analytics: AI insight under a chart](https://mobbin.com/screens/c9072ade-ef2a-4821-bb0a-c70096d7a254?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Below a bar chart sits an "✦ Insights Beta" card with prompt pills ("Explain the trends in my income and expenses" selected, "How is my business performing", "How can I improve profit"). The result is a "📊 Summary — Income & Expenses" list with emoji markers (⬇️ ⬆️ ⚠️) and **exact figures quoted in quotes**. Then regenerate / copy / 👍 / 👎 / clear, and a long legal disclaimer. |
| [Grok: table answer with version pager](https://mobbin.com/screens/2c3c6c16-1fcd-4323-aa3b-7adff6a2d6f2?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) / [Mistral: report table](https://mobbin.com/screens/eccc91ee-0c75-4467-bbee-f99e3069367b?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Full-width bordered tables inside the message. Grok shows "‹ 2/2 ›" response versions above the answer. Mistral adds "Generate PDF report" above the table and a timestamp under it. |
| [Langdock: chart in chat](https://mobbin.com/screens/8e084e8b-3d61-41f9-8230-104462b21dc2?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | "› Read skill, worked" collapsed line, then a bordered card "2 images · 2/2" with ‹ › arrows holding a radar chart, then narrative below. |
| [Perplexity iOS: inline source chips](https://mobbin.com/screens/fe1aa2bb-e46b-45b2-ac6f-e2cb4916cbf1?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) / [ChatGPT iOS: Sources sheet](https://mobbin.com/screens/3eaf4e44-fdce-48bc-965b-b194ed9c43ac?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) / [Beside iOS: numbered dots](https://mobbin.com/screens/93bfe0a3-157b-47ed-bf29-cb00113e7c20?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Perplexity: monospace chips "youtube +1" at the end of bullets, an action row (share, download, rewrite, copy), "10 sources", then ↳ follow-up suggestions. ChatGPT: tapping Sources opens a **bottom sheet** of source rows. Beside: small circled numbers ① ② ③ inline. |
| [Public iOS: AI blurb inside data sheet](https://mobbin.com/screens/712600e3-810e-4a73-877c-449512deb433?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A sector bottom sheet. A bordered callout ("Technology sector is sharply higher today, powered by…") carries **"Generated by Agents at 10:22 AM ✦"** in small grey text, followed by a data table (1D / 1Y change) and two buttons (Compare / View VGT). |

**Takeaways:** citations take one of two forms. Either inline small grey chips or numbers (Gemini, ChatGPT, Perplexity, Beside, Cohere), or a "Sources" button that opens a side panel on desktop or a bottom sheet on iOS. Tables render full-width with borders. Charts sit in a bordered card with a pager when there are several. Generated text over data **states exact numbers and stamps provenance and time** ("Generated by Agents at 10:22 AM", "Summarized at 6:00 AM", "Data from binance.com").

---

## 5. Proposed actions needing approval

| App | What the screen shows |
|---|---|
| [ChatGPT Codex iOS: approval card](https://mobbin.com/screens/760a26c6-bcae-480a-8757-7e58d975ea7b?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | The narration explains *why* it will ask ("Since emptying Trash is destructive, I'll ask before removing anything."). The card asks a question ("Do you want to allow me to inspect your macOS Trash before emptying it?"), shows the **exact command in a grey mono block**, then a black **Approve** button, an outlined **Always approve** and a small **Deny** pill inline with a "Tell Codex what to do" field. A "Pursuing goal 12s" pill floats above. |
| [Navan: inline confirm card in panel](https://mobbin.com/screens/82d0c1eb-a54d-44f6-9753-52bffbd285b5?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | "Asmobbin is ready to create. Please review it and confirm." A white card titled "Confirm your company legal entity" lists the key/value fields (Legal Name, Address). Below are two arrow-text actions, "→ Confirm" and "→ Edit", then 👍 👎. |
| [Notion AI: change receipt with "Show changes"](https://mobbin.com/screens/9a45b305-7f6e-45b5-acd9-7d22c8606a33?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | After acting, a card "Created Task Database and linked in instructions" with a **Show changes** button, then "Created: ✅ Task Database" and "Edited: 📄 Instructions". A sticky bar above the composer reads "Task triager · Unsaved changes · Save". |
| [Structured iOS: created item with Undo](https://mobbin.com/screens/b9d89e7d-49f0-47bd-bcb1-2b8fe9007e0a?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | The AI's created event card carries a "✓ CREATED" tag on its border and three equal buttons: **Edit / Undo / Show**. |
| [Mercury: review-everything summary](https://mobbin.com/screens/d3c20839-1157-4e6a-8d54-068d1e83b109?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | "Let's review everything / You can still go back and make changes." A card lists consequences with ✓ ("2 new budgets will be created", "1 person will be assigned budgets: We'll notify them via email and app", "Spend will route automatically"). Footer buttons: Back / **Create budgets**, where the label is the specific verb. |
| [Deel: Accept suggestion / Recreate / Adjust](https://mobbin.com/screens/07b2ed6b-dfe6-46bd-8a76-99d8f7b80f57?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | The AI draft appears in a bordered box under an "Ask for any changes?" input. Footer: "Adjust ▾", "↻ Recreate", a black "✓ Accept suggestion" and a trash icon. |
| [Dovetail: suggestion cards with Accept all / Reject all](https://mobbin.com/screens/0d5151ab-6ade-47f5-8b03-024571200782?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A side panel titled "2 suggested highlights ⌃" with **Accept all / Reject all**. Each card shows ✦, the quoted text, a tag chip ("Pain point 1 ×"), and Accept / tag / ✕. |
| [Mintlify](https://mobbin.com/screens/75a194a1-ad5f-44e0-b8eb-6f78bd5598ee?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) / [v0](https://mobbin.com/screens/fa34ea87-3b4a-4de3-9987-bbfc3e84e470?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) / [Mistral agent versions](https://mobbin.com/screens/782f5257-54b5-44df-aac7-4ffd42aa1d3c?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Mintlify: the chat ends with "1 file change · internal/components-guide +213", and the main pane shows a red/green side-by-side diff with "Back to editing ×" and Publish. v0: a ✅ checklist of applied changes in chat ("✅ Changed color to #cc2b60") next to the diff. Mistral: a "Review your changes" modal with "Current version: v0 → New version: v1" diff, an optional "Describe this version" field and "Save Agent Changes". |
| [Shopify Sidekick](https://mobbin.com/screens/6ba41d7d-c9c9-4afe-a6e4-8de3977e9a64?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) / [Unify](https://mobbin.com/flows/72f50aff-483e-446f-a8f8-ffe4f25ccd96?tab=screens&utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | When the AI needs a decision, a **question card docked above the composer**: "1/2" pager, numbered options with keyboard numbers (1–4), "Other" free text, and Skip / Next ↵. |

**Takeaways:** the approval card is **inline in the thread**, not a modal. It shows (1) a plain-language summary of what will happen, (2) the exact parameters (fields, or the command or diff), and (3) a primary button named with the specific verb ("Create budgets", "Approve", "Accept suggestion"), plus a secondary Edit/Deny. After execution, a **receipt card** with ✓ and **Undo / Show changes** replaces it (Notion, Structured). For repeat actions, "Always approve" (Codex) or "Accept all" (Dovetail).

---

## 6. AI briefings / digests on a home screen

| App | What the screen shows |
|---|---|
| [Fey: "Daily recap" card](https://mobbin.com/screens/dc5328bd-98d9-46b1-9b18-7ee5805fb878?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A two-column home: market chart plus sector list on the left. On the right, a hero card labelled "◂ Daily recap" with "**Summarized at 6:00 AM**" at top right and an expand icon. It holds a single bold 3-line paragraph ending in "Read more", followed by a feed of short news cards (ticker logo, 1-line headline, "Today · 10m ago"). |
| [Perplexity Finance iOS: Market Summary](https://mobbin.com/screens/93a10608-673e-4ee5-a919-5e506eb7ce4d?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | "Market Summary" with "Updated 2 minutes ago" on the right. An **accordion of headlines**: the first is expanded to a paragraph with numbers, the rest are collapsed rows with ⌄. Ends with "46 sources" (favicon stack), then a heatmap section below. |
| [Public iOS: agent-generated blurb](https://mobbin.com/screens/712600e3-810e-4a73-877c-449512deb433?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A one-sentence headline insight with ⌄ to expand and "Generated by Agents at 10:22 AM ✦", above the data table it explains. |
| [Slack iOS: channel summary](https://mobbin.com/screens/f3f930e0-49a9-4b2c-b476-18594c556a4d?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | "✦ General Reminders ⌄" heading, bullet with a [1] citation, "1 message summarized from today", a disclaimer with a "Give feedback" link, and 👍 👎. |
| [Fireflies: Personal Assistant tiles](https://mobbin.com/screens/cb1796cb-0cb7-4abb-a56d-0e5937a344a7?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Home "Good Evening, Alex" with a "Personal Assistant" row of tiles: "Daily Digest ✓ · 2 meetings, 11 hours ago" and "Meeting Prep ✓ · No upcoming meetings". An "Ask anything from your meetings…" bar floats at the bottom center. |
| [Sprig: AI Insights feed](https://mobbin.com/screens/f4b4d803-5a17-4193-b5c6-d89383104f39?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | "AI Insights" with an "All / You" segmented toggle and a "Yesterday" divider. A card shows the source object (survey, 31 responses), a "✦ Summary" tag and a 3-line summary. |
| [Productboard home](https://mobbin.com/screens/f13010b2-199a-4be0-9cfa-843fc9064fa3?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | "Good evening, Alex! What will we Spark today?" with a composer and skill cards. The bell holds notifications "Scheduled automation completed: Weekly Feedback Sentiment Summary · View results". |
| [Asana iOS: Summarize card](https://mobbin.com/screens/4e738c2c-a7bb-447e-b5f5-3ba22cf99e62?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A "✦ Project summary" card with a one-line explanation and a full-width **Summarize** button. This is on-demand, not precomputed. |

**Takeaways:** a brief is a **single card at the top** with a label ("Daily recap", "Market Summary"), a **freshness stamp** ("Summarized at 6:00 AM", "Updated 2 minutes ago"), a bold 1–3 sentence headline, then either an accordion of items (Perplexity) or a feed of short cards (Fey). It ends with the sources count and feedback. The brief sits *next to* the live data it explains, never replacing it.

---

## 7. Agents / background tasks / automations

| App | What the screen shows |
|---|---|
| [Unify: Scheduled chats](https://mobbin.com/screens/f4b6f05f-3c13-4b3b-b8d7-d6d3b91420af?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) and [creation flow](https://mobbin.com/flows/72f50aff-483e-446f-a8f8-ffe4f25ccd96?tab=screens&utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Each scheduled job is a row card: bold name, 2-line prompt preview, a schedule chip "🕐 Daily at 10:00 AM", a status ("Paused" or green "Next run 11 hours from now"), "▷ Run now", an enable toggle and `⋮`. Below is a template grid (icon, title, 2-line description, "Every Mon at 9:00 AM", "Add"). The empty state offers "Create manually" or "**Create with chat**". Create opens a right drawer with Name, Prompt (with "Try it in chat" and a model chip), and Frequency "On a timer / At a set time". |
| [Unify: create via chat](https://mobbin.com/flows/4e62f823-68bf-4d57-b7ca-0cf72aadce74?tab=screens&utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | The AI asks clarifying questions in a docked question card (1/2, recommended option first). It ends with "Done. I created the scheduled chat **Pipeline Multithreading Drafts**… Its next run is scheduled for **Aug 10, 2026 9:00 AM**", states the dependencies and confidence, then gives ↳ follow-ups. |
| [ChatGPT Tasks](https://mobbin.com/flows/2002085a-60e4-4bac-aa77-266ebe27c762?tab=screens&utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | The empty state "Start creating tasks / Ask ChatGPT to do things in the future" offers example chips plus "Try your own →". In chat, the AI returns a small **task card** ("Stretch · Next run May 12, 2025 ⋮") above its confirmation sentence, followed by an inline banner "Turn on desktop notifications · Allow / Not now". |
| [Manus: schedule from composer](https://mobbin.com/flows/7556e3aa-7c07-451e-a5d2-2a54df2332ca?tab=screens&utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Typing "Every day at 9:00 AM…" lights up a "📅 Schedule task" chip in the composer, and a toast says "Accepted". The thread shows the step "Create scheduled task…" with an attached "daily_trending_topics_summary · Scheduled task" object, then "Confirm task scheduling to user · 2/2". |
| [Gemini: Scheduled actions manager](https://mobbin.com/screens/a9515df0-210d-4edb-aac6-a4027e28ee37?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A template row of cards with + buttons, then "My actions" rows: schedule text ("Monday, Tuesday… at 8 AM"), title, prompt preview, a status "Paused" and a toggle. |
| [Lindy: My Agents table](https://mobbin.com/screens/c6c72ec1-9c98-4517-8d2d-6706f88f97b0?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Columns Name / **Last Run** ("About 4 hours ago") / Integrations (icon stack, "+5") / **Enabled** toggle. |
| [Gumloop home](https://mobbin.com/screens/7da1e89d-5538-412a-98f7-cb2b50e52fe9?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | "Most Used Agents" cards, "Recent Activity" (✓ green per run, "Manual", "3 hours ago") and "**Upcoming Triggers**" with an "Agents 1 / Workflows 1" toggle. |
| [Browserbase: Recent runs](https://mobbin.com/screens/91fff3d4-82a6-4d59-95bd-0da39f7d3d51?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A runs table: Agent ID, Status (green "Complete" pill), Run ID, Duration "44.8s", Steps "7", Task, Result, Started. |
| [Manus: task completed card](https://mobbin.com/screens/0f0a51a4-a51f-4726-9f9e-b85123e701fd?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Result document card, "✓ Task completed" in green, "How was this result? ☆☆☆☆☆", and "Suggested follow-ups" including "Set up automatic daily collection…", which offers to make it recurring. |

**Takeaways:** an agent row has **name, plain-language trigger or schedule chip, last run, next run, status (Paused / green), Run now, enable toggle, `⋮`**. Agents get created either from a form drawer or **"Create with chat"**, which ends in a confirmation stating the next run time. A templates grid helps first-time users. Completed runs show up as notifications ("Scheduled automation completed: … View results") and in a "Recent activity" list with ✓.

---

## 8. Mobile (iOS) assistant screens

| App | What the screen shows |
|---|---|
| [ChatGPT iOS home](https://mobbin.com/screens/afe6d698-a43e-4071-aa6f-3170758cdf6d?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | The composer pill sits at the bottom ("+ Ask ChatGPT", mic, a filled blue voice-mode button). Three icon-plus-text starters are stacked just *above* the composer, in thumb reach. Top bar: ≡, "✦ Upgrade" pill, new-chat. |
| [Claude iOS](https://mobbin.com/screens/3ecbf36f-0aea-4f7c-846b-703ce03bd2ab?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A rounded composer card with the placeholder "Chat with Claude", then `+`, a model chip "Sonnet 4.6 Low", a mic and a black circular voice button. An upgrade nudge sits inside the card above the input. |
| [Copilot iOS](https://mobbin.com/screens/7d36cdb1-6c49-4cd5-8c9b-3fbd3829bb5d?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Large left-aligned greeting "Hey Sam, how can I help?", a horizontally scrolling chip row above the composer, and a mode chip "Quick ▾" inside the composer. |
| [Cleo iOS: assistant plus quick replies](https://mobbin.com/screens/61dbd028-5ec9-49cd-8621-3056ba8a3341?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A big "Hey you 👋" with a data sentence ("Starbucks made 9 appearances in your last 7 days for $75.22"). **Quick-reply chips** ("income", "bills") sit right-aligned above the input, and the assistant is a tab ("Ask Cleo") in the bottom bar. |
| [Binance AI bottom sheet](https://mobbin.com/screens/fc295cc9-ada7-4e6d-a0b5-9304097fac4f?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | The assistant opens as a **near-full-height sheet** with a grabber, `···`, a "✦ Binance AI Beta" title and new-chat. The answer has "Data from binance.com" provenance, then 👍 👎 and a composer with mic. Footer: "Binance AI can make mistakes. Verify its outputs! View more". |
| [Comet iOS: Assistant sheet](https://mobbin.com/screens/2faad092-c040-40a9-af66-d7426930b2b2?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A sheet with ✕ and an "open full" icon. "2 steps completed ›" above the answer, inline source chips, and a scroll-to-bottom ↓. The floating composer "Ask a follow up…" has mic and a new-thread icon. |
| [Public iOS: data bottom sheet](https://mobbin.com/screens/712600e3-810e-4a73-877c-449512deb433?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A sheet with a title plus a big % change, an AI callout with timestamp, a table and 2 actions. This is the template for a "brief item detail" sheet. |
| [Copilot iOS voice](https://mobbin.com/screens/dde18761-b196-4a1d-919e-10fbe3421871?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) / [Google Search Live](https://mobbin.com/screens/b1ede01b-db3f-432e-8df6-2c659f1e96eb?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) / [WhatsApp Meta AI](https://mobbin.com/screens/6474d2b9-3803-4bd3-90ee-143cf9dda044?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Voice mode is a full-screen state with one status word ("I'm listening" / "Listening…"), an animated orb or glow, and a bottom control capsule (✕, mic, settings) or Mute / Video / **Transcript** buttons. Google adds the line "Search Live is AI and can make mistakes". |
| [Lloyds iOS: in-app "Explore your spending"](https://mobbin.com/screens/0b513db0-3b95-44c1-aa50-6ebd386b1c8a?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A dedicated screen with a "BETA" pill and "Conversations are powered by AI". The state shows "✦ ••• Preparing a response", and the composer shows a "0/256" counter. |

**Takeaways:** the composer is bottom-anchored with mic plus a separate voice-mode button. Starters stack directly above the composer. An in-app assistant opens as a **bottom sheet** with a grabber and a new-chat icon. Answers end with a provenance line ("Data from …"), feedback icons and quick-reply chips. Voice is a separate full-screen state with a single status word.

---

## 9. Feedback controls

| App | What the screen shows |
|---|---|
| [Claude web: action row](https://mobbin.com/screens/028209d5-855b-43dd-9ee1-d0caf63e3aae?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Under the answer: copy (✓ after click), 👍, 👎, ↻ retry. These are small grey icons with no labels, left-aligned. |
| [Gemini web: "What went wrong?"](https://mobbin.com/screens/716ae53a-d3c9-4510-8003-ef469cc90a21?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Clicking 👎 fills the icon and expands an **inline** panel under the answer: "What went wrong?" with stacked rows "Offensive / Unsafe", "Not factually correct", "Didn't follow instructions", "Personalization issue", "More…", "Other", plus ×. |
| [Perplexity: "Help us improve" modal](https://mobbin.com/screens/75ffe4ec-cdd6-46ba-b294-f5d911ae82a8?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) and [positive follow-up popover](https://mobbin.com/screens/4bb8f8e1-be0b-42b4-bc48-f8eab91c0182?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Negative: a 2-column chip grid with icons (Inaccurate, Out of date, Too short, Too long, Harmful or offensive, **Wrong sources**), an optional text field and Cancel / Submit. Positive: a small popover "What did you like about this response? (optional)". |
| [Square: inline reasons popover](https://mobbin.com/screens/524cf8d3-26d7-42c9-bc81-6a2e40468dc5?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | "Why wasn't this helpful?" with checkboxes (Incorrect information, Hard to understand, Not what I asked for, Technical issue, Other), an optional details field and Cancel / Submit. |
| [Copilot: feedback modal](https://mobbin.com/screens/aaf8e1d6-5363-4369-8c8e-d29fda53e208?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | The action row has 👍 👎 share copy speak regenerate and "Edit in a page". The modal lists radio options under "Text response" (Ignored or refused instructions, Missing key information, Forgot previous context, Factually incorrect). |
| [ChatGPT: in-thread micro-survey](https://mobbin.com/flows/2002085a-60e4-4bac-aa77-266ebe27c762?tab=screens&utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | A small inline pill under the message, "Is this conversation helpful so far? 👍 👎 ×". |
| [Grok: response versions](https://mobbin.com/screens/2c3c6c16-1fcd-4323-aa3b-7adff6a2d6f2?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | After regenerate or edit, a "‹ 2/2 ›" pager above the answer lets the user flip between versions. |
| [Mistral Le Chat row](https://mobbin.com/screens/eccc91ee-0c75-4467-bbee-f99e3069367b?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) / [Gemini iOS row](https://mobbin.com/screens/14c6b403-0f06-482b-8d2e-6c7a32d8a433?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | Mistral: a timestamp on the left and 👍 👎 present regenerate copy play on the right. Gemini iOS: a "🔗 Sources" pill, then 👍 👎 ↻ share copy `⋮`. |

**Takeaways:** a single row of 4–6 unlabeled grey icons under each assistant message: copy, 👍, 👎, regenerate, plus optional share/export. 👎 opens **reasons as chips or checkboxes** (inaccurate, out of date, wrong sources, didn't follow instructions) with optional text. Regenerated versions are kept behind a "‹ n/N ›" pager.

---

## Synthesis: recurring patterns (counts = distinct apps observed in this session)

| # | Pattern | Count | Apps |
|---|---|---|---|
| P1 | Disclaimer line "X can make mistakes" under the composer or answer | 14 | ChatGPT, Gemini (web+iOS), Productboard, Plane, Dropbox Dash, HoneyBook, Navan, Deel, Mistral, Binance, Slack, Google Search Live, Square, Oura |
| P2 | Icon row under answers (copy / 👍 / 👎 / regenerate) | 14 | Claude, ChatGPT, Gemini, Perplexity, Copilot, Mistral, HoneyBook, Dropbox Dash, Cohere, Otter, Fireflies, Xero, Binance, Meta AI |
| P3 | Model or mode chip *inside* the composer (not the header) | 12 | Notion, Plane, Unify, Figma, Langdock, Gemini, Claude iOS, Copilot iOS, Meta AI, Mistral, Grok, ClickUp ("All Sources") |
| P4 | Starter prompts below or above the composer in the empty state | 12 | Notion, Productboard, Plane, Deel, Lightfield, Aboard, Asana, Dash, Sana, Gemini iOS, ChatGPT iOS, Copilot iOS |
| P5 | Collapsed "Thought / Worked for N s" line plus expandable steps | 10 | Linear, Notion, Unify, Otter, Grok (web+iOS), Figma, DeepSeek, TikTok, Langdock, ChatGPT |
| P6 | Stop button replaces Send while generating | 9 | Unify, ClickUp, ChatGPT, Grok, DeepSeek, Linktree, TikTok, Lindy, Browserbase |
| P7 | Assistant as a right-side panel with an expand-to-full-page icon | 9 | Linear, Notion, Asana, HoneyBook, Aboard, Fabric, Rows, Obvious, Shopify |
| P8 | Citations: inline chips or numbers, plus a Sources panel or sheet | 9 | ChatGPT (web+iOS), Gemini Notebook, Perplexity, Cohere, Copilot, WRITER, Beside, Slack, Comet |
| P9 | Scheduled agent row: schedule chip + last/next run + toggle + Run now | 6 | Unify, Gemini, Lindy, Productboard, Gumloop, ChatGPT Tasks |
| P10 | Inline approval or confirm card with a verb-specific primary button | 6 | ChatGPT Codex, Navan, Mercury, Deel, Dovetail, Shopify (question card) |
| P11 | Follow-up suggestions after the answer (↳ rows or chips) | 6 | Perplexity, Unify, Manus, Fireflies, Opera, Cleo |
| P12 | Freshness/provenance stamp on AI summaries | 5 | Fey ("Summarized at 6:00 AM"), Perplexity Finance ("Updated 2 minutes ago"), Public ("Generated by Agents at 10:22 AM"), Binance ("Data from …"), Slack ("1 message summarized from today") |
| P13 | Structured clarifying question card docked above the composer (n/N, numbered options, Skip) | 4 | Shopify, Perplexity Computer, Unify, (Manus step confirm) |
| P14 | Post-action receipt with Undo / Show changes | 3 | Notion, Structured, Mintlify ("1 file change +213") |
| P15 | Domain objects rendered *as product components* inside the answer | 3 | Linear (issue rows), Unify (table pane), WRITER (result card) |

### Details worth copying for Compass

**Panel and layout (desktop, revenue manager)**
- A right-docked panel of about 25–30% width (Notion), with a header of `title ▾ · new · history · expand · close` (Linear, Asana, HoneyBook). The expand icon promotes the conversation to full page, as Linear does with "Ask Linear". This lets an analysis grow without losing the dashboard.
- Composer, left to right: `+` attach/mention · sliders (sources/permissions) · mode chip · spacer · model text chip "Auto" · mic · send→stop. Write access is a **toggle "Can make changes"**, off by default (Notion).
- Context chip above the input text showing what the assistant is looking at (Plane's workspace chip, Notion's avatar chip, Fabric's "Current file + 1 item"). For Compass this would be the "Hotel: X · Last 30 days" chip.

**Empty state**
- Greeting headline plus 3–6 starter prompts phrased as real questions over the user's own data, as Deel ("Show number of workers by country") and Lightfield ("Which of my opportunities need updating?") do. Group them under small labels the way Asana does ("For you", "Insights", "More"). Put Recent chats next to the suggestions (Notion).

**Progress**
- A single grey status line with a verb and live seconds: "Thinking 2s", then "Worked for 13 seconds ▸" when done (Linear, Grok). Expand it to a ✓ step list using **tool-named steps** ("Queried rows", "Displayed table · View table", from Unify).
- Paint a skeleton of the component that is coming (Unify's skeleton table pane) so the user sees *what* is being built.
- For long agent runs: a side "Activity / N Sources" panel with a timeline and **Stop / Update** (ChatGPT deep research), finishing with "✓ Completed in 5m · 23 sources".

**Generated components in answers**
- Lead sentence, then the component, then 2–3 bullets that interpret it with exact figures (Linear issue rows; Xero quotes exact amounts and marks direction with ⬆️⬇️⚠️).
- Bordered cards. Several charts get a "‹ 1/2 ›" pager (Langdock). Tables are full-width with an export action ("Generate PDF report", Mistral).
- Cite data provenance as small grey chips, not footnotes. For Compass, chips should name the dataset or metric ("PMS · Oct 1–31") rather than URLs, in the style of Binance's "Data from binance.com".

**Approval cards**
- Inline in the thread. The structure is a title stating the action ("Confirm your company legal entity"), key/value parameters or a before→after diff, consequence lines with ✓ ("1 person will be assigned… We'll notify them via email"), then a **primary button with the specific verb** ("Create budgets", "Approve"), plus Edit and Deny (Navan, Mercury, Codex).
- Explain *why* approval is needed before the card ("Since emptying Trash is destructive, I'll ask before…", Codex).
- After execution, the card becomes a receipt: "✓ CREATED" tag plus **Edit / Undo / Show** (Structured), or "Show changes" (Notion). Offer "Always approve" for repeat low-risk actions (Codex).

**Morning brief (phone GM, desktop home)**
- One hero card labelled "Daily recap" with "Summarized at 6:00 AM" at top right. It holds a bold 2–3 sentence headline, an accordion of 4–6 items (first expanded, the rest one-line with ⌄, as in Perplexity Finance), and ends with "N sources" and 👍👎.
- Tapping an item opens a **bottom sheet** with the metric, a big delta, an AI callout stamped "Generated by Agents at 10:22 AM", a small table and 2 action buttons (Public).
- Keep live KPIs visible beside the brief (Fey's left chart and right recap), never replace them with prose.

**Agents watching metrics**
- Row: name · plain trigger chip ("🕐 Daily at 10:00 AM" or condition) · status ("Paused" grey / "Next run 11 hours from now" green) · ▷ Run now · toggle · `⋮` (Unify). A table variant adds **Last Run** and Enabled columns (Lindy).
- Creation offers two entry points, "Create manually" (right drawer form) or "Create with chat". The chat path ends with a confirmation that names the agent and its next run in bold (Unify), plus the in-thread "Turn on notifications · Allow / Not now" prompt (ChatGPT Tasks).
- Run results arrive as notifications reading "Scheduled automation completed: <name> · View results" (Productboard), and as a "Recent activity" list with ✓ (Gumloop).

**Mobile**
- Bottom composer pill with `+`, mic and a filled voice button. Starters stacked directly above the composer, in thumb reach (ChatGPT iOS). Quick-reply chips right-aligned above the input after each answer (Cleo).
- In-context assistant as a near-full-height sheet with a grabber, "✦ Name" title and new-chat (Binance, Comet). Sources open in a bottom sheet (ChatGPT iOS).
- Voice: full-screen, one status word ("Listening…"), bottom capsule ✕ / mic / settings, plus a Transcript button (Copilot, Google).

**Feedback**
- Icon row: copy · 👍 · 👎 · ↻ (Claude), grey and unlabeled, with copy flipping to ✓ for about 1.5s.
- 👎 expands inline (Gemini) into reason chips. For a data product, use Perplexity's set, which includes **"Out of date"** and **"Wrong sources"**: "Inaccurate · Out of date · Wrong sources · Too long · Didn't follow instructions" plus optional text.
- Keep regenerated versions behind "‹ 2/2 ›" (Grok).

**Wording seen and reusable**
- "Thought for 15s" / "Worked for 13 seconds" / "View all steps (4)" / "Research completed in 5m · 23 sources"
- "Summarized at 6:00 AM" / "Updated 2 minutes ago" / "Generated by Agents at 10:22 AM"
- "Let's review everything / You can still go back and make changes."
- "Scheduled automation completed: … View results" / "Next run 11 hours from now" / "Paused"
- "Can make changes" (permission toggle) / "Always approve" / "Accept all · Reject all"
- "<Product> can make mistakes. Please double-check responses."

**Motion (inferred from static states; Mobbin is screenshots only)**
- The status line counts up seconds live, then collapses into a one-line disclosure ("Thinking • 2s" becomes "Thought for 15s").
- Steps get ✓ one by one, and the current step shows a spinner (Raycast's tool row, Lindy).
- The copy icon swaps to ✓ / "Copied!" tooltip (Dropbox Dash, Claude).
- Voice uses a pulsing orb or glow (Copilot, Roku, Meta AI).
- Unify's skeleton table pane shows shimmer placeholders before the data lands.
