'use client'

import { useState, useRef } from 'react'
import { csvToObjects } from '@/lib/csv/parse'
import { guessMapping, applyMapping } from '@/lib/import/match'
import { IMPORT_ENTITIES, IMPORT_SCHEMAS, buildTemplateCSV, type ImportEntity } from '@/lib/import/schema'

interface ImportResult { inserted: number; failed: number; errors: { row: number; reason: string }[]; error?: string }

export function ImportManager() {
  const [entity, setEntity] = useState<ImportEntity>('members')
  const [fileName, setFileName] = useState('')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({}) // 우리컬럼 → CSV헤더('' = 없음)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const schema = IMPORT_SCHEMAS[entity]
  const requiredUnmapped = rows.length > 0
    ? schema.columns.filter(c => c.required && !mapping[c.header]).map(c => c.header)
    : []
  const loaded = rows.length > 0
  const mappedRows = loaded ? applyMapping(rows, schema.columns, mapping) : []

  function reset() {
    setRows([]); setCsvHeaders([]); setMapping({}); setFileName(''); setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }
  function switchEntity(e: ImportEntity) { setEntity(e); reset() }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    try {
      const text = await file.text()
      const parsed = csvToObjects(text)
      if (parsed.headers.length === 0) {
        setResult({ inserted: 0, failed: 0, errors: [], error: '빈 파일이거나 헤더가 없어요' })
        return
      }
      setCsvHeaders(parsed.headers)
      setRows(parsed.rows)
      setFileName(file.name)
      // 자동 매핑 추측 (null → '')
      const guess = guessMapping(parsed.headers, schema.columns)
      const init: Record<string, string> = {}
      schema.columns.forEach(c => { init[c.header] = guess[c.header] ?? '' })
      setMapping(init)
    } catch {
      reset()
      setResult({ inserted: 0, failed: 0, errors: [], error: 'CSV 읽기 실패 — 파일을 확인하세요' })
    }
  }

  function setMap(ourCol: string, csvHeader: string) {
    setMapping(m => ({ ...m, [ourCol]: csvHeader }))
  }

  function downloadTemplate() {
    const csv = buildTemplateCSV(entity)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }) // BOM = 엑셀 한글 보호
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${schema.label}_템플릿.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function runImport() {
    if (!loaded || requiredUnmapped.length > 0) return
    setImporting(true); setResult(null)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity, rows: mappedRows }),
      })
      const json = await res.json() as ImportResult & { error?: string }
      if (!res.ok && json.inserted == null) {
        setResult({ inserted: 0, failed: 0, errors: [], error: json.error ?? '가져오기 실패' })
      } else {
        setResult({ inserted: json.inserted ?? 0, failed: json.failed ?? 0, errors: json.errors ?? [], error: json.error })
      }
    } catch (err) {
      setResult({ inserted: 0, failed: 0, errors: [], error: (err as Error).message })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 엔티티 탭 */}
      <div className="flex flex-wrap gap-1.5">
        {IMPORT_ENTITIES.map(e => (
          <button
            key={e}
            onClick={() => switchEntity(e)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              entity === e ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {IMPORT_SCHEMAS[e].label}
          </button>
        ))}
      </div>

      <div className="text-[11px] text-neutral-500 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 break-keep">
        💡 권장 순서: <b>강사 → 회원 → 수업 / 매출·지출</b>. 어떤 양식의 CSV를 올려도 컬럼을 자동으로 추측해 매핑해줘요(아래에서 확인·수정).
      </div>

      {/* 파일 업로드 */}
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-sm font-semibold">{schema.label} CSV 올리기</span>
          <button onClick={downloadTemplate} className="text-xs font-medium text-violet-600 hover:underline shrink-0">↓ 표준 템플릿 받기</button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="block w-full text-sm text-neutral-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
        />
        {fileName && <p className="text-xs text-neutral-500 mt-2">📄 {fileName} · {rows.length}행 · 컬럼 {csvHeaders.length}개 인식</p>}
      </div>

      {/* 컬럼 매핑 */}
      {loaded && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="text-sm font-semibold mb-1">컬럼 연결</div>
          <p className="text-[11px] text-neutral-400 mb-3 break-keep">우리 항목 ← 당신의 CSV 컬럼. 자동 추천을 채워뒀어요. 틀린 게 있으면 바꾸거나 «(비우기)»로 두세요.</p>
          <div className="space-y-2">
            {schema.columns.map(col => {
              const unmapped = col.required && !mapping[col.header]
              return (
                <div key={col.header} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <div className="w-28 shrink-0 text-sm">
                    <span className="font-medium text-neutral-700">{col.header}</span>
                    {col.required && <span className="text-red-500 text-xs ml-0.5">*</span>}
                  </div>
                  <span className="text-neutral-300 shrink-0">←</span>
                  <select
                    value={mapping[col.header] ?? ''}
                    onChange={e => setMap(col.header, e.target.value)}
                    className={`flex-1 min-w-0 border rounded-lg px-2 py-1.5 text-sm bg-white ${unmapped ? 'border-red-300 ring-1 ring-red-200' : 'border-neutral-300'}`}
                  >
                    <option value="">(비우기)</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  {col.hint && <span className="hidden sm:block text-[10px] text-neutral-400 w-32 shrink-0 break-keep">{col.hint}</span>}
                </div>
              )
            })}
          </div>
          {requiredUnmapped.length > 0 && (
            <p className="text-xs text-red-600 mt-3 break-keep">⚠ 필수 항목을 연결하세요: <b>{requiredUnmapped.join(', ')}</b></p>
          )}
          {schema.note && <p className="text-[11px] text-neutral-400 mt-2 break-keep">ⓘ {schema.note}</p>}
        </div>
      )}

      {/* 미리보기 (매핑 적용 결과) */}
      {loaded && requiredUnmapped.length === 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="text-xs font-semibold text-neutral-600 mb-2">미리보기 — 연결 결과 (처음 {Math.min(8, mappedRows.length)}행 / 총 {mappedRows.length}행)</div>
          <div className="overflow-x-auto">
            <table className="text-xs whitespace-nowrap">
              <thead>
                <tr className="text-neutral-400 text-left border-b border-neutral-100">
                  {schema.columns.map(c => <th key={c.header} className="py-1.5 pr-4 font-medium">{c.header}</th>)}
                </tr>
              </thead>
              <tbody>
                {mappedRows.slice(0, 8).map((r, i) => (
                  <tr key={i} className="border-b border-neutral-50 last:border-0">
                    {schema.columns.map(c => <td key={c.header} className="py-1.5 pr-4 text-neutral-600">{r[c.header] || '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 실행 */}
      <div className="flex items-center gap-2">
        <button
          onClick={runImport}
          disabled={importing || !loaded || requiredUnmapped.length > 0}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {importing ? '가져오는 중…' : `${schema.label}${loaded ? ` ${mappedRows.length}행` : ''} 가져오기`}
        </button>
        {(loaded || result) && (
          <button onClick={reset} className="px-3 py-2 rounded-lg text-sm text-neutral-500 hover:bg-neutral-100">초기화</button>
        )}
      </div>

      {/* 결과 */}
      {result && (
        <div className={`rounded-lg border p-4 ${result.error && result.inserted === 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
          {result.error && result.inserted === 0 ? (
            <p className="text-sm text-red-700">⚠ {result.error}</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-emerald-800">
                ✅ {result.inserted}건 가져오기 완료{result.failed > 0 ? ` · ${result.failed}건 건너뜀` : ''}
              </p>
              {result.error && <p className="text-xs text-amber-700 mt-1">중간에 멈춤: {result.error}</p>}
              {result.errors.length > 0 && (
                <div className="mt-2 text-xs text-neutral-600 max-h-40 overflow-y-auto space-y-0.5">
                  {result.errors.map((e, i) => <div key={i}>· {e.row}행: {e.reason}</div>)}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
