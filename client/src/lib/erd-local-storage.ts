import { STORAGE_KEYS } from '@/constants/storage';

/** localStorage와 호환되는 최소 스토리지 인터페이스 (테스트 주입용). */
export interface ErdLocalStorageLike {
  /** 키로 값을 조회한다. 없으면 null을 반환한다. */
  getItem: (key: string) => string | null;
  /** 키에 값을 저장한다. 용량 초과 시 예외를 던질 수 있다. */
  setItem: (key: string, value: string) => void;
  /** 키의 값을 삭제한다. */
  removeItem: (key: string) => void;
}

/**
 * 로컬 드래프트 JSON을 읽는다.
 *
 * 저장된 값이 손상된 JSON이면 삭제하고 null을 반환한다.
 *
 * @param storage 읽기 대상 스토리지
 * @returns 저장된 드래프트 JSON, 없거나 손상됐으면 null
 */
export function readErdLocalDraft(storage: ErdLocalStorageLike): string | null {
  const raw = storage.getItem(STORAGE_KEYS.ERD_LOCAL_DRAFT);
  if (raw === null) {
    return null;
  }
  try {
    JSON.parse(raw);
    return raw;
  } catch {
    storage.removeItem(STORAGE_KEYS.ERD_LOCAL_DRAFT);
    return null;
  }
}

/**
 * 로컬 드래프트 JSON을 저장한다.
 *
 * @param storage 저장 대상 스토리지
 * @param json    `serialize()` 결과 JSON 문자열
 * @returns 저장 성공 여부 (용량 초과 등 실패 시 false)
 */
export function writeErdLocalDraft(storage: ErdLocalStorageLike, json: string): boolean {
  try {
    storage.setItem(STORAGE_KEYS.ERD_LOCAL_DRAFT, json);
    return true;
  } catch {
    return false;
  }
}

/**
 * 사용자가 연 파일 텍스트를 ERD JSON으로 검증한다.
 *
 * @param text 파일 텍스트
 * @returns 유효한 ERD JSON이면 원문, 아니면 null
 */
export function parseErdLocalFileText(text: string): string | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
}
