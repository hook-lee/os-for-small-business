'use client'

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import type { Member } from '@/lib/supabase/members'

export function MembersTable({ members }: { members: Member[] }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return members
    return members.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.phone ?? '').toLowerCase().includes(q) ||
      (m.email ?? '').toLowerCase().includes(q),
    )
  }, [members, query])

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="이름 / 전화번호 / 이메일 검색"
        className="w-full md:w-80 border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
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
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-neutral-400 text-sm">
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
