import { Service, computed, effect, inject, signal, untracked } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';
import type { AnswerMode, Proposal, Workflow } from '@compass/contracts';
import { BriefApi, KassandraChat, WorkflowsApi, toApiError } from './api';
import { FilterState, scopeChips } from './filters';
import { AnswerScope, BRIEF_ITEMS, BriefRow, CompassStore, THEME_LAB_PATH, isBuilderUrl, isOrbLabUrl, scopeForRow } from './store';
import { Drill } from './portfolio';
import { drillContent } from './drill';
import { ScopeService } from './scope/scope.service';
import { docsPageOf } from './docs/docs-pages';

/** Who decides, as the audit log records it. The demo has no sign-in yet. */
export const DECIDER = 'Revenue manager (web)';
const CONVERSATIONS_KEY = 'compass.conversations';
const MODE_KEY = 'compass.answerMode';

export interface ConversationRef {
  id: string;
  title: string;
  /** When it was last asked something (ms), for "5 min" in the sidebar. */
  at: number;
  scope?: AnswerScope;
  /** What opened it (a brief item, a chart mark, a KPI tile), so the same click reopens it instead of asking again. */
  source?: string;
}

/**
 * A thread's title from its first question: the trailing scope in brackets is dropped, long questions are cut at a
 * word, and a title already in the list gets a number, so no two threads read the same.
 */
export function threadTitle(question: string, taken: readonly string[] = []): string {
  let base = question.replace(/\s+/g, ' ').trim().replace(/\s*\([^()]*\)\s*$/, '') || 'New conversation';
  if (base.length > 72) base = `${base.slice(0, 70).replace(/\s+\S*$/, '')}…`;
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) if (!taken.includes(`${base} · ${n}`)) return `${base} · ${n}`;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: the list lives for this visit only */
  }
}

/**
 * The live backend behind the screens (src/app/api): the morning brief, Kassandra's chat and the workflows
 * (watchers, proposals, audit). Screens read signals from here; the embedded Halcyon snapshot stays as the
 * fallback when the brief can't load, and for the boards, which the API doesn't serve.
 */
@Service()
export class Live {
  private readonly store = inject(CompassStore);
  readonly briefApi = inject(BriefApi);
  readonly chat = inject(KassandraChat);
  readonly workflowsApi = inject(WorkflowsApi);
  /** The hotels the person works on (the sidebar switcher). Decisions waiting on a person follow it; every question carries it. */
  readonly hotelScope = inject(ScopeService);

  /* ── Brief ── */
  readonly briefState = computed<'loading' | 'live' | 'snapshot'>(() => (this.briefApi.brief.hasValue() ? 'live' : this.briefApi.brief.error() ? 'snapshot' : 'loading'));
  readonly briefError = computed(() => this.briefApi.error()?.message ?? null);
  readonly briefMeta = computed(() => {
    const b = this.briefApi.brief.hasValue() ? this.briefApi.brief.value() : null;
    if (!b) return null;
    const at = new Date(b.generatedAt);
    return { generated: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(at), model: b.model, usage: b.usage };
  });
  readonly refreshing = signal(false);

  /* ── Workflows ── */
  readonly workflows = this.workflowsApi.listResource();
  readonly pending = this.workflowsApi.proposalsResource();
  readonly audit = this.workflowsApi.auditResource();
  readonly pendingList = computed(() => (this.pending.hasValue() ? this.pending.value() : []).filter((p) => this.hotelScope.includes(p.hotel_code)));
  readonly workflowList = computed(() => (this.workflows.hasValue() ? this.workflows.value() : []));
  readonly workflowsError = computed(() => (this.workflows.error() ? toApiError(this.workflows.error()).message : null));
  /** Calls in flight, by workflow or proposal id, so buttons can say "Running…" / "Approving…". */
  readonly busy = signal<Record<string, string>>({});

  /* ── Chat ── */
  readonly mode = signal<AnswerMode>(read<AnswerMode>(MODE_KEY, 'thinker'));
  /** Text to put in the thread's composer without sending it: only `/ask?q=` (a link in an email) does that. */
  readonly composer = signal<{ text: string; n: number }>({ text: '', n: 0 });
  readonly conversations = signal<ConversationRef[]>(read<ConversationRef[]>(CONVERSATIONS_KEY, []));
  readonly scope = computed(() => this.conversations().find((c) => c.id === this.chat.conversation())?.scope ?? null);
  readonly title = computed(() => this.conversations().find((c) => c.id === this.chat.conversation())?.title ?? this.chat.turns().find((t) => t.question)?.question ?? 'New conversation');
  private n = 0;
  /** A reopened thread whose first question never reached the server (it was refused): ask it once it has loaded. */
  private readonly unanswered = signal<{ id: string; question: string } | null>(null);

