import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { LandmarkOverlayContainer } from './overlay-landmark';
import { Density } from './theme/density';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    // Menus open outside the page's landmarks: their layer is a named region (overlay-landmark.ts).
    { provide: OverlayContainer, useClass: LandmarkOverlayContainer },
    // The remembered density is on <html> before the first render, on every page (the builder has no sidebar).
    provideAppInitializer(() => void inject(Density)),
  ],
};
