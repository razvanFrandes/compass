import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { HotelPicker } from './hotel-picker';
import { HALCYON_HOTELS } from './hotels';

@Component({
  imports: [HotelPicker],
  template: `<form (submit)="submitted.set(true)"><app-hotel-picker [hotels]="hotels" [(value)]="value" label="Search hotels" /></form>`,
})
class Host {
  readonly hotels = HALCYON_HOTELS;
  readonly value = signal<string[]>([]);
  readonly submitted = signal(false);
}

describe('HotelPicker', () => {
  let fixture: ComponentFixture<Host>;
  let root: HTMLElement;
  let input: HTMLInputElement;

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const type = async (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  };
  const press = async (key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    await settle();
    return event;
  };
  const options = () => [...root.querySelectorAll<HTMLElement>('[role=option]')];
  const hotelNames = () => [...root.querySelectorAll('.hp-name')].map((el) => el.textContent?.trim());
  const active = () => {
    const id = input.getAttribute('aria-activedescendant');
    return id ? root.querySelector<HTMLElement>(`#${id}`) : null;
  };
  const chips = () => [...root.querySelectorAll('.hp-chip span')].map((el) => el.textContent?.trim());
  const status = () => root.querySelector('[role=status]')?.textContent?.trim();

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    root = fixture.nativeElement as HTMLElement;
    await settle();
    input = root.querySelector('input')!;
  });

  it('is a combobox over a multi-select listbox, grouped, with the whole group chosen at first', () => {
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-label')).toBe('Search hotels');
    const list = root.querySelector('[role=listbox]')!;
    expect(input.getAttribute('aria-controls')).toBe(list.id);
    expect(list.getAttribute('aria-multiselectable')).toBe('true');
    const groups = [...list.querySelectorAll('[role=group]')];
    expect(groups.map((group) => root.querySelector(`#${group.getAttribute('aria-labelledby')}`)?.textContent?.trim())).toEqual(['Quick picks', 'Asia', 'Europe', 'Middle East', 'North America', 'South America']);
    expect(options()).toHaveLength(30);
    expect(options().filter((o) => o.getAttribute('aria-selected') === 'true').map((o) => o.textContent?.trim())).toEqual(['All 20 hotels']);
    // Nothing is highlighted until the person moves or types.
    expect(active()).toBeNull();
    expect(new Set(options().map((o) => o.id)).size).toBe(30);
  });

  it('filters as the person types and says how many hotels match', async () => {
    await type('london');
    expect(hotelNames()).toEqual(['Kestrel London Mayfair', "Tessera London King's Cross"]);
    expect(status()).toBe('2 hotels match.');
    // Typing puts the highlight on the best match, so Enter takes it.
    expect(active()?.textContent).toContain('Kestrel London Mayfair');

    await type('kestrel');
    expect(hotelNames()).toHaveLength(4);
    expect(options()[0]!.textContent).toContain('Kestrel');
    expect(active()?.textContent).toContain('Kestrel Singapore Marina');
  });

  it('says so when nothing matches, and offers to clear the search', async () => {
    await type('atlantis');
    expect(root.querySelector('[role=listbox]')).toBeNull();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.hasAttribute('aria-controls')).toBe(false);
    expect(root.querySelector('.hp-empty')?.textContent).toContain('No hotel matches “atlantis”');
    root.querySelector<HTMLButtonElement>('.hp-empty button')!.click();
    await settle();
    expect(options()).toHaveLength(30);
    expect(input.value).toBe('');
  });

  it('moves with the arrow keys, wraps, and jumps with Home and End', async () => {
    await press('ArrowDown');
    expect(active()?.textContent?.trim()).toBe('All 20 hotels');
    await press('ArrowDown');
    expect(active()?.textContent).toContain('Asia');
    await press('ArrowUp');
    await press('ArrowUp');
    expect(active()?.textContent).toContain('Tessera Buenos Aires Palermo');
    await press('Home');
    expect(active()?.textContent?.trim()).toBe('All 20 hotels');
    await press('End');
    expect(active()?.textContent).toContain('Tessera Buenos Aires Palermo');
    await press('PageUp');
    expect(active()?.textContent).toContain('Tessera Dubai Business Bay');
    await press('PageDown');
    await press('PageDown');
    expect(active()?.textContent).toContain('Tessera Buenos Aires Palermo');
    expect(active()?.hasAttribute('data-active')).toBe(true);
    expect(root.querySelectorAll('[data-active]')).toHaveLength(1);
  });

  it('selects with Enter without submitting the form, and clears the search for the next hotel', async () => {
    await type('lisb');
    const enter = await press('Enter');
    expect(enter.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.submitted()).toBe(false);
    expect(fixture.componentInstance.value()).toEqual(['LIS']);
    expect(input.value).toBe('');
    expect(chips()).toEqual(['Lisbon Chiado']);
    expect(status()).toBe('Arbor Lisbon Chiado selected. 1 of 20 hotels selected.');
    const lisbon = options().find((o) => o.textContent?.includes('Arbor Lisbon Chiado'))!;
    expect(lisbon.getAttribute('aria-selected')).toBe('true');
    expect(options()[0]!.getAttribute('aria-selected')).toBe('false');

    await type('paris');
    await press('Enter');
    expect(fixture.componentInstance.value()).toEqual(['LIS', 'PAR']);
  });

  it('picks a whole region from the quick picks, shows it as one chip, and Enter again removes it', async () => {
    await press('ArrowDown');
    await press('ArrowDown');
    await press('ArrowDown');
    expect(active()?.textContent).toContain('Europe');
    await press('Enter');
    expect(fixture.componentInstance.value()).toEqual(['AMS', 'LIS', 'PAR', 'LON1', 'VIE', 'BCN', 'BER', 'LON2']);
    expect(chips()).toEqual(['Europe · 8']);
    expect(status()).toBe('Europe, 8 hotels, selected. 8 of 20 hotels selected.');
    // The highlight stays where it was, so the same key undoes it.
    await press('Enter');
    expect(fixture.componentInstance.value()).toEqual([]);
    expect(chips()).toEqual([]);
  });

  it('marks a region as partly chosen, in words too', async () => {
    fixture.componentInstance.value.set(['LIS', 'PAR']);
    await settle();
    const europe = options().find((o) => o.id.endsWith('region-europe'))!;
    expect(europe.getAttribute('data-state')).toBe('some');
    expect(europe.getAttribute('aria-selected')).toBe('false');
    expect(europe.querySelector('.sr-only')?.textContent).toContain('2 of 8 hotels selected');
  });

  it('clears the search on Escape and lets a second Escape through to whatever holds it', async () => {
    let escaped = 0;
    root.addEventListener('keydown', (event) => event.key === 'Escape' && escaped++);
    await type('lis');
    const first = await press('Escape');
    expect(first.defaultPrevented).toBe(true);
    expect(input.value).toBe('');
    expect(escaped).toBe(0);
    const second = await press('Escape');
    expect(second.defaultPrevented).toBe(false);
    expect(escaped).toBe(1);
  });

  it('removes the last chip with Backspace in an empty search, and any chip with its button', async () => {
    fixture.componentInstance.value.set(['LIS', 'PAR', 'NYC']);
    await settle();
    expect(chips()).toEqual(['Lisbon Chiado', 'Paris Opera', 'New York Midtown']);
    await press('Backspace');
    expect(fixture.componentInstance.value()).toEqual(['LIS', 'PAR']);

    await type('x');
    await press('Backspace');
    expect(fixture.componentInstance.value()).toEqual(['LIS', 'PAR']);
    await type('');

    root.querySelector<HTMLButtonElement>('button[aria-label="Remove Lisbon Chiado"]')!.click();
    await settle();
    expect(fixture.componentInstance.value()).toEqual(['PAR']);
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.trim() === 'Clear all')!.click();
    await settle();
    expect(fixture.componentInstance.value()).toEqual([]);
    expect(status()).toBe('Cleared. All 20 hotels selected.');
  });

  it('selects on click and keeps the search, so several matches can be ticked', async () => {
    await type('dubai');
    const [marina, bay] = options().filter((o) => o.classList.contains('hp-option'));
    marina!.click();
    await settle();
    bay!.click();
    await settle();
    expect(fixture.componentInstance.value()).toEqual(['DXB1', 'DXB2']);
    expect(input.value).toBe('dubai');
    // A press on an option must not take the keyboard out of the search box.
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    options()[0]!.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
  });
});
