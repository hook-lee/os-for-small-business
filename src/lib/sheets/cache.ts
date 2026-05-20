export interface CacheConfig<T> {
  ttlMs: number
  fetcher: () => Promise<T>
}

export interface Cache<T> {
  get(): Promise<T>
  invalidate(): void
}

export function createCache<T>(config: CacheConfig<T>): Cache<T> {
  let cached: { value: T; expiresAt: number } | null = null
  return {
    async get() {
      if (cached && Date.now() < cached.expiresAt) return cached.value
      const value = await config.fetcher()
      cached = { value, expiresAt: Date.now() + config.ttlMs }
      return value
    },
    invalidate() { cached = null },
  }
}
