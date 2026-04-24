import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatProjectDate } from '@/lib/format';
import {
  getProjectIssueEditableStatuses,
  getProjectIssuePriorityLabelKey,
  getProjectIssueStatusLabelKey,
  PROJECT_ISSUE_FILTER_UNASSIGNED,
  PROJECT_ISSUE_PRIORITY_VALUES,
} from '@/lib/project-issues';
import { cn } from '@/lib/utils';
import type { ProjectIssue, ProjectIssuePriority, ProjectIssueStatus } from '@/types/issues';
import type { TeamMember } from '@/types/team';

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 4000;

/** 프로젝트 이슈 다이얼로그 모드. */
export type IssueDialogMode = 'create' | 'edit' | 'view';

/** 프로젝트 이슈 다이얼로그 제출 payload. */
export interface IssueDialogSubmitPayload {
  /** 제목 */
  title: string;
  /** 설명 */
  description: string;
  /** 우선순위 */
  priority: ProjectIssuePriority;
  /** 담당자 사용자 ID */
  assigneeUserId: number | null;
  /** 상태 */
  status?: ProjectIssueStatus;
}

/** 프로젝트 이슈 다이얼로그 props. */
interface IssueDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 다이얼로그 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 다이얼로그 모드 */
  mode: IssueDialogMode;
  /** 현재 선택된 이슈 */
  issue: ProjectIssue | null;
  /** 팀 멤버 목록 */
  members: TeamMember[];
  /** 표시 locale */
  locale: string;
  /** 제출 핸들러 */
  onSubmit: (payload: IssueDialogSubmitPayload, mode: 'create' | 'edit') => Promise<void>;
  /** 제출 중 여부 */
  loading?: boolean;
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

/**
 * 프로젝트 이슈 생성/수정/조회 다이얼로그를 렌더링한다.
 *
 * @param props 다이얼로그 props
 * @returns 프로젝트 이슈 다이얼로그 JSX
 */
