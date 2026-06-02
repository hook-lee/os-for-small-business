/**
 * 데모 PT샵 데이터 시드 (2026-01 ~ 2026-05, 5개월치).
 *
 * 대상: ckdghks1198@gmail.com (owner_id 자동 조회)
 *
 * Usage:
 *   npx tsx scripts/seed-demo-pt.ts                 # dry-run (요약만, 쓰기 X)
 *   npx tsx scripts/seed-demo-pt.ts --wipe --commit # 기존 데모데이터 정리 후 실제 입력
 *   npx tsx scripts/seed-demo-pt.ts --commit        # 정리 없이 실제 입력 (중복 주의)
 *
 * 연동:
 *  - 회원 ↔ 수강권(member_id) ↔ 가계부 매출(transactions.pass_id, v3.7)
 *  - 수강권 ↔ 카탈로그(pass_product_id)
 *  - 수업 ↔ 회원/강사/룸/수강권, 완료·취소·노쇼 → 잔여횟수 차감/만료 반영
 *  - 그룹세션 ↔ 강사/룸, 그룹예약 ↔ 회원/수강권
 *  - 강사 급여(수업 기반) + 운영비 → 가계부 비용
 *
 * 안전: service_role로 RLS 우회. rooms는 건드리지 않음(사용자가 만든 샵1/2/3 사용).
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
dotenvConfig()

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const TARGET_EMAIL = 'ckdghks1198@gmail.com'
const args = process.argv.slice(2)
const COMMIT = args.includes('--commit')
const WIPE = args.includes('--wipe')

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Set SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const supabase: SupabaseClient = createClient(url, key, { auth: { persistSession: false } })

// ───────────────────────── 유틸 ─────────────────────────
// 시드 고정 PRNG (재현 가능)
let _seed = 20260101
function rnd(): number { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296 }
function pick<T>(arr: T[]): T { return arr[Math.floor(rnd() * arr.length)] }
function pickWeighted<T>(items: Array<{ v: T; w: number }>): T {
  const total = items.reduce((s, i) => s + i.w, 0)
  let r = rnd() * total
  for (const it of items) { if ((r -= it.w) <= 0) return it.v }
  return items[items.length - 1].v
}
function randInt(min: number, max: number): number { return Math.floor(rnd() * (max - min + 1)) + min }
function roundKRW(n: number, unit = 10000): number { return Math.round(n / unit) * unit }
function ymd(d: Date): string { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }

const PERIOD_START = new Date('2026-01-01')
const PERIOD_END = new Date('2026-05-31')
const TODAY = new Date('2026-06-01')
const UPCOMING_END = new Date('2026-08-31') // 미래 예약 수업: 8월 말까지 시간표대로

// ───────────────────────── 마스터 정의 ─────────────────────────
// 강사: 원장(매일) + 3명(요일 고정). weekday: 0=일 ... 6=토
const OWNER_DAYS = [1, 2, 3, 4, 5, 6]
const INSTRUCTORS = [
  { key: 'owner', name: '최민혁', role: 'owner' as const, color: '#0ea5e9', days: OWNER_DAYS, rates: { p: 0, r: 0, d: 0, g: 25000 } },
  { key: 'A', name: '김하진', role: 'instructor' as const, color: '#f97316', days: [1, 4], rates: { p: 30000, r: 35000, d: 25000, g: 22000 } },
  { key: 'B', name: '이도아', role: 'instructor' as const, color: '#ec4899', days: [2, 5], rates: { p: 30000, r: 35000, d: 25000, g: 22000 } },
  { key: 'C', name: '박서진', role: 'instructor' as const, color: '#22c55e', days: [3, 6], rates: { p: 32000, r: 38000, d: 27000, g: 24000 } },
]

// 수강권 카탈로그. payroll 분류: 이름에 재활/듀엣/그룹 포함시 자동 매핑
const PRODUCTS = [
  { key: 'trial',    name: '체험 PT 1회',  passType: '프라이빗' as const, durationDays: 30,  totalCount: 1,  price: 50000,    category: '체험' },
  { key: 'p10',      name: '개인 PT 10회', passType: '프라이빗' as const, durationDays: 90,  totalCount: 10, price: 750000,   category: '프라이빗' },
  { key: 'p20',      name: '개인 PT 20회', passType: '프라이빗' as const, durationDays: 150, totalCount: 20, price: 1400000,  category: '프라이빗' },
  { key: 'p30',      name: '개인 PT 30회', passType: '프라이빗' as const, durationDays: 180, totalCount: 30, price: 1950000,  category: '프라이빗' },
  { key: 'duet10',   name: '듀엣 PT 10회', passType: '그룹' as const,     durationDays: 90,  totalCount: 10, price: 500000,   category: '듀엣' },
  { key: 'rehab10',  name: '재활 PT 10회', passType: '프라이빗' as const, durationDays: 90,  totalCount: 10, price: 850000,   category: '재활' },
  { key: 'group8',   name: '그룹 PT 8회',  passType: '그룹' as const,     durationDays: 30,  totalCount: 8,  price: 200000,   category: '그룹' },
] as const
type ProductKey = typeof PRODUCTS[number]['key']

const MEMBER_NAMES = [
  '김서연','이준호','박지민','최예은','정우진','강하늘','조민서','윤도윤','임수아','한지후',
  '오서윤','서지안','신은우','권하준','황시우','안유나','송지호','전소율','홍준서','고채원',
  '문하율','양지원','배수빈','백건우','유나윤','남도현','심예준','노아인','하지율','곽민재',
  '성수현','차은서','주시윤','진여울','구본혁',
]
const SLOTS = ['07:00', '08:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '19:00', '20:00', '21:00']
const METHODS = [{ v: '카드', w: 70 }, { v: '계좌이체', w: 20 }, { v: '현금', w: 10 }]

// 수업 상태 분포 (과거)
const PAST_STATUS = [
  { v: 'completed', w: 84 }, { v: 'cancelled_advance', w: 8 },
  { v: 'cancelled_same_day', w: 4 }, { v: 'noshow', w: 4 },
]
const DEDUCTED = new Set(['completed', 'cancelled_same_day', 'noshow'])

function payrollCat(passName: string): 'p' | 'r' | 'd' | 'g' {
  if (passName.includes('재활')) return 'r'
  if (passName.includes('듀엣')) return 'd'
  if (passName.includes('그룹')) return 'g'
  return 'p'
}

// ───────────────────────── 메인 ─────────────────────────
async function main() {
  console.log(`\n=== 데모 PT샵 시드 ${COMMIT ? '🟢 COMMIT' : '🟡 DRY-RUN(쓰기 없음)'} ${WIPE ? '+ WIPE' : ''} ===\n`)

  // owner_id 조회
  const { data: ud, error: ue } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (ue) throw new Error(ue.message)
  const user = ud.users.find(u => u.email === TARGET_EMAIL)
  if (!user) throw new Error(`${TARGET_EMAIL} 계정 없음 — 먼저 가입 필요`)
  const ownerId = user.id
  console.log(`대상: ${TARGET_EMAIL} (owner ...${ownerId.slice(-4)})`)

  // rooms
  const { data: roomData } = await supabase.from('rooms').select('id, name').eq('owner_id', ownerId).order('display_order')
  const rooms = (roomData ?? []) as Array<{ id: number; name: string }>
  if (rooms.length === 0) throw new Error('룸이 없음 — 먼저 룸 생성 필요')
  console.log(`룸 ${rooms.length}개: ${rooms.map(r => r.name).join(', ')}`)

  if (WIPE) await wipe(ownerId)

  // ── 메모리에서 전체 계획 생성 ──
  // 강사
  type InstrPlan = typeof INSTRUCTORS[number] & { id: number }
  // 회원/수강권/수업 계획 컨테이너
  interface PassPlan {
    productKey: ProductKey
    passName: string; passType: string
    paidAt: string; startDate: string; endDate: string
    paymentAmount: number; paymentMethod: string; paymentType: string
    instructorKey: string
    totalCount: number
    lessons: LessonPlan[]   // 이 수강권에 묶인 수업
    deductedCount: number
    // 채워질 id
    id?: number
  }
  interface LessonPlan {
    date: string; time: string; roomId: number
    instructorKey: string; status: string; deducted: boolean; cat: 'p'|'r'|'d'|'g'
  }
  interface MemberPlan {
    name: string; phone: string; gender: string; registeredAt: string
    instructorKey: string; preferredSlot: string
    passes: PassPlan[]
    lastAttended: string | null
  }

  // 충돌 회피 전역 집합
  const usedRoom = new Set<string>()
  const usedInstr = new Set<string>()
  const usedMember = new Set<string>()
  const rk = (d: string, t: string, r: number) => `${d}#${t}#${r}`
  const ik = (d: string, t: string, k: string) => `${d}#${t}#${k}`
  const mk = (d: string, t: string, n: string) => `${d}#${t}#${n}`

  function placeSlot(date: string, instrKey: string, memberName: string, preferred: string): { time: string; roomId: number } | null {
    const order = [preferred, ...SLOTS.filter(s => s !== preferred)]
    for (const t of order) {
      if (usedInstr.has(ik(date, t, instrKey))) continue
      if (usedMember.has(mk(date, t, memberName))) continue
      for (const r of rooms) {
        if (!usedRoom.has(rk(date, t, r.id))) {
          usedRoom.add(rk(date, t, r.id)); usedInstr.add(ik(date, t, instrKey)); usedMember.add(mk(date, t, memberName))
          return { time: t, roomId: r.id }
        }
      }
    }
    return null
  }

  // 회원 생성
  const members: MemberPlan[] = []
  let phoneSeq = 2000
  for (let i = 0; i < MEMBER_NAMES.length; i++) {
    const name = MEMBER_NAMES[i]
    // 등록월 분포 (들쑥날쑥): 1월 많고, 3월 피크, 2월/5월 적게
    const monthWeights = [{ v: 0, w: 9 }, { v: 1, w: 5 }, { v: 2, w: 11 }, { v: 3, w: 7 }, { v: 4, w: 8 }]
    const m = pickWeighted(monthWeights)
    const day = randInt(1, 27)
    const reg = new Date(2026, m, day)
    const instr = pickWeighted([{ v: 'owner', w: 3 }, { v: 'A', w: 3 }, { v: 'B', w: 3 }, { v: 'C', w: 3 }])
    members.push({
      name, phone: `010-${String(++phoneSeq).padStart(4, '0')}-${String(randInt(1000, 9999))}`,
      gender: pick(['남', '여']), registeredAt: ymd(reg),
      instructorKey: instr, preferredSlot: pick(SLOTS), passes: [], lastAttended: null,
    })
  }

  // 수강권 + 수업 계획
  const productByKey = Object.fromEntries(PRODUCTS.map(p => [p.key, p])) as Record<ProductKey, typeof PRODUCTS[number]>

  function makePass(member: MemberPlan, productKey: ProductKey, paidAtD: Date, paymentType: string): PassPlan {
    const p = productByKey[productKey]
    const discount = rnd() < 0.3 ? roundKRW(randInt(3, 10) * 10000) : 0
    const amount = Math.max(p.price - discount, roundKRW(p.price * 0.8))
    const end = addDays(paidAtD, p.durationDays)
    return {
      productKey, passName: p.name, passType: p.passType,
      paidAt: ymd(paidAtD), startDate: ymd(paidAtD), endDate: ymd(end),
      paymentAmount: amount, paymentMethod: pickWeighted(METHODS), paymentType,
      instructorKey: member.instructorKey, totalCount: p.totalCount, lessons: [], deductedCount: 0,
    }
  }

  // 개별수업 생성기 (그룹 제외)
  function genIndividualLessons(member: MemberPlan, pass: PassPlan) {
    const instr = INSTRUCTORS.find(x => x.key === pass.instructorKey)!
    const cat = payrollCat(pass.passName)
    let cursor = new Date(pass.startDate)
    let placed = 0
    const limit = pass.totalCount
    let guard = 0
    while (placed < limit && cursor <= PERIOD_END && guard < 400) {
      guard++
      const wd = cursor.getDay()
      if (instr.days.includes(wd)) {
        const slot = placeSlot(ymd(cursor), instr.key, member.name, member.preferredSlot)
        if (slot) {
          const status = pickWeighted(PAST_STATUS)
          const ded = DEDUCTED.has(status)
          pass.lessons.push({ date: ymd(cursor), time: slot.time, roomId: slot.roomId, instructorKey: instr.key, status, deducted: ded, cat })
          if (ded) { placed++; pass.deductedCount++; if (status === 'completed') member.lastAttended = ymd(cursor) }
          else placed += 0 // 사전취소는 회차 안 줄지만 일정 1개로 카운트하지 않음 → 다음 주 진행
        }
      }
      cursor = addDays(cursor, 1)
    }
  }

  // 회원의 고정 수업요일: A/B/C 강사는 강사 출근요일 그대로, 원장(매일)은 회원별 2요일 고정 (결정적)
  function classWeekdays(member: MemberPlan, instr: typeof INSTRUCTORS[number]): number[] {
    if (instr.days.length <= 2) return instr.days
    const pairs = [[1, 4], [2, 5], [3, 6], [1, 3], [2, 4], [3, 5], [4, 6]]
    const idx = (member.name.length + Math.max(0, SLOTS.indexOf(member.preferredSlot))) % pairs.length
    return pairs[idx]
  }

  // 미래(6~8월) 예약 수업 — 활성 개인 수강권의 잔여를 주간 시간표대로 분산 예약.
  // 결정적(rnd 미사용)이라 과거(1~5월) 데이터엔 영향 없음. 만료일·잔여횟수 초과 방지.
  function genUpcoming(member: MemberPlan, pass: PassPlan) {
    const remaining = pass.totalCount - pass.deductedCount
    if (remaining <= 0) return
    const passEnd = new Date(pass.endDate)
    if (passEnd < TODAY) return // 이미 만료 → 미래 예약 X
    const horizon = passEnd < UPCOMING_END ? passEnd : UPCOMING_END
    const instr = INSTRUCTORS.find(x => x.key === pass.instructorKey)!
    const days = classWeekdays(member, instr)
    // 주당 1~2회 (결정적): 이름·선호시간 해시로 고정 → 큰 잔여는 8월까지 분산
    const perWeek = ((member.name.charCodeAt(0) + Math.max(0, SLOTS.indexOf(member.preferredSlot))) % 5) < 2 ? 2 : 1
    const cat = payrollCat(pass.passName)
    let placed = 0
    let weekStart = addDays(new Date(TODAY), -new Date(TODAY).getDay()) // 이번 주 일요일
    let guard = 0
    while (placed < remaining && weekStart <= horizon && guard < 30) {
      guard++
      let bookedThisWeek = 0
      for (const wd of days) {
        if (placed >= remaining || bookedThisWeek >= perWeek) break
        const date = addDays(weekStart, wd)
        if (date < TODAY || date > horizon) continue
        const slot = placeSlot(ymd(date), instr.key, member.name, member.preferredSlot)
        if (slot) {
          pass.lessons.push({ date: ymd(date), time: slot.time, roomId: slot.roomId, instructorKey: instr.key, status: 'scheduled', deducted: false, cat })
          placed++; bookedThisWeek++
        }
      }
      weekStart = addDays(weekStart, 7)
    }
  }

  for (const member of members) {
    // 상품 선택 (가중)
    const firstKey = pickWeighted<ProductKey>([
      { v: 'trial', w: 16 }, { v: 'p10', w: 30 }, { v: 'p20', w: 16 }, { v: 'p30', w: 7 },
      { v: 'duet10', w: 11 }, { v: 'rehab10', w: 6 }, { v: 'group8', w: 14 },
    ])
    const regD = new Date(member.registeredAt)
    const firstPass = makePass(member, firstKey, regD, '신규결제')
    member.passes.push(firstPass)

    if (firstKey === 'group8') {
      // 그룹 회원: 개별수업 X (그룹세션 예약은 뒤에서). 인스트럭터는 그룹 담당(owner)로 강제
      firstPass.instructorKey = 'owner'
      member.instructorKey = 'owner'
    } else {
      genIndividualLessons(member, firstPass)
      // 체험 → 전환(개인10/20회 재결제), 70%
      if (firstKey === 'trial' && rnd() < 0.7) {
        const convKey = pickWeighted<ProductKey>([{ v: 'p10', w: 60 }, { v: 'p20', w: 30 }, { v: 'rehab10', w: 10 }])
        const convD = addDays(regD, randInt(7, 21))
        if (convD <= PERIOD_END) {
          const conv = makePass(member, convKey, convD, '재결제')
          member.passes.push(conv); genIndividualLessons(member, conv)
        }
      }
      // 일반 재결제: 첫 수강권 거의 소진 + 40%
      else if (firstPass.deductedCount >= firstPass.totalCount * 0.7 && rnd() < 0.4) {
        const reKey = pickWeighted<ProductKey>([{ v: 'p10', w: 45 }, { v: 'p20', w: 35 }, { v: 'p30', w: 20 }])
        const lastLesson = firstPass.lessons.filter(l => l.deducted).map(l => l.date).sort().pop()
        const reD = lastLesson ? addDays(new Date(lastLesson), randInt(3, 14)) : addDays(regD, 60)
        if (reD <= PERIOD_END) {
          const re = makePass(member, reKey, reD, '재결제')
          member.passes.push(re); genIndividualLessons(member, re)
        }
      }
      // 활성 수강권에 미래 예약 소량
      const active = member.passes[member.passes.length - 1]
      genUpcoming(member, active)
    }
  }

  // ── 그룹세션 + 예약 ── (매주 화/목 20:00, 샵3, 강사=원장)
  const groupRoom = rooms[Math.min(2, rooms.length - 1)]
  interface GSPlan { date: string; time: string; roomId: number; reservations: Array<{ memberName: string; passRef: PassPlan; status: string }> }
  const groupSessions: GSPlan[] = []
  const groupMembers = members.filter(m => m.passes.some(p => p.productKey === 'group8'))
  {
    let cursor = new Date(PERIOD_START)
    while (cursor <= UPCOMING_END) {
      const wd = cursor.getDay()
      if (wd === 2 || wd === 4) {
        const dstr = ymd(cursor)
        const time = '20:00'
        const isPast = cursor <= PERIOD_END
        if (!usedRoom.has(rk(dstr, time, groupRoom.id))) {
          usedRoom.add(rk(dstr, time, groupRoom.id)); usedInstr.add(ik(dstr, time, 'owner'))
          const gs: GSPlan = { date: dstr, time, roomId: groupRoom.id, reservations: [] }
          // 예약 후보: 그룹수강권 잔여+유효 회원
          const candidates = groupMembers.filter(m => {
            const gp = m.passes.find(p => p.productKey === 'group8')!
            return gp && gp.deductedCount < gp.totalCount && new Date(gp.startDate) <= cursor && new Date(gp.endDate) >= cursor
          })
          if (isPast) {
            // 과거: 2~4명 출석/취소/노쇼 (rnd 순서 보존 — 기존 그대로)
            const n = Math.min(candidates.length, randInt(2, 4))
            for (let j = 0; j < n; j++) {
              const m = candidates[j]
              if (usedMember.has(mk(dstr, time, m.name))) continue
              const gp = m.passes.find(p => p.productKey === 'group8')!
              usedMember.add(mk(dstr, time, m.name))
              const status = pickWeighted([{ v: 'attended', w: 85 }, { v: 'cancelled', w: 10 }, { v: 'noshow', w: 5 }])
              if (status === 'attended' || status === 'noshow') { gp.deductedCount++; if (status === 'attended') m.lastAttended = dstr }
              gs.reservations.push({ memberName: m.name, passRef: gp, status })
            }
            if (gs.reservations.length > 0) groupSessions.push(gs)
          } else {
            // 미래: 시간표상 그룹수업 슬롯 노출. 예약은 유효 그룹권 회원만(결정적·차감 X·status=reserved)
            const n = Math.min(candidates.length, 3)
            for (let j = 0; j < n; j++) {
              const m = candidates[j]
              if (usedMember.has(mk(dstr, time, m.name))) continue
              const gp = m.passes.find(p => p.productKey === 'group8')!
              usedMember.add(mk(dstr, time, m.name))
              gs.reservations.push({ memberName: m.name, passRef: gp, status: 'reserved' })
            }
            groupSessions.push(gs) // 미래는 예약 0이어도 시간표 노출
          }
        }
      }
      cursor = addDays(cursor, 1)
    }
  }

  // ── 집계 (요약/검증용) ──
  const allPasses = members.flatMap(m => m.passes)
  const allLessons = members.flatMap(m => m.passes.flatMap(p => p.lessons))
  const revenueByMonth: Record<string, number> = {}
  for (const p of allPasses) { const mo = p.paidAt.slice(0, 7); revenueByMonth[mo] = (revenueByMonth[mo] ?? 0) + p.paymentAmount }

  // 강사 급여(수업 기반): 비-오너 강사, 차감수업 × 단가, 월별
  const payByInstrMonth: Record<string, number> = {} // key: instrKey|YYYY-MM
  for (const l of allLessons) {
    if (!l.deducted) continue
    const instr = INSTRUCTORS.find(x => x.key === l.instructorKey)!
    if (instr.role === 'owner') continue
    const rate = l.cat === 'r' ? instr.rates.r : l.cat === 'd' ? instr.rates.d : l.cat === 'g' ? instr.rates.g : instr.rates.p
    const k = `${l.instructorKey}|${l.date.slice(0, 7)}`
    payByInstrMonth[k] = (payByInstrMonth[k] ?? 0) + rate
  }

  // ── 비용 거래 계획 ──
  interface ExpensePlan { date: string; rawCategory: string; category: string; amount: number; method: string; classification: string; counterparty?: string; memo?: string }
  const expenses: ExpensePlan[] = []
  const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']
  for (const mo of months) {
    expenses.push({ date: `${mo}-01`, rawCategory: '정기결제', category: '정기결제', amount: -99000, method: '카드', classification: 'business', counterparty: 'CRM/음악 구독', memo: '월 정기결제' })
    expenses.push({ date: `${mo}-05`, rawCategory: '임대료', category: '임대료', amount: -2200000, method: '계좌이체', classification: 'business', counterparty: '건물주', memo: '월 임대료' })
    expenses.push({ date: `${mo}-05`, rawCategory: '관리비', category: '관리비', amount: -250000, method: '계좌이체', classification: 'business', counterparty: '관리사무소', memo: '공용 관리비' })
    expenses.push({ date: `${mo}-10`, rawCategory: '보험료', category: '보험료', amount: -80000, method: '카드', classification: 'business', counterparty: '배상책임보험', memo: '월 보험료' })
    expenses.push({ date: `${mo}-15`, rawCategory: '공과금', category: '공과금', amount: -roundKRW(randInt(15, 25) * 10000, 1000), method: '카드', classification: 'business', counterparty: '전기/수도/가스', memo: '공과금' })
    expenses.push({ date: `${mo}-08`, rawCategory: '마케팅비', category: '마케팅비', amount: -roundKRW(randInt(25, 90) * 10000), method: '카드', classification: 'business', counterparty: '인스타/네이버 광고', memo: 'SNS 광고' })
    expenses.push({ date: `${mo}-18`, rawCategory: '소모품', category: '소모품', amount: -roundKRW(randInt(8, 25) * 10000, 1000), method: '카드', classification: 'living', counterparty: '운동 소모품', memo: '밴드/소도구' })
    expenses.push({ date: `${mo}-25`, rawCategory: '예비비', category: '예비비', amount: -300000, method: '계좌이체', classification: 'reserve', counterparty: '세금적립', memo: '세금 대비 적립' })
    expenses.push({ date: `${mo}-12`, rawCategory: '식비', category: '식비', amount: -roundKRW(randInt(4, 8) * 10000, 1000), method: '카드', classification: 'living', counterparty: '직원 간식', memo: '간식/식대' })
  }
  // 강사 급여: 전월분을 익월 10일 지급 (1~4월분 → 2~5월 지급)
  const payMonths: Record<string, string> = { '2026-01': '2026-02', '2026-02': '2026-03', '2026-03': '2026-04', '2026-04': '2026-05' }
  for (const [workMo, payMo] of Object.entries(payMonths)) {
    for (const instr of INSTRUCTORS) {
      if (instr.role === 'owner') continue
      const amt = payByInstrMonth[`${instr.key}|${workMo}`] ?? 0
      if (amt <= 0) continue
      const net = -Math.round(amt * 0.967) // 3.3% 원천징수
      expenses.push({ date: `${payMo}-10`, rawCategory: '급여', category: '급여', amount: net, method: '계좌이체', classification: 'business', counterparty: instr.name, memo: `${workMo} 수업료 정산(3.3% 공제)` })
    }
  }
  // 초기 비품 (1월, capital) + 강사 워크숍 교육비 (3월)
  expenses.push({ date: '2026-01-06', rawCategory: '사무용품', category: '사무용품', amount: -1200000, method: '카드', classification: 'capital', counterparty: '집기/비품', memo: '오픈 초기 비품' })
  expenses.push({ date: '2026-03-20', rawCategory: '교육비', category: '교육비', amount: -200000, method: '카드', classification: 'business', counterparty: '강사 워크숍', memo: '재교육' })

  // ── 요약 출력 ──
  const expenseByMonth: Record<string, number> = {}
  for (const e of expenses) { const mo = e.date.slice(0, 7); expenseByMonth[mo] = (expenseByMonth[mo] ?? 0) + e.amount }
  console.log('\n── 계획 요약 ──')
  console.log(`강사: ${INSTRUCTORS.length}명 (원장 1 + 강사 3)`)
  console.log(`수강권 상품: ${PRODUCTS.length}종`)
  console.log(`회원: ${members.length}명`)
  console.log(`수강권 결제(매출 row): ${allPasses.length}건`)
  console.log(`개별수업: ${allLessons.length}건 (차감 ${allLessons.filter(l => l.deducted).length} / 예약(미래) ${allLessons.filter(l => l.status === 'scheduled').length})`)
  const schedByMonth: Record<string, number> = {}
  for (const l of allLessons) if (l.status === 'scheduled') { const mo = l.date.slice(0, 7); schedByMonth[mo] = (schedByMonth[mo] ?? 0) + 1 }
  console.log(`  예약(미래) 월별: ${Object.entries(schedByMonth).sort().map(([m, c]) => `${m.slice(5)}월 ${c}건`).join(' / ') || '없음'}`)
  const futureGroup = groupSessions.filter(g => new Date(g.date) >= TODAY)
  console.log(`그룹세션: ${groupSessions.length}회 (과거 ${groupSessions.length - futureGroup.length} / 미래 ${futureGroup.length}) / 그룹예약: ${groupSessions.reduce((s, g) => s + g.reservations.length, 0)}건`)
  console.log(`비용 거래: ${expenses.length}건`)
  console.log('\n월별 매출 / 비용(절대값) / 순:')
  for (const mo of months) {
    const rev = revenueByMonth[mo] ?? 0; const exp = -(expenseByMonth[mo] ?? 0)
    console.log(`  ${mo}  매출 ${rev.toLocaleString().padStart(11)}  비용 ${exp.toLocaleString().padStart(10)}  순 ${(rev - exp).toLocaleString().padStart(11)}`)
  }
  const totalRev = Object.values(revenueByMonth).reduce((a, b) => a + b, 0)
  console.log(`  합계  매출 ${totalRev.toLocaleString()}`)

  if (!COMMIT) {
    console.log('\n🟡 DRY-RUN 종료 — 실제 입력하려면 --commit (권장: --wipe --commit)\n')
    return
  }

  // ───────────────────────── 실제 INSERT ─────────────────────────
  console.log('\n🟢 INSERT 시작...')

  // 1) 강사
  const instrIdByKey: Record<string, number> = {}
  for (const ins of INSTRUCTORS) {
    const { data, error } = await supabase.from('instructors').insert({
      name: ins.name, phone: null, role: ins.role,
      default_hourly_rate: ins.rates.p || 30000,
      rate_private: ins.rates.p || 30000, rate_rehab: ins.rates.r || 35000,
      rate_duet: ins.rates.d || 25000, rate_group: ins.rates.g || 22000,
      color: ins.color, active: true, owner_id: ownerId,
    }).select('id').single()
    if (error) throw new Error(`instructor ${ins.name}: ${error.message}`)
    instrIdByKey[ins.key] = (data as { id: number }).id
  }
  console.log(`  강사 ${Object.keys(instrIdByKey).length}명`)

  // 2) 상품
  const prodIdByKey: Record<string, number> = {}
  for (let i = 0; i < PRODUCTS.length; i++) {
    const p = PRODUCTS[i]
    const { data, error } = await supabase.from('pass_products').insert({
      name: p.name, pass_type: p.passType, duration_days: p.durationDays, total_count: p.totalCount,
      price: p.price, per_unit_price: Math.round(p.price / p.totalCount), display_order: i,
      category: p.category, active: true, owner_id: ownerId,
    }).select('id').single()
    if (error) throw new Error(`product ${p.name}: ${error.message}`)
    prodIdByKey[p.key] = (data as { id: number }).id
  }
  console.log(`  상품 ${Object.keys(prodIdByKey).length}종`)

  // 3) 회원
  const memberIdByName: Record<string, number> = {}
  for (const m of members) {
    const { data, error } = await supabase.from('members').insert({
      name: m.name, phone: m.phone, gender: m.gender, registered_at: m.registeredAt,
      last_attended_at: m.lastAttended, app_connected: false, tier: '일반', owner_id: ownerId,
    }).select('id').single()
    if (error) throw new Error(`member ${m.name}: ${error.message}`)
    memberIdByName[m.name] = (data as { id: number }).id
  }
  console.log(`  회원 ${Object.keys(memberIdByName).length}명`)

  // 4) 수강권 + 연결 매출 + 수업
  const linkedTx: Record<string, unknown>[] = []
  const lessonRows: Record<string, unknown>[] = []
  let passCount = 0
  for (const m of members) {
    const memberId = memberIdByName[m.name]
    for (const pass of m.passes) {
      const remaining = Math.max(0, pass.totalCount - pass.deductedCount)
      const status = remaining === 0 ? '이용만료' : '이용중'
      const instrId = instrIdByKey[pass.instructorKey]
      const { data, error } = await supabase.from('passes').insert({
        member_id: memberId, instructor_id: instrId, pass_name: pass.passName, pass_type: pass.passType,
        start_date: pass.startDate, end_date: pass.endDate, total_count: pass.totalCount,
        remaining_count: remaining, available_count: remaining, cancellable_count: remaining,
        status, payment_type: pass.paymentType, payment_amount: pass.paymentAmount,
        paid_at: pass.paidAt, payment_method: pass.paymentMethod, installment: '일시불',
        is_family: false, issued_at: pass.paidAt, owner_id: ownerId,
      }).select('id').single()
      if (error) throw new Error(`pass ${m.name}/${pass.passName}: ${error.message}`)
      pass.id = (data as { id: number }).id
      passCount++

      // 연결 매출 (v3.7)
      linkedTx.push({
        date: pass.paidAt, raw_category: '매출', category: '매출', amount: pass.paymentAmount,
        method: pass.paymentMethod, counterparty: m.name, person: null, classification: 'business',
        memo: `${pass.passName} ${pass.paymentType}`, member_id: memberId, instructor_id: instrId,
        pass_product_id: prodIdByKey[pass.productKey], pass_id: pass.id, owner_id: ownerId,
      })

      // 수업
      for (const l of pass.lessons) {
        lessonRows.push({
          pass_id: pass.id, member_id: memberId, instructor_id: instrIdByKey[l.instructorKey],
          room_id: l.roomId, lesson_date: l.date, lesson_time: l.time, duration_minutes: 50,
          status: l.status, deducted: l.deducted, owner_id: ownerId,
        })
      }
    }
  }
  console.log(`  수강권 ${passCount}건`)

  // 5) 연결 매출 + 비용 거래 batch
  const expenseRows = expenses.map(e => ({
    date: e.date, raw_category: e.rawCategory, category: e.category, amount: e.amount, method: e.method,
    counterparty: e.counterparty ?? null, person: null, classification: e.classification, memo: e.memo ?? null, owner_id: ownerId,
  }))
  await insertChunked('transactions', [...linkedTx, ...expenseRows])
  console.log(`  매출(연결) ${linkedTx.length}건 + 비용 ${expenseRows.length}건`)

  // 6) 수업 batch
  await insertChunked('lessons', lessonRows)
  console.log(`  수업 ${lessonRows.length}건`)

  // 7) 그룹세션 + 예약
  let gsCount = 0, grCount = 0
  for (const gs of groupSessions) {
    const { data, error } = await supabase.from('group_sessions').insert({
      instructor_id: instrIdByKey['owner'], session_name: '그룹 PT', lesson_date: gs.date, lesson_time: gs.time,
      duration_minutes: 50, capacity: 4, room_id: gs.roomId, active: true, owner_id: ownerId,
    }).select('id').single()
    if (error) throw new Error(`group_session ${gs.date}: ${error.message}`)
    const sessionId = (data as { id: number }).id
    gsCount++
    const resRows = gs.reservations.map(r => ({
      session_id: sessionId, member_id: memberIdByName[r.memberName], pass_id: r.passRef.id ?? null,
      status: r.status, deducted: r.status === 'attended' || r.status === 'noshow',
      // group_reservations는 owner_id 컬럼 없음 (parent 격리)
    }))
    if (resRows.length) {
      const { error: re } = await supabase.from('group_reservations').insert(resRows)
      if (re) throw new Error(`group_reservations ${gs.date}: ${re.message}`)
      grCount += resRows.length
    }
  }
  console.log(`  그룹세션 ${gsCount}회 / 예약 ${grCount}건`)

  console.log('\n✅ 시드 완료. 앱에서 확인해줘.\n')
}

async function insertChunked(table: string, rows: Record<string, unknown>[], size = 400) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size)
    const { error } = await supabase.from(table).insert(chunk)
    if (error) throw new Error(`${table} insert [${i}]: ${error.message}`)
  }
}

async function wipe(ownerId: string) {
  console.log('🧹 기존 데이터 정리 중...')
  // group_reservations: 이 owner의 group_sessions id들로 삭제
  const { data: gsIds } = await supabase.from('group_sessions').select('id').eq('owner_id', ownerId)
  const ids = (gsIds ?? []).map(r => (r as { id: number }).id)
  if (ids.length) await supabase.from('group_reservations').delete().in('session_id', ids)
  for (const t of ['lessons', 'group_sessions', 'transactions', 'passes', 'pass_products', 'members', 'instructors']) {
    const { error } = await supabase.from(t).delete().eq('owner_id', ownerId)
    if (error) throw new Error(`wipe ${t}: ${error.message}`)
  }
  console.log('🧹 정리 완료 (rooms는 보존)')
}

main().catch(e => { console.error('\n❌ ERROR:', e.message); process.exit(1) })
