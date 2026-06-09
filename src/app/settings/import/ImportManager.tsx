'use client'

import { useState, useRef } from 'react'
import { csvToObjects } from '@/lib/csv/parse'
import { IMPORT_ENTITIES, IMPORT_SCHEMAS, buildTemplateCSV, type ImportEntity } from '@/lib/import/schema'

interface ImportResult { inserted: number; failed: number; errors: { row: number; reason: string }[]; error?: string }

export function ImportManager() {
  const [entity, setEntity] = useState<ImportEntity>('members')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const schema = IMPORT_SCHEMAS[entity]
  const requiredHeaders = schema.columns.filter(c => c.required).map(c => c.header)
  const missingRequired = rows.length > 0 ? requiredHeaders.filter(h => !headers.includes(h)) : []

  function reset() {
    setRows([]); setHeaders([]); setFileName(''); setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function switchEntity(e: ImportEntity) {
    setEntity(e); reset()
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    try {
      const text = await file.text()
      const parsed = csvToObjects(text)
      setHeaders(parsed.headers)
      setRows(parsed.rows)
      setFileName(file.name)
    } catch {
      setHeaders([]); setRows([]); setFileName('')
      setResult({ inserted: 0, failed: 0, errors: [], error: 'CSV 읽기 실패 — 파일을 확인하세요' })
    }
  }

  function downloadTemplate() {
    const csv = buildTemplateCSV(entity)
    // 엑셀 한글 깨짐 방지를 위해 BOM 추가
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${schema.label}_템플릿.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function runImport() {
    if (rows.length === 0 || missingRequired.length > 0) return
    setImporting(true); setResult(null)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity, rows }),
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
              entity === e
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {IMPORT_SCHEMAS[e].label}
          </button>
        ))}
      </div>

      {/* 권장 순서 안내 */}
      <div className="text-[11px] text-neutral-500 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 break-keep">
        💡 권장 순서: <b>강사 → 회원 → 수업 / 매출·지출</b>. 수업은 회원·강사 이름으로 연결되니, 회원·강사를 먼저 가져오세요.
      </div>

      {/* 컬럼 가이드 + 템플릿 */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">{schema.label} CSV 형식</h2>
          <button
            onClick={downloadTemplate}
            className="text-xs font-medium text-violet-600 hover:underline shrink-0"
          >
            ↓ 템플릿 CSV 받기
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-neutral-400 text-left border-b border-neutral-100">
                <th className="py-1.5 pr-3 font-medium whitespace-nowrap">컬럼명</th>
                <th className="py-1.5 pr-3 font-medium whitespace-nowrap">필수</th>
                <th className="py-1.5 pr-3 font-medium whitespace-nowrap">예시</th>
                <th className="py-1.5 font-medium">설명</th>
              </tr>
            </thead>
            <tbody>
              {schema.columns.map(c => (
                <tr key={c.header} className="border-b border-neutral-50 last:border-0">
                  <td className="py-1.5 pr-3 font-medium text-neutral-700 whitespace-nowrap">{c.header}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{c.required ? <span className="text-red-500">필수</span> : <span className="text-neutral-300">선택</span>}</td>
                  <td className="py-1.5 pr-3 text-neutral-500 whitespace-nowrap">{c.example || '—'}</td>
                  <td className="py-1.5 text-neutral-400 break-keep">{c.hint ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {schema.note && <p className="text-[11px] text-neutral-400 mt-2 break-keep">ⓘ {schema.note}</p>}
      </div>

      {/* 파일 업로드 */}
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="block w-full text-sm text-neutral-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
        />
        {fileName && <p className="text-xs text-neutral-500 mt-2">📄 {fileName} · {rows.length}행 인식</p>}
        {missingRequired.length > 0 && (
          <p className="text-xs text-red-600 mt-2 break-keep">
            ⚠ 필수 컬럼이 없어요: <b>{missingRequired.join(', ')}</b> — 헤더 이름을 위 형식과 똑같이 맞춰주세요.
          </p>
        )}
      </div>

      {/* 미리보기 */}
      {rows.length > 0 && missingRequired.length === 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="text-xs font-semibold text-neutral-600 mb-2">미리보기 (처음 {Math.min(8, rows.length)}행 / 총 {rows.length}행)</div>
          <div className="overflow-x-auto">
            <table className="text-xs whitespace-nowrap">
              <thead>
                <tr className="text-neutral-400 text-left border-b border-neutral-100">
                  {schema.columns.map(c => <th key={c.header} className="py-1.5 pr-4 font-medium">{c.header}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((r, i) => (
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
          disabled={importing || rows.length === 0 || missingRequired.length > 0}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {importing ? '가져오는 중…' : `${schema.label} ${rows.length > 0 ? `${rows.length}행 ` : ''}가져오기`}
        </button>
        {(rows.length > 0 || result) && (
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