export default function IssueDialog({
  open,
  onOpenChange,
  mode,
  issue,
  members,
  locale,
  onSubmit,
  loading = false,
}: IssueDialogProps) {
  const { t } = useTranslation();
  const isCreate = mode === 'create';
  const isEdit = mode === 'edit';
  const isView = mode === 'view';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<ProjectIssuePriority>('MEDIUM');
  const [assigneeValue, setAssigneeValue] = useState(PROJECT_ISSUE_FILTER_UNASSIGNED);
  const [status, setStatus] = useState<ProjectIssueStatus>('REGISTERED');

  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTitle(issue?.title ?? '');
    setDescription(issue?.description ?? '');
    setPriority(issue?.priority ?? 'MEDIUM');
    setAssigneeValue(
      issue?.assigneeUserId != null
        ? String(issue.assigneeUserId)
        : PROJECT_ISSUE_FILTER_UNASSIGNED,
    );
    setStatus(issue?.status ?? 'REGISTERED');
  }, [issue, open]);

  useEffect(() => {
    if (!open || isView) {
      return;
    }

    const timer = window.setTimeout(() => titleInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isView, open]);

  const editableStatuses = useMemo(
    () => getProjectIssueEditableStatuses(issue?.status ?? 'REGISTERED'),
    [issue?.status],
  );

  const assigneeOptions = useMemo(() => {
    if (
      !issue ||
      issue.assigneeUserId == null ||
      members.some((member) => member.userId === issue.assigneeUserId)
    ) {
      return members;
    }

    return [
      {
        userId: issue.assigneeUserId,
        name: issue.assigneeName ?? t('issues.filter.unassigned'),
        loginId: issue.assigneeLoginId ?? '',
        role: 'VIEWER' as const,
      },
      ...members,
    ];
  }, [issue, members, t]);

  const assigneeLabel = issue?.assigneeName ?? t('issues.filter.unassigned');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isView) {
      return;
    }

    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();

    if (normalizedTitle.length === 0) {
      toast.error(t('issues.validation.titleRequired'));
      return;
    }

    if (normalizedTitle.length > MAX_TITLE_LENGTH) {
      toast.error(t('issues.validation.titleTooLong', { max: MAX_TITLE_LENGTH }));
      return;
    }

    if (normalizedDescription.length > MAX_DESCRIPTION_LENGTH) {
      toast.error(t('issues.validation.descriptionTooLong', { max: MAX_DESCRIPTION_LENGTH }));
      return;
    }

    if (!PROJECT_ISSUE_PRIORITY_VALUES.includes(priority)) {
      toast.error(t('issues.validation.priorityInvalid'));
      return;
    }

    const assigneeUserId =
      assigneeValue === PROJECT_ISSUE_FILTER_UNASSIGNED ? null : Number(assigneeValue);

    if (assigneeUserId != null && (!Number.isInteger(assigneeUserId) || assigneeUserId <= 0)) {
      toast.error(t('issues.validation.assigneeInvalid'));
      return;
    }

    if (isEdit && !editableStatuses.includes(status)) {
      toast.error(t('issues.validation.statusInvalid'));
      return;
    }

    try {
      await onSubmit(
        {
          title: normalizedTitle,
          description: normalizedDescription,
          priority,
          assigneeUserId,
          status: isEdit ? status : undefined,
        },
        isCreate ? 'create' : 'edit',
      );
      onOpenChange(false);
    } catch {
      // mutateAsync error는 상위에서 toast 처리한다.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {isCreate
              ? t('issues.form.createTitle')
              : isEdit
                ? t('issues.form.editTitle')
                : t('issues.form.viewTitle')}
          </DialogTitle>
          <DialogDescription>
            {isCreate
              ? t('issues.form.createDescription')
              : isEdit
                ? t('issues.form.editDescription')
                : t('issues.form.viewDescription')}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="issue-title">{t('issues.form.title')}</Label>
            <Input
              id="issue-title"
              ref={titleInputRef}
              readOnly={isView}
              maxLength={MAX_TITLE_LENGTH}
              placeholder={isView ? undefined : t('issues.form.titlePlaceholder')}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            {!isView ? (
              <p className="text-xs text-muted-foreground">
                {t('issues.form.titleHint', {
                  current: title.trim().length,
                  max: MAX_TITLE_LENGTH,
                })}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-description">{t('issues.form.description')}</Label>
            <Textarea
              id="issue-description"
              readOnly={isView}
              maxLength={MAX_DESCRIPTION_LENGTH}
              placeholder={isView ? undefined : t('issues.form.descriptionPlaceholder')}
              className="min-h-[160px]"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            {!isView ? (
              <p className="text-xs text-muted-foreground">
                {t('issues.form.descriptionHint', {
                  current: description.trim().length,
                  max: MAX_DESCRIPTION_LENGTH,
                })}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="issue-priority">{t('issues.form.priority')}</Label>
              {isView ? (
                <Input
                  id="issue-priority"
                  readOnly
                  value={t(getProjectIssuePriorityLabelKey(priority))}
                />
              ) : (
                <Select
                  value={priority}
                  onValueChange={(nextValue) => setPriority(nextValue as ProjectIssuePriority)}
                >
                  <SelectTrigger id="issue-priority">
                    <SelectValue placeholder={t('issues.form.priorityPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_ISSUE_PRIORITY_VALUES.map((priorityValue) => (
                      <SelectItem key={priorityValue} value={priorityValue}>
                        {t(getProjectIssuePriorityLabelKey(priorityValue))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="issue-assignee">{t('issues.form.assignee')}</Label>
              {isView ? (
                <div className="space-y-1">
                  <Input id="issue-assignee" readOnly value={assigneeLabel} />
                  {issue?.assigneeLoginId ? (
                    <p className="text-xs text-muted-foreground">{issue.assigneeLoginId}</p>
                  ) : null}
                </div>
              ) : (
                <Select value={assigneeValue} onValueChange={setAssigneeValue}>
                  <SelectTrigger id="issue-assignee">
                    <SelectValue placeholder={t('issues.form.assigneePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PROJECT_ISSUE_FILTER_UNASSIGNED}>
                      {t('issues.filter.unassigned')}
                    </SelectItem>
                    {assigneeOptions.map((member) => (
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
              )}
            </div>
          </div>

          {isCreate ? null : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="issue-status">{t('issues.form.status')}</Label>
                {isView ? (
                  <div
                    id="issue-status"
                    className="flex h-10 items-center rounded-md border border-border/75 bg-secondary/20 px-3"
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        'font-medium',
                        getStatusBadgeClassName(issue?.status ?? 'REGISTERED'),
                      )}
                    >
                      {t(getProjectIssueStatusLabelKey(issue?.status ?? 'REGISTERED'))}
                    </Badge>
                  </div>
                ) : (
                  <Select
                    value={status}
                    onValueChange={(nextValue) => setStatus(nextValue as ProjectIssueStatus)}
                  >
                    <SelectTrigger id="issue-status">
                      <SelectValue placeholder={t('issues.form.statusPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {editableStatuses.map((statusOption) => (
                        <SelectItem key={statusOption} value={statusOption}>
                          {t(getProjectIssueStatusLabelKey(statusOption))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          {isCreate ? null : (
            <div className="rounded-lg border border-border/75 bg-secondary/18 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {t('issues.form.createdAt')}
                  </p>
                  <p className="text-sm text-foreground">
                    {issue ? formatProjectDate(issue.createdAt, locale) : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {t('issues.form.updatedAt')}
                  </p>
                  <p className="text-sm text-foreground">
                    {issue ? formatProjectDate(issue.updatedAt, locale) : '-'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.button.close')}
            </Button>
            {isView ? null : (
              <Button type="submit" disabled={loading}>
                {loading
                  ? isCreate
                    ? t('issues.form.creating')
                    : t('issues.form.saving')
                  : isCreate
                    ? t('issues.action.create')
                    : t('issues.form.saveAction')}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
