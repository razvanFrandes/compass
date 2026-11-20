import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { WorkflowBuilder } from './builder-page';

/**
 * Opens the workflow builder as its own full-screen page. The app's views are a switch in the shell, which this
 * feature does not edit, so `main.ts` loads this file lazily for the builder's address and the builder takes the
 * screen: the shell is hidden and inert behind it. Once the shell has a route for it, render
 * `<app-workflow-builder />` there and drop this file.
 */
export async function mountWorkflowBuilder(doc: Document = document): Promise<void> {
  const shell = doc.querySelector<HTMLElement>('app-root');
  if (shell) {
    shell.inert = true;
    shell.style.display = 'none';
  }
  doc.body.appendChild(doc.createElement('app-workflow-builder'));
  doc.title = 'New workflow · Compass';
  await bootstrapApplication(WorkflowBuilder, { providers: [provideBrowserGlobalErrorListeners()] });
}