  constructor() {
    // The live brief replaces the snapshot as soon as it loads.
    effect(() => {
      // value() throws while the resource is in error: read it only when there is one. On failure, the saved copy.
      const b = this.briefApi.brief.hasValue() ? this.briefApi.brief.value() : null;
      const failed = !!this.briefApi.brief.error();
      untracked(() => {
        if (b) this.store.setBrief(b.items as unknown as BriefRow[], 'live');
        else if (failed && this.store.briefSource() !== 'live') this.store.setBrief(BRIEF_ITEMS, 'snapshot');
      });
    });
    effect(() => write(MODE_KEY, this.mode()));
    effect(() => write(CONVERSATIONS_KEY, this.conversations().slice(0, 30)));
    effect(() => {
      const want = this.unanswered();
      if (!want || this.chat.conversation() !== want.id || this.chat.status() !== 'open') return;
      untracked(() => {
        this.unanswered.set(null);
        if (!this.chat.turns().length) this.chat.ask(want.question, this.mode(), this.askScope());
      });
    });
    // A conversation is remembered once it has a question.
    effect(() => {
      const q = this.chat.turns().find((t) => t.question)?.question;
      const id = this.chat.conversation();
      if (q) untracked(() => this.remember(id, q));
    });
    // The contract is polling: a decision wakes the run, and the proposal moves on a moment later.
    const timer = setInterval(() => {
      this.pending.reload();
      if (this.store.view() === 'watchers' || this.store.view() === 'watcher') {
        this.workflows.reload();
        this.audit.reload();
      }
    }, 10_000);
    void timer;
    // Every place has an address, so reload and Back work: /ask?c=…, /studio/:id, /boards/:id, /workflows/new.
    // The scope rides along in ?hotels= (ScopeService.href).
    this.applyUrl();
    effect(() => {
      const target = this.urlFor();
      const loc = globalThis.location;
      if (!target || !loc) return;
      const params = new URLSearchParams(loc.search);
      const here = target.c ? loc.pathname === target.path && params.get('c') === target.c : loc.pathname === target.path;
      if (!here) globalThis.history?.pushState(null, '', this.hotelScope.href(target.c ? `${target.path}?c=${encodeURIComponent(target.c)}` : target.path));
    });
    globalThis.addEventListener?.('popstate', () => this.applyUrl());
  }

  /** The address of what's on screen (null for the builder, which keeps its own ?draft=). */
  private urlFor(): { path: string; c?: string } | null {
    switch (this.store.view()) {
      case 'thread':
        return { path: '/ask', c: this.chat.conversation() };
      case 'boards':
        return { path: '/boards' };
      case 'board':
        return { path: `/boards/${encodeURIComponent(this.store.activeBoardId())}` };
      case 'watchers':
        return { path: '/studio' };
      case 'watcher':
        return { path: `/studio/${encodeURIComponent(this.store.activeWatcherId())}` };
      case 'builder':
      case 'notfound':
      case 'orb-lab':
      case 'docs': // /docs/*: DocsRouter keeps the page and its address
        return null;
      case 'catalog':
        return { path: '/catalog' };
      case 'theme-lab':
        return { path: THEME_LAB_PATH };
      default:
        return { path: '/' };
    }
  }
  /** Opens what the address names. `/ask?q=…` (links in alert emails) fills the composer and never sends. */
  private applyUrl() {
    const loc = globalThis.location;
    if (!loc) return;
    const path = loc.pathname.replace(/\/+$/, '') || '/';
    const params = new URLSearchParams(loc.search);
    const seg = (re: RegExp) => {
      const m = path.match(re);
      return m ? decodeURIComponent(m[1]) : null;
    };
    if (isBuilderUrl(loc)) return this.store.view.set('builder');
    if (isOrbLabUrl(loc)) return this.store.view.set('orb-lab');
    if (path === THEME_LAB_PATH) return this.store.view.set('theme-lab');
    if (docsPageOf(path)) return this.store.view.set('docs');
    if (path === '/ask') {
      const c = params.get('c');
      if (c) this.chat.open(c);
      const q = params.get('q');
      if (q !== null) {
        // A link from an email: a fresh conversation with the question ready. Opening it never asks anything.
        if (!c) this.chat.newConversation();
        this.prefill(q);
        globalThis.history?.replaceState(null, '', this.hotelScope.href(`/ask?c=${encodeURIComponent(this.chat.conversation())}`));
      }
      return this.store.view.set('thread');
    }
    if (path === '/catalog') return this.store.view.set('catalog');
    // Agent Studio lives at /studio; /watchers is its old address and still opens it.
    if (path.startsWith('/watchers')) globalThis.history?.replaceState(null, '', `${path.replace(/^\/watchers/, '/studio')}${loc.search}`);
    if (path === '/studio' || path === '/watchers') return this.store.view.set('watchers');
    const wid = seg(/^\/(?:studio|watchers)\/([^/]+)$/);
    if (wid) {
      this.store.activeWatcherId.set(wid);
      return this.store.view.set('watcher');
    }
    if (path === '/boards') return this.store.view.set('boards');
    const bid = seg(/^\/boards\/([^/]+)$/);
    if (bid) {
      // Built-in or saved: the board page says "Board not found" when a saved id doesn't exist.
      this.store.activeBoardId.set(bid);
      return this.store.view.set('board');
    }
    this.store.view.set(path === '/' ? 'inbox' : 'notfound');
  }

