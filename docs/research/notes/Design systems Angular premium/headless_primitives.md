# Headless / Unstyled Primitive Libraries for Angular (state as of 2026-11-20)

Method note: repo stats (stars, last push, latest release) were pulled via the GitHub API, and versions, peer deps, entry points and weekly downloads via the npm registry/API on 2026-11-20. These are point-in-time values. Compass currently has `@angular/core ^22.2`, `@angular/cdk ^22.2.6`, `tailwindcss ^4.1.12`, `tailwind-merge`, `tailwindcss-animate` (from /Users/razvan/Web/compass/package.json). It has no primitive library yet.

## Angular Aria (@angular/aria): coverage, stability in v22, API style, a11y

### Takeaway
Angular Aria is official and stable in v22, and the most-downloaded headless option after the CDK. It covers only about 12 composite-widget WAI-ARIA patterns (listbox, combobox/select/multiselect/autocomplete, menu/menubar, toolbar, tabs, accordion, tree, grid). It has no dialog, popover, tooltip, toast, slider, date picker, checkbox/switch or overlay of its own, and relies on CDK Overlay for popups.

### Cited Findings
- The roadmap says v21 launched Angular Aria in developer preview "providing eight patterns", and that in v22 "we promoted Angular Aria to stable", with plans to "introduce new patterns where needed". — [Angular roadmap](https://angular.dev/roadmap)
- Angular 22 was released June 3, 2026, with "Stable accessible components with Angular ARIA" (secondary source). — [Wikipedia: Angular](https://en.wikipedia.org/wiki/Angular_(web_framework))
- The official overview (docs built at v22.3.0) lists these patterns: Autocomplete, Listbox, Select, Multiselect, Combobox, Menu, Menubar, Toolbar, Accordion, Tabs, Tree, Grid. It describes them as "headless, accessible directives that implement common WAI-ARIA patterns" handling keyboard interaction, ARIA attributes, focus management and screen-reader support. It recommends them for "design systems, enterprise component libraries, and custom branding". — [angular.dev/guide/aria/overview](https://angular.dev/guide/aria/overview)
- npm entry points for `@angular/aria@22.3.0` are accordion, combobox, grid, listbox, menu, tabs, toolbar, tree. Select, multiselect and autocomplete are compositions of combobox + listbox, not separate entry points. The peer deps are `@angular/cdk: 22.3.0` (exact pin) and `@angular/core ^22 || ^23`. — [npm @angular/aria](https://www.npmjs.com/package/@angular/aria)
- API style is attribute directives plus signals and two-way `model` bindings, e.g. `<div ngCombobox #combobox="ngCombobox" [(expanded)]="open">`, `ngComboboxPopup`, `ngListbox ngComboboxWidget focusMode="activedescendant" selectionMode="explicit"`, `ngOption [value] [label]`. The popup is rendered with CDK `cdkConnectedOverlay` (`usePopover: 'inline'`, `matchWidth: true`), and "CDK Overlay handles viewport edges and scrolling". — [angular.dev/guide/aria/select](https://angular.dev/guide/aria/select)
- The overview example still has the developer binding some state attributes (e.g. `aria-pressed`) manually. — [angular.dev/guide/aria/overview](https://angular.dev/guide/aria/overview)
- On a11y, the team says it is "continuously evaluating the components and patterns against accessibility standards such as WCAG". — [Angular roadmap](https://angular.dev/roadmap)
- Weekly downloads are about 225.6k (npm API, week ending 2026-11-20). Unpacked size is about 1.16 MB. — [npm downloads API](https://api.npmjs.org/downloads/point/last-week/@angular/aria), [npm](https://www.npmjs.com/package/@angular/aria)
- Version cadence: it ships in lockstep with angular/components (v22.3.0 released 2026-11-18; 22.4.0-next.0 the same day). — [angular/components releases](https://github.com/angular/components/releases)
- Pattern counts differ between sources: the roadmap says 8 at preview, the docs list 12–13 entries now, and a Nov 2025 article lists 12 for v21. — [Angular roadmap](https://angular.dev/roadmap); [dev.to (Nov 27 2025)](https://dev.to/hassantayyab/angular-aria-vs-angular-primitives-whats-the-difference-and-when-should-you-use-each-5f1)

### Inferences
- Aria is a "keyboard/ARIA brain" for list-like composite widgets, not a full primitive kit. A design system on Aria alone still needs dialog, popover, tooltip, toast, form controls (checkbox, switch, radio, slider), a date picker, and positioning (CDK Overlay or floating-ui).
- Being first-party and pinned to the CDK version means zero version-skew risk on Angular upgrades. That is the main strategic advantage.
- No found source says Angular Material is being rebuilt on Aria (the roadmap does not say so).

### Gaps
- No independent a11y audit (e.g. screen-reader matrix) of Angular Aria was found.
- No per-pattern gzipped bundle size data. Tree-shaken size per entry point was not measured.
- No confirmation of whether any new patterns (e.g. dialog/popover) are planned for v23.

## Angular CDK: what is still the best choice there

### Takeaway
The CDK (v22.3.0, about 5.8M weekly downloads) is still the foundation under nearly every Angular primitive library. Its overlay, a11y (FocusTrap, LiveAnnouncer, FocusMonitor, ListKeyManager), dialog, drag-drop, scrolling (virtual scroll), bidi, clipboard, text-field (autosize) and table entry points remain the default choices. Its older `cdk/listbox` and `cdk/menu` overlap with Aria's newer equivalents.

### Cited Findings
- `@angular/cdk@22.3.0` entry points include a11y, accordion, bidi, clipboard, collections, dialog, drag-drop, layout, listbox, menu, observers, overlay, platform, portal, scrolling, stepper, table, testing, text-field, tree. — [npm @angular/cdk](https://www.npmjs.com/package/@angular/cdk)
- The roadmap lists "zoneless support to the Angular CDK and Angular Material" as completed, and mixed-orientation drag-and-drop as completed. — [Angular roadmap](https://angular.dev/roadmap)
- The roadmap frames the choices as: custom components with Angular Aria, CDK interaction patterns, or ready-made Material. — [Angular roadmap](https://angular.dev/roadmap)
- Angular Aria uses CDK Overlay for its popups (the select guide uses `cdkConnectedOverlay`). — [angular.dev/guide/aria/select](https://angular.dev/guide/aria/select)
- `@angular/aria`, `ng-primitives`, `@spartan-ng/brain` and `@taiga-ui/cdk` all declare `@angular/cdk` as a peer dependency. — npm registry: [aria](https://www.npmjs.com/package/@angular/aria), [ng-primitives](https://www.npmjs.com/package/ng-primitives), [brain](https://www.npmjs.com/package/@spartan-ng/brain), [taiga cdk](https://www.npmjs.com/package/@taiga-ui/cdk)
- Weekly downloads for `@angular/cdk` are about 5.80M. — [npm downloads API](https://api.npmjs.org/downloads/point/last-week/@angular/cdk)

### Inferences
- The CDK is already installed in compass and is a transitive requirement of every serious option, so the CDK is not a choice. The real choice is what sits on top of it.
- For new work, prefer Aria's listbox/menu/tabs/tree over `cdk/listbox`, `cdk/menu` and `cdk/tree`'s keyboard handling, because Aria is the actively promoted, signal-based successor. Keep `cdk/overlay`, `cdk/dialog`, `cdk/a11y`, `cdk/drag-drop` and `cdk/scrolling`.
- CDK Overlay positioning is more limited and heavier than floating-ui (used by ng-primitives and radix-ng). This is a known trade-off from general knowledge, not verified in this session.

### Gaps
- No 2026 source was found that explicitly deprecates `cdk/menu` or `cdk/listbox` in favor of Aria.

## ng-primitives (angularprimitives.com): coverage, maintenance, Angular support, API quality

### Takeaway
ng-primitives has the widest pure-headless coverage in Angular: 45 primitives, including date picker, combobox, select, dialog, popover, tooltip, toast, slider/range slider, number field, OTP, color picker, file upload, navigation menu, context menu and table. It is very actively released (v0.132.0 on 2026-11-19), supports Angular 21–22, and is zoneless/SSR-ready. It is still pre-1.0 (0.x) and smaller-community (616 stars).

### Cited Findings
- It lists 45 primitives: Accordion, AI Assistant, Avatar, Breadcrumbs, Button, Checkbox, Collapsible, Color Picker, Combobox, Context Menu, Date Picker, Dialog, File Upload, Form Field, Icons, Input OTP, Input, Listbox, Menu, Meter, Navigation Menu, Number Field, Pagination, Password, Popover, Preview Card, Progress, Radio, Range Slider, Rating, Resize, Roving Focus, Search, Select, Separator, Slider, Switch, Table, Tabs, Textarea, Toast, Toggle Group, Toggle, Toolbar, Tooltip. It also has Interactions (Focus Visible, Focus, Hover, Move, Press) and Utilities (Autofill, Date Adapter, Focus Trap, Visually Hidden). — [angularprimitives.com intro](https://angularprimitives.com/getting-started/introduction)
- It "supports SSR … and Zoneless out of the box". "We don't provide any styles." Accessibility is a stated priority. — [angularprimitives.com intro](https://angularprimitives.com/getting-started/introduction)
- GitHub: 616 stars, about 1,281 commits, Apache-2.0. The lead contributor is Ashley Hunter. The compatibility table maps 0.121.0+ to Angular 21.x/22.x, 0.90–0.120 to 20/21, 0.19–0.89 to 19/20, and 0.1–0.18 to 18. — [github.com/ng-primitives/ng-primitives](https://github.com/ng-primitives/ng-primitives)
- Latest release is v0.132.0 (2026-11-19). The previous release was v0.131.4 (2026-10-28). Last push was 2026-11-19. — [GitHub releases](https://github.com/ng-primitives/ng-primitives/releases)
- Peer deps are `@angular/cdk ^21||^22`, `@angular/core ^21||^22`, `@angular/forms`, `rxjs`, and `@floating-ui/dom >=1.6.0` for positioning. — [npm ng-primitives](https://www.npmjs.com/package/ng-primitives)
- Weekly downloads are about 44.0k. — [npm downloads API](https://api.npmjs.org/downloads/point/last-week/ng-primitives)
- A Nov 2025 dev.to article characterizes "Angular Primitives" as focused on "interaction mechanics, not full ARIA patterns" and recommends pairing it with Angular Aria (Aria listbox + Primitives popover/focus). This is contradicted by the project's own docs, which list full widgets such as Combobox, Select, Tabs, Menu and Date Picker. Treat the article as low-reliability. — [dev.to](https://dev.to/hassantayyab/angular-aria-vs-angular-primitives-whats-the-difference-and-when-should-you-use-each-5f1) vs [angularprimitives.com](https://angularprimitives.com/getting-started/introduction)

### Inferences
- ng-primitives is the strongest single-dependency headless kit for a custom design system. It fills almost every gap Aria leaves (overlays, form controls, date picker, toast), and uses floating-ui for positioning.
- The 0.x versioning and frequent minor releases (about 2 per month) imply possible breaking changes. Pinning versions and reading changelogs is required. The bus factor appears concentrated on one lead maintainer.
- Its Angular support window (current + previous major) is similar to Angular's own support model.

### Gaps
- The docs intro does not state that the primitives are signal-based. Inspecting the source or API pages would confirm this (not done).
- No independent a11y audit found. Per-primitive bundle size not found.
- I did not verify whether ng-primitives has a command-palette primitive (none is listed; Search and Combobox exist).

## Spartan brain, Taiga UI CDK, radix-ng, Zag/Ark, Headless UI ports, @ngxpert, newcomers

### Takeaway
- **Spartan brain** is the most popular non-official headless layer (3.0k stars, about 125k weekly downloads, v1.10.0 released today). It is tied to the shadcn-style "helm" ecosystem and has Tailwind/tw-animate peer deps.
- **radix-ng** is a small but active, signals-first Base UI-aligned port.
- **Taiga UI CDK** is a utility layer, not a widget-primitive kit.
- **Zag.js** has only a community Angular adapter.
- No viable Headless UI (Tailwind Labs) Angular port was found.

### Cited Findings
**Spartan (brain/helm)**
- Brain is the "unstyled, accessible primitive layer" installed from npm and handling ARIA, keyboard and focus. Helm is the shadcn-style Tailwind layer copied into your codebase. Spartan is "built with signals, supports SSR" and is "zoneless ready". The site lists about 70 components including Autocomplete, Combobox, Command, Date Picker, Calendar, Dialog, Drawer, Hover Card, Popover, Tooltip, Select, Slider, Sonner (toast), Data Table, Input OTP and Resizable. — [spartan.ng introduction](https://www.spartan.ng/documentation/introduction)
- `@spartan-ng/brain@1.10.0` entry points: accordion, alert-dialog, autocomplete, avatar, button, calendar, checkbox, collapsible, combobox, command, date-picker, date-time (+luxon), dialog, drawer, field, forms, hover-card, input, input-otp, label, message-scroller, navigation-menu, overlay, popover, progress, radio-group, resizable, select, separator, sheet, slider, sonner, switch, tabs, textarea, toggle, toggle-group, tooltip. There are no menu/context-menu/menubar entries in brain, which suggests those live in helm on top of `@angular/cdk/menu` (inference). — [npm @spartan-ng/brain](https://www.npmjs.com/package/@spartan-ng/brain)
- Brain's peer deps are `@angular/cdk >=21 <23`, `@angular/core >=21 <23`, `@angular/forms`, `rxjs`, `luxon`, `tailwindcss >=4`, and `tw-animate-css`. — [npm @spartan-ng/brain](https://www.npmjs.com/package/@spartan-ng/brain)
- GitHub: 3,002 stars. v1.10.0 was released 2026-11-20 (betas the same day). — [github.com/spartan-ng/spartan](https://github.com/spartan-ng/spartan)
- Weekly downloads for `@spartan-ng/brain` are about 125.4k. — [npm downloads API](https://api.npmjs.org/downloads/point/last-week/@spartan-ng/brain)

**radix-ng (@radix-ng/primitives)**
- "Headless, signals-first UI primitives with first-class Angular Forms support". It began as a Radix UI port, "but its API and behavior now mainly follow Base UI". MIT, 278 stars, about 1,488 commits, supports Angular 21 and 22, with Signal Forms support. Date Picker, Date Range Field/Picker and Range Calendar are planned but not available. Docs are at radix-ng.com (with /llms.txt). — [github.com/radix-ng/primitives](https://github.com/radix-ng/primitives)
- `@radix-ng/primitives@1.3.0` (released 2026-11-08) entry points include accordion, alert-dialog, autocomplete, calendar, checkbox, combobox, context-menu, cropper, date-field, dialog, drawer, editable, menu, menubar, meter, navigation-menu, number-field, otp-field, pagination, popover, preview-card, scroll-area, select, signal-forms, slider, stepper, switch, tabs, time-field, toast, toggle-group, toolbar, tooltip, visually-hidden. Peer deps are `@floating-ui/dom`, `@internationalized/date` and `@internationalized/number`. It does not depend on the CDK. — [npm @radix-ng/primitives](https://www.npmjs.com/package/@radix-ng/primitives), [releases](https://github.com/radix-ng/primitives/releases)
- Weekly downloads are about 5.5k. — [npm downloads API](https://api.npmjs.org/downloads/point/last-week/@radix-ng/primitives)

**Taiga UI CDK**
- `@taiga-ui/cdk@5.33.0` (released 2026-11-16, with a parallel v4.109.0 line). It peers on `@angular/cdk >=19` plus a set of `@ng-web-apis/*`, `@taiga-ui/polymorpheus` and `@taiga-ui/event-plugins` packages. 4,097 repo stars. About 39k weekly downloads. — [npm @taiga-ui/cdk](https://www.npmjs.com/package/@taiga-ui/cdk), [github.com/taiga-family/taiga-ui](https://github.com/taiga-family/taiga-ui)

**Zag.js / Ark UI**
- Zag's official adapters are React, Vue, Solid, Svelte, Preact and vanilla. The Angular adapter `zag-angular` (makuko/zag-angular) is listed as "Community maintained", outside the official support/release process. — [zagjs.com framework adapters](https://zagjs.com/guides/framework-adapters)
- `zag-angular@0.7.0` (last modified 2026-04-26) peers on `@angular/core ^21.2.10`. That is Angular 21 only, with no Angular 22 range. The npm page showed about 28 weekly downloads at the time it was indexed. — [npm zag-angular](https://www.npmjs.com/package/zag-angular)
- Zag core repo: 5,290 stars, `@zag-js/core@1.48.0`. — [github.com/chakra-ui/zag](https://github.com/chakra-ui/zag)
- No official `@zag-js/angular` or Ark UI for Angular package exists on npm (`npm view @zag-js/angular` returned not found on 2026-11-20).

**Headless UI ports / @ngxpert / newcomers**
- No maintained Angular port of Tailwind Labs Headless UI was found (the GitHub repo `anglify/headless-ui` returned 404). A small repo "headless-ui-angular-aria" (melvinnjuguna) builds Headless-UI-style components on Angular Aria. It is a personal project. — [GitHub](https://github.com/melvinnjuguna/headless-ui-angular-aria)
- `@ngxpert/cmdk` v3.0.0 (2024-06-23) has had no release since. Last push was 2025-11-26, 74 stars, about 1.2k weekly downloads, peer `@angular/core >=18`. — [github.com/ngxpert/cmdk](https://github.com/ngxpert/cmdk), [npm](https://www.npmjs.com/package/@ngxpert/cmdk)
- `@ngxpert/hot-toast@7.0.0` peers on `@angular/core >=22`. The repo has 222 stars, last push 2026-09-23. The toast is styled, not headless. — [npm](https://www.npmjs.com/package/@ngxpert/hot-toast), [github.com/ngxpert/hot-toast](https://github.com/ngxpert/hot-toast)
- Newcomer: "AxisUI", a signals-first component library described in a dev.to post (styled, not a primitive layer, small). — [dev.to AxisUI](https://dev.to/kishan_hadiyal_8cf48e733d/closing-angulars-aesthetic-gap-1d26)
- Zard UI (shadcn-style, copy-in components for Angular + Tailwind v4) also exists. It is a styled layer, not a primitive layer. This is from the zard-ui MCP server description available in this environment; no web source was fetched.

### Inferences
- Spartan brain is a reasonable headless layer, but its Tailwind/tw-animate peer deps and shadcn-oriented API mean it is best when you also adopt helm. For a fully custom "premium" look, ng-primitives or Aria is a cleaner foundation.
- radix-ng has very good coverage (including date/time fields, editable, cropper, scroll-area) and Base UI semantics, but about 5k weekly downloads and 278 stars signal a small community. It is a risk for a long-lived design system.
- Zag-based Angular is not viable in 2026: it is community-only and lacks an Angular 22 peer range.
- Taiga is a full styled kit. Its CDK is utilities (polymorpheus, event plugins, directives), not headless widgets, so it is not a fit as a primitive layer for a custom DS.

### Gaps
- Did not verify Spartan brain's internal implementation (whether any brain components wrap CDK menu/listbox or Aria). Peer deps show no `@angular/aria`.
- Did not check the radix-ng docs for an a11y testing statement.
- Found no reliable 2025–26 Reddit consensus thread. The search surfaced only an older r/Angular2 "headless UI library" thread via a mirror, without replies.

## Comparison matrix, recommended foundation, and gaps needing third-party libs

### Takeaway
Recommended foundation for compass: **Angular Aria + Angular CDK as the official core, with ng-primitives filling the non-composite primitives** (dialog/popover/tooltip/toast/slider/date picker/form controls). Alternatively, use ng-primitives alone if a single API style matters more than first-party backing. Third-party additions: **TanStack Table (Angular)** for data grids, **TanStack Virtual (Angular)** or CDK virtual scroll for virtualization. A command palette is best composed from Aria combobox+listbox (or ng-primitives Combobox/Spartan Command) inside a CDK dialog, because `@ngxpert/cmdk` is stagnant.

### Cited Findings
Coverage matrix (Y = dedicated primitive; from npm entry points/docs cited above):

| Pattern | @angular/aria 22.3 | @angular/cdk 22.3 | ng-primitives 0.132 | spartan brain 1.10 | radix-ng 1.3 |
|---|---|---|---|---|---|
| Combobox/Autocomplete | Y | – | Y (Combobox) | Y | Y |
| Select / Multiselect | Y (via combobox+listbox) | – | Y (Select) | Y | Y |
| Listbox | Y | Y (cdk/listbox) | Y | – | – |
| Menu / Menubar / Context menu | Y / Y / – | Y (cdk/menu) | Y / – / Y | – (helm) | Y / Y / Y |
| Dialog / Alert dialog | – | Y (cdk/dialog) | Y | Y / Y | Y / Y |
| Popover / Tooltip / Hover card | – | overlay only | Y / Y / Y (Preview Card) | Y / Y / Y | Y / Y / Y (preview-card) |
| Tabs / Accordion | Y / Y | – / Y | Y / Y | Y / Y | Y / Y |
| Tree / Grid | Y / Y | Y (tree, table) | – / Table | – | – |
| Toolbar | Y | – | Y | – | Y |
| Slider / Range | – | – | Y / Y | Y | Y |
| Checkbox / Radio / Switch / Toggle group | – | – | Y | Y | Y |
| Date picker / Calendar | – | – | Y (Date Picker) | Y / Y | Calendar, date-field, time-field (picker planned) |
| Toast | – | – | Y | Y (sonner) | Y |
| Command palette | – | – | – | Y (command) | – |
| OTP / Number field | – | – | Y / Y | Y / – | Y / Y |
| Positioning engine | CDK Overlay | CDK Overlay | @floating-ui/dom | CDK (peer) | @floating-ui/dom |

Maintenance snapshot (2026-11-20):

| Package | Stars | Latest release | Weekly DLs | Angular peer |
|---|---|---|---|---|
| @angular/aria / cdk ([angular/components](https://github.com/angular/components)) | 25,049 | v22.3.0 (2026-11-18) | 225.6k / 5.80M | ^22 \|\| ^23 |
| [ng-primitives](https://github.com/ng-primitives/ng-primitives) | 616 | v0.132.0 (2026-11-19) | 44.0k | ^21 \|\| ^22 |
| [@spartan-ng/brain](https://github.com/spartan-ng/spartan) | 3,002 | v1.10.0 (2026-11-20) | 125.4k | >=21 <23 |
| [@radix-ng/primitives](https://github.com/radix-ng/primitives) | 278 | 1.3.0 (2026-11-08) | 5.5k | ^21 \|\| ^22 |
| [@taiga-ui/cdk](https://github.com/taiga-family/taiga-ui) | 4,097 | v5.33.0 (2026-11-16) | 39.2k | >=19 |
| [zag-angular](https://www.npmjs.com/package/zag-angular) (community) | n/a | 0.7.0 (≈2026-04) | ~28 (stale figure) | ^21.2 only |
| [@ngxpert/cmdk](https://github.com/ngxpert/cmdk) | 74 | v3.0.0 (2024-06-23) | 1.2k | >=18 |

Sources for the table: GitHub API and npm registry/downloads API queried 2026-11-20 (links above).

Third-party gap fillers:
- `@tanstack/angular-table@9.3.2` (peer `@angular/core >=19`, about 95.7k weekly downloads). The TanStack/table repo has 28,592 stars, last push 2026-11-18. — [npm](https://www.npmjs.com/package/@tanstack/angular-table), [GitHub](https://github.com/TanStack/table)
- `@tanstack/angular-virtual@6.1.12` (peer `@angular/core >=20`). The TanStack/virtual repo has 7,203 stars, last push 2026-11-19. — [npm](https://www.npmjs.com/package/@tanstack/angular-virtual), [GitHub](https://github.com/TanStack/virtual)
- CDK provides `scrolling` (virtual scroll) and `table` entry points as first-party alternatives. — [npm @angular/cdk](https://www.npmjs.com/package/@angular/cdk)
- A Nov 2025 article recommends combining Aria (listbox behavior) with a community primitives lib (popover/focus) for custom design systems moving away from Material. — [dev.to](https://dev.to/hassantayyab/angular-aria-vs-angular-primitives-whats-the-difference-and-when-should-you-use-each-5f1)

### Inferences
- **Why Aria + CDK as the core:**
  - It is first-party and stable since v22, and released in lockstep with Angular, so there is no upgrade lag.
  - It is signal/model-based and zoneless-safe.
  - It covers the hardest keyboard/ARIA patterns (combobox, menu, tree, grid, tabs).
  - The CDK is already in compass.
- **Why add ng-primitives (or build in-house):**
  - Aria lacks dialog, popover, tooltip, toast, slider, form controls and date picker. ng-primitives covers all of them headlessly, with floating-ui positioning, zoneless/SSR support, and an Angular 21–22 peer range.
  - The alternative is building dialog, popover and tooltip yourself on `cdk/dialog`, `cdk/overlay` and `cdk/a11y`. That is feasible: these are simpler patterns than combobox or grid.
- **Risk of mixing two libraries:** inconsistent API idioms and two positioning engines (CDK Overlay vs floating-ui). A design system should hide both behind its own wrapper components.
- **ng-primitives alone** is the most pragmatic choice if the team prefers one consistent API. It trades first-party backing for coverage.
- **Spartan brain** fits teams who want shadcn aesthetics as a starting point. It is less suited to a fully bespoke look.
- **Date picker:** use ng-primitives Date Picker or Spartan's calendar/date-picker. Aria has none. radix-ng's picker is "planned" only.
- **Command palette:** no healthy dedicated Angular package exists. Compose it from a CDK dialog plus an Aria combobox/listbox (activedescendant mode) with your own fuzzy filter. Alternatively use Spartan brain's `command` primitive.
- **Toast:** use ng-primitives Toast or Spartan's sonner, or a small custom CDK-overlay service with an `aria-live` region (LiveAnnouncer).
- **Data grid:** use TanStack Table (headless, signals-friendly Angular adapter) for logic, Aria Grid for keyboard navigation semantics, and TanStack Virtual or CDK virtual scroll for large row counts.

### Gaps
- No bundle-size (gzipped, tree-shaken) comparisons found for any library. Only unpacked npm sizes were collected (aria about 1.16 MB, brain about 3.27 MB, radix-ng about 7.15 MB, cdk about 3.58 MB). These do not reflect shipped bytes.
- No independent accessibility audits (e.g. NVDA/JAWS/VoiceOver matrices) were found for any of these libraries.
- I did not verify whether Aria's Grid can drive a TanStack Table instance cleanly (no source found).
- I did not verify that the TanStack Angular adapters are signal-native in current majors (version numbers only).
