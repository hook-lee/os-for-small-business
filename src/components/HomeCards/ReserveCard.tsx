import { Card } from '@/components/ui/Card'
import { StatNumber } from '@/components/ui/StatNumber'
import type { ReserveRecommendation } from '@/types/domain'

export function ReserveCard({ recommendation }: { recommendation: ReserveRecommendation }) {
  return (
    <Card>
      <div className="text-xs text-neutral-500">권장 월 예비비</div>
      <div className="mt-2">
        <StatNumber amount={recommendation.monthly} size="hero" className="text-blue-600" />
      </div>
      <div className="text-xs text-neutral-500 mt-2">
        연 예상 세금 {(recommendation.annualTaxEstimate / 10_000).toFixed(0)}만원
      </div>
      <div className="text-xs text-neutral-400 mt-1">
        부가세 {(recommendation.breakdown.vatTotal / 10_000).toFixed(0)}만 + 종소세·지방세 {(recommendation.breakdown.incomeTaxTotal / 10_000).toFixed(0)}만
      </div>
    </Card>
  )
}
