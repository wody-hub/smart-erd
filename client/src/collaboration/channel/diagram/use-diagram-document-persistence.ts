import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type * as Y from 'yjs';
import { useDiagramCodeModeSnapshotPersist } from './use-diagram-code-mode-snapshot-persist.js';
import { useDiagramPublishedSave } from './use-diagram-published-save.js';
import type { DiagramDocumentPersistenceSession } from './diagram-document-persistence-session.js';

interface UseDiagramDocumentPersistenceParams {
  enabledCodeModeDraftPersist: boolean;
  ydoc: Y.Doc | null;
  diagramContentRevision: string | undefined;
  diagramPersistenceSession: DiagramDocumentPersistenceSession | null;
  diagramDetailQueryKey: readonly unknown[];
}

export interface UseDiagramDocumentPersistenceResult {
  handleSave: () => void;
  persistPublishedDiagramNow: () => Promise<boolean>;
  isDiagramSavePending: boolean;
  codeModeDraftPersistStatus: ReturnType<
    typeof useDiagramCodeModeSnapshotPersist
  >['codeModeDraftPersistStatus'];
  codeModeDraftPersistedAt: ReturnType<
    typeof useDiagramCodeModeSnapshotPersist
  >['codeModeDraftPersistedAt'];
  scheduleCodeModeSnapshotPersist: ReturnType<
    typeof useDiagramCodeModeSnapshotPersist
  >['scheduleCodeModeSnapshotPersist'];
  resetCodeModeSnapshotPersistState: ReturnType<
    typeof useDiagramCodeModeSnapshotPersist
  >['resetCodeModeSnapshotPersistState'];
  registerBeforeCodeModeSnapshotPersist: ReturnType<
    typeof useDiagramCodeModeSnapshotPersist
  >['registerBeforeSnapshotPersist'];
  flushCodeModeSnapshotBeforeDispose: ReturnType<
    typeof useDiagramCodeModeSnapshotPersist
  >['flushSnapshotKeepaliveNow'];
}

export function useDiagramDocumentPersistence({
  enabledCodeModeDraftPersist,
  ydoc,
  diagramContentRevision,
  diagramPersistenceSession,
  diagramDetailQueryKey,
}: UseDiagramDocumentPersistenceParams): UseDiagramDocumentPersistenceResult {
  const queryClient = useQueryClient();
  const {
    handleSave,
    persistPublishedDiagramNow,
    isSaving: isDiagramSavePending,
  } = useDiagramPublishedSave({
    diagramPersistenceSession,
    diagramDetailQueryKey,
  });
  const {
    codeModeDraftPersistStatus,
    codeModeDraftPersistedAt,
    scheduleCodeModeSnapshotPersist,
    resetCodeModeSnapshotPersistState,
    registerBeforeSnapshotPersist,
    flushSnapshotKeepaliveNow,
  } = useDiagramCodeModeSnapshotPersist({
    enabled: enabledCodeModeDraftPersist,
    ydoc,
    diagramContentRevision,
    diagramPersistenceSession,
    queryClient,
    diagramDetailQueryKey,
  });

  return useMemo(
    () => ({
      handleSave,
      persistPublishedDiagramNow,
      isDiagramSavePending,
      codeModeDraftPersistStatus,
      codeModeDraftPersistedAt,
      scheduleCodeModeSnapshotPersist,
      resetCodeModeSnapshotPersistState,
      registerBeforeCodeModeSnapshotPersist: registerBeforeSnapshotPersist,
      flushCodeModeSnapshotBeforeDispose: flushSnapshotKeepaliveNow,
    }),
    [
      codeModeDraftPersistStatus,
      codeModeDraftPersistedAt,
      handleSave,
      isDiagramSavePending,
      persistPublishedDiagramNow,
      registerBeforeSnapshotPersist,
      resetCodeModeSnapshotPersistState,
      scheduleCodeModeSnapshotPersist,
      flushSnapshotKeepaliveNow,
    ],
  );
}
