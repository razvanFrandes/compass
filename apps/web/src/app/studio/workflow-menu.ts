import { Component, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorDotsThreeBold } from '@ng-icons/phosphor-icons/bold';
import { phosphorCopyLight, phosphorPauseLight, phosphorPencilSimpleLight, phosphorPlayLight, phosphorTrashLight } from '@ng-icons/phosphor-icons/light';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import type { Workflow } from '@compass/contracts';
import { WorkflowActions } from './workflow-actions';

/**
 * The ⋯ menu of a workflow: Edit (opens it in the builder), Duplicate, Pause or Resume, Delete (asks first).
 * The screen that shows it also holds one `<app-confirm-dialog />`.
 */
@Component({
  selector: 'app-workflow-menu',
  imports: [NgIcon, HlmButtonImports, HlmDropdownMenuImports],
  providers: [provideIcons({ phosphorCopyLight, phosphorDotsThreeBold, phosphorPauseLight, phosphorPencilSimpleLight, phosphorPlayLight, phosphorTrashLight })],
  host: { class: 'inline-flex' },
  template: `
    @let w = workflow();
    <button #trigger hlmBtn type="button" variant="ghost" size="icon-sm" class="text-muted-foreground" [attr.aria-label]="'Actions for ' + w.name" [disabled]="!!actions.busy()[w.id]" [hlmDropdownMenuTrigger]="menu" align="end">
      <ng-icon name="phosphorDotsThreeBold" class="text-[18px]" aria-hidden="true" />
    </button>
    <ng-template #menu>
      <hlm-dropdown-menu class="w-48">
        <button hlmDropdownMenuItem (triggered)="actions.edit(w)"><ng-icon name="phosphorPencilSimpleLight" aria-hidden="true" />Edit</button>
        <button hlmDropdownMenuItem (triggered)="duplicate(w)"><ng-icon name="phosphorCopyLight" aria-hidden="true" />Duplicate</button>
        <button hlmDropdownMenuItem (triggered)="actions.setEnabled(w, !w.enabled)">
          <ng-icon [name]="w.enabled ? 'phosphorPauseLight' : 'phosphorPlayLight'" aria-hidden="true" />{{ w.enabled ? 'Pause' : 'Resume' }}
        </button>
        <hlm-dropdown-menu-separator />
        <button hlmDropdownMenuItem variant="destructive" (triggered)="remove(w)"><ng-icon name="phosphorTrashLight" aria-hidden="true" />Delete…</button>
      </hlm-dropdown-menu>
    </ng-template>
  `,
})
export class WorkflowMenu {
  readonly workflow = input.required<Workflow>();
  /** The workflow is gone: the screen moves on (and moves focus, since the menu went with it). */
  readonly deleted = output<Workflow>();
  /** A copy was made. */
  readonly duplicated = output<Workflow>();

  protected readonly actions = inject(WorkflowActions);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  protected async duplicate(workflow: Workflow) {
    const copy = await this.actions.duplicate(workflow);
    if (copy) this.duplicated.emit(copy);
  }

  protected async remove(workflow: Workflow) {
    const gone = await this.actions.remove(workflow);
    if (gone) this.deleted.emit(workflow);
    // Cancelled or refused: the keyboard goes back to the menu button, not to the top of the page.
    else this.trigger().nativeElement.focus();
  }
}
