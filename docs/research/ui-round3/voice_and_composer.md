# Voice mode and the ask bar (UI research, round 3)

Collected 2026-11-20 for Compass. The user rejected the current ask bar: a rotating conic-gradient border with a blurred glow at rest, and a flat bar waveform while listening. They called it "too much / exaggerated" and asked for "something 3D with an effect that reacts to the voice" while they speak.

Labels used below:

- **[seen]**: observed in a Mobbin screenshot (linked).
- **[measured]**: pixel-measured from Mobbin's high-resolution screenshot (method in A.1).
- **[code]**: read in the source code (repo and file named).
- **[doc]**: vendor documentation, help centre, official blog, design site or release notes.
- **[press]**: a press report.
- **[inferred]**: my reading; not confirmed by a source.

---

## TL;DR

1. **The best composers are quiet at rest.** The surface is one step lighter than the page, with a hairline border or none, and nothing moves. None of the 23 composers examined on Mobbin has a gradient or animated border, at rest or on focus. Colour shows up in only four places: the send button, a static single-hue focus ring (Perplexity, Upwork), a short "thinking" light sweep (Origin), and Gemini's ambient glow on the *page* behind the composer.
2. **Focus is usually just the caret.** Claude, Gemini, ChatGPT and Notion look the same focused as at rest. Where focus is drawn, it is a static 1 px brand-tinted border with a soft ring.
3. **Voice has moved into the conversation and shrunk.**
   - ChatGPT has run voice inside the thread since Nov 2025, with a small orb docked above the composer and the live transcript in the chat; full screen is an opt-in "Separate Voice".
   - Gemini Live (2026) replaced its full screen with a **pill holding a blue waveform** in place of the prompt box.
   - Siri in iOS 27 dropped the full-screen edge glow for a **small dark Liquid Glass orb** that "pulses slightly" while its waveform "reacts in real-time".
   - Claude's mobile voice screen uses a bottom glow that changes colour by state: blue while listening, terracotta while speaking.
   - ElevenLabs and Perplexity use orbs: a shaded disc and a particle sphere.
   - Microsoft removed its Mico character from Copilot voice in Aug 2026.
4. **What reacts to the voice** is mostly *scale* plus *internal motion speed*, sometimes rim brightness. The silhouette barely deforms. ElevenLabs' open-source Orb maps mic volume to ring radius and opacity, and the agent's output volume to flow distortion and speed ([code], below).
5. **Recommendation for Compass:**
   - Make the bar calm: 56 px tall, 12 px radius, `#1E2429` fill, hairline border, and a purple 1 px focus border. No gradient on the edge.
   - When the mic is pressed, expand the bar **in place** into a voice panel. It holds a **small WebGL "Kassandra orb"** (a fragment-shader sphere with simplex-noise flow and an iridescent fresnel rim in the Kassandra gradient) that reacts to the mic level, plus the live transcript and Cancel / Send.
   - Use no libraries: roughly 150 lines of GLSL and TypeScript, plus the MIT simplex-noise function. A working prototype of the shader is in B.4.

---

## Part A: the composer at rest and focused

### A.1 Method

- The composers come from Mobbin. They are web screens unless marked iOS.
- Mobbin's web screenshots are 1920 px wide captures of a **1440 px viewport**. I checked the scale on ChatGPT: the capital "A" of its 16 px placeholder is 15 px tall in the image, which is 11.25 CSS px, the cap height of a 16 px font.
- **Heights** come from 1 px colour profiles taken through blank parts of each composer, so text and icons are not counted. They are reported in CSS px.
- **Radii** are estimated from the corner offset and checked by eye, to about ±3 px.
- Images: the high-resolution files were downloaded to the session scratchpad. They are temporary.

### A.2 Anatomy, product by product

