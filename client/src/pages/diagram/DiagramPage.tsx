import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as Y from 'yjs';
import { isAxiosError } from 'axios';
import { ReactFlowProvider } from '@xyflow/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import { useShallow } from 'zustand/react/shallow';
import DiagramCollaboratorsBar from '@/components/erd/DiagramCollaboratorsBar';
import { DiagramCodeNavigationProvider } from '@/components/erd/DiagramCodeNavigationContext';
import DiagramWorkModeSwitcher from '@/components/erd/DiagramWorkModeSwitcher';
import PreviewCanvas from '@/components/erd/PreviewCanvas';
import Header from '@/components/layout/Header';
import ERDCanvas from '@/components/erd/ERDCanvas';
import CanvasLoadingOverlay from '@/components/erd/CanvasLoadingOverlay';
import DiagramSidebar from '@/components/erd/DiagramSidebar';
import DiagramSyncStatusBanner from '@/components/erd/DiagramSyncStatusBanner';
import ValidationPanel from '@/components/erd/ValidationPanel';
import DictionaryManagementDialog from '@/components/erd/DictionaryManagementDialog';
import { ErdDictionaryProvider } from '@/components/erd/ErdDictionaryContext';
import { ErdPermissionProvider } from '@/components/erd/ErdPermissionContext';
import { DiagramWorkModeProvider } from '@/components/erd/DiagramWorkModeContext';
import Spinner from '@/components/ui/spinner';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import useCollaborationStore from '@/stores/erd/useCollaborationStore';
import {
  downloadDiagramColumnDefinition,
  downloadDiagramIndexDefinition,
  downloadDiagramTableDefinition,
  fetchDiagram,
  persistDiagramYdocSnapshot,
  persistDiagramYdocSnapshotKeepalive,
  saveDiagram,
} from '@/api/diagramApi';
import type { DiagramDetail, SaveDiagramResult } from '@/types/diagram';
import { isTextInputLikeTarget } from '@/constants/canvas-history';
import { CODE_SHARED_DRAFT_SERVER_PERSIST_IDLE_MS } from '@/constants/code-sync';
import { queryKeys } from '@/constants/query-keys';
import { KEYBINDINGS } from '@/constants/keybindings';
import { getErrorMessage } from '@/lib/api-error';
import {
  beginCodeModeSnapshotKeepalive,
  shouldRetryCodeModeSnapshotAfterKeepalive,
} from '@/lib/code-mode-snapshot-keepalive';
import { shouldScheduleCodeModeSnapshotPersist } from '@/lib/code-mode-snapshot-persist';
import { useTeamRole } from '@/hooks/useTeamRole';
import { useSidebarResize, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from '@/hooks/useSidebarResize';
import { toast } from 'sonner';
import { useYjsCollaboration } from '@/hooks/useYjsCollaboration';
import { useAutoBackup } from '@/hooks/useAutoBackup';
import { useDiagramDictionaryReconciliation } from '@/hooks/useDiagramDictionaryReconciliation';
import {
  createDiagramWorkModeCapabilities,
  loadDiagramWorkMode,
  resolveDiagramWorkModeRuntimeState,
  saveDiagramWorkMode,
  type DiagramWorkMode,
} from '@/lib/diagram-work-mode';
import type {
  CodeEditorTableFocusRequest,
  CodeEditorTableRevealRequest,
} from '@/lib/code-editor-table-navigation';
import type { DslPreviewCanvasState } from '@/lib/dsl-preview-graph';
import {
  buildPreviewEdgePresentationEntries,
  buildPreviewGraphFromDslParsedSchema,
  buildPreviewLayoutSourceEntries,
} from '@/lib/dsl-preview-graph';
import type { DiagramPreviewPositionRecord } from '@/lib/diagram-code-draft';
import {
  buildParseResultFromSharedSchemaDraft,
  getSharedSchemaDraftMap,
  readSharedSchemaDraftSnapshot,
  SHARED_SCHEMA_DRAFT_ORIGIN,
  writeSharedSchemaDraftPositions,
  type SharedSchemaDraftSnapshot,
  hasSharedSchemaDraftContent,
} from '@/lib/shared-schema-draft';
import { buildPreviewDraftOverlayGraph } from '@/lib/preview-draft-merge';
import type { ERDEdge, TableNode } from '@/types/erd';

type CodeModeDraftPersistStatus = 'inactive' | 'dirty' | 'saving' | 'saved' | 'error' | 'stale';

const PERSISTED_SAVE_SNAPSHOT_CACHE_IDLE_MS = 350;

const DdlCodeEditorPanel = lazy(() => import('@/components/erd/DdlCodeEditorPanel'));

/** 빈 핸들러 (오버레이 retry prop용, 현재 syncStage 고정이므로 미사용). @returns 없음 */
const noop = () => {};

function DiagramDictionaryReconciler({ diagramId }: { diagramId: string }) {
  useDiagramDictionaryReconciliation({ diagramId });
  return null;
}

/**
 * 다이어그램 편집 페이지.
 *
 * URL 파라미터에서 teamId/projectId/diagramId를 추출하여
 * 다이어그램을 로드하고, Y.Doc 기반 실시간 협업 캔버스를 제공한다.
 * Ctrl+S(Mac: Cmd+S) 단축키로 JSON 백업 저장을 할 수 있다.
 *
 * @returns 다이어그램 편집 페이지 JSX
 */
export default function DiagramPage() {
  /** URL 파라미터: teamId, projectId, diagramId */
  const { teamId, projectId, diagramId } = useParams<{
    teamId: string;
    projectId: string;
    diagramId: string;
  }>();

  const { t } = useTranslation();

  /** 헤더에 표시할 다이어그램 이름 */
  const [diagramName, setDiagramName] = useState('');
  /** 유효성 검사 패널 열림 상태 */
  const [validationOpen, setValidationOpen] = useState(false);
  /** 사전 관리 다이얼로그 열림 상태 */
  const [dictionaryDialogOpen, setDictionaryDialogOpen] = useState(false);
  /** 좌측 패널 모드 ('sidebar' | 'code') */
  const [leftPanel, setLeftPanel] = useState<'sidebar' | 'code'>('sidebar');
  /** 다이어그램 작업 모드 */
  const [workMode, setWorkMode] = useState<DiagramWorkMode>('sync');
  /** 현재 다이어그램 스코프의 작업 모드 로드 완료 여부 */
  const [workModeHydrated, setWorkModeHydrated] = useState(false);
  /** code 모드의 DSL preview 상태 */
  const [dslPreviewState, setDslPreviewState] = useState<DslPreviewCanvasState | null>(null);
  /** code 모드의 shared schema draft 위치 정보 */
  const [dslPreviewPositionOverrides, setDslPreviewPositionOverrides] =
    useState<DiagramPreviewPositionRecord>({});
  /** shared schema draft snapshot */
  const [sharedSchemaDraft, setSharedSchemaDraft] = useState<SharedSchemaDraftSnapshot | null>(null);
  /** 코드 에디터에서 요청한 테이블 포커스 대상 */
  const [tableFocusRequest, setTableFocusRequest] = useState<CodeEditorTableFocusRequest | null>(null);
  /** ERD에서 요청한 코드 reveal 대상 */
  const [tableCodeRevealRequest, setTableCodeRevealRequest] =
    useState<CodeEditorTableRevealRequest | null>(null);
  /** 활성 그룹 ID (null이면 전체 보기) */
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  /** 초기 진입 렌더 완료 래치 (한 번 true가 되면 동일 다이어그램 세션에서 유지) */
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  /** 다이어그램 전환 감지용 래치 키 */
  const latchKey = `${projectId}:${diagramId}`;
  /** 이전 래치 키 보관 ref */
  const prevLatchKeyRef = useRef(latchKey);
  /** 이전 preview 모드 상태 보관 ref (연결 완료 토스트 1회 제어용) */
  const prevPreviewSyncStatusRef = useRef<'inactive' | 'syncing' | 'live' | 'degraded'>('inactive');
  /** 다이어그램 전환 직후 1회 평가 스킵 가드 */
  const skipLatchEvalRef = useRef(false);
  /** code 모드 shared schema draft snapshot 서버 저장 debounce 타이머 */
  const codeModeSnapshotPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** code 모드 shared schema draft snapshot 서버 저장 진행 중 여부 */
  const codeModeSnapshotPersistInFlightRef = useRef(false);
  /** code 모드 shared schema draft snapshot 서버 저장 필요 여부 */
  const codeModeSnapshotPersistDirtyRef = useRef(false);
  /** code 모드 shared schema draft snapshot 저장 세대 (최종 저장 후 이전 요청 결과 무시용) */
  const codeModeSnapshotPersistEpochRef = useRef(0);
  /** keepalive snapshot 중복 전송 방지용 마지막 발사 시각 */
  const codeModeSnapshotLastKeepaliveAtRef = useRef(0);
  /** keepalive snapshot 전송 후 응답 미확정 상태 */
  const codeModeSnapshotKeepalivePendingRef = useRef(false);
  /** persisted 저장용 Y.Doc 변경 버전 */
  const persistedSaveSnapshotDocVersionRef = useRef(0);
  /** 마지막으로 캐시한 persisted 저장용 snapshot 버전 */
  const persistedSaveSnapshotBuiltVersionRef = useRef(0);
  /** persisted 저장용 최근 snapshot 캐시 */
  const persistedSaveSnapshotCacheRef = useRef<Uint8Array | null>(null);
  /** persisted 저장용 snapshot 캐시 debounce 타이머 */
  const persistedSaveSnapshotBuildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** persisted 저장용 snapshot 캐시 idle handle */
  const persistedSaveSnapshotIdleHandleRef = useRef<number | null>(null);
  /** code 모드 shared schema draft 서버 저장 상태 */
  const [codeModeDraftPersistStatus, setCodeModeDraftPersistStatus] =
    useState<CodeModeDraftPersistStatus>('inactive');
  /** code 모드 shared schema draft 서버 저장 완료 시각 */
  const [codeModeDraftPersistedAt, setCodeModeDraftPersistedAt] = useState<number | null>(null);
  /** 테이블 정의서 엑셀 다운로드 진행 여부 */
  const [tableDefinitionExporting, setTableDefinitionExporting] = useState(false);
  /** 컬럼 정의서 엑셀 다운로드 진행 여부 */
  const [columnDefinitionExporting, setColumnDefinitionExporting] = useState(false);
  /** 인덱스 정의서 엑셀 다운로드 진행 여부 */
  const [indexDefinitionExporting, setIndexDefinitionExporting] = useState(false);

  const { canEdit } = useTeamRole(teamId);
  const queryClient = useQueryClient();
  const workModeCapabilities = useMemo(
    () => createDiagramWorkModeCapabilities(workMode),
    [workMode],
  );
  const {
    sidebarWidth,
    isSidebarResizing,
    sidebarContainerRef,
    sidebarResizeHandleRef,
    handleSidebarResizeStart,
    handleSidebarResizeKeyDown,
  } = useSidebarResize();

  const prepareBackup = useCanvasStore((s) => s.prepareBackup);
  const markBackedUp = useCanvasStore((s) => s.markBackedUp);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s.canUndo);
  const canRedo = useCanvasStore((s) => s.canRedo);
  const groups = useCanvasStore((s) => s.groups);
  const connectionStatus = useCollaborationStore((s) => s.connectionStatus);
  /** store에 렌더 가능한 노드/엣지가 존재하는지 (boolean selector로 리렌더 최소화) */
  const storeHasRenderableGraph = useCanvasStore((s) => s.nodes.length > 0 || s.edges.length > 0);
  const { ydoc } = useCanvasStore(
    useShallow((state) => ({
      ydoc: state.ydoc,
    })),
  );
  const { persistedNodes, persistedEdges } = useCanvasStore(
    useShallow((state) => ({
      persistedNodes: state.nodes as TableNode[],
      persistedEdges: state.edges as ERDEdge[],
    })),
  );

  /** 현재 활성 그룹 객체 */
  const activeGroup = activeGroupId
    ? (groups.find((group) => group.id === activeGroupId) ?? null)
    : null;
  /** 활성 그룹의 테이블 ID 집합 */
  const activeGroupTableIds = useMemo(
    () => (activeGroup ? new Set(activeGroup.tableIds) : null),
    [activeGroup],
  );

  const {
    data: diagram,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.diagrams.detail(teamId!, projectId!, diagramId!),
    queryFn: () => fetchDiagram(teamId!, projectId!, diagramId!),
    enabled: !!teamId && !!projectId && !!diagramId,
  });
  const diagramDetailQueryKey = useMemo(
    () => queryKeys.diagrams.detail(teamId!, projectId!, diagramId!),
    [diagramId, projectId, teamId],
  );

  const handleExportTableDefinition = useCallback(
    async (content: string) => {
      if (!teamId || !projectId || !diagramId) {
        return;
      }
      if (tableDefinitionExporting || columnDefinitionExporting || indexDefinitionExporting) {
        return;
      }

      setTableDefinitionExporting(true);
      try {
        await downloadDiagramTableDefinition(teamId, projectId, diagramId, content);
        toast.success(t('erd.tableDefinitionExport.downloaded'));
      } catch {
        toast.error(t('erd.tableDefinitionExport.failed'));
      } finally {
        setTableDefinitionExporting(false);
      }
    },
    [
      columnDefinitionExporting,
      diagramId,
      indexDefinitionExporting,
      projectId,
      t,
      tableDefinitionExporting,
      teamId,
    ],
  );

  const handleExportColumnDefinition = useCallback(
    async (content: string) => {
      if (!teamId || !projectId || !diagramId) {
        return;
      }
      if (columnDefinitionExporting || tableDefinitionExporting || indexDefinitionExporting) {
        return;
      }

      setColumnDefinitionExporting(true);
      try {
        await downloadDiagramColumnDefinition(teamId, projectId, diagramId, content);
        toast.success(t('erd.columnDefinitionExport.downloaded'));
      } catch {
        toast.error(t('erd.columnDefinitionExport.failed'));
      } finally {
        setColumnDefinitionExporting(false);
      }
    },
    [
      columnDefinitionExporting,
      diagramId,
      indexDefinitionExporting,
      projectId,
      t,
      tableDefinitionExporting,
      teamId,
    ],
  );

  const handleExportIndexDefinition = useCallback(
    async (content: string) => {
      if (!teamId || !projectId || !diagramId) {
        return;
      }
      if (indexDefinitionExporting || tableDefinitionExporting || columnDefinitionExporting) {
        return;
      }

      setIndexDefinitionExporting(true);
      try {
        await downloadDiagramIndexDefinition(teamId, projectId, diagramId, content);
        toast.success(t('erd.indexDefinitionExport.downloaded'));
      } catch {
        toast.error(t('erd.indexDefinitionExport.failed'));
      } finally {
        setIndexDefinitionExporting(false);
      }
    },
    [
      columnDefinitionExporting,
      diagramId,
      indexDefinitionExporting,
      projectId,
      t,
      tableDefinitionExporting,
      teamId,
    ],
  );

  // --- 파생값 (useQuery 결과 `diagram`에 의존하므로 그룹7 이후 배치) ---
  /** 빈 다이어그램 여부 */
  const diagramHasContent = !!diagram?.content;
  /** 렌더 가능 그래프 판정 */
  const hasRenderableGraph = storeHasRenderableGraph;
  /** 빈 다이어그램이면 오버레이 불필요 */
  const isPersistedEmptyDiagram = !diagramHasContent;
  /** 오버레이 표시 조건 */
  const showOverlay = !isPersistedEmptyDiagram && !hasRenderableGraph && !initialLoadComplete;

  /**
   * 저장 성공 응답을 즉시 detail cache에 반영한다.
   *
   * @param savedDiagram 서버가 반환한 최신 저장 메타데이터
   * @param content 저장한 content JSON
   * @returns 없음
   */
  const applySavedDiagramDetailToCache = useCallback(
    (savedDiagram: SaveDiagramResult, content: string) => {
      queryClient.setQueryData(diagramDetailQueryKey, (prev: DiagramDetail | undefined) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          content,
          hasYdocSnapshot: savedDiagram.hasYdocSnapshot,
          contentRevision: savedDiagram.contentRevision,
          snapshotRevision: savedDiagram.snapshotRevision,
          snapshotUpdatedAt: savedDiagram.snapshotUpdatedAt,
          updatedAt: savedDiagram.updatedAt,
        };
      });
    },
    [diagramDetailQueryKey, queryClient],
  );

  /**
   * persisted 저장용 snapshot 캐시 예약 작업을 취소한다.
   *
   * @returns 없음
   */
  const clearPersistedSaveSnapshotBuildSchedule = useCallback(() => {
    if (persistedSaveSnapshotBuildTimerRef.current) {
      clearTimeout(persistedSaveSnapshotBuildTimerRef.current);
      persistedSaveSnapshotBuildTimerRef.current = null;
    }
    if (
      persistedSaveSnapshotIdleHandleRef.current != null &&
      typeof window !== 'undefined' &&
      typeof window.cancelIdleCallback === 'function'
    ) {
      window.cancelIdleCallback(persistedSaveSnapshotIdleHandleRef.current);
      persistedSaveSnapshotIdleHandleRef.current = null;
    }
  }, []);

  /**
   * 현재 Y.Doc 상태를 persisted 저장용 snapshot 캐시에 반영한다.
   *
   * @returns 없음
   */
  const buildPersistedSaveSnapshotCache = useCallback(() => {
    if (!ydoc) {
      persistedSaveSnapshotCacheRef.current = null;
      persistedSaveSnapshotBuiltVersionRef.current = 0;
      return;
    }
    persistedSaveSnapshotCacheRef.current = Y.encodeStateAsUpdate(ydoc);
    persistedSaveSnapshotBuiltVersionRef.current = persistedSaveSnapshotDocVersionRef.current;
  }, [ydoc]);

  /**
   * persisted 저장용 snapshot 캐시를 debounce + idle 시점에 다시 만든다.
   *
   * @returns 없음
   */
  const schedulePersistedSaveSnapshotCacheBuild = useCallback(() => {
    clearPersistedSaveSnapshotBuildSchedule();
    persistedSaveSnapshotBuildTimerRef.current = setTimeout(() => {
      persistedSaveSnapshotBuildTimerRef.current = null;
      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        persistedSaveSnapshotIdleHandleRef.current = window.requestIdleCallback(() => {
          persistedSaveSnapshotIdleHandleRef.current = null;
          buildPersistedSaveSnapshotCache();
        });
        return;
      }
      buildPersistedSaveSnapshotCache();
    }, PERSISTED_SAVE_SNAPSHOT_CACHE_IDLE_MS);
  }, [buildPersistedSaveSnapshotCache, clearPersistedSaveSnapshotBuildSchedule]);

  /**
   * 저장 시 사용할 최신 Y.Doc snapshot을 반환한다.
   *
   * 캐시가 현재 문서 버전과 일치하면 재사용하고, 아니면 즉시 다시 인코딩한다.
   *
   * @returns 저장에 사용할 최신 snapshot
   */
  const getLatestPersistedSaveSnapshot = useCallback((): Uint8Array | undefined => {
    if (!ydoc) {
      return undefined;
    }
    if (
      persistedSaveSnapshotCacheRef.current &&
      persistedSaveSnapshotBuiltVersionRef.current === persistedSaveSnapshotDocVersionRef.current
    ) {
      return persistedSaveSnapshotCacheRef.current;
    }
    const snapshot = Y.encodeStateAsUpdate(ydoc);
    persistedSaveSnapshotCacheRef.current = snapshot;
    persistedSaveSnapshotBuiltVersionRef.current = persistedSaveSnapshotDocVersionRef.current;
    return snapshot;
  }, [ydoc]);

  const saveMutation = useMutation({
    mutationFn: (content: string) =>
      saveDiagram(
        teamId!,
        projectId!,
        diagramId!,
        content,
        getLatestPersistedSaveSnapshot(),
      ),
    onSuccess: (savedDiagram, content) => {
      applySavedDiagramDetailToCache(savedDiagram, content);
    },
  });

  /**
   * 다이어그램을 서버에 백업한다.
   *
   * 변경이 없으면 생략하고, 백업 중이면 중복 실행을 방지한다.
   *
   * @returns 없음
   */
  const handleSave = () => {
    if (saveMutation.isPending) {
      return;
    }
    const result = prepareBackup();
    if (!result) {
      toast.info(t('diagram.toast.noChanges'));
      return;
    }
    saveMutation.mutate(result.content, {
      onSuccess: () => {
        markBackedUp(result.hash);
        toast.success(t('diagram.toast.backupSynced'));
      },
      onError: (err) => toast.error(getErrorMessage(err, t('diagram.toast.backupFailed'))),
    });
  };

  /**
   * 현재 캔버스 상태를 즉시 persisted 다이어그램으로 저장한다.
   *
   * code 모드에서는 `최종 저장` 액션에서 사용하며, draft 저장과 달리
   * published ERD를 서버에 확정 반영한다.
   *
   * @returns 저장 성공 여부
   */
  const persistPublishedDiagramNow = useCallback(async (): Promise<boolean> => {
    if (saveMutation.isPending) {
      return false;
    }

    const result = prepareBackup();
    if (!result) {
      return true;
    }

    try {
      await saveMutation.mutateAsync(result.content);
      markBackedUp(result.hash);
      void queryClient.invalidateQueries({ queryKey: diagramDetailQueryKey, exact: true });
      toast.success(t('diagram.toast.backupSynced'));
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, t('diagram.toast.backupFailed')));
      return false;
    }
  }, [diagramDetailQueryKey, markBackedUp, prepareBackup, queryClient, saveMutation, t]);

  /**
   * code 모드 draft snapshot 저장 상태를 즉시 정리한다.
   *
   * 최종 저장 뒤에는 stale snapshot 저장 타이머/결과가 UI를 다시 흔들지 않도록
   * 세대를 증가시켜 이전 in-flight 결과를 무시한다.
   *
   * @param nextStatus 정리 후 표시할 상태
   * @returns 없음
   */
  const resetCodeModeSnapshotPersistState = useCallback(
    (nextStatus: CodeModeDraftPersistStatus = 'saved') => {
      codeModeSnapshotPersistEpochRef.current += 1;
      if (codeModeSnapshotPersistTimerRef.current) {
        clearTimeout(codeModeSnapshotPersistTimerRef.current);
        codeModeSnapshotPersistTimerRef.current = null;
      }
      codeModeSnapshotPersistDirtyRef.current = false;
      codeModeSnapshotPersistInFlightRef.current = false;
      codeModeSnapshotKeepalivePendingRef.current = false;
      setCodeModeDraftPersistStatus(nextStatus);
      setCodeModeDraftPersistedAt(nextStatus === 'saved' ? Date.now() : null);
    },
    [],
  );

  /** 유효성 검사 패널 토글 핸들러 */
  const handleToggleValidation = useCallback(() => setValidationOpen((prev) => !prev), []);

  /**
   * 현재 포커스가 캔버스 undo 단축키를 가로채면 안 되는 입력 필드인지 확인한다.
   *
   * @returns 텍스트 입력 계열 포커스면 true
   */
  const shouldBypassCanvasUndo = () => isTextInputLikeTarget(document.activeElement);

  /** 코드 에디터 토글 핸들러 */
  const handleToggleCodeEditor = useCallback(
    () => setLeftPanel((prev) => (prev === 'code' ? 'sidebar' : 'code')),
    [],
  );

  /**
   * 그룹 뷰를 활성화한다.
   *
   * @param groupId 그룹 ID
   * @returns 없음
   */
  const handleViewGroup = (groupId: string) => {
    setActiveGroupId(groupId);
    setLeftPanel('sidebar');
    const { setActiveEditNodeId, clearHighlights } = useCanvasStore.getState();
    setActiveEditNodeId(null);
    clearHighlights();
  };

  /**
   * 전체 보기로 복귀한다.
   *
   * @returns 없음
   */
  const handleBackToAll = () => {
    setActiveGroupId(null);
  };

  /**
   * 코드 에디터에서 특정 테이블로 이동 요청을 처리한다.
   *
   * 그룹 뷰가 활성화된 경우 먼저 전체 보기로 복귀한 뒤 캔버스에 포커스 요청을 전달한다.
   *
   * @param request 코드 에디터 테이블 포커스 요청
   * @returns 없음
   */
  const handleNavigateToTableFromEditor = useCallback((request: CodeEditorTableFocusRequest) => {
    setActiveGroupId(null);
    setTableFocusRequest(request);
  }, []);

  /**
   * ERD 테이블에서 코드 에디터 줄 reveal 요청을 처리한다.
   *
   * 코드 패널을 표시할 수 있는 모드라면 코드 패널을 열고 요청을 전달한다.
   *
   * @param request 테이블 -> 코드 reveal 요청
   * @returns 없음
   */
  const handleNavigateToCodeFromDiagram = useCallback(
    (request: CodeEditorTableRevealRequest) => {
      if (!workModeCapabilities.showCodePanel) {
        return;
      }
      if (workModeCapabilities.forcedLeftPanel == null) {
        setLeftPanel('code');
      }
      setTableCodeRevealRequest(request);
    },
    [workModeCapabilities.forcedLeftPanel, workModeCapabilities.showCodePanel],
  );

  // Y.Doc + YjsProvider 라이프사이클 관리
  const { providerRef, isPreviewMode, previewSyncStatus } = useYjsCollaboration(
    diagram,
    diagramId,
    teamId,
    projectId,
  );

  useEffect(() => {
    if (!ydoc) {
      setSharedSchemaDraft(null);
      return;
    }

    const draftMap = getSharedSchemaDraftMap(ydoc);
    const syncSharedSchemaDraft = (_event?: Y.YMapEvent<unknown>) => {
      const nextSnapshot = readSharedSchemaDraftSnapshot(ydoc);
      setSharedSchemaDraft(hasSharedSchemaDraftContent(nextSnapshot) ? nextSnapshot : null);
      setDslPreviewPositionOverrides(nextSnapshot.positions);
    };

    syncSharedSchemaDraft();
    draftMap.observe(syncSharedSchemaDraft);
    return () => {
      draftMap.unobserve(syncSharedSchemaDraft);
    };
  }, [ydoc]);

  const sharedDraftOverlayGraph = useMemo(() => {
    if (workModeCapabilities.canvasSource === 'preview' || activeGroupId) {
      return null;
    }
    if (!sharedSchemaDraft) {
      return null;
    }

    const previewGraph = buildPreviewGraphFromDslParsedSchema(
      buildParseResultFromSharedSchemaDraft(sharedSchemaDraft),
      buildPreviewLayoutSourceEntries(persistedNodes),
      buildPreviewEdgePresentationEntries(persistedNodes, persistedEdges),
      sharedSchemaDraft.positions,
    );
    return buildPreviewDraftOverlayGraph(previewGraph, persistedNodes, persistedEdges);
  }, [
    activeGroupId,
    persistedEdges,
    persistedNodes,
    sharedSchemaDraft,
    workModeCapabilities.canvasSource,
  ]);
  const workModeRuntimeState = useMemo(
    () =>
      resolveDiagramWorkModeRuntimeState({
        mode: workMode,
        capabilities: workModeCapabilities,
        canEdit,
        isPersistedPreviewMode: isPreviewMode,
        hasActiveGroupView: !!activeGroupId,
      }),
    [activeGroupId, canEdit, isPreviewMode, workMode, workModeCapabilities],
  );
  const previewReadOnlyMessage = isPreviewMode
    ? t('diagram.previewSync.headerReadonly')
    : undefined;

  useAutoBackup(saveMutation, teamId!, projectId!, diagramId!);
  useHotkeys(KEYBINDINGS.SAVE, handleSave, {
    preventDefault: true,
    enabled: workModeRuntimeState.canPersistDiagramSave,
  });

  useEffect(() => {
    setWorkModeHydrated(false);
    setWorkMode(loadDiagramWorkMode({ teamId, projectId, diagramId }));
    setWorkModeHydrated(true);
  }, [diagramId, projectId, teamId]);

  useEffect(() => {
    setDslPreviewPositionOverrides({});
    setTableFocusRequest(null);
    setTableCodeRevealRequest(null);
  }, [diagramId, projectId, teamId]);

  useEffect(() => {
    if (!workModeHydrated) {
      return;
    }
    saveDiagramWorkMode({ teamId, projectId, diagramId }, workMode);
  }, [diagramId, projectId, teamId, workMode, workModeHydrated]);

  const handleWorkModeChange = useCallback((nextMode: DiagramWorkMode) => {
    setWorkMode(nextMode);
  }, []);

  /**
   * code 모드 shared schema draft 위치 정보를 갱신한다.
   *
   * 신규 draft 테이블 위치는 shared schema draft에 저장하고,
   * 기존 persisted 테이블 위치는 PreviewCanvas 내부에서 persisted Y.Doc에 즉시 반영한다.
   *
   * @param nextPositions 다음 preview 위치 레코드
   * @returns 없음
   */
  const handleSharedSchemaDraftPositionsChange = useCallback(
    (nextPositions: DiagramPreviewPositionRecord) => {
      setDslPreviewPositionOverrides(nextPositions);
      if (!ydoc && Object.keys(nextPositions).length === 0) {
        return;
      }
      if (!ydoc) {
        return;
      }
      writeSharedSchemaDraftPositions(ydoc, nextPositions, SHARED_SCHEMA_DRAFT_ORIGIN);
    },
    [ydoc],
  );

  /**
   * 현재 Y.Doc 전체 상태를 서버 persisted snapshot으로 저장한다.
   *
   * code 모드 shared draft를 세션 종료/재접속 후에도 복원할 수 있도록
   * 로컬 update를 주기적으로 snapshot에 반영한다.
   *
   * TODO: 이 경로는 debounce/keepalive 기반이라, 마지막 입력 직후 서버가 내려가면
   * 최신 draft가 snapshot에 반영되기 전에 유실될 수 있다. 기능은 유지하되
   * durability를 더 높여야 할 시점에는 즉시 저장 조건을 더 공격적으로 가져가야 한다.
   *
   * @param useKeepalive keepalive fetch 사용 여부
   * @returns 없음
   */
  const persistCodeModeSnapshotNow = useCallback(
    async (useKeepalive = false) => {
      if (!teamId || !projectId || !diagramId || !ydoc) {
        return;
      }
      const cachedDiagramDetail = queryClient.getQueryData<DiagramDetail>(diagramDetailQueryKey);
      const expectedContentRevision = cachedDiagramDetail?.contentRevision ?? diagram?.contentRevision;
      if (!expectedContentRevision) {
        return;
      }
      const requestEpoch = codeModeSnapshotPersistEpochRef.current;

      const nextSnapshot = getLatestPersistedSaveSnapshot();
      if (!nextSnapshot) {
        return;
      }
      if (nextSnapshot.length === 0) {
        codeModeSnapshotPersistDirtyRef.current = false;
        codeModeSnapshotKeepalivePendingRef.current = false;
        if (requestEpoch === codeModeSnapshotPersistEpochRef.current) {
          setCodeModeDraftPersistStatus('saved');
        }
        return;
      }

      if (useKeepalive) {
        const now = Date.now();
        const keepaliveDecision = beginCodeModeSnapshotKeepalive(
          now,
          codeModeSnapshotLastKeepaliveAtRef.current,
          1000,
        );
        if (!keepaliveDecision.shouldSend) {
          return;
        }
        codeModeSnapshotLastKeepaliveAtRef.current = keepaliveDecision.nextLastKeepaliveAt;
        codeModeSnapshotKeepalivePendingRef.current = keepaliveDecision.keepalivePending;
        persistDiagramYdocSnapshotKeepalive(
          teamId,
          projectId,
          diagramId,
          expectedContentRevision,
          nextSnapshot,
        );
        if (requestEpoch === codeModeSnapshotPersistEpochRef.current) {
          setCodeModeDraftPersistStatus('saving');
          setCodeModeDraftPersistedAt(null);
        }
        return;
      }

      if (codeModeSnapshotPersistInFlightRef.current) {
        codeModeSnapshotPersistDirtyRef.current = true;
        setCodeModeDraftPersistStatus('dirty');
        return;
      }

      codeModeSnapshotPersistInFlightRef.current = true;
      codeModeSnapshotPersistDirtyRef.current = false;
      codeModeSnapshotKeepalivePendingRef.current = false;
      if (requestEpoch === codeModeSnapshotPersistEpochRef.current) {
        setCodeModeDraftPersistStatus('saving');
      }
      try {
        const persisted = await persistDiagramYdocSnapshot(
          teamId,
          projectId,
          diagramId,
          expectedContentRevision,
          nextSnapshot,
        );
        if (!persisted) {
          codeModeSnapshotPersistDirtyRef.current = true;
          if (requestEpoch === codeModeSnapshotPersistEpochRef.current) {
            setCodeModeDraftPersistStatus('dirty');
          }
          console.warn('[DiagramPage] code mode snapshot persist returned persisted=false');
          return;
        }
        if (requestEpoch === codeModeSnapshotPersistEpochRef.current) {
          setCodeModeDraftPersistStatus('saved');
          setCodeModeDraftPersistedAt(Date.now());
        }
      } catch (error) {
        if (requestEpoch !== codeModeSnapshotPersistEpochRef.current) {
          return;
        }
        if (isAxiosError(error) && error.response?.status === 409) {
          try {
            const latestDiagram = await fetchDiagram(teamId, projectId, diagramId);
            queryClient.setQueryData(diagramDetailQueryKey, latestDiagram);
            const persisted = await persistDiagramYdocSnapshot(
              teamId,
              projectId,
              diagramId,
              latestDiagram.contentRevision,
              nextSnapshot,
            );
            if (!persisted) {
              codeModeSnapshotPersistDirtyRef.current = true;
              setCodeModeDraftPersistStatus('dirty');
              console.warn('[DiagramPage] code mode snapshot persist retry returned persisted=false');
              return;
            }
            if (requestEpoch === codeModeSnapshotPersistEpochRef.current) {
              setCodeModeDraftPersistStatus('saved');
              setCodeModeDraftPersistedAt(Date.now());
            }
            return;
          } catch (retryError) {
            if (requestEpoch !== codeModeSnapshotPersistEpochRef.current) {
              return;
            }
            if (isAxiosError(retryError) && retryError.response?.status === 409) {
              codeModeSnapshotPersistDirtyRef.current = true;
              setCodeModeDraftPersistStatus('dirty');
              console.warn('[DiagramPage] code mode snapshot persist retried with latest revision but remained stale');
              return;
            }
            codeModeSnapshotPersistDirtyRef.current = true;
            setCodeModeDraftPersistStatus('error');
            console.warn('[DiagramPage] code mode snapshot persist retry failed:', retryError);
            return;
          }
        }
        codeModeSnapshotPersistDirtyRef.current = true;
        setCodeModeDraftPersistStatus('error');
        console.warn('[DiagramPage] code mode snapshot persist failed:', error);
      } finally {
        if (requestEpoch === codeModeSnapshotPersistEpochRef.current) {
          codeModeSnapshotPersistInFlightRef.current = false;
        }
        if (codeModeSnapshotPersistDirtyRef.current) {
          setCodeModeDraftPersistStatus('dirty');
          if (codeModeSnapshotPersistTimerRef.current) {
            clearTimeout(codeModeSnapshotPersistTimerRef.current);
          }
          codeModeSnapshotPersistTimerRef.current = setTimeout(() => {
            void persistCodeModeSnapshotNow();
          }, CODE_SHARED_DRAFT_SERVER_PERSIST_IDLE_MS);
        }
      }
    },
    [
      diagram?.contentRevision,
      diagramDetailQueryKey,
      diagramId,
      getLatestPersistedSaveSnapshot,
      projectId,
      queryClient,
      teamId,
      ydoc,
    ],
  );

  /**
   * code 모드 snapshot 서버 저장을 debounce 예약한다.
   *
   * @returns 없음
   */
  const scheduleCodeModeSnapshotPersist = useCallback(() => {
    codeModeSnapshotPersistDirtyRef.current = true;
    setCodeModeDraftPersistStatus('dirty');
    if (codeModeSnapshotPersistTimerRef.current) {
      clearTimeout(codeModeSnapshotPersistTimerRef.current);
    }
    codeModeSnapshotPersistTimerRef.current = setTimeout(() => {
      void persistCodeModeSnapshotNow();
    }, CODE_SHARED_DRAFT_SERVER_PERSIST_IDLE_MS);
  }, [persistCodeModeSnapshotNow]);

  useHotkeys(
    KEYBINDINGS.UNDO,
    (event) => {
      if (shouldBypassCanvasUndo()) {
        return;
      }
      event.preventDefault();
      undo();
    },
    { enabled: workModeRuntimeState.effectiveCanvasCanEdit && canUndo },
    [workModeRuntimeState.effectiveCanvasCanEdit, canUndo, undo],
  );

  useHotkeys(
    KEYBINDINGS.REDO,
    (event) => {
      if (shouldBypassCanvasUndo()) {
        return;
      }
      event.preventDefault();
      redo();
    },
    { enabled: workModeRuntimeState.effectiveCanvasCanEdit && canRedo },
    [workModeRuntimeState.effectiveCanvasCanEdit, canRedo, redo],
  );

  useEffect(() => {
    if (workModeCapabilities.forcedLeftPanel && leftPanel !== workModeCapabilities.forcedLeftPanel) {
      setLeftPanel(workModeCapabilities.forcedLeftPanel);
    }
  }, [leftPanel, workModeCapabilities.forcedLeftPanel]);

  useEffect(() => {
    if (!workModeRuntimeState.canOpenDictionaryManagement && dictionaryDialogOpen) {
      setDictionaryDialogOpen(false);
    }
  }, [dictionaryDialogOpen, workModeRuntimeState.canOpenDictionaryManagement]);

  useEffect(() => {
    if (workModeCapabilities.canvasSource !== 'preview') {
      setDslPreviewState(null);
    }
  }, [workModeCapabilities.canvasSource]);

  useEffect(() => {
    if (!workModeCapabilities.persistCodeDraft) {
      setCodeModeDraftPersistStatus('inactive');
      setCodeModeDraftPersistedAt(null);
      return;
    }
  }, [workModeCapabilities.persistCodeDraft]);

  useEffect(() => {
    persistedSaveSnapshotDocVersionRef.current = ydoc ? 1 : 0;
    persistedSaveSnapshotBuiltVersionRef.current = 0;
    persistedSaveSnapshotCacheRef.current = null;
    clearPersistedSaveSnapshotBuildSchedule();
    if (!ydoc) {
      return;
    }

    const handleYdocSnapshotSourceUpdate = () => {
      persistedSaveSnapshotDocVersionRef.current += 1;
      schedulePersistedSaveSnapshotCacheBuild();
    };

    ydoc.on('update', handleYdocSnapshotSourceUpdate);
    schedulePersistedSaveSnapshotCacheBuild();

    return () => {
      ydoc.off('update', handleYdocSnapshotSourceUpdate);
      clearPersistedSaveSnapshotBuildSchedule();
      persistedSaveSnapshotCacheRef.current = null;
      persistedSaveSnapshotBuiltVersionRef.current = 0;
      persistedSaveSnapshotDocVersionRef.current = 0;
    };
  }, [clearPersistedSaveSnapshotBuildSchedule, schedulePersistedSaveSnapshotCacheBuild, ydoc]);

  useEffect(() => {
    if (!workModeCapabilities.persistCodeDraft || !ydoc || !teamId || !projectId || !diagramId) {
      if (codeModeSnapshotPersistTimerRef.current) {
        clearTimeout(codeModeSnapshotPersistTimerRef.current);
        codeModeSnapshotPersistTimerRef.current = null;
      }
      codeModeSnapshotPersistDirtyRef.current = false;
      codeModeSnapshotKeepalivePendingRef.current = false;
      return;
    }

    const handleDocUpdate = (_update: Uint8Array, origin: unknown) => {
      if (!shouldScheduleCodeModeSnapshotPersist(origin)) {
        return;
      }
      scheduleCodeModeSnapshotPersist();
    };

    const flushKeepalive = () => {
      if (!codeModeSnapshotPersistDirtyRef.current) {
        return;
      }
      if (codeModeSnapshotPersistTimerRef.current) {
        clearTimeout(codeModeSnapshotPersistTimerRef.current);
        codeModeSnapshotPersistTimerRef.current = null;
      }
      void persistCodeModeSnapshotNow(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushKeepalive();
        return;
      }
      if (
        !shouldRetryCodeModeSnapshotAfterKeepalive(
          document.visibilityState,
          codeModeSnapshotKeepalivePendingRef.current,
        )
      ) {
        return;
      }
      codeModeSnapshotKeepalivePendingRef.current = false;
      codeModeSnapshotPersistDirtyRef.current = true;
      setCodeModeDraftPersistStatus('dirty');
      void persistCodeModeSnapshotNow();
    };

    ydoc.on('update', handleDocUpdate);
    globalThis.addEventListener('pagehide', flushKeepalive);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      ydoc.off('update', handleDocUpdate);
      globalThis.removeEventListener('pagehide', flushKeepalive);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (codeModeSnapshotPersistTimerRef.current) {
        clearTimeout(codeModeSnapshotPersistTimerRef.current);
        codeModeSnapshotPersistTimerRef.current = null;
      }
    };
  }, [
    diagramId,
    persistCodeModeSnapshotNow,
    projectId,
    scheduleCodeModeSnapshotPersist,
    teamId,
    workModeCapabilities.persistCodeDraft,
    ydoc,
  ]);

  useEffect(() => {
    if (prevLatchKeyRef.current !== latchKey) {
      prevPreviewSyncStatusRef.current = previewSyncStatus;
      return;
    }

    if (prevPreviewSyncStatusRef.current !== 'live' && previewSyncStatus === 'live' && canEdit) {
      toast.success(t('diagram.previewSync.toast.connected'));
    }

    prevPreviewSyncStatusRef.current = previewSyncStatus;
  }, [canEdit, latchKey, previewSyncStatus, t]);

  // diagram 로드 완료 시 이름 설정
  useEffect(() => {
    if (diagram) {
      setDiagramName(diagram.name);
    }
  }, [diagram]);

  /**
   * 오버레이 래치 관리 (단일 useEffect + ref 가드).
   *
   * 3단계로 동작한다:
   * 1. 키 변경 감지: latchKey(projectId:diagramId)가 변경되면 래치를 리셋하고
   *    skipLatchEvalRef를 설정하여 다음 평가를 1프레임 지연시킨다.
   * 2. 스킵 가드: 다이어그램 전환 직후 store에 이전 다이어그램의 노드/엣지가
   *    잔존할 수 있으므로, 첫 번째 평가를 건너뛰어 조기 래치 설정을 방지한다.
   * 3. 정상 평가: 렌더 가능 그래프가 도착하거나 빈 다이어그램이면 래치를
   *    true로 설정하여 오버레이를 영구 해제한다.
   */
  useEffect(() => {
    if (prevLatchKeyRef.current !== latchKey) {
      prevLatchKeyRef.current = latchKey;
      skipLatchEvalRef.current = true;
      setInitialLoadComplete(false);
      return;
    }

    if (skipLatchEvalRef.current) {
      skipLatchEvalRef.current = false;
      return;
    }

    if (isLoading || !diagram) {
      return;
    }

    if (hasRenderableGraph || isPersistedEmptyDiagram) {
      setInitialLoadComplete(true);
    }
  }, [latchKey, isLoading, diagram, hasRenderableGraph, isPersistedEmptyDiagram]);

  // 원격으로 현재 보고 중인 그룹이 삭제된 경우 전체 보기로 복귀한다.
  useEffect(() => {
    if (activeGroupId && !groups.some((group) => group.id === activeGroupId)) {
      setActiveGroupId(null);
      toast.info(t('erd.group.toast.groupDeleted'));
    }
  }, [activeGroupId, groups, t]);

  if (isError) {
    return (
      <div className="h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-destructive">{t('diagram.edit.loadError')}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Spinner text={t('diagram.edit.loadingDiagram')} />
        </div>
      </div>
    );
  }

  const dictionaryContextSetId = diagram?.dictionarySetId ? String(diagram.dictionarySetId) : '';

  return (
    <ReactFlowProvider>
      <ErdDictionaryProvider teamId={teamId!} setId={dictionaryContextSetId}>
        <DiagramDictionaryReconciler diagramId={diagramId!} />
        <DiagramWorkModeProvider
          mode={workMode}
          capabilities={workModeCapabilities}
          setMode={handleWorkModeChange}
        >
          <DiagramCodeNavigationProvider
            value={{
              canNavigateToCode: workModeCapabilities.showCodePanel,
              navigateToCode: workModeCapabilities.showCodePanel
                ? handleNavigateToCodeFromDiagram
                : undefined,
            }}
          >
            <ErdPermissionProvider canEdit={workModeRuntimeState.effectiveCanvasCanEdit}>
              <div className="h-screen flex flex-col">
                <Header
                  diagramName={diagramName}
                  onSave={workModeRuntimeState.canPersistDiagramSave ? handleSave : undefined}
                  saving={saveMutation.isPending}
                  connectionStatus={connectionStatus}
                  canEdit={workModeRuntimeState.headerCanEdit}
                  readOnlyMessage={!workModeRuntimeState.headerCanEdit ? previewReadOnlyMessage : undefined}
                  diagramAccessory={
                    <div className="flex items-center gap-3">
                      <DiagramWorkModeSwitcher mode={workMode} onModeChange={handleWorkModeChange} />
                      <DiagramCollaboratorsBar />
                    </div>
                  }
                />
                {workModeRuntimeState.showPreviewSyncBanner && (
                  <DiagramSyncStatusBanner connectionStatus={connectionStatus} />
                )}
                {workModeRuntimeState.showCodeModeInfoBanner && (
                  <div className="px-4 py-1 text-xs text-muted-foreground border-b bg-background">
                    {t('diagram.workMode.codeInfo')}
                  </div>
                )}
                {diagram?.dictionarySetName && (
                  <div className="px-4 py-1 text-xs text-muted-foreground border-b bg-background">
                    {t('diagram.edit.dictionaryContext', { name: diagram.dictionarySetName })}
                  </div>
                )}
                <div className="flex flex-1 overflow-hidden">
                  <div
                    ref={sidebarContainerRef}
                    className="h-full shrink-0"
                    style={{ width: sidebarWidth }}
                  >
                    {leftPanel === 'sidebar' ? (
                      <DiagramSidebar
                        canEdit={workModeRuntimeState.effectiveCanvasCanEdit}
                        activeGroupId={activeGroupId}
                        onViewGroup={handleViewGroup}
                        onBackToAll={handleBackToAll}
                      />
                    ) : (
                      <Suspense fallback={<Spinner />}>
                        <DdlCodeEditorPanel
                          canEdit={workModeRuntimeState.effectiveCodeCanEdit}
                          enableCodeToErdAutoSync={workModeCapabilities.enableCodeToErdAutoSync}
                          enableErdToCodeAutoSync={workModeCapabilities.enableErdToCodeAutoSync}
                          enableTableLock={workModeCapabilities.enableCodeEditorTableLock}
                          persistDraft={workModeCapabilities.persistCodeDraft}
                          dslOnly={workModeCapabilities.dslOnlyCodeEditor}
                          workMode={workMode}
                          previewPositionOverrides={dslPreviewPositionOverrides}
                          onPreviewPositionOverridesChange={handleSharedSchemaDraftPositionsChange}
                          onNavigateToTable={handleNavigateToTableFromEditor}
                          tableRevealRequest={tableCodeRevealRequest}
                          delayDraftHydration={
                            workModeCapabilities.persistCodeDraft &&
                            !!diagram?.hasYdocSnapshot &&
                            isPreviewMode
                          }
                          persistedDiagramHasContent={!!diagram?.content}
                          onScheduleCodeModeSnapshotPersist={
                            workModeCapabilities.persistCodeDraft
                              ? scheduleCodeModeSnapshotPersist
                              : undefined
                          }
                          onResetCodeModeSnapshotPersistState={
                            workModeCapabilities.persistCodeDraft
                              ? resetCodeModeSnapshotPersistState
                              : undefined
                          }
                          codeModeDraftPersistStatus={codeModeDraftPersistStatus}
                          codeModeDraftPersistedAt={codeModeDraftPersistedAt}
                          onPersistPublishedDiagram={
                            workModeCapabilities.persistCodeDraft
                              ? persistPublishedDiagramNow
                              : undefined
                          }
                          onDslPreviewStateChange={
                            workModeCapabilities.canvasSource === 'preview'
                              ? setDslPreviewState
                              : undefined
                          }
                        />
                      </Suspense>
                    )}
                  </div>
                  <div
                    ref={sidebarResizeHandleRef}
                    className="group w-3 shrink-0 cursor-col-resize flex items-stretch justify-center bg-muted/30 hover:bg-muted/60 active:bg-muted/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    onPointerDown={handleSidebarResizeStart}
                    onKeyDown={handleSidebarResizeKeyDown}
                    role="separator"
                    aria-orientation="vertical"
                    aria-controls="diagram-sidebar"
                    aria-label={t('erd.sidebar.resize')}
                    aria-valuemin={SIDEBAR_MIN_WIDTH}
                    aria-valuemax={SIDEBAR_MAX_WIDTH}
                    aria-valuenow={sidebarWidth}
                    title={t('erd.sidebar.resize')}
                    tabIndex={0}
                  >
                    <div className="w-px h-full bg-border/80 group-hover:bg-primary/80 group-active:bg-primary transition-colors" />
                  </div>
                  <main className="flex-1 relative">
                    {workModeCapabilities.canvasSource === 'preview' ? (
                      <PreviewCanvas
                        previewState={dslPreviewState}
                        diagramName={diagramName || 'diagram'}
                        tableFocusRequest={tableFocusRequest}
                        positionOverrides={dslPreviewPositionOverrides}
                        onPositionOverridesChange={handleSharedSchemaDraftPositionsChange}
                        canOpenDictionary={
                          !!dictionaryContextSetId && workModeRuntimeState.canOpenDictionaryManagement
                        }
                        onOpenDictionary={
                          dictionaryContextSetId && workModeRuntimeState.canOpenDictionaryManagement
                            ? () => setDictionaryDialogOpen(true)
                            : undefined
                        }
                        onExportTableDefinition={handleExportTableDefinition}
                        onExportColumnDefinition={handleExportColumnDefinition}
                        onExportIndexDefinition={handleExportIndexDefinition}
                        tableDefinitionExporting={tableDefinitionExporting}
                        columnDefinitionExporting={columnDefinitionExporting}
                        indexDefinitionExporting={indexDefinitionExporting}
                      />
                    ) : (
                      <>
                        <ERDCanvas
                          diagramName={diagramName || 'diagram'}
                          draftOverlayGraph={sharedDraftOverlayGraph}
                          tableFocusRequest={tableFocusRequest}
                          provider={providerRef.current}
                          validationOpen={validationOpen}
                          onToggleValidation={handleToggleValidation}
                          dictionaryOpen={dictionaryDialogOpen}
                          onOpenDictionary={
                            dictionaryContextSetId && workModeRuntimeState.canOpenDictionaryManagement
                              ? () => setDictionaryDialogOpen(true)
                              : undefined
                          }
                          canEdit={workModeRuntimeState.effectiveCanvasCanEdit}
                          activeGroupId={activeGroupId}
                          activeGroupName={activeGroup?.label}
                          activeGroupTableIds={activeGroupTableIds}
                          codeEditorActive={leftPanel === 'code'}
                          onToggleCodeEditor={
                            workModeRuntimeState.canToggleCodeEditor ? handleToggleCodeEditor : undefined
                          }
                          isSidebarResizing={isSidebarResizing}
                          onExportTableDefinition={handleExportTableDefinition}
                          onExportColumnDefinition={handleExportColumnDefinition}
                          onExportIndexDefinition={handleExportIndexDefinition}
                          tableDefinitionExporting={tableDefinitionExporting}
                          columnDefinitionExporting={columnDefinitionExporting}
                          indexDefinitionExporting={indexDefinitionExporting}
                        />
                        {showOverlay && (
                          <CanvasLoadingOverlay
                            syncStage="yjs-live"
                            retryCount={0}
                            maxRetries={0}
                            onRetry={noop}
                          />
                        )}
                      </>
                    )}
                  </main>
                  {validationOpen && <ValidationPanel onClose={() => setValidationOpen(false)} />}
                </div>

                {dictionaryContextSetId && (
                  <DictionaryManagementDialog
                    open={dictionaryDialogOpen}
                    onOpenChange={setDictionaryDialogOpen}
                    teamId={teamId!}
                    canEdit={workModeRuntimeState.canEditDictionaryManagement}
                    dictionarySetId={dictionaryContextSetId}
                    dictionarySetName={diagram?.dictionarySetName}
                  />
                )}
              </div>
            </ErdPermissionProvider>
          </DiagramCodeNavigationProvider>
        </DiagramWorkModeProvider>
      </ErdDictionaryProvider>
    </ReactFlowProvider>
  );
}
