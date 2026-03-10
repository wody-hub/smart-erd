import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import ERDCanvas from '@/components/erd/ERDCanvas';
import CanvasLoadingOverlay from '@/components/erd/CanvasLoadingOverlay';
import DiagramSyncStatusBanner from '@/components/erd/DiagramSyncStatusBanner';
import ValidationPanel from '@/components/erd/ValidationPanel';
import { ErdDictionaryProvider } from '@/components/erd/ErdDictionaryContext';
import { ErdPermissionProvider } from '@/components/erd/ErdPermissionContext';
import Spinner from '@/components/ui/spinner';
import useCanvasStore from '@/stores/useCanvasStore';
import useCollaborationStore from '@/stores/useCollaborationStore';
import { fetchDiagram, saveDiagram } from '@/api/diagramApi';
import { queryKeys } from '@/constants/query-keys';
import { KEYBINDINGS } from '@/constants/keybindings';
import { getErrorMessage } from '@/lib/api-error';
import { useTeamRole } from '@/hooks/useTeamRole';
import { toast } from 'sonner';
import { useYjsCollaboration } from '@/hooks/useYjsCollaboration';
import { useAutoBackup } from '@/hooks/useAutoBackup';

const DdlCodeEditorPanel = lazy(() => import('@/components/erd/DdlCodeEditorPanel'));

