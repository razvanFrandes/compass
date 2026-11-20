import { Directive, input, signal } from '@angular/core';
import { BrnButton } from '@spartan-ng/brain/button';
import { classes } from '@spartan-ng/helm/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ClassValue } from 'cn';
import { injectBrnButtonConfig } from './hlm-button.token';

/*
  Button anatomy follows Meta's Astryx (github.com/facebook/astryx, Button.tsx + tokens.stylex.ts):
  heights 28/32/36 (+40 here for prominent actions), 8px element radius (not pills), medium-weight label,
  hover and press painted as a translucent overlay (5% / 10%) so every fill reacts the same way,
  a 0.98 press scale for fine pointers only (none on touch or under reduced motion), 175ms standard ease.
*/
export const buttonVariants = cva(
  "group/button relative isolate inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[8px] border border-transparent font-medium tracking-[-0.005em] outline-none select-none bg-clip-padding " +
    "transition-[background-color,color,transform,box-shadow] duration-[175ms] ease-[cubic-bezier(0.2,0,0,1)] " +
    "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:transition-colors after:duration-[130ms] after:content-[''] " +
    "[@media(hover:hover)]:hover:after:bg-[var(--overlay-hover)] active:after:bg-[var(--overlay-pressed)] " +
    "[@media(pointer:fine)]:active:not-aria-[haspopup]:scale-[0.98] motion-reduce:active:scale-100 " +
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
    "data-disabled:pointer-events-none data-disabled:opacity-45 disabled:pointer-events-none disabled:opacity-45 " +
    "[&_ng-icon]:pointer-events-none [&_ng-icon]:shrink-0 [&_ng-icon:not([class*='text-'])]:text-[16px]",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]',
        outline: 'border-border bg-transparent text-foreground aria-expanded:bg-secondary',
        secondary: 'bg-secondary text-secondary-foreground aria-expanded:after:bg-[var(--overlay-hover)]',
        ghost: 'bg-transparent text-foreground aria-expanded:bg-secondary',
        destructive: 'bg-destructive text-white',
        link: 'h-auto! px-0! text-(--brand) underline-offset-4 after:hidden hover:underline',
      },
      size: {
        xs: 'h-7 px-2.5 text-[13px] gap-1.5',
        sm: 'h-8 px-3 text-[13px] gap-1.5',
        default: 'h-9 px-3.5 text-[14px]',
        lg: 'h-10 px-4 text-[15px]',
        icon: 'size-9',
        'icon-xs': "size-7 [&_ng-icon:not([class*='text-'])]:text-[14px]",
        'icon-sm': 'size-8',
        'icon-lg': "size-10 [&_ng-icon:not([class*='text-'])]:text-[18px]",
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

@Directive({
  selector: 'button[hlmBtn], a[hlmBtn]',
  exportAs: 'hlmBtn',
  hostDirectives: [{ directive: BrnButton, inputs: ['disabled'] }],
  host: { 'data-slot': 'button', '[attr.data-size]': 'size()', '[attr.data-variant]': 'variant()' },
})
export class HlmButton {
  private readonly _config = injectBrnButtonConfig();

  private readonly _additionalClasses = signal<ClassValue>('');

  public readonly variant = input<ButtonVariants['variant']>(this._config.variant);

  public readonly size = input<ButtonVariants['size']>(this._config.size);

  constructor() {
    classes(() => [
      buttonVariants({ variant: this.variant(), size: this.size() }),
      this._additionalClasses(),
    ]);
  }

  setClass(classes: string): void {
    this._additionalClasses.set(classes);
  }
}
