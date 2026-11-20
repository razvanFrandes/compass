# Tooltips and related micro-UX: rulebook

Researched 2026-11-20. Every rule has a source. Lines marked **[our call]** are decisions we derived from the sources where no guideline gives an exact number; they are not quoted rules.

Source gaps: the m3.material.io and m2.material.io pages render client-side and could not be fetched, so Material guidance comes from Google's Android/Compose docs and source, the Angular Material docs, and the archived M1 spec. Apple and NN/g give no hover-delay value for macOS or the web, and the macOS default for `NSInitialToolTipDelay` could not be confirmed from a primary source.

---

## TL;DR: what to change in the demo

1. **Stop tooltipping everything.** A visible text label beats a tooltip. Use a tooltip only to name an icon-only control, or to add short non-essential info. Never repeat visible text. (NN/g, Primer, Atlassian, Apple; see Section 1)
2. **Add a show delay of about 600 to 700 ms** instead of Spartan's default of 0 ms. Radix defaults to 700 ms and Base UI to 600 ms. (Section 2)
3. **Group adjacent icon buttons** with `provideBrnTooltipGroup()` (skip-delay window 300 ms) so that once one tooltip is open, the neighbours open instantly. (Section 2, Section 6)
4. **Show nothing on touch.** Spartan already ignores touch pointers. Anything a touch user needs must be visible or live in a popover. (Section 3)
5. Keep the Escape, hover and focus behaviour that WCAG 1.4.13 requires. Spartan already supports Esc and content hover. (Section 4)
6. **No tooltips on `disabled` buttons.** If the reason for disabling matters, show it inline, or use `aria-disabled` and keep the button focusable. (Section 5)

---

## 1. When to use a tooltip vs a visible label vs `aria-label` only

