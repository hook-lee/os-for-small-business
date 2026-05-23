'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { Member } from '@/lib/supabase/members'

interface Props {
  members: Member[]
  currentFilter?: string
  totalCount?: number
  expiringCount?: number
  dormantCount?: number
}

export function MembersTable({ members, currentFilter = 'all', totalCount, expiringCount, dormantCount }: Props) {
  const router = useRouter()

  function changeFilter(f: string) {
    router.push(f === 'all' ? '/members' : `/members?filter=${f}`)
  }
  const [query, setQuery] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    gender: '',
    birthDate: '',
    memo: '',
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return members
    return members.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.phone ?? '').toLowerCase().includes(q) ||
      (m.email ?? '').toLowerCase().includes(q),
    )
  }, [members, query])

  function resetForm() {
    setForm({ name: '', phone: '', email: '', gender: '', birthDate: '', memo: '' })
    setShowAddForm(false)
  }

  async function handleAdd() {
    if (!form.name.trim()) {
      alert('이름을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          gender: form.gender || null,
          birthDate: form.birthDate || null,
          memo: form.memo.trim() || null,
        }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        alert(`추가 실패: ${json.error ?? 'unknown'}`)
        return
      }
      resetForm()
      router.refresh()
    } catch {
      alert('추가 실패: 네트워크 오류')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(m: Member) {
    if (!confirm(`${m.name} 회원 삭제할까요? 수강권 이력도 함께 삭제됩니다.`)) return
    try {
      const res = await fetch(`/api/members/${m.id}`, { method: 'DELETE' })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        alert(`삭제 실패: ${json.error ?? 'unknown'}`)
        return
      }
      router.refresh()
    } catch {
      alert('삭제 실패: 네트워크 오류')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-sm">
        <button onClick={() => changeFilter('all')} className={`px-3 py-1 rounded ${currentFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
          전체 ({totalCount ?? members.length})
        </button>
        <button onClick={() => changeFilter('expiring')} className={`px-3 py-1 rounded ${currentFilter === 'expiring' ? 'bg-amber-500 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
          만료 임박 ({expiringCount ?? 0})
        </button>
        <button onClick={() => changeFilter('dormant')} className={`px-3 py-1 rounded ${currentFilter === 'dormant' ? 'bg-red-500 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
          휴면 ({dormantCount ?? 0})
        </button>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="이름 / 전화번호 / 이메일 검색"
          className="w-full md:w-80 border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + 회원 추가
        </button>
      </div>

      {showAddForm && (
        <Card className="space-y-3">
          <div className="text-sm font-medium text-neutral-700">신규 회원 추가</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">이름 *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">전화번호</label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="010-0000-0000"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">이메일</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="example@email.com"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">성별</label>
              <select
                value={form.gender}
                onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">선택 안함</option>
                <option value="남성">남성</option>
                <option value="여성">여성</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">생년월일</label>
              <input
                type="date"
                value={form.birthDate}
                onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))}
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">메모</label>
              <input
                type="text"
                value={form.memo}
                onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="기타 메모"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700"
            >
              취소
            </button>
          </div>
        </Card>
      )}

      <div className="text-xs text-neutral-500">
        {query ? `검색 결과 ${filtered.length}건` : `전체 ${members.length}명`}
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">이름</th>
                <th className="text-left px-4 py-2 font-medium">전화번호</th>
                <th className="text-left px-4 py-2 font-medium">등록일</th>
                <th className="text-left px-4 py-2 font-medium">최근 출석</th>
                <th className="text-left px-4 py-2 font-medium">앱 연결</th>
                <th className="text-left px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-2">
                    <a href={`/members/${m.id}`} className="font-medium text-blue-600 hover:underline">
                      {m.name}
                    </a>
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{m.phone ?? '—'}</td>
                  <td className="px-4 py-2 text-neutral-600">{m.registeredAt ?? '—'}</td>
                  <td className="px-4 py-2 text-neutral-600">{m.lastAttendedAt ?? '—'}</td>
                  <td className="px-4 py-2">
                    {m.appConnected ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">연결</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-neutral-100 text-neutral-500">미연결</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleDelete(m)}
                      className="text-xs px-2 py-0.5 rounded text-red-600 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-400 text-sm">
                    {query ? '검색 결과 없음' : '회원이 아직 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
