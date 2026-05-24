'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'

export function MemberAccessLink({ memberId, initialToken }: { memberId: number; initialToken: string | null }) {
  const [token, setToken] = useState<string | null>(initialToken)
  const [busy, setBusy] = useState(false)

  const url = token && typeof window !== 'undefined'
    ? `${window.location.origin}/m/${token}`
    : null

  async function regen() {
    if (token && !confirm('새 링크를 발급하면 기존 링크는 작동 안 합니다. 계속할까요?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/members/${memberId}/access-token`, { method: 'POST' })
      const json = await res.json() as { ok?: boolean; token?: string; error?: string }
      if (!res.ok) { alert(`발급 실패: ${json.error}`); return }
      setToken(json.token ?? null)
    } catch { alert('네트워크 오류') }
    finally { setBusy(false) }
  }

  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">회원 접근 링크</h3>
        <button
          onClick={regen}
          disabled={busy}
          className="text-xs bg-teal-600 text-white px-2 py-1 rounded hover:bg-teal-700 disabled:bg-teal-300"
        >
          {busy ? '발급 중...' : (token ? '재발급' : '링크 발급')}
        </button>
      </div>
      {url ? (
        <div>
          <div className="text-xs text-neutral-500 mb-1">아래 링크를 회원에게 카톡으로 전달하세요. 회원은 비밀번호 없이 자기 정보 조회 가능.</div>
          <div className="flex gap-2 items-center">
            <input
              readOnly
              value={url}
              className="flex-1 border border-neutral-300 bg-neutral-50 rounded px-2 py-1 text-xs font-mono"
              onClick={e => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={() => { navigator.clipboard.writeText(url); alert('복사됨') }}
              className="text-xs bg-neutral-100 hover:bg-neutral-200 px-2 py-1 rounded"
            >
              복사
            </button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-neutral-400">링크가 아직 발급되지 않았습니다.</div>
      )}
    </Card>
  )
}
