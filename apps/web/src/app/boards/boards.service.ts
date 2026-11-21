import { Service, computed, inject, signal } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';
import { API_BASE } from '../api';
import type { Board, BoardWidget, WidgetPayload } from './types';

/*
  Saved boards (docs/round2-contracts.md §4). The server is the source of truth: GET/POST/PATCH/DELETE /api/boards.
  Until r2/be-widgets-boards is deployed the endpoint answers 404, and boards are kept in this browser with the
  same shapes and limits, so nothing changes in the UI when the server lands except where they are saved.
  Every write returns a value; failures show the server's message and never throw.
*/

const LOCAL_KEY = 'compass.boards.v1';
const LIMITS = { boards: 50, widgets: 24, rows: 400 };
export type BoardsMode = 'loading' | 'server' | 'local';
type Result<T> = { ok: true; value: T } | { ok: false; message: string };

const now = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;

function readLocal(): Board[] {
  try {
    const raw = globalThis.localStorage?.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as Board[]) : [];
  } catch {
    return [];
  }
}
function writeLocal(boards: Board[]) {
  try {
    globalThis.localStorage?.setItem(LOCAL_KEY, JSON.stringify(boards));
  } catch {
    toast('Couldn’t save the board in this browser', { description: 'Its storage is full or blocked. Free some space, or allow storage for this site.', duration: 8000 });
  }
}

