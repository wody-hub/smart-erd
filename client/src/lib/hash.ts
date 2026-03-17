/**
 * djb2 해시 함수. 문자열을 32비트 정수 문자열로 변환한다.
 *
 * @param str 해시할 문자열
 * @returns 32비트 unsigned 정수의 문자열 표현
 */
export function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return String(hash >>> 0);
}
