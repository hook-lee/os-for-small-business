import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCache } from '@/lib/sheets/cache'

describe('createCache', () => {
  beforeEach(() => { vi.useFakeTimers() })

  it('첫 호출 시 fetcher 호출, 결과 반환', async () => {
    const fetcher = vi.fn().mockResolvedValue([['a', 'b']])
    const cache = createCache({ ttlMs: 5 * 60 * 1000, fetcher })
    expect(await cache.get()).toEqual([['a', 'b']])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('TTL 안: 캐시 사용, fetcher 1번만', async () => {
    const fetcher = vi.fn().mockResolvedValue([['a']])
    const cache = createCache({ ttlMs: 5 * 60 * 1000, fetcher })
    await cache.get()
    await cache.get()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('TTL 만료 후 fetcher 재호출', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce([['a']]).mockResolvedValueOnce([['b']])
    const cache = createCache({ ttlMs: 1000, fetcher })
    const r1 = await cache.get()
    vi.advanceTimersByTime(2000)
    const r2 = await cache.get()
    expect(r1).toEqual([['a']])
    expect(r2).toEqual([['b']])
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('invalidate() 후 다음 get은 fetcher 호출', async () => {
    const fetcher = vi.fn().mockResolvedValue([['a']])
    const cache = createCache({ ttlMs: 60_000, fetcher })
    await cache.get()
    cache.invalidate()
    await cache.get()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
