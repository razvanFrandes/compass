import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import type { BriefNights } from '@compass/contracts';
import type { HotelRef } from '../scope/hotels';
import { FLAG_TEXT, type NightCell, nightQuestion, nightsModel, notableRows } from './brief-model';

/** A long list of hotels opens with this many: the ones with something to look at. */
export const NIGHTS_OPEN_WITH = 8;
const shortDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayOf = (iso: string) => shortDay.format(Date.parse(`${iso}T00:00:00Z`));

/**
 * The next 14 nights as an occupancy calendar: one row for the scope, one per hotel. A fill of one hue in five
 * steps says how full a night is; ✦ marks a city event and an orange dot a rate that is out of line with the
 * comp set. It is a real table, so it reads in rows and columns; a night of the scope and a flagged night of a hotel
 * are buttons that ask Kassandra about it.
 */
@Component({
  selector: 'app-nights-calendar',
  encapsulation: ViewEncapsulation.None,
  styleUrl: './nights-calendar.css',
  host: { class: 'block min-w-0' },
  template: `
    @let m = model();
    <div class="nights-scroll" tabindex="0" role="group" [attr.aria-label]="'Occupancy for the next 14 nights, ' + scopeLabel()">
      <table class="nights">
        <caption class="sr-only">
          Occupancy on the books for the next 14 nights, {{ scopeLabel() }}. Each cell is a night; flagged nights have a rate to check.
        </caption>
        <thead>
          <tr>
            <th scope="col" class="nights-corner"><span class="sr-only">Hotel</span></th>
            @for (d of m.days; track d.date) {
              <th scope="col" class="nights-day" [class.nights-day--weekend]="d.weekend">
                <span class="nights-dow" aria-hidden="true">{{ d.weekday }}</span>
                <span class="nights-date" aria-hidden="true">{{ d.day }}</span>
                @if (d.month) {
                  <span class="nights-month" aria-hidden="true">{{ d.month }}</span>
                }
                <span class="sr-only">{{ d.full }}</span>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          <tr class="nights-total">
            <th scope="row" class="nights-name">{{ single() ? m.rows[0]!.name : scopeLabel() }}</th>
            @for (c of lead(); track c.date; let i = $index) {
              <td>
                <button type="button" class="nights-cell nights-cell--big" [attr.data-step]="c.step" [attr.aria-label]="c.label + ' Ask Kassandra.'" [attr.title]="c.label" (click)="askAbout(c, i)">
                  <span class="nights-occ" aria-hidden="true">{{ c.occupancy === null ? '–' : round(c.occupancy) }}</span>
                  <span class="nights-marks" aria-hidden="true">
                    @if (c.events.length && single()) {
                      <i class="nights-event">✦</i>
                    }
                    @if (c.flags) {
                      <i class="nights-flag"></i>
                    }
                  </span>
                </button>
              </td>
            }
          </tr>
          @if (!single()) {
            @for (r of rows(); track r.code) {
              <tr>
                <th scope="row" class="nights-name nights-name--hotel">{{ r.name }}</th>
                @for (c of r.cells; track c.date; let i = $index) {
                  <td>
                    @if (c.flag) {
                      <button type="button" class="nights-cell nights-cell--flagged" [attr.data-step]="c.step" [attr.aria-label]="c.label + ' Ask Kassandra.'" [attr.title]="c.label" (click)="ask.emit(question(m.days[i]!.full, r.code, c))">
                        <i class="nights-flag" aria-hidden="true"></i>
                      </button>
                    } @else {
                      <span class="nights-cell" [attr.data-step]="c.step" [attr.title]="c.label">
                        @if (c.events.length) {
                          <i class="nights-event" aria-hidden="true">✦</i>
                        }
                        <span class="sr-only">{{ c.label }}</span>
                      </span>
                    }
                  </td>
                }
              </tr>
            }
          }
        </tbody>
      </table>
    </div>

    <div class="nights-legend">
      <p class="nights-ramp">
        <span>Occupancy</span>
        <span class="nights-ramp-end">under 40%</span>
        <span class="nights-ramp-bar" aria-hidden="true"><i data-step="0"></i><i data-step="1"></i><i data-step="2"></i><i data-step="3"></i><i data-step="4"></i></span>
        <span class="nights-ramp-end">85% and over</span>
      </p>
      <p class="nights-key"><i class="nights-event" aria-hidden="true">✦</i>City event</p>
      <p class="nights-key"><i class="nights-flag" aria-hidden="true"></i>Rate to check</p>
    </div>

    @if (notes().length) {
      <ul class="nights-notes">
        @for (n of notes(); track n.text) {
          <li [attr.data-kind]="n.kind">
            @if (n.kind === 'event') {
              <i class="nights-event" aria-hidden="true">✦</i>
            } @else {
              <i class="nights-flag" aria-hidden="true"></i>
            }
            <span>{{ n.text }}</span>
          </li>
        }
      </ul>
    } @else {
      <p class="nights-none">No city events and no rates out of line with the comp set in these 14 nights.</p>
    }
  `,
})
export class NightsCalendar {
  readonly nights = input.required<BriefNights>();
  readonly hotels = input.required<readonly HotelRef[]>();
  readonly scopeLabel = input('');
  readonly ask = output<string>();

  protected readonly model = computed(() => nightsModel(this.nights(), this.hotels()));
  protected readonly single = computed(() => this.model().rows.length === 1);
  /** The first row: the scope's nights, or the one hotel's own (with its flags) when the scope is a single hotel. */
  protected readonly lead = computed<NightCell[]>(() => (this.single() ? this.model().rows[0]!.cells : this.model().total));
  /** Every hotel of the scope, or (the default) the ones with something to look at. The section's "View all" sets it. */
  readonly showAll = input(false);
  protected readonly rows = computed(() => (this.showAll() ? this.model().rows : notableRows(this.model().rows, NIGHTS_OPEN_WITH)));
  protected readonly round = Math.round;

  /** Under the calendar, in words: each event with its hotels and dates, then the hotels with rates to check. */
  protected readonly notes = computed(() => {
    const m = this.model();
    const events = m.events.map((name) => {
      const rows = m.rows.filter((r) => r.cells.some((c) => c.events.includes(name)));
      const dates = [...new Set(rows.flatMap((r) => r.cells.filter((c) => c.events.includes(name)).map((c) => c.date)))].sort();
      const span = dates.length > 1 ? `${dayOf(dates[0]!)} to ${dayOf(dates.at(-1)!)}` : dayOf(dates[0]!);
      return { kind: 'event' as const, text: `${name}: ${rows.map((r) => r.name).join(', ')}, ${span}` };
    });
    const flags = m.rows
      .filter((r) => r.flags)
      .map((r) => {
        const cells = r.cells.filter((c) => c.flag);
        const why = FLAG_TEXT[cells[0]!.flag!];
        return { kind: 'flag' as const, text: `${r.name}: ${cells.length} ${cells.length === 1 ? 'night' : 'nights'} with the ${why} (${cells.map((c) => dayOf(c.date)).join(', ')})` };
      });
    return [...flags, ...events];
  });

  protected question(full: string, code: string, cell: NightCell): string {
    return nightQuestion(full, this.hotels().find((h) => h.code === code)?.name ?? code, cell.flag);
  }

  protected askAbout(cell: NightCell, index: number) {
    const m = this.model();
    const full = m.days[index]!.full;
    this.ask.emit(this.single() ? this.question(full, m.rows[0]!.code, cell) : nightQuestion(full));
  }
}
