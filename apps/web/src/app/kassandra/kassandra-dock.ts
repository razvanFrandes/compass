import { Component, DestroyRef, ElementRef, afterNextRender, inject, input, signal } from '@angular/core';

/**
 * Kassandra docked at the bottom of a page, as on the Inbox: fixed to the bottom of the page's column (`within`, the
 * page's host: its left edge and width, so the sidebar is never covered), above the phone's safe area, with the fade
 * of the page above it. It writes its height to `--dock-h` on `within`, so the page pads its bottom by it and its last
 * card scrolls fully clear.
 *
 *   <kassandra-dock [within]="host"><kassandra-composer … /></kassandra-dock>
 */
@Component({
  selector: 'kassandra-dock',
  host: { class: 'kassandra-dock k-dock', '[style.left.px]': 'box().left', '[style.width.px]': 'box().width || null' },
  template: `<div class="k-dock-inner"><ng-content /></div>`,
})
export class KassandraDock {
  readonly within = input.required<HTMLElement>();
  protected readonly box = signal({ left: 0, width: 0 });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const column = this.within();
      const measure = () => {
        const r = column.getBoundingClientRect();
        this.box.set({ left: Math.round(r.left), width: Math.round(r.width) });
        column.style.setProperty('--dock-h', `${Math.ceil(host.getBoundingClientRect().height) + 28}px`);
      };
      measure();
      if (typeof ResizeObserver !== 'function') return;
      // Measured on the next frame: writing --dock-h resizes the column, which must not re-enter the observer's loop.
      let frame = 0;
      const later = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(measure);
      };
      const sizes = new ResizeObserver(later);
      sizes.observe(host);
      sizes.observe(column);
      addEventListener('resize', later);
      destroy.onDestroy(() => {
        cancelAnimationFrame(frame);
        sizes.disconnect();
        removeEventListener('resize', later);
        column.style.removeProperty('--dock-h');
      });
    });
  }
}
