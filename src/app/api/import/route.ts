import { NextResponse } from 'next/server'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { insertMember, fetchAllMembers } from '@/lib/supabase/members'
import { insertInstructor, fetchAllInstructors } from '@/lib/supabase/instructors'
import { insertTransaction } from '@/lib/supabase/transactions'
import { createLesson } from '@/lib/supabase/lessons'
import { normalizeCategory, classify } from '@/lib/categories/normalize'
import { invalidateCache } from '@/lib/data/loader'
import type { ImportEntity } from '@/lib/import/schema'

const MAX_ROWS = 2000

// ── 셀 파서 헬퍼 ──
function str(v: string | undefined): string | undefined {
  const t = (v ?? '').trim()
  return t === '' ? undefined : t
}
function numOrUndef(v: string | undefined): number | undefined {
  const t = (v ?? '').trim()
  if (t === '') return undefined
  const n = Number(t.replace(/[,\s원]/g, ''))
  return Number.isFinite(n) ? n : undefined
}
/** 'YYYY-MM-DD' / 'YYYY.M.D' / 'YYYY/M/D' 허용 → 표준 YYYY-MM-DD. 실패 시 null. */
function normDate(v: string | undefined): string | null {
  const t = (v ?? '').trim()
  const m = t.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}
function normMethod(v: string | undefined): '카드' | '계좌이체' | '현금' {
  const t = (v ?? '').trim()
  if (t === '계좌이체' || t === '이체' || t === '계좌') return '계좌이체'
  if (t === '현금') return '현금'
  return '카드' // 기본·네이버페이 등 → 카드로 정규화
}

interface RowError { row: number; reason: string }

export async function POST(req: Request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  }
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  let body: { entity?: ImportEntity; rows?: Record<string, string>[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON 파싱 실패' }, { status: 400 }) }

  const { entity, rows } = body
  if (!entity || !Array.isArray(rows)) return NextResponse.json({ error: 'entity, rows 필수' }, { status: 400 })
  if (rows.length === 0) return NextResponse.json({ error: '가져올 데이터가 없습니다' }, { status: 400 })
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `한 번에 최대 ${MAX_ROWS}행까지 가능합니다 (현재 ${rows.length}행). 파일을 나눠 올려주세요.` }, { status: 400 })
  }

  const errors: RowError[] = []
  let inserted = 0
  const lineNo = (i: number) => i + 2 // 헤더(1행) 다음부터

  try {
    if (entity === 'members') {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const name = str(r['이름'])
        if (!name) { errors.push({ row: lineNo(i), reason: '이름 누락' }); continue }
        await insertMember({
          name,
          phone: str(r['전화번호']) ?? null,
          email: str(r['이메일']) ?? null,
          gender: str(r['성별']) ?? null,
          birthDate: normDate(r['생년월일']),
          address: str(r['주소']) ?? null,
          tier: str(r['등급']) ?? null,
          memo: str(r['메모']) ?? null,
        }, ownerId)
        inserted++
      }

    } else if (entity === 'instructors') {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const name = str(r['이름'])
        if (!name) { errors.push({ row: lineNo(i), reason: '이름 누락' }); continue }
        const roleRaw = str(r['역할'])
        const role = roleRaw === 'owner' || roleRaw === 'admin' ? roleRaw : 'instructor'
        await insertInstructor({
          name,
          phone: str(r['전화번호']) ?? null,
          role,
          defaultHourlyRate: numOrUndef(r['기본시급']),
          ratePrivate: numOrUndef(r['개인시급']),
          rateRehab: numOrUndef(r['재활시급']),
          rateDuet: numOrUndef(r['듀엣시급']),
          rateGroup: numOrUndef(r['그룹시급']),
        }, ownerId)
        inserted++
      }

    } else if (entity === 'transactions') {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const date = normDate(r['날짜'])
        const rawCategory = str(r['카테고리'])
        const amount = numOrUndef(r['금액'])
        if (!date) { errors.push({ row: lineNo(i), reason: '날짜 형식 오류(YYYY-MM-DD)' }); continue }
        if (!rawCategory) { errors.push({ row: lineNo(i), reason: '카테고리 누락' }); continue }
        if (amount == null) { errors.push({ row: lineNo(i), reason: '금액 오류' }); continue }
        const category = normalizeCategory(rawCategory)
        if (!category) { errors.push({ row: lineNo(i), reason: '카테고리 인식 불가' }); continue }
        await insertTransaction({
          date,
          rawCategory,
          category,
          amount: Math.abs(amount), // 양수 저장 — 매출/지출은 카테고리로 구분
          method: normMethod(r['결제수단']),
          counterparty: str(r['거래처']),
          classification: classify(category),
          memo: str(r['메모']),
        }, ownerId)
        inserted++
      }
      invalidateCache(ownerId)

    } else if (entity === 'lessons') {
      const [members, instructors] = await Promise.all([
        fetchAllMembers(ownerId),
        fetchAllInstructors(ownerId),
      ])
      const memberByName = new Map<string, number>()
      members.forEach(m => { if (!memberByName.has(m.name)) memberByName.set(m.name, m.id) })
      const instByName = new Map<string, number>()
      instructors.forEach(t => { if (!instByName.has(t.name)) instByName.set(t.name, t.id) })

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const memberName = str(r['회원이름'])
        const date = normDate(r['날짜'])
        if (!memberName) { errors.push({ row: lineNo(i), reason: '회원이름 누락' }); continue }
        if (!date) { errors.push({ row: lineNo(i), reason: '날짜 형식 오류(YYYY-MM-DD)' }); continue }
        const memberId = memberByName.get(memberName)
        if (memberId == null) { errors.push({ row: lineNo(i), reason: `회원 '${memberName}' 못 찾음 — 회원을 먼저 가져오세요` }); continue }
        const instName = str(r['강사이름'])
        const instructorId = instName ? (instByName.get(instName) ?? null) : null
        await createLesson({
          memberId,
          instructorId,
          lessonDate: date,
          lessonTime: str(r['시간']),
          durationMinutes: numOrUndef(r['시간(분)']),
          memo: str(r['메모']),
        }, ownerId)
        inserted++
      }

    } else {
      return NextResponse.json({ error: '알 수 없는 entity' }, { status: 400 })
    }
  } catch (error) {
    // 부분 성공 + 중단 지점 보존. 거래 import는 일부라도 들어갔으면 캐시 무효화(즉시 반영).
    if (entity === 'transactions') invalidateCache(ownerId)
    return NextResponse.json(
      { error: (error as Error).message, inserted, failed: errors.length, errors: errors.slice(0, 50) },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, inserted, failed: errors.length, errors: errors.slice(0, 50) })
}
