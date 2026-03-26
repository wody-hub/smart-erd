import { useCallback, useEffect, useMemo, useRef } from 'react';
import { fetchDiagram, fetchDiagramBootstrap } from '@/api/diagramApi';
import { useDiagramCollaborationSession } from '@/collaboration/channel/diagram/use-diagram-collaboration-session';
import { useDiagramDocumentPersistence } from '@/collaboration/channel/diagram/use-diagram-document-persistence';
import { useDocumentPageHost } from '@/collaboration/core/session/use-document-page-host';
import { queryKeys } from '@/constants/query-keys';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import type { DiagramDetail } from '@/types/diagram';
import {
  ERD_DOCUMENT_ENGINE_ID,
  ERD_DOCUMENT_PLUGIN_ID,
} from '@/collaboration/plugins/erd/erd-document-plugin';

interface UseDiagramDocumentSessionParams {
  teamId: string | undefined;
  projectId: string | undefined;
  diagramId: string | undefined;
  enableCodeModeDraftPersist: boolean;
}

interface UseDiagramDocumentSessionResult {
  documentBootstrap: ReturnType<typeof useDocumentPageHost<DiagramDetail>>['documentBootstrap'];
  diagram: DiagramDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  providerRef: ReturnType<typeof useDiagramCollaborationSession>['providerRef'];
  isPreviewMode: boolean;
  previewSyncStatus: ReturnType<typeof useDiagramCollaborationSession>['previewSyncStatus'];
  collaborationSetupErrorKind: ReturnType<
    typeof useDiagramCollaborationSession
  >['collaborationSetupErrorKind'];
  retryCollaborationSetup: ReturnType<
    typeof useDiagramCollaborationSession
  >['retryCollaborationSetup'];
  documentMutationSession: ReturnType<
    typeof useDiagramCollaborationSession
  >['documentMutationSession'];
  diagramPersistenceSession: ReturnType<
    typeof useDiagramCollaborationSession
  >['diagramPersistenceSession'];
  handleSave: ReturnType<typeof useDiagramDocumentPersistence>['handleSave'];
  persistPublishedDiagramNow: ReturnType<
    typeof useDiagramDocumentPersistence
  >['persistPublishedDiagramNow'];
  isDiagramSavePending: ReturnType<typeof useDiagramDocumentPersistence>['isDiagramSavePending'];
  codeModeDraftPersistStatus: ReturnType<
    typeof useDiagramDocumentPersistence
  >['codeModeDraftPersistStatus'];
  codeModeDraftPersistedAt: ReturnType<
    typeof useDiagramDocumentPersistence
  >['codeModeDraftPersistedAt'];
  scheduleCodeModeSnapshotPersist: ReturnType<
    typeof useDiagramDocumentPersistence
  >['scheduleCodeModeSnapshotPersist'];
  resetCodeModeSnapshotPersistState: ReturnType<
    typeof useDiagramDocumentPersistence
  >['resetCodeModeSnapshotPersistState'];
  registerBeforeCodeModeSnapshotPersist: ReturnType<
    typeof useDiagramDocumentPersistence
  >['registerBeforeCodeModeSnapshotPersist'];
}

export function useDiagramDocumentSession({
  teamId,
  projectId,
  diagramId,
  enableCodeModeDraftPersist,
}: UseDiagramDocumentSessionParams): UseDiagramDocumentSessionResult {
  const ydoc = useCanvasStore((state) => state.ydoc);
  const beforeDestroyYDocRef = useRef<(() => void) | null>(null);
  const lastAutoRetrySignatureRef = useRef<string | null>(null);
  const handleBeforeDestroyYDoc = useCallback(() => {
    beforeDestroyYDocRef.current?.();
  }, []);
  const {
    documentBootstrap,
    documentDetail: diagram,
    isLoading,
    isError,
    retryDocumentSetup,
  } = useDocumentPageHost<DiagramDetail>({
    bootstrapQueryKey: queryKeys.diagrams.bootstrap(teamId!, projectId!, diagramId!),
    bootstrapQueryFn: () => fetchDiagramBootstrap(teamId!, projectId!, diagramId!),
    detailQueryKey: queryKeys.diagrams.detail(teamId!, projectId!, diagramId!),
    detailQueryFn: () => fetchDiagram(teamId!, projectId!, diagramId!),
    expectedPluginId: ERD_DOCUMENT_PLUGIN_ID,
    expectedEngineId: ERD_DOCUMENT_ENGINE_ID,
    enabled: !!teamId && !!projectId && !!diagramId,
  });
  const diagramDetailQueryKey = useMemo(
    () => queryKeys.diagrams.detail(teamId!, projectId!, diagramId!),
    [diagramId, projectId, teamId],
  );

  const {
    providerRef,
    isPreviewMode,
    previewSyncStatus,
    collaborationSetupErrorKind,
    retryCollaborationSetup: retryCollaborationRuntimeSetup,
    documentMutationSession,
    diagramPersistenceSession,
  } = useDiagramCollaborationSession(
    diagram,
    documentBootstrap,
    diagramId,
    teamId,
    projectId,
    handleBeforeDestroyYDoc,
  );
  const retryCollaborationSetup = useCallback(() => {
    void retryDocumentSetup().finally(() => {
      retryCollaborationRuntimeSetup();
    });
  }, [retryCollaborationRuntimeSetup, retryDocumentSetup]);

  useEffect(() => {
    if (
      collaborationSetupErrorKind !== 'authoritative-bootstrap-required' ||
      !teamId ||
      !projectId ||
      !diagramId
    ) {
      return;
    }

    const retrySignature = [
      teamId,
      projectId,
      diagramId,
      documentBootstrap?.revision ?? 'unknown',
      diagram?.contentRevision ?? 'unknown',
    ].join(':');
    if (lastAutoRetrySignatureRef.current === retrySignature) {
      return;
    }
    lastAutoRetrySignatureRef.current = retrySignature;
    retryCollaborationSetup();
  }, [
    collaborationSetupErrorKind,
    diagram?.contentRevision,
    diagramId,
    documentBootstrap?.revision,
    projectId,
    retryCollaborationSetup,
    teamId,
  ]);

  const {
    handleSave,
    persistPublishedDiagramNow,
    isDiagramSavePending,
    codeModeDraftPersistStatus,
    codeModeDraftPersistedAt,
    scheduleCodeModeSnapshotPersist,
    resetCodeModeSnapshotPersistState,
    registerBeforeCodeModeSnapshotPersist,
    flushCodeModeSnapshotBeforeDispose,
  } = useDiagramDocumentPersistence({
    enabledCodeModeDraftPersist: enableCodeModeDraftPersist,
    ydoc,
    diagramContentRevision: diagram?.contentRevision,
    diagramPersistenceSession,
    diagramDetailQueryKey,
  });
  beforeDestroyYDocRef.current = flushCodeModeSnapshotBeforeDispose;

  return {
    documentBootstrap,
    diagram,
    isLoading,
    isError,
    providerRef,
    isPreviewMode,
    previewSyncStatus,
    collaborationSetupErrorKind,
    retryCollaborationSetup,
    documentMutationSession,
    diagramPersistenceSession,
    handleSave,
    persistPublishedDiagramNow,
    isDiagramSavePending,
    codeModeDraftPersistStatus,
    codeModeDraftPersistedAt,
    scheduleCodeModeSnapshotPersist,
    resetCodeModeSnapshotPersistState,
    registerBeforeCodeModeSnapshotPersist,
  };
}
