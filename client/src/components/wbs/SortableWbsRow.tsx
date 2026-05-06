import { type KeyboardEvent, useEffect, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TFunction } from 'i18next';
import { Check, ChevronDown, ChevronRight, GripVertical, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import { isDateOrderValid } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Milestone } from '@/types/milestone';
import type { TeamMember } from '@/types/team';
import type { UpdateWbsItemPayload, WbsItem, WbsTemplateSummary } from '@/types/wbs';
import { SortableWbsRowActionStrip } from './SortableWbsRowActionStrip';
import { SortableWbsRowCells } from './SortableWbsRowCells';
import {
  NO_MILESTONE_VALUE,
  UNASSIGNED_VALUE,
} from './sortable-wbs-row-formatters';
import { getWbsRowSurfaceClasses } from './sortable-wbs-row-surface';
import type { WbsVisibleColumn } from './wbs-authoring-utils';
import WbsLevelBadge from './WbsLevelBadge';
import { TREE_INDENT } from './wbs-tree-utils';

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
  /** 보이는 컬럼 집합 */
  visibleColumns: Set<WbsVisibleColumn>;
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
  /** dedicated page 여부 */
  pageAuthoringMode?: boolean;
  /** 같은 레벨 아래 추가 가능 여부 */
  canAddBelow?: boolean;
  /** 하위 추가 가능 여부 */
  canAddChild?: boolean;
  /** 위로 이동 가능 여부 */
  canMoveUp?: boolean;
  /** 아래로 이동 가능 여부 */
  canMoveDown?: boolean;
  /** 들여쓰기 가능 여부 */
  canIndent?: boolean;
  /** 내어쓰기 가능 여부 */
  canOutdent?: boolean;
  /** 같은 레벨 아래 inline composer 열기 */
  onAddBelow?: (item: WbsItem) => void;
  /** 하위 inline composer 열기 */
  onAddChild?: (item: WbsItem) => void;
  /** 위로 이동 */
  onMoveUp?: (item: WbsItem) => void;
  /** 아래로 이동 */
  onMoveDown?: (item: WbsItem) => void;
  /** 들여쓰기 */
  onIndent?: (item: WbsItem) => void;
  /** 내어쓰기 */
  onOutdent?: (item: WbsItem) => void;
  /** 저장된 템플릿 */
  templates?: WbsTemplateSummary[];
  /** 하위 트리 복제 */
  onDuplicate?: (item: WbsItem) => void;
  /** 템플릿 저장 */
  onSaveTemplate?: (item: WbsItem) => void;
  /** 템플릿 적용 */
  onApplyTemplate?: (template: WbsTemplateSummary, item: WbsItem) => void;
}

