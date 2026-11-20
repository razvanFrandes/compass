# Watchers page: how to show AI agents, monitors and scheduled automations

Research round 3, done 2026-11-20, for the Compass Watchers page. Compass uses Angular and Tailwind with the dark-first Juyo palette: ink `#0D1117`; surfaces `#161C22`, `#1E2429` and `#2A2E33`; purple `#996AD5`; orange `#FE7637`, which means "needs your decision"; and Inter.

**The brief.** The user rejected the plain text list. This document finds the strongest established patterns for showing a user's agents and recommends one premium pattern for the three watchers:

| Watcher | Schedule | Autonomy | State |
|---|---|---|---|
| Event pricing | daily 06:00 | recommends a rate | needs your decision |
| Comp-set rates | every 2 h | alerts only | idle |
| OTA mix | weekly | — | paused |

**Method.**
- **Mobbin:** 26 screen searches (one returned nothing) and 2 flow searches across web and iOS. Every cited screen was opened and looked at, not judged from its metadata.
- **Official docs:** docs, changelogs and official posts for the 17 products in the brief, read on 2026-11-20. Three research passes ran in parallel, and the key claims were spot-checked: n8n schedules, the Gemini Enterprise gallery, and Pulse's retirement.
- **Earlier Compass research:** `ai-ux/pattern_canon.md`, `ai-ux/mobbin_best_ai_apps.md`, `ui-refinement/juyo_brand.md`, `ui-refinement/color_type.md` and `ui-refinement/mobile_and_boards.md`.

**Labels.**
- **[Mobbin]**: seen on a Mobbin screen.
- **[Docs]**: in official documentation.
- **[source]**: read in a vendor's open-source frontend.
- **[our call]**: a decision we derived; no source states it as a rule.
- "Not documented": we looked and found nothing.

---

## TL;DR

1. **Use agent cards in a grid, not rows.** Cloudscape's agent-management pattern, Gemini Enterprise's Agent Gallery, Zapier's "My agents", n8n, Manus "Manage" and Gumloop all present agents as cards. NN/g: cards suit "collections of heterogeneous items". The three watchers differ in cadence, output and state, which is exactly what rows flatten.
2. **Each card answers the questions n8n puts on every schedule:** "the next run time, the last run time, and the outcome of the last run". Compass adds the latest finding itself and a strip of the last 14 runs.
3. **The run strip comes from monitoring tools, not agent builders.** Sentry Crons is the reference: a 14 px tick row, colour by status, worst status wins, per-status tooltip. Statuspage, Checkly, incident.io and Better Stack are similar. No agent platform documents a strip on its cards; that gap is where Compass can look premium.
4. **"Needs your decision" is a run state every major platform now names.** Zapier "Needs action", Copilot Studio "Waiting for user", Gemini Enterprise "Needs Review", Linear `awaitingInput`, Gumloop "Approval Required", Ramp "Requires review". It sorts first, is the only orange element, and carries the named action ("Review €189 →").
5. **Autonomy is a short ladder of named stopping points, shown on the card and starting low.**
   - Ladders elsewhere: Sentry Seer "Where should Seer stop?"; Relevance "Auto Run / Approval Required / Let Agent Decide"; Zapier "Off / Suggest fixes / Automatically fix"; Gumloop "Always allow / Ask each time / Ask for writes/deletes / Never allow"; Ramp "starts in review-only mode by default".
   - Juyo sells "an autonomy control you set property by property".
   - Compass: Alerts only → Recommends · you decide → Acts within limits. The third level is shown locked, because Compass never writes rates.
6. **Keep "is it on?" apart from "how did the last run go?".** Zapier says outright that published state is "different from activity running statuses"; Gumloop and n8n separate them too. On the card, the switch shows the first and the chip and strip show the second.
7. **Create three ways:** describe it in chat, start from a template, or set it up manually. LangChain Fleet, Notion Custom Agents, Relevance AI, Linear Loops, Manus Automations and Gemini Enterprise all offer the same three entries. The flow ends on a review card that restates the watcher in one sentence with the first run time, as Mercury and Unify do.
8. **The market moved this way in 2026.** Zapier Agents moved to AI by Zapier, ChatGPT agent and Pulse gave way to Work and Scheduled tasks, Lindy moved to Routines, and Manus to Automations. OpenAI's stated lesson: people value "a dedicated place for proactive work". The Watchers page is that place for a hotel.

---

## 1. The seven layouts products use

| | Layout | Examples | Good at | Weak at |
|---|---|---|---|---|
| A | **Rows / table**: name, schedule, last run, status, switch | Lindy (old "My Agents"), Relevance AI agent list, Vapi Monitors, Klaviyo Auto monitors, Hex Scheduled runs, Base44 Workflows, Cursor Automations, Datadog Manage Monitors, Copilot Studio Activity | Many items, sorting, bulk actions | Every state looks the same; no room for a finding or history. **This is what the user rejected.** |
| B | **Agent cards in a grid**: avatar, name, description, meta, switch or action | Cloudscape guidance; Gemini Enterprise gallery; Zapier "My agents"; n8n workflows; Manus "Manage"; Gumloop; Relevance AI home; Mistral; Langdock; StackAI; Fireflies; Sana; Copy.ai; Google Home (iOS) | Identity, mixed content, small sets | Ranking, dense scanning (NN/g) |
| C | **Wide row-cards for scheduled tasks**: name, prompt preview, schedule chip, status, Run now, switch | Unify Scheduled chats, Gemini Scheduled actions, ChatGPT Scheduled, Manus iOS | Schedule clarity, quick actions | No history, no finding |
| D | **Monitor list with a run strip** | Sentry Crons and Uptime, Datadog synthetics, Statuspage, incident.io, Checkly, Better Stack | Health at a glance, trust | Says nothing about decisions; no persona |
| E | **One agent's home page**: persona, status line, approval queue, recommended actions | Wix AI Marketing Agent ("Kleo"), Tana agent page, Intercom Fin, Plain's agent activity, Gorgias AI Agent | The decision loop; trust copy | One agent per page, so not an overview |
| F | **Canvas / node graph** | n8n, Attio workflows, Gemini Enterprise Workflow Builder, Agentforce Canvas, Relevance Workforce, Copilot Studio Map view, Railway | Building and debugging | GMs and revenue managers don't wire nodes |
| G | **Queue or inbox of things that need you** | LangChain Fleet "Needs Attention", Gumloop "Approval Required", Relevance "Approvals", Zapier "Needs action", Copilot "Waiting for user", Gemini Enterprise "Needs Review", Ramp homepage groups, Mercury "Needs Approval", Datadog "Triggered Monitors" | Never missing a decision | A second place to check |

**Recommendation in one line:** B (cards) carrying D's run strip, a slice of E (the pending decision shown on the card, as Wix does), and G expressed as a "Needs you" filter, nav badge and sort order rather than a separate page. Details in §5.

---

## 2. Product by product

Each product is described with the same fields. **[Mobbin]** means we saw it on a Mobbin screen. **[Docs]** means it is in the official docs, a changelog or an official post. "Not documented" means we looked and found nothing. Several products changed a lot in 2026, so each entry describes the current product and names what it replaced.

### 2.1 Zapier Agents (moving to "AI by Zapier")

