import { Component, ElementRef, ViewEncapsulation, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import * as icons from './icons';
import { Live } from './live';
import { handoverMessage, type HandoverMessage } from './proposal-text';
import { ScopeService } from './scope/scope.service';
import { CompassStore } from './store';

/**
 * "View message": the message a decision was handed over with, as the person at the hotel gets it: who it went to,
 * when, the suggestion, today → suggested, the reasoning with its numbers and where the agent's own working is.
 * Its foot says what the demo does and does not do: a task for a person, no rate changed, no email sent.
 *
 * A native modal dialog, so focus is trapped, Escape closes it and focus goes back to where it was. A sheet from the
 * bottom on a phone. One of these lives in the shell; `Live.message` opens it from a toast or a card.
 */
@Component({
  selector: 'app-handover-sheet',
  imports: [NgIcon, HlmButtonImports],
  providers: [provideIcons({ ...icons })],
  encapsulation: ViewEncapsulation.None,
  styleUrl: './handover-sheet.css',
  template: `
    <dialog #dialog class="hand-sheet" aria-labelledby="hand-title" (close)="live.message.set(null)" (click)="backdrop($event)">
      @let m = shown();
      @if (m) {
        <header class="hand-head">
          <div class="min-w-0">
            <p class="hand-eyebrow">Message handed over</p>
            <h2 id="hand-title" class="hand-subject">{{ m.subject }}</h2>
          </div>
          <button #close hlmBtn type="button" variant="ghost" size="icon-sm" aria-label="Close the message" (click)="dismiss()"><ng-icon name="phosphorXLight" aria-hidden="true" /></button>
        </header>

        <div class="hand-body">
          <dl class="hand-meta">
            <div>
              <dt>To</dt>
              <dd>
                @if (m.to; as to) {
                  <span class="hand-name">{{ to.name }}</span>, {{ to.roleLabel }} · {{ to.hotel }}
                  <span class="hand-address">{{ to.email }}</span>
                } @else {
                  <span class="hand-name">The {{ m.role.toLowerCase() }}</span> · {{ m.hotel }}
                }
              </dd>
            </div>
            <div>
              <dt>From</dt>
              <dd>Compass, sent on by you</dd>
            </div>
            @if (m.sent) {
              <div>
                <dt>Sent</dt>
                <dd>{{ m.sent }}@if (m.task) {<span class="hand-task"> · task {{ m.task }}</span>}</dd>
              </div>
            }
          </dl>

          <div class="hand-message">
            <h3 class="hand-suggestion">{{ m.suggestion }}</h3>
            <p class="hand-summary">{{ m.summary }}</p>
            <dl class="hand-plan">
              @if (m.reasoning.today || m.reasoning.suggested) {
                <div>
                  <dt>Today</dt>
                  <dd>{{ m.reasoning.today || 'not stated' }}</dd>
                </div>
                <div>
                  <dt>Suggested</dt>
                  <dd>{{ m.reasoning.suggested || 'not stated' }}</dd>
                </div>
              }
              @if (m.reasoning.covers) {
                <div>
                  <dt>Covers</dt>
                  <dd>{{ m.reasoning.covers }}</dd>
                </div>
              }
              <div>
                <dt>The reasoning</dt>
                <dd>{{ m.reasoning.why }}</dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd><a class="hand-link" [href]="m.evidenceHref" (click)="evidence($event, m)">The agent’s run, with the data it read <span aria-hidden="true">→</span></a></dd>
              </div>
            </dl>
          </div>
        </div>

        <footer class="hand-foot">
          <p><ng-icon name="phosphorLockSimpleLight" aria-hidden="true" /><span>{{ m.footnote }}</span></p>
          <button hlmBtn type="button" variant="outline" size="sm" (click)="dismiss()">Close</button>
        </footer>
      }
    </dialog>
  `,
})
export class HandoverSheet {
  protected readonly live = inject(Live);
  private readonly scope = inject(ScopeService);
  private readonly store = inject(CompassStore);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly close = viewChild<ElementRef<HTMLButtonElement>>('close');

  private readonly message = computed<HandoverMessage | null>(() => {
    const outcome = this.live.message();
    return outcome ? handoverMessage(outcome, this.scope.nameOf(outcome.proposal.hotel_code), this.scope.catalog()) : null;
  });
  /** The message on screen. It keeps the last one while the dialog closes, so the text does not blank out. */
  protected readonly shown = signal<HandoverMessage | null>(null);
  private opener: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      const message = this.message();
      if (message) untracked(() => this.shown.set(message));
      const wanted = message !== null;
      if (wanted === dialog.open) return;
      if (wanted) {
        this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        queueMicrotask(() => this.close()?.nativeElement.focus());
      } else {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
        // The toast that opened it may be gone by now: focus goes back only to something still on the page.
        if (this.opener?.isConnected) this.opener.focus();
        this.opener = null;
      }
    });
  }

  /** Closing is clearing the message: the effect above then closes the dialog, in whatever way the browser has. */
  protected dismiss() {
    this.live.message.set(null);
  }

  /** A click on the dimmed page behind the sheet closes it. */
  protected backdrop(event: MouseEvent) {
    if (event.target === this.dialog().nativeElement) this.dismiss();
  }

  /** The evidence is the agent's own page: its run log shows what it read. */
  protected evidence(event: Event, m: HandoverMessage) {
    event.preventDefault();
    this.dismiss();
    this.store.openWatcher(m.workflowId, 'history');
  }
}
