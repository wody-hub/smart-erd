import { STORAGE_KEYS } from '../constants/storage.js';

/** 코드->ERD 반영 시 레이아웃 모드 */
export type SyncLayoutMode = 'full' | 'incremental' | 'none';

/** 코드 동기화 정책 */
export interface SyncPolicy {
  /** 자동 Apply 허용 여부 */
  autoApplyEnabled: boolean;
  /** 레이아웃 모드 */
  layoutMode: SyncLayoutMode;
  /** 대형 다이어그램 자동 Apply 제한 임계치 */
  largeDiagramThreshold: number;
}

/** 다이어그램 단위 정책 저장 스코프 */
export interface SyncPolicyScope {
  teamId?: string;
  projectId?: string;
  diagramId?: string;
}

/** 대형 다이어그램 경고 임계치 (노드 수) */
export const LARGE_DIAGRAM_WARNING_THRESHOLD = 150;
/** 대형 다이어그램 자동 Apply 제한 임계치 (노드 수) */
export const LARGE_DIAGRAM_AUTO_APPLY_THRESHOLD = 300;
/** 대형 다이어그램에서 full 요청 시 기본 대체 레이아웃 */
const LARGE_DIAGRAM_FALLBACK_LAYOUT_MODE: SyncLayoutMode = 'incremental';

/** 동기화 정책 기본값 */
export const DEFAULT_SYNC_POLICY: SyncPolicy = {
  autoApplyEnabled: true,
  layoutMode: 'full',
  largeDiagramThreshold: LARGE_DIAGRAM_AUTO_APPLY_THRESHOLD,
};

/** 자동 Apply 차단 사유 */
export type AutoApplyBlockReason = 'auto-apply-disabled' | 'large-diagram';

/** localStorage 최소 인터페이스 */
interface StorageLike {
  getItem: (key: string) => string | null;
}

/**
 * 실행 환경에서 접근 가능한 localStorage 객체를 반환한다.
 *
 * @returns localStorage 호환 객체. 미지원 환경이면 null
 */
function getLocalStorage(): StorageLike | null {
  const storage = (globalThis as { localStorage?: StorageLike }).localStorage;
  return storage ?? null;
}

/**
 * 다이어그램 스코프 기준 localStorage 키를 생성한다.
 *
 * @param scope 팀/프로젝트/다이어그램 식별자
 * @returns 저장 키. 스코프가 불완전하면 null
 */
export function buildSyncPolicyStorageKey(scope: SyncPolicyScope): string | null {
  const { teamId, projectId, diagramId } = scope;
  if (!teamId || !projectId || !diagramId) {
    return null;
  }
  return `${STORAGE_KEYS.ERD_SYNC_POLICY_PREFIX}:${teamId}:${projectId}:${diagramId}`;
}

/**
 * 외부 입력 값을 SyncPolicy 부분 값으로 정규화한다.
 *
 * @param value 외부 입력 값
 * @returns 유효한 정책 필드만 포함한 partial 값
 */
function normalizeSyncPolicy(value: unknown): Partial<SyncPolicy> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const raw = value as Record<string, unknown>;
  const next: Partial<SyncPolicy> = {};

  if (typeof raw.autoApplyEnabled === 'boolean') {
    next.autoApplyEnabled = raw.autoApplyEnabled;
  }

  if (raw.layoutMode === 'full' || raw.layoutMode === 'incremental' || raw.layoutMode === 'none') {
    next.layoutMode = raw.layoutMode;
  }

  if (
    typeof raw.largeDiagramThreshold === 'number' &&
    Number.isFinite(raw.largeDiagramThreshold) &&
    raw.largeDiagramThreshold >= 1
  ) {
    next.largeDiagramThreshold = Math.floor(raw.largeDiagramThreshold);
  }

  return next;
}

/**
 * 다이어그램 단위 localStorage에서 SyncPolicy를 로드한다.
 *
 * 저장값이 없거나 파싱에 실패하면 기본값을 반환한다.
 *
 * @param scope 팀/프로젝트/다이어그램 식별자
 * @returns 동기화 정책
 */
export function loadSyncPolicy(scope: SyncPolicyScope): SyncPolicy {
  const key = buildSyncPolicyStorageKey(scope);
  const storage = getLocalStorage();
  if (!key || !storage) {
    return DEFAULT_SYNC_POLICY;
  }
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return DEFAULT_SYNC_POLICY;
    }
    return {
      ...DEFAULT_SYNC_POLICY,
      ...normalizeSyncPolicy(JSON.parse(raw) as unknown),
    };
  } catch {
    return DEFAULT_SYNC_POLICY;
  }
}

/**
 * 자동 Apply 허용 여부와 다이어그램 규모를 바탕으로 차단 사유를 판정한다.
 *
 * @param policy 동기화 정책
 * @param nodeCount 현재 또는 예상 노드 수
 * @returns 차단 사유. 차단하지 않으면 null
 */
export function getAutoApplyBlockReason(
  policy: SyncPolicy,
  nodeCount: number,
): AutoApplyBlockReason | null {
  if (!policy.autoApplyEnabled) {
    return 'auto-apply-disabled';
  }
  if (nodeCount >= policy.largeDiagramThreshold) {
    return 'large-diagram';
  }
  return null;
}

/**
 * 다이어그램 규모를 반영해 최종 레이아웃 모드를 결정한다.
 *
 * @param requestedMode 사용자/정책 요청 모드
 * @param nodeCount 현재 또는 예상 노드 수
 * @param largeDiagramThreshold 대형 다이어그램 임계치
 * @returns 최종 적용 레이아웃 모드
 */
export function resolveLayoutMode(
  requestedMode: SyncLayoutMode,
  nodeCount: number,
  largeDiagramThreshold: number,
): SyncLayoutMode {
  if (nodeCount < largeDiagramThreshold) {
    return requestedMode;
  }
  if (requestedMode === 'full') {
    return LARGE_DIAGRAM_FALLBACK_LAYOUT_MODE;
  }
  return requestedMode;
}
