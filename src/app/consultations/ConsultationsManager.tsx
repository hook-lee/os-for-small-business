'use client'
import { toast } from '@/components/ui/toast'

import { useState, useMemo, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { Consultation } from '@/lib/supabase/consultations'

interface InstructorRef { id: number; name: string }

const INFLOW_CHANNELS = ['방문상담', '전화', '카톡', '인스타', '광고', '지인소개', '기타']

export function ConsultationsManager({
  initialConsultations,
  instructors,
}: {
  initialConsultations: Consultation[]
  instructors: InstructorRef[]
}) {
  const router = useRouter()
  const [consultations, setConsultations] = useState(initialConsultations)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'converted'>('all')

  // 보조 필터
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [staffFilter, setStaffFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [query, setQuery] = useState('')

  // 폼 상태
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [channel, setChannel] = useState('방문상담')
  const [content, setContent] = useState('')
  const [staffId, setStaffId] = useState<number | null>(null)
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // xlsx import 데이터에 등장한 모든 인입경로 unique (라파의 실제 값 우선 노출)
  const usedChannels = useMemo(() => {
    const s = new Set<string>()
    consultations.forEach(c => { if (c.inflowChannel) s.add(c.inflowChannel) })
    INFLOW_CHANNELS.forEach(c => s.add(c))
    return Array.from(s)
  }, [consultations])

  // 등장한 담당스태프 unique
  const usedStaffs = useMemo(() => {
    const s = new Set<string>()
    consultations.forEach(c => { if (c.staffName) s.add(c.staffName) })
    instructors.forEach(i => s.add(i.name))
    return Array.from(s)
  }, [consultations, instructors])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return consultations.filter(c => {
      if (filter === 'pending' && c.convertedToMember) return false
      if (filter === 'converted' && !c.convertedToMember) return false
      if (channelFilter !== 'all' && c.inflowChannel !== channelFilter) return false
      if (staffFilter !== 'all' && c.staffName !== staffFilter) return false
      if (dateFrom && c.consultationDate < dateFrom) return false
      if (dateTo && c.consultationDate > dateTo) return false
      if (q) {
        const hit =
          c.name.toLowerCase().includes(q) ||
          (c.phone ?? '').toLowerCase().includes(q) ||
          (c.content ?? '').toLowerCase().includes(q)
        if (!hit) return false
      }
      return true
    })
  }, [consultations, filter, channelFilter, staffFilter, dateFrom, dateTo, query])

  const hasActiveFilter = channelFilter !== 'all' || staffFilter !== 'all' || dateFrom || dateTo || query

  function resetFilters() {
    setChannelFilter('all'); setStaffFilter('all'); setDateFrom(''); setDateTo(''); setQuery('')
  }

  async function reloadList() {
    try {
      const res = await fetch('/api/consultations')
      const j = await res.json() as { consultations?: Consultation[] }
      setConsultations(j.consultations ?? [])
      router.refresh()
    } catch { /* ignore */ }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('이름 필수'); return }
    setSubmitting(true); setError('')
    try {
      const staffName = staffId ? instructors.find(i => i.id === staffId)?.name : null
      const res = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          consultationDate: date,
          inflowChannel: channel,
          content: content.trim() || null,
          staffName,
          staffId,
          memo: memo.trim() || null,
        }),
      })
      const j = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(j.error ?? '저장 실패'); return }
      // 폼 리셋 + 닫기 + 리로드
      setName(''); setPhone(''); setContent(''); setMemo('')
      setShowAdd(false)
      await reloadList()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConvert(id: number) {
    if (!confirm('이 상담 고객을 회원으로 전환하시겠습니까?\n(이름+전화 일치하는 회원 있으면 기존 회원과 연결, 없으면 새로 생성)')) return
    try {
      const res = await fetch(`/api/consultations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'convert' }),
      })
      const j = await res.json() as { ok?: boolean; error?: string; memberId?: number; created?: boolean }
      if (!res.ok) { toast(j.error ?? '전환 실패'); return }
      toast(j.created ? '새 회원으로 등록됨' : '기존 회원과 연결됨')
      await reloadList()
    } catch (e) {
      toast((e as Error).message)
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`'${name}' 상담을 삭제하시겠습니까?`)) return
    try {
      const res = await fetch(`/api/consultations/${id}`, { method: 'DELETE' })
      const j = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { toast(j.error ?? '삭제 실패'); return }
      await reloadList()
    } catch (e) {
      toast((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">상담 고객</h2>
        <div className="flex items-center gap-2">
          {/* 필터 */}
          <div className="flex gap-0.5 bg-neutral-100 p-0.5 rounded">
            {([
              ['all', '전체'],
              ['pending', '미전환'],
              ['converted', '회원 전환됨'],
            ] as Array<['all' | 'pending' | 'converted', string]>).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`px-2.5 py-1 text-xs font-medium rounded ${
                  filter === k ? 'bg-white shadow-sm text-blue-600' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAdd(v => !v)}
            className={`text-sm font-medium px-3 py-1.5 rounded ${
              showAdd ? 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {showAdd ? '취소' : '+ 새 상담'}
          </button>
        </div>
      </div>

      {/* 통계 */}
      <div className="flex gap-3 text-sm text-neutral-600">
        <span>총 <strong className="text-neutral-900">{consultations.length}건</strong></span>
        <span className="text-neutral-300">·</span>
        <span>미전환 {consultations.filter(c => !c.convertedToMember).length}건</span>
        <span className="text-neutral-300">·</span>
        <span>전환 {consultations.filter(c => c.convertedToMember).length}건</span>
      </div>

      {/* 보조 필터 */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <FilterSelect
          label="인입경로"
          value={channelFilter}
          onChange={setChannelFilter}
          options={[{ value: 'all', label: '인입경로 전체' }, ...usedChannels.map(c => ({ value: c, label: c }))]}
        />
        <FilterSelect
          label="담당스태프"
          value={staffFilter}
          onChange={setStaffFilter}
          options={[{ value: 'all', label: '담당스태프 전체' }, ...usedStaffs.map(s => ({ value: s, label: s }))]}
        />
        <div className="inline-flex items-center gap-1">
          <span className="text-xs text-neutral-500">기간</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="text-sm border border-neutral-300 rounded px-2 py-1"
          />
          <span className="text-neutral-400 text-xs">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="text-sm border border-neutral-300 rounded px-2 py-1"
          />
        </div>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="이름 / 전화 / 내용 검색"
          className="flex-1 min-w-[200px] text-sm border border-neutral-300 rounded px-2 py-1"
        />
        {hasActiveFilter && (
          <button onClick={resetFilters} className="text-xs text-neutral-500 hover:text-red-600 underline">
            초기화
          </button>
        )}
      </div>

      {/* 추가 폼 */}
      {showAdd && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="이름 *">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                />
              </Field>
              <Field label="전화번호">
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="010-1234-5678"
                  className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                />
              </Field>
              <Field label="상담일자 *">
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                  className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                />
              </Field>
              <Field label="인입경로">
                <select
                  value={channel}
                  onChange={e => setChannel(e.target.value)}
                  className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                >
                  {INFLOW_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="담당스태프">
                <select
                  value={staffId ?? ''}
                  onChange={e => setStaffId(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                >
                  <option value="">선택 안 함</option>
                  {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="상담 내용">
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={3}
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="메모">
              <input
                value={memo}
                onChange={e => setMemo(e.target.value)}
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
              />
            </Field>
            {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">⚠ {error}</div>}
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-4 py-2 rounded text-sm"
            >
              {submitting ? '저장 중...' : '저장'}
            </button>
          </form>
        </Card>
      )}

      {/* 목록 */}
      {filtered.length === 0 ? (
        <Card>
          <div className="text-sm text-neutral-400 text-center py-8">
            {filter === 'all' ? '상담 기록이 없습니다.' : filter === 'pending' ? '미전환 상담이 없습니다.' : '전환된 상담이 없습니다.'}
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500 uppercase">
              <tr>
                <th className="text-left px-3 py-2 w-28">이름</th>
                <th className="text-left px-3 py-2 hidden md:table-cell whitespace-nowrap w-36">전화</th>
                <th className="text-left px-3 py-2 whitespace-nowrap w-28">상담일</th>
                <th className="text-left px-3 py-2 hidden md:table-cell whitespace-nowrap w-24">인입경로</th>
                <th className="text-left px-3 py-2 hidden lg:table-cell">내용</th>
                <th className="text-left px-3 py-2 hidden md:table-cell whitespace-nowrap w-24">담당</th>
                <th className="text-right px-3 py-2 whitespace-nowrap w-36">상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">
                    {c.memberId ? (
                      <a href={`/members/${c.memberId}`} className="text-blue-600 hover:underline">{c.name}</a>
                    ) : c.name}
                  </td>
                  <td className="px-3 py-2 text-neutral-600 hidden md:table-cell whitespace-nowrap tabular-nums">{c.phone ?? '—'}</td>
                  <td className="px-3 py-2 text-neutral-700 tabular-nums whitespace-nowrap">{c.consultationDate}</td>
                  <td className="px-3 py-2 text-neutral-600 hidden md:table-cell whitespace-nowrap">{c.inflowChannel ?? '—'}</td>
                  <td className="px-3 py-2 text-neutral-600 hidden lg:table-cell max-w-[200px] truncate">{c.content ?? '—'}</td>
                  <td className="px-3 py-2 text-neutral-600 hidden md:table-cell whitespace-nowrap">{c.staffName ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      {c.convertedToMember ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">전환됨</span>
                      ) : (
                        <button
                          onClick={() => handleConvert(c.id)}
                          className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded"
                        >
                          회원 전환
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        className="text-xs text-neutral-400 hover:text-red-600 px-1"
                        title="삭제"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-neutral-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

function FilterSelect({
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
