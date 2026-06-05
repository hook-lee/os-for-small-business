import { Card } from '@/components/ui/Card'
import type { AnnualVATResult } from '@/lib/tax/vat'

export function VATForecastCard({ result }: { result: AnnualVATResult }) {
  const isSimplified = result.type === 'simplified'
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="text-xs text-neutral-500">{result.year}년 부가세 예상 (연 단위)</div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">
          {isSimplified ? '간이과세' : '일반과세'}
        </span>
      </div>
      <div className="text-2xl sm:text-3xl font-bold mt-2 tabular-nums break-keep">
        {result.estimatedAnnualVAT.toLocaleString()}<span className="text-base font-normal ml-1">원</span>
      </div>
      {result.exempt ? (
        <div className="text-xs text-green-600 mt-2">
          연 공급대가 {(result.annualizedSales / 10_000).toFixed(0)}만원 → 납부의무 면제 예상
        </div>
      ) : (
        <div className="text-xs text-neutral-500 mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {isSimplified ? (
            <span>연 공급대가 {(result.annualizedSales / 10_000).toFixed(0)}만 × 부가율</span>
          ) : (
            <>
              <span>매출세액 {(result.outputVAT / 10_000).toFixed(0)}만</span>
              <span>매입세액 {(result.inputVAT / 10_000).toFixed(0)}만</span>
            </>
          )}
        </div>
      )}
      <div className="text-xs text-neutral-400 mt-1">납부기한 {result.filingLabel}</div>
    </Card>
  )
}
