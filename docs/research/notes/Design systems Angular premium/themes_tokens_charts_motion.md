# Premium design-system tooling for Angular 22 + Tailwind v4 (themes, tokens, kits, charts, motion, icons, fonts) — as of Nov 2026

Context: "compass" hotel dashboard: Angular 22, Tailwind v4, Zard UI (shadcn-style, CSS variables), ECharts via ngx-echarts, @ng-icons/lucide.

## 1. Theme generators and token tools compatible with shadcn-style CSS variables

### Takeaway
tweakcn is the most direct fit. It is a visual shadcn theme editor that exports Tailwind v4 CSS variables in OKLCH, and those drop straight into Zard UI's `:root`/`.dark` variables because Zard uses the same shadcn variable names. For a more distinctive, accessible palette, generate ramps with Adobe Leonardo, which is contrast-based, outputs OKLCH, and also produces data-viz scales. Then map them onto the shadcn variables in a Tailwind v4 `@theme` block.

### Cited Findings
- tweakcn is a no-code visual editor for shadcn/ui themes with sliders, color pickers and live preview. It supports Tailwind v3 and v4 and can switch between OKLCH and HSL color modes. — [Tailkits: tweakcn](https://tailkits.com/tools/tweakcn/); [Product Hunt: tweakcn](https://www.producthunt.com/p/tweakcn-3/tweakcn)
- Exported tweakcn CSS variables drop into the Tailwind v4 theme file. — [Tailkits](https://tailkits.com/tools/tweakcn/)
- In Tailwind v4, theme configuration moved into CSS via `@theme`, with variables declared in the stylesheet. — [21st.dev: shadcn theming with CSS variables](https://21st.dev/blog/shadcn-theming-css-variables)
- Third-party theme pickers built on tweakcn presets exist, such as tweakcn-theme-picker (OKLCH/HSL/HEX/RGB, v4 + OKLCH by default) and themux, another shadcn customizer with Tailwind v4 and OKLCH. These are not official tweakcn projects. — [GitHub: tweakcn-theme-picker](https://github.com/BankkRoll/tweakcn-theme-picker); [GitHub: themux](https://github.com/jsdev-robin/themux)
- Adobe Leonardo is an open-source, contrast-based tool for accessible color systems for UI and data visualization. It ships as a web app ([leonardocolor.io](https://leonardocolor.io/)) and an npm package `@adobe/leonardo-contrast-colors`. It is Apache 2.0 licensed and outputs HEX, RGB, HSL, LAB, LCH, CAM02, OKLAB and OKLCH. — [GitHub: adobe/leonardo](https://github.com/adobe/leonardo); [npm](https://npmjs.com/package/@adobe/leonardo-contrast-colors)
- Leonardo also generates color scales for data visualization (sequential/diverging), which helps keep chart colors consistent with the UI theme. — [Nate Baldwin: Color scales for data viz in Leonardo](https://medium.com/@NateBaldwin/color-scales-for-data-visualization-in-leonardo-bf206feb61b9)
- Tailwind v4, Radix Colors, Culori and most modern design-system tooling work in OKLCH. — [Medium: Tools for creating a color palette](https://medium.com/@ollie_w/tools-for-creating-a-color-palette-c0c79d51e362) (secondary source)

### Inferences
- Zard UI uses shadcn variable names (`--background`, `--primary`, `--chart-1..5`, etc.), so a tweakcn export is roughly a paste-in replacement for the Zard theme block. Check this against the Zard theming docs (`get-docs` via the zard-ui MCP).
- A good recipe for a non-generic look: pick a brand hue (for a hotel, perhaps a deep ink/navy, a warm brass or a muted green). Generate neutral and accent ramps in Leonardo at target contrast ratios, so WCAG AA, which the project's CLAUDE.md requires, is built in. Then feed them into tweakcn or hand-write the `@theme`. Tinted neutrals (grays with a slight brand hue) instead of pure zinc/slate are a common signal of a "designed" palette.
- Map the `--chart-1..5` variables to the Leonardo data-viz scale, so ECharts and the UI share one source of truth.

### Gaps
- No search results covered Huetone, uicolors.app or the current Radix Colors tooling directly, so their features and licensing are unverified here.
- I could not reach the official tweakcn site or docs. The current export format (exact variable set, whether `@theme inline` is emitted) comes from secondary listings.
- I found no source ranking which generator produces the most "premium" palettes. That is a subjective, design-level judgment.

## 2. Premium UI kits and templates portable to Angular

### Takeaway
Big change in 2026: Tailwind Labs joined Shopify on Sept 9, 2026 and closed new sign-ups for Tailwind Plus (including Catalyst). Unless the user already owns a license, Tailwind Plus is no longer purchasable. The best portable sources now:
- Preline and Flowbite, which are framework-agnostic HTML/Tailwind and have Angular guides or packages.
- Tremor Blocks, which became free and MIT after Vercel acquired Tremor. They are React, but useful as dashboard and chart design references.
- Angular-native shadcn ports: Spartan, plus the project's existing Zard UI and its blocks.

Untitled UI, Magic UI, Origin UI and Aceternity are React-only, so they can only serve as visual references or Figma sources.

### Cited Findings
- Tailwind Labs announced on September 9, 2026 that it is joining Shopify. New sign-ups for Tailwind Plus and ui.sh closed immediately, existing customers keep access, and Tailwind CSS stays MIT. — [Tailwind blog: Tailwind Labs is joining Shopify](https://tailwindcss.com/blog/tailwind-is-joining-shopify); [AlternativeTo news](https://alternativeto.net/news/2026/9/tailwind-labs-joins-shopify-and-keeps-tailwind-css-mit-licensed/); [CMSWire](https://www.cmswire.com/digital-experience/shopify-acquires-tailwind-labs-to-secure-css-framework/)
- The deal structure and terms were not disclosed. Some outlets call it an acquisition, others "joining." — [RuntimeWire](https://runtimewire.com/article/tailwind-labs-joining-shopify-undefined-deal)
- Catalyst was $149 one-time, built on React + Headless UI, licensed for unlimited personal and commercial projects. It is now effectively unavailable to new buyers. — [Tailwind Plus: Catalyst page](https://tailwindcss.com/plus/templates/catalyst); [Untitled UI blog](https://www.untitledui.com/blog/tailwind-plus-alternatives)
- Untitled UI React: free tier with MIT components, Pro from $349 lifetime, Figma kit kept in sync (a free Figma kit also exists). It is React only. (Source is Untitled UI's own blog, so it is not neutral.) — [Untitled UI blog](https://www.untitledui.com/blog/tailwind-plus-alternatives)
- The same comparison lists:
  - Preline: free tier; Pro $350 for 1 dev, Team $645; framework-agnostic HTML/React/Vue; free Figma.
  - Flowbite: MIT core; paid from $299; HTML, React, Vue, Svelte and Angular; Figma available.
  - Magic UI: MIT; Pro $199 lifetime; React.
  - daisyUI: MIT, pure CSS.
  - Tailark and AlignUI: React only.
  — [Untitled UI blog](https://www.untitledui.com/blog/tailwind-plus-alternatives)
- A different comparison quotes Flowbite Developer at €289 one-time and Preline Pro at €216 one-time (780 blocks, 21 templates). These prices conflict with the Untitled UI blog's figures, so check the vendor sites. — [devtoolpicks: Tailwind Plus alternatives 2026](https://devtoolpicks.com/blog/best-tailwind-plus-alternatives-indie-hackers-2026)
- Preline core is free for personal and commercial use under MIT plus the Preline UI Fair Use License, and Preline has an official Angular install guide. — [GitHub: preline](https://github.com/htmlstreamofficial/preline); [Preline docs: Angular](https://preline.co/docs/frameworks-angular.html)
- flowbite-angular is an open-source Angular component collection using Tailwind, with versions tracking Angular majors (e.g. 20.1.0). Its docs were noted as incomplete. — [unpkg: flowbite-angular README](https://app.unpkg.com/flowbite-angular@20.1.0/files/README.md)
- Vercel acquired Tremor in January 2025. Tremor Blocks (formerly the paid product) became free and open source (MIT), built on React, Tailwind and Radix. — [Vercel blog](https://vercel.com/blog/vercel-acquires-tremor)
- Since July 2024, Tremor Blocks have had copy-paste "Raw" variants in plain Tailwind without Tremor tokens, which makes the markup easier to port. — [Tremor Blocks changelog](https://blocks.tremor.so/changelog)
- shadcn has no official Angular implementation. shadcn blocks cannot be copied straight into Angular, but they work as layout references. — [shadcnstudio: using shadcn with Angular](https://shadcnstudio.com/blog/using-shadcn-with-angular/)
- Spartan (spartan/ui) is an Angular port of shadcn/ui. Its 1.0 is described as stable with 55+ components, split into the headless `@spartan-ng/brain` and copy-paste styled source. Thoughtworks Radar placed it in "Assess" and noted rough edges with CLI upgrades. — [GitHub: spartan-ng/spartan](https://github.com/spartan-ng/spartan); [Thoughtworks Radar](https://www.thoughtworks.com/radar/languages-and-frameworks/spartan-ui)
- Zard UI is a copy-paste shadcn-style Angular library, which launched in beta in Aug 2025. — [dev.to: ZardUI beta](https://dev.to/samuelrizzondev/zardui-beta-bringing-shadcnuis-philosophy-to-angular-where-you-own-every-line-of-code-2a79)

### Inferences
- The quickest premium gains come from markup that is already plain Tailwind:
  - Tremor Raw blocks: KPI cards, chart cards, tables and filter bars. They are React, but the class strings port directly into Angular templates.
  - Preline / Flowbite HTML blocks.
- Use Zard's own blocks (`list-blocks` / `get-block` in the zard-ui MCP) as the Angular-native baseline.
- Treat Untitled UI's free Figma kit as the visual spec for dashboard density and hierarchy (spacing, shadows, border radii).
- Because Tailwind Plus is closed to new customers, don't plan around buying Catalyst or Application UI.

### Gaps
- Not covered by results, so licensing and quality are unverified for: shadcnblocks.com pricing, Origin UI (now part of coss.com), HyperUI, Aceternity UI.
- Prior knowledge, uncited: HyperUI is free and MIT; Aceternity and Origin UI are React. Verify before relying on this.
- Flowbite and Preline Pro prices conflict between sources (USD vs EUR, different amounts).
- I did not confirm whether flowbite-angular has published an Angular 22-compatible major.

## 3. Premium charts for Angular dashboards

### Takeaway
Stay on ECharts and upgrade to ECharts 6. Its new token-based default theme and runtime `setTheme()` (no dispose/re-init) directly answer "premium look + dark mode." Drive its palette from the same CSS variables as the UI. Unovis (`@unovis/angular`) is the most "designer-ish" framework-native alternative. AG Charts has an official Angular wrapper and strong financial themes, but I could not confirm Angular 22 support.

### Cited Findings
- ECharts 6.0 features:
  - The default theme was rebuilt with design tokens (colors, spacing) for a more consistent look. The old look is still available via a `v5.js` theme.
  - It supports runtime theme switching without disposing and re-initializing the chart. It can follow `prefers-color-scheme` by calling `setTheme('dark' | 'default')`.
  - It adds gradient chord edges, broken axes and smarter axis-label layout. A custom-series project adds violin, contour, segmented doughnut, bar-range and line-range charts.
  — [ECharts 6 new features](https://echarts.apache.org/handbook/en/basics/release-note/v6-feature)
- Custom ECharts themes are registered with `echarts.registerTheme(name, obj)` and passed to `init`, or passed inline as an object. Themes can declare `darkMode`. — [ECharts handbook: style](https://echarts.apache.org/handbook/en/concepts/style); [ECharts custom themes (Mintlify mirror)](https://www.mintlify.com/apache/echarts/themes/custom-themes)
- Core ECharts does not read CSS variables natively. shadcn-vue-echarts shows the pattern: read shadcn CSS variables and detect `.dark` / `prefers-color-scheme`, then build the theme object. — [shadcn-vue-echarts theming guide](https://jtthompson1887.github.io/shadcn-vue-echarts/guide/theming.html)
- ngx-echarts is a community-maintained wrapper, so the Angular integration is not native. (Source is a vendor review by Telerik/Kendo.) — [Telerik: 10 best Angular chart libraries](https://www.telerik.com/blogs/10-best-angular-ui-chart-libraries)
- Unovis is a modular, framework-independent library by F5 for charts, maps and network graphs, supporting React, Angular, Svelte, Vue, Solid and vanilla TS. Install with `npm i @unovis/ts @unovis/angular`. Component APIs are the same across frameworks. It ships an `@unovis/mcp` server that renders chart previews. — [Unovis docs intro](https://unovis.dev/docs/intro)
- AG Charts has an official `ag-charts-angular` package (v14.x on npm) and built-in themes, including `ag-financial` / `ag-financial-dark` with `up`/`down` palette entries. — [npm: ag-charts-angular](https://www.npmjs.com/package/ag-charts-angular); [AG Charts themes API](https://ag-grid.com/charts/themes-api/); [Financial charts config](https://www.ag-grid.com/charts/angular/financial-charts-configuration/)
- An AG Charts changelog entry raised the minimum to Angular 18. I found no source confirming Angular 22. — [AG Charts changelog](https://ag-grid.com/charts/changelog/)

### Inferences
- Premium ECharts recipe for compass. It combines the cited capabilities with standard ECharts options.
  1. Build a theme from the `--chart-*`, `--muted-foreground` and `--border` variables at runtime (via `getComputedStyle`). Call `setTheme` when the dark class toggles.
  2. Use hairline or no axis lines, dashed low-contrast split lines, and few ticks.
  3. Use smooth lines with an `areaStyle` vertical `LinearGradient` fading from about 25% to 0% opacity.
  4. Use rounded bar tops (`borderRadius`), generous grid padding and no chart titles; title the card instead.
  5. Use custom HTML tooltips styled like Zard popovers, and `tabular-nums` fonts.
- Unovis is worth trialing for sparklines and KPI microcharts if ECharts feels heavy. Its SVG output and CSS-variable-driven styling fit shadcn aesthetics. That styling method is unverified here; see Gaps.

### Gaps
- Unovis license, theming method (CSS variables?) and Angular 22 compatibility were not stated on the fetched page.
- Not researched within the call budget: Highcharts (commercial license required for commercial use, per prior knowledge, unverified), Chart.js and ng2-charts.
- I did not confirm whether ngx-echarts has a release supporting Angular 22 together with ECharts 6. Check npm peerDependencies.
- No source found on ECharts gradient area-chart styling specifically. The recipe above is a design inference.

## 4. Motion and animation in modern Angular

### Takeaway
Use Angular's native `animate.enter` / `animate.leave` (v20.2+) with CSS transitions or keyframes for most enter/leave cases. `@angular/animations` is deprecated. For springs, layout-y or orchestrated sequences, call Motion (motion.dev, vanilla `animate`) or GSAP from the `(animate.enter)` / `(animate.leave)` event bindings.

### Cited Findings
- Angular provides `animate.enter` and `animate.leave`. They apply CSS classes at the right times, or call functions that use third-party libraries such as GSAP or anime.js. — [Angular docs: enter and leave animations](https://angular.dev/guide/animations/migration); [v20 animations guide](https://v20.angular.dev/guide/animations)
- `@angular/animations` was deprecated as of v20.2, when `animate.enter` / `animate.leave` were introduced. Legacy animations cannot be mixed with the new API in the same component. — [Angular legacy animations guide](https://angular.dev/guide/legacy-animations); [dev.to migration guide](https://dev.to/aminkarimi_sis/goodbye-angularanimations-how-to-migrate-to-angular-20s-modern-animation-api-37d0)
- With a function-based `(animate.leave)`, you must call `animationComplete()`, or Angular removes the element after a default 4s timeout (configurable via `MAX_ANIMATION_TIMEOUT`). — [angular.jp: enter and leave](https://angular.jp/guide/animations/enter-and-leave)
- Motion (motion.dev) is framework-agnostic. Its vanilla `animate()` supports springs (`type: spring` with `stiffness`, or duration plus `bounce`), and there is a smaller `motion/mini` build. — [motion.dev quick start](https://motion.dev/docs/quick-start); [motion.dev spring](https://motion.dev/dom/spring); [JS spring example](https://motion.dev/examples/js-spring)
- An Angular + Motion One tutorial shows element refs plus `animate()` in component methods. It was written for Motion One, the predecessor, so APIs may differ. — [dev.to: Animate your Angular app using Motion One](https://dev.to/playfulprogramming-angular/animate-your-angular-app-using-motion-one-4bg3)
- Modern Angular animation articles promote dropping the DSL in favor of native CSS plus `animate.*`. — [Brian Treese: Modern Angular animations](https://dev.to/brianmtreese/modern-angular-animations-ditch-the-dsl-keep-the-power-76d)

### Inferences
- Micro-interaction set for a premium dashboard:
  - 150–250 ms ease-out transitions on hover, focus and press. For press, use `scale(0.98)`.
  - Staggered fade-up of KPI cards on route enter, using CSS `@starting-style` or `animate.enter` with `--i` delay.
  - Count-up numbers via Motion `animate(0, value, { onUpdate })`.
  - Dialogs and popovers scale from 0.96 plus fade.
  - ECharts' own entry animation, kept short (`animationDuration` of about 600 ms).
  - Honor `prefers-reduced-motion` throughout.
- The project already has relevant skills installed: `emil-design-eng`, `animate` and `improve-animations`.

### Gaps
- GSAP licensing: from prior knowledge, GSAP became fully free (including plugins) after Webflow acquired it in 2024–25. I did not verify this in this session.
- No official motion.dev Angular integration page was found.
- I did not verify the View Transitions API with the Angular router (`withViewTransitions`) in this session.

## 5. Icon sets beyond Lucide and their Angular packages

### Takeaway
ng-icons, already in use, covers the main premium alternatives as drop-in packages. Swapping or adding a set is just a new `@ng-icons/*` install:
- Phosphor: `@ng-icons/phosphor-icons`, MIT, multiple weights including duotone.
- Tabler: `@ng-icons/tabler-icons`, MIT.
- Hugeicons: `@ng-icons/huge-icons`, CC0 free set. Hugeicons also has an official `@hugeicons/angular`.
- Iconoir: `@ng-icons/iconoir`, MIT.
- Radix: `@ng-icons/radix-icons`, MIT.

### Cited Findings
- ng-icons package names and licenses:
  - `@ng-icons/phosphor-icons` (MIT)
  - `@ng-icons/huge-icons` (CC0-1.0)
  - `@ng-icons/tabler-icons` (MIT)
  - `@ng-icons/iconoir` (MIT)
  - `@ng-icons/radix-icons` (MIT)
  - plus Heroicons, Ionicons, Material, Feather, Octicons, Akar, Simple Icons and more.
  — [ng-icons GitHub](https://www.Github.com/ng-icons/ng-icons); [@ng-icons/core README](https://cdn.jsdelivr.net/npm/@ng-icons/core@33.2.1/README.md); [@ng-icons/phosphor-icons](https://socket.dev/npm/package/@ng-icons/phosphor-icons/overview/32.4.0); [@ng-icons/radix-icons](https://packages.ecosyste.ms/registries/npmjs.org/packages/@ng-icons%2Fradix-icons)
- Hugeicons publishes its own Angular package, `@hugeicons/angular`, independent of ng-icons. — [Hugeicons: best Angular icon libraries](https://hugeicons.com/blog/development/best-angular-icon-libraries) (vendor blog)
- A 2026 roundup of free icon libraries for UI design exists, useful for visual comparison. — [Muzli: Best free icon libraries 2026](https://muz.li/blog/best-free-icon-libraries-for-ui-design-in-2026/)

### Inferences
- Phosphor in "light" or "regular" weight, or Hugeicons stroke-rounded, reads less generic than Lucide, which is ubiquitous in shadcn apps. Phosphor's duotone weight suits KPI and empty-state accents.
- Keep one set for consistency, and set stroke width deliberately: around 1.5 at 20px.

### Gaps
- Not verified: Central Icons and Streamline (both commercial), Hugeicons Pro pricing and the full style count of the free set.
- Not verified: whether the ng-icons Phosphor package includes all six weights.

## 6. Fonts that read premium for dashboards

### Takeaway
The best free picks are:
- Inter 4 (OFL; has `opsz` optical sizing, so Display styles are automatic at large sizes; tall x-height; slashed zero), the strongest for dense numeric dashboards.
- Geist + Geist Mono (OFL, Vercel), which looks crisper and more "Vercel-premium."

Satoshi (ITF Free Font License) is free for commercial use but forbids modification, subsetting or format conversion, and redistribution in public repos. Its small x-height makes it weak at 12–14px, so use it for headings only.

### Cited Findings
- Geist is licensed under SIL OFL 1.1 and available via GitHub, npm (`geist`) and Fontsource. — [GitHub: vercel/geist-font](https://github.com/vercel/geist-font); [Fontsource: Geist](https://fontsource.org/fonts/geist/about); [Vercel: Geist](https://vercel.com/font/geist)
- A font comparison found:
  - Inter: OFL; v4.0 (Nov 2023) added the `opsz` axis (14–32); x-height 0.546; slashed zero; Cyrillic, Greek and Vietnamese support. Recommended for dense, numeric products.
  - Geist: about 29 KB Latin WOFF2, pairs with Geist Mono, no slashed zero. Its README calls it display-first.
  - Satoshi: ITF Free Font License v2.0 allows commercial use and self-hosting, but forbids modification ("explicitly includes subsetting and format conversion") and redistribution, including public repos. x-height 0.484 makes it weakest at 12–14px.
  - None of the three enables tabular figures by default, so set `font-variant-numeric: tabular-nums` on metrics and tables.
  - Suisse International is a paid family that Geist approximates for free.
  — [fontalternatives.com: Geist vs Inter vs Satoshi](https://fontalternatives.com/blog/geist-vs-inter-vs-satoshi-product-ui/)

### Inferences
- For compass, a premium pairing is Inter (variable, `opsz`) or Geist for UI with Geist Mono for IDs and codes. An optional serif display face for the hotel brand (e.g. headings) adds hospitality character, but choose an OFL one.
- Satoshi's no-subsetting rule matters if the build pipeline subsets or converts fonts. Avoid it, or ship the files unmodified and keep them out of public repos.

### Gaps
- Not verified: General Sans license (Indian Type Foundry/Fontshare, likely the same ITF Free Font License, unconfirmed); Söhne pricing (Klim, commercial); Inter Display as a separate family vs the `opsz` axis.
- No independent source ranks fonts by "premium" perception. That is subjective.
