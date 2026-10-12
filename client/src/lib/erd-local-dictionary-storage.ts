import { STORAGE_KEYS } from '@/constants/storage';
import type { ErdLocalStorageLike } from '@/lib/erd-local-storage';
import type { Domain, Term, Word } from '@/types/dictionary';

/** 로컬 사전 파일 형식 버전. */
export const ERD_LOCAL_DICTIONARY_FILE_VERSION = 1;

/** 로컬 사전 파일 페이로드 (서버 타입 재사용, id는 음수). */
export interface ErdLocalDictionaryFile {
  /** 파일 형식 버전 */
  version: number;
  /** 로컬 도메인 목록 */
  domains: Domain[];
  /** 로컬 용어 목록 */
  terms: Term[];
  /** 로컬 단어 목록 */
  words: Word[];
}

/**
 * 로컬 사전 페이로드를 읽는다. 손상됐으면 삭제하고 null을 반환한다.
 *
 * @param storage 읽기 대상 스토리지
 * @returns 저장된 사전, 없거나 손상됐으면 null
 */
export function readErdLocalDictionary(
  storage: ErdLocalStorageLike,
): ErdLocalDictionaryFile | null {
  const raw = storage.getItem(STORAGE_KEYS.ERD_LOCAL_DICTIONARY);
  if (raw === null) {
    return null;
  }
  const parsed = parseErdLocalDictionaryFile(raw);
  if (!parsed.ok) {
    storage.removeItem(STORAGE_KEYS.ERD_LOCAL_DICTIONARY);
    return null;
  }
  return parsed.data;
}

/**
 * 로컬 사전 페이로드를 저장한다.
 *
 * @param storage 저장 대상 스토리지
 * @param data    저장할 사전 페이로드
 * @returns 저장 성공 여부
 */
export function writeErdLocalDictionary(
  storage: ErdLocalStorageLike,
  data: ErdLocalDictionaryFile,
): boolean {
  try {
    storage.setItem(STORAGE_KEYS.ERD_LOCAL_DICTIONARY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * 사전 파일 텍스트를 검증한다.
 *
 * 도메인은 `logicalName` 비어 있지 않음 + `physicalType` 비어 있지 않음,
 * 용어/단어는 `logicalName` + `physicalName` 비어 있지 않음을 요구한다.
 *
 * @param text 파일 텍스트
 * @returns 유효하면 `{ ok: true, data }`, 아니면 `{ ok: false }`
 */
export function parseErdLocalDictionaryFile(
  text: string,
): { ok: true; data: ErdLocalDictionaryFile } | { ok: false } {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false };
    }
    const record = parsed as Record<string, unknown>;
    if (record.version !== ERD_LOCAL_DICTIONARY_FILE_VERSION) {
      return { ok: false };
    }
    if (
      !Array.isArray(record.domains) ||
      !Array.isArray(record.terms) ||
      !Array.isArray(record.words)
    ) {
      return { ok: false };
    }
    if (
      !record.domains.every(isValidDomainRow) ||
      !record.terms.every(isValidTermRow) ||
      !record.words.every(isValidWordRow)
    ) {
      return { ok: false };
    }
    return {
      ok: true,
      data: {
        version: ERD_LOCAL_DICTIONARY_FILE_VERSION,
        domains: record.domains as Domain[],
        terms: record.terms as Term[],
        words: record.words as Word[],
      },
    };
  } catch {
    return { ok: false };
  }
}

/**
 * 다음 로컬 id를 발급한다. 서버 양수 id와 충돌하지 않는 음수를 쓴다.
 *
 * @param existingIds 기존 id 목록
 * @returns 기존 최소값보다 1 작은 음수 (없으면 -1)
 */
export function nextErdLocalId(existingIds: number[]): number {
  if (existingIds.length === 0) {
    return -1;
  }
  return Math.min(0, ...existingIds) - 1;
}

/**
 * 도메인 행의 최소 형식을 검증한다.
 *
 * @param row 검사 대상
 * @returns 유효 여부
 */
function isValidDomainRow(row: unknown): boolean {
  if (typeof row !== 'object' || row === null) {
    return false;
  }
  const record = row as Record<string, unknown>;
  return (
    typeof record.id === 'number' &&
    typeof record.logicalName === 'string' &&
    record.logicalName.trim().length > 0 &&
    typeof record.physicalType === 'string' &&
    record.physicalType.trim().length > 0
  );
}

/**
 * 용어 행의 최소 형식을 검증한다.
 *
 * @param row 검사 대상
 * @returns 유효 여부
 */
function isValidTermRow(row: unknown): boolean {
  if (typeof row !== 'object' || row === null) {
    return false;
  }
  const record = row as Record<string, unknown>;
  return (
    typeof record.id === 'number' &&
    typeof record.logicalName === 'string' &&
    record.logicalName.trim().length > 0 &&
    typeof record.physicalName === 'string' &&
    record.physicalName.trim().length > 0
  );
}

/**
 * 단어 행의 최소 형식을 검증한다.
 *
 * @param row 검사 대상
 * @returns 유효 여부
 */
function isValidWordRow(row: unknown): boolean {
  return isValidTermRow(row);
}
