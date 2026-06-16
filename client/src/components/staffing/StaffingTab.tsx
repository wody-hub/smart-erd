import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, RefreshCcw, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  createProjectStaffing,
  deleteProjectStaffing,
  fetchProjectStaffing,
  updateProjectStaffing,
} from '@/api/staffingApi';
import { fetchMembers } from '@/api/teamApi';
import StaffingMatrixTable from '@/components/staffing/StaffingMatrixTable';
import StaffingResourceDialog from '@/components/staffing/StaffingResourceDialog';
import StaffingResourceTable from '@/components/staffing/StaffingResourceTable';
import StaffingSummaryStrip from '@/components/staffing/StaffingSummaryStrip';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import Spinner from '@/components/ui/spinner';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import { queryKeys } from '@/constants/query-keys';
import { useProjectQueryInvalidation } from '@/hooks/useProjectQueryInvalidation';
import { getErrorMessage } from '@/lib/api-error';
import type {
  CreateProjectStaffingPayload,
  ProjectStaffingResource,
  UpdateProjectStaffingPayload,
} from '@/types/staffing';

interface StaffingTabProps {
  /** 팀 ID */
  teamId: string;
  /** 프로젝트 ID */
  projectId: string;
  /** 편집 가능 여부 */
  canEdit: boolean;
}

/**
 * 프로젝트 허브의 인력 투입 탭.
 *
 * @param props 탭 props
 * @returns 인력 투입 탭 JSX
 */
export default function StaffingTab({ teamId, projectId, canEdit }: StaffingTabProps) {
  const { t } = useTranslation();
  const invalidateRelatedQueries = useProjectQueryInvalidation(teamId, projectId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<ProjectStaffingResource | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectStaffingResource | null>(null);

  const staffingQuery = useQuery({
    queryKey: queryKeys.staffing.all(teamId, projectId),
    queryFn: () => fetchProjectStaffing(teamId, projectId),
    enabled: Boolean(teamId) && Boolean(projectId),
  });

  const membersQuery = useQuery({
    queryKey: queryKeys.teams.members(teamId),
    queryFn: () => fetchMembers(teamId),
    enabled: Boolean(teamId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateProjectStaffingPayload) =>
      createProjectStaffing(teamId, projectId, payload),
    onSuccess: () => {
      invalidateRelatedQueries({
        includeWbs: false,
        includeMilestones: false,
        includeStaffing: true,
      });
      toast.success(t('staffing.toast.created'));
    },
    onError: (error) => toast.error(getErrorMessage(error, t('staffing.toast.createFailed'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      staffingId,
      payload,
    }: {
      staffingId: number;
      payload: UpdateProjectStaffingPayload;
    }) => updateProjectStaffing(teamId, projectId, staffingId, payload),
    onSuccess: () => {
      invalidateRelatedQueries({
        includeWbs: false,
        includeMilestones: false,
        includeStaffing: true,
      });
      toast.success(t('staffing.toast.updated'));
    },
    onError: (error) => toast.error(getErrorMessage(error, t('staffing.toast.updateFailed'))),
  });

  const deleteMutation = useMutation({
    mutationFn: (staffingId: number) => deleteProjectStaffing(teamId, projectId, staffingId),
    onSuccess: () => {
      invalidateRelatedQueries({
        includeWbs: false,
        includeMilestones: false,
        includeStaffing: true,
      });
      setDeleteTarget(null);
      toast.success(t('staffing.toast.deleted'));
    },
    onError: (error) => toast.error(getErrorMessage(error, t('staffing.toast.deleteFailed'))),
  });

  const resources = staffingQuery.data?.resources ?? [];
  const summary = staffingQuery.data?.summary;
  const months = staffingQuery.data?.months ?? [];

  const staffedUserIds = useMemo(
    () => new Set(resources.map((resource) => resource.userId)),
    [resources],
  );

  const dialogSubmitting = createMutation.isPending || updateMutation.isPending;
  const deletingId = deleteMutation.isPending ? (deleteTarget?.id ?? null) : null;

  /**
   * 생성 다이얼로그를 연다.
   */
  const handleOpenCreate = () => {
    setEditingTarget(null);
    setDialogOpen(true);
  };

  /**
   * 수정 다이얼로그를 연다.
   *
   * @param resource 수정 대상
   */
  const handleOpenEdit = (resource: ProjectStaffingResource) => {
    setEditingTarget(resource);
    setDialogOpen(true);
  };

  /**
   * 다이얼로그 제출을 처리한다.
   *
   * @param payload 생성/수정 payload
   * @param mode create 또는 edit
   */
  const handleDialogSubmit = async (
    payload: CreateProjectStaffingPayload | UpdateProjectStaffingPayload,
    mode: 'create' | 'edit',
  ) => {
    if (mode === 'create') {
      await createMutation.mutateAsync(payload as CreateProjectStaffingPayload);
      return;
    }

    if (!editingTarget) {
      return;
    }

    await updateMutation.mutateAsync({
      staffingId: editingTarget.id,
      payload: payload as UpdateProjectStaffingPayload,
    });
  };

  /**
   * 수동 새로고침을 수행한다.
   */
  const handleRefresh = async () => {
    try {
      await staffingQuery.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error, t('staffing.toast.refreshFailed')));
    }
  };

  if (staffingQuery.isLoading && !staffingQuery.data) {
    return (
      <div className="mt-6 flex min-h-[260px] items-center justify-center">
        <Spinner text={t('staffing.status.loading')} />
      </div>
    );
  }

  if (staffingQuery.isError && !staffingQuery.data) {
    return (
      <div className="mt-6">
        <WorkspaceEmptyState
          icon={<UsersRound className="h-6 w-6" />}
          title={t('staffing.status.loadFailedTitle')}
          description={t('staffing.status.loadFailed')}
          tone="error"
          role="alert"
          action={
            <Button onClick={() => staffingQuery.refetch()}>{t('workspace.status.retry')}</Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{t('staffing.section.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('staffing.section.description')}</p>
          {!canEdit ? (
            <p className="text-xs text-muted-foreground">{t('staffing.status.readOnly')}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void handleRefresh()}>
            <RefreshCcw
              className={staffingQuery.isFetching ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'}
            />
            {t('staffing.action.refresh')}
          </Button>
          {canEdit ? (
            <Button type="button" onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t('staffing.action.create')}
            </Button>
          ) : null}
        </div>
      </div>

      {resources.length === 0 ? (
        <WorkspaceEmptyState
          icon={<UsersRound className="h-6 w-6" />}
          title={t('staffing.empty.title')}
          description={
            canEdit ? t('staffing.empty.description') : t('staffing.empty.readOnlyDescription')
          }
          action={
            canEdit ? (
              <Button type="button" onClick={handleOpenCreate}>
                <Plus className="mr-2 h-4 w-4" />
                {t('staffing.action.create')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {summary ? <StaffingSummaryStrip summary={summary} /> : null}
          <StaffingResourceTable
            resources={resources}
            canEdit={canEdit}
            onEdit={handleOpenEdit}
            onDelete={setDeleteTarget}
            deletingId={deletingId}
          />
          <StaffingMatrixTable resources={resources} months={months} />
        </>
      )}

      <StaffingResourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={editingTarget}
        members={membersQuery.data ?? []}
        staffedUserIds={staffedUserIds}
        onSubmit={handleDialogSubmit}
        loading={dialogSubmitting}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title={t('staffing.delete.title')}
        description={t('staffing.delete.description', { name: deleteTarget?.memberName ?? '' })}
        confirmLabel={t('staffing.delete.confirm')}
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
