import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  createDiagram,
  deleteDiagram,
  renameDiagram,
  updateDiagramDictionaryContext,
} from '@/api/diagramApi';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import type { DictionarySet } from '@/types/dictionary';
import type { DiagramSummary } from '@/types/diagram';

interface UseDiagramDocumentHubActionsOptions {
  teamId?: string;
  projectId?: string;
  dictionarySets: DictionarySet[];
}

interface DiagramDocumentHubActionsResult {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  deleteTarget: number | null;
  setDeleteTarget: (diagramId: number | null) => void;
  renamingId: number | null;
  renameValue: string;
  setRenameValue: (value: string) => void;
  createDictionaryContextId: string;
  setCreateDictionaryContextId: (value: string) => void;
  startRename: (diagram: DiagramSummary) => void;
  confirmRename: () => void;
  cancelRename: () => void;
  createDocument: (name: string) => Promise<unknown>;
  confirmDeleteDocument: () => void;
  updateDictionaryContext: (diagramId: number, dictionarySetId: number) => void;
  deleteDocumentPending: boolean;
  updateDictionaryContextPending: boolean;
}

/** DiagramsPage의 문서 허브 액션과 UI 상태를 모은다. */
export function useDiagramDocumentHubActions({
  teamId,
  projectId,
  dictionarySets,
}: UseDiagramDocumentHubActionsOptions): DiagramDocumentHubActionsResult {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [createDictionaryContextId, setCreateDictionaryContextId] = useState('');

  useEffect(() => {
    if (dictionarySets.length === 0) {
      setCreateDictionaryContextId('');
      return;
    }
    const defaultSet = dictionarySets.find((set) => set.isDefault);
    setCreateDictionaryContextId((prev) => {
      if (prev && dictionarySets.some((set) => String(set.id) === prev)) {
        return prev;
      }
      return String(defaultSet?.id ?? dictionarySets[0]!.id);
    });
  }, [dictionarySets]);

  const invalidateDocuments = useCallback(() => {
    if (!teamId || !projectId) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.diagrams.byProject(teamId, projectId) });
  }, [projectId, queryClient, teamId]);

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      createDiagram(teamId!, projectId!, name, Number(createDictionaryContextId)),
    onSuccess: () => {
      invalidateDocuments();
      toast.success(t('diagram.toast.created'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('diagram.toast.createFailed'))),
  });

  const deleteMutation = useMutation({
    mutationFn: (diagramId: number) => deleteDiagram(teamId!, projectId!, String(diagramId)),
    onSuccess: () => {
      invalidateDocuments();
      setDeleteTarget(null);
      toast.success(t('diagram.toast.deleted'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('diagram.toast.deleteFailed'))),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      renameDiagram(teamId!, projectId!, String(id), name),
    onSuccess: () => {
      invalidateDocuments();
      setRenamingId(null);
      toast.success(t('diagram.toast.renamed'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('diagram.toast.renameFailed'))),
  });

  const updateDiagramSetMutation = useMutation({
    mutationFn: ({ diagramId, dictionarySetId }: { diagramId: number; dictionarySetId: number }) =>
      updateDiagramDictionaryContext(teamId!, projectId!, String(diagramId), dictionarySetId),
    onSuccess: () => {
      invalidateDocuments();
      toast.success(t('diagram.toast.dictionaryContextUpdated'));
    },
    onError: (err) =>
      toast.error(getErrorMessage(err, t('diagram.toast.dictionaryContextUpdateFailed'))),
  });

  const startRename = useCallback((diagram: DiagramSummary) => {
    setRenamingId(diagram.id);
    setRenameValue(diagram.name);
  }, []);

  const confirmRename = useCallback(() => {
    if (renamingId === null || !renameValue.trim()) {
      return;
    }
    renameMutation.mutate({ id: renamingId, name: renameValue.trim() });
  }, [renameMutation, renamingId, renameValue]);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
  }, []);

  const confirmDeleteDocument = useCallback(() => {
    if (deleteTarget === null) {
      return;
    }
    deleteMutation.mutate(deleteTarget);
  }, [deleteMutation, deleteTarget]);

  const updateDictionaryContext = useCallback(
    (diagramId: number, dictionarySetId: number) => {
      updateDiagramSetMutation.mutate({ diagramId, dictionarySetId });
    },
    [updateDiagramSetMutation],
  );

  return {
    dialogOpen,
    setDialogOpen,
    deleteTarget,
    setDeleteTarget,
    renamingId,
    renameValue,
    setRenameValue,
    createDictionaryContextId,
    setCreateDictionaryContextId,
    startRename,
    confirmRename,
    cancelRename,
    createDocument: createMutation.mutateAsync,
    confirmDeleteDocument,
    updateDictionaryContext,
    deleteDocumentPending: deleteMutation.isPending,
    updateDictionaryContextPending: updateDiagramSetMutation.isPending,
  };
}
