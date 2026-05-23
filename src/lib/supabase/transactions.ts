import type { Transaction, Category, PaymentMethod, TxClassification } from '@/types/domain'
import { getSupabaseClient } from './client'

interface TransactionRow {
  id: number
  date: string
  raw_category: string
  category: string
  amount: number
  method: string
  counterparty: string | null
  person: string | null
  classification: string
  memo: string | null
}

function rowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    rawCategory: row.raw_category,
    category: row.category as Category,
    amount: Number(row.amount),
    method: row.method as PaymentMethod,
    counterparty: row.counterparty ?? undefined,
    person: row.person ?? undefined,
    classification: row.classification as TxClassification,
    memo: row.memo ?? undefined,
  }
}

export async function fetchAllTransactions(): Promise<Transaction[]> {
  const supabase = getSupabaseClient()
  // PostgREST는 요청당 최대 1000행(기본 max-rows)만 반환하므로 range로 페이지네이션.
  const PAGE = 1000
  const all: TransactionRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, date, raw_category, category, amount, method, counterparty, person, classification, memo')
      .order('date', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Supabase fetch failed: ${error.message}`)
    const rows = (data ?? []) as TransactionRow[]
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all.map(rowToTransaction)
}

export async function deleteTransaction(id: number): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw new Error(`Supabase delete failed: ${error.message}`)
}

export interface NewTransactionInput {
  date: string
  rawCategory: string
  category: Category
  amount: number
  method: PaymentMethod
  counterparty?: string
  person?: string
  classification: TxClassification
  memo?: string
}

export async function insertTransaction(input: NewTransactionInput): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('transactions').insert({
    date: input.date,
    raw_category: input.rawCategory,
    category: input.category,
    amount: input.amount,
    method: input.method,
    counterparty: input.counterparty ?? null,
    person: input.person ?? null,
    classification: input.classification,
    memo: input.memo ?? null,
  })
  if (error) throw new Error(`Supabase insert failed: ${error.message}`)
}
