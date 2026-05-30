'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

interface Member { id: number; name: string; phone: string | null }
interface Instructor { id: number; name: string }

/**
 * 전체 뷰 어디서든 수업을 빠르게 추가하는 모달.
 * 종류 토글 (개별/그룹) + 날짜/시간/회원 또는 세션명/강사 입력 → 즉시 저장.
 */
export function QuickAddLesson({
  open,
  onClose,
  prefillDate,
}: {
  open: boolean
  onClose: () => void
  prefillDate: string
}) {
  const router = useRouter()
  const [type, setType] = useState<'individual' | 'group'>('individual')
  const [date, setDate] = useState(prefillDate)
  const [time, setTime] = useState('10:00')
  const [members, setMembers] = useState<Member[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [memberQuery, setMemberQuery] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)
  const [selectedInstructorId, setSelectedInstructorId] = useState<number | null>(null)

  // 그룹 전용
  const [sessionName, setSessionName] = useState('')
  const [capacity, setCapacity] = useState(4)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 모달 열릴 때 데이터 로드 + 날짜 prefill 갱신
  useEffect(() => {
    if (!open) return
    setDate(prefillDate)
    setError('')
    fetch('/api/members').then(r => r.json()).then((j: { members?: Member[] }) => setMembers(j.members ?? []))
    fetch('/api/instructors').then(r => r.json()).then((j: { instructors?: Instructor[] }) => setInstructors(j.instructors ?? []))
  }, [open, prefillDate])

  useEffect(() => {
    const match = members.find(m => m.name === memberQuery)
    setSelectedMemberId(match?.id ?? null)
  }, [memberQuery, members])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (type === 'individual') {
        if (!selectedMemberId) { setError('회원을 선택하세요'); setSubmitting(false); return }
        const res = await fetch('/api/lessons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: selectedMemberId,
            instructorId: selectedInstructorId,
            lessonDate: date,
            lessonTime: time,
          }),
        })
        const json = await res.json() as { ok?: boolean; error?: string }
        if (!res.ok) { setError(json.error ?? '저장 실패'); return }
      } else {
        if (!sessionName.trim()) { setError('세션 이름을 입력하세요'); setSubmitting(false); return }
        const res = await fetch('/api/group-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionName: sessionName.trim(),
            instructorId: selectedInstructorId,
            lessonDate: date,
            lessonTime: time,
            capacity,
            durationMinutes: 50,
          }),
        })
        const json = await res.json() as { ok?: boolean; error?: string }
        if (!res.ok) { setError(json.error ?? '저장 실패'); return }
      }
      // 성공
      router.refresh()
      // 폼 리셋
      setMemberQuery('')
      setSelectedMemberId(null)
      setSessionName('')
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">수업 추가</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-xl leading-none">×</button>
        </div>

        {/* 종류 토글 */}
        <div className="flex gap-1 bg-neutral-100 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => setType('individual')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              type === 'individual' ? 'bg-white shadow-sm text-blue-600' : 'text-neutral-500'
            }`}
          >
            개별 수업
          </button>
          <button
            type="button"
            onClick={() => setType('group')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              type === 'group' ? 'bg-white shadow-sm text-purple-600' : 'text-neutral-500'
            }`}
          >
            그룹 수업
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">날짜</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">시간</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                required
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          {/* 개별 — 회원 */}
          {type === 'individual' && (
            <div>
              <label className="block text-xs text-neutral-500 mb-1">회원 *</label>
              <input
                type="text"
                list="quick-add-member-options"
                value={memberQuery}
                onChange={e => setMemberQuery(e.target.value)}
                placeholder="회원 이름"
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
              />
              <datalist id="quick-add-member-options">
                {members.map(m => <option key={m.id} value={m.name}>{m.phone ?? ''}</option>)}
              </datalist>
              {selectedMemberId && <div className="text-xs text-blue-600 mt-1">✓ 매칭됨</div>}
            </div>
          )}

          {/* 그룹 — 세션 이름 + 정원 */}
          {type === 'group' && (
            <>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">세션 이름 *</label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={e => setSessionName(e.target.value)}
                  required
                  placeholder="예: 월수금 10시 그룹"
                  className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">정원</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={capacity}
                  onChange={e => setCapacity(Number(e.target.value) || 4)}
                  required
                  className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                />
              </div>
            </>
          )}

          {/* 강사 — 공통 */}
          <div>
            <label className="block text-xs text-neutral-500 mb-1">강사 (선택)</label>
            <select
              value={selectedInstructorId ?? ''}
              onChange={e => setSelectedInstructorId(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
            >
              <option value="">선택 안 함</option>
              {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>

          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">⚠ {error}</div>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-sm border border-neutral-300 rounded px-3 py-2 hover:bg-neutral-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 text-sm text-white font-medium rounded px-3 py-2 ${
                type === 'individual' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'
              } disabled:opacity-50`}
            >
              {submitting ? '저장 중...' : '추가'}
            </button>
          </div>

          <p className="text-[10px] text-neutral-400 text-center">
            더 자세한 옵션 (반복 등록 / 메모 등)은 <a href={type === 'individual' ? '/lessons/individual' : '/lessons/groups'} className="text-blue-600 hover:underline">{type === 'individual' ? '개별 수업' : '그룹 수업'} 페이지</a>에서 가능
          </p>
        </form>
      </div>
    </div>
  )
}
