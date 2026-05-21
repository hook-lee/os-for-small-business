import type { Transaction, Category, PaymentMethod, TxClassification } from '@/types/domain'
import { getSupabaseClient } from './client'

interface TransactionRow {
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
  const { data, error } = await supabase
    .from('transactions')
    .select('date, raw_category, category, amount, method, counterparty, person, classification, memo')
    .order('date', { ascending: true })
    .limit(10000)
  if (error) throw new Error(`Supabase fetch failed: ${error.message}`)
  return (data ?? []).map(rowToTransaction)
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
