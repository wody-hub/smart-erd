import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import type { PreviewSyncStatus } from '@/collaboration/core/collaboration-preview-sync-status';
import type {
  CodeEditorTableFocusRequest,
  CodeEditorTableRevealRequest,
} from '@/lib/code-editor-table-navigation';
import type { DiagramPreviewPositionRecord } from '@/lib/diagram-code-draft';
import type { DslPreviewCanvasState } from '@/lib/dsl-preview-graph';
import {
  buildPreviewEdgePresentationEntries,
  buildPreviewGraphFromDslParsedSchema,
  buildPreviewLayoutSourceEntries,
} from '@/lib/dsl-preview-graph';
import type { DiagramWorkMode } from '@/lib/diagram-work-mode';
import {
  hasSharedSchemaDraftContent,
  type SharedSchemaDraftSnapshot,
} from '@/lib/shared-schema-draft';
import {
  resolveDiagramWorkModeRuntimeState,
} from '@/lib/diagram-work-mode';
import type { DiagramWorkModeCapabilities } from '@/lib/diagram-work-mode';
import { buildPreviewDraftOverlayGraph } from '@/lib/preview-draft-merge';
import { buildParseResultFromSharedSchemaDraft } from '@/lib/shared-schema-draft';
import type { ERDEdge, TableNode } from '@/types/erd';

/**
 * persisted 캔버스에서 shared draft overlay를 허용할 최대 테이블 수.
 *
 * 큰 다이어그램에서 overlay를 전체 렌더하면 persisted 노드와 draft overlay 노드가
 * 거의 두 배로 겹쳐져 React Flow startup과 상호작용이 급격히 느려진다.
 */
const MAX_VISIBLE_SHARED_DRAFT_OVERLAY_TABLES = 80;

/**
 * persisted 캔버스에서 shared draft overlay를 허용할 최대 컬럼 수.
 *
 * split handle 레이아웃 기준 컬럼 수가 많을수록 handle/measurement 비용이 급격히 커진다.
 */
const MAX_VISIBLE_SHARED_DRAFT_OVERLAY_COLUMNS = 1000;

type GroupSummary = {
  id: string;
  label: string;
  tableIds: string[];
};

type DiagramSummary = {
  name: string;
  content?: string | null;
  hasYdocSnapshot?: boolean;
  dictionarySetId?: number | null;
  dictionarySetName?: string | null;
};

type UseDiagramPageRuntimeStateParams = {
  beforeViewGroup?: () => void;
  canEdit: boolean;
  collaborationSetupErrorKind: string | null;
  diagram: DiagramSummary | undefined;
  diagramId: string | undefined;
  dictionaryDialogOpen: boolean;
  groups: GroupSummary[];
  isLoading: boolean;
  isPreviewMode: boolean;
  leftPanel: 'sidebar' | 'code';
  persistedEdges: ERDEdge[];
  persistedNodes: TableNode[];
  previewSyncStatus: PreviewSyncStatus;
  projectId: string | undefined;
  setDictionaryDialogOpen: (open: boolean) => void;
  setLeftPanel: (panel: 'sidebar' | 'code') => void;
  sharedSchemaDraft: SharedSchemaDraftSnapshot | null;
  storeHasRenderableGraph: boolean;
  toggleCodeEditorPanel?: () => void;
  t: TFunction;
  workModeCapabilities: DiagramWorkModeCapabilities;
  workMode: DiagramWorkMode;
  writePreviewPositionOverrides: (positions: DiagramPreviewPositionRecord) => void;
};

type UseDiagramPageRuntimeStateResult = {
  activeGroupId: string | null;
  activeGroup: GroupSummary | null;
  activeGroupTableIds: Set<string> | null;
  canOpenDictionary: boolean;
  captureCodeEditorPreviewState: boolean;
  codeDraftPersistEnabled: boolean;
  delayCodeDraftHydration: boolean;
  diagramName: string;
  dictionaryContextName?: string;
  dictionaryContextSetId: string;
  dslPreviewPositionOverrides: DiagramPreviewPositionRecord;
  dslPreviewState: DslPreviewCanvasState | null;
  handleBackToAll: () => void;
  handleDslPreviewStateChange: (nextState: DslPreviewCanvasState | null) => void;
  handleNavigateToCodeFromDiagram: (request: CodeEditorTableRevealRequest) => void;
  handleNavigateToTableFromEditor: (request: CodeEditorTableFocusRequest) => void;
  handleOpenDictionary: (() => void) | undefined;
  handleSharedSchemaDraftPositionsChange: (nextPositions: DiagramPreviewPositionRecord) => void;
  handleToggleCodeEditor: (() => void) | undefined;
  handleViewGroup: (groupId: string) => void;
  previewReadOnlyMessage: string | undefined;
  renderDictionaryDialog: boolean;
  sharedDraftOverlayGraph: ReturnType<typeof buildPreviewDraftOverlayGraph> | null;
  sharedDraftOverlaySuppressed: boolean;
  showOverlay: boolean;
  showPreviewCanvas: boolean;
  tableCodeRevealRequest: CodeEditorTableRevealRequest | null;
  tableFocusRequest: CodeEditorTableFocusRequest | null;
  workModeRuntimeState: ReturnType<typeof resolveDiagramWorkModeRuntimeState>;
};

