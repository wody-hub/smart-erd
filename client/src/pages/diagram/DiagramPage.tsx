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
import CollabSyncBanner from '@/components/erd/CollabSyncBanner';
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
import { useDiagramPreview } from '@/hooks/useDiagramPreview';
import { useDiagramSyncStage } from '@/hooks/useDiagramSyncStage';
import { toast } from 'sonner';
import { useYjsCollaboration } from '@/hooks/useYjsCollaboration';
import { useAutoBackup } from '@/hooks/useAutoBackup';
import { ENABLE_API_PREVIEW } from '@/constants/feature-flags';
import { useSidebarResize } from '@/hooks/useSidebarResize';

/** 다이어그램 쿼리 staleTime (ms) — 5분 */
const DIAGRAM_QUERY_STALE_TIME_MS = 5 * 60 * 1000;

const DdlCodeEditorPanel = lazy(() => import('@/components/erd/DdlCodeEditorPanel'));

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
  /** 좌측 패널 모드 ('sidebar' | 'code') */
  const [leftPanel, setLeftPanel] = useState<'sidebar' | 'code'>('sidebar');
  /** 활성 그룹 ID (null이면 전체 보기) */
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  /** 초기 진입 렌더 완료 래치 (한 번 true가 되면 동일 다이어그램 세션에서 유지) */
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  /** 다이어그램 전환 감지용 래치 키 */
  const latchKey = `${projectId}:${diagramId}`;
  /** 이전 래치 키 보관 ref */
  const prevLatchKeyRef = useRef(latchKey);
  /** 다이어그램 전환 직후 1회 평가 스킵 가드 */
  const skipLatchEvalRef = useRef(false);

  const {
    sidebarWidth,
    isSidebarResizing,
    sidebarContainerRef,
    sidebarResizeHandleRef,
    handleResizeStart,
    handleResizeKeyDown,
    minWidth: sidebarMinWidth,
    maxWidth: sidebarMaxWidth,
  } = useSidebarResize();

  const { canEdit } = useTeamRole(teamId);

  const prepareBackup = useCanvasStore((s) => s.prepareBackup);
  const markBackedUp = useCanvasStore((s) => s.markBackedUp);
  const groups = useCanvasStore((s) => s.groups);
  const connectionStatus = useCollaborationStore((s) => s.connectionStatus);
  const storeHasRenderableGraph = useCanvasStore((s) => s.nodes.length > 0 || s.edges.length > 0);

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
    staleTime: DIAGRAM_QUERY_STALE_TIME_MS,
  });

  // preview: API 응답 JSON을 즉시 파싱
  const { previewNodes, previewEdges, parseSuccess, parseError } = useDiagramPreview(
    diagram?.content,
  );
  const previewHasRenderableGraph = previewNodes.length > 0 || previewEdges.length > 0;
  const previewRenderableForOverlay = ENABLE_API_PREVIEW && previewHasRenderableGraph;
  const isPersistedEmptyDiagram =
    !diagram?.content || (parseSuccess && previewNodes.length === 0 && previewEdges.length === 0);
  const hasRenderableGraph = previewRenderableForOverlay || storeHasRenderableGraph;
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

  // Y.Doc + YjsProvider 라이프사이클 관리
  const { providerRef } = useYjsCollaboration(diagram, diagramId);

  // SyncStage 상태머신
  const { syncStage, retryCount, maxRetries, manualRetry } = useDiagramSyncStage({
    diagram,
    isLoading,
    previewParseSuccess: parseSuccess,
    previewHasRenderableGraph,
    providerRef,
    featureEnabled: ENABLE_API_PREVIEW,
  });

  /** preview→yjs-live 전환 전까지 편집을 차단하는 복합 플래그 */
  const syncCanEdit = canEdit && syncStage === 'yjs-live';

  useAutoBackup(saveMutation, teamId!, projectId!, diagramId!, syncCanEdit);
  useHotkeys(KEYBINDINGS.SAVE, handleSave, { preventDefault: true });

  // diagram 로드 완료 시 이름 설정
  useEffect(() => {
    if (diagram) {
      setDiagramName(diagram.name);
    }
  }, [diagram]);

  // 오버레이 래치 관리
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

  // preview JSON 파싱 실패 시 1회 경고 토스트
  useEffect(() => {
    if (ENABLE_API_PREVIEW && parseError) {
      toast.warning(t('erd.collabSync.previewParseFailed'));
    }
  }, [parseError, t]);

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
        <ErdPermissionProvider canEdit={syncCanEdit}>
          <div className="h-screen flex flex-col">
            <Header
              diagramName={diagramName}
              onSave={syncCanEdit ? handleSave : undefined}
              saving={saveMutation.isPending}
              connectionStatus={connectionStatus}
              canEdit={canEdit}
            />
            {diagram?.dictionarySetName && (
              <div className="px-4 py-1 text-xs text-muted-foreground border-b bg-background">
                {t('diagram.edit.dictionarySet', { name: diagram.dictionarySetName })}
              </div>
            )}
            {!showOverlay && (
              <CollabSyncBanner
                syncStage={syncStage}
                retryCount={retryCount}
                maxRetries={maxRetries}
                onRetry={manualRetry}
              />
            )}
            <div className="flex flex-1 overflow-hidden">
              <div
                ref={sidebarContainerRef}
                className="h-full shrink-0"
                style={{ width: sidebarWidth }}
              >
                {leftPanel === 'sidebar' ? (
                  <Sidebar
                    canEdit={syncCanEdit}
                    activeGroupId={activeGroupId}
                    onViewGroup={handleViewGroup}
                    onBackToAll={handleBackToAll}
                  />
                ) : (
                  <Suspense fallback={<Spinner />}>
                    <DdlCodeEditorPanel canEdit={syncCanEdit} />
                  </Suspense>
                )}
              </div>
              <div
                ref={sidebarResizeHandleRef}
                className="group w-3 shrink-0 cursor-col-resize flex items-stretch justify-center bg-muted/30 hover:bg-muted/60 active:bg-muted/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                onPointerDown={handleResizeStart}
                onKeyDown={handleResizeKeyDown}
                role="separator"
                aria-orientation="vertical"
                aria-controls="diagram-sidebar"
                aria-label={t('erd.sidebar.resize')}
                aria-valuemin={sidebarMinWidth}
                aria-valuemax={sidebarMaxWidth}
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
                  canEdit={syncCanEdit}
                  syncStage={syncStage}
                  previewNodes={previewNodes}
                  previewEdges={previewEdges}
                  activeGroupId={activeGroupId}
                  activeGroupName={activeGroup?.label}
                  activeGroupTableIds={activeGroupTableIds}
                  codeEditorActive={leftPanel === 'code'}
                  onToggleCodeEditor={
                    syncCanEdit && !activeGroupId ? handleToggleCodeEditor : undefined
                  }
                  isSidebarResizing={isSidebarResizing}
                />
                {showOverlay && (
                  <CanvasLoadingOverlay
                    syncStage={syncStage}
                    retryCount={retryCount}
                    maxRetries={maxRetries}
                    onRetry={manualRetry}
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
