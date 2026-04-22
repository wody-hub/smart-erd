/**
 * Yjs Y.Doc에서 저장값을 안전하게 읽는 유틸리티.
 *
 * Y.Map/Y.Array에서 꺼낸 `unknown` 값을 타입 안전하게 파싱한다.
 * ERD, Screen-Spec 등 모든 문서 플러그인에서 공유한다.
 */

/**
 * 저장값에서 비어 있지 않은 문자열을 읽는다.
 * 앞뒤 공백을 제거(trim)하고, 결과가 빈 문자열이면 null을 반환한다.
 *
 * @param value 해석할 저장값
 * @returns trim된 문자열 또는 null
 */
export function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * 저장값에서 유한한 숫자를 읽는다.
 *
 * @param value 해석할 저장값
 * @returns 유효한 숫자 또는 null
 */
export function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * 저장값에서 양수 정수를 읽는다.
 *
 * @param value 해석할 저장값
 * @returns 양수 정수 또는 null
 */
export function readPositiveNumber(value: unknown): number | null {
  const parsed = readNumber(value);
  return parsed !== null && parsed > 0 ? Math.round(parsed) : null;
}

/**
 * 저장값에서 boolean 값을 읽는다.
 *
 * @param value 해석할 저장값
 * @returns boolean 값 또는 null
 */
export function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}
