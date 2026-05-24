'use client'

import { useState } from 'react'
import type { GroupSession } from '@/lib/supabase/group-sessions'
import type { Instructor } from '@/lib/supabase/instructors'

interface Props {
  initialSessions: GroupSession[]
  instructors: Instructor[]
}

export function GroupSessionsManager({ initialSessions, instructors }: Props) {
  const [sessions, setSessions] = useState<GroupSession[]>(initialSessions)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    sessionName: '',
    instructorId: '',
    lessonDate: new Date().toISOString().slice(0, 10),
    lessonTime: '10:00',
    capacity: '4',
    durationMinutes: '50',
    notes: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/group-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionName: form.sessionName,
          instructorId: form.instructorId ? Number(form.instructorId) : null,
          lessonDate: form.lessonDate,
          lessonTime: form.lessonTime,
          capacity: Number(form.capacity),
          durationMinutes: Number(form.durationMinutes),
          notes: form.notes || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '생성 실패')
      // Refresh list
      const listRes = await fetch('/api/group-sessions')
      const listJson = await listRes.json()
      setSessions(listJson.sessions ?? [])
      setShowForm(false)
      setForm({
        sessionName: '',
        instructorId: '',
        lessonDate: new Date().toISOString().slice(0, 10),
        lessonTime: '10:00',
        capacity: '4',
        durationMinutes: '50',
        notes: '',
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('이 세션을 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/api/group-sessions/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? '삭제 실패')
      }
      setSessions(s => s.filter(x => x.id !== id))
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">그룹 수업</h1>
        <button
          onClick={() => setShowForm(f => !f)}
          className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? '취소' : '+ 그룹 세션'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl p-4 space-y-3 shadow-sm border border-blue-100">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">세션 이름 *</label>
            <input
              name="sessionName"
              value={form.sessionName}
              onChange={handleChange}
              required
              placeholder="예: 월수금 10시 그룹"
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">강사</label>
              <select
                name="instructorId"
                value={form.instructorId}
                onChange={handleChange}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">미지정</option>
                {instructors.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">정원 *</label>
              <input
                name="capacity"
                type="number"
                min="1"
                value={form.capacity}
                onChange={handleChange}
                required
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">날짜 *</label>
              <input
                name="lessonDate"
                type="date"
                value={form.lessonDate}
                onChange={handleChange}
                required
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">시간 *</label>
              <input
                name="lessonTime"
                type="time"
                value={form.lessonTime}
                onChange={handleChange}
                required
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">메모</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={2}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {error && <div className="text-red-500 text-xs">{error}</div>}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '저장 중...' : '세션 생성'}
          </button>
        </form>
      )}

      {sessions.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-sm text-neutral-400">
          예정된 그룹 세션이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => (
            <div key={s.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{s.sessionName}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {s.lessonDate} {s.lessonTime}
                    {s.instructorName && ` · ${s.instructorName}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-medium text-blue-600">
                    예약 {s.reservedCount}/{s.capacity}명
                  </span>
                  <a
                    href={`/lessons/groups/${s.id}`}
                    className="text-xs text-neutral-500 hover:text-blue-600 border border-neutral-200 rounded px-2 py-0.5"
                  >
                    명단 →
                  </a>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-xs text-red-400 hover:text-red-600"
                    title="세션 삭제"
                  >
                    삭제
                  </button>
                </div>
              </div>
              {s.notes && (
                <div className="text-xs text-neutral-400 mt-1.5 truncate">{s.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
