'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

interface Member { id: number; name: string; phone: string | null }
interface Instructor { id: number; name: string }
interface Room { id: number; name: string; isActive: boolean }

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
  const [rooms, setRooms] = useState<Room[]>([])
  const [memberQuery, setMemberQuery] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)
  // 만료 회원 가드 — 선택된 회원의 수강권 사용 가능 여부
  const [passGuard, setPassGuard] = useState<{ usable: boolean; reason: string } | null>(null)
  const [guardLoading, setGuardLoading] = useState(false)
  const [selectedInstructorId, setSelectedInstructorId] = useState<number | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)

  // 그룹/예약형 전용
  const [sessionName, setSessionName] = useState('')
  const [capacity, setCapacity] = useState(4)
  const [category, setCategory] = useState('그룹')

  // 종류 선택 시 정원 기본값 자동 (개인=1, 듀엣=2, 그룹=4) — 사용자가 바꿀 수 있음
  function changeCategory(c: string) {
    setCategory(c)
    if (c === '개인') setCapacity(1)
    else if (c === '듀엣') setCapacity(2)
    else if (c === '그룹') setCapacity(4)
  }

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 활성 룸만 표시
  const activeRooms = rooms.filter(r => r.isActive)

  // 모달 열릴 때 데이터 로드 + 날짜 prefill 갱신
  useEffect(() => {
    if (!open) return
    setDate(prefillDate)
    setError('')
    fetch('/api/members').then(r => r.json()).then((j: { members?: Member[] }) => setMembers(j.members ?? []))
    fetch('/api/instructors').then(r => r.json()).then((j: { instructors?: Instructor[] }) => setInstructors(j.instructors ?? []))
    fetch('/api/rooms').then(r => r.json()).then((j: { rooms?: Room[] }) => {
      setRooms(j.rooms ?? [])
      // 자동 선택 안 함 — 사용자가 명시적으로 미정/룸 선택
      setSelectedRoomId(null)
    })
  }, [open, prefillDate])

  useEffect(() => {
    const match = members.find(m => m.name === memberQuery)
    setSelectedMemberId(match?.id ?? null)
  }, [memberQuery, members])

  // 회원이 선택되면 수강권 가드 조회 (잔여 0회·기간 만료 = 무료 수업 위험 경고)
  useEffect(() => {
    if (type !== 'individual' || selectedMemberId == null) {
      setPassGuard(null)
      return
    }
    let cancelled = false
    setGuardLoading(true)
    setPassGuard(null)
    fetch(`/api/members/${selectedMemberId}/pass-guard`)
      .then(r => r.json())
      .then((g: { usable?: boolean; reason?: string }) => {
        if (cancelled) return
        setPassGuard({ usable: g.usable !== false, reason: g.reason ?? '' })
      })
      .catch(() => { if (!cancelled) setPassGuard(null) })
      .finally(() => { if (!cancelled) setGuardLoading(false) })
    return () => { cancelled = true }
  }, [selectedMemberId, type])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      // 룸은 선택사항 — 당일에 룸 정하는 경우 많다고 해서 강제 안 함.
      // 단, 룸이 정해진 경우엔 cross-table 충돌 검증은 API가 해줌.
      if (type === 'individual') {
        if (!selectedMemberId) { setError('회원을 선택하세요'); setSubmitting(false); return }
        // 만료 회원 가드 — 무료 수업 방지: 사용 가능 수강권 없으면 한 번 더 확인
        if (passGuard && !passGuard.usable) {
          const name = memberQuery || '이 회원'
          if (!confirm(`⚠ ${name}님은 ${passGuard.reason}.\n무료 수업이 될 수 있어요. 그래도 추가할까요?`)) {
            setSubmitting(false)
            return
          }
        }
        const res = await fetch('/api/lessons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: selectedMemberId,
            instructorId: selectedInstructorId,
            roomId: selectedRoomId,
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
            category,
            instructorId: selectedInstructorId,
            roomId: selectedRoomId,
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
      setPassGuard(null)
      setSessionName('')
      setCategory('그룹')
      setCapacity(4)
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
            className={`flex-1 min-h-[42px] py-2 text-sm font-medium rounded-md transition-colors ${
              type === 'individual' ? 'bg-white shadow-sm text-blue-600' : 'text-neutral-500'
            }`}
          >
            개별 수업
          </button>
          <button
            type="button"
            onClick={() => setType('group')}
            className={`flex-1 min-h-[42px] py-2 text-sm font-medium rounded-md transition-colors ${
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
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">시간</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                required
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
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
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
              <datalist id="quick-add-member-options">
                {members.map(m => <option key={m.id} value={m.name}>{m.phone ?? ''}</option>)}
              </datalist>
              {selectedMemberId && (
                guardLoading ? (
                  <div className="text-xs text-neutral-400 mt-1">✓ 매칭됨 · 수강권 확인 중…</div>
                ) : passGuard && !passGuard.usable ? (
                  <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mt-1">
                    ⚠ <b>{memberQuery}</b>님은 {passGuard.reason}. 이대로 추가하면 <b>무료 수업</b>이 될 수 있어요.
                  </div>
                ) : passGuard && passGuard.usable ? (
                  <div className="text-xs text-green-600 mt-1">✓ 매칭됨 · 이용 가능한 수강권 있음</div>
                ) : (
                  <div className="text-xs text-blue-600 mt-1">✓ 매칭됨</div>
                )
              )}
            </div>
          )}

          {/* 그룹/예약형 — 종류 + 세션 이름 + 정원 */}
          {type === 'group' && (
            <>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">수업 종류 (예약형)</label>
                <div className="flex gap-1">
                  {['개인', '재활', '듀엣', '그룹'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => changeCategory(c)}
                      className={`flex-1 min-h-[42px] py-2 text-sm rounded-md border ${
                        category === c ? 'bg-purple-600 text-white border-purple-600 font-medium' : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-neutral-400 mt-1">개인=정원 1 · 듀엣=2 · 그룹=정원만큼. 회원이 직접 예약하는 수업이에요. (급여도 종류대로 집계)</p>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">세션 이름 *</label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={e => setSessionName(e.target.value)}
                  required
                  placeholder="예: 월수금 10시 그룹"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
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
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </div>
            </>
          )}

          {/* 룸 — 선택사항. 2개 이상이면 셀렉터, 1개면 토글, 0개면 안내. 미정하면 당일에 정함. */}
          {activeRooms.length >= 2 && (
            <div>
              <label className="block text-xs text-neutral-500 mb-1">룸 (선택)</label>
              <select
                value={selectedRoomId ?? ''}
                onChange={e => setSelectedRoomId(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              >
                <option value="">미정 (당일 결정)</option>
                {activeRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          )}
          {activeRooms.length === 1 && (
            <div>
              <label className="block text-xs text-neutral-500 mb-1">룸 (선택)</label>
              <select
                value={selectedRoomId ?? ''}
                onChange={e => setSelectedRoomId(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              >
                <option value="">미정 (당일 결정)</option>
                <option value={activeRooms[0].id}>{activeRooms[0].name}</option>
              </select>
            </div>
          )}
          {activeRooms.length === 0 && (
            <div className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded p-2">
              💡 룸 관리는 <a href="/settings/operations" className="text-blue-600 underline">운영정보 설정</a>에서 가능. 지금은 룸 미정으로 저장됩니다.
            </div>
          )}

          {/* 강사 — 공통 */}
          <div>
            <label className="block text-xs text-neutral-500 mb-1">강사 (선택)</label>
            <select
              value={selectedInstructorId ?? ''}
              onChange={e => setSelectedInstructorId(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
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
              className="flex-1 inline-flex items-center justify-center min-h-[48px] text-sm font-medium border border-neutral-300 rounded-lg px-3 hover:bg-neutral-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 inline-flex items-center justify-center min-h-[48px] text-sm text-white font-medium rounded-lg px-3 shadow-sm ${
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
