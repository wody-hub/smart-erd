import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as Y from 'yjs';
import { isAxiosError } from 'axios';
import { ReactFlowProvider } from '@xyflow/react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
  fetchDiagram,
  persistDiagramYdocSnapshot,
  persistDiagramYdocSnapshotKeepalive,
  saveDiagram,
} from '@/api/diagramApi';
import { CANVAS_HISTORY_ORIGIN, isTextInputLikeTarget } from '@/constants/canvas-history';
import { CODE_SHARED_DRAFT_SERVER_PERSIST_IDLE_MS } from '@/constants/code-sync';
import { queryKeys } from '@/constants/query-keys';
import { KEYBINDINGS } from '@/constants/keybindings';
import { getErrorMessage } from '@/lib/api-error';
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
import type { DiagramPreviewPositionRecord } from '@/lib/diagram-code-draft';
import {
  readCodeModeSharedDraftGraph,
  CODE_MODE_SHARED_DRAFT_TEXT_ORIGIN,
  getCodeModeSharedDraftMap,
} from '@/lib/code-mode-shared-draft';
import type { PreviewDraftOverlayGraph } from '@/lib/preview-draft-merge';

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
  /** code 모드의 로컬 preview 위치 override */
  const [dslPreviewPositionOverrides, setDslPreviewPositionOverrides] =
    useState<DiagramPreviewPositionRecord>({});
  /** shared code mode preview draft overlay graph */
  const [sharedCodeModeDraftGraph, setSharedCodeModeDraftGraph] =
    useState<PreviewDraftOverlayGraph | null>(null);
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
  /** code 모드 shared draft snapshot 서버 저장 debounce 타이머 */
  const codeModeSnapshotPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** code 모드 shared draft snapshot 서버 저장 진행 중 여부 */
  const codeModeSnapshotPersistInFlightRef = useRef(false);
  /** code 모드 shared draft snapshot 서버 저장 필요 여부 */
  const codeModeSnapshotPersistDirtyRef = useRef(false);

  const { canEdit } = useTeamRole(teamId);
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

  // --- 파생값 (useQuery 결과 `diagram`에 의존하므로 그룹7 이후 배치) ---
  /** 빈 다이어그램 여부 */
  const diagramHasContent = !!diagram?.content;
  /** 렌더 가능 그래프 판정 */
  const hasRenderableGraph = storeHasRenderableGraph;
  /** 빈 다이어그램이면 오버레이 불필요 */
  const isPersistedEmptyDiagram = !diagramHasContent;
  /** 오버레이 표시 조건 */
  const showOverlay = !isPersistedEmptyDiagram && !hasRenderableGraph && !initialLoadComplete;

  const saveMutation = useMutation({
    mutationFn: (content: string) => saveDiagram(teamId!, projectId!, diagramId!, content),
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
  const { providerRef, isPreviewMode, previewSyncStatus } = useYjsCollaboration(diagram, diagramId);

  useEffect(() => {
    if (!ydoc) {
      setSharedCodeModeDraftGraph(null);
      return;
    }

    const draftMap = getCodeModeSharedDraftMap(ydoc);
    const syncDraftGraph = (_event?: Y.YMapEvent<unknown>) => {
      setSharedCodeModeDraftGraph(readCodeModeSharedDraftGraph(ydoc));
    };

    syncDraftGraph();
    draftMap.observe(syncDraftGraph);
    return () => {
      draftMap.unobserve(syncDraftGraph);
    };
  }, [ydoc]);

  const sharedDraftOverlayGraph = useMemo(() => {
    if (workModeCapabilities.canvasSource === 'preview' || activeGroupId) {
      return null;
    }
    return sharedCodeModeDraftGraph;
  }, [activeGroupId, sharedCodeModeDraftGraph, workModeCapabilities.canvasSource]);
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
   * 현재 Y.Doc 전체 상태를 서버 persisted snapshot으로 저장한다.
   *
   * code 모드 shared draft를 세션 종료/재접속 후에도 복원할 수 있도록
   * 로컬 update를 주기적으로 snapshot에 반영한다.
   *
   * @param useKeepalive keepalive fetch 사용 여부
   * @returns 없음
   */
  const persistCodeModeSnapshotNow = useCallback(
    async (useKeepalive = false) => {
      if (!teamId || !projectId || !diagramId || !ydoc) {
        return;
      }
      if (!diagram?.contentRevision) {
        return;
      }

      const nextSnapshot = Y.encodeStateAsUpdate(ydoc);
      if (nextSnapshot.length === 0) {
        codeModeSnapshotPersistDirtyRef.current = false;
        return;
      }

      if (useKeepalive) {
        codeModeSnapshotPersistDirtyRef.current = false;
        persistDiagramYdocSnapshotKeepalive(
          teamId,
          projectId,
          diagramId,
          diagram.contentRevision,
          nextSnapshot,
        );
        return;
      }

      if (codeModeSnapshotPersistInFlightRef.current) {
        codeModeSnapshotPersistDirtyRef.current = true;
        return;
      }

      codeModeSnapshotPersistInFlightRef.current = true;
      codeModeSnapshotPersistDirtyRef.current = false;
      try {
        await persistDiagramYdocSnapshot(
          teamId,
          projectId,
          diagramId,
          diagram.contentRevision,
          nextSnapshot,
        );
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 409) {
          codeModeSnapshotPersistDirtyRef.current = false;
          console.warn('[DiagramPage] code mode snapshot persist skipped due to stale content revision');
          return;
        }
        codeModeSnapshotPersistDirtyRef.current = true;
        console.warn('[DiagramPage] code mode snapshot persist failed:', error);
      } finally {
        codeModeSnapshotPersistInFlightRef.current = false;
        if (codeModeSnapshotPersistDirtyRef.current) {
          if (codeModeSnapshotPersistTimerRef.current) {
            clearTimeout(codeModeSnapshotPersistTimerRef.current);
          }
          codeModeSnapshotPersistTimerRef.current = setTimeout(() => {
            void persistCodeModeSnapshotNow();
          }, CODE_SHARED_DRAFT_SERVER_PERSIST_IDLE_MS);
        }
      }
    },
    [diagram?.contentRevision, diagramId, projectId, teamId, ydoc],
  );

  /**
   * code 모드 snapshot 서버 저장을 debounce 예약한다.
   *
   * @returns 없음
   */
  const scheduleCodeModeSnapshotPersist = useCallback(() => {
    codeModeSnapshotPersistDirtyRef.current = true;
    if (codeModeSnapshotPersistTimerRef.current) {
      clearTimeout(codeModeSnapshotPersistTimerRef.current);
    }
    codeModeSnapshotPersistTimerRef.current = setTimeout(() => {
      void persistCodeModeSnapshotNow();
    }, CODE_SHARED_DRAFT_SERVER_PERSIST_IDLE_MS);
  }, [persistCodeModeSnapshotNow]);

  /**
   * code 모드 shared draft text flush 직후 snapshot 저장을 즉시 시작한다.
   *
   * 일반 입력 경로에서는 keepalive 대신 즉시 서버 저장을 시작해
   * 재접속 직후에도 draft가 복원될 가능성을 높인다.
   *
   * @returns 없음
   */
  const requestImmediateCodeModeSnapshotPersist = useCallback(() => {
    if (codeModeSnapshotPersistTimerRef.current) {
      clearTimeout(codeModeSnapshotPersistTimerRef.current);
      codeModeSnapshotPersistTimerRef.current = null;
    }
    codeModeSnapshotPersistDirtyRef.current = false;
    void persistCodeModeSnapshotNow();
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
    if (!workModeCapabilities.persistCodeDraft || !ydoc || !teamId || !projectId || !diagramId) {
      if (codeModeSnapshotPersistTimerRef.current) {
        clearTimeout(codeModeSnapshotPersistTimerRef.current);
        codeModeSnapshotPersistTimerRef.current = null;
      }
      codeModeSnapshotPersistDirtyRef.current = false;
      return;
    }

    const handleDocUpdate = (_update: Uint8Array, origin: unknown) => {
      if (
        origin === 'remote' ||
        origin === CANVAS_HISTORY_ORIGIN.SYSTEM_DICTIONARY_RECONCILE ||
        origin === CODE_MODE_SHARED_DRAFT_TEXT_ORIGIN
      ) {
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
      }
    };

    ydoc.on('update', handleDocUpdate);
    globalThis.addEventListener('pagehide', flushKeepalive);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      ydoc.off('update', handleDocUpdate);
      globalThis.removeEventListener('pagehide', flushKeepalive);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flushKeepalive();
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
                          onPreviewPositionOverridesChange={setDslPreviewPositionOverrides}
                          onNavigateToTable={handleNavigateToTableFromEditor}
                          tableRevealRequest={tableCodeRevealRequest}
                          delayDraftHydration={
                            workModeCapabilities.persistCodeDraft &&
                            !!diagram?.hasYdocSnapshot &&
                            isPreviewMode
                          }
                          persistedDiagramHasContent={!!diagram?.content}
                          onPersistCodeModeSnapshot={
                            workModeCapabilities.persistCodeDraft
                              ? requestImmediateCodeModeSnapshotPersist
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
                        onPositionOverridesChange={setDslPreviewPositionOverrides}
                        canOpenDictionary={
                          !!dictionaryContextSetId && workModeRuntimeState.canOpenDictionaryManagement
                        }
                        onOpenDictionary={
                          dictionaryContextSetId && workModeRuntimeState.canOpenDictionaryManagement
                            ? () => setDictionaryDialogOpen(true)
                            : undefined
                        }
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
