import { AxiosError } from 'axios';

/** 서버 에러 응답 본문 구조. GlobalExceptionHandler가 `{ error: "메시지" }` 형태로 반환. */
interface ApiErrorBody {
  /** 서버 에러 메시지 */
  error: string;
}

/**
 * AxiosError에서 서버 에러 메시지를 추출한다.
 * 서버 응답이 없으면 fallback 메시지를 반환한다.
 *
 * @param err      에러 객체 (AxiosError인 경우 서버 메시지 추출)
 * @param fallback 서버 메시지가 없을 때 반환할 기본 메시지
 * @returns 서버 에러 메시지 또는 fallback 메시지
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError && err.response?.data) {
    const data = err.response.data as ApiErrorBody;
    if (typeof data.error === 'string' && data.error.length > 0) {
      return data.error;
    }
  }
  return fallback;
}
