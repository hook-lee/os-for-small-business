import { redirect } from 'next/navigation'

export default async function PayrollRedirect({ searchParams }: { searchParams: Promise<{ ym?: string }> }) {
  const params = await searchParams
  const ymQuery = params.ym ? `&ym=${params.ym}` : ''
  redirect(`/instructors?tab=payroll${ymQuery}`)
}
