import { Component, inject } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { CompassStore } from './store';

/** An address the app doesn't know: say so, and offer the way back. */
@Component({
  selector: 'app-not-found',
  imports: [HlmButtonImports],
  host: { class: 'block' },
  template: `
    <section class="mx-auto max-w-[560px] px-6 pt-24 pb-28 text-center" aria-labelledby="nf-title">
      <p class="text-muted-foreground text-[13px] font-medium tracking-[0.06em] uppercase">404</p>
      <h1 id="nf-title" class="mt-2 text-[26px] font-semibold tracking-[-0.02em]">This page doesn’t exist</h1>
      <p class="text-muted-foreground mt-2 text-[15px]">The link may be old or mistyped. Start again from one of these.</p>
      <div class="mt-6 flex flex-wrap justify-center gap-2">
        <button hlmBtn (click)="store.go('inbox')">Go to the morning brief</button>
        <button hlmBtn variant="outline" (click)="store.go('boards')">Boards</button>
        <button hlmBtn variant="outline" (click)="store.go('watchers')">Agent Studio</button>
      </div>
    </section>
  `,
})
export class NotFound {
  protected readonly store = inject(CompassStore);
}
