/**
 * 경량 markdown → HTML 변환 (XSS 안전).
 *
 * 적용 순서가 중요:
 * 1. HTML 특수 문자 escape (가장 먼저)
 * 2. markdown 변환 (우리가 추가하는 <strong>/<code>/<br>은 안전)
 *
 * `dangerouslySetInnerHTML`에 들어가는 모든 문자열은 이 함수 통과 필수.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * `**bold**` + `\`code\`` + `\n` 만 지원하는 최소 markdown.
 * 사용자/AI 입력의 텍스트를 안전하게 HTML로 변환.
 */
export function renderSafeMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-neutral-100 px-1 rounded text-[11px]">$1</code>')
    .replace(/\n/g, '<br/>')
}

/**
 * 카테고리 description처럼 `**bold**`만 쓰는 경우.
 * 클래스 인자로 커스텀 strong 스타일 적용 가능.
 */
export function renderSafeBold(text: string, strongClass?: string): string {
  const escaped = escapeHtml(text)
  const tag = strongClass ? `<strong class="${escapeHtml(strongClass)}">` : '<strong>'
  return escaped.replace(/\*\*(.+?)\*\*/g, `${tag}$1</strong>`)
}
