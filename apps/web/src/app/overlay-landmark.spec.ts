import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { LandmarkOverlayContainer } from './overlay-landmark';

describe('LandmarkOverlayContainer', () => {
  it('makes the layer where menus open a named region, so their content sits in a landmark', () => {
    TestBed.configureTestingModule({ providers: [{ provide: OverlayContainer, useClass: LandmarkOverlayContainer }] });
    const element = TestBed.inject(OverlayContainer).getContainerElement();
    expect(element.getAttribute('role')).toBe('region');
    expect(element.getAttribute('aria-label')).toBe('Menus');
  });
});
