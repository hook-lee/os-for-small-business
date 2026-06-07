'use client'

import { useRef, useState, useEffect, type PointerEvent } from 'react'

/**
 * 손글씨 서명 패드. 손가락(터치)·마우스 모두 지원(Pointer Events).
 * 그릴 때마다 onChange(base64 PNG). 비우면 onChange(null).
 */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    // 고해상도 대응
    const ratio = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    c.width = rect.width * ratio
    c.height = rect.height * ratio
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111827'
  }, [])

  function pointFromEvent(e: PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!
    const rect = c.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    drawing.current = true
    const p = pointFromEvent(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const p = pointFromEvent(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    setEmpty(false)
    const url = canvasRef.current?.toDataURL('image/png') ?? null
    onChange(url)
  }

  function clear() {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    setEmpty(true)
    onChange(null)
  }

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="w-full h-40 border border-neutral-300 rounded-lg bg-white touch-none cursor-crosshair"
        />
        {empty && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-300 pointer-events-none">
            여기에 서명해주세요
          </div>
        )}
      </div>
      <button type="button" onClick={clear} className="mt-1 text-xs text-neutral-500 hover:text-neutral-800 underline">
        지우고 다시
      </button>
    </div>
  )
}
