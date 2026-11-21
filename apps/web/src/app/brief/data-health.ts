import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import type { BriefFeed } from '@compass/contracts';
import { healthModel, syncTime } from './brief-model';

/**
 * Data health: every source system behind the numbers on this page, for the hotels in scope. A feed that is not
 * fresh leads, with when it last synced; the rest are one line per system with a mark per hotel.
 */
@Component({
  selector: 'app-data-health',
  encapsulation: ViewEncapsulation.None,
  styleUrl: './data-health.css',
  imports: [HlmButtonImports],
  host: { class: 'block min-w-0' },
  template: `
    @let m = model();
    <p class="health-sum" [attr.data-ok]="m.stale.length ? 'no' : 'yes'">
      <i class="health-dot" aria-hidden="true"></i>
      <span
        ><strong>{{ m.fresh }} of {{ m.total }}</strong> feeds synced this morning@if (m.stale.length) {<span>, {{ m.stale.length }} {{ m.stale.length === 1 ? 'is' : 'are' }} behind</span>}</span
      >
    </p>

    @for (f of m.stale; track f.hotel_code + f.system) {
      <div class="health-stale">
        <p class="health-stale-title">{{ nameOf()(f.hotel_code) }} · {{ f.system }} ({{ f.vendor }})</p>
        <p class="health-stale-body">Last synced {{ sync(f.last_sync_at) }}: {{ f.days_behind }} {{ f.days_behind === 1 ? 'day' : 'days' }} behind. Numbers from this feed are incomplete until it syncs.</p>
        <button hlmBtn variant="outline" size="sm" (click)="explore.emit(f)">What does it affect?</button>
      </div>
    }

    <table class="health-table">
      <caption class="sr-only">
        Source systems and when they last synced
      </caption>
      <thead class="sr-only">
        <tr>
          <th scope="col">System</th>
          <th scope="col">Hotels</th>
          <th scope="col">Fresh</th>
          <th scope="col">Last sync</th>
        </tr>
      </thead>
      <tbody>
        @for (s of systems(); track s.system) {
          <tr>
            <th scope="row">{{ s.system }}</th>
            <td class="health-marks" aria-hidden="true">
              @for (mark of s.marks; track mark.code) {
                <i [class.health-mark--stale]="!mark.ok" [attr.title]="nameOf()(mark.code) + (mark.ok ? ': fresh' : ': behind')"></i>
              }
            </td>
            <td class="health-count" [class.health-count--bad]="s.fresh < s.total">{{ s.fresh }}/{{ s.total }}<span class="sr-only"> fresh</span></td>
            <td class="health-time">{{ s.synced || '–' }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class DataHealth {
  readonly feeds = input.required<readonly BriefFeed[]>();
  readonly nameOf = input<(code: string) => string>((code) => code);
  readonly explore = output<BriefFeed>();
  /** How many systems to list; the ones with a feed behind come first. Null lists them all. */
  readonly limit = input<number | null>(null);
  protected readonly model = computed(() => healthModel(this.feeds()));
  protected readonly systems = computed(() => (this.limit() === null ? this.model().systems : this.model().systems.slice(0, this.limit()!)));
  protected readonly sync = syncTime;
}
