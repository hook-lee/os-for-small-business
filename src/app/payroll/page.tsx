import { redirect } from 'next/navigation'

export default async function PayrollRedirect({ searchParams }: { searchParams: Promise<{ ym?: string }> }) {
  await import('@/lib/supabase/guard').then(m => m.guardManagerPage())
  const params = await searchParams
  const ymQuery = params.ym ? `&ym=${params.ym}` : ''
  redirect(`/instructors?tab=payroll${ymQuery}`)
}
