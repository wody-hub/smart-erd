import { useEffect, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TFunction } from 'i18next';
import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatProjectDate, isDateOrderValid } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Milestone } from '@/types/milestone';
import type { TeamMember } from '@/types/team';
import type { UpdateWbsItemPayload, WbsItem } from '@/types/wbs';
import { TREE_INDENT } from './wbs-tree-utils';

const UNASSIGNED_VALUE = '__unassigned__';
const NO_MILESTONE_VALUE = '__none__';

type InlineEditor =
  | 'name'
  | 'assignee'
  | 'period'
  | 'progress'
  | 'estimatedMm'
  | 'milestone'
  | null;

/** SortableWbsRow 컴포넌트 props. */
export interface SortableWbsRowProps {
  /** WBS 항목 */
  item: WbsItem;
  /** 편집 가능 여부 */
  canEdit: boolean;
  /** 로케일 */
  locale: string;
  /** 담당자 이름 */
  assigneeName: string | null;
  /** 연결 마일스톤 이름 */
  milestoneName: string | null;
  /** 자식 항목 존재 여부 */
  hasChildren: boolean;
  /** 접힌 상태 여부 */
  collapsed: boolean;
  /** 비활성 여부 */
  disabled: boolean;
  /** 강조 상태 */
  highlighted?: boolean;
  /** 번역 함수 */
  t: TFunction;
  /** 팀 멤버 목록 */
  members: TeamMember[];
  /** 마일스톤 목록 */
  milestones: Milestone[];
  /** 담당자 목록 사용 불가 여부 */
  membersUnavailable: boolean;
  /** 접기/펼치기 토글 핸들러 */
  onToggleCollapse: (id: number) => void;
  /** 인라인 이름 수정 핸들러 */
  onInlineNameSubmit: (item: WbsItem, nextName: string) => void;
  /** 인라인 진척률 수정 핸들러 */
  onInlineProgressSubmit: (item: WbsItem, nextProgress: number) => void;
  /** 인라인 담당자 수정 핸들러 */
  onInlineAssigneeSubmit: (item: WbsItem, nextAssigneeUserId: number | null) => void;
  /** 인라인 기간 수정 핸들러 */
  onInlinePeriodSubmit: (
    item: WbsItem,
    nextPeriod: Pick<UpdateWbsItemPayload, 'startDate' | 'endDate'>,
  ) => void;
  /** 인라인 예상 M/M 수정 핸들러 */
  onInlineEstimatedMmSubmit: (item: WbsItem, nextEstimatedMm: number | null) => void;
  /** 인라인 마일스톤 수정 핸들러 */
  onInlineMilestoneSubmit: (item: WbsItem, nextMilestoneId: number | null) => void;
  /** 수정 다이얼로그 열기 핸들러 */
  onOpenEditDialog: (item: WbsItem) => void;
  /** 이동 다이얼로그 열기 핸들러 */
  onOpenMoveDialog: (item: WbsItem) => void;
  /** 삭제 요청 핸들러 */
  onRequestDelete: (item: WbsItem) => void;
  /** 행 선택 핸들러 */
  onSelect?: (item: WbsItem) => void;
  /** 현재 선택 상태 */
  selected?: boolean;
}

function formatPeriod(
  startDate: string | null,
  endDate: string | null,
  locale: string,
  t: TFunction,
): string {
  if (startDate && endDate) {
    return `${formatProjectDate(startDate, locale)} ~ ${formatProjectDate(endDate, locale)}`;
  }
  if (startDate) {
    return `${formatProjectDate(startDate, locale)} ~ -`;
  }
  if (endDate) {
    return `- ~ ${formatProjectDate(endDate, locale)}`;
  }
  return t('wbs.field.noPeriod');
}

function InlineActionButtons({
  disabled,
  onConfirm,
  onCancel,
}: {
  disabled: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onConfirm}
        disabled={disabled}
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onCancel}
        disabled={disabled}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * 정렬 가능한 WBS 행을 렌더링한다.
 *
 * @param props SortableWbsRow props
 * @returns WBS 단일 행 JSX
 */
