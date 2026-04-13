import { useCallback, useState } from 'react';
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
import { SCREEN_SPEC_DOCUMENT_PLUGIN_ID, type CreateProjectDocumentInput } from '@/types/document';
import type { DiagramSummary } from '@/types/diagram';

interface UseDiagramDocumentHubActionsOptions {
  teamId?: string;
  projectId?: string;
}

interface DiagramDocumentHubActionsResult {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  deleteTarget: number | null;
  setDeleteTarget: (diagramId: number | null) => void;
  renamingId: number | null;
  renameValue: string;
  setRenameValue: (value: string) => void;
  startRename: (diagram: DiagramSummary) => void;
  confirmRename: () => void;
  cancelRename: () => void;
  createDocument: (input: CreateProjectDocumentInput) => Promise<unknown>;
  confirmDeleteDocument: () => void;
  updateDictionaryContext: (diagramId: number, dictionarySetId: number) => void;
  deleteDocumentPending: boolean;
  updateDictionaryContextPending: boolean;
}

/**
 * DiagramsPage의 문서 허브 액션과 UI 상태를 모은다.
 *
 * @param options 팀/프로젝트 스코프 옵션
 * @returns 문서 허브 액션과 UI 상태
 */
export function useDiagramDocumentHubActions({
  teamId,
  projectId,
}: UseDiagramDocumentHubActionsOptions): DiagramDocumentHubActionsResult {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const invalidateDocuments = useCallback(() => {
    if (!teamId || !projectId) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.diagrams.byProject(teamId, projectId) });
  }, [projectId, queryClient, teamId]);

  const createMutation = useMutation({
    mutationFn: (input: CreateProjectDocumentInput) => createDiagram(teamId!, projectId!, input),
    onSuccess: (diagram) => {
      invalidateDocuments();
      toast.success(resolveCreatedToast(diagram.pluginId));
    },
    onError: (err, variables) =>
      toast.error(getErrorMessage(err, resolveCreateFailedToast(variables.pluginId))),
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

  /**
   * 문서 생성 성공 toast 메시지를 플러그인 타입별로 고른다.
   *
   * @param pluginId 생성된 문서 플러그인 id
   * @returns 노출할 toast 메시지
   */
  function resolveCreatedToast(pluginId: CreateProjectDocumentInput['pluginId']) {
    if (pluginId === 'markdown') {
      return t('markdown.toast.created');
    }
    if (pluginId === SCREEN_SPEC_DOCUMENT_PLUGIN_ID) {
      return t('screenSpec.toast.created');
    }
    return t('diagram.toast.created');
  }

  /**
   * 문서 생성 실패 toast 메시지를 플러그인 타입별로 고른다.
   *
   * @param pluginId 생성 요청 문서 플러그인 id
   * @returns 노출할 실패 toast 메시지
   */
  function resolveCreateFailedToast(pluginId: CreateProjectDocumentInput['pluginId']) {
    if (pluginId === 'markdown') {
      return t('markdown.toast.createFailed');
    }
    if (pluginId === SCREEN_SPEC_DOCUMENT_PLUGIN_ID) {
      return t('screenSpec.toast.createFailed');
    }
    return t('diagram.toast.createFailed');
  }

  return {
    dialogOpen,
    setDialogOpen,
    deleteTarget,
    setDeleteTarget,
    renamingId,
    renameValue,
    setRenameValue,
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
