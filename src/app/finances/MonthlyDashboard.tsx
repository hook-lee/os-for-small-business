'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { MonthlySummary } from '@/lib/analytics/monthly-summary'
import { collectCostCategories } from '@/lib/analytics/monthly-summary'
import { MonthlyBarChart } from '@/components/Charts/MonthlyBarChartLazy'

export function MonthlyDashboard({
  allSummaries,
  initialMonth,
}: {
  allSummaries: MonthlySummary[]
  initialMonth: string
}) {
  const router = useRouter()
  const [ym, setYm] = useState(initialMonth)

  const summary = useMemo(
    () => allSummaries.find(s => s.yearMonth === ym) ?? {
      yearMonth: ym, revenue: 0,
      revenueByMethod: { card: 0, transfer: 0, cash: 0, other: 0 },
      revenueCountByMethod: { card: 0, transfer: 0, cash: 0, other: 0 },
      businessCosts: {},
      businessCostTotal: 0,
      operatingProfit: 0,
      personalCosts: {},
      personalCostTotal: 0,
      netProfit: 0,
      ownerDraw: 0,
      reserve: 0,
      otherCosts: 0,
      transactionCount: 0,
    },
    [allSummaries, ym],
  )

  // 패널에 표시할 카테고리 행 — 전체 월에서 실제 등장한 카테고리만 (하드코딩 X)
  const businessCats = useMemo(() => collectCostCategories(allSummaries, 'business'), [allSummaries])
  const personalCats = useMemo(() => collectCostCategories(allSummaries, 'personal'), [allSummaries])

  function changeMonth(newYm: string) {
    setYm(newYm)
    router.push(`/finances?ym=${newYm}`)
  }

  const revenueByMethodPct = summary.revenue > 0 ? {
    card: Math.round(summary.revenueByMethod.card / summary.revenue * 100),
    transfer: Math.round(summary.revenueByMethod.transfer / summary.revenue * 100),
    cash: Math.round(summary.revenueByMethod.cash / summary.revenue * 100),
  } : { card: 0, transfer: 0, cash: 0 }

  return (
    <div className="space-y-4">
      {/* 헤더 + 월 selector */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">월별 요약</h2>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={ym}
            min={allSummaries[0]?.yearMonth}
            max={allSummaries[allSummaries.length - 1]?.yearMonth}
            onChange={e => changeMonth(e.target.value)}
            className="border border-neutral-300 rounded px-2 py-1 text-sm"
          />
        </div>
      </div>

      {/* 상단 큰 지표 4개 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="매출" value={summary.revenue} highlight color="blue" />
        <Stat label="영업이익" value={summary.operatingProfit} highlight color="emerald" sub="= 매출 - 사업비" />
        <Stat label="순수익" value={summary.netProfit} highlight color="violet" sub="= 영업이익 - 개인비" />
        <Stat label="거래 건수" value={summary.transactionCount} suffix="건" />
      </div>

      {/* 결제수단별 매출 — 사용자가 '정말 중요'하다고 강조 */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-700">💳 결제수단별 매출</h3>
          <span className="text-xs text-neutral-400">{ym} 기준</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <MethodCard
            icon="💳" label="카드"
            amount={summary.revenueByMethod.card}
            count={summary.revenueCountByMethod.card}
            pct={revenueByMethodPct.card}
            color="blue"
          />
          <MethodCard
            icon="🏦" label="계좌이체"
            amount={summary.revenueByMethod.transfer}
            count={summary.revenueCountByMethod.transfer}
            pct={revenueByMethodPct.transfer}
            color="emerald"
          />
          <MethodCard
            icon="💵" label="현금"
            amount={summary.revenueByMethod.cash}
            count={summary.revenueCountByMethod.cash}
            pct={revenueByMethodPct.cash}
            color="amber"
          />
        </div>
        {summary.revenueByMethod.other > 0 && (
          <div className="mt-2 text-xs text-neutral-500">
            기타 결제수단: {summary.revenueByMethod.other.toLocaleString()}원 ({summary.revenueCountByMethod.other}건)
          </div>
        )}
      </Card>

      {/* 좌·우 패널 — Excel 우측 형태 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 사업 비용 */}
        <Card>
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">🏢 사업 비용</h3>
          <div className="space-y-1.5">
            {businessCats.length === 0 ? (
              <p className="text-xs text-neutral-400 py-2">아직 분류된 사업 비용이 없습니다.</p>
            ) : (
              businessCats.map(cat => (
                <Row key={cat} label={cat} value={summary.businessCosts[cat] ?? 0} />
              ))
            )}
            <div className="border-t border-neutral-200 pt-2 mt-2">
              <Row label="소계" value={summary.businessCostTotal} bold />
            </div>
          </div>
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded p-3">
            <div className="text-xs text-emerald-700 font-bold uppercase tracking-wider">영업이익 (사업소득)</div>
            <div className="text-lg sm:text-2xl font-bold text-emerald-900 tabular-nums mt-1 break-keep">
              {summary.operatingProfit.toLocaleString()}원
            </div>
            <div className="text-[10px] text-emerald-600 mt-0.5">매출 - 사업 비용</div>
          </div>
        </Card>

        {/* 개인 비용 */}
        <Card>
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">👤 개인 비용</h3>
          <div className="space-y-1.5">
            {personalCats.length === 0 ? (
              <p className="text-xs text-neutral-400 py-2">아직 분류된 개인 비용이 없습니다.</p>
            ) : (
              personalCats.map(cat => (
                <Row key={cat} label={cat} value={summary.personalCosts[cat] ?? 0} />
              ))
            )}
            <div className="border-t border-neutral-200 pt-2 mt-2">
              <Row label="소계" value={summary.personalCostTotal} bold />
            </div>
          </div>
          <div className="mt-4 bg-violet-50 border border-violet-200 rounded p-3">
            <div className="text-xs text-violet-700 font-bold uppercase tracking-wider">순수익 (잔고 변화)</div>
            <div className="text-lg sm:text-2xl font-bold text-violet-900 tabular-nums mt-1 break-keep">
              {summary.netProfit.toLocaleString()}원
            </div>
            <div className="text-[10px] text-violet-600 mt-0.5">영업이익 - 개인 비용</div>
          </div>
          {(summary.ownerDraw > 0 || summary.reserve > 0 || summary.otherCosts > 0) && (
            <div className="mt-3 pt-2 border-t border-neutral-100 space-y-0.5 text-xs text-neutral-500">
              <div className="text-[10px] text-neutral-400 mb-0.5">아래는 비용 합계에서 제외 (별도 항목)</div>
              {summary.ownerDraw > 0 && (
                <div className="flex items-center justify-between">
                  <span>대표 인출</span><span className="tabular-nums">-{summary.ownerDraw.toLocaleString()}원</span>
                </div>
              )}
              {summary.reserve > 0 && (
                <div className="flex items-center justify-between">
                  <span>세금 적립</span><span className="tabular-nums">-{summary.reserve.toLocaleString()}원</span>
                </div>
              )}
              {summary.otherCosts > 0 && (
                <div className="flex items-center justify-between">
                  <span>자산성 지출 <span className="text-[10px] text-neutral-400">(감가상각 대상)</span></span>
                  <span className="tabular-nums">-{summary.otherCosts.toLocaleString()}원</span>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* 월별 추이 */}
      {allSummaries.length > 1 && (
        <Card>
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">📈 월별 추이 (매출 / 영업이익 / 순수익)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MonthlyBarChart
              data={allSummaries.map(s => ({ month: s.yearMonth, amount: s.revenue }))}
              title="매출"
              color="#2563eb"
            />
            <MonthlyBarChart
              data={allSummaries.map(s => ({ month: s.yearMonth, amount: s.operatingProfit }))}
              title="영업이익"
              color="#10b981"
            />
            <MonthlyBarChart
              data={allSummaries.map(s => ({ month: s.yearMonth, amount: s.netProfit }))}
              title="순수익"
              color="#8b5cf6"
            />
          </div>
        </Card>
      )}

      <p className="text-xs text-neutral-400">
        💡 비용은 각 거래의 분류(사업/개인)에 따라 자동 집계됩니다. 대표 인출·세금 적립·자산성 지출은 비용 합계에서 제외돼요. 카테고리는 /settings · 카테고리 관리에서 직접 설계할 수 있습니다.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────
// 하위 컴포넌트
// ─────────────────────────────────────────────
function Stat({ label, value, sub, highlight, color, suffix = '원' }: {
  label: string
  value: number
  sub?: string
  highlight?: boolean
  color?: 'blue' | 'emerald' | 'violet'
  suffix?: string
}) {
  const colorClass = color === 'emerald' ? 'text-emerald-700'
    : color === 'violet' ? 'text-violet-700'
    : color === 'blue' ? 'text-blue-700'
    : 'text-neutral-800'
  return (
    <Card className={highlight ? 'border-2' : ''}>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`text-lg sm:text-xl md:text-2xl font-bold tabular-nums mt-1 break-keep ${colorClass}`}>
        {value.toLocaleString()}{suffix}
      </div>
      {sub && <div className="text-[10px] text-neutral-400 mt-0.5">{sub}</div>}
    </Card>
  )
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${bold ? 'font-bold' : ''}`}>
      <span className={bold ? 'text-neutral-800' : 'text-neutral-600'}>{label}</span>
      <span className={`tabular-nums ${value === 0 ? 'text-neutral-300' : 'text-neutral-800'}`}>
        {value === 0 ? '-' : `${value.toLocaleString()}원`}
      </span>
    </div>
  )
}

function MethodCard({ icon, label, amount, count, pct, color }: {
  icon: string
  label: string
  amount: number
  count: number
  pct: number
  color: 'blue' | 'emerald' | 'amber'
}) {
  const bgClass = color === 'blue' ? 'bg-blue-50 border-blue-200'
    : color === 'emerald' ? 'bg-emerald-50 border-emerald-200'
    : 'bg-amber-50 border-amber-200'
  const textClass = color === 'blue' ? 'text-blue-700'
    : color === 'emerald' ? 'text-emerald-700'
    : 'text-amber-700'
  const barClass = color === 'blue' ? 'bg-blue-500'
    : color === 'emerald' ? 'bg-emerald-500'
    : 'bg-amber-500'
  return (
    <div className={`rounded-lg border p-2.5 sm:p-3 ${bgClass}`}>
      <div className="flex items-baseline justify-between gap-1 flex-wrap">
        <span className="text-xs sm:text-sm font-semibold break-keep">{icon} {label}</span>
        <span className={`text-xs font-bold ${textClass}`}>{pct}%</span>
      </div>
      <div className="text-sm sm:text-lg font-bold tabular-nums mt-1 text-neutral-800 break-keep">
        {amount.toLocaleString()}원
      </div>
      <div className="text-[10px] text-neutral-500">{count}건</div>
      <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
        <div className={`h-full ${barClass} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
