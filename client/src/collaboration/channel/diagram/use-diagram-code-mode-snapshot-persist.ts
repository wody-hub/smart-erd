import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type * as Y from 'yjs';
import type { DiagramDocumentPersistenceSession } from '@/collaboration/channel/diagram/diagram-document-persistence-session';
import {
  CODE_SHARED_DRAFT_INITIAL_SERVER_PERSIST_IDLE_MS,
  CODE_SHARED_DRAFT_SERVER_PERSIST_IDLE_MS,
} from '@/constants/code-sync';
import {
  beginCodeModeSnapshotKeepalive,
  shouldRetryCodeModeSnapshotAfterKeepalive,
} from '@/lib/code-mode-snapshot-keepalive';
import { shouldScheduleCodeModeSnapshotPersist } from '@/lib/code-mode-snapshot-persist';

export type CodeModeDraftPersistStatus =
  | 'inactive'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'error'
  | 'stale';

interface UseDiagramCodeModeSnapshotPersistParams {
  enabled: boolean;
  ydoc: Y.Doc | null;
  diagramContentRevision: string | undefined;
  diagramPersistenceSession: DiagramDocumentPersistenceSession | null;
  queryClient: QueryClient;
  diagramDetailQueryKey: QueryKey;
}

interface UseDiagramCodeModeSnapshotPersistReturn {
  codeModeDraftPersistStatus: CodeModeDraftPersistStatus;
  codeModeDraftPersistedAt: number | null;
  scheduleCodeModeSnapshotPersist: () => void;
  resetCodeModeSnapshotPersistState: (nextStatus?: CodeModeDraftPersistStatus) => void;
  registerBeforeSnapshotPersist: (callback: (() => void) | null) => void;
  flushSnapshotKeepaliveNow: () => void;
}

