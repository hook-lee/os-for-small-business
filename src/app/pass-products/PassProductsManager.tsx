'use client'

import { useState, useMemo, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { ColorPicker } from '@/components/ColorPicker'
import type { PassProduct } from '@/lib/supabase/pass-products'

/**
 * 수강권 카탈로그 매니저.
 *
 * 그룹화 정책:
 *  1. category 컬럼이 있으면 그 값으로 그룹화 (예: '체험' 카테고리 안에 '체험'/'듀엣 체험'/'원장 체험' 묶임)
 *  2. category가 NULL이면 name 자체를 그룹키로 사용 (기존 동작 유지)
 *
 * 그룹 색: 그룹 내 첫 상품의 color → 기존 라파 하드코딩 매핑(GROUP_COLORS) → 회색 fallback.
 * 같은 색을 여러 카테고리에 자유롭게 쓸 수 있음 (unique 제약 없음).
 */

// 기존 라파 데이터 색 매핑 (NULL color일 때만 fallback)
const LEGACY_GROUP_COLORS: Record<string, string> = {
  '개인': '#a855f7',
  '듀엣': '#6366f1',
  '재활': '#f43f5e',
  '2:1 소그룹': '#f97316',
  '체험': '#14b8a6',
  '듀엣 체험': '#10b981',
}

function normalizeGroupKey(name: string): string {
  const trimmed = name.trim()
  if (trimmed === '2:1소그룹') return '2:1 소그룹'
  return trimmed
}

type FormState = {
  name: string
  category: string
  passType: '프라이빗' | '그룹'
  durationDays: string
  totalCount: string
  price: string
  perUnitPrice: string
  displayOrder: string
  color: string
  maxSuspendDays: string
}

const EMPTY_FORM: FormState = {
  name: '',
  category: '',
  passType: '프라이빗',
  durationDays: '',
  totalCount: '',
  price: '',
  perUnitPrice: '',
  displayOrder: '0',
  color: '',
  maxSuspendDays: '',
}

function productToForm(p: PassProduct): FormState {
  return {
    name: p.name,
    category: p.category ?? '',
    passType: p.passType,
    durationDays: String(p.durationDays),
    totalCount: String(p.totalCount),
    price: String(p.price),
    perUnitPrice: p.perUnitPrice ? String(p.perUnitPrice) : '',
    displayOrder: String(p.displayOrder),
    color: p.color ?? '',
    maxSuspendDays: p.maxSuspendDays != null ? String(p.maxSuspendDays) : '',
  }
}

type PayloadOk = {
  ok: true
  data: {
    name: string
    category?: string | null
    passType: '프라이빗' | '그룹'
    durationDays: number
    totalCount: number
    price: number
    perUnitPrice?: number
    displayOrder?: number
    color?: string
    maxSuspendDays?: number | null
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
      category: f.category.trim() || null,
      passType: f.passType,
      durationDays: dur,
      totalCount: cnt,
      price: pri,
      perUnitPrice: per,
      displayOrder: ord,
      color: f.color.trim() || undefined,
      maxSuspendDays: f.maxSuspendDays.trim() === '' ? null : Math.max(0, parseInt(f.maxSuspendDays, 10) || 0),
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

  // 기존 카테고리 unique (datalist 자동완성용)
  const existingCategories = useMemo(() => {
    const s = new Set<string>()
    initial.forEach(p => { if (p.category) s.add(p.category) })
    return Array.from(s).sort()
  }, [initial])

  const grouped = useMemo(() => {
    const map = new Map<string, PassProduct[]>()
    for (const p of initial) {
      // category 우선, 없으면 name 자체를 그룹키로
      const key = p.category ? p.category.trim() : normalizeGroupKey(p.name)
      const arr = map.get(key) ?? []
      arr.push(p)
      map.set(key, arr)
    }
    for (const [, arr] of map) {
      // 같은 그룹 안에서 displayOrder → 기간 → 횟수 순
      arr.sort((a, b) =>
        a.displayOrder - b.displayOrder ||
        a.durationDays - b.durationDays ||
        a.totalCount - b.totalCount,
      )
    }
    // 그룹은 첫 상품의 displayOrder 기준 정렬, 동일하면 키 사전순
    return [...map.entries()]
      .map(([key, products]) => ({ key, products }))
      .sort((a, b) => {
        const aOrd = a.products[0]?.displayOrder ?? 999
        const bOrd = b.products[0]?.displayOrder ?? 999
        if (aOrd !== bOrd) return aOrd - bOrd
        return a.key.localeCompare(b.key)
      })
  }, [initial])

  function getGroupColor(products: PassProduct[], groupKey: string): string {
    // 그룹 내 첫 상품의 color > 라파 legacy 매핑 > 회색
    const first = products.find(p => p.color)
    if (first?.color) return first.color
    return LEGACY_GROUP_COLORS[groupKey] ?? '#9ca3af'
  }

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
          <span className="text-neutral-400 text-sm font-normal">총 {initial.length}개 상품 / {grouped.length}개 카테고리</span>
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
            <FormFields form={addForm} setForm={setAddForm} existingCategories={existingCategories} />
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

      {initial.length === 0 && (
        <div className="text-sm text-neutral-500">상품이 아직 없습니다. + 상품 추가 버튼을 누르세요.</div>
      )}

      {grouped.map(({ key, products }) => {
        const color = getGroupColor(products, key)
        return (
          <section key={key} className="space-y-3">
            <div className="flex items-center gap-2 mt-4">
              <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: color }} />
              <h3 className="text-base font-semibold">{key}</h3>
              <span className="text-xs text-neutral-500">{products.length}개 상품</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {products.map(p => {
                const productColor = p.color || color  // 개별 상품 색 없으면 그룹 색
                return (
                  <Card
                    key={p.id}
                    className="bg-white space-y-2"
                    style={{ borderTop: `4px solid ${productColor}` }}
                  >
                    {editingId === p.id ? (
                      <>
                        <FormFields form={editForm} setForm={setEditForm} existingCategories={existingCategories} />
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
                            <div className="text-xs text-neutral-500">{p.passType} · <span className="font-medium text-neutral-700">{p.name}</span></div>
                            <div className="font-semibold text-sm mt-0.5">{p.durationDays}일 · {p.totalCount}회</div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => { setEditingId(p.id); setEditForm(productToForm(p)); setError('') }}
                              className="text-xs text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded hover:bg-neutral-50"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDelete(p)}
                              className="text-xs text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-neutral-50"
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
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function FormFields({
  form,
  setForm,
  existingCategories,
}: {
  form: FormState
  setForm: (f: FormState) => void
  existingCategories: string[]
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="상위 카테고리">
          <input
            type="text"
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
            placeholder="예: 체험 (비우면 이름이 카테고리)"
            list="pass-category-options"
            className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
          />
          <datalist id="pass-category-options">
            {existingCategories.map(c => <option key={c} value={c} />)}
          </datalist>
        </Field>
        <Field label="이름" required>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="예: 듀엣 체험"
            required
            className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="종류" required>
          <select value={form.passType} onChange={e => setForm({ ...form, passType: e.target.value as '프라이빗' | '그룹' })} className="w-full border border-neutral-300 rounded px-2 py-1 text-sm">
            <option value="프라이빗">프라이빗</option>
            <option value="그룹">그룹</option>
          </select>
        </Field>
        <Field label="유효 기간 (일)" required>
          <input type="number" min="1" value={form.durationDays} onChange={e => setForm({ ...form, durationDays: e.target.value })} placeholder="90" required className="w-full border border-neutral-300 rounded px-2 py-1 text-sm" />
        </Field>
        <Field label="총 횟수" required>
          <input type="number" min="1" value={form.totalCount} onChange={e => setForm({ ...form, totalCount: e.target.value })} placeholder="20" required className="w-full border border-neutral-300 rounded px-2 py-1 text-sm" />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="판매 가격 (원)" required>
          <input type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="650000" required className="w-full border border-neutral-300 rounded px-2 py-1 text-sm" />
        </Field>
        <Field label="회당 가격 (선택)">
          <input type="number" min="0" value={form.perUnitPrice} onChange={e => setForm({ ...form, perUnitPrice: e.target.value })} placeholder="비우면 자동 계산" className="w-full border border-neutral-300 rounded px-2 py-1 text-sm" />
        </Field>
        <Field label="표시 순서">
          <input type="number" value={form.displayOrder} onChange={e => setForm({ ...form, displayOrder: e.target.value })} className="w-full border border-neutral-300 rounded px-2 py-1 text-sm" />
        </Field>
      </div>
      <Field label="컬러 (카테고리 안에서 자유. 비우면 카테고리 색 사용)">
        <ColorPicker value={form.color} onChange={v => setForm({ ...form, color: v })} />
      </Field>
      <Field label="최대 정지일수 (이 수강권 전용 · 비우면 센터 기본)">
        <input
          type="number"
          min="0"
          value={form.maxSuspendDays}
          onChange={e => setForm({ ...form, maxSuspendDays: e.target.value })}
          placeholder="비우면 운영설정 기본값 사용"
          className="w-full border border-neutral-300 rounded px-2 py-1 text-sm tabular-nums"
        />
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
