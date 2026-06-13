'use client'
import { toast } from '@/components/ui/toast'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { ColorPicker } from '@/components/ColorPicker'
import type { Instructor } from '@/lib/supabase/instructors'
import { effectiveRateMap } from '@/lib/analytics/payroll'
import { DEFAULT_LESSON_CATEGORIES } from '@/lib/supabase/lesson-categories'

// 역할 우선순위: owner(0) → admin(1) → instructor(2). 같은 역할 내에서는 이름 가나다순.
const ROLE_RANK: Record<Instructor['role'], number> = {
  owner: 0,
  admin: 1,
  instructor: 2,
}

interface EditDraft {
  name: string
  phone: string
  defaultRate: string
  categoryRates: Record<string, string>  // 카테고리 → 시급(문자열)
}

/** 강사 시급 요약 — 기본시급 + 카테고리별(설정된 것만). §0 */
function ratesSummary(inst: Instructor): string {
  const eff = effectiveRateMap(inst)
  const entries = Object.entries(eff)
  const parts = [`기본 ${inst.defaultHourlyRate.toLocaleString()}`]
  for (const [cat, rate] of entries) parts.push(`${cat} ${rate.toLocaleString()}`)
  return parts.join(' · ') + '원'
}

interface InstructorsTableProps {
  instructors: Instructor[]
  memberCounts?: Record<number, number>
  revenueByInstructor?: Record<number, number>
  categories?: string[]  // 센터 수업 카테고리(수강권 상위 카테고리) — 시급 입력 칸 목록
}