  /* ── Chat actions ── */
  /** The global hotel scope, sent with every question (round2-contracts §1). Empty means the whole group. */
  private askScope() {
    return { hotels: this.hotelScope.hotels() };
  }
  /**
   * "Explore" on a brief item, a click on a chart mark or a KPI tile: the Thread opens and the question is sent at
   * once, because the click is the person's own. `source` names what was clicked: the same item under the same
   * hotel scope reopens its thread instead of asking twice.
   */
  explore(question: string, scope?: AnswerScope, source?: string) {
    const q = question.trim();
    if (!q) return;
    const key = source ? `${source}@${[...this.hotelScope.hotels()].sort().join(',')}` : undefined;
    const existing = key ? this.conversations().find((c) => c.source === key) : undefined;
    this.prefill('');
    if (existing && this.chat.open(existing.id)) {
      this.unanswered.set({ id: existing.id, question: q });
      this.store.go('thread');
      return;
    }
    const id = this.chat.newConversation();
    this.remember(id, q, scope, key);
    this.store.go('thread');
    this.chat.ask(q, this.mode(), this.askScope());
  }
  /** A typed question from anywhere: a new conversation, sent at once. */
  askNew(question: string) {
    this.explore(question);
  }
  /** A click that stands for a question ("Ask why", a KPI tile): sent at once, and the same click reopens its thread. */
  askAbout(question: string) {
    this.explore(question, undefined, `q:${question.trim()}`);
  }
  /** The composer in the thread: a follow-up, or a correction while an answer runs. */
  send(text: string) {
    const q = text.trim();
    if (!q) return;
    if (this.chat.running()) this.chat.steer(q);
    else this.chat.ask(q, this.mode(), this.askScope());
    this.touch(this.chat.conversation());
  }
  openConversation(id: string) {
    if (this.chat.open(id)) this.store.go('thread');
  }
  newChat() {
    this.chat.newConversation();
    this.prefill('');
    this.store.go('thread');
  }
  /** A click on a chart mark: the structured drill becomes the question, with the chart's scope, and is sent. */
  drill(d: Drill, s: FilterState) {
    const r = drillContent(d, s);
    const patch: Partial<FilterState> | null = d.dimension === 'night' ? null : d.dimension === 'hotel' ? { hotels: [d.value] } : d.dimension === 'channel' ? { channels: [d.value], chOp: 'is' } : { segments: [d.value], segOp: 'is' };
    const chips = [...scopeChips(r.scope), ...(r.extraChip ? [r.extraChip] : [])];
    const question = `${r.question} (${chips.join(' · ')})`;
    this.explore(
      question,
      {
        chips,
        patch,
        said: d.dimension === 'hotel' ? { hotels: `clicked ${d.label}` } : d.dimension === 'channel' ? { channel: `clicked ${d.label}` } : d.dimension === 'segment' ? { segment: `clicked ${d.label}` } : {},
        note: patch ? undefined : 'A single night isn’t a dashboard preset',
      },
      `drill:${question}`,
    );
  }
  exploreRow(r: BriefRow) {
    this.explore(r.question ?? r.title ?? r.hotel_name, scopeForRow(r), `brief:${r.id}`);
  }
  /** A new name for a thread in the sidebar. An empty name keeps the old one. */
  renameConversation(id: string, title: string) {
    const name = title.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (name) this.conversations.update((list) => list.map((c) => (c.id === id ? { ...c, title: name } : c)));
  }
  /**
   * Takes a thread out of the list and returns it, so the caller can offer Undo (`restoreConversation`). The list is
   * this browser's: the transcript stays on the server under its id.
   */
  deleteConversation(id: string): ConversationRef | null {
    const removed = this.conversations().find((c) => c.id === id) ?? null;
    if (!removed) return null;
    this.forgotten.add(id);
    this.conversations.update((list) => list.filter((c) => c.id !== id));
    if (this.chat.conversation() === id) this.chat.newConversation();
    return removed;
  }
  restoreConversation(ref: ConversationRef) {
    this.forgotten.delete(ref.id);
    this.conversations.update((list) => (list.some((c) => c.id === ref.id) ? list : [...list, ref].sort((a, b) => b.at - a.at)));
  }
  private readonly forgotten = new Set<string>();

