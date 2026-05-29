import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { persistDiagramYdocSnapshot, requestWsTicket } from '@/api/diagramApi';
import { YjsProvider } from '@/collaboration/YjsProvider';
import { useScreenDesignDocumentRuntime } from '@/collaboration/channel/document/use-screen-design-document-runtime';
import { useScreenDesignRuntimeBootstrap } from '@/collaboration/channel/document/use-screen-design-runtime-bootstrap';
import type { DocumentCheckpointReader } from '@/collaboration/core/contracts/document-checkpoint';
import type { DocumentMutationSession } from '@/collaboration/core/session/document-mutation-session';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import type { DiagramDetail } from '@/types/diagram';
import type { DocumentChangeSummary } from '@/types/collaboration';
import type { DocumentBootstrapPayload } from '@/types/document';

interface UseScreenDesignSessionParams {
  teamId: string;
  projectId: string;
  diagramId: string;
  documentDetail: DiagramDetail | undefined;
  documentBootstrap: DocumentBootstrapPayload | undefined;
}

interface UseScreenDesignSessionResult {
  collaborationReady: boolean;
  collaborationError: boolean;
  retryCollaborationSetup: () => void;
  savePending: boolean;
  handleSave: () => void;
  sharedDocumentEngine: YjsSharedDocumentEngine | null;
  documentMutationSession: DocumentMutationSession | null;
  documentCheckpointReader: DocumentCheckpointReader | null;
  projectionVersion: number;
  lastDocumentChangeSummary: DocumentChangeSummary | null;
}

/**
 * 화면기획 문서의 최소 협업 세션을 조립한다.
 *
 * @param params 화면기획 협업 세션 파라미터
 * @returns 협업 준비 상태와 runtime 의존성
 */
