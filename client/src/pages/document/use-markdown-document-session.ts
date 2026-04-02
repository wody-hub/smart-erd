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
import type { RemoteMutationInfo } from '@/components/collaboration/RemotePendingBanner';
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
  /** 현재 편집 중인 section ID (마지막 section-update 커맨드 기준) */
  activeSectionId: string | undefined;
  /** 원격 pending mutation 정보 (null이면 배너 미표시) */
  remoteMutation: RemoteMutationInfo | null;
  /** 원격 pending mutation 수락 콜백 */
  onAcceptRemote: () => void;
  /** 원격 pending mutation 거절 콜백 */
  onRejectRemote: () => void;
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
  /** collaborationReady의 ref 미러 — useEffect 클로저 내에서 최신 값 참조용 */
  const collaborationReadyRef = useRef(false);
  /** 현재 편집 중인 section ID (마지막 section-update 커맨드 기준) */
  const [activeSectionId, setActiveSectionId] = useState<string | undefined>(undefined);
  /** 원격 pending mutation 정보 */
  const [remoteMutation, setRemoteMutation] = useState<RemoteMutationInfo | null>(null);

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
    return subscribeDocumentChanges((event) => {
      const serialized = readSerializedBuffer();
      prevBodyRef.current = parseMarkdownBuffer(serialized).body.replace(/\r\n/g, '\n');
      setBuffer(serialized);

      // 원격 변경 감지 시 remoteMutation 설정 (D-07/D-08 배너 연동)
      // 초기 sync (Y.Doc handoff)의 remote event는 무시 — collaborationReady 이전의 remote는 초기 데이터 로드
      if (event.origin.source === 'remote' && collaborationReadyRef.current) {
        const scope = event.affectedScopes[0];
        const sectionId = scope?.id !== 'root' ? scope?.id : undefined;
        setRemoteMutation({
          key: sectionId ? 'markdown:section-update' : 'markdown:body-replace',
          payload: sectionId ? { sectionId } : undefined,
        });
      }
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
    collaborationReadyRef.current = true;
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
    collaborationReadyRef.current = true;
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
    collaborationReadyRef.current = true;
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

      // activeSectionId 추적: 마지막 section-update 커맨드의 sectionId
      const lastCommand = commands[commands.length - 1];
      if (lastCommand?.key === 'markdown:section-update') {
        setActiveSectionId(lastCommand.payload.sectionId);
      } else if (lastCommand?.key === 'markdown:body-replace') {
        setActiveSectionId(undefined);
      }

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

  /** 원격 pending mutation 수락 — Yjs가 이미 자동 병합하므로 배너 닫기만 수행 */
  const onAcceptRemote = useCallback(() => {
    setRemoteMutation(null);
  }, []);

  /** 원격 pending mutation 거절 — Yjs CRDT 특성상 undo 불가, 배너 닫기만 수행 */
  const onRejectRemote = useCallback(() => {
    setRemoteMutation(null);
  }, []);

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
    activeSectionId,
    remoteMutation,
    onAcceptRemote,
    onRejectRemote,
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
