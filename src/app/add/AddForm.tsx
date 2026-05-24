'use client'

import { useState, useEffect, useMemo, type FormEvent } from 'react'
import { Card } from '@/components/ui/Card'
import type { ExpenseCategory } from '@/lib/supabase/categories'

type TxType = '지출' | '매출'
type Method = '카드' | '계좌이체' | '현금'

const FALLBACK_CATEGORIES = [
  '매출', '식비', '임대료', '광고선전비', '소모품비', '수도광열비',
  '여비교통비', '경조사비', '대표자급여', '예비비', '기타',
]

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

interface RecentTx {
  id?: number
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
  const [paymentType, setPaymentType] = useState<'신규결제' | '재결제'>('신규결제')
  const [categories, setCategories] = useState<ExpenseCategory[]>([])

  useEffect(() => {
    fetchRecent()
    fetch('/api/members').then(r => r.json()).then((j: { members?: Array<{id: number; name: string; phone: string|null}> }) => setMembers(j.members ?? []))
    fetch('/api/instructors').then(r => r.json()).then((j: { instructors?: Array<{id: number; name: string}> }) => setInstructors(j.instructors ?? []))
    fetch('/api/pass-products').then(r => r.json()).then((j: { products?: Array<{id: number; name: string; passType: string; durationDays: number; totalCount: number; price: number}> }) => setProducts(j.products ?? []))
    fetch('/api/categories').then(r => r.json()).then((j: { categories?: ExpenseCategory[] }) => {
      if (j.categories && j.categories.length > 0) setCategories(j.categories)
    }).catch(() => { /* graceful — fallback */ })
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
    if (t === '지출' && rawCategory === '매출') {
      // 지출인데 카테고리가 '매출'이면 다른 기본 카테고리로
      setRawCategory(categories.length > 0 ? (categories.find(c => c.name !== '매출')?.name ?? '기타') : '식비')
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
      setRecent(sorted)
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

    const isPassIssuance = txType === '매출' && selectedMemberId && selectedPassProductId

    try {
      if (isPassIssuance) {
        const res = await fetch('/api/passes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: selectedMemberId,
            instructorId: selectedInstructorId,
            productId: selectedPassProductId,
            startDate: date,
            paymentAmount: Math.abs(amount),
            paymentMethod: method,
            paymentType,
            installment: '일시불',
          }),
        })
        const json = await res.json() as { ok?: boolean; error?: string }
        if (!res.ok) {
          setErrorMsg(json.error ?? '발급 실패')
          setStatus('error')
          return
        }
      } else {
        const signedAmount = txType === '매출' ? Math.abs(amount) : -Math.abs(amount)
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            rawCategory,
            amount: signedAmount,
            method,
            counterparty: counterparty || undefined,
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
      }

      setStatus('saved')
      setAmountStr('')
      setCounterparty('')
      setMemo('')
      setDate(today())
      setMemberQuery('')
      setSelectedMemberId(null)
      setSelectedInstructorId(null)
      setSelectedPassProductId(null)
      setPaymentType('신규결제')
      setTimeout(() => setStatus('idle'), 2500)
      await fetchRecent()
    } catch {
      setErrorMsg('네트워크 오류')
      setStatus('error')
    }
  }

  const isSupabaseMissing = status === 'error' && errorMsg.includes('Supabase 미설정')
  const isSalesMode = txType === '매출'

  // 최근 입력 필터: txType에 맞춰 매출(>0) 또는 지출(<0)만
  const filteredRecent = useMemo(() => {
    return recent.filter(tx => isSalesMode ? tx.amount > 0 : tx.amount < 0).slice(0, 5)
  }, [recent, isSalesMode])

  const selectedCategoryObj = useMemo(
    () => categories.find(c => c.name === rawCategory) ?? null,
    [categories, rawCategory],
  )

  // 매출 모드면 매출 카테고리 외엔 가리고, 지출 모드면 매출 카테고리는 가린다
  const visibleCategories = useMemo(() => {
    if (categories.length === 0) return FALLBACK_CATEGORIES.filter(c => isSalesMode ? c === '매출' : c !== '매출')
    return categories
      .filter(c => isSalesMode ? c.name === '매출' : c.name !== '매출')
      .map(c => c.name)
  }, [categories, isSalesMode])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
      {/* === 좌측: 폼 + 최근 입력 === */}
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

            {/* 매출 모드: 결제 구분 (회원/수강권 선택 전에도 항상 표시) */}
            {isSalesMode && (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <label className="block text-sm font-bold mb-2 text-blue-800">결제 구분 <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  {(['신규결제', '재결제'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPaymentType(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        paymentType === t
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-neutral-700 hover:bg-blue-100 border border-blue-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-blue-700 mt-1">
                  매출 리포트에서 <strong>&ldquo;{paymentType}&rdquo;</strong>로 분류 (체험 매출은 별도). 회원 + 수강권 모두 선택하면 자동으로 수강권 발급 처리됩니다.
                </div>
              </div>
            )}

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
                {visibleCategories.map(cat => (
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
              {selectedCategoryObj?.description && (
                <div className="text-xs text-neutral-600 bg-neutral-50 border border-neutral-200 rounded p-2 mt-2 lg:hidden">
                  💡 {selectedCategoryObj.description}
                </div>
              )}
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

            {/* 거래처 (선택) */}
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

            {/* 회원·강사·수강권 연동 (매출일 때만) */}
            {isSalesMode && (
              <>
                <div className="text-xs text-neutral-600 bg-blue-50 border border-blue-200 px-3 py-2 rounded">
                  💡 회원 + 수강권 둘 다 선택하시면 <strong>수강권 발급</strong>으로 자동 처리됩니다. 둘 중 하나라도 비우면 잡매출(가계부)로 기록.
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-600">회원</label>
                  <div className="text-xs text-neutral-400 mb-1">수강권 발급 시 필수</div>
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

            {/* 수강권 발급 힌트 */}
            {isSalesMode && selectedMemberId !== null && selectedPassProductId !== null && (
              <div className="text-xs text-blue-600 text-center">
                💡 저장 시 회원에게 수강권 발급됩니다 ({paymentType})
              </div>
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
              {status === 'saving' ? '저장 중...'
                : status === 'saved' ? '저장됨'
                : (isSalesMode && selectedMemberId && selectedPassProductId) ? `${paymentType} 발급`
                : '저장'}
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

        {/* 최근 입력 5건 (txType에 따라 매출/지출만) */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-500 mb-2">
            최근 {isSalesMode ? '매출' : '지출'} 입력
          </h3>
          {filteredRecent.length === 0 ? (
            <p className="text-sm text-neutral-400">아직 {isSalesMode ? '매출' : '지출'} 기록이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {filteredRecent.map((tx, i) => {
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

      {/* === 우측: 카테고리 설명 패널 (데스크탑만) === */}
      <aside className="hidden lg:block sticky top-4">
        <Card className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-700">📚 카테고리 가이드</h3>
            <p className="text-xs text-neutral-500 mt-0.5">세무사가 봐도 이해할 수 있는 회계 계정과목</p>
          </div>

          {selectedCategoryObj && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-blue-900">{selectedCategoryObj.name}</span>
                <div className="flex gap-1">
                  {selectedCategoryObj.vatDeductible && (
                    <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded">부가세↓</span>
                  )}
                  {selectedCategoryObj.incomeTaxDeductible && (
                    <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded">종소세 경비</span>
                  )}
                </div>
              </div>
              {selectedCategoryObj.description && (
                <p className="text-xs text-blue-900 leading-relaxed">{selectedCategoryObj.description}</p>
              )}
            </div>
          )}

          <div className="border-t border-neutral-200 pt-3 space-y-2 max-h-[55vh] overflow-y-auto">
            <div className="text-xs font-semibold text-neutral-500 sticky top-0 bg-white py-1">전체 항목</div>
            {(categories.length > 0 ? categories : []).map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setRawCategory(cat.name)}
                className={`w-full text-left p-2 rounded transition-colors ${
                  rawCategory === cat.name
                    ? 'bg-blue-100 border border-blue-300'
                    : 'hover:bg-neutral-50 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-800">{cat.name}</span>
                  <span className="text-[10px] text-neutral-400">
                    {cat.classification === 'business' ? '사업' : cat.classification === 'living' ? '생활' : cat.classification === 'capital' ? '자산' : cat.classification === 'owner_draw' ? '인출' : '적립'}
                  </span>
                </div>
                {cat.description && (
                  <p className="text-[11px] text-neutral-500 mt-0.5 leading-snug">{cat.description}</p>
                )}
              </button>
            ))}
            {categories.length === 0 && (
              <p className="text-xs text-neutral-400 p-2">
                카테고리 시드 미실행 — <code className="bg-neutral-100 px-1 rounded">npx tsx scripts/seed-categories.ts</code>
              </p>
            )}
          </div>

          <div className="border-t border-neutral-200 pt-2">
            <a href="/finances/categories" className="text-xs text-blue-600 hover:text-blue-800">
              → 카테고리 관리 (추가/수정/삭제)
            </a>
          </div>
        </Card>
      </aside>
    </div>
  )
}
