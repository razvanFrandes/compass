import { DestroyRef, inject } from '@angular/core';
import { API_BASE, ChatSocket, SOCKET_FACTORY, wsUrl } from '../api';

/**
 * A Kassandra conversation of its own, beside the main thread (`KassandraChat`): a board's "describe a view" talks
 * to Kassandra without leaving the board or touching the thread the person has open. Call it in an injection
 * context; the socket closes with the component.
 */
export function kassandraSession(conversation: string): ChatSocket {
  const base = inject(API_BASE);
  const chat = new ChatSocket({ url: () => wsUrl(base, 'kassandra/ws', { conversation }), createSocket: inject(SOCKET_FACTORY) });
  inject(DestroyRef).onDestroy(() => chat.disconnect());
  return chat;
}

/** A conversation id (1–64 letters, digits, `-` or `_`) from a readable prefix and a random tail. */
export function sessionId(prefix: string): string {
  const tail = (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, '').slice(0, 12);
  return `${prefix.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)}-${tail}`;
}
