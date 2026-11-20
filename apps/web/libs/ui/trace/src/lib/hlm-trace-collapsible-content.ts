import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BrnCollapsibleContent } from '@spartan-ng/brain/collapsible';
import { classes, hlm } from '@spartan-ng/helm/utils';
import { ClassValue } from 'cn';

@Component({
  selector: 'hlm-trace-collapsible-content',
  exportAs: 'hlmTraceCollapsibleContent',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: BrnCollapsibleContent, inputs: ['id'] }],
  host: { 'data-slot': 'trace-collapsible-content' },
  template: `
    <div [class]="_computedContentInnerClasses()" data-slot="trace-collapsible-content-inner">
      <ng-content />
    </div>
  `,
})
export class HlmTraceCollapsibleContent {
  public readonly contentInnerClasses = input<ClassValue>();

  protected readonly _computedContentInnerClasses = computed(() =>
    hlm(
      'mt-1.5 mb-1 ml-[calc(--spacing(1.75)-1px)] border-l pr-1 pl-3.75 text-muted-foreground min-w-0 wrap-break-word',
      this.contentInnerClasses(),
    ),
  );

  constructor() {
    classes(
      () =>
        'duration-200 block min-w-0 overflow-hidden transition-[height] data-[state=closed]:h-0 data-[state=open]:h-(--brn-collapsible-content-height) motion-reduce:transition-none',
    );
  }
}
