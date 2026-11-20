import { InjectionToken, Service, inject, signal } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';
import type { Workflow } from '@compass/contracts';
import { WorkflowsApi } from '../api/workflows-api';
import { CompassStore } from '../store';
import { Confirm } from './confirm';
import { AUTONOMY_LONG, AUTONOMY_MEANS, isRaise, type Autonomy } from './studio';

/** Opens a workflow in the builder (`/workflows/<id>/edit`). A token, so a test can watch it without the shell. */
export const WORKFLOW_EDITOR = new InjectionToken<(workflowId: string) => void>('WORKFLOW_EDITOR', {
  providedIn: 'root',
  factory: () => {
    const store = inject(CompassStore);
    return (workflowId) => store.openBuilder(workflowId);
  },
});

export interface Notice {
  description?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

/** The toasts of Agent Studio. Its own service, so a test can read what was said and press Undo. */
@Service()
export class Notices {
  show(title: string, notice: Notice = {}): void {
    toast(title, { duration: 6000, ...notice });
  }
}

/**
 * What a person can do to a workflow from Agent Studio: edit, duplicate, pause or resume, delete, and change
 * how far it may go. Errors are values: the server's text is shown as it is.
 *
 * Raising autonomy and deleting ask first. Lowering autonomy is immediate and offers Undo.
 */
@Service()
export class WorkflowActions {
  private readonly api = inject(WorkflowsApi);
  private readonly confirm = inject(Confirm);
  private readonly notices = inject(Notices);
  private readonly openEditor = inject(WORKFLOW_EDITOR);

  /** Counts changes saved on the server: a screen reloads its lists when it moves. */
  readonly changed = signal(0);
  /** Calls in flight by workflow id, so a control can say "Pausing…" and stay off meanwhile. */
  readonly busy = signal<Record<string, string>>({});

  edit(workflow: Pick<Workflow, 'id'>): void {
    this.openEditor(workflow.id);
  }

  /** The copy is named "… (copy)" and starts paused. Returns it, or null when the server refused. */
  async duplicate(workflow: Workflow): Promise<Workflow | null> {
    this.mark(workflow.id, 'Duplicating…');
    const result = await this.api.duplicate(workflow.id);
    this.mark(workflow.id, null);
    if (!result.ok) {
      this.notices.show(`Couldn’t duplicate ${workflow.name}`, { description: result.error.message, duration: 8000 });
      return null;
    }
    const copy = result.value;
    this.notices.show(`Created “${copy.name}”`, {
      description: 'It starts paused, so you can change it before it runs.',
      duration: 10000,
      action: { label: 'Edit', onClick: () => this.openEditor(copy.id) },
    });
    this.bump();
    return copy;
  }

  async setEnabled(workflow: Workflow, enabled: boolean): Promise<boolean> {
    this.mark(workflow.id, enabled ? 'Resuming…' : 'Pausing…');
    const result = await this.api.patch(workflow.id, { enabled });
    this.mark(workflow.id, null);
    if (!result.ok) this.notices.show(`Couldn’t ${enabled ? 'resume' : 'pause'} ${workflow.name}`, { description: result.error.message, duration: 8000 });
    else this.notices.show(enabled ? `${workflow.name} resumed` : `${workflow.name} paused`, { description: enabled ? 'It runs again on its schedule.' : 'It keeps its history and won’t run until you resume it.' });
    this.bump();
    return result.ok;
  }

  /** Asks first. The workflow's runs, proposals and audit entries stay on the server, under its name. */
  async remove(workflow: Workflow): Promise<boolean> {
    const ok = await this.confirm.ask({
      title: `Delete “${workflow.name}”?`,
      body: 'It stops running and leaves Agent Studio. Its past runs and decisions stay in the audit log, under its name.',
      confirm: 'Delete agent',
      tone: 'destructive',
    });
    if (!ok) return false;
    this.mark(workflow.id, 'Deleting…');
    const result = await this.api.remove(workflow.id);
    this.mark(workflow.id, null);
    if (!result.ok) {
      this.notices.show(`Couldn’t delete ${workflow.name}`, { description: result.error.message, duration: 8000 });
      return false;
    }
    this.notices.show(`Deleted “${workflow.name}”`, { description: 'Its history stays in the audit log.' });
    this.bump();
    return true;
  }

  /** True when the level changed. Raising it asks first; lowering it is immediate, with Undo in the toast. */
  async setAutonomy(workflow: Workflow, to: Autonomy): Promise<boolean> {
    const from = workflow.autonomy;
    if (to === from) return false;
    if (isRaise(from, to)) {
      const ok = await this.confirm.ask({
        title: to === 'approve' ? `Let “${workflow.name}” act after you approve?` : `Let “${workflow.name}” act alone on low-risk actions?`,
        body: `${AUTONOMY_MEANS[to]} You can lower this again at any time.`,
        confirm: to === 'approve' ? 'Let it act after I approve' : 'Let it act alone',
      });
      if (!ok) return false;
      return this.applyAutonomy(workflow, to);
    }
    const done = await this.applyAutonomy(workflow, to, { label: 'Undo', onClick: () => void this.applyAutonomy(workflow, from) });
    return done;
  }

  private async applyAutonomy(workflow: Workflow, autonomy: Autonomy, action?: Notice['action']): Promise<boolean> {
    this.mark(workflow.id, 'Saving…');
    const result = await this.api.patch(workflow.id, { autonomy });
    this.mark(workflow.id, null);
    if (!result.ok) this.notices.show(`Couldn’t change ${workflow.name}`, { description: result.error.message, duration: 8000 });
    else this.notices.show(`${workflow.name} now ${AUTONOMY_LONG[autonomy].toLowerCase()}`, { description: AUTONOMY_MEANS[autonomy], duration: action ? 10000 : 6000, action });
    this.bump();
    return result.ok;
  }

  private bump(): void {
    this.changed.update((count) => count + 1);
  }

  private mark(id: string, label: string | null): void {
    this.busy.update((busy) => {
      const next = { ...busy };
      if (label) next[id] = label;
      else delete next[id];
      return next;
    });
  }
}
