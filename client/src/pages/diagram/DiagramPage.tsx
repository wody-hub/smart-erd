import { lazy, Suspense, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ReactFlowProvider } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import { useShallow } from 'zustand/react/shallow';
import { fetchProject } from '@/api/projectApi';
import { fetchTeam } from '@/api/teamApi';
import DiagramCollaboratorsBar from '@/components/erd/DiagramCollaboratorsBar';
import { DiagramCodeNavigationProvider } from '@/components/erd/DiagramCodeNavigationContext';
import DiagramHeaderAccessory from '@/components/erd/DiagramHeaderAccessory';
import DiagramWorkModeSwitcher from '@/components/erd/DiagramWorkModeSwitcher';
import PreviewCanvas from '@/components/erd/PreviewCanvas';
import Header from '@/components/layout/Header';
import ERDCanvas from '@/components/erd/ERDCanvas';
import CanvasLoadingOverlay from '@/components/erd/CanvasLoadingOverlay';
import DiagramSidebar from '@/components/erd/DiagramSidebar';
import DiagramSyncStatusBanner from '@/components/erd/DiagramSyncStatusBanner';
import ValidationPanel from '@/components/erd/ValidationPanel';
import { ErdDictionaryProvider } from '@/components/erd/ErdDictionaryContext';
import { ErdPermissionProvider } from '@/components/erd/ErdPermissionContext';
import { DiagramWorkModeProvider } from '@/components/erd/DiagramWorkModeContext';
import Spinner from '@/components/ui/spinner';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import useCollaborationStore from '@/stores/erd/useCollaborationStore';
import { DocumentMutationSessionProvider } from '@/collaboration/core/session/document-mutation-session';
import type { PreviewSyncStatus } from '@/collaboration/core/collaboration-preview-sync-status';
import { isTextInputLikeTarget } from '@/constants/canvas-history';
import { KEYBINDINGS } from '@/constants/keybindings';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useRecentProjectContext } from '@/hooks/useRecentProjectContext';
import { useTeamRole } from '@/hooks/useTeamRole';
import { useSidebarResize, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from '@/hooks/useSidebarResize';
import { useDiagramDictionaryReconciliation } from '@/hooks/useDiagramDictionaryReconciliation';
import { useDiagramSharedSchemaDraft } from '@/collaboration/channel/diagram/use-diagram-shared-schema-draft';
import { useDiagramDocumentSession } from '@/collaboration/channel/diagram/use-diagram-document-session';
import { createDiagramWorkModeCapabilities } from '@/lib/diagram-work-mode';
import { cn } from '@/lib/utils';
import type { ERDEdge, TableNode } from '@/types/erd';
import type { DictionaryWorkspaceRouteState } from '@/types/workspace';
import { useDiagramPageControls } from './use-diagram-page-controls';
import { useDiagramPageRuntimeState } from './use-diagram-page-runtime-state';
import { useDiagramWorkModeState } from './use-diagram-work-mode-state';

const DdlCodeEditorPanel = lazy(() => import('@/components/erd/DdlCodeEditorPanel'));

/** 빈 핸들러 (오버레이 retry prop용, 현재 syncStage 고정이므로 미사용). @returns 없음 */
const noop = () => {};

function DiagramDictionaryReconciler({
  diagramId,
  isPreviewMode,
  previewSyncStatus,
}: {
  diagramId: string;
  isPreviewMode: boolean;
  previewSyncStatus: PreviewSyncStatus;
}) {
  useDiagramDictionaryReconciliation({ diagramId, isPreviewMode, previewSyncStatus });
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
  const navigate = useNavigate();

  const { t } = useTranslation();
  const { recordRecentProjectContext } = useRecentProjectContext(teamId);
  const { canEdit } = useTeamRole(teamId);
  const isMobileEditorLayout = useMediaQuery('(max-width: 767px)');

  const { data: team } = useQuery({
    queryKey: queryKeys.teams.detail(teamId!),
    queryFn: () => fetchTeam(teamId!),
    enabled: !!teamId,
  });
  const { data: project } = useQuery({
    queryKey: queryKeys.projects.detail(teamId!, projectId!),
    queryFn: () => fetchProject(teamId!, projectId!),
    enabled: !!teamId && !!projectId,
  });

  const { workMode, handleWorkModeChange } = useDiagramWorkModeState({
    teamId,
    projectId,
    diagramId,
  });
  const workModeCapabilities = useMemo(
    () => createDiagramWorkModeCapabilities(workMode),
    [workMode],
  );
  const {
    columnDefinitionExporting,
    handleExportColumnDefinition,
    handleExportIndexDefinition,
    handleExportTableDefinition,
    handleToggleCodeEditor: toggleCodeEditorPanel,
    handleToggleValidation,
    indexDefinitionExporting,
    leftPanel,
    setLeftPanel,
    setValidationOpen,
    tableDefinitionExporting,
    validationOpen,
  } = useDiagramPageControls({ diagramId, projectId, t, teamId });
  const {
    sidebarWidth,
    isSidebarResizing,
    sidebarContainerRef,
    sidebarResizeHandleRef,
    handleSidebarResizeStart,
    handleSidebarResizeKeyDown,
  } = useSidebarResize();

  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s.canUndo);
  const canRedo = useCanvasStore((s) => s.canRedo);
  const groups = useCanvasStore((s) => s.groups);
  const setActiveEditNodeId = useCanvasStore((s) => s.setActiveEditNodeId);
  const clearHighlights = useCanvasStore((s) => s.clearHighlights);
  const connectionStatus = useCollaborationStore((s) => s.connectionStatus);
  const connectionIssue = useCollaborationStore((s) => s.connectionIssue);
  /** store에 렌더 가능한 노드/엣지가 존재하는지 (boolean selector로 리렌더 최소화) */
  const storeHasRenderableGraph = useCanvasStore((s) => s.nodes.length > 0 || s.edges.length > 0);
  const { persistedNodes, persistedEdges } = useCanvasStore(
    useShallow((state) => ({
      persistedNodes: state.nodes as TableNode[],
      persistedEdges: state.edges as ERDEdge[],
    })),
  );

  const {
    diagram,
    isLoading,
    isError,
    providerRef,
    isPreviewMode,
    previewSyncStatus,
    collaborationSetupErrorKind,
    retryCollaborationSetup,
    documentMutationSession,
    handleSave,
    persistPublishedDiagramNow,
    isDiagramSavePending,
    codeModeDraftPersistStatus,
    codeModeDraftPersistedAt,
    scheduleCodeModeSnapshotPersist,
    resetCodeModeSnapshotPersistState,
    registerBeforeCodeModeSnapshotPersist,
  } = useDiagramDocumentSession({
    teamId,
    projectId,
    diagramId,
    enableCodeModeDraftPersist: workModeCapabilities.persistCodeDraft,
  });
  const { sharedSchemaDraft, writePreviewPositionOverrides } = useDiagramSharedSchemaDraft();
  const {
    activeGroupId,
    activeGroup,
    activeGroupTableIds,
    canOpenDictionaryContext,
    captureCodeEditorPreviewState,
    codeDraftPersistEnabled,
    delayCodeDraftHydration,
    diagramName,
    dictionaryContextName,
    dictionaryContextSetId,
    dslPreviewPositionOverrides,
    dslPreviewState,
    handleBackToAll,
    handleDslPreviewStateChange,
    handleNavigateToCodeFromDiagram,
    handleNavigateToTableFromEditor,
    handleSharedSchemaDraftPositionsChange,
    handleToggleCodeEditor,
    handleViewGroup,
    previewReadOnlyMessage,
    sharedDraftOverlayGraph,
    sharedDraftOverlaySuppressed,
    showOverlay,
    showPreviewCanvas,
    tableCodeRevealRequest,
    tableFocusRequest,
    workModeRuntimeState,
  } = useDiagramPageRuntimeState({
    beforeViewGroup: () => {
      setActiveEditNodeId(null);
      clearHighlights();
    },
    canEdit,
    collaborationSetupErrorKind,
    diagram,
    diagramId,
    groups,
    isLoading,
    isPreviewMode,
    leftPanel,
    persistedEdges,
    persistedNodes,
    previewSyncStatus,
    projectId,
    setLeftPanel,
    sharedSchemaDraft,
    storeHasRenderableGraph,
    toggleCodeEditorPanel,
    t,
    workModeCapabilities,
    workMode,
    writePreviewPositionOverrides,
  });
  const handleOpenDictionaryContext = useCallback(() => {
    if (!teamId || !projectId || !canOpenDictionaryContext) {
      return;
    }

    const dictionaryRouteState: DictionaryWorkspaceRouteState = {
      fixedSetId: dictionaryContextSetId,
      fixedSetLabel: dictionaryContextName ?? null,
    };
    recordRecentProjectContext(projectId);
    navigate(ROUTES.DICTIONARY(teamId), {
      state: dictionaryRouteState,
    });
  }, [
    canOpenDictionaryContext,
    dictionaryContextName,
    dictionaryContextSetId,
    navigate,
    projectId,
    recordRecentProjectContext,
    teamId,
  ]);
  const diagramHeaderRightSlot = (
    <DiagramHeaderAccessory
      onSave={workModeRuntimeState.canPersistDiagramSave ? handleSave : undefined}
      saving={isDiagramSavePending}
      connectionStatus={connectionStatus}
      canEdit={workModeRuntimeState.headerCanEdit}
      readOnlyMessage={!workModeRuntimeState.headerCanEdit ? previewReadOnlyMessage : undefined}
      accessory={
        <div className="header-utility-rail">
          <DiagramWorkModeSwitcher mode={workMode} onModeChange={handleWorkModeChange} />
          <DiagramCollaboratorsBar />
        </div>
      }
    />
  );
  /**
   * 현재 포커스가 캔버스 undo 단축키를 가로채면 안 되는 입력 필드인지 확인한다.
   *
   * @returns 텍스트 입력 계열 포커스면 true
   */
  const shouldBypassCanvasUndo = () => isTextInputLikeTarget(document.activeElement);

  useHotkeys(KEYBINDINGS.SAVE, handleSave, {
    preventDefault: true,
    enabled: workModeRuntimeState.canPersistDiagramSave,
  });

  /**
   * code 모드 shared schema draft 위치 정보를 갱신한다.
   *
   * 신규 draft 테이블 위치는 shared schema draft에 저장하고,
   * 기존 persisted 테이블 위치는 PreviewCanvas 내부에서 persisted Y.Doc에 즉시 반영한다.
   *
   * @param nextPositions 다음 preview 위치 레코드
   * @returns 없음
   */
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

  if (isError) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <Header
          workspaceContext={{
            team: team ? { id: teamId!, name: team.name } : undefined,
            project: project ? { id: projectId!, name: project.name } : undefined,
            section: 'documents',
            documentType: 'erd',
          }}
        />
        <div className="workspace-shell flex flex-1 items-center justify-center">
          <p className="text-destructive">{t('diagram.edit.loadError')}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <Header
          workspaceContext={{
            team: team ? { id: teamId!, name: team.name } : undefined,
            project: project ? { id: projectId!, name: project.name } : undefined,
            section: 'documents',
            documentType: 'erd',
          }}
        />
        <div className="workspace-shell flex flex-1 items-center justify-center">
          <Spinner text={t('diagram.edit.loadingDiagram')} />
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <DocumentMutationSessionProvider value={documentMutationSession}>
        <ErdDictionaryProvider teamId={teamId!} setId={dictionaryContextSetId}>
          <DiagramDictionaryReconciler
            diagramId={diagramId!}
            isPreviewMode={isPreviewMode}
            previewSyncStatus={previewSyncStatus}
          />
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
                <div className="flex h-screen flex-col bg-background">
                  <Header
                    workspaceContext={{
                      team: team ? { id: teamId!, name: team.name } : undefined,
                      project: project ? { id: projectId!, name: project.name } : undefined,
                      section: 'documents',
                      documentType: 'erd',
                      document: {
                        id: diagramId!,
                        name: diagramName,
                        type: 'erd',
                      },
                    }}
                    rightSlot={diagramHeaderRightSlot}
                  />
                  {(workModeRuntimeState.showPreviewSyncBanner ||
                    collaborationSetupErrorKind ||
                    connectionIssue) && (
                    <DiagramSyncStatusBanner
                      connectionStatus={connectionStatus}
                      connectionIssue={connectionIssue}
                      setupErrorKind={collaborationSetupErrorKind}
                      onRetry={
                        collaborationSetupErrorKind === 'authoritative-bootstrap-required' ||
                        connectionIssue
                          ? retryCollaborationSetup
                          : undefined
                      }
                    />
                  )}
                  {sharedDraftOverlaySuppressed && (
                    <div className="banner-warm-surface border-b px-4 py-2 text-xs text-ink-secondary">
                      {t('diagram.previewSync.sharedDraftOverlaySuppressed')}
                    </div>
                  )}
                  {(workModeRuntimeState.showCodeModeInfoBanner || dictionaryContextName) && (
                    <div className="editor-meta-strip">
                      {workModeRuntimeState.showCodeModeInfoBanner && (
                        <span className="editor-meta-chip">
                          {t('diagram.workMode.codeInfoCompact')}
                        </span>
                      )}
                      {dictionaryContextName && (
                        <span className="editor-meta-chip">
                          {t('diagram.edit.dictionaryContext', { name: dictionaryContextName })}
                        </span>
                      )}
                    </div>
                  )}
                  <div
                    className={cn(
                      'flex flex-1 min-h-0 bg-background',
                      isMobileEditorLayout
                        ? 'flex-col overflow-x-hidden overflow-y-auto'
                        : 'overflow-hidden',
                    )}
                  >
                    <div
                      ref={sidebarContainerRef}
                      className={cn(
                        'shrink-0',
                        isMobileEditorLayout ? 'max-h-[18rem] w-full' : 'h-full',
                      )}
                      style={isMobileEditorLayout ? undefined : { width: sidebarWidth }}
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
                            persistDraft={codeDraftPersistEnabled}
                            dslOnly={workModeCapabilities.dslOnlyCodeEditor}
                            workMode={workMode}
                            previewPositionOverrides={dslPreviewPositionOverrides}
                            onPreviewPositionOverridesChange={
                              handleSharedSchemaDraftPositionsChange
                            }
                            onNavigateToTable={handleNavigateToTableFromEditor}
                            tableRevealRequest={tableCodeRevealRequest}
                            delayDraftHydration={delayCodeDraftHydration}
                            persistedDiagramHasContent={!!diagram?.content}
                            onScheduleCodeModeSnapshotPersist={
                              codeDraftPersistEnabled ? scheduleCodeModeSnapshotPersist : undefined
                            }
                            onResetCodeModeSnapshotPersistState={
                              codeDraftPersistEnabled
                                ? resetCodeModeSnapshotPersistState
                                : undefined
                            }
                            registerBeforeCodeModeSnapshotPersist={
                              codeDraftPersistEnabled
                                ? registerBeforeCodeModeSnapshotPersist
                                : undefined
                            }
                            codeModeDraftPersistStatus={codeModeDraftPersistStatus}
                            codeModeDraftPersistedAt={codeModeDraftPersistedAt}
                            onPersistPublishedDiagram={
                              codeDraftPersistEnabled ? persistPublishedDiagramNow : undefined
                            }
                            onDslPreviewStateChange={
                              captureCodeEditorPreviewState
                                ? handleDslPreviewStateChange
                                : undefined
                            }
                          />
                        </Suspense>
                      )}
                    </div>
                    {!isMobileEditorLayout && (
                      <div
                        ref={sidebarResizeHandleRef}
                        className="group flex w-3 shrink-0 cursor-col-resize items-stretch justify-center bg-secondary/30 transition-colors hover:bg-secondary/65 active:bg-secondary/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
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
                        <div className="h-full w-px bg-border/80 transition-colors group-hover:bg-primary/80 group-active:bg-primary" />
                      </div>
                    )}
                    <main
                      className={cn(
                        'relative flex-1 min-h-0 min-w-0 bg-card/20',
                        isMobileEditorLayout && 'min-h-[56vh]',
                      )}
                    >
                      {showPreviewCanvas ? (
                        <PreviewCanvas
                          previewState={dslPreviewState}
                          diagramName={diagramName || 'diagram'}
                          tableFocusRequest={tableFocusRequest}
                          positionOverrides={dslPreviewPositionOverrides}
                          onPositionOverridesChange={handleSharedSchemaDraftPositionsChange}
                          canEdit={workModeRuntimeState.effectiveCodeCanEdit}
                          canOpenDictionaryContext={canOpenDictionaryContext}
                          onOpenDictionaryContext={handleOpenDictionaryContext}
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
                            onOpenDictionaryContext={handleOpenDictionaryContext}
                            canEdit={workModeRuntimeState.effectiveCanvasCanEdit}
                            activeGroupId={activeGroupId}
                            activeGroupName={activeGroup?.label}
                            activeGroupTableIds={activeGroupTableIds}
                            codeEditorActive={leftPanel === 'code'}
                            onToggleCodeEditor={handleToggleCodeEditor}
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
                </div>
              </ErdPermissionProvider>
            </DiagramCodeNavigationProvider>
          </DiagramWorkModeProvider>
        </ErdDictionaryProvider>
      </DocumentMutationSessionProvider>
    </ReactFlowProvider>
  );
}
