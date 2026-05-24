'use client'

import { useState } from 'react'
import type { GroupSession } from '@/lib/supabase/group-sessions'
import type { Reservation, ReservationStatus } from '@/lib/supabase/group-reservations'

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
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [updating, setUpdating] = useState<number | null>(null)

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
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setUpdating(null)
    }
  }

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
          예약 {session.reservedCount}/{session.capacity}명 · 출석 {session.attendedCount}명
        </div>
        {session.notes && <div className="text-xs text-neutral-400 mt-1">{session.notes}</div>}
      </div>

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
                        <option value="cancelled">취소</option>
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
    </div>
  )
}
