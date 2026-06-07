'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { toast } from '@/components/ui/toast'
import { CONTRACT_KIND_LABELS, CONTRACT_TARGET, type ContractKind } from '@/lib/contracts/defaults'
import type { Contract } from '@/lib/supabase/contracts'

const MEMBER_KINDS = (Object.keys(CONTRACT_TARGET) as ContractKind[]).filter(k => CONTRACT_TARGET[k] === 'member')

export function SendMemberContract({
  memberId, accessToken, initial,
}: {
  memberId: number
  accessToken: string | null
  initial: Contract[]
}) {
  const router = useRouter()
  const [contracts] = useState<Contract[]>(initial)
  const [kind, setKind] = useState<ContractKind>(MEMBER_KINDS[0])
  const [busy, setBusy] = useState(false)
  const [origin, setOrigin] = useState('')

  useEffect(() => { setOrigin(window.location.origin) }, [])
  const link = accessToken && origin ? `${origin}/m/${accessToken}/contracts` : null

  async function send() {
    setBusy(true)
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, memberId }),
      })
      const j = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { toast(`발송 실패: ${j.error ?? 'unknown'}`, 'error'); return }
      toast('계약서가 생성됐어요 — 아래 링크를 회원에게 보내세요', 'success')
      router.refresh()
    } catch {
      toast('네트워크 오류', 'error')
    } finally {
      setBusy(false)
    }
  }

  function copyLink() {
    if (link) { navigator.clipboard.writeText(link); toast('링크 복사됨', 'success') }
  }

  return (
    <Card className="p-3">
      <h3 className="text-sm font-semibold mb-1">📄 계약서 보내기</h3>
      <p className="text-xs text-neutral-400 mb-2">종류를 골라 생성하면, 아래 링크를 카톡/문자로 회원에게 보내세요. 회원이 열어 서명·동의합니다.</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={kind}
          onChange={e => setKind(e.target.value as ContractKind)}
          className="flex-1 border border-neutral-300 rounded px-2 py-1.5 text-sm bg-white"
        >
          {MEMBER_KINDS.map(k => <option key={k} value={k}>{CONTRACT_KIND_LABELS[k]}</option>)}
        </select>
        <button onClick={send} disabled={busy} className="bg-neutral-900 text-white text-sm rounded px-4 py-1.5 disabled:opacity-50 whitespace-nowrap">
          {busy ? '생성 중…' : '계약서 생성'}
        </button>
      </div>

      {link ? (
        <div className="mt-2 flex items-center gap-2 text-xs bg-neutral-50 border border-neutral-200 rounded px-2 py-1.5">
          <span className="text-neutral-500 truncate flex-1">{link}</span>
          <button onClick={copyLink} className="text-blue-600 shrink-0 font-medium">링크 복사</button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-amber-600">회원 링크(접근 토큰)가 없어요. 아래 &lsquo;회원 전용 링크&rsquo;에서 먼저 발급하세요.</p>
      )}

      {contracts.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-neutral-100 pt-2">
          {contracts.map(c => (
            <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-neutral-600 truncate">{c.title}</span>
              {c.status === 'agreed'
                ? <span className="text-emerald-600 shrink-0">✓ {c.agreedName} {c.agreedAt?.slice(5, 10)}</span>
                : <span className="text-neutral-400 shrink-0">발송됨 · 미동의</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
