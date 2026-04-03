import { STORAGE_KEYS } from '../constants/storage.js';

/** 다이어그램 작업 모드 */
export type DiagramWorkMode = 'code' | 'erd';

/** 다이어그램 작업 모드 저장 스코프 */
export interface DiagramWorkModeScope {
  /** 팀 ID */
  teamId?: string;
  /** 프로젝트 ID */
  projectId?: string;
  /** 다이어그램 ID */
  diagramId?: string;
}

/** 다이어그램 작업 모드 capability */
export interface DiagramWorkModeCapabilities {
  /** 코드 편집 가능 여부 */
  canEditCode: boolean;
  /** 캔버스 편집 가능 여부 */
  canEditCanvas: boolean;
  /** 코드 -> ERD 자동반영 활성 여부 */
  enableCodeToErdAutoSync: boolean;
  /** ERD -> 코드 자동생성 활성 여부 */
  enableErdToCodeAutoSync: boolean;
  /** 캔버스 데이터 소스 */
  canvasSource: 'persisted' | 'preview';
  /** 코드 패널 표시 여부 */
  showCodePanel: boolean;
  /** 코드 draft 저장 필요 여부 */
  persistCodeDraft: boolean;
  /** DSL 탭만 허용 여부 */
  dslOnlyCodeEditor: boolean;
  /** 헤더 persisted 저장 버튼 표시 여부 */
  showPersistedSave: boolean;
  /** preview sync 배너 표시 여부 */
  showPreviewSyncBanner: boolean;
  /** 코드 에디터 테이블 락 발행 여부 */
  enableCodeEditorTableLock: boolean;
  /** 강제 좌측 패널 */
  forcedLeftPanel: 'sidebar' | 'code' | null;
}

/** 작업 모드 런타임 정책 계산 입력 */
export interface DiagramWorkModeRuntimeStateOptions {
  /** 현재 작업 모드 */
  mode: DiagramWorkMode;
  /** 현재 작업 모드 capability */
  capabilities: DiagramWorkModeCapabilities;
  /** 팀 권한 기준 편집 가능 여부 */
  canEdit: boolean;
  /** authoritative bootstrap 전이라 diagram 편집을 열면 안 되는 상태인지 여부 */
  isAuthoritativeBootstrapBlocked: boolean;
  /** persisted ERD가 preview handoff 상태인지 여부 */
  isPersistedPreviewMode: boolean;
  /** 현재 그룹 단위 보기 활성 여부 */
  hasActiveGroupView: boolean;
}

/** 작업 모드 런타임 정책 */
export interface DiagramWorkModeRuntimeState {
  /** persisted 수정 surface 편집 가능 여부 */
  persistedEditingAllowed: boolean;
  /** 헤더를 일반 편집 상태로 볼 수 있는지 여부 */
  headerCanEdit: boolean;
  /** 캔버스 편집 가능 여부 */
  effectiveCanvasCanEdit: boolean;
  /** 코드 편집 가능 여부 */
  effectiveCodeCanEdit: boolean;
  /** persisted 백업 가능 여부 */
  canPersistDiagramSave: boolean;
  /** preview sync 배너 표시 여부 */
  showPreviewSyncBanner: boolean;
  /** code 모드 안내 배너 표시 여부 */
  showCodeModeInfoBanner: boolean;
  /** 코드 에디터 토글 허용 여부 */
  canToggleCodeEditor: boolean;
  /** 사전 관리 진입 허용 여부 */
  canOpenDictionaryManagement: boolean;
  /** 사전 관리 persisted 편집 허용 여부 */
  canEditDictionaryManagement: boolean;
}

/** localStorage 최소 인터페이스 */
interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

/** 작업 모드 기본값 */
export const DEFAULT_DIAGRAM_WORK_MODE: DiagramWorkMode = 'erd';

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
 * 다이어그램 스코프 기준 작업 모드 저장 키를 생성한다.
 *
 * @param scope 팀/프로젝트/다이어그램 식별자
 * @returns 저장 키. 스코프가 불완전하면 null
 */
export function buildDiagramWorkModeStorageKey(scope: DiagramWorkModeScope): string | null {
  const { teamId, projectId, diagramId } = scope;
  if (!teamId || !projectId || !diagramId) {
    return null;
  }
  return `${STORAGE_KEYS.DIAGRAM_WORK_MODE_PREFIX}:${teamId}:${projectId}:${diagramId}`;
}

/**
 * 외부 입력 값을 유효한 작업 모드로 정규화한다.
 *
 * @param value 외부 입력 값
 * @returns 유효한 작업 모드. 유효하지 않으면 기본값
 */
function normalizeDiagramWorkMode(value: unknown): DiagramWorkMode {
  if (value === 'code' || value === 'erd') {
    return value;
  }
  // legacy `sync` 저장값은 persisted 저장 의미가 가장 분명한 ERD 모드로 수렴한다.
  return DEFAULT_DIAGRAM_WORK_MODE;
}

