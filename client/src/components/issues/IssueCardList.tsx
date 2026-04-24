import type { MouseEvent } from 'react';
import { Check, Eye, Pencil, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatProjectDate } from '@/lib/format';
import {
  getNextProjectIssueStatus,
  getProjectIssuePriorityLabelKey,
  getProjectIssueStatusLabelKey,
  getProjectIssueTransitionLabelKey,
} from '@/lib/project-issues';
import { cn } from '@/lib/utils';
import type { ProjectIssue, ProjectIssuePriority, ProjectIssueStatus } from '@/types/issues';

/** 프로젝트 이슈 카드 리스트 props. */
interface IssueCardListProps {
  /** 렌더링할 이슈 목록 */
  items: ProjectIssue[];
  /** 프로젝트 편집 권한 */
  canEdit: boolean;
  /** 표시 locale */
  locale: string;
  /** 이슈 상세 열기 핸들러 */
  onOpenIssue: (issue: ProjectIssue) => void;
  /** 상태 전이 액션 핸들러 */
  onAdvanceStatus: (issue: ProjectIssue) => void;
  /** 상태 전이 진행 중 이슈 ID */
  advancingIssueId: number | null;
}

function getStatusBadgeClassName(status: ProjectIssueStatus): string {
  switch (status) {
    case 'REGISTERED':
      return 'border-slate-400/40 bg-slate-500/10 text-slate-700';
    case 'IN_PROGRESS':
      return 'border-primary/30 bg-primary/10 text-primary';
    case 'DONE':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700';
  }
}

function getPriorityBadgeClassName(priority: ProjectIssuePriority): string {
  switch (priority) {
    case 'LOW':
      return 'border-slate-400/35 bg-slate-500/8 text-slate-700';
    case 'MEDIUM':
      return 'border-indigo-500/25 bg-indigo-500/8 text-indigo-700';
    case 'HIGH':
      return 'border-orange-500/25 bg-orange-500/8 text-orange-700';
    case 'CRITICAL':
      return 'border-rose-500/25 bg-rose-500/8 text-rose-700';
  }
}

/**
 * 프로젝트 이슈 모바일 카드 리스트를 렌더링한다.
 *
 * @param props 카드 리스트 props
 * @returns 모바일 카드 리스트 JSX
 */
export default function IssueCardList({
  items,
  canEdit,
  locale,
  onOpenIssue,
  onAdvanceStatus,
  advancingIssueId,
}: IssueCardListProps) {
  const { t } = useTranslation();

  const stopCardClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
    <div className="space-y-3">
      {items.map((issue) => {
        const nextStatus = getNextProjectIssueStatus(issue.status);
        const transitionLabelKey = getProjectIssueTransitionLabelKey(issue.status);
        const actionLabel = canEdit ? t('issues.action.edit') : t('issues.action.view');

        return (
          <Card
            key={issue.id}
            className={cn(!canEdit && 'cursor-pointer')}
            onClick={!canEdit ? () => onOpenIssue(issue) : undefined}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{issue.title}</h3>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className={cn('font-medium', getStatusBadgeClassName(issue.status))}
                >
                  {t(getProjectIssueStatusLabelKey(issue.status))}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn('font-medium', getPriorityBadgeClassName(issue.priority))}
                >
                  {t(getProjectIssuePriorityLabelKey(issue.priority))}
                </Badge>
              </div>

              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {t('issues.list.column.assignee')}
                </span>{' '}
                {issue.assigneeName ?? t('issues.filter.unassigned')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {t('issues.list.column.updatedAt')}
                </span>{' '}
                {formatProjectDate(issue.updatedAt, locale)}
              </p>

              {issue.description ? (
                <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">
                  {issue.description}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={
                    canEdit
                      ? t('issues.aria.edit', { title: issue.title })
                      : t('issues.aria.view', { title: issue.title })
                  }
                  onClick={(event) => {
                    stopCardClick(event);
                    onOpenIssue(issue);
                  }}
                >
                  {canEdit ? <Pencil className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                  {actionLabel}
                </Button>

                {canEdit ? (
                  nextStatus && transitionLabelKey ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={advancingIssueId === issue.id}
                      onClick={(event) => {
                        stopCardClick(event);
                        onAdvanceStatus(issue);
                      }}
                    >
                      {issue.status === 'REGISTERED' ? (
                        <Play className="mr-2 h-4 w-4" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      {advancingIssueId === issue.id
                        ? t('common.button.processing')
                        : t(transitionLabelKey)}
                    </Button>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('issues.status.done')}
                    </span>
                  )
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
