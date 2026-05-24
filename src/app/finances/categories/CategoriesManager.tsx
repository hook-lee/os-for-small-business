'use client'

import { useState } from 'react'
import type { ExpenseCategory } from '@/lib/supabase/categories'
import { Card } from '@/components/ui/Card'

const CLASSIFICATION_LABELS: Record<string, string> = {
  business: '사업비',
  living: '생활비',
  owner_draw: '대표자인출',
  reserve: '예비비',
  capital: '자산',
}

function ClassificationBadge({ cls }: { cls: string }) {
  const colors: Record<string, string> = {
    business: 'bg-blue-100 text-blue-800',
    living: 'bg-neutral-100 text-neutral-700',
    owner_draw: 'bg-amber-100 text-amber-800',
    reserve: 'bg-purple-100 text-purple-800',
    capital: 'bg-green-100 text-green-800',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${colors[cls] ?? 'bg-neutral-100 text-neutral-700'}`}>
      {CLASSIFICATION_LABELS[cls] ?? cls}
    </span>
  )
}

interface EditModalProps {
  category: ExpenseCategory
  onClose: () => void
  onSave: (id: number, patch: Partial<ExpenseCategory>) => Promise<void>
}

function EditModal({ category, onClose, onSave }: EditModalProps) {
  const [name, setName] = useState(category.name)
  const [description, setDescription] = useState(category.description ?? '')
  const [classification, setClassification] = useState(category.classification)
  const [vatDeductible, setVatDeductible] = useState(category.vatDeductible)
  const [incomeTaxDeductible, setIncomeTaxDeductible] = useState(category.incomeTaxDeductible)
  const [active, setActive] = useState(category.active)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(category.id, { name, description: description || null, classification, vatDeductible, incomeTaxDeductible, active })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <Card className="w-full max-w-md space-y-4">
        <h3 className="font-semibold text-base">카테고리 수정</h3>
        <div>
          <label className="block text-sm font-medium mb-1">이름</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            disabled={category.isDefault}
          />
          {category.isDefault && <div className="text-xs text-neutral-400 mt-1">기본 카테고리 — 이름 수정 불가</div>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">설명</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">분류</label>
          <select
            value={classification}
            onChange={e => setClassification(e.target.value as ExpenseCategory['classification'])}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="business">사업비</option>
            <option value="living">생활비</option>
            <option value="owner_draw">대표자인출</option>
            <option value="reserve">예비비</option>
            <option value="capital">자산</option>
          </select>
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={vatDeductible} onChange={e => setVatDeductible(e.target.checked)} />
            부가세 공제
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={incomeTaxDeductible} onChange={e => setIncomeTaxDeductible(e.target.checked)} />
            종소세 경비
          </label>
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
            활성 (비활성 시 입력 화면에서 숨김)
          </label>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-blue-300"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-neutral-100 text-neutral-700 py-2 rounded text-sm font-medium hover:bg-neutral-200"
          >
            취소
          </button>
        </div>
      </Card>
    </div>
  )
}

interface AddModalProps {
  onClose: () => void
  onAdd: (input: { name: string; description: string; classification: ExpenseCategory['classification']; vatDeductible: boolean; incomeTaxDeductible: boolean }) => Promise<void>
}

function AddModal({ onClose, onAdd }: AddModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [classification, setClassification] = useState<ExpenseCategory['classification']>('business')
  const [vatDeductible, setVatDeductible] = useState(false)
  const [incomeTaxDeductible, setIncomeTaxDeductible] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!name.trim()) return
    setSaving(true)
    await onAdd({ name: name.trim(), description, classification, vatDeductible, incomeTaxDeductible })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <Card className="w-full max-w-md space-y-4">
        <h3 className="font-semibold text-base">카테고리 추가</h3>
        <div>
          <label className="block text-sm font-medium mb-1">이름 *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="예: 청소용역비"
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">설명</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="세무사가 봤을 때 알 수 있는 설명"
            className="w-full border rounded px-3 py-2 text-sm"
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">분류</label>
          <select
            value={classification}
            onChange={e => setClassification(e.target.value as ExpenseCategory['classification'])}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="business">사업비</option>
            <option value="living">생활비</option>
            <option value="owner_draw">대표자인출</option>
            <option value="reserve">예비비</option>
            <option value="capital">자산</option>
          </select>
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={vatDeductible} onChange={e => setVatDeductible(e.target.checked)} />
            부가세 공제
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={incomeTaxDeductible} onChange={e => setIncomeTaxDeductible(e.target.checked)} />
            종소세 경비
          </label>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAdd}
            disabled={saving || !name.trim()}
            className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-blue-300"
          >
            {saving ? '추가 중...' : '추가'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-neutral-100 text-neutral-700 py-2 rounded text-sm font-medium hover:bg-neutral-200"
          >
            취소
          </button>
        </div>
      </Card>
    </div>
  )
}

export function CategoriesManager({ initial }: { initial: ExpenseCategory[] }) {
  const [categories, setCategories] = useState<ExpenseCategory[]>(initial)
  const [editTarget, setEditTarget] = useState<ExpenseCategory | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSave(id: number, patch: Partial<ExpenseCategory>) {
    setErrorMsg('')
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: patch.name,
          description: patch.description,
          classification: patch.classification,
          vatDeductible: patch.vatDeductible,
          incomeTaxDeductible: patch.incomeTaxDeductible,
          active: patch.active,
        }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(json.error ?? '수정 실패')
      setCategories(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
    } catch (e) {
      setErrorMsg((e as Error).message)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('이 카테고리를 삭제할까요?')) return
    setErrorMsg('')
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(json.error ?? '삭제 실패')
      setCategories(prev => prev.filter(c => c.id !== id))
    } catch (e) {
      setErrorMsg((e as Error).message)
    }
  }

  async function handleAdd(input: { name: string; description: string; classification: ExpenseCategory['classification']; vatDeductible: boolean; incomeTaxDeductible: boolean }) {
    setErrorMsg('')
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const json = await res.json() as { ok?: boolean; id?: number; error?: string }
      if (!res.ok) throw new Error(json.error ?? '추가 실패')
      // Reload the list
      const listRes = await fetch('/api/categories')
      const listJson = await listRes.json() as { categories?: ExpenseCategory[] }
      setCategories(listJson.categories ?? categories)
    } catch (e) {
      setErrorMsg((e as Error).message)
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">비용 카테고리</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
        >
          + 카테고리 추가
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded">
          {errorMsg}
        </div>
      )}

      <div className="space-y-2">
        {categories.map(cat => (
          <Card key={cat.id} className={`flex items-start gap-3 ${!cat.active ? 'opacity-50' : ''}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{cat.name}</span>
                <ClassificationBadge cls={cat.classification} />
                {cat.vatDeductible && (
                  <span className="text-xs bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded">부가세 공제</span>
                )}
                {cat.incomeTaxDeductible && (
                  <span className="text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded">종소세 경비</span>
                )}
                {!cat.active && (
                  <span className="text-xs bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded">비활성</span>
                )}
                {cat.isDefault && (
                  <span className="text-xs text-neutral-400">(기본)</span>
                )}
              </div>
              {cat.description && (
                <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{cat.description}</p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => setEditTarget(cat)}
                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
              >
                수정
              </button>
              <button
                onClick={() => handleDelete(cat.id)}
                disabled={cat.isDefault}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 disabled:text-neutral-300 disabled:cursor-not-allowed"
                title={cat.isDefault ? '기본 카테고리는 삭제할 수 없습니다' : '삭제'}
              >
                삭제
              </button>
            </div>
          </Card>
        ))}
      </div>

      {editTarget && (
        <EditModal
          category={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={handleSave}
        />
      )}

      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  )
}
