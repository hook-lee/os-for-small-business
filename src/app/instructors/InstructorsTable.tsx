'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import type { Instructor } from '@/lib/supabase/instructors'

export function InstructorsTable({ instructors: initial }: { instructors: Instructor[] }) {
  const [instructors, setInstructors] = useState<Instructor[]>(initial)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draftRate, setDraftRate] = useState<string>('')
  const [savingId, setSavingId] = useState<number | null>(null)

  function startEdit(inst: Instructor) {
    setEditingId(inst.id)
    setDraftRate(String(inst.defaultHourlyRate))
  }

  async function saveRate(id: number) {
    const rate = parseInt(draftRate, 10)
    if (!Number.isFinite(rate) || rate < 0) {
      alert('시급은 0 이상 숫자만 입력 가능')
      return
    }
    setSavingId(id)
    try {
      const res = await fetch(`/api/instructors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultHourlyRate: rate }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        alert(`저장 실패: ${json.error ?? 'unknown'}`)
        return
      }
      setInstructors(prev => prev.map(i => i.id === id ? { ...i, defaultHourlyRate: rate } : i))
      setEditingId(null)
    } catch {
      alert('저장 실패: 네트워크 오류')
    } finally {
      setSavingId(null)
    }
  }

  function roleLabel(role: Instructor['role']): string {
    return role === 'owner' ? '스튜디오 오너' : role === 'admin' ? '관리자' : '강사'
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs text-neutral-500 uppercase">
            <tr>
              <th className="text-left px-4 py-2 font-medium">강사</th>
              <th className="text-left px-4 py-2 font-medium">역할</th>
              <th className="text-left px-4 py-2 font-medium">전화번호</th>
              <th className="text-right px-4 py-2 font-medium">시급 (원/시간)</th>
              <th className="text-left px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {instructors.map(inst => (
              <tr key={inst.id} className="border-t border-neutral-100">
                <td className="px-4 py-3 flex items-center gap-2">
                  {inst.color && (
                    <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: inst.color }} />
                  )}
                  <span className="font-medium">{inst.name}</span>
                </td>
                <td className="px-4 py-3 text-neutral-600">{roleLabel(inst.role)}</td>
                <td className="px-4 py-3 text-neutral-600">{inst.phone ?? '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {editingId === inst.id ? (
                    <input
                      type="number"
                      value={draftRate}
                      onChange={e => setDraftRate(e.target.value)}
                      className="w-32 border border-neutral-300 rounded px-2 py-1 text-right"
                      min="0"
                      step="1000"
                    />
                  ) : (
                    <span>{inst.defaultHourlyRate.toLocaleString()}원</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === inst.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => saveRate(inst.id)}
                        disabled={savingId === inst.id}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
                      >
                        {savingId === inst.id ? '...' : '저장'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2 py-1 text-xs text-neutral-500 hover:text-neutral-700"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(inst)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      시급 수정
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {instructors.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-400 text-sm">
                  강사가 아직 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
