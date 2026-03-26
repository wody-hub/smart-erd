import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
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
  type SharedSchemaDraftSnapshot,
} from '@/lib/shared-schema-draft';
import {
  resolveDiagramWorkModeRuntimeState,
  loadDiagramWorkMode,
  saveDiagramWorkMode,
} from '@/lib/diagram-work-mode';
import type { DiagramWorkModeCapabilities } from '@/lib/diagram-work-mode';
import { buildPreviewDraftOverlayGraph } from '@/lib/preview-draft-merge';
import { buildParseResultFromSharedSchemaDraft } from '@/lib/shared-schema-draft';
import type { ERDEdge, TableNode } from '@/types/erd';

type GroupSummary = {
  id: string;
  label: string;
  tableIds: string[];
};

type DiagramSummary = {
  name: string;
  content?: string | null;
};

type UseDiagramPageRuntimeStateParams = {
  activeGroupId: string | null;
  canEdit: boolean;
  collaborationSetupErrorKind: string | null;
  diagram: DiagramSummary | undefined;
  diagramId: string | undefined;
  dictionaryDialogOpen: boolean;
  groups: GroupSummary[];
  initialLoadComplete: boolean;
  isLoading: boolean;
  isPreviewMode: boolean;
  leftPanel: 'sidebar' | 'code';
  persistedEdges: ERDEdge[];
  persistedNodes: TableNode[];
  previewSyncStatus: PreviewSyncStatus;
  projectId: string | undefined;
  setActiveGroupId: Dispatch<SetStateAction<string | null>>;
  setDiagramName: Dispatch<SetStateAction<string>>;
  setDictionaryDialogOpen: Dispatch<SetStateAction<boolean>>;
  setDslPreviewPositionOverrides: Dispatch<SetStateAction<DiagramPreviewPositionRecord>>;
  setDslPreviewState: Dispatch<SetStateAction<DslPreviewCanvasState | null>>;
  setInitialLoadComplete: Dispatch<SetStateAction<boolean>>;
  setLeftPanel: Dispatch<SetStateAction<'sidebar' | 'code'>>;
  setTableCodeRevealRequest: Dispatch<SetStateAction<CodeEditorTableRevealRequest | null>>;
  setTableFocusRequest: Dispatch<SetStateAction<CodeEditorTableFocusRequest | null>>;
  setWorkMode: Dispatch<SetStateAction<DiagramWorkMode>>;
  setWorkModeHydrated: Dispatch<SetStateAction<boolean>>;
  sharedSchemaDraft: SharedSchemaDraftSnapshot | null;
  storeHasRenderableGraph: boolean;
  t: TFunction;
  teamId: string | undefined;
  workModeCapabilities: DiagramWorkModeCapabilities;
  workMode: DiagramWorkMode;
  workModeHydrated: boolean;
  writePreviewPositionOverrides: (positions: DiagramPreviewPositionRecord) => void;
};

type UseDiagramPageRuntimeStateResult = {
  activeGroup: GroupSummary | null;
  activeGroupTableIds: Set<string> | null;
  handleBackToAll: () => void;
  handleNavigateToCodeFromDiagram: (request: CodeEditorTableRevealRequest) => void;
  handleNavigateToTableFromEditor: (request: CodeEditorTableFocusRequest) => void;
  handleSharedSchemaDraftPositionsChange: (nextPositions: DiagramPreviewPositionRecord) => void;
  handleViewGroup: (groupId: string) => void;
  handleWorkModeChange: (nextMode: DiagramWorkMode) => void;
  previewReadOnlyMessage: string | undefined;
  sharedDraftOverlayGraph: ReturnType<typeof buildPreviewDraftOverlayGraph> | null;
  showOverlay: boolean;
  workModeRuntimeState: ReturnType<typeof resolveDiagramWorkModeRuntimeState>;
};

export function useDiagramPageRuntimeState({
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
}: UseDiagramPageRuntimeStateParams): UseDiagramPageRuntimeStateResult {
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

  const diagramHasContent = !!diagram?.content;
  const isPersistedEmptyDiagram = !diagramHasContent;
  const showOverlay = !isPersistedEmptyDiagram && !storeHasRenderableGraph && !initialLoadComplete;

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

  const handleViewGroup = useCallback(
    (groupId: string) => {
      setActiveGroupId(groupId);
      setLeftPanel('sidebar');
    },
    [setActiveGroupId, setLeftPanel],
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

  const handleWorkModeChange = useCallback((nextMode: DiagramWorkMode) => {
    setWorkMode(nextMode);
  }, [setWorkMode]);

  useEffect(() => {
    setWorkModeHydrated(false);
    setWorkMode(loadDiagramWorkMode({ teamId, projectId, diagramId }));
    setWorkModeHydrated(true);
  }, [diagramId, projectId, setWorkMode, setWorkModeHydrated, teamId]);

  useEffect(() => {
    if (!workModeHydrated) {
      return;
    }
    saveDiagramWorkMode({ teamId, projectId, diagramId }, workMode);
  }, [diagramId, projectId, teamId, workMode, workModeHydrated]);

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
    teamId,
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
    if (diagram) {
      setDiagramName(diagram.name);
    }
  }, [diagram, setDiagramName]);

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
    activeGroup,
    activeGroupTableIds,
    handleBackToAll,
    handleNavigateToCodeFromDiagram,
    handleNavigateToTableFromEditor,
    handleSharedSchemaDraftPositionsChange,
    handleViewGroup,
    handleWorkModeChange,
    previewReadOnlyMessage,
    sharedDraftOverlayGraph,
    showOverlay,
    workModeRuntimeState,
  };
}
