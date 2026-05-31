import { fetchPassEventsByMember, PASS_EVENT_LABEL } from '@/lib/supabase/pass-events'

/**
 * 회원 상세의 '수강권 변경 이력' 타임라인 섹션. Server component.
 */
export async function MemberPassEvents({ memberId, ownerId }: { memberId: number; ownerId: string }) {
  let events: Awaited<ReturnType<typeof fetchPassEventsByMember>> = []
  try {
    events = await fetchPassEventsByMember(memberId, ownerId, 100)
  } catch { /* 무시 */ }

  if (events.length === 0) return null

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">수강권 변경 이력 ({events.length}건)</h3>
      <div className="rounded-lg border border-neutral-200 bg-white p-3">
        <ol className="space-y-3">
          {events.map(ev => {
            const dt = new Date(ev.changedAt)
            const dateStr = `${dt.getFullYear()}.${dt.getMonth() + 1}.${dt.getDate()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
            const typeColor = {
              issued: 'bg-blue-100 text-blue-700',
              modified: 'bg-amber-100 text-amber-700',
              expired: 'bg-neutral-100 text-neutral-500',
              deleted: 'bg-red-100 text-red-700',
            }[ev.eventType] ?? 'bg-neutral-100 text-neutral-500'
            return (
              <li key={ev.id} className="flex gap-3 text-sm">
                <div className="flex-shrink-0 text-xs text-neutral-400 tabular-nums w-32 pt-1">
                  {dateStr}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${typeColor}`}>
                      {PASS_EVENT_LABEL[ev.eventType]}
                    </span>
                    {ev.passName && <span className="text-sm font-medium text-neutral-800">{ev.passName}</span>}
                    {ev.changedBy && <span className="text-xs text-neutral-500">by {ev.changedBy}</span>}
                  </div>
                  <ChangeDetails before={ev.beforeData} after={ev.afterData} />
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

function ChangeDetails({ before, after }: { before: Record<string, string> | null; after: Record<string, string> | null }) {
  if (!before && !after) return null
  // before/after 키 합집합. 변경된 필드만 표시.
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  const rows: Array<{ key: string; before: string; after: string }> = []
  for (const k of keys) {
    const b = (before?.[k] ?? '').trim()
    const a = (after?.[k] ?? '').trim()
    if (b !== a) rows.push({ key: k, before: b, after: a })
  }
  if (rows.length === 0) return null
  return (
    <div className="mt-1 text-xs text-neutral-600 space-y-0.5">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2 flex-wrap">
          <span className="text-neutral-500 min-w-[60px]">{r.key}</span>
          <span className="text-neutral-400 line-through">{r.before || '(빈값)'}</span>
          <span className="text-neutral-400">→</span>
          <span className="text-neutral-800 font-medium">{r.after || '(빈값)'}</span>
        </div>
      ))}
    </div>
  )
}
