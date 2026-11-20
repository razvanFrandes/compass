# Full (installed, pre-styled) Angular UI libraries: premium look and depth of customization (as of Nov 2026)

Method note: GitHub stars, release dates and npm peer dependencies below were pulled live on 2026-11-20 via `gh api` and the npm registry (`registry.npmjs.org/<pkg>`). These are primary data. Visual-quality verdicts are mostly secondary or vendor-authored; I found no directly retrievable Reddit threads (search returned none), so "community verdict" items are flagged.

## Snapshot table (live data, 2026-11-20)

| Library | GitHub stars | Latest release (date) | Angular peer dep (npm latest) | License (npm) |
|---|---|---|---|---|
| Angular Material / CDK (`angular/components`) | 25,049 | v22.3.0 (2026-11-18) | `^22.0.0 \|\| ^23.0.0` | MIT |
| AG Grid (`ag-grid/ag-grid`) | 15,689 | 36.3.0 (2026-11-04) | `>= 20.0.0` | MIT community / commercial enterprise |
| PrimeNG (`primefaces/primeng`) | 12,484 | npm 22.1.5 (2026-11-11); last GitHub release tag 21.1.10 (2026-09-09); repo last push 2026-09-24 | `^22.1.0` | "SEE LICENSE IN LICENSE.md" (PrimeUI license); deps include `@primeui/license-manager` |
| NG-ZORRO (`NG-ZORRO/ng-zorro-antd`) | 9,195 | 22.2.0 (2026-11-04) | `^22.0.0` | MIT |
| Taiga UI (`taiga-family/taiga-ui`) | 4,097 | v5.33.0 and v4.109.0 (both 2026-11-16) | `>=19.0.0` | Apache-2.0 |
| DevExtreme (`DevExpress/DevExtreme`) | 1,913 | 26.1.6 (2026-10-26) | `>=20.0.0` | commercial |
| Optimus UI (MIT fork of PrimeNG v21, `openng-org/optimus-ui`) | 815 | 2.0.2 (2026-08-28); created 2026-06-29 | not checked | MIT |
| Ignite UI for Angular | 599 | 22.3.0 (2026-11-17) | `22` | MIT (open part) + commercial |
| Clarity (`vmware-clarity/ng-clarity`) | 435 | v18.5.1 (2026-11-13) | `^21.1.0 \|\| 22` | not asserted on GitHub |
| Syncfusion (`@syncfusion/ej2-angular-grids`) | 294 (wrapper repo) | 35.2.12 (npm, 2026-11-18) | no Angular peer declared | commercial / community license |
| Kendo UI (`@progress/kendo-angular-grid`) | closed source | 26.1.0 (npm, 2026-11-17) | `20 - 22` | commercial |

