export type CacheValue<T> = { value: T; expiresAt: number; source: string };

export class MemoryTtlCache<T> {
  private items = new Map<string, CacheValue<T>>();
  constructor(private readonly defaultTtlMs: number) {}

  get(key: string) {
    const item = this.items.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) return null;
    return item.value;
  }

  getStale(key: string) {
    return this.items.get(key)?.value || null;
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs, source = 'memory-cache') {
    this.items.set(key, { value, expiresAt: Date.now() + ttlMs, source });
    return value;
  }

  delete(key: string) { return this.items.delete(key); }
  clear() { this.items.clear(); }
}
