import { DurableObject } from 'cloudflare:workers';
import { BoardService } from '../application/boards/boards.ts';
import { buildSeedBoards } from '../application/boards/seed.ts';
import { HotelData } from '../application/hotel-data.ts';
import type { Env } from '../env.ts';
import { DurableBoardStore } from '../infrastructure/do-board-store.ts';
import { openPostgres } from '../infrastructure/postgres.ts';
import { catalogRunner } from './tools/run-catalog-tool.ts';

/** The one instance every request shares: the boards of the group. */
export const BOARDS_NAME = 'halcyon';

/** After a failed seeding, the next try waits this long, so a database outage does not slow every request. */
const SEED_RETRY_MS = 60_000;

/**
 * Boards (the Canvas saved on the server): one object for the group. A Durable Object runs one request at a time
 * across its storage calls, so two visitors cannot both add the 24th widget or create the 50th board.
 *
 * On first use it seeds the sample boards from the database (application/boards/seed.ts), so the Boards page is never
 * empty. Seeding is single-flight and recorded once it worked; a sample board that is deleted later stays deleted.
 */
export class Boards extends DurableObject<Env> {
  #service = new BoardService(new DurableBoardStore(this.ctx.storage));
  #seeded = false;
  #seeding: Promise<void> | undefined;
  #seedFailedAt = 0;

  async list() {
    await this.#ready();
    return this.#service.list();
  }
  async get(id: string) {
    await this.#ready();
    return this.#service.get(id);
  }
  async create(input: unknown) {
    await this.#ready();
    return this.#service.create(input);
  }
  async update(id: string, input: unknown) {
    await this.#ready();
    return this.#service.update(id, input);
  }
  async remove(id: string) {
    await this.#ready();
    return this.#service.remove(id);
  }
  async addWidget(id: string, input: unknown) {
    await this.#ready();
    return this.#service.addWidget(id, input);
  }
  async removeWidget(id: string, widgetId: string) {
    await this.#ready();
    return this.#service.removeWidget(id, widgetId);
  }

  async #ready(): Promise<void> {
    if (this.#seeded) return;
    if (await this.ctx.storage.get<string>('seeded')) {
      this.#seeded = true;
      return;
    }
    if (Date.now() - this.#seedFailedAt < SEED_RETRY_MS) return;
    this.#seeding ??= this.#seed().finally(() => {
      this.#seeding = undefined;
    });
    await this.#seeding;
  }

  /** Builds the sample boards from the database. A failure is logged and tried again later; the API still answers. */
  async #seed(): Promise<void> {
    const db = openPostgres(this.env.HYPERDRIVE.connectionString);
    try {
      const data = new HotelData(db);
      const built = await buildSeedBoards(catalogRunner(data), await data.businessDate(), new Date());
      if (!built.ok) throw new Error(built.error);
      await this.#service.seed(built.value);
      await this.ctx.storage.put('seeded', new Date().toISOString());
      this.#seeded = true;
    } catch (error) {
      console.error('seeding the sample boards failed', error);
      this.#seedFailedAt = Date.now();
    } finally {
      await db.close();
    }
  }
}
