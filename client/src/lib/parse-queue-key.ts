/**
 * 파싱 요청의 의미적 입력을 안정적으로 식별하는 키를 생성한다.
 *
 * 동일 텍스트라도 파서 옵션(DBMS 등)이 다르면 별도 요청으로 취급해야 하므로,
 * 호출부는 파싱 결과에 영향을 주는 입력을 모두 넘겨야 한다.
 *
 * @param parts 파싱 입력을 구성하는 식별 요소들
 * @returns 중복 파싱 방지용 직렬화 키
 */
export function buildParseQueueKey(...parts: readonly unknown[]): string {
  return JSON.stringify(parts);
}
