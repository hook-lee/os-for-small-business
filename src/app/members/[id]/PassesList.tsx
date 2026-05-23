'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { Pass } from '@/lib/supabase/passes'

export function PassesList({ initial }: { initial: Pass[] }) {
  const router = useRouter()
  const [passes, setPasses] = useState<Pass[]>(initial)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [instructors, setInstructors] = useState<Array<{ id: number; name: string }>>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editStatus, setEditStatus] = useState('')
  const [editRemaining, setEditRemaining] = useState('')
  const [editInstructorId, setEditInstructorId] = useState<number | null>(null)
  const [editEndDate, setEditEndDate] = useState('')

  useEffect(() => {
    fetch('/api/instructors')
      .then(r => r.json())
      .then((j: { instructors?: Array<{ id: number; name: string }> }) => setInstructors(j.instructors ?? []))
  }, [])

  function startEdit(p: Pass) {
    setEditingId(p.id)
    setEditStatus(p.status ?? '')
    setEditRemaining(p.remainingCount?.toString() ?? '')
    setEditInstructorId(p.instructorId ?? null)
    setEditEndDate(p.endDate ?? '')
  }

  async function saveEdit(id: number) {
    const remaining = editRemaining ? parseInt(editRemaining, 10) : undefined
    if (remaining !== undefined && (!Number.isFinite(remaining) || remaining < 0)) {
      alert('잔여 횟수는 0 이상')
      return
    }
    try {
      const res = await fetch(`/api/passes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editStatus || undefined,
          remainingCount: remaining,
          instructorId: editInstructorId,
          endDate: editEndDate || undefined,
        }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { alert(`저장 실패: ${json.error ?? 'unknown'}`); return }
      // optimistic update
      setPasses(prev => prev.map(p =>
        p.id === id
          ? {
              ...p,
              status: editStatus || p.status,
              remainingCount: remaining ?? p.remainingCount,
              instructorId: editInstructorId,
              endDate: editEndDate || p.endDate,
            }
          : p
      ))
      setEditingId(null)
      router.refresh()
    } catch {
      alert('저장 실패: 네트워크 오류')
    }
  }

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
            {editingId === p.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs">상태
                    <select
                      value={editStatus}
                      onChange={e => setEditStatus(e.target.value)}
                      className="block w-full mt-1 border rounded px-2 py-1 text-sm"
                    >
                      <option value="이용중">이용중</option>
                      <option value="이용만료">이용만료</option>
                      <option value="환불">환불</option>
                    </select>
                  </label>
                  <label className="text-xs">잔여 횟수
                    <input
                      type="number"
                      min="0"
                      value={editRemaining}
                      onChange={e => setEditRemaining(e.target.value)}
                      className="block w-full mt-1 border rounded px-2 py-1 text-sm"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs">담당 강사
                    <select
                      value={editInstructorId ?? ''}
                      onChange={e => setEditInstructorId(e.target.value ? parseInt(e.target.value, 10) : null)}
                      className="block w-full mt-1 border rounded px-2 py-1 text-sm"
                    >
                      <option value="">선택 안 함</option>
                      {instructors.map(i => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs">만료일
                    <input
                      type="date"
                      value={editEndDate}
                      onChange={e => setEditEndDate(e.target.value)}
                      className="block w-full mt-1 border rounded px-2 py-1 text-sm"
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(p.id)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs text-neutral-500"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <>
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
                      onClick={() => startEdit(p)}
                      className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                    >
                      수정
                    </button>
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
              </>
            )}
          </Card>
        )
      })}
    </div>
  )
}
