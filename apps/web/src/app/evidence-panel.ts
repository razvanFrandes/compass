import { Component, computed, input } from '@angular/core';
import { ChatStep } from './api';
import { argsLine, toolLabel } from './chat-turn';

/**
 * "How this was computed", from the evidence every data tool returns: the sources, the metric definitions,
 * the period, the business date, the exact SQL with its parameters and the row count, plus the first rows.
 * Facts, never the model's reasoning.
 */
@Component({
  selector: 'app-evidence-panel',
  host: { class: 'block' },
  template: `
    @if (steps().length) {
      <ol class="flex flex-col gap-4">
        @for (s of steps(); track s.callId) {
          @let e = s.evidence!;
          <li [id]="'ev-' + s.callId" class="insight-card p-4 text-[13px]" [class]="s.callId === focus() ? 'ring-1 ring-(--focus-brand)' : ''">
            <p class="font-medium">{{ label(s.name) }}</p>
            @if (args(s); as a) {
              <p class="text-muted-foreground text-[12.5px]">{{ a }}</p>
            }
            <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
              @if (e.period) {
                <dt class="text-muted-foreground">Period</dt>
                <dd>{{ e.period.from }} → {{ e.period.to }}</dd>
              }
              <dt class="text-muted-foreground">Data as of</dt>
              <dd>{{ e.businessDate }}: stays before it are actuals, from it on are on the books</dd>
              <dt class="text-muted-foreground">Rows</dt>
              <dd>{{ e.rowCount }}</dd>
              <dt class="text-muted-foreground">Sources</dt>
              <dd class="flex flex-wrap gap-1">
                @for (src of e.sources; track src) {
                  <span class="bg-muted rounded px-1.5 py-0.5 font-mono text-[11.5px]">{{ src }}</span>
                }
              </dd>
              @for (d of defs(e.definitions); track d[0]) {
                <dt class="text-muted-foreground">{{ d[0] }}</dt>
                <dd>{{ d[1] }}</dd>
              }
            </dl>
            @for (n of e.notes; track $index) {
              <p class="text-muted-foreground mt-2 text-[12.5px]">{{ n }}</p>
            }
            @if (s.rows?.length) {
              @let cols = columns(s);
              <div class="mt-3 max-h-48 overflow-auto" tabindex="0" [attr.aria-label]="label(s.name) + ', first rows'">
                <table class="w-full text-[12px] tabular-nums">
                  <thead class="text-muted-foreground sticky top-0 bg-(--card)">
                    <tr>
                      @for (c of cols; track c) {
                        <th scope="col" class="border-border border-b py-1 pr-3 text-left font-medium whitespace-nowrap">{{ c }}</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of s.rows!.slice(0, 8); track $index) {
                      <tr class="border-border border-b last:border-b-0">
                        @for (c of cols; track c) {
                          <td class="py-1 pr-3 whitespace-nowrap">{{ cell(r[c]) }}</td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              @if (s.rows!.length > 8) {
                <p class="text-muted-foreground mt-1 text-[11.5px]">First 8 of {{ s.rows!.length }} rows</p>
              }
            }
            <details class="mt-3">
              <summary class="text-muted-foreground hover:text-foreground cursor-pointer text-[12.5px]">SQL</summary>
              <pre class="latest-panel mt-2 max-h-56 overflow-auto rounded-[8px] p-3 font-mono text-[11.5px]/relaxed whitespace-pre">{{ e.sql }}</pre>
              @if (e.params.length) {
                <p class="text-muted-foreground mt-1 font-mono text-[11.5px]">params: {{ params(e.params) }}</p>
              }
            </details>
          </li>
        }
      </ol>
    } @else {
      <p class="text-muted-foreground text-[13px]">{{ empty() }}</p>
    }
  `,
})
export class EvidencePanel {
  readonly allSteps = input.required<ChatStep[]>();
  readonly focus = input<string | null>(null);
  readonly empty = input('Numbers in the answer will show where they came from here.');
  protected readonly steps = computed(() => this.allSteps().filter((s) => !!s.evidence));
  protected readonly label = toolLabel;
  protected args(s: ChatStep) {
    return argsLine(s.args);
  }
  protected defs(d: Record<string, string>) {
    return Object.entries(d);
  }
  protected columns(s: ChatStep) {
    return Object.keys(s.rows?.[0] ?? {}).slice(0, 6);
  }
  protected cell(v: unknown) {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString('en-GB') : v.toLocaleString('en-GB', { maximumFractionDigits: 2 });
    return String(v);
  }
  protected params(p: unknown[]) {
    return JSON.stringify(p);
  }
}
