import type { WbsItem } from '@/types/wbs';
import { NO_MILESTONE_VALUE, UNASSIGNED_VALUE } from './sortable-wbs-row-formatters';

export type WbsInlineEditor =
  | 'name'
  | 'assignee'
  | 'period'
  | 'progress'
  | 'estimatedMm'
  | 'milestone';

export interface WbsInlineDraftState {
  assigneeValue: string;
  endDateValue: string;
  estimatedMmValue: string;
  milestoneValue: string;
  nameValue: string;
  progressValue: string;
  startDateValue: string;
}

export function createWbsInlineDraftState(item: WbsItem): WbsInlineDraftState {
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

export function normalizeInlineName(value: string): string {
  return value.trim();
}

export function parseInlineAssigneeValue(value: string): number | null {
  return value === UNASSIGNED_VALUE ? null : Number.parseInt(value, 10);
}

export function parseInlineMilestoneValue(value: string): number | null {
  return value === NO_MILESTONE_VALUE ? null : Number.parseInt(value, 10);
}

export function parseInlineProgressValue(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value);
}

export function parseValidatedInlineProgressValue(value: string): number | null {
  const parsed = parseInlineProgressValue(value);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }
  return parsed;
}

export function parseInlineEstimatedMmValue(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }
  return Number(value);
}

export function isWbsInlineEditorDirty(
  editor: WbsInlineEditor,
  item: WbsItem,
  draft: WbsInlineDraftState,
): boolean {
  if (editor === 'name') {
    return normalizeInlineName(draft.nameValue) !== item.name;
  }

  if (editor === 'assignee') {
    return parseInlineAssigneeValue(draft.assigneeValue) !== item.assigneeUserId;
  }

  if (editor === 'period') {
    const nextStartDate = draft.startDateValue || null;
    const nextEndDate = draft.endDateValue || null;
    return nextStartDate !== item.startDate || nextEndDate !== item.endDate;
  }

  if (editor === 'progress') {
    const parsed = parseInlineProgressValue(draft.progressValue);
    if (Number.isNaN(parsed)) {
      return draft.progressValue.trim() !== String(item.progressRate);
    }
    return parsed !== item.progressRate;
  }

  if (editor === 'estimatedMm') {
    const parsed = parseInlineEstimatedMmValue(draft.estimatedMmValue);
    if (parsed == null) {
      return item.estimatedMm != null;
    }
    if (Number.isNaN(parsed)) {
      return draft.estimatedMmValue.trim() !== (item.estimatedMm == null ? '' : String(item.estimatedMm));
    }
    return parsed !== item.estimatedMm;
  }

  return parseInlineMilestoneValue(draft.milestoneValue) !== item.milestoneId;
}

export function resolveInlineBlurDecision(
  editor: WbsInlineEditor,
  item: WbsItem,
  draft: WbsInlineDraftState,
  confirmSave: () => boolean,
): 'save' | 'discard' | 'unchanged' {
  if (!isWbsInlineEditorDirty(editor, item, draft)) {
    return 'unchanged';
  }
  return confirmSave() ? 'save' : 'discard';
}
