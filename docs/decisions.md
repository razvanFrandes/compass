# Decisions

These are the decisions made so far, in the discussion phase (2026-11-20). No code has been written yet. Each entry gives the choice and the reason.

## Decided

| Area | Choice | Why |
|---|---|---|
| Repo | New repo `compass-mvp`, separate from the POC | Clean history. The POC stays as a reference at `/Users/razvan/Web/compass`. |
| Framework | Angular 22 (standalone, signals, zoneless) + Tailwind CSS v4 | Same as the POC. Juyo's own product is built in Angular. |
| Component kit | **Spartan UI** (spartan.ng: brain + helm), not Zard | Preferred by the user. More mature: about 3k stars, in the Thoughtworks Radar "Assess" ring. It already ships AI-oriented helm components: `message`, `message-scroller`, `bubble`, `attachment`, `code-block`, `trace`, `questionnaire`, `skeleton`, `sonner`, `command`. |
| Icons | **Not Lucide.** The lead candidate is **Phosphor** (`@ng-icons/phosphor-icons`, MIT); the alternative is Hugeicons Pro | Lucide is on every shadcn-style app. Phosphor's 6 weights work as a system: Light for navigation, Regular for actions, Fill or Duotone for the active state. Spartan already renders icons through `ng-icons`, so swapping sets is cheap. |
| Generative UI runtime | **Hashbrown** (`@hashbrownai/angular`, with its Anthropic adapter) | Angular-native: signals, `exposeComponent()`, `uiChatResource`, and streaming JSON. It renders our own components. |
| Generative UI model | A strict **component catalog** (KPI strip, metric chart, table, comparison, occupancy calendar, insight, action proposal, form, empty state). Add a sandboxed iframe escape hatch only if it is ever needed. | Consistent, premium and accessible. Matches JUYO_CONTEXT §8.3: one spec shared by people and the AI. |
| Data in generated UI | The model emits **queries/metric references, never numbers**. Components fetch their own data. | No hallucinated numbers, and widgets stay live. |
| Skeletons | Every catalog component has a **skeleton with identical dimensions**. There are 3 phases: component chosen → skeleton; props streaming → fill in progressively; data loading → skeleton only on the data area. Show it for at least ~300 ms, use a subtle shimmer, and respect `prefers-reduced-motion`. | Perceived speed and no layout shift. |
| Semantic search (RAG) | **Reviews only**, as `find_reviews`: Workers AI `@cf/baai/bge-m3` (1024 dims) over review sentences in pgvector, next to the data | Numbers stay in SQL: a metric must be computed exactly from sums, and a nearest-neighbour lookup can only approximate it. RAG is for unstructured text, where the question is "what do guests say about X?" and the wording varies. The vectors sit in the same Postgres as the reviews, so one query filters by hotel and period, then ranks by meaning and counts mentions. |
| Charts | Our own chart **spec** sits between the model and the library. The leading renderer is **ECharts 6**. Spartan's chart, which is built on TanStack Charts 0.16, gets a visual bake-off. | The library can be swapped without touching prompts. TanStack Charts is still young. |

## Open (to discuss next)

1. What to carry over from the POC: the domain only, or also the backend (Hono, PGlite, Claude pipeline, Cloudflare deploy)?
2. The MCP server over the data, which is a Juyo bonus point. Where does it sit relative to Hashbrown's tool calling?
3. The Claude models to use, and where the Hashbrown backend runs (Worker or Container).
4. Visual direction: dark-first or light-first, the font (Geist or Inter 4, with tabular numbers), the accent color, and which Spartan style to start from.
5. Final icon pick: Phosphor (free) or Hugeicons Pro ($49).
6. Scope against the deadline. See `JUYO_CONTEXT.md` §1 and §10.

## Known friction to check during setup

- Spartan helm's peer range is `@ng-icons/*` 32–33 (the latest is 36), and its repo still develops on Angular 21.2. Expect small version fixes.
- Spartan's CLI depends on Nx. Check that it works in a plain Angular CLI workspace.
- Hashbrown is still 0.x (v0.5, July 2026), so keep it behind a thin layer of our own.
