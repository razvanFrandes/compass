import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorCaretRight } from '@ng-icons/phosphor-icons/regular';
import { BrnCollapsibleTrigger } from '@spartan-ng/brain/collapsible';
import { classes } from '@spartan-ng/helm/utils';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[hlmTraceCollapsibleTrigger]',
  exportAs: 'hlmTraceCollapsibleTrigger',
  imports: [NgIcon],
  providers: [provideIcons({ phosphorCaretRight })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: BrnCollapsibleTrigger, inputs: ['type'] }],
  host: { 'data-slot': 'trace-collapsible-trigger' },
  template: `
    <ng-content />
    <ng-icon
      name="phosphorCaretRight"
      class="transition-transform group-aria-expanded/trace-collapsible-trigger:rotate-90 motion-reduce:transition-none"
    />
  `,
})
export class HlmTraceCollapsibleTrigger {
  constructor() {
    classes(
      () =>
        'focus-visible:ring-ring/30 gap-1 rounded-sm focus-visible:ring-2 group/trace-collapsible-trigger text-muted-foreground hover:text-foreground has-[[data-status=error]]:text-destructive flex w-fit max-w-full min-w-0 cursor-pointer items-center text-left transition-colors outline-none',
    );
  }
}
