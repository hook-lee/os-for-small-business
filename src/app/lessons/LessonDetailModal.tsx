'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { UnifiedLesson } from '@/lib/supabase/lessons-combined'
import { toast } from '@/components/ui/toast'

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
  const [date, setDate] = useState<string>('')
  const [time, setTime] = useState<string>('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // 개인수업 운동일지 빠른 입력
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)

  useEffect(() => {
    if (!open || !lesson) return
    setRoomId(lesson.roomId)
    setDate(lesson.date)
    setTime(lesson.time ?? '')
    setError('')
    setNoteOpen(false); setNoteContent('')
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
        lessonDate: date || lesson.date,   // 날짜 변경 + cross-table 충돌 검사
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

  async function saveNote() {
    if (!lesson || !lesson.memberId || !noteContent.trim()) return
    setNoteSaving(true)
    try {
      const res = await fetch('/api/member-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: lesson.memberId,
          noteDate: lesson.date,
          content: noteContent.trim(),
          tags: ['운동기록'],
          authorInstructorId: lesson.instructorId ?? null,
          lessonId: lesson.id,
        }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { toast(`일지 저장 실패: ${json.error ?? ''}`, 'error'); return }
      toast('운동 일지 저장됨 ✓', 'success')
      setNoteContent(''); setNoteOpen(false)
      router.refresh()
    } catch {
      toast('일지 저장 실패: 네트워크 오류', 'error')
    } finally {
      setNoteSaving(false)
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
          <div className="flex justify-between items-center">
            <span className="text-neutral-500">날짜</span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border border-neutral-300 rounded px-2 py-1 text-sm tabular-nums"
            />
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
            {isGroup ? (
              <span className="font-medium">
                {lesson.sessionName} ({lesson.reservedCount ?? 0}/{lesson.capacity ?? '—'})
              </span>
            ) : lesson.memberId != null ? (
              <a href={`/members/${lesson.memberId}`} className="font-medium text-blue-600 hover:underline">
                {lesson.memberName ?? '—'} →
              </a>
            ) : (
              <span className="font-medium">{lesson.memberName ?? '—'}</span>
            )}
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

        {/* 개인수업 — 오늘 운동 일지 빠른 기록 */}
        {!isGroup && lesson.memberId != null && (
          <div className="border-t border-neutral-100 pt-3">
            {!noteOpen ? (
              <button
                type="button"
                onClick={() => setNoteOpen(true)}
                className="w-full text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded px-3 py-2 font-medium"
              >
                📝 이 수업 운동 일지 쓰기
              </button>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs text-neutral-500">
                  오늘 운동 기록 · <b>{lesson.memberName ?? '회원'}</b>
                </label>
                <textarea
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  rows={3}
                  placeholder="예: 코어+롤러, 어깨 가동 개선. 다음엔 하체 강도 ↑"
                  className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveNote}
                    disabled={noteSaving}
                    className="text-sm bg-neutral-900 text-white rounded px-3 py-1.5 disabled:opacity-50"
                  >
                    {noteSaving ? '저장 중…' : '일지 저장'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNoteOpen(false); setNoteContent('') }}
                    className="text-sm border border-neutral-300 rounded px-3 py-1.5 hover:bg-neutral-50"
                  >
                    취소
                  </button>
                </div>
                <p className="text-[11px] text-neutral-400">태그·지난 기록은 회원 상세 → 운동 일지에서 볼 수 있어요.</p>
              </div>
            )}
          </div>
        )}

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
          {isGroup ? (
            <a
              href={`/lessons/groups/${lesson.id}`}
              className="text-sm border border-neutral-300 rounded px-3 py-2 hover:bg-neutral-50"
            >
              명단
            </a>
          ) : lesson.memberId != null ? (
            <a
              href={`/members/${lesson.memberId}`}
              className="text-sm border border-blue-200 text-blue-700 rounded px-3 py-2 hover:bg-blue-50"
            >
              회원 정보
            </a>
          ) : null}
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
