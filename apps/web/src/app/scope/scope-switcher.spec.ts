import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ScopeService } from './scope.service';
import { ScopeSwitcher } from './scope-switcher';

describe('ScopeSwitcher', () => {
  let fixture: ComponentFixture<ScopeSwitcher>;
  let root: HTMLElement;
  let scope: ScopeService;

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const trigger = () => root.querySelector<HTMLButtonElement>('button[aria-haspopup=dialog]')!;
  const dialog = () => root.querySelector('dialog')!;

  async function render(variant: 'sidebar' | 'chip', url = '/') {
    localStorage.clear();
    history.replaceState(null, '', url);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    scope = TestBed.inject(ScopeService);
    TestBed.tick();
    // The hotels endpoint is not deployed everywhere yet: the switcher works on the built-in list.
    TestBed.inject(HttpTestingController).expectOne('/api/hotels').flush({ error: 'Not found.' }, { status: 404, statusText: 'Not Found' });
    fixture = TestBed.createComponent(ScopeSwitcher);
    fixture.componentRef.setInput('variant', variant);
    root = fixture.nativeElement as HTMLElement;
    document.body.appendChild(root);
    await settle();
  }
  afterEach(() => root.remove());

  it('is the group switcher in the sidebar: the group, the scope, and no "coming soon"', async () => {
    await render('sidebar');
    expect(trigger().textContent).toContain('Halcyon Hospitality');
    expect(trigger().textContent).toContain('20 hotels · 16 countries');
    expect(trigger().hasAttribute('aria-disabled')).toBe(false);
    expect(trigger().disabled).toBe(false);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    // A closed switcher is one button: the list is not in the page.
    expect(root.querySelector('[role=listbox]')).toBeNull();
  });

  it('opens the picker in a labelled dialog and applies a pick at once, to the label and the address', async () => {
    await render('chip');
    trigger().click();
    await settle();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(dialog().hasAttribute('open')).toBe(true);
    expect(root.querySelector(`#${dialog().getAttribute('aria-labelledby')}`)?.textContent).toBe('Which hotels?');
    expect(root.querySelectorAll('[role=option]')).toHaveLength(30);

    [...root.querySelectorAll<HTMLElement>('[role=option]')].find((option) => option.textContent?.includes('Arbor Lisbon Chiado'))!.click();
    await settle();
    expect(scope.hotels()).toEqual(['LIS']);
    expect(trigger().textContent).toContain('Arbor Lisbon Chiado');
    expect(trigger().hasAttribute('data-narrowed')).toBe(true);
    expect(location.search).toBe('?hotels=LIS');
    expect(dialog().textContent).toContain('1 of 20');

    [...dialog().querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Done')!.click();
    await settle();
    expect(dialog().hasAttribute('open')).toBe(false);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('[role=listbox]')).toBeNull();
  });

  it('compact, for the icon rail: the same button, with the number of hotels in scope as a badge', async () => {
    await render('sidebar');
    const button = trigger();
    fixture.componentRef.setInput('compact', true);
    await settle();
    expect(trigger()).toBe(button);
    expect(button.hasAttribute('data-compact')).toBe(true);
    const badge = () => button.querySelector('.sw-count')!;
    expect(badge().textContent?.trim()).toBe('20');
    expect(badge().hasAttribute('data-narrowed')).toBe(false);
    // The names stay in the button for a screen reader; the badge is for the eye.
    expect(button.textContent).toContain('20 hotels · 16 countries');
    expect(badge().getAttribute('aria-hidden')).toBe('true');

    scope.set(['LIS', 'DXB2']);
    await settle();
    expect(badge().textContent?.trim()).toBe('2');
    expect(badge().hasAttribute('data-narrowed')).toBe(true);

    button.click();
    await settle();
    expect(dialog().hasAttribute('open')).toBe(true);
    expect(root.querySelectorAll('[role=option]').length).toBeGreaterThan(20);
  });

  it('shows the scope it was opened with', async () => {
    await render('chip', '/studio?hotels=DOH,DXB1,DXB2');
    expect(trigger().textContent).toContain('Middle East · 3 hotels');
  });
});