export function useDiagramPageRuntimeState({
  beforeViewGroup,
  canEdit,
  collaborationSetupErrorKind,
  diagram,
  diagramId,
  dictionaryDialogOpen,
  groups,
  isLoading,
  isPreviewMode,
  leftPanel,
  persistedEdges,
  persistedNodes,
  previewSyncStatus,
  projectId,
  setDictionaryDialogOpen,
  setLeftPanel,
  sharedSchemaDraft,
  storeHasRenderableGraph,
  toggleCodeEditorPanel,
  t,
  workModeCapabilities,
  workMode,
  writePreviewPositionOverrides,
}: UseDiagramPageRuntimeStateParams): UseDiagramPageRuntimeStateResult {
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [dslPreviewState, setDslPreviewState] = useState<DslPreviewCanvasState | null>(null);
  const [dslPreviewPositionOverrides, setDslPreviewPositionOverrides] =
    useState<DiagramPreviewPositionRecord>({});
  const [tableFocusRequest, setTableFocusRequest] = useState<CodeEditorTableFocusRequest | null>(
    null,
  );
  const [tableCodeRevealRequest, setTableCodeRevealRequest] =
    useState<CodeEditorTableRevealRequest | null>(null);
  const latchKey = `${projectId}:${diagramId}`;
  const prevLatchKeyRef = useRef(latchKey);
  const prevPreviewSyncStatusRef = useRef<PreviewSyncStatus>('inactive');
  const skipLatchEvalRef = useRef(false);

  const activeGroup = activeGroupId
    ? (groups.find((group) => group.id === activeGroupId) ?? null)
    : null;

  const activeGroupTableIds = useMemo(
    () => (activeGroup ? new Set(activeGroup.tableIds) : null),
    [activeGroup],
  );
  const dictionaryContextSetId = diagram?.dictionarySetId ? String(diagram.dictionarySetId) : '';
  const dictionaryContextName = diagram?.dictionarySetName ?? undefined;

  const diagramHasContent = !!diagram?.content;
  const isPersistedEmptyDiagram = !diagramHasContent;
  const showOverlay = !isPersistedEmptyDiagram && !storeHasRenderableGraph && !initialLoadComplete;
  const diagramName = diagram?.name ?? '';
  const codeDraftPersistEnabled = workModeCapabilities.persistCodeDraft;
  const delayCodeDraftHydration =
    codeDraftPersistEnabled && !!diagram?.hasYdocSnapshot && isPreviewMode;
  const showPreviewCanvas = workModeCapabilities.canvasSource === 'preview';
  const captureCodeEditorPreviewState = showPreviewCanvas;
  const renderDictionaryDialog = !!dictionaryContextSetId;
  const hasSharedDraftContent = hasSharedSchemaDraftContent(sharedSchemaDraft);
  const persistedColumnCount = useMemo(
    () => persistedNodes.reduce((sum, node) => sum + node.data.columns.length, 0),
    [persistedNodes],
  );
  const sharedDraftOverlaySuppressed =
    workModeCapabilities.canvasSource !== 'preview' &&
    !activeGroupId &&
    hasSharedDraftContent &&
    (persistedNodes.length > MAX_VISIBLE_SHARED_DRAFT_OVERLAY_TABLES ||
      persistedColumnCount > MAX_VISIBLE_SHARED_DRAFT_OVERLAY_COLUMNS);

  const sharedDraftOverlayGraph = useMemo(() => {
    if (workModeCapabilities.canvasSource === 'preview' || activeGroupId) {
      return null;
    }
    if (!sharedSchemaDraft) {
      return null;
    }
    if (sharedDraftOverlaySuppressed) {
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
    sharedDraftOverlaySuppressed,
    workModeCapabilities.canvasSource,
  ]);

  const workModeRuntimeState = useMemo(
    () =>
      resolveDiagramWorkModeRuntimeState({
        mode: workMode,
        capabilities: workModeCapabilities,
        canEdit,
        isAuthoritativeBootstrapBlocked:
          collaborationSetupErrorKind === 'authoritative-bootstrap-required',
        isPersistedPreviewMode: isPreviewMode,
        hasActiveGroupView: !!activeGroupId,
      }),
    [
      activeGroupId,
      canEdit,
      collaborationSetupErrorKind,
      isPreviewMode,
      workMode,
      workModeCapabilities,
    ],
  );

  const previewReadOnlyMessage = isPreviewMode
    ? t('diagram.previewSync.headerReadonly')
    : undefined;
  const canOpenDictionary =
    !!dictionaryContextSetId && workModeRuntimeState.canOpenDictionaryManagement;
  const handleOpenDictionary = useMemo(() => {
    if (!canOpenDictionary) {
      return undefined;
    }
    return () => setDictionaryDialogOpen(true);
  }, [canOpenDictionary, setDictionaryDialogOpen]);

  const handleToggleCodeEditor = useMemo(() => {
    if (!workModeRuntimeState.canToggleCodeEditor || !toggleCodeEditorPanel) {
      return undefined;
    }
    return () => toggleCodeEditorPanel();
  }, [toggleCodeEditorPanel, workModeRuntimeState.canToggleCodeEditor]);

  const handleViewGroup = useCallback(
    (groupId: string) => {
      beforeViewGroup?.();
      setActiveGroupId(groupId);
      setLeftPanel('sidebar');
    },
    [beforeViewGroup, setActiveGroupId, setLeftPanel],
  );

  const handleBackToAll = useCallback(() => {
    setActiveGroupId(null);
  }, [setActiveGroupId]);

  const handleNavigateToTableFromEditor = useCallback(
    (request: CodeEditorTableFocusRequest) => {
      setActiveGroupId(null);
      setTableFocusRequest(request);
    },
    [setActiveGroupId, setTableFocusRequest],
  );

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
    [
      setLeftPanel,
      setTableCodeRevealRequest,
      workModeCapabilities.forcedLeftPanel,
      workModeCapabilities.showCodePanel,
    ],
  );

  const handleSharedSchemaDraftPositionsChange = useCallback(
    (nextPositions: DiagramPreviewPositionRecord) => {
      setDslPreviewPositionOverrides(nextPositions);
      writePreviewPositionOverrides(nextPositions);
    },
    [setDslPreviewPositionOverrides, writePreviewPositionOverrides],
  );

  const handleDslPreviewStateChange = useCallback((nextState: DslPreviewCanvasState | null) => {
    setDslPreviewState(nextState);
  }, []);

  useEffect(() => {
    setDslPreviewPositionOverrides(sharedSchemaDraft?.positions ?? {});
  }, [setDslPreviewPositionOverrides, sharedSchemaDraft]);

  useEffect(() => {
    setDslPreviewPositionOverrides({});
    setTableFocusRequest(null);
    setTableCodeRevealRequest(null);
  }, [
    diagramId,
    projectId,
    setDslPreviewPositionOverrides,
    setTableCodeRevealRequest,
    setTableFocusRequest,
  ]);

  useEffect(() => {
    if (
      workModeCapabilities.forcedLeftPanel &&
      leftPanel !== workModeCapabilities.forcedLeftPanel
    ) {
      setLeftPanel(workModeCapabilities.forcedLeftPanel);
    }
  }, [leftPanel, setLeftPanel, workModeCapabilities.forcedLeftPanel]);

  useEffect(() => {
    if (!workModeRuntimeState.canOpenDictionaryManagement && dictionaryDialogOpen) {
      setDictionaryDialogOpen(false);
    }
  }, [
    dictionaryDialogOpen,
    setDictionaryDialogOpen,
    workModeRuntimeState.canOpenDictionaryManagement,
  ]);

  useEffect(() => {
    if (workModeCapabilities.canvasSource !== 'preview') {
      setDslPreviewState(null);
    }
  }, [setDslPreviewState, workModeCapabilities.canvasSource]);

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

    if (storeHasRenderableGraph || isPersistedEmptyDiagram) {
      setInitialLoadComplete(true);
    }
  }, [
    diagram,
    isLoading,
    isPersistedEmptyDiagram,
    latchKey,
    setInitialLoadComplete,
    storeHasRenderableGraph,
  ]);

  useEffect(() => {
    if (activeGroupId && !groups.some((group) => group.id === activeGroupId)) {
      setActiveGroupId(null);
      toast.info(t('erd.group.toast.groupDeleted'));
    }
  }, [activeGroupId, groups, setActiveGroupId, t]);

  return {
    activeGroupId,
    activeGroup,
    activeGroupTableIds,
    canOpenDictionary,
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
    handleOpenDictionary,
    handleSharedSchemaDraftPositionsChange,
    handleToggleCodeEditor,
    handleViewGroup,
    previewReadOnlyMessage,
    renderDictionaryDialog,
    sharedDraftOverlayGraph,
    sharedDraftOverlaySuppressed,
    showOverlay,
    showPreviewCanvas,
    tableCodeRevealRequest,
    tableFocusRequest,
    workModeRuntimeState,
  };
}
