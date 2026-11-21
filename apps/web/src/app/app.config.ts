import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { Density } from './theme/density';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    // The remembered density is on <html> before the first render, on every page (the builder has no sidebar).
    provideAppInitializer(() => void inject(Density)),
  ],
};