| Product | Layout | Height | Radius | Surface and edge | Shadow | Left | Right when empty | Right when typed / running | Focus |
|---|---|---|---|---|---|---|---|---|---|
| [ChatGPT](https://mobbin.com/screens/9729b1c4-e00e-48c9-96dd-9cb6731faaac?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | 1 row. Becomes 2 rows when a tool or long text is added ([Think](https://mobbin.com/screens/efb593c5-be61-47d5-a2bd-87aab6056cd2?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)) | ≈55 (1 row), ≈100 (2 rows) [measured] | full pill; 2 rows keep ≈28 | white, 1 px hairline ≈#DDD | short, soft, ≈4 px below | bare `+` | mic glyph, then a **36 px black circle** holding the voice-mode waveform glyph | 36 px black circle ↑ ([typed](https://mobbin.com/screens/c3f1aa21-87cc-4212-919d-7e9e8337ce5e?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)); ■ while generating ([seen](https://mobbin.com/screens/fc303bbc-5d5f-4ffc-b3ce-065abc9693bc?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)) | no visible change |
| [ChatGPT temporary chat](https://mobbin.com/screens/ce88ac1e-b781-421c-9507-ccc00cd972da?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | 1 row | ≈55 | pill | **inverted: #303030 fill, no border** [measured] | soft | `+` | mic + white circle | n/a | n/a |
| [Claude](https://mobbin.com/screens/33b8745d-b1f7-405b-aa9c-a50c06e44ab4?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | 2 rows: text above a toolbar | ≈118 [measured] | ≈16–20 | white on #FAF9F5, 1 px ≈#E3E3E3 | none or faint | bare `+` | model "Sonnet 4.6 ⌄" as text, plus a grey waveform glyph with no fill | model text + **32 px terracotta rounded square ↑** (≈8 px radius) ([typed](https://mobbin.com/screens/e8c0af18-6e3a-4273-93c1-935e958ff8b3?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)) | no visible change |
| [Perplexity](https://mobbin.com/screens/58f502ea-7ea8-4636-be0d-929177acc49f?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | 2 rows | ≈114 [measured] | ≈10–12 | warm white #FFFBF8, 1 px ≈#CDCDCD | soft, below | `+`, segmented "Search ⌄ / Computer" | "Model ⌄", mic glyph, 32 px near-black circle (voice mode) | n/a | **[Computer home](https://mobbin.com/screens/c6aa333c-fa93-4120-8cb7-d9fc11bcf6a2?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp): teal-grey 1 px border + soft teal outer glow** [seen; reading it as the focus/active state is inferred] |
| [Gemini](https://mobbin.com/screens/f3b9012f-3f75-433b-a9e0-c70c2a39e9bc?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | 1-row pill. With text it becomes a card of ≈30 px radius ([typed](https://mobbin.com/screens/e50e041f-a944-4982-ba81-067ab2e9f4ab?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)) | ≈64 [measured] | full pill | white, **no border**; dark: **#1E1F21, no border** ([dark](https://mobbin.com/screens/4acd68bd-1868-45fa-9885-5f191585e02c?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)) | soft drop shadow. **A large ambient radial glow sits on the page behind the composer**, light blue, or deep blue #12172B in dark mode | `+` | "Flash ⌄" + mic glyph. **No send button** | + 32 px light-blue circle ↑ | no visible change |
| [Linear: Ask Linear](https://mobbin.com/screens/e8fe60b4-6db4-4485-99b8-3395d69ea7db?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | 2 rows | ≈101 [measured] | ≈8–10 | #FCFCFC, hairline | barely any | toolbar: "Skills ⌄" chip | paperclip + **22–24 px outline circle ↑** | small ■ while running ([seen](https://mobbin.com/screens/b56b197d-7ef0-41b7-9e56-cc23460ffdc8?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)) | n/a |
| [Notion AI, dark](https://mobbin.com/screens/5a169bb1-12fa-4bfe-88c4-ff2210b15d32?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | 2 rows, with a tray attached underneath ("Get better answers from your apps") | ≈102 [measured] | ≈14–20 | **#202020 on #191919, 1 px ≈#3A3A3A** [measured] | none | `+`, sliders | "Auto", mic, 28 px send circle at low opacity (disabled) | blue filled circle ↑ ([light, typed](https://mobbin.com/screens/644841b3-6633-4075-bd1e-bb494c50d67f?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)) | no visible change |
| [v0](https://mobbin.com/screens/8330a460-5684-4f4e-a9fa-158f0b630df8?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | 2 rows | ≈104 [measured] | ≈10–12 | white on #FAFAFA, hairline | faint | `+`, "v0 Pro ⌄" | "Project ⌄", **28 px black rounded-square mic (filled)** | n/a | n/a |
| [Copilot](https://mobbin.com/screens/ababd41c-bdce-441b-9fbe-c13ed2dff0e5?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | 2 rows, raised | ≈95 | ≈24–28 | white, on a warm page, with an inner white ring | large and soft | 32 px outlined circle `+`, peach chip | n/a | 36 px black circle ↑ | n/a |
| [Devin, dark](https://mobbin.com/screens/b6987953-3551-42d1-985f-d85f5ff9ca5a?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | 2–3 rows | ≈147 [measured] | ≈14–16 | **#1F1F1F on #141414, 1 px ≈#313131** [measured] | none | "Normal ⌄" chip, `+`, settings | mic + grey split button ↑ \| ⌄ | n/a | n/a |
| [Mistral Le Chat, dark](https://mobbin.com/screens/2d750238-9093-46b0-bde8-9afde16be265?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | 1 row | ≈53 [measured] | ≈10–12 | **#222224 on #18181A, no border** [measured] | none | `+` in a 28 px bordered square | "Fast ⌄" + **32 px orange rounded-square mic (filled)** | black ↑ during dictation ([seen](https://mobbin.com/screens/7411b9f0-68ad-4585-98bb-d3b13384de4b?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)) | n/a |
| [Upwork Uma](https://mobbin.com/screens/a5b98330-1e31-498e-ac0e-2cb98d92de5b?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | 1 row | n/a | ≈12 | white | n/a | n/a | outline circle ▷ | n/a | **lime outer glow** [seen] |
| [Origin AI Advisor](https://mobbin.com/screens/24fea78e-bea4-493b-99f3-fe9a34681d9a?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | 1 row | n/a | ≈8 | white | n/a | n/a | grey ↑ | **thinking: a blue→violet light sweep along the edges of the status bar; faint lavender glow on the input's top edge** [seen] | n/a |
| [Granola, iOS](https://mobbin.com/screens/b1d234c6-48b2-478f-9fa8-9fa198fa49be?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) | bottom sheet | n/a | n/a | white sheet | n/a | n/a | scope chip "All time ▴", model chip, grey circle send | n/a | n/a |
| [Dia](https://www.diabrowser.com/) (not on Mobbin; [screenshot on its site](https://cdn.sanity.io/images/e5fj2khm/production/d685014ed6e8c681a25ea03e064da6f5022f2794-1141x758.png)) | 1 row, floating at the bottom of the chat | n/a | large, about 20 | white, no visible border | soft, wide | n/a | grey `+` and mic glyphs on the right | **filled rose circle** (shown as ■ stop) | **caret only**, no ring, although the field is focused [seen] |
| **Juyo** (own app, juyo.ai screenshots; see `../ui-refinement/juyo_brand.md` §3) | full-width bottom bar | n/a | small | dark (≈#0C1216 in screenshots; the brief gives #2A2E33) | n/a | n/a | n/a | small **purple rounded-square send** with a paper-plane icon; **no mic** | n/a |

**Not on Mobbin:** Raycast, Dia and Arc desktop are macOS apps. Dia's own site shows its composer (row above). Raycast was not checked. Mobbin has only Arc Search for iOS, whose "call" mode is shown in B.1.

### A.3 Patterns

1. **Two shapes.**
   - A **single-row pill, 53–64 px tall**: ChatGPT 55, Mistral 53, Gemini 64.
   - A **two-row card, 100–120 px tall**, with text above a toolbar: Claude 118 (r≈18), Perplexity 114 (r≈11), Linear 101 (r≈9), Notion 102, v0 104. Devin is taller (147).
   - ChatGPT and Gemini start as a pill and **grow into the card** when there is long text, an attachment or a tool chip, keeping a large radius.
2. **Surface versus border.**
   - Light mode: a white surface with a 1 px hairline (#DDD–#E7E7E7) and a short soft shadow (ChatGPT, Perplexity, v0, Linear), or a shadow only (Gemini, Copilot).
   - Dark mode: the surface is **one step lighter than the page** and the border is optional:
     - Notion: #202020 on #191919, with a 1 px #3A3A3A border.
     - Devin: #1F1F1F on #141414, with a 1 px #313131 border.
     - Mistral: #222224 on #18181A, no border.
     - Gemini: #1E1F21, no border.
   - **No dark composer uses a shadow.**
3. **No gradient edges.** The 23 composers examined are the table above plus [Sana](https://mobbin.com/screens/eb1a7750-d1c0-4b4c-8fc0-2ec45ef08cfa?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp), [Apollo](https://mobbin.com/screens/b66f3c41-1f73-419d-a2ed-6f9be0063b47?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp), [Plane](https://mobbin.com/screens/c02b60e7-2633-460e-844f-bec457ac0d1f?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp), [Higgsfield](https://mobbin.com/screens/35b69828-40c2-418c-9c02-59aa4229a544?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp), [Artlist](https://mobbin.com/screens/cb2a555a-e11e-4a02-910d-98fb00dfe3c3?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp), [Fabric](https://mobbin.com/screens/be637666-26c7-46f8-b503-477f07bbaa0b?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp), [Productboard](https://mobbin.com/screens/5358d8e6-5ae8-462a-8ef3-08da69024e2d?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp), [Searchable](https://mobbin.com/screens/5b1c6193-7557-47b2-9c17-f5fb0d2e10d2?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp), [Base44](https://mobbin.com/screens/e3c8f50f-2ee3-4140-9331-937d4ccb77d4?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) and [Voicenotes](https://mobbin.com/screens/67d70fbc-5b27-4bf4-ad71-57642585c132?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp). None has a gradient, conic or animated border, and none glows at rest. The Kassandra-style gradient appears in these products only as **brand marks** (Gemini's sparkle) or as **ambient light**, never as a stroke around the input.
4. **Placeholder.** Short and imperative, 16 px, mid grey: "Ask anything" (ChatGPT, Perplexity), "Ask Gemini", "How can I help you today?" (Claude), "Ask Linear…", "Do anything with AI…" (Notion), "Ask v0 to build…".
5. **Icon placement.**
   - `+` (attach, tools, context) sits at the left end of the composer or its toolbar in most of them: ChatGPT, Claude, Perplexity, Gemini, Notion, v0, Copilot, Mistral, Plane, Base44, Searchable. Linear instead puts a paperclip on the right, next to send.
   - The model or mode picker is **plain text with a chevron**, not a pill.
   - The mic is a bare glyph on the right.
   - The primary round or rounded-square button sits at the far right.
6. **The primary slot changes role.**
   - The common sequence is *empty → voice* (ChatGPT's black circle, Perplexity's dark circle, Claude's waveform glyph, v0's black mic, Mistral's orange mic), then *typed → send ↑*, then *running → stop ■*.
   - Products without a voice mode show a **disabled send at low opacity** (Notion, Linear's outline circle, Sana, Origin, Granola).
   - Gemini shows **no send at all until there is text**.
7. **The mic.**
   - It is an 18–20 px glyph in a 32–36 px hit area, neutral grey, and **never coloured at rest**. The only filled mics (v0 black, Mistral orange) are the brand's primary button.
   - Two functions use different glyphs: **dictation** (mic) and **voice conversation** (a waveform glyph in a filled button).
8. **Dictation stays inside the composer.**
   - ChatGPT web replaces the text with a scrolling **monochrome** waveform, a playhead line and ✕ / ✓, all inside the same pill ([seen](https://mobbin.com/screens/874aee2b-7f1c-4a52-9751-c36de1f13b01?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)).
   - Plane shows "◉ Recording…" and ✕ / ✓ ([seen](https://mobbin.com/screens/e9cd6480-757c-460e-961a-baec177562e4?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)).
   - Mistral shows a pixel equaliser in its brand style, a red dot with a timer, and a black send ([seen](https://mobbin.com/screens/7411b9f0-68ad-4585-98bb-d3b13384de4b?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)).
   - The rejected flat bar waveform is therefore the *industry default for dictation*. The user wants a voice-mode visual instead (Part B).
9. **Focus.**
   - In the typed or focused screenshots of Claude, Gemini, ChatGPT and Notion, the composer looks **identical to rest**. The caret is the cue.
   - Where focus is drawn, it is **static and single-hue**: Perplexity uses a teal 1 px border and soft glow, and Upwork a lime outer glow.
   - WCAG 1.4.11 (as explained in W3C's Understanding document) asks that a custom focus indicator have 3:1 contrast against adjacent colours: "the visual focus indicator for a component must have sufficient contrast against the adjacent background" ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)).

### A.4 Recommended ask-bar spec for Compass (dark, Juyo palette)

| Part | Spec | Why |
|---|---|---|
| Size | 56 px single row (`h-14`). It grows to a 2-row card (min ≈104 px) when the text wraps or a chip is added; the radius stays the same. Mobile: 48 px, 16 px text. | Juyo's own inputs are `h-14 rounded-xl` (see `juyo_brand.md` §1.4). This matches ChatGPT and Mistral (53–55). 16 px text stops iOS zoom (`decisions.md`). |
| Radius | **12 px** | Juyo's `rounded-xl` and our 12 px cards. Our buttons use 8 px (Astryx), so this is not a pill. |
| Surface | `#1E2429` fill on the `#0D1117` / `#161C22` page, with a 1 px `#2A2E33` border (or `rgba(255,255,255,.08)`). No shadow. | The dark pattern above: one surface step lighter, hairline, no shadow (Notion, Devin, Mistral). |
| Placeholder | "Ask anything about Fagus Cluj", Inter 16 px, `#8A9199` | `#8A9199` on `#1E2429` is **4.9:1** [computed], so AA passes even though placeholders are exempt. |
| Left | One AI mark only: a static 18 px Kassandra orb glyph (a CSS radial gradient or PNG, not WebGL). It is where the voice orb grows from (B.4). | It gives the gradient a single home. The sparkle and the orb are not both needed. |
| Right, empty | A `⌘K` hint chip (desktop only, hidden on focus), then the **mic**: a 32 px ghost button, 8 px radius, 18 px Phosphor `Microphone` glyph in `#C9CED6`, hover overlay 6% / press 11% (Astryx). No send button (Gemini pattern). | The mic stays neutral, like every product above. |
| Right, typed | The mic stays. **Send** appears: 32×32, 8 px radius, `#8556C9` fill, white ↑ (5.0:1 per `decisions.md`). It fades and scales in from 0.96 over 120 ms. While running it becomes **stop ■** in the same slot. | Send and stop share one slot, as in ChatGPT, Claude and Linear. The mic stays visible while typing, as in Gemini, ChatGPT and Perplexity. The purple square matches Juyo's own send. |
| Hover | Border becomes `rgba(255,255,255,.14)`. | Quiet. |
| Focus | Border becomes **`#996AD5` 1 px**, with an optional static 3 px ring at `rgba(153,106,213,.20)`. Transition 150 ms. **No gradient, no glow animation.** | `#996AD5` is **4.0:1** against `#1E2429` and **4.8:1** against `#0D1117` [computed], so it passes 1.4.11. This is the static brand ring of Perplexity and Upwork. |
| Thinking | Do not animate the border. If something must move, it is the 18 px orb mark (slow rotation, with a static image under reduced motion). | Origin's sweep is the only edge effect seen, and it is temporary. |

What to remove from the current bar: the rotating conic border, the blurred glow at rest, and the gradient stroke on focus. The gradient moves into the orb mark (at rest) and into the voice orb (Part B).

---

## Part B: a voice-mode visual that reacts to the voice

### B.1 How products show voice (Mobbin, iOS unless noted)

**ChatGPT** ([flow, 2026](https://mobbin.com/flows/4b19b589-ddc4-4107-93b0-d8d60178117d?tab=screens&utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp), [flow with in-chat orb](https://mobbin.com/flows/e513c0fe-fd2a-4f92-b7e7-756c9a8e9996?tab=screens&utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp), [older flow](https://mobbin.com/flows/8a834128-d249-425a-8bc6-029504038e5f?tab=screens&utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp))

- Each voice has its own orb, shown in "Meet Voice" / "Choose a voice":
  - [Spruce](https://mobbin.com/screens/d704184c-d3cc-467b-b659-19ee15bfa30a?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp), "Calm and affirming": periwinkle-indigo.
  - Breeze, "Animated and earnest": sky blue and white.
  - Arbor: deeper blue.
- The orb is a **flat disc filled with a moving cloud or sky texture**. It has no rim light and no specular highlight [seen]. It reads as a volume because of the texture motion, not because of shading [inferred].
- During a session [seen]:
  - The orb is **large and centred** (with a status line such as "Poor connection") or **small (≈60 px) and docked just above the composer**, while the transcript fills the chat ("ChatGPT Voice" in the header).
  - The bottom row keeps the text field ("+ Ask ChatGPT"), a **mute** button (mic-slash) and a black **✕ End**.
  - After the session, a "Voice chat ended · 36s" card with 👍 / 👎 appears, and the transcript stays in the thread.
- ChatGPT web settings have a **"Separate Voice"** toggle: "Keep ChatGPT Voice in a separate full screen, without real time transcripts and visuals" ([seen](https://mobbin.com/screens/ee1aa5d2-be03-48d6-9ac0-bb9af18f25a6?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)). So **in-chat voice with a live transcript is the default**, and full screen is an opt-in setting.
- The older voice UI was a black full screen with **four white dots**, "Tap to interrupt", a stop button and a red ✕.

**Claude** ([flow](https://mobbin.com/flows/b5f46b12-b097-4994-8079-61098a4778d8?tab=screens&utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp), [older flow](https://mobbin.com/flows/74ef81df-cd15-4c92-b822-c9c8e525a3f8?tab=screens&utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp))

- **There is no orb in these captures.** A soft **glow rises from the bottom edge** of an otherwise plain screen [seen]. 2026 press reports a central orb (B.1b).
- **The glow's colour shows the state** [seen]:
  - **Listening** ("Start talking" / "Ready and listening"): **cool blue**. The user's words appear as an italic live transcript just above the controls.
  - **Speaking** ("Tap anywhere to interrupt"): **warm terracotta**. The answer text is **revealed as it is spoken**: already-spoken text is dark and the rest is grey.
- Controls:
  - Newer flow: settings ⚙, mic and ✕.
  - Older flow: a capsule of `+`, ↑ (send now) and ✕, where ↑ becomes **■** while Claude speaks.
- Options: [Push to talk](https://mobbin.com/screens/f191a932-d66b-4694-9996-84691bab8420?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) ("Hold to speak, release to send"), and a [voice settings sheet](https://mobbin.com/screens/f9414f83-4ffc-4d05-aa72-5cb79f91739d?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) (Buttery / Airy / Mellow, Language, Speed).

**Gemini Live** ([Live screen](https://mobbin.com/screens/9362deca-d1dd-4492-bbe1-6c04b8bb5c01?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp), [camera on](https://mobbin.com/screens/a216ee5d-b99a-4750-8499-8a99cd862d8f?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp))

- A dark full screen with a "Live" title and a captions toggle. Captions appear as text.
- A **luminous blue band of light along the bottom**, above a row of camera, screen-share, mic and red ✕ (End). With the camera on, the glow stays behind the controls [seen].

**ElevenLabs (ElevenReader app)** ([Connecting](https://mobbin.com/screens/d9a14bbf-8a4a-4536-ab0a-92a16d67fd6b?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp), [flow](https://mobbin.com/flows/0c1b32b4-a7f4-48e5-84ee-8910cb858d20?tab=screens&utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp), [voice orbs](https://mobbin.com/flows/90fdb1b9-283a-4e83-bbb4-c06df1dfb05b?tab=screens&utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp))

- A pale cyan **orb with a conical swirl**, "Connecting…", a mic toggle and a text-mode toggle, and the line "Beta feature. May behave unexpectedly."
- Once the session is in text, the orb has dissolved into a **soft cyan glow behind the input** [seen].
- Every voice in their library has its own colour of the same orb (pink, green, violet). It looks like the open-source ElevenLabs UI `Orb` shader described in B.3 [inferred].

**Perplexity** ([sphere](https://mobbin.com/screens/8c98cc52-7198-40b2-b551-6e72597ee0d8?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp), [push-to-talk flow](https://mobbin.com/flows/53917546-b3f7-4761-9a71-09131931f1d9?tab=screens&utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp))

- A **3D point-cloud sphere** of fine dots, with "Say something…" and ✕ and mic on either side. The answer is shown in large text above it.
- In push-to-talk mode the dots **scatter across the screen**, with "Press and hold while speaking" and a large teal mic.
- Settings offer "Hands free (Automatic speech detection)" or "Push to talk", and a Subtitles toggle [seen].

**Others** [seen]

- [Meta AI](https://mobbin.com/screens/fca8709b-7a3a-4ce9-995d-3bd6677c5dd4?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp): a blue-to-cyan **gradient ring**, a timer, a live transcript under it, and a red "Stop" pill.
- [Google app](https://mobbin.com/screens/6446a9af-3532-4ed8-b83f-614e6963d748?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp): "Listening…" over a thin **coloured arc** (horizon) near the bottom.
- [Arc Search](https://mobbin.com/screens/ed0b030d-502f-4663-ba5c-579ee4c9361d?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) "call": a blue→magenta blob rising from the bottom, a smiley face, and a white bar waveform.
- [Tolan](https://mobbin.com/screens/6c567d6c-7c9b-4323-af5f-8d388e130fc4?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp): a particle character. This is the "too much" end of the range.

**Juyo Kassandra** (in-app `assets/gifs/kassandra-ai.gif`: 411×396, 181 frames of 30–40 ms, **≈6.0 s loop** [measured])

- It is a **flat disc of slowly flowing soft colour fields**, with no rim light, no highlight and no 3D shading.
- Colours sampled from the middle frame: violet `#A35DFE`–`#BC88F4` dominates, with lilac `#D093D5`, peach `#D7A8A3`, pale yellow `#D4C39B`, and cyan accents [measured].
- The sub-agent's frame analysis: the colour field makes **one full counter-clockwise turn per loop**, and there is **no scale pulse** [inferred].
- In juyo.ai screenshots it sits beside answers as an avatar of about 40 px. The composer ("Ask anything about your data") has a purple send and **no mic**.
- **Juyo shows no voice feature anywhere public**; "Talk to your hotel in plain language" means text chat ([juyo.ai/kassandra-ai](https://juyo.ai/kassandra-ai), [juyo.ai/hotelgpt](https://juyo.ai/hotelgpt)). Voice would be a Compass addition, not a copy of Juyo [inferred].

#### B.1b Web and press findings, 2024–2026

A research sub-agent wrote this survey. I re-checked the MacStories (Siri) and 9to5Google (Gemini Live) quotes myself. **No vendor publishes animation durations, and none documents reduced-motion behaviour for its voice visual.**

**ChatGPT**

- **May 2024:** a black dot that "changes into a stylized waveform when ChatGPT is speaking, just as the prompt area turns into one when the user speaks" ([TechCrunch](https://techcrunch.com/2024/05/13/chatgpts-new-face-is-a-black-hole)) [press].
- **Sept 2024:** Advanced Voice became "a blue animated sphere, instead of the animated black dots" ([TechCrunch](https://techcrunch.com/2024/09/24/openai-rolls-out-advanced-voice-mode-with-more-voices-and-a-new-look)), which "pulsed as it talked" ([TechRadar](https://www.techradar.com/ai-platforms-assistants/chatgpt/chatgpts-new-voice-integration-feels-like-the-missing-piece-in-ai-chat-ive-tried-it-and-its-almost-perfect)) [press].
- **Nov 25, 2025:** voice moved **into the chat thread**, with a live transcript and inline images and maps. Full screen became an opt-in "Separate" mode ([TechCrunch](https://techcrunch.com/2025/11/25/chatgpts-voice-mode-is-no-longer-a-separate-interface/), [MacRumors](https://www.macrumors.com/2025/11/26/chatgpt-voice-mode-update-seamless-chat/)) [press].
- **Help centre, July 2026** (Wayback): voice "can appear inside the main chat page, as a floating voice orb, or in Separate Voice". Mute is bottom-left and exit bottom-right ([help.openai.com 8400625](https://help.openai.com/en/articles/8400625-voice-mode-faq)) [doc].
- **Nov 2026:**
  - "Voice works within a chat", and with GPT-Live "responses appear as text in the chat while they are spoken" ([help.openai.com 20001274](https://help.openai.com/en/articles/20001274-chatgpt-voice)) [doc].
  - GPT-Live (July 8, 2026) keeps talking while a stronger model works, and says "mhmm" to show it is listening ([openai.com](https://openai.com/index/introducing-gpt-live)) [doc].
  - **No per-state spec for the orb was found.**

**Gemini Live and Search Live**

- **2024–25:** full screen, with a blue/purple waveform, big Hold and End buttons, and a glow around the overlay ([9to5Google](https://9to5google.com/2024/08/13/pixel-9-gemini-live/), [glow](https://9to5google.com/2024/08/17/gemini-glow-floating-overlay/)) [press].
- **2026:** "Instead of a fullscreen interface, Gemini Live just takes over the Gemini app homepage… the prompt box is replaced by a pill-shaped container that features the blue waveform", with camera / screen share on the left and mute on the right ([9to5Google, Apr 2026](https://9to5google.com/2026/04/19/gemini-live-app-redesign/), verified) [press].
- **I/O, May 2026:** "Neural Expressive" design, Live "integrated… directly into Gemini" ([Google blog](https://blog.google/innovation-and-ai/products/gemini-app/next-evolution-gemini-app/)) [doc]. Hands-on reviews describe a "small pill at the bottom of the screen" ([Android Authority](https://www.androidauthority.com/gemini-neural-expressive-android-app-hands-on-3668985/)) [press].
- **Oct 2026 tests:** a "circular button surrounded by animated dots and a glowing blue background", where the dots "warp slightly whenever sound plays" ([Android Authority](https://www.androidauthority.com/gemini-live-neural-expressive-audio-visualizer-redesign-3728666/), [Android Headlines](https://www.androidheadlines.com/2026/10/google-gemini-live-redesign-leak.html)) [press].
- **Search Live:**
  - 2025: "an arc-shaped waveform", which curves downward when responding ([9to5Google](https://9to5google.com/2025/06/18/google-search-live-voice-input/)).
  - 2026 test: a "perimeter glow that's blue as you ask a question", then "a gradient waveform at the bottom when Google is responding" ([9to5Google](https://9to5google.com/2026/05/06/search-live-redesign/)) [press].
- **Google's own rationale** ([design.google, "Illustrating the Gemini App"](https://design.google/library/gemini-ai-visual-design)) [doc]:
  - gradients are "amorphous, adaptable", with "sharp, almost opaque leading edges that diffuse at the tail";
  - "Blue radial gradients ripple outward… to represent Gemini's voice waves";
  - "Each animation has a defined start and end point".

**Apple Siri**

- **iOS 18.1 – iOS 26:** "an elegant glowing light that wraps around the edge of the screen" ([Apple Newsroom](https://www.apple.com/newsroom/2024/10/apple-intelligence-is-available-today-on-iphone-ipad-and-mac/)) [doc]. It is an "edge-lit animation which adapts in response to the sound of your voice" ([9to5Mac](https://9to5mac.com/2024/11/03/new-apple-intelligence-siri-looks-different-works-the-same/)) [press].
- **iOS 27 (2026)**, from [MacStories](https://www.macstories.net/stories/ios-and-ipados-27-review/5/) (verified) [press]:
  - "The old glowing animation around the device's bezels is gone", "replaced by a floating dark orb made out of Liquid Glass" that "smoothly descends from the Dynamic Island to listen to you".
  - "The orb pulses slightly to indicate it's listening", and "its multicolor waveform… reacts in real-time".
  - It shrinks "into a 'thinking' activity with a loading indicator", then expands "into a dark, translucent overlay".
- **So Apple, too, has moved from a full-screen edge effect to a small orb that reacts subtly.**

**Claude**

- **Help centre:**
  - Hands-free by default, responding at natural pauses. Push-to-talk means "hold a button while speaking".
  - Entry is the sound-wave icon next to the mic. A Stop button sits lower right on web and desktop ([support.claude.com](https://support.claude.com/en/articles/11101966-use-voice-mode)) [doc].
- **Launch, May 2025:** "displaying key points on-screen as Claude speaks" ([TechCrunch](https://techcrunch.com/2025/05/27/anthropic-launches-a-voice-mode-for-claude/)) [press].
- **2026 reports:** "a new glowing animation pulsing around the central voice orb during active sessions" ([Android Headlines](https://www.androidheadlines.com/2026/05/anthropic-claude-voice-mode-multilingual-update-push-to-talk.html)), and a move back to a standalone voice screen ([TestingCatalog](https://testingcatalog.com/anthropic-readies-upgraded-claude-voice-mode-for-desktop)) [press].
- The Mobbin captures above show the bottom glow and no orb, so the orb is newer or a test [inferred].

**Microsoft Copilot**

- **Copilot Appearance (July 2025):** "an abstract blob with a face" ([Neowin](https://www.neowin.net/news/microsoft-gives-copilot-visual-appearance-with-real-time-expressions-and-emotions/)) [press].
- **Mico (Oct 2025):** it "listens, reacts, and even changes colors" ([TechCrunch](https://techcrunch.com/2025/10/23/microsofts-mico-is-a-clippy-for-the-ai-era)) [press].
- **Aug 2026:** "the animated Mico character will be removed from the voice experience" ([Microsoft Support](https://support.microsoft.com/en-us/microsoft-365-copilot/frequently-asked-questions-about-retired-copilot-features)) [doc]. This is a data point *against* character-like, expressive voice visuals.

**ElevenLabs Agents widget**

- The avatar is an "Orb: Choose two gradient colors" or an image.
- The states are **text labels** ("Listening...", "Assistant speaking").
- The widget is voice-only by default, with an optional transcript and mute, and sits bottom-right ([docs](https://elevenlabs.io/docs/eleven-agents/customization/widget)) [doc].

**Commentary**

- [21st.dev blog](https://21st.dev/blog/react-voice-orb-components) (2026-08-21):
  - smooth the mic amplitude over several frames;
  - under `prefers-reduced-motion`, render a static orb and let text carry the meaning;
  - announce state changes in a live region;
  - never make the orb the only control.
- A critic of Gemini's gradients: they "don't map to anything" ([Roger Wong](https://rogerwong.me/2026/01/google-gemini-vibe-branding)).
- The common thread: **tie the motion to a real signal (voice level or state), not to decoration.**

### B.2 What reacts, and where it sits

| Product | Visual | Listening (user speaks) | Thinking | Speaking (assistant) | What reacts to audio | Placement |
|---|---|---|---|---|---|---|
| ChatGPT | Flat disc with an animated cloud texture, one palette per voice | No per-state spec found. 2024: the prompt area became a waveform | No visual; GPT-Live keeps talking | Orb "pulsed as it talked" [press] | Pulse with the output voice [press] | **In the chat thread** by default since Nov 2025: orb docked above the composer, live transcript, mute and End. "Separate Voice" full screen is opt-in [seen + doc] |
| Claude | Bottom-edge glow; 2026 reports of a central orb with a pulsing glow | **Blue** glow, italic live transcript [seen] | "pauses to think" (no visual found) | **Terracotta** glow; text revealed as it is spoken; ■ / tap to interrupt [seen] | Not documented | Full-screen voice screen on mobile; Stop at lower right on web [seen + doc] |
| Gemini Live | 2024–25: blue/purple waveform plus glow. 2026: **bottom pill with a blue waveform**. Tests: a glowing core with dots | Waveform in the pill [press] | Not found | Gradient "rippling and responding to voice" [doc] | Waveform; in tests, dots "warp" with sound [press] | Full screen → **takes over the app home**, with the pill in place of the prompt box [press, verified] |
| Search Live | Arc → 2026 test of a perimeter glow | Arc / **blue perimeter glow** | n/a | Arc curves down / gradient waveform from the bottom | Light "shifts around to match the speech" [press] | Full screen |
| Siri iOS 18–26 | Iridescent screen-edge glow | Glow "adapts in response to the sound of your voice" [press] | n/a | n/a | Edge glow intensity and motion | Screen edge |
| **Siri iOS 27** | **Dark Liquid Glass orb + multicolour waveform** | "pulses slightly… waveform… reacts in real-time" [press, verified] | Shrinks to a "thinking" pill with a loading indicator | Expands into a translucent results overlay | Pulse + waveform | Drops from the Dynamic Island; small, not full screen |
| Copilot | Abstract blob → Mico character (**removed from voice, Aug 2026**) | Mico "listens, reacts" | Icon states Thinking / Planning / Retrieval [doc] | Colour and expression changes | Not documented | Opened from the composer mic |
| ElevenLabs | Polar-shader orb (UI kit) + text labels (widget) | `listening`: input volume swells and brightens the rings [code] | `thinking`: slow wander [code] | `talking`: output volume drives flow distortion and speed [code] | **Scale, ring radius, opacity, flow speed** [code] | Floating widget, bottom-right; orb avatar in a card |
| Perplexity | 3D point-cloud sphere | Dots alive; push-to-talk scatters them [seen] | n/a | Large text above [seen] | Not documented | Full screen on iOS |
| Juyo Kassandra | Flat iridescent GIF disc | **No voice** | Same 6 s loop | n/a | Nothing | 40 px avatar beside answers |

**Takeaways**

1. **Placement is moving inwards.** ChatGPT moved voice into the thread in 2025. Gemini went from full screen to a pill in 2026. Siri went from a full-screen edge glow to a small orb in 2026. Phones still use a full-screen sheet when voice is the main task.
2. **Colour shows the state, motion shows the level.** Claude switches blue ↔ terracotta. Search Live is blue while you ask and uses a gradient while it answers.
3. **Audio mostly drives scale or pulse and internal motion.** Silhouettes deform only slightly: "pulses slightly" (Siri), dots "warp slightly" (Gemini test), and the ElevenLabs ring radius moves 0.2 at most.
4. **Expressive characters are being withdrawn.** Mico was removed from voice. Keep the orb abstract.

### B.3 Open-source references

#### ElevenLabs UI: `Orb` (verified in code)

- **Repo and licence:** [github.com/elevenlabs/ui](https://github.com/elevenlabs/ui), **MIT** ("Copyright (c) 2025 Eleven Labs Inc."), about 2.5k stars, pushed 2026-11-16 [code].
- **Source:** `apps/www/registry/elevenlabs-ui/ui/orb.tsx` (498 lines). Docs: [ui.elevenlabs.io/docs/components/orb](https://ui.elevenlabs.io/docs/components/orb) [code].
- **Dependencies:** `three`, `@react-three/fiber`, `@react-three/drei` (only `useTexture`) and `@types/three`, per the registry JSON. At runtime it **hot-links a Perlin noise PNG** from `storage.googleapis.com/eleven-public-cdn/images/perlin-noise.png` [code].
- **It is not a 3D mesh, despite the docs** ("A 3D animated orb"). It renders a flat `circleGeometry(3.5, 64)` with a 2D **polar-coordinate fragment shader**:
  - seven soft ovals with gradients arranged around the centre;
  - two noisy rings;
  - a 4-stop colour ramp (black → `uColor1` → `uColor2` → white);
  - `uInverted` flips the luminance for dark mode [code].
- **Uniforms:** `uTime, uAnimation, uInverted, uOffsets[7], uColor1, uColor2, uInputVolume, uOutputVolume, uOpacity, uPerlinTexture` [code].
- **Audio mapping** [code]:
  - **Mic (input):** oval height `b = noise * mix(3.5, 2.5, uInputVolume)`, ring radius `radius + uInputVolume*0.2`, ring opacity `mix(0.2, 0.6, uInputVolume)`. Louder input makes the rings swell and brighten.
  - **Agent voice (output):** flow distortion `theta += noise * mix(0.08, 0.25, uOutputVolume)` and animation speed `0.1 + (1 - (out-1)^2) * 0.9`.
  - **Smoothing:** per frame, `cur += (target - cur) * 0.2` for the volumes, 0.12 for speed and 0.08 for the colour lerp. All are frame-rate dependent.
  - **Fade-in:** `uOpacity += delta*2`, which is about 0.5 s.
- **Two traps** [code]:
  1. In the default `volumeMode="auto"` the orb **ignores real audio**. It plays synthetic sine-wave volumes per `agentState`:
     - listening: in = `0.55 + sin(t*3.2)*0.35`
     - talking: in = `0.65 + sin(t*4.8)*0.22`, out = `0.75 + …`
     - thinking: a slow wander

     Real audio only drives it with `volumeMode="manual"`, as the `voice-chat-01/02` blocks do.
  2. Those blocks scale the raw SDK volume with **`Math.min(1, Math.pow(raw, 0.5) * 2.5)`**, a square-root curve with gain.
- **Volume helper:** `bar-visualizer.tsx` exports `useAudioVolume` [code]:
  - `AnalyserNode` with `fftSize: 32` and `smoothingTimeConstant: 0`;
  - the **RMS of `getByteFrequencyData` divided by 255**;
  - throttled to 30 fps, updating only when the change is greater than 0.01.
- **Agent states** used across their components: `connecting | initializing | listening | speaking | thinking` (bar visualizer) and `null | thinking | listening | talking` (orb).
- **Shader language:** it uses `texture()` and `float[7](…)` array constructors, which are GLSL ES 3.00. That means **WebGL2**; three.js adds the `#version 300 es` header.
- **It handles context loss** (`webglcontextlost` → `preventDefault` → `forceContextRestore`).
- **Port to Angular without React:** *easy*.
  - The shader is self-contained.
  - The `useFrame` logic is about 60 lines.
  - Replace R3F with a raw WebGL2 full-screen triangle, and self-host or replace the Perlin PNG.
  - The look is ElevenLabs' signature, so copying it 1:1 would read as "their orb". Borrow the **state and volume plumbing**, not the look.

#### Vercel AI Elements: `Persona` (verified in code)

- **Repo and licence:** [github.com/vercel/ai-elements](https://github.com/vercel/ai-elements). The code is **Apache-2.0** (repo `LICENSE`, "Copyright 2023 Vercel, Inc.").
- **Source:** `packages/elements/src/persona.tsx`. Docs: `apps/docs/content/components/(voice)/persona.mdx` [code].
- **How it works** [code]:
  - It is built on **Rive** (`@rive-app/react-webgl2`).
  - Its six variants (`obsidian, mana, opal, halo, glint, command`) **hot-link `.riv` files on Vercel Blob storage** (e.g. `…/obsidian-2.0.riv`, `…/orb-1.2.riv`).
  - The **repo states no licence for those design files**.
- **States only, no amplitude:**
  - States: `idle | listening | thinking | speaking | asleep`, set as booleans on a state machine called `default`.
  - There is **no volume input**.
  - A view-model `color` is set to white or black by theme.
- The docs warn that browsers cap active WebGL2 contexts at "~8–16".
- **Port:** Rive has framework-agnostic runtimes, but we would need our own `.riv` with a number input for the level. This is not the quickest path.

#### Other references: open-source survey (2026-11-20)

How these were checked:

- A research sub-agent read GitHub and npm directly (`gh api`, the npm registry and bundlephobia).
- Codrops, Shadertoy and CodePen block bots, so they were read through Wayback snapshots.
- I spot-checked the licences of orbloom, OGL and LiveKit, and LiveKit's speaking-scale code, myself.

Bundle sizes (min+gz, bundlephobia): **three 0.187.0 = 185.7 KB**, **ogl 1.0.11 = 34.2 KB** (README: 29 KB, smaller after tree-shaking), simplex-noise 1.8 KB, lit 6.0 KB.

| Reference | Licence | Deps / weight | Technique | Audio → uniforms | Port to Angular, no React |
|---|---|---|---|---|---|
| **[orbloom](https://github.com/rickybharti/orbloom)** (npm 0.1.0, Aug 2026, 21★) | **MIT** (verified) | none | **Analytic sphere in a fragment shader** (`depth = sqrt(1-r²)`, `refract` for a glass back face). The same idea as our option A | Time-domain level with an adaptive noise-floor gate (`absoluteGateDb: -55`). **Attack/release envelope τ = 0.11 s up / 0.3 s down via `1 - exp(-dt/τ)`**. Uniforms `uAudioBrightness, uAudioPulse, uSpin, uGlass, uState` | Easy: `createOrb(canvas, opts)`. Young and little adopted, so take ideas rather than the dependency |
| **[LiveKit Agents UI "Aura"](https://docs.livekit.io/reference/components/agents-ui/component/agent-audio-visualizer-aura/)** ([component](https://github.com/livekit/components-js/blob/main/packages/shadcn/components/agents-ui/agent-audio-visualizer-aura.tsx), [hook](https://github.com/livekit/components-js/blob/main/packages/shadcn/hooks/agents-ui/use-agent-audio-visualizer-aura.ts)) | **Apache-2.0** (verified), keep the NOTICE | React + motion + an MIT ShaderToy wrapper | 2D Shadertoy-style SDF circle, 36-iteration "turb" warp, HSV shift. "Designed in partnership with Unicorn Studio" | `useTrackVolume(fftSize 512, smoothing 0.55)`. **Speaking: `scale = 0.2 + 0.2*volume`** (verified). The full state table is below | Easy (GLSL plus a small tween). Heavy per pixel: they cap DPR at 2 |
| **[Google "Live Audio" starter](https://github.com/Nate711/pupperv3-monorepo/tree/main/ai/llm-ui/live-audio-original)** (AI Studio export; read from third-party copies) | Apache-2.0 (SPDX headers) | lit + three, about 192 KB gz; bloom, EXR env map, FXAA | `IcosahedronGeometry(1, 10)` (2,420 triangles), `MeshStandardMaterial` patched with `onBeforeCompile`: sine displacement plus analytic normals | **Separate analysers for mic and agent output** (`fftSize 32`): `inputData = (in[0]/255, 0.1*in[1]/255, 10*in[2]/255)`, `sphere.scale = 1 + 0.2*out[1]/255`, `time += dt*0.1*out[0]/255` | Easy (it is already a Lit web component), but heavy, and the DPR is uncapped |
| **[Codrops: 3D audio visualizer](https://tympanus.net/codrops/2025/06/18/coding-a-3d-audio-visualizer-with-three-js-gsap-web-audio-api/)** (Filip Zrnzevic, 2025) | MIT (Codrops / CodePen default) | three (+ gsap) | Icosahedron, simplex displacement along normals, fresnel rim, back-face additive glow shell at about 1.2× | `audioLevel = avg(byteFreq)/255 * sens/5`. Vertex: `pos += normal*noise*distortion*(1.0+audioLevel)`. Fresnel exponent `2.0 + audioLevel*2.0` | Easy (needs your own icosphere and matrices) |
| **[Codrops WebGLBlobs](https://github.com/codrops/WebGLBlobs)** ("Twisted Colorful Spheres", 2021) | **MIT** | three 0.123 + glslify | `pnoise((normal + t)*uNoiseDensity)*uNoiseStrength`, a twist, an iq cosine palette for iridescent bands | No audio: drive `uNoiseStrength` from the level | Easy (inline the GLSL) |
| [Codrops: displaced sphere, custom material](https://github.com/pavel-mazhuga/codrops-tutorial-distorted-sphere-custom-material) (Pavel Mazhuga, 2024) | MIT | R3F + CustomShaderMaterial, `MeshPhysicalMaterial` with iridescence 0.96 | Perlin displacement; normals rebuilt with neighbours; detail 200, about 808k triangles | No audio | Moderate and costly |
| **[OGL](https://github.com/oframe/ogl)** | **Unlicense** (npm, verified; the repo has no LICENSE file) | 29–34 KB gz, zero deps | `fresnel.html` (`pow(1.0 - abs(dot(V, N)), uFresnelPower)`), full-screen-triangle and bloom examples; `Sphere` is a UV sphere, **no icosphere** | n/a | Easy. The best small base for a true-3D mesh (option C) |
| [React Bits Orb](https://github.com/DavidHDev/react-bits) (DavidHDev) | **MIT + Commons Clause**: usable in your own product, but not redistributable, "including… as a ported version" | raw WebGL2 since 2026-10-11 (was OGL) | 2D glow ring (`snoise3`) | Hover, not audio. Smoothing `x += (t-x)*(1-exp(-dt/0.16))` | Avoid as a base. Its derivatives (21st "VoicePoweredOrb", `@omnedia/ngx-orb`) inherit the terms, and ngx-orb carries no attribution |
| [SmoothUI Siri Orb](https://github.com/educlopez/smoothui) | MIT | CSS only (+ motion) | Stacked `conic-gradient`s animated through `@property --angle`, blur and contrast | Amplitude drives blur and scale | Easy. **A good no-WebGL or reduced-motion fallback** |
| [Pipecat voice-ui-kit Plasma](https://github.com/pipecat-ai/voice-ui-kit/blob/main/package/src/visualizers/webgl/Plasma.tsx) | BSD-2-Clause | three (peer), React | 2D full-screen fragment | `getFloatFrequencyData`, `(db+140)/140`, gate at 0.15, then `pow(v,1.5)*reactivity` → intensity, radius, glow, speed | Moderate |
| [Paper Shaders](https://github.com/paper-design/shaders) | Apache-2.0 | zero deps, vanilla API, 64 KB gz | 2D (smoke ring, metaballs, pulsing border) | none | Easy, but 0.0.x |
| 21st.dev "voice orb" items | mixed: MIT, "unknown", "no-license" | various | various | various | Source now needs a 21st API key. Vet each one; the 21st blog itself says "Quality varies by author" |

**Licence traps**

- **Shadertoy**'s default licence is **CC BY-NC-SA 3.0**, which rules it out for a commercial product without the author's permission ([archived terms](https://web.archive.org/web/20240601025715/https://www.shadertoy.com/terms)). Some Inigo Quilez shaders forbid any use. **LYGIA** is Prosperity 3.0 (non-commercial). The WaelYasmina audiovisualizer has no LICENSE file. **Three.js Journey** code is a paid course, not open source.
- **Safe**: stegu / ashima webgl-noise (MIT), OGL (Unlicense), and Codrops demos (MIT unless stated otherwise).

**LiveKit Aura state table** [code, via the sub-agent; the speaking row was verified by me]. It is a useful reference for state semantics.

| State | speed | scale | amplitude | frequency | brightness |
|---|---|---|---|---|---|
| idle / disconnected | 10 | 0.2 | 1.2 | 0.4 | 1.0 |
| listening | 20 | 0.3 (spring, 1.0 s, bounce 0.35) | 1.0 | 0.7 | pulses 1.5 ↔ 2.0 |
| thinking / connecting | 30 | 0.3 | 0.5 | 1.0 | pulses 0.5 ↔ 2.5 |
| speaking | 70 | **0.2 + 0.2 × volume** | 0.75 | 1.25 | 1.5 |

Transitions are 0.5 s easeOut, and pulses run 0.35 s mirrored.

**Performance notes from these sources**

- **DPR cap of 2 everywhere.** LiveKit `MAX_SHADER_PIXEL_RATIO = 2`, React Bits and Pipecat `min(devicePixelRatio, 2)`. Google's sample does not cap.
- **Pause when not visible.** IntersectionObserver plus `visibilitychange` in React Bits, orbloom and ReactShaderToy.
- **Context limits.** Browsers drop contexts after about 16. React Bits calls `WEBGL_lose_context` on teardown, and one library shares a single hidden context across all its orbs.
- **Do the displacement on the GPU.** VapiBlocks morphs vertices on the CPU every update. Avoid that.
- **Mesh size.** An icosphere has 20 × (detail+1)² triangles: detail 10 = 2,420; detail 30 = 19,220.
- **Analysis can run at 30 Hz**, apart from rendering (LiveKit). A small `fftSize` is enough for a level meter.

### B.4 Recommendation: an inline "Kassandra orb" in raw WebGL

#### Placement and flow

- **Desktop: expand in place, no overlay.**
  - Pressing the mic grows the ask bar **in place** from 56 px to about 120 px tall, over 220 ms with `cubic-bezier(.2,.8,.2,1)`. It keeps its width, its 12 px radius and the `#1E2429` surface.
  - Inside the panel:
    - the **orb** sits on the left, in the slot of the 18 px Kassandra mark (a 104 px canvas; the sphere fills about 65% of it, so it looks about 68 px);
    - a status word ("Listening…", 12 px, `#8A9199`) and the **live transcript** (16 px, `#E6E8EB`) sit in the middle;
    - **✕ Cancel** (Esc) and **Send ↑** (Enter, the purple square) sit on the right.
  - The mark scales up into the orb, so the voice visual comes out of the bar instead of appearing somewhere else.
  - This follows the sources:
    - **Gemini Live (2026), the closest precedent:** "the prompt box is replaced by a pill-shaped container that features the blue waveform".
    - ChatGPT's in-chat voice: an orb docked by the composer, with the transcript in place.
    - Siri iOS 27: a small orb instead of a full-screen effect.
    - In-composer dictation in ChatGPT, Plane and Mistral: same box, ✕ / ✓.
    - `decisions.md`: Esc cancels; the question is sent when you stop, like Google voice search.
- **Phone: a full-screen sheet.**
  - ChatGPT, Claude, Gemini and Perplexity all use one on phones.
  - The orb is 160–200 px and centred at about 40% of the height. The transcript sits under it and the controls are at the bottom (✕, Send), each at least 44 px.
  - Use plain `#0D1117` with no full-screen glow, to keep it calm.
- **States.** Compass speaks no answers aloud, so there is no "speaking" state unless TTS is added.

| State | Orb | Text | Notes |
|---|---|---|---|
| Asking for the mic | static orb at 0.6 opacity | "Allow the microphone to talk to Kassandra" | `getUserMedia` and `AudioContext.resume()` must run inside the click handler (autoplay rules: [MDN](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)) |
| Listening | live, `uLevel` from the mic | "Listening…" plus the live transcript | Esc cancels; Enter sends now |
| Silence or send | in about 250 ms `uLevel` → 0, scale to 0.92 and flow slows | "Sending…" | auto-send after about 1.2 s of silence (to tune). The panel then collapses to 56 px and the question appears in the thread |
| Thinking (answer streaming) | the 18 px mark turns slowly (static under reduced motion) | existing "Worked for…" steps | the bar does not glow |
| Error or no mic | static orb | "Microphone blocked. Type your question instead" | keep the demo transcript fallback from `decisions.md` |
| Speaking (only if TTS is added) | same orb, driven by the **output** analyser; optional state hue shift towards pink | spoken text revealed as it plays (Claude) | Claude's model: colour shows the state, motion shows the level |

#### What reacts to the voice, and how much

The rejected bar failed by doing too much. Keep each effect small:

| Effect | Silence → loudest (`uLevel` 0 → 1) | Role |
|---|---|---|
| Scale (sphere radius / canvas half-size) | 0.62 → 0.69 (+11%) | the main cue, readable at a glance |
| Silhouette displacement (angular simplex noise) | 0.6% → 3.4% of the radius | makes it feel alive, not a blob |
| Internal flow speed (time multiplier) | 0.10 → 0.35 | "energy" |
| Fresnel rim intensity | 0.45 → 0.90 | light, not colour |
| Outer halo alpha | 0.05 → 0.23 | barely visible |
| Hue | **unchanged by level** | colour is the brand and, at most, the state, never the signal |

#### The shader (validated)

It compiles and renders in WebGL 1 and was checked in a headless browser at 24–200 px. A screenshot of the level sweep and of the inline panel mock was reviewed. The scratch prototype is in the session scratchpad at `orb-proto/orb-proto-v3.html`, which is temporary.

- **Technique:** a **fragment-only analytic sphere** on one full-screen triangle. It takes a sphere normal from the pixel position, perturbs it with 3D simplex noise (liquid surface), draws a domain-warped colour flow along the brand diagonal, adds Lambert and Blinn shading, an iridescent fresnel rim and an exponential halo.
- **Cost:** no geometry, no matrices, no textures, no depth buffer, and **5 `snoise` calls per pixel**.
- **Noise:** `snoise(vec3)` is Ashima / Stefan Gustavson's `noise3D.glsl` ([github.com/stegu/webgl-noise](https://github.com/stegu/webgl-noise), **MIT**; verified with `gh api`). Paste it above `main()`.

```glsl
precision highp float;
uniform vec2  uRes;    // canvas size in device px
uniform float uTime;   // seconds (frozen under reduced motion)
uniform float uLevel;  // 0..1, smoothed mic level
uniform vec3  uC1, uC2, uC3; // Kassandra: #6FA0FB, #A78CFB, #EB75BE (sRGB 0..1)
// + snoise(vec3) from stegu/webgl-noise src/noise3D.glsl (MIT)

vec3 ramp(float f){ f = clamp(f, 0.0, 1.0); return f < 0.5 ? mix(uC1, uC2, f*2.0) : mix(uC2, uC3, (f-0.5)*2.0); }
void main(){
  vec2 p = (gl_FragCoord.xy - 0.5*uRes) / (0.5*min(uRes.x, uRes.y));
  float lv = clamp(uLevel, 0.0, 1.0);
  float R = 0.62 + 0.07*lv;                                       // 1) scale: the main voice cue
  float a = atan(p.y, p.x);
  float wob = snoise(vec3(cos(a)*0.9, sin(a)*0.9, uTime*0.25)) * (0.006 + 0.028*lv);
  float edge = R * (1.0 + wob);                                    // 2) gentle silhouette displacement (seam-free)
  float r = length(p);
  float px = 1.5 / min(uRes.x, uRes.y);
  float inside = 1.0 - smoothstep(edge - px, edge + px, r);        // analytic AA, so antialias:false is fine
  vec2 q = p / edge;
  float z = sqrt(max(0.0, 1.0 - dot(q, q)));
  vec3 n = normalize(vec3(q, z));                                  // analytic sphere normal
  float t = uTime * (0.10 + 0.25*lv);                              // 3) flow speed follows the voice
  vec3 np = n*1.2 + vec3(0.0, 0.0, t);
  n = normalize(n + (0.05 + 0.09*lv) * vec3(snoise(np + 7.0), snoise(np + 19.0), 0.0)); // liquid bump
  float w = snoise(vec3(q*0.6, t*0.6 + 3.0));
  float flow = snoise(vec3(q*0.75 + 0.45*vec2(w, -w), t*0.5));     // domain-warped flow
  float f = 0.5 + 0.38*dot(q, vec2(0.62, -0.62)) + 0.30*flow;      // brand diagonal: blue top-left -> pink bottom-right
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(vec3(-0.45, 0.55, 0.75));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 2.4);
  float spec = pow(clamp(dot(n, normalize(L + V)), 0.0, 1.0), 32.0);
  vec3 col = ramp(f) * (0.42 + 0.58*diff);
  col += fres * ramp(f*0.5 + fres*0.7) * (0.45 + 0.45*lv);         // 4) iridescent fresnel rim, brighter with voice
  col += spec * 0.16;                                              // soft glassy highlight
  float d = max(r - edge, 0.0);
  float glow = exp(-d*18.0) * (0.05 + 0.18*lv) * (1.0 - inside);    // 5) faint halo
  gl_FragColor = vec4(col*inside + ramp(0.55)*glow, clamp(inside + glow, 0.0, 1.0)); // premultiplied
}
```

Vertex shader: `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`, drawn with one triangle `[-1,-1, 3,-1, -1,3]`.

Possible upgrades, used sparingly:

- A warm accent stop. Juyo's own orb GIF has peach and pale yellow; try a `#F3D9A4`-ish fourth stop at 10–15% only in the rim.
- An early exit for pixels where `r > edge + 0.35`.
- For a state colour (if TTS is ever added), lerp `uC1..3` over 400 ms. Never per frame from the level.

#### Audio → `uLevel`

```ts
// Inside the mic button's click handler (user activation).
const stream = await navigator.mediaDevices.getUserMedia({
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
});
const ctx = new AudioContext();
await ctx.resume();
const analyser = ctx.createAnalyser();
analyser.fftSize = 1024;                                 // ≈21 ms at 48 kHz
ctx.createMediaStreamSource(stream).connect(analyser);   // never connect to ctx.destination (feedback)
const buf = new Float32Array(analyser.fftSize);

function micLevel(): number {                            // 0..1, perceptual
  analyser.getFloatTimeDomainData(buf);                  // Baseline since April 2021 (MDN)
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  const db = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-8);   // dBFS
  return Math.min(1, Math.max(0, (db + 55) / 40));                  // -55 dBFS → 0, -15 dBFS → 1 (tune on devices)
}

// Every frame, frame-rate independent: fast attack, slow release, no flicker.
let level = 0;
function smooth(dt: number) {
  const target = micLevel();
  const tau = target > level ? 0.06 : 0.3;               // seconds
  level += (target - level) * (1 - Math.exp(-dt / tau));
}
```

- ElevenLabs' blocks use a different curve: `min(1, sqrt(raw) * 2.5)` on their SDK volume, and their `useAudioVolume` takes the RMS of `getByteFrequencyData` at `fftSize 32` [code]. Either curve works. The point is a **perceptual (square-root or dB) curve, then attack/release**.
- Their `cur += (t - cur) * 0.2` per frame runs faster on 120 Hz screens. The `exp(-dt/τ)` form above does not.
- On stop or cancel: `stream.getTracks().forEach(t => t.stop())` and `ctx.close()`.

#### Angular wiring (zoneless, no React)

- **Component.** `KassandraOrb` is a standalone component with a `<canvas>` and `host: { 'aria-hidden': 'true' }`.
  - Start WebGL in `afterNextRender` (browser only, so SSR-safe) and clean up through `DestroyRef`.
  - Pass the level as a getter input, `levelSource = input.required<() => number>()`. It is read inside `requestAnimationFrame`. **Do not write a signal every frame.**
- **Sizing.** Use `ResizeObserver` with `{ box: 'device-pixel-content-box' }`, falling back to `content-box × devicePixelRatio`, and resize the canvas inside the rAF before drawing, as MDN's [WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) advise. Cap the DPR at 2.
- **Context attributes:** `{ alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }`. MDN warns that `alpha:false` "can be expensive". The shader antialiases its own edge.
- **The loop runs only while the panel is open and visible.** Pause on `document.visibilitychange` and with an `IntersectionObserver`. When the session ends, stop rAF and free the context (`WEBGL_lose_context`, per MDN "Lose contexts eagerly").
- **Context loss:** handle `webglcontextlost` (`preventDefault`) and `webglcontextrestored` (rebuild the program). ElevenLabs does the same.
- **Never call `gl.getError()` or `getParameter()` in the loop.** MDN: they "cause synchronous stalls".
- **No-WebGL fallback:** a CSS radial-gradient sphere (the same three stops plus a white highlight) with `transform: scale(1 + 0.1*level)`, which is compositor-only.
- **Accessibility:**
  - The orb is decorative (`aria-hidden`).
  - State changes go to a `role="status"` region ("Listening", "Sending your question", "Microphone blocked").
  - Do not live-announce the transcript word by word.
  - Focus moves to Cancel while listening and back to the input on close.

#### Reduced motion, flashing and comfort

- **`prefers-reduced-motion: reduce`** ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)): freeze `uTime`. No flow, no wobble and no scale. Render **one** frame and let the level change only the rim brightness, by 10% at most, with a ≥300 ms release (a fade, not motion). Or show a static orb with the "Listening…" text. This follows WCAG 2.3.3 Animation from Interactions ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)).
- **Flashing:** WCAG 2.3.1 counts a flash as "a pair of opposing changes in relative luminance of 10% or more", with the darker state below 0.80, over an area above 25% of a 10° field (≈341×256 px at 1024×768) ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)). Syllables run at about 4–6 per second, so **keep the orb small (≤200 px) and its luminance swing small**. The halo and rim add light; the body's brightness should not pump. The release smoothing above prevents strobing.
- **Pause, Stop, Hide (2.2.2):** the animation starts only after the user presses the mic and stops when the session ends, so nothing auto-plays at rest. This is one more reason the bar's idle state must be static.

#### Mobile

- `getUserMedia` needs a secure context, and the `AudioContext` must start from the tap.
- Test on iOS Safari with the screen locked and unlocked, and stop the tracks on `pagehide`.
- MDN lists the Web Speech API's `SpeechRecognition` as **"Limited availability"**, and notes that "On some browsers, speech recognition uses a server-based recognition engine by default" ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)). Plan a server-side speech-to-text fallback, or keep the demo-transcript path.
- Orb: 160–200 px in the sheet, DPR capped at 2. At 200 CSS px × 2 that is 400² = 160k pixels × 5 noise calls, which is light for mobile GPUs [inferred]. **Measure it on a mid-range Android.**
- Controls are at least 44 px. The keyboard is hidden during voice; the transcript stays editable after you stop.

#### Alternatives considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Fragment-only analytic sphere (above)** | no dependencies, about 2 KB of GLSL, WebGL 1 and 2, reads as 3D at 24–200 px, trivial reduced-motion and fallback. **orbloom (MIT, 2026) independently uses the same technique and the same attack/release envelope** | the silhouette displacement is faked (in 2D) | **Recommended** |
| B. Port ElevenLabs UI `Orb` to raw WebGL2 | MIT, proven states and volume plumbing | a flat polar shader whose look is ElevenLabs' signature; needs WebGL2; hot-linked texture; its "auto" mode ignores audio | borrow the plumbing, not the look |
| C. True 3D icosphere with vertex displacement | real silhouette deformation, rotation parallax; cost does not grow with resolution | needs icosphere generation and matrices, or **OGL** (Unlicense, about 30 KB, but no icosphere) or three (186 KB); easy to drift into "exaggerated blob" | if wanted later: OGL + Codrops WebGLBlobs displacement (MIT) + Filip Zrnzevic's fresnel and audio coupling, with the 3-stop Kassandra ramp in place of the cosine palette. Not needed at 70 px |
| D. Particle / point-cloud sphere (Perplexity) | very "technical" and premium | harder to tint with the gradient; more JS; busy at small sizes | worth a later experiment |
| E. Rive persona (AI Elements) | state machine, nice motion | no amplitude input in their files; `.riv` licence unclear; need our own `.riv` | no |

---

## Sources

See the inline links. Key ones:

- Mobbin screens and flows linked throughout Part A and B.1.
- Voice products, 2024–2026 (see B.1b for quotes):
  - ChatGPT: [TechCrunch 2025-11-25](https://techcrunch.com/2025/11/25/chatgpts-voice-mode-is-no-longer-a-separate-interface/), [help: voice FAQ](https://help.openai.com/en/articles/8400625-voice-mode-faq), [help: ChatGPT voice](https://help.openai.com/en/articles/20001274-chatgpt-voice), [GPT-Live](https://openai.com/index/introducing-gpt-live).
  - Gemini: [9to5Google 2026-04-19](https://9to5google.com/2026/04/19/gemini-live-app-redesign/), [design.google: Illustrating the Gemini App](https://design.google/library/gemini-ai-visual-design), [Google blog, I/O 2026](https://blog.google/innovation-and-ai/products/gemini-app/next-evolution-gemini-app/).
  - Siri: [Apple Newsroom 2024-10](https://www.apple.com/newsroom/2024/10/apple-intelligence-is-available-today-on-iphone-ipad-and-mac/), [MacStories iOS 27 review](https://www.macstories.net/stories/ios-and-ipados-27-review/5/).
  - Claude: [help: voice mode](https://support.claude.com/en/articles/11101966-use-voice-mode).
  - Copilot: [Microsoft Support: retired Copilot features](https://support.microsoft.com/en-us/microsoft-365-copilot/frequently-asked-questions-about-retired-copilot-features).
  - ElevenLabs: [widget docs](https://elevenlabs.io/docs/eleven-agents/customization/widget).
- ElevenLabs UI: [repo](https://github.com/elevenlabs/ui) (MIT), `apps/www/registry/elevenlabs-ui/ui/orb.tsx`, `ui/bar-visualizer.tsx`, `blocks/voice-chat-01/page.tsx`, [docs](https://ui.elevenlabs.io/docs/components/orb).
- Vercel AI Elements: [repo](https://github.com/vercel/ai-elements) (Apache-2.0), `packages/elements/src/persona.tsx`, `apps/docs/content/components/(voice)/persona.mdx`.
- Noise: [stegu/webgl-noise](https://github.com/stegu/webgl-noise) (MIT), `src/noise3D.glsl`.
- Open-source orbs: [orbloom](https://github.com/rickybharti/orbloom) (MIT), [LiveKit components-js](https://github.com/livekit/components-js) (Apache-2.0), [OGL](https://github.com/oframe/ogl) (Unlicense), [Codrops WebGLBlobs](https://github.com/codrops/WebGLBlobs) (MIT), [Codrops 3D audio visualizer](https://tympanus.net/codrops/2025/06/18/coding-a-3d-audio-visualizer-with-three-js-gsap-web-audio-api/), [Codrops licensing](https://tympanus.net/codrops/licensing/), [React Bits licence](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md), [SmoothUI](https://github.com/educlopez/smoothui) (MIT), [Pipecat voice-ui-kit](https://github.com/pipecat-ai/voice-ui-kit) (BSD-2), [Paper Shaders](https://github.com/paper-design/shaders) (Apache-2.0), [bundlephobia three](https://bundlephobia.com/package/three@0.187.0), [bundlephobia ogl](https://bundlephobia.com/package/ogl@1.0.11).
- MDN: [WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices), [getFloatTimeDomainData](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getFloatTimeDomainData), [SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition), [Autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay), [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion).
- W3C: [1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [2.3.1 Three Flashes](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html), [2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).
