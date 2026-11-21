import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { DENSITY_STORAGE_KEY, Density } from './density';
import { DensitySwitch } from './density-switch';

describe('DensitySwitch', () => {
  let fixture: ComponentFixture<DensitySwitch>;
  let root: HTMLElement;
  const radios = () => [...root.querySelectorAll<HTMLButtonElement>('[role=radio]')];
  const checked = () => radios().find((r) => r.getAttribute('aria-checked') === 'true')?.getAttribute('aria-label');

  beforeEach(async () => {
    fixture = TestBed.createComponent(DensitySwitch);
    root = fixture.nativeElement as HTMLElement;
    document.body.appendChild(root);
    await fixture.whenStable();
  });
  afterEach(() => {
    root.remove();
    document.documentElement.removeAttribute('data-density');
    localStorage.removeItem(DENSITY_STORAGE_KEY);
  });

  it('is a labelled radio group with Comfortable chosen', () => {
    const group = root.querySelector('[role=radiogroup]')!;
    expect(root.querySelector(`#${group.getAttribute('aria-labelledby')}`)?.textContent).toBe('Density');
    expect(radios().map((r) => r.textContent?.trim())).toEqual(['Comfortable', 'Compact']);
    expect(checked()).toBe('Comfortable');
    // One stop in the tab order: the chosen radio.
    expect(radios().map((r) => r.tabIndex)).toEqual([0, -1]);
  });

  it('switches on click, on <html> and in storage', async () => {
    radios()[1].click();
    await fixture.whenStable();
    expect(checked()).toBe('Compact');
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('compact');
    expect(TestBed.inject(Density).id()).toBe('compact');
  });

  it('moves the choice and the focus with the arrow keys', async () => {
    radios()[0].focus();
    radios()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(checked()).toBe('Compact');
    expect(document.activeElement).toBe(radios()[1]);
    radios()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(checked()).toBe('Comfortable');
    radios()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await fixture.whenStable();
    expect(checked()).toBe('Compact');
  });

  it('shows icons with names in the rail', async () => {
    fixture.componentRef.setInput('collapsed', true);
    await fixture.whenStable();
    expect(radios().map((r) => r.getAttribute('aria-label'))).toEqual(['Comfortable', 'Compact']);
    expect(radios().every((r) => r.querySelector('ng-icon'))).toBe(true);
    expect(root.querySelector('p')?.classList.contains('sr-only')).toBe(true);
  });
});
