import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { Workflow } from '@compass/contracts';
import type { ApiResult } from '../api/api-http';
import { WorkflowsApi } from '../api/workflows-api';
import { Confirm, ConfirmDialog } from './confirm';
import { Notices, WORKFLOW_EDITOR, WorkflowActions, type Notice } from './workflow-actions';
import { WorkflowMenu } from './workflow-menu';

const workflow = (over: Partial<Workflow> = {}): Workflow => ({
  id: 'wf-1',
  name: 'Pace guard',
  description: '',
  hotels: ['ALL'],
  trigger: { kind: 'schedule', every: 'day' },
  goal: 'Watch the pace of every hotel.',
  checks: ['get_pace'],
  action: { type: 'adjust_bar', guidance: '' },
  approver: 'revenue_manager',
  autonomy: 'approve',
  enabled: true,
  createdAt: '2026-11-20T05:00:00Z',
  createdBy: 'template',
  lastRun: null,
  ...over,
});

/** The parts of `WorkflowsApi` the actions use, recording every call and answering from a script. */
class FakeWorkflowsApi {
  readonly calls: { method: string; id: string; body?: unknown }[] = [];
  fail: string | null = null;
  private answer<T>(value: T): Promise<ApiResult<T>> {
    return Promise.resolve(this.fail ? { ok: false, error: { status: 409, message: this.fail } } : { ok: true, value });
  }
  patch(id: string, body: Partial<Workflow>) {
    this.calls.push({ method: 'patch', id, body });
    return this.answer(workflow({ id, ...body }));
  }
  duplicate(id: string) {
    this.calls.push({ method: 'duplicate', id });
    return this.answer(workflow({ id: 'wf-copy', name: 'Pace guard (copy)', enabled: false, createdBy: 'user' }));
  }
  remove(id: string) {
    this.calls.push({ method: 'remove', id });
    return this.answer(null);
  }
}

class FakeNotices {
  readonly shown: { title: string; notice: Notice }[] = [];
  show(title: string, notice: Notice = {}) {
    this.shown.push({ title, notice });
  }
  get last() {
    return this.shown.at(-1)!;
  }
}

@Component({
  imports: [WorkflowMenu, ConfirmDialog],
  template: `<app-workflow-menu [workflow]="workflow()" (deleted)="deleted.set($event.id)" (duplicated)="duplicated.set($event.id)" /><app-confirm-dialog />`,
})
class Host {
  readonly workflow = signal(workflow());
  readonly deleted = signal('');
  readonly duplicated = signal('');
}