@Service()
export class BoardsService {
  private readonly base = inject(API_BASE);
  readonly mode = signal<BoardsMode>('loading');
  /** The list (on the server, widgets carry spec and title only; `full()` loads the rows). */
  readonly boards = signal<Board[]>([]);
  readonly error = signal<string | null>(null);
  readonly loaded = computed(() => this.mode() !== 'loading');
  private readonly cache = new Map<string, Board>();

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.error.set(null);
    const r = await this.req<Board[]>('GET', 'boards');
    if (r.ok) {
      this.mode.set('server');
      this.boards.set(r.value);
      return;
    }
    if (r.status === 404 || r.status === 405 || r.status === 501) {
      this.mode.set('local');
      this.boards.set(readLocal());
      return;
    }
    this.mode.set('local');
    this.boards.set(readLocal());
    this.error.set(r.message);
  }

  /** A board with its widgets' rows. */
  async full(id: string): Promise<Board | null> {
    if (this.mode() === 'local') return this.boards().find((b) => b.id === id) ?? null;
    const r = await this.req<Board>('GET', `boards/${encodeURIComponent(id)}`);
    if (!r.ok) return null;
    this.cache.set(id, r.value);
    this.replace(r.value, false);
    return r.value;
  }
  cached(id: string) {
    return this.cache.get(id) ?? this.boards().find((b) => b.id === id) ?? null;
  }

  async create(input: { name: string; description?: string; hotels?: string[] }): Promise<Result<Board>> {
    const name = input.name.trim() || 'Untitled board';
    if (this.mode() === 'local') {
      if (this.boards().length >= LIMITS.boards) return this.fail(`You can keep up to ${LIMITS.boards} boards. Delete one to make room.`);
      const b: Board = { id: uid('b'), name, description: input.description ?? '', hotels: input.hotels ?? [], widgets: [], createdAt: now(), updatedAt: now() };
      this.saveLocal([b, ...this.boards()]);
      return { ok: true, value: b };
    }
    const r = await this.req<Board>('POST', 'boards', { name, description: input.description ?? '', hotels: input.hotels ?? [] });
    if (!r.ok) return this.fail(r.message, 'Couldn’t create the board');
    this.boards.update((l) => [r.value, ...l]);
    return { ok: true, value: r.value };
  }

  async update(id: string, patch: { name?: string; description?: string; hotels?: string[]; order?: string[] }): Promise<Result<Board>> {
    if (this.mode() === 'local') {
      const b = this.boards().find((x) => x.id === id);
      if (!b) return this.fail('This board no longer exists.');
      const widgets = patch.order ? patch.order.map((wid) => b.widgets.find((w) => w.id === wid)).filter((w): w is BoardWidget => !!w) : b.widgets;
      const next: Board = { ...b, ...(patch.name !== undefined ? { name: patch.name.trim() || b.name } : {}), ...(patch.description !== undefined ? { description: patch.description } : {}), ...(patch.hotels ? { hotels: patch.hotels } : {}), widgets, updatedAt: now() };
      this.saveLocal(this.boards().map((x) => (x.id === id ? next : x)));
      return { ok: true, value: next };
    }
    const r = await this.req<Board>('PATCH', `boards/${encodeURIComponent(id)}`, patch);
    if (!r.ok) return this.fail(r.message, 'Couldn’t save the change to the board');
    this.cache.delete(id);
    this.replace(r.value);
    return { ok: true, value: r.value };
  }

  async remove(id: string): Promise<Result<null>> {
    if (this.mode() === 'local') {
      this.saveLocal(this.boards().filter((b) => b.id !== id));
      return { ok: true, value: null };
    }
    const r = await this.req<unknown>('DELETE', `boards/${encodeURIComponent(id)}`);
    if (!r.ok) return this.fail(r.message, 'Couldn’t delete the board');
    this.cache.delete(id);
    this.boards.update((l) => l.filter((b) => b.id !== id));
    return { ok: true, value: null };
  }

  /** A copy with every widget (the contract has no duplicate endpoint: create, then add each widget). */
  async duplicate(id: string): Promise<Result<Board>> {
    const src = await this.full(id);
    if (!src) return this.fail('This board no longer exists.');
    const made = await this.create({ name: `${src.name} (copy)`, description: src.description, hotels: src.hotels });
    if (!made.ok) return made;
    for (const w of src.widgets) {
      const r = await this.addWidget(made.value.id, { spec: w.spec, rows: w.rows, columns: w.columns, evidence: w.evidence, question: w.question }, true);
      if (!r.ok) break;
    }
    return { ok: true, value: (await this.full(made.value.id)) ?? made.value };
  }

  async addWidget(boardId: string, payload: WidgetPayload, quiet = false): Promise<Result<BoardWidget>> {
    const rows = payload.rows.slice(0, LIMITS.rows);
    if (this.mode() === 'local') {
      const b = this.boards().find((x) => x.id === boardId);
      if (!b) return this.fail('This board no longer exists.');
      if (b.widgets.length >= LIMITS.widgets) return this.fail(`A board holds up to ${LIMITS.widgets} charts. Remove one to add another.`);
      const w: BoardWidget = { ...payload, rows, id: uid('w'), addedAt: now() };
      this.saveLocal(this.boards().map((x) => (x.id === boardId ? { ...x, widgets: [...x.widgets, w], updatedAt: now() } : x)));
      return { ok: true, value: w };
    }
    const r = await this.req<BoardWidget>('POST', `boards/${encodeURIComponent(boardId)}/widgets`, { ...payload, rows });
    if (!r.ok) return quiet ? { ok: false, message: r.message } : this.fail(r.message, 'Couldn’t add the chart');
    this.cache.delete(boardId);
    this.boards.update((l) => l.map((b) => (b.id === boardId ? { ...b, widgets: [...b.widgets, r.value], updatedAt: now() } : b)));
    return { ok: true, value: r.value };
  }

  async removeWidget(boardId: string, widgetId: string): Promise<Result<null>> {
    if (this.mode() === 'local') {
      this.saveLocal(this.boards().map((b) => (b.id === boardId ? { ...b, widgets: b.widgets.filter((w) => w.id !== widgetId), updatedAt: now() } : b)));
      return { ok: true, value: null };
    }
    const r = await this.req<unknown>('DELETE', `boards/${encodeURIComponent(boardId)}/widgets/${encodeURIComponent(widgetId)}`);
    if (!r.ok) return this.fail(r.message, 'Couldn’t remove the chart');
    this.cache.delete(boardId);
    this.boards.update((l) => l.map((b) => (b.id === boardId ? { ...b, widgets: b.widgets.filter((w) => w.id !== widgetId), updatedAt: now() } : b)));
    return { ok: true, value: null };
  }

  /**
   * "Add to …": to a saved board, or to a new one ('new', named after `newName`). Confirms with a toast that can
   * open the board or undo. `open` navigates (the caller passes store.openBoard).
   */
  async addTo(target: string | 'new', payload: WidgetPayload, open: (id: string) => void, newName?: string): Promise<boolean> {
    let boardId = target;
    let name = this.boards().find((b) => b.id === target)?.name ?? '';
    if (target === 'new') {
      const made = await this.create({ name: this.freshName(newName ?? 'Untitled board') });
      if (!made.ok) return false;
      boardId = made.value.id;
      name = made.value.name;
    }
    const r = await this.addWidget(boardId, payload);
    if (!r.ok) return false;
    toast(`Added to ${name}`, {
      description: payload.spec.title,
      duration: 10000,
      action: { label: 'Open', onClick: () => open(boardId) },
      cancel: { label: 'Undo', onClick: () => void this.removeWidget(boardId, r.value.id) },
    });
    return true;
  }

  /** A fresh name that isn't taken: "Untitled board", "Untitled board 2", … */
  freshName(base = 'Untitled board') {
    const names = new Set(this.boards().map((b) => b.name));
    if (!names.has(base)) return base;
    let n = 2;
    while (names.has(`${base} ${n}`)) n++;
    return `${base} ${n}`;
  }

  private saveLocal(boards: Board[]) {
    this.boards.set(boards);
    writeLocal(boards);
  }
  private replace(b: Board, bump = true) {
    this.boards.update((l) => (l.some((x) => x.id === b.id) ? l.map((x) => (x.id === b.id ? (bump ? b : { ...x, ...b }) : x)) : [b, ...l]));
  }
  private fail<T>(message: string, title?: string): Result<T> {
    if (title) toast(title, { description: message, duration: 8000 });
    return { ok: false, message };
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<{ ok: true; value: T } | { ok: false; status: number; message: string }> {
    try {
      const res = await fetch(`${this.base}/${path}`, {
        method,
        headers: body === undefined ? { accept: 'application/json' } : { 'content-type': 'application/json', accept: 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status === 204) return { ok: true, value: null as T };
      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      if (!res.ok) {
        const msg = (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string' ? (data as { error: string }).error : null) ?? (text && text.length < 300 && !text.startsWith('<') ? text : 'The server couldn’t do that just now. Try again in a moment.');
        return { ok: false, status: res.status, message: msg };
      }
      // The SPA fallback answers unknown paths with index.html: that means the endpoint isn't there yet.
      if (data === null && text.startsWith('<')) return { ok: false, status: 404, message: 'Boards aren’t available right now. Try again in a moment.' };
      return { ok: true, value: data as T };
    } catch {
      return { ok: false, status: 0, message: 'Couldn’t reach the server. Check your connection and try again.' };
    }
  }
}
