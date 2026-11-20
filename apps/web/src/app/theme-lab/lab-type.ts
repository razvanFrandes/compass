import { Component, ElementRef, afterRenderEffect, inject, signal, viewChildren } from '@angular/core';
import { LabState, short } from './lab-kit';

/** The sizes the components write today, each with real text from the app. The concept theme maps them to 8 steps. */
const ROWS = [
  { cls: 'text-[34px] font-semibold', sample: 'New York Midtown lost its biggest account', use: 'Brief headline' },
  { cls: 'text-[30px] font-semibold', sample: 'Three nights need a rate decision', use: 'Brief headline, phone' },
  { cls: 'text-[26px] font-semibold', sample: 'Portfolio', use: 'Page title' },
  { cls: 'text-[24px] font-semibold tabular-nums', sample: '€20.25M', use: 'Metric' },
  { cls: 'text-[22px] font-semibold', sample: 'Agent Studio', use: 'Page title' },
  { cls: 'text-[20px] font-semibold tabular-nums', sample: '51.4%', use: 'Metric' },
  { cls: 'text-[18px] font-semibold', sample: 'Barcelona Mar has 26 of 300 rooms out of order', use: 'Card title' },
  { cls: 'text-[17px] font-semibold', sample: 'Rate vs comp set', use: 'Card title' },
  { cls: 'text-[16px] font-medium', sample: 'Ask about any hotel, night or metric', use: 'Composer' },
  { cls: 'text-[15px]', sample: 'Pickup slowed after the comp set dropped rates on 12 Nov.', use: 'Answer text' },
  { cls: 'text-[14px]', sample: '7 findings across 20 hotels, ranked by money', use: 'Body' },
  { cls: 'text-[13.5px]', sample: 'Every day, after the morning brief', use: 'Row text' },
  { cls: 'text-[13px] tabular-nums', sample: '€184,300   €143,100   −€41,200', use: 'Table figures' },
  { cls: 'text-[12.5px]', sample: 'On the books as of 20 Nov, 07:00', use: 'Captions' },
  { cls: 'text-[12px] font-medium tracking-[0.04em] uppercase', sample: 'Threads', use: 'Section label' },
  { cls: 'text-[11.5px]', sample: '21 Nov to 20 Dec 2026', use: 'Axis labels' },
  { cls: 'text-[11px]', sample: 'Soon', use: 'Badge' },
] as const;

interface Measured {
  size: string;
  line: string;
  detail: string;
}

/** A type specimen that measures itself: the class a component writes, the text, and what the pane renders. */
@Component({
  selector: 'app-lab-type',
  host: { class: 'block' },
  template: `
    <p class="text-muted-foreground mb-3 text-[12px]">{{ family() }}. {{ distinct() }} distinct sizes rendered from {{ rows.length }} written.</p>
    <ul class="flex flex-col">
      @for (r of rows; track r.cls; let i = $index) {
        <li class="grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-0.5 border-b border-border py-2 sm:grid-cols-[minmax(0,1fr)_128px] sm:items-baseline">
          <span #sample class="min-w-0 truncate whitespace-pre" [class]="r.cls">{{ r.sample }}</span>
          <span class="text-muted-foreground text-[11.5px] tabular-nums sm:text-right">
            <span class="text-foreground">{{ measured()[i]?.size }}/{{ measured()[i]?.line }}</span> {{ measured()[i]?.detail }}
            <span class="block">{{ written(r.cls) }}, {{ r.use }}</span>
          </span>
        </li>
      }
    </ul>
  `,
})
export class LabType {
  protected readonly rows = ROWS;
  protected readonly measured = signal<Measured[]>([]);
  protected readonly family = signal('');
  protected readonly distinct = signal(0);
  private readonly samples = viewChildren<ElementRef<HTMLElement>>('sample');

  constructor() {
    const lab = inject(LabState);
    afterRenderEffect(() => {
      lab.version();
      const out = this.samples().map((ref): Measured => {
        const cs = getComputedStyle(ref.nativeElement);
        const px = Number.parseFloat(cs.fontSize);
        const line = cs.lineHeight === 'normal' ? 'auto' : `${+Number.parseFloat(cs.lineHeight).toFixed(1)}`;
        const tracking = cs.letterSpacing === 'normal' || Number.parseFloat(cs.letterSpacing) === 0 ? '' : `${+(Number.parseFloat(cs.letterSpacing) / px).toFixed(3)}em`;
        const width = cs.fontStretch === '100%' || cs.fontStretch === 'normal' ? '' : `${cs.fontStretch} wide`;
        return { size: short(cs.fontSize).replace('px', ''), line, detail: [cs.fontWeight, width, tracking].filter(Boolean).join(' · ') };
      });
      this.measured.set(out);
      this.distinct.set(new Set(out.map((m) => m.size)).size);
      const first = this.samples()[0]?.nativeElement;
      if (first) this.family.set(getComputedStyle(first).fontFamily.split(',')[0].replace(/["']/g, ''));
    });
  }

  protected written(cls: string) {
    return cls.split(' ')[0].replace('text-[', '').replace(']', '');
  }
}
