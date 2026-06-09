import { loadTransactions } from '@/lib/data/loader'
import { loadProfile } from '@/lib/profile/settings'
import { simulateVAT, simulateAnnualVAT, type Quarter } from '@/lib/tax/vat'
import { simulateIncomeTax } from '@/lib/tax/income-tax'
import { Card } from '@/components/ui/Card'
import { KpiCard } from '@/components/ui/KpiCard'
import { FinancesTabBar } from '@/components/FinancesTabBar'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import {
  buildTaxPeriods,
  SIMPLIFIED_THRESHOLD,
  checkSimplifiedEligibility,
  computeQuarterlyVATHistory,
  extractActualTaxes,
  aggregateTaxesByMonth,
} from '@/lib/analytics/tax-history'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export default async function TaxPage() {
  await import('@/lib/supabase/guard').then(m => m.guardManagerPage())
  const ownerId = await requireOwnerId().catch(() => 'no-auth')
  const [transactions, profile] = await Promise.all([loadTransactions(ownerId), loadProfile(ownerId)])
  const today = new Date().toISOString().slice(0, 10)
  const year = parseInt(today.slice(0, 4), 10)

  // === 과세 유형 타임라인 (원장 프로필 기반 — 하드코딩 X) ===
  const txMonths = transactions.map(t => t.date.slice(0, 7)).filter(Boolean)
  const firstTxMonth = txMonths.length ? txMonths.reduce((a, b) => (a < b ? a : b)) : null
  const taxPeriods = buildTaxPeriods({
    startMonth: profile.taxStartMonth,
    currentType: profile.taxPayerType ?? 'simplified',
    generalSinceMonth: profile.taxGeneralSinceMonth,
    fallbackStartMonth: firstTxMonth,
    asOfMonth: today.slice(0, 7),
  })
  const currentTaxType = taxPeriods[taxPeriods.length - 1]?.type ?? profile.taxPayerType ?? 'simplified'

  // === 신규 분석 ===
  const eligibility = checkSimplifiedEligibility(transactions, today.slice(0, 7))
  const quarterlyVAT = computeQuarterlyVATHistory(transactions, taxPeriods)
  const actualTaxes = extractActualTaxes(transactions)
  const taxesByMonth = aggregateTaxesByMonth(actualTaxes)

  // 세금 종류별 합계
  const taxByCategory: Record<string, number> = {}
  for (const t of actualTaxes) {
    taxByCategory[t.category] = (taxByCategory[t.category] ?? 0) + t.amount
  }
  const totalActualTax = actualTaxes.reduce((s, t) => s + t.amount, 0)

  // === 부가세 시뮬레이터 — 연 단위 단일 소스 + (일반과세자만) 분기 breakdown ===
  // currentTaxType: 타임라인 기준 현재 과세 유형. 간이는 분기 신고 개념이 없어 연 단위로만 표시.
  const annualVATResult = simulateAnnualVAT(transactions, year, today, { taxPayerType: currentTaxType })
  const vatByQuarter = [1, 2, 3, 4].map(q => simulateVAT(transactions, year, q as Quarter, { taxPayerType: currentTaxType }))
  const currentQuarterNum = Math.ceil((parseInt(today.slice(5, 7), 10)) / 3)

  const incomeTax = simulateIncomeTax(transactions, today, {
    personalDeductionCount: profile.personalDeductionCount,
    noranusanContribution: profile.noranusanAnnualContribution,
    pensionSavings: profile.pensionAnnualContribution,
    youngStartupReduction: profile.isYoungStartupEligible ? profile.youngStartupReductionRate : 0,
  })

  const eligibilityPct = Math.min(100, Math.round(eligibility.rollingRevenue / SIMPLIFIED_THRESHOLD * 100))

  // 간이 전환 조건 모니터링 — 현재 과세 유형에 따라 의미·문구가 갈린다.
  //  · 간이과세자: 1억400만 '이상'이면 다음 과세기간(7월)부터 일반으로 강제 전환 → 임계점 감시.
  //  · 일반과세자: 1억400만 '미만'이면 다음 7월부터 간이로 복귀 가능 → 복귀 가능 여부 감시.
  const isSimplifiedNow = currentTaxType === 'simplified'
  const underThreshold = eligibility.isEligible // 직전 1년 매출 < 기준
  const marginText = eligibility.remainingMargin.toLocaleString()
  const overText = (-eligibility.remainingMargin).toLocaleString()
  const thresholdManwon = '1억400만'
  const monitorTitle = isSimplifiedNow ? '🎯 일반 전환 모니터링 (간이 유지 조건)' : '🎯 간이 전환 모니터링 (간이 복귀 조건)'
  const monitorThresholdLabel = isSimplifiedNow ? '강제 일반 전환 기준' : '간이 전환 기준'
  const monitorMessage = isSimplifiedNow
    ? (underThreshold
        ? `✓ 간이과세자 유지 — 직전 1년 매출이 ${thresholdManwon}원 미만이라 일반 전환 대상 아님 (여유: ${marginText}원)`
        : `⚠ ${thresholdManwon}원 초과 — 다음 과세기간(7월)부터 일반과세자로 자동 전환 (${overText}원 초과)`)
    : (underThreshold
        ? `✓ ${thresholdManwon}원 미만 · 다음 7월부터 간이 전환 가능 (여유: ${marginText}원)`
        : `⚠ ${thresholdManwon}원 초과 · 일반과세자 유지 (${overText}원 초과)`)
  // 색: 간이는 '미만=안전(green)', 일반은 '미만=간이복귀가능(green)' → 둘 다 underThreshold=green
  const monitorGood = underThreshold

  return (
    <div className="space-y-6">
      <FinancesTabBar />

      {/* === 1. 사업자 유형 타임라인 === */}
      <section>
        <h2 className="text-lg font-semibold mb-3">📅 사업자 유형 타임라인</h2>
        <Card>
          <div className="space-y-2">
            {taxPeriods.map(p => (
              <div key={p.start} className="flex items-center gap-3 text-sm">
                <div className={`w-2 h-12 rounded ${p.type === 'simplified' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                <div className="flex-1">
                  <div className="font-semibold">
                    {p.start} ~ {p.ongoing ? '현재' : p.end}
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                      p.type === 'simplified' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {p.type === 'simplified' ? '간이과세자' : '일반과세자'}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">{p.monthCount}개월{p.ongoing ? ' (진행 중)' : ''}</div>
                </div>
              </div>
            ))}
            {currentTaxType === 'general' && (
              <div className="flex items-center gap-3 text-sm pt-2 border-t border-neutral-200">
                <div className="w-2 h-12 rounded bg-amber-400" />
                <div className="flex-1">
                  <div className="font-semibold">
                    간이 전환 (조건부)
                    <span className="ml-2 text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                      매년 7월 재판정
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    직전 1년 매출 &lt; 1억400만원이면 다음 과세기간(7월)부터 간이과세자 전환 가능
                  </div>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-neutral-400 mt-3">
            💡 이 타임라인은 /settings의 사업 개시 연월·과세 유형·일반 전환 시점으로 자동 생성됩니다.
          </p>
        </Card>
      </section>

      {/* === 2. 간이 전환 조건 모니터링 === */}
      <section>
        <h2 className="text-lg font-semibold mb-3">{monitorTitle}</h2>
        <Card>
          <div className="flex items-baseline justify-between mb-2">
            <div>
              <div className="text-xs text-neutral-500">직전 1년({eligibility.asOfMonth} 기준) 매출</div>
              <div className="text-xl sm:text-2xl font-bold tabular-nums tracking-tight text-neutral-800 mt-1 break-keep">
                {eligibility.rollingRevenue.toLocaleString()}원
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-neutral-500">{monitorThresholdLabel}</div>
              <div className="text-lg font-semibold text-neutral-600 tabular-nums">
                {SIMPLIFIED_THRESHOLD.toLocaleString()}원
              </div>
            </div>
          </div>
          <div className="h-4 bg-neutral-100 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full transition-all ${monitorGood ? 'bg-emerald-500' : 'bg-red-500'}`}
              style={{ width: `${eligibilityPct}%` }}
            />
          </div>
          <div className={`text-sm font-medium ${monitorGood ? 'text-emerald-700' : 'text-red-700'}`}>
            {monitorMessage}
          </div>
          <p className="text-xs text-neutral-400 mt-3">
            💡 간이과세자: 매출×30%×10% = 매출의 3% 부가세. 일반: 매출세액 - 매입세액. 운영자가 한 해 결정할 수 있는 '구조적' 절세 옵션.
          </p>
        </Card>
      </section>

      {/* === 3. 분기별 부가세 추이 === */}
      <section>
        <h2 className="text-lg font-semibold mb-3">📊 분기별 매출·부가세 추이</h2>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs text-neutral-500 uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium whitespace-nowrap">분기</th>
                  <th className="text-right px-4 py-2 font-medium whitespace-nowrap">매출</th>
                  <th className="text-center px-4 py-2 font-medium whitespace-nowrap">유형</th>
                  <th className="text-center px-4 py-2 font-medium whitespace-nowrap">상태</th>
                  <th className="text-right px-4 py-2 font-medium whitespace-nowrap">부가세 (매출 기준)</th>
                  <th className="text-right px-4 py-2 font-medium whitespace-nowrap">매출 대비</th>
                </tr>
              </thead>
              <tbody>
                {quarterlyVAT.map(q => {
                  const ratio = q.revenue > 0 ? (q.estimatedVAT / q.revenue * 100).toFixed(2) : '0'
                  // 분기 기간이 이미 완전히 끝났으면 매출 '확정', 진행 중이면 '예상'
                  const ended = q.endMonth < today.slice(0, 7)
                  const ongoing = q.startMonth <= today.slice(0, 7) && today.slice(0, 7) <= q.endMonth
                  return (
                    <tr key={q.quarter} className="border-t border-neutral-100">
                      <td className="px-4 py-2 font-medium whitespace-nowrap">{q.quarter}</td>
                      <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">{q.revenue.toLocaleString()}원</td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          q.type === 'simplified' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {q.type === 'simplified' ? '간이' : '일반'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          ended ? 'bg-neutral-100 text-neutral-600' : ongoing ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {ended ? '매출 확정' : ongoing ? '진행 중' : '예상'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium whitespace-nowrap">
                        {q.estimatedVAT.toLocaleString()}원
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-neutral-500 tabular-nums whitespace-nowrap">{ratio}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-400 px-4 py-3 border-t border-neutral-100">
            💡 &apos;부가세 (매출 기준)&apos;는 신고서에 적힌 실제 납부액이 아니라 매출로 역산한 추정치입니다.
            실제 납부한 세금은 아래 &apos;과거 납부 세금(실측)&apos;에서 확인하세요.
          </p>
        </Card>
      </section>

      {/* === 4. 과거 실제 세금 === */}
      {actualTaxes.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">💰 과거 납부 세금 (실측)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3 mb-3">
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
                    <th className="text-left px-3 py-2 font-medium whitespace-nowrap">월</th>
                    {Object.keys(taxByCategory).map(c => (
                      <th key={c} className="text-right px-3 py-2 font-medium whitespace-nowrap">{c}</th>
                    ))}
                    <th className="text-right px-3 py-2 font-medium whitespace-nowrap">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {taxesByMonth.map(m => (
                    <tr key={m.yearMonth} className="border-t border-neutral-100">
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{m.yearMonth}</td>
                      {Object.keys(taxByCategory).map(c => (
                        <td key={c} className="px-3 py-2 text-right tabular-nums text-neutral-600 whitespace-nowrap">
                          {m.byCategory[c] ? `${m.byCategory[c].toLocaleString()}원` : '-'}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap">
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

      {/* === 5. 부가세 시뮬레이터 === */}
      <section>
        <h2 className="text-lg font-semibold mb-3">🔮 {year}년 부가세 시뮬레이터</h2>

        {currentTaxType === 'simplified' ? (
          // 간이과세자: 1년 1회 확정신고. 분기 개념 없음 → 연 단위로만 표시.
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <KpiCard title="연환산 공급대가" amount={annualVATResult.annualizedSales} />
              <KpiCard
                title="예상 부가세 (연)"
                amount={annualVATResult.estimatedAnnualVAT}
                subtitle={annualVATResult.exempt ? '납부의무 면제 예상' : '공급대가 × 부가율 × 10%'}
              />
              <Card>
                <div className="text-xs text-neutral-500">확정신고 납부기한</div>
                <div className="text-lg font-bold mt-2">{annualVATResult.dueDate}</div>
                <div className="text-xs text-neutral-400 mt-1">{annualVATResult.filingLabel}</div>
              </Card>
            </div>
            {annualVATResult.exempt && (
              <Card className="mt-3 border-emerald-200 bg-emerald-50">
                <div className="text-sm text-emerald-800">
                  ✓ 연환산 공급대가가 4,800만원 미만이라 부가세 <b>납부의무 면제</b> 대상으로 보입니다.
                  (단, 신고 의무는 있을 수 있어 확정신고는 진행하세요.)
                </div>
              </Card>
            )}
            <p className="text-xs text-neutral-400 mt-2">
              💡 간이과세자는 분기마다 내지 않고 1년치를 다음 해 1월 25일에 한 번 확정신고합니다.
              (7월에 직전 납부세액의 1/2 예정부과가 있을 수 있고, 50만원 미만이면 생략됩니다.)
            </p>
          </>
        ) : (
          // 일반과세자: 분기별. 지난 분기 = 매출 확정, 현재/미래 = 예상.
          <>
            <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
              {vatByQuarter.map(v => {
                const ended = v.quarter < currentQuarterNum
                const ongoing = v.quarter === currentQuarterNum
                return (
                  <KpiCard
                    key={v.quarter}
                    title={`${v.quarter}분기 ${ended ? '(확정)' : ongoing ? '(진행)' : '(예상)'}`}
                    amount={v.estimatedVAT}
                    subtitle={`거래 ${v.transactionCount}건`}
                  />
                )
              })}
            </div>
            <div className="mt-3">
              <KpiCard title={`${year}년 부가세 합계 (연환산 예상)`} amount={annualVATResult.estimatedAnnualVAT} />
            </div>
            <p className="text-xs text-neutral-400 mt-2">
              💡 1기(1~6월)는 7월 25일, 2기(7~12월)는 다음 해 1월 25일 확정신고합니다.
              지난 분기는 매출이 확정된 값, 현재·이후 분기는 추세 기반 예상입니다.
            </p>
          </>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">🔮 종합소득세 시뮬레이터 (연환산)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard title="연환산 매출" amount={incomeTax.annualizedRevenue} />
          <KpiCard title="필요경비" amount={-incomeTax.annualizedExpense} />
          <KpiCard title="사업소득금액" amount={incomeTax.businessIncome} />
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard title="과세표준" amount={incomeTax.taxableBase} />
          <KpiCard title={`종합소득세 (국세)`} amount={incomeTax.nationalTax} />
          <KpiCard title={`지방소득세 (국세 ×10%)`} amount={incomeTax.localTax} />
        </div>
        <div className="mt-3">
          <Card className="border-blue-200 bg-blue-50">
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-semibold text-blue-900">
                {incomeTax.filingYear}년 5월 예상 납부 총액 (국세 + 지방세)
              </div>
              <div className="text-xl sm:text-2xl font-bold text-blue-700 tabular-nums tracking-tight break-keep">
                {incomeTax.totalTax.toLocaleString()}원
              </div>
            </div>
            <div className="text-xs text-blue-600/70 mt-1">
              {year}년 귀속분을 {incomeTax.filingYear}년 5월 31일까지 신고·납부합니다.
            </div>
          </Card>
        </div>
        <Card className="mt-3">
          <div className="text-xs text-neutral-500 leading-relaxed">
            <div>
              인적공제 {profile.personalDeductionCount}명 (1인당 150만){' '}
              {profile.isYoungStartupEligible
                ? `· 청년창업감면 ${(profile.youngStartupReductionRate * 100).toFixed(0)}% 적용`
                : '· 청년창업감면 미적용'}
            </div>
            {profile.noranusanAnnualContribution > 0 && (
              <div>· 노란우산 {(profile.noranusanAnnualContribution / 10_000).toFixed(0)}만원 (소득공제, 한도 적용)</div>
            )}
            {incomeTax.pensionCredit > 0 && (
              <div>· 연금저축 세액공제 {incomeTax.pensionCredit.toLocaleString()}원 (납입액 {(profile.pensionAnnualContribution / 10_000).toFixed(0)}만원)</div>
            )}
            <div className="text-neutral-400 mt-1">
              * 공제·감면은 /settings에서 원장이 직접 설정합니다. 기본값은 보수적(미적용)입니다.
            </div>
          </div>
        </Card>
      </section>
    </div>
  )
}
