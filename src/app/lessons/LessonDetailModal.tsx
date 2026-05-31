'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { UnifiedLesson } from '@/lib/supabase/lessons-combined'

interface Room { id: number; name: string; isActive: boolean }

/**
 * 통합 수업 뷰의 row·카드 클릭시 열리는 상세 모달.
 * 핵심: 룸 변경 + 시간 변경 + 삭제.
 *
 * - 개별: /api/lessons/[id] PATCH (room_id, lesson_time), DELETE
 * - 그룹: /api/group-sessions/[id] PATCH/DELETE
 *   그룹 + 예약자 존재 시 경고 후 강제 삭제.
 */
export function LessonDetailModal({
  lesson,
  open,
  onClose,
}: {
  lesson: UnifiedLesson | null
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])
  const [roomId, setRoomId] = useState<number | null>(null)
  const [time, setTime] = useState<string>('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !lesson) return
    setRoomId(lesson.roomId)
    setTime(lesson.time ?? '')
    setError('')
    fetch('/api/rooms').then(r => r.json()).then((j: { rooms?: Room[] }) => setRooms(j.rooms ?? []))
  }, [open, lesson])

  if (!open || !lesson) return null

  const isGroup = lesson.type === 'group'
  const apiBase = isGroup ? '/api/group-sessions' : '/api/lessons'
  const activeRooms = rooms.filter(r => r.isActive)

  async function handleSave() {
    if (!lesson) return
    // 룸은 선택사항 — 미정 상태 허용. 룸 지정시에만 충돌 검증 (서버에서 처리).
    setBusy(true); setError('')
    try {
      const body = {
        roomId,
        lessonTime: time || lesson.time,
        lessonDate: lesson.date,   // cross-table 충돌 검사용
      }
      const res = await fetch(`${apiBase}/${lesson.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(json.error ?? '저장 실패'); return }
      router.refresh()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!lesson) return
    let confirmMsg = '이 수업을 삭제하시겠습니까?'
    if (isGroup && (lesson.reservedCount ?? 0) > 0) {
      confirmMsg = `⚠ 이 그룹 수업에 ${lesson.reservedCount}명이 예약되어 있습니다.\n삭제하면 예약도 같이 사라집니다. (수강권 차감은 되돌리지 않음)\n정말 삭제하시겠습니까?`
    }
    if (!confirm(confirmMsg)) return
    setBusy(true); setError('')
    try {
      const res = await fetch(`${apiBase}/${lesson.id}`, { method: 'DELETE' })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(json.error ?? '삭제 실패'); return }
      router.refresh()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {isGroup ? '그룹' : '개별'} 수업 상세
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-xl leading-none">×</button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">날짜</span>
            <span className="font-medium">{lesson.date}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-500">시간</span>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="border border-neutral-300 rounded px-2 py-1 text-sm tabular-nums"
            />
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">{isGroup ? '세션' : '회원'}</span>
            <span className="font-medium">
              {isGroup
                ? `${lesson.sessionName} (${lesson.reservedCount ?? 0}/${lesson.capacity ?? '—'})`
                : (lesson.memberName ?? '—')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">강사</span>
            <span className="font-medium">{lesson.instructorName ?? '미정'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-500">룸 (선택)</span>
            {activeRooms.length === 0 ? (
              <span className="text-xs text-neutral-400">등록된 룸 없음</span>
            ) : (
              <select
                value={roomId ?? ''}
                onChange={e => setRoomId(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="border border-neutral-300 rounded px-2 py-1 text-sm"
              >
                <option value="">미정 (당일 결정)</option>
                {activeRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
          </div>
        </div>

        {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">⚠ {error}</div>}

        {isGroup && (lesson.reservedCount ?? 0) > 0 && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            ⚠ 이 수업에 {lesson.reservedCount}명이 예약되어 있습니다. 삭제 주의.
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="text-sm bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded px-3 py-2 disabled:opacity-50"
          >
            삭제
          </button>
          <a
            href={isGroup ? `/lessons/groups/${lesson.id}` : `/lessons/individual`}
            className="text-sm border border-neutral-300 rounded px-3 py-2 hover:bg-neutral-50"
          >
            {isGroup ? '명단' : '상세'}
          </a>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="text-sm border border-neutral-300 rounded px-3 py-2 hover:bg-neutral-50"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded px-3 py-2 disabled:opacity-50"
          >
            {busy ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
