# Copy-paste / own-the-code Angular component libraries (state as of 2026-11-20)

Method note: the GitHub numbers (stars, releases, commit counts, open issues) were pulled live with `gh api` on 2026-11-20. npm numbers are last-month downloads from `api.npmjs.org` and peer dependencies come from `registry.npmjs.org/<pkg>/latest`, also pulled that day. Commit counts are capped at 100 per query, so "100" means "at least 100".

## Which libraries exist, and what are their vital stats?

### Takeaway
Two serious full shadcn-style kits exist for Angular in late 2026: **Spartan UI** (brain + helm), the largest and most mature, and **Zard UI** (self-contained copy-in), which is younger, ships fast, and has slightly more components. Below them sits a primitives tier: **ng-primitives**, **radix-ng**, **@angular/aria** and the Angular CDK. Small newcomers build on those primitives: **Volt UI**, built on ng-primitives, and **Semantic Components**, built on @angular/aria + CDK. I found no maintained Angular port of Magic UI, Aceternity, Origin UI or Motion Primitives.

### Cited Findings

**Spartan UI (spartan-ng/spartan)**
- 3,002 stars, 341 forks, 91 open issues, repo created 2023-04-06. Latest release is v1.10.0 (2026-11-20). Stable releases came out roughly weekly from September to November 2026 (v1.5.0 on 09-21, v1.6.0 on 10-05, v1.7.0 on 10-14, v1.8.0 on 10-16, v1.9.0 on 10-29, v1.10.0 on 11-20). There were at least 100 commits in the last 90 days and at least 100 contributors. — [GitHub](https://github.com/spartan-ng/spartan), [releases](https://github.com/spartan-ng/spartan/releases)
- The README says "stable on the 1.x line: production-ready, semantically versioned, and shipping more than 55 components". The brain primitives are "inspired by Radix and built on the Angular CDK and other proven community solutions". Helm is deliberately not published as a package: "the CLI copies them straight into your project". — [README](https://github.com/spartan-ng/spartan)
- The docs sidebar lists 65 components (Accordion through Trace), utilities (Scroll Fade, Shimmer), Signal Forms and Reactive Forms pages, and a Blocks section. The docs claim signals, SSR compatibility and "zoneless ready". — [spartan.ng intro](https://spartan.ng/documentation/introduction)
- 1.0 shipped in June 2026. — [Thoughtworks Radar Vol. 35](https://www.thoughtworks.com/radar/languages-and-frameworks/spartan-ui), [changelog](https://www.spartan.ng/documentation/changelog), [1.0 announcement](https://dev.to/playfulprogramming-angular/announcing-spartanui-10-546o)
- `@spartan-ng/brain@1.10.0` declares peers `@angular/core >=21.0.0 <23.0.0`, `@angular/cdk >=21 <23`, `tailwindcss >=4.0.0` and `tw-animate-css`, and also luxon. Its only runtime dependency is tslib. Angular 22 is therefore inside the declared range. The repo's own workspace still pins Angular 21.2.x, so the CI may be exercising 21 rather than 22. — [npm](https://www.npmjs.com/package/@spartan-ng/brain), [package.json](https://github.com/spartan-ng/spartan/blob/main/package.json)
- npm, last month: `@spartan-ng/brain` 502,938 downloads; `@spartan-ng/cli` 350,294. — [npm API](https://api.npmjs.org/downloads/point/last-month/@spartan-ng/brain)
- The CLI (`@spartan-ng/cli`) is an Nx plugin plus Angular schematics, e.g. `ng g @spartan-ng/cli:init` and `ng g @spartan-ng/cli:ui button`. It depends on nx, @nx/angular and ts-morph. It also has a `migrate-cn` schematic that replaces clsx/tailwind-merge with its own `hlm()`/`cn` helper. — [npm](https://www.npmjs.com/package/@spartan-ng/cli), [theming docs](https://spartan.ng/documentation/theming)
- There are **6 visual styles**: nova, vega, lyra, maia, mira and luma (shadcn's v4-era named styles). The style is chosen at init and stored in `components.json`. Switching means editing `style` and regenerating components. — [spartan styles](https://spartan.ng/documentation/styles)
- Icons: the workspace uses `@ng-icons/lucide`, `@ng-icons/remixicon` and `@ng-icons/tabler-icons` (all ^32), matching compass's `@ng-icons` stack. — [package.json](https://github.com/spartan-ng/spartan/blob/main/package.json)

**Zard UI (zard-ui/zardui)**
- 1,213 stars, 99 forks, only 3 open issues, repo created 2025-03-05. Latest release is v1.12.0 (2026-11-14). It released very rapidly: v1.1.2 to v1.12.0 between 2026-11-04 and 11-14, with several releases on some days. About 95 commits in the last 90 days. — [GitHub](https://github.com/zard-ui/zardui), [releases](https://github.com/zard-ui/zardui/releases)
- The repo workspace is on **Angular 22.2.x, @angular/cdk 22.2.7, Tailwind ^4.3, @ng-icons/lucide ^36, class-variance-authority, and tailwind-merge ^3**. That is exactly compass's stack, so it is the only kit verified to develop against Angular 22 in its own repo. — [package.json](https://github.com/zard-ui/zardui/blob/master/package.json)
- The docs sidebar lists about 67 components plus an "AI Elements" section of 21 components. It also has Blocks, Charts, Maps, a Themes generator (`/themes`), an MCP Server, Registry docs, and Signal, Reactive and Template-driven forms pages. — [zardui.com intro](https://zardui.com/docs/introduction)
- Primitives: there is no npm primitive package. The whole component is copied in. Overlays (dialog, alert-dialog, sheet, drawer, tooltip, popover, select, dropdown, hover-card) import `@angular/cdk` directly, according to a code search of `libs/zard/src/lib/shared/components/*`. I found no `@angular/aria` usage. — [GitHub code](https://github.com/zard-ui/zardui/tree/master/libs/zard/src/lib/shared/components)
- `zard-cli` has no peer dependencies (it uses commander, execa, zod and @antfu/ni) and gets about 22,775 downloads a month. That is roughly 22 times fewer than Spartan's brain package, though Zard has no runtime package, so the comparison undercounts it. — [npm](https://www.npmjs.com/package/zard-cli)
- Earlier docs and articles cited Angular 19+; a third-party comparison noted Zard had "~35 components" at the time. Both are outdated. — [shadcnstudio](https://shadcnstudio.com/blog/using-shadcn-with-angular/)

**ng-primitives (Angular Primitives)**
- 616 stars, 63 open issues, v0.132.0 released 2026-11-19 (still 0.x after 132 minors, so it has a high churn cadence), at least 97 commits in the last 90 days. Peers: Angular `^21 || ^22`, cdk, `@floating-ui/dom`. 191,412 downloads last month. — [GitHub](https://github.com/ng-primitives/ng-primitives), [npm](https://www.npmjs.com/package/ng-primitives)
- Headless and unstyled. Claims every primitive meets accessibility standards (keyboard and ARIA roles) and "fully supports Zoneless Angular". Installed with `ng add ng-primitives` and schematics. — [angularprimitives.com](https://angularprimitives.com/)

**radix-ng/primitives**
- 278 stars, v1.3.0 (2026-11-08), peers Angular `^21 || ^22`, @floating-ui and @internationalized/date. Describes itself as "headless, signals-first UI primitives for Angular" (a Radix port). About 15k downloads a month. No styled layer. — [GitHub](https://github.com/radix-ng/primitives), [radix-ng.com](https://radix-ng.com)

**@angular/aria (official)**
- v22.3.0, peer `@angular/core ^22 || ^23`, 762,679 downloads last month. This is the official headless ARIA-pattern layer, with no styles. — [npm](https://www.npmjs.com/package/@angular/aria)

**Volt UI (Andersseen/volt-ui), 2026 entrant**
- 2 stars, created 2026-03-09, pushed 2026-11-18. v1.3 claims **Angular 21.2 and 22 verified**, Tailwind v4, CVA, and ng-primitives underneath. It ships 44 components, either as an npm package or as copy-and-own source via `@voltui/cli`. It also has a theme builder, an MCP server, Storybook and cross-browser tests. — [README](https://github.com/Andersseen/volt-ui), [voltui.dev](https://voltui.dev), [Medium (403 on fetch)](https://medium.com/@andriipap/building-volt-ui-bringing-shadcn-ui-philosophy-to-angular-e8a66d152cd5)

**Semantic Components (gridatek/semantic-components)**
- 23 stars, created 2024-11, pushed 2026-11-20. The workspace runs Angular 22.2 with **@angular/aria 22.2.7** and CDK, plus Tailwind ^4.3. It is "heavily inspired by shadcn/ui" and uses slot-based composition. It is the only kit found built on the official @angular/aria. — [GitHub](https://github.com/gridatek/semantic-components), [dev.to](https://dev.to/gridou/meet-semantic-components-a-modern-angular-ui-library-3352), [site](https://www.semantic-components.com)

**Animated "Magic UI / Aceternity" style for Angular**
- Searches turned up only React originals (Magic UI has 150+ components; Aceternity has 104 free and 130 pro blocks) and Svelte ports. I found no Angular port. — [designrevision](https://designrevision.com/alternatives/magic-ui), [ui.aceternity.com llms.txt](https://ui.aceternity.com/llms.txt)
- Andersseen's "stack" lists an "Angular Movement" animation library alongside Volt UI. It has 0 stars and I did not verify it. — [andersseen-stack](https://github.com/Andersseen/andersseen-stack)

**Not shadcn-style but mentioned in 2026 roundups:** Taiga UI, PrimeNG, Angular Material/CDK, NG-ZORRO, Kendo, DevExtreme and Ignite UI are all npm-installed rather than copy-paste. — [modernlearner 2026](https://www.modernlearner.org/ui-frameworks-for-angular-2026/)

### Inferences
- "Hlm" is not a separate library. It is Spartan's helm prefix (`hlm*` directives, the `hlm()` helper).
- No Angular library implements the official shadcn registry protocol (i.e. `npx shadcn add <angular-url>`). Spartan and Zard each have their own CLI and a `components.json`-like config. Zard documents a "Registry" section, but I did not confirm whether it is shadcn-protocol compatible.
- The primitives tier (ng-primitives, @angular/aria, CDK) is where "built on primitives" is real. Zard's own behaviour code (focus, keyboard, roving tabindex) is hand-rolled per component, with CDK only for overlays.

### Gaps
- I could not verify "shadcn-ng", "ngxui", "Analog UI" or "ngx-aceternity" as real, maintained repos. A GitHub search for `shadcn angular` returned only repos with 0–1 stars. Treat them as non-existent or insignificant unless the user has a specific URL.
- Spartan's exact Angular 22 verification: the peers allow it, but the repo is on 21.2. The Version Support page was not fetched.
- Spartan's block count and Zard's block count are unknown. Zard's Registry docs page and whether its MCP and registry follow the shadcn JSON schema were not fetched.

## Accessibility, theming, and the "premium vs generic shadcn look" question

### Takeaway
Spartan and Zard both copy shadcn's token system nearly 1:1. Both use OKLCH CSS variables in `:root`/`.dark`, Tailwind v4 `@theme inline`, a single `--radius`, and the same five base colours (neutral, stone, zinc, gray, slate). So **tweakcn-style themes should port to either with little effort**, and neither will look premium out of the box. Spartan's 6 named styles (nova, vega, lyra, maia, mira, luma) are the only built-in way to step away from the default look. Zard counters with a theme generator and AI-Elements components.

### Cited Findings
- Zard theming uses tokens in `src/styles.css` (`:root`, `.dark`) in OKLCH, with surface/foreground pairs (`--primary`/`--primary-foreground`) and 32 tokens (base, surface, form, chart, sidebar). `@theme inline` maps `--color-primary: var(--primary)`. `--radius` drives sm/md/lg/xl via calc. There are 5 base colours: Neutral, Stone, Zinc, Gray, Slate. A theme generator at `/themes` exports CSS. Dark mode uses `@custom-variant dark (&:is(.dark *))` plus a `ZardDarkMode` service. Theming can be scoped by redefining tokens under a container class. It requires the `tailwindcss-animate` plugin. tweakcn is not mentioned. — [zardui theming](https://zardui.com/docs/theming)
- Spartan theming uses CSS variables in `:root`/`.dark` with OKLCH values; `--primary`/`--primary-foreground`, `--card`, `--popover`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--sidebar-*` and `--chart-1..5`. Custom colours go through `@theme inline`. It has the same 5 base colours (Neutral, Stone, Zinc, Gray, Slate). Class merging goes through `hlm()`/`cn` with `createCn` for custom theme keys. tweakcn is not mentioned. — [spartan theming](https://spartan.ng/documentation/theming)
- Spartan has 6 styles (nova, vega, lyra, maia, mira, luma), chosen in `components.json` at init. — [spartan styles](https://spartan.ng/documentation/styles)
- Spartan's brain handles ARIA attributes, keyboard navigation and focus management; helm handles styling only. — [spartan intro](https://spartan.ng/documentation/introduction)
- ng-primitives claims accessibility standards for every primitive. — [angularprimitives.com](https://angularprimitives.com/)

### Inferences
- Because the variable names match shadcn's (OKLCH, `--primary`, `--sidebar-*`, `--chart-*`), a tweakcn export should drop into either library's `styles.css`. Font variables and shadow tokens may need manual `@theme inline` wiring. I have not tested this.
- Accessibility architecture: Spartan separates behaviour into a versioned, tested npm package (brain), so fixes arrive via `npm update`. Zard's behaviour lives in copied code, so a11y fixes require re-running the CLI or merging diffs by hand. For the AXE/WCAG AA mandate in compass's CLAUDE.md, Spartan's brain is structurally safer. I found no independent AXE audit of either library.
- "Premium" will come from compass's own tokens, typography and motion layered on top, not from the library choice. Spartan's alternative styles give more starting points; Zard's code is easier to restyle wholesale because nothing is hidden in a package.

### Gaps
- I found no published AXE or a11y audit of Spartan, Zard, Volt or Semantic Components.
- Visual quality of Spartan's six styles versus Zard's default was not assessed; this needs a screenshot comparison.

## Weaknesses and community sentiment

### Takeaway
Community signal is thin. There is no head-to-head Spartan vs Zard thread on Reddit. The most authoritative external view is Thoughtworks Radar Vol. 35 (Nov 2026), which places Spartan in "Assess" because of rough edges when upgrading styled components through the CLI. That is the inherent cost of copy-paste. Zard's launch drew solid Reddit interest, but its very fast release churn and small bus factor are the risks.

### Cited Findings
- Thoughtworks Radar Vol. 35 (2026-11-04) puts spartan/ui in **Assess**. It calls it "a credible Angular Material alternative" and says a Thoughtworks team used it to build a branded component library. Reached 1.0 June 2026 "but is still young". Rough edges in "the CLI upgrade path for styled components". — [Thoughtworks Radar](https://www.thoughtworks.com/radar/languages-and-frameworks/spartan-ui)
- Spartan's most-discussed open issue is #926, "warn about modifications in hlm library migrator" (15 comments), which confirms the pain of upgrading code you have edited locally. #32, "Examples of how to wrap Brain components", is still open. #1070 asks for a Presence directive for conditional rendering with animation, so animation support is still a known gap. — [spartan issues](https://github.com/spartan-ng/spartan/issues)
- An older r/angular "state of Angular" comment called Spartan "in early alpha, and not really moving forward". It predates 1.0 and the current cadence. A team blog also rejected Spartan while it was in alpha because of breaking changes. — [r/angular thread mirror](https://redlib.hackliberty.org/r/angular/comments/1ky0t8l/state_of_angular), [orvorkay substack](https://orvorkay.substack.com/p/building-an-angular-ui-library-how?r=25sqj)
- The Zard UI Beta 1.0 r/angular launch post had about 112 upvotes and 57 comments; comments questioned the name, and maintainers promised to track new Angular releases. — [r/angular mirror](https://reddit.zackpollard.pro/r/angular/comments/1mu2dsr/zardui_beta_10_the_shadcnui_alternative_for)
- Zard's closed issues include "migrate icon component from lucide-angular to ng-icons" (#482) and "Update project to Angular21" (#388). — [zard issues](https://github.com/zard-ui/zardui/issues)
- A 2026 article called Spartan "the de-facto 'Shadcn for Angular'". Its cons: community-maintained, and updates lag shadcn (e.g., charts). — [stow.build, 2026-01-04](https://www.stow.build/blog/shadcn/shadcn-angular)
- One comparison: "Spartan is the safer pick for a long-lived app, while Zard is quicker to start with." — [shadcnstudio](https://shadcnstudio.com/blog/using-shadcn-with-angular/)

### Inferences
- Zard's 3 open issues against Spartan's 91 most likely reflect lower adoption and aggressive closing, not higher quality.
- Zard shipping 12 minor versions in 10 days (Nov 2026) suggests rapid feature work, but it also means the copied code drifts quickly from upstream.
- Neither library has motion or "premium" effects built in. Animated hero and marketing effects will have to be custom-built (e.g., Angular animations, CSS, or the Motion library), because no Angular Magic UI/Aceternity port exists.

### Gaps
- I found no 2026 Reddit, X or HN threads directly comparing the libraries. Bluesky and X were not searched.

## Zard UI vs Spartan for compass: switch, combine, or stay?

### Takeaway
**Stay on Zard as the base.** It already matches compass's exact stack (Angular 22.2, cdk 22, Tailwind 4.3, `@ng-icons/lucide` 36, CVA, tailwind-merge), it has slightly more components plus AI Elements, and switching costs more than it gains. **Borrow selectively**: hand-port individual Spartan helm components or styles (e.g., a nova or maia variant) where Zard is weak. Use **ng-primitives** or **@angular/aria** as the behaviour layer for any new complex widget that compass builds itself. Mixing two full kits wholesale would duplicate tokens and the `cn` helpers (Spartan's `hlm()` vs Zard's tailwind-merge), so it is not advised.

### Cited Findings
- Zard's repo uses Angular 22.2.6, cdk 22.2.7, Tailwind ^4.3, @ng-icons/lucide ^36, CVA ^0.7.1 and tailwind-merge ^3.6. — [zard package.json](https://github.com/zard-ui/zardui/blob/master/package.json)
- Spartan's repo uses Angular 21.2.x and @ng-icons ^32. Brain peers allow Angular below 23. Helm uses its own `hlm()`/`cn` and offers a migrator away from clsx/tailwind-merge. — [spartan package.json](https://github.com/spartan-ng/spartan/blob/main/package.json), [spartan theming](https://spartan.ng/documentation/theming)
- Both use the same token names, OKLCH, and 5 base colours, so a theme moves across without changes. — [zard theming](https://zardui.com/docs/theming), [spartan theming](https://spartan.ng/documentation/theming)
- Scale: Spartan has 3.0k stars and ~503k brain downloads a month; Zard has 1.2k stars and ~23k CLI downloads a month. — GitHub/npm data above
- Components: Spartan about 65 in the docs ("55+" in the README); Zard about 67 plus 21 AI Elements. — [spartan](https://spartan.ng/documentation/introduction), [zard](https://zardui.com/docs/introduction)

### Inferences
- **Reasons to switch to Spartan:** a bigger community; a versioned brain that delivers accessibility fixes via npm; 6 alternative styles; an external endorsement (Thoughtworks Assess, used by a real team for a branded system). These matter most if compass will be long-lived and must pass AXE audits with less in-house effort.
- **Reasons to stay on Zard:** a stack already aligned to Angular 22; no Nx dependency in the CLI (Spartan's CLI pulls nx and @nx/angular, which works in plain Angular CLI workspaces but is heavier); AI Elements fit compass's AI-assistant use case; migration cost is near zero.
- **Combining is viable at the primitive level:** `@spartan-ng/brain` (peers Angular 21–22, cdk) or ng-primitives can be installed alongside Zard, with brain directives wrapped in Zard-styled templates for components where Zard's hand-rolled behaviour is weaker (e.g., combobox, menus, date pickers). Verify keyboard and AXE behaviour per component first.
- The "premium, not AI-slop" look is mainly a token, typography, spacing, shadow and motion problem; neither library solves it out of the box.

### Gaps
- No side-by-side AXE run of the same component (e.g., combobox, select, menu) in Zard vs Spartan. This is the most decision-relevant test still to do.
- Not verified whether Spartan's CLI works cleanly in a non-Nx Angular 22 workspace with Zard already initialised (both write a `components.json`, so a conflict is possible).
