import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CircleAlert, Download, Plus, RefreshCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  createProjectIssue,
  downloadProjectIssuesExcel,
  fetchProjectIssues,
  updateProjectIssue,
  updateProjectIssueStatus,
} from '@/api/issuesApi';
import { fetchMembers } from '@/api/teamApi';
import IssueCardList from '@/components/issues/IssueCardList';
import IssueDialog, {
  type IssueDialogMode,
  type IssueDialogSubmitPayload,
} from '@/components/issues/IssueDialog';
import IssueFilterBar from '@/components/issues/IssueFilterBar';
import IssueTable from '@/components/issues/IssueTable';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import { queryKeys } from '@/constants/query-keys';
import { useProjectQueryInvalidation } from '@/hooks/useProjectQueryInvalidation';
import { getErrorMessage } from '@/lib/api-error';
import { downloadBlob } from '@/lib/download';
import {
  DEFAULT_PROJECT_ISSUE_FILTER_STATE,
  getNextProjectIssueStatus,
  normalizeProjectIssueFilters,
  type ProjectIssueFilterState,
} from '@/lib/project-issues';
import type {
  CreateProjectIssuePayload,
  ProjectIssue,
  UpdateProjectIssuePayload,
} from '@/types/issues';

/** 프로젝트 허브의 이슈 탭 props. */
interface IssuesTabProps {
  /** 팀 ID */
  teamId: string;
  /** 프로젝트 ID */
  projectId: string;
  /** 편집 가능 여부 */
  canEdit: boolean;
}

/**
 * 프로젝트 허브의 이슈 탭.
 *
 * @param props 탭 props
 * @returns 프로젝트 이슈 탭 JSX
 */
