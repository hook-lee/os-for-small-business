'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { Pass } from '@/lib/supabase/passes'
import type { Instructor } from '@/lib/supabase/instructors'
import type { Transaction } from '@/types/domain'
import {
  computePassesKPI, computeTransactionsKPI, revenueByProduct, revenueByInstructor,
  revenueByMethod, revenueByMonth, filterPassesByRange, filterTransactionsByRange,
} from '@/lib/analytics/sales-report'
import { MonthlyBarChart } from '@/components/Charts/MonthlyBarChart'

type Range = '월' | '연' | '전체'

export function SalesReport({ initialMonth, passes, instructors, transactions }: {
  initialMonth: string
  passes: Pass[]
  instructors: Instructor[]
  transactions: Transaction[]
}) {
  const router = useRouter()
  const [range, setRange] = useState<Range>('월')
  const [yearMonth, setYearMonth] = useState(initialMonth)

  const filteredPasses = useMemo(() => {
    if (range === '전체') return passes
    if (range === '연') {
      const year = yearMonth.slice(0, 4)
      return filterPassesByRange(passes, `${year}-01-01`, `${year}-12-31`)
    }
    const year = yearMonth.slice(0, 4)
    const month = yearMonth.slice(5, 7)
    const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate()
    return filterPassesByRange(passes, `${yearMonth}-01`, `${yearMonth}-${String(lastDay).padStart(2, '0')}`)
  }, [passes, range, yearMonth])

  const filteredTxs = useMemo(() => {
    if (range === '전체') return transactions
    if (range === '연') {
      const year = yearMonth.slice(0, 4)
      return filterTransactionsByRange(transactions, `${year}-01-01`, `${year}-12-31`)
    }
    const year = yearMonth.slice(0, 4)
    const month = yearMonth.slice(5, 7)
    const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate()
    return filterTransactionsByRange(transactions, `${yearMonth}-01`, `${yearMonth}-${String(lastDay).padStart(2, '0')}`)
  }, [transactions, range, yearMonth])

  const passKPI = useMemo(() => computePassesKPI(filteredPasses), [filteredPasses])
  const txKPI = useMemo(() => computeTransactionsKPI(filteredTxs), [filteredTxs])

  const instructorMap = useMemo(() => new Map(instructors.map(i => [i.id, i.name])), [instructors])
  const byProduct = useMemo(() => revenueByProduct(filteredPasses), [filteredPasses])
  const byInstructor = useMemo(() => revenueByInstructor(filteredPasses, instructorMap), [filteredPasses, instructorMap])
  const byMethod = useMemo(() => revenueByMethod(filteredPasses), [filteredPasses])
  const byMonth = useMemo(() => revenueByMonth(passes), [passes])  // 전체 기간 차트

  // 매출 source of truth = transactions (사용자가 직접 입력한 가계부)
  // passes는 회원 결제 이력 (참고용) — 두 source가 중복될 수 있어 합산하지 않음
  const grandTotal = txKPI.total

  function changeMonth(newYm: string) {
    setYearMonth(newYm)
    router.push(`/sales?ym=${newYm}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">매출 리포트</h2>
        <div className="flex items-center gap-2">
          {(['월', '연', '전체'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-sm px-3 py-1 rounded ${range === r ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              {r}
            </button>
          ))}
          {(range === '월' || range === '연') && (
            <input
              type="month"
              value={yearMonth}
              onChange={e => changeMonth(e.target.value)}
              className="border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          )}
        </div>
      </div>

      {/* 합계 카드 — 가계부(transactions) 기준 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="총 매출" value={`${grandTotal.toLocaleString()}원`} sub={`${txKPI.count}건 · 가계부`} highlight />
        <Stat label="순이익" value={`${(grandTotal - txKPI.expense).toLocaleString()}원`} sub="매출 - 지출" />
        <Stat label="총 지출" value={`-${txKPI.expense.toLocaleString()}원`} sub={`${txKPI.expenseCount}건`} />
        <Stat label="매출률" value={`${grandTotal > 0 ? Math.round((grandTotal - txKPI.expense) / grandTotal * 100) : 0}%`} sub="(매출 - 지출) / 매출" />
      </div>

      {/* 회원 결제 이력 (참고용 — passes 기반, 매출 합산 X) */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-neutral-700">📒 회원 결제 이력 (참고)</h3>
          <span className="text-[10px] text-neutral-400">총 매출에 합산 X · passes 테이블 기준</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="결제 건수" value={`${passKPI.transactionCount}건`} sub={`${passKPI.total.toLocaleString()}원`} />
          <Stat label="신규결제" value={`${passKPI.newPayment.toLocaleString()}원`} />
          <Stat label="재결제" value={`${passKPI.rePayment.toLocaleString()}원`} />
          <Stat label="체험" value={`${passKPI.trialPayment.toLocaleString()}원`} />
        </div>
      </div>

      {/* 차트 */}
      {byMonth.length > 0 && (
        <MonthlyBarChart
          data={byMonth.map(m => ({ month: m.month, amount: m.total }))}
          title="월별 회원 결제 이력 (전체 기간 · 참고용)"
          color="#94a3b8"
        />
      )}

      {/* 상품별 + 강사별 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-semibold mb-2">상품별 매출 ({range})</h3>
          <Table rows={byProduct} renderRow={r => ({ left: r.name, right: r.total, sub: `${r.count}건` })} />
        </Card>
        <Card>
          <h3 className="text-sm font-semibold mb-2">강사별 매출 ({range})</h3>
          <Table rows={byInstructor} renderRow={r => ({ left: r.name, right: r.total, sub: `${r.count}건` })} />
        </Card>
        <Card>
          <h3 className="text-sm font-semibold mb-2">결제수단별 매출 ({range})</h3>
          <Table rows={byMethod} renderRow={r => ({ left: r.method, right: r.total, sub: `${r.count}건` })} />
        </Card>
      </div>

      <p className="text-xs text-neutral-400">
        💡 <strong>총 매출 = 가계부(transactions)</strong>만 합산. 회원 결제 이력(passes)은 회원/수강권 관리용 데이터로 참고만 — 두 source가 중복될 수 있어 매출에 합산하지 않습니다.
      </p>
    </div>
  )
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <Card>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`text-xl font-bold mt-1 tabular-nums ${highlight ? 'text-blue-600' : ''}`}>{value}</div>
      {sub && <div className="text-xs text-neutral-400 mt-1">{sub}</div>}
    </Card>
  )
}

function Table<T>({ rows, renderRow }: { rows: T[]; renderRow: (r: T) => { left: string; right: number; sub?: string } }) {
  if (rows.length === 0) return <div className="text-xs text-neutral-400">데이터 없음</div>
  return (
    <div className="space-y-1">
      {rows.map((r, i) => {
        const data = renderRow(r)
        return (
          <div key={i} className="flex items-center justify-between text-sm border-b border-neutral-100 py-1">
            <span>{data.left}</span>
            <span className="text-right">
              <span className="tabular-nums font-medium">{data.right.toLocaleString()}원</span>
              {data.sub && <span className="text-xs text-neutral-400 ml-2">{data.sub}</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}
