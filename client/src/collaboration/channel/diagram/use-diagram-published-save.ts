import { useCallback } from 'react';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { DiagramDetail, SaveDiagramResult } from '@/types/diagram';
import type {
  DiagramDocumentPersistenceSession,
  DiagramPublishedBackup,
} from '@/collaboration/channel/diagram/diagram-document-persistence-session';
import { useAutoBackup } from '@/hooks/useAutoBackup';
import { getErrorMessage } from '@/lib/api-error';
import useCanvasStore from '@/stores/erd/useCanvasStore';

interface UseDiagramPublishedSaveParams {
  diagramPersistenceSession: DiagramDocumentPersistenceSession | null;
  diagramDetailQueryKey: QueryKey;
}

interface UseDiagramPublishedSaveReturn {
  handleSave: () => void;
  persistPublishedDiagramNow: () => Promise<boolean>;
  isSaving: boolean;
}

export function useDiagramPublishedSave({
  diagramPersistenceSession,
  diagramDetailQueryKey,
}: UseDiagramPublishedSaveParams): UseDiagramPublishedSaveReturn {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const markBackedUp = useCanvasStore((state) => state.markBackedUp);
  const lastBackupHash = useCanvasStore((state) => state.lastBackupHash);

  const applySavedDiagramDetailToCache = useCallback(
    (savedDiagram: SaveDiagramResult, content: string) => {
      queryClient.setQueryData(diagramDetailQueryKey, (prev: DiagramDetail | undefined) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          content,
          hasYdocSnapshot: savedDiagram.hasYdocSnapshot,
          contentRevision: savedDiagram.contentRevision,
          snapshotRevision: savedDiagram.snapshotRevision,
          snapshotUpdatedAt: savedDiagram.snapshotUpdatedAt,
          updatedAt: savedDiagram.updatedAt,
        };
      });
    },
    [diagramDetailQueryKey, queryClient],
  );

  const saveMutation = useMutation({
    mutationFn: async (backup: DiagramPublishedBackup) => {
      if (!diagramPersistenceSession) {
        throw new Error('Diagram persistence session is not ready');
      }
      return diagramPersistenceSession.savePublishedBackup(backup);
    },
    onSuccess: (savedDiagram, backup) => {
      applySavedDiagramDetailToCache(savedDiagram, backup.content);
    },
  });

  useAutoBackup({
    saveMutation,
    diagramPersistenceSession,
  });

  const handleSave = useCallback(() => {
    if (!diagramPersistenceSession || saveMutation.isPending) {
      return;
    }

    const backup = diagramPersistenceSession.preparePublishedBackup(lastBackupHash);
    if (!backup) {
      toast.info(t('diagram.toast.noChanges'));
      return;
    }

    saveMutation.mutate(backup, {
      onSuccess: () => {
        markBackedUp(backup.hash);
        toast.success(t('diagram.toast.backupSynced'));
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, t('diagram.toast.backupFailed')));
      },
    });
  }, [diagramPersistenceSession, lastBackupHash, markBackedUp, saveMutation, t]);

  const persistPublishedDiagramNow = useCallback(async (): Promise<boolean> => {
    if (!diagramPersistenceSession || saveMutation.isPending) {
      return false;
    }

    const backup = diagramPersistenceSession.preparePublishedBackup(lastBackupHash);
    if (!backup) {
      return true;
    }

    try {
      await saveMutation.mutateAsync(backup);
      markBackedUp(backup.hash);
      void queryClient.invalidateQueries({ queryKey: diagramDetailQueryKey, exact: true });
      toast.success(t('diagram.toast.backupSynced'));
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, t('diagram.toast.backupFailed')));
      return false;
    }
  }, [
    diagramDetailQueryKey,
    diagramPersistenceSession,
    lastBackupHash,
    markBackedUp,
    queryClient,
    saveMutation,
    t,
  ]);

  return {
    handleSave,
    persistPublishedDiagramNow,
    isSaving: saveMutation.isPending,
  };
}
