import { Component, inject } from '@angular/core';
import { SPECIMENS } from '../../charts/catalog-samples';
import { WidgetChart } from '../../charts/widget-chart';
import { CompassStore } from '../../store';
import { DOCS_KIT, type DocsCell } from '../docs-kit';
import { DocsColourShifts, JUYO_COLOUR_SHIFTS } from './process-visuals';

const FACTS = [
  { value: 'WCAG 2.2 AA', label: 'the target', note: 'written into the project rules before the first screen' },
  { value: '4.5 : 1', label: 'for text', note: 'and 3 : 1 for chart series, field borders and focus rings' },
  { value: '0', label: 'axe violations to merge', note: 'per view, per theme, on desktop and phone' },
  { value: '44 px', label: 'touch targets', note: 'on a coarse pointer, in every theme' },
] as const;

/** The same pairs the process page shows: Juyo's sampled colour and the Compass token that replaced it. */
export const COLOUR_SHIFTS = JUYO_COLOUR_SHIFTS;

const NOT_COLOUR_ALONE: readonly DocsCell[] = [
  { title: '▲ and ▼ with every change', text: 'A figure that moved carries an arrow and a sign as well as green or red. The real minus sign is used, so a screen reader says “minus”.' },
  { title: 'Last year is dashed', text: 'The comparison period is a dashed line and a different tone. The two series stay apart in greyscale and for colour-blind readers.' },
  { title: 'Height carries the outcome', text: 'In an agent’s run strip a tall tick means it found something. The strip also has a text summary for screen readers.' },
  { title: 'Status is a word', text: '“Needs you”, “Failed”, “Paused” are written out. A paused card recedes with a dashed edge, not with lower opacity, so its text keeps its contrast.' },
];

const FIXED: readonly (readonly string[])[] = [
  ['`aria-pressed` on a radio', 'Quick / Thinker and the autonomy levels', 'They are now real radio groups: `aria-checked`, a roving tabindex, arrow keys.', '20 Nov, `7730a8e`'],
  ['`nested-interactive`', 'The rows of an agent’s run history', 'A control sat inside a control. Rows became plain buttons with `aria-pressed`.', '20 Nov, `7730a8e`'],
  ['`label-content-name-mismatch`', 'The KPI tiles on the Inbox', 'The accessible name did not contain the visible text. It is now the visible text plus a hidden tail.', '20 Nov, `7730a8e`'],
  ['Heading order', 'Chart cards on a board', 'Chart titles became `h2` under the board’s `h1`.', '20 Nov, `7730a8e`'],
  ['`color-contrast`', 'The Approve button, light theme', 'Its label was 3.65:1 on the light theme’s orange. It passes now.', '21 Nov, `e4e8e5c`'],
  ['`color-contrast`', 'The count on the sidebar’s current row, light theme', 'It was 4.3:1. It passes now.', '21 Nov, sidebar branch'],
  ['`empty-table-header`', 'A comparison table in these docs', 'The first column had no header text. It has one now.', '21 Nov, this branch'],
  ['`color-contrast`', 'The colour samples on this page', 'The “before” colours were shown as text, which failed as it should. They are drawings now.', '21 Nov, this branch'],
];

const KEYBOARD: readonly (readonly string[])[] = [
  ['Skip link', 'Tab from the top of any page', '“Skip to content” appears first and moves focus past the navigation.'],
  ['Ask Kassandra', '`⌘K` / `Ctrl K`, `Enter`, `Shift Enter`', 'The shortcut focuses the ask bar from anywhere. Enter sends, Shift Enter breaks the line.'],
  ['Quick / Thinker, autonomy', 'Arrow keys, `Home`, `End`', 'One tab stop per group; the arrows move the choice.'],
  ['Hotel scope picker', 'Type, arrow keys, `Enter`, `Esc`', 'An ARIA combobox. Focus stays in the search box and `aria-activedescendant` names the option the arrows are on.'],
  ['Answer and evidence split', 'Arrow keys on the divider', 'The divider is a `separator` with a value. Arrows resize it; a double click resets it.'],
  ['Agent builder', '`Tab`, `Enter`, `Esc`', 'The chain is an ordered list, so it reads top to bottom. A node opens its editor; Esc closes it and focus goes back to the node.'],
  ['Menus and dialogs', '`Esc`', 'Esc closes, and focus returns to the control that opened it. Delete asks first, with Cancel in focus.'],
  ['Charts', 'Arrow keys on a chart', 'A chart is one focusable image with a summary. The arrows step through its points, and “View as table” swaps it for a real table.'],
  ['These docs', '`?`, arrow keys on the flow tabs', '“?” opens the Docs panel unless you are typing. The architecture flows are a tab list.'],
];

