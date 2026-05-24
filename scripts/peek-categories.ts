import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data } = await supabase
    .from('expense_categories')
    .select('name, classification, vat_deductible, income_tax_deductible, description')
    .order('display_order')

  for (const c of (data ?? []) as Array<{ name: string; classification: string; vat_deductible: boolean; income_tax_deductible: boolean; description: string }>) {
    const flags = [c.vat_deductible ? '부가세↓' : '', c.income_tax_deductible ? '종소세' : ''].filter(Boolean).join('+') || '-'
    console.log(`${c.name.padEnd(14)} [${c.classification.padEnd(10)}] [${flags.padEnd(10)}] ${(c.description || '').slice(0, 80)}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
