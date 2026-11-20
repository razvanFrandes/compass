import type { BuilderServerMessage } from '@compass/contracts';
import type { PiSession } from 'agents/harness/pi';
import { PublicError, publicMessage } from '../http/errors.ts';
import { projectEntries, projectLive } from './chat-projection.ts';

export interface ChatSocketOptions {
  /** The id the snapshot names: the conversation, or the builder's draft. */
  conversation: string;
  /** Who serves the socket, for the logs and the close reason: "Kassandra". */
  name: string;
  /** A message from the client, as received. A throw is answered with an `error` message; the socket stays open. */
  onMessage(raw: unknown): Promise<void>;
  /** Called once the snapshot is sent, with the way to send more on this socket. */
  onOpen?(send: (message: BuilderServerMessage) => void): Promise<void>;
}

/**
 * Serves one chat WebSocket over a Pi session until it closes. The server sends a snapshot, then each new transcript
 * entry once and every change of the live state (streamed text, running tools, failures). Watches live in memory, so
 * a reconnect after a restart simply gets a fresh snapshot of the durable transcript.
 */
export async function serveChatSocket(socket: WebSocket, session: PiSession, opts: ChatSocketOptions): Promise<void> {
  const label = opts.name.toLowerCase();
  const send = (message: BuilderServerMessage) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };
  let watch: Awaited<ReturnType<PiSession['watch']>> | undefined;
  const closed = new Promise<void>((resolve) => {
    socket.addEventListener('close', () => resolve());
    socket.addEventListener('error', () => resolve());
  });

  socket.addEventListener('message', (event) => {
    void opts.onMessage(event.data).catch((error: unknown) => {
      if (!(error instanceof PublicError)) console.error(`${label} message failed`, error);
      send({ type: 'error', message: publicMessage(error) });
    });
  });

  try {
    watch = await session.watch();
    const sent = new Set<number>();
    const initial = projectEntries(watch.value.entries);
    for (const entry of initial) sent.add(entry.id);
    let lastLive = JSON.stringify(projectLive(watch.value.docs));
    send({ type: 'snapshot', conversation: opts.conversation, entries: initial, live: JSON.parse(lastLive) });
    await opts.onOpen?.(send);

    watch.start(async (call) => {
      if (call.kind !== 'value') return;
      const fresh = projectEntries(call.value.entries).filter((entry) => !sent.has(entry.id));
      for (const entry of fresh) sent.add(entry.id);
      if (fresh.length) send({ type: 'entries', entries: fresh });
      const live = JSON.stringify(projectLive(call.value.docs));
      if (live !== lastLive) {
        lastLive = live;
        send({ type: 'live', live: JSON.parse(live) });
      }
    });
    await closed;
  } catch (error) {
    console.error(`${label} socket failed`, error);
    send({ type: 'error', message: publicMessage(error) });
    socket.close(1011, `${opts.name} is unavailable`);
  } finally {
    await watch?.stop();
  }
}
