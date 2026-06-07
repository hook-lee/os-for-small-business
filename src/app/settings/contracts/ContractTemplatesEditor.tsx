'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { toast } from '@/components/ui/toast'
import { CONTRACT_KIND_LABELS, renderContract, type ContractKind } from '@/lib/contracts/defaults'

interface TemplateItem {
  kind: ContractKind
  title: string
  body: string
  isDefault: boolean
}

const VAR_HINT = '{{센터명}} {{회원명}} {{강사명}} {{날짜}}'

export function ContractTemplatesEditor({
  initial, workspaceName,
}: {
  initial: TemplateItem[]
  workspaceName: string | null
}) {
  const [templates, setTemplates] = useState<TemplateItem[]>(initial)
  const [activeKind, setActiveKind] = useState<ContractKind>(initial[0]?.kind ?? 'member_terms')
  const [savingKind, setSavingKind] = useState<ContractKind | null>(null)
  const [preview, setPreview] = useState(false)

  const active = templates.find(t => t.kind === activeKind) ?? templates[0]

  function update(patch: Partial<TemplateItem>) {
    setTemplates(prev => prev.map(t => (t.kind === activeKind ? { ...t, ...patch } : t)))
  }

  async function save() {
    if (!active) return
    setSavingKind(active.kind)
    try {
      const res = await fetch('/api/contract-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: active.kind, title: active.title, body: active.body }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { toast(`저장 실패: ${json.error ?? 'unknown'}`, 'error'); return }
      update({ isDefault: false })
      toast('계약서 저장됐어요', 'success')
    } catch {
      toast('저장 실패: 네트워크 오류', 'error')
    } finally {
      setSavingKind(null)
    }
  }

  if (!active) return null

  const previewVars: Record<string, string> = {
    센터명: workspaceName ?? '○○ 센터',
    회원명: '홍길동',
    강사명: '김강사',
    날짜: '2026-06-07',
  }

  return (
    <Card className="p-4 space-y-3">
      {/* 종류 탭 */}
      <div className="flex gap-1 overflow-x-auto">
        {templates.map(t => (
          <button
            key={t.kind}
            onClick={() => { setActiveKind(t.kind); setPreview(false) }}
            className={`shrink-0 text-sm px-3 py-1.5 rounded whitespace-nowrap ${
              activeKind === t.kind ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {CONTRACT_KIND_LABELS[t.kind]}
            {t.isDefault && <span className="text-[10px] opacity-60"> · 샘플</span>}
          </button>
        ))}
      </div>

      {!preview ? (
        <>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">제목</label>
            <input
              value={active.title}
              onChange={e => update({ title: e.target.value })}
              className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">
              본문 — 변수 <code className="bg-neutral-100 px-1 rounded">{VAR_HINT}</code>는 발송 시 자동으로 채워집니다
            </label>
            <textarea
              value={active.body}
              onChange={e => update({ body: e.target.value })}
              rows={16}
              className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm font-mono leading-relaxed"
            />
          </div>
        </>
      ) : (
        <div className="bg-neutral-50 border border-neutral-200 rounded p-4 text-sm whitespace-pre-wrap break-keep leading-relaxed">
          <div className="font-semibold mb-2">{renderContract(active.title, previewVars)}</div>
          {renderContract(active.body, previewVars)}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={savingKind === active.kind}
          className="bg-neutral-900 text-white text-sm rounded px-4 py-2 disabled:opacity-50"
        >
          {savingKind === active.kind ? '저장 중…' : '저장'}
        </button>
        <button
          onClick={() => setPreview(p => !p)}
          className="text-sm border border-neutral-300 rounded px-4 py-2 hover:bg-neutral-50"
        >
          {preview ? '편집으로' : '미리보기'}
        </button>
      </div>

      <p className="text-[11px] text-neutral-400">
        ⚠️ 기본 샘플은 일반 예시예요. 센터 상황·법령에 맞게 검토·수정 후 사용하세요. (필요 시 세무사·노무사 확인 권장)
      </p>
    </Card>
  )
}