const SPOKEN: readonly (readonly string[])[] = [
  ['While Kassandra works', '“Thinking…”, “Checking the data…”, “Writing…”', 'A `status` region beside the Stop button.'],
  ['The answer', 'Read once, when it is whole', 'The turn is `aria-live="polite"` with `aria-busy` while it streams, so it is not read token by token.'],
  ['Voice input', '“Listening”, then “Stopped”', 'A visually hidden `status` line in the composer.'],
  ['A chart being drawn', '“Kassandra is drawing a chart”', 'A hidden `status` line in the widget card while its skeleton shows.'],
  ['The hotel picker', 'What was added or removed', 'A hidden `status` line, because the list stays open while you pick.'],
  ['Something failed', 'The message, at once', '`role="alert"`, in plain words, with what to do next.'],
  ['Receipts', '“Saved to Portfolio overview” with View and Undo', 'Toasts are announced. On a phone they sit at the top, away from the composer.'],
];

const MOTION: readonly DocsCell[] = [
  { title: 'The orb holds still', text: 'With reduced motion on, the WebGL orb draws one frame per state and stops. Listening is drawn mid-word, so the state is still clear.' },
  { title: 'Skeletons do not shimmer', text: 'The loading sweep becomes a static block. The box keeps its size either way, so nothing jumps.' },
  { title: 'Flows do not march', text: 'The dashed edges on the architecture map stop moving and become solid lines.' },
  { title: 'Nothing depends on it', text: 'Charts draw without their entry animation, and panels appear without sliding. Every state change still happens.' },
];

const TOUCH: readonly DocsCell[] = [
  { title: '44 px targets', text: 'On a coarse pointer every control grows to at least 44 px, in both themes and both modes. The dense desktop heights stay on desktop.' },
  { title: '16 px inputs', text: 'Fields are 16 px on a phone, so iOS does not zoom the page when one takes focus.' },
  { title: 'Tooltips are never the only way', text: 'They are on icon-only buttons, which also have an accessible name. They wait 600 ms, and they never show on touch.' },
  { title: 'Sheets, not popovers', text: 'On a phone the hotel picker and the evidence panel open as bottom sheets, where a thumb reaches them.' },
];

const CHOICE: readonly DocsCell[] = [
  { title: 'Speak or type', text: 'Voice is a second way to ask, not a feature for its own sake. If the microphone is blocked the app says so, and typing always works.' },
  { title: 'No time limits', text: 'Voice never sends on its own: you tap send, or stop. A link from an email only fills the question in. Nothing acts because a timer ran out.' },
  { title: 'Plain words', text: 'Errors say what happened and what to do. Dates and codes from the model are turned into words before they reach the screen.' },
];

const CHECK: readonly string[] = [
  'Press **Tab** from the top of any page. The skip link comes first, and you can see where focus is at every step.',
  'Open the theme lab. Its contrast table measures every text and chart pair in the theme on screen, in WCAG 2 and APCA.',
  'Turn on **Reduce motion** in your system settings and reload. The orb, the skeletons and the map stop moving.',
  'Run axe DevTools on this page, then switch the theme and run it again.',
  'On any chart, press **View as table**.',
];

/**
 * /docs/accessibility: what the target is, how it is checked, and what was found and fixed. Every claim names
 * something that can be checked in the app or in the history.
 */