- **2026 status [Docs].** Every Agents article now says "Zapier is moving Agents to AI by Zapier". Each agent becomes a Zap with one "AI by Zapier" step. No shutdown date has been set ([migration, updated 2026-10-27](https://help.zapier.com/hc/en-us/articles/47402591569805)).
- **Layout [Docs].**
  - "My agents" uses agent cards. During migration a card shows a "Ready to migrate" badge; after migration it shows a "Published badge, Activities used count, last run timestamp, and an Open Zap link".
  - Agents can be grouped into "Pods" ([pods](https://help.zapier.com/hc/en-us/articles/36818615050765)).
- **Identity:** not documented. On Mobbin, the older assistant settings show a name with an emoji icon, "Data sources … Syncing" and "Behaviors" with a "Trigger: On demand" block ([Mobbin](https://mobbin.com/screens/49d6542d-3f52-42bc-8928-dad6511e04ef)).
- **Status [Docs].** There are two separate layers:
  - The agent itself is "Published" or "Not published". The docs say this is "different from activity running statuses" ([versions](https://help.zapier.com/hc/en-us/articles/42070243063053)).
  - Each run is "Needs action", "In progress", "Failed", "Cancelled", "Completed" or "Test". "Needs action" covers an error, unclear instructions, or an approval you asked for ([statuses](https://help.zapier.com/hc/en-us/articles/36818600959501)).
  - On Mobbin, Zap history uses finer run states: "Stopped / Errored", "Held", "Waiting / Scheduled", "Filtered", "Success", "Playing" ([Mobbin](https://mobbin.com/screens/4af6e0a9-4e3c-4179-9c7d-e7455fdf2f22)).
- **Schedule [Docs].** "Schedule by Zapier" (e.g. "every day at 9 AM"), and the trigger is only active after "Publish" ([trigger](https://help.zapier.com/hc/en-us/articles/45394909914381)). Next-run display: not documented.
- **Activity [Docs].** An "All activity" page plus an "Activity" tab per agent; the default view is the last 2 days. Runs can be pinned with "Pin to top" ([activity](https://help.zapier.com/hc/en-us/articles/33336184962573)). A "Needs action" filter shipped on 2025-05-26 ([blog](https://zapier.com/blog/zapier-agents-pods-dashboards/)).
- **Autonomy [Docs].**
  - In Agents, approval is written into the instructions ("ask for my confirmation through [messaging app] before continuing"), and you "return to Zapier Agents to approve or stop" ([approval](https://help.zapier.com/hc/en-us/articles/41776074420493)).
  - AI by Zapier has a per-tool toggle, "Require approval before running", off by default ([tools](https://help.zapier.com/hc/en-us/articles/45863491098893)).
  - The Human in the Loop step offers "Approve" / "Decline" and "Let Reviewer edit content?" ([HITL](https://help.zapier.com/hc/en-us/articles/38731463206029)).
  - The early-access "Healing" setting is a 3-step ladder: "Off / Suggest fixes / Automatically fix". Even on automatic it still asks when a fix is high-risk ([agentic, updated 2026-11-17](https://help.zapier.com/hc/en-us/articles/49007548829069)).
- **Primary action [Docs].** "Run" at the top right, greyed out when the agent isn't published. Also "Publish".
- **Needs input [Docs].** The "Needs action" run status and its filter.
- **Create [Docs].** "+ New agent" → write instructions or "Use this template" → "Connect your apps" → "Configure". A Copilot chat handles edits ([build](https://help.zapier.com/hc/en-us/articles/24393442652557)).
- **Empty state:** not documented.

### 2.2 Lindy (now one assistant with "Routines")

- **2026 status [Docs].** Lindy is now one assistant (a "Teammate") plus "Routines". The old human-in-the-loop docs page now redirects.
- **Home [Docs].** A chat box plus cards: "Upcoming meetings", "Need to know" (items to act on), "What I've been up to" (stats), and "Recent learnings". When empty, the cards "stay hidden or show a friendly 'getting to know you' state" ([home](https://docs.lindy.ai/teammate/home)).
- **Layout [Docs].**
  - Routines are cards under the tabs "Personal / Workspace / Discover".
  - Built-in routines have an on/off toggle that "stops it without removing it".
  - Template cards in Discover show "Ready", "Needs setup" (with "Connect") or "Needs admin" ([routines](https://docs.lindy.ai/teammate/routines)).
- **Seen on Mobbin.** A template gallery by category, with a large hero tile and small cards with a coloured icon square, e.g. "Web Monitoring · Stay updated with real-time alerts" ([Mobbin](https://mobbin.com/screens/066fc832-8f57-4d71-b835-2c8a86d1a76b)). Round-1 research found the earlier "My Agents" table, with columns Last Run ("About 4 hours ago"), Integrations and an Enabled toggle ([Mobbin](https://mobbin.com/screens/c6c72ec1-9c98-4517-8d2d-6706f88f97b0)).
- **Identity [Docs].** One persona, with its own email address and phone number. Per-routine icons: not documented.
- **Schedule [Docs].** The default is "daily at 9:00 AM". Next run and run history: not documented.
- **Autonomy [Docs].**
  - Per-integration "Guardrails": "Always allow / Require approval / Don't offer". Approval uses "Approve" / "Deny" buttons in Slack, and "Always allow" changes the rule going forward ([integrations](https://docs.lindy.ai/integrations/overview)).
  - Legacy (archived 2026-06-08): an "Ask for Confirmation" toggle on actions with side effects. You approved by email or "in the task menu".
- **Create [Docs].** "New" opens "Describe your routine", which fills in the name, trigger and schedule. Alternatively, with "Teach a task", Lindy proposes a routine and you "approve activation" ([teach](https://docs.lindy.ai/teammate/teach-a-task)).

### 2.3 Relevance AI

- **Layout.**
  - [Docs] The agent list is a table with "Agent name" and "Description" columns. It supports pinning, folders and coloured tags, with filters "Pinned agents / My agents / Edited by me" ([agents](https://relevanceai.com/docs/get-started/core-concepts/agents)).
  - [Mobbin] The home page shows "Recent" agent cards, each with a pixel-art persona surrounded by orbiting integration logos and "Edited 16m ago". "Recommended AI agents" shows clone counts ([Mobbin](https://mobbin.com/screens/41b324ab-787a-440a-9160-63e27d0ff382)).
- **Identity [Docs].** An "Agent Profile" with a name and summary. The docs suggest names like "Samuel, the Sales Qualification Assistant" ([prompt](https://relevanceai.com/docs/build/agents/build-your-agent/prompt)).
- **Status [Docs].**
  - Tasks have 14 statuses, including "Pending approval", "Escalated", "Idle", "Timed out", "Paused" and "Exhausted retries" ([alerts](https://relevanceai.com/docs/build/agents/build-your-agent/alerts)).
  - The "Agent queue" uses "In Progress / Upcoming Queue / Failed / Processed / Cancelled" ([queue](https://relevanceai.com/docs/build/agents/give-your-agent-tasks/task-queue)).
- **Schedule [Docs].** "Recurring Schedule" (daily, weekly, monthly, custom or cron). Toggle it off to pause. Next run: not documented ([scheduled](https://relevanceai.com/docs/build/agents/build-your-agent/agent-triggers/scheduled-triggers)).
- **Detail [Docs + Mobbin].**
  - Tabs are Build, Run and Alerts.
  - The Run tab has a task list ("All / To Review", "Tabular view", "Agent queue"), a Timeline, and a Details panel with Status, Credits used, Run time and "Pause Task" ([tasks](https://relevanceai.com/docs/build/agents/give-your-agent-tasks/task-overview); [Mobbin](https://mobbin.com/screens/c1486516-90be-4b17-9bb7-f7d5e3290911)).
  - The paused banner reads: "This task is paused. This means it can not receive messages from you or triggers, and will not complete anymore work…" ([Mobbin](https://mobbin.com/screens/4366a3ad-efe2-464b-99e7-2ff4202948a5)).
- **Needs input [Docs].** A cross-agent "Tasks" page with tabs "Approvals / Escalated / Errors / All tasks". Bulk Approve / Reject / Rerun confirms with the number of tasks affected ([tasks page](https://relevanceai.com/docs/build/agents/give-your-agent-tasks/tasks-page)). On Mobbin, the approve modal asks "How would you like to approve? Approve immediately / Approve with work hours" ([Mobbin](https://mobbin.com/screens/cf5634be-2e4c-4499-97c3-e761293bdd80)).
- **Autonomy [Docs + Mobbin].**
  - Per tool: "Auto Run / Approval Required / Let Agent Decide", with "Max auto runs" as a cap. The docs advise starting at approval required and loosening over time ([tools](https://relevanceai.com/docs/build/agents/build-your-agent/tools), [approvals](https://relevanceai.com/docs/build/workforces/workforce-features/approvals-and-escalations)).
  - The "Agent autonomy limit" caps consecutive tool runs. When the limit is reached, "'Ask for approval' pauses for user input" ([Mobbin](https://mobbin.com/screens/99ee570c-42ff-4dab-9e3d-e8b8c200b897)).
- **Create [Docs].** "Invent" (describe the agent in words), "Clone from Marketplace", or "Start from scratch" ([create](https://relevanceai.com/docs/build/agents/create-an-agent)). "Workforce" is a canvas for teams of agents.

### 2.4 n8n

- **Layout [Docs].**
  - The workflows list uses cards with a published indicator. Since n8n 2.0 (2025-12-05), "Publish" replaces activation ([publish](https://docs.n8n.io/build/understand-workflows/save-and-publish-workflows), [2.x notes](https://docs.n8n.io/changelog/release-notes-2.x)).
  - A workflow's detail view is its node canvas.
- **Activity.**
  - [Docs] An "Executions" tab with the filters "Failed / Running / Success / Waiting" and "Retry execution" ([executions](https://docs.n8n.io/build/understand-workflows/understand-executions/view-all-executions)). The Overview page has an Insights banner for the last 7 days: failures, failure rate, time saved and run time ([insights](https://docs.n8n.io/administer/observe-and-log/track-usage-with-insights)).
  - [Mobbin] Executions are a list with a green or red left edge ("Succeeded in 63ms", "Error in 41ms"), next to the canvas with a check on each node and a logs panel ([Mobbin](https://mobbin.com/screens/cc8016fe-3d39-4041-8359-e5ef41e6973a)).
- **Agents (Preview) [Docs, verified].**
  - Identity: "Use the icon picker to change the icon". The release notes add an "icon and gradient" avatar.
  - Schedule: "n8n shows the next run time, the last run time, and the outcome of the last run for each schedule".
  - Approvals: "For sensitive tools, the agent pauses and asks for approval before running the tool", with **Approve** / **Reject**. Pending approvals appear in the "Sessions" tab ([agents](https://docs.n8n.io/build/build-and-manage-agents)).
- **Autonomy [Docs].** Workflow AI Agent nodes get a per-tool "Human review" step with "Approve" / "Deny". The request can go to Slack, email, Teams and other channels ([HITL](https://docs.n8n.io/build/integrate-ai/ai-examples/human-in-the-loop-for-tools)).
- **Create [Docs].** A Templates library, or the natural-language "AI Workflow Builder" with "Execute and refine" ([builder](https://docs.n8n.io/build/ways-of-building-workflows/ai-workflow-builder)).

### 2.5 Notion Custom Agents (Notion 3.3, 24 Feb 2026)

- **Where [Docs + Mobbin].**
  - Agents live in an "Agents" section of the sidebar, added with `+` ([help](https://www.notion.com/help/custom-agents), [release](https://www.notion.com/releases/2026-02-24)).
  - On Mobbin, the sidebar shows "Agents Beta · + New agent", and a row of round agent avatars sits under "Notion AI" ([Mobbin](https://mobbin.com/screens/cd858178-8f6c-4e87-9d4f-a1d3b10aa36a)).
- **Identity [Docs].** The API has a `custom_agent_avatar` with static and animated URLs ([API](https://developers.notion.com/reference/notion-agent-apis/update-agent)).
- **Status [Docs].**
  - In the API, an agent is `active`, `disabled` or `deleted`. A pause carries a `pause_reason`: `credit_limit`, `failure_limit`, `needs_user_review` or `disabled_from_agent_settings`.
  - The product page promises: "Disable agents anytime. Stop all runs, edits, and chats" ([product](https://www.notion.com/product/custom-agents)).
- **Schedule [Docs + Mobbin].**
  - [Docs] Triggers › Recurring (day, week, month or year, with a time and time zone). You can "review the next scheduled run time".
  - [Mobbin] Settings open with "Triggers: When should this agent run?", a **Run agent** button, trigger rows with toggles and "+ Add trigger" ([Mobbin](https://mobbin.com/screens/cd858178-8f6c-4e87-9d4f-a1d3b10aa36a)). Database agents list "On page creation / On page update / Recurring" ([Mobbin](https://mobbin.com/screens/ad51a8b8-e251-447e-8a17-502d2159b3c5)).
- **Activity [Docs].** An "Activity" tab, "A log of every agent run", showing trigger, actions, errors and steps. There is also an "Analytics" tab.
- **Autonomy [Docs + Mobbin].**
  - Access is set per resource: "Can view / Can comment / Can edit".
  - Mobbin shows field-level scoping, "Can only fill data in: Status", plus "Tools and access: What can the agent use?" with a "Web access" toggle.
  - Agent cost and quality appear as dot meters, "Speed ●●●○○ · Intelligence ●●●●● · Cost ●●●○○" ([Mobbin](https://mobbin.com/screens/c36224b0-dffd-42e8-b0ea-7b36b77d9a6d), [Mobbin](https://mobbin.com/screens/ad51a8b8-e251-447e-8a17-502d2159b3c5)).
- **Needs input:** not documented beyond credit alerts at 80% and 100% and automatic pausing.
- **Create [Docs + Mobbin].** "Create with AI chat", "Create from a template" or "Create from scratch". On Mobbin, the chat path ("Create agent using Task triager template") asks a clarifying question with option chips, then reports "Created Task Database and linked in instructions · Show changes · Undo" ([Mobbin](https://mobbin.com/screens/ff8e618b-a9a8-487b-a3f4-07ec75a397ef)).
- **Detail [Docs].** Tabs are Chat, Settings, Activity and Analytics.
- **iOS [Mobbin].** An automation's `⋯` sheet holds an "Active" switch, Edit, Duplicate and Delete. The empty list offers "Try repeating triggers · Automatically create and edit items on a schedule" ([Mobbin](https://mobbin.com/screens/12c8b938-aafe-4bbb-8b91-997347a6976b)).

### 2.6 ChatGPT: scheduled tasks (agent and Pulse retired)

- **2026 status [Docs + press].**
  - ChatGPT agent is "no longer available. Use ChatGPT Work" ([help, via Wayback 2026-11-03](https://help.openai.com/en/articles/11752874-chatgpt-agent)).
  - Pulse was retired in mid-2026, and its proactive updates moved into scheduled tasks. OpenAI's reason, as reported: people value "a dedicated place for proactive work" ([help](https://help.openai.com/en/articles/12293630-chatgpt-pulse); [Digit](https://www.digit.in/news/general/openai-is-retiring-chatgpt-pulse-and-replacing-it-with-scheduled-tasks-here-is-why.html); [AlternativeTo](https://alternativeto.net/news/2026/6/chatgpt-launches-new-scheduled-tasks-and-prepares-to-sunset-pulse/)).
- **Layout [Docs].** The "Scheduled" page (chatgpt.com/schedules) "lists current tasks". From there you can review results and schedules and "pause, resume, edit, or delete". It has a "Schedule a task" input, an "Active" filter and example tiles ([help, via Wayback 2026-11-17](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt)). Press coverage says the page shows "when they'll run next".
- **Monitoring tasks [Docs].** Tasks such as "Package Delivery Watch" "check for changes and send a notification when a relevant update occurs", and can stop at an end condition.
- **Needs input [Docs].** Approval-gated actions pause the task "until you review it", and the advice is to "check Scheduled for a paused task or pending approval". Notifications go by push or email.
- **Seen on Mobbin.**
  - iOS "Scheduled" shows dashed template cards with emoji icons ("☀️ Daily brief", "🏷️ Sale monitor", "🎵 Concert alerts") above a "Schedule a task" composer ([Mobbin](https://mobbin.com/screens/e015143b-c020-426f-a99c-3a7950757c91)).
  - The create flow is: "Asking questions" → a "1 of 3" question sheet → "Done — … It'll run each morning around 9:00 AM Jakarta time", plus a "Daily · Daily Design Briefing" chip ([flow](https://mobbin.com/flows/1456e5f5-d01b-443d-aa7f-272c0efd8540)).
  - Round 1 found the web flow: the empty state "Start creating tasks", a task card with "Next run…", and "Turn on desktop notifications · Allow / Not now" ([flow](https://mobbin.com/flows/2002085a-60e4-4bac-aa77-266ebe27c762)).
- **ChatGPT Work [Docs].** You can "follow its progress, answer questions, change direction, and approve important actions", and an "Auto-review" step checks important actions first ([announcement](https://openai.com/index/chatgpt-for-your-most-ambitious-work/)).

### 2.7 Manus: scheduled tasks, now "Automations"

- **2026 status [Docs].** Scheduled tasks now live in "Automations" and "continue to work" ([automations](https://manus.im/docs/automations)).
- **Layout [Docs].** "Manage" cards show "type, connected app, status, name, and instructions". "More actions" offers pause, run a test, locate the original task, edit and delete.
- **Activity [Docs].** "Updates" groups runs by date, each with run time, status and a short result summary. You can open a run to see "why it needs attention". A calendar view shows the month's activity and upcoming work. A trigger "can pause after the same failure repeats".
- **Placement [Docs].** Schedules are created inside the task, project or app they belong to. Each run "continues in the same task or starts as a separate task" ([blog](https://manus.im/en/blog/manus-schedules)).
- **Autonomy [Docs].** Not documented for automations. Manus Studio has "Ask for approval / Approve for me / Full access" ([studio](https://manus.im/docs/features/desktop)).
- **Seen on Mobbin.**
  - iOS "Scheduled tasks": a sheet with "Scheduled / Completed" segments. Each card shows title, prompt, switch, next run ("6 Jan 2026 at 4:00 PM") and `⋯` ([Mobbin](https://mobbin.com/screens/bd788ad2-c92e-4c41-9003-ae2f69a5cf62)).
  - The iOS confirmation step offers **Start** / **Always auto-start**, with orange text "Manus will continue after your confirmation" and a pill "Manus is waiting for your reply · 00:57" ([Mobbin](https://mobbin.com/screens/5f1e26ff-a7aa-426a-9510-fa2928315f24)).
  - Web: a "Schedule task" chip appears in the composer. The thread shows "Create scheduled task…", a scheduled-task object, and "Confirm task scheduling to user 2/2" ([Mobbin](https://mobbin.com/screens/65f21438-4b6f-4089-8d7c-aa9076d7f235)).
- **Create [Docs].** "Create" → "Schedule" / "Trigger" / "Advanced automation (Beta)". The Beta option takes a natural-language description, and you review it "before activating".

### 2.8 Gumloop

- **Layout [Docs].**
  - The "Agents" page offers card or table view. "Cards show the agent name, connected apps, creator, and last activity", with a usage line ("Used by Ana, Ben and 4 others · 62 tasks in the last month") ([agents](https://docs.gumloop.com/core-concepts/agents), [changelog](https://www.gumloop.com/changelog)).
  - Workflows are turned off for accounts with no runs since 2026-11-02.
- **Seen on Mobbin (earlier UI).**
  - The home page shows "Most Used Agents" cards with a large round avatar overlapping the card top, a description, integration icons and "Alex · 15 hours ago".
  - Below are "Recent Activity" rows with a green check, "Manual" and "3 hours ago", and "Upcoming Triggers" with an "Agents 1 / Workflows 1" switch ([Mobbin](https://mobbin.com/screens/7da1e89d-5538-412a-98f7-cb2b50e52fe9)).
  - The Tasks page has tabs "All / Completed / Approval Required / Failed" ([Mobbin](https://mobbin.com/screens/f65590b4-be93-42d7-9de6-960f6e5ddcc6)).
- **Identity [Docs].** "Identity (icon, name, description)".
- **Status and schedule [Docs].**
  - The Triggers table shows On/Off. Trigger Details show the status plus a reason ("Too many failed runs", "Monthly run limit reached", "Account needs reconnecting").
  - "Recent tasks" lists the last 3 runs with status, time and credits; the empty state is "No tasks yet".
  - A trigger turns itself off after 3 consecutive failures and notifies by email, Slack and in-app.
  - Schedules are typed in plain language and shown readably ("At 08:39 AM, every day") ([triggers](https://docs.gumloop.com/core-concepts/agent_triggers)).
- **Autonomy [Docs].**
  - Per connector: "Always allow / Ask each time / Ask for writes/deletes / Never allow / Custom".
  - Natural-language "Guardrails" with the outcomes "Ask for approval", "Block", "Tag" or "Run without approval" ([HITL](https://docs.gumloop.com/core-concepts/human_in_the_loop)).
- **Needs input [Docs].**
  - An approval card with the tool's name and icon, an "Intent" line, key fields, **Reject** / **Approve**, and "Don't ask again for this tool".
  - A bell with a badge count, inline Approve and a "Resolved" tab, plus Slack buttons.
  - Since September 2026, the browser-tab icon shows whether the agent is working or blocked.
- **Create [Docs].** "Create Agent" runs a guided setup that "asks what it should take care of". Triggers can be made with "Create With AI".

### 2.9 Linear: agents and Loops

- **Identity [Docs].** "The name and icon of your application will be how the agent appears" ([dev](https://linear.app/developers/agents)). Agents appear in the normal assignee menu ([docs](https://linear.app/docs/agents-in-linear)). On Mobbin, issue rows carry an agent assignee chip, "AI UX Research Assistant" ([Mobbin](https://mobbin.com/screens/fd1b4d88-f021-49a3-98af-4cd3a87e1d29)).
- **Delegation [Docs].** The agent becomes the `delegate`, and "the user remains the primary assignee" ([changelog 2025-07-30](https://linear.app/changelog/2025-07-30-agent-interaction-guidelines-and-sdk)).
- **Status [Docs].**
  - Sessions are `pending`, `active`, `error`, `awaitingInput`, `complete` or `stale`, "visible to users".
  - Activities are `thought`, `elicitation`, `action`, `response` or `error`, plus a Plan checklist.
  - Users can "Send stop request" ([interaction](https://linear.app/developers/agent-interaction), [signals](https://linear.app/developers/agent-signals)).
- **Guidelines [Docs].** "An agent should always disclose that it's an agent". "…clear and transparent about its internal state". "…respect requests to disengage". "An agent cannot be held accountable" ([AIG](https://linear.app/developers/aig)).
- **Loops: scheduled agents, launched 2026-07-20 [Docs]** ([changelog](https://linear.app/changelog/2026-07-20-introducing-loops), [docs](https://linear.app/docs/loops)):
  - **Where:** "Loops" in the sidebar, or as a team tab.
  - **Create:** "New loop" from a template ("Autofix bugs", "Triage agent", "Weekly wrap"), a prompt, or "Start from scratch".
  - **Schedule:** hourly to yearly, with a time zone and a first run time.
  - **"Capabilities & access":** includes "Reasoning level" and "Access code" (Disabled / Read / Read & write).
  - **Tool approval:** "Always approved" per tool, or "Automatically approve all tool calls".
  - **Operations:** a "Run history" page, Enable / Disable, "Run now", and a notification when a run fails.
  - **Advice:** Linear's guidance is to "start small…" and widen the loop's scope over time ([principles](https://linear.app/now/five-principles-working-with-loops)).
  - Row layout: not documented.

### 2.10 Intercom Fin

- **Layout.** Fin is one agent, not a list. Navigation is "Analyze / Train / Test / Deploy" ([changelog, Mar 2025](https://www.intercom.com/changes/en/86405-set-up-and-optimize-fin-easily-with-a-more-intuitive-fin-navigation)). On Mobbin, each channel in the nav carries a status dot (Chat, Email, Phone) that turns green when live ([Mobbin](https://mobbin.com/screens/e363a917-2245-4e84-b90f-02f4653e05a5)).
- **Behaviour as a sentence [Mobbin].** The Deploy page reads top to bottom as a chain:
  - "When a customer starts a conversation"
  - "Customers see Fin: Users, Leads, and Visitors"
  - "Fin answers the customer"
  - "Using support content", flagged with an amber chip "More content required"
  - "If Fin can't resolve the conversation"
  - "Hands over or escalates"
  
  A "Not live" dropdown sits at the top ([Mobbin](https://mobbin.com/screens/47a74bd0-89dd-4055-9e5b-054c187ee4e1)).
- **Status [Docs + Mobbin].**
  - You go live with "Set Fin Live 🎉", and the panel then reads "Simple deploy is live". To pause, toggle Fin off ([setup](https://www.intercom.com/help/en/articles/8286630-set-up-and-go-live-with-fin)).
  - On Mobbin, going live shows a toast "Fin is now live". A block labelled "Pause Fin" adds "You can pause Fin at any time."
  - Guidance rules are cards with "Enabled · Used: 8 · Resolved: – · Routed: –" and a per-rule **Pause** ([Mobbin](https://mobbin.com/screens/2bb82cb1-288a-4d89-98ff-dc88a344b9b3)).
- **Identity [Docs + Mobbin].** "Fin's identity" sets a name and avatar per brand ([identities](https://www.intercom.com/help/en/articles/12426795-create-a-branded-experience-with-fin-identities)). Mobbin shows separate Light and Dark avatars and a "Show AI Agent label in Messenger" toggle ([Mobbin](https://mobbin.com/screens/adcc8587-873e-476b-990e-29bd6e4b313e)).
- **Monitoring [Docs].** "Performance dashboard", "CX Score", weekly "Recommendations", "Topics Explorer", "Trends" and "Monitors" ([updated 2026-09-30](https://www.intercom.com/help/en/articles/10576273-measure-customer-service-with-insights-built-for-the-ai-agent-era)).
- **Autonomy [Docs].** "Fin hands over or escalates" to a team. Procedures start "Disabled", must be enabled and published, and have version history with "Restore this version". An approval queue: not documented.
- **Test [Docs + Mobbin].** A permanent Preview pane with "Testing as Preview user", plus Simulations.
- **Create [Docs].** Guidance via "+ New" per category. Procedures via "Let AI draft your procedure" → "Keep / Clear / Try again" ([quick start](https://www.intercom.com/help/en/articles/12599391-quick-start-create-a-simple-fin-procedure)).

### 2.11 Microsoft Copilot Studio

- **Layout [Docs].** An "Agents" page where the ellipsis menu offers open, export, delete and share. Whether it is a grid or a table: not documented ([training, 2026-09-01](https://learn.microsoft.com/en-us/training/modules/agents-copilot-studio-online-workshop/agent-tour)).
- **Identity [Docs].** A PNG icon, set with "Change icon" ([first agent](https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-first-bot)).
- **Create [Docs].** Describe the agent in up to 1,024 characters. Studio generates the name, description and instructions and suggests triggers, knowledge and tools. Alternatively, "Create blank agent".
- **Schedule [Docs].** Overview › Triggers › "Add trigger" includes "Recurrence", with "Test trigger". Triggers fire only after publishing ([triggers](https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-trigger-event)). Next run: not documented.
- **Activity [Docs, 2026-11-19]** ([activity](https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-review-activity)):
  - Table columns: Name ("Automated" when no user is involved), Channels, Date, Completed steps, Last step, Status.
  - Filter pills: "Failed", "Blocked", "In progress", "Waiting for user", "Completed".
  - Run detail: "Transcript + Map view" (a node graph), "Reasoning" and "Show rationale".
  - States: Submitted, In progress, Input required, Auth required, Complete, Canceled, Failed, Rejected.
- **Health [Docs].** The "Monitor" page shows "Run outcomes", "Trigger use", "Tool use" and "Knowledge source use" ([health](https://learn.microsoft.com/en-us/microsoft-copilot-studio/analytics-improve-agent-health)).
- **Autonomy [Docs].**
  - Each tool has "Ask the end user before running" (default No) and an "Enabled" toggle ([tools, 2026-11-16](https://learn.microsoft.com/en-us/microsoft-copilot-studio/add-tools-custom-agent)).
  - A roadmap item adds approve / approve for the session / deny, inline in the channel (reported by a third-party mirror: [RM570434](https://mc.merill.net/message/RM570434)).
  - Agent flows have "Request for information", which works in Outlook only ([RFI](https://learn.microsoft.com/en-us/microsoft-copilot-studio/flows-request-for-information)).
- **Admin [Docs].** Agent 365 dashboard cards: "Pending Requests for Agents", "Agents at risk", "Agents without owners" ([Agent 365](https://learn.microsoft.com/en-us/microsoft-agent-365/admin/agent-365-overview)).
- **Mobbin:** not on Mobbin.

### 2.12 Salesforce Agentforce

- **Layout [Docs].** Agentforce Studio › Agents: "View a clickable list of all your agents" plus "New Agent" ([Trailhead](https://trailhead.salesforce.com/content/learn/modules/introduction-to-agent-builder/get-to-know-agent-builder)). The list's columns and status labels: not documented in sources we could open.
- **Create [Docs].** Describe the role, company and tasks, answer follow-ups (or "Skip Ahead"), and subagents are generated. The builder has Explorer, a Canvas (the default), Script view, Preview and an assistant ([Trailhead](https://trailhead.salesforce.com/content/learn/modules/new-agentforce-builder-quick-look/explore-the-new-agentforce-builder)).
- **Status [Docs].**
  - A draft "isn't live". "Commit Version" locks it; you then activate it, and "only one version can be live".
  - Preview offers "Simulate" (no actions run) or "Live Test". Testing Center sits next to Agent Builder and Observability ([blog, 2026-04-15](https://www.salesforce.com/blog/agentforce-testing-center/)).
- **Observability (formerly Command Center) [Docs].** Health Monitoring raises "high-speed alerts on critical errors, latency spikes, and escalations" ([news](https://www.salesforce.com/news/stories/agentforce-studio-observability-tools-announcement/)). Session traces show "reasoning steps, LLM calls, and guardrail checks" ([blog, 2026-07-21](https://www.salesforce.com/blog/agentforce-observability/)).
- **Autonomy [Docs].**
  - Agent Script "Combines deterministic workflows with flexible LLM reasoning" ([press release](https://www.salesforce.com/news/press-releases/2025/10/13/agentic-enterprise-announcement/)).
  - Actions can "Require user confirmation" (seen only in a search snippet of a developer workshop).
- **Not documented:** identity, schedule display, how needs-input is surfaced, empty state. Not on Mobbin.

### 2.13 Google Gemini Enterprise (formerly Agentspace)

- **Layout [Docs, verified].** The Agent Gallery is a card grid.
  - Filter chips: "All, Pinned, Made by Google, From your organization, Your agents, Marketplace".
  - Pinned agents appear in "the **Pinned** section at the top".
  - "Cards display their current status (such as **Draft** or **Live**)".
  - "Click any agent card to start a conversation". The `⋮` menu offers edit, share and delete ([gallery](https://docs.cloud.google.com/gemini/enterprise/docs/agents-gallery)).
- **Create [Docs].** "+ New agent > Workflow", then describe the task to get a generated scaffold, or "Build manually". The canvas is a node graph, and "Turn on" makes it live ([create](https://docs.cloud.google.com/gemini/enterprise/docs/workflow-builder/create-workflow-agent)). Workflow Builder went GA on 2026-09-03 ([release notes](https://docs.cloud.google.com/gemini/enterprise/docs/release-notes)).
- **Schedule [Docs].** "+ Add schedule" with "Repeat frequency", "Execution time and timezone" and "Prompt". A new schedule saves as "Draft" and activates with "Update" ([schedule](https://docs.cloud.google.com/gemini/enterprise/docs/agent-designer/schedule-agent)). Next run: not documented.
- **Runs [Docs].**
  - Columns: "Input/Trigger", "Status", "Started".
  - Status chips: "Running", "Needs Review", "Completed", "Error" ([runs](https://docs.cloud.google.com/gemini/enterprise/docs/workflow-builder/workflow-agent-runs)).
- **Needs input [Docs].**
  - Workflows can include "Request info" and "Approval" steps. A paused run "appears with a Needs Review status in the Runs tab" ([HITL](https://docs.cloud.google.com/gemini/enterprise/docs/workflow-builder/use-hitl-steps)).
  - For scheduled agents: "If the scheduled run is paused, review the proposed action and click Approve".
- **Mobbin (consumer Gemini, not Enterprise).** "Scheduled actions manager" shows template cards with "+", then "My actions" rows with a schedule sentence ("Monday, Tuesday, Wednesday, and Thursday at 8 AM"), title, prompt preview, switch and `⋮`, plus "+ New action" ([Mobbin](https://mobbin.com/screens/f79b1633-8e67-4fd9-81b2-9f7ca1882be4)).

### 2.14 Datadog Monitors (and Bits AI)

- **Layout [Docs].**
  - Monitors are a table of rows with checkboxes. Columns include status, muted elapsed, muted left, name and tags. Hovering a row shows "Edit, Clone, Mute, Delete".
  - Bulk actions: "Mute" (preset or custom), "Unmute", "Resolve", "Delete" ([manage](https://docs.datadoghq.com/monitors/manage/)).
- **Status [Docs].** `Triggered` (`Alert`, `Warn`, `No Data`) or `OK`, plus a "Muted" facet ([search](https://docs.datadoghq.com/monitors/manage/search/)). Colours: not documented.
- **Needs attention [Docs].** A separate "Triggered Monitors" page lists one row per triggered group, with bulk mute and resolve ([manage](https://docs.datadoghq.com/monitors/manage/)).
- **Detail [Docs].**
  - **Header:** status, type, creator, teams and tags, with Edit / Clone / Export / Permissions / Delete. "Resolve" sets the monitor to OK only until the next evaluation ([status](https://docs.datadoghq.com/monitors/status/); [redesign blog, 2025-02-04](https://www.datadoghq.com/blog/monitor-status-page/)).
  - **History graph:** toggles between "Evaluated Data / Source Data / Transitions". Transitions shows state over time per group, and a dotted line means a group stopped reporting ([graphs](https://docs.datadoghq.com/monitors/status/graphs/)).
  - **Event timeline:** includes downtimes and audit events, with "Mute", "Resolve", "Declare Incident" and "Run Workflow" ([events](https://docs.datadoghq.com/monitors/status/events/)).
- **Run history on lists [Docs].** Synthetic tests have an optional "Last Runs" column, though how it renders is not documented. Each row's menu has "Pause" and "Run Test Now", and the test page has a "Global Uptime" graph ([synthetics search](https://docs.datadoghq.com/synthetics/search/), [results](https://docs.datadoghq.com/synthetics/browser_tests/test_results/)).
- **Create / empty [Docs].** With fewer than 10 monitors, the list recommends templates based on your installed integrations ([templates](https://docs.datadoghq.com/monitors/templates/)).
- **Autonomy (Bits AI) [Docs].**
  - An "Auto-Investigate" toggle per monitor decides whether the agent investigates on its own.
  - Remediation is gated separately: "Approve" works only if a guardrail covers the action.
  - "Action History" is the audit log: status, guardrail, who initiated the action, and a link to the investigation ([investigate](https://docs.datadoghq.com/bits_ai/bits_ai_sre/investigate_alerts/), [remediation](https://docs.datadoghq.com/bits_ai/bits_remediation/)).
- **Mobbin:** not on Mobbin.

### 2.15 Sentry: Crons, Uptime, Alerts and Seer

- **Context [Docs].** "Monitors" (what to watch) and "Alerts" (who gets told) were split into separate features, generally available on 2026-05-07 ([changelog](https://sentry.io/changelog/monitors--alerts--now-generally-available/)).
- **Cron list [Mobbin + source].**
  - On Mobbin, each row shows the monitor name with its project and schedule ("At 12:00 AM") and a "Disabled" chip. A timeline column with date ticks sits beside it, and the list sorts by "Status — Failing First" with a "14D" range selector ([Mobbin](https://mobbin.com/screens/0f0f940e-ec5e-44a7-90a8-26dbfd0fb82b)).
  - Sentry's open-source frontend confirms the columns Name / Type / Last Issue / Assignee / Alerts, plus a timeline with "Expand/Collapse visualization" ([src](https://github.com/getsentry/sentry/blob/master/static/app/views/detectors/components/detectorListTable/index.tsx)).
- **Tick strip [source].** This is the most fully specified run strip we found.
  - **Shape:** a 14 px-high row of ticks at least 4 px wide. Adjacent buckets with the same status merge into one rounded bar, and empty buckets leave gaps.
  - **Statuses:** "Okay", "Failed", "Timed Out" (hatched), "Missed", "In Progress" and "Unknown" (hatched). In a mixed bucket the worst status wins.
  - **Tooltip:** the date range plus counts per status.
  - Sources: [timeline](https://github.com/getsentry/sentry/blob/master/static/app/components/checkInTimeline/checkInTimeline.tsx), [merge](https://github.com/getsentry/sentry/blob/master/static/app/components/checkInTimeline/utils/mergeBuckets.tsx), [statuses](https://github.com/getsentry/sentry/blob/master/static/app/views/insights/crons/utils.tsx), [tooltip](https://github.com/getsentry/sentry/blob/master/static/app/components/checkInTimeline/checkInTooltip.tsx). The timeline view dates from 2023 ([changelog](https://sentry.io/changelog/2023-6-21-new-crons-timeline-view)).
- **Schedule and next run [source].** A plain-language schedule ("Every 5 minutes", or crontab as text with its time zone). "Next check-in" is a relative time that updates live; it reads "Expected Now" when overdue and "-" when disabled. "Last check-in" is shown too ([src](https://github.com/getsentry/sentry/blob/master/static/app/views/detectors/components/details/cron/index.tsx)).
- **Status of the monitor itself [source].**
  - When disabled, a banner reads "This monitor is disabled and not accepting check-ins."
  - Environments can show "Waiting For Check-In", "Muted", or an automatic-mute notice ("It has been automatically muted.").
- **Detail [source].**
  - Actions: Disable / Duplicate / Edit.
  - Main column: "Recent Check-Ins".
  - Sidebar: Detect, Resolve and Schedule.
- **Uptime [source].** The strip labels are "Uptime", "Failure" (hatched), "Downtime" and "Unknown" ([src](https://github.com/getsentry/sentry/blob/master/static/app/views/insights/uptime/timelineConfig.tsx)).
- **Alerts [Docs + source].** The list has Name / Last Triggered / Actions / Projects / Monitors. The detail page shows a chart of how often the alert fired, recent runs and an on/off control ([docs](https://docs.sentry.io/product/monitors-and-alerts/alerts/)).
- **Empty state [source].** "Monitor Your Cron Jobs" with setup buttons per platform ([src](https://github.com/getsentry/sentry/blob/master/static/app/views/detectors/list/cron.tsx)).
- **Autonomy, Seer [source + Docs].** The setting asks "Where should Seer stop?" with the hint: "Choose how far Seer should go during automated runs before stopping for your approval." The options are "Root Cause (default) / Solution / Code Changes / Pull Request". "Auto-Trigger Fixes" runs from "Off" ("Seer only runs when you click Start.") up to "All Issues" ([src](https://github.com/getsentry/sentry/blob/master/static/app/views/settings/projectSeer/index.tsx); [docs](https://docs.sentry.io/product/ai-in-sentry/seer/issue-fix/)).

### 2.16 Mercury and Ramp

**Mercury**
- **Rule card [Mobbin].** One sentence with the values in bold, under a blue dot:

  > **Every Monday**, if the balance of **Checking ••2502** is lower than **$1,000** → Transfer funds from **Savings ••5679**

  The footer reads "Next transfer: November 10, 2025 · Last modified by you today", with a `⋮` menu. The page header says "You have 1 active auto transfer rule." ([Mobbin](https://mobbin.com/screens/832aeaf8-e152-48b0-a022-e26b6e009939)).
- **Pausing [Docs].** Each rule has a pause toggle in the list. A details panel lets you set an "auto-resume date"; pausing shipped on 2026-06-29. "You can view when a transfer is next scheduled to run" ([rules, updated 2026-10-15](https://support.mercury.com/hc/en-us/articles/28768212621332-Setting-up-auto-transfer-rules); [releases](https://mercury.com/releases?category=Automations)).
- **Create [Mobbin + Docs].**
  - Four template tiles: "Distribute funds across accounts", "Maintain a target account balance", "Schedule recurring transfers", "Redirect incoming funds". Then "+ Custom Rule" ([Mobbin](https://mobbin.com/screens/a220dbb6-11e7-49e7-9118-eaabe2f26256)).
  - The docs add "describe how you want your funds to move—we'll use AI to suggest the right rule".
  - The review step restates the rule with "Next transfer…" and "Transfers settle instantly", and ends with "By clicking 'Create Rule,' I authorize Mercury to initiate transfers as specified in this rule." ([Mobbin](https://mobbin.com/screens/397b40e0-a485-4e2e-b4a0-5030935ef154)).
- **History [Docs].** A skipped run sends an email, and a failure shows in transaction history. A per-rule history view: not documented.
- **Needs input [Docs].**
  - The Payments page has "Inbox / Needs Approval / Scheduled / Paid" ([payments](https://support.mercury.com/hc/en-us/articles/40585414546068-Using-the-Payments-page)).
  - The Task Feed marks "Time sensitive tasks" ([tasks](https://support.mercury.com/hc/en-us/articles/28769957843732-Managing-tasks-in-your-Task-Feed)).
- **AI agents [Docs].**
  - Money movement requested from an AI tool shows "Approve on Mercury", needs approval inside Mercury, and expires after about 5 minutes. Categorizing transactions needs no approval ([article](https://support.mercury.com/hc/en-us/articles/54640210295956-Connecting-Mercury-to-ChatGPT-Claude-and-other-AI-tools)).
  - "Agent Controls" lists connected agents with Owner / Agent / Permissions ("Read only" or "Read & write"), "Last used" and "Recent activity" ([article, updated 2026-11-20](https://support.mercury.com/hc/en-us/articles/55316012641300-Managing-AI-agents-connected-to-Mercury)).

**Ramp (Policy Agent, Accounting Agent)**
- **List [Docs].** No agent hub is documented. Agents are switched on from an "Early Access" tab ([announcement, 2025-07-09](https://ramp.com/blog/ramp-agents-announcement)). Not on Mobbin.
- **Recommendation states [Docs].**
  - The states are "Approval recommended", "Requires review" and "Rejection recommended".
  - The homepage groups them into "Transactions ready to approve / to review / ready to reject".
  - A "Policy assessment" column shows "In policy / Policy uncertain / Out of policy", and "(i)" shows the rule the agent used ([overview](https://support.ramp.com/hc/en-us/articles/44072387128979-Policy-Agent-Overview)).
- **Autonomy [Docs].**
  - The agent "starts in review-only mode by default" ([blog, 2026-04-29](https://ramp.com/blog/ai-agents-finance)).
  - It auto-approves only once added to an approval workflow, and only within limits on amount, programs, departments, merchants or categories. When unsure it escalates as "Requires review" ([approvals](https://support.ramp.com/hc/en-us/articles/47618318137875-Use-Policy-Agent-for-approvals)).
- **Audit [Docs].** Each item records rationale, cited policy text, overrides, feedback and the policy version. A Policy dashboard shows **"agent alignment"**: how often reviewers agree with the agent.
- **Accounting Agent [Docs].**
  - "Suggested action" badges: "Mark ready", "Review fields", "Remind approvers". Icons show whether a field was filled by AI, by a person or by a rule.
  - "Auto-mark ready" applies under a "Materiality threshold (USD)" ([guide](https://support.ramp.com/hc/en-us/articles/45051740591251-Ramp-Accounting-Agent-Enablement-Daily-Use-Admin-guide)).

### 2.17 Apple Shortcuts automations (and Home)

- **Create [Docs].** In iOS 26: "Tap Automation" → "Create Personal Automation" → pick a trigger → choose a blank automation, a suggestion or an existing shortcut → "Next" shows a summary → "Done" adds it to the Automation screen ([iOS 26](https://support.apple.com/guide/shortcuts/create-a-new-personal-automation-apdfbdbd7123/9.0/ios/26)).
- **On/off and autonomy [Docs].**
  - On/off is an "Enable This Automation" toggle.
  - Autonomy is binary: by default "you'll receive a notification asking you to run the automation". "Turn off Ask Before Running, then tap Don't Ask" makes it run without asking ([enable/disable, iOS 26](https://support.apple.com/guide/shortcuts/enable-or-disable-a-personal-automation-apd602971e63/9.0/ios/26); [intro](https://support.apple.com/guide/shortcuts/intro-to-personal-automation-apd690170742/ios)).
  - Copies synced to other devices arrive disabled.
- **"Run After Confirmation / Run Immediately / Notify When Run".** These labels are not in Apple's guides. A third-party write-up dates them to the iOS 17 betas, and notes that "Notify When Run" is hidden for some triggers once "Run Immediately" is chosen ([Cassinelli, 2023-08-01](https://matthewcassinelli.com/automations-run-immediately-shortcuts-notifications/)). Treat as unofficial.
- **iOS 27 [Docs].** A trigger is attached to a shortcut via Edit → Automation. The Automation view filters by "Turned On" / "Turned Off", and unattended runs need "Allow Running When Locked" ([iOS 27](https://support.apple.com/guide/shortcuts/add-automations-apdfbdbd7123/10.0/ios/27)).
- **Home app [Docs].** "Add Automation", "Test This Automation", "Enable This Automation", and "Turn Off" after a set duration ([Home, 2025-09-15](https://support.apple.com/en-us/102313)).
- **Similar iOS screens on Mobbin.**
  - Google Home: automation cards with a glyph, "1 starter • 2 actions" and a round run button ([Mobbin](https://mobbin.com/screens/1dfd1406-0b39-4ce3-a3f9-a9264315edb4)).
  - Philips Hue: groups with icon headers and rows like "10:00 PM • Sleep · Mo–We" with a switch ([Mobbin](https://mobbin.com/screens/d5568fb8-92f3-474a-b870-02566afd399c)).
  - Apple's own Shortcuts screens are not on Mobbin.

### 2.18 Other run-strip precedents (Statuspage, Checkly, GitHub Actions, Better Stack, incident.io)

- **Atlassian Statuspage [Docs].**
  - A 90-day strip; "Each day will appear somewhere on the scale of Green->Yellow->Orange->Red" by minutes of downtime. Days with no data are grey.
  - Hovering shows a link to the incident, and the 90-day percentage sits below the strip ([docs](https://support.atlassian.com/statuspage/docs/display-historical-uptime-of-components/)).
- **Checkly [Docs].** "Each bar represents a part of that time period". Hovering lists that slice's runs, and clicking a bar filters the results list ([docs](https://www.checklyhq.com/docs/monitoring/check-results/)).
- **GitHub Actions [Docs].** A "Run workflow" button sits above the runs list, with "Disable workflow" / "Enable workflow". In public repos, scheduled workflows auto-disable after 60 days with no activity ([run](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow), [disable](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)).
- **Better Stack [Mobbin + Docs].**
  - The monitor page (dark) has a status dot and name, "Up · Checked every 3 minutes", then actions "Send test alert / Incidents / Pause / Configure".
  - Three tiles: "Currently up for", "Last checked at 39 seconds ago", "Incidents 0". Below them, a response-time chart with a hover tooltip ([Mobbin](https://mobbin.com/screens/b677964b-252f-47a8-8495-40501138635c); [pausing](https://betterstack.com/docs/uptime/pausing-monitors-and-maintenances/)).
- **incident.io status page [Mobbin].** "System status May 2026 – Aug 2026", with one strip of thin bars per component and recent days coloured amber or green ([Mobbin](https://mobbin.com/screens/05816d43-88a9-4537-a444-a09ca5456e03)).

---

## 3. Also on Mobbin: strong examples outside the brief's list

These are the screens that most shaped the recommendation. All were opened and looked at.

### Agent overviews and agent pages

| Screen | What to take from it |
|---|---|
| [Wix: AI Marketing Agent, "Ready for approval"](https://mobbin.com/screens/87fe23e3-9fa4-4d82-aebb-80ae70330c59) | **Persona and status line:** a blob persona "Kleo · AI Marketing Agent" whose status line changes with state: "Ready when you are." / "Keeping an eye on things 👀" / "Enjoying a quiet moment between tasks." **Approval area:** "Ready for approval" with category chips ("All 0 · SEO · Social media · Emails") and the empty state "You're all caught up · You'll be notified when new suggestions are ready for approval." **Other:** "Recommended actions" rows, and "Required actions" setup cards on the right. |
| [Wix: approve modal](https://mobbin.com/screens/2304336e-a523-460e-9f8a-2d5ed586144b) and [trust promise](https://mobbin.com/screens/495fb6b6-d382-4368-9b4c-d4887eab3ef1) | **Modal:** "Review and approve blog post. To publish blog posts at the scheduled time, approve them and confirm." It shows a preview with Dismiss / Approve, then "Confirm (1/1)". **Onboarding promise:** "You are always in control. Nothing gets published without your approval, ever. I notify you whenever there's new content for you to approve. You can always adjust which tasks I run and how you get notified." |
| [Cursor: Automations](https://mobbin.com/screens/e67678aa-b92f-49cf-8997-a35a421d6606) | **Stat tiles:** "Total Automations / Successful · 7d / Failed · 7d / **Run History →**", the last with a tiny bar sparkline. **Create:** a natural-language box above the list ("Every time a message is sent to #bug-reports…"). **List:** "Mine / All", a table, then "Suggested" template cards. **Empty state ([screen](https://mobbin.com/screens/f59cea72-f6f3-4c57-a769-29a71800ac57)):** "No Automations Yet · Run agents on a schedule or automatically in response to events." |
| [Cursor: per-tool permission](https://mobbin.com/screens/e38b5675-f3e2-4d37-a3a9-ef5fab70b300) | The tool row "Comment on Pull Request · PR-triggered runs only · **Don't Allow PR Approval** ▾" sets permission per tool, under triggers like "Every week on Monday at 09:00 GMT+7". |
| [Cursor: agents grouped by state (flow)](https://mobbin.com/flows/4358ab22-eea3-40ac-b4d0-e72c95c3c24f) | The sidebar groups agents as "In Progress / Ready to open / **Awaiting follow-up**". Its status filter has "Running, Finished, Error, Creating, Expired" ([screen](https://mobbin.com/screens/58450174-4034-4e5d-a126-9def2378b0a0)). |
| [Unify: Scheduled chats](https://mobbin.com/screens/f4b6f05f-3c13-4b3b-b8d7-d6d3b91420af) | **Row card:** title, 2-line prompt, chip "🕐 Daily at 10:00 AM · Paused", "▷ Run now", switch and `⋮`. **Templates:** a grid with schedule chips and "Add". **Creation:** create with chat ends in "Its next run is scheduled for **Aug 10, 2026 9:00 AM**" (round 1). |
| [Tana: agent page](https://mobbin.com/screens/8d3199a0-dfb3-4145-b7da-851658ff1684) | **Header:** gradient avatar, name and description. **Schedule card:** "Runs Tuesdays, Thursdays, Saturdays · **Next run tomorrow at 01:20** · Last run Jan 1 at 07:00". **Sections:** "Work Done by This Agent", "Latest Chats", and a composer "Start something new with <agent>…". **Edit view ([screen](https://mobbin.com/screens/655ddfbf-d2cd-42dc-bc74-a259e64071c1)):** capability checkboxes ("Modify, move, and delete existing documents") and schedule rows with a switch and "Not yet run". |
| [Productboard: scheduled automation](https://mobbin.com/screens/a29a52a9-a610-427b-a0a0-e8f96a926b05) | **Fields:** Status "Active", Next run "Sep 27 at 11:02 AM", Schedule "Every Sunday at 11:00 AM" with a switch, Description, Instructions. **History:** "Run history: No runs yet". **Buttons:** "Edit automation" and **Run now**. |
| [Attio: workflow runs](https://mobbin.com/screens/d8d6c229-4909-490c-83a1-a84958f82b83) | **Canvas:** a "Live" switch, with "Triggered / Completed" chips on each node. **Overview tiles:** "In progress 0 · Avg. runtime 18 seconds · Completed 61 · Failed 0". **Run history:** a numbered "Run #61…" list with a tooltip (Status, Runtime, Triggered, Completed). |
| [Langdock: agents](https://mobbin.com/screens/5d03a26a-2943-41f9-9051-136ff2055c6f) | **Highlighted card:** a "Highlighted" agent card in a user-chosen colour ("Change color" palette). **Recently used:** cards with owner, message count and time. **Prompt:** "Looking for inspiration? Browse templates". |
| [Mistral: My Agents](https://mobbin.com/screens/91a956f3-2594-47fe-af83-5b4d4238dec1) | **Card:** a large pixel-art avatar banner on top, then name, description and "By me". **Filters:** All / Mine / Shared. |
| [Fireflies: voice agents](https://mobbin.com/screens/e2927bc5-0ecb-469d-b1cd-2c1a3f5c0a53) | Each card has the switch at bottom-left and the action ("Copy Link") at bottom-right. Filters: All / Active. |
| [Plain: agent activity](https://mobbin.com/screens/9f3d27b2-3693-4517-83f3-98ff87ecb18a) | **Header:** an "Active" chip. **Outcome tiles:** "Handed off 3", plus a handoff breakdown. **Filters:** chips with counts, "All 3 / Responded 0 / Handed off 3 / Knowledge gaps 0". |
| [Klaviyo: Auto monitors](https://mobbin.com/screens/31461579-882e-4c41-b3bb-ab7499504847) and [detail](https://mobbin.com/screens/0c894c0a-df11-452c-8aad-8551a4e565b6) | **List:** "Klaviyo AI · Spot unexpected changes… · **Next check on Jul 22, 2026**". **Row:** "Last check on Jul 21", Status "Active", rule "Ready to review · No unexpected decrease…", and Notifications. **Detail:** a plain "Definition" sentence, then Monitor details, Notification settings and Metric preview. |
| [Databricks: job runs](https://mobbin.com/screens/1bd9f80c-3c2d-46ba-bd06-b6177a78ebdb) | **Run chart:** a bar per run, with height = duration and green/grey squares per task. **Actions:** **Run now** at the top right. **Empty triggers:** "Schedules & Triggers · None · Add trigger". |
| [Adaline: monitor](https://mobbin.com/screens/85e692f8-e7c5-4cce-ae0e-681d50e1f3f8) | A histogram of runs per hour, switchable "24 hrs / 7 days / 30 days / 6 months", above a runs table with check icons. |
| [Modal: function card](https://mobbin.com/screens/983cf563-8a26-448f-856c-883884b951bb) | A sidebar card with a mini bar histogram and "Containers: 0 live · Calls: 0 running". It's the only Mobbin card we saw with history inside it. |
| [Render: event timeline](https://mobbin.com/screens/50504a21-dc6e-4450-a235-ce809c9d3355) | Time, event, status icon and, for human actions, the actor's avatar ("Database suspended · samlee…"). |
| [Deel: payroll cycles](https://mobbin.com/screens/5f2b0662-7d0c-42fa-aec0-328ff23b7bf5) | **Tiles:** "…with overdue items 0 / due today 0 / **pending items 3**". **Rows:** each ends in a primary button ("Review approval") with "Due in 22 days". |
| [LangChain Fleet: templates and inbox](https://mobbin.com/screens/765f1a2a-350b-40d0-8f1a-7d88f088a570) | **Create paths** (sidebar): "Create agent with AI / Start from a template / Create agent manually". **Inbox ([screen](https://mobbin.com/screens/23d60ab4-1d3a-4c08-b4eb-3abad2ce6095)):** "Needs Attention / Completed / All", with a count on the nav. **Template modal ([screen](https://mobbin.com/screens/556a78c0-46f9-43f8-8ab4-78de428a82e8)):** "Select triggers · Poll Gmail inbox every 10 minutes…". |
| [Base44: agents empty state](https://mobbin.com/screens/0fd36e7d-9252-42b3-8a4c-fc14b88b3157) | **Empty state:** "Create your first agent · Agents talk to your users, work with your data, and run on schedules…", then 3 suggestions plus "Create from scratch". **Chat builder:** a question card with options ("2/2", Skip / Send). |
| [Cofounder: agent updates](https://mobbin.com/screens/52d55c74-ed5e-4f4f-adbf-40715cb4bb66) | **Updates pill:** bottom-left "1 agent update · **Review**". **Question card:** a docked card with a "Recommended" option and "Decide all / Decide this one". |

### Autonomy controls

| Screen | What to take from it |
|---|---|
| [hilos](https://mobbin.com/screens/ad00bad1-e623-4941-ba4f-82bc5aeb6043) | **The dial:** "One dial for autonomy, effort, and model spend… individual agents can override it on their profile." **Stops:** "Careful / **Balanced (recommended)** / Ambitious", between "Careful & cheap" and "Autonomous & thorough". |
| [Canny Autopilot](https://mobbin.com/screens/bc98c982-2b47-4630-b8d3-c03df7014e70) | **Control:** a segmented "Manual \| Automated" per action type. **Copy:** "You can either manually review these actions or automate them, with the ability to reverse as needed." |
| [Juicebox](https://mobbin.com/screens/2b992945-41c9-4892-af74-b09084019d1c) | A question at setup: "Would you like to manually approve each profile, or let the agent reach out automatically?" Buttons: "Review individually / Reach out automatically". |
| [Expensify: approval mode](https://mobbin.com/screens/4430437e-782b-4af7-8fcc-5a4006075898) | Three option cards: "Submit and Close / Submit and Approve / **Advanced Approval 🔒**". A higher level is shown but locked. |
| [WRITER](https://mobbin.com/screens/381a93f2-6693-43ff-94ad-b1770af9cce7) | Per-capability "Enabled" switch, then a segmented scope: "All websites / Only specific websites / Exclude specific websites". |
| [Customer.io AI](https://mobbin.com/screens/cfdb39ad-6bc5-4c32-bc02-d24647630c48) | A write permission off by default: "Edit live data · Allow AI agents acting on your account to edit live campaigns…". |
| [Manus iOS](https://mobbin.com/screens/5f1e26ff-a7aa-426a-9510-fa2928315f24) | **Buttons:** "**Start** / **Always auto-start**", which promotes autonomy from the decision itself. **Waiting state:** orange "Manus will continue after your confirmation", and the pill "Manus is waiting for your reply · 00:57". |

### iOS

| Screen | What to take from it |
|---|---|
| [Citizen: widget](https://mobbin.com/screens/37b45bb2-72f4-433f-ab20-9a58fa71be25) | The "Protect Agent · Standing by ●" tile fits an agent's identity and idle status into a small square. |
| [GitHub iOS: Copilot](https://mobbin.com/screens/1bbb638a-0ea1-4ad9-9fb2-e7c6b5640983) | "Agent sessions" card group, with rows carrying "Draft +91 −10" / "Completed" chips and a "New Session" pill. |
| [Grok Bot: agent profile (flow)](https://mobbin.com/flows/83c1109a-c769-49aa-9d0a-6bba10d28ed0) | **Mark:** a "Character" picker of colour and shape ("How this agent's mark looks everywhere"). **Routines:** "Weekly meal prep · Every Sunday at 8:41 AM". **Notifications:** "Get notified when this agent finishes or needs input". |
| [Claude iOS: notification permission](https://mobbin.com/screens/c5cbd6f5-1c04-4111-acee-c0080b68e97f) | Sample notifications: "Itinerary ready to review", "Refactor complete · 12 files changed, tests green", "Research paused · **Needs your input to continue**". |
| [Neo Financial: empty automations](https://mobbin.com/screens/76ccb40f-d80e-44e6-8ddc-af24b43fb279) | "No automations · Set up automations for managing money." Then two template rows. |

---

## 4. What the evidence says, question by question

**Card, tile or canvas?**
- Agent *overviews* are cards almost everywhere: Cloudscape, Gemini Enterprise, Zapier, n8n, Manus, Gumloop, and on Mobbin also Relevance, Mistral, Langdock, StackAI, Fireflies, Sana and Copy.ai.
- *Runs* are tables or lists everywhere: Copilot, Gemini Enterprise, Zapier, Gumloop, n8n, Attio.
- *Canvases* appear only where users build the logic: n8n, Attio, Gemini Workflow Builder, Agentforce.
- Tiles, meaning small squares with no text body, appear only as iOS widgets (Citizen).

**Avatar, icon or persona?**
- **Documented:** every product gives agents a name and icon: Gumloop "Identity (icon, name, description)", n8n "icon and gradient", Notion's animated avatar, Linear's app icon, Fin's per-brand avatar, Copilot's PNG icon.
- **On Mobbin:** human-like personas appear (Wix Kleo, Relevance pixel people, ElevenLabs "Eric / Matilda"), alongside abstract marks (Grok's colour and shape, Langdock's colour).
- **Rules that apply:** Linear requires disclosure ("always disclose that it's an agent"), and Cloudscape asks for the agent's *source* to be shown prominently.

**Status vocabulary.** Two layers, kept apart:
- **Layer 1, is it on?**
  - Published / Not published: Zapier, n8n.
  - Draft / Live: Gemini Enterprise.
  - On / Off with a reason: Gumloop.
  - Active / disabled with a `pause_reason`: Notion.
  - Enabled / Disabled: Sentry, Fin procedures, Apple.
- **Layer 2, how did the last run go?**
  - Running / Needs input / Completed / Failed, under many names:
    - Zapier "Needs action";
    - Copilot "Waiting for user", "Input required";
    - Gemini "Needs Review";
    - Linear `awaitingInput`;
    - Gumloop "Approval Required";
    - Relevance "Pending approval";
    - Ramp "Requires review".
  - Monitoring tools add "Missed" and "Timed Out" (Sentry) and "No Data" (Datadog).
  - GitLab's flow states (`pattern_canon.md` §8) cover all of these.

**Schedule and next run.**
- The schedule is plain words everywhere: Unify "Daily at 10:00 AM", Gumloop "At 08:39 AM, every day", Sentry "Every 5 minutes", Tana "Runs Tuesdays, Thursdays, Saturdays".
- The next run is shown relative (Sentry's live "Next check-in", which reads "Expected Now" when overdue; Unify "Next run 11 hours from now"; Tana "Next run tomorrow at 01:20") or absolute (Productboard, Hex, Mercury, Klaviyo).
- A ticking per-second countdown appears only for *waiting on the user* (Manus "00:57") or long builds (Emergent "04:29"), never for schedules.

**Run history.**
- Agent platforms use a table (Copilot, Gemini, Zapier, Linear "Run history", Gumloop's last 3 runs, Attio's numbered list).
- Monitoring tools use a strip: Sentry ticks, Statuspage 90 days, Checkly bars, Datadog Transitions, incident.io.
- Mobbin shows only two products putting history *inside* a small card or tile: Modal's card histogram and Cursor's "Run History" sparkline tile.

**Recent activity.** A merged feed with day grouping:
- Gumloop "Recent Activity"
- Manus "Updates" grouped by date with a result summary
- Render's event timeline with actor avatars
- Zapier "All activity", defaulting to the last 2 days
- Cloudscape's timeline overview

Ramp's per-item feed records rationale, cited policy and overrides.

**Autonomy and permissions.**
- A short ladder of named levels, usually per tool or action:
  - Gumloop, Relevance, Lindy: as in TL;DR 5 and §2.
  - Copilot: "Ask the end user before running".
  - Linear Loops: "Always approved".
  - Cursor: "Don't Allow PR Approval".
- Defaults are conservative: Ramp "review-only mode by default", Sentry "Root Cause (default)", Relevance "start at approval required", Linear "start small".
- Single per-agent or per-workspace dials exist too: hilos's 3-stop dial, Canny's "Manual | Automated", Juyo's per-property control, Sentry's "Where should Seer stop?".
- **Implication [our call]:** a Compass watcher has one kind of output, so the per-action ladder and the per-agent dial become the same control.

**How "needs input" is surfaced.**
- **A queue:** Relevance "Approvals" tab, Gumloop "Approval Required" plus a bell with a count, Zapier "Needs action" filter, LangChain "Needs Attention", Mercury "Needs Approval", Ramp's homepage groups, Datadog "Triggered Monitors".
- **On the item itself:** Wix "Ready for approval", Deel's row button.
- **Pushed:** Gumloop and Lindy Slack buttons, Mercury notification plus Tasks, Grok "finishes or needs input".
- **Not documented anywhere:** a cross-agent approval inbox *on the agent overview* itself. Microsoft's admin card "Pending Requests for Agents" is the nearest.

**Empty state.**
- Templates first, with one-line copy that says what agents do: Base44, Cursor, Neo, ChatGPT iOS, Datadog (templates recommended from your integrations), Sentry ("Monitor Your Cron Jobs").
- Lindy hides empty cards or shows "getting to know you".

**Create flow.**
- **Three doors:** describe it, template, or manual. Seen in LangChain Fleet, Notion, Relevance ("Invent / Clone from Marketplace / Start from scratch"), Linear Loops, Manus, Gemini Enterprise, Copilot (describe in up to 1,024 characters or "Create blank agent"), and Mercury ("describe how you want your funds to move").
- **Before it goes live:** clarifying questions in a docked card (ChatGPT "1 of 3", Unify, Base44, Notion), then a review or summary step (Mercury's authorization line, Apple's "Next shows a summary", Manus "review … before activating").

**Auto-pausing: sources disagree.**
- **Pause automatically:** Gumloop (after 3 failures), Notion (`failure_limit`), Manus (repeated failure), Sentry (auto-mute) and GitHub (60 days inactive).
- **Don't:** Cloudscape says "Don't auto-disable or delete an agent without explicit user action."
- **Compass [our call]:** watchers only read data, so a failing run does no harm. Keep running, show "Couldn't run", notify once, offer Retry, and never switch a watcher off on the user's behalf.

---

## 5. Recommendation: Watcher cards with a run strip

**One pattern:** each watcher gets its own **agent card** in a responsive grid. Cards are sorted so the one that needs you comes first. Every card shows the same seven parts in the same order: identity, status, what it watches, latest finding, a strip of the last 14 runs, schedule with next run, and autonomy. A footer holds the on/off switch and one state-dependent primary action. Clicking the card opens the watcher's own page.

It is a combination of established parts, not a new pattern:

| Part | Taken from |
|---|---|
| A card per agent with identity, toggle, description, capabilities and scope | Cloudscape agent management ([pattern](https://cloudscape.design/gen-ai/patterns/agent-management/)); on Mobbin: Gumloop, Relevance AI, Mistral, Langdock, StackAI, Fireflies, Sana |
| Next run, last run and outcome of the last run for each schedule | n8n Agents (quoted in §2.4); Sentry "Next check-in" / "Last check-in" |
| Run-history strip of fixed-size bars coloured by outcome | Sentry Crons tick strip (14 px row, worst status wins, per-status tooltip); Statuspage 90-day bars; Checkly; incident.io; Modal's card histogram; Cursor's "Run History" sparkline |
| Rule written as one sentence with bold values | Mercury auto-transfer rule card; Klaviyo's "Definition"; Intercom Fin's behaviour chain |
| Schedule plus next run on the item | Unify "Daily at 10:00 AM", Tana "Next run tomorrow at 01:20 · Last run…", Productboard "Next run", Hex "Next: Monday…", Klaviyo "Next check on…", Mercury "Next transfer…" |
| Autonomy as named stopping points, shown and editable on the item, starting low, with a locked higher level | Juyo "autonomy control you set property by property"; Sentry Seer "Where should Seer stop?"; Ramp "starts in review-only mode by default"; Relevance "Auto Run / Approval Required / Let Agent Decide"; Zapier "Off / Suggest fixes / Automatically fix"; hilos "Careful / Balanced (recommended) / Ambitious"; Canny "Manual \| Automated"; Expensify's locked "Advanced Approval"; Apple "Ask Before Running" |
| "Needs input" as a named state that sorts first and is counted | Zapier "Needs action", Copilot "Waiting for user", Gemini Enterprise "Needs Review", Linear `awaitingInput`, Gumloop "Approval Required", LangChain "Needs Attention", Ramp "Requires review"; Sentry "Sort by: Status — Failing First"; GitLab flow states |
| Create from a template, with chat, or by hand | LangChain Fleet, Notion Custom Agents, Relevance AI, Linear Loops, Manus Automations, Gemini Enterprise; Cursor's prompt box above the list |

### 5.1 Why cards, and why this card

1. **Cards fit a small set of different things.** NN/g: "Cards work best for collections of heterogeneous items" and suit dashboards ([NN/g, Cards](https://www.nngroup.com/articles/cards-component/)). The three watchers differ in cadence (2 h, daily, weekly), output (alert vs. rate recommendation) and state (needs decision, idle, paused). A uniform row hides those differences; a card can show each one's own latest finding.
2. **NN/g's warnings about cards are handled.** Cards weaken ranking, so the grid is explicitly sorted by urgency and the urgent card is marked in orange. Cards are harder to scan in bulk, but Compass has 3 watchers, not 300. Past about 10 watchers, add a list view toggle (Hex and Zoho offer list/grid toggles, see `ui-refinement/mobile_and_boards.md`) **[our call]**.
3. **The run strip proves the watcher is alive.** Monitoring products put a compact status history next to each item: Sentry Crons per row, Statuspage and incident.io per component, Checkly per check, and Datadog synthetics as an optional "Last Runs" column. A GM who sees 14 quiet bars and one tall purple one trusts that the watcher ran and found one thing. The previous list could only say "last run 06:02".
4. **The decision is on the card.** Wix's AI Marketing Agent shows what is "Ready for approval" with a preview and Approve. Deel's payroll rows end in a "Review approval" button. The Compass card shows the recommended rate and one button to review it, so the user needn't open a second page to learn what is wanted.
5. **Autonomy is visible, not buried.** Cloudscape: permissions must be "explicit and editable, not buried in setup flows". Juyo sells "an autonomy control you set property by property" ([juyo-enterprise](https://juyo.ai/juyo-enterprise)), and "Deploy autonomous agents that monitor, recommend and act, inside the bounds you set" ([kassandra-ai](https://juyo.ai/kassandra-ai)). Showing the level on each card is how Compass demonstrates that promise. None of the products we checked shows the autonomy level on the agent's card. It lives in settings, per tool (Gumloop, Relevance, Copilot, Zapier), per project (Sentry Seer) or per workspace (hilos). Putting it on the card is where Compass can stand out.
6. **It is the "dedicated place" the market converged on.** OpenAI folded Pulse into Scheduled tasks because people value "a dedicated place for proactive work" (§2.6). Zapier, Lindy and Manus made similar moves in 2026. A Watchers page with real cards is that place for a hotel.

### 5.2 Page anatomy (desktop, ≥1280 px)

```
Watchers                                                        [ + New watcher  ▾ ]
Kassandra checks these on a schedule and brings you only what needs a decision.
Nothing changes in your systems without your approval.

[ All 3 ] [ ● Needs you 1 ] [ Watching 1 ] [ Paused 1 ]                    (filter chips)

┌ Event pricing ─────────────┐ ┌ Comp-set rates ────────────┐ ┌ OTA mix ───────────────────┐
│ needs your decision (ORANGE)│ │ watching                    │ │ paused                      │
└─────────────────────────────┘ └─────────────────────────────┘ └─────────────────────────────┘

Activity                                                                       View all
Today
  06:02  Event pricing recommended €189 for Sat 6 Dec (+€24)              Review
  04:00  Comp-set rates checked 8 hotels · no change
Yesterday
  18:40  You paused OTA mix
  …

Add a watcher
[ Pickup pace  · Daily 07:00  + ] [ Forecast vs. budget · Weekly Mon  + ] [ Describe your own… ]
```

- **Header.** Title, a one-sentence purpose, and the trust promise. The promise copies the structure of Wix's "You are always in control. Nothing gets published without your approval, ever." It also matches Compass's read-only rule (`docs/decisions.md`: approving logs the decision and sends it to the revenue manager as a task). The primary button is a split button: **New watcher** (create with chat) ▾ From a template / Set up manually. These are the same three paths as LangChain Fleet's "Create agent with AI / Start from a template / Create agent manually".
- **Filter chips with counts.** All · Needs you · Watching · Paused. Sources: Plain's "All 3 / Responded 0 / Handed off 3", Base44's "Active (2) / Paused (0) / Completed (0)", Gumloop's "Approval Required" tab, LangChain Fleet's "Needs Attention" and Zapier's "Needs action" filter. Ramp's homepage and Mercury's "Needs Approval" tab show the same idea outside AI tools. Hide a chip when its count is 0 **[our call]**.
- **Grid.** CSS grid, `repeat(auto-fill, minmax(340px, 1fr))`, gap 16 px. With 3 watchers at ≥1280 px that gives one row of three. Order: Needs your decision → Couldn't run → Running → Watching → Paused, which mirrors Sentry's "Sort by: Status — Failing First". Within a group, sort by next run time.
- **Activity.** A merged, newest-first feed of what every watcher did and what people did to them, with day dividers. Rows are past-tense sentences with a time, the watcher's glyph, and a link. Sources: Gumloop "Recent Activity", Render "Event timeline", Cloudscape timeline overview (past-tense labels, day dividers), GitLab (failed sessions keep their logs). Human actions (approved, paused, changed autonomy) appear with the person's avatar, as in Render's timeline. This is also where the audit trail Juyo promises becomes visible ("Full audit trails", [it-data-and-security](https://juyo.ai/it-data-and-security)).
- **Add a watcher.** Template cards with a schedule chip and "+", plus a "Describe your own…" card that opens the chat. Sources: Unify templates ("Every Mon at 9:00 AM", "Add"), Gemini "Templates" with "+", Cursor "Suggested", Mercury's four rule templates.

### 5.3 The card, part by part

Card shell: background `#161C22`, 1 px border `#2A2E33`, radius 16 px (Juyo uses `rounded-2xl`; `ui-refinement/juyo_brand.md`), padding 20 px, internal gap 14 px. The whole card is the link to the watcher page, as NN/g recommends. Inner controls (switch, autonomy, buttons, menu) are separate targets that don't trigger the card link.

```
┌──────────────────────────────────────────────────────────┐  ← border #FE7637 at 60% only when it needs you
│ ┌────┐  Event pricing                ● Needs your decision │  1 identity + 2 status
│ │ ▦  │  Kassandra watcher · Hotel Aurora                   │
│ └────┘                                                     │
│ Checks events in the next 60 days and recommends a rate    │  3 what it watches
│ when pickup runs ahead of last year.                       │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ LATEST · today 06:02                                  │ │  4 latest finding
│ │ Raise Sat 6 Dec to €189  (+€24)                       │ │
│ │ City marathon · pickup +38% vs. STLY                  │ │
│ └──────────────────────────────────────────────────────┘ │
│ Last 14 runs                         2 findings · 0 failed │  5 run strip
│ ▂ ▂ ▂ ▂ ▂ ▂ ▂ ▂ ▂ █ ▂ ▂ ▂ █   (purple at 10, orange at 14)  │
│ ◷ Daily 06:00 · next in 13 h 40 min                        │  6 schedule
│ Autonomy  ▰▰▱  Recommends · you decide              ⌄      │  7 autonomy
│ ─────────────────────────────────────────────────────────  │
│ [● On]                         [ Review €189 → ]     ⋯     │  footer
└──────────────────────────────────────────────────────────┘
```

**1. Identity.** A 40×40 tile, radius 12, background `#1E2429`, holding a 22 px Material Symbols Outlined glyph tinted `#B79BE4`. Juyo's own feature icons are Material Symbols tinted purple or orange (`juyo_brand.md`). Name in Inter 16/600. Under it, in 13/400 muted text, the source and scope: "Kassandra watcher · Hotel Aurora".
- Glyphs: Event pricing `event`, Comp-set rates `travel_explore`, OTA mix `donut_large` **[our call]**.
- Watchers are told apart by glyph, not by colour. Orange stays reserved for "needs your decision", so persona tiles never use it **[our call; `color_type.md` already moved the decision colour into its own token so it can't leak]**.
- No human names or faces. Kassandra is already the persona, so each watcher is one of her jobs, named for its action. GitLab names autonomous flows by action ("Security Triage Flow") with their own avatar. Linear's guidelines say an agent "should always disclose that it's an agent". Cloudscape: "Show the agent's source prominently". Grok's agents also get an abstract colour-and-shape "mark", not a face.

**2. Status chip.** Pill, 24 px high, 12/500 text, with an icon or dot, top-right.

It reports the *run* layer. The footer switch reports the *on/off* layer. Zapier, Gumloop and n8n keep these two apart (§4), and a paused watcher can still hold an undecided recommendation from before it was paused **[our call]**. One vocabulary, mapped to GitLab's flow states and the platforms' run states:

| Chip | When | Colour (on `#161C22`) | GitLab state |
|---|---|---|---|
| ● Needs your decision | A recommendation is waiting | text and dot `#FE7637` (6.4:1), fill `#FE7637` at 12% | Awaiting user input (Zapier "Needs action", Gemini "Needs Review") |
| ⟳ Running… | A run is in progress | `#B79BE4` (7.2:1) with a spinner (static under `prefers-reduced-motion`) | Running |
| ● Watching | On, idle between runs | `#9AA4AE` (6.8:1) | (between runs) |
| ‖ Paused | Switched off | `#9AA4AE`. Don't dim the card with opacity: at 64% the muted text drops to 3.6:1, below AA. Show the pause through the chip, the switch, "· paused" in the schedule line, and outlined bars for skipped runs **[our call, computed]** | Paused |
| ! Couldn't run | Last run failed | `#F0645A` (5.5:1) | Failed (Sentry "Failed", Copilot "Failed") |

Failure handling: no auto-pause. A watcher that keeps failing stays on and shows "Couldn't run · Retry". The user is notified once. Some sources auto-pause and Cloudscape says not to (§4); Compass watchers only read data, so a failing run does no harm **[our call]**.

For "Watching", the finding panel carries the reassurance, as Stripe's "No alerts · Updated today 12:25:35" and Better Stack's "Last checked at 39 seconds ago" do. Citizen's "Standing by ●" and Wix's "Keeping an eye on things 👀" do the same job with personality; Compass keeps the plain wording **[our call]**.

**3. What it watches.** One or two sentences in 14/400, with the values in 600 weight, like Mercury's rule card ("**Every Monday**, if the balance of **Checking ••2502** is lower than **$1,000**"). Klaviyo's monitor page puts the same kind of sentence under "Definition". Clicking a bold value deep-links to that setting on the watcher page **[our call]**.

**4. Latest finding.** An inset panel (background `#1E2429`, radius 12, padding 12):
- Label: "LATEST · today 06:02" (12/500, uppercase, muted), a freshness stamp like Public's "Generated by Agents at 10:22 AM" (prior research, `ai-ux/mobbin_best_ai_apps.md`).
- Headline (15/600): the finding itself, with the number.
- One line of why (13/400 muted).
- When nothing changed, still show the last value. A watcher that says only "no change" looks dead. Example: "No change worth flagging · comp-set median €142, within 2% of yesterday".
- Tana gives each agent a "Work Done by This Agent" area; Unify and Gemini show a 2-line preview of each scheduled item.

**5. Run strip (last 14 runs).** One row of 14 bars, oldest left, newest right. Above it, "Last 14 runs" on the left and a count summary on the right ("2 findings · 0 failed"). Bars stretch to the card width, 3 px apart, 20 px high.

| Run outcome | Bar | Colour | Contrast vs. `#161C22` |
|---|---|---|---|
| Ran, nothing to report | short (8 px) | `#6B7580` | 3.7:1 |
| Finding or alert | full height | `#996AD5` | 4.4:1 |
| Recommendation waiting for you (only ever the newest) | full height | `#FE7637` | 6.4:1 |
| Failed | full height, hatched with diagonal stripes, as Sentry hatches "Timed Out" and "Unknown" | `#F0645A` | 5.5:1 |
| Skipped (paused, or not yet run) | 1 px outline | `#6B7580` | 3.7:1 |

- **Sentry is the reference.** Its strip is a 14 px row of ticks at least 4 px wide, with "Okay / Failed / Timed Out (hatched) / Missed / In Progress / Unknown (hatched)". The worst status wins in a mixed bucket, and the tooltip gives counts per status (§2.15).
- **Compass differs in two ways [our call]:**
  - **One bar per run, no buckets.** Fourteen runs fit without merging.
  - **Height carries meaning.** A tall bar means "found something" and a short one "nothing". This borrows from Databricks and Adaline, whose bar heights encode magnitude, and lets the strip read in greyscale, satisfying WCAG 1.4.1 (don't rely on colour alone).
- **Contrast.** All five colours clear the 3:1 non-text minimum (WCAG 1.4.11). The `#5B6570` grey would not (2.9:1). Statuspage likewise keeps "no data" grey and separate from failure.
- **Why 14.** It fits a 340 px card with legible bars, and Sentry's cron list on Mobbin shows a "14D" range selector. Because cadences differ, the label gives the time span: "Last 14 runs · 28 h" for the 2-hourly watcher, "· 14 wks" for the weekly one **[our call]**.
- **Tooltip.** Hover or focus shows: "Thu 20 Nov · 06:00 · Recommended €189 · took 41 s". Attio's run tooltip shows status, runtime, triggered and completed times. In the full history (§5.7), clicking a bar filters the run list, as in Checkly.
- On the card, the strip is one non-interactive image, `role="img"` with a label such as "Last 14 runs: 12 no change, 2 findings, 0 failed". Clicking it opens the watcher page at Run history, where each run is focusable. This avoids 14 extra tab stops on every card **[our call]**.

**6. Schedule.** A clock glyph, then the cadence in plain words, then the next run: "Daily 06:00 · next in 13 h 40 min".
- Relative time when the next run is under 24 h, absolute beyond that ("Mon 24 Nov, 07:00"). Sentry's "Next check-in" and Unify ("Next run 11 hours from now") are relative; Productboard, Hex, Mercury and Klaviyo use absolute dates.
- Edge states follow Sentry. While running: "Running now…". When overdue: "Overdue · was due 06:00" (Sentry: "Expected Now"). When paused: "Weekly, Mon 07:00 · paused" with no next run (Sentry shows "-"; Unify shows "Paused" next to the schedule chip).
- Update once a minute, not every second, and keep it out of live regions. Use `<time datetime>`, with the hotel's time zone in the tooltip (Hex shows "America/New_York", Cursor shows "GMT+7") **[our call]**.

**7. Autonomy.** A row: label "Autonomy", a 3-segment meter (each segment 20×6 px, radius 3), and the level name.
- Segments fill in `#996AD5` up to the current level. Empty segments are `#2A2E33` with a `#6B7580` outline.
- Notion's agent settings show "Speed / Intelligence / Cost" as dot meters. Hilos shows "Careful / Balanced (recommended) / Ambitious" as a 3-stop dial.
- Clicking the row opens a popover. Its question borrows Sentry Seer's wording ("Choose how far Seer should go during automated runs before stopping for your approval"): **"How far should this watcher go before stopping for you?"** Below it are a segmented control and one sentence per level:

| Level | Meter | What it means in Compass |
|---|---|---|
| Alerts only | ▰▱▱ | Tells you what changed. Never proposes a number. |
| Recommends · you decide | ▰▰▱ | Proposes a rate with its reasons. Nothing happens until you approve. Approval logs a task for the revenue manager. |
| Acts within limits 🔒 | ▰▰▰ | Shown locked: "Not available: Compass never changes rates in your systems." |

- **Showing the third level, locked.** Juyo's ladder is "monitor, recommend and act" and its pricing lists "Act" as "Coming Soon" (`juyo_brand.md`). Expensify shows a locked "Advanced Approval" tier next to the available ones. Showing the step but locking it tells the user where this goes without pretending it works **[our call]**. If the team prefers, drop it and show two segments.
- **One control per watcher.** Gumloop, Relevance, Lindy, Copilot and Linear Loops set autonomy per tool or action. A Compass watcher has exactly one kind of output, so the per-action ladder and a per-watcher control are the same thing **[our call]**.
- **New watchers start low.** Ramp's agent "starts in review-only mode by default". Relevance advises starting at approval required. Linear says to "start small". So a new watcher starts at Alerts only or Recommends, never higher.
- **Raising autonomy asks for confirmation** in a dialog that restates the change as a sentence. Mercury closes rule creation with "By clicking 'Create Rule,' I authorize Mercury to initiate transfers as specified in this rule". **Lowering it is immediate**, with an Undo toast. These are the same asymmetric-risk rules as the approval card in `ai-ux/README.md` **[our call]**.
- If Compass shows several hotels, the popover says which one the level applies to ("for Hotel Aurora"). Juyo sets autonomy "property by property"; hilos sets a workspace default that "individual agents can override".

**Footer.** A divider, then:
- **Left: the on/off switch**, labelled "On" or "Paused", with accessible name "Event pricing watcher". Fireflies' agent cards and Unify's rows put the toggle on the item. Turning a watcher off must be an explicit user action (Cloudscape: "Don't auto-disable or delete an agent without explicit user action").
- **Right: one primary button, depending on state:**
  - *Needs your decision* → **"Review €189 →"**: a filled pill, near-white `#F2F4F7` with ink `#0D1117` text, because Juyo's primary buttons are neutral pills and brand colour is an accent (`juyo_brand.md`). Orange stays a signal, not a button colour. White text on `#FE7637` would be only 2.7:1 **[our call, with computed contrast]**.
  - *Any other state* → **"▷ Run now"** as a ghost button. Unify shows Run now even on paused rows, and Databricks and Productboard put Run now on the job page.
  - *Couldn't run* → **"Retry"**. GitLab pairs failure with Retry.
- **`⋯` menu:** Edit, Duplicate, **Pause until…**, View run history, Delete. Notion's automation sheet has Active / Edit / Duplicate / Delete; Base44's row menu has Pause / Archive. "Pause until…" follows Mercury's "auto-resume date" and suits seasonal watchers such as OTA mix **[our call]**.

### 5.4 How the three watchers look today

| | Event pricing | Comp-set rates | OTA mix |
|---|---|---|---|
| Position | 1st | 2nd | 3rd |
| Border | orange 60% | default | default (no dimming, see §5.3) |
| Chip | ● Needs your decision | ● Watching | ‖ Paused |
| Glyph | `event` | `travel_explore` | `donut_large` |
| Watches | events in the next **60 days**; recommends when **pickup beats STLY** | **8 comp-set hotels**, alerts when the median moves **more than 5%** | **channel share of room nights**, weekly |
| Latest | "Raise **Sat 6 Dec** to **€189** (+€24) · City marathon · pickup +38%" | "No change worth flagging · median €142, ±2% · 14:00" | "Paused 12 Nov by you · last: Booking.com 41% (+3 pts)" |
| Strip | 12 short grey, 1 purple, newest orange | 14 short grey (span 28 h) | 10 bars, then 4 outlines (span 14 wks) |
| Schedule | Daily 06:00 · next in 13 h 40 min | Every 2 h · next in 1 h 12 min | Weekly, Mon 07:00 · paused |
| Autonomy | ▰▰▱ Recommends · you decide | ▰▱▱ Alerts only | ▰▱▱ Alerts only |
| Primary | **Review €189 →** | ▷ Run now | ▷ Run now (switch off) |

All values are sample copy for the prototype, not data.

### 5.5 Mobile (≤767 px)

```
Watchers                         [ + ]
[All 3] [● Needs you 1] [Watching 1] →        (chips scroll sideways)
┌────────────────────────────────────┐
│ ▦  Event pricing      ● Needs you   │
│ Raise Sat 6 Dec to €189 (+€24)      │
│ City marathon · today 06:02         │
│ ▂▂▂▂▂▂▂▂▂█▂▂▂█                      │
│ Daily 06:00 · next 13 h · ▰▰▱       │
│ [        Review €189 →          ]   │  ← 44 px, full width
└────────────────────────────────────┘
┌────────────────────────────────────┐
│ ⌕  Comp-set rates     ● Watching    │
│ No change · median €142 (±2%)       │
│ ▂▂▂▂▂▂▂▂▂▂▂▂▂▂                      │
│ Every 2 h · next 1 h 12 min · ▰▱▱   │
│ [● On]                  ▷ Run now   │
└────────────────────────────────────┘
```

- **Single column, same order and parts.** "What it watches" moves to the watcher page. Schedule and autonomy merge into one meta line. Sources: Manus iOS scheduled-task cards (title, prompt, switch, next date, `⋯`), Google Home automation cards (glyph, "1 starter • 2 actions", round run button), GitHub iOS "Agent sessions" (status chips per row).
- **New watcher** is a `+` in the header. A FAB would compete with Compass's floating "Ask" button (`ui-refinement/mobile_and_boards.md`, rule 3).
- **The decision button is full width and 44 px high**; other buttons are at least 44 px. This follows the target-size rules in `mobile_and_boards.md`.
- **Review €189** opens a bottom sheet with before → after, the reasons, and Approve / Adjust / Dismiss. Never stack a second sheet (`mobile_and_boards.md`, rule 10).
- **Changing autonomy** opens a bottom sheet with three radio rows and their one-line explanations. The locked level shows its lock. Precedents: Sentry Seer's stopping points as a list of options with the default marked, and Relevance AI's radio choice "Approve immediately / Approve with work hours". Apple keeps a single "Ask Before Running" switch on the automation's own screen (§2.17).
- A home-screen widget can come later: Citizen's "Protect Agent · Standing by ●" tile shows that an agent's status fits a small square **[later, not MVP]**.

### 5.6 Tablet (768–1279 px)

Two columns from the same `auto-fill` grid; the third card wraps. Filter chips and the activity feed stay. The Add-a-watcher row becomes a horizontal scroller **[our call]**.

### 5.7 The watcher page (detail view)

Route `/watchers/:id`, so notifications and the activity feed can link straight to it. It is a full page, not a drawer, because run history and settings need room. NN/g: the whole card links to a details page.

1. **Header.** Glyph (48 px), name, status chip, and the "what it watches" sentence. Actions: **Run now**, the on/off switch, and `⋯` (Edit, Duplicate, Delete). Better Stack's monitor page has the same shape ("Up · Checked every 3 minutes", then Send test alert / Incidents / Pause / Configure), as does Productboard's (Status, Next run, Schedule with switch, then Edit automation / Run now).
2. **Decision panel** (only when one is pending), pinned at the top. It reuses the approval card from `ai-ux/README.md`: current rate → recommended rate, evidence chips (event, pickup vs. STLY, comp-set median), a "How this was computed" link, and the buttons **Approve and log task**, **Adjust**, **Dismiss**, followed by a receipt with Undo. Precedents: Wix "Review and approve blog post" (preview, Dismiss / Approve, "Confirm (1/1)"), Lemni (Decline / Approve with "Waiting for approval"), Relevance AI ("Approve immediately / Approve with work hours").
3. **Four stat tiles:**
   - Last run: "today 06:02 · 41 s"
   - Next run: "in 13 h 40 min"
   - Findings (30 days): "4"
   - You agreed (30 days): "3 of 4 approved · 75%"
   
   Better Stack shows "Currently up for / Last checked at / Incidents". Attio shows "In progress / Avg. runtime / Completed / Failed". Plain and Gorgias show agent outcome tiles. The agreement tile copies Ramp's "agent alignment" (how often reviewers agree with the agent). It tells a GM whether the watcher is worth keeping, and whether it has earned more autonomy later.
4. **Run history.**
   - A wider strip of the last 90 runs, using the same encoding as the card, with a 30 / 90 / All switch. Adaline offers "24 hrs / 7 days / 30 days / 6 months"; Statuspage uses 90 days.
   - Below it, a list of runs: time, outcome chip, duration, one-line finding.
   - Expanding a run shows its steps (data read, checks run, result) and the "How this was computed" panel. Browserbase lists steps with timestamps; n8n lists executions with a green or red edge and shows the per-node result; Attio has a numbered "Run history" list.
   - Failed runs keep their logs and partial results (GitLab).
5. **Activity.** This watcher's events and people's actions in one timeline (created, autonomy changed by Alex, recommendation approved by Maria, paused). It uses past-tense labels, day dividers and actor avatars, as in Render's "Event timeline" and Cloudscape's timeline overview. Juyo promises "how every action is logged" ([juyo-enterprise](https://juyo.ai/juyo-enterprise)).
6. **Settings,** as sections on the same page:
   - **Schedule:** a repeat picker. Mercury uses "every week on M T W T F"; Philips Hue uses "Start at / Repeat" with day circles.
   - **Scope:** hotel, date window, segments.
   - **Thresholds:** for example "Flag when pickup vs. STLY is above +20%".
   - **Autonomy:** the same segmented control as the card, with the explanation per level.
   - **Notifications:** the default is "Only when it needs you or fails". GitLab sends no notifications during normal running; Grok's agent profile says "Get notified when this agent finishes or needs input"; Klaviyo's monitor page lists channels and roles.
   - **Data it reads:** Cloudscape asks for the agent's source to be shown.
   - Notion's custom-agent settings group the same things under "Triggers / Instructions / Tools and access".
7. **Optional: "Ask about this watcher".** A composer at the bottom that opens Kassandra with this watcher as context. Tana's agent page ends with "Start something new with <agent>…", and Relevance AI has "Leave comment for your agent" **[optional]**.

### 5.8 Empty state and create flow

**No watchers yet**
- Headline: "No watchers yet". One line: "Watchers check your numbers on a schedule and bring you only what needs a decision."
- Three template cards (Event pricing, Comp-set rates, OTA mix), each with its schedule chip and **Add**.
- A prompt box: "Describe what to watch… e.g. Every morning, check events in the next 60 days and suggest a rate."
- A secondary link: "Set up manually".
- Sources: Base44 ("Create your first agent… run on schedules", suggestions plus "Create from scratch"), Cursor ("No Automations Yet · Run agents on a schedule or automatically in response to events" plus "Suggested"), Neo Financial ("No automations" plus two templates), ChatGPT iOS (dashed template cards with "+" above a "Schedule a task" composer).

**Create with chat**
1. The user describes the watcher.
2. Kassandra asks at most two clarifying questions in a docked question card ("1 of 2", recommended option first). ChatGPT iOS does this ("1 of 3 · Which topics should your daily briefing prioritize?"), as do Unify and Base44.
3. A **review card** restates the watcher:
   - the watcher as one sentence;
   - schedule plus first run in bold ("First run tomorrow 06:00");
   - autonomy level, starting at Alerts only or Recommends, never higher;
   - one authorization line ("Kassandra will only propose rates. Nothing changes until you approve.").
   
   Sources: Mercury's "Review auto transfer rule" with "Next transfer…" and the authorization sentence; Unify's confirmation with the next run in bold; ChatGPT's "It'll run each morning around 9:00 AM" with a "Daily · <name>" chip.
4. **Create.** The new card appears at its sorted position with "First run tomorrow 06:00" and a **Run now** button to test it.

SM-A's Autonomy Dial says to start new users low (`ai-ux/pattern_canon.md`).

### 5.9 Notifications and the nav

- **When to notify.** Notify only on *needs your decision* and *couldn't run*. Never notify for routine runs (GitLab's rules; Microsoft's "nudging more than notifying"). Copy pattern: "Event pricing needs your decision · Sat 6 Dec €189", similar to Claude iOS's "Research paused · Needs your input to continue".
- **Nav badge.** The Watchers nav item carries a count of pending decisions. LangChain Fleet's Inbox shows a count; Deel's "Action required" shows 72.
- **Morning brief.** Pending decisions also appear in the morning brief, where `docs/decisions.md` already puts agents' approval requests.

### 5.10 What this replaces, and what we rejected

| Option | Seen in | Why not for Compass |
|---|---|---|
| Plain rows / table | Lindy, Vapi, Klaviyo Auto monitors, Hex, Base44, Snowflake, Cursor Automations | The user rejected it. Rows flatten different states and can't show a finding. Keep as a future list toggle when there are more than 10 watchers. |
| Node canvas | n8n, Attio workflows, Railway, LangGraph Studio | A builder's tool. A GM approves rates; they don't wire nodes. |
| Kanban by status | Cursor's grouped sidebar, Linear | With 3 watchers, most columns would be empty. |
| Human persona (name and face) | Wix "Kleo", Relevance AI pixel people, ElevenLabs "Eric / Matilda" | Kassandra is already Juyo's persona; one persona per watcher dilutes her. Linear's guidelines require disclosure, not anthropomorphism. |
| Inbox-only (no cards) | LangChain Fleet Inbox, Assembly Approvals | Good for many items; with 3 watchers it hides the watchers themselves. The "Needs you" chip and nav badge give an inbox view without a second page. |

### 5.11 Accessibility checklist (WCAG 2.2 AA)

- **Status chips** always have icon plus text, never colour alone (1.4.1). Their text clears 4.5:1 (orange 6.4, purple-tint 7.2, grey 6.8, red 5.5 on `#161C22`).
- **Purple `#996AD5`** is 4.4:1 on `#161C22`. Use it only for bars, meters and large text. Small purple text uses `#B79BE4` (7.2:1).
- **Run strip:** `role="img"` with a text summary on the card, focusable bars on the detail page, and the tooltip also shown on focus.
- **Switch:** `role="switch"` with the watcher's name as its label. The card link wraps the title, not the whole card, and a pseudo-element stretches the click area, so nested controls stay reachable and the link's name stays short **[our call]**.
- **Countdown:** no `aria-live`. It updates once a minute, and a `<time>` element carries the absolute time.
- **Reduced motion:** the spinner becomes static and there's no pulse on the pending bar.
- **Targets:** at least 24×24 CSS px on desktop and 44 px on mobile (`mobile_and_boards.md`).

---

## 6. Limits of this research

- **Not on Mobbin:** Datadog, Ramp, Copilot Studio, Agentforce, Gemini Enterprise, Apple Shortcuts, and the current Zapier Agents UI. For these we rely on official docs only. Mobbin's Zapier screens show the older assistant settings.
- **Fetch problems:**
  - help.openai.com, help.salesforce.com and developer.salesforce.com block automated fetching. OpenAI pages were read through Wayback snapshots dated 2026-11-03 and 2026-11-17.
  - The Pulse retirement reason was confirmed in secondary coverage ([Digit](https://www.digit.in/news/general/openai-is-retiring-chatgpt-pulse-and-replacing-it-with-scheduled-tasks-here-is-why.html), [AlternativeTo](https://alternativeto.net/news/2026/6/chatgpt-launches-new-scheduled-tasks-and-prepares-to-sunset-pulse/)).
  - Mercury's help pages were read through the help centre's public JSON API.
- **Sentry:** the docs don't describe the cron list or timeline UI. Those details come from Sentry's open-source frontend (`getsentry/sentry`, `master`, read 2026-11-20).
- **Apple:** "Run Immediately / Notify When Run" appear only in third-party sources. Apple's own guides document "Ask Before Running" and "Enable This Automation".
- **Status colours:** no agent platform documents its colours. The colours in §5 come from the Juyo palette, with contrast computed by us against `#161C22`.
- **Gumloop:** "Recent Activity" and "Upcoming Triggers" exist on Mobbin but are no longer in Gumloop's docs. Treat that home page as an earlier UI.
- **Sample data:** all hotel numbers in §5 are illustrative.

### Contrast check (WCAG 2.x, computed)

| Colour | on `#0D1117` | on `#161C22` | on `#1E2429` | Use |
|---|---|---|---|---|
| `#FE7637` orange | 7.1 | 6.4 | 5.9 | Decision chip, ring and pending bar. **Never white text on orange (2.7).** |
| `#996AD5` purple | 4.9 | 4.4 | 4.0 | Bars, meters, large text only |
| `#B79BE4` purple tint | 8.0 | 7.2 | 6.6 | Small purple text, glyphs |
| `#9AA4AE` muted text | 7.5 | 6.8 | 6.2 | Secondary text, Watching/Paused chips |
| `#6B7580` bar grey | 4.0 | 3.7 | 3.4 | "Nothing found" bars, empty meter outline |
| `#5B6570` | 3.2 | 2.9 | 2.6 | Avoid for meaningful marks |
| `#F0645A` red | 6.0 | 5.5 | 5.0 | Couldn't run |
| `#AB4236` (Juyo negative) | 3.2 | 2.9 | 2.7 | Too dark for small marks on cards |
