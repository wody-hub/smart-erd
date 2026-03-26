import { STORAGE_KEYS } from '../constants/storage.js';

/** 다이어그램 코드 draft 저장 스코프 */
export interface DiagramCodeDraftScope {
  /** 팀 ID */
  teamId?: string;
  /** 프로젝트 ID */
  projectId?: string;
  /** 다이어그램 ID */
  diagramId?: string;
}

/** localStorage 최소 인터페이스 */
interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

/** code 모드 preview 캔버스 로컬 위치 저장 포맷 */
export type DiagramPreviewPositionRecord = Record<string, { x: number; y: number }>;

/** 다이어그램 단위 DSL draft 저장 레코드 */
export interface DiagramDslDraftRecord {
  /** 저장된 DSL 코드 */
  text: string;
  /** draft가 생성된 시점의 persisted ERD baseline revision */
  baselineRevision: string | null;
  /** code 모드 preview 캔버스의 로컬 위치 override */
  previewPositions: DiagramPreviewPositionRecord;
  /** 사용자가 의도적으로 빈 코드를 저장했는지 여부 */
  isIntentionalBlank: boolean;
  /** intentional blank가 실제 사용자 입력으로 확인된 상태인지 여부 */
  isConfirmedBlank: boolean;
}

/**
 * preview 위치 저장값을 정규화한다.
 *
 * @param value 외부 입력 값
 * @returns 유효한 preview 위치 레코드
 */
function normalizePreviewPositions(value: unknown): DiagramPreviewPositionRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const normalized: DiagramPreviewPositionRecord = {};
  for (const [nodeId, position] of Object.entries(value)) {
    if (!position || typeof position !== 'object') {
      continue;
    }
    const x = (position as { x?: unknown }).x;
    const y = (position as { y?: unknown }).y;
    if (
      typeof x !== 'number' ||
      !Number.isFinite(x) ||
      typeof y !== 'number' ||
      !Number.isFinite(y)
    ) {
      continue;
    }
    normalized[nodeId] = { x, y };
  }
  return normalized;
}

/**
 * 접근 가능한 localStorage를 반환한다.
 *
 * @returns localStorage 호환 객체. 미지원 환경이면 null
 */
function getLocalStorage(): StorageLike | null {
  const storage = (globalThis as { localStorage?: StorageLike }).localStorage;
  return storage ?? null;
}

/**
 * 저장된 raw draft 문자열을 구조화된 draft 레코드로 역직렬화한다.
 *
 * 예전 plain string 형식도 호환한다.
 *
 * @param raw localStorage에 저장된 원시 문자열
 * @returns 구조화된 draft 레코드. 해석할 수 없으면 null
 */
function parseDiagramDslDraftRecord(raw: string | null): DiagramDslDraftRecord | null {
  if (raw == null) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DiagramDslDraftRecord> | string;
    if (typeof parsed === 'string') {
      return {
        text: parsed,
        baselineRevision: null,
        previewPositions: {},
        isIntentionalBlank: parsed.trim().length === 0,
        isConfirmedBlank: false,
      };
    }
    if (typeof parsed?.text === 'string') {
      return {
        text: parsed.text,
        baselineRevision:
          typeof parsed.baselineRevision === 'string' ? parsed.baselineRevision : null,
        previewPositions: normalizePreviewPositions(parsed.previewPositions),
        isIntentionalBlank: parsed.isIntentionalBlank === true,
        isConfirmedBlank: parsed.isConfirmedBlank === true,
      };
    }
  } catch {
    return {
      text: raw,
      baselineRevision: null,
      previewPositions: {},
      isIntentionalBlank: raw.trim().length === 0,
      isConfirmedBlank: false,
    };
  }

  return null;
}

/**
 * 다이어그램 단위 DSL draft 저장 키를 생성한다.
 *
 * @param scope 팀/프로젝트/다이어그램 식별자
 * @returns 저장 키. 스코프가 불완전하면 null
 */
export function buildDiagramDslDraftStorageKey(scope: DiagramCodeDraftScope): string | null {
  const { teamId, projectId, diagramId } = scope;
  if (!teamId || !projectId || !diagramId) {
    return null;
  }
  return `${STORAGE_KEYS.DIAGRAM_DSL_DRAFT_PREFIX}:${teamId}:${projectId}:${diagramId}`;
}

/**
 * 다이어그램 단위 DSL draft를 로드한다.
 *
 * @param scope 팀/프로젝트/다이어그램 식별자
 * @returns 저장된 DSL draft. 없거나 실패하면 null
 */
export function loadDiagramDslDraft(scope: DiagramCodeDraftScope): string | null {
  return loadDiagramDslDraftRecord(scope)?.text ?? null;
}

/**
 * 다이어그램 단위 DSL draft 레코드를 로드한다.
 *
 * @param scope 팀/프로젝트/다이어그램 식별자
 * @returns 저장된 draft 레코드. 없거나 실패하면 null
 */
export function loadDiagramDslDraftRecord(
  scope: DiagramCodeDraftScope,
): DiagramDslDraftRecord | null {
  const key = buildDiagramDslDraftStorageKey(scope);
  const storage = getLocalStorage();
  if (!key || !storage) {
    return null;
  }
  try {
    return parseDiagramDslDraftRecord(storage.getItem(key));
  } catch {
    return null;
  }
}

/**
 * 다이어그램 단위 DSL draft를 저장한다.
 *
 * @param scope 팀/프로젝트/다이어그램 식별자
 * @param draft 저장할 DSL draft
 * @returns 없음
 */
export function saveDiagramDslDraft(scope: DiagramCodeDraftScope, draft: string): void {
  saveDiagramDslDraftRecord(scope, {
    text: draft,
    baselineRevision: null,
    previewPositions: {},
    isIntentionalBlank: draft.trim().length === 0,
    isConfirmedBlank: false,
  });
}

/**
 * 다이어그램 단위 DSL draft 레코드를 저장한다.
 *
 * @param scope 팀/프로젝트/다이어그램 식별자
 * @param draft 저장할 draft 레코드
 * @returns 없음
 */
export function saveDiagramDslDraftRecord(
  scope: DiagramCodeDraftScope,
  draft: DiagramDslDraftRecord,
): void {
  const key = buildDiagramDslDraftStorageKey(scope);
  const storage = getLocalStorage();
  if (!key || !storage) {
    return;
  }
  try {
    storage.setItem(key, JSON.stringify(draft));
  } catch {
    // draft 저장 실패는 코드 편집 자체를 막지 않는다.
  }
}

/**
 * 다이어그램 단위 DSL draft 레코드를 제거한다.
 *
 * @param scope 팀/프로젝트/다이어그램 식별자
 * @returns 없음
 */
export function clearDiagramDslDraftRecord(scope: DiagramCodeDraftScope): void {
  const key = buildDiagramDslDraftStorageKey(scope);
  const storage = getLocalStorage();
  if (!key || !storage?.removeItem) {
    return;
  }
  try {
    storage.removeItem(key);
  } catch {
    // draft 제거 실패는 코드 편집 자체를 막지 않는다.
  }
}
