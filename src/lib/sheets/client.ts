import { google } from 'googleapis'

export interface SheetConfig {
  clientEmail: string
  privateKey: string
  spreadsheetId: string
  range: string
}

export function getSheetConfig(): SheetConfig {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID
  const range = process.env.GOOGLE_SHEETS_RANGE ?? '전체 통합!A2:I3500'

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error('Missing Google Sheets env vars (GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, GOOGLE_SHEETS_ID)')
  }

  return { clientEmail, privateKey, spreadsheetId, range }
}

export async function fetchSheetRows(config: SheetConfig): Promise<string[][]> {
  const auth = new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: config.range,
  })
  return (response.data.values ?? []) as string[][]
}