describe('Agent Studio actions', () => {
  let api: FakeWorkflowsApi;
  let notices: FakeNotices;
  let edited: string[];
  let actions: WorkflowActions;
  let confirm: Confirm;

  beforeEach(() => {
    api = new FakeWorkflowsApi();
    notices = new FakeNotices();
    edited = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: WorkflowsApi, useValue: api },
        { provide: Notices, useValue: notices },
        { provide: WORKFLOW_EDITOR, useValue: (id: string) => edited.push(id) },
      ],
    });
    actions = TestBed.inject(WorkflowActions);
    confirm = TestBed.inject(Confirm);
  });

  /** Lets the promise chain of an action reach its next await. */
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  describe('the service', () => {
    it('opens a workflow in the builder', () => {
      actions.edit(workflow());
      expect(edited).toEqual(['wf-1']);
      expect(api.calls).toEqual([]);
    });

    it('duplicates, says the copy starts paused, and offers to edit it', async () => {
      const copy = await actions.duplicate(workflow());
      expect(api.calls).toEqual([{ method: 'duplicate', id: 'wf-1' }]);
      expect(copy).toMatchObject({ id: 'wf-copy', enabled: false });
      expect(notices.last.title).toBe('Created “Pace guard (copy)”');
      expect(notices.last.notice.description).toContain('paused');
      expect(actions.changed()).toBe(1);
      notices.last.notice.action!.onClick();
      expect(edited).toEqual(['wf-copy']);
    });

    it('shows the server’s reason when it refuses, and changes nothing', async () => {
      api.fail = 'The demo keeps at most 100 agents.';
      expect(await actions.duplicate(workflow())).toBeNull();
      expect(notices.last).toMatchObject({ title: 'Couldn’t duplicate Pace guard', notice: { description: 'The demo keeps at most 100 agents.' } });
      expect(actions.changed()).toBe(0);
    });

    it('pauses and resumes', async () => {
      expect(await actions.setEnabled(workflow(), false)).toBe(true);
      expect(api.calls.at(-1)).toEqual({ method: 'patch', id: 'wf-1', body: { enabled: false } });
      expect(notices.last.title).toBe('Pace guard paused');
      await actions.setEnabled(workflow({ enabled: false }), true);
      expect(api.calls.at(-1)).toEqual({ method: 'patch', id: 'wf-1', body: { enabled: true } });
      expect(notices.last.title).toBe('Pace guard resumed');
      expect(actions.busy()).toEqual({});
    });

    it('asks before deleting, and deletes only on a yes', async () => {
      const cancelled = actions.remove(workflow());
      expect(confirm.request()).toMatchObject({ title: 'Delete “Pace guard”?', confirm: 'Delete agent', tone: 'destructive' });
      expect(confirm.request()!.body).toContain('audit log');
      confirm.answer(false);
      expect(await cancelled).toBe(false);
      expect(api.calls).toEqual([]);

      const confirmed = actions.remove(workflow());
      confirm.answer(true);
      expect(await confirmed).toBe(true);
      expect(api.calls).toEqual([{ method: 'remove', id: 'wf-1' }]);
      expect(notices.last.title).toBe('Deleted “Pace guard”');
      expect(confirm.request()).toBeNull();
    });

    it('keeps the workflow when the server refuses to delete it', async () => {
      api.fail = 'This agent is running. Wait for the run to finish, then delete it.';
      const result = actions.remove(workflow());
      confirm.answer(true);
      expect(await result).toBe(false);
      expect(notices.last.notice.description).toBe('This agent is running. Wait for the run to finish, then delete it.');
    });

    it('asks before raising autonomy, and saves nothing when the person cancels', async () => {
      const raise = actions.setAutonomy(workflow({ autonomy: 'approve' }), 'auto_low_risk');
      expect(confirm.request()).toMatchObject({ title: 'Let “Pace guard” act alone on low-risk actions?', confirm: 'Let it act alone' });
      expect(confirm.request()!.body).toContain('Prices and channels still wait for your approval');
      confirm.answer(false);
      expect(await raise).toBe(false);
      expect(api.calls).toEqual([]);

      const again = actions.setAutonomy(workflow({ autonomy: 'suggest' }), 'approve');
      expect(confirm.request()!.title).toBe('Let “Pace guard” act after you approve?');
      confirm.answer(true);
      expect(await again).toBe(true);
      expect(api.calls).toEqual([{ method: 'patch', id: 'wf-1', body: { autonomy: 'approve' } }]);
      // A confirmed raise needs no Undo.
      expect(notices.last.notice.action).toBeUndefined();
    });

    it('lowers autonomy at once, with Undo back to the level it had', async () => {
      expect(await actions.setAutonomy(workflow({ autonomy: 'auto_low_risk' }), 'suggest')).toBe(true);
      expect(confirm.request()).toBeNull();
      expect(api.calls).toEqual([{ method: 'patch', id: 'wf-1', body: { autonomy: 'suggest' } }]);
      expect(notices.last.title).toBe('Pace guard now only suggests');
      expect(notices.last.notice.action!.label).toBe('Undo');

      notices.last.notice.action!.onClick();
      await tick();
      expect(api.calls.at(-1)).toEqual({ method: 'patch', id: 'wf-1', body: { autonomy: 'auto_low_risk' } });
      expect(actions.changed()).toBe(2);
    });

    it('does nothing when the level is the one it has', async () => {
      expect(await actions.setAutonomy(workflow({ autonomy: 'approve' }), 'approve')).toBe(false);
      expect(api.calls).toEqual([]);
      expect(confirm.request()).toBeNull();
    });
  });

  describe('the ⋯ menu', () => {
    let fixture: ComponentFixture<Host>;
    let root: HTMLElement;

    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      await tick();
      fixture.detectChanges();
    };
    const trigger = () => root.querySelector<HTMLButtonElement>('app-workflow-menu button')!;
    const items = () => [...document.querySelectorAll<HTMLElement>('[role=menuitem]')];
    const open = async () => {
      trigger().click();
      await settle();
    };
    const choose = async (label: string) => {
      await open();
      const item = items().find((el) => el.textContent?.trim().startsWith(label));
      if (!item) throw new Error(`No menu item “${label}” among: ${items().map((el) => el.textContent?.trim()).join(', ')}`);
      item.click();
      await settle();
    };
    const dialog = () => root.querySelector('dialog')!;
    const dialogButton = (label: string) => [...dialog().querySelectorAll('button')].find((button) => button.textContent?.trim() === label)!;

    beforeEach(async () => {
      fixture = TestBed.createComponent(Host);
      root = fixture.nativeElement as HTMLElement;
      document.body.appendChild(root);
      await settle();
    });
    afterEach(() => root.remove());

    it('is a labelled button that opens Edit, Duplicate, Pause and Delete', async () => {
      expect(trigger().getAttribute('aria-label')).toBe('Actions for Pace guard');
      await open();
      expect(items().map((el) => el.textContent?.trim())).toEqual(['Edit', 'Duplicate', 'Pause', 'Delete…']);
    });

    it('says Resume for a paused workflow, and turns it on', async () => {
      fixture.componentInstance.workflow.set(workflow({ enabled: false }));
      await settle();
      await choose('Resume');
      expect(api.calls).toEqual([{ method: 'patch', id: 'wf-1', body: { enabled: true } }]);
    });

    it('opens the builder on Edit', async () => {
      await choose('Edit');
      expect(edited).toEqual(['wf-1']);
    });

    it('duplicates and tells the screen about the copy', async () => {
      await choose('Duplicate');
      expect(api.calls).toEqual([{ method: 'duplicate', id: 'wf-1' }]);
      expect(fixture.componentInstance.duplicated()).toBe('wf-copy');
    });

    it('asks in an alert dialog before deleting; Cancel keeps the workflow and gives the focus back', async () => {
      await choose('Delete');
      expect(dialog().hasAttribute('open')).toBe(true);
      // The safe answer has the focus when the question appears.
      expect(document.activeElement).toBe(dialogButton('Cancel'));
      expect(dialog().getAttribute('role')).toBe('alertdialog');
      const title = root.querySelector(`#${dialog().getAttribute('aria-labelledby')}`)!;
      const body = root.querySelector(`#${dialog().getAttribute('aria-describedby')}`)!;
      expect(title.textContent).toBe('Delete “Pace guard”?');
      expect(body.textContent).toContain('audit log');
      dialogButton('Cancel').click();
      await settle();
      expect(api.calls).toEqual([]);
      expect(fixture.componentInstance.deleted()).toBe('');
      expect(dialog().hasAttribute('open')).toBe(false);
      expect(document.activeElement).toBe(trigger());
    });

    it('deletes on confirm and tells the screen', async () => {
      await choose('Delete');
      dialogButton('Delete agent').click();
      await settle();
      expect(api.calls).toEqual([{ method: 'remove', id: 'wf-1' }]);
      expect(fixture.componentInstance.deleted()).toBe('wf-1');
      expect(notices.last.title).toBe('Deleted “Pace guard”');
    });
  });
});
