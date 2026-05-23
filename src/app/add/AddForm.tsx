'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { Card } from '@/components/ui/Card'

type TxType = '지출' | '매출'
type Method = '카드' | '계좌이체' | '현금'

const QUICK_CATEGORIES = [
  '매출', '식비', '임대료', '마케팅비', '소모품', '공과금',
  '교통비', '경조사비', '유진 급여', '예비비', '기타',
]

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

interface RecentTx {
  id?: number      // Supabase 출처면 존재. fixture 출처면 undefined (삭제 불가)
  date: string
  rawCategory: string
  amount: number
  method: string
}

export function AddForm() {
  const [txType, setTxType] = useState<TxType>('지출')
  const [date, setDate] = useState(today())
  const [rawCategory, setRawCategory] = useState('식비')
  const [amountStr, setAmountStr] = useState('')
  const [method, setMethod] = useState<Method>('카드')
  const [counterparty, setCounterparty] = useState('')
  const [person, setPerson] = useState('')
  const [memo, setMemo] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [recent, setRecent] = useState<RecentTx[]>([])
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [members, setMembers] = useState<Array<{id: number; name: string; phone: string|null}>>([])
  const [instructors, setInstructors] = useState<Array<{id: number; name: string}>>([])
  const [memberQuery, setMemberQuery] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState<number|null>(null)
  const [selectedInstructorId, setSelectedInstructorId] = useState<number|null>(null)
  const [products, setProducts] = useState<Array<{id: number; name: string; passType: string; durationDays: number; totalCount: number; price: number}>>([])
  const [selectedPassProductId, setSelectedPassProductId] = useState<number|null>(null)

  useEffect(() => {
    fetchRecent()
    fetch('/api/members').then(r => r.json()).then((j: { members?: Array<{id: number; name: string; phone: string|null}> }) => setMembers(j.members ?? []))
    fetch('/api/instructors').then(r => r.json()).then((j: { instructors?: Array<{id: number; name: string}> }) => setInstructors(j.instructors ?? []))
    fetch('/api/pass-products').then(r => r.json()).then((j: { products?: Array<{id: number; name: string; passType: string; durationDays: number; totalCount: number; price: number}> }) => setProducts(j.products ?? []))
  }, [])

  useEffect(() => {
    const match = members.find(m => m.name === memberQuery)
    setSelectedMemberId(match?.id ?? null)
  }, [memberQuery, members])

  useEffect(() => {
    if (selectedPassProductId) {
      const p = products.find(pr => pr.id === selectedPassProductId)
      if (p) setAmountStr(String(p.price))
    }
  }, [selectedPassProductId, products])

  function setTxTypeWithSync(t: TxType) {
    setTxType(t)
    if (t === '매출' && rawCategory !== '매출') {
      setRawCategory('매출')
    }
  }

  async function handleDelete(id: number, label: string) {
    if (!confirm(`${label}\n정말 삭제할까요?`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        alert(`삭제 실패: ${json.error ?? 'unknown'}`)
        return
      }
      await fetchRecent()
    } catch {
      alert('삭제 실패: 네트워크 오류')
    } finally {
      setDeletingId(null)
    }
  }

  async function fetchRecent() {
    try {
      const res = await fetch('/api/transactions')
      if (!res.ok) return
      const json = await res.json() as { transactions: RecentTx[] }
      const sorted = [...(json.transactions ?? [])].sort((a, b) => b.date.localeCompare(a.date))
      setRecent(sorted.slice(0, 5))
    } catch {
      // silent
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const amount = parseFloat(amountStr)
    if (!amountStr || isNaN(amount) || amount <= 0) {
      setErrorMsg('금액을 올바르게 입력하세요')
      return
    }
    setStatus('saving')
    setErrorMsg('')
    const signedAmount = txType === '매출' ? Math.abs(amount) : -Math.abs(amount)
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          rawCategory,
          amount: signedAmount,
          method,
          counterparty: counterparty || undefined,
          person: person || undefined,
          memo: memo || undefined,
          memberId: selectedMemberId,
          instructorId: selectedInstructorId,
          passProductId: selectedPassProductId,
        }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        setErrorMsg(json.error ?? '저장 실패')
        setStatus('error')
        return
      }
      setStatus('saved')
      setAmountStr('')
      setCounterparty('')
      setPerson('')
      setMemo('')
      setDate(today())
      setMemberQuery('')
      setSelectedMemberId(null)
      setSelectedInstructorId(null)
      setSelectedPassProductId(null)
      setTimeout(() => setStatus('idle'), 2500)
      await fetchRecent()
    } catch {
      setErrorMsg('네트워크 오류')
      setStatus('error')
    }
  }

  const isSupabaseMissing = status === 'error' && errorMsg.includes('Supabase 미설정')
  const showMemberInstructor = txType === '매출' || rawCategory === '매출'

  return (
    <div className="space-y-6 max-w-lg">
      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 매출/지출 토글 */}
          <div className="flex gap-2">
            {(['지출', '매출'] as TxType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTxTypeWithSync(t)}
                className={`flex-1 py-3 rounded-lg font-semibold text-base transition-colors ${
                  txType === t
                    ? t === '매출'
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-800 text-white'
                    : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* 금액 */}
          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-600">금액 (원)</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="100"
              placeholder="0"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-4 py-4 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* 카테고리 버튼 그리드 */}
          <div>
            <label className="block text-sm font-medium mb-2 text-neutral-600">카테고리</label>
            <div className="flex flex-wrap gap-2">
              {QUICK_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setRawCategory(cat)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    rawCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 결제 수단 */}
          <div>
            <label className="block text-sm font-medium mb-2 text-neutral-600">결제 수단</label>
            <div className="flex gap-2">
              {(['카드', '계좌이체', '현금'] as Method[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    method === m
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* 날짜 */}
          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-600">날짜</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 거래처 / 사람 (선택) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-neutral-600">거래처 (선택)</label>
              <input
                type="text"
                value={counterparty}
                onChange={e => setCounterparty(e.target.value)}
                placeholder="예: 쿠팡"
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-neutral-600">사람 (선택)</label>
              <input
                type="text"
                value={person}
                onChange={e => setPerson(e.target.value)}
                placeholder="예: 유진"
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-600">메모 (선택)</label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="간단한 메모"
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 회원·강사 연동 (매출일 때만) */}
          {showMemberInstructor && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-600">회원 (선택)</label>
                <input
                  type="text"
                  list="member-options"
                  value={memberQuery}
                  onChange={e => setMemberQuery(e.target.value)}
                  placeholder="회원 이름으로 검색 + 선택"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <datalist id="member-options">
                  {members.map(m => (
                    <option key={m.id} value={m.name}>{m.phone ?? ''}</option>
                  ))}
                </datalist>
                {selectedMemberId && <div className="text-xs text-blue-600 mt-1">✓ 매칭됨 (id={selectedMemberId})</div>}
                {memberQuery && !selectedMemberId && <div className="text-xs text-neutral-400 mt-1">매칭 없음 (저장은 됨, 회원 연결 안 됨)</div>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-600">강사 (선택)</label>
                <select
                  value={selectedInstructorId ?? ''}
                  onChange={e => setSelectedInstructorId(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">선택 안 함</option>
                  {instructors.map(i => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-600">수강권 (선택)</label>
                <select
                  value={selectedPassProductId ?? ''}
                  onChange={e => setSelectedPassProductId(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">선택 안 함</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.passType} · {p.durationDays}일/{p.totalCount}회 · {p.price.toLocaleString()}원
                    </option>
                  ))}
                </select>
                <div className="text-xs text-neutral-400 mt-1">선택하면 정가가 자동 입력됩니다 (수정 가능).</div>
              </div>
            </>
          )}

          {/* 저장 버튼 */}
          <button
            type="submit"
            disabled={status === 'saving'}
            className={`w-full py-4 rounded-lg text-white font-semibold text-base transition-colors ${
              status === 'saving'
                ? 'bg-blue-400 cursor-not-allowed'
                : status === 'saved'
                  ? 'bg-green-600'
                  : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {status === 'saving' ? '저장 중...' : status === 'saved' ? '저장됨' : '저장'}
          </button>

          {/* 오류 메시지 */}
          {(status === 'error' || errorMsg) && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {errorMsg}
              {isSupabaseMissing && (
                <p className="mt-1 text-xs text-red-500">
                  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정하세요.
                </p>
              )}
            </div>
          )}
        </form>
      </Card>

      {/* 최근 입력 5건 */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-500 mb-2">최근 입력</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-neutral-400">아직 거래가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((tx, i) => {
              const canDelete = typeof tx.id === 'number'
              const isDeleting = canDelete && deletingId === tx.id
              const label = `${tx.date} ${tx.rawCategory} ${tx.amount >= 0 ? '+' : ''}${tx.amount.toLocaleString('ko-KR')}원`
              return (
                <Card key={tx.id ?? `fx-${i}`} className="flex items-center justify-between py-2 px-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-neutral-400 w-24 shrink-0">{tx.date}</span>
                    <span className="text-sm font-medium">{tx.rawCategory}</span>
                    <span className="text-xs text-neutral-400">{tx.method}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-sm font-semibold tabular-nums ${tx.amount >= 0 ? 'text-blue-600' : 'text-neutral-800'}`}>
                      {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString('ko-KR')}원
                    </span>
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(tx.id!, label)}
                        disabled={isDeleting}
                        className="text-xs text-red-500 hover:text-red-700 disabled:text-neutral-300 px-2 py-1 rounded hover:bg-red-50"
                        aria-label="삭제"
                        title="삭제"
                      >
                        {isDeleting ? '...' : '삭제'}
                      </button>
                    ) : (
                      <span
                        className="text-xs text-neutral-300 px-2 py-1"
                        title="과거 시드 데이터 — 직접 삭제 불가"
                      >
                        —
                      </span>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
