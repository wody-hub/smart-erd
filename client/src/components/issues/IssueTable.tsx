import type { KeyboardEvent, MouseEvent } from 'react';
import { Check, Eye, Pencil, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatProjectDate } from '@/lib/format';
import {
  getNextProjectIssueStatus,
  getProjectIssuePriorityLabelKey,
  getProjectIssueStatusLabelKey,
  getProjectIssueTransitionLabelKey,
} from '@/lib/project-issues';
import { cn } from '@/lib/utils';
import type { ProjectIssue, ProjectIssuePriority, ProjectIssueStatus } from '@/types/issues';

/** 프로젝트 이슈 테이블 props. */
interface IssueTableProps {
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
 * 프로젝트 이슈 테이블을 렌더링한다.
 *
 * @param props 테이블 props
 * @returns 프로젝트 이슈 테이블 JSX
 */
export default function IssueTable({
  items,
  canEdit,
  locale,
  onOpenIssue,
  onAdvanceStatus,
  advancingIssueId,
}: IssueTableProps) {
  const { t } = useTranslation();

  const handleOpenFromRow = (issue: ProjectIssue) => {
    if (!canEdit) {
      onOpenIssue(issue);
    }
  };

  const handleReadOnlyRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    issue: ProjectIssue,
  ) => {
    if (canEdit) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenIssue(issue);
    }
  };

  const stopRowClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
    <Table className="min-w-[980px]">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[120px]">{t('issues.list.column.status')}</TableHead>
          <TableHead className="w-[120px]">{t('issues.list.column.priority')}</TableHead>
          <TableHead className="min-w-[420px]">{t('issues.list.column.issue')}</TableHead>
          <TableHead className="w-[180px]">{t('issues.list.column.assignee')}</TableHead>
          <TableHead className="w-[160px]">{t('issues.list.column.updatedAt')}</TableHead>
          <TableHead className="w-[220px]">{t('issues.list.column.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((issue) => {
          const nextStatus = getNextProjectIssueStatus(issue.status);
          const transitionLabelKey = getProjectIssueTransitionLabelKey(issue.status);
          const actionLabel = canEdit ? t('issues.action.edit') : t('issues.action.view');
          const actionAriaLabel = canEdit
            ? t('issues.aria.edit', { title: issue.title })
            : t('issues.aria.view', { title: issue.title });

          return (
            <TableRow
              key={issue.id}
              role={!canEdit ? 'button' : undefined}
              tabIndex={!canEdit ? 0 : undefined}
              className={cn(!canEdit && 'cursor-pointer')}
              onClick={() => handleOpenFromRow(issue)}
              onKeyDown={(event) => handleReadOnlyRowKeyDown(event, issue)}
            >
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn('font-medium', getStatusBadgeClassName(issue.status))}
                >
                  {t(getProjectIssueStatusLabelKey(issue.status))}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn('font-medium', getPriorityBadgeClassName(issue.priority))}
                >
                  {t(getProjectIssuePriorityLabelKey(issue.priority))}
                </Badge>
              </TableCell>
              <TableCell className="min-w-[420px]">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{issue.title}</p>
                  {issue.description ? (
                    <p className="line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">
                      {issue.description}
                    </p>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                {issue.assigneeName ? (
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">{issue.assigneeName}</p>
                    <p className="text-xs text-muted-foreground">{issue.assigneeLoginId}</p>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {t('issues.filter.unassigned')}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatProjectDate(issue.updatedAt, locale)}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={actionAriaLabel}
                    onClick={(event) => {
                      stopRowClick(event);
                      onOpenIssue(issue);
                    }}
                  >
                    {canEdit ? (
                      <Pencil className="mr-2 h-4 w-4" />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" />
                    )}
                    {actionLabel}
                  </Button>

                  {canEdit ? (
                    nextStatus && transitionLabelKey ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={advancingIssueId === issue.id}
                        aria-label={t('issues.aria.advance', {
                          title: issue.title,
                          status: t(getProjectIssueStatusLabelKey(nextStatus)),
                        })}
                        onClick={(event) => {
                          stopRowClick(event);
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
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
