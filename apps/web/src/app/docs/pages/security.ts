import { httpResource } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { API_BASE, apiUrl } from '../../api/api-config';
import { DOCS_KIT, type DocsCell } from '../docs-kit';

/** `GET /api/budget`: today's usage per kind, for all visitors together. */
type BudgetUsage = Record<string, { used: number; limit: number }>;

const BUDGET_KINDS: readonly { key: string; label: string; what: string }[] = [
  { key: 'question', label: 'Questions', what: 'Kassandra questions and steers' },
  { key: 'workflow_run', label: 'Workflow runs', what: '“Run now” and builder tests' },
  { key: 'decision', label: 'Decisions', what: 'Send a proposal to the revenue manager, or dismiss it' },
  { key: 'brief_refresh', label: 'Brief refreshes', what: 'Regenerate the morning brief' },
  { key: 'embedding', label: 'Embeddings', what: '`find_reviews` calls over MCP' },
  { key: 'voice', label: 'Voice dictations', what: 'Temporary speech-to-text keys' },
  { key: 'board_write', label: 'Board changes', what: 'Create, rename, add or remove a widget' },
];
/** The limits in `apps/worker/wrangler.jsonc`, shown when the live count cannot be read. */
const DEFAULT_LIMITS: Record<string, number> = { question: 300, workflow_run: 60, decision: 120, brief_refresh: 24, embedding: 2000, voice: 300, board_write: 600 };

const POSTURE: readonly DocsCell[] = [
  { k: 'Database', title: 'A role that can only read', text: '`compass_ro` has `SELECT` on schema `hotel` only. Every transaction is read-only and stops at 5 s. Postgres listens on localhost; the VM opens no inbound port.' },
  { k: 'Custom SQL', title: 'A SQL guard in front of the escape hatch', text: '`run_readonly_query` accepts one `SELECT`, refuses `pg_*` names, locks and session statements, and is wrapped to 200 rows of at most 32 KB.' },
  { k: 'Prompt injection', title: 'Outside text is wrapped as data', text: 'Guest reviews, account names and custom query results reach the model inside `<untrusted_data>`, with `<` escaped. The system prompt treats that text as data, never as instructions.' },
  { k: 'Actions', title: 'Prices and channels need a person', text: '`adjust_bar`, `close_channel` and `open_channel` are high risk in code. Injected text cannot make a workflow apply one alone.' },
  { k: 'Spend', title: 'A daily budget for everyone together', text: 'One Durable Object counts questions, runs, decisions and more per UTC day. When a kind is spent the app says so until midnight UTC.' },
  { k: 'Email', title: 'Limits on mail from our domain', text: 'One sender, one recipient per workflow, a fixed template, and every outside link removed. 3 per hour and 6 per day per address, 50 per day in total.' },
  { k: 'Privacy', title: 'Masked addresses', text: 'API answers, the audit log and run logs show `si****@gmail.com`. Only the builder socket shows the address, and its draft id is a random secret. Quota counters key on a hash.' },
  { k: 'API', title: 'Same-origin writes, no internals in errors', text: 'A mutating `/api` call from another site gets 403, and both sockets check their Origin. Bodies are at most 16 KB. Unexpected errors return a generic 500.' },
  { k: 'Voice', title: 'The speech key never reaches the browser', text: 'The Worker mints a temporary Soniox key: single use, 120 s to connect, 180 s of audio, 10 per minute per client.' },
];

const GUARD: readonly (readonly string[])[] = [
  ['Quoted identifiers hid the name', '`select "pg_sleep"(10)`'],
  ['Unicode-escaped identifiers', '`select U&"\\0070g_sleep"(10)`'],
  ['Nested block comments', '`select 1 /* /* */ \' */ , pg_sleep(10) --\'`'],
  ['Catalog without a schema', '`select datname from pg_database`'],
  ['SQL run from a string', '`query_to_xml(\'…\')`, `ts_stat(\'…\')`'],
  ['Row locks', '`for share`, `for key share`'],
  ['Escaping the row cap', '`select 1) as q, generate_series(…) --`'],
  ['Huge rows', '`select repeat(\'x\', 100000000)`'],
];

const EMAIL: readonly (readonly string[])[] = [
  ['Recipient', 'One address per workflow, fixed when it is created. The model never sees or chooses it.'],
  ['Per address', '3 emails per rolling hour and 6 per UTC day.'],
  ['Per client', '10 per rolling hour for whoever pressed “Run now” or “Send test now”.'],
  ['Everyone', '50 per UTC day.'],
  ['Lifetime', 'A scheduled email workflow turns itself off after 7 days or 5 emails, and its last mail says so.'],
  ['Content', 'A fixed subject and template. The summary is at most 500 characters, every value is HTML-escaped, and every URL and bare domain becomes `[link removed]`.'],
  ['Links', 'The one link opens `/ask?q=…`, which only fills the composer. The person presses send, so a link cannot spend the budget.'],
];

