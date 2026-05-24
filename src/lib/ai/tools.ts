/**
 * AI 챗 비서가 호출하는 Tool 6개.
 *
 * 각 tool은 declaration(스키마)과 execute(실제 supabase 호출)로 구성.
 * Gemini가 사용자 질문 분석 후 적절한 tool을 골라 호출 → 결과를 받아 자연어로 답변.
 *
 * 보안:
 * - 모든 tool은 read-only (조회만, 변경/삭제 X)
 * - 회원 전화번호는 마스킹 (010-****-1234)
 */
import { SchemaType, type ToolHandler } from './gemini'
import { fetchAllMembers, fetchMemberById } from '@/lib/supabase/members'
import { fetchAllInstructors, fetchInstructorById } from '@/lib/supabase/instructors'
import { fetchActivePassesByMember } from '@/lib/supabase/passes'
import { loadTransactions } from '@/lib/data/loader'
import { fetchAutoPayrollCounts } from '@/lib/supabase/payroll-auto'
import { computePayrollTotal } from '@/lib/analytics/payroll'
import { simulateVAT, type Quarter } from '@/lib/tax/vat'
import { simulateIncomeTax } from '@/lib/tax/income-tax'
import { recommendReserve } from '@/lib/tax/reserve'
import { loadProfile } from '@/lib/profile/settings'

