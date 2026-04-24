import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getProjectIssueStatusLabelKey,
  PROJECT_ISSUE_FILTER_ALL,
  PROJECT_ISSUE_FILTER_UNASSIGNED,
  PROJECT_ISSUE_PRIORITY_VALUES,
  PROJECT_ISSUE_STATUS_VALUES,
  type ProjectIssueFilterState,
  getProjectIssuePriorityLabelKey,
} from '@/lib/project-issues';
import type { TeamMember } from '@/types/team';

/** 프로젝트 이슈 필터 바 props. */
interface IssueFilterBarProps {
  /** 현재 필터 상태 */
  filters: ProjectIssueFilterState;
  /** 현재 팀 멤버 목록 */
  members: TeamMember[];
  /** 필터 활성화 여부 */
  hasActiveFilters: boolean;
  /** 현재 화면에 보이는 결과 수 */
  resultCount: number;
  /** 목록 갱신 중 여부 */
  isRefreshing: boolean;
  /** 필터 부분 변경 핸들러 */
  onChange: (nextState: Partial<ProjectIssueFilterState>) => void;
  /** 필터 초기화 핸들러 */
  onReset: () => void;
}

/**
 * 프로젝트 이슈 필터 바를 렌더링한다.
 *
 * @param props 필터 바 props
 * @returns 프로젝트 이슈 필터 바 JSX
 */
export default function IssueFilterBar({
  filters,
  members,
  hasActiveFilters,
  resultCount,
  isRefreshing,
  onChange,
  onReset,
}: IssueFilterBarProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-border/75 bg-secondary/20 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_220px_260px] xl:items-end">
          <div className="space-y-2">
            <Label>{t('issues.filter.status')}</Label>
            <div className="flex flex-wrap gap-2 rounded-lg border border-border/70 bg-background/75 p-1">
              <Button
                type="button"
                size="sm"
                variant={filters.status === PROJECT_ISSUE_FILTER_ALL ? 'secondary' : 'ghost'}
                aria-pressed={filters.status === PROJECT_ISSUE_FILTER_ALL}
                onClick={() => onChange({ status: PROJECT_ISSUE_FILTER_ALL })}
              >
                {t('issues.filter.allStatuses')}
              </Button>
              {PROJECT_ISSUE_STATUS_VALUES.map((status) => (
                <Button
                  key={status}
                  type="button"
                  size="sm"
                  variant={filters.status === status ? 'secondary' : 'ghost'}
                  aria-pressed={filters.status === status}
                  onClick={() => onChange({ status })}
                >
                  {t(getProjectIssueStatusLabelKey(status))}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="issues-filter-priority">{t('issues.filter.priority')}</Label>
            <Select
              value={filters.priority}
              onValueChange={(value) =>
                onChange({
                  priority:
                    value === PROJECT_ISSUE_FILTER_ALL
                      ? PROJECT_ISSUE_FILTER_ALL
                      : (value as ProjectIssueFilterState['priority']),
                })
              }
            >
              <SelectTrigger id="issues-filter-priority">
                <SelectValue placeholder={t('issues.filter.allPriorities')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PROJECT_ISSUE_FILTER_ALL}>
                  {t('issues.filter.allPriorities')}
                </SelectItem>
                {PROJECT_ISSUE_PRIORITY_VALUES.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {t(getProjectIssuePriorityLabelKey(priority))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="issues-filter-assignee">{t('issues.filter.assignee')}</Label>
            <Select
              value={filters.assignee}
              onValueChange={(value) => onChange({ assignee: value })}
            >
              <SelectTrigger id="issues-filter-assignee">
                <SelectValue placeholder={t('issues.filter.allAssignees')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PROJECT_ISSUE_FILTER_ALL}>
                  {t('issues.filter.allAssignees')}
                </SelectItem>
                <SelectItem value={PROJECT_ISSUE_FILTER_UNASSIGNED}>
                  {t('issues.filter.unassigned')}
                </SelectItem>
                {members.map((member) => (
                  <SelectItem
                    key={member.userId}
                    value={String(member.userId)}
                    secondaryText={member.loginId}
                    textValue={member.name}
                  >
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
          <p className="text-sm text-muted-foreground">
            {t('issues.filter.resultCount', { count: resultCount })}
          </p>
          {isRefreshing ? (
            <p className="text-xs text-muted-foreground">{t('issues.status.refreshing')}</p>
          ) : null}
          {hasActiveFilters ? (
            <Button type="button" size="sm" variant="ghost" onClick={onReset}>
              {t('issues.action.resetFilters')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