/**
 * 다이어그램 단위 localStorage에서 작업 모드를 로드한다.
 *
 * @param scope 팀/프로젝트/다이어그램 식별자
 * @returns 저장된 작업 모드. 없거나 실패하면 기본값
 */
export function loadDiagramWorkMode(scope: DiagramWorkModeScope): DiagramWorkMode {
  const key = buildDiagramWorkModeStorageKey(scope);
  const storage = getLocalStorage();
  if (!key || !storage) {
    return DEFAULT_DIAGRAM_WORK_MODE;
  }
  try {
    return normalizeDiagramWorkMode(storage.getItem(key));
  } catch {
    return DEFAULT_DIAGRAM_WORK_MODE;
  }
}

/**
 * 다이어그램 단위 localStorage에 작업 모드를 저장한다.
 *
 * @param scope 팀/프로젝트/다이어그램 식별자
 * @param mode 저장할 작업 모드
 * @returns 없음
 */
export function saveDiagramWorkMode(scope: DiagramWorkModeScope, mode: DiagramWorkMode): void {
  const key = buildDiagramWorkModeStorageKey(scope);
  const storage = getLocalStorage();
  if (!key || !storage) {
    return;
  }
  try {
    storage.setItem(key, mode);
  } catch {
    // localStorage 저장 실패는 모드 동작을 막지 않는다.
  }
}

/**
 * 작업 모드에 따른 capability 집합을 계산한다.
 *
 * @param mode 작업 모드
 * @returns 작업 모드 capability
 */
export function createDiagramWorkModeCapabilities(
  mode: DiagramWorkMode,
): DiagramWorkModeCapabilities {
  switch (mode) {
    case 'code':
      return {
        canEditCode: true,
        canEditCanvas: false,
        enableCodeToErdAutoSync: false,
        enableErdToCodeAutoSync: false,
        canvasSource: 'preview',
        showCodePanel: true,
        persistCodeDraft: true,
        dslOnlyCodeEditor: true,
        showPersistedSave: false,
        showPreviewSyncBanner: false,
        enableCodeEditorTableLock: false,
        forcedLeftPanel: 'code',
      };
    case 'erd':
    default:
      return {
        canEditCode: false,
        canEditCanvas: true,
        enableCodeToErdAutoSync: false,
        enableErdToCodeAutoSync: false,
        canvasSource: 'persisted',
        showCodePanel: false,
        persistCodeDraft: false,
        dslOnlyCodeEditor: false,
        showPersistedSave: true,
        showPreviewSyncBanner: true,
        enableCodeEditorTableLock: false,
        forcedLeftPanel: 'sidebar',
      };
  }
}

/**
 * 작업 모드 capability와 현재 런타임 상태를 결합해 실제 화면 정책을 계산한다.
 *
 * code 모드는 persisted ERD preview 상태와 무관하게 로컬 코드 작업을 허용하지만,
 * authoritative bootstrap 전에는 모든 diagram 편집 surface를 막는다.
 * persisted 수정 계열(surface save, canvas edit)은 preview 상태에 묶고,
 * 사전 관리는 별도 관리 surface로 본다.
 *
 * @param options 작업 모드/권한/preview 상태 입력
 * @returns 현재 화면에서 사용할 런타임 정책
 */
export function resolveDiagramWorkModeRuntimeState({
  mode,
  capabilities,
  canEdit,
  isAuthoritativeBootstrapBlocked,
  isPersistedPreviewMode,
  hasActiveGroupView,
}: DiagramWorkModeRuntimeStateOptions): DiagramWorkModeRuntimeState {
  const collaborationEditingAllowed = canEdit && !isAuthoritativeBootstrapBlocked;
  const persistedEditingAllowed = collaborationEditingAllowed && !isPersistedPreviewMode;
  const codeEditingRequiresPersistedReady = mode !== 'code';
  const effectiveCodeCanEdit =
    collaborationEditingAllowed &&
    capabilities.canEditCode &&
    (!codeEditingRequiresPersistedReady || !isPersistedPreviewMode);

  return {
    persistedEditingAllowed,
    headerCanEdit:
      collaborationEditingAllowed &&
      (capabilities.showPersistedSave ? !isPersistedPreviewMode : effectiveCodeCanEdit),
    effectiveCanvasCanEdit: persistedEditingAllowed && capabilities.canEditCanvas,
    effectiveCodeCanEdit,
    canPersistDiagramSave: persistedEditingAllowed && capabilities.showPersistedSave,
    showPreviewSyncBanner:
      capabilities.showPreviewSyncBanner && collaborationEditingAllowed && isPersistedPreviewMode,
    showCodeModeInfoBanner: mode === 'code',
    canToggleCodeEditor:
      persistedEditingAllowed &&
      capabilities.showCodePanel &&
      capabilities.forcedLeftPanel == null &&
      !hasActiveGroupView,
    canOpenDictionaryManagement: collaborationEditingAllowed,
    canEditDictionaryManagement: collaborationEditingAllowed,
  };
}
