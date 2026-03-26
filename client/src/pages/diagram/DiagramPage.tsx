import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
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
import { DocumentMutationSessionProvider } from '@/collaboration/core/session/document-mutation-session';
import type { PreviewSyncStatus } from '@/collaboration/core/collaboration-preview-sync-status';
import { isTextInputLikeTarget } from '@/constants/canvas-history';
import { KEYBINDINGS } from '@/constants/keybindings';
import { useTeamRole } from '@/hooks/useTeamRole';
import { useSidebarResize, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from '@/hooks/useSidebarResize';
import { useDiagramDictionaryReconciliation } from '@/hooks/useDiagramDictionaryReconciliation';
import { useDiagramSharedSchemaDraft } from '@/collaboration/channel/diagram/use-diagram-shared-schema-draft';
import { useDiagramDocumentSession } from '@/collaboration/channel/diagram/use-diagram-document-session';
import { createDiagramWorkModeCapabilities, type DiagramWorkMode } from '@/lib/diagram-work-mode';
import type {
  CodeEditorTableFocusRequest,
  CodeEditorTableRevealRequest,
} from '@/lib/code-editor-table-navigation';
import type { DslPreviewCanvasState } from '@/lib/dsl-preview-graph';
import type { DiagramPreviewPositionRecord } from '@/lib/diagram-code-draft';
import type { ERDEdge, TableNode } from '@/types/erd';
import { useDiagramPageControls } from './use-diagram-page-controls';
import { useDiagramPageRuntimeState } from './use-diagram-page-runtime-state';

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

  const { t } = useTranslation();

  /** 헤더에 표시할 다이어그램 이름 */
  const [diagramName, setDiagramName] = useState('');
  /** 다이어그램 작업 모드 */
  const [workMode, setWorkMode] = useState<DiagramWorkMode>('sync');
  /** 현재 다이어그램 스코프의 작업 모드 로드 완료 여부 */
  const [workModeHydrated, setWorkModeHydrated] = useState(false);
  /** code 모드의 DSL preview 상태 */
  const [dslPreviewState, setDslPreviewState] = useState<DslPreviewCanvasState | null>(null);
  /** code 모드의 shared schema draft 위치 정보 */
  const [dslPreviewPositionOverrides, setDslPreviewPositionOverrides] =
    useState<DiagramPreviewPositionRecord>({});
  /** 코드 에디터에서 요청한 테이블 포커스 대상 */
  const [tableFocusRequest, setTableFocusRequest] = useState<CodeEditorTableFocusRequest | null>(
    null,
  );
  /** ERD에서 요청한 코드 reveal 대상 */
  const [tableCodeRevealRequest, setTableCodeRevealRequest] =
    useState<CodeEditorTableRevealRequest | null>(null);
  /** 활성 그룹 ID (null이면 전체 보기) */
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  /** 초기 진입 렌더 완료 래치 (한 번 true가 되면 동일 다이어그램 세션에서 유지) */
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const { canEdit } = useTeamRole(teamId);
  const {
    columnDefinitionExporting,
    dictionaryDialogOpen,
    handleExportColumnDefinition,
    handleExportIndexDefinition,
    handleExportTableDefinition,
    handleToggleCodeEditor,
    handleToggleValidation,
    indexDefinitionExporting,
    leftPanel,
    setDictionaryDialogOpen,
    setLeftPanel,
    setValidationOpen,
    tableDefinitionExporting,
    validationOpen,
  } = useDiagramPageControls({ diagramId, projectId, t, teamId });
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

  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s.canUndo);
  const canRedo = useCanvasStore((s) => s.canRedo);
  const groups = useCanvasStore((s) => s.groups);
  const setActiveEditNodeId = useCanvasStore((s) => s.setActiveEditNodeId);
  const clearHighlights = useCanvasStore((s) => s.clearHighlights);
  const connectionStatus = useCollaborationStore((s) => s.connectionStatus);
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
    activeGroup,
    activeGroupTableIds,
    handleBackToAll,
    handleNavigateToCodeFromDiagram,
    handleNavigateToTableFromEditor,
    handleSharedSchemaDraftPositionsChange,
    handleViewGroup: handleViewGroupState,
    handleWorkModeChange,
    previewReadOnlyMessage,
    sharedDraftOverlayGraph,
    showOverlay,
    workModeRuntimeState,
  } = useDiagramPageRuntimeState({
    activeGroupId,
    canEdit,
    collaborationSetupErrorKind,
    diagram,
    diagramId,
    dictionaryDialogOpen,
    groups,
    initialLoadComplete,
    isLoading,
    isPreviewMode,
    leftPanel,
    persistedEdges,
    persistedNodes,
    previewSyncStatus,
    projectId,
    setActiveGroupId,
    setDiagramName,
    setDictionaryDialogOpen,
    setDslPreviewPositionOverrides,
    setDslPreviewState,
    setInitialLoadComplete,
    setLeftPanel,
    setTableCodeRevealRequest,
    setTableFocusRequest,
    setWorkMode,
    setWorkModeHydrated,
    sharedSchemaDraft,
    storeHasRenderableGraph,
    t,
    teamId,
    workModeCapabilities,
    workMode,
    workModeHydrated,
    writePreviewPositionOverrides,
  });

  /**
   * 현재 포커스가 캔버스 undo 단축키를 가로채면 안 되는 입력 필드인지 확인한다.
   *
   * @returns 텍스트 입력 계열 포커스면 true
   */
  const shouldBypassCanvasUndo = () => isTextInputLikeTarget(document.activeElement);

  const handleViewGroup = useCallback(
    (groupId: string) => {
      setActiveEditNodeId(null);
      clearHighlights();
      handleViewGroupState(groupId);
    },
    [clearHighlights, handleViewGroupState, setActiveEditNodeId],
  );

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
                <div className="h-screen flex flex-col">
                  <Header
                    diagramName={diagramName}
                    onSave={workModeRuntimeState.canPersistDiagramSave ? handleSave : undefined}
                    saving={isDiagramSavePending}
                    connectionStatus={connectionStatus}
                    canEdit={workModeRuntimeState.headerCanEdit}
                    readOnlyMessage={
                      !workModeRuntimeState.headerCanEdit ? previewReadOnlyMessage : undefined
                    }
                    diagramAccessory={
                      <div className="flex items-center gap-3">
                        <DiagramWorkModeSwitcher
                          mode={workMode}
                          onModeChange={handleWorkModeChange}
                        />
                        <DiagramCollaboratorsBar />
                      </div>
                    }
                  />
                  {(workModeRuntimeState.showPreviewSyncBanner || collaborationSetupErrorKind) && (
                    <DiagramSyncStatusBanner
                      connectionStatus={connectionStatus}
                      setupErrorKind={collaborationSetupErrorKind}
                      onRetry={
                        collaborationSetupErrorKind === 'authoritative-bootstrap-required'
                          ? retryCollaborationSetup
                          : undefined
                      }
                    />
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
                            onPreviewPositionOverridesChange={
                              handleSharedSchemaDraftPositionsChange
                            }
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
                            registerBeforeCodeModeSnapshotPersist={
                              workModeCapabilities.persistCodeDraft
                                ? registerBeforeCodeModeSnapshotPersist
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
                          canEdit={workModeRuntimeState.effectiveCodeCanEdit}
                          canOpenDictionary={
                            !!dictionaryContextSetId &&
                            workModeRuntimeState.canOpenDictionaryManagement
                          }
                          onOpenDictionary={
                            dictionaryContextSetId &&
                            workModeRuntimeState.canOpenDictionaryManagement
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
                              dictionaryContextSetId &&
                              workModeRuntimeState.canOpenDictionaryManagement
                                ? () => setDictionaryDialogOpen(true)
                                : undefined
                            }
                            canEdit={workModeRuntimeState.effectiveCanvasCanEdit}
                            activeGroupId={activeGroupId}
                            activeGroupName={activeGroup?.label}
                            activeGroupTableIds={activeGroupTableIds}
                            codeEditorActive={leftPanel === 'code'}
                            onToggleCodeEditor={
                              workModeRuntimeState.canToggleCodeEditor
                                ? handleToggleCodeEditor
                                : undefined
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
      </DocumentMutationSessionProvider>
    </ReactFlowProvider>
  );
}