Sources: [GitHub angular/components](https://github.com/angular/components), [GitHub primefaces/primeng](https://github.com/primefaces/primeng), [GitHub taiga-family/taiga-ui](https://github.com/taiga-family/taiga-ui/releases), [GitHub NG-ZORRO](https://github.com/NG-ZORRO/ng-zorro-antd), [GitHub ng-clarity](https://github.com/vmware-clarity/ng-clarity), [GitHub igniteui-angular](https://github.com/IgniteUI/igniteui-angular), [GitHub ag-grid](https://github.com/ag-grid/ag-grid), [GitHub DevExtreme](https://github.com/DevExpress/DevExtreme), [GitHub optimus-ui](https://github.com/openng-org/optimus-ui), [npm primeng](https://www.npmjs.com/package/primeng)

## PrimeNG (v20+ / v22): styled vs unstyled, tokens, Tailwind, license, Angular 22

### Takeaway
PrimeNG is technically current (v22 requires Angular `^22.1.0`, design-token presets, unstyled + pass-through, official Tailwind v4 plugin), but the big 2026 change is licensing: from v22 it is no longer open source, ships as compiled npm packages under the PrimeUI license, and is free only for very small organisations; an MIT community fork of v21 (Optimus UI) exists.

### Cited Findings
- PrimeNG v22 is "the first release under the PrimeUI umbrella", licensing moves to a "dual Community/Commercial model"; presets listed are Aura, Material, Lara, Nora; v22 now assumes a 16px root font size with a 14px "compat" variant per preset — [PrimeNG v22 migration](https://primeng.dev/migration/v22)
- v22 deprecates (removal planned v24) MultiSelect, PanelMenu, Password, Galleria, ColorPicker, InputMask component, Chart, Image, Editor, ScrollPanel, ImageCompare and AutoComplete `multiple`; removes `@primeng/themes` (replaced by `@primeuix/themes`), `pTemplate`, `pBadge` and others — [PrimeNG v22 migration](https://primeng.dev/migration/v22)
- "These future major versions will be distributed under the PrimeUI license and will no longer be released as open source"; future majors ship as "compiled npm packages"; "All existing MIT-licensed versions remain MIT forever" — [PrimeUI: The Next Chapter](https://primeui.dev/nextchapter)
- Community (free) license requires all of: < $1M annual revenue, < 5 developers, < 10 employees, < $3M VC funding; 12-month keys, renewed after re-confirming eligibility; same core feature set as Commercial — [PrimeUI: The Next Chapter](https://primeui.dev/nextchapter)
- Commercial: $599/developer perpetual with one year of updates (launch price through end of 2026), $799 from 2027, $399/dev/year update extension — [PrimeUI: The Next Chapter](https://primeui.dev/nextchapter)
- PrimeUI PRO components (included with Commercial): Scheduler, Text Editor, Task Board, Charts available; DataGrid, Sheet, Gantt, Diagram, PDF Viewer "in development"; a Sept 2026 update says Angular PRO support is now available — [PrimeUI: The Next Chapter](https://primeui.dev/nextchapter)
- npm `primeng@22.1.5` license field is "SEE LICENSE IN LICENSE.md" and depends on `@primeui/license-manager` — [npm registry](https://registry.npmjs.org/primeng)
- Third-party reports say PrimeTek archived/stopped updating the public repo on June 29, 2026 — [OpenNG post](https://www.openng.org/posts/primeng-is-no-longer-open-source), [white duck](https://whiteduck.de/en/primeng-will-be-subject-to-a-fee-and-now/); contradicted in part by live GitHub API data showing `archived: false` and a last push on 2026-09-24 (repo appears frozen rather than formally archived; last GitHub release tag 21.1.10) — [GitHub primefaces/primeng](https://github.com/primefaces/primeng)
- Optimus UI: "80+ accessible, customizable Angular components under the MIT license. A community-maintained continuation of PrimeNG v21", created 2026-06-29, 815 stars, v2.0.2 — [GitHub optimus-ui](https://github.com/openng-org/optimus-ui)
- Tailwind: official `tailwindcss-primeui` plugin "is designed to work both in styled and unstyled modes"; ships a CSS build for v4; for v4 the primeng layer must sit "after theme and base, but before the other Tailwind layers such as utilities"; PrimeNG preflight (off by default) lives in `primeui.base` layer — [PrimeNG Tailwind docs](https://primeng.dev/tailwind). Note: plugin last released 0.6.1 on 2025-03-26 — [GitHub tailwindcss-primeui](https://github.com/primefaces/tailwindcss-primeui)
- PrimeNG can run fully unstyled with every internal element exposed through pass-through props for Tailwind styling — [UICentral](https://uicentral.fyi/component-libraries/primeng); official Pass Through and Unstyled Mode docs pages exist in v22 nav — [PrimeNG v22 migration](https://primeng.dev/migration/v22)
- "Volt" (Tailwind-styled, copy-into-project components built on unstyled Prime) is a PrimeVue offering; I found no PrimeNG/Angular equivalent and the PrimeNG Tailwind page mentions only the plugin and a `primeng-quickstart-tailwind` repo — [PrimeNG Tailwind docs](https://primeng.dev/tailwind)
- Comparison sources: PrimeNG is "best free Angular library for breadth" with 80+ components but "sometimes lack[s] the polish of Angular Material or the depth of commercial alternatives like Kendo UI" — [Colorlib 2026](https://colorlib.com/wp/angular-components/); vendor table rates PrimeNG data-grid performance "moderate" — [Infragistics, Jan 2026](https://www.infragistics.com/blogs/angular-material-alternatives) (note: Infragistics still lists PrimeNG as MIT, which is outdated for v22)

### Inferences
- For "compass" (likely a small team), the Community license may be free, but eligibility must be re-confirmed yearly and the code is closed; that is a strategic risk for an "editable components" goal. Pass-through lets you restyle but you cannot edit component source.
- The Aura preset is the most "modern" of the Prime presets; with design-token overrides (`@primeuix/themes` `definePreset`) plus Tailwind, PrimeNG can be pushed reasonably far from its default look, but the DOM structure and interaction patterns remain recognisably PrimeNG.
- Large deprecation list in v22 means churn for anyone adopting now.

### Gaps
- Exact v22 signals/zoneless status not stated on the migration page ("modernized codebase using newer Angular APIs" only). Not verified.
- Whether PrimeNG v22 bundle size changed; no data found.
- Whether a Volt-like Tailwind preset for Angular is planned: no source found.
- OpenNG thresholds were secondary but match PrimeTek's primary page.

## Taiga UI (v4/v5)

### Takeaway
Taiga UI is the most actively maintained open-source full kit (v5 and v4 both released 2026-11-16, Apache-2.0), fully moved to signals, CSS-only animations and CSS custom property theming; it has a distinctive, clean fintech look, but limited data-grid depth and a smaller community.

### Cited Findings
- v5.33.0 and v4.109.0 both released 2026-11-16; 4,097 stars; npm `@taiga-ui/core` license Apache-2.0, Angular peer `>=19.0.0` — [GitHub releases](https://github.com/taiga-family/taiga-ui/releases), [npm](https://registry.npmjs.org/@taiga-ui/core)
- v5: minimum Angular 19; components moved to signal inputs, `computed` replaces `@tuiPure`, signal queries; tokens like `TUI_NUMBER_FORMAT` now return signals; "improved support for Zoneless applications!"; `@angular/animations` "completely dropped", animations rewritten in native CSS; text fields fully refactored; `provideTaiga()` handles light/dark and font scaling; a revamped date picker is planned — [dev.to: What's new in Taiga UI v5](https://dev.to/angular/whats-new-in-taiga-ui-v5-a-modern-angular-ui-kit-7lm)
- Described as modular, tree-shakable, deep customization via CSS custom properties — [Taiga UI repo index](https://github.com/taiga-family/taiga-ui)
- Vendor comparison: "130+ components, 100+ directives", data grids and charts rated "Limited" — [Infragistics](https://www.infragistics.com/blogs/angular-material-alternatives) (lists license as MIT; npm says Apache-2.0)
- "Relatively new open-source Angular component library from T-Bank ... smaller community than Angular Material or PrimeNG" — [Colorlib 2026](https://colorlib.com/wp/angular-components/)

### Inferences
- Taiga is the strongest free option on "modern Angular" internals (signals, zoneless, no animations package). Visually it reads as polished product UI rather than enterprise, but it has its own recognisable "Taiga/T-Bank" style; restyling uses CSS variables, not Tailwind-native classes.
- For a hotel dashboard it would need a separate grid (e.g., AG Grid) and possibly a scheduler.

### Gaps
- No primary source found on Taiga's theming token list or Tailwind v4 coexistence (likely fine since it uses plain CSS variables, but unverified).
- No bundle-size figures found.

## Angular Material 3 / M3 tokens

### Takeaway
Angular Material (v22.3.0, MIT, 25k stars, Angular 22/23) offers a layered token system (`mat.theme`, `--mat-sys-*` system tokens, `mat.theme-overrides`, per-component `*-overrides` mixins) that can substantially change color, type, shape and density, but the component anatomy and motion stay Material; most sources still call its design language rigid.

### Cited Findings
- `@angular/material@22.3.0` released 2026-11-18, peer `^22.0.0 || ^23.0.0`, MIT — [npm](https://registry.npmjs.org/@angular/material)
- `mat.theme-overrides` replaces generated system token values such as `--mat-sys-primary`; can be scoped to any selector; each component has an overrides mixin (e.g., `card-overrides`) whose tokens are documented with the system token they derive from — [Kasia Biernat, Modern Angular Material theming 2/3](https://medium.com/@kasiabiernat/2-3-modern-angular-material-theming-how-to-pick-the-right-system-token-8a8a72719ce4), [Angular Material system variables](https://next.material.angular.io/guide/system-variables), [Button styling](https://material.angular.io/components/button/styling)
- Internal DOM and CSS classes are private implementation details; override via theming APIs — [Kasia Biernat blog](https://kasiabiernat.github.io/blog/06_3-modern-angular-material-modern-theming)
- "Safest long-term bet" vs "limited component variety and a rigid design language" — [Colorlib 2026](https://colorlib.com/wp/angular-components/); vendor criticism of "restrictive Material Design, limited data-heavy support, theming complexity" — [Infragistics](https://www.infragistics.com/blogs/angular-material-alternatives)

### Inferences
- Because system tokens are plain CSS custom properties, they can be mapped to Tailwind v4 `@theme` variables in both directions, so coexistence is straightforward. Pushing it away from the "Google look" is feasible for colors, radii, typography and density, but ripples, floating-label form fields and elevation conventions still read as Material unless you override per component.
- The CDK (same repo) is a strong base for custom/headless work (covered by other research).

### Gaps
- Could not fetch the official theming guide (material.angular.dev returned no content); exact list of shape/corner tokens not verified.
- No Material data grid beyond `mat-table`; no scheduler.

## NG-ZORRO, Clarity, Kendo, Syncfusion, DevExtreme, Ignite UI, AG Grid

### Takeaway
All are maintained and Angular-22-compatible as of Nov 2026. For data-heavy hotel features (grid, scheduler, calendar), the commercial suites (Kendo, Syncfusion, DevExtreme, Ignite UI) are deepest; AG Grid is the best-in-class standalone grid with a modern default theme (Quartz) and a Theming API. NG-ZORRO (Ant Design) and Clarity (VMware) have strong but recognisable, enterprise-style looks.

### Cited Findings
- NG-ZORRO 22.2.0 (2026-11-04), peer `^22.0.0`, MIT, 9,195 stars — [GitHub](https://github.com/NG-ZORRO/ng-zorro-antd), [npm](https://registry.npmjs.org/ng-zorro-antd/latest); vendor table: component coverage "Medium", data grids "Limited" — [Infragistics](https://www.infragistics.com/blogs/angular-material-alternatives)
- Clarity `@clr/angular` 18.5.1 (2026-11-13), peer `^21.1.0 || 22`, 435 stars — [GitHub ng-clarity](https://github.com/vmware-clarity/ng-clarity)
- Ignite UI 22.3.0 (2026-11-17), peer `22`; "50+ open-source controls" under MIT plus 100+ commercial; premium controls include Data Grid, Pivot Grid, Hierarchical Grid, Charts; "built-in row and column virtualization"; "customizable themes beyond Material Design" — [Infragistics (vendor)](https://www.infragistics.com/blogs/angular-material-alternatives), [GitHub](https://github.com/IgniteUI/igniteui-angular)
- Kendo UI: "110+ UI components", claims "Handles 1M+ data cells efficiently" — [Infragistics](https://www.infragistics.com/blogs/angular-material-alternatives). npm `@progress/kendo-angular-grid` 26.1.0 (2026-11-17), peer `20 - 22` — [npm](https://registry.npmjs.org/@progress/kendo-angular-grid)
- Kendo pricing: subscription ~$783/dev/year listing and "since June 1st 2026 new Perpetual Licenses are no longer available" — [ComponentSource](https://www.componentsource.com/product/kendo-ui/prices); ThemeBuilder included in subscriptions, Kendo UI "starting at $799 per developer, per year" — [Telerik ThemeBuilder pricing](https://www.telerik.com/themebuilder/pricing); other figures ($599 renewal, $1,099) conflict — [tekonline](https://www.tekonline.com.au/telerik-kendo-ui-price-increase-april-2026-what-developers-should-know/), [Colorlib](https://colorlib.com/wp/angular-components/)
- Syncfusion: "90+ Angular components", WCAG 2.2 claims — [Infragistics](https://www.infragistics.com/blogs/angular-material-alternatives); Community License free for < $1M revenue, ≤5 developers, ≤10 employees; covers full Essential Studio; Angular community licenses have no expiration — [Syncfusion community license](https://www.syncfusion.com/products/communitylicense), [Syncfusion web story](https://www.syncfusion.com/web-stories/getting-free-angular-components-is-easier-than-you-think)
- DevExtreme 26.1.6 (2026-10-26), peer `>=20.0.0`; "80+ responsive Angular controls", "30+ chart types", Pivot Grid "up to 1M records"; 30-day trial + 60-day money-back — [GitHub](https://github.com/DevExpress/DevExtreme), [Infragistics](https://www.infragistics.com/blogs/angular-material-alternatives)
- AG Grid 36.3.0 (2026-11-04), `ag-grid-angular` peer `>= 20.0.0`; Community edition MIT and includes theming; Enterprise "$999 USD per licence" (configurator for exact price); Quartz is the default theme; customize via Theming API or CSS variables; Theme Builder UI available; missing Enterprise key shows watermark and console warnings — [AG Grid homepage](https://ag-grid.com/), [AG Grid licensing](https://www.ag-grid.com/licensing/), [AG Grid themes](https://www.ag-grid.com/vue-data-grid/themes/), [npm](https://registry.npmjs.org/ag-grid-angular)
- Vendor comparison table rates Ignite UI, Syncfusion, Kendo, DevExtreme as "Advanced" for grids/charts, PrimeNG "Moderate", NG-ZORRO and Taiga "Limited" — [Infragistics (vendor, self-interested)](https://www.infragistics.com/blogs/angular-material-alternatives)

### Inferences
- Unverified from my training data (not re-checked this session): Kendo ships Default, Bootstrap, Material, Fluent and Classic themes, all Sass + CSS-variable based, editable in ThemeBuilder; Syncfusion ships Tailwind 3, Fluent 2, Material 3, Bootstrap 5 themes plus a Theme Studio; DevExtreme ships Fluent, Material and Generic themes with a ThemeBuilder; Ignite UI ships Material, Fluent, Bootstrap and Indigo themes via Sass/CSS variables. Treat as plausible but verify.
- Kendo, Syncfusion, DevExtreme and Ignite UI all include Scheduler/Calendar components relevant to hotel room/booking views (general knowledge, not re-verified this session). AG Grid has no scheduler.
- Practical hybrid for "compass": a free/headless or Tailwind-native base for the premium look plus AG Grid Community (Quartz themed via its Theming API using the same CSS tokens) for data-heavy tables; add a commercial scheduler only if a timeline/room-booking view is needed.
- Syncfusion's Community License likely makes the full suite (incl. Scheduler) free for compass if the company is small, which is a notable cost lever.

### Gaps
- Bundle weights: no reliable 2026 figures found for any library.
- Signals/zoneless support for Kendo, Syncfusion, DevExtreme, Ignite UI, Clarity, NG-ZORRO not verified (only Angular 22 peer compatibility was verified, Syncfusion declares none).
- Clarity's long-term roadmap under Broadcom not researched.
- Tailwind v4 coexistence: only PrimeNG (official docs) verified; for others it is generally a CSS layer/preflight question but unverified.

## Community verdicts: which look "premium" vs "enterprise/dated"

### Takeaway
I could not retrieve primary Reddit/HN threads; available verdicts are from comparison blogs and vendor content and are subjective. The consistent pattern: Angular Material = safe but "rigid"; PrimeNG = broad but less polished; Kendo = polished commercial; Taiga = newer, modern-feeling; NG-ZORRO/Clarity/DevExtreme/Syncfusion = enterprise looks.

### Cited Findings
- Free options for a premium look most-cited: Angular Material and Taiga UI; Kendo when budget and heavy grids are needed; "None of these sources directly rate visual design quality" — search synthesis of [Colorlib](https://colorlib.com/wp/angular-components/), [Infragistics](https://www.infragistics.com/blogs/angular-material-alternatives), [nxhhuy.tech](https://nxhhuy.tech/en/blog/angular/ui-library-comparison)
- PrimeNG "sometimes lack[s] the polish of Angular Material or the depth of commercial alternatives like Kendo UI" — [Colorlib 2026](https://colorlib.com/wp/angular-components/)
- Vendor guide reports Reddit complaints about PrimeNG performance with large grids and that it is "slightly more difficult to customize" than Material — [Infragistics](https://www.infragistics.com/blogs/angular-material-alternatives) (secondhand, vendor)

### Inferences
- Every full library carries a recognisable visual signature (Material ripples/fields, Ant Design density, Clarity's VMware chrome, Kendo/Syncfusion/DevExtreme enterprise grids). Achieving a "does not resemble a template" look with a full library requires heavy token work, and even then structural tells remain. This supports pairing a Tailwind-native/headless base for app chrome with a themeable best-in-class grid.

### Gaps
- No primary Reddit/HN threads retrieved; community sentiment is unverified.
- No screenshots/visual audit performed.
