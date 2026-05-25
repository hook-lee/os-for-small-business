'use client'

import { useState } from 'react'

/**
 * 컬러 팔레트 + 커스텀 hex 입력. hex 직접 모르는 사용자용.
 * 14개 톤별 프리셋 + 커스텀 입력 옵션 + 비우기 버튼.
 */
const PRESET_COLORS = [
  { hex: '#ef4444', name: '레드' },
  { hex: '#f97316', name: '오렌지' },
  { hex: '#f59e0b', name: '앰버' },
  { hex: '#eab308', name: '옐로' },
  { hex: '#84cc16', name: '라임' },
  { hex: '#22c55e', name: '그린' },
  { hex: '#10b981', name: '에메랄드' },
  { hex: '#14b8a6', name: '틸' },
  { hex: '#06b6d4', name: '시안' },
  { hex: '#3b82f6', name: '블루' },
  { hex: '#6366f1', name: '인디고' },
  { hex: '#8b5cf6', name: '바이올렛' },
  { hex: '#ec4899', name: '핑크' },
  { hex: '#737373', name: '뉴트럴' },
]

export function ColorPicker({
  value,
  onChange,
  showCustom = true,
}: {
  value: string
  onChange: (hex: string) => void
  showCustom?: boolean
}) {
  const [showCustomInput, setShowCustomInput] = useState(false)
  // 현재 value가 프리셋에 있는지 확인. 없으면 커스텀
  const isPreset = PRESET_COLORS.some(c => c.hex.toLowerCase() === value.toLowerCase())
  const showInputBox = showCustomInput || (!!value && !isPreset)

  return (
    <div className="space-y-2">
      {/* 팔레트 */}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_COLORS.map(c => {
          const selected = value.toLowerCase() === c.hex.toLowerCase()
          return (
            <button
              key={c.hex}
              type="button"
              onClick={() => { onChange(c.hex); setShowCustomInput(false) }}
              className={`w-7 h-7 rounded-full transition-all hover:scale-110 ${
                selected ? 'ring-2 ring-offset-2 ring-neutral-800 scale-110' : 'ring-1 ring-neutral-300'
              }`}
              style={{ backgroundColor: c.hex }}
              title={`${c.name} ${c.hex}`}
              aria-label={`${c.name} 선택`}
            />
          )
        })}
        {/* 비우기 (선택 해제) */}
        <button
          type="button"
          onClick={() => { onChange(''); setShowCustomInput(false) }}
          className={`w-7 h-7 rounded-full bg-white border border-dashed transition-all hover:scale-110 flex items-center justify-center text-xs text-neutral-400 ${
            !value ? 'ring-2 ring-offset-2 ring-neutral-800 scale-110' : 'border-neutral-300'
          }`}
          title="색상 없음"
          aria-label="색상 없음"
        >
          ×
        </button>
        {/* 커스텀 hex 토글 */}
        {showCustom && (
          <button
            type="button"
            onClick={() => setShowCustomInput(v => !v)}
            className="w-7 h-7 rounded-full bg-gradient-to-br from-red-400 via-yellow-400 via-green-400 via-blue-400 to-purple-400 ring-1 ring-neutral-300 hover:scale-110 transition-all flex items-center justify-center text-xs text-white font-bold"
            title="커스텀 hex 입력"
            aria-label="커스텀 hex"
          >
            +
          </button>
        )}
      </div>

      {/* 커스텀 hex 입력 (토글) */}
      {showCustom && showInputBox && (
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full ring-1 ring-neutral-300 shrink-0"
            style={{ backgroundColor: value || '#ffffff' }}
          />
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="#6366f1"
            maxLength={7}
            className="flex-1 max-w-[140px] border border-neutral-300 rounded px-2 py-1 text-xs font-mono"
          />
          <span className="text-[10px] text-neutral-400">hex 직접 입력</span>
        </div>
      )}
    </div>
  )
}
