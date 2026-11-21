import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { phosphorCompassFill } from '@ng-icons/phosphor-icons/fill';
import { BRAND, CompassLogo } from './compass-logo';

@Component({
  imports: [CompassLogo],
  template: `
    <app-compass-logo id="default" />
    <a href="/" aria-label="Compass, morning brief"><app-compass-logo id="bound" [variant]="variant()" [size]="size()" /></a>
  `,
})
class Host {
  readonly variant = signal<'full' | 'mark'>('full');
  readonly size = signal(20);
}

describe('CompassLogo', () => {
  let fixture: ComponentFixture<Host>;
  let root: HTMLElement;
  const logo = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    root = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('by default is the full logo at 22 px: the tile, then the wordmark "Compass"', () => {
    const el = logo('default');
    expect(el.getAttribute('data-variant')).toBe('full');
    expect(el.style.getPropertyValue('--logo-size')).toBe('22px');
    expect([...el.children].map((child) => child.className)).toEqual(['tile', 'word']);
    expect(el.querySelector('.word')?.textContent).toBe('Compass');
    expect(BRAND).toBe('Compass');
  });

  it('draws Phosphor’s compass, Fill weight, as the mark', () => {
    const path = (svg: string) => /\sd="([^"]+)"/.exec(svg)?.[1];
    const drawn = logo('default').querySelector('.tile ng-icon svg');
    expect(drawn?.getAttribute('viewBox')).toBe('0 0 256 256');
    expect(drawn?.querySelector('path')?.getAttribute('d')).toBe(path(phosphorCompassFill));
    expect(drawn?.getAttribute('fill')).toBe('currentColor');
  });

  it('variant "mark" is the tile alone, and it follows the input', async () => {
    expect(logo('bound').querySelector('.word')).not.toBeNull();
    fixture.componentInstance.variant.set('mark');
    await fixture.whenStable();
    expect(logo('bound').getAttribute('data-variant')).toBe('mark');
    expect(logo('bound').querySelector('.word')).toBeNull();
    expect(logo('bound').querySelector('.tile ng-icon svg')).not.toBeNull();
  });

  it('size sets the side of the tile, which the wordmark scales from', async () => {
    expect(logo('bound').style.getPropertyValue('--logo-size')).toBe('20px');
    fixture.componentInstance.size.set(32);
    await fixture.whenStable();
    expect(logo('bound').style.getPropertyValue('--logo-size')).toBe('32px');
  });

  it('is one image named "Compass" in both variants; its parts are hidden from assistive technology', async () => {
    for (const variant of ['full', 'mark'] as const) {
      fixture.componentInstance.variant.set(variant);
      await fixture.whenStable();
      const el = logo('bound');
      expect(el.getAttribute('role')).toBe('img');
      expect(el.getAttribute('aria-label')).toBe('Compass');
      expect([...el.children].every((child) => child.getAttribute('aria-hidden') === 'true')).toBe(true);
    }
  });
});
