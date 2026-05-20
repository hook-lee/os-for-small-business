import { Card } from '@/components/ui/Card'
import type { ReserveRecommendation } from '@/types/domain'

export function ReserveCard({ recommendation }: { recommendation: ReserveRecommendation }) {
  return (
    <Card>
      <div className="text-xs text-neutral-500">권장 월 예비비</div>
      <div className="text-3xl font-bold mt-2 text-blue-600">
        {recommendation.monthly.toLocaleString()}<span className="text-base font-normal ml-1">원</span>
      </div>
      <div className="text-xs text-neutral-500 mt-2">
        연 예상 세금 {(recommendation.annualTaxEstimate / 10_000).toFixed(0)}만원
      </div>
      <div className="text-xs text-neutral-400 mt-1">
        부가세 {(recommendation.breakdown.vatTotal / 10_000).toFixed(0)}만 + 종소세 {(recommendation.breakdown.incomeTaxTotal / 10_000).toFixed(0)}만
      </div>
    </Card>
  )
}
