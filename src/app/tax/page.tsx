import { loadTransactions } from '@/lib/data/loader'
import { loadProfile } from '@/lib/profile/settings'
import { simulateVAT, type Quarter } from '@/lib/tax/vat'
import { simulateIncomeTax } from '@/lib/tax/income-tax'
import { Card } from '@/components/ui/Card'
import { KpiCard } from '@/components/ui/KpiCard'
import { FinancesTabBar } from '@/components/FinancesTabBar'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import {
  TAX_PERIODS,
  SIMPLIFIED_THRESHOLD,
  checkSimplifiedEligibility,
  computeQuarterlyVATHistory,
  extractActualTaxes,
  aggregateTaxesByMonth,
} from '@/lib/analytics/tax-history'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export default async function TaxPage() {
  const ownerId = await requireOwnerId().catch(() => 'no-auth')
  const [transactions, profile] = await Promise.all([loadTransactions(ownerId), loadProfile(ownerId)])
  const today = new Date().toISOString().slice(0, 10)
  const year = parseInt(today.slice(0, 4), 10)

  // === 신규 분석 ===
  const eligibility = checkSimplifiedEligibility(transactions, today.slice(0, 7))
  const quarterlyVAT = computeQuarterlyVATHistory(transactions)
  const actualTaxes = extractActualTaxes(transactions)
  const taxesByMonth = aggregateTaxesByMonth(actualTaxes)

  // 세금 종류별 합계
  const taxByCategory: Record<string, number> = {}
  for (const t of actualTaxes) {
    taxByCategory[t.category] = (taxByCategory[t.category] ?? 0) + t.amount
  }
  const totalActualTax = actualTaxes.reduce((s, t) => s + t.amount, 0)

  // === 기존 simulator ===
  const vatByQuarter = [1, 2, 3, 4].map(q => simulateVAT(transactions, year, q as Quarter, { taxPayerType: profile.taxPayerType ?? 'general' }))
  const annualVAT = vatByQuarter.reduce((sum, v) => sum + Math.max(0, v.estimatedVAT), 0)
  const incomeTax = simulateIncomeTax(transactions, today, {
    noranusanContribution: profile.noranusanAnnualContribution,
    pensionSavings: profile.pensionAnnualContribution,
    youngStartupReduction: profile.isYoungStartupEligible ? profile.youngStartupReductionRate : 0,
  })

  const eligibilityPct = Math.min(100, Math.round(eligibility.rollingRevenue / SIMPLIFIED_THRESHOLD * 100))

  return (
    <div className="space-y-6">
      <FinancesTabBar />

      {/* === 1. 사업자 유형 타임라인 === */}
      <section>
        <h2 className="text-lg font-semibold mb-3">📅 사업자 유형 타임라인</h2>
        <Card>
          <div className="space-y-2">
            {TAX_PERIODS.map(p => (
              <div key={p.start} className="flex items-center gap-3 text-sm">
                <div className={`w-2 h-12 rounded ${p.type === 'simplified' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                <div className="flex-1">
                  <div className="font-semibold">
                    {p.start} ~ {p.end}
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                      p.type === 'simplified' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {p.type === 'simplified' ? '간이과세자' : '일반과세자'}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">{p.monthCount}개월</div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 text-sm pt-2 border-t border-neutral-200">
              <div className="w-2 h-12 rounded bg-amber-400" />
              <div className="flex-1">
                <div className="font-semibold">
                  2026-07 ~
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                    간이 전환 조건부
                  </span>
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  직전 1년 매출 &lt; 1억800만원 시 간이과세자 전환 가능
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* === 2. 간이 전환 조건 모니터링 === */}
      <section>
        <h2 className="text-lg font-semibold mb-3">🎯 간이 전환 조건 모니터링</h2>
        <Card>
          <div className="flex items-baseline justify-between mb-2">
            <div>
              <div className="text-xs text-neutral-500">직전 1년({eligibility.asOfMonth} 기준) 매출</div>
              <div className="text-3xl font-bold tabular-nums text-neutral-800 mt-1">
                {eligibility.rollingRevenue.toLocaleString()}원
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-neutral-500">간이 전환 기준</div>
              <div className="text-lg font-semibold text-neutral-600 tabular-nums">
                {SIMPLIFIED_THRESHOLD.toLocaleString()}원
              </div>
            </div>
          </div>
          <div className="h-4 bg-neutral-100 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full transition-all ${eligibility.isEligible ? 'bg-emerald-500' : 'bg-red-500'}`}
              style={{ width: `${eligibilityPct}%` }}
            />
          </div>
          <div className={`text-sm font-medium ${eligibility.isEligible ? 'text-emerald-700' : 'text-red-700'}`}>
            {eligibility.isEligible
              ? `✓ 1억800만 미만 · 26-07부터 간이 전환 가능 (여유: ${eligibility.remainingMargin.toLocaleString()}원)`
              : `⚠ 1억800만 초과 · 일반 유지 필요 (${(-eligibility.remainingMargin).toLocaleString()}원 초과)`}
          </div>
          <p className="text-xs text-neutral-400 mt-3">
            💡 간이과세자: 매출×30%×10% = 매출의 3% 부가세. 일반: 매출세액 - 매입세액. 운영자가 한 해 결정할 수 있는 '구조적' 절세 옵션.
          </p>
        </Card>
      </section>

      {/* === 3. 분기별 부가세 추이 === */}
      <section>
        <h2 className="text-lg font-semibold mb-3">📊 분기별 부가세 추이 (실측 vs 추정)</h2>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs text-neutral-500 uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">분기</th>
                  <th className="text-right px-4 py-2 font-medium">매출</th>
                  <th className="text-center px-4 py-2 font-medium">유형</th>
                  <th className="text-right px-4 py-2 font-medium">추정 부가세</th>
                  <th className="text-right px-4 py-2 font-medium">매출 대비</th>
                </tr>
              </thead>
              <tbody>
                {quarterlyVAT.map(q => {
                  const ratio = q.revenue > 0 ? (q.estimatedVAT / q.revenue * 100).toFixed(2) : '0'
                  return (
                    <tr key={q.quarter} className="border-t border-neutral-100">
                      <td className="px-4 py-2 font-medium">{q.quarter}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{q.revenue.toLocaleString()}원</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          q.type === 'simplified' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {q.type === 'simplified' ? '간이' : '일반'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">
                        {q.estimatedVAT.toLocaleString()}원
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-neutral-500 tabular-nums">{ratio}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* === 4. 과거 실제 세금 === */}
      {actualTaxes.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">💰 과거 납부 세금 (실측)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <KpiCard title="총 납부 세금" amount={totalActualTax} subtitle={`${actualTaxes.length}건`} />
            {Object.entries(taxByCategory).map(([cat, amt]) => (
              <KpiCard key={cat} title={cat} amount={amt} />
            ))}
          </div>
          <Card className="p-0 overflow-hidden">
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-neutral-50 text-neutral-500 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">월</th>
                    {Object.keys(taxByCategory).map(c => (
                      <th key={c} className="text-right px-3 py-2 font-medium">{c}</th>
                    ))}
                    <th className="text-right px-3 py-2 font-medium">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {taxesByMonth.map(m => (
                    <tr key={m.yearMonth} className="border-t border-neutral-100">
                      <td className="px-3 py-2 font-medium">{m.yearMonth}</td>
                      {Object.keys(taxByCategory).map(c => (
                        <td key={c} className="px-3 py-2 text-right tabular-nums text-neutral-600">
                          {m.byCategory[c] ? `${m.byCategory[c].toLocaleString()}원` : '-'}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {m.total.toLocaleString()}원
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      {/* === 5. 기존 simulator === */}
      <section>
        <h2 className="text-lg font-semibold mb-3">🔮 부가세 시뮬레이터 ({year}년, 분기별)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {vatByQuarter.map(v => (
            <KpiCard
              key={v.quarter}
              title={`${v.quarter}분기`}
              amount={v.estimatedVAT}
              subtitle={`거래 ${v.transactionCount}건`}
            />
          ))}
        </div>
        <div className="mt-3">
          <KpiCard title={`${year}년 부가세 합계 (예상)`} amount={annualVAT} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">🔮 종합소득세 시뮬레이터 (연환산)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard title="연환산 매출" amount={incomeTax.annualizedRevenue} />
          <KpiCard title="필요경비" amount={-incomeTax.annualizedExpense} />
          <KpiCard title="사업소득금액" amount={incomeTax.businessIncome} />
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <KpiCard title="과세표준" amount={incomeTax.taxableBase} />
          <KpiCard title={`${year}년 5월 예상 납부액`} amount={incomeTax.estimatedTax} />
        </div>
        <Card className="mt-3">
          <div className="text-xs text-neutral-500">
            {profile.isYoungStartupEligible
              ? `* 청년창업감면 ${(profile.youngStartupReductionRate * 100).toFixed(0)}% 적용됨`
              : '* 청년창업감면 미적용 — /settings에서 토글 가능'}
            {profile.noranusanAnnualContribution > 0 && ` · 노란우산 ${(profile.noranusanAnnualContribution / 10_000).toFixed(0)}만원 적용`}
            {profile.pensionAnnualContribution > 0 && ` · 연금저축 ${(profile.pensionAnnualContribution / 10_000).toFixed(0)}만원 적용`}
          </div>
        </Card>
      </section>
    </div>
  )
}
