import { fetchAllMembers } from '@/lib/supabase/members'
import { fetchAllPasses } from '@/lib/supabase/passes'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { MembersTable } from './MembersTable'
import { MembersTabBar } from '@/components/MembersTabBar'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import { buildMemberStatusMap, buildMemberMetricsMap } from '@/lib/analytics/member-status'

export const dynamic = 'force-dynamic'

type ActivePassInfo = {
  passName: string
  passType: string | null
  startDate: string | null
  endDate: string | null
  totalCount: number | null
  remainingCount: number | null
  paidAt: string | null
}

export default async function MembersPage() {
  const today = new Date().toISOString().slice(0, 10)

  let members: Awaited<ReturnType<typeof fetchAllMembers>> = []
  let passes: Awaited<ReturnType<typeof fetchAllPasses>> = []
  const ownerId = await requireOwnerId().catch(() => 'no-auth')
  if (hasSupabaseConfig()) {
    try {
      ;[members, passes] = await Promise.all([fetchAllMembers(ownerId), fetchAllPasses(ownerId)])
    } catch {}
  }

  // 회원 상태 + 메트릭 계산
  const memberIds = members.map(m => m.id)
  const statusMap = buildMemberStatusMap(memberIds, passes, today)
  const metricsMap = buildMemberMetricsMap(memberIds, passes, today)

  // 가장 최근 active 패스 정보 (테이블 표시용)
  const activePassMap: Record<number, ActivePassInfo> = {}
  const tempMap = new Map<number, ActivePassInfo>()
  for (const p of passes) {
    if (p.status !== '이용중') continue
    const cur = tempMap.get(p.memberId)
    if (!cur || (p.paidAt ?? '') > (cur.paidAt ?? '')) {
      tempMap.set(p.memberId, {
        passName: p.passName,
        passType: p.passType,
        startDate: p.startDate,
        endDate: p.endDate,
        totalCount: p.totalCount,
        remainingCount: p.remainingCount,
        paidAt: p.paidAt,
      })
    }
  }
  for (const [id, info] of tempMap.entries()) activePassMap[id] = info

  // 상태별 카운트 (필터 버튼 라벨용)
  const statusCounts = { active: 0, expired: 0, no_pass: 0 }
  for (const s of statusMap.values()) statusCounts[s]++

  // 회원 객체에 status/metrics 첨부 (테이블에서 바로 필터링 가능하도록)
  const enriched = members.map(m => ({
    ...m,
    _status: statusMap.get(m.id) ?? 'no_pass' as const,
    _passType: metricsMap.get(m.id)?.passType ?? null,
    _remainingCount: metricsMap.get(m.id)?.remainingCount ?? null,
    _daysToExpire: metricsMap.get(m.id)?.daysToExpire ?? null,
  }))

  return (
    <div className="space-y-4">
      <MembersTabBar />
      {!hasSupabaseConfig() && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
          Supabase 미설정 — 환경변수 설정 후 회원 데이터가 표시됩니다.
        </div>
      )}
      <MembersTable
        members={enriched}
        statusCounts={statusCounts}
        activePassMap={activePassMap}
      />
    </div>
  )
}
