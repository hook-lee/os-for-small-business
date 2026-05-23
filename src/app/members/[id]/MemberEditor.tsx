'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { Member } from '@/lib/supabase/members'

export function MemberEditor({ member }: { member: Member }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: member.name,
    phone: member.phone ?? '',
    email: member.email ?? '',
    gender: member.gender ?? '',
    birthDate: member.birthDate ?? '',
    address: member.address ?? '',
    detailAddress: member.detailAddress ?? '',
    tier: member.tier ?? '',
    memo: member.memo ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('이름 필수'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || null,
          email: form.email || null,
          gender: form.gender || null,
          birthDate: form.birthDate || null,
          address: form.address || null,
          detailAddress: form.detailAddress || null,
          tier: form.tier || null,
          memo: form.memo || null,
        }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(json.error ?? '저장 실패'); return }
      setEditing(false)
      router.refresh()
    } catch { setError('네트워크 오류') }
    finally { setSaving(false) }
  }

  if (!editing) {
    return (
      <div className="flex items-start gap-2">
        <Card className="flex-1 space-y-2">
          <Row label="전화번호" value={member.phone} />
          <Row label="이메일" value={member.email} />
          <Row label="성별" value={member.gender} />
          <Row label="생년월일" value={member.birthDate} />
          <Row label="주소" value={[member.address, member.detailAddress].filter(Boolean).join(' ') || null} />
          <Row label="회원등급" value={member.tier} />
          <Row label="등록일" value={member.registeredAt} />
          <Row label="최근 출석" value={member.lastAttendedAt} />
          <Row label="앱 연결" value={member.appConnected ? '연결' : '미연결'} />
          {member.memo && <Row label="메모" value={member.memo} />}
        </Card>
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
        >
          정보 수정
        </button>
      </div>
    )
  }

  return (
    <Card>
      <form onSubmit={handleSave} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="이름" required>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </Field>
          <Field label="전화번호">
            <input
              type="text"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="010-0000-0000"
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="이메일">
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </Field>
          <Field label="성별">
            <select
              value={form.gender}
              onChange={e => setForm({ ...form, gender: e.target.value })}
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            >
              <option value="">선택 안 함</option>
              <option value="여성">여성</option>
              <option value="남성">남성</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="생년월일">
            <input
              type="date"
              value={form.birthDate}
              onChange={e => setForm({ ...form, birthDate: e.target.value })}
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </Field>
          <Field label="회원등급">
            <input
              type="text"
              value={form.tier}
              onChange={e => setForm({ ...form, tier: e.target.value })}
              placeholder="VIP / 일반 등"
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="주소">
            <input
              type="text"
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </Field>
          <Field label="상세 주소">
            <input
              type="text"
              value={form.detailAddress}
              onChange={e => setForm({ ...form, detailAddress: e.target.value })}
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </Field>
        </div>
        <Field label="공개 메모 (회원도 볼 수 있음)">
          <textarea
            value={form.memo}
            onChange={e => setForm({ ...form, memo: e.target.value })}
            rows={2}
            className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
          />
        </Field>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm disabled:bg-blue-300"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-sm text-neutral-500">
            취소
          </button>
        </div>
      </form>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex">
      <div className="w-24 shrink-0 text-sm text-neutral-500">{label}</div>
      <div className="text-sm">{value ?? '—'}</div>
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
