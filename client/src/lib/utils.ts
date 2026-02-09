import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind 클래스 병합 유틸리티. clsx로 조건부 결합 후 tailwind-merge로 충돌 해소.
 *
 * @param inputs 조건부 클래스 값 목록
 * @returns 병합된 클래스 문자열
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
