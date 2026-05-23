'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'

interface Product {
  id: number
  name: string
  passType: string
  durationDays: number
  totalCount: number
  price: number
}

interface Instructor {
  id: number
  name: string
}

export function IssuePassForm({ memberId }: { memberId: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [productId, setProductId] = useState<number | null>(null)
  const [instructorId, setInstructorId] = useState<number | null>(null)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [customAmount, setCustomAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'카드' | '계좌이체' | '현금'>('카드')
  const [paymentType, setPaymentType] = useState<'신규결제' | '재결제'>('신규결제')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && products.length === 0) {
      fetch('/api/pass-products')
        .then(r => r.json())
        .then((j: { products?: Product[] }) => setProducts(j.products ?? []))
      fetch('/api/instructors')
        .then(r => r.json())
        .then((j: { instructors?: Instructor[] }) => setInstructors(j.instructors ?? []))
    }
  }, [open, products.length])

  const selectedProduct = products.find(p => p.id === productId)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!productId) {
      setError('상품을 선택하세요')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/passes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          instructorId,
          productId,
          startDate,
          paymentAmount: customAmount ? parseInt(customAmount, 10) : undefined,
          paymentMethod,
          paymentType,
        }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        setError(json.error ?? '저장 실패')
        return
      }
      setOpen(false)
      setProductId(null)
      setCustomAmount('')
      router.refresh()
    } catch {
      setError('네트워크 오류')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
      >
        + 수강권 발급
      </button>
    )
  }

  return (
    <Card className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1 text-neutral-600">상품</label>
          <select
            value={productId ?? ''}
            onChange={e => setProductId(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
            required
          >
            <option value="">선택...</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.passType} · {p.durationDays}일 / {p.totalCount}회 · {p.price.toLocaleString()}원
              </option>
            ))}
          </select>
        </div>

        {selectedProduct && (
          <div className="text-xs text-neutral-500 bg-neutral-50 rounded p-2">
            만료일: {new Date(new Date(startDate).getTime() + selectedProduct.durationDays * 86400000).toISOString().slice(0, 10)} ·
            총 {selectedProduct.totalCount}회 · 정가 {selectedProduct.price.toLocaleString()}원
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-600">담당 강사</label>
            <select
              value={instructorId ?? ''}
              onChange={e => setInstructorId(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">선택 안 함</option>
              {instructors.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-600">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-600">결제 구분</label>
            <select
              value={paymentType}
              onChange={e => setPaymentType(e.target.value as '신규결제' | '재결제')}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="신규결제">신규결제</option>
              <option value="재결제">재결제</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-600">결제 수단</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value as '카드' | '계좌이체' | '현금')}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="카드">카드</option>
              <option value="계좌이체">계좌이체</option>
              <option value="현금">현금</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-neutral-600">
            실제 결제 금액 (선택, 비우면 정가)
          </label>
          <input
            type="number"
            min="0"
            step="1000"
            value={customAmount}
            onChange={e => setCustomAmount(e.target.value)}
            placeholder={selectedProduct ? `${selectedProduct.price.toLocaleString()} (정가)` : '0'}
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300 text-sm"
          >
            {saving ? '발급 중...' : '발급'}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setError('') }}
            className="px-3 py-2 text-neutral-500 hover:text-neutral-700 text-sm"
          >
            취소
          </button>
        </div>
      </form>
    </Card>
  )
}
