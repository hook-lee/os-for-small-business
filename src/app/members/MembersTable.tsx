'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { Member } from '@/lib/supabase/members'
import { MEMBER_STATUS_LABEL, type MemberStatus } from '@/lib/analytics/member-status'

type ActivePassInfo = {
  passName: string
  passType: string | null
  startDate: string | null
  endDate: string | null
  totalCount: number | null
  remainingCount: number | null
  paidAt: string | null
}

interface EnrichedMember extends Member {
  _status: MemberStatus
  _passType: '프라이빗' | '그룹' | null
  _remainingCount: number | null
  _daysToExpire: number | null
}

interface Props {
  members: EnrichedMember[]
  statusCounts: Record<MemberStatus, number>
  activePassMap?: Record<number, ActivePassInfo>
}

type StatusFilter = 'all' | MemberStatus
type PassTypeFilter = 'all' | '프라이빗' | '그룹'
type ExpireFilter = 'all' | '7d' | '14d' | '30d'   // 잔여 N일 이내
type RemainingFilter = 'all' | 'low' | 'zero'      // 잔여 ≤2 / =0

export function MembersTable({ members, statusCounts, activePassMap = {} }: Props) {
  const router = useRouter()

  const [status, setStatus] = useState<StatusFilter>('all')
  const [passType, setPassType] = useState<PassTypeFilter>('all')
  const [expireFilter, setExpireFilter] = useState<ExpireFilter>('all')
  const [remainingFilter, setRemainingFilter] = useState<RemainingFilter>('all')
  const [query, setQuery] = useState('')

  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', phone: '', email: '', gender: '', birthDate: '', memo: '',
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members.filter(m => {
      if (status !== 'all' && m._status !== status) return false
      if (passType !== 'all' && m._passType !== passType) return false
      if (expireFilter !== 'all') {
        const limit = expireFilter === '7d' ? 7 : expireFilter === '14d' ? 14 : 30
        if (m._daysToExpire === null || m._daysToExpire > limit || m._daysToExpire < 0) return false
      }
      if (remainingFilter === 'low' && (m._remainingCount ?? -1) > 2) return false
      if (remainingFilter === 'zero' && (m._remainingCount ?? -1) !== 0) return false
      if (q) {
        const hit =
          m.name.toLowerCase().includes(q) ||
          (m.phone ?? '').toLowerCase().includes(q) ||
          (m.email ?? '').toLowerCase().includes(q)
        if (!hit) return false
      }
      return true
    })
  }, [members, status, passType, expireFilter, remainingFilter, query])

  function resetForm() {
    setForm({ name: '', phone: '', email: '', gender: '', birthDate: '', memo: '' })
    setShowAddForm(false)
  }

  async function handleAdd() {
    if (!form.name.trim()) { alert('이름을 입력해주세요.'); return }
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
      if (!res.ok) { alert(`추가 실패: ${json.error ?? 'unknown'}`); return }
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
      if (!res.ok) { alert(`삭제 실패: ${json.error ?? 'unknown'}`); return }
      router.refresh()
    } catch {
      alert('삭제 실패: 네트워크 오류')
    }
  }

  const total = members.length

  return (
    <div className="space-y-3">
      {/* 상태 토글 */}
      <div className="flex flex-wrap gap-2 text-sm">
        <StatusBtn label={`전체 (${total})`} active={status === 'all'} onClick={() => setStatus('all')} color="blue" />
        <StatusBtn label={`${MEMBER_STATUS_LABEL.active} (${statusCounts.active})`} active={status === 'active'} onClick={() => setStatus('active')} color="green" />
        <StatusBtn label={`${MEMBER_STATUS_LABEL.expired} (${statusCounts.expired})`} active={status === 'expired'} onClick={() => setStatus('expired')} color="amber" />
        <StatusBtn label={`${MEMBER_STATUS_LABEL.no_pass} (${statusCounts.no_pass})`} active={status === 'no_pass'} onClick={() => setStatus('no_pass')} color="neutral" />
      </div>

      {/* 보조 필터들 */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Select
          label="수강권 종류"
          value={passType}
          onChange={v => setPassType(v as PassTypeFilter)}
          options={[
            { value: 'all', label: '전체 수강권' },
            { value: '프라이빗', label: '프라이빗' },
            { value: '그룹', label: '그룹' },
          ]}
        />
        <Select
          label="잔여 기간"
          value={expireFilter}
          onChange={v => setExpireFilter(v as ExpireFilter)}
          options={[
            { value: 'all', label: '전체 기간' },
            { value: '7d', label: '7일 이내 만료' },
            { value: '14d', label: '14일 이내 만료' },
            { value: '30d', label: '30일 이내 만료' },
          ]}
        />
        <Select
          label="잔여 횟수"
          value={remainingFilter}
          onChange={v => setRemainingFilter(v as RemainingFilter)}
          options={[
            { value: 'all', label: '전체 횟수' },
            { value: 'low', label: '잔여 ≤ 2회' },
            { value: 'zero', label: '잔여 0회' },
          ]}
        />
        {(status !== 'all' || passType !== 'all' || expireFilter !== 'all' || remainingFilter !== 'all' || query) && (
          <button
            onClick={() => { setStatus('all'); setPassType('all'); setExpireFilter('all'); setRemainingFilter('all'); setQuery('') }}
            className="text-xs text-neutral-500 hover:text-red-600 underline"
          >
            초기화
          </button>
        )}
      </div>

      {/* 검색 + 회원추가 */}
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
            <FormField label="이름 *">
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm" placeholder="홍길동" />
            </FormField>
            <FormField label="전화번호">
              <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm" placeholder="010-0000-0000" />
            </FormField>
            <FormField label="이메일">
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm" placeholder="example@email.com" />
            </FormField>
            <FormField label="성별">
              <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm">
                <option value="">선택 안함</option>
                <option value="남성">남성</option>
                <option value="여성">여성</option>
              </select>
            </FormField>
            <FormField label="생년월일">
              <input type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm" />
            </FormField>
            <FormField label="메모">
              <input type="text" value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm" placeholder="기타 메모" />
            </FormField>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300">
              {saving ? '저장 중...' : '저장'}
            </button>
            <button onClick={resetForm} className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700">취소</button>
          </div>
        </Card>
      )}

      <div className="text-xs text-neutral-500">
        결과 <strong className="text-neutral-700">{filtered.length}명</strong> / 전체 {total}명
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium whitespace-nowrap">이름</th>
                <th className="text-left px-4 py-2 font-medium whitespace-nowrap w-24">상태</th>
                <th className="text-left px-4 py-2 font-medium whitespace-nowrap w-36">전화번호</th>
                <th className="text-left px-4 py-2 font-medium whitespace-nowrap">수강권</th>
                <th className="text-left px-4 py-2 font-medium whitespace-nowrap w-56">기간</th>
                <th className="text-right px-4 py-2 font-medium whitespace-nowrap w-24">잔여</th>
                <th className="text-left px-4 py-2 font-medium whitespace-nowrap w-28">최근 출석</th>
                <th className="text-left px-4 py-2 font-medium whitespace-nowrap w-16">앱</th>
                <th className="px-4 py-2 whitespace-nowrap w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const ap = activePassMap[m.id]
                const isLowRemaining = (m._remainingCount ?? -1) >= 0 && (m._remainingCount ?? 0) <= 1
                const isExpiringSoon = m._daysToExpire !== null && m._daysToExpire <= 7 && m._daysToExpire >= 0
                return (
                  <tr key={m.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <a href={`/members/${m.id}`} className="font-medium text-blue-600 hover:underline">
                        {m.name}
                      </a>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <StatusBadge status={m._status} />
                    </td>
                    <td className="px-4 py-2 text-neutral-600 whitespace-nowrap tabular-nums">{m.phone ?? '—'}</td>
                    <td className="px-4 py-2 text-neutral-600 whitespace-nowrap">
                      {ap?.passName ? (
                        <>
                          {ap.passName}
                          {ap.passType && <span className="ml-1 text-[10px] text-neutral-400">{ap.passType}</span>}
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2 text-neutral-600 text-xs whitespace-nowrap tabular-nums">
                      {ap?.startDate && ap?.endDate ? (
                        <>
                          {ap.startDate} ~ {ap.endDate}
                          {isExpiringSoon && <span className="ml-1 text-amber-600 font-semibold">D-{m._daysToExpire}</span>}
                        </>
                      ) : '—'}
                    </td>
                    <td className={`px-4 py-2 text-right tabular-nums whitespace-nowrap ${isLowRemaining ? 'text-red-600 font-semibold' : 'text-neutral-600'}`}>
                      {m._remainingCount !== null ? `${m._remainingCount} / ${ap?.totalCount ?? '—'}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-neutral-600 text-xs tabular-nums whitespace-nowrap">
                      {m.lastAttendedAt ?? '—'}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {m.appConnected ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">연결</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-neutral-100 text-neutral-500">미연결</span>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <button onClick={() => handleDelete(m)} className="text-xs px-2 py-0.5 rounded text-red-600 hover:bg-red-50">삭제</button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-neutral-400 text-sm">
                    조건에 맞는 회원이 없습니다.
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

// ─────────────────────────────────────────────
function StatusBtn({
  label, active, onClick, color,
}: {
  label: string
  active: boolean
  onClick: () => void
  color: 'blue' | 'green' | 'amber' | 'neutral'
}) {
  const palette = {
    blue: active ? 'bg-blue-600 text-white' : 'text-blue-600 hover:bg-blue-50',
    green: active ? 'bg-green-600 text-white' : 'text-green-600 hover:bg-green-50',
    amber: active ? 'bg-amber-500 text-white' : 'text-amber-600 hover:bg-amber-50',
    neutral: active ? 'bg-neutral-700 text-white' : 'text-neutral-600 hover:bg-neutral-100',
  }
  return (
    <button onClick={onClick} className={`px-3 py-1 rounded font-medium ${palette[color]}`}>
      {label}
    </button>
  )
}

function StatusBadge({ status }: { status: MemberStatus }) {
  const colors = {
    active: 'bg-green-100 text-green-700',
    expired: 'bg-amber-100 text-amber-700',
    no_pass: 'bg-neutral-100 text-neutral-500',
  }
  return <span className={`text-xs px-2 py-0.5 rounded ${colors[status]}`}>{MEMBER_STATUS_LABEL[status]}</span>
}

function Select({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <span className="text-xs text-neutral-500">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-sm border border-neutral-300 rounded px-2 py-1"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-neutral-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
