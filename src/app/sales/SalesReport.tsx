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

  const grandTotal = passKPI.total + txKPI.total

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

      {/* 합계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="총 매출" value={`${grandTotal.toLocaleString()}원`} highlight />
        <Stat label="수강권 매출" value={`${passKPI.total.toLocaleString()}원`} sub={`${passKPI.transactionCount}건`} />
        <Stat label="가계부 매출" value={`${txKPI.total.toLocaleString()}원`} sub={`${txKPI.count}건`} />
        <Stat label="환불" value={`-${passKPI.refund.toLocaleString()}원`} sub="수강권 기준" />
      </div>

      {/* 수강권 매출 분해 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="신규결제" value={`${passKPI.newPayment.toLocaleString()}원`} />
        <Stat label="재결제" value={`${passKPI.rePayment.toLocaleString()}원`} />
        <Stat label="체험 매출" value={`${passKPI.trialPayment.toLocaleString()}원`} />
        <Stat
          label="재결제 비율"
          value={`${passKPI.total > 0 ? Math.round(passKPI.rePayment / passKPI.total * 100) : 0}%`}
        />
      </div>

      {/* 차트 */}
      {byMonth.length > 0 && (
        <MonthlyBarChart
          data={byMonth.map(m => ({ month: m.month, amount: m.total }))}
          title="월별 수강권 매출 (전체 기간)"
          color="#2563eb"
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
        수강권 매출 = passes.payment_amount (수강권 결제) / 가계부 매출 = transactions where category=매출 (그 외 잡매출). 두 소스가 겹칠 수 있음 (수강권 매출을 가계부에도 입력한 경우).
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
