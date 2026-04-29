import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Link2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  createMilestone,
  deleteMilestone,
  fetchMilestones,
  updateMilestone,
} from '@/api/milestoneApi';
import { fetchMembers } from '@/api/teamApi';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import MilestoneFormDialog from '@/components/milestone/MilestoneFormDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Spinner from '@/components/ui/spinner';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import { queryKeys } from '@/constants/query-keys';
import { useProjectQueryInvalidation } from '@/hooks/useProjectQueryInvalidation';
import { getErrorMessage } from '@/lib/api-error';
import { formatProjectDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CreateMilestonePayload, Milestone, UpdateMilestonePayload } from '@/types/milestone';

/** MilestonePanel 컴포넌트 props. */
interface MilestonePanelProps {
  /** 팀 ID */
  teamId: string;
  /** 프로젝트 ID */
  projectId: string;
  /** 편집 가능 여부 */
  canEdit: boolean;
}

/**
 * 마일스톤 패널을 렌더링한다.
 *
 * @param props MilestonePanel props
 * @returns 마일스톤 패널 JSX
 */
export default function MilestonePanel({ teamId, projectId, canEdit }: MilestonePanelProps) {
  const { t, i18n } = useTranslation();
  const invalidateRelatedQueries = useProjectQueryInvalidation(teamId, projectId);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Milestone | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Milestone | null>(null);
  const [filter, setFilter] = useState<'all' | 'approval' | 'delayed'>('all');

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
    mutationFn: (payload: CreateMilestonePayload) => createMilestone(teamId, projectId, payload),
    onSuccess: () => {
      invalidateRelatedQueries();
      toast.success(t('milestone.toast.created'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('milestone.toast.createFailed'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      milestoneId,
      payload,
    }: {
      milestoneId: number;
      payload: UpdateMilestonePayload;
    }) => updateMilestone(teamId, projectId, milestoneId, payload),
    onSuccess: () => {
      invalidateRelatedQueries();
      toast.success(t('milestone.toast.updated'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('milestone.toast.updateFailed'))),
  });

  const deleteMutation = useMutation({
    mutationFn: (milestoneId: number) => deleteMilestone(teamId, projectId, milestoneId),
    onSuccess: () => {
      invalidateRelatedQueries();
      setDeleteTarget(null);
      toast.success(t('milestone.toast.deleted'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('milestone.toast.deleteFailed'))),
  });

  /**
   * 생성/수정 폼 제출을 처리한다.
   *
   * @param payload 생성/수정 payload
   */
  const handleSubmit = async (payload: CreateMilestonePayload) => {
    if (editTarget) {
      await updateMutation.mutateAsync({ milestoneId: editTarget.id, payload });
      return;
    }
    await createMutation.mutateAsync(payload);
  };

  if (milestonesQuery.isLoading && !milestonesQuery.data) {
    return <Spinner text={t('common.loading')} />;
  }

  if (milestonesQuery.isError) {
    return (
      <WorkspaceEmptyState
        icon={<CalendarClock className="h-10 w-10" />}
        title={t('workspace.status.loadFailedTitle')}
        description={t('milestone.toast.loadFailed')}
        tone="error"
        role="alert"
        action={
          <Button variant="outline" onClick={() => void milestonesQuery.refetch()}>
            {t('workspace.status.retry')}
          </Button>
        }
      />
    );
  }

  const milestones = milestonesQuery.data ?? [];
  const filteredMilestones = milestones.filter((milestone) => {
    if (filter === 'approval') {
      return milestone.type === 'APPROVAL';
    }
    if (filter === 'delayed') {
      return milestone.isDelayed;
    }
    return true;
  });
  const locale = i18n.resolvedLanguage ?? i18n.language;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">{t('milestone.section.title')}</CardTitle>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => {
                setEditTarget(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('milestone.action.create')}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t('milestone.section.description')}</p>
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'approval', 'delayed'] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={filter === value ? 'default' : 'outline'}
              onClick={() => setFilter(value)}
            >
              {t(`milestone.filter.${value}`)}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {milestones.length === 0 ? (
          <WorkspaceEmptyState
            icon={<CalendarClock className="h-10 w-10" />}
            title={t('milestone.empty.title')}
            description={t('milestone.empty.description')}
            action={
              canEdit ? (
                <Button
                  onClick={() => {
                    setEditTarget(null);
                    setFormOpen(true);
                  }}
                >
                  {t('milestone.action.create')}
                </Button>
              ) : undefined
            }
          />
        ) : filteredMilestones.length === 0 ? (
          <WorkspaceEmptyState
            icon={<CalendarClock className="h-10 w-10" />}
            title={t('milestone.filter.emptyTitle')}
            description={t('milestone.filter.emptyDescription')}
          />
        ) : (
          <div className="space-y-3">
            {filteredMilestones.map((milestone) => {
              const isDelayed = milestone.isDelayed;
              const achievementRate = Math.min(Math.max(milestone.achievementRate, 0), 100);
              const linkedWbsItemCount = milestone.linkedWbsItemCount ?? 0;

              return (
                <div
                  key={milestone.id}
                  className={cn(
                    'rounded-xl border bg-card p-4 shadow-sm',
                    isDelayed
                      ? 'border-destructive/30 bg-destructive/5'
                      : 'border-success/30 bg-success/5',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-foreground">
                          {milestone.name}
                        </h3>
                        <Badge variant="outline">{t(`milestone.type.${milestone.type}`)}</Badge>
                        <Badge variant={isDelayed ? 'destructive' : 'secondary'}>
                          {isDelayed
                            ? t('milestone.status.delayed')
                            : t('milestone.status.onTrack')}
                        </Badge>
                      </div>

                      <p
                        className={cn(
                          'inline-flex items-center gap-1 text-sm font-medium',
                          isDelayed ? 'text-destructive' : 'text-success',
                        )}
                      >
                        {isDelayed ? (
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                        )}
                        <span>{t('milestone.field.targetDate')}:</span>
                        <span>{formatProjectDate(milestone.targetDate, locale)}</span>
                      </p>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {t('milestone.field.achievementRate')}
                          </span>
                          <span
                            className={cn(
                              'font-semibold tabular-nums',
                              isDelayed ? 'text-destructive' : 'text-success',
                            )}
                          >
                            {achievementRate}%
                          </span>
                        </div>
                        <div
                          className="h-2 overflow-hidden rounded-full bg-muted"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={achievementRate}
                          aria-label={`${milestone.name} ${achievementRate}%`}
                        >
                          <div
                            className={cn(
                              'h-full rounded-full transition-[width]',
                              isDelayed ? 'bg-destructive' : 'bg-success',
                            )}
                            style={{ width: `${achievementRate}%` }}
                          />
                        </div>
                      </div>

                      <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Link2 className="h-3.5 w-3.5 shrink-0" />
                        {t('milestone.field.linkedWbsCount', { count: linkedWbsItemCount })}
                      </p>

                      <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        {t('milestone.field.blockingCount', {
                          count: milestone.inboundDependencyCount,
                        })}
                      </p>

                      <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <UserRound className="h-3.5 w-3.5 shrink-0" />
                        {milestone.ownerName
                          ? t('milestone.field.ownerValue', { name: milestone.ownerName })
                          : t('milestone.field.noOwner')}
                      </p>

                      <p className="inline-flex items-start gap-1 text-xs text-muted-foreground">
                        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          {milestone.readinessNote?.trim() || t('milestone.field.noReadinessNote')}
                        </span>
                      </p>

                      <p className="text-sm text-muted-foreground">
                        {milestone.description ?? t('milestone.field.noDescription')}
                      </p>
                    </div>

                    {canEdit && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditTarget(milestone);
                            setFormOpen(true);
                          }}
                          aria-label={t('milestone.aria.edit', { name: milestone.name })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDeleteTarget(milestone)}
                          aria-label={t('milestone.aria.delete', { name: milestone.name })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <MilestoneFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditTarget(null);
          }
        }}
        initialData={editTarget}
        onSubmit={handleSubmit}
        members={membersQuery.data ?? []}
        membersLoading={membersQuery.isLoading}
        membersError={membersQuery.isError}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title={t('milestone.delete.title')}
        description={t('milestone.delete.description', {
          name: deleteTarget?.name ?? '',
        })}
        onConfirm={() => {
          if (!deleteTarget) {
            return;
          }
          deleteMutation.mutate(deleteTarget.id);
        }}
        loading={deleteMutation.isPending}
      />
    </Card>
  );
}
