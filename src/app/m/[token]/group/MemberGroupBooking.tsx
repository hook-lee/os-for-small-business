'use client'

import { useState } from 'react'
import type { GroupSession } from '@/lib/supabase/group-sessions'
import type { Pass } from '@/lib/supabase/passes'
import type { Reservation } from '@/lib/supabase/group-reservations'

interface Props {
  memberId: number
  sessions: GroupSession[]
  groupPasses: Pass[]
  myReservations: Reservation[]
}

export function MemberGroupBooking({ memberId, sessions, groupPasses, myReservations }: Props) {
  const [reservations, setReservations] = useState<Reservation[]>(myReservations)
  const [loading, setLoading] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Map session_id → reservation (only active ones)
  const activeReservationMap = new Map<number, Reservation>()
  for (const r of reservations) {
    if (r.status === 'reserved' || r.status === 'attended') {
      activeReservationMap.set(r.sessionId, r)
    }
  }

  // Pick best pass: smallest remaining > 0 first
  const bestGroupPass = groupPasses
    .filter(p => (p.remainingCount ?? 0) > 0)
    .sort((a, b) => (a.remainingCount ?? 0) - (b.remainingCount ?? 0))[0] ?? null

  async function handleReserve(sessionId: number) {
    if (!bestGroupPass) return
    setError(null)
    setLoading(sessionId)
    try {
      const res = await fetch('/api/group-reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, memberId, passId: bestGroupPass.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '예약 실패')
      // Add optimistic reservation
      setReservations(prev => [
        ...prev,
        {
          id: json.id,
          sessionId,
          memberId,
          memberName: '',
          memberPhone: null,
          passId: bestGroupPass.id,
          status: 'reserved',
          deducted: false,
          reservedAt: new Date().toISOString(),
          cancelledAt: null,
        },
      ])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(null)
    }
  }

  async function handleCancel(reservationId: number, sessionId: number) {
    setError(null)
    setLoading(sessionId)
    try {
      const res = await fetch(`/api/group-reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '취소 실패')
      setReservations(prev =>
        prev.map(r => r.id === reservationId ? { ...r, status: 'cancelled' } : r)
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(null)
    }
  }

  const hasGroupPass = groupPasses.length > 0
  const hasRemainingPass = bestGroupPass !== null

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">그룹 수업 예약</h1>

      {/* Pass summary */}
      {!hasGroupPass ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          그룹 수강권이 없습니다. 수강권 구매 후 예약이 가능합니다.
        </div>
      ) : !hasRemainingPass ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          그룹 수강권 잔여 횟수가 없습니다.
        </div>
      ) : (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
          <div className="text-xs text-teal-600 font-semibold">사용 수강권</div>
          <div className="font-semibold mt-0.5">{bestGroupPass.passName}</div>
          <div className="text-sm text-teal-700 mt-1">
            잔여 <span className="font-bold text-teal-600">{bestGroupPass.remainingCount}</span>회
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-sm text-neutral-400">
          예약 가능한 그룹 세션이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => {
            const myRes = activeReservationMap.get(s.id)
            const isReserved = !!myRes
            const isFull = s.reservedCount >= s.capacity && !isReserved
            const isLoading = loading === s.id

            let buttonLabel = '예약하기'
            let buttonDisabled = false
            let buttonClass = 'bg-teal-600 hover:bg-teal-700 text-white'

            if (isReserved) {
              buttonLabel = '예약 취소'
              buttonClass = 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
            } else if (isFull) {
              buttonLabel = '정원 마감'
              buttonDisabled = true
              buttonClass = 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
            } else if (!hasGroupPass) {
              buttonLabel = '그룹 수강권 없음'
              buttonDisabled = true
              buttonClass = 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
            } else if (!hasRemainingPass) {
              buttonLabel = '수강권 잔여 부족'
              buttonDisabled = true
              buttonClass = 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
            }

            return (
              <div key={s.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{s.sessionName}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {s.lessonDate.slice(5).replace('-', '/')} {s.lessonTime}
                      {s.instructorName && ` · ${s.instructorName}`}
                    </div>
                    <div className="text-xs mt-1">
                      <span className={`${s.reservedCount >= s.capacity ? 'text-red-500' : 'text-teal-600'}`}>
                        {s.reservedCount}/{s.capacity}명
                      </span>
                      {isReserved && (
                        <span className="ml-2 text-teal-600 font-medium">· 예약됨</span>
                      )}
                    </div>
                  </div>
                  <button
                    disabled={buttonDisabled || isLoading}
                    onClick={() => {
                      if (isReserved && myRes) {
                        handleCancel(myRes.id, s.id)
                      } else {
                        handleReserve(s.id)
                      }
                    }}
                    className={`shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-60 ${buttonClass}`}
                  >
                    {isLoading ? '처리 중...' : buttonLabel}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
