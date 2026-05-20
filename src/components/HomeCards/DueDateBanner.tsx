import type { DueDate } from '@/types/domain'

export function DueDateBanner({ due }: { due: DueDate }) {
  const urgent = due.daysRemaining <= 14
  return (
    <div className={`rounded-md px-4 py-3 ${urgent ? 'bg-amber-50 border border-amber-200' : 'bg-neutral-100'}`}>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">{due.label}</span>
          <span className="text-xs text-neutral-500 ml-2">{due.date}</span>
        </div>
        <div className={`text-sm font-bold ${urgent ? 'text-amber-700' : 'text-neutral-600'}`}>
          D-{due.daysRemaining}
        </div>
      </div>
    </div>
  )
}
