/**
 * 스냅샷 리비전 검증 유틸리티.
 *
 * WS v2 프로토콜에서 수신한 snapshotRevision과 API 응답의 contentRevision을 비교하여
 * 스냅샷이 최신인지 판단한다.
 */

/**
 * 문자열 리비전을 BigInt로 파싱한다.
 *
 * @param value 리비전 문자열 (null이면 null 반환)
 * @returns BigInt 값 또는 null
 */
export function parseRevision(value: string | null | undefined): bigint | null {
  if (value == null) {
    return null;
  }
  try {
    return BigInt(value);
  } catch {
    // 유효하지 않은 리비전 문자열은 null로 처리
    return null;
  }
}

/**
 * WS 스냅샷 리비전이 content 리비전과 일치하는지 검증한다.
 *
 * 어느 한쪽이 null이면 검증을 스킵하고 true를 반환한다 (레거시 호환).
 *
 * @param wsRevision      WS 스냅샷 리비전 (v2 바이너리에서 파싱)
 * @param contentRevision API 응답의 content 리비전 문자열
 * @returns 스냅샷이 유효한지 여부
 */
export function isSnapshotRevisionValid(
  wsRevision: bigint | null,
  contentRevision: string | undefined,
): boolean {
  if (wsRevision == null) {
    return true;
  }
  const parsed = parseRevision(contentRevision ?? null);
  if (parsed == null) {
    return true;
  }
  return wsRevision >= parsed;
}
