import { forwardRef, type ReactNode, useEffect, useImperativeHandle, useMemo, useState } from 'react';
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
import { ListTree } from 'lucide-react';
import { toast } from 'sonner';
import { fetchMilestones } from '@/api/milestoneApi';
import { fetchMembers } from '@/api/teamApi';
import {
  createWbsItem,
  deleteWbsItem,
  fetchWbsItems,
  reorderWbsItems,
  updateWbsItem,
} from '@/api/wbsApi';
import MilestonePanel from '@/components/milestone/MilestonePanel';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import { queryKeys } from '@/constants/query-keys';
import { useProjectQueryInvalidation } from '@/hooks/useProjectQueryInvalidation';
import { getErrorMessage } from '@/lib/api-error';
import { cn } from '@/lib/utils';
import type {
  CreateWbsItemPayload,
  ReorderWbsPayload,
  UpdateWbsItemPayload,
  WbsItem,
} from '@/types/wbs';
import SortableWbsRow from './SortableWbsRow';
import WbsInlineCreateRow from './WbsInlineCreateRow';
import WbsItemFormDialog, { type WbsItemFormValues } from './WbsItemFormDialog';
import {
  MAX_WBS_DEPTH,
  buildChildrenByParent,
  buildInlineCreatePayload,
  buildInlineCreatePlacements,
  buildReorderPayload,
  collectDescendantIds,
  flattenTreeItems,
  getMaxDescendantDepthOffset,
  projectPlacement,
  type InlineCreatePlacement,
} from './wbs-tree-utils';

const HIGHLIGHT_DURATION_MS = 2200;

/** WbsWorkspaceContent imperative handle. */
export interface WbsWorkspaceContentHandle {
  /** 상세 생성 dialog를 연다. */
  openCreateDialog: () => void;
}

/** WbsWorkspaceContent props. */
interface WbsWorkspaceContentProps {
  /** 팀 ID */
  teamId: string;
  /** 프로젝트 ID */
  projectId: string;
  /** 편집 가능 여부 */
  canEdit: boolean;
  /** compact tab 또는 dedicated page */
  variant: 'tab' | 'page';
  /** 추가 클래스 */
  className?: string;
}

/**
 * compact tab / dedicated page가 공용으로 쓰는 WBS authoring surface.
 *
 * @param props WbsWorkspaceContent props
 * @returns shared WBS workspace JSX
 */
