import type { FocusEventHandler, KeyboardEventHandler } from 'react';
import type { TFunction } from 'i18next';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { Milestone } from '@/types/milestone';
import type { TeamMember } from '@/types/team';
import type { WbsItem } from '@/types/wbs';
import {
  formatOptionalPercentage,
  formatPeriod,
  formatVariance,
  formatVarianceDays,
  NO_MILESTONE_VALUE,
  UNASSIGNED_VALUE,
} from './sortable-wbs-row-formatters';
import type { WbsVisibleColumn } from './wbs-authoring-utils';

type InlineEditor = 'assignee' | 'estimatedMm' | 'milestone' | 'period' | 'progress' | null;

export interface SortableWbsRowCellsProps {
  activeEditor: InlineEditor;
  assigneeName: string | null;
  assigneeValue: string;
  canEdit: boolean;
  disabled: boolean;
  displayEstimatedMmLabel: string;
  displayMilestoneLabel: string;
  displayPeriodLabel: string;
  displayProgressLabel: string;
  editorRootProps?: {
    onBlurCapture: FocusEventHandler<HTMLElement>;
  };
  endDateValue: string;
  estimatedMmValue: string;
  item: WbsItem;
  locale: string;
  members: TeamMember[];
  membersUnavailable: boolean;
  milestoneValue: string;
  milestones: Milestone[];
  pageDenseCellClass?: string;
  pageDividerCellClass?: string;
  pageAuthoringMode: boolean;
  progressValue: string;
  startDateValue: string;
  t: TFunction;
  visibleColumns: Set<WbsVisibleColumn>;
  onEditorKeyDown: KeyboardEventHandler<HTMLElement>;
  onSetAssigneeValue: (value: string) => void;
  onSetEndDateValue: (value: string) => void;
  onSetEstimatedMmValue: (value: string) => void;
  onSetMilestoneValue: (value: string) => void;
  onSetProgressValue: (value: string) => void;
  onSetStartDateValue: (value: string) => void;
  onStartEditor: (editor: Exclude<InlineEditor, null>) => void;
}

