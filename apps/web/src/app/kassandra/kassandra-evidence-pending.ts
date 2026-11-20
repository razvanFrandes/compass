import { Component, computed, input } from '@angular/core';
import type { EvidenceSlot } from './live-slots';

/**
 * The evidence cards that are on their way, for the top of "How this was computed": one row per data tool call
 * that has not answered yet. First a skeleton of the row (the call has started), then its human title and what it
 * reads (the arguments are known), with the data still a skeleton; when the result is in, the evidence panel's own
 * card takes over. A row has the height of a collapsed evidence card, so the list does not jump.
 */
@Component({
  selector: 'kassandra-evidence-pending',
  host: { class: 'block' },
  template: `
    @if (pending().length) {
      <ol class="mb-4 flex flex-col gap-2" aria-label="Data Kassandra is reading">
        @for (s of pending(); track s.callId) {
          <li class="insight-card flex min-h-[62px] items-center gap-3 px-4 py-3" [attr.data-phase]="s.phase">
            <span class="min-w-0 flex-1" role="status">
              @if (s.title) {
                <span class="block truncate text-[14px]/5 font-medium">{{ s.title }}</span>
                <span class="text-muted-foreground block truncate text-[12.5px]/[18px]">{{ s.detail ? s.detail + ' · ' : '' }}Reading the data…</span>
              } @else {
                <span class="sr-only">Kassandra is reading data</span>
                <i class="k-skel my-[3px] block h-3.5 w-2/5"></i>
                <i class="k-skel my-[3px] block h-3 w-3/5"></i>
              }
            </span>
            <i class="k-skel block h-2 w-16 !rounded-full" aria-hidden="true"></i>
          </li>
        }
      </ol>
    }
  `,
})
export class KassandraEvidencePending {
  /** The data calls of the turn the panel explains (see `evidenceSlots`). */
  readonly slots = input.required<readonly EvidenceSlot[]>();
  /** Calls whose skeleton has just appeared and must stay a little longer (see `SkeletonHold`). */
  readonly held = input<ReadonlySet<string>>(new Set());

  protected readonly pending = computed(() =>
    this.slots()
      .filter((slot) => slot.phase !== 'ready' || this.held().has(slot.callId))
      .map((slot) => (slot.phase === 'ready' ? { ...slot, phase: 'described' as const } : slot)),
  );
}