const WbsWorkspaceContent = forwardRef<WbsWorkspaceContentHandle, WbsWorkspaceContentProps>(
  function WbsWorkspaceContent({ teamId, projectId, canEdit, variant, className }, ref) {
    const { t, i18n } = useTranslation();
    const invalidateRelatedQueries = useProjectQueryInvalidation(teamId, projectId);

    const [formOpen, setFormOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<WbsItem | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<WbsItem | null>(null);
    const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
    const [activeDragItemId, setActiveDragItemId] = useState<number | null>(null);
    const [highlightedItemId, setHighlightedItemId] = useState<number | null>(null);

    const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: { distance: 6 },
      }),
    );

    useImperativeHandle(
      ref,
      () => ({
        openCreateDialog: () => {
          setEditTarget(null);
          setFormOpen(true);
        },
      }),
      [],
    );

    useEffect(() => {
      if (highlightedItemId == null) {
        return undefined;
      }

      const timer = window.setTimeout(() => {
        setHighlightedItemId((current) => (current === highlightedItemId ? null : current));
      }, HIGHLIGHT_DURATION_MS);

      return () => window.clearTimeout(timer);
    }, [highlightedItemId]);

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

    const membersQuery = useQuery({
      queryKey: queryKeys.teams.members(teamId),
      queryFn: () => fetchMembers(teamId),
      enabled: Boolean(teamId),
    });

    const createMutation = useMutation({
      mutationFn: (payload: CreateWbsItemPayload) => createWbsItem(teamId, projectId, payload),
      onSuccess: (createdItem) => {
        invalidateRelatedQueries();
        if (createdItem.parentId != null) {
          setCollapsedIds((prev) => {
            if (!prev.has(createdItem.parentId!)) {
              return prev;
            }
            const next = new Set(prev);
            next.delete(createdItem.parentId!);
            return next;
          });
        }
        setHighlightedItemId(createdItem.id);
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
      () =>
        new Map((milestonesQuery.data ?? []).map((milestone) => [milestone.id, milestone.name])),
      [milestonesQuery.data],
    );

    const memberNameByUserId = useMemo(
      () => new Map((membersQuery.data ?? []).map((member) => [member.userId, member.name])),
      [membersQuery.data],
    );

    const inlineCreatePlacements = useMemo(
      () =>
        variant === 'page' && canEdit
          ? buildInlineCreatePlacements({
              visibleItems,
              hasChildrenById,
              collapsedIds,
            })
          : [],
      [canEdit, collapsedIds, hasChildrenById, variant, visibleItems],
    );

    const inlineCreateRowsByAfterItemId = useMemo(() => {
      const map = new Map<number | null, InlineCreatePlacement[]>();
      inlineCreatePlacements.forEach((placement) => {
        const current = map.get(placement.afterItemId) ?? [];
        current.push(placement);
        map.set(placement.afterItemId, current);
      });
      return map;
    }, [inlineCreatePlacements]);

    /**
     * 생성/수정 dialog submit을 처리한다.
     *
     * @param values form 값
     */
    const handleSubmit = async (values: WbsItemFormValues) => {
      if (editTarget) {
        await updateMutation.mutateAsync({
          wbsId: editTarget.id,
          payload: {
            name: values.name,
            assigneeUserId: values.assigneeUserId,
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
        assigneeUserId: values.assigneeUserId,
        startDate: values.startDate,
        endDate: values.endDate,
        progressRate: values.progressRate,
        estimatedMm: values.estimatedMm,
        milestoneId: values.milestoneId,
      });
    };

    /**
     * dedicated workspace inline create를 처리한다.
     *
     * @param input name / parentId
     */
    const handleInlineCreate = async (input: { name: string; parentId: number | null }) => {
      await createMutation.mutateAsync(buildInlineCreatePayload(input.name, input.parentId));
    };

    /**
     * 인라인 이름 수정을 처리한다.
     *
     * @param item 수정 대상 항목
     * @param nextName 다음 이름
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
     * @param nextProgress 다음 진척률
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
     * 접힘 상태를 토글한다.
     *
     * @param id 대상 항목 ID
     */
    const handleToggleCollapse = (id: number) => {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    };

    /**
     * drag 시작 상태를 반영한다.
     *
     * @param event drag start 이벤트
     */
    const handleDragStart = (event: DragStartEvent) => {
      setActiveDragItemId(Number(event.active.id));
    };

    /**
     * drag 종료 시 reorder를 처리한다.
     *
     * @param event drag end 이벤트
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
    const activeDragItem =
      activeDragItemId == null ? null : (itemById.get(activeDragItemId) ?? null);
    const isMutating =
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      reorderMutation.isPending;
    const tableColumnCount = canEdit ? 7 : 6;
    const shouldShowPageInlineCreate = variant === 'page' && canEdit;

    /**
     * 지정 위치 뒤에 inline quick-add rows를 렌더링한다.
     *
     * @param afterItemId 배치 기준 항목 ID
     * @returns quick-add rows
     */
    const renderInlineCreateRows = (afterItemId: number | null) =>
      (inlineCreateRowsByAfterItemId.get(afterItemId) ?? []).map((placement) => (
        <WbsInlineCreateRow
          key={`${placement.kind}-${placement.parentId ?? 'root'}`}
          kind={placement.kind}
          parentId={placement.parentId}
          depth={placement.depth}
          parentName={
            placement.parentId == null ? null : (itemById.get(placement.parentId)?.name ?? null)
          }
          onCreate={handleInlineCreate}
          loading={createMutation.isPending}
          columnCount={tableColumnCount}
        />
      ));

    /**
     * WBS table body를 렌더링한다.
     *
     * @returns table JSX
     */
    const renderTable = () => {
      const tableRows: ReactNode[] = [];

      if (visibleItems.length === 0 && shouldShowPageInlineCreate) {
        tableRows.push(
          <TableRow key="empty-state">
            <TableCell colSpan={tableColumnCount} className="py-6 text-center">
              <div className="space-y-1">
                <p className="font-medium text-foreground">{t('wbs.empty.title')}</p>
                <p className="text-sm text-muted-foreground">{t('wbs.empty.description')}</p>
              </div>
            </TableCell>
          </TableRow>,
        );
      }

      visibleItems.forEach((item) => {
        tableRows.push(
          <SortableWbsRow
            key={`item-${item.id}`}
            item={item}
            canEdit={canEdit}
            locale={locale}
            assigneeName={
              item.assigneeName ??
              (item.assigneeUserId == null
                ? null
                : (memberNameByUserId.get(item.assigneeUserId) ?? null))
            }
            milestoneName={
              item.milestoneName ??
              (item.milestoneId == null ? null : (milestoneNameById.get(item.milestoneId) ?? null))
            }
            hasChildren={hasChildrenById.get(item.id) === true}
            collapsed={collapsedIds.has(item.id)}
            disabled={isMutating}
            highlighted={highlightedItemId === item.id}
            t={t}
            onToggleCollapse={handleToggleCollapse}
            onInlineNameSubmit={handleInlineNameSubmit}
            onInlineProgressSubmit={handleInlineProgressSubmit}
            onOpenEditDialog={(target) => {
              setEditTarget(target);
              setFormOpen(true);
            }}
            onRequestDelete={setDeleteTarget}
          />,
        );

        if (shouldShowPageInlineCreate) {
          tableRows.push(...renderInlineCreateRows(item.id));
        }
      });

      if (shouldShowPageInlineCreate) {
        tableRows.push(...renderInlineCreateRows(null));
      }

      return (
        <div className="space-y-2">
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
              <Table className="w-full min-w-[1320px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[320px]">{t('wbs.field.name')}</TableHead>
                    <TableHead className="w-[180px]">{t('wbs.field.assignee')}</TableHead>
                    <TableHead className="w-[240px]">{t('wbs.field.period')}</TableHead>
                    <TableHead className="w-[120px]">{t('wbs.field.progressRate')}</TableHead>
                    <TableHead className="w-[140px]">{t('wbs.field.estimatedMm')}</TableHead>
                    <TableHead className="w-[220px]">{t('wbs.field.milestone')}</TableHead>
                    {canEdit && (
                      <TableHead className="w-[100px]">{t('wbs.field.actions')}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>

                <TableBody>{tableRows}</TableBody>
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

          <p className="text-xs text-muted-foreground">{t('wbs.dnd.hint')}</p>
        </div>
      );
    };

    let wbsContent: ReactNode;
    if (wbsQuery.isLoading && !wbsQuery.data) {
      wbsContent = <Spinner text={t('common.loading')} />;
    } else if (wbsQuery.isError) {
      wbsContent = (
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
      );
    } else if (allItems.length === 0 && !(shouldShowPageInlineCreate && canEdit)) {
      wbsContent = (
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
      );
    } else {
      wbsContent = renderTable();
    }

    return (
      <>
        <div
          className={cn('grid gap-6 xl:grid-cols-[minmax(0,2.4fr)_minmax(320px,1fr)]', className)}
        >
          <section aria-label={t('wbs.section.title')}>{wbsContent}</section>
          <aside>
            <MilestonePanel teamId={teamId} projectId={projectId} canEdit={canEdit} />
          </aside>
        </div>

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
          members={membersQuery.data ?? []}
          membersLoading={membersQuery.isLoading}
          membersError={membersQuery.isError}
          loading={
            createMutation.isPending || updateMutation.isPending || reorderMutation.isPending
          }
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
      </>
    );
  },
);

export default WbsWorkspaceContent;
