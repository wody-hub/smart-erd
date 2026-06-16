const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function toLocalMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function padTwoDigits(value: number): string {
  return value.toString().padStart(2, '0');
}

/**
 * yyyy-MM-dd 문자열을 로컬 날짜 객체로 파싱한다.
 *
 * @param value yyyy-MM-dd 날짜 문자열
 * @returns 로컬 자정 Date 객체
 */
export function parseDateOnly(value: string): Date {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(`Invalid date-only value: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new RangeError(`Invalid calendar date value: ${value}`);
  }

  return parsed;
}

/**
 * 로컬 날짜 객체를 yyyy-MM-dd 문자열로 직렬화한다.
 *
 * @param date 직렬화할 Date 객체
 * @returns yyyy-MM-dd 문자열
 */
export function formatDateOnly(date: Date): string {
  const local = toLocalMidnight(date);
  return `${local.getFullYear()}-${padTwoDigits(local.getMonth() + 1)}-${padTwoDigits(local.getDate())}`;
}

/**
 * 시작일/종료일의 inclusive 기간(일)을 계산한다.
 *
 * @param start 시작일
 * @param end 종료일
 * @returns 최소 1일 이상의 기간
 */
export function inclusiveDurationDays(start: Date, end: Date): number {
  const normalizedStart = toLocalMidnight(start);
  const normalizedEnd = toLocalMidnight(end);
  const diffDays =
    Math.floor((normalizedEnd.getTime() - normalizedStart.getTime()) / DAY_IN_MS) + 1;
  return Math.max(diffDays, 1);
}

/**
 * 최소/최대 날짜 범위를 padDays 만큼 확장한다.
 *
 * @param min 최소 날짜
 * @param max 최대 날짜
 * @param padDays 앞뒤 확장 일수
 * @returns 확장된 시작/종료 범위
 */
export function expandDateRange(
  min: Date,
  max: Date,
  padDays: number,
): {
  start: Date;
  end: Date;
} {
  const normalizedMin = toLocalMidnight(min);
  const normalizedMax = toLocalMidnight(max);
  const safePad = Math.max(0, Math.trunc(padDays));

  const baseStart =
    normalizedMin.getTime() <= normalizedMax.getTime() ? normalizedMin : normalizedMax;
  const baseEnd =
    normalizedMin.getTime() <= normalizedMax.getTime() ? normalizedMax : normalizedMin;

  const start = new Date(baseStart);
  const end = new Date(baseEnd);
  start.setDate(start.getDate() - safePad);
  end.setDate(end.getDate() + safePad);

  return { start, end };
}
