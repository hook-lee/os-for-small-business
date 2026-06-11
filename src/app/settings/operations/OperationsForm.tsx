'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { StudioSettings } from '@/lib/supabase/studio-settings'

/**
 * 운영정보 설정 폼.
 * 관련 설정을 그룹(예약 / 폐강 / 예약대기 / 회원앱 / 급여)으로 묶고 01~11 연속 번호로 표시.
 */
export function OperationsForm({ initial }: { initial: StudioSettings }) {
  const router = useRouter()
  const [s, setS] = useState<StudioSettings>(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

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
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* ── 예약 규칙 ── */}
      <GroupHeader>📅 예약 규칙</GroupHeader>

      <SettingCard num={1} title="예약·취소 가능 시간" description="회원이 수업 시작 몇 시간 전까지 예약/취소할 수 있는지">
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

      <SettingCard num={2} title="예약 가능 기간" description="수업일 N일 전부터 예약 받기">
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

      <SettingCard num={3} title="프라이빗 예약 시간 단위" description="예약 시간 분 단위 선택지">
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

      <SettingCard num={4} title="일별 예약 가능 횟수" description="회원이 하루에 최대 몇 개의 그룹 수업을 예약할 수 있는지">
        <Row label="회원당 하루">
          <NumberInput value={s.dailyBookingMaxGroupCount} onChange={v => patch('dailyBookingMaxGroupCount', v)} min={1} max={20} suffix="개 그룹 수업까지 예약 가능" />
        </Row>
        <div className="text-xs text-neutral-400 mt-2">제한 기준: <strong>수강권별</strong> (수강권 1개당 일별 제한 적용)</div>
      </SettingCard>

      {/* ── 폐강 ── */}
      <GroupHeader>⛔ 폐강</GroupHeader>

      <SettingCard num={5} title="폐강 기준" description="자동 폐강 시점 + 강사 성과(폐강률)에 집계할 수업 종류">
        <div className="space-y-3">
          <Row label="폐강 시점">
            <span className="text-sm text-neutral-500">수업 시작</span>
            <NumberInput value={s.autoCloseHoursBeforeStart} onChange={v => patch('autoCloseHoursBeforeStart', v)} min={0} max={72} suffix="시간 전" />
            <span className="text-sm text-neutral-500">자동 폐강</span>
          </Row>
          <div className="pt-2 border-t border-neutral-100">
            <Row label="폐강률 집계 종류">
              <TagsInput
                value={s.groupClosureCategories}
                onChange={v => patch('groupClosureCategories', v)}
                placeholder="예: 그룹, 단체, GX"
              />
            </Row>
            <p className="text-[11px] text-neutral-400 mt-1.5 pl-[140px] break-keep leading-relaxed">
              강사 성과의 <b>폐강률</b>은 여기 적은 수업 종류만 집계해요. 우리 센터가 그룹 수업을 «그룹»이 아닌 다른 이름(단체·GX 등)으로 부르면 그 이름을 넣어주세요. (수업 종류는 수업 추가 시 정하는 «카테고리»와 같아야 합니다.)
            </p>
          </div>
        </div>
      </SettingCard>

      {/* ── 예약대기 ── */}
      <GroupHeader>⏳ 예약대기</GroupHeader>

      <SettingCard num={6} title="예약대기 횟수 제한" description="한 회원이 동시에 예약대기에 등록할 수 있는 최대 횟수">
        <Row label="회원당 최대">
          <NumberInput value={s.waitlistMaxCount} onChange={v => patch('waitlistMaxCount', v)} min={0} max={50} suffix="회까지 대기 가능" />
        </Row>
      </SettingCard>

      <SettingCard num={7} title="예약대기 자동 예약 시간" description="자동으로 예약대기 → 예약 전환되는 시점">
        <Row label="자동 예약">
          <span className="text-sm text-neutral-500">수업 시작</span>
          <NumberInput value={s.waitlistAutoBookHoursBefore} onChange={v => patch('waitlistAutoBookHoursBefore', v)} min={0} max={48} suffix="시간 전" />
        </Row>
      </SettingCard>

      <SettingCard num={8} title="그룹 예약대기 인원 표시" description="회원에게 대기 인원수를 보여줄지">
        <div className="space-y-2">
          <Checkbox checked={s.showWaitlistCountForReserved} onChange={v => patch('showWaitlistCountForReserved', v)} label="그룹 수업 예약자에게 대기 인원 표시" />
          <Checkbox checked={s.showWaitlistCountForWaitlisted} onChange={v => patch('showWaitlistCountForWaitlisted', v)} label="예약대기 회원에게 대기 인원 표시" />
        </div>
      </SettingCard>

      {/* ── 회원앱 표시 ── */}
      <GroupHeader>📱 회원앱 표시</GroupHeader>

      <SettingCard num={9} title="회원앱 표시 옵션" description="회원이 보는 화면에 어떤 정보를 표시할지">
        <div className="space-y-2">
          <Checkbox checked={s.hideExpiredPassesFromMembers} onChange={v => patch('hideExpiredPassesFromMembers', v)} label="만료된 수강권은 회원앱에서 숨김" />
          <Checkbox checked={s.showAllLessons} onChange={v => patch('showAllLessons', v)} label="회원이 자기 수강권으로 들을 수 없는 수업도 표시" />
        </div>
      </SettingCard>

      <SettingCard num={10} title="기타 회원앱 옵션">
        <div className="space-y-2">
          <Checkbox checked={s.useMessageBoard} onChange={v => patch('useMessageBoard', v)} label="문자 게시판 사용" />
          <Checkbox checked={s.useAcademicRecord} onChange={v => patch('useAcademicRecord', v)} label="학적 기능 사용" />
          <Checkbox checked={s.useCancelWithoutDeduction} onChange={v => patch('useCancelWithoutDeduction', v)} label="횟수 차감되지 않는 취소 사용" />
          <p className="text-[11px] text-neutral-400 pl-6 break-keep leading-relaxed">
            위 <b>01 예약·취소 가능 시간</b>과 함께 <b>회원이 직접 취소</b>할 때의 차감 기준으로 쓰입니다. 원장이 일정에서 직접 처리할 땐 수업 상세 «취소·삭제»에서 차감 여부를 직접 고릅니다.
          </p>
          <Checkbox checked={s.autoFillUnpaidAmount} onChange={v => patch('autoFillUnpaidAmount', v)} label="수강권 미수금 자동 입력" />
          <Checkbox checked={s.useMemberAppLounge} onChange={v => patch('useMemberAppLounge', v)} label="회원앱 라운지 사용" />
        </div>
      </SettingCard>

      {/* ── 급여 ── */}
      <GroupHeader>💰 급여</GroupHeader>

      <SettingCard num={11} title="급여 정산 기준" description="당일취소·노쇼를 강사 급여(자동집계)에 반영할지 — 센터마다 다름">
        <div className="space-y-2">
          <Checkbox checked={s.payrollCountsSameDayCancel} onChange={v => patch('payrollCountsSameDayCancel', v)} label="당일 취소를 강사 급여에 반영" />
          <Checkbox checked={s.payrollCountsNoshow} onChange={v => patch('payrollCountsNoshow', v)} label="노쇼를 강사 급여에 반영" />
          <p className="text-[11px] text-neutral-400 pl-6 break-keep leading-relaxed">
            끄면 해당 수업은 <b>강사 시급 자동집계에서 제외</b>됩니다(강사에게 안 줌). 회원의 <b>회차 차감</b>과는 별개예요. 취소 기준 시간은 위 <b>01 예약·취소 가능 시간</b>에서 센터별로 설정하세요.
          </p>
        </div>
      </SettingCard>

      {/* 저장 */}
      <div className="flex items-center gap-3 sticky bottom-0 bg-white border-t border-neutral-200 py-3 -mx-4 px-4">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-4 py-2 rounded text-sm"
        >
          {status === 'saving' ? '저장 중...' : status === 'saved' ? '저장됨 ✓' : '운영 정보 저장'}
        </button>
        {status === 'error' && <span className="text-sm text-red-600">⚠ {errorMsg}</span>}
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────
// 공용 컴포넌트
// ─────────────────────────────────────────────
function GroupHeader({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider pt-3 pb-0.5">{children}</div>
}

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

/** 콤마로 구분하는 문자열 목록 입력 (예: "그룹, 단체, GX" → ['그룹','단체','GX']). */
function TagsInput({ value, onChange, placeholder }: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  // raw(화면 표시)를 로컬 소스로 두어 콤마/공백 타이핑이 자연스럽게 유지되게 한다.
  const [raw, setRaw] = useState(value.join(', '))
  function commit(text: string) {
    setRaw(text)
    onChange(text.split(',').map(t => t.trim()).filter(Boolean))
  }
  return (
    <input
      type="text"
      value={raw}
      placeholder={placeholder}
      onChange={e => commit(e.target.value)}
      className="flex-1 min-w-[180px] border border-neutral-300 rounded px-2 py-1 text-sm"
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
