import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ListTree, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { fetchMilestones } from '@/api/milestoneApi';
import {
  createWbsItem,
  deleteWbsItem,
  fetchWbsItems,
  reorderWbsItems,
  updateWbsItem,
} from '@/api/wbsApi';
import MilestonePanel from '@/components/milestone/MilestonePanel';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import SortableWbsRow from '@/components/wbs/SortableWbsRow';
import WbsItemFormDialog, { type WbsItemFormValues } from '@/components/wbs/WbsItemFormDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Spinner from '@/components/ui/spinner';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import { queryKeys } from '@/constants/query-keys';
import { useProjectQueryInvalidation } from '@/hooks/useProjectQueryInvalidation';
import { getErrorMessage } from '@/lib/api-error';
import type {
  CreateWbsItemPayload,
  ReorderWbsPayload,
  UpdateWbsItemPayload,
  WbsItem,
} from '@/types/wbs';
import {
  buildChildrenByParent,
  buildReorderPayload,
  collectDescendantIds,
  flattenTreeItems,
  getMaxDescendantDepthOffset,
  MAX_WBS_DEPTH,
  projectPlacement,
} from './wbs-tree-utils';

/** WbsTab 컴포넌트 props. */
interface WbsTabProps {
  /** 팀 ID */
  teamId: string;
  /** 프로젝트 ID */
  projectId: string;
  /** 편집 가능 여부 */
  canEdit: boolean;
}

/**
 * WBS 탭을 렌더링한다.
 *
 * @param props WbsTab props
 * @returns WBS 탭 JSX
 */
