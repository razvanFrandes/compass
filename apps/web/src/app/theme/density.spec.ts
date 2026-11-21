import { TestBed } from '@angular/core/testing';
import { DEFAULT_DENSITY, DENSITIES, DENSITY_STORAGE_KEY, Density, densityOf, isDensityId } from './density';

describe('Density', () => {
  const root = document.documentElement;

  afterEach(() => {
    root.removeAttribute('data-density');
    root.removeAttribute('data-theme');
    localStorage.removeItem(DENSITY_STORAGE_KEY);
  });

  it('offers comfortable and compact, comfortable first', () => {
    expect(DENSITIES.map((d) => d.id)).toEqual(['comfortable', 'compact']);
    expect(DEFAULT_DENSITY).toBe('comfortable');
    expect(isDensityId('compact')).toBe(true);
    expect(isDensityId('cosy')).toBe(false);
  });

  it('reads the starting density from data-density, then from the remembered choice, then the default', () => {
    expect(densityOf(root)).toBe('comfortable');
    expect(densityOf(root, 'compact')).toBe('compact');
    expect(densityOf(root, 'tiny')).toBe('comfortable');
    root.setAttribute('data-density', 'compact');
    expect(densityOf(root, 'comfortable')).toBe('compact');
    root.setAttribute('data-density', 'unknown');
    expect(densityOf(root, 'compact')).toBe('compact');
  });

  it('starts comfortable and puts the attribute on <html> at once', () => {
    const density = TestBed.inject(Density);
    expect(density.id()).toBe('comfortable');
    expect(density.compact()).toBe(false);
    expect(root.getAttribute('data-density')).toBe('comfortable');
    // Nothing is stored until the person chooses.
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBeNull();
  });

  it('writes the choice to <html> and remembers it', () => {
    const density = TestBed.inject(Density);
    density.set('compact');
    expect(root.getAttribute('data-density')).toBe('compact');
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('compact');
    expect(density.compact()).toBe(true);
    expect(density.option().label).toBe('Compact');
  });

  it('comes back with the remembered choice', () => {
    localStorage.setItem(DENSITY_STORAGE_KEY, 'compact');
    const density = TestBed.inject(Density);
    expect(density.id()).toBe('compact');
    expect(root.getAttribute('data-density')).toBe('compact');
  });

  it('ignores a stored value it does not know', () => {
    localStorage.setItem(DENSITY_STORAGE_KEY, 'dense');
    expect(TestBed.inject(Density).id()).toBe('comfortable');
  });

  it('leaves the theme alone', () => {
    root.setAttribute('data-theme', 'juyo-concept');
    TestBed.inject(Density).set('compact');
    expect(root.getAttribute('data-theme')).toBe('juyo-concept');
  });

  it('still applies when storage is blocked', () => {
    const density = TestBed.inject(Density);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    density.set('compact');
    spy.mockRestore();
    expect(density.id()).toBe('compact');
    expect(root.getAttribute('data-density')).toBe('compact');
  });
});
