const STAFFING_MONTH_WINDOW_THRESHOLD = 18;
const STAFFING_DEFAULT_WINDOW_SIZE = 12;

/**
 * 월 배열 길이에 따라 표시할 창 크기를 계산한다.
 *
 * @param months 월 키 배열(yyyy-MM)
 * @returns 표시 창 크기
 */
export function resolveStaffingMonthWindowSize(months: string[]): number {
  return months.length > STAFFING_MONTH_WINDOW_THRESHOLD
    ? STAFFING_DEFAULT_WINDOW_SIZE
    : months.length;
}

/**
 * 월 창의 시작 인덱스를 유효 범위로 보정한다.
 *
 * @param months 월 키 배열(yyyy-MM)
 * @param requestedStart 요청된 시작 인덱스
 * @param windowSize 창 크기
 * @returns 보정된 시작 인덱스
 */
export function clampStaffingMonthWindowStart(
  months: string[],
  requestedStart: number,
  windowSize: number,
): number {
  if (months.length === 0 || windowSize <= 0) {
    return 0;
  }

  const maxStart = Math.max(months.length - windowSize, 0);
  const normalizedStart = Number.isFinite(requestedStart) ? Math.trunc(requestedStart) : 0;
  return Math.min(Math.max(normalizedStart, 0), maxStart);
}

/**
 * 월 창에 실제로 표시할 월 목록을 반환한다.
 *
 * @param months 월 키 배열(yyyy-MM)
 * @param startIndex 시작 인덱스
 * @param windowSize 창 크기
 * @returns 현재 창에 보이는 월 배열
 */
export function getVisibleStaffingMonths(
  months: string[],
  startIndex: number,
  windowSize: number,
): string[] {
  if (months.length === 0 || windowSize <= 0) {
    return [];
  }

  const clampedStart = clampStaffingMonthWindowStart(months, startIndex, windowSize);
  return months.slice(clampedStart, clampedStart + windowSize);
}
