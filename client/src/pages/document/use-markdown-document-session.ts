import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { persistDiagramYdocSnapshot, requestWsTicket, saveDiagram } from '@/api/diagramApi';
import { YjsProvider } from '@/collaboration/YjsProvider';
import { useMarkdownDocumentRuntime } from '@/collaboration/channel/document/use-markdown-document-runtime';
import { useMarkdownRuntimeBootstrap } from '@/collaboration/channel/document/use-markdown-runtime-bootstrap';
import type { DocumentMutationSession } from '@/collaboration/core/session/document-mutation-session';
import { queryKeys } from '@/constants/query-keys';
import { parseMarkdownBuffer } from '@/lib/markdown';
import { buildSectionCommands } from '@/collaboration/plugins/markdown/markdown-section-projector';
import type { DiagramDetail } from '@/types/diagram';
import type { DocumentBootstrapPayload } from '@/types/document';

interface UseMarkdownDocumentSessionParams {
  teamId: string;
  projectId: string;
  diagramId: string;
  documentDetail: DiagramDetail | undefined;
  documentBootstrap: DocumentBootstrapPayload | undefined;
}

interface UseMarkdownDocumentSessionResult {
  buffer: string;
  setEditorBuffer: (nextBuffer: string) => void;
  dirty: boolean;
  lastSavedAt: string | null;
  savePending: boolean;
  collaborationReady: boolean;
  collaborationError: boolean;
  handleSave: () => void;
  retryCollaborationSetup: () => void;
  documentMutationSession: DocumentMutationSession | null;
}

/**
 * markdown 편집 버퍼와 Yjs collaboration runtime을 조합한다.
 */
