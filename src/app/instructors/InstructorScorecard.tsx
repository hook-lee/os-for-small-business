'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { InstructorScorecardRow } from '@/lib/analytics/instructor-scorecard'
import { PERIOD_LABELS, type PeriodKey } from '@/lib/analytics/period'

const PERIOD_ORDER: PeriodKey[] = ['month', 'quarter', 'year', 'all']

// 정렬 가능한 숫자 컬럼 정의
type SortKey =
  | 'revenue' | 'newMembers' | 'reregistrationCount'
  | 'trialConversionRate' | 'reregistrationRate' | 'activeMembers' | 'closureRate'

interface ColDef {
  key: SortKey
  label: string
  scope: '기간' | '누적' | '현재'
  value: (r: InstructorScorecardRow) => number
  render: (r: InstructorScorecardRow) => string
  lowerIsBetter?: boolean   // 폐강률처럼 낮을수록 좋은 지표 → 색 강조 반전
}

function manwon(won: number): string {
  if (won === 0) return '0'
  if (Math.abs(won) >= 10_000) return `${Math.round(won / 10_000).toLocaleString()}만`
  return won.toLocaleString()
}

const COLS: ColDef[] = [
  { key: 'revenue', label: '매출', scope: '기간', value: r => r.revenue, render: r => `${manwon(r.revenue)}원` },
  { key: 'newMembers', label: '신규', scope: '기간', value: r => r.newMembers, render: r => `${r.newMembers}명` },
  { key: 'reregistrationCount', label: '재등록', scope: '기간', value: r => r.reregistrationCount, render: r => `${r.reregistrationCount}건` },
  { key: 'trialConversionRate', label: '전환율', scope: '누적', value: r => r.trialConversionRate, render: r => `${(r.trialConversionRate * 100).toFixed(0)}%` },
  { key: 'reregistrationRate', label: '재등록률', scope: '누적', value: r => r.reregistrationRate, render: r => `${(r.reregistrationRate * 100).toFixed(0)}%` },
  { key: 'activeMembers', label: '활성', scope: '현재', value: r => r.activeMembers, render: r => `${r.activeMembers}명` },
  { key: 'closureRate', label: '폐강률', scope: '기간', value: r => r.closureRate, render: r => (r.groupTotal === 0 ? '—' : `${(r.closureRate * 100).toFixed(0)}%`), lowerIsBetter: true },
]

function roleLabel(role: InstructorScorecardRow['role']): string | null {
  if (role === 'owner') return '오너'
  if (role === 'admin') return '관리자'
  return null
}

function incentiveText(inc: InstructorScorecardRow['incentive']): string {
  if (!inc.hasAny) return '미설정'
  const { perSessionMin, perSessionMax, memberCount } = inc
  const amount = perSessionMin === perSessionMax
    ? `회당 ${(perSessionMin ?? 0).toLocaleString()}원`
    : `회당 ${(perSessionMin ?? 0).toLocaleString()}~${(perSessionMax ?? 0).toLocaleString()}원`
  return `${amount} · ${memberCount}명`
}

