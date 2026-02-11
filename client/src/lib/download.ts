import type { AxiosResponse } from 'axios';

/**
 * Content-Disposition 헤더에서 파일명을 추출한다.
 *
 * RFC 5987 `filename*=UTF-8''...` 형식과 일반 `filename="..."` 형식 모두 지원한다.
 * 헤더가 없거나 파싱에 실패하면 fallback 파일명을 반환한다.
 *
 * @param response Axios 응답 객체
 * @param fallback 파일명 추출 실패 시 사용할 기본 파일명
 * @returns 추출된 파일명
 */
export function extractFilename(response: AxiosResponse, fallback: string): string {
  const disposition = response.headers['content-disposition'];
  if (typeof disposition !== 'string') return fallback;

  // RFC 5987: filename*=UTF-8''encoded-name
  const utf8Match = disposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/i);
  if (utf8Match) return decodeURIComponent(utf8Match[1]);

  // Standard: filename="name" or filename=name
  const standardMatch = disposition.match(/filename="?([^";\n]+)"?/i);
  if (standardMatch) return standardMatch[1].trim();

  return fallback;
}

/**
 * Blob 응답을 파일로 다운로드한다.
 *
 * Content-Disposition 헤더에서 파일명을 추출하고,
 * 임시 `<a>` 요소를 생성하여 브라우저 다운로드를 트리거한다.
 *
 * @param response    Axios blob 응답 객체
 * @param defaultName Content-Disposition에서 파일명을 추출할 수 없을 때 사용할 기본 파일명
 */
export function downloadBlob(response: AxiosResponse, defaultName: string): void {
  const filename = extractFilename(response, defaultName);
  const url = URL.createObjectURL(response.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
