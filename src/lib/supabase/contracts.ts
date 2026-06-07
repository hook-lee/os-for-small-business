import { getSupabaseClient } from './client'
import {
  CONTRACT_KINDS, CONTRACT_DEFAULTS, type ContractKind,
} from '@/lib/contracts/defaults'

/**
 * 전자계약 템플릿 + 인스턴스 DB 처리. 멀티테넌트 owner_id 격리.
 *  - 템플릿: 원장이 편집한 분만 DB 저장. 안 한 종류는 코드 기본 샘플 사용.
 *  - 계약 인스턴스(발송/동의)는 Phase 2.
 */

export interface ResolvedTemplate {
  kind: ContractKind
  title: string
  body: string
  isDefault: boolean   // true = 코드 기본 샘플(원장 미편집)
}

/** 4종 템플릿 — 저장분 우선, 없으면 기본 샘플. (테이블 미존재 시 전부 기본) */
export async function loadContractTemplates(ownerId: string): Promise<ResolvedTemplate[]> {
  const supabase = getSupabaseClient()
  const saved = new Map<string, { title: string; body: string }>()
  try {
    let q = supabase.from('contract_templates').select('kind, title, body')
    if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
    const { data } = await q
    for (const r of (data ?? []) as Array<{ kind: string; title: string; body: string }>) {
      saved.set(r.kind, { title: r.title, body: r.body })
    }
  } catch {
    /* 테이블 미존재(마이그 전) → 기본만 */
  }
  return CONTRACT_KINDS.map(kind => {
    const s = saved.get(kind)
    return s
      ? { kind, title: s.title, body: s.body, isDefault: false }
      : { kind, title: CONTRACT_DEFAULTS[kind].title, body: CONTRACT_DEFAULTS[kind].body, isDefault: true }
  })
}

export async function saveContractTemplate(
  ownerId: string, kind: ContractKind, title: string, body: string,
): Promise<void> {
  const supabase = getSupabaseClient()
  const row: Record<string, unknown> = { kind, title, body, updated_at: new Date().toISOString() }
  if (ownerId !== 'no-auth') row.owner_id = ownerId
  const { error } = await supabase
    .from('contract_templates')
    .upsert(row, { onConflict: 'owner_id,kind' })
  if (error) throw new Error(`계약서 템플릿 저장 실패: ${error.message}`)
}
