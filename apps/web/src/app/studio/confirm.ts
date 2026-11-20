import { Component, ElementRef, Service, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';

export interface ConfirmRequest {
  title: string;
  body: string;
  /** The label of the button that goes ahead, e.g. "Delete workflow". */
  confirm: string;
  cancel?: string;
  /** `destructive` paints the confirm button as a deletion. */
  tone?: 'default' | 'destructive';
}

/** Asks a person before something that is hard to take back. One question at a time. */
@Service()
export class Confirm {
  private resolve: ((ok: boolean) => void) | null = null;
  readonly request = signal<ConfirmRequest | null>(null);

  /** Resolves to true when the person confirms, false when they cancel, press Escape or another question replaces it. */
  ask(request: ConfirmRequest): Promise<boolean> {
    this.resolve?.(false);
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.request.set(request);
    });
  }

  answer(ok: boolean): void {
    const resolve = this.resolve;
    this.resolve = null;
    this.request.set(null);
    resolve?.(ok);
  }
}

/**
 * The dialog behind `Confirm`: a native modal `alertdialog`, so focus is trapped, Escape cancels and focus goes
 * back to where it was. Cancel comes first, so it has the focus when the dialog opens. Put one on a screen that asks.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [HlmButtonImports],
  styles: `
    dialog[open] { animation: confirm-in 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
    @keyframes confirm-in { from { opacity: 0; transform: translateY(6px) scale(0.985); } }
    .confirm-delete { background: var(--destructive); color: #fff; }
    :host-context(:root:not(.light)) .confirm-delete { background: #c93545; }
    @media (prefers-reduced-motion: reduce) { dialog[open] { animation: none; } }
  `,
  template: `
    <dialog #dialog class="confirm-dialog" role="alertdialog" [attr.aria-labelledby]="uid + '-title'" [attr.aria-describedby]="uid + '-body'" (cancel)="$event.preventDefault(); confirm.answer(false)" (close)="confirm.request() && confirm.answer(false)">
      <!-- Always in the page, so Cancel is there to take the focus the moment the dialog opens. -->
      @let request = shown();
      <h2 class="text-[17px]/snug font-semibold tracking-[-0.01em]" [id]="uid + '-title'">{{ request.title }}</h2>
      <p class="text-muted-foreground mt-2 text-[14px]/relaxed" [id]="uid + '-body'">{{ request.body }}</p>
      <div class="mt-6 flex flex-wrap justify-end gap-2">
        <button #cancel hlmBtn type="button" variant="ghost" (click)="confirm.answer(false)">{{ request.cancel ?? 'Cancel' }}</button>
        <button hlmBtn type="button" [class.confirm-delete]="request.tone === 'destructive'" (click)="confirm.answer(true)">{{ request.confirm }}</button>
      </div>
    </dialog>
  `,
})
export class ConfirmDialog {
  protected readonly confirm = inject(Confirm);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly cancel = viewChild.required<ElementRef<HTMLButtonElement>>('cancel');
  /** The question on screen. It keeps the last one while the dialog closes, so the text does not blank out. */
  protected readonly shown = signal<ConfirmRequest>({ title: '', body: '', confirm: '' });
  private static next = 0;
  protected readonly uid = `confirm-${ConfirmDialog.next++}`;

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      const request = this.confirm.request();
      if (request) untracked(() => this.shown.set(request));
      const wanted = request !== null;
      if (wanted === dialog.open) return;
      if (wanted) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        // The safe answer has the focus: Enter or Space on a dialog that just appeared must not delete anything.
        this.cancel().nativeElement.focus();
      } else if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    });
  }
}
