'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SignaturePad } from '@/components/ui/SignaturePad'
import { toast } from '@/components/ui/toast'
import type { Contract } from '@/lib/supabase/contracts'

export function MemberContractsView({ token, contracts: initial }: { token: string; contracts: Contract[] }) {
  const router = useRouter()
  const [contracts, setContracts] = useState<Contract[]>(initial)
  const [openId, setOpenId] = useState<number | null>(initial.find(c => c.status === 'sent')?.id ?? null)
  const [name, setName] = useState('')
  const [sig, setSig] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function agree(id: number) {
    if (!name.trim()) { toast('본인 성명을 입력해주세요', 'error'); return }
    setBusy(true)
    try {
      const res = await fetch(`/api/m/${token}/contracts/${id}/agree`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), signatureData: sig }),
      })
      const j = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { toast(`실패: ${j.error ?? 'unknown'}`, 'error'); return }
      setContracts(prev => prev.map(c =>
        c.id === id ? { ...c, status: 'agreed', agreedName: name.trim(), agreedAt: new Date().toISOString() } : c))
      setOpenId(null); setName(''); setSig(null)
      toast('동의가 완료됐어요', 'success')
      router.refresh()
    } catch {
      toast('네트워크 오류', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (contracts.length === 0) {
    return <div className="text-center text-sm text-neutral-400 py-10">받은 계약서가 없어요.</div>
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">계약서 / 동의서</h2>
      {contracts.map(c => (
        <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-sm">{c.title}</div>
            {c.status === 'agreed' ? (
              <span className="text-xs text-emerald-600 font-medium shrink-0">✓ 동의완료</span>
            ) : (
              <button
                onClick={() => setOpenId(o => (o === c.id ? null : c.id))}
                className="text-xs text-blue-600 shrink-0"
              >
                {openId === c.id ? '접기' : '보기·동의'}
              </button>
            )}
          </div>
          {c.status === 'agreed' && (
            <div className="text-xs text-neutral-400 mt-1">{c.agreedName} · {c.agreedAt?.slice(0, 10)}</div>
          )}

          {openId === c.id && c.status !== 'agreed' && (
            <div className="mt-3 space-y-3">
              <div className="bg-neutral-50 border border-neutral-200 rounded p-3 text-sm whitespace-pre-wrap break-keep leading-relaxed max-h-64 overflow-y-auto">
                {c.body}
              </div>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="본인 성명"
                className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
              />
              <div>
                <div className="text-xs text-neutral-500 mb-1">서명</div>
                <SignaturePad onChange={setSig} />
              </div>
              <button
                onClick={() => agree(c.id)}
                disabled={busy}
                className="w-full bg-blue-600 text-white rounded py-2.5 text-sm font-medium disabled:opacity-50"
              >
                {busy ? '처리 중…' : '위 내용에 동의합니다'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