  private prefill(text: string) {
    this.composer.set({ text, n: ++this.n });
  }
  private remember(id: string, question: string, scope?: AnswerScope, source?: string) {
    if (this.forgotten.has(id)) return;
    this.conversations.update((list) => {
      const old = list.find((c) => c.id === id);
      if (old && (scope ?? old.scope) === old.scope && (source ?? old.source) === old.source) return list;
      const others = list.filter((c) => c.id !== id);
      const next: ConversationRef = { id, title: old?.title ?? threadTitle(question, others.map((c) => c.title)), at: old?.at ?? Date.now(), scope: scope ?? old?.scope, source: source ?? old?.source };
      return [next, ...others];
    });
  }
  /** A thread that was just asked something moves to the top of the list. */
  private touch(id: string) {
    this.conversations.update((list) => {
      const ref = list.find((c) => c.id === id);
      return ref ? [{ ...ref, at: Date.now() }, ...list.filter((c) => c.id !== id)] : list;
    });
  }

  /* ── Brief actions ── */
  async refreshBrief() {
    this.refreshing.set(true);
    const r = await this.briefApi.refresh();
    this.refreshing.set(false);
    if (!r.ok) toast('The brief wasn’t refreshed', { description: r.error.message, duration: 8000 });
  }

  /* ── Workflow actions (errors are values: the server's text is shown as is) ── */
  async runNow(w: Workflow) {
    this.mark(w.id, 'Running…');
    const r = await this.workflowsApi.run(w.id);
    this.mark(w.id, null);
    if (!r.ok) toast(`${w.name} didn’t start`, { description: r.error.message, duration: 8000 });
    else toast(`${w.name} is running`, { description: 'Its result will show here when it finishes.', duration: 5000 });
    this.workflows.reload();
    return r;
  }
  async setEnabled(w: Workflow, enabled: boolean) {
    this.mark(w.id, enabled ? 'Turning on…' : 'Pausing…');
    const r = await this.workflowsApi.patch(w.id, { enabled });
    this.mark(w.id, null);
    if (!r.ok) toast(`${w.name} wasn’t changed`, { description: r.error.message, duration: 8000 });
    this.workflows.reload();
    return r;
  }
  async setAutonomy(w: Workflow, autonomy: Workflow['autonomy']) {
    const r = await this.workflowsApi.patch(w.id, { autonomy });
    if (!r.ok) toast(`${w.name} wasn’t changed`, { description: r.error.message, duration: 8000 });
    this.workflows.reload();
    return r;
  }
  async decide(p: Proposal, approved: boolean, note = '') {
    this.mark(p.id, approved ? 'Approving…' : 'Denying…');
    const r = await this.workflowsApi.decide(p.id, { approved, by: DECIDER, note });
    this.mark(p.id, null);
    if (!r.ok) toast('The decision wasn’t saved', { description: r.error.message, duration: 8000 });
    else
      toast(approved ? 'Approved' : 'Denied', {
        description: approved ? 'Handed to the revenue manager as an RMS task; it shows in the audit log.' : 'Nothing will be changed.',
        duration: 6000,
        ...(approved ? { action: { label: 'Undo', onClick: () => void this.undo(p) } } : {}),
      });
    this.reloadAll();
    return r;
  }
  async undo(p: Proposal) {
    const r = await this.workflowsApi.undo(p.id, DECIDER);
    if (!r.ok) toast('Undo failed', { description: r.error.message, duration: 8000 });
    else toast('Undone', { description: 'A compensating RMS task was sent and audited.', duration: 5000 });
    this.reloadAll();
    return r;
  }
  reloadAll() {
    this.pending.reload();
    this.workflows.reload();
    this.audit.reload();
  }
  private mark(id: string, label: string | null) {
    this.busy.update((b) => {
      const next = { ...b };
      if (label) next[id] = label;
      else delete next[id];
      return next;
    });
  }
}

/** "3 min ago", "yesterday 17:24". */
export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  const s = Math.round((now - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(t);
}
