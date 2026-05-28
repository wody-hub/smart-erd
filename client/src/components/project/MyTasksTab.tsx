import { useEffect, useMemo, useState } from 'react';
import { ListTodo } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { fetchDiagrams } from '@/api/diagramApi';
import {
  createProjectTodo,
  deleteProjectTodo,
  fetchProjectTodos,
  fetchSharedTodoSummaries,
  fetchTodoDocuments,
  linkTodoDocument,
  linkTodoToWbs,
  unlinkTodoDocument,
  unlinkTodoFromWbs,
  updateProjectTodo,
} from '@/api/projectTodoApi';
import { fetchWbsItems } from '@/api/wbsApi';
import ProjectTodoCreateDialog from '@/components/project/ProjectTodoCreateDialog';
import ProjectTodoDetailPanel from '@/components/project/ProjectTodoDetailPanel';
import ProjectTodoListSection from '@/components/project/ProjectTodoListSection';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import Spinner from '@/components/ui/spinner';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import ProjectTodoDocumentLinkDialog from './ProjectTodoDocumentLinkDialog';
import {
  buildEditorValues,
  DEFAULT_EDITOR_VALUES,
  parseProgressRate,
  toLinkedWbsEditorValue,
  toNullableDate,
  toNullableText,
  type TodoEditorValues,
} from './project-todo-editor';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import type {
  CreateProjectTodoPayload,
  ProjectTodo,
  TodoDocument,
  TodoDocumentVisibility,
  UpdateProjectTodoPayload,
} from '@/types/project-todo';

interface MyTasksTabProps {
  teamId: string;
  projectId: string;
  canManagePersonalTodos: boolean;
}

/**
 * 개인 TODO와 관련된 React Query 캐시를 무효화한다.
 *
 * @param queryClient React Query 클라이언트
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param wbsItemId 현재 연결된 WBS 항목 ID
 * @param todoId TODO ID
 * @param previousWbsItemId 이전 WBS 항목 ID
 * @returns 없음
 */
function invalidateTodoRelatedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  teamId: string,
  projectId: string,
  wbsItemId: number | null,
  todoId: number | null,
  previousWbsItemId?: number | null,
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.projectTodos.all(teamId, projectId) });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.projects.businessOverview(teamId, projectId),
  });
  void queryClient.invalidateQueries({ queryKey: queryKeys.wbs.all(teamId, projectId) });
  if (todoId != null) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.projectTodos.documents(teamId, projectId, todoId),
    });
  }
  if (wbsItemId != null) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.wbs.sharedTodos(teamId, projectId, wbsItemId),
    });
  }
  if (previousWbsItemId != null && previousWbsItemId !== wbsItemId) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.wbs.sharedTodos(teamId, projectId, previousWbsItemId),
    });
  }
}

/**
 * TODO 목록 캐시에 서버가 반환한 최신 TODO 값을 반영한다.
 *
 * @param queryClient React Query 클라이언트
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param todo 갱신된 TODO
 * @returns 없음
 */
function syncProjectTodoInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  teamId: string,
  projectId: string,
  todo: ProjectTodo,
) {
  queryClient.setQueryData<ProjectTodo[] | undefined>(
    queryKeys.projectTodos.all(teamId, projectId),
    (current) => current?.map((item) => (item.id === todo.id ? todo : item)) ?? current,
  );
}

/**
 * TODO 목록 캐시에 WBS 연결 상태를 낙관적으로 반영한다.
 *
 * @param queryClient React Query 클라이언트
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param todoId TODO ID
 * @param linkedWbsItemId 연결할 WBS 항목 ID
 * @param linkedWbsItemName 연결할 WBS 항목 이름
 * @returns 없음
 */
function updateProjectTodoWbsInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  teamId: string,
  projectId: string,
  todoId: number,
  linkedWbsItemId: number | null,
  linkedWbsItemName: string | null,
) {
  queryClient.setQueryData<ProjectTodo[] | undefined>(
    queryKeys.projectTodos.all(teamId, projectId),
    (current) =>
      current?.map((item) =>
        item.id === todoId ? { ...item, linkedWbsItemId, linkedWbsItemName } : item,
      ) ?? current,
  );
}

