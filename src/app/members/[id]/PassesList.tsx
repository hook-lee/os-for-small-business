'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { Pass } from '@/lib/supabase/passes'

export function PassesList({ initial }: { initial: Pass[] }) {
  const router = useRouter()
  const [passes, setPasses] = useState<Pass[]>(initial)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function handleDelete(id: number, label: string) {
    if (!confirm(`${label}\n정말 삭제할까요?`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/passes/${id}`, { method: 'DELETE' })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        alert(`삭제 실패: ${json.error ?? 'unknown'}`)
        return
      }
      setPasses(prev => prev.filter(p => p.id !== id))
      router.refresh()
    } catch {
      alert('삭제 실패: 네트워크 오류')
    } finally {
      setDeletingId(null)
    }
  }

  if (passes.length === 0) return <div className="text-sm text-neutral-400">수강권 이력 없음</div>

  return (
    <div className="space-y-2">
      {passes.map(p => {
        const label = `${p.paidAt ?? '—'} ${p.passName} ${p.paymentAmount?.toLocaleString() ?? '—'}원`
        const isDeleting = deletingId === p.id
        return (
          <Card key={p.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="font-medium">
                {p.passName}{' '}
                <span className="text-xs text-neutral-400">{p.passType ?? ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    p.status === '이용중'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {p.status ?? '—'}
                </span>
                <button
                  onClick={() => handleDelete(p.id, label)}
                  disabled={isDeleting}
                  className="text-xs text-red-500 hover:text-red-700 disabled:text-neutral-300 px-2 py-1 rounded hover:bg-red-50"
                >
                  {isDeleting ? '...' : '삭제'}
                </button>
              </div>
            </div>
            <div className="text-sm text-neutral-600">
              {p.startDate ?? '—'} ~ {p.endDate ?? '—'} · {p.remainingCount ?? '—'}/{p.totalCount ?? '—'}회 잔여
            </div>
            <div className="text-xs text-neutral-500">
              {p.paymentType ?? '—'} · {p.paymentAmount?.toLocaleString() ?? '—'}원 · {p.paymentMethod ?? '—'} · {p.paidAt ?? '—'}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