/** 빈 핸들러 (오버레이 retry prop용, 현재 syncStage 고정이므로 미사용) */
const noop = () => {};

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
  const SIDEBAR_MIN_WIDTH = 180;
  const SIDEBAR_MAX_WIDTH = 480;
  const SIDEBAR_KEYBOARD_STEP = 16;

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
  /** 좌측 패널 모드 ('sidebar' | 'code') */
  const [leftPanel, setLeftPanel] = useState<'sidebar' | 'code'>('sidebar');
  /** 좌측 사이드바 너비(px) */
  const [sidebarWidth, setSidebarWidth] = useState(224);
  /** 사이드바 리사이즈 진행 여부 */
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  /** 활성 그룹 ID (null이면 전체 보기) */
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  /** 초기 진입 렌더 완료 래치 (한 번 true가 되면 동일 다이어그램 세션에서 유지) */
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  /** 다이어그램 전환 감지용 래치 키 */
  const latchKey = `${projectId}:${diagramId}`;
  /** 이전 래치 키 보관 ref */
  const prevLatchKeyRef = useRef(latchKey);
  /** 이전 preview 모드 상태 보관 ref (연결 완료 토스트 1회 제어용) */
  const prevPreviewSyncStatusRef = useRef<'inactive' | 'syncing' | 'live' | 'degraded'>(
    'inactive',
  );
  /** 다이어그램 전환 직후 1회 평가 스킵 가드 */
  const skipLatchEvalRef = useRef(false);
  /** 진행 중인 사이드바 리사이즈 정리 함수 */
  const sidebarResizeCleanupRef = useRef<(() => void) | null>(null);
  /** 언마운트 진행 여부 */
  const isUnmountingRef = useRef(false);
  /** 사이드바 래퍼 DOM ref (리사이즈 중 직접 width 반영) */
  const sidebarContainerRef = useRef<HTMLDivElement | null>(null);
  /** 사이드바 리사이즈 핸들 ref (접근성 값 실시간 반영) */
  const sidebarResizeHandleRef = useRef<HTMLDivElement | null>(null);
  /** 최신 사이드바 너비 ref */
  const sidebarWidthRef = useRef(224);
  /** 사이드바 리사이즈 rAF ID */
  const sidebarResizeRafRef = useRef<number | null>(null);
  /** rAF 틱에서 반영할 사이드바 너비 */
  const pendingSidebarWidthRef = useRef<number | null>(null);

  const { canEdit } = useTeamRole(teamId);

  const prepareBackup = useCanvasStore((s) => s.prepareBackup);
  const markBackedUp = useCanvasStore((s) => s.markBackedUp);
  const groups = useCanvasStore((s) => s.groups);
  const connectionStatus = useCollaborationStore((s) => s.connectionStatus);
  /** store에 렌더 가능한 노드/엣지가 존재하는지 (boolean selector로 리렌더 최소화) */
  const storeHasRenderableGraph = useCanvasStore(
    (s) => s.nodes.length > 0 || s.edges.length > 0,
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
   * 사이드바 너비를 허용 범위로 보정한다.
   *
   * @param width 후보 너비
   * @returns 보정된 너비
   */
  const clampSidebarWidth = (width: number) =>
    Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, width));

  /** 사이드바 DOM 너비를 즉시 반영한다. */
  const applySidebarWidth = useCallback((width: number) => {
    const sidebarEl = sidebarContainerRef.current;
    if (sidebarEl) {
      sidebarEl.style.width = `${width}px`;
    }
    const resizeHandle = sidebarResizeHandleRef.current;
    if (resizeHandle) {
      resizeHandle.setAttribute('aria-valuenow', String(Math.round(width)));
    }
  }, []);

  /**
   * 현재 진행 중인 사이드바 리사이즈 리스너/전역 스타일을 정리한다.
   *
   * @returns 없음
   */
  const cleanupSidebarResize = () => {
    if (!sidebarResizeCleanupRef.current) return;
    sidebarResizeCleanupRef.current();
    sidebarResizeCleanupRef.current = null;
  };

  /**
   * 사이드바 리사이즈 시작 핸들러.
   *
   * @param e PointerDown 이벤트
   * @returns 없음
   */
  const handleSidebarResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.focus();
    cleanupSidebarResize();
    const startX = e.clientX;
    const startWidth = sidebarWidthRef.current;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    setIsSidebarResizing(true);

    /**
     * 리사이즈 중 대기 너비를 상태와 DOM에 반영한다.
     *
     * @returns 없음
     */
    const flushPendingWidth = () => {
      if (sidebarResizeRafRef.current !== null) {
        cancelAnimationFrame(sidebarResizeRafRef.current);
        sidebarResizeRafRef.current = null;
      }
      const nextWidth = pendingSidebarWidthRef.current;
      pendingSidebarWidthRef.current = null;
      if (nextWidth === null) {
        if (!isUnmountingRef.current) {
          setSidebarWidth((prev) =>
            prev === sidebarWidthRef.current ? prev : sidebarWidthRef.current,
          );
        }
        return;
      }
      sidebarWidthRef.current = nextWidth;
      applySidebarWidth(nextWidth);
      if (!isUnmountingRef.current) {
        setSidebarWidth((prev) => (prev === nextWidth ? prev : nextWidth));
      }
    };

    /**
     * pointermove 중 사이드바 너비를 갱신한다.
     *
     * @param ev PointerEvent
     * @returns 없음
     */
    const handleMove = (ev: PointerEvent) => {
      pendingSidebarWidthRef.current = clampSidebarWidth(startWidth + (ev.clientX - startX));
      if (sidebarResizeRafRef.current !== null) {
        return;
      }
      sidebarResizeRafRef.current = requestAnimationFrame(() => {
        sidebarResizeRafRef.current = null;
        const nextWidth = pendingSidebarWidthRef.current;
        pendingSidebarWidthRef.current = null;
        if (nextWidth === null) {
          return;
        }
        if (nextWidth === sidebarWidthRef.current) {
          return;
        }
        sidebarWidthRef.current = nextWidth;
        applySidebarWidth(nextWidth);
      });
    };

    /**
     * 리사이즈 종료 시 리스너와 전역 상태를 정리한다.
     *
     * @returns 없음
     */
    const handleEnd = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
      window.removeEventListener('blur', handleEnd);
      flushPendingWidth();
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (!isUnmountingRef.current) {
        setIsSidebarResizing(false);
      }
      sidebarResizeCleanupRef.current = null;
    };

    sidebarResizeCleanupRef.current = handleEnd;
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    window.addEventListener('blur', handleEnd);
  };

  /**
   * 키보드 기반 사이드바 리사이즈 핸들러.
   *
   * ArrowLeft/ArrowRight로 너비를 조절하고, Home/End로 최소/최대로 이동한다.
   *
   * @param e 키보드 이벤트
   * @returns 없음
   */
  const handleSidebarResizeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSidebarWidth((prev) => clampSidebarWidth(prev - SIDEBAR_KEYBOARD_STEP));
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSidebarWidth((prev) => clampSidebarWidth(prev + SIDEBAR_KEYBOARD_STEP));
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setSidebarWidth(SIDEBAR_MIN_WIDTH);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      setSidebarWidth(SIDEBAR_MAX_WIDTH);
    }
  };

  useAutoBackup(saveMutation, teamId!, projectId!, diagramId!);
  useHotkeys(KEYBINDINGS.SAVE, handleSave, { preventDefault: true });

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
    applySidebarWidth(sidebarWidth);
  }, [sidebarWidth, applySidebarWidth]);

  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      if (sidebarResizeCleanupRef.current) {
        sidebarResizeCleanupRef.current();
        sidebarResizeCleanupRef.current = null;
      }
      if (sidebarResizeRafRef.current !== null) {
        cancelAnimationFrame(sidebarResizeRafRef.current);
        sidebarResizeRafRef.current = null;
      }
      pendingSidebarWidthRef.current = null;
    };
  }, []);

  // Y.Doc + YjsProvider 라이프사이클 관리
  const { providerRef, isPreviewMode, previewSyncStatus } = useYjsCollaboration(diagram, diagramId);
  /** 프리뷰 중에는 전반적 편집을 잠근다. */
  const effectiveCanEdit = canEdit && !isPreviewMode;
  const previewReadOnlyMessage = isPreviewMode
    ? t('diagram.previewSync.headerReadonly')
    : undefined;

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

  const dictionarySetId = diagram?.dictionarySetId ? String(diagram.dictionarySetId) : '';

  return (
    <ReactFlowProvider>
      <ErdDictionaryProvider teamId={teamId!} setId={dictionarySetId}>
        <ErdPermissionProvider canEdit={effectiveCanEdit}>
          <div className="h-screen flex flex-col">
            <Header
              diagramName={diagramName}
              onSave={effectiveCanEdit ? handleSave : undefined}
              saving={saveMutation.isPending}
              connectionStatus={connectionStatus}
              canEdit={effectiveCanEdit}
              readOnlyMessage={previewReadOnlyMessage}
            />
            {canEdit && isPreviewMode && (
              <DiagramSyncStatusBanner connectionStatus={connectionStatus} />
            )}
            {diagram?.dictionarySetName && (
              <div className="px-4 py-1 text-xs text-muted-foreground border-b bg-background">
                {t('diagram.edit.dictionarySet', { name: diagram.dictionarySetName })}
              </div>
            )}
            <div className="flex flex-1 overflow-hidden">
              <div
                ref={sidebarContainerRef}
                className="h-full shrink-0"
                style={{ width: sidebarWidth }}
              >
                {leftPanel === 'sidebar' ? (
                  <Sidebar
                    canEdit={effectiveCanEdit}
                    activeGroupId={activeGroupId}
                    onViewGroup={handleViewGroup}
                    onBackToAll={handleBackToAll}
                  />
                ) : (
                  <Suspense fallback={<Spinner />}>
                    <DdlCodeEditorPanel canEdit={effectiveCanEdit} />
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
                <ERDCanvas
                  diagramName={diagramName || 'diagram'}
                  provider={providerRef.current}
                  validationOpen={validationOpen}
                  onToggleValidation={handleToggleValidation}
                  canEdit={effectiveCanEdit}
                  activeGroupId={activeGroupId}
                  activeGroupName={activeGroup?.label}
                  activeGroupTableIds={activeGroupTableIds}
                  codeEditorActive={leftPanel === 'code'}
                  onToggleCodeEditor={
                    effectiveCanEdit && !activeGroupId ? handleToggleCodeEditor : undefined
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
              </main>
              {validationOpen && <ValidationPanel onClose={() => setValidationOpen(false)} />}
            </div>
          </div>
        </ErdPermissionProvider>
      </ErdDictionaryProvider>
    </ReactFlowProvider>
  );
}