export function SortableWbsRowCells({
  activeEditor,
  assigneeName,
  assigneeValue,
  canEdit,
  disabled,
  displayEstimatedMmLabel,
  displayMilestoneLabel,
  displayPeriodLabel,
  displayProgressLabel,
  editorRootProps,
  endDateValue,
  estimatedMmValue,
  item,
  locale,
  members,
  membersUnavailable,
  milestoneValue,
  milestones,
  pageDenseCellClass,
  pageDividerCellClass,
  pageAuthoringMode,
  progressValue,
  startDateValue,
  t,
  visibleColumns,
  onEditorKeyDown,
  onSetAssigneeValue,
  onSetEndDateValue,
  onSetEstimatedMmValue,
  onSetMilestoneValue,
  onSetProgressValue,
  onSetStartDateValue,
  onStartEditor,
}: SortableWbsRowCellsProps) {
  return (
    <>
      {visibleColumns.has('assignee') ? (
        <TableCell className={cn(pageDenseCellClass, pageDividerCellClass)}>
          {activeEditor === 'assignee' && canEdit ? (
            <div {...editorRootProps}>
              <Select
                value={assigneeValue}
                onValueChange={onSetAssigneeValue}
                disabled={disabled || membersUnavailable}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder={t('wbs.form.assigneePlaceholder')} />
                </SelectTrigger>
                <SelectContent data-inline-editor-portal="true">
                  <SelectItem value={UNASSIGNED_VALUE}>{t('wbs.form.unassigned')}</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.userId} value={String(member.userId)}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : canEdit ? (
            <button
              type="button"
              className={cn(
                'inline-flex max-w-full items-center rounded-full border border-border/80 bg-card font-medium text-foreground hover:bg-accent',
                pageAuthoringMode ? 'px-2 py-0.5 text-[11px] leading-4' : 'px-2.5 py-1 text-xs',
              )}
              onClick={() => onStartEditor('assignee')}
              disabled={disabled || membersUnavailable}
              aria-label={t('wbs.aria.editAssignee', { name: item.name })}
            >
              <span className="truncate">{assigneeName ?? t('wbs.field.unassigned')}</span>
            </button>
          ) : assigneeName ? (
            <span
              className={cn(
                'inline-flex max-w-full items-center rounded-full border border-border/80 bg-card font-medium text-foreground',
                pageAuthoringMode ? 'px-2 py-0.5 text-[11px] leading-4' : 'px-2.5 py-1 text-xs',
              )}
            >
              <span className="truncate">{assigneeName}</span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">{t('wbs.field.unassigned')}</span>
          )}
        </TableCell>
      ) : null}

      {visibleColumns.has('period') ? (
        <TableCell
          className={cn('text-sm text-muted-foreground', pageDenseCellClass, pageDividerCellClass)}
        >
          {activeEditor === 'period' && canEdit ? (
            <div {...editorRootProps}>
              <div className="grid grid-cols-1 gap-1">
                <Input
                  type="date"
                  value={startDateValue}
                  onChange={(event) => onSetStartDateValue(event.target.value)}
                  onKeyDown={onEditorKeyDown}
                  className="h-8"
                  autoFocus
                  disabled={disabled}
                  aria-label={t('wbs.aria.editPeriod', { name: item.name })}
                />
                <Input
                  type="date"
                  value={endDateValue}
                  onChange={(event) => onSetEndDateValue(event.target.value)}
                  onKeyDown={onEditorKeyDown}
                  className="h-8"
                  disabled={disabled}
                  aria-label={t('wbs.aria.editPeriod', { name: item.name })}
                />
              </div>
            </div>
          ) : canEdit ? (
            <button
              type="button"
              className="rounded-md px-2 py-1 text-left hover:bg-accent"
              onClick={() => onStartEditor('period')}
              disabled={disabled}
              aria-label={t('wbs.aria.editPeriod', { name: item.name })}
            >
              {displayPeriodLabel}
            </button>
          ) : (
            displayPeriodLabel
          )}
        </TableCell>
      ) : null}

      {visibleColumns.has('actualPeriod') ? (
        <TableCell
          className={cn('text-sm text-muted-foreground', pageDenseCellClass, pageDividerCellClass)}
        >
          {formatPeriod(item.actualStartDate, item.actualEndDate, locale, t)}
        </TableCell>
      ) : null}

      {visibleColumns.has('progressRate') ? (
        <TableCell className={cn('tabular-nums', pageDenseCellClass, pageDividerCellClass)}>
          {activeEditor === 'progress' && canEdit ? (
            <div {...editorRootProps}>
              <Input
                value={progressValue}
                type="number"
                min={0}
                max={100}
                step={1}
                className="h-8 w-20 tabular-nums"
                onChange={(event) => onSetProgressValue(event.target.value)}
                onKeyDown={onEditorKeyDown}
                autoFocus
                disabled={disabled}
                aria-label={t('wbs.aria.editProgress', { name: item.name })}
              />
            </div>
          ) : canEdit ? (
            <button
              type="button"
              className="rounded-md px-2 py-1 text-left text-sm tabular-nums hover:bg-accent"
              onClick={() => onStartEditor('progress')}
              disabled={disabled}
            >
              {displayProgressLabel}
            </button>
          ) : (
            displayProgressLabel
          )}
        </TableCell>
      ) : null}

      {visibleColumns.has('plannedProgressRate') ? (
        <TableCell
          className={cn(
            'text-sm tabular-nums text-muted-foreground',
            pageDenseCellClass,
            pageDividerCellClass,
          )}
        >
          {formatOptionalPercentage(item.plannedProgressRate, t)}
        </TableCell>
      ) : null}

      {visibleColumns.has('progressVarianceRate') ? (
        <TableCell className={cn(pageDenseCellClass, pageDividerCellClass)}>
          <div
            className={cn(
              'text-sm tabular-nums',
              item.progressVarianceRate == null
                ? 'text-muted-foreground'
                : item.progressVarianceRate > 0
                  ? 'text-emerald-700'
                  : item.progressVarianceRate < 0
                    ? 'text-rose-700'
                    : 'text-foreground',
            )}
          >
            {formatVariance(item.progressVarianceRate, t)}
          </div>
          {item.startVarianceDays != null || item.endVarianceDays != null ? (
            <div className="mt-1 space-y-0.5 text-[11px] leading-4 text-muted-foreground">
              {formatVarianceDays(item.startVarianceDays, 'start', t) ? (
                <p>{formatVarianceDays(item.startVarianceDays, 'start', t)}</p>
              ) : null}
              {formatVarianceDays(item.endVarianceDays, 'end', t) ? (
                <p>{formatVarianceDays(item.endVarianceDays, 'end', t)}</p>
              ) : null}
            </div>
          ) : null}
        </TableCell>
      ) : null}

      {visibleColumns.has('estimatedMm') ? (
        <TableCell className={cn('tabular-nums', pageDenseCellClass, pageDividerCellClass)}>
          {activeEditor === 'estimatedMm' && canEdit ? (
            <div {...editorRootProps}>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={estimatedMmValue}
                onChange={(event) => onSetEstimatedMmValue(event.target.value)}
                onKeyDown={onEditorKeyDown}
                className="h-8 w-24 tabular-nums"
                autoFocus
                disabled={disabled}
                aria-label={t('wbs.aria.editEstimatedMm', { name: item.name })}
              />
            </div>
          ) : canEdit ? (
            <button
              type="button"
              className="rounded-md px-2 py-1 text-left text-sm tabular-nums hover:bg-accent"
              onClick={() => onStartEditor('estimatedMm')}
              disabled={disabled}
              aria-label={t('wbs.aria.editEstimatedMm', { name: item.name })}
            >
              {displayEstimatedMmLabel}
            </button>
          ) : item.estimatedMm != null ? (
            displayEstimatedMmLabel
          ) : (
            displayEstimatedMmLabel
          )}
        </TableCell>
      ) : null}

      {visibleColumns.has('milestone') ? (
        <TableCell
          className={cn('text-sm text-muted-foreground', pageDenseCellClass, pageDividerCellClass)}
        >
          {activeEditor === 'milestone' && canEdit ? (
            <div {...editorRootProps}>
              <Select
                value={milestoneValue}
                onValueChange={onSetMilestoneValue}
                disabled={disabled}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder={t('wbs.form.milestonePlaceholder')} />
                </SelectTrigger>
                <SelectContent data-inline-editor-portal="true">
                  <SelectItem value={NO_MILESTONE_VALUE}>{t('wbs.form.noMilestone')}</SelectItem>
                  {milestones.map((milestone) => (
                    <SelectItem key={milestone.id} value={String(milestone.id)}>
                      {milestone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : canEdit ? (
            <button
              type="button"
              className="rounded-md px-2 py-1 text-left hover:bg-accent"
              onClick={() => onStartEditor('milestone')}
              disabled={disabled}
              aria-label={t('wbs.aria.editMilestone', { name: item.name })}
            >
              {displayMilestoneLabel}
            </button>
          ) : (
            displayMilestoneLabel
          )}
        </TableCell>
      ) : null}
    </>
  );
}