export default function IssuesTab({ teamId, projectId, canEdit }: IssuesTabProps) {
  const { t, i18n } = useTranslation();
  const invalidateRelatedQueries = useProjectQueryInvalidation(teamId, projectId);

  const [filters, setFilters] = useState<ProjectIssueFilterState>(
    DEFAULT_PROJECT_ISSUE_FILTER_STATE,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<IssueDialogMode>('create');
  const [selectedIssue, setSelectedIssue] = useState<ProjectIssue | null>(null);

  const normalizedFilters = useMemo(() => normalizeProjectIssueFilters(filters), [filters]);
  const hasActiveFilters = Object.keys(normalizedFilters).length > 0;

  const issuesQuery = useQuery({
    queryKey: queryKeys.issues.all(teamId, projectId, normalizedFilters),
    queryFn: () => fetchProjectIssues(teamId, projectId, normalizedFilters),
    enabled: Boolean(teamId) && Boolean(projectId),
  });

  const membersQuery = useQuery({
    queryKey: queryKeys.teams.members(teamId),
    queryFn: () => fetchMembers(teamId),
    enabled: Boolean(teamId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateProjectIssuePayload) =>
      createProjectIssue(teamId, projectId, payload),
    onSuccess: () => {
      invalidateRelatedQueries({
        includeWbs: false,
        includeMilestones: false,
        includeStaffing: false,
        includeIssues: true,
      });
      toast.success(t('issues.toast.created'));
    },
    onError: (error) => toast.error(getErrorMessage(error, t('issues.toast.createFailed'))),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      issueId,
      payload,
      nextStatus,
      currentStatus,
    }: {
      issueId: number;
      payload: UpdateProjectIssuePayload;
      nextStatus?: ProjectIssue['status'];
      currentStatus: ProjectIssue['status'];
    }) => {
      const updatedIssue = await updateProjectIssue(teamId, projectId, issueId, payload);

      if (nextStatus && nextStatus !== currentStatus) {
        return updateProjectIssueStatus(teamId, projectId, issueId, { status: nextStatus });
      }

      return updatedIssue;
    },
    onSuccess: () => {
      invalidateRelatedQueries({
        includeWbs: false,
        includeMilestones: false,
        includeStaffing: false,
        includeIssues: true,
      });
      toast.success(t('issues.toast.updated'));
    },
    onError: (error) => toast.error(getErrorMessage(error, t('issues.toast.updateFailed'))),
  });

  const statusMutation = useMutation({
    mutationFn: ({
      issueId,
      nextStatus,
    }: {
      issueId: number;
      nextStatus: ProjectIssue['status'];
    }) => updateProjectIssueStatus(teamId, projectId, issueId, { status: nextStatus }),
    onSuccess: () => {
      invalidateRelatedQueries({
        includeWbs: false,
        includeMilestones: false,
        includeStaffing: false,
        includeIssues: true,
      });
      toast.success(t('issues.toast.statusUpdated'));
    },
    onError: (error) => toast.error(getErrorMessage(error, t('issues.toast.statusFailed'))),
  });

  const exportMutation = useMutation({
    mutationFn: () => downloadProjectIssuesExcel(teamId, projectId, normalizedFilters),
    onSuccess: (response) => {
      downloadBlob(response, 'project-issues.xlsx');
    },
    onError: (error) => toast.error(getErrorMessage(error, t('issues.toast.exportFailed'))),
  });

  const items = issuesQuery.data?.items ?? [];
  const resultCount = issuesQuery.data ? items.length : 0;
  const dialogSubmitting = createMutation.isPending || updateMutation.isPending;
  const advancingIssueId = statusMutation.isPending
    ? (statusMutation.variables?.issueId ?? null)
    : null;
  const locale = i18n.resolvedLanguage ?? i18n.language;

  /**
   * 필터 상태를 변경한다.
   *
   * @param nextState 부분 필터 상태
   */
  const handleFilterChange = (nextState: Partial<ProjectIssueFilterState>) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      ...nextState,
    }));
  };

  /**
   * 새 이슈 생성 다이얼로그를 연다.
   */
  const handleOpenCreate = () => {
    setSelectedIssue(null);
    setDialogMode('create');
    setDialogOpen(true);
  };

  /**
   * 이슈 다이얼로그를 연다.
   *
   * @param issue 대상 이슈
   */
  const handleOpenIssue = (issue: ProjectIssue) => {
    setSelectedIssue(issue);
    setDialogMode(canEdit ? 'edit' : 'view');
    setDialogOpen(true);
  };

  /**
   * 프로젝트 이슈 생성/수정 제출을 처리한다.
   *
   * @param payload 제출 payload
   * @param mode create 또는 edit
   */
  const handleDialogSubmit = async (payload: IssueDialogSubmitPayload, mode: 'create' | 'edit') => {
    if (mode === 'create') {
      await createMutation.mutateAsync({
        title: payload.title,
        description: payload.description,
        priority: payload.priority,
        assigneeUserId: payload.assigneeUserId,
      });
      return;
    }

    if (!selectedIssue) {
      return;
    }

    await updateMutation.mutateAsync({
      issueId: selectedIssue.id,
      payload: {
        title: payload.title,
        description: payload.description,
        priority: payload.priority,
        assigneeUserId: payload.assigneeUserId,
      },
      nextStatus: payload.status,
      currentStatus: selectedIssue.status,
    });
  };

  /**
   * 프로젝트 이슈 상태를 다음 단계로 전환한다.
   *
   * @param issue 상태를 변경할 이슈
   */
  const handleAdvanceStatus = async (issue: ProjectIssue) => {
    const nextStatus = getNextProjectIssueStatus(issue.status);
    if (!nextStatus) {
      return;
    }

    await statusMutation.mutateAsync({
      issueId: issue.id,
      nextStatus,
    });
  };

  /**
   * 목록을 수동 새로고침한다.
   */
  const handleRefresh = async () => {
    try {
      await issuesQuery.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error, t('issues.toast.refreshFailed')));
    }
  };

  /**
   * 필터를 초기 상태로 되돌린다.
   */
  const handleResetFilters = () => {
    setFilters(DEFAULT_PROJECT_ISSUE_FILTER_STATE);
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{t('issues.section.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('issues.section.description')}</p>
          {!canEdit ? (
            <p className="text-xs text-muted-foreground">{t('issues.status.readOnly')}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void handleRefresh()}>
            <RefreshCcw
              className={issuesQuery.isFetching ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'}
            />
            {t('issues.action.refresh')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          >
            <Download className="mr-2 h-4 w-4" />
            {exportMutation.isPending ? t('common.button.processing') : t('issues.action.export')}
          </Button>
          {canEdit ? (
            <Button type="button" onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t('issues.action.create')}
            </Button>
          ) : null}
        </div>
      </div>

      <IssueFilterBar
        filters={filters}
        members={membersQuery.data ?? []}
        hasActiveFilters={hasActiveFilters}
        resultCount={resultCount}
        isRefreshing={issuesQuery.isFetching && !issuesQuery.isLoading}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      <div className="space-y-4">
        {issuesQuery.isLoading && !issuesQuery.data ? (
          <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-border/75 bg-card/75">
            <Spinner text={t('issues.status.loading')} />
          </div>
        ) : issuesQuery.isError && !issuesQuery.data ? (
          <WorkspaceEmptyState
            icon={<CircleAlert className="h-6 w-6" />}
            title={t('issues.status.loadFailedTitle')}
            description={t('issues.status.loadFailed')}
            tone="error"
            role="alert"
            action={
              <Button onClick={() => void issuesQuery.refetch()}>
                {t('workspace.status.retry')}
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <WorkspaceEmptyState
            icon={<CircleAlert className="h-6 w-6" />}
            title={hasActiveFilters ? t('issues.empty.filteredTitle') : t('issues.empty.title')}
            description={
              hasActiveFilters
                ? t('issues.empty.filteredDescription')
                : canEdit
                  ? t('issues.empty.description')
                  : t('issues.empty.readOnlyDescription')
            }
            action={
              hasActiveFilters ? (
                <Button type="button" variant="outline" onClick={handleResetFilters}>
                  {t('issues.action.resetFilters')}
                </Button>
              ) : canEdit ? (
                <Button type="button" onClick={handleOpenCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('issues.action.create')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <IssueTable
                items={items}
                canEdit={canEdit}
                locale={locale}
                onOpenIssue={handleOpenIssue}
                onAdvanceStatus={(issue) => void handleAdvanceStatus(issue)}
                advancingIssueId={advancingIssueId}
              />
            </div>
            <div className="md:hidden">
              <IssueCardList
                items={items}
                canEdit={canEdit}
                locale={locale}
                onOpenIssue={handleOpenIssue}
                onAdvanceStatus={(issue) => void handleAdvanceStatus(issue)}
                advancingIssueId={advancingIssueId}
              />
            </div>
          </>
        )}
      </div>

      <IssueDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        issue={selectedIssue}
        members={membersQuery.data ?? []}
        locale={locale}
        onSubmit={handleDialogSubmit}
        loading={dialogSubmitting}
      />
    </div>
  );
}
