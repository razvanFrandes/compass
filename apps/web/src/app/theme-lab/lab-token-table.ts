import { Component, ElementRef, afterRenderEffect, inject, input, signal } from '@angular/core';
import { LabState, readToken, rgbOf } from './lab-kit';

/** A token table read from the rendered CSS: the name and the value the pane resolves it to. */
@Component({
  selector: 'app-lab-token-table',
  host: { class: 'block' },
  template: `
    <table class="w-full table-fixed text-[12.5px]">
      <caption class="sr-only">{{ caption() }}</caption>
      <thead class="sr-only">
        <tr><th scope="col">Token</th><th scope="col">Value</th></tr>
      </thead>
      <tbody>
        @for (r of rows(); track r.name) {
          <tr>
            <th scope="row" class="w-[46%] truncate border-b border-border py-1 pr-3 text-left font-mono text-[12px] font-normal">{{ r.name }}</th>
            <td class="border-b border-border py-1">
              <span class="flex min-w-0 items-center gap-2">
                @if (r.colour) {
                  <span class="size-3.5 shrink-0 rounded-[2px] border border-border" [style.background]="r.value"></span>
                }
                <span class="min-w-0 truncate tabular-nums" [class]="r.value ? '' : 'text-muted-foreground'" [attr.title]="r.value">{{ r.value || 'not set' }}</span>
              </span>
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class LabTokenTable {
  readonly names = input.required<readonly string[]>();
  readonly caption = input('Design tokens and their values');
  protected readonly rows = signal<{ name: string; value: string; colour: boolean }[]>([]);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  constructor() {
    const lab = inject(LabState);
    afterRenderEffect(() => {
      lab.version();
      const el = this.host.nativeElement;
      this.rows.set(
        this.names().map((name) => {
          const value = readToken(el, name);
          return { name, value, colour: !!value && !/^[\d.]/.test(value) && rgbOf(value) !== null };
        }),
      );
    });
  }
}
