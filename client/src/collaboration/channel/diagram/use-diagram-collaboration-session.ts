import { useCallback, useMemo, useState } from 'react';
import { YjsProvider } from '@/collaboration/YjsProvider';
import type { DiagramDocumentMutationSession as DocumentMutationSession } from './diagram-document-mutation-session';
import type { PreviewSyncStatus } from '@/collaboration/core/collaboration-preview-sync-status';
import { useSnapshotCompaction } from '@/hooks/useSnapshotCompaction';
import type { DiagramDetail } from '@/types/diagram';
import type { DocumentBootstrapPayload } from '@/types/document';
import { DiagramDocumentPersistenceSession } from './diagram-document-persistence-session.js';
import { useDiagramCollaborationRuntime } from './use-diagram-collaboration-runtime.js';
import {
  useDiagramCollaborationProvider,
  type DiagramCollaborationSetupErrorKind,
} from './use-diagram-collaboration-provider.js';

interface UseDiagramCollaborationSessionReturn {
  providerRef: React.RefObject<YjsProvider | null>;
  isPreviewMode: boolean;
  previewSyncStatus: PreviewSyncStatus;
  documentMutationSession: DocumentMutationSession | null;
  diagramPersistenceSession: DiagramDocumentPersistenceSession | null;
  collaborationSetupErrorKind: DiagramCollaborationSetupErrorKind;
  retryCollaborationSetup: () => void;
}

export function useDiagramCollaborationSession(
  diagram: DiagramDetail | undefined,
  documentBootstrap: DocumentBootstrapPayload | undefined,
  diagramId: string | undefined,
  teamId: string | undefined,
  projectId: string | undefined,
  canEdit: boolean,
  beforeDestroyYDoc?: (() => void) | null,
): UseDiagramCollaborationSessionReturn {
  const [setupAttempt, setSetupAttempt] = useState(0);
  const retryCollaborationSetup = useCallback(() => {
    setSetupAttempt((attempt) => attempt + 1);
  }, []);
  const {
    collaborationBootstrap,
    previewSyncStatus,
    initYDoc,
    destroyYDoc,
    storeBridge,
    resetRuntimeState,
    createProviderLifecycle,
    handleProviderSetupFailed,
    sharedDocumentEngine,
    snapshotCodec,
    documentMutationSession,
    documentCheckpointReader,
    getHydratedSnapshot,
    getHydratedContentRevision,
    getRemoteHydrationGeneration,
  } = useDiagramCollaborationRuntime(diagram, documentBootstrap, setupAttempt, canEdit);
  const { providerRef, isPreviewMode, setupErrorKind } = useDiagramCollaborationProvider({
    collaborationBootstrap,
    sharedDocumentEngine,
    snapshotCodec,
    diagramId,
    teamId,
    projectId,
    initYDoc,
    destroyYDoc,
    beforeDestroyYDoc,
    resetCollaboration: storeBridge.resetCollaboration,
    resetRuntimeState,
    createProviderLifecycle,
    onSetupFailed: handleProviderSetupFailed,
    setupAttempt,
  });

  const diagramPersistenceSession = useMemo(
    () =>
      teamId && projectId && diagramId
        ? new DiagramDocumentPersistenceSession({
            teamId,
            projectId,
            diagramId,
            checkpointReader: documentCheckpointReader,
            isReady: () => documentMutationSession?.ready ?? false,
            getHydratedSnapshot,
            getHydratedContentRevision,
            getRemoteHydrationGeneration,
          })
        : null,
    [
      diagramId,
      documentCheckpointReader,
      documentMutationSession,
      getHydratedSnapshot,
      getHydratedContentRevision,
      getRemoteHydrationGeneration,
      projectId,
      teamId,
    ],
  );

  useSnapshotCompaction(
    providerRef,
    diagramId,
    () => diagramPersistenceSession?.getLatestCheckpoint() != null,
  );

  return {
    providerRef,
    isPreviewMode,
    previewSyncStatus,
    documentMutationSession,
    diagramPersistenceSession,
    collaborationSetupErrorKind: setupErrorKind,
    retryCollaborationSetup,
  };
}
