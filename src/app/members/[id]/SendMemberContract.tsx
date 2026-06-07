'use client'

import { useState, useEffect, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { toast } from '@/components/ui/toast'
import { CONTRACT_KIND_LABELS, CONTRACT_TARGET, type ContractKind } from '@/lib/contracts/defaults'
import type { Contract } from '@/lib/supabase/contracts'

const MEMBER_KINDS = (Object.keys(CONTRACT_TARGET) as ContractKind[]).filter(k => CONTRACT_TARGET[k] === 'member')

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

export function SendMemberContract({
  memberId, memberName, accessToken, initial,
}: {
  memberId: number
  memberName: string
  accessToken: string | null
  initial: Contract[]
}) {
  const router = useRouter()
  const [contracts, setContracts] = useState<Contract[]>(initial)
  const [kind, setKind] = useState<ContractKind>(MEMBER_KINDS[0])
  const [busy, setBusy] = useState(false)
  const [origin, setOrigin] = useState('')
  const [manualId, setManualId] = useState<number | null>(null)
  const [manualName, setManualName] = useState('')
  const [manualFile, setManualFile] = useState<{ data: string; name: string } | null>(null)

  useEffect(() => { setOrigin(window.location.origin) }, [])
  useEffect(() => { setContracts(initial) }, [initial])
  const link = accessToken && origin ? `${origin}/m/${accessToken}/contracts` : null

  async function send() {
    setBusy(true)
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, memberId }),
      })
      const j = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { toast(`발송 실패: ${j.error ?? 'unknown'}`, 'error'); return }
      toast('계약서 생성됨 — 아래 링크를 회원에게 보내세요', 'success')
      router.refresh()
    } catch { toast('네트워크 오류', 'error') } finally { setBusy(false) }
  }

  function copyLink() { if (link) { navigator.clipboard.writeText(link); toast('링크 복사됨', 'success') } }

  async function del(id: number) {
    if (!confirm('이 계약서를 삭제할까요? (잘못 보냈거나 중복일 때)')) return
    const prev = contracts
    setContracts(contracts.filter(c => c.id !== id))
    try {
      const res = await fetch(`/api/contracts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch { setContracts(prev); toast('삭제 실패', 'error') }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 3_000_000) { toast('파일이 너무 커요 (3MB 이하)', 'error'); return }
    const data = await fileToBase64(f)
    setManualFile({ data, name: f.name })
  }

  async function manualAgree(id: number) {
    if (!manualName.trim()) { toast('동의자 성명을 입력해주세요', 'error'); return }
    setBusy(true)
    try {
      const res = await fetch(`/api/contracts/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: manualName.trim(), attachment: manualFile }),
      })
      const j = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { toast(`처리 실패: ${j.error ?? 'unknown'}`, 'error'); return }
      setContracts(prev => prev.map(c => c.id === id
        ? { ...c, status: 'agreed', agreedName: manualName.trim(), agreedAt: new Date().toISOString(), attachmentName: manualFile?.name ?? null }
        : c))
      setManualId(null); setManualName(''); setManualFile(null)
      toast('동의 완료로 표시했어요', 'success')
      router.refresh()
    } catch { toast('네트워크 오류', 'error') } finally { setBusy(false) }
  }

  return (
    <Card className="p-3">
      <h3 className="text-sm font-semibold mb-1">📄 계약서 보내기</h3>
      <p className="text-xs text-neutral-400 mb-2">종류를 골라 생성하면, 아래 링크를 카톡/문자로 회원에게 보내세요. 종이로 받았다면 &lsquo;직접 동의처리&rsquo;로 표시할 수 있어요.</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <select value={kind} onChange={e => setKind(e.target.value as ContractKind)} className="flex-1 border border-neutral-300 rounded px-2 py-1.5 text-sm bg-white">
          {MEMBER_KINDS.map(k => <option key={k} value={k}>{CONTRACT_KIND_LABELS[k]}</option>)}
        </select>
        <button onClick={send} disabled={busy} className="bg-neutral-900 text-white text-sm rounded px-4 py-1.5 disabled:opacity-50 whitespace-nowrap">{busy ? '생성 중…' : '계약서 생성'}</button>
      </div>

      {link ? (
        <div className="mt-2 flex items-center gap-2 text-xs bg-neutral-50 border border-neutral-200 rounded px-2 py-1.5">
          <span className="text-neutral-500 truncate flex-1">{link}</span>
          <button onClick={copyLink} className="text-blue-600 shrink-0 font-medium">링크 복사</button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-amber-600">회원 링크(접근 토큰)가 없어요. 위 &lsquo;회원 접근 링크&rsquo;에서 먼저 발급하세요.</p>
      )}

      {contracts.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-neutral-100 pt-2">
          {contracts.map(c => (
            <li key={c.id}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-neutral-600 truncate">{c.title}</span>
                {c.status === 'agreed' ? (
                  <span className="text-emerald-600 shrink-0">✓ {c.agreedName} {c.agreedAt?.slice(5, 10)}{c.attachmentName ? ' 📎' : ''}</span>
                ) : (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => { setManualId(manualId === c.id ? null : c.id); setManualName(memberName); setManualFile(null) }} className="text-blue-600">직접 동의처리</button>
                    <button onClick={() => del(c.id)} className="text-red-500">삭제</button>
                  </div>
                )}
              </div>
              {manualId === c.id && c.status !== 'agreed' && (
                <div className="mt-2 space-y-2 bg-neutral-50 border border-neutral-200 rounded p-2">
                  <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="동의자 성명" className="w-full border border-neutral-300 rounded px-2 py-1 text-xs" />
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-0.5">서류 첨부 (사진·PDF, 선택)</label>
                    <input type="file" accept="image/*,application/pdf" onChange={onFile} className="block text-xs w-full" />
                    {manualFile && <span className="text-[11px] text-emerald-600">첨부: {manualFile.name}</span>}
                  </div>
                  <button onClick={() => manualAgree(c.id)} disabled={busy} className="bg-neutral-900 text-white text-xs rounded px-3 py-1.5 disabled:opacity-50">동의 완료로 표시</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
