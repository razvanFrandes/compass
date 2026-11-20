import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { CompassStore, RunOutcome, Watcher, WatcherStatus } from './store';
import { LEVELS, STATUS, TEMPLATES } from './watcher-data';
import * as icons from './icons';

const ORDER: WatcherStatus[] = ['needs', 'failed', 'running', 'watching', 'paused'];

/*
  Watchers (docs/research/ui-round3/agents_pattern.md §5): cards with a run strip.
  Each card answers: who is this, is it OK, what did it last find, how often has it found something,
  when does it run next, how far may it go. The run strip follows Sentry Crons; height carries meaning
  (tall = found something), so it reads without colour. Autonomy is one control per watcher; raising it asks,
  lowering it is immediate with Undo. "Acts within limits" is shown locked: Compass never changes rates.
*/
@Component({
  selector: 'app-watchers',
  imports: [NgIcon, HlmButtonImports, HlmDropdownMenuImports, HlmSwitchImports],
  providers: [provideIcons({ ...icons })],
  host: { class: 'block' },
  template: `
    <div class="mx-auto flex max-w-[1180px] flex-col gap-6 px-[max(16px,env(safe-area-inset-left,0px))] pt-6 pb-28 sm:px-8 lg:pt-8">
      <header class="flex items-start justify-between gap-4 sm:items-end">
        <div class="max-w-[60ch] min-w-0">
          <h1 class="text-[26px] font-semibold tracking-[-0.02em]">Watchers</h1>
          <p class="text-muted-foreground mt-1 text-[15px]/relaxed">Checks Kassandra runs on a schedule. Nothing changes in your systems without your approval.</p>
        </div>
        <button hlmBtn class="shrink-0 max-sm:size-11 max-sm:px-0" aria-label="New watcher" [hlmDropdownMenuTrigger]="newMenu" align="end"><ng-icon name="phosphorPlusLight" /><span class="max-sm:hidden">New watcher</span><ng-icon name="phosphorCaretDownLight" class="opacity-70 max-sm:hidden" /></button>
        <ng-template #newMenu>
          <hlm-dropdown-menu class="w-60">
            <button hlmDropdownMenuItem (triggered)="store.openBuilder()"><ng-icon name="phosphorSparkleFill" class="text-(--brand)" />New workflow by chat</button>
            <button hlmDropdownMenuItem (triggered)="scrollToTemplates()"><ng-icon name="phosphorSquaresFourLight" />From a template</button>
            <button hlmDropdownMenuItem (triggered)="store.startCreate('manual')"><ng-icon name="phosphorSlidersHorizontalLight" />Set up manually</button>
          </hlm-dropdown-menu>
        </ng-template>
      </header>

      <div class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Filter watchers">
        @for (f of filters(); track f.id) {
          <button type="button" role="radio" class="filter-chip" [attr.aria-checked]="filter() === f.id" (click)="filter.set(f.id)">
            @if (f.id === 'needs') {
              <i class="size-1.5 rounded-full bg-(--decision)"></i>
            }
            {{ f.label }} <span class="tabular-nums">{{ f.count }}</span>
          </button>
        }
      </div>

      <ul class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))]">
        @for (w of visible(); track w.id) {
          <li class="min-w-0">
            <article class="watcher-card watcher-card--link flex h-full flex-col gap-4 p-5" [class.watcher-card--needs]="w.status === 'needs'" [attr.aria-labelledby]="'w-' + w.id">
              <header class="flex items-center gap-3">
                <span class="watcher-glyph grid size-11 shrink-0 place-items-center rounded-[12px]"><ng-icon [name]="w.glyph" class="text-[22px]" /></span>
                <div class="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <h2 [id]="'w-' + w.id" class="max-w-full truncate text-[16px]/tight font-semibold"><button type="button" class="card-link underline-offset-2 hover:underline" (click)="store.openWatcher(w.id)">{{ w.name }}</button></h2>
                <span class="status-chip" [class]="status[w.status].cls">
                  @if (w.status === 'running') {
                    <ng-icon name="phosphorCircleNotchLight" class="motion-safe:animate-spin" />
                  } @else if (w.status === 'paused') {
                    <ng-icon name="phosphorPauseFill" class="text-[10px]" />
                  } @else {
                    <i class="size-1.5 rounded-full bg-current"></i>
                  }
                  {{ status[w.status].label }}
                </span>
                </div>
              </header>

              <div class="latest-panel rounded-[12px] p-3">
                <p class="text-muted-foreground text-[11.5px] font-medium tracking-[0.06em] uppercase">Latest · {{ w.latest.when }}</p>
                <p class="mt-1 text-[15px]/snug font-semibold">{{ w.latest.headline }}</p>
              </div>

              <div>
                <div class="text-muted-foreground flex items-baseline justify-between text-[12px]">
                  <span>Last 14 runs · {{ w.span }}</span>
                </div>
                <div class="run-strip mt-2" role="img" [attr.aria-label]="stripLabel(w)">
                  @for (r of w.runs; track $index) {
                    <i [class]="'run run--' + r"></i>
                  }
                </div>
              </div>

              <div class="flex flex-col gap-2.5 text-[13px]">
                <p class="text-muted-foreground flex items-center gap-1.5">
                  <ng-icon name="phosphorClockLight" class="text-[15px]" />
                  {{ w.cadence }} · {{ w.status === 'running' ? 'running now…' : (w.next ?? 'paused') }}
                </p>
                <button type="button" class="autonomy-row above-link group flex items-center gap-2 rounded-[8px] text-left" [hlmDropdownMenuTrigger]="autonomyMenu" [hlmDropdownMenuTriggerData]="{ $implicit: w }" align="start" [attr.aria-label]="'Autonomy for ' + w.name + ': ' + levels[w.autonomy - 1].name + '. Change'">
                  <span class="text-muted-foreground">Autonomy</span>
                  <span class="flex gap-[3px]" aria-hidden="true">
                    @for (l of segs; track l) {
                      <i class="meter-seg" [class.is-on]="l <= w.autonomy"></i>
                    }
                  </span>
                  <span class="font-medium whitespace-nowrap">{{ levels[w.autonomy - 1].short }}</span>
                  <ng-icon name="phosphorCaretDownLight" class="text-muted-foreground group-hover:text-foreground" />
                </button>
              </div>

              <footer class="border-border mt-auto flex flex-wrap items-center gap-2 border-t pt-4">
                <label class="above-link flex items-center gap-2 text-[13px] [@media(pointer:coarse)]:min-h-11">
                  <hlm-switch [checked]="w.enabled" (checkedChange)="store.setEnabled(w.id, $event)" [attr.aria-label]="w.name + ' watcher'" />
                  <span [class.text-muted-foreground]="!w.enabled">{{ w.enabled ? 'On' : 'Paused' }}</span>
                </label>
                <span class="flex-1"></span>
                @if (w.status === 'needs' && w.cta) {
                  <button hlmBtn class="review-btn above-link max-sm:order-first max-sm:h-11 max-sm:w-full" (click)="store.openWatcher(w.id)">{{ w.cta }}<ng-icon name="phosphorArrowRightLight" /></button>
                } @else {
                  <button hlmBtn variant="ghost" class="above-link" [disabled]="w.status === 'running'" (click)="store.runNow(w.id)"><ng-icon name="phosphorPlayLight" />Run now</button>
                }
                <button hlmBtn variant="ghost" size="icon-sm" class="text-muted-foreground above-link" [attr.aria-label]="'More for ' + w.name" [hlmDropdownMenuTrigger]="moreMenu" [hlmDropdownMenuTriggerData]="{ $implicit: w }" align="end">
                  <ng-icon name="phosphorDotsThreeBold" class="text-[18px]" />
                </button>
              </footer>
            </article>
          </li>
        }
      </ul>

      <section aria-labelledby="activity-title" class="watcher-card p-5">
        <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="activity-title" class="text-[15px] font-semibold">Activity</h2>
          <p class="text-muted-foreground text-[12px]">Every run and every change is logged</p>
        </div>
        <div class="mt-3 grid gap-x-10 gap-y-3 lg:grid-cols-2">
          @for (day of days(); track day.day) {
            <div class="min-w-0">
              <h3 class="timeline-day">{{ day.day }}</h3>
              <ol class="timeline-items">
                @for (a of day.items; track $index) {
                  <li class="timeline-item">
                    @if (a.by) {
                      <span class="timeline-node timeline-node--you" aria-label="You">Y</span>
                    } @else {
                      <span class="timeline-node" aria-hidden="true"><ng-icon [name]="glyph(a.watcher)" class="text-[16px]" /></span>
                    }
                    <div class="min-w-0 flex-1">
                      <p class="text-[13.5px]/snug">{{ a.text }}</p>
                      <p class="text-muted-foreground text-[12px] tabular-nums">{{ a.time }}</p>
                    </div>
                    @if (a.action === 'review' && needsReview()) {
                      <button hlmBtn variant="secondary" size="sm" (click)="store.openWatcher(a.watcher)">Review</button>
                    }
                  </li>
                }
              </ol>
            </div>
          }
        </div>
      </section>

      <section #templatesSection aria-labelledby="templates-title" class="scroll-mt-6">
        <h2 id="templates-title" class="text-[15px] font-semibold">Add a watcher</h2>
        <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          @for (t of templates; track t.key) {
            <button type="button" class="clickable-card flex flex-col items-start gap-1.5 p-4 text-left" (click)="store.startCreate('review', t)">
              <span class="flex w-full items-center justify-between">
                <span class="watcher-glyph grid size-9 place-items-center rounded-[10px]"><ng-icon [name]="t.glyph" class="text-[18px]" /></span>
                <ng-icon name="phosphorPlusLight" class="text-muted-foreground" />
              </span>
              <span class="mt-1.5 text-[14px] font-medium">{{ t.name }}</span>
              <span class="text-muted-foreground text-[12.5px]/snug">{{ t.blurb }}</span>
              <span class="schedule-chip mt-auto"><ng-icon name="phosphorClockLight" />{{ t.cadence }}</span>
            </button>
          }
          <button type="button" class="border-border text-muted-foreground hover:text-foreground flex min-h-[132px] flex-col items-start justify-center gap-1.5 rounded-[12px] border border-dashed p-4 text-left transition-colors" (click)="store.startCreate('describe')">
            <ng-icon name="phosphorSparkleFill" class="text-[18px] text-(--brand)" />
            <span class="text-foreground text-[14px] font-medium">Describe your own…</span>
            <span class="text-[12.5px]/snug">Kassandra sets it up from one sentence</span>
          </button>
        </div>
      </section>
    </div>

    <ng-template #autonomyMenu let-w>
      <hlm-dropdown-menu class="w-[300px]">
        <hlm-dropdown-menu-label class="font-normal whitespace-normal">How far should <strong class="font-semibold">{{ w.name }}</strong> go before stopping for you?</hlm-dropdown-menu-label>
        @for (l of levels; track l.level) {
          <button hlmDropdownMenuItem class="items-start py-2" [disabled]="l.level === 3" (triggered)="changeAutonomy(w, l.level)">
            <span class="mt-1 flex shrink-0 gap-[3px]" aria-hidden="true">
              @for (s of segs; track s) {
                <i class="meter-seg" [class.is-on]="s <= l.level"></i>
              }
            </span>
            <span class="min-w-0 flex-1 whitespace-normal">
              <span class="flex items-center gap-1.5 font-medium">{{ l.name }}
                @if (l.level === 3) {
                  <ng-icon name="phosphorLockSimpleLight" />
                }
                @if (l.level === w.autonomy) {
                  <ng-icon name="phosphorCheckLight" class="ml-auto" />
                }
              </span>
              <span class="text-muted-foreground block text-[12px]/snug">{{ l.text }}</span>
            </span>
          </button>
        }
      </hlm-dropdown-menu>
    </ng-template>

    <ng-template #moreMenu let-w>
      <hlm-dropdown-menu class="w-60">
        <button hlmDropdownMenuItem (triggered)="store.openWatcher(w.id, 'history')"><ng-icon name="phosphorClockCounterClockwiseLight" />View run history</button>
        <button hlmDropdownMenuItem (triggered)="store.openWatcher(w.id, 'settings')"><ng-icon name="phosphorSlidersHorizontalLight" />Edit settings</button>
        <button hlmDropdownMenuItem (triggered)="store.askNew('Explain what the ' + w.name + ' watcher checks and why')"><ng-icon name="phosphorSparkleFill" class="text-(--brand)" />Ask about this watcher</button>
        <hlm-dropdown-menu-separator />
        @if (w.enabled) {
          <button hlmDropdownMenuItem (triggered)="store.pauseUntil(w.id, 'Tue 1 Dec')"><ng-icon name="phosphorPauseLight" />Pause until 1 Dec</button>
        } @else {
          <button hlmDropdownMenuItem (triggered)="store.setEnabled(w.id, true)"><ng-icon name="phosphorPlayLight" />Resume</button>
        }
        <button hlmDropdownMenuItem (triggered)="store.duplicateWatcher(w.id)"><ng-icon name="phosphorCopyLight" />Duplicate</button>
        <hlm-dropdown-menu-separator />
        <button hlmDropdownMenuItem variant="destructive" (triggered)="store.deleteWatcher(w.id)"><ng-icon name="phosphorTrashLight" />Delete</button>
      </hlm-dropdown-menu>
    </ng-template>

    <!-- Raising autonomy asks first, in one sentence (Mercury's rule confirmation) -->
    <dialog #confirm class="confirm-dialog" aria-labelledby="confirm-title" (close)="pending.set(null)">
      @if (pending(); as p) {
        <h2 id="confirm-title" class="text-[16px] font-semibold">Let {{ p.w.name }} recommend rates?</h2>
        <p class="text-muted-foreground mt-2 text-[14px]/relaxed">It will propose a rate with its reasons when it finds something. Nothing changes until you approve, and approving only logs a task for the revenue manager.</p>
        <div class="mt-5 flex justify-end gap-2">
          <button hlmBtn variant="ghost" (click)="closeConfirm()">Cancel</button>
          <button hlmBtn (click)="applyPending()">Allow recommendations</button>
        </div>
      }
    </dialog>
  `,
})
export class WatchersView {
  protected readonly store = inject(CompassStore);
  protected readonly status = STATUS;
  protected readonly levels = LEVELS;
  protected readonly segs = [1, 2, 3];
  protected readonly filter = signal<'all' | WatcherStatus>('all');
  protected readonly pending = signal<{ w: Watcher; level: 1 | 2 } | null>(null);
  private readonly confirmEl = viewChild<ElementRef<HTMLDialogElement>>('confirm');
  private readonly templatesEl = viewChild<ElementRef<HTMLElement>>('templatesSection');

