'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { Instructor } from '@/lib/supabase/instructors'

interface RateDraft {
  ratePrivate: string
  rateRehab: string
  rateDuet: string
  rateGroup: string
}

function ratesSummary(inst: Instructor): string {
  const { ratePrivate, rateRehab, rateDuet, rateGroup } = inst
  if (ratePrivate === rateRehab && rateRehab === rateDuet && rateDuet === rateGroup) {
    return `${ratePrivate.toLocaleString()}원 (균등)`
  }
  return `개인 ${ratePrivate.toLocaleString()}·재활 ${rateRehab.toLocaleString()}·듀엣 ${rateDuet.toLocaleString()}·그룹 ${rateGroup.toLocaleString()}원`
}

export function InstructorsTable({ instructors: initial }: { instructors: Instructor[] }) {
  const router = useRouter()
  const [instructors, setInstructors] = useState<Instructor[]>(initial)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [rateDraft, setRateDraft] = useState<RateDraft>({ ratePrivate: '', rateRehab: '', rateDuet: '', rateGroup: '' })
  const [savingId, setSavingId] = useState<number | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addSaving, setAddSaving] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', phone: '', color: '' })

  function startEdit(inst: Instructor) {
    setEditingId(inst.id)
    setRateDraft({
      ratePrivate: String(inst.ratePrivate),
      rateRehab: String(inst.rateRehab),
      rateDuet: String(inst.rateDuet),
      rateGroup: String(inst.rateGroup),
    })
  }

  async function saveRates(id: number) {
    const ratePrivate = parseInt(rateDraft.ratePrivate, 10)
    const rateRehab = parseInt(rateDraft.rateRehab, 10)
    const rateDuet = parseInt(rateDraft.rateDuet, 10)
    const rateGroup = parseInt(rateDraft.rateGroup, 10)
    if ([ratePrivate, rateRehab, rateDuet, rateGroup].some(r => !Number.isFinite(r) || r < 0)) {
      alert('시급은 0 이상 숫자만 입력 가능')
      return
    }
    setSavingId(id)
    try {
      const res = await fetch(`/api/instructors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratePrivate, rateRehab, rateDuet, rateGroup }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        alert(`저장 실패: ${json.error ?? 'unknown'}`)
        return
      }
      setInstructors(prev => prev.map(i =>
        i.id === id ? { ...i, ratePrivate, rateRehab, rateDuet, rateGroup } : i,
      ))
      setEditingId(null)
    } catch {
      alert('저장 실패: 네트워크 오류')
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(inst: Instructor) {
    if (inst.role === 'owner') return
    if (!confirm(`${inst.name} 강사를 삭제할까요?`)) return
    try {
      const res = await fetch(`/api/instructors/${inst.id}`, { method: 'DELETE' })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        alert(`삭제 실패: ${json.error ?? 'unknown'}`)
        return
      }
      setInstructors(prev => prev.filter(i => i.id !== inst.id))
      router.refresh()
    } catch {
      alert('삭제 실패: 네트워크 오류')
    }
  }

  async function handleAdd() {
    if (!addForm.name.trim()) {
      alert('이름을 입력해주세요.')
      return
    }
    setAddSaving(true)
    try {
      const res = await fetch('/api/instructors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name.trim(),
          phone: addForm.phone.trim() || null,
          role: 'instructor',
          color: addForm.color.trim() || null,
        }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        alert(`추가 실패: ${json.error ?? 'unknown'}`)
        return
      }
      setAddForm({ name: '', phone: '', color: '' })
      setShowAddForm(false)
      router.refresh()
    } catch {
      alert('추가 실패: 네트워크 오류')
    } finally {
      setAddSaving(false)
    }
  }

  function roleLabel(role: Instructor['role']): string {
    return role === 'owner' ? '스튜디오 오너' : role === 'admin' ? '관리자' : '강사'
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + 강사 추가
        </button>
      </div>

      {showAddForm && (
        <Card className="space-y-3">
          <div className="text-sm font-medium text-neutral-700">신규 강사 추가</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">이름 *</label>
              <input
                type="text"
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">전화번호</label>
              <input
                type="text"
                value={addForm.phone}
                onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="010-0000-0000"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">색상 (hex)</label>
              <input
                type="text"
                value={addForm.color}
                onChange={e => setAddForm(f => ({ ...f, color: e.target.value }))}
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="#3B82F6"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={addSaving}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
            >
              {addSaving ? '저장 중...' : '저장'}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setAddForm({ name: '', phone: '', color: '' }) }}
              className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700"
            >
              취소
            </button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">강사</th>
                <th className="text-left px-4 py-2 font-medium">역할</th>
                <th className="text-left px-4 py-2 font-medium">전화번호</th>
                <th className="text-left px-4 py-2 font-medium">시급 (개인·재활·듀엣·그룹)</th>
                <th className="text-left px-4 py-2 font-medium">동작</th>
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
                  <td className="px-4 py-3 tabular-nums">
                    {editingId === inst.id ? (
                      <div className="grid grid-cols-2 gap-2 min-w-[260px]">
                        {(['ratePrivate', 'rateRehab', 'rateDuet', 'rateGroup'] as const).map((key, i) => (
                          <div key={key}>
                            <label className="block text-xs text-neutral-400 mb-0.5">
                              {['개인', '재활', '듀엣', '그룹'][i]}
                            </label>
                            <input
                              type="number"
                              value={rateDraft[key]}
                              onChange={e => setRateDraft(d => ({ ...d, [key]: e.target.value }))}
                              className="w-full border border-neutral-300 rounded px-2 py-1 text-right text-sm"
                              min="0"
                              step="1000"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-neutral-700">{ratesSummary(inst)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === inst.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => saveRates(inst.id)}
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
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(inst)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(inst)}
                          disabled={inst.role === 'owner'}
                          className="text-xs text-red-600 hover:underline disabled:text-neutral-300 disabled:cursor-not-allowed"
                          title={inst.role === 'owner' ? '오너는 삭제 불가' : undefined}
                        >
                          삭제
                        </button>
                      </div>
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
    </div>
  )
}
