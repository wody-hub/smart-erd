/**
 * 숫자를 한국 원화 표기로 포맷한다.
 *
 * @param amount 금액 (원화 단위 정수)
 * @returns 포맷된 금액 문자열 (예: "150,000,000원")
 */
export function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

/**
 * ISO 8601 날짜를 locale 기준으로 포맷한다.
 *
 * @param date ISO 8601 날짜 문자열 (예: "2026-01-01")
 * @param locale BCP 47 언어 태그 (예: "ko", "en")
 * @returns 포맷된 날짜 문자열
 */
export function formatProjectDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date));
}

/**
 * 시작일이 종료일보다 같거나 이전인지 검증한다.
 * 둘 중 하나라도 비어 있으면 true를 반환한다.
 *
 * @param startDate 시작일 (ISO 8601 또는 빈 문자열)
 * @param endDate 종료일 (ISO 8601 또는 빈 문자열)
 * @returns 날짜 순서가 유효하면 true
 */
export function isDateOrderValid(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate) {
    return true;
  }
  return new Date(endDate) >= new Date(startDate);
}

/**
 * 시작일/종료일 쌍의 입력 정합성을 검증한다.
 * 둘 다 입력했거나 둘 다 비어 있어야 유효하다.
 *
 * @param startDate 시작일 (ISO 8601 또는 빈 문자열)
 * @param endDate 종료일 (ISO 8601 또는 빈 문자열)
 * @returns 날짜 쌍 정합성이 유효하면 true
 */
export function isDatePairValid(startDate: string, endDate: string): boolean {
  const hasStart = Boolean(startDate);
  const hasEnd = Boolean(endDate);
  return hasStart === hasEnd;
}