interface WbsLinkMutationContext {
  previousEditorLinkedWbsItemId: string;
  previousTodos: ProjectTodo[] | undefined;
  previousLinkedWbsItemId: number | null;
}

interface DeleteTodoMutationContext {
  previousSelectedTodoId: number | null;
  previousTodos: ProjectTodo[] | undefined;
}

/**
 * 개인 TODO 목록, 상세 편집, 문서/WBS 연결을 관리하는 프로젝트 탭.
 *
 * @param props 개인 TODO 탭 렌더링 속성
 * @returns 개인 TODO 탭 JSX
 */
export default function MyTasksTab({ teamId, projectId, canManagePersonalTodos }: MyTasksTabProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const queryClient = useQueryClient();
  const [selectedTodoId, setSelectedTodoId] = useState<number | null>(null);
  const [editorValues, setEditorValues] = useState<TodoEditorValues>(DEFAULT_EDITOR_VALUES);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createValues, setCreateValues] = useState<TodoEditorValues>(DEFAULT_EDITOR_VALUES);
  const [deleteTarget, setDeleteTarget] = useState<ProjectTodo | null>(null);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const projectTodosQueryKey = queryKeys.projectTodos.all(teamId, projectId);

  const todosQuery = useQuery({
    queryKey: projectTodosQueryKey,
    queryFn: () => fetchProjectTodos(teamId, projectId),
    enabled: Boolean(teamId) && Boolean(projectId),
  });

  const wbsQuery = useQuery({
    queryKey: queryKeys.wbs.all(teamId, projectId),
    queryFn: () => fetchWbsItems(teamId, projectId),
    enabled: Boolean(teamId) && Boolean(projectId),
  });

  const diagramsQuery = useQuery({
    queryKey: queryKeys.diagrams.byProject(teamId, projectId),
    queryFn: () => fetchDiagrams(teamId, projectId),
    enabled: Boolean(teamId) && Boolean(projectId),
  });

  const selectedTodo = useMemo(
    () => (todosQuery.data ?? []).find((todo) => todo.id === selectedTodoId) ?? null,
    [selectedTodoId, todosQuery.data],
  );

  useEffect(() => {
    const todos = todosQuery.data ?? [];
    if (todos.length === 0) {
      setSelectedTodoId(null);
      return;
    }
    if (selectedTodoId != null && todos.some((todo) => todo.id === selectedTodoId)) {
      return;
    }
    setSelectedTodoId(todos[0]?.id ?? null);
  }, [selectedTodoId, todosQuery.data]);

  useEffect(() => {
    setEditorValues(buildEditorValues(selectedTodo));
  }, [selectedTodo]);

  const todoDocumentsQuery = useQuery({
    queryKey: queryKeys.projectTodos.documents(teamId, projectId, selectedTodo?.id ?? null),
    queryFn: () => fetchTodoDocuments(teamId, projectId, selectedTodo!.id),
    enabled: selectedTodo != null,
  });

  const selectedWbsSharedTodosQuery = useQuery({
    queryKey: queryKeys.wbs.sharedTodos(teamId, projectId, selectedTodo?.linkedWbsItemId ?? null),
    queryFn: () => fetchSharedTodoSummaries(teamId, projectId, selectedTodo!.linkedWbsItemId!),
    enabled: selectedTodo?.linkedWbsItemId != null,
  });

  const linkedDocumentIds = useMemo(
    () => new Set((todoDocumentsQuery.data ?? []).map((document) => document.id)),
    [todoDocumentsQuery.data],
  );

  const linkableDocuments = useMemo(
    () => (diagramsQuery.data ?? []).filter((document) => !linkedDocumentIds.has(document.id)),
    [diagramsQuery.data, linkedDocumentIds],
  );

  const allWbsItems = useMemo(() => wbsQuery.data ?? [], [wbsQuery.data]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateProjectTodoPayload) =>
      createProjectTodo(teamId, projectId, payload),
    onSuccess: (createdTodo) => {
      invalidateTodoRelatedQueries(
        queryClient,
        teamId,
        projectId,
        createdTodo.linkedWbsItemId,
        createdTodo.id,
      );
      setCreateDialogOpen(false);
      setCreateValues(DEFAULT_EDITOR_VALUES);
      setSelectedTodoId(createdTodo.id);
      toast.success(t('myTasks.toast.created'));
    },
    onError: (error) => toast.error(getErrorMessage(error, t('myTasks.toast.createFailed'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ todoId, payload }: { todoId: number; payload: UpdateProjectTodoPayload }) =>
      updateProjectTodo(teamId, projectId, todoId, payload),
    onSuccess: (updatedTodo) => {
      if (selectedTodo?.id === updatedTodo.id) {
        setEditorValues(buildEditorValues(updatedTodo));
      }
      invalidateTodoRelatedQueries(
        queryClient,
        teamId,
        projectId,
        updatedTodo.linkedWbsItemId,
        updatedTodo.id,
      );
      toast.success(t('myTasks.toast.updated'));
    },
    onError: (error) => toast.error(getErrorMessage(error, t('myTasks.toast.updateFailed'))),
  });

  const deleteMutation = useMutation({
    onMutate: async (todo): Promise<DeleteTodoMutationContext> => {
      const previousSelectedTodoId = selectedTodoId;
      const previousTodos = queryClient.getQueryData<ProjectTodo[] | undefined>(
        projectTodosQueryKey,
      );
      await queryClient.cancelQueries({
        queryKey: queryKeys.projectTodos.documents(teamId, projectId, todo.id),
      });
      queryClient.setQueryData<ProjectTodo[] | undefined>(
        projectTodosQueryKey,
        (current) => current?.filter((item) => item.id !== todo.id) ?? current,
      );
      if (previousSelectedTodoId === todo.id) {
        setSelectedTodoId(null);
      }
      return { previousSelectedTodoId, previousTodos };
    },
    mutationFn: (todo: ProjectTodo) => deleteProjectTodo(teamId, projectId, todo.id),
    onSuccess: (_, deletedTodo) => {
      void queryClient.removeQueries({
        queryKey: queryKeys.projectTodos.documents(teamId, projectId, deletedTodo.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.projectTodos.all(teamId, projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.projects.businessOverview(teamId, projectId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wbs.all(teamId, projectId) });
      if (deletedTodo.linkedWbsItemId != null) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.wbs.sharedTodos(teamId, projectId, deletedTodo.linkedWbsItemId),
        });
      }
      setDeleteTarget(null);
      setSelectedTodoId((current) => (current === deletedTodo.id ? null : current));
      toast.success(t('myTasks.toast.deleted'));
    },
    onError: (error, deletedTodo, context) => {
      if (context?.previousTodos) {
        queryClient.setQueryData(projectTodosQueryKey, context.previousTodos);
      }
      if (context?.previousSelectedTodoId === deletedTodo.id) {
        setSelectedTodoId(deletedTodo.id);
      }
      toast.error(getErrorMessage(error, t('myTasks.toast.deleteFailed')));
    },
  });

  const linkWbsMutation = useMutation({
    onMutate: ({ todoId, wbsItemId }): WbsLinkMutationContext => {
      const previousTodos = queryClient.getQueryData<ProjectTodo[] | undefined>(
        projectTodosQueryKey,
      );
      const previousLinkedWbsItemId =
        previousTodos?.find((todo) => todo.id === todoId)?.linkedWbsItemId ??
        selectedTodo?.linkedWbsItemId ??
        null;
      const linkedWbsItemName = allWbsItems.find((item) => item.id === wbsItemId)?.name ?? null;

      setEditorValues((current) => ({
        ...current,
        linkedWbsItemId: toLinkedWbsEditorValue(wbsItemId),
      }));
      updateProjectTodoWbsInCache(
        queryClient,
        teamId,
        projectId,
        todoId,
        wbsItemId,
        linkedWbsItemName,
      );

      return {
        previousEditorLinkedWbsItemId: editorValues.linkedWbsItemId,
        previousTodos,
        previousLinkedWbsItemId,
      };
    },
    mutationFn: ({ todoId, wbsItemId }: { todoId: number; wbsItemId: number }) =>
      linkTodoToWbs(teamId, projectId, todoId, wbsItemId),
    onSuccess: (updatedTodo, _variables, context) => {
      syncProjectTodoInCache(queryClient, teamId, projectId, updatedTodo);
      setEditorValues((current) => ({
        ...current,
        linkedWbsItemId: toLinkedWbsEditorValue(updatedTodo.linkedWbsItemId),
      }));
      invalidateTodoRelatedQueries(
        queryClient,
        teamId,
        projectId,
        updatedTodo.linkedWbsItemId,
        updatedTodo.id,
        context?.previousLinkedWbsItemId,
      );
      toast.success(t('myTasks.toast.wbsLinked'));
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(projectTodosQueryKey, context?.previousTodos);
      setEditorValues((current) => ({
        ...current,
        linkedWbsItemId:
          context?.previousEditorLinkedWbsItemId ??
          toLinkedWbsEditorValue(context?.previousLinkedWbsItemId ?? null),
      }));
      toast.error(getErrorMessage(error, t('myTasks.toast.wbsLinkFailed')));
    },
  });

  const unlinkWbsMutation = useMutation({
    onMutate: (todoId: number): WbsLinkMutationContext => {
      const previousTodos = queryClient.getQueryData<ProjectTodo[] | undefined>(
        projectTodosQueryKey,
      );
      const previousLinkedWbsItemId =
        previousTodos?.find((todo) => todo.id === todoId)?.linkedWbsItemId ??
        selectedTodo?.linkedWbsItemId ??
        null;

      setEditorValues((current) => ({ ...current, linkedWbsItemId: 'none' }));
      updateProjectTodoWbsInCache(queryClient, teamId, projectId, todoId, null, null);

      return {
        previousEditorLinkedWbsItemId: editorValues.linkedWbsItemId,
        previousTodos,
        previousLinkedWbsItemId,
      };
    },
    mutationFn: (todoId: number) => unlinkTodoFromWbs(teamId, projectId, todoId),
    onSuccess: (updatedTodo, _variables, context) => {
      syncProjectTodoInCache(queryClient, teamId, projectId, updatedTodo);
      setEditorValues((current) => ({
        ...current,
        linkedWbsItemId: toLinkedWbsEditorValue(updatedTodo.linkedWbsItemId),
      }));
      invalidateTodoRelatedQueries(
        queryClient,
        teamId,
        projectId,
        null,
        updatedTodo.id,
        context?.previousLinkedWbsItemId,
      );
      toast.success(t('myTasks.toast.wbsUnlinked'));
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(projectTodosQueryKey, context?.previousTodos);
      setEditorValues((current) => ({
        ...current,
        linkedWbsItemId:
          context?.previousEditorLinkedWbsItemId ??
          toLinkedWbsEditorValue(context?.previousLinkedWbsItemId ?? null),
      }));
      toast.error(getErrorMessage(error, t('myTasks.toast.wbsUnlinkFailed')));
    },
  });

  const linkDocumentMutation = useMutation({
    mutationFn: ({
      todoId,
      documentId,
      visibility,
    }: {
      todoId: number;
      documentId: number;
      visibility: TodoDocumentVisibility;
    }) => linkTodoDocument(teamId, projectId, todoId, documentId, { visibility }),
    onSuccess: () => {
      if (!selectedTodo) {
        return;
      }
      invalidateTodoRelatedQueries(
        queryClient,
        teamId,
        projectId,
        selectedTodo.linkedWbsItemId,
        selectedTodo.id,
      );
      setDocumentDialogOpen(false);
      toast.success(t('myTasks.toast.documentLinked'));
    },
    onError: (error) => toast.error(getErrorMessage(error, t('myTasks.toast.documentLinkFailed'))),
  });

  const unlinkDocumentMutation = useMutation({
    mutationFn: ({ todoId, documentId }: { todoId: number; documentId: number }) =>
      unlinkTodoDocument(teamId, projectId, todoId, documentId),
    onSuccess: () => {
      if (!selectedTodo) {
        return;
      }
      invalidateTodoRelatedQueries(
        queryClient,
        teamId,
        projectId,
        selectedTodo.linkedWbsItemId,
        selectedTodo.id,
      );
      toast.success(t('myTasks.toast.documentUnlinked'));
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, t('myTasks.toast.documentUnlinkFailed'))),
  });

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    linkWbsMutation.isPending ||
    unlinkWbsMutation.isPending ||
    linkDocumentMutation.isPending ||
    unlinkDocumentMutation.isPending;

  /**
   * 생성 다이얼로그 값을 검증하고 새 TODO를 생성한다.
   *
   * @returns 생성 요청 완료 Promise
   */
  const handleCreate = async () => {
    const progressRate = parseProgressRate(createValues.progressRate);
    if (!createValues.title.trim()) {
      toast.error(t('myTasks.validation.titleRequired'));
      return;
    }
    if (progressRate == null || progressRate < 0 || progressRate > 100) {
      toast.error(t('myTasks.validation.progressRate'));
      return;
    }
    await createMutation.mutateAsync({
      title: createValues.title.trim(),
      description: toNullableText(createValues.description),
      status: createValues.status,
      priority: createValues.priority,
      targetDate: toNullableDate(createValues.targetDate),
      progressRate,
      linkedWbsItemId:
        createValues.linkedWbsItemId === 'none' ? null : Number(createValues.linkedWbsItemId),
    });
  };

  /**
   * 상세 패널의 편집 값을 검증하고 선택된 TODO를 저장한다.
   *
   * @returns 저장 요청 완료 Promise
   */
  const handleSave = async () => {
    if (!selectedTodo) {
      return;
    }
    const progressRate = parseProgressRate(editorValues.progressRate);
    if (!editorValues.title.trim()) {
      toast.error(t('myTasks.validation.titleRequired'));
      return;
    }
    if (progressRate == null || progressRate < 0 || progressRate > 100) {
      toast.error(t('myTasks.validation.progressRate'));
      return;
    }
    await updateMutation.mutateAsync({
      todoId: selectedTodo.id,
      payload: {
        title: editorValues.title.trim(),
        description: toNullableText(editorValues.description),
        status: editorValues.status,
        priority: editorValues.priority,
        targetDate: toNullableDate(editorValues.targetDate),
        progressRate,
      },
    });
  };

  /**
   * 목록/보드에서 선택한 TODO 상태를 즉시 변경한다.
   *
   * @param todo 상태를 바꿀 TODO
   * @param status 다음 TODO 상태
   * @returns 없음
   */
  const handleStatusChange = (todo: ProjectTodo, status: ProjectTodo['status']) => {
    if (!canManagePersonalTodos || todo.status === status || updateMutation.isPending) {
      return;
    }
    void updateMutation.mutateAsync({
      todoId: todo.id,
      payload: {
        title: todo.title,
        description: todo.description,
        status,
        priority: todo.priority,
        targetDate: todo.targetDate,
        progressRate: todo.progressRate,
      },
    });
  };

  /**
   * 선택된 TODO의 WBS 연결 값을 변경한다.
   *
   * @param value 선택된 WBS 항목 ID 또는 none
   * @returns 없음
   */
  const handleLinkedWbsChange = (value: string) => {
    if (!selectedTodo) {
      return;
    }
    if (value === 'none') {
      void unlinkWbsMutation.mutateAsync(selectedTodo.id);
      return;
    }
    void linkWbsMutation.mutateAsync({ todoId: selectedTodo.id, wbsItemId: Number(value) });
  };

  /**
   * 연결된 문서의 공유 범위를 변경한다.
   *
   * @param document 공유 범위를 바꿀 문서
   * @param visibility 다음 공유 범위
   * @returns 없음
   */
  const handleDocumentVisibilityChange = (document: TodoDocument, visibility: string) => {
    if (!selectedTodo) {
      return;
    }
    void linkDocumentMutation.mutateAsync({
      todoId: selectedTodo.id,
      documentId: document.id,
      visibility: visibility as TodoDocumentVisibility,
    });
  };

  if (todosQuery.isLoading && !todosQuery.data) {
    return <Spinner text={t('common.loading')} />;
  }

  if (todosQuery.isError) {
    return (
      <div className="mt-6">
        <WorkspaceEmptyState
          icon={<ListTodo className="h-10 w-10" />}
          title={t('myTasks.status.loadFailedTitle')}
          description={t('myTasks.status.loadFailedDescription')}
          tone="error"
          action={
            <Button variant="outline" onClick={() => void todosQuery.refetch()}>
              {t('workspace.status.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.35fr)]">
        <ProjectTodoListSection
          canManagePersonalTodos={canManagePersonalTodos}
          selectedTodoId={selectedTodoId}
          todos={todosQuery.data ?? []}
          onCreate={() => setCreateDialogOpen(true)}
          onSelectTodo={setSelectedTodoId}
          onStatusChange={handleStatusChange}
        />

        <aside className="space-y-6">
          <ProjectTodoDetailPanel
            canManagePersonalTodos={canManagePersonalTodos}
            isMutating={isMutating}
            locale={locale}
            selectedTodo={selectedTodo}
            editorValues={editorValues}
            allWbsItems={allWbsItems}
            todoDocuments={todoDocumentsQuery.data ?? []}
            linkableDocumentsCount={linkableDocuments.length}
            sharedTodos={selectedWbsSharedTodosQuery.data ?? []}
            todoDocumentsLoading={todoDocumentsQuery.isLoading}
            todoDocumentsError={todoDocumentsQuery.isError}
            sharedTodosLoading={selectedWbsSharedTodosQuery.isLoading}
            sharedTodosError={selectedWbsSharedTodosQuery.isError}
            onEditorChange={setEditorValues}
            onDelete={setDeleteTarget}
            onSave={() => void handleSave()}
            onLinkedWbsChange={handleLinkedWbsChange}
            onOpenDocumentDialog={() => setDocumentDialogOpen(true)}
            onRetryDocuments={() => void todoDocumentsQuery.refetch()}
            onDocumentVisibilityChange={handleDocumentVisibilityChange}
            onDocumentUnlink={(documentId) => {
              if (!selectedTodo) {
                return;
              }
              unlinkDocumentMutation.mutate({ todoId: selectedTodo.id, documentId });
            }}
          />
        </aside>
      </div>

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title={t('myTasks.delete.title')}
        description={t('myTasks.delete.description', { title: deleteTarget?.title ?? '' })}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget);
          }
        }}
        loading={deleteMutation.isPending}
      />

      <ProjectTodoDocumentLinkDialog
        open={documentDialogOpen}
        onOpenChange={setDocumentDialogOpen}
        documents={linkableDocuments}
        loading={linkDocumentMutation.isPending}
        onConfirm={async (documentId, visibility) => {
          if (!selectedTodo) {
            return;
          }
          await linkDocumentMutation.mutateAsync({
            todoId: selectedTodo.id,
            documentId,
            visibility,
          });
        }}
      />

      <ProjectTodoCreateDialog
        open={createDialogOpen}
        createValues={createValues}
        createPending={createMutation.isPending}
        allWbsItems={allWbsItems}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setCreateValues(DEFAULT_EDITOR_VALUES);
          }
        }}
        onChange={setCreateValues}
        onCreate={() => void handleCreate()}
      />
    </>
  );
}
