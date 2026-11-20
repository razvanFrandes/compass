import type { Brief } from '@compass/contracts';
import { DurableObject } from 'cloudflare:workers';
import { generateBrief } from '../application/brief.ts';
import type { Env } from '../env.ts';
import { createClaudeBriefWriter } from '../infrastructure/brief-writer.ts';
import { openPostgres } from '../infrastructure/postgres.ts';

/**
 * The morning brief, one object for the group. A cron regenerates it every morning; the app reads the latest one.
 * Regeneration is single-flight, so a burst of requests causes at most one generation.
 */
export class Briefs extends DurableObject<Env> {
  #running: Promise<Brief> | undefined;

  async latest(): Promise<Brief> {
    const stored = await this.ctx.storage.get<Brief>('latest');
    return stored ?? this.regenerate();
  }

  regenerate(): Promise<Brief> {
    this.#running ??= this.#generate().finally(() => {
      this.#running = undefined;
    });
    return this.#running;
  }

  async #generate(): Promise<Brief> {
    const db = openPostgres(this.env.HYPERDRIVE.connectionString);
    try {
      const brief = await generateBrief(db, createClaudeBriefWriter(this.env.AI));
      await this.ctx.storage.put('latest', brief);
      return brief;
    } finally {
      await db.close();
    }
  }
}
