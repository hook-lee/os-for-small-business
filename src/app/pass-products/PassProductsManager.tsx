'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { PassProduct } from '@/lib/supabase/pass-products'

type FormState = {
  name: string
  passType: '프라이빗' | '그룹'
  durationDays: string
  totalCount: string
  price: string
  perUnitPrice: string
  displayOrder: string
  color: string
}

const EMPTY_FORM: FormState = {
  name: '',
  passType: '프라이빗',
  durationDays: '',
  totalCount: '',
  price: '',
  perUnitPrice: '',
  displayOrder: '0',
  color: '',
}

function productToForm(p: PassProduct): FormState {
  return {
    name: p.name,
    passType: p.passType,
    durationDays: String(p.durationDays),
    totalCount: String(p.totalCount),
    price: String(p.price),
    perUnitPrice: p.perUnitPrice ? String(p.perUnitPrice) : '',
    displayOrder: String(p.displayOrder),
    color: p.color ?? '',
  }
}

type PayloadOk = {
  ok: true
  data: {
    name: string
    passType: '프라이빗' | '그룹'
    durationDays: number
    totalCount: number
    price: number
    perUnitPrice?: number
    displayOrder?: number
    color?: string
  }
}
type PayloadErr = { ok: false; error: string }

function formToPayload(f: FormState): PayloadOk | PayloadErr {
  if (!f.name.trim()) return { ok: false, error: '이름 필수' }
  const dur = parseInt(f.durationDays, 10)
  const cnt = parseInt(f.totalCount, 10)
  const pri = parseInt(f.price, 10)
  if (!Number.isFinite(dur) || dur <= 0) return { ok: false, error: '유효 기간(일) 필수' }
  if (!Number.isFinite(cnt) || cnt <= 0) return { ok: false, error: '총 횟수 필수' }
  if (!Number.isFinite(pri) || pri < 0) return { ok: false, error: '판매 가격 필수' }
  const per = f.perUnitPrice ? parseInt(f.perUnitPrice, 10) : Math.round(pri / cnt)
  const ord = parseInt(f.displayOrder, 10) || 0
  return {
    ok: true,
    data: {
      name: f.name.trim(),
      passType: f.passType,
      durationDays: dur,
      totalCount: cnt,
      price: pri,
      perUnitPrice: per,
      displayOrder: ord,
      color: f.color.trim() || undefined,
    },
  }
}

export function PassProductsManager({ initial }: { initial: PassProduct[] }) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const v = formToPayload(addForm)
    if (!v.ok) { setError(v.error); return }
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/pass-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v.data),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(json.error ?? '저장 실패'); return }
      setAddOpen(false)
      setAddForm(EMPTY_FORM)
      router.refresh()
    } catch { setError('네트워크 오류') }
    finally { setBusy(false) }
  }

  async function handleSaveEdit(id: number) {
    const v = formToPayload(editForm)
    if (!v.ok) { setError(v.error); return }
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/pass-products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v.data),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(json.error ?? '저장 실패'); return }
      setEditingId(null)
      router.refresh()
    } catch { setError('네트워크 오류') }
    finally { setBusy(false) }
  }

  async function handleDelete(p: PassProduct) {
    if (!confirm(`"${p.name}" (${p.durationDays}일·${p.totalCount}회) 삭제할까요?\n이미 발급된 수강권은 영향 없음.`)) return
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/pass-products/${p.id}`, { method: 'DELETE' })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(json.error ?? '삭제 실패'); return }
      router.refresh()
    } catch { setError('네트워크 오류') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          수강권 카탈로그{' '}
          <span className="text-neutral-400 text-sm font-normal">총 {initial.length}개 상품</span>
        </h2>
        <button
          onClick={() => { setAddOpen(o => !o); setError('') }}
          className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
        >
          {addOpen ? '취소' : '+ 상품 추가'}
        </button>
      </div>

      {addOpen && (
        <Card>
          <form onSubmit={handleAdd}>
            <FormFields form={addForm} setForm={setAddForm} />
            <div className="flex gap-2 mt-3">
              <button type="submit" disabled={busy} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm disabled:bg-blue-300">
                {busy ? '저장 중...' : '추가'}
              </button>
              <button type="button" onClick={() => { setAddOpen(false); setError('') }} className="text-sm text-neutral-500">취소</button>
            </div>
          </form>
        </Card>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {initial.map(p => (
          <Card key={p.id} className="space-y-2" style={p.color ? { borderTop: `4px solid ${p.color}` } : undefined}>
            {editingId === p.id ? (
              <>
                <FormFields form={editForm} setForm={setEditForm} />
                <div className="flex gap-2 mt-3">
                  <button onClick={() => handleSaveEdit(p.id)} disabled={busy} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm disabled:bg-blue-300">
                    {busy ? '저장 중...' : '저장'}
                  </button>
                  <button onClick={() => { setEditingId(null); setError('') }} className="text-sm text-neutral-500">취소</button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-base">{p.name}</div>
                    <div className="text-xs text-neutral-500">{p.passType} · {p.durationDays}일 · {p.totalCount}회</div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingId(p.id); setEditForm(productToForm(p)); setError('') }}
                      className="text-xs text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded hover:bg-blue-50"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="text-xs text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                <div className="text-xl font-bold tabular-nums">{p.price.toLocaleString()}원</div>
                {p.perUnitPrice && <div className="text-xs text-neutral-500">회당 {p.perUnitPrice.toLocaleString()}원</div>}
              </>
            )}
          </Card>
        ))}
        {initial.length === 0 && (
          <div className="text-sm text-neutral-500 col-span-full">상품이 아직 없습니다. + 상품 추가 버튼을 누르세요.</div>
        )}
      </div>
    </div>
  )
}

function FormFields({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="이름" required>
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="예: 개인" required className="w-full border border-neutral-300 rounded px-2 py-1 text-sm" />
        </Field>
        <Field label="종류" required>
          <select value={form.passType} onChange={e => setForm({ ...form, passType: e.target.value as '프라이빗' | '그룹' })} className="w-full border border-neutral-300 rounded px-2 py-1 text-sm">
            <option value="프라이빗">프라이빗</option>
            <option value="그룹">그룹</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="유효 기간 (일)" required>
          <input type="number" min="1" value={form.durationDays} onChange={e => setForm({ ...form, durationDays: e.target.value })} placeholder="90" required className="w-full border border-neutral-300 rounded px-2 py-1 text-sm" />
        </Field>
        <Field label="총 횟수" required>
          <input type="number" min="1" value={form.totalCount} onChange={e => setForm({ ...form, totalCount: e.target.value })} placeholder="20" required className="w-full border border-neutral-300 rounded px-2 py-1 text-sm" />
        </Field>
        <Field label="표시 순서">
          <input type="number" value={form.displayOrder} onChange={e => setForm({ ...form, displayOrder: e.target.value })} className="w-full border border-neutral-300 rounded px-2 py-1 text-sm" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="판매 가격 (원)" required>
          <input type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="650000" required className="w-full border border-neutral-300 rounded px-2 py-1 text-sm" />
        </Field>
        <Field label="회당 가격 (선택)">
          <input type="number" min="0" value={form.perUnitPrice} onChange={e => setForm({ ...form, perUnitPrice: e.target.value })} placeholder="비우면 자동 계산" className="w-full border border-neutral-300 rounded px-2 py-1 text-sm" />
        </Field>
      </div>
      <Field label="컬러 (hex, 선택)">
        <input type="text" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} placeholder="#6366f1" className="w-full border border-neutral-300 rounded px-2 py-1 text-sm" />
      </Field>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1 text-neutral-600">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
