# AI UX Pattern Canon (as of 2026-11-20)

Purpose: the allow-list of named, published AI UX patterns for the Compass demo (hotel analytics, Angular + Spartan UI, AI assistant with generated UI, morning briefing, metric-watching agents, desktop + phone). **Rule: if a UI behavior is not in this file with a source, we don't ship it. If we need it, find a source first.**

Each pattern lists: **name as the source writes it**, what it is, when to use it, anatomy (what's on screen), anti-patterns, and the source URL. Paraphrased throughout. Shape of AI is CC-BY-NC-SA: cite it, don't copy it.

## Source key

| Key | Source | Type | URL |
|---|---|---|---|
| SoAI | The Shape of AI (Emily Campbell), 57 patterns in 6 families | Pattern library | https://www.shapeof.ai/ |
| HAX | Microsoft HAX Toolkit: 18 Guidelines + 34 design patterns (Gx-Y) | Guidelines + patterns | https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/ , https://www.microsoft.com/en-us/haxtoolkit/design-patterns/ |
| PAIR | Google People + AI Guidebook (6 chapters, 22 patterns) | Guidebook | https://pair.withgoogle.com/guidebook/ (patterns: `/guidebook/patterns#<slug>`) |
| AHIG-GenAI / AHIG-ML | Apple HIG: Generative AI (updated 2026-06-08), Machine learning | Platform guidelines | https://developer.apple.com/design/human-interface-guidelines/generative-ai , https://developer.apple.com/design/human-interface-guidelines/machine-learning |
| CS | AWS Cloudscape "Gen AI" patterns (19 patterns, 2023 to 2026) | Design system | https://cloudscape.design/gen-ai/ |
| CB | IBM Carbon for AI + AI label | Design system | https://carbondesignsystem.com/guidelines/carbon-for-ai/ , https://carbondesignsystem.com/components/ai-label/usage/ |
| GL | GitLab Pajamas: AI-human interaction, Duo agents and flows | Design system | https://design.gitlab.com/patterns/ai-human-interaction , https://design.gitlab.com/patterns/duo-agents-and-flows |
| ATL | Atlassian Rovo UI: AI interaction guidelines (8) | Design system | https://atlassian.design/rovo-ui/ai-interaction-guidelines |
| MSL | Microsoft Learn: "Creating a dynamic UX: guidance for generative AI applications" (Copilot UX) | Vendor guidance | https://learn.microsoft.com/en-us/microsoft-cloud/dev/copilot/isv/ux-guidance |
| MSD | Microsoft Design: "UX design for agents" (2025-04-11) | Vendor guidance | https://microsoft.design/articles/ux-design-for-agents/ |
| LIN | Linear: Agent Interaction Guidelines (AIG), living doc | Vendor guidance | https://linear.app/developers/aig |
| OAI | OpenAI Apps SDK: UI guidelines (display modes for in-chat UI) | Platform guidelines | https://developers.openai.com/apps-sdk/concepts/ui-guidelines |
| AIE | Vercel AI Elements (component inventory = de-facto standard patterns). Note: site says it moves to shadcn/ui and deprecates at the end of Nov 2026 | Component library | https://elements.ai-sdk.dev/ |
| AISDK | Vercel AI SDK: Generative user interfaces | Dev docs | https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces |
| NNg | Nielsen Norman Group AI articles (2023 to 2026), index: | Research | https://www.nngroup.com/articles/designing-ai-study-guide/ |
| SM-A | Smashing, Yocco, "Designing For Agentic AI: Practical UX Patterns For Control, Consent, And Accountability" (2026-02) | Practitioner | https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/ |
| SM-T | Smashing, "Practical Interface Patterns For AI Transparency (Part 2)" (2026-05) | Practitioner | https://www.smashingmagazine.com/2026/05/practical-interface-patterns-ai-transparency/ |

Weighting: primary/platform sources (HAX, PAIR, AHIG, CS, CB, GL, SoAI) define the canon. NNg is research evidence. SM-A/SM-T are newer practitioner writing: use their patterns only where a primary source covers the same behavior (cross-references noted). AIE/OAI tell us which components are standard.

HAX phases: G1-G2 "Initially", G3-G6 "During interaction", G7-G11 "When wrong", G12-G18 "Over time" (CHI 2019 paper, in library/).

---

## 1. Onboarding and expectation setting

**Make clear what the system can do** (HAX G1). Patterns:
- **G1-A Introductory blurb**: one sentence, readable in under 10 seconds. Shown next to the feature name, in the input field, or on first use. Must be easy to dismiss. Anti: "magic" framing, catchy but not descriptive, buried, repeated until it annoys. https://www.microsoft.com/en-us/haxtoolkit/pattern/g1-a-introductory-blurb/
- **G1-C Expose system controls**: capabilities discovered through visible menus and controls. Anti: low discoverability. https://www.microsoft.com/en-us/haxtoolkit/pattern/g1-c-expose-system-controls/
- **G1-D Demonstrate possible system inputs**: clickable pre-written inputs, placeholder text, autocomplete. Pick them for diversity, popularity, and context. Anti: examples the system then handles badly; examples that set a biased tone. https://www.microsoft.com/en-us/haxtoolkit/pattern/g1-d-demonstrate-possible-system-inputs/
- **G1-E Show a set of system outputs**: a preview of likely outputs. Anti: too few or too many. https://www.microsoft.com/en-us/haxtoolkit/pattern/g1-e-show-a-set-of-system-outputs/

**Make clear how well the system can do what it can do** (HAX G2). Patterns:
- **G2-A Match precision to performance (language)**: word choice tracks confidence ("is" vs "may", "probably"). Anti: wording that sounds more certain than the system is, or so hedged it means nothing. https://www.microsoft.com/en-us/haxtoolkit/pattern/g2-a-match-the-level-of-precision-in-ui-communication-with-the-system-performance-language/
- **G2-B Match precision to performance (numbers)**: rounding, ranges, "about", fewer decimals when uncertain. Highly relevant for KPI forecasts. https://www.microsoft.com/en-us/haxtoolkit/pattern/g2-b-match-the-level-of-precision-in-ui-communication-with-the-system-performance-numbers/
- **G2-C Report system performance information**: accuracy and false-rate information in units users understand, in docs or an inspector. Anti: using it in place of G2-D. https://www.microsoft.com/en-us/haxtoolkit/pattern/g2-c-report-system-performance-information/
- **G2-D Provide low performance alerts**: an alert in context when the system is known to do worse (for example, sparse data). Alert style scales with consequence. Anti: no actionable next step; too much text. https://www.microsoft.com/en-us/haxtoolkit/pattern/g2-d-provide-low-performance-alerts/

**Set the right expectations** / **Explain the benefit, not the technology** / **Anchor on familiarity** / **Make it safe to explore** (PAIR):
- Be open about capabilities and limits.
- Explain the value the user gets, not the model.
- Use familiar UI rather than "magic" metaphors.
- Offer a reversible test drive before asking for data or preferences, and per-item undo instead of a "nuclear reset".
- https://pair.withgoogle.com/guidebook/patterns#set-the-right-expectations , `#explain-the-benefit-not-the-technology`, `#anchor-on-familiarity`, `#make-it-safe-to-explore`
- Chapter "Mental Models + Expectations" (sections: Introduce AI in stages, Plan for co-learning, Account for Human-Like Interaction): https://pair.withgoogle.com/guidebook/chapters/mental-models-and-expectations

**Set clear expectations about what your AI-powered feature can and can't do** (AHIG-GenAI, Transparency):
- A short tutorial, plus curated suggestions for open-ended inputs.
- State known limits up front, show how to get good results, and explain why a poor result happened.
- Related AHIG-ML **Limitations**: set expectations before use, demonstrate best results (placeholder text, alternatives instead of "no results"), explain how a limit caused a poor result, and announce when a limit is lifted.

**Initial CTA** (SoAI, Wayfinders): the first touchpoint.
- Anatomy: a large open input surrounded by scaffolding (suggestions, gallery, prompt enhancer, mode or model selector, attachments, templates).
- Variants: Action-First CTA (AI is a feature, so use wizards or templates), **Contextual CTA** (hold AI back until there is data to act on; this fits Compass, which surfaces AI on a dashboard metric), Playful CTA.
- Anti: a bare box that relies on prompt skill; wasting compute on vague intent.
- https://www.shapeof.ai/patterns/cta

**Nudges** (SoAI): progressive disclosure of AI capabilities through actionable triggers in context ("find action items"). Anti: blanket lists of options, "growth theater" upsells, nudges that build dependence. https://www.shapeof.ai/patterns/nudges

**Example gallery** (SoAI): curated, community, or dynamic sample outputs with "Try this", "See prompt", "Modify input". Doubles as onboarding. https://www.shapeof.ai/patterns/gallery

**Show what the chatbot can do through informative messages and suggested prompts** (NNg guideline 3):
- The opening message lists the territory it covers ("finding cookware, recipes"), not "Ask me anything".
- Tailor it to the page the user is on.
- If the bot can see the current page or remember earlier items, say so through suggestions that reference them.
- https://www.nngroup.com/articles/ai-chatbots-design-guidelines/

**Scope** (NNg "Scope in Generative AI Features"): narrow-scope features (for example, a prompt wizard) tested better than broad open chat because of the flexibility-usability tradeoff. Decide the scope before designing the UI. https://www.nngroup.com/articles/scope-ai-features/

**AI Chat Is Not (Always) the Answer** (NNg): consider non-chat integration (personalization, embedded features) before adding a chatbot. https://www.nngroup.com/articles/ai-chat-not-the-answer/

**Copilot UX focus frameworks** (MSL):
- **Immersive** (whole canvas, for example an AI-generated dashboard).
- **Assistive** (side panel inside the app).
- **Embedded** (a single entry point on an entity, for example "dive deeper into a chart").
- A secondary focus is recommended, for example Embedded plus Assistive.
- First-run: explain capabilities and suggest how to start.
- https://learn.microsoft.com/en-us/microsoft-cloud/dev/copilot/isv/ux-guidance

**Avoid cold starts by eliciting user preferences** (HAX G10-B): a short, optional, ideally fun preference session. Anti: burdensome or privacy-unclear. https://www.microsoft.com/en-us/haxtoolkit/pattern/g10-b-avoid-cold-starts-by-eliciting-user-preferences/

**Automate in phases** (PAIR): start users at the lowest automation level and let them raise or lower it in small steps. Cites Sheridan's 10 levels of automation. https://pair.withgoogle.com/guidebook/patterns#automate-in-phases

---

## 2. Input and prompting

**Open input** (SoAI, Inputs).
- Variants: Inline composer (works on a selection), Command-style prompt with parameters, Side panel composer.
- Rules: a clear default scope and one-step scope switching; constructive errors that say what's missing ("too long or underspecified"); don't drop controls after the first prompt.
- https://www.shapeof.ai/patterns/open-input

**Prompt suggestions** (NNg), 3 types:
- **Use-case prompt suggestions** (learnability).
- **Prompt autocomplete** (efficiency).
- **Followup questions** (continuation).
- Rules: specific beats vague, individualize, place near the input field, curate by hand, use an example library when more context is needed.
- https://www.nngroup.com/articles/prompt-suggestions/ , https://www.nngroup.com/articles/designing-use-case-prompt-suggestions/

**Suggestions** (SoAI): 3 to 6 ranked, contextual, actionable chips that either run or prefill. Model good prompts. Show a preview or confirmation if a suggestion triggers data access, publishing, or heavy compute. https://www.shapeof.ai/patterns/suggestions

**Offer relevant suggested questions as buttons, not text** (NNg guideline 4): show them at open and after each answer. Anti: follow-ups embedded in answer prose that must be retyped; repeating a suggestion the user already ignored. https://www.nngroup.com/articles/ai-chatbots-design-guidelines/

**Support prompts** (CS):
- Two types: **non-editable** (send on select, for example "Compare with last quarter") and **editable** (insert into the input with `<variables>`, marked by an edit icon).
- Anti: editable prompts used for quick follow-ups; disabling inserted text.
- https://cloudscape.design/gen-ai/patterns/support-prompts/

**Variables** (CS): inline placeholders `<time-period>` in templates. Italic until filled. Plain or interactive (token plus popover). Anti: too many variables; using a variable as a status label (use a badge). https://cloudscape.design/gen-ai/patterns/variables/

**Templates** / **Madlibs** (SoAI): structured fields plus variables for known, repeatable tasks. Mark critical vs optional fields. Show the underlying prompt structure. https://www.shapeof.ai/patterns/templates , https://www.shapeof.ai/patterns/madlibs

**Encourage details** (MSL): split one general prompt into several input fields. https://learn.microsoft.com/en-us/microsoft-cloud/dev/copilot/isv/ux-guidance

**Prompt controls** (NNg "Prompt Controls in GenAI Chatbots"):
- UI controls around the prompt for discoverability, education, constraints (scope or format), and follow-ups.
- Rules: standard icons plus labels or tooltips, clear non-branded names, grouping by function, follow conventions.
- https://www.nngroup.com/articles/prompt-controls-genai/

**Shortcut menus** (CS) (slash or @ menus) and **Slash commands** (GL Duo): keep frequent actions as visible secondary actions in the prompt input rather than only inside the menu. https://cloudscape.design/gen-ai/patterns/shortcut-menus/ , https://design.gitlab.com/patterns/duo-slash-commands

**Inline Action** (SoAI): preset AI actions on a selection or object (shorten, explain, transform). Show the result as a suggestion layer, not an overwrite; accept, reject, or refine. Show "see how this was changed" when data or claims change. https://www.shapeof.ai/patterns/inline-action

**Attachments** (SoAI): paperclip, @-mention, paste URL, canvas block, live capture. Let users set each attachment's purpose (subject vs guide). Cite attachment passages. https://www.shapeof.ai/patterns/attachments

**In-chat context** (CS):
- Match the method to where the context lives (OAuth for services, upload for files, natural language for knowledge).
- The agent confirms what it received and how it will use it.
- Collapse completed steps. Never send the user to a settings page mid-chat.
- https://cloudscape.design/gen-ai/patterns/in-chat-context/

**Connectors** (SoAI):
- Make scope explicit.
- Show a per-message "Using: X, Y" chip.
- Show freshness: last synced, cached label, refresh.
- Degrade gracefully ("Drive not reachable" plus Retry or Reconnect).
- Treat connected content as untrusted (prompt injection): gate tool use behind explicit intent.
- https://www.shapeof.ai/patterns/connectors

**Modes** (SoAI): a mode is a contract, not a theme. Explicit entry and exit, visible state, a reconfigured surface, visible inheritance rules. https://www.shapeof.ai/patterns/modes

**Model management** (SoAI): show the active model at the point of generation; describe differences in human terms; routing by default with manual override. https://www.shapeof.ai/patterns/model-management

**Prompt enhancer** (SoAI): an "Enhance" action that rewrites the prompt visibly. Keep the user's intent and highlight material expansions. Keep the raw prompt accessible. https://www.shapeof.ai/patterns/prompt-enhancer

**Parameters** (SoAI): toggles, sliders, chips. "Treat autonomy as a parameter": suggest only, ask approval, or execute. https://www.shapeof.ai/patterns/parameters

Also in SoAI Inputs and Tuners (lower relevance for Compass): Auto-fill, Chained action, Describe, Expand, Inpainting, Regenerate (section 6), Restructure, Restyle, Summary (section 4), Synthesis (section 4), Transform, Filters, Preset styles, Saved styles, Voice and tone. Base URL: `https://www.shapeof.ai/patterns/<slug>`.

**Consider offering voice input** (NNg guideline 10). https://www.nngroup.com/articles/ai-chatbots-design-guidelines/

---

## 3. Waiting, progress, and reasoning visibility

**Generative AI loading states** (CS):
- Two stages: **processing** (nothing returned yet: AI avatar in loading state plus specific loading text in the bubble) and **generation** (stream text and inline code).
- For tables, lists, and code blocks, show a **loading bar plus text** in the spot where the element will render.
- Copy format: "Generating [artifact]" for new content, "Loading [artifact]" for fetched content.
- Anti: a loading state shorter than 1 second (flicker).
- https://cloudscape.design/gen-ai/patterns/generative-ai-loading-states/

**Consider giving specific, reassuring feedback during generation** (AHIG-GenAI): "Summarizing key themes from your notes", not "Processing…". Factor latency in: design a loading experience, or generate in the background while the user does something else.

**Thinking** (CS, 2026-04):
- States: Active ("Thinking…", expandable, **collapsed by default in chat**, expanded by default when the response isn't the primary content, for example on a dashboard) and Complete ("Thought for 14s").
- Optional **Skip thinking**.
- Thinking is internal reasoning, not execution. Use Progressive steps for actions.
- Anti: using it as a generic spinner; exposing secrets, tokens, or system prompts.
- https://cloudscape.design/gen-ai/patterns/thinking/

**Progressive steps** (CS):
- Hierarchical step list. Statuses: not-started, in progress, success, error, stopped. Sub-steps at most 4 levels.
- Over 10 seconds: estimated wait or a progress bar. On error, dependent steps are marked stopped and the failed step offers retry.
- On completion, the steps list collapses under the output.
- Header copy: "40% · 2 of 5 steps" or "3 done · 2 running · 1 queued".
- https://cloudscape.design/gen-ai/patterns/progressive-steps/

**Stream of Thought** (SoAI):
- A bounded, collapsible box: human-readable plan, execution log, compact summary.
- Rules: "Make steps into states" (queued, running, waiting for approval, error, retried, completed). Keep plan, execution, and evidence separate but synchronized. Tailor visibility to the mode.
- https://www.shapeof.ai/patterns/stream-of-thought

**Reasoning**, **Chain of Thought**, **Shimmer**, **Task**, **Tool** (AIE components): standard building blocks for collapsible reasoning, shimmer text, task and status rows, and tool call plus result cards. https://elements.ai-sdk.dev/components/reasoning , `/chain-of-thought`, `/shimmer`, `/task`, `/tool`

**An agent should provide instant feedback** (LIN): acknowledge right away with a lightweight "Thinking" indicator. https://linear.app/developers/aig

**Practitioner patterns, cross-referenced to primary sources** (SM-T):
- **The Living Breadcrumb**: cycling step labels for background work (compare the AHIG specific feedback guidance).
- **The Dynamic Checklist**: wired to real state (= CS Progressive steps).
- **The Thinking Toggle**: sanitized logs (= CS Thinking, ATL "pop the hood").
- **The Audit Trail** (section 8).
- Anti: spinners for agent work, because they don't say whether the agent is reasoning, stalled, or failed.
- https://www.smashingmagazine.com/2026/05/practical-interface-patterns-ai-transparency/

**Controls** (SoAI):
- The **Stop button** is always in the same place and clickable until done. **Pause/resume** for long runs.
- A **Queue** stacks new tasks while the agent works.
- Use variations instead of overwriting.
- https://www.shapeof.ai/patterns/controls . Matching components: AIE **Queue** https://elements.ai-sdk.dev/components/queue. CS: the send button becomes a **Stop action**, with no friction to stop.

**Don't autoscroll users to the end of a response** (NNg guideline 7): keep the scroll position at the top of the new message. https://www.nngroup.com/articles/ai-chatbots-design-guidelines/

**Timeline overview**: also CS "don't auto-scroll unless the user is already at the bottom".

**Cost estimates** (SoAI) / **Context** (AIE): show expected cost or credits and context-window use where decisions happen. https://www.shapeof.ai/patterns/cost-estimates , https://elements.ai-sdk.dev/components/context

---

## 4. Output presentation (including generated UI)

**Generative AI chat** (CS):
- Avatars distinguish authors.
- **Align the conversation to the surface**: in dense, embedded, or side-panel surfaces, put all messages on one side.
- **Keep the composer pinned**; only the log scrolls.
- At most 5 inline actions per message; the rest go in a dropdown.
- Error alert with a recovery action.
- https://cloudscape.design/gen-ai/patterns/generative-ai-chat/

**Artifact previews** (CS):
- **Inline previews** (code snippet, media, download-only file card; quick actions such as copy or download).
- **Canvas previews** (a selectable card that opens the full artifact in an adjacent panel for detailed review or editing).
- Keep artifact actions inside the artifact card, separate from message actions.
- Anti: nesting artifacts inside a chat bubble (stack them instead).
- https://cloudscape.design/gen-ai/patterns/artifact-previews/

**Display modes** (OAI):
- **Inline card**: one action or decision, or small structured data. At most 2 actions (1 primary). No tabs, no drill-ins, no nested scroll.
- **Inline carousel**: 3 to 8 items, each with a visual and at most 3 lines of metadata.
- **Fullscreen**: rich tasks. The composer stays overlaid.
- **Picture-in-picture**: live sessions.
- Anti: duplicating the chat input inside the card; custom fonts or gradients.
- **This is the closest published canon for "AI returns a chart, table, or proposal card".**
- https://developers.openai.com/apps-sdk/concepts/ui-guidelines

**Generative UI** (AISDK): the model calls a tool and its typed output renders a component. Render each tool state: input-available means loading, output-available means the component, output-error means an inline error. https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces

**Generative UI and Outcome-Oriented Design** (NNg) defines GenUI and its challenges. https://www.nngroup.com/articles/generative-ui/

**The Most Exciting Development in GenUI: Buttons and Checkboxes** (NNg): simple form controls inside chat (checkboxes on results, Claude's AskUserQuestion with up to 4 questions) beat typing. https://www.nngroup.com/articles/genui-buttons-and-checkboxes/

**Give answers first; provide detail on demand** (NNg "Less Chat, More Answer"):
- The **truncated-pyramid rule** for small chat viewports.
- Cut small talk and sycophancy.
- Answers must be concise and scannable.
- When it can't help, say so plainly.
- Prefer specific answers to "go see page X".
- https://www.nngroup.com/articles/less-chat-more-answer/

**Use progressive disclosure to keep the chat short** (NNg guideline 6): expand details in place (an accordion), not as a new message. https://www.nngroup.com/articles/ai-chatbots-design-guidelines/

**Include images, not just links** (NNg guideline 5), **Allow users to resize the chat window** (NNg guideline 8), **Allow users to save or share chat content** (NNg guideline 9). Same URL.

**Show inputs and outputs together** + **Keep a history of outputs and prompts** (MSL). https://learn.microsoft.com/en-us/microsoft-cloud/dev/copilot/isv/ux-guidance

**Consider offering alternate versions of results** (AHIG-GenAI) / **Multiple options** (AHIG-ML):
- Prefer diverse options; avoid too many.
- Put the most likely first; make them easy to tell apart.
- **Variations** (SoAI): never overwrite the original without confirmation. https://www.shapeof.ai/patterns/variations

**Summary** (SoAI): faithful compression.
- Expose the scope ("what is summarized").
- Offer short, detailed, or key-points presets.
- Attach citations automatically.
- Label auto-summaries as AI and let users disable them.
- https://www.shapeof.ai/patterns/summary

**Synthesis** (SoAI): reorganizes sources and adds interpretation.
- **Separate evidence from interpretation** visually.
- **Expose uncertainty** ("limited support", "conflicting data"; confidence indicators on cards and dashboards).
- Verify key conclusions before adopting them.
- https://www.shapeof.ai/patterns/synthesis

**Present properties of system outputs** (HAX G11-C): show output characteristics so users can compare (price lower than X, and so on). https://www.microsoft.com/en-us/haxtoolkit/pattern/g11-c-present-properties-of-system-outputs/

**Make precision and recall tradeoffs carefully** (PAIR): in high-stakes domains show fewer, higher-confidence results (precision); in low-stakes domains show more (recall). Relevant for alert and agent thresholds. https://pair.withgoogle.com/guidebook/patterns#make-precision-and-recall-tradeoffs-carefully

---

## 5. Trust, transparency, citations, explanation

**Citations** (SoAI):
- Variants: inline highlights, direct quotations, multi-source references (title and favicon), lightweight links.
- Rules: hover preview plus click-through; deep-link to the passage; make missing or broken citations explicit; let users rescope sources.
- https://www.shapeof.ai/patterns/citations

**References** (SoAI): a source list in a panel, a hidden aside (tab or drawer), or nested in the message. Prominence matches the use case. Handle missing sources explicitly. https://www.shapeof.ai/patterns/references

**Source citations, done right** (NNg "Explainable AI in Chat Interfaces", 2025-12):
- Users rarely click citations, and a cited look inflates trust.
- So: style citations distinctly; place them next to the claim; link to the relevant passage; use meaningful labels, never "Source".
- **Step-by-step reasoning is often unfaithful**: don't present it as proof of how the answer was reached.
- **Disclaimers**: plain language, paired with an action ("Double-check…"), near the input, and in onboarding.
- **Avoid anthropomorphic language.**
- https://www.nngroup.com/articles/explainable-ai/

**Inline citations / Sources** (CS copy rules): "[1] [2]" markers; a popover with the source title and dismiss button; an expandable section titled "Sources" with title, description, and date. https://cloudscape.design/gen-ai/patterns/generative-ai-chat/ . Components: AIE **Inline Citation**, **Sources** https://elements.ai-sdk.dev/components/inline-citation , `/sources`

**Encourage fact-checking using citations and direct quotes** + **Add appropriate friction** (MSL): add friction at copy, save, share, and insert ("review before inserting"). https://learn.microsoft.com/en-us/microsoft-cloud/dev/copilot/isv/ux-guidance

**Make clear why the system did what it did** (HAX G11). Patterns:
- **G11-A Local explanations** (for one decision; don't explain when confidence is low, communicate uncertainty instead).
- **G11-B Global explanations.**
- **G11-D Map system input attributes to system outputs** (which inputs mattered).
- **G11-E Map user behaviors to system outputs.**
- **G11-F Example-based explanations.**
- **G11-G "What if?" explanations** (simulate alternative inputs; useful for KPI levers).
- https://www.microsoft.com/en-us/haxtoolkit/pattern/g11-a-local-explanations/ (and g11-b to g11-g)

**Attribution** (AHIG-ML): a factual basis for a result ("Because you've read mysteries…"). Not too specific or too general, no emotional inference, no statistical jargon unless the domain is statistical (hotel KPIs are, so numbers are fine). https://developer.apple.com/design/human-interface-guidelines/machine-learning

**Confidence** (AHIG-ML) / **Determine how to show model confidence, if at all** (PAIR):
- Translate confidence into familiar concepts.
- Change the presentation at confidence thresholds.
- Test displays early; sometimes show none.
- https://pair.withgoogle.com/guidebook/patterns#determine-how-to-show-model-confidence-if-at-all

**Communicating uncertainty** (NNg "AI Hallucinations"): intentionally uncertain first-person language, explainable factors with low-confidence warnings, confidence ratings in high-stakes cases, consistency checks across multiple responses, displayed sources. https://www.nngroup.com/articles/ai-hallucinations/

**Explain for understanding, not completeness** + **Go beyond in-the-moment explanations** (PAIR): short in-flow explanations; deeper ones in help, onboarding, or docs. Also HAX **G16-D**. https://pair.withgoogle.com/guidebook/patterns#explain-for-understanding-not-completeness

**Add context from human sources** (PAIR): third-party or expert or community context next to AI recommendations in high-stakes situations. https://pair.withgoogle.com/guidebook/patterns#add-context-from-human-sources

**Footprints** (SoAI): visible and machine-readable traces of AI participation (interface badges plus system logs: model, sources, approvals, cost). https://www.shapeof.ai/patterns/footprints

**Prompt details** (SoAI): show the prompt and parameters behind an artifact with "Copy prompt" or "Use as template". https://www.shapeof.ai/patterns/prompt-details

**Caveat** (SoAI): "Assume they will be ignored". Make it contextual ("Check dates for accuracy"), placed at the moment of decision, and part of a broader support system. https://www.shapeof.ai/patterns/caveat

**Make it easy to 'pop the hood'** (ATL): live and after-the-fact views (logs, advanced layers) tailored to role. https://atlassian.design/rovo-ui/ai-interaction-guidelines

**Explainability popover** (CB): the AI label opens a popover with **Overview / Supporting details / Artifacts and resources / Additional actions**. https://carbondesignsystem.com/components/ai-label/usage/

**Crafting AI Explanations for Every Role in Your Enterprise** (NNg): different explanations for governance leads, builders, and domain experts. https://www.nngroup.com/articles/crafting-ai-explanations/

**Sycophancy** (NNg; SoAI Personality "Guard against sycophancy"): models flip under "Are you sure?". Design and evaluate against over-agreeableness. https://www.nngroup.com/articles/sycophancy-generative-ai-chatbots/

---

## 6. Control, steering, correction

**Keep people in control** + **Make it easy for people to refine or revert generated results, and acknowledge when their corrections take effect** (AHIG-GenAI):
- **Edit / Undo / Retry / Adjust** controls next to generated content.
- Give a visible signal that an adjustment took effect.
- Let people dismiss unwanted content.
- https://developer.apple.com/design/human-interface-guidelines/generative-ai

**Support efficient invocation / dismissal / correction** (HAX G7, G8, G9). G9 patterns:
- **G9-A Switch classification decisions** (toggle a label, for example anomaly vs normal).
- **G9-B Rich and detailed edits** (edit AI output as your own content).
- **G9-C Undo automated actions** (say what the AI changed, plus a way to reverse it).
- **G9-D Do G9 through G15** (a correction also counts as feedback).
- **G9-E Batch-editing data** (one fix offered across similar items).
- Common pitfall: if correction is frequent, let users disable the feature (G17).
- https://www.microsoft.com/en-us/haxtoolkit/guideline/support-efficient-correction/

**Corrections** (AHIG-ML): familiar correction tools; immediate value; persist corrections; let users correct the correction; prefer **guided corrections** (suggested alternatives) to freeform. https://developer.apple.com/design/human-interface-guidelines/machine-learning

**Revert to AI** (CB): once a user edits AI content, AI styling and the label drop away and an icon-only **revert** button appears; activating it restores the AI version. https://carbondesignsystem.com/components/ai-label/usage/

**Response regeneration** (CS):
- A refresh icon in the message's button group, only on user-initiated responses.
- Regenerating replays the same input and drops later messages.
- Allowed after a stop or after completion. Stop must have zero friction.
- https://cloudscape.design/gen-ai/patterns/response-regeneration/

**Regenerate** (SoAI): overwrite (cycle through past versions) vs branch; guided vs random. Past results must be recoverable. https://www.shapeof.ai/patterns/regenerate

**Branches** (SoAI): "Branch" on message actions; a summary of inherited context; non-destructive merge. https://www.shapeof.ai/patterns/branches

**Checkpoint** (AIE): a bookmark row plus restore trigger plus separator; restoring cuts the conversation back to that point. https://elements.ai-sdk.dev/components/checkpoint

**Allow user to edit outputs** (MSL). **Withhold outputs when necessary** (MSL, see section 9).

**Provide global controls** (HAX G17): users globally customize what the AI monitors and how it behaves. This applies directly to Compass watcher agents. https://www.microsoft.com/en-us/haxtoolkit/guideline/provide-global-controls/

**Offer control over the AI experience** (PAIR chapter "Feedback + Controls"). https://pair.withgoogle.com/guidebook/chapters/feedback-and-controls

**Let users supervise automation** (PAIR): users can override and take back control; knowing that they can builds comfort even if they rarely use it. https://pair.withgoogle.com/guidebook/patterns#let-users-supervise-automation

**Automate more when risk is low** (PAIR): automate heavily when stakes are low, give more control when they're high. https://pair.withgoogle.com/guidebook/patterns#automate-more-when-risk-is-low

**An agent should respect requests to disengage** (LIN): it stops immediately and resumes only on an explicit signal. https://linear.app/developers/aig

**Give the user control / don't let AI take control autonomously** (GL): undo, pause, cancel, or modify running flows; a review step before high-risk actions. https://design.gitlab.com/patterns/ai-human-interaction

**Memory** (SoAI) (section 10) and **Voice and tone** (SoAI, "Using: Team Brand Voice" label, reset to default).

---

## 7. Human-in-the-loop and approval (action proposals)

**User authorized actions** (CS, published 2025-08, updated 2026-09). The most concrete published approval spec.

Key concepts:
- Match authorization to risk.
- Reduce repeated friction (scoped trust).
- Communicate consequences: reversibility, failure impact, long-term impact.
- Keep users in control (scoped access, full access, or exit).
- **Record the outcome** in the transcript.

Anatomy of the authorization dialog, **docked above the prompt input**:
- Title "Allow `tool`?" or "Allow this command?"
- Optional description.
- Optional command body in a code block.
- Expandable "Request details".
- **Scope selector**: Allow this time / Allow for this chat / Always allow.
- Buttons: Cancel / Allow, plus Skip and pagination for bulk requests.
- Close button always present.

Variants:
- **One-time authorization**: "Approve deployment to production?" with key-value facts and Reject / Approve. **This is the template for Compass rate or price change proposals.**
- **Irreversible action**: "type 'confirm'" input or a warning alert listing affected resources (one or the other, not both). Afterwards the agent reports what was deleted or kept.

Resolved-state labels: "Approved", "Rejected", "Approved automatically", "Request expired". Expiry copy: "This request expired. Nothing was deployed."

Anti:
- Pre-selecting or auto-focusing Approve on risky operations.
- A loading or success state inside the dialog (the resolved state belongs in the conversation).
- Re-asking for an already-trusted tool.
- A pending request that blocks the UI forever.
- A scope selector when preferences can't persist.
- On Cancel, the agent must acknowledge ("Got it, skipping that step.").

https://cloudscape.design/gen-ai/patterns/user-authorized-actions/

**Verification** (SoAI):
- Match friction to risk (loss of reputation, money, security, work, or time means verify by default).
- Opt-out allowed, and the opt-out state is made visible.
- **Alert the user when their action is needed** (push to Slack or email).
- https://www.shapeof.ai/patterns/verification

**Action plan** (SoAI):
- Advisory vs **contractual** (blocks until approved).
- Variants: step lists, execution previews, content outlines, adaptive plans.
- Rules: show the plan before committing resources; keep it skimmable; editable per step (no full regeneration for one fix); collapsible or bypassable for experts; **plan-execution fidelity** (explain deviations).
- https://www.shapeof.ai/patterns/action-plan

**Sample response** (SoAI): run a sample (first rows) before the full batch; show cost and time; show it next to existing records rather than overwriting. https://www.shapeof.ai/patterns/sample-response

**Confirmation** (AIE): an alert-style approval component. States: approval-requested (request plus actions), approval-responded / output-denied / output-available (Accepted or Rejected content). https://elements.ai-sdk.dev/components/confirmation

**Plan** (AIE) https://elements.ai-sdk.dev/components/plan ; **Question** (AIE) https://elements.ai-sdk.dev/components/question

**Consider consequences and get permission before performing irreversible or potentially problematic tasks** (AHIG-GenAI): avoid automating destructive or hard-to-undo actions (purchases, deletion); ask for confirmation before significant actions.

**Feedforward: convey the consequences of user actions before the user takes action** (HAX G16-A): describe or preview the impact. **Very severe means a modal**; lower stakes means a non-interrupting indicator. Pairs with **G16-B Feedback (after)** and **G16-C Remind of consequences of a past action and ask for reconfirmation**. https://www.microsoft.com/en-us/haxtoolkit/pattern/g16-a-feedforward-convey-the-consequences-of-user-actions-before-the-user-takes-action/

**Intent Preview** (SM-A, cross-ref: SoAI Action plan + CS one-time authorization):
- Plan title, numbered steps (bold action plus plain-language outcome).
- Buttons **"Proceed with this Plan" / "Edit Plan" / "Handle it Myself"**.
- Anti: approve/reject only, with no edit or take-over path; jargon; a notification with no controls.
- https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/

**In-flow user input** (CS):
- Inline forms in the conversation when the agent needs values to *execute* (at most 5 fields, pre-filled from context, no optional fields).
- Sequential cards ("1 of 3") collapse to a read-only summary when complete.
- Inline-edit icon on agent-created values.
- Anti: using forms to clarify *intent* (use follow-up questions).
- https://cloudscape.design/gen-ai/patterns/in-flow-user-input/

**Disambiguate before acting** (HAX G10-A):
- Clarifying question or select-from-options when confidence falls between thresholds; most probable option first; let users request new options.
- Anti: endless clarification loops; interrupting when confidence is high.
- https://www.microsoft.com/en-us/haxtoolkit/pattern/g10-a-disambiguate-before-acting/

**Follow-up questions** (CS):
- Sequential predefined choices in a **dismissible dialog docked above the prompt input** when context is needed up front; support prompt group to narrow a broad answer.
- At most 5 questions; most likely option first; always allow free text; never ask for data the system can fetch.
- https://cloudscape.design/gen-ai/patterns/follow-up-questions/

**Follow up** (SoAI): conversation extenders, clarifying questions, depth probes, comparisons, action nudges, share or export. Anchor them in the last answer; keep the list short; separate visually from the answer. https://www.shapeof.ai/patterns/follow-up

**Escalation Pathway** (SM-A, cross-ref HAX G10-A, G10-C): clarify, offer options, or hand off to a human instead of guessing confidently.

---

## 8. Agents and background work (watchers, briefings, long runs)

**Flows: states and status communication** (GL "Duo agents and flows"). The most complete published state model for background agents:
- States: **Created/started, Running, Awaiting user input, Paused, Resumed, Completed, Failed, Cancelled.**
- Each state appears in 4 places: activity timeline comment, **session panel** (live log, audit trail), **sessions indicator** (persistent status chip), and notifications.
- Approvals: Approve / Deny / Modify in the session panel plus an @mention plus a high-priority to-do.

Notification rules:
- Toast on start.
- High-priority to-do when input is needed or on failure (Retry / Get Help).
- Dismissable to-do on completion.
- **No notifications during normal running or on resume.**

Other rules:
- Update the initial comment; don't replace it.
- Failed and cancelled sessions keep their logs and partial results.
- No resume after cancel.

https://design.gitlab.com/patterns/duo-agents-and-flows

**Agent management** (CS, 2026-06):
- An agents page with search and filters and an "Add agent" button.
- **Agent card**: avatar plus label plus **source**, enable toggle, description, capability badges, **scope**.
- Permissions explicit and editable, not buried in setup.
- Anti: auto-disabling or deleting an agent without explicit user action.
- https://cloudscape.design/gen-ai/patterns/agent-management/

**Timeline overview** (CS, 2026-06):
- **Event log**: timestamp column, status icon, past-tense labels ("Created environment: X"), day dividers (Today, Yesterday, date), filter.
- **Conversation overview**: anchor-link list into a long chat.
- https://cloudscape.design/gen-ai/patterns/timeline-overview/

**Agent Interaction Guidelines** (LIN):
1. "An agent should always disclose that it's an agent."
2. "…inhabit the platform natively" (same actions as humans; shows in the normal activity feed).
3. "…provide instant feedback."
4. "…be clear and transparent about its internal state" (thinking, waiting for input, executing, finished; an Agent Session view with steps and tool calls).
5. "…respect requests to disengage."
6. "An agent cannot be held accountable" (show the responsible human next to the agent).

https://linear.app/developers/aig

**UX design for agents** (MSD):
- Space: "Connecting, not collapsing"; "Easily accessible yet occasionally invisible".
- Time: Past (reflect on history), **Now: "nudging more than notifying"**, Future (adapt).
- Core: "Embrace uncertainty but establish appropriate trust"; "Transparency, control, and consistency".
- **Background agents need a user-facing dashboard, settings, or log to view and control their actions.**
- Respect Do Not Disturb.
- https://microsoft.design/articles/ux-design-for-agents/

**Time services based on context** (HAX G3) / **Show contextually relevant information** (HAX G4): decide when to interrupt based on the user's task and attention; pair with G17 global controls. Timing rules for the briefing and alerts. https://www.microsoft.com/en-us/haxtoolkit/guideline/time-services-based-on-context/

**Proactive or reactive** (AHIG-ML): proactive features get less patience for mistakes. "Be especially careful to avoid mistakes in proactive features." https://developer.apple.com/design/human-interface-guidelines/machine-learning

**Make workflows proactive** / **Keep the flow state** / **Always accelerate responsibly** (ATL): anticipate; controls live in the working surface; state carries across devices; when work is delegated, communicate risks, options, and chances to course-correct. https://atlassian.design/rovo-ui/ai-interaction-guidelines

**Shared vision** (SoAI): ambient cues that the AI is active (a glow on the surface it's working in); take-over control; scope boundaries visible; screenshots in the stream of thought for audit. https://www.shapeof.ai/patterns/shared-vision

**Action Audit & Undo** (SM-A, cross-ref HAX G9-C, CS Timeline overview):
- Chronological log of agent actions with status (success, in progress, undone) and an undo per action.
- Time-limited undo stated explicitly ("Undo available for 15 minutes").
- Anti: undo on some actions only; hiding when an action becomes irreversible.

**Explainable Rationale** (SM-A, cross-ref HAX G11-A/E): "Because you said X, I did Y"; a "Why I took this action:" section plus "Undo this Action".

**Autonomy Dial** (SM-A, cross-ref PAIR Automate in phases, SoAI Parameters "autonomy as a parameter"):
- Levels: Observe & Suggest / Plan & Propose / Act with Confirmation / Act Autonomously, set **per task type**.
- Start new users low.
- Anti: a single global toggle.

**Designing For Partial Success** + **Disentangling The Tool** (SM-T, cross-ref CS Progressive steps independent-step errors):
- Per-sub-task status with a reason ("No inventory").
- Name the failing external service ("Google Calendar connection…") and the retry plan.
- Anti: a big "Request Failed" banner for a mostly successful task.

**Agent / Task / Queue / Plan** (AIE): standard components for agent config, task status rows, queued work, and multi-step plans. https://elements.ai-sdk.dev/

**Agents vs Flows naming and identity** (GL): agents (conversational, inside chat) vs flows (autonomous, repeatable, triggered from objects), each with a unique avatar, handle, and action-oriented name ("Security Triage Flow").

**Morning briefing: no single canonical "briefing" pattern exists in these sources.** Compose it from canon:
- SoAI **Summary** (scope, presets, citations).
- SoAI **Synthesis** (evidence vs interpretation, uncertainty).
- SoAI **Follow up** / CS **Support prompts** (next questions).
- HAX **G3/G4** (timing and relevance).
- MSD "nudging more than notifying".
- AHIG-ML proactive-mistake caution.
- SoAI **Disclosure** label ("Summarized with AI").

Don't market it as a new pattern.

---

## 9. Errors, failure, recovery

**Be accountable for errors** (PAIR): plan for errors from the start. Remedies: explanation, manual controls, support. https://pair.withgoogle.com/guidebook/patterns#be-accountable-for-errors

**Give control back to the user when automation fails** (PAIR): tell the user what happened, what to do next, and how to take the next action; route to a human when stakes are high. https://pair.withgoogle.com/guidebook/patterns#give-control-back-to-the-user-when-automation-fails

**Provide paths forward from failure** (PAIR chapter "Errors + Graceful Failure"; worksheets in library/). https://pair.withgoogle.com/guidebook/chapters/errors-and-graceful-failures

**Fall back to other strategies** (HAX G10-C): fall back to a simpler automated path or to a human. Announce the handoff with time to react. Anti: unclear, late hand-off signals; unclear how to take over. https://www.microsoft.com/en-us/haxtoolkit/pattern/g10-c-fall-back-to-other-strategies/

**Scope services when in doubt** (HAX G10): disambiguate or gracefully degrade under uncertainty. https://www.microsoft.com/en-us/haxtoolkit/guideline/scope-services-when-in-doubt/

**Help people improve requests when blocked or undesirable results occur** (AHIG-GenAI): coach toward success ("Unable to use that description") and offer example requests. If something fails, say what happened in plain language and give a clear next step.

**Mistakes** (AHIG-ML): anticipate; match corrective tools to the seriousness of the mistake; correct easily.

**Fail gracefully** (GL): always a non-AI path forward; explain why there was no recommendation; offer retry or manual fallback. https://design.gitlab.com/patterns/ai-human-interaction

**Ensure a great experience even when generative features aren't available** (AHIG-GenAI): non-AI fallback. Compass: dashboards must work with the AI down.

**When it can't help, say so plainly** (NNg "Less Chat, More Answer"): no padding; the "can't do X, can do Y" message goes first. https://www.nngroup.com/articles/less-chat-more-answer/

**Withhold outputs when necessary** (MSL): pre-written disengage or redirect responses ("please try a different topic").

**Error state** (CS Generative AI chat): an error alert in the conversation with a recovery action ("Try again"); error types are access denied, server, and connection. **Expired request** state (CS User authorized actions).

**Connectors: graceful degradation** (SoAI): "Notion token expired" plus Retry / Reconnect / Attach manually; never a blank state that implies success.

**Make broken or missing citations explicit** (SoAI Citations and References).

**Filters: design for recovery** (SoAI): an empty-result state offering to relax constraints. https://www.shapeof.ai/patterns/filters

---

## 10. Feedback and learning over time

**Encourage granular feedback** (HAX G15):
- **G15-A Encourage explicit feedback on individual system outputs** (user-initiated; thumbs, scale, or text; confirm receipt and explain how it's used).
- **G15-B Request explicit feedback on selected outputs** (system-initiated, sparingly).
- **G15-C Reporting inappropriate content.**
- **G15-D Use existing public rating or interaction data.**
- https://www.microsoft.com/en-us/haxtoolkit/pattern/g15-a-encourage-explicit-feedback-on-individual-system-outputs/

**Let users share feedback on outputs** (AHIG-GenAI) / **Explicit feedback** and **Implicit feedback** (AHIG-ML):
- Voluntary.
- Thumbs up and down plus optional detail.
- Option labels that describe consequences ("Show fewer…", not "Dislike"); icons are not enough on their own.
- **Act immediately and persist.**
- For implicit feedback: don't narrow exploration; prioritize recent signals; withhold sensitive suggestions.

**Let users give feedback** (PAIR): thumbs, hide, flag, or form; acknowledge receipt and explain the system's response. https://pair.withgoogle.com/guidebook/patterns#let-users-give-feedback

**Feedback on generative AI responses** (CS copy):
- Tooltips "Helpful" / "Not helpful".
- States "Submitting feedback" then "Feedback submitted".
- Disabled-reason text after submission.
- Optional additional-feedback form.
- https://cloudscape.design/gen-ai/patterns/generative-ai-chat/

**Encourage feedback** (GL): implicit plus explicit, without interrupting; unobtrusive cues. **Duo feedback** pattern: https://design.gitlab.com/patterns/duo-feedback

**Convey the consequences of user actions** (HAX G16): G16-A feedforward, **G16-B feedback** (confirm the system registered it), G16-C remind and reconfirm, G16-D docs.

**Remember recent interactions** (HAX G12), **Learn from user behavior** (HAX G13), **Update and adapt cautiously** (HAX G14):
- **G14-A Comprehensive updates.**
- **G14-B Immediate, partial, non-disruptive updates**: a small local change at the edge of attention, with a subtle cue against change blindness.
- Relevant for dashboards that re-rank after feedback.
- https://www.microsoft.com/en-us/haxtoolkit/pattern/g14-b-immediate-partial-non-disruptive-updates/

**Notify users about changes** (HAX G18): announce new or updated capabilities. Also AHIG-ML "tell people when limitations are resolved".

**Memory** (SoAI):
- Memory is never a black box: show when something is saved (a "Saved to memory" chip); make it editable and deletable; offer one-step reset.
- Scoped vs global vs ephemeral.
- https://www.shapeof.ai/patterns/memory

**Conversational history** (CS):
- Title "Conversations" with a count.
- Grouped Today / Yesterday / Past 7 days, then absolute dates.
- Item title from the first user message; timestamp with a full-time tooltip; delete and share actions.
- History (user-facing) is distinct from memory (AI-facing).
- https://cloudscape.design/gen-ai/patterns/conversational-history/

---

## 11. Identity, disclosure, labeling

**Disclosure** (SoAI):
- Name the actor every time.
- **Label the action, not just the feature** ("Summarized with AI").
- A distinct, AI-only style.
- Don't fake human interaction.
- https://www.shapeof.ai/patterns/disclosure

**Generative AI output label** (CS): "Generated by AI" with the sparkle, close to the output; reserved for generative output only. Anti: labeling every item in an all-AI list (label the group header instead). https://cloudscape.design/gen-ai/patterns/generative-ai-output-label/

**AI label** (CB):
- "AI" indicator plus explainability popover.
- Default and inline variants.
- Placement rules: containers top-right; inputs right side; **data tables by scope** (whole table: header top-right; column: column header far right; row: far left; cell: inline left).
- Visibility: focused / broad / both.
- Anti: decorative use; using it as a trigger for "regenerate"; disabling it.
- **Directly applicable to AI-filled KPI tables.**
- https://carbondesignsystem.com/components/ai-label/usage/

**AI presence styling** (CB): light, glow, or gradient tokens, with "Light spread is limited for readability". Used only to mark AI, never as decoration. https://carbondesignsystem.com/guidelines/carbon-for-ai/

**Communicate where your app uses AI** (AHIG-GenAI): never trick people into thinking content or interaction is human.

**Be transparent** + **Keep UI text consistent** (GL):
- Disclaimer "[Verb] by AI" under the content, once per context.
- Verification message "Verify before use."
- Third-person voice in UI text, first person only in agent replies.
- No "AI" or product name inside CTA labels.

**Human in control: "Summarize with copilot", not "copilot, summarize"** + **Avoid anthropomorphizing** (MSL): avoid "understand/think/feel"; prefer "processing/analyzing"; keep personality light.

**Ingress** (CS):
- Sparkle on AI action buttons.
- Standalone sparkle = AI is the function; integrated sparkle = AI enhances a familiar function.
- One primary button per page (use a secondary AI button otherwise).
- Don't overuse.
- Terminology: "AI assistant"; replies are "responses", not "answers".
- https://cloudscape.design/gen-ai/patterns/ingress/

**The Proliferation and Problem of the ✨ Sparkles ✨ Icon** (NNg): sparkles are ambiguous, so pair them with text labels. Also SoAI **Iconography**: pair icons with text; don't overload one symbol. https://www.nngroup.com/articles/ai-sparkles-icon-problem/ , https://www.shapeof.ai/patterns/iconography

**Name / Avatar / Color / Personality** (SoAI Identifiers):
- Name: entity-style ("Assistant") or technology label, never mistakable for a human.
- Avatar: communicates state (listening, generating), anchors identity, avoids deceptive realism.
- Color: an affordance, never color alone (accessibility).
- Personality: guard against sycophancy; separate empathy from authority.
- https://www.shapeof.ai/patterns/name , `/avatar`, `/color`, `/personality`

**Match relevant social norms** (HAX G5), **Mitigate social biases** (HAX G6); **Ensure an inclusive experience for all** (AHIG-GenAI).

---

## 12. Privacy, data, consent

- **Ask permission before using personal information and usage data** + **Clearly disclose how your app and its model use and store personal information** (AHIG-GenAI). Also: choose the model type, on-device vs server, with privacy in mind.
- **Be transparent about privacy and data settings** (PAIR): ask early, remind over time. https://pair.withgoogle.com/guidebook/patterns#be-transparent-about-privacy-and-data-settings
- **Data ownership** (SoAI): default to privacy; separate training from retention; state the default in the UI. https://www.shapeof.ai/patterns/data-ownership
- **Consent** (SoAI): opt-in; consent types kept separate; revocable. https://www.shapeof.ai/patterns/consent
- **Incognito Mode** (SoAI): an unmistakable persistent indicator; connectors limited in scope. https://www.shapeof.ai/patterns/incognito-mode
- **Handle Personal Data Carefully** (NNg, Qwen agent lessons). https://www.nngroup.com/articles/designing-ai-agents/
- Guest PII in a hotel app: the authorization dialog must state any data sharing (CS "Communicate consequences").

---

## 13. Mobile and multi-surface

There is no dedicated "AI on mobile" canon in these sources. Use these explicit statements:

- **OAI mobile**:
  - Inline cards grow up to the display height.
  - Inline UI renders *before* the model's text.
  - In fullscreen, the composer stays at the bottom with a truncated reply snippet that opens the chat sheet.
  - The composer shimmers while streaming.
  - PiP is fixed to the top.
  - Platform fonts.
  - https://developers.openai.com/apps-sdk/concepts/ui-guidelines
- **CS Generative AI chat**: in constrained or side-panel surfaces, align messages to one side; **pin the composer**; only the log scrolls.
- **NNg**:
  - Keep the chatbot accessible across pages (guideline 2).
  - Don't autoscroll (7).
  - Resize or maximize (8).
  - Voice input (10).
  - The truncated-pyramid rule for small viewports (Less Chat, More Answer).
- **MSD**: agents discoverable and usable on any device; foreground and background switching; multimodal input and output with the active modes visible.
- **ATL "Keep the flow state"**: tasks and state carry across interfaces and devices.
- **SoAI Consent**: multimodal indicators (light, sound, vibration) when screens aren't visible.
- **AHIG-GenAI**: no extra per-platform considerations; follow Loading guidance and run generation in the background.
- **MSL**: offer voice plus text ("multimodal design").

---

## 14. Behaviors to design against (research findings, not patterns to build)

- **Accordion editing**: users repeatedly shrink and expand outputs to reach one goal.
- **Apple picking**: users reference earlier responses in the next prompt, which causes heavy scrolling.

Both come from NNg (Gibbons, Mugunthan, Nielsen): https://www.nngroup.com/articles/accordion-editing-apple-picking/ . Mitigations from canon: SoAI Inline Action, Restructure, Branches; CS Timeline overview (conversation overview anchors); MSL "Keep a history of outputs and prompts"; AIE Checkpoint.

- **AI articulation barrier**: users can't express intent in prose. https://www.nngroup.com/articles/ai-articulation-barrier/ . Mitigations: Suggestions, Templates, Prompt controls, Follow-up questions.
- **Overtrust from citations**: users rarely click citations (NNg Explainable AI).
- **Unfaithful step-by-step reasoning**: don't present reasoning as proof (NNg Explainable AI).
- **Agent slowness and shaky inquisitiveness**: an agent should ask early about critical constraints (NNg "Initial Impressions of ChatGPT's Agent"). https://www.nngroup.com/articles/impressions-chatgpt-agent/

---

## 15. Compass feature to canon map (composition only)

| Compass need | Use these canon patterns (and only these) |
|---|---|
| Assistant panel (desktop) | MSL Assistive focus + Embedded entry on charts; CS Generative AI chat (pinned composer, one-side alignment in a side panel); NNg accessible across pages; CS Conversational history |
| Assistant (phone) | OAI fullscreen + inline cards; CS pinned composer; NNg truncated pyramid and no autoscroll; voice input (NNg 10) |
| First run | HAX G1-A blurb + G1-D clickable inputs; NNg informative opening message tailored to page; SoAI Contextual CTA; HAX G2-D low-performance alert when data is sparse |
| Asking questions | SoAI Suggestions / CS Support prompts (editable with `<variables>` vs send-now); NNg buttons-not-text follow-ups; CS Follow-up questions dialog above input; HAX G10-A disambiguation |
| Waiting | CS Loading states ("Loading occupancy for last 30 days"); CS Thinking (collapsed in chat); CS Progressive steps for multi-query; SoAI Controls (stop); AHIG specific feedback |
| Charts and tables in chat | AISDK tool to component with per-state rendering; OAI inline card rules (2 actions max, no nested scroll, no tabs); CS Artifact previews (inline vs canvas panel, actions in the artifact card); CB AI label on tables by scope; SoAI Disclosure "Generated by AI"; HAX G2-B numeric precision |
| Numbers you can trust | SoAI Citations / References (deep link to the source report or row); NNg citation rules; SoAI Synthesis (evidence vs interpretation, uncertainty cues); HAX G11-D/G "what if"; CB explainability popover |
| Action proposals (rate change, overbooking, email) | CS User authorized actions (one-time authorization, resolved states, no autofocus on Approve, expiry); SoAI Action plan (editable, contractual) + Verification (friction matches risk); HAX G16-A feedforward; AHIG confirm significant actions; AIE Confirmation; SM-A Intent Preview buttons (Proceed / Edit / Handle it myself) |
| After the action | HAX G9-C Undo automated actions; CB Revert to AI; SM-A Action Audit & Undo (stated undo window); CS Timeline overview event log; LIN "cannot be held accountable" (show the approving human) |
| Morning briefing | SoAI Summary + Synthesis + Follow up; HAX G3/G4 timing; MSD nudging over notifying; AHIG-ML proactive-mistake caution; GL "[Verb] by AI" disclaimer; HAX G15-A per-item feedback |
| Metric-watching agents | CS Agent management (card: identity, source, toggle, capabilities, scope); GL flow states + 4 status surfaces + notification rules; HAX G17 global controls; MSD background agents need a dashboard or log; LIN disclose, instant feedback, internal state, disengage; PAIR precision/recall tradeoff for alert thresholds; SM-A Autonomy Dial per task (cross-ref PAIR Automate in phases) |
| Errors | CS error alert plus Try again; SM-T Disentangling the tool + Partial success (cross-ref SoAI Connectors degradation); PAIR give control back; GL fail gracefully (non-AI path); AHIG non-AI fallback |
| Feedback | CS thumbs copy and states; AHIG consequence-based labels; HAX G15-A, G16-B |

---

## 16. Library (downloaded, official, free; nothing executed)

Path: `/Users/razvan/Web/compass-mvp/docs/research/ai-ux/library/`

| File | Publisher | Source URL |
|---|---|---|
| microsoft-hax-18-guidelines-poster.pdf | Microsoft HAX | https://www.microsoft.com/en-us/haxtoolkit/uploads/2021/05/AI-Guidelines-poster_nogradient_final.pdf |
| microsoft-hax-guidelines-cards-2019.pdf | Microsoft HAX (guideline cards) | https://www.microsoft.com/en-us/haxtoolkit/uploads/2021/05/AI-Design-guidelines_041519.pdf |
| microsoft-guidelines-for-human-ai-interaction-chi2019.pdf | Microsoft Research (Amershi et al., CHI 2019) | https://www.microsoft.com/en-us/research/wp-content/uploads/2019/01/Guidelines-for-Human-AI-Interaction-camera-ready.pdf |
| google-pair-worksheets-user-needs-and-defining-success.pdf | Google PAIR | https://pair.withgoogle.com/guidebook/assets/worksheets/user-needs-and-defining-success/combined-worksheets-user-needs-and-defining-success.pdf |
| google-pair-worksheets-mental-models-and-expectations.pdf | Google PAIR | …/mental-models-and-expectations/combined-worksheets-mental-models-and-expectations.pdf |
| google-pair-worksheets-trust-and-explanations.pdf | Google PAIR | …/trust-and-explanations/combined-worksheets-trust-and-explanations.pdf |
| google-pair-worksheets-errors-and-graceful-failure.pdf | Google PAIR | …/errors-and-graceful-failure/combined-worksheets-errors-and-graceful-failure.pdf |
| google-pair-guidebook-workshop-slides.pdf | Google PAIR | https://pair.withgoogle.com/guidebook-v2/workshop/Guidebook-Workshop-Slides.pdf |
| google-pair-guidebook-workshop-facilitator-guide.pdf | Google PAIR | https://pair.withgoogle.com/guidebook-v2/workshop/Guidebook-Workshop-Facilitator-Guide.pdf |

Not downloadable as PDF (web-only, read online): PAIR Guidebook chapters themselves; Apple HIG; Shape of AI; Cloudscape; Carbon; GitLab Pajamas; NNg articles. HAX also offers a free Workbook (.xlsx/.pptx), not downloaded: https://www.microsoft.com/en-us/haxtoolkit/workbook/

---

## 17. Recommended books (paid; not downloaded)

| Title | Author(s) | Year / publisher | Where to buy |
|---|---|---|---|
| UX for AI: A Framework for Designing AI-Driven Products | Greg Nudelman | 2025, Wiley | https://uxforai.com/c/book ; O'Reilly https://www.oreilly.com/library/view/ux-for-ai/9781394345922/ |
| Sentient Design: Crafting Intelligent Interfaces with AI | Josh Clark, Veronika Kindred | 2026 (June 9), Rosenfeld Media | https://rosenfeldmedia.com/books/sentient-design/ |
| Designing Agentic AI Experiences: UX Strategies for Collaborative, Human-Centred AI | Victor Yocco (author of SM-A) | 2026/2027, CRC Press / Routledge (ISBN 9781041237266) | https://www.routledge.com/Designing-Agentic-AI-Experiences-UX-Strategies-for-Collaborative-Human-Centred-AI/Yocco/p/book/9781041237266 |
| Designing Human-Centric AI Experiences: Applied UX Design for Artificial Intelligence | Akshay Kore | 2022, Apress | Apress / Springer Link, major booksellers |
| AI and UX: Why Artificial Intelligence Needs User Experience | Gavin Lew, Robert M. Schumacher Jr. | 2020, Apress | Apress / Springer Link |
| Designing Agentive Technology: AI That Works for People | Christopher Noessel | 2017, Rosenfeld Media | https://rosenfeldmedia.com |
| Conversations with Things: UX Design for Chat and Voice | Diana Deibel, Rebecca Evanhoe | 2021, Rosenfeld Media | https://rosenfeldmedia.com |
| Human-Centered AI | Ben Shneiderman | 2022, Oxford University Press | OUP, major booksellers |
| AI in UX Design | (O'Reilly listing, July 2026; verify author before buying) | 2026, O'Reilly | https://www.oreilly.com/library/view/ai-in-ux/9781807787592/ |

Note: Emily Campbell's "The Shape of AI" is a website plus Substack (https://shapeofai.substack.com/), not a book (no book found as of 2026-11).

---

## 18. Gaps and cautions

- **No canonical "morning briefing", "KPI anomaly alert", or "AI-generated chart" pattern** exists as a named pattern in any primary source. Build them only by composing the patterns in section 15.
- Atlassian's pattern pages (message card, generative border) are partly staff-only; only the 8 guidelines are public. Fluent 2 has no public AI page (404). Copilot guidance lives on MS Learn (MSL).
- The AI Elements site says it moves to shadcn/ui and deprecates in late Nov 2026. Use its component *inventory* as evidence of standard patterns; Spartan (shadcn-for-Angular) ports should mirror those names (Conversation, Message, Prompt Input, Suggestion, Reasoning, Tool, Confirmation, Plan, Queue, Task, Sources, Inline Citation, Checkpoint, Context, Shimmer, Artifact).
- SM-A and SM-T are single-author practitioner articles from 2026. Each pattern used from them is cross-referenced to a primary source; prefer the primary pattern's name in the UI spec.
- HAX patterns exist only for G1, G2, G9, G10, G11, G14, G15, G16. The other 10 guidelines have no published pattern.
