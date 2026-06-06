'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { toast } from '@/components/ui/toast'

export function InstructorAccountSection({
  instructorId, instructorName, email, connected,
}: {
  instructorId: number
  instructorName: string
  email: string | null
  connected: boolean
}) {
  const [emailInput, setEmailInput] = useState(email ?? '')
  const [busy, setBusy] = useState(false)
  const [issued, setIssued] = useState<{ email: string; tempPassword: string } | null>(null)
  const [isConnected, setIsConnected] = useState(connected)

  async function create() {
    if (!emailInput.trim()) { toast('이메일을 입력해주세요', 'error'); return }
    if (!confirm(`${instructorName} 강사의 로그인 계정을 만들까요?\n임시 비밀번호가 발급됩니다.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/instructors/${instructorId}/create-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim() }),
      })
      const json = await res.json() as { ok?: boolean; email?: string; tempPassword?: string; error?: string }
      if (!res.ok || !json.tempPassword) { toast(`실패: ${json.error ?? 'unknown'}`, 'error'); return }
      setIssued({ email: json.email ?? emailInput.trim(), tempPassword: json.tempPassword })
      setIsConnected(true)
      toast('강사 로그인 계정이 생성됐어요', 'success')
    } catch {
      toast('네트워크 오류', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-3">
      <h3 className="text-sm font-semibold mb-1">🔑 강사 로그인 계정</h3>
      <p className="text-xs text-neutral-400 mb-2">
        강사가 직접 로그인해서 본인 수업·회원·운동일지를 기록할 수 있어요. 매출·세금·다른 강사 급여는 안 보입니다.
      </p>

      {isConnected ? (
        <div className="text-sm text-emerald-700">✓ 로그인 계정 연결됨{email ? ` (${email})` : ''}</div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            placeholder="강사 이메일"
            className="flex-1 border border-neutral-300 rounded px-2 py-1.5 text-sm"
          />
          <button
            onClick={create}
            disabled={busy}
            className="bg-neutral-900 text-white text-sm rounded px-4 py-1.5 disabled:opacity-50 whitespace-nowrap"
          >
            {busy ? '생성 중…' : '계정 만들기'}
          </button>
        </div>
      )}

      {issued && (
        <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm">
          <div className="font-semibold text-amber-800 mb-1">✅ 계정 생성 완료 — 강사에게 전달하세요</div>
          <div className="font-mono text-xs space-y-0.5 break-all">
            <div>이메일: <b>{issued.email}</b></div>
            <div>임시 비밀번호: <b>{issued.tempPassword}</b></div>
          </div>
          <p className="text-[11px] text-amber-700 mt-1.5">
            이 비밀번호는 지금만 보여요. 복사해서 강사에게 전달하고, 강사가 로그인 후 바꾸도록 안내하세요.
          </p>
        </div>
      )}
    </Card>
  )
}
