'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'

interface Room {
  id: number
  name: string
  displayOrder: number
  isActive: boolean
}

/**
 * 룸 관리 카드 — /settings/operations 안에 마운트.
 * - 룸 목록 표시 + 추가 / 이름수정 / 활성토글 / 삭제
 * - 삭제는 ON DELETE SET NULL이라 기존 수업의 room_id가 NULL이 됨 (이력 보존).
 */
export function RoomsManager() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/rooms')
      const j = await res.json() as { rooms?: Room[] }
      setRooms(j.rooms ?? [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleAdd() {
    if (!newName.trim()) { setError('룸 이름 입력하세요'); return }
    setError('')
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), displayOrder: rooms.length }),
    })
    const j = await res.json() as { ok?: boolean; error?: string }
    if (!res.ok) { setError(j.error ?? '추가 실패'); return }
    setNewName('')
    await load()
  }

  async function handleRename(id: number, name: string) {
    if (!name.trim()) return
    const res = await fetch(`/api/rooms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    const j = await res.json() as { ok?: boolean; error?: string }
    if (!res.ok) { setError(j.error ?? '수정 실패'); return }
    await load()
  }

  async function handleToggleActive(id: number, isActive: boolean) {
    const res = await fetch(`/api/rooms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    const j = await res.json() as { ok?: boolean; error?: string }
    if (!res.ok) { setError(j.error ?? '변경 실패'); return }
    await load()
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`'${name}' 룸을 완전히 삭제하시겠습니까?\n(기존 수업의 룸 정보는 '미지정'으로 변경됨, 수업 자체는 보존)`)) return
    const res = await fetch(`/api/rooms/${id}`, { method: 'DELETE' })
    const j = await res.json() as { ok?: boolean; error?: string }
    if (!res.ok) { setError(j.error ?? '삭제 실패'); return }
    await load()
  }

  return (
    <Card>
      <div className="mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-bold text-neutral-400 tabular-nums">07</span>
          <h3 className="text-sm font-semibold text-neutral-800">룸 관리</h3>
        </div>
        <p className="text-xs text-neutral-500 mt-1 ml-6">
          스튜디오의 수업 공간을 등록합니다. 수업 추가 시 룸을 선택할 수 있고, 같은 룸·같은 시간에 수업 중복을 방지합니다.
        </p>
      </div>

      <div className="ml-6 space-y-3">
        {loading ? (
          <div className="text-sm text-neutral-400">불러오는 중...</div>
        ) : (
          <>
            {/* 룸 목록 */}
            {rooms.length === 0 ? (
              <div className="text-xs text-neutral-400">등록된 룸이 없습니다.</div>
            ) : (
              <ul className="space-y-2">
                {rooms.map(r => (
                  <RoomRow
                    key={r.id}
                    room={r}
                    onRename={name => handleRename(r.id, name)}
                    onToggleActive={() => handleToggleActive(r.id, r.isActive)}
                    onDelete={() => handleDelete(r.id, r.name)}
                  />
                ))}
              </ul>
            )}

            {/* 추가 */}
            <div className="flex gap-2 pt-2 border-t border-neutral-100">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="새 룸 이름 (예: 필라테스 A실)"
                className="flex-1 border border-neutral-300 rounded px-2 py-1.5 text-sm"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
              />
              <button
                type="button"
                onClick={handleAdd}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded"
              >
                + 추가
              </button>
            </div>

            {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">⚠ {error}</div>}
          </>
        )}
      </div>
    </Card>
  )
}

function RoomRow({ room, onRename, onToggleActive, onDelete }: {
  room: Room
  onRename: (name: string) => void
  onToggleActive: () => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(room.name)

  return (
    <li className="flex items-center gap-2 text-sm">
      {editing ? (
        <>
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onRename(draft); setEditing(false) } }}
            className="flex-1 border border-neutral-300 rounded px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => { onRename(draft); setEditing(false) }}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
          >
            저장
          </button>
          <button
            type="button"
            onClick={() => { setDraft(room.name); setEditing(false) }}
            className="text-xs text-neutral-500 hover:text-neutral-800"
          >
            취소
          </button>
        </>
      ) : (
        <>
          <span className={`flex-1 ${room.isActive ? 'text-neutral-800' : 'text-neutral-400 line-through'}`}>
            {room.name}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-neutral-500 hover:text-blue-600"
          >
            이름수정
          </button>
          <button
            type="button"
            onClick={onToggleActive}
            className="text-xs text-neutral-500 hover:text-amber-600"
            title={room.isActive ? '숨김 처리 (수업 추가시 선택 불가)' : '활성화'}
          >
            {room.isActive ? '숨김' : '활성화'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-neutral-500 hover:text-red-600"
            title="완전 삭제 (기존 수업은 룸 미지정 상태로)"
          >
            삭제
          </button>
        </>
      )}
    </li>
  )
}