function maskPhone(phone: string | null): string {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8) return '—'
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`
}

// ─────────────────────────────────────────────────────────
// Tool 1: 회원 검색 (이름)
// ─────────────────────────────────────────────────────────
const searchMembers: ToolHandler = {
  name: 'searchMembers',
  declaration: {
    name: 'searchMembers',
    description: '회원을 이름(부분 일치)으로 검색. 결과는 최대 10명. 전화번호는 마스킹됨. 회원 상세를 보려면 다음에 getMemberDetail(id) 호출.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: '회원 이름의 일부 또는 전체. 비우면 최근 등록된 회원 10명' },
      },
    },
  },
  execute: async (args) => {
    const query = ((args.query as string) ?? '').trim()
    const all = await fetchAllMembers()
    const filtered = query
      ? all.filter(m => m.name.includes(query))
      : all.slice(0, 10)
    return filtered.slice(0, 10).map(m => ({
      id: m.id,
      name: m.name,
      phone: maskPhone(m.phone),
      registeredAt: m.registeredAt,
      lastAttendedAt: m.lastAttendedAt,
    }))
  },
}

// ─────────────────────────────────────────────────────────
// Tool 2: 회원 상세 (수강권 포함)
// ─────────────────────────────────────────────────────────
const getMemberDetail: ToolHandler = {
  name: 'getMemberDetail',
  declaration: {
    name: 'getMemberDetail',
    description: '특정 회원의 상세 정보 + 활성 수강권 목록. 먼저 searchMembers로 id를 알아내야 함.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        memberId: { type: SchemaType.INTEGER, description: 'searchMembers 결과의 id' },
      },
      required: ['memberId'],
    },
  },
  execute: async (args) => {
    const id = args.memberId as number
    const member = await fetchMemberById(id)
    if (!member) return { error: '회원을 찾을 수 없습니다' }
    const passes = await fetchActivePassesByMember(id)
    return {
      id: member.id,
      name: member.name,
      phone: maskPhone(member.phone),
      registeredAt: member.registeredAt,
      lastAttendedAt: member.lastAttendedAt,
      memo: member.memo,
      activePasses: passes.map(p => ({
        passName: p.passName,
        passType: p.passType,
        remainingCount: p.remainingCount,
        totalCount: p.totalCount,
        endDate: p.endDate,
        paymentAmount: p.paymentAmount,
        paidAt: p.paidAt,
      })),
    }
  },
}

// ─────────────────────────────────────────────────────────
// Tool 3: 월별 매출·지출 집계
// ─────────────────────────────────────────────────────────
const getMonthlyFinancials: ToolHandler = {
  name: 'getMonthlyFinancials',
  declaration: {
    name: 'getMonthlyFinancials',
    description: '지정 연/월의 매출·지출 집계. 카테고리별 분해 포함. 사장님이 "이번 달 매출/지출", "5월 광고비" 등을 물을 때 사용.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        year: { type: SchemaType.INTEGER, description: '예: 2026' },
        month: { type: SchemaType.INTEGER, description: '1~12. 생략 시 연간 집계' },
      },
      required: ['year'],
    },
  },
  execute: async (args) => {
    const year = args.year as number
    const month = args.month as number | undefined
    const txs = await loadTransactions()
    const inRange = txs.filter(t => {
      if (!t.date.startsWith(String(year))) return false
      if (month && t.date.slice(5, 7) !== String(month).padStart(2, '0')) return false
      return true
    })
    const revenue = inRange.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
    const expenses = inRange.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
    // 카테고리별 지출
    const byCat = new Map<string, number>()
    for (const t of inRange) {
      if (t.amount >= 0) continue
      byCat.set(t.category, (byCat.get(t.category) ?? 0) + Math.abs(t.amount))
    }
    const expensesByCategory = Array.from(byCat.entries())
      .map(([cat, amt]) => ({ category: cat, amount: amt }))
      .sort((a, b) => b.amount - a.amount)
    return {
      period: month ? `${year}년 ${month}월` : `${year}년 (연간)`,
      revenue,
      expenses,
      operatingProfit: revenue - expenses,
      transactionCount: inRange.length,
      expensesByCategory,
    }
  },
}

// ─────────────────────────────────────────────────────────
// Tool 4: 강사 급여 미리계산 (lessons 자동 집계)
// ─────────────────────────────────────────────────────────
const getInstructorPayrollPreview: ToolHandler = {
  name: 'getInstructorPayrollPreview',
  declaration: {
    name: 'getInstructorPayrollPreview',
    description: '특정 강사의 특정 월 급여 미리계산. lessons + group_sessions에서 자동 집계 + 시급 × 회차 × (1 - 3.3% 원천징수).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        instructorId: { type: SchemaType.INTEGER },
        yearMonth: { type: SchemaType.STRING, description: 'YYYY-MM 형식. 예: 2026-05' },
      },
      required: ['instructorId', 'yearMonth'],
    },
  },
  execute: async (args) => {
    const instructorId = args.instructorId as number
    const yearMonth = args.yearMonth as string
    const instructor = await fetchInstructorById(instructorId)
    if (!instructor) return { error: '강사를 찾을 수 없습니다' }
    const counts = await fetchAutoPayrollCounts(instructorId, yearMonth)
    const b = computePayrollTotal(instructor, counts)
    const taxWithholding = Math.round(b.grossTotal * 0.033)
    return {
      instructorName: instructor.name,
      yearMonth,
      counts,
      grossAmount: b.grossTotal,
      breakdown: {
        privateTotal: b.privateTotal,
        rehabTotal: b.rehabTotal,
        duetTotal: b.duetTotal,
        groupTotal: b.groupTotal,
      },
      taxWithholding,
      netAmount: b.grossTotal - taxWithholding,
    }
  },
}

// ─────────────────────────────────────────────────────────
// Tool 5: 세금 시뮬레이션 (부가세 + 종소세)
// ─────────────────────────────────────────────────────────
const simulateTax: ToolHandler = {
  name: 'simulateTax',
  declaration: {
    name: 'simulateTax',
    description: '연간 부가세(분기별) + 종소세 시뮬레이션. profile의 사업자유형/청년감면 자동 반영. asOfDate 기준 연환산.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        asOfDate: { type: SchemaType.STRING, description: 'YYYY-MM-DD. 기준 시점. 생략 시 오늘' },
      },
    },
  },
  execute: async (args) => {
    const asOfDate = (args.asOfDate as string) ?? new Date().toISOString().slice(0, 10)
    const year = parseInt(asOfDate.slice(0, 4), 10)
    const txs = await loadTransactions()
    const profile = await loadProfile()

    const vatOptions = { taxPayerType: profile.taxPayerType }
    const vatByQuarter = [1, 2, 3, 4].map(q => {
      const r = simulateVAT(txs, year, q as Quarter, vatOptions)
      return { quarter: q, outputVAT: r.outputVAT, inputVAT: r.inputVAT, estimatedVAT: r.estimatedVAT }
    })

    const incomeTax = simulateIncomeTax(txs, asOfDate, {
      youngStartupReduction: profile.isYoungStartupEligible ? profile.youngStartupReductionRate : 0,
      noranusanContribution: profile.noranusanAnnualContribution,
      pensionSavings: profile.pensionAnnualContribution,
    })

    return {
      asOfDate,
      taxPayerType: profile.taxPayerType,
      isYoungStartupEligible: profile.isYoungStartupEligible,
      youngStartupReductionRate: profile.youngStartupReductionRate,
      vat: {
        byQuarter: vatByQuarter,
        annualEstimate: vatByQuarter.reduce((s, q) => s + Math.max(0, q.estimatedVAT), 0),
      },
      incomeTax,
    }
  },
}

// ─────────────────────────────────────────────────────────
// Tool 6: 권장 월 예비비
// ─────────────────────────────────────────────────────────
const getReserveRecommendation: ToolHandler = {
  name: 'getReserveRecommendation',
  declaration: {
    name: 'getReserveRecommendation',
    description: '세금 대비 권장 월 예비비. 분기 VAT + 종소세 연환산 / 12. 사장님이 "매달 얼마 적립?" 물을 때 사용.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        asOfDate: { type: SchemaType.STRING, description: 'YYYY-MM-DD. 생략 시 오늘' },
      },
    },
  },
  execute: async (args) => {
    const asOfDate = (args.asOfDate as string) ?? new Date().toISOString().slice(0, 10)
    const txs = await loadTransactions()
    const profile = await loadProfile()
    const r = recommendReserve(txs, asOfDate, {
      youngStartupReduction: profile.isYoungStartupEligible ? profile.youngStartupReductionRate : 0,
      noranusanContribution: profile.noranusanAnnualContribution,
      pensionSavings: profile.pensionAnnualContribution,
      taxPayerType: profile.taxPayerType,
    })
    return {
      asOfDate,
      monthlyRecommended: r.monthly,
      annualTaxEstimate: r.annualTaxEstimate,
      breakdown: r.breakdown,
    }
  },
}

// ─────────────────────────────────────────────────────────
// Tool 7 (보너스): 강사 목록 — 빠른 lookup
// ─────────────────────────────────────────────────────────
const listInstructors: ToolHandler = {
  name: 'listInstructors',
  declaration: {
    name: 'listInstructors',
    description: '전체 강사 목록 (id, 이름, 역할, 시급). 사장님이 강사 이름만 알고 id를 모를 때 먼저 호출.',
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  execute: async () => {
    const all = await fetchAllInstructors()
    return all.map(i => ({
      id: i.id,
      name: i.name,
      role: i.role,
      ratePrivate: i.ratePrivate,
      rateRehab: i.rateRehab,
      rateDuet: i.rateDuet,
      rateGroup: i.rateGroup,
      active: i.active,
    }))
  },
}

export const ALL_TOOLS: ToolHandler[] = [
  searchMembers,
  getMemberDetail,
  getMonthlyFinancials,
  listInstructors,
  getInstructorPayrollPreview,
  simulateTax,
  getReserveRecommendation,
]