export default function WbsTab({ teamId, projectId, canEdit }: WbsTabProps) {
  const { t, i18n } = useTranslation();
  const invalidateRelatedQueries = useProjectQueryInvalidation(teamId, projectId);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WbsItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WbsItem | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const [activeDragItemId, setActiveDragItemId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const wbsQuery = useQuery({
    queryKey: queryKeys.wbs.all(teamId, projectId),
    queryFn: () => fetchWbsItems(teamId, projectId),
    enabled: Boolean(teamId) && Boolean(projectId),
  });

  const milestonesQuery = useQuery({
    queryKey: queryKeys.milestones.all(teamId, projectId),
    queryFn: () => fetchMilestones(teamId, projectId),
    enabled: Boolean(teamId) && Boolean(projectId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateWbsItemPayload) => createWbsItem(teamId, projectId, payload),
    onSuccess: () => {
      invalidateRelatedQueries();
      toast.success(t('wbs.toast.created'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('wbs.toast.createFailed'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ wbsId, payload }: { wbsId: number; payload: UpdateWbsItemPayload }) =>
      updateWbsItem(teamId, projectId, wbsId, payload),
    onSuccess: () => {
      invalidateRelatedQueries();
      toast.success(t('wbs.toast.updated'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('wbs.toast.updateFailed'))),
  });

  const deleteMutation = useMutation({
    mutationFn: (wbsId: number) => deleteWbsItem(teamId, projectId, wbsId),
    onSuccess: () => {
      invalidateRelatedQueries();
      setDeleteTarget(null);
      toast.success(t('wbs.toast.deleted'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('wbs.toast.deleteFailed'))),
  });

  const reorderMutation = useMutation({
    mutationFn: (payload: ReorderWbsPayload) => reorderWbsItems(teamId, projectId, payload),
    onSuccess: () => {
      invalidateRelatedQueries();
      toast.success(t('wbs.toast.reordered'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('wbs.toast.reorderFailed'))),
  });

  const allItems = useMemo(() => {
    const items = wbsQuery.data ?? [];
    const map = buildChildrenByParent(items);
    return flattenTreeItems(map, new Set<number>());
  }, [wbsQuery.data]);

  const childrenByParent = useMemo(() => buildChildrenByParent(allItems), [allItems]);

  const itemById = useMemo(() => new Map(allItems.map((item) => [item.id, item])), [allItems]);

  const hasChildrenById = useMemo(() => {
    const map = new Map<number, boolean>();
    allItems.forEach((item) => {
      map.set(item.id, (childrenByParent.get(item.id)?.length ?? 0) > 0);
    });
    return map;
  }, [allItems, childrenByParent]);

  const visibleItems = useMemo(
    () => flattenTreeItems(childrenByParent, collapsedIds),
    [childrenByParent, collapsedIds],
  );

  const milestoneNameById = useMemo(
    () => new Map((milestonesQuery.data ?? []).map((milestone) => [milestone.id, milestone.name])),
    [milestonesQuery.data],
  );

  /**
   * 생성/수정 폼 제출을 처리한다.
   *
   * @param values 폼 값
   */
  const handleSubmit = async (values: WbsItemFormValues) => {
    if (editTarget) {
      await updateMutation.mutateAsync({
        wbsId: editTarget.id,
        payload: {
          name: values.name,
          assigneeUserId: editTarget.assigneeUserId,
          startDate: values.startDate,
          endDate: values.endDate,
          progressRate: values.progressRate,
          estimatedMm: values.estimatedMm,
          milestoneId: values.milestoneId,
        },
      });
      return;
    }

    await createMutation.mutateAsync({
      name: values.name,
      parentId: values.parentId,
      assigneeUserId: null,
      startDate: values.startDate,
      endDate: values.endDate,
      progressRate: values.progressRate,
      estimatedMm: values.estimatedMm,
      milestoneId: values.milestoneId,
    });
  };

  /**
   * 인라인 이름 수정을 처리한다.
   *
   * @param item 수정 대상 항목
   * @param nextName 변경 이름
   */
  const handleInlineNameSubmit = (item: WbsItem, nextName: string) => {
    updateMutation.mutate({
      wbsId: item.id,
      payload: {
        name: nextName,
        assigneeUserId: item.assigneeUserId,
        startDate: item.startDate,
        endDate: item.endDate,
        progressRate: item.progressRate,
        estimatedMm: item.estimatedMm,
        milestoneId: item.milestoneId,
      },
    });
  };

  /**
   * 인라인 진척률 수정을 처리한다.
   *
   * @param item 수정 대상 항목
   * @param nextProgress 변경 진척률
   */
  const handleInlineProgressSubmit = (item: WbsItem, nextProgress: number) => {
    updateMutation.mutate({
      wbsId: item.id,
      payload: {
        name: item.name,
        assigneeUserId: item.assigneeUserId,
        startDate: item.startDate,
        endDate: item.endDate,
        progressRate: nextProgress,
        estimatedMm: item.estimatedMm,
        milestoneId: item.milestoneId,
      },
    });
  };

  /**
   * 드래그 시작 상태를 반영한다.
   *
   * @param event DnD 시작 이벤트
   */
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragItemId(Number(event.active.id));
  };

  /**
   * 드래그 종료 시 reorder를 실행한다.
   *
   * @param event DnD 종료 이벤트
   */
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragItemId(null);
    const { active, over, delta } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const activeId = Number(active.id);
    const overId = Number(over.id);
    const activeIndex = visibleItems.findIndex((item) => item.id === activeId);
    const overIndex = visibleItems.findIndex((item) => item.id === overId);
    if (activeIndex < 0 || overIndex < 0) {
      return;
    }

    const activeItem = itemById.get(activeId);
    if (!activeItem) {
      return;
    }

    const movedVisibleItems = arrayMove(visibleItems, activeIndex, overIndex);
    const placement = projectPlacement({
      movedVisibleItems,
      activeItem,
      overIndex,
      dragOffsetX: delta.x,
    });

    const descendants = collectDescendantIds(activeId, childrenByParent);
    if (placement.parentId != null && descendants.has(placement.parentId)) {
      toast.error(t('wbs.toast.invalidMove'));
      return;
    }

    const maxDepthOffset = getMaxDescendantDepthOffset(activeId, itemById, childrenByParent);
    if (placement.depth + maxDepthOffset > MAX_WBS_DEPTH) {
      toast.error(t('wbs.toast.depthLimitExceeded'));
      return;
    }

    const payload = buildReorderPayload({
      allItems,
      childrenByParent,
      movedVisibleItems,
      activeItemId: activeId,
      previousParentId: activeItem.parentId,
      nextParentId: placement.parentId,
      nextDepth: placement.depth,
    });
    if (payload.items.length === 0) {
      return;
    }

    reorderMutation.mutate(payload);
  };

  const locale = i18n.resolvedLanguage ?? i18n.language;
  const activeDragItem = activeDragItemId == null ? null : (itemById.get(activeDragItemId) ?? null);
  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    reorderMutation.isPending;

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg">{t('wbs.section.title')}</CardTitle>
            {canEdit && (
              <Button
                onClick={() => {
                  setEditTarget(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('wbs.action.create')}
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{t('wbs.section.description')}</p>
        </CardHeader>

        <CardContent>
          {wbsQuery.isLoading && !wbsQuery.data ? (
            <Spinner text={t('common.loading')} />
          ) : wbsQuery.isError ? (
            <WorkspaceEmptyState
              icon={<ListTree className="h-10 w-10" />}
              title={t('workspace.status.loadFailedTitle')}
              description={t('wbs.toast.loadFailed')}
              tone="error"
              role="alert"
              action={
                <Button variant="outline" onClick={() => void wbsQuery.refetch()}>
                  {t('workspace.status.retry')}
                </Button>
              }
            />
          ) : allItems.length === 0 ? (
            <WorkspaceEmptyState
              icon={<ListTree className="h-10 w-10" />}
              title={t('wbs.empty.title')}
              description={t('wbs.empty.description')}
              action={
                canEdit ? (
                  <Button
                    onClick={() => {
                      setEditTarget(null);
                      setFormOpen(true);
                    }}
                  >
                    {t('wbs.action.create')}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={visibleItems.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <Table className="w-full min-w-[1080px] table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[320px]">{t('wbs.field.name')}</TableHead>
                        <TableHead className="w-[260px]">{t('wbs.field.period')}</TableHead>
                        <TableHead className="w-[120px]">{t('wbs.field.progressRate')}</TableHead>
                        <TableHead className="w-[140px]">{t('wbs.field.estimatedMm')}</TableHead>
                        <TableHead className="w-[220px]">{t('wbs.field.milestone')}</TableHead>
                        {canEdit && (
                          <TableHead className="w-[100px]">{t('wbs.field.actions')}</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {visibleItems.map((item) => (
                        <SortableWbsRow
                          key={item.id}
                          item={item}
                          canEdit={canEdit}
                          locale={locale}
                          milestoneName={
                            item.milestoneName ??
                            (item.milestoneId == null
                              ? null
                              : (milestoneNameById.get(item.milestoneId) ?? null))
                          }
                          hasChildren={hasChildrenById.get(item.id) === true}
                          collapsed={collapsedIds.has(item.id)}
                          disabled={isMutating}
                          t={t}
                          onToggleCollapse={(id) => {
                            setCollapsedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(id)) {
                                next.delete(id);
                              } else {
                                next.add(id);
                              }
                              return next;
                            });
                          }}
                          onInlineNameSubmit={handleInlineNameSubmit}
                          onInlineProgressSubmit={handleInlineProgressSubmit}
                          onOpenEditDialog={(target) => {
                            setEditTarget(target);
                            setFormOpen(true);
                          }}
                          onRequestDelete={setDeleteTarget}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </SortableContext>

                <DragOverlay>
                  {activeDragItem ? (
                    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-lg">
                      {activeDragItem.name}
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
              <p className="mt-2 text-xs text-muted-foreground">{t('wbs.dnd.hint')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <MilestonePanel teamId={teamId} projectId={projectId} canEdit={canEdit} />

      <WbsItemFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditTarget(null);
          }
        }}
        onSubmit={handleSubmit}
        initialData={editTarget}
        items={allItems}
        milestones={milestonesQuery.data ?? []}
        loading={createMutation.isPending || updateMutation.isPending || reorderMutation.isPending}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title={t('wbs.delete.title')}
        description={t('wbs.delete.description', { name: deleteTarget?.name ?? '' })}
        onConfirm={() => {
          if (!deleteTarget) {
            return;
          }
          deleteMutation.mutate(deleteTarget.id);
        }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
