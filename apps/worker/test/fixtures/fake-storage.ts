/** The calls the stores make on a Durable Object's storage, over a Map. */
export class FakeStorage {
  readonly data = new Map<string, unknown>();
  async get(key: string) {
    return this.data.get(key);
  }
  async put(key: string | Record<string, unknown>, value?: unknown) {
    if (typeof key === 'string') this.data.set(key, value);
    else for (const [k, v] of Object.entries(key)) this.data.set(k, v);
  }
  async delete(keys: string | string[]) {
    for (const key of [keys].flat()) this.data.delete(key);
    return 0;
  }
  async list({ prefix = '', reverse = false }: { prefix?: string; reverse?: boolean } = {}) {
    const entries = [...this.data].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b));
    return new Map(reverse ? entries.reverse() : entries);
  }
}
