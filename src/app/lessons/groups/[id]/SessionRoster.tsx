'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { GroupSession } from '@/lib/supabase/group-sessions'
import type { Reservation, ReservationStatus } from '@/lib/supabase/group-reservations'

interface Member { id: number; name: string; phone: string | null }

const STATUS_LABEL: Record<ReservationStatus, string> = {
  reserved: '예약',
  attended: '출석',
  cancelled: '취소',
  noshow: '노쇼',
}

const STATUS_COLOR: Record<ReservationStatus, string> = {
  reserved: 'bg-blue-100 text-blue-700',
  attended: 'bg-green-100 text-green-700',
  cancelled: 'bg-neutral-100 text-neutral-500',
  noshow: 'bg-red-100 text-red-600',
}

interface Props {
  session: GroupSession
  initialReservations: Reservation[]
}

export function SessionRoster({ session, initialReservations }: Props) {
  const router = useRouter()
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [updating, setUpdating] = useState<number | null>(null)

  // 회원 추가 폼 상태
  const [showAdd, setShowAdd] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [memberQuery, setMemberQuery] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    if (showAdd && members.length === 0) {
      fetch('/api/members').then(r => r.json()).then((j: { members?: Member[] }) => setMembers(j.members ?? []))
    }
  }, [showAdd, members.length])

  useEffect(() => {
    const match = members.find(m => m.name === memberQuery)
    setSelectedMemberId(match?.id ?? null)
  }, [memberQuery, members])

  async function handleStatusChange(id: number, newStatus: ReservationStatus) {
    setUpdating(id)
    try {
      const res = await fetch(`/api/group-reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '상태 변경 실패')
      setReservations(prev =>
        prev.map(r => r.id === id ? { ...r, status: newStatus } : r)
      )
      router.refresh()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setUpdating(null)
    }
  }

  async function handleAddMember(e: FormEvent) {
    e.preventDefault()
    if (!selectedMemberId) { setAddError('회원을 선택하세요'); return }
    // 이미 활성 예약(취소 아님)인지 체크
    const existing = reservations.find(r => r.memberId === selectedMemberId && r.status !== 'cancelled')
    if (existing) {
      setAddError('이미 예약된 회원입니다')
      return
    }
    setAddSubmitting(true)
    setAddError('')
    try {
      const res = await fetch('/api/group-reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          memberId: selectedMemberId,
          passId: null,
        }),
      })
      const json = await res.json() as { ok?: boolean; id?: number; error?: string }
      if (!res.ok) { setAddError(json.error ?? '추가 실패'); return }
      router.refresh()
      setMemberQuery('')
      setSelectedMemberId(null)
      setShowAdd(false)
    } catch (err) {
      setAddError((err as Error).message)
    } finally {
      setAddSubmitting(false)
    }
  }

  const activeCount = reservations.filter(r => r.status !== 'cancelled').length
  const isFull = activeCount >= session.capacity

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <a href="/lessons/groups" className="text-sm text-neutral-500 hover:text-blue-600">← 그룹 수업</a>
      </div>

      {/* Session header */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="font-bold text-lg">{session.sessionName}</div>
        <div className="text-sm text-neutral-500 mt-1">
          {session.lessonDate} {session.lessonTime}
          {session.instructorName && ` · ${session.instructorName}`}
        </div>
        <div className="text-sm text-blue-600 mt-1 font-medium">
          예약 {activeCount}/{session.capacity}명 · 출석 {session.attendedCount}명
        </div>
        {session.notes && <div className="text-xs text-neutral-400 mt-1">{session.notes}</div>}
      </div>

      {/* 회원 추가 toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">예약 명단</h3>
        <button
          onClick={() => { setShowAdd(v => !v); setAddError('') }}
          className={`text-sm font-medium px-3 py-1.5 rounded ${
            showAdd
              ? 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {showAdd ? '취소' : '+ 회원 추가'}
        </button>
      </div>

      {/* 회원 추가 인라인 폼 */}
      {showAdd && (
        <form onSubmit={handleAddMember} className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
          <div>
            <label className="block text-xs text-neutral-600 mb-1">회원 검색</label>
            <input
              type="text"
              list="roster-member-options"
              value={memberQuery}
              onChange={e => setMemberQuery(e.target.value)}
              placeholder="회원 이름"
              className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
              autoFocus
            />
            <datalist id="roster-member-options">
              {members.map(m => <option key={m.id} value={m.name}>{m.phone ?? ''}</option>)}
            </datalist>
            {selectedMemberId && <div className="text-xs text-blue-700 mt-1">✓ 매칭됨 (id={selectedMemberId})</div>}
            {memberQuery && !selectedMemberId && <div className="text-xs text-amber-700 mt-1">⚠ 등록된 회원 중에 매칭 없음</div>}
          </div>
          {isFull && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              ⚠ 정원 초과 상태입니다 ({activeCount}/{session.capacity}). 강제 추가 가능.
            </div>
          )}
          {addError && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">⚠ {addError}</div>}
          <button
            type="submit"
            disabled={addSubmitting || !selectedMemberId}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 rounded text-sm"
          >
            {addSubmitting ? '추가 중...' : '회원 예약 추가'}
          </button>
        </form>
      )}

      {/* Reservations table */}
      {reservations.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-sm text-neutral-400">
          예약자가 없습니다.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="text-left px-4 py-2 text-xs text-neutral-500 font-medium">회원</th>
                <th className="text-left px-4 py-2 text-xs text-neutral-500 font-medium hidden sm:table-cell">연락처</th>
                <th className="text-left px-4 py-2 text-xs text-neutral-500 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map(r => (
                <tr key={r.id} className="border-b border-neutral-50 last:border-0">
                  <td className="px-4 py-3">
                    <a href={`/members/${r.memberId}`} className="font-medium hover:text-blue-600">
                      {r.memberName}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 hidden sm:table-cell">
                    {r.memberPhone ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLOR[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      <select
                        disabled={updating === r.id}
                        value={r.status}
                        onChange={e => handleStatusChange(r.id, e.target.value as ReservationStatus)}
                        className="text-xs border border-neutral-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
                      >
                        <option value="reserved">예약</option>
                        <option value="attended">출석</option>
                        <option value="cancelled">취소 (제외)</option>
                        <option value="noshow">노쇼</option>
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-neutral-400">
        💡 <strong>제외</strong> = 상태를 &lsquo;취소&rsquo;로 변경. 회차 차감 안 됨, 정원에서 빠짐. 완전 삭제는 없음 (이력 보존).
      </p>
    </div>
  )
}