export function useDiagramCodeModeSnapshotPersist({
  enabled,
  ydoc,
  diagramContentRevision,
  diagramPersistenceSession,
  queryClient,
  diagramDetailQueryKey,
}: UseDiagramCodeModeSnapshotPersistParams): UseDiagramCodeModeSnapshotPersistReturn {
  const codeModeSnapshotPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeModeSnapshotPersistInFlightRef = useRef(false);
  const codeModeSnapshotPersistDirtyRef = useRef(false);
  const codeModeSnapshotPersistEpochRef = useRef(0);
  const codeModeSnapshotLastKeepaliveAtRef = useRef(0);
  const codeModeSnapshotKeepalivePendingRef = useRef(false);
  const beforeSnapshotPersistRef = useRef<(() => void) | null>(null);
  const [codeModeDraftPersistStatus, setCodeModeDraftPersistStatus] =
    useState<CodeModeDraftPersistStatus>('inactive');
  const [codeModeDraftPersistedAt, setCodeModeDraftPersistedAt] = useState<number | null>(null);

  const resetCodeModeSnapshotPersistState = useCallback(
    (nextStatus: CodeModeDraftPersistStatus = 'saved') => {
      codeModeSnapshotPersistEpochRef.current += 1;
      if (codeModeSnapshotPersistTimerRef.current) {
        clearTimeout(codeModeSnapshotPersistTimerRef.current);
        codeModeSnapshotPersistTimerRef.current = null;
      }
      codeModeSnapshotPersistDirtyRef.current = false;
      codeModeSnapshotPersistInFlightRef.current = false;
      codeModeSnapshotKeepalivePendingRef.current = false;
      setCodeModeDraftPersistStatus(nextStatus);
      setCodeModeDraftPersistedAt(nextStatus === 'saved' ? Date.now() : null);
    },
    [],
  );

  const registerBeforeSnapshotPersist = useCallback((callback: (() => void) | null) => {
    beforeSnapshotPersistRef.current = callback;
  }, []);

  const getNextPersistDelayMs = useCallback(
    () =>
      codeModeDraftPersistedAt == null
        ? CODE_SHARED_DRAFT_INITIAL_SERVER_PERSIST_IDLE_MS
        : CODE_SHARED_DRAFT_SERVER_PERSIST_IDLE_MS,
    [codeModeDraftPersistedAt],
  );

  const persistCodeModeSnapshotNow = useCallback(
    async (useKeepalive = false) => {
      if (!diagramPersistenceSession) {
        return;
      }
      if (!diagramContentRevision) {
        return;
      }

      beforeSnapshotPersistRef.current?.();

      const requestEpoch = codeModeSnapshotPersistEpochRef.current;
      const checkpoint = diagramPersistenceSession.getLatestCheckpoint();
      if (!checkpoint) {
        return;
      }
      const nextSnapshot = checkpoint.snapshot;
      if (nextSnapshot.length === 0) {
        codeModeSnapshotPersistDirtyRef.current = false;
        codeModeSnapshotKeepalivePendingRef.current = false;
        if (requestEpoch === codeModeSnapshotPersistEpochRef.current) {
          setCodeModeDraftPersistStatus('saved');
        }
        return;
      }

      if (useKeepalive) {
        const now = Date.now();
        const keepaliveDecision = beginCodeModeSnapshotKeepalive(
          now,
          codeModeSnapshotLastKeepaliveAtRef.current,
          1000,
        );
        if (!keepaliveDecision.shouldSend) {
          return;
        }
        codeModeSnapshotLastKeepaliveAtRef.current = keepaliveDecision.nextLastKeepaliveAt;
        codeModeSnapshotKeepalivePendingRef.current = keepaliveDecision.keepalivePending;
        diagramPersistenceSession.persistSnapshotKeepalive(diagramContentRevision);
        if (requestEpoch === codeModeSnapshotPersistEpochRef.current) {
          setCodeModeDraftPersistStatus('saving');
          setCodeModeDraftPersistedAt(null);
        }
        return;
      }

      if (codeModeSnapshotPersistInFlightRef.current) {
        codeModeSnapshotPersistDirtyRef.current = true;
        setCodeModeDraftPersistStatus('dirty');
        return;
      }

      codeModeSnapshotPersistInFlightRef.current = true;
      codeModeSnapshotPersistDirtyRef.current = false;
      codeModeSnapshotKeepalivePendingRef.current = false;
      if (requestEpoch === codeModeSnapshotPersistEpochRef.current) {
        setCodeModeDraftPersistStatus('saving');
      }

      try {
        const persistResult =
          await diagramPersistenceSession.persistSnapshotWithConflictRetry(diagramContentRevision);
        if (persistResult.refreshedDiagram) {
          queryClient.setQueryData(diagramDetailQueryKey, persistResult.refreshedDiagram);
        }
        if (persistResult.status !== 'persisted') {
          codeModeSnapshotPersistDirtyRef.current = true;
          if (requestEpoch === codeModeSnapshotPersistEpochRef.current) {
            setCodeModeDraftPersistStatus('dirty');
          }
          console.warn(
            `[DiagramPage] code mode snapshot persist ended with status=${persistResult.status}`,
          );
          return;
        }
        if (requestEpoch === codeModeSnapshotPersistEpochRef.current) {
          setCodeModeDraftPersistStatus('saved');
          setCodeModeDraftPersistedAt(Date.now());
        }
      } catch (error) {
        if (requestEpoch !== codeModeSnapshotPersistEpochRef.current) {
          return;
        }
        codeModeSnapshotPersistDirtyRef.current = true;
        setCodeModeDraftPersistStatus('error');
        console.warn('[DiagramPage] code mode snapshot persist failed:', error);
      } finally {
        if (requestEpoch === codeModeSnapshotPersistEpochRef.current) {
          codeModeSnapshotPersistInFlightRef.current = false;
        }
        if (codeModeSnapshotPersistDirtyRef.current) {
          setCodeModeDraftPersistStatus('dirty');
          if (codeModeSnapshotPersistTimerRef.current) {
            clearTimeout(codeModeSnapshotPersistTimerRef.current);
          }
          codeModeSnapshotPersistTimerRef.current = setTimeout(() => {
            void persistCodeModeSnapshotNow();
          }, getNextPersistDelayMs());
        }
      }
    },
    [
      diagramContentRevision,
      diagramDetailQueryKey,
      diagramPersistenceSession,
      getNextPersistDelayMs,
      queryClient,
    ],
  );

  const scheduleCodeModeSnapshotPersist = useCallback(() => {
    codeModeSnapshotPersistDirtyRef.current = true;
    setCodeModeDraftPersistStatus('dirty');
    if (codeModeSnapshotPersistTimerRef.current) {
      clearTimeout(codeModeSnapshotPersistTimerRef.current);
    }
    codeModeSnapshotPersistTimerRef.current = setTimeout(() => {
      void persistCodeModeSnapshotNow();
    }, getNextPersistDelayMs());
  }, [getNextPersistDelayMs, persistCodeModeSnapshotNow]);

  const flushSnapshotKeepaliveNow = useCallback(() => {
    if (!enabled || !ydoc || !diagramPersistenceSession) {
      return;
    }
    if (codeModeSnapshotPersistTimerRef.current) {
      clearTimeout(codeModeSnapshotPersistTimerRef.current);
      codeModeSnapshotPersistTimerRef.current = null;
    }
    void persistCodeModeSnapshotNow(true);
  }, [diagramPersistenceSession, enabled, persistCodeModeSnapshotNow, ydoc]);

  useEffect(() => {
    if (!enabled) {
      setCodeModeDraftPersistStatus('inactive');
      setCodeModeDraftPersistedAt(null);
      return;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !ydoc || !diagramPersistenceSession) {
      if (codeModeSnapshotPersistTimerRef.current) {
        clearTimeout(codeModeSnapshotPersistTimerRef.current);
        codeModeSnapshotPersistTimerRef.current = null;
      }
      codeModeSnapshotPersistDirtyRef.current = false;
      codeModeSnapshotKeepalivePendingRef.current = false;
      return;
    }

    const handleDocUpdate = (_update: Uint8Array, origin: unknown) => {
      if (!shouldScheduleCodeModeSnapshotPersist(origin)) {
        return;
      }
      scheduleCodeModeSnapshotPersist();
    };

    const flushKeepalive = () => {
      if (codeModeSnapshotPersistTimerRef.current) {
        clearTimeout(codeModeSnapshotPersistTimerRef.current);
        codeModeSnapshotPersistTimerRef.current = null;
      }
      void persistCodeModeSnapshotNow(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushKeepalive();
        return;
      }
      if (
        !shouldRetryCodeModeSnapshotAfterKeepalive(
          document.visibilityState,
          codeModeSnapshotKeepalivePendingRef.current,
        )
      ) {
        return;
      }
      codeModeSnapshotKeepalivePendingRef.current = false;
      codeModeSnapshotPersistDirtyRef.current = true;
      setCodeModeDraftPersistStatus('dirty');
      void persistCodeModeSnapshotNow();
    };

    ydoc.on('update', handleDocUpdate);
    globalThis.addEventListener('pagehide', flushKeepalive);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      ydoc.off('update', handleDocUpdate);
      globalThis.removeEventListener('pagehide', flushKeepalive);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (codeModeSnapshotPersistTimerRef.current) {
        clearTimeout(codeModeSnapshotPersistTimerRef.current);
        codeModeSnapshotPersistTimerRef.current = null;
      }
    };
  }, [
    diagramPersistenceSession,
    enabled,
    persistCodeModeSnapshotNow,
    scheduleCodeModeSnapshotPersist,
    ydoc,
  ]);

  return {
    codeModeDraftPersistStatus,
    codeModeDraftPersistedAt,
    scheduleCodeModeSnapshotPersist,
    resetCodeModeSnapshotPersistState,
    registerBeforeSnapshotPersist,
    flushSnapshotKeepaliveNow,
  };
}