export function InstructorScorecard({ rows, periodKey }: { rows: InstructorScorecardRow[]; periodKey: PeriodKey }) {
  const router = useRouter()
  const [sortKey, setSortKey] = useState<SortKey>('revenue')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  const sorted = useMemo(() => {
    const col = COLS.find(c => c.key === sortKey)!
    return [...rows].sort((a, b) => {
      const diff = col.value(b) - col.value(a)
      return sortDir === 'desc' ? diff : -diff
    })
  }, [rows, sortKey, sortDir])

  // 현재 정렬 컬럼의 최고/최저값 (상·하위 색 강조용). 값이 모두 같으면 강조 안 함.
  const { hi, lo } = useMemo(() => {
    const col = COLS.find(c => c.key === sortKey)!
    const vals = rows.map(col.value)
    const max = Math.max(...vals)
    const min = Math.min(...vals)
    return { hi: max, lo: min }
  }, [rows, sortKey])
  const highlightActive = rows.length > 1 && hi !== lo

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function changePeriod(key: PeriodKey) {
    router.push(`/instructors?tab=scorecard&period=${key}`)
  }

  const sortedCol = COLS.find(c => c.key === sortKey)!
  // 폐강률처럼 '낮을수록 좋은' 지표면 best=최소·worst=최대로 색을 뒤집는다.
  const best = sortedCol.lowerIsBetter ? lo : hi
  const worst = sortedCol.lowerIsBetter ? hi : lo

  return (
    <div className="space-y-3">
      {/* 기간 토글 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-neutral-500">기간</span>
        <div className="inline-flex rounded-lg border border-neutral-200 overflow-hidden">
          {PERIOD_ORDER.map(key => (
            <button
              key={key}
              onClick={() => changePeriod(key)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                key === periodKey
                  ? 'bg-blue-600 text-white font-medium'
                  : 'bg-white text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {PERIOD_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {/* 모바일 — 정렬 컨트롤 + 카드 (가로 스크롤 없이) */}
      <div className="md:hidden space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500 shrink-0">정렬</span>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="flex-1 min-w-0 border border-neutral-300 rounded px-2 py-1.5 text-sm bg-white"
          >
            {COLS.map(col => (
              <option key={col.key} value={col.key}>{col.label} ({col.scope})</option>
            ))}
          </select>
          <button
            onClick={() => setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))}
            className="shrink-0 border border-neutral-300 rounded px-3 py-1.5 text-sm tabular-nums"
            title="정렬 방향"
          >
            {sortDir === 'desc' ? '높은순 ↓' : '낮은순 ↑'}
          </button>
        </div>

        {sorted.length === 0 && (
          <Card className="p-6 text-center text-sm text-neutral-400">표시할 강사 데이터가 없습니다.</Card>
        )}
        {sorted.map(r => {
          const sortVal = sortedCol.value(r)
          const accent = highlightActive && sortVal === best
            ? 'border-green-300 bg-green-50/40'
            : highlightActive && sortVal === worst
              ? 'border-amber-300 bg-amber-50/30'
              : 'border-neutral-200'
          const rl = roleLabel(r.role)
          return (
            <Card key={r.instructorId} className={`p-3 border ${accent}`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {r.color && <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />}
                  <a href={`/instructors/${r.instructorId}`} className="font-semibold text-blue-600 hover:underline truncate">{r.instructorName}</a>
                  {rl && <span className="text-[10px] text-neutral-400 border border-neutral-200 rounded px-1 shrink-0">{rl}</span>}
                </div>
                <a
                  href={`/instructors/${r.instructorId}`}
                  className="text-[11px] shrink-0 hover:underline"
                  title="회원별 인센티브 설정"
                >
                  {r.incentive.hasAny
                    ? <span className="text-neutral-500">{incentiveText(r.incentive)}</span>
                    : <span className="text-amber-600">⚠ 인센티브 설정 →</span>}
                </a>
              </div>
              <div className="grid grid-cols-3 gap-x-2 gap-y-2.5">
                {COLS.map(col => {
                  const isSorted = col.key === sortKey
                  const v = col.value(r)
                  const cellAccent = isSorted && highlightActive
                    ? (v === best ? 'text-green-700' : v === worst ? 'text-amber-700' : 'text-neutral-800')
                    : 'text-neutral-800'
                  const sub = col.key === 'trialConversionRate' && r.trialMemberCount > 0
                    ? `체험 ${r.trialMemberCount}→${r.convertedMemberCount}`
                    : col.key === 'closureRate' && r.groupTotal > 0
                      ? `${r.groupClosed}/${r.groupTotal} 폐강`
                      : null
                  return (
                    <div key={col.key} className={`min-w-0 ${isSorted ? 'rounded-md bg-blue-50/60 -mx-0.5 px-1.5 py-0.5' : ''}`}>
                      <div className="text-[10px] text-neutral-400 leading-tight">
                        {col.label} <span className="text-neutral-300">{col.scope}</span>
                      </div>
                      <div className={`text-sm font-semibold tabular-nums break-keep ${cellAccent}`}>{col.render(r)}</div>
                      {sub && <div className="text-[9px] text-neutral-400 leading-tight">{sub}</div>}
                    </div>
                  )
                })}
              </div>
            </Card>
          )
        })}
      </div>

      {/* PC — 정렬 가능한 표 */}
      <Card className="hidden md:block p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium whitespace-nowrap">강사</th>
                {COLS.map(col => (
                  <th
                    key={col.key}
                    className="text-right px-4 py-2 font-medium whitespace-nowrap cursor-pointer select-none hover:text-neutral-800"
                    onClick={() => toggleSort(col.key)}
                    title="클릭하여 정렬"
                  >
                    <span className={col.key === sortKey ? 'text-blue-600' : ''}>
                      {col.label}{col.key === sortKey ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                    </span>
                    <div className="text-[10px] font-normal text-neutral-400">{col.scope}</div>
                  </th>
                ))}
                <th className="text-right px-4 py-2 font-medium whitespace-nowrap">
                  인센티브
                  <div className="text-[10px] font-normal text-neutral-400">현재</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const sortVal = sortedCol.value(r)
                const rowAccent = highlightActive && sortVal === best
                  ? 'bg-green-50/50'
                  : highlightActive && sortVal === worst
                    ? 'bg-amber-50/40'
                    : ''
                const rl = roleLabel(r.role)
                return (
                  <tr key={r.instructorId} className={`border-t border-neutral-100 hover:bg-neutral-50/50 ${rowAccent}`}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {r.color && <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />}
                        <a href={`/instructors/${r.instructorId}`} className="font-medium text-blue-600 hover:underline">{r.instructorName}</a>
                        {rl && <span className="text-[10px] text-neutral-400 border border-neutral-200 rounded px-1">{rl}</span>}
                      </div>
                    </td>
                    {COLS.map(col => {
                      const isSorted = col.key === sortKey
                      const v = col.value(r)
                      const cellAccent = isSorted && highlightActive
                        ? (v === best ? 'text-green-700 font-semibold' : v === worst ? 'text-amber-700' : '')
                        : ''
                      // 전환율은 분모 노출(체험 N명)로 0% 오해 방지 / 폐강률은 N/M 노출
                      const sub = col.key === 'trialConversionRate' && r.trialMemberCount > 0
                        ? `체험 ${r.trialMemberCount}→${r.convertedMemberCount}`
                        : col.key === 'closureRate' && r.groupTotal > 0
                          ? `${r.groupClosed}/${r.groupTotal} 폐강`
                          : null
                      return (
                        <td key={col.key} className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                          <span className={cellAccent}>{col.render(r)}</span>
                          {sub && <div className="text-[10px] text-neutral-400">{sub}</div>}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      <a
                        href={`/instructors/${r.instructorId}`}
                        title="클릭하면 이 강사 회원별 인센티브를 설정할 수 있어요"
                        className="hover:underline"
                      >
                        {r.incentive.hasAny ? (
                          <span className="text-neutral-700">{incentiveText(r.incentive)}</span>
                        ) : (
                          <span className="text-amber-600 text-xs">⚠ 미설정 · 설정하기 →</span>
                        )}
                      </a>
                    </td>
                  </tr>
                )
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={COLS.length + 2} className="px-4 py-8 text-center text-neutral-400 text-sm">
                    표시할 강사 데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-[11px] text-neutral-400 leading-relaxed space-y-0.5">
        <p>※ <b>매출·신규·재등록</b>은 선택한 <b>기간</b> 기준(결제일). 매출은 그 강사에게 귀속된 수강권 결제액입니다(스튜디오 전체 매출과 다름).</p>
        <p>※ <b>전환율·재등록률</b>은 누적(전체 기간) 기준 — 체험→정회원은 시차가 커서 짧은 기간은 오해를 줄 수 있어 누적으로 고정했습니다.</p>
        <p>※ <b>활성</b>은 현재 이용중 수강권 보유 회원(시점 스냅샷). <b>인센티브</b>는 현재 설정된 회당 금액·대상 회원 수입니다.</p>
        <p>※ <b>폐강률</b>(기간) = 인원 부족으로 취소(폐강)된 그룹 수업 ÷ 개설한 그룹 수업. <b>낮을수록 좋음</b>(0%면 수요가 많다는 신호). 그룹 수업 취소 시 사유를 «인원 부족»으로 선택하면 폐강으로 집계됩니다. 그룹 수업이 없으면 «—».</p>
      </div>
    </div>
  )
}