export default function SortableWbsRow({
  item,
  canEdit,
  locale,
  assigneeName,
  milestoneName,
  hasChildren,
  collapsed,
  disabled,
  highlighted = false,
  t,
  members,
  milestones,
  membersUnavailable,
  onToggleCollapse,
  onInlineNameSubmit,
  onInlineProgressSubmit,
  onInlineAssigneeSubmit,
  onInlinePeriodSubmit,
  onInlineEstimatedMmSubmit,
  onInlineMilestoneSubmit,
  onOpenEditDialog,
  onOpenMoveDialog,
  onRequestDelete,
  onSelect,
  selected = false,
}: SortableWbsRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !canEdit || disabled,
  });
  const [activeEditor, setActiveEditor] = useState<InlineEditor>(null);
  const [nameValue, setNameValue] = useState(item.name);
  const [progressValue, setProgressValue] = useState(String(item.progressRate));
  const [assigneeValue, setAssigneeValue] = useState(
    item.assigneeUserId == null ? UNASSIGNED_VALUE : String(item.assigneeUserId),
  );
  const [startDateValue, setStartDateValue] = useState(item.startDate ?? '');
  const [endDateValue, setEndDateValue] = useState(item.endDate ?? '');
  const [estimatedMmValue, setEstimatedMmValue] = useState(
    item.estimatedMm == null ? '' : String(item.estimatedMm),
  );
  const [milestoneValue, setMilestoneValue] = useState(
    item.milestoneId == null ? NO_MILESTONE_VALUE : String(item.milestoneId),
  );

  useEffect(() => {
    if (activeEditor != null) {
      return;
    }
    setNameValue(item.name);
    setProgressValue(String(item.progressRate));
    setAssigneeValue(item.assigneeUserId == null ? UNASSIGNED_VALUE : String(item.assigneeUserId));
    setStartDateValue(item.startDate ?? '');
    setEndDateValue(item.endDate ?? '');
    setEstimatedMmValue(item.estimatedMm == null ? '' : String(item.estimatedMm));
    setMilestoneValue(item.milestoneId == null ? NO_MILESTONE_VALUE : String(item.milestoneId));
  }, [activeEditor, item]);

  const closeEditor = () => {
    setActiveEditor(null);
    setNameValue(item.name);
    setProgressValue(String(item.progressRate));
    setAssigneeValue(item.assigneeUserId == null ? UNASSIGNED_VALUE : String(item.assigneeUserId));
    setStartDateValue(item.startDate ?? '');
    setEndDateValue(item.endDate ?? '');
    setEstimatedMmValue(item.estimatedMm == null ? '' : String(item.estimatedMm));
    setMilestoneValue(item.milestoneId == null ? NO_MILESTONE_VALUE : String(item.milestoneId));
  };

  const startEditor = (editor: Exclude<InlineEditor, null>) => {
    if (!canEdit || disabled) {
      return;
    }
    setActiveEditor(editor);
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLElement>, onConfirm: () => void) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onConfirm();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeEditor();
    }
  };

  const confirmNameEdit = () => {
    const trimmed = nameValue.trim();
    if (!trimmed) {
      closeEditor();
      return;
    }
    if (trimmed !== item.name) {
      onInlineNameSubmit(item, trimmed);
    }
    setActiveEditor(null);
  };

  const confirmProgressEdit = () => {
    const parsed = Number(progressValue);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      toast.error(t('wbs.validation.progressRate'));
      return;
    }
    if (parsed !== item.progressRate) {
      onInlineProgressSubmit(item, parsed);
    }
    setActiveEditor(null);
  };

  const confirmAssigneeEdit = () => {
    const nextAssigneeUserId =
      assigneeValue === UNASSIGNED_VALUE ? null : Number.parseInt(assigneeValue, 10);
    if (nextAssigneeUserId !== item.assigneeUserId) {
      onInlineAssigneeSubmit(item, nextAssigneeUserId);
    }
    setActiveEditor(null);
  };

  const confirmPeriodEdit = () => {
    if (!isDateOrderValid(startDateValue, endDateValue)) {
      toast.error(t('wbs.validation.dateOrder'));
      return;
    }
    const nextStartDate = startDateValue || null;
    const nextEndDate = endDateValue || null;
    if (nextStartDate !== item.startDate || nextEndDate !== item.endDate) {
      onInlinePeriodSubmit(item, {
        startDate: nextStartDate,
        endDate: nextEndDate,
      });
    }
    setActiveEditor(null);
  };

  const confirmEstimatedMmEdit = () => {
    let nextEstimatedMm: number | null = null;
    if (estimatedMmValue.trim() !== '') {
      nextEstimatedMm = Number(estimatedMmValue);
      if (Number.isNaN(nextEstimatedMm) || nextEstimatedMm < 0) {
        toast.error(t('wbs.validation.estimatedMm'));
        return;
      }
    }
    if (nextEstimatedMm !== item.estimatedMm) {
      onInlineEstimatedMmSubmit(item, nextEstimatedMm);
    }
    setActiveEditor(null);
  };

  const confirmMilestoneEdit = () => {
    const nextMilestoneId =
      milestoneValue === NO_MILESTONE_VALUE ? null : Number.parseInt(milestoneValue, 10);
    if (nextMilestoneId !== item.milestoneId) {
      onInlineMilestoneSubmit(item, nextMilestoneId);
    }
    setActiveEditor(null);
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
      }}
      className={cn(
        'align-top',
        isDragging && 'bg-accent/40',
        selected && 'bg-secondary/55',
        highlighted && 'bg-primary/5 ring-1 ring-inset ring-primary/20',
      )}
      onClick={() => onSelect?.(item)}
    >
      <TableCell>
        <div
          className="flex items-start gap-1.5"
          style={{ paddingLeft: `${item.depth * TREE_INDENT}px` }}
        >
          {hasChildren ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-0.5 h-7 w-7 shrink-0"
              onClick={() => onToggleCollapse(item.id)}
              aria-expanded={!collapsed}
              aria-label={
                collapsed
                  ? t('wbs.aria.expand', { name: item.name })
                  : t('wbs.aria.collapse', { name: item.name })
              }
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <span className="h-7 w-7 shrink-0" aria-hidden />
          )}

          {canEdit ? (
            <button
              type="button"
              className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={t('wbs.aria.drag', { name: item.name })}
              disabled={disabled}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : null}

          <div className="min-w-0 flex-1 space-y-1">
            <span className="text-xs text-muted-foreground">L{item.depth + 1}</span>
            {activeEditor === 'name' && canEdit ? (
              <div className="flex items-center gap-1">
                <Input
                  value={nameValue}
                  onChange={(event) => setNameValue(event.target.value)}
                  onKeyDown={(event) => handleEditorKeyDown(event, confirmNameEdit)}
                  disabled={disabled}
                  className="h-8 max-w-[260px]"
                  autoFocus
                  aria-label={t('wbs.aria.editName', { name: item.name })}
                />
                <InlineActionButtons
                  disabled={disabled}
                  onConfirm={confirmNameEdit}
                  onCancel={closeEditor}
                />
              </div>
            ) : canEdit ? (
              <button
                type="button"
                className="truncate text-left font-medium text-foreground hover:underline"
                onClick={(event) => {
                  event.stopPropagation();
                  startEditor('name');
                }}
                disabled={disabled}
              >
                {item.name}
              </button>
            ) : (
              <button
                type="button"
                className="truncate text-left font-medium text-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect?.(item);
                }}
              >
                {item.name}
              </button>
            )}
          </div>
        </div>
      </TableCell>

      <TableCell>
        {activeEditor === 'assignee' && canEdit ? (
          <div className="space-y-1">
            <Select
              value={assigneeValue}
              onValueChange={setAssigneeValue}
              disabled={disabled || membersUnavailable}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder={t('wbs.form.assigneePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED_VALUE}>{t('wbs.form.unassigned')}</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.userId} value={String(member.userId)}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <InlineActionButtons
              disabled={disabled || membersUnavailable}
              onConfirm={confirmAssigneeEdit}
              onCancel={closeEditor}
            />
          </div>
        ) : canEdit ? (
          <button
            type="button"
            className="inline-flex max-w-full items-center rounded-full border border-border/80 bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent"
            onClick={() => startEditor('assignee')}
            disabled={disabled || membersUnavailable}
            aria-label={t('wbs.aria.editAssignee', { name: item.name })}
          >
            <span className="truncate">{assigneeName ?? t('wbs.field.unassigned')}</span>
          </button>
        ) : assigneeName ? (
          <span className="inline-flex max-w-full items-center rounded-full border border-border/80 bg-card px-2.5 py-1 text-xs font-medium text-foreground">
            <span className="truncate">{assigneeName}</span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">{t('wbs.field.unassigned')}</span>
        )}
      </TableCell>

      <TableCell className="text-sm text-muted-foreground">
        {activeEditor === 'period' && canEdit ? (
          <div className="space-y-1">
            <div className="grid grid-cols-1 gap-1">
              <Input
                type="date"
                value={startDateValue}
                onChange={(event) => setStartDateValue(event.target.value)}
                onKeyDown={(event) => handleEditorKeyDown(event, confirmPeriodEdit)}
                className="h-8"
                autoFocus
                disabled={disabled}
                aria-label={t('wbs.aria.editPeriod', { name: item.name })}
              />
              <Input
                type="date"
                value={endDateValue}
                onChange={(event) => setEndDateValue(event.target.value)}
                onKeyDown={(event) => handleEditorKeyDown(event, confirmPeriodEdit)}
                className="h-8"
                disabled={disabled}
                aria-label={t('wbs.aria.editPeriod', { name: item.name })}
              />
            </div>
            <InlineActionButtons
              disabled={disabled}
              onConfirm={confirmPeriodEdit}
              onCancel={closeEditor}
            />
          </div>
        ) : canEdit ? (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-left hover:bg-accent"
            onClick={() => startEditor('period')}
            disabled={disabled}
            aria-label={t('wbs.aria.editPeriod', { name: item.name })}
          >
            {formatPeriod(item.startDate, item.endDate, locale, t)}
          </button>
        ) : (
          formatPeriod(item.startDate, item.endDate, locale, t)
        )}
      </TableCell>

      <TableCell className="tabular-nums">
        {activeEditor === 'progress' && canEdit ? (
          <div className="flex items-center gap-1">
            <Input
              value={progressValue}
              type="number"
              min={0}
              max={100}
              step={1}
              className="h-8 w-20 tabular-nums"
              onChange={(event) => setProgressValue(event.target.value)}
              onKeyDown={(event) => handleEditorKeyDown(event, confirmProgressEdit)}
              autoFocus
              disabled={disabled}
              aria-label={t('wbs.aria.editProgress', { name: item.name })}
            />
            <InlineActionButtons
              disabled={disabled}
              onConfirm={confirmProgressEdit}
              onCancel={closeEditor}
            />
          </div>
        ) : canEdit ? (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-left text-sm tabular-nums hover:bg-accent"
            onClick={() => startEditor('progress')}
            disabled={disabled}
          >
            {item.progressRate}%
          </button>
        ) : (
          `${item.progressRate}%`
        )}
      </TableCell>

      <TableCell className="tabular-nums">
        {activeEditor === 'estimatedMm' && canEdit ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={estimatedMmValue}
              onChange={(event) => setEstimatedMmValue(event.target.value)}
              onKeyDown={(event) => handleEditorKeyDown(event, confirmEstimatedMmEdit)}
              className="h-8 w-24 tabular-nums"
              autoFocus
              disabled={disabled}
              aria-label={t('wbs.aria.editEstimatedMm', { name: item.name })}
            />
            <InlineActionButtons
              disabled={disabled}
              onConfirm={confirmEstimatedMmEdit}
              onCancel={closeEditor}
            />
          </div>
        ) : canEdit ? (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-left text-sm tabular-nums hover:bg-accent"
            onClick={() => startEditor('estimatedMm')}
            disabled={disabled}
            aria-label={t('wbs.aria.editEstimatedMm', { name: item.name })}
          >
            {item.estimatedMm != null
              ? t('wbs.field.mmValue', { value: item.estimatedMm })
              : t('wbs.field.noEstimatedMm')}
          </button>
        ) : item.estimatedMm != null ? (
          t('wbs.field.mmValue', { value: item.estimatedMm })
        ) : (
          t('wbs.field.noEstimatedMm')
        )}
      </TableCell>

      <TableCell className="text-sm text-muted-foreground">
        {activeEditor === 'milestone' && canEdit ? (
          <div className="space-y-1">
            <Select value={milestoneValue} onValueChange={setMilestoneValue} disabled={disabled}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder={t('wbs.form.milestonePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_MILESTONE_VALUE}>{t('wbs.form.noMilestone')}</SelectItem>
                {milestones.map((milestone) => (
                  <SelectItem key={milestone.id} value={String(milestone.id)}>
                    {milestone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <InlineActionButtons
              disabled={disabled}
              onConfirm={confirmMilestoneEdit}
              onCancel={closeEditor}
            />
          </div>
        ) : canEdit ? (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-left hover:bg-accent"
            onClick={() => startEditor('milestone')}
            disabled={disabled}
            aria-label={t('wbs.aria.editMilestone', { name: item.name })}
          >
            {milestoneName ?? t('wbs.field.noMilestone')}
          </button>
        ) : (
          (milestoneName ?? t('wbs.field.noMilestone'))
        )}
      </TableCell>

      {canEdit ? (
        <TableCell>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenEditDialog(item)}
              aria-label={t('wbs.aria.edit', { name: item.name })}
              disabled={disabled}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenMoveDialog(item)}
              aria-label={t('wbs.aria.move', { name: item.name })}
              disabled={disabled}
            >
              <ArrowRightLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onRequestDelete(item)}
              aria-label={t('wbs.aria.delete', { name: item.name })}
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  );
}