const ACCEPTED: readonly DocsCell[] = [
  { title: 'A visitor can change demo state', text: 'There is no login, so anyone can send or dismiss a proposal, edit a workflow or delete a board. Nothing outside Compass changes, and the audit log records each decision.' },
  { title: 'A visitor can spend the day’s budget', text: 'Others then get a clear message until midnight UTC. The cost of a bad day is capped.' },
  { title: 'The hotel scope is not access control', text: 'It is a working mode, checked and enforced in code on every tool. Anyone may pick any scope: the data is the same fictional data for everyone.' },
  { title: 'Board widgets trust the client for their rows', text: 'A script could store invented rows. A stricter API would copy the widget from the conversation on the server.' },
];

/** /docs/security: the posture of a public demo that has no login. */
@Component({
  selector: 'docs-security',
  imports: [...DOCS_KIT],
  host: { class: 'block' },
  styles: `
    .meter {
      height: 6px;
      overflow: hidden;
      border-radius: var(--radius-mark, 3px);
      background: var(--muted);
    }
    .meter > i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--series);
    }
    .meter > i[data-full] {
      background: var(--brass);
    }
  `,
  template: `
    <div class="flex flex-col gap-section-lg">
      <docs-head
        eyebrow="Docs · Security"
        title="A public demo with no login, and a bounded bad day"
        lede="Reviewers use Compass as it is, without an account, and every model call is paid from the owner’s key. So the design goal is not access control. It is a public surface that cannot write anywhere that matters, cannot be turned against a visitor, and cannot spend more than a fixed amount in a day."
      />

      <docs-section heading="The posture, in nine lines" anchor="posture">
        <docs-cells [items]="posture" [min]="300" />
      </docs-section>

      <docs-section heading="Daily budget" anchor="budget" [note]="budgetNote()">
        <ul class="docs-panel grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
          @for (b of budget(); track b.key) {
            <li class="min-w-0">
              <p class="flex items-baseline justify-between gap-3 text-[14px]">
                <span class="font-medium">{{ b.label }}</span>
                <span class="text-muted-foreground tabular-nums">
                  @if (b.used !== null) {
                    <span class="text-foreground">{{ b.used }}</span> of
                  }
                  {{ b.limit }} a day
                </span>
              </p>
              @if (b.used !== null) {
                <div class="meter mt-1.5" role="img" [attr.aria-label]="b.label + ': ' + b.used + ' of ' + b.limit + ' used today'"><i [style.width.%]="b.pct" [attr.data-full]="b.pct >= 100 ? '' : null"></i></div>
              }
              <p class="docs-md text-muted-foreground mt-1.5 text-[12.5px]" [innerHTML]="b.what | md"></p>
            </li>
          }
        </ul>
        <p class="text-muted-foreground mt-3 max-w-[76ch] text-[13px]/relaxed">Per client, on top of the budget: 6 questions and 60 MCP requests a minute, 10 voice keys a minute, 60 board changes a minute. At most 30 workflows may be enabled, because the morning cron may run each of them.</p>
      </docs-section>

      <docs-section heading="What the SQL guard refuses" anchor="guard" note="Each of these got through an earlier version of the guard and is refused now. The guard follows Postgres’s own lexer (nested comments, \`E''\` escapes), checks quoted identifiers as words, and requires balanced parentheses before it wraps the query in a row and size cap.">
        <docs-table caption="Bypasses the SQL guard now refuses" [head]="['Bypass', 'Example']" [rows]="guard" [minWidth]="560" />
      </docs-section>

      <docs-section heading="Email is the riskiest feature" anchor="email" note="Nobody logs in, and a workflow mails an address a visitor types. Left open, that is an email relay on our domain. Everything below bounds how much mail leaves, to whom, and what it can say.">
        <docs-table caption="The limits on workflow emails" [head]="['What', 'Rule']" [rows]="email" [minWidth]="520" />
      </docs-section>

      <docs-section heading="What the demo does not prevent" anchor="accepted" note="These are accepted, and written down. Each one would close with a login.">
        <docs-cells [items]="accepted" [min]="300" />
      </docs-section>
    </div>
  `,
})
export class DocsSecurity {
  private readonly base = inject(API_BASE);
  /** Today's usage, read from the same endpoint the app uses. The page still stands when it cannot be read. */
  private readonly usage = httpResource<BudgetUsage>(() => apiUrl(this.base, '/budget'));

  protected readonly posture = POSTURE;
  protected readonly guard = GUARD;
  protected readonly email = EMAIL;
  protected readonly accepted = ACCEPTED;

  private readonly live = computed<BudgetUsage | null>(() => (this.usage.hasValue() ? this.usage.value() : null));
  protected readonly budget = computed(() => {
    const live = this.live();
    return BUDGET_KINDS.map((k) => {
      const row = live?.[k.key];
      const usable = !!row && typeof row.used === 'number' && typeof row.limit === 'number';
      const limit = usable ? row.limit : (DEFAULT_LIMITS[k.key] ?? 0);
      const used = usable ? row.used : null;
      return { ...k, limit, used, pct: used === null || !limit ? 0 : Math.min(100, Math.round((used / limit) * 100)) };
    });
  });
  protected readonly budgetNote = computed(() =>
    this.live()
      ? 'Counted per UTC day for all visitors together, by one Durable Object. The bars show today’s real usage, read from `GET /api/budget` just now.'
      : 'Counted per UTC day for all visitors together, by one Durable Object. Over a limit the API answers 429 with the time it resets, and the app shows that message as it is.',
  );
}
