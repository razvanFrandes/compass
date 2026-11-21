import { TestBed } from '@angular/core/testing';
import { DENSITY_STORAGE_KEY } from '../theme/density';
import { LabDensity, inPx } from './lab-density';

describe('theme lab density section', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-density');
    localStorage.removeItem(DENSITY_STORAGE_KEY);
  });

  it('writes a rem token in px, and leaves other units as they are', () => {
    expect(inPx('1.5rem')).toBe('24px');
    expect(inPx(' 0.75rem ')).toBe('12px');
    expect(inPx('1.125rem')).toBe('18px');
    expect(inPx('180px')).toBe('180px');
    expect(inPx('68ch')).toBe('68ch');
    expect(inPx('')).toBe('');
  });

  it('shows the same specimen as a comfortable and a compact region, with the switch', async () => {
    const fixture = TestBed.createComponent(LabDensity);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    expect([...el.querySelectorAll('[data-pane]')].map((pane) => pane.getAttribute('data-density'))).toEqual(['comfortable', 'compact']);
    expect(el.querySelector('app-density-switch [role=radiogroup]')).not.toBeNull();
    // One row for each density token, and one for each layout constant.
    expect(el.querySelectorAll('table.ld-tokens')[0]!.querySelectorAll('tbody tr').length).toBe(14);
    expect(el.querySelectorAll('table.ld-tokens')[1]!.querySelectorAll('tbody tr').length).toBe(8);
  });
});
