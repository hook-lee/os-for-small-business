import { Card } from '@/components/ui/Card'
import type { ActionCard } from '@/types/domain'

export function ActionCardsList({ cards }: { cards: ActionCard[] }) {
  const triggered = cards.filter(c => c.triggered)
  return (
    <Card>
      <div className="text-sm font-medium mb-3">절세 액션 ({triggered.length}건 활성)</div>
      <div className="space-y-2">
        {triggered.map(card => (
          <div key={card.id} className="border-l-4 border-blue-500 pl-3 py-1">
            <div className="text-sm font-medium">{card.title}</div>
            <div className="text-xs text-neutral-500">{card.description}</div>
            {card.estimatedSavings != null && (
              <div className="text-xs text-blue-600 mt-1">절세 가능 ~{(card.estimatedSavings / 10_000).toFixed(0)}만원</div>
            )}
          </div>
        ))}
        {triggered.length === 0 && <div className="text-xs text-neutral-400">현재 활성 액션 없음</div>}
      </div>
    </Card>
  )
}
