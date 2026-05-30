'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { StudioSettings } from '@/lib/supabase/studio-settings'

/**
 * 운영정보 설정 폼.
 *
 * 1차 wave: 핵심 6개 카드만 노출.
 * 나머지 11개 설정은 DEFAULT_STUDIO_SETTINGS에 정의되어 있고, '고급' 섹션 토글로 점진 노출 가능.
 */
export function OperationsForm({ initial }: { initial: StudioSettings }) {
  const router = useRouter()
  const [s, setS] = useState<StudioSettings>(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  function patch<K extends keyof StudioSettings>(key: K, value: StudioSettings[K]) {
    setS(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setErrorMsg('')
    try {
      const res = await fetch('/api/studio-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setStatus('saved')
      router.refresh()
      setTimeout(() => setStatus('idle'), 2000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '알 수 없는 오류')
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 01. 예약·취소 가능 시간 */}
      <SettingCard
        num={1}
        title="예약·취소 가능 시간"
        description="회원이 수업 시작 몇 시간 전까지 예약/취소 가능한지 설정합니다."
      >
        <div className="space-y-3">
          <Row label="프라이빗 예약 가능">
            <span className="text-sm text-neutral-500">수업 시작</span>
            <NumberInput value={s.privateBookingHoursBefore} onChange={v => patch('privateBookingHoursBefore', v)} min={0} max={720} suffix="시간" />
            <NumberInput value={s.privateBookingMinutesBefore} onChange={v => patch('privateBookingMinutesBefore', v)} min={0} max={59} suffix="분" />
            <span className="text-sm text-neutral-500">전까지</span>
          </Row>
          <Row label="그룹 예약 가능">
            <span className="text-sm text-neutral-500">수업 시작</span>
            <NumberInput value={s.groupBookingHoursBefore} onChange={v => patch('groupBookingHoursBefore', v)} min={0} max={720} suffix="시간" />
            <NumberInput value={s.groupBookingMinutesBefore} onChange={v => patch('groupBookingMinutesBefore', v)} min={0} max={59} suffix="분" />
            <span className="text-sm text-neutral-500">전까지</span>
          </Row>
          <Row label="프라이빗 취소 가능">
            <span className="text-sm text-neutral-500">수업 시작</span>
            <NumberInput value={s.privateCancelHoursBefore} onChange={v => patch('privateCancelHoursBefore', v)} min={0} max={720} suffix="시간" />
            <NumberInput value={s.privateCancelMinutesBefore} onChange={v => patch('privateCancelMinutesBefore', v)} min={0} max={59} suffix="분" />
            <span className="text-sm text-neutral-500">전까지</span>
          </Row>
          <Row label="그룹 취소 가능">
            <span className="text-sm text-neutral-500">수업 시작</span>
            <NumberInput value={s.groupCancelHoursBefore} onChange={v => patch('groupCancelHoursBefore', v)} min={0} max={720} suffix="시간" />
            <NumberInput value={s.groupCancelMinutesBefore} onChange={v => patch('groupCancelMinutesBefore', v)} min={0} max={59} suffix="분" />
            <span className="text-sm text-neutral-500">전까지</span>
          </Row>
        </div>
      </SettingCard>

      {/* 02. 폐강 시간 */}
      <SettingCard
        num={2}
        title="폐강 시간 설정"
        description="최소 수강인원 미달 시 수업이 자동 폐강되는 시점을 설정합니다."
      >
        <Row label="폐강 시점">
          <span className="text-sm text-neutral-500">수업 시작</span>
          <NumberInput value={s.autoCloseHoursBeforeStart} onChange={v => patch('autoCloseHoursBeforeStart', v)} min={0} max={72} suffix="시간 전" />
          <span className="text-sm text-neutral-500">자동 폐강</span>
        </Row>
      </SettingCard>

      {/* 03. 예약대기 횟수 */}
      <SettingCard
        num={3}
        title="예약대기 횟수 제한"
        description="한 회원이 동시에 예약대기에 등록할 수 있는 최대 횟수를 설정합니다."
      >
        <Row label="회원당 최대">
          <NumberInput value={s.waitlistMaxCount} onChange={v => patch('waitlistMaxCount', v)} min={0} max={50} suffix="회까지 대기 가능" />
        </Row>
      </SettingCard>

      {/* 04. 일별 예약 가능 횟수 */}
      <SettingCard
        num={4}
        title="일별 예약 가능 횟수"
        description="회원이 하루에 최대 몇 개의 그룹 수업을 예약할 수 있는지 설정합니다."
      >
        <Row label="회원당 하루">
          <NumberInput value={s.dailyBookingMaxGroupCount} onChange={v => patch('dailyBookingMaxGroupCount', v)} min={1} max={20} suffix="개 그룹 수업까지 예약 가능" />
        </Row>
        <div className="text-xs text-neutral-400 mt-2">
          제한 기준: <strong>수강권별</strong> (수강권 1개당 일별 제한 적용)
        </div>
      </SettingCard>

      {/* 05. 그룹 예약대기 인원 표시 */}
      <SettingCard
        num={5}
        title="그룹 예약대기 인원 표시"
        description="회원에게 대기 인원수를 보여줄지 설정합니다."
      >
        <div className="space-y-2">
          <Checkbox
            checked={s.showWaitlistCountForReserved}
            onChange={v => patch('showWaitlistCountForReserved', v)}
            label="그룹 수업 예약자에게 대기 인원 표시"
          />
          <Checkbox
            checked={s.showWaitlistCountForWaitlisted}
            onChange={v => patch('showWaitlistCountForWaitlisted', v)}
            label="예약대기 회원에게 대기 인원 표시"
          />
        </div>
      </SettingCard>

      {/* 06. 회원앱 옵션 */}
      <SettingCard
        num={6}
        title="회원앱 표시 옵션"
        description="회원이 보는 화면에 어떤 정보를 표시할지 설정합니다."
      >
        <div className="space-y-2">
          <Checkbox
            checked={s.hideExpiredPassesFromMembers}
            onChange={v => patch('hideExpiredPassesFromMembers', v)}
            label="만료된 수강권은 회원앱에서 숨김"
          />
          <Checkbox
            checked={s.showAllLessons}
            onChange={v => patch('showAllLessons', v)}
            label="회원이 자기 수강권으로 들을 수 없는 수업도 표시"
          />
        </div>
      </SettingCard>

      {/* 고급 설정 — 점진 노출 */}
      <div className="border-t border-neutral-200 pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(v => !v)}
          className="text-sm text-blue-600 hover:underline"
        >
          {showAdvanced ? '▾ 고급 설정 접기' : '▸ 고급 설정 펼치기'}
        </button>
      </div>

      {showAdvanced && (
        <div className="space-y-4">
          <SettingCard num={7} title="당일 예약 변경 가능 시간 (그룹)" description="그룹 수업 시작 후 N시간까지 예약 변경 가능">
            <Row label="변경 가능">
              <span className="text-sm text-neutral-500">수업 시작</span>
              <NumberInput value={s.groupChangeHoursAfterStart} onChange={v => patch('groupChangeHoursAfterStart', v)} min={0} max={24} suffix="시간 후까지" />
            </Row>
          </SettingCard>

          <SettingCard num={8} title="예약대기 자동 예약 시간" description="자동으로 예약대기 → 예약 전환되는 시점">
            <Row label="자동 예약">
              <span className="text-sm text-neutral-500">수업 시작</span>
              <NumberInput value={s.waitlistAutoBookHoursBefore} onChange={v => patch('waitlistAutoBookHoursBefore', v)} min={0} max={48} suffix="시간 전" />
            </Row>
          </SettingCard>

          <SettingCard num={9} title="예약 가능 기간" description="수업일 N일 전부터 예약 받기">
            <div className="space-y-3">
              <Row label="프라이빗">
                <span className="text-sm text-neutral-500">수업일</span>
                <NumberInput value={s.privateBookableDaysAhead} onChange={v => patch('privateBookableDaysAhead', v)} min={0} max={90} suffix="일 전" />
                <TimeInput value={s.privateBookableTimeOfDay} onChange={v => patch('privateBookableTimeOfDay', v)} />
                <span className="text-sm text-neutral-500">부터</span>
              </Row>
              <Row label="그룹">
                <span className="text-sm text-neutral-500">수업일</span>
                <NumberInput value={s.groupBookableDaysAhead} onChange={v => patch('groupBookableDaysAhead', v)} min={0} max={90} suffix="일 전" />
                <TimeInput value={s.groupBookableTimeOfDay} onChange={v => patch('groupBookableTimeOfDay', v)} />
                <span className="text-sm text-neutral-500">부터</span>
              </Row>
            </div>
          </SettingCard>

          <SettingCard num={10} title="프라이빗 예약 시간 단위" description="예약 시간 분 단위 선택지">
            <div className="flex gap-2 flex-wrap">
              {(['flexible', '30', '20', '15', '10', '5'] as const).map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => patch('privateBookingTimeUnit', u)}
                  className={`px-3 py-1.5 text-sm rounded border ${
                    s.privateBookingTimeUnit === u
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  {u === 'flexible' ? '정시' : `${u}분`}
                </button>
              ))}
            </div>
          </SettingCard>

          <SettingCard num={11} title="기타 회원앱 옵션">
            <div className="space-y-2">
              <Checkbox checked={s.useMessageBoard} onChange={v => patch('useMessageBoard', v)} label="문자 게시판 사용" />
              <Checkbox checked={s.useAcademicRecord} onChange={v => patch('useAcademicRecord', v)} label="학적 기능 사용" />
              <Checkbox checked={s.useCancelWithoutDeduction} onChange={v => patch('useCancelWithoutDeduction', v)} label="횟수 차감되지 않는 취소 사용" />
              <Checkbox checked={s.autoFillUnpaidAmount} onChange={v => patch('autoFillUnpaidAmount', v)} label="수강권 미수금 자동 입력" />
              <Checkbox checked={s.useMemberAppLounge} onChange={v => patch('useMemberAppLounge', v)} label="회원앱 라운지 사용" />
            </div>
          </SettingCard>
        </div>
      )}

      {/* 저장 */}
      <div className="flex items-center gap-3 sticky bottom-0 bg-white border-t border-neutral-200 py-3 -mx-4 px-4">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-4 py-2 rounded text-sm"
        >
          {status === 'saving' ? '저장 중...' : status === 'saved' ? '저장됨 ✓' : '운영 정보 저장'}
        </button>
        {status === 'error' && (
          <span className="text-sm text-red-600">⚠ {errorMsg}</span>
        )}
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────
// 공용 컴포넌트
// ─────────────────────────────────────────────
function SettingCard({ num, title, description, children }: {
  num: number
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <div className="mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-bold text-neutral-400 tabular-nums">{String(num).padStart(2, '0')}</span>
          <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
        </div>
        {description && <p className="text-xs text-neutral-500 mt-1 ml-6">{description}</p>}
      </div>
      <div className="ml-6">{children}</div>
    </Card>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-neutral-700 font-medium min-w-[140px]">{label}</span>
      {children}
    </div>
  )
}

function NumberInput({ value, onChange, min, max, suffix }: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  suffix?: string
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="w-16 border border-neutral-300 rounded px-2 py-1 text-sm text-center tabular-nums"
      />
      {suffix && <span className="text-sm text-neutral-600">{suffix}</span>}
    </div>
  )
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="border border-neutral-300 rounded px-2 py-1 text-sm tabular-nums"
    />
  )
}

function Checkbox({ checked, onChange, label }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-neutral-300"
      />
      <span className="text-neutral-700">{label}</span>
    </label>
  )
}
