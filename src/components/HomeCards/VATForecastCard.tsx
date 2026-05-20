import { Card } from '@/components/ui/Card'
import type { VATResult } from '@/types/domain'

export function VATForecastCard({ result }: { result: VATResult }) {
  return (
    <Card>
      <div className="text-xs text-neutral-500">{result.year}년 {result.quarter}분기 부가세 예상</div>
      <div className="text-3xl font-bold mt-2">
        {result.estimatedVAT.toLocaleString()}<span className="text-base font-normal ml-1">원</span>
      </div>
      <div className="text-xs text-neutral-500 mt-2 flex gap-4">
        <span>매출세액 {(result.outputVAT / 10_000).toFixed(0)}만</span>
        <span>매입세액 {(result.inputVAT / 10_000).toFixed(0)}만</span>
        <span>거래 {result.transactionCount}건</span>
      </div>
    </Card>
  )
}
