import type { Transaction, PaymentMethod } from '@/types/domain'
import { normalizeCategory, classify } from '@/lib/categories/normalize'

const VALID_METHODS = new Set<PaymentMethod>(['카드', '계좌이체', '현금'])

function isValidMethod(s: unknown): s is PaymentMethod {
  return typeof s === 'string' && VALID_METHODS.has(s as PaymentMethod)
}

function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw !== 'string') return null
  const cleaned = raw.replace(/[^\d.\-]/g, '')
  if (!cleaned) return null
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function parseDate(raw: unknown): string | null {
  // Excel serial number
  if (typeof raw === 'number') {
    const ms = (raw - 25569) * 86400 * 1000
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString().slice(0, 10)
  }
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  // "2024.02.22"
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(trimmed)) return trimmed.replace(/\./g, '-')
  // "2024-02-22"
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  // Excel serial as string "45344"
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10)
    return parseDate(n)
  }
  return null
}

function cleanPerson(raw: unknown): string | undefined {
  if (raw == null) return undefined
  const trimmed = String(raw).trim()
  if (!trimmed) return undefined
  // 휴리스틱: 순수 숫자거나 "%" 포함은 사람 이름 아님 (잘못된 데이터)
  if (/^\d+$/.test(trimmed)) return undefined
  if (trimmed.includes('%')) return undefined
  return trimmed
}

export function parseSheetRows(rows: string[][]): Transaction[] {
  const out: Transaction[] = []
  for (const row of rows) {
    const [, , dateRaw, categoryRaw, amountRaw, methodRaw, , memo1, memo2] = row

    if (!dateRaw || !categoryRaw || !amountRaw || !methodRaw) continue

    const date = parseDate(dateRaw)
    if (!date) continue

    const category = normalizeCategory(categoryRaw)
    if (!category) continue

    const amount = parseAmount(amountRaw)
    if (amount === null) continue

    if (!isValidMethod(methodRaw)) continue

    const counterparty = memo1 ? String(memo1).trim() || undefined : undefined
    const person = cleanPerson(memo2)

    out.push({
      date,
      rawCategory: String(categoryRaw).trim(),
      category,
      amount,
      method: methodRaw,
      counterparty,
      person,
      classification: classify(category),
      memo: undefined,
    })
  }
  return out
}