  protected readonly templates = TEMPLATES;

  protected readonly sorted = computed(() => [...this.store.watchers()].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)));
  protected readonly visible = computed(() => (this.filter() === 'all' ? this.sorted() : this.sorted().filter((w) => w.status === this.filter())));
  protected readonly filters = computed(() => {
    const ws = this.store.watchers();
    const n = (s: WatcherStatus) => ws.filter((w) => w.status === s).length;
    return [
      { id: 'all' as const, label: 'All', count: ws.length },
      { id: 'needs' as const, label: 'Needs you', count: n('needs') },
      { id: 'watching' as const, label: 'Watching', count: n('watching') },
      { id: 'paused' as const, label: 'Paused', count: n('paused') },
    ].filter((f) => f.id === 'all' || f.count > 0);
  });
  protected readonly days = computed(() => {
    const a = this.store.activity();
    return (['Today', 'Yesterday'] as const).map((day) => ({ day, items: a.filter((x) => x.day === day) })).filter((d) => d.items.length);
  });
  protected readonly needsReview = computed(() => this.store.watchers().some((w) => w.status === 'needs'));

  protected count(runs: RunOutcome[], o: RunOutcome) {
    return runs.filter((r) => r === o).length;
  }
  protected found(w: Watcher) {
    return this.count(w.runs, 'finding') + this.count(w.runs, 'pending');
  }
  protected stripLabel(w: Watcher) {
    const c = (o: RunOutcome) => this.count(w.runs, o);
    return `Last 14 runs: ${c('none')} no change, ${this.found(w)} findings, ${c('failed')} failed, ${c('skipped')} skipped`;
  }
  protected glyph(id: string) {
    return this.store.watchers().find((w) => w.id === id)?.glyph ?? 'phosphorLightningLight';
  }
  protected changeAutonomy(w: Watcher, level: 1 | 2 | 3) {
    if (level === 3 || level === w.autonomy) return;
    if (level > w.autonomy) {
      this.pending.set({ w, level });
      setTimeout(() => this.confirmEl()?.nativeElement.showModal());
    } else this.store.setAutonomy(w.id, level);
  }
  protected applyPending() {
    const p = this.pending();
    if (p) this.store.setAutonomy(p.w.id, p.level);
    this.closeConfirm();
  }
  protected closeConfirm() {
    this.confirmEl()?.nativeElement.close();
  }
  protected scrollToTemplates() {
    this.templatesEl()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
