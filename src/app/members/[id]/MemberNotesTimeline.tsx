'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { toast } from '@/components/ui/toast'
import { MEMBER_NOTE_TAGS, type MemberNote } from '@/lib/supabase/member-notes'
import type { StudioRole } from '@/lib/supabase/auth-server'

interface InstructorRef { id: number; name: string; color: string | null }

const TAG_STYLE: Record<string, string> = {
  운동기록: 'bg-blue-100 text-blue-700 border-blue-200',
  특이사항: 'bg-amber-100 text-amber-700 border-amber-200',
  목표: 'bg-violet-100 text-violet-700 border-violet-200',
  등록시문제: 'bg-red-100 text-red-700 border-red-200',
  개선: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

function tagClass(tag: string): string {
  return TAG_STYLE[tag] ?? 'bg-neutral-100 text-neutral-600 border-neutral-200'
}

function formatDate(d: string): string {
  const [, m, day] = d.split('-').map(Number)
  return `${m}월 ${day}일`
}

export function MemberNotesTimeline({
  memberId, initial, instructors, currentRole, currentInstructorId, today,
}: {
  memberId: number
  initial: MemberNote[]
  instructors: InstructorRef[]
  currentRole: StudioRole
  currentInstructorId: number | null
  today: string
}) {
  const router = useRouter()
  const [notes, setNotes] = useState<MemberNote[]>(initial)
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(today)
  // 강사 로그인이면 작성자 본인 고정, 원장이면 드롭다운 선택
  const isInstructor = currentRole === 'instructor'
  const [authorId, setAuthorId] = useState<string>(
    isInstructor && currentInstructorId ? String(currentInstructorId) : '',
  )
  const [tags, setTags] = useState<Set<string>>(new Set(['운동기록']))
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const instructorName = (id: number | null) => instructors.find(i => i.id === id)?.name ?? null

  function toggleTag(t: string) {
    setTags(prev => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t); else next.add(t)
      return next
    })
  }

  async function save() {
    if (!content.trim()) { toast('내용을 입력해주세요', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/member-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          noteDate: date,
          content: content.trim(),
          tags: [...tags],
          authorInstructorId: authorId ? Number(authorId) : null,
        }),
      })
      const json = await res.json() as { ok?: boolean; id?: number; error?: string }
      if (!res.ok || !json.id) { toast(`저장 실패: ${json.error ?? 'unknown'}`, 'error'); return }
      // 낙관적 추가 (서버 author 강제값과 다를 수 있으니 refresh도 함께)
      const newNote: MemberNote = {
        id: json.id,
        memberId,
        noteDate: date,
        content: content.trim(),
        tags: [...tags],
        authorInstructorId: authorId ? Number(authorId) : (isInstructor ? currentInstructorId : null),
        authorName: instructorName(authorId ? Number(authorId) : currentInstructorId),
        lessonId: null,
        createdAt: new Date().toISOString(),
      }
      setNotes(prev => [newNote, ...prev])
      setContent(''); setTags(new Set(['운동기록']))
      toast('일지 저장됨', 'success')
      router.refresh()
    } catch {
      toast('저장 실패: 네트워크 오류', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    if (!confirm('이 기록을 삭제할까요?')) return
    const prev = notes
    setNotes(notes.filter(n => n.id !== id))
    try {
      const res = await fetch(`/api/member-notes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      setNotes(prev)
      toast('삭제 실패', 'error')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mt-6 mb-2">
        <h3 className="text-lg font-semibold">📝 운동 일지 ({notes.length})</h3>
        <button
          onClick={() => setOpen(o => !o)}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded shadow-sm"
        >
          {open ? '닫기' : '+ 기록 추가'}
        </button>
      </div>

      {open && (
        <Card className="p-3 mb-3 space-y-3 border-blue-200 bg-blue-50/30">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <label className="block text-xs text-neutral-500 mb-1">날짜</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-neutral-500 mb-1">담당 강사</label>
              {isInstructor ? (
                <div className="w-full border border-neutral-200 rounded px-2 py-1.5 text-sm bg-neutral-100 text-neutral-600">
                  {instructorName(currentInstructorId) ?? '본인'} (나)
                </div>
              ) : (
                <select
                  value={authorId}
                  onChange={e => setAuthorId(e.target.value)}
                  className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm bg-white"
                >
                  <option value="">선택 안 함</option>
                  {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">태그 (여러 개 선택 가능)</label>
            <div className="flex flex-wrap gap-1.5">
              {MEMBER_NOTE_TAGS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    tags.has(t) ? tagClass(t) : 'bg-white text-neutral-400 border-neutral-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">내용</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={3}
              placeholder="예: 코어+롤러 스트레칭. 어깨 가동 개선됨. 다음엔 하체 강도 ↑"
              className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
            />
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full sm:w-auto bg-neutral-900 text-white text-sm rounded px-4 py-2 disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </Card>
      )}

      {notes.length === 0 ? (
        <Card className="p-6 text-center text-sm text-neutral-400">
          아직 운동 기록이 없어요. 수업 후 그날 한 운동을 남겨두면 다음 루틴 짤 때 도움이 돼요.
        </Card>
      ) : (
        <ul className="space-y-2">
          {notes.map(n => (
            <li key={n.id}>
              <Card className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-sm font-semibold tabular-nums shrink-0">{formatDate(n.noteDate)}</span>
                    {n.tags.map(t => (
                      <span key={t} className={`text-[10px] px-2 py-0.5 rounded-full border ${tagClass(t)}`}>{t}</span>
                    ))}
                  </div>
                  <button
                    onClick={() => remove(n.id)}
                    className="text-xs text-neutral-300 hover:text-red-500 shrink-0"
                    title="삭제"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-sm text-neutral-800 mt-1.5 whitespace-pre-line break-keep">{n.content}</p>
                {n.authorName && (
                  <div className="text-[11px] text-neutral-400 mt-1.5">✍️ {n.authorName}</div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