export function InstructorsTable({ instructors: initial, memberCounts = {}, revenueByInstructor = {}, categories = DEFAULT_LESSON_CATEGORIES }: InstructorsTableProps) {
  const router = useRouter()
  const [instructors, setInstructors] = useState<Instructor[]>(initial)

  // 역할 우선 + 이름 가나다순 2중 정렬
  const sortedInstructors = useMemo(
    () => [...instructors].sort((a, b) => {
      const rankDiff = (ROLE_RANK[a.role] ?? 99) - (ROLE_RANK[b.role] ?? 99)
      if (rankDiff !== 0) return rankDiff
      return a.name.localeCompare(b.name, 'ko-KR')
    }),
    [instructors],
  )
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft>({ name: '', phone: '', defaultRate: '', categoryRates: {} })
  const [savingId, setSavingId] = useState<number | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addSaving, setAddSaving] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', phone: '', color: '' })

  function startEdit(inst: Instructor) {
    setEditingId(inst.id)
    const eff = effectiveRateMap(inst)
    const cr: Record<string, string> = {}
    for (const cat of categories) cr[cat] = eff[cat] != null ? String(eff[cat]) : ''
    // 카테고리 목록에 없지만 강사가 따로 설정해둔 카테고리도 보존
    for (const [k, v] of Object.entries(inst.categoryRates ?? {})) {
      if (!(k in cr)) cr[k] = String(v)
    }
    setEditDraft({
      name: inst.name,
      phone: inst.phone ?? '',
      defaultRate: String(inst.defaultHourlyRate),
      categoryRates: cr,
    })
  }

  async function saveEdit(id: number) {
    const name = editDraft.name.trim()
    if (!name) {
      toast('이름은 비울 수 없습니다')
      return
    }
    const defaultHourlyRate = parseInt(editDraft.defaultRate, 10) || 0
    if (defaultHourlyRate < 0) { toast('기본 시급은 0 이상'); return }
    // 입력된 카테고리 시급(>0)만 저장
    const categoryRates: Record<string, number> = {}
    for (const [cat, v] of Object.entries(editDraft.categoryRates)) {
      const n = parseInt(v, 10)
      if (Number.isFinite(n) && n > 0) categoryRates[cat] = n
    }
    const phone = editDraft.phone.trim() || null
    setSavingId(id)
    try {
      const res = await fetch(`/api/instructors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, defaultHourlyRate, categoryRates }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        toast(`저장 실패: ${json.error ?? 'unknown'}`)
        return
      }
      setInstructors(prev => prev.map(i =>
        i.id === id ? { ...i, name, phone, defaultHourlyRate, categoryRates } : i,
      ))
      setEditingId(null)
    } catch {
      toast('저장 실패: 네트워크 오류')
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
        toast(`삭제 실패: ${json.error ?? 'unknown'}`)
        return
      }
      setInstructors(prev => prev.filter(i => i.id !== inst.id))
      router.refresh()
    } catch {
      toast('삭제 실패: 네트워크 오류')
    }
  }

  async function handleAdd() {
    if (!addForm.name.trim()) {
      toast('이름을 입력해주세요.')
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
        toast(`추가 실패: ${json.error ?? 'unknown'}`)
        return
      }
      setAddForm({ name: '', phone: '', color: '' })
      setShowAddForm(false)
      router.refresh()
    } catch {
      toast('추가 실패: 네트워크 오류')
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
              <label className="block text-xs text-neutral-500 mb-1">색상</label>
              <ColorPicker value={addForm.color} onChange={v => setAddForm(f => ({ ...f, color: v }))} />
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

      {/* 모바일: 카드 레이아웃 (가로로 긴 표 대신) */}
      <div className="md:hidden space-y-2">
        {sortedInstructors.map(inst => (
          <Card key={inst.id} className="space-y-2">
            {editingId === inst.id ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {inst.color && <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: inst.color }} />}
                  <input type="text" value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))} className="flex-1 border border-neutral-300 rounded px-2 py-1 text-sm" placeholder="이름" />
                </div>
                <input type="text" value={editDraft.phone} onChange={e => setEditDraft(d => ({ ...d, phone: e.target.value }))} className="w-full border border-neutral-300 rounded px-2 py-1 text-sm" placeholder="전화번호" />
                <RateEditor draft={editDraft} onChange={patch => setEditDraft(d => ({ ...d, ...patch }))} />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(inst.id)} disabled={savingId === inst.id} className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm disabled:bg-blue-300">{savingId === inst.id ? '저장 중...' : '저장'}</button>
                  <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm text-neutral-500">취소</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {inst.color && <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: inst.color }} />}
                    <a href={`/instructors/${inst.id}`} className="font-semibold text-blue-600 truncate">{inst.name}</a>
                    <span className="text-[10px] text-neutral-500 shrink-0">{inst.role === 'owner' ? '👑 오너' : roleLabel(inst.role)}</span>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <button onClick={() => startEdit(inst)} className="text-xs text-blue-600">수정</button>
                    <button onClick={() => handleDelete(inst)} disabled={inst.role === 'owner'} className="text-xs text-red-600 disabled:text-neutral-300">삭제</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-neutral-600">
                  <div className="tabular-nums">📞 {inst.phone ?? '—'}</div>
                  <div><a href={`/instructors/${inst.id}`} className="text-blue-600">담당 {memberCounts[inst.id] ?? 0}명</a></div>
                  <div className="col-span-2 tabular-nums">💰 매출기여 {(revenueByInstructor[inst.id] ?? 0).toLocaleString()}원</div>
                  <div className="col-span-2 text-neutral-500 leading-relaxed">시급 · {ratesSummary(inst)}</div>
                </div>
              </>
            )}
          </Card>
        ))}
        {sortedInstructors.length === 0 && (
          <Card><div className="text-sm text-neutral-400 text-center py-4">강사가 아직 없습니다.</div></Card>
        )}
      </div>

      {/* 데스크탑: 표 */}
      <Card className="hidden md:block p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium whitespace-nowrap">강사</th>
                <th className="text-left px-4 py-2 font-medium whitespace-nowrap">역할</th>
                <th className="text-left px-4 py-2 font-medium whitespace-nowrap">전화번호</th>
                <th className="text-center px-4 py-2 font-medium whitespace-nowrap">담당</th>
                <th className="text-left px-4 py-2 font-medium">시급 (기본·카테고리별)</th>
                <th className="text-right px-4 py-2 font-medium whitespace-nowrap">매출 기여</th>
                <th className="text-right px-4 py-2 font-medium whitespace-nowrap">동작</th>
              </tr>
            </thead>
            <tbody>
              {sortedInstructors.map(inst => (
                <tr key={inst.id} className="border-t border-neutral-100 hover:bg-neutral-50/50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {inst.color && (
                        <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: inst.color }} />
                      )}
                      {editingId === inst.id ? (
                        <input
                          type="text"
                          value={editDraft.name}
                          onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                          className="w-28 border border-neutral-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="이름"
                        />
                      ) : (
                        <a href={`/instructors/${inst.id}`} className="font-medium text-blue-600 hover:underline">{inst.name}</a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 whitespace-nowrap">
                    {inst.role === 'owner' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                        👑 {roleLabel(inst.role)}
                      </span>
                    ) : (
                      <span className="text-sm">{roleLabel(inst.role)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 whitespace-nowrap tabular-nums">
                    {editingId === inst.id ? (
                      <input
                        type="text"
                        value={editDraft.phone}
                        onChange={e => setEditDraft(d => ({ ...d, phone: e.target.value }))}
                        className="w-32 border border-neutral-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="010-0000-0000"
                      />
                    ) : (
                      inst.phone ?? '—'
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center tabular-nums">
                    <a
                      href={`/instructors/${inst.id}`}
                      className="text-blue-600 hover:underline"
                      title="담당 회원 보기 (이용중 기준)"
                    >
                      {memberCounts[inst.id] ?? 0}명
                    </a>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {editingId === inst.id ? (
                      <div className="min-w-[300px]">
                        <RateEditor draft={editDraft} onChange={patch => setEditDraft(d => ({ ...d, ...patch }))} />
                      </div>
                    ) : (
                      <span className="text-neutral-700 leading-relaxed">{ratesSummary(inst)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-700 whitespace-nowrap font-medium">
                    {(revenueByInstructor[inst.id] ?? 0).toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    {editingId === inst.id ? (
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => saveEdit(inst.id)}
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
                      <div className="inline-flex gap-3">
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
              {sortedInstructors.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-neutral-400 text-sm">
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

// 강사 시급 편집기 — 기본 시급 + 카테고리(수강권 상위 카테고리)별 시급. §0
function RateEditor({ draft, onChange }: {
  draft: EditDraft
  onChange: (patch: Partial<EditDraft>) => void
}) {
  const cats = Object.keys(draft.categoryRates)
  return (
    <div className="space-y-2">
      <label className="block text-xs text-neutral-500">
        기본 시급 (카테고리 미설정 시 적용)
        <input
          type="number" min="0" step="1000"
          value={draft.defaultRate}
          onChange={e => onChange({ defaultRate: e.target.value })}
          className="block w-full mt-0.5 border border-neutral-300 rounded-lg px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
        />
      </label>
      {cats.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {cats.map(cat => (
            <label key={cat} className="text-xs text-neutral-500 truncate" title={cat}>
              {cat}
              <input
                type="number" min="0" step="1000" placeholder="기본 적용"
                value={draft.categoryRates[cat]}
                onChange={e => onChange({ categoryRates: { ...draft.categoryRates, [cat]: e.target.value } })}
                className="block w-full mt-0.5 border border-neutral-300 rounded-lg px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </label>
          ))}
        </div>
      )}
      <p className="text-[10px] text-neutral-400 leading-snug">비워두면 기본 시급 적용. 카테고리는 수강권 상품의 상위 카테고리예요.</p>
    </div>
  )
}