export function useScreenDesignSession({
  teamId,
  projectId,
  diagramId,
  documentDetail,
  documentBootstrap,
}: UseScreenDesignSessionParams): UseScreenDesignSessionResult {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [setupAttempt, setSetupAttempt] = useState(0);
  const [collaborationReady, setCollaborationReady] = useState(false);
  const [collaborationError, setCollaborationError] = useState(false);
  const seededSetupSignatureRef = useRef<string | null>(null);
  const snapshotAvailableRef = useRef(false);
  const localBootstrapReadyRef = useRef(false);

  useEffect(() => {
    localBootstrapReadyRef.current = false;
    seededSetupSignatureRef.current = null;
  }, [diagramId, setupAttempt]);

  useEffect(() => {
    snapshotAvailableRef.current = documentBootstrap?.snapshotAvailable === true;
    if (documentBootstrap?.snapshotAvailable) {
      localBootstrapReadyRef.current = false;
    }
  }, [documentBootstrap?.snapshotAvailable]);

  const bootstrapQueryKey = useMemo(
    () => queryKeys.diagrams.bootstrap(teamId, projectId, diagramId),
    [diagramId, projectId, teamId],
  );
  const {
    collaborationBootstrap,
    resolvedSessionBootstrap,
    sharedDocumentEngine,
    snapshotCodec,
    documentAdapter,
  } = useScreenDesignRuntimeBootstrap(documentDetail, documentBootstrap, setupAttempt);
  const {
    documentMutationSession,
    documentCheckpointReader,
    projectionVersion,
    lastDocumentChangeSummary,
  } = useScreenDesignDocumentRuntime({
    documentDetail,
    resolvedSessionBootstrap,
    sharedDocumentEngine,
    snapshotCodec,
    documentAdapter,
  });

  useEffect(() => {
    if (
      !teamId ||
      !projectId ||
      !diagramId ||
      !documentBootstrap ||
      !collaborationBootstrap ||
      !sharedDocumentEngine ||
      !snapshotCodec
    ) {
      return;
    }
    if (documentBootstrap.snapshotAvailable) {
      return;
    }

    const seedSignature = [teamId, projectId, diagramId, setupAttempt].join(':');
    if (seededSetupSignatureRef.current === seedSignature) {
      return;
    }
    seededSetupSignatureRef.current = seedSignature;

    documentAdapter.applyBootstrapToDoc(
      sharedDocumentEngine.getDocument(),
      collaborationBootstrap,
      'bootstrap',
    );
    localBootstrapReadyRef.current = true;
    setCollaborationReady(true);
    setCollaborationError(false);

    void persistDiagramYdocSnapshot(
      teamId,
      projectId,
      diagramId,
      collaborationBootstrap.contentRevision,
      snapshotCodec.encodeForPersistence(sharedDocumentEngine.exportSnapshot()),
      { persistOnlyIfMissing: true },
    )
      .then(() => {
        queryClient.setQueryData<DocumentBootstrapPayload | undefined>(
          bootstrapQueryKey,
          (currentBootstrap) =>
            currentBootstrap
              ? {
                  ...currentBootstrap,
                  snapshotAvailable: true,
                }
              : currentBootstrap,
        );
      })
      .catch((error) => {
        console.warn('[useScreenDesignSession] screen spec snapshot seed failed', error);
      });
  }, [
    bootstrapQueryKey,
    collaborationBootstrap,
    diagramId,
    documentAdapter,
    documentBootstrap,
    projectId,
    queryClient,
    setupAttempt,
    sharedDocumentEngine,
    snapshotCodec,
    teamId,
  ]);

  useEffect(() => {
    if (!diagramId || !sharedDocumentEngine) {
      return;
    }

    let cancelled = false;
    setCollaborationError(false);
    setCollaborationReady(localBootstrapReadyRef.current);

    const provider = new YjsProvider(sharedDocumentEngine.getDocument(), {
      diagramId,
      getTicket: () => requestWsTicket(diagramId),
    });

    provider.onSyncStateChange = (synced) => {
      if (!synced || cancelled) {
        return;
      }
      setCollaborationError(false);
      localBootstrapReadyRef.current = true;
      setCollaborationReady(true);
    };

    provider.onConnectionStatusChange = (status) => {
      if (cancelled) {
        return;
      }
      if (status === 'connected') {
        setCollaborationError(false);
      }
    };

    provider.onConnectionIssueDetected = (issue) => {
      if (cancelled) {
        return;
      }
      if (!issue) {
        setCollaborationError(false);
        return;
      }
      if (snapshotAvailableRef.current && !provider.isSynced()) {
        setCollaborationError(true);
        return;
      }
      setCollaborationError(true);
      if (!localBootstrapReadyRef.current) {
        setCollaborationReady(false);
      }
    };

    provider.connect();

    return () => {
      cancelled = true;
      provider.onConnectionIssueDetected = null;
      provider.onConnectionStatusChange = null;
      provider.onSyncStateChange = null;
      provider.destroy();
    };
  }, [diagramId, sharedDocumentEngine, setupAttempt]);

  const retryCollaborationSetup = useCallback(() => {
    localBootstrapReadyRef.current = false;
    seededSetupSignatureRef.current = null;
    setCollaborationError(false);
    setCollaborationReady(false);
    setSetupAttempt((currentAttempt) => currentAttempt + 1);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!documentDetail || !sharedDocumentEngine || !snapshotCodec) {
        throw new Error(t('screenSpec.toast.saveUnavailable'));
      }
      const snapshot =
        documentCheckpointReader?.getLatestCheckpoint().snapshot ??
        snapshotCodec.encodeForPersistence(sharedDocumentEngine.exportSnapshot());
      await persistDiagramYdocSnapshot(
        teamId,
        projectId,
        diagramId,
        documentDetail.contentRevision,
        snapshot,
      );
    },
    onSuccess: () => {
      queryClient.setQueryData<DiagramDetail | undefined>(
        queryKeys.diagrams.detail(teamId, projectId, diagramId),
        (current) =>
          current
            ? {
                ...current,
                hasYdocSnapshot: true,
              }
            : current,
      );
      queryClient.setQueryData<DocumentBootstrapPayload | undefined>(
        bootstrapQueryKey,
        (currentBootstrap) =>
          currentBootstrap
            ? {
                ...currentBootstrap,
                snapshotAvailable: true,
              }
            : currentBootstrap,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.diagrams.detail(teamId, projectId, diagramId),
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: bootstrapQueryKey,
        exact: true,
      });
      toast.success(t('screenSpec.toast.saved'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t('screenSpec.toast.saveFailed')));
    },
  });

  return {
    collaborationReady,
    collaborationError,
    retryCollaborationSetup,
    savePending: saveMutation.isPending,
    handleSave: () => saveMutation.mutate(),
    sharedDocumentEngine,
    documentMutationSession,
    documentCheckpointReader,
    projectionVersion,
    lastDocumentChangeSummary,
  };
}
