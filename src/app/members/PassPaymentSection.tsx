'use client'

import { useEffect, useState } from 'react'

interface Product {
  id: number
  name: string
  passType: string
  durationDays: number
  totalCount: number
  price: number
}
interface Instructor { id: number; name: string }

export interface PassPaymentDraft {
  enabled: boolean
  productId: string
  instructorId: string
  date: string
  paymentType: '신규결제' | '재결제'
  paymentMethod: '카드' | '계좌이체' | '현금'
  amount: string       // 실결제금액 (빈값=정가)
  bonusCount: string   // 회차 추가(+)/감소(-) — 서비스 1회 등. 빈값/0 = 조정 없음
  firstLessonEnabled: boolean   // 첫 수업(체험) 일정도 함께 잡기 → 시간표에 자동 등록
  firstLessonDate: string
  firstLessonTime: string
}

export function emptyPassPayment(today: string): PassPaymentDraft {
  return {
    enabled: false, productId: '', instructorId: '', date: today,
    paymentType: '신규결제', paymentMethod: '카드', amount: '', bonusCount: '',
    firstLessonEnabled: false, firstLessonDate: today, firstLessonTime: '10:00',
  }
}

/**
 * 회원 등록 시 "첫 결제(수강권 발급)"를 함께 잡는 선택 섹션.
 * 켜면 수강권/강사/날짜/결제수단/금액 입력 → 부모가 /api/passes로 발급(매출 자동).
 * 끄면(기본) 회원만 등록. = 회원 결제 정보는 '필수 아님'.
 */
export function PassPaymentSection({ value, onChange }: {
  value: PassPaymentDraft
  onChange: (v: PassPaymentDraft) => void
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])

  useEffect(() => {
    if (!value.enabled || products.length > 0) return
    fetch('/api/pass-products').then(r => r.json()).then((j: { products?: Product[] }) => setProducts(j.products ?? []))
    fetch('/api/instructors').then(r => r.json()).then((j: { instructors?: Instructor[] }) => setInstructors(j.instructors ?? []))
  }, [value.enabled, products.length])

  const set = (patch: Partial<PassPaymentDraft>) => onChange({ ...value, ...patch })
  const selected = products.find(p => String(p.id) === value.productId)

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-3">
      <label className="flex items-center gap-2 text-sm font-medium text-blue-900 cursor-pointer">
        <input type="checkbox" checked={value.enabled} onChange={e => set({ enabled: e.target.checked })} />
        💳 수강권도 함께 등록 — 켜면 매출이 자동으로 잡힙니다 (선택)
      </label>

      {value.enabled && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">수강권 상품 *</label>
            <select
              value={value.productId}
              onChange={e => set({ productId: e.target.value })}
              className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
            >
              <option value="">선택...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.passType} · {p.durationDays}일/{p.totalCount}회 · {p.price.toLocaleString()}원
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">회차 추가/감소 (서비스 등 · 선택)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                value={value.bonusCount}
                onChange={e => set({ bonusCount: e.target.value })}
                placeholder="예: 1 (1회 서비스), -2 (차감)"
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm tabular-nums"
              />
              {selected && (() => {
                const bonus = Math.floor(Number(value.bonusCount) || 0)
                const total = Math.max(0, selected.totalCount + bonus)
                return (
                  <span className="text-xs text-neutral-600 whitespace-nowrap">
                    → 최종 <b className="text-blue-700 tabular-nums">{total}</b>회
                    {bonus !== 0 && <span className="text-neutral-400"> ({selected.totalCount}{bonus > 0 ? '+' : ''}{bonus})</span>}
                  </span>
                )
              })()}
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">수강권 기본 회차에 더하거나(+) 뺍니다(−). 결제 금액·매출에는 영향 없어요.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">담당 강사</label>
              <select
                value={value.instructorId}
                onChange={e => set({ instructorId: e.target.value })}
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="">선택 안 함</option>
                {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">결제일(=시작일)</label>
              <input
                type="date"
                value={value.date}
                onChange={e => set({ date: e.target.value })}
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">결제 구분</label>
              <select
                value={value.paymentType}
                onChange={e => set({ paymentType: e.target.value as '신규결제' | '재결제' })}
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="신규결제">신규결제</option>
                <option value="재결제">재결제</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">결제 수단</label>
              <select
                value={value.paymentMethod}
                onChange={e => set({ paymentMethod: e.target.value as '카드' | '계좌이체' | '현금' })}
                className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="카드">카드</option>
                <option value="계좌이체">계좌이체</option>
                <option value="현금">현금</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">실제 결제 금액 (비우면 정가)</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={value.amount}
              onChange={e => set({ amount: e.target.value })}
              placeholder={selected ? `${selected.price.toLocaleString()} (정가)` : '0'}
              className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
            />
          </div>

          <div className="border-t border-blue-200/50 pt-2.5">
            <label className="flex items-center gap-2 text-sm font-medium text-blue-900 cursor-pointer">
              <input
                type="checkbox"
                checked={value.firstLessonEnabled}
                onChange={e => set({ firstLessonEnabled: e.target.checked })}
              />
              📅 첫 수업(체험) 일정도 잡기 — 시간표에 자동 등록 (선택)
            </label>
            {value.firstLessonEnabled && (
              <>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">수업 날짜</label>
                    <input
                      type="date"
                      value={value.firstLessonDate}
                      onChange={e => set({ firstLessonDate: e.target.value })}
                      className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">시간</label>
                    <input
                      type="time"
                      value={value.firstLessonTime}
                      onChange={e => set({ firstLessonTime: e.target.value })}
                      className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  위에서 고른 담당 강사로 수업이 잡혀요. 체험은 보통 1일짜리 수강권이라 이 일정이 곧 체험일이 됩니다.
                </p>
              </>
            )}
          </div>

          <p className="text-[11px] text-blue-700/80">
            ※ 저장하면 회원 등록 + 수강권 발급 + 같은 금액이 <b>가계부 매출로 자동 기록</b>됩니다. 할인했다면 실제 받은 금액을 적어주세요.
          </p>
        </div>
      )}
    </div>
  )
}
