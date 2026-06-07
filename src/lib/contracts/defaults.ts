/**
 * 전자계약 — 기본 샘플 템플릿 + 변수 치환.
 *  - 원장이 편집 안 한 종류는 이 기본 샘플을 사용.
 *  - {{센터명}} {{회원명}} {{강사명}} {{날짜}} 변수를 발송 시 치환.
 *  ⚠️ 법률 자문이 아닌 일반 샘플 — 센터 상황에 맞게 검토·수정 후 사용 권장.
 */

export type ContractKind = 'member_terms' | 'refund' | 'privacy' | 'instructor'

export const CONTRACT_KINDS: ContractKind[] = ['member_terms', 'refund', 'privacy', 'instructor']

export const CONTRACT_KIND_LABELS: Record<ContractKind, string> = {
  member_terms: '회원 이용약관',
  refund: '환불 규정 동의',
  privacy: '개인정보 수집·이용 동의',
  instructor: '강사 근로/위탁 계약',
}

/** 각 종류의 대상(회원 vs 강사). */
export const CONTRACT_TARGET: Record<ContractKind, 'member' | 'instructor'> = {
  member_terms: 'member',
  refund: 'member',
  privacy: 'member',
  instructor: 'instructor',
}

export function isContractKind(v: string): v is ContractKind {
  return (CONTRACT_KINDS as string[]).includes(v)
}

export interface ContractTemplate {
  kind: ContractKind
  title: string
  body: string
}

export const CONTRACT_DEFAULTS: Record<ContractKind, { title: string; body: string }> = {
  member_terms: {
    title: '회원 이용약관',
    body: `{{센터명}} 회원 이용약관

제1조 (목적)
본 약관은 {{센터명}}(이하 "센터")의 시설 및 프로그램 이용에 관해 회원과 센터의 권리·의무를 정합니다.

제2조 (수강권)
1. 회원은 등록한 수강권의 유효기간과 잔여 횟수 내에서 수업을 이용합니다.
2. 유효기간·횟수는 등록 시 안내된 내용을 따릅니다.

제3조 (예약 및 취소)
1. 수업은 센터가 정한 방법으로 예약·취소합니다.
2. 당일 취소·노쇼는 1회 차감될 수 있습니다.

제4조 (일시정지)
부상·여행 등 사유로 수강권을 일시정지할 수 있으며, 누적 정지 한도는 센터 정책을 따릅니다.

제5조 (회원의 의무)
회원은 시설을 안전하게 이용하고, 타 회원·강사에게 피해를 주지 않습니다.

제6조 (안전·책임)
회원은 건강 상태를 사전에 고지하며, 본인의 부주의로 인한 부상에 대해 센터는 책임지지 않습니다.

본인은 위 약관을 충분히 읽고 이해하였으며 이에 동의합니다.

회원명: {{회원명}}
동의일: {{날짜}}`,
  },
  refund: {
    title: '환불 규정 동의서',
    body: `{{센터명}} 환불 규정 동의서

1. 환불은 관계 법령(방문판매 등에 관한 법률 등)과 센터 환불 규정에 따릅니다.
2. 환불 금액 = 결제액 − (이용한 횟수 × 정상 1회 단가) − 위약금(해당 시).
3. 이용 개시 전 청약철회 시 전액 환불합니다.
4. 일시정지·양도는 센터 정책에 따릅니다.
5. 환불 신청은 센터에 직접 접수합니다.

본인은 위 환불 규정을 확인하였으며 이에 동의합니다.

회원명: {{회원명}}
동의일: {{날짜}}`,
  },
  privacy: {
    title: '개인정보 수집·이용 동의서',
    body: `개인정보 수집·이용 동의서

{{센터명}}은(는) 회원 관리를 위해 아래와 같이 개인정보를 수집·이용합니다.

1. 수집 항목: 성명, 연락처, 결제·수강 이력
2. 수집·이용 목적: 회원 관리, 수업 예약·정산, 공지 안내
3. 보유·이용 기간: 회원 탈퇴 후 관계 법령에서 정한 기간까지
4. 동의 거부 권리: 동의를 거부할 수 있으나, 이 경우 회원 서비스 이용이 제한될 수 있습니다.

본인은 위 내용을 확인하였으며 개인정보 수집·이용에 동의합니다. (필수)

회원명: {{회원명}}
동의일: {{날짜}}`,
  },
  instructor: {
    title: '강사 업무 위탁 계약서',
    body: `{{센터명}} 강사 업무 위탁 계약서

{{센터명}}(이하 "센터")와 강사 {{강사명}}(이하 "강사")는 다음과 같이 계약을 체결합니다.

제1조 (업무) 강사는 센터가 배정한 회원 수업을 성실히 진행합니다.
제2조 (보수) 정산은 센터가 정한 회당 단가 및 인센티브 기준에 따릅니다.
제3조 (정산일) 매월 센터가 정한 지급일에 정산합니다.
제4조 (의무) 강사는 수업 시간을 준수하고, 회원 개인정보를 비밀로 유지합니다.
제5조 (해지) 양 당사자는 사전 통지로 본 계약을 해지할 수 있습니다.

본인은 위 계약 내용을 충분히 이해하였으며 이에 동의합니다.

강사명: {{강사명}}
동의일: {{날짜}}`,
  },
}

/** {{변수}} 치환. 알 수 없는 변수는 원형 유지. */
export function renderContract(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{([^}]+)\}\}/g, (_, k: string) => {
    const key = k.trim()
    return vars[key] ?? `{{${key}}}`
  })
}