export function useMarkdownDocumentSession({
  teamId,
  projectId,
  diagramId,
  documentDetail,
  documentBootstrap,
}: UseMarkdownDocumentSessionParams): UseMarkdownDocumentSessionResult {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  /** 현재 editor buffer */
  const [buffer, setBuffer] = useState('');
  /** 마지막 저장 완료 기준 buffer */
  const [lastSavedBuffer, setLastSavedBuffer] = useState('');
  /** 마지막 저장 시각 */
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  /** collaboration bootstrap 재시도 시퀀스 */
  const [setupAttempt, setSetupAttempt] = useState(0);
  /** collaboration runtime 활성화 여부 */
  const [collaborationReady, setCollaborationReady] = useState(false);
  /** collaboration setup 오류 여부 */
  const [collaborationError, setCollaborationError] = useState(false);
  /** 현재 setup attempt에서 snapshot seed를 이미 반영했는지 기록 */
  const seededSetupSignatureRef = useRef<string | null>(null);
  /** malformed snapshot 복구를 content revision별로 1회만 수행한다 */
  const repairedSnapshotSignatureRef = useRef<string | null>(null);
  /** provider 연결 시점의 snapshot 존재 여부 */
  const snapshotAvailableRef = useRef(false);
  /** 서버 기준 최신 직렬화 buffer */
  const loadedContentRef = useRef('');
  /** 이전 body 텍스트 — section-aware 커맨드 발행용 (render 유발 방지를 위해 ref 사용) */
  const prevBodyRef = useRef<string>('');

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
  } = useMarkdownRuntimeBootstrap(documentDetail, documentBootstrap, setupAttempt);
  const {
    documentMutationSession,
    documentCheckpointReader,
    subscribeDocumentChanges,
    readSerializedBuffer,
  } = useMarkdownDocumentRuntime({
    documentDetail,
    resolvedSessionBootstrap,
    sharedDocumentEngine,
    snapshotCodec,
    documentAdapter,
  });

  const dirty = buffer !== lastSavedBuffer;

  useEffect(() => {
    snapshotAvailableRef.current = documentBootstrap?.snapshotAvailable === true;
  }, [documentBootstrap?.snapshotAvailable]);

  useEffect(() => {
    loadedContentRef.current = documentDetail?.content ?? '';
  }, [documentDetail?.content]);

  useEffect(() => {
    if (!documentDetail) {
      return;
    }
    if (buffer !== lastSavedBuffer) {
      return;
    }
    const nextBuffer = documentDetail.content ?? '';
    setBuffer(nextBuffer);
    setLastSavedBuffer(nextBuffer);
    setLastSavedAt(documentDetail.updatedAt ?? null);
  }, [buffer, documentDetail, lastSavedBuffer]);

  useEffect(() => {
    if (!subscribeDocumentChanges) {
      return;
    }
    return subscribeDocumentChanges(() => {
      const serialized = readSerializedBuffer();
      prevBodyRef.current = parseMarkdownBuffer(serialized).body.replace(/\r\n/g, '\n');
      setBuffer(serialized);
    });
  }, [readSerializedBuffer, subscribeDocumentChanges]);

  useEffect(() => {
    if (
      !teamId ||
      !projectId ||
      !diagramId ||
      !documentDetail ||
      !documentBootstrap?.snapshotAvailable ||
      !sharedDocumentEngine ||
      !snapshotCodec ||
      !collaborationReady
    ) {
      return;
    }

    const repairSignature = `${diagramId}:${documentDetail.contentRevision}`;
    if (repairedSnapshotSignatureRef.current === repairSignature) {
      return;
    }

    const persistedFrontmatter = parseMarkdownBuffer(documentDetail.content ?? '').frontmatter;
    const currentFrontmatter = documentAdapter.readFrontmatter(sharedDocumentEngine.getDocument());
    const currentHasMalformedPlaceholder = hasMalformedFrontmatterPlaceholder(currentFrontmatter);
    const persistedHasMalformedPlaceholder = hasMalformedFrontmatterPlaceholder(persistedFrontmatter);
    if (!currentHasMalformedPlaceholder || persistedHasMalformedPlaceholder) {
      return;
    }

    repairedSnapshotSignatureRef.current = repairSignature;
    documentAdapter.replaceBuffer(
      sharedDocumentEngine.getDocument(),
      documentDetail.content ?? '',
      'bootstrap-repair',
    );
    setBuffer(readSerializedBuffer());
    void persistDiagramYdocSnapshot(
      teamId,
      projectId,
      diagramId,
      documentDetail.contentRevision,
      snapshotCodec.encodeForPersistence(sharedDocumentEngine.exportSnapshot()),
    ).catch((error) => {
      console.warn('[useMarkdownDocumentSession] markdown snapshot repair failed', error);
    });
  }, [
    collaborationReady,
    diagramId,
    documentAdapter,
    documentBootstrap?.snapshotAvailable,
    documentDetail,
    projectId,
    readSerializedBuffer,
    sharedDocumentEngine,
    snapshotCodec,
    teamId,
  ]);

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
    const doc = sharedDocumentEngine.getDocument();
    documentAdapter.applyBootstrapToDoc(doc, collaborationBootstrap, 'bootstrap');
    const seedBuffer = readSerializedBuffer();
    prevBodyRef.current = parseMarkdownBuffer(seedBuffer).body.replace(/\r\n/g, '\n');
    setBuffer(seedBuffer);
    setCollaborationReady(true);
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
        return queryClient.invalidateQueries({
          queryKey: bootstrapQueryKey,
          exact: true,
        });
      })
      .catch((error) => {
        console.warn('[useMarkdownDocumentSession] markdown snapshot seed failed', error);
      });
  }, [
    bootstrapQueryKey,
    collaborationBootstrap,
    diagramId,
    documentBootstrap,
    documentAdapter,
    projectId,
    queryClient,
    readSerializedBuffer,
    sharedDocumentEngine,
    snapshotCodec,
    setupAttempt,
    teamId,
  ]);

  useEffect(() => {
    if (!teamId || !projectId || !diagramId || !sharedDocumentEngine || !snapshotCodec) {
      return;
    }

    let cancelled = false;
    const alreadyHydrated =
      snapshotAvailableRef.current && readSerializedBuffer() === loadedContentRef.current;
    setCollaborationError(false);
    if (alreadyHydrated) {
      setCollaborationReady(true);
    } else if (snapshotAvailableRef.current) {
      setCollaborationReady(false);
    }

    const doc = sharedDocumentEngine.getDocument();
    const provider = new YjsProvider(doc, {
      diagramId,
      getTicket: () => requestWsTicket(diagramId),
    });

    provider.onSyncStateChange = (synced) => {
      if (!synced || cancelled) {
        return;
      }
      setCollaborationError(false);
      setCollaborationReady(true);
      const syncedBuffer = readSerializedBuffer();
      prevBodyRef.current = parseMarkdownBuffer(syncedBuffer).body.replace(/\r\n/g, '\n');
      setBuffer(syncedBuffer);
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
  }, [diagramId, projectId, readSerializedBuffer, sharedDocumentEngine, snapshotCodec, teamId, setupAttempt]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // editor buffer를 content artifact로 직접 사용한다.
      // frontmatter가 YAML invalid 상태일 때 Y.Doc serialization은 이전 frontmatter를 복원하므로,
      // 사용자 편집 내용을 보존하기 위해 항상 editor buffer를 우선한다.
      const contentToPersist = buffer;
      const latestCheckpoint = documentCheckpointReader?.getLatestCheckpoint() ?? null;
      return {
        contentToPersist,
        result: await saveDiagram(
          teamId,
          projectId,
          diagramId,
          contentToPersist,
          latestCheckpoint?.snapshot ?? null,
        ),
      };
    },
    onSuccess: ({ contentToPersist, result }) => {
      queryClient.setQueryData<DiagramDetail | undefined>(
        queryKeys.diagrams.detail(teamId, projectId, diagramId),
        (current) =>
          current
            ? {
                ...current,
                content: contentToPersist,
                updatedAt: result.updatedAt,
                contentRevision: result.contentRevision,
                hasYdocSnapshot: result.hasYdocSnapshot,
                snapshotRevision: result.snapshotRevision,
                snapshotUpdatedAt: result.snapshotUpdatedAt,
              }
            : current,
      );
      queryClient.setQueryData<DocumentBootstrapPayload | undefined>(
        bootstrapQueryKey,
        (currentBootstrap) =>
          currentBootstrap
            ? {
                ...currentBootstrap,
                revision: result.snapshotRevision ?? result.contentRevision,
                snapshotAvailable: result.hasYdocSnapshot,
              }
            : currentBootstrap,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.diagrams.byProject(teamId, projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: bootstrapQueryKey,
        exact: true,
      });
      setLastSavedBuffer(contentToPersist);
      setLastSavedAt(result.updatedAt);
      toast.success(t('markdown.toast.saved'));
    },
    onError: () => toast.error(t('markdown.toast.saveFailed')),
  });

  const setEditorBuffer = useCallback(
    (nextBuffer: string) => {
      if (!documentMutationSession?.enabled || !collaborationReady) {
        return;
      }
      const prevBody = prevBodyRef.current;
      const nextBody = parseMarkdownBuffer(nextBuffer).body.replace(/\r\n/g, '\n');
      const commands = buildSectionCommands(prevBody, nextBody, nextBuffer);
      prevBodyRef.current = nextBody;

      for (const command of commands) {
        documentMutationSession.emitCommand(command, {
          origin: {
            source: 'local',
          },
        });
      }
    },
    [collaborationReady, documentMutationSession],
  );

  const retryCollaborationSetup = useCallback(() => {
    setCollaborationError(false);
    setSetupAttempt((currentAttempt) => currentAttempt + 1);
  }, []);

  return {
    buffer,
    setEditorBuffer,
    dirty,
    lastSavedAt,
    savePending: saveMutation.isPending,
    collaborationReady,
    collaborationError,
    handleSave: () => saveMutation.mutate(),
    retryCollaborationSetup,
    documentMutationSession,
  };
}

function hasMalformedFrontmatterPlaceholder(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((entryValue) => hasMalformedFrontmatterPlaceholder(entryValue));
  }
  if (!value || typeof value !== 'object') {
    return false;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.some(([, entryValue]) => hasMalformedFrontmatterPlaceholder(entryValue));
}