function resetEditorState(item: WbsItem) {
  return {
    assigneeValue: item.assigneeUserId == null ? UNASSIGNED_VALUE : String(item.assigneeUserId),
    endDateValue: item.endDate ?? '',
    estimatedMmValue: item.estimatedMm == null ? '' : String(item.estimatedMm),
    milestoneValue: item.milestoneId == null ? NO_MILESTONE_VALUE : String(item.milestoneId),
    nameValue: item.name,
    progressValue: String(item.progressRate),
    startDateValue: item.startDate ?? '',
  };
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
  visibleColumns,
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
  pageAuthoringMode = false,
  canAddBelow = false,
  canAddChild = false,
  canMoveUp = false,
  canMoveDown = false,
  canIndent = false,
  canOutdent = false,
  onAddBelow,
  onAddChild,
  onMoveUp,
  onMoveDown,
  onIndent,
  onOutdent,
  templates = [],
  onDuplicate,
  onSaveTemplate,
  onApplyTemplate,
}: SortableWbsRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !canEdit || disabled,
  });
  const surfaceClasses = getWbsRowSurfaceClasses({
    highlighted,
    isDragging,
    pageAuthoringMode,
    selected,
  });
  const levelBadge = (
    <WbsLevelBadge
      label={t('wbs.row.level', { level: item.depth + 1 })}
      dense={pageAuthoringMode}
    />
  );
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
    const nextState = resetEditorState(item);
    setNameValue(nextState.nameValue);
    setProgressValue(nextState.progressValue);
    setAssigneeValue(nextState.assigneeValue);
    setStartDateValue(nextState.startDateValue);
    setEndDateValue(nextState.endDateValue);
    setEstimatedMmValue(nextState.estimatedMmValue);
    setMilestoneValue(nextState.milestoneValue);
  }, [activeEditor, item]);

  const closeEditor = () => {
    const nextState = resetEditorState(item);
    setActiveEditor(null);
    setNameValue(nextState.nameValue);
    setProgressValue(nextState.progressValue);
    setAssigneeValue(nextState.assigneeValue);
    setStartDateValue(nextState.startDateValue);
    setEndDateValue(nextState.endDateValue);
    setEstimatedMmValue(nextState.estimatedMmValue);
    setMilestoneValue(nextState.milestoneValue);
  };

  const startEditor = (editor: Exclude<InlineEditor, null>) => {
    if (!canEdit || disabled) {
      return;
    }
    setActiveEditor(editor);
  };

  const handleEditorKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    onConfirm: () => void,
  ) => {
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
      className={surfaceClasses.row}
      onClick={() => onSelect?.(item)}
    >
      <TableCell className={cn(surfaceClasses.denseCell, surfaceClasses.dividerCell)}>
        <div
          className={cn('flex items-start gap-1.5', pageAuthoringMode && 'gap-1')}
          style={{ paddingLeft: `${item.depth * TREE_INDENT}px` }}
        >
          {hasChildren ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(surfaceClasses.compactControl, 'shrink-0')}
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
              className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
                surfaceClasses.compactControl,
              )}
              aria-label={t('wbs.aria.drag', { name: item.name })}
              disabled={disabled}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : null}

          <div className="min-w-0 flex-1">
            {activeEditor === 'name' && canEdit ? (
              <div className={cn('flex items-center gap-2', pageAuthoringMode && 'gap-1.5')}>
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  <Input
                    value={nameValue}
                    onChange={(event) => setNameValue(event.target.value)}
                    onKeyDown={(event) => handleEditorKeyDown(event, confirmNameEdit)}
                    disabled={disabled}
                    className="h-8 max-w-[260px]"
                    autoFocus
                    aria-label={t('wbs.aria.editName', { name: item.name })}
                  />
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={confirmNameEdit}
                      disabled={disabled}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={closeEditor}
                      disabled={disabled}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {levelBadge}
              </div>
            ) : canEdit ? (
              <div className={cn('flex items-center gap-2', pageAuthoringMode && 'gap-1.5')}>
                <button
                  type="button"
                  className={cn(
                    'min-w-0 flex-1 truncate text-left font-medium text-foreground hover:underline',
                    pageAuthoringMode && 'leading-5',
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    startEditor('name');
                  }}
                  disabled={disabled}
                >
                  {item.name}
                </button>
                {levelBadge}
              </div>
            ) : (
              <div className={cn('flex items-center gap-2', pageAuthoringMode && 'gap-1.5')}>
                <button
                  type="button"
                  className={cn(
                    'min-w-0 flex-1 truncate text-left font-medium text-foreground',
                    pageAuthoringMode && 'leading-5',
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect?.(item);
                  }}
                >
                  {item.name}
                </button>
                {levelBadge}
              </div>
            )}
          </div>
        </div>
      </TableCell>

      <SortableWbsRowCells
        activeEditor={activeEditor === 'name' ? null : activeEditor}
        assigneeName={assigneeName}
        assigneeValue={assigneeValue}
        canEdit={canEdit}
        disabled={disabled}
        endDateValue={endDateValue}
        estimatedMmValue={estimatedMmValue}
        item={item}
        locale={locale}
        members={members}
        membersUnavailable={membersUnavailable}
        milestoneName={milestoneName}
        milestoneValue={milestoneValue}
        milestones={milestones}
        pageDenseCellClass={surfaceClasses.denseCell}
        pageDividerCellClass={surfaceClasses.dividerCell}
        pageAuthoringMode={pageAuthoringMode}
        progressValue={progressValue}
        startDateValue={startDateValue}
        t={t}
        visibleColumns={visibleColumns}
        onCancelEditor={closeEditor}
        onConfirmAssigneeEdit={confirmAssigneeEdit}
        onConfirmEstimatedMmEdit={confirmEstimatedMmEdit}
        onConfirmMilestoneEdit={confirmMilestoneEdit}
        onConfirmPeriodEdit={confirmPeriodEdit}
        onConfirmProgressEdit={confirmProgressEdit}
        onEditorKeyDown={(event) => {
          if (activeEditor === 'period') {
            handleEditorKeyDown(event, confirmPeriodEdit);
            return;
          }
          if (activeEditor === 'progress') {
            handleEditorKeyDown(event, confirmProgressEdit);
            return;
          }
          if (activeEditor === 'estimatedMm') {
            handleEditorKeyDown(event, confirmEstimatedMmEdit);
          }
        }}
        onSetAssigneeValue={setAssigneeValue}
        onSetEndDateValue={setEndDateValue}
        onSetEstimatedMmValue={setEstimatedMmValue}
        onSetMilestoneValue={setMilestoneValue}
        onSetProgressValue={setProgressValue}
        onSetStartDateValue={setStartDateValue}
        onStartEditor={startEditor}
      />

      <SortableWbsRowActionStrip
        canAddBelow={canAddBelow}
        canAddChild={canAddChild}
        canEdit={canEdit}
        canIndent={canIndent}
        canMoveDown={canMoveDown}
        canMoveUp={canMoveUp}
        canOutdent={canOutdent}
        disabled={disabled}
        item={item}
        pageActionCellClass={surfaceClasses.actionCell}
        pageAuthoringMode={pageAuthoringMode}
        pageDenseCellClass={surfaceClasses.denseCell}
        t={t}
        templates={templates}
        onAddBelow={onAddBelow}
        onAddChild={onAddChild}
        onApplyTemplate={onApplyTemplate}
        onDuplicate={onDuplicate}
        onIndent={onIndent}
        onMoveDown={onMoveDown}
        onMoveUp={onMoveUp}
        onOpenEditDialog={onOpenEditDialog}
        onOpenMoveDialog={onOpenMoveDialog}
        onOutdent={onOutdent}
        onRequestDelete={onRequestDelete}
        onSaveTemplate={onSaveTemplate}
      />
    </TableRow>
  );
}
