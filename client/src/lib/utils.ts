import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Tailwind 클래스 병합 유틸리티. clsx로 조건부 결합 후 tailwind-merge로 충돌 해소. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