@Component({
  selector: 'docs-accessibility',
  imports: [...DOCS_KIT, DocsColourShifts, WidgetChart],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-section-lg">
      <docs-head
        eyebrow="Docs · Accessibility"
        title="Accessibility was a constraint from the first day"
        lede="I did not leave it for a pass at the end. The rule that every view must pass axe and meet WCAG AA is in the project’s instructions, so it applied to the first screen and to every agent that wrote code after it. This page says what the target is, how it is checked, and what was found and fixed."
      />

      <dl class="docs-cells" style="--docs-cell-min: 200px">
        @for (f of facts; track f.label) {
          <div>
            <dt class="order-2 text-[14px] font-medium">{{ f.label }}</dt>
            <dd class="order-1 text-[24px]/tight font-semibold tracking-[-0.02em] tabular-nums">{{ f.value }}</dd>
            <dd class="text-muted-foreground order-3 text-[13px]/snug">{{ f.note }}</dd>
          </div>
        }
      </dl>

      <docs-section heading="Colour: inspired by Juyo’s mobile app colours, then adjusted for WCAG AA" anchor="colour" note="The palette was taken from Juyo’s own mobile app: screenshots of the Juyo app on Google Play, plus the CSS of their web app. Where a sampled colour failed for the job it had, I moved it by the smallest step that passes. Each pair below is the original colour and the token that replaced it, with the contrast of both on the same background. The ratios are computed on this page from the hex values.">
        <docs-colour-shifts [shifts]="shifts" />
        <p class="text-muted-foreground mt-3 max-w-[76ch] text-[13.5px]/relaxed">
          WCAG 2.2 AA is the gate. APCA is shown beside it in the concept theme’s spec and in <a class="docs-link" href="/theme-lab" (click)="lab($event)">the theme lab</a>, because it tracks small text and dark surfaces more closely. The sampling of Juyo’s colours is in <docs-source path="docs/research/ui-refinement/juyo_brand.md" kind="blob" />, and the concept theme’s contrast tables are in <docs-source path="docs/research/theme/juyo-concept-spec.md" kind="blob" />.
        </p>
      </docs-section>

      <docs-section heading="Change is never colour alone" anchor="not-colour">
        <div class="docs-panel mb-4 overflow-x-auto p-4" tabindex="0" role="region" aria-label="Sample: three changes shown with an arrow, a sign and a colour">
          <table class="w-full min-w-[420px] text-[13.5px] tabular-nums">
            <caption class="sr-only">Room revenue against last year for three hotels</caption>
            <thead>
              <tr class="text-muted-foreground text-[12px]">
                <th scope="col" class="border-border border-b py-1.5 text-left font-medium">Hotel</th>
                <th scope="col" class="border-border border-b py-1.5 text-right font-medium">On the books</th>
                <th scope="col" class="border-border border-b py-1.5 text-right font-medium">Against last year</th>
              </tr>
            </thead>
            <tbody>
              @for (r of sample; track r.hotel) {
                <tr>
                  <th scope="row" class="border-border border-b py-1.5 text-left font-normal">{{ r.hotel }}</th>
                  <td class="border-border border-b py-1.5 text-right">{{ r.otb }}</td>
                  <td class="border-border border-b py-1.5 text-right" [class]="r.up ? 'text-(--positive)' : 'text-(--negative)'"><span aria-hidden="true">{{ r.up ? '▲' : '▼' }} </span>{{ r.gap }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <docs-cells [items]="notColour" [min]="380" />
      </docs-section>

      <docs-section heading="The gate: axe, on every view" anchor="axe" note="A branch is not merged until axe reports no violations on the views it touches, in the default theme’s Light and Dark and in the Juyo concept, on desktop and on a phone. For the chart catalogue that includes both densities. These ten docs pages were checked the same way: three theme and mode combinations, two sizes, 0 violations.">
        <h3 class="mb-2 text-[16px] font-semibold tracking-[-0.01em]">Found and fixed</h3>
        <p class="text-muted-foreground mb-3 max-w-[76ch] text-[14px]/relaxed">A gate is only worth something if it stops things. These are real findings from the history, with the fix and where it landed.</p>
        <docs-table caption="Accessibility violations that were found and fixed" [head]="['Finding', 'Where', 'Fix', 'When']" [rows]="fixed" [nowrap]="[3]" [minWidth]="760" />
      </docs-section>

      <docs-section heading="Keyboard: every flow works without a mouse" anchor="keyboard" note="Focus is always visible. The default themes draw a ring on each control; the concept theme draws one ring everywhere, a 2 px line with a 2 px gap.">
        <docs-table caption="How each flow works from the keyboard" [head]="['Flow', 'Keys', 'What happens']" [rows]="keyboard" [minWidth]="720" />
      </docs-section>

      <docs-section heading="Screen readers: what is said, and when" anchor="screen-readers" note="A streamed answer and a chart that draws itself are easy to get wrong: either nothing is announced, or every token is. Each of these has a live region with a decided behaviour.">
        <docs-table caption="What a screen reader announces" [head]="['Moment', 'What is announced', 'How']" [rows]="spoken" [minWidth]="720" />

        <h3 class="mt-8 mb-1 text-[16px] font-semibold tracking-[-0.01em]">A chart is also a table</h3>
        <p class="text-muted-foreground mb-3 max-w-[76ch] text-[14px]/relaxed">Every chart in the catalogue has a text summary, steps through its points with the arrow keys, and offers the same rows as a table with a caption and scoped headers. Try “View as table” on this one.</p>
        <div class="docs-panel max-w-[720px] p-4 sm:p-5">
          <juyo-widget-chart [spec]="chart.spec" [rows]="chart.rows" [columns]="chart.columns" [compact]="true" />
        </div>
      </docs-section>

      <docs-section heading="Motion: reduced motion is honoured" anchor="motion">
        <docs-cells [items]="motion" [min]="380" />
      </docs-section>

      <docs-section heading="Touch and small screens" anchor="touch">
        <docs-cells [items]="touch" [min]="380" />
      </docs-section>

      <docs-section heading="More than one way, and no clock" anchor="choice">
        <docs-cells [items]="choice" [min]="280" />
      </docs-section>

      <div class="grid gap-x-10 gap-y-12 lg:grid-cols-2">
        <docs-section heading="Check it yourself" anchor="check">
          <ol class="docs-steps">
            @for (c of check; track c) {
              <li><span class="docs-md text-muted-foreground" [innerHTML]="c | md"></span></li>
            }
          </ol>
        </docs-section>

        <docs-section heading="What has not been done" anchor="limits">
          <ul class="text-muted-foreground flex max-w-[64ch] flex-col gap-3 text-[14px]/relaxed">
            <li>axe finds what a machine can find. I have not tested Compass with people who use a screen reader or a switch every day, and that is the test that matters.</li>
            <li>The theme lab’s own audit found four pairs in the default themes that miss: the dark field border (1.54:1), the dark focus ring beside a primary button (1.63:1), white on the dark destructive red (3.16:1) and a faded secondary text in light (3.73:1). The concept theme meets all of them. In Light and Dark they are listed as follow-ups.</li>
            <li>The architecture map is a wide drawing. It has a text summary and its steps are a list, but on a phone it scrolls sideways.</li>
          </ul>
        </docs-section>
      </div>
    </div>
  `,
})
export class DocsAccessibility {
  private readonly store = inject(CompassStore);
  protected readonly facts = FACTS;
  protected readonly shifts = COLOUR_SHIFTS;
  protected readonly notColour = NOT_COLOUR_ALONE;
  protected readonly fixed = FIXED;
  protected readonly keyboard = KEYBOARD;
  protected readonly spoken = SPOKEN;
  protected readonly motion = MOTION;
  protected readonly touch = TOUCH;
  protected readonly choice = CHOICE;
  protected readonly check = CHECK;
  protected readonly chart = SPECIMENS.flatMap((g) => g.items).find((s) => s.spec.kind === 'line')!;
  protected readonly sample = [
    { hotel: 'Dubai Business Bay', otb: '€184,300', gap: '+€41,200', up: true },
    { hotel: 'Lisbon Chiado', otb: '€96,010', gap: '−€5,865', up: false },
    { hotel: 'Vienna Ring', otb: '€211,746', gap: '+€2,846', up: true },
  ];

  protected lab(event: MouseEvent) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    this.store.go('theme-lab');
  }
}
