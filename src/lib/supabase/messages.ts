import { getSupabaseClient } from './client'

export type MessageChannel = 'manual' | 'sms' | 'kakao' | 'email' | 'webpush'
export type MessageStatus = 'draft' | 'sent' | 'failed'

export interface MessageRecord {
  id: number
  channel: MessageChannel
  recipientGroup: string
  recipientCount: number
  recipientIds: number[] | null
  subject: string | null
  body: string
  status: MessageStatus
  sentAt: string | null
  memo: string | null
  createdAt: string
}

interface MessageRow {
  id: number
  channel: string
  recipient_group: string
  recipient_count: number
  recipient_ids: number[] | null
  subject: string | null
  body: string
  status: string
  sent_at: string | null
  memo: string | null
  created_at: string
}

function rowToMessage(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    channel: row.channel as MessageChannel,
    recipientGroup: row.recipient_group,
    recipientCount: row.recipient_count,
    recipientIds: row.recipient_ids,
    subject: row.subject,
    body: row.body,
    status: row.status as MessageStatus,
    sentAt: row.sent_at,
    memo: row.memo,
    createdAt: row.created_at,
  }
}

export async function fetchRecentMessages(limit: number = 20): Promise<MessageRecord[]> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('message_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return []
    return ((data ?? []) as MessageRow[]).map(rowToMessage)
  } catch { return [] }
}

export interface CreateMessageInput {
  channel?: MessageChannel
  recipientGroup: string
  recipientIds: number[]
  subject?: string
  body: string
  status?: MessageStatus
  memo?: string
}

export async function createMessage(input: CreateMessageInput): Promise<number> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('message_records')
    .insert({
      channel: input.channel ?? 'manual',
      recipient_group: input.recipientGroup,
      recipient_count: input.recipientIds.length,
      recipient_ids: input.recipientIds,
      subject: input.subject ?? null,
      body: input.body,
      status: input.status ?? 'draft',
      sent_at: input.status === 'sent' ? new Date().toISOString() : null,
      memo: input.memo ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Create message failed: ${error.message}`)
  return (data as { id: number }).id
}

export async function markMessageSent(id: number): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('message_records')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`Mark sent failed: ${error.message}`)
}