| Situation | Use | Source |
|---|---|---|
| Control has a visible text label | **No tooltip.** Don't repeat the label. | NN/g: don't use tooltips for redundant text ([tooltip-guidelines](https://www.nngroup.com/articles/tooltip-guidelines/)). Atlassian: no tooltips on labeled buttons when they repeat the label ([atlassian.design](https://atlassian.design/components/tooltip/usage)). Apple: "avoid repeating a control's name in its tooltip" ([HIG Offering help](https://developer.apple.com/design/human-interface-guidelines/offering-help)). Fluent 2: "additional information, not redundant information" ([fluent2](https://fluent2.microsoft.design/components/web/react/core/tooltip/usage)). Primer: don't duplicate content already on the page ([Primer guidelines](https://primer.style/product/components/tooltip/guidelines/)). |
| Icon is ambiguous and space allows | **Visible text label**, preferably over any tooltip | NN/g: "a text label must be present alongside an icon"; "Don't rely on hover to reveal text labels" ([icon-usability](https://www.nngroup.com/articles/icon-usability/)). NN/g recommends text labels first, tooltips as a fallback ([tooltip-guidelines](https://www.nngroup.com/articles/tooltip-guidelines/)). |
| Icon-only button (toolbar, compact UI) | `aria-label` **plus** a short label tooltip | Carbon: tooltips "name icon-only controls" ([Carbon](https://carbondesignsystem.com/components/tooltip/usage/)). Primer: reserve tooltips for surfacing the label of IconButtons ([Primer guidelines](https://primer.style/product/components/tooltip/guidelines/)). Atlassian: icon buttons have tooltips built in ([atlassian.design](https://atlassian.design/components/tooltip/usage)). M3: plain tooltips "describe elements or actions of icon buttons" ([Android Compose tooltip](https://developer.android.com/develop/ui/compose/components/tooltip)). |
| Universally obvious icon in a dense, repeated context (close X in a dialog, etc.) | `aria-label` is required; a tooltip is optional | **[our call]**, inferred from Primer's advice to ask whether the information is essential and whether the UI can be clearer ([Primer](https://primer.style/product/components/tooltip/guidelines/)) and Primer calling tooltips a "last resort" ([Primer component](https://primer.style/product/components/tooltip/)). NN/g's consistency rule applies: give every element of a type a tooltip, or none of them ([tooltip-guidelines](https://www.nngroup.com/articles/tooltip-guidelines/)). |
| Short supplementary info (keyboard shortcut, brief clarification, full text of a truncated string) | Description tooltip | Atlassian ([usage](https://atlassian.design/components/tooltip/usage)). Primer `keybindingHint` ([Primer](https://primer.style/product/components/tooltip/)). |
| Information needed to finish the task (password rules, errors, critical details) | **Never a tooltip.** Use helper text, inline messages or errors. | NN/g ([tooltip-guidelines](https://www.nngroup.com/articles/tooltip-guidelines/)), Carbon ([usage](https://carbondesignsystem.com/components/tooltip/usage/)), Atlassian ([usage](https://atlassian.design/components/tooltip/usage)) |
| Content with links, buttons or formatting | **Toggletip / popover**, not a tooltip | Carbon toggletip ([usage](https://carbondesignsystem.com/components/tooltip/usage/)). Atlassian: use a popup or modal ([usage](https://atlassian.design/components/tooltip/usage)). Fluent: popover for rich info ([fluent2](https://fluent2.microsoft.design/components/web/react/core/tooltip/usage)). Base UI: info icons should use a Popover ([base-ui](https://base-ui.com/react/components/tooltip)). |
| Non-interactive elements (`div`, `span`, badges, lozenges) | **No tooltip** | Primer: "Never use tooltips on non-interactive elements" ([Primer guidelines](https://primer.style/product/components/tooltip/guidelines/)). Atlassian: no tooltips on lozenges or other non-interactive elements ([usage](https://atlassian.design/components/tooltip/usage)). |
| Feature announcements and onboarding tips | Not a tooltip. Use a tip or popover. | NN/g ([tooltip-guidelines](https://www.nngroup.com/articles/tooltip-guidelines/)). Apple "tips" are a separate pattern ([HIG](https://developer.apple.com/design/human-interface-guidelines/offering-help)). |

**Label vs description semantics**
- When a tooltip is the only visible name of an icon button, it is a **label**: `aria-labelledby`, or keep an `aria-label` that matches the tooltip text. ([Primer a11y](https://primer.style/product/components/tooltip/accessibility/); [Base UI](https://base-ui.com/react/components/tooltip): "The trigger needs an aria-label that closely matches the tooltip's content")
- When it adds information to an already-labelled control, it is a **description**: `aria-describedby`. ([Primer a11y](https://primer.style/product/components/tooltip/accessibility/); [Fluent 2](https://fluent2.microsoft.design/components/web/react/core/tooltip/usage); [Angular Material](https://github.com/angular/components/blob/main/src/material/tooltip/tooltip.md))
- A tooltip never replaces the accessible name. MUI notes that using `describeChild` when the tooltip is the only label leaves the child without an accessible name and violates WCAG 2.5.3 ([MUI](https://mui.com/material-ui/react-tooltip/)). Compose: a tooltip never replaces the icon's `contentDescription` ([Android tooltip skill ref](https://developer.android.com/agents/skills/jetpack-compose/adaptive/references/tooltips)).
- Spartan's `BrnTooltip` sets `aria-describedby`, so it is a **description**. The icon button still needs its own `aria-label`. ([brn-tooltip.ts](https://github.com/spartan-ng/spartan/blob/main/libs/brain/tooltip/src/lib/brn-tooltip.ts))

## 2. Timing

### Library and platform defaults (facts)

| System | Show delay | Hide delay | "Skip" / reshow window | Source |
|---|---|---|---|---|
| Radix Tooltip | **700 ms** (`delayDuration`) | (none) | **300 ms** (`skipDelayDuration`) | [radix-ui.com](https://www.radix-ui.com/primitives/docs/components/tooltip) |
| Base UI Tooltip | **600 ms** (`delay`) | 0 ms (`closeDelay`) | **400 ms** (Provider `timeout`) | [base-ui.com](https://base-ui.com/react/components/tooltip) |
| shadcn/ui `TooltipProvider` | **0 ms** (overrides Radix's 700) | (none) | Radix default | [shadcn tooltip.tsx](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/tooltip.tsx) |
| **Spartan brain 1.10.0 / main** | **0 ms** (`showDelay`) | **0 ms** (`hideDelay`) | **300 ms**, only inside `provideBrnTooltipGroup()` | [brn-tooltip.token.ts](https://github.com/spartan-ng/spartan/blob/main/libs/brain/tooltip/src/lib/brn-tooltip.token.ts), [brn-tooltip-group.ts](https://github.com/spartan-ng/spartan/blob/main/libs/brain/tooltip/src/lib/brn-tooltip-group.ts) |
| Angular Material `matTooltip` | 0 ms | 0 ms; touch 1500 ms (`touchendHideDelay`) | (none) | [tooltip.ts](https://github.com/angular/components/blob/main/src/material/tooltip/tooltip.ts), [tooltip.md](https://github.com/angular/components/blob/main/src/material/tooltip/tooltip.md) |
| GitHub Primer React | 50 ms default (`short`); 400 `medium`; 1200 `long` | (none) | (none) | [primer.style](https://primer.style/product/components/tooltip/) |
| MUI | Shows immediately by default; touch long-press 700 ms | Touch: hides after 1500 ms | (none) | [mui.com](https://mui.com/material-ui/react-tooltip/) |
| Windows Forms ToolTip | `AutomaticDelay` 500 ms, so InitialDelay is 500 ms | AutoPop 10x (5 s) | Reshow 1/5 (100 ms) | [MS Learn AutomaticDelay](https://learn.microsoft.com/dotnet/api/system.windows.forms.tooltip.automaticdelay) |
| Material (Compose) | hover / long-press | non-persistent: `TooltipDuration` = 1500 ms | (none) | [androidx API 1.9.0](https://github.com/androidx/androidx/blob/androidx-main/compose/foundation/foundation/api/1.9.0-beta01.txt) |
| Material 1 (archived) | long-press on touch | displayed 1.5 s after lift; 150 ms enter and exit motion | (none) | [m1.material.io](https://m1.material.io/components/tooltips.html) |
| macOS | user default `NSInitialToolTipDelay` (ms) exists; Apple does not document the default value | | | [MacScripter](https://www.macscripter.net/t/delay-tooltips-appearance/58764) |

Microsoft's caveat about the other extreme: "If the value of the InitialDelay property is set to a value that is too long in duration, the user of your application might not know that your application provides ToolTip Help." ([MS Learn InitialDelay](https://learn.microsoft.com/dotnet/api/system.windows.forms.tooltip.initialdelay))

### Rules for us
- **Show delay: 600 ms** **[our call]**, inside the 500 to 700 ms range that Radix (700), Base UI (600) and WinForms (500) use. A 0 ms delay (Spartan, shadcn and Angular Material defaults) causes the "tooltip flashes on everything the cursor crosses" problem the user reported.
- **Keyboard focus opens without the hover delay.** Radix opens and closes immediately on Tab ([radix](https://www.radix-ui.com/primitives/docs/components/tooltip)). Spartan applies `showDelay` to focus as well ([brn-tooltip.ts](https://github.com/spartan-ng/spartan/blob/main/libs/brain/tooltip/src/lib/brn-tooltip.ts)), so this needs a small wrapper or can be accepted as a known deviation **[our call]**.
- **Skip delay: 300 ms** (Radix and Spartan group default). Once one tooltip in a toolbar is open, moving to a neighbour shows its tooltip instantly.
- **Hide delay: 0 to 100 ms** **[our call]**. Base UI uses 0. A short delay lets the pointer travel onto the tooltip, as 1.4.13 "hoverable" requires. Spartan keeps the tooltip open while its content is hovered.
- **Esc, click and Space/Enter close immediately** (Radix keyboard table, [radix](https://www.radix-ui.com/primitives/docs/components/tooltip)). Spartan handles Esc globally, even during the show delay ([brn-tooltip.ts](https://github.com/spartan-ng/spartan/blob/main/libs/brain/tooltip/src/lib/brn-tooltip.ts)).

### Content and placement
- **Length:** at most **60 to 75 characters** where possible ([Apple HIG](https://developer.apple.com/design/human-interface-guidelines/offering-help)). Icon-button tooltips should be **one or two words** ([Carbon](https://carbondesignsystem.com/components/tooltip/usage/)). If you need much more, simplify the UI or use a popover ([Apple](https://developer.apple.com/design/human-interface-guidelines/offering-help), [Primer](https://primer.style/product/components/tooltip/guidelines/)).
- **Wording:** start with a verb ("Restore default settings"); use sentence case; omit end punctuation on fragments ([Apple](https://developer.apple.com/design/human-interface-guidelines/offering-help); [Fluent 2](https://fluent2.microsoft.design/components/web/react/core/tooltip/usage): noun phrase, sentence case, no end punctuation for unlabeled components).
- **Context-sensitive text** per state is fine, for example "Mute" vs "Unmute" ([Apple](https://developer.apple.com/design/human-interface-guidelines/offering-help)).
- **Plain text only.** No links, buttons, images or formatting ([Carbon](https://carbondesignsystem.com/components/tooltip/usage/), [Atlassian](https://atlassian.design/components/tooltip/usage), [Primer a11y](https://primer.style/product/components/tooltip/accessibility/), [M1](https://m1.material.io/components/tooltips.html)).
- **Never truncate tooltip text** ([Atlassian](https://atlassian.design/components/tooltip/usage)).
- **Placement:** don't cover the content the tooltip describes ([NN/g](https://www.nngroup.com/articles/tooltip-guidelines/)). Fluent's default offset is 4 px ([Fluent 2](https://fluent2.microsoft.design/components/web/react/core/tooltip/usage)); Spartan's is 8 px `sideOffset` ([token](https://github.com/spartan-ng/spartan/blob/main/libs/brain/tooltip/src/lib/brn-tooltip.token.ts)). Use arrows when triggers sit close together ([NN/g](https://www.nngroup.com/articles/tooltip-guidelines/)).
- **Contrast:** the tooltip must contrast with the page; light grey on white fails ([NN/g](https://www.nngroup.com/articles/tooltip-guidelines/)).

## 3. Touch and mobile
- Tooltips depend on hover, so they are generally unavailable on touchscreens. NN/g suggests a tap-to-open popup tip (an "i" or "?" icon) instead ([NN/g](https://www.nngroup.com/articles/tooltip-guidelines/)).
- Base UI: "Tooltips are disabled on touch devices" because there is no discoverable way to reveal them before tapping ([base-ui](https://base-ui.com/react/components/tooltip)).
- Primer: "Tooltips are not accessible for touch screen users" ([Primer a11y](https://primer.style/product/components/tooltip/accessibility/)).
- Atlassian: tooltips are hard to discover on devices without hover, so don't put critical info in them ([Atlassian](https://atlassian.design/components/tooltip/usage)).
- Material and Android: long-press shows the tooltip ([Compose docs](https://developer.android.com/develop/ui/compose/components/tooltip)), which then hides about 1.5 s after release ([M1](https://m1.material.io/components/tooltips.html), [Angular Material](https://github.com/angular/components/blob/main/src/material/tooltip/tooltip.md), [MUI](https://mui.com/material-ui/react-tooltip/)). That pattern suits native apps. On the web, the modern headless libraries (Base UI and Spartan) skip touch entirely.
- **Spartan behaviour:** opens only for `pointerType` `mouse` or `pen`, plus keyboard focus. Touch is ignored by design: "use a popover when touch users need to see the content" ([brn-tooltip.ts](https://github.com/spartan-ng/spartan/blob/main/libs/brain/tooltip/src/lib/brn-tooltip.ts)).
- **Rule:** nothing a mobile user needs may live only in a tooltip. Icon-only buttons on mobile rely on recognisable icons plus `aria-label`, or get visible labels ([NN/g icon usability](https://www.nngroup.com/articles/icon-usability/)).

## 4. Keyboard and accessibility (WCAG 2.2 SC 1.4.13, AA)
Source: [W3C Understanding 1.4.13](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html)
- **Dismissible:** the user can close the tooltip without moving the pointer or focus, for example with **Esc**.
- **Hoverable:** the pointer can move onto the tooltip without it disappearing.
- **Persistent:** the tooltip stays until hover or focus leaves, the user dismisses it, or the information becomes invalid. **No auto-hide timer on desktop.**
- Native `title` tooltips are exempt (the user agent controls them), but they also give no control over delay, styling or touch.
- **Focus must trigger the tooltip too**, not only the mouse ([NN/g](https://www.nngroup.com/articles/tooltip-guidelines/), [Carbon](https://carbondesignsystem.com/components/tooltip/usage/), [Angular Material a11y](https://github.com/angular/components/blob/main/src/material/tooltip/tooltip.md)).
- Tooltips themselves never receive focus ([Carbon](https://carbondesignsystem.com/components/tooltip/usage/), [Atlassian](https://atlassian.design/components/tooltip/usage), [M1](https://m1.material.io/components/tooltips.html)).
- Shortcuts shown only in tooltips are hidden from assistive technology, so expose them somewhere else too ([Atlassian](https://atlassian.design/components/tooltip/usage)).

## 5. Disabled buttons
- **Atlassian:** "Never use tooltips with disabled elements because they are not interactive." ([usage](https://atlassian.design/components/tooltip/usage))
- **Primer:** "A Tooltip is not allowed on disabled elements because such elements are not keyboard-accessible." If you must, use `aria-disabled="true"` and disable the behaviour in code ([Primer a11y](https://primer.style/product/components/tooltip/accessibility/)).
- **Fluent 2** (dissenting): a tooltip on a disabled control should explain what would enable it ([Fluent 2](https://fluent2.microsoft.design/components/web/react/core/tooltip/usage)).
- Technical: native `disabled` buttons don't fire pointer events, so libraries need a wrapper `span` hack ([MUI](https://mui.com/material-ui/react-tooltip/), [shadcn](https://ui.shadcn.com/docs/components/tooltip)). That wrapper is not keyboard-reachable.
- **Rule [our call, reconciling the above]:** no tooltip on `disabled`. If the reason for disabling matters, show it as visible inline text, or use `aria-disabled="true"` (focusable) with a description tooltip that explains how to enable it.

## 6. Spartan implementation notes
Verified against `@spartan-ng/brain` **1.10.0** (npm latest) and `main` at commit 37b58c26 (2026-11-19).

- Global defaults: `provideBrnTooltipDefaultOptions(options: Partial<BrnTooltipOptions>)`. Options are `showDelay`, `hideDelay`, `sideOffset` (default 8), `position`, and class hooks. It merges with options from a parent injector, so `HlmTooltip`'s own provider (classes only) won't wipe app-level delays ([token](https://github.com/spartan-ng/spartan/blob/main/libs/brain/tooltip/src/lib/brn-tooltip.token.ts), [hlm-tooltip.ts](https://github.com/spartan-ng/spartan/blob/main/libs/helm/tooltip/src/lib/hlm-tooltip.ts)).
- Per instance: the `showDelay`, `hideDelay`, `tooltipDisabled` and `position` inputs are forwarded through `hlmTooltip`.
- Skip delay: `provideBrnTooltipGroup({ skipDelayDuration?: number })` (default 300) on a wrapper component such as a toolbar or sidebar. Tooltips inside it open instantly, without the enter animation, within 300 ms of a sibling closing ([group](https://github.com/spartan-ng/spartan/blob/main/libs/brain/tooltip/src/lib/brn-tooltip-group.ts)).
- Already compliant: Esc dismiss, content hover keeps it open, touch ignored, `aria-describedby`, and a hidden tooltip when the text is empty ([brn-tooltip.ts](https://github.com/spartan-ng/spartan/blob/main/libs/brain/tooltip/src/lib/brn-tooltip.ts)).

```ts
// app.config.ts
providers: [
  provideBrnTooltipDefaultOptions({ showDelay: 600, hideDelay: 100 }),
]

// toolbar / sidebar / icon-button cluster component
@Component({ selector: 'app-toolbar', providers: [provideBrnTooltipGroup()], /* skipDelayDuration: 300 */ })
```

## 7. Toasts (brief)
- **Use for passive, low-stakes confirmations only.** NN/g: toasts are "appropriate for passive notifications" and "a bad way to implement an error message". A user missed an error that "faded away after 5 seconds" and waited about 5 minutes ([NN/g](https://www.nngroup.com/articles/indicators-validations-notifications/)). Material: not for critical info; anything important enough to block the screen should be a dialog ([M1 snackbars](https://m1.material.io/components/snackbars-toasts.html)).
- **Duration:** Material Compose snackbar is Short = **4 s**, Long = **10 s**, plus Indefinite, and it is lengthened when accessibility services are on ([SnackbarHost.kt](https://github.com/androidx/androidx/blob/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/SnackbarHost.kt)). Carbon toasts persist by default, with optional auto-dismiss at **5 s** ([Carbon](https://carbondesignsystem.com/components/notification/usage/)). Sonner (the shadcn/Spartan toast) defaults to **4 s** and shows 3 visible at once ([sonner source](https://github.com/emilkowalski/sonner/blob/main/src/index.tsx)).
- **Toasts with an action (Undo) must not vanish fast.** Carbon: actionable notifications persist until dismissed ([Carbon](https://carbondesignsystem.com/components/notification/usage/)). NN/g: a contextual Undo needs "good visibility"; Google Drive's snackbar "only appears for a few seconds" ([NN/g](https://www.nngroup.com/articles/user-control-and-freedom/)). WCAG 2.2.1 applies when the toast is the only way to get the information ([W3C 2.2.1](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html)).
- **One action at most**, and never "Dismiss" or "Cancel" as the action ([M1](https://m1.material.io/components/snackbars-toasts.html), [Carbon](https://carbondesignsystem.com/components/notification/usage/)). Carbon limits text to 2 lines ([Carbon](https://carbondesignsystem.com/components/notification/usage/)).
- **A11y:** `role="status"` for confirmations and `role="alert"` only for errors or time-sensitive warnings. Don't move focus (WCAG 4.1.3, [W3C](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)).
- **Rules for us:** confirmation 4 s; with Undo, at least 10 s (Material Long) or until dismissed; pause while the user hovers or interacts (Sonner pauses its timer when expanded or interacted with, or when the tab is hidden: [sonner source](https://github.com/emilkowalski/sonner/blob/main/src/index.tsx)); errors go inline, not in toasts.
