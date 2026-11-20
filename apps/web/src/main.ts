import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));

// Workflow builder (src/app/builder): its own lazy full-screen page at /workflows/new, or ?builder on any path.
if (location.pathname.startsWith('/workflows/new') || new URLSearchParams(location.search).has('builder')) void import('./app/builder/builder-bootstrap').then((m) => m.mountWorkflowBuilder());
