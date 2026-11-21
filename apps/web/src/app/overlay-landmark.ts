import { OverlayContainer } from '@angular/cdk/overlay';
import { Injectable } from '@angular/core';

/**
 * The CDK overlay layer, at the end of <body>, as a named region. Menus (the user menu, Recent in the rail, the
 * board picker) open there, outside the page's landmarks; without one, axe's `region` rule flags their items.
 * Dialogs and tooltips are unaffected: they carry their own roles.
 */
@Injectable()
export class LandmarkOverlayContainer extends OverlayContainer {
  protected override _createContainer(): void {
    super._createContainer();
    this._containerElement?.setAttribute('role', 'region');
    this._containerElement?.setAttribute('aria-label', 'Menus');
  }
}
