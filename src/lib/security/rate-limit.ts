/**
 * 간단한 in-memory rate limiter.
 *
 * 한계:
 * - Vercel serverless는 instance마다 메모리 분리 → best-effort
 * - 진짜 강한 보호 원하면 Upstash Redis 등 외부 store 필요
 * - 그래도 단일 instance 내에서는 동작 → 일반 abuse 완화
 *
 * 사용:
 *   const ok = checkRateLimit(`chat:${ownerId}`, 10, 60_000)
 *   if (!ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
 */

interface Bucket {
  timestamps: number[]
}

const buckets = new Map<string, Bucket>()

// 메모리 누수 방지 — 1시간마다 오래된 키 정리
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 60 * 60 * 1000  // 1시간
const STALE_THRESHOLD = 10 * 60 * 1000   // 10분

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, bucket] of buckets) {
    const fresh = bucket.timestamps.filter(t => now - t < STALE_THRESHOLD)
    if (fresh.length === 0) buckets.delete(key)
    else bucket.timestamps = fresh
  }
}

/**
 * @param key  사용자별 키 (예: 'chat:userId123')
 * @param max  허용 호출 수
 * @param windowMs 시간 윈도우 (밀리초)
 * @returns true = 허용, false = 제한 초과
 */
export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  cleanup()
  const now = Date.now()
  const bucket = buckets.get(key) ?? { timestamps: [] }
  // window 내 호출만 유지
  bucket.timestamps = bucket.timestamps.filter(t => now - t < windowMs)
  if (bucket.timestamps.length >= max) {
    return false
  }
  bucket.timestamps.push(now)
  buckets.set(key, bucket)
  return true
}

/**
 * 디버깅용: 현재 bucket 통계
 */
export function rateLimitStats(): { bucketCount: number; totalEntries: number } {
  let total = 0
  for (const b of buckets.values()) total += b.timestamps.length
  return { bucketCount: buckets.size, totalEntries: total }
}
