import type { ITask } from '@svar-ui/react-gantt';
import type { Milestone } from '@/types/milestone';
import type { WbsItem } from '@/types/wbs';
import {
  buildChildrenByParent,
  flattenTreeItems,
  type ParentKey,
} from '@/components/wbs/wbs-tree-utils';
import {
  expandDateRange,
  formatDateOnly,
  inclusiveDurationDays,
  parseDateOnly,
} from './gantt-date-utils';

/** 간트 태스크 종류 메타 타입. */
export type GanttTaskKind = 'wbs' | 'summary' | 'milestone';

/** 간트 range 모델. */
export interface GanttViewportRange {
  /** 시작일 */
  start: Date;
  /** 종료일 */
  end: Date;
}

/** 간트 통계 모델. */
export interface GanttTaskStats {
  /** 날짜가 없어 차트에서 제외된 WBS 항목 수 */
  omittedItemCount: number;
  /** 기간이 있는 WBS 작업 수 */
  datedTaskCount: number;
  /** 마일스톤 수 */
  milestoneCount: number;
}

/** WBS 메타 정보. */
export interface GanttWbsMeta {
  kind: 'wbs';
  wbsId: number;
  original: WbsItem;
}

/** Summary 메타 정보. */
export interface GanttSummaryMeta {
  kind: 'summary';
  wbsId: number;
}

/** Milestone 메타 정보. */
export interface GanttMilestoneMeta {
  kind: 'milestone';
  milestoneId: number;
  isDelayed: boolean;
  linkedWbsItemCount: number;
}

/** 간트 태스크 메타 정보 유니온. */
export type GanttTaskMeta = GanttWbsMeta | GanttSummaryMeta | GanttMilestoneMeta;

/** SVAR task 확장 모델. */
export type GanttTask = ITask & {
  id: string | number;
  text: string;
  type: 'task' | 'summary' | 'milestone';
  kind: GanttTaskKind;
  wbsId?: number;
  milestoneId?: number;
  isDelayed?: boolean;
  linkedWbsItemCount?: number;
  original?: WbsItem;
};

/** 간트 모델 빌드 입력값. */
export interface BuildGanttModelInput {
  /** WBS 목록 */
  wbsItems: WbsItem[];
  /** 마일스톤 목록 */
  milestones: Milestone[];
}

/** 간트 모델 빌드 결과. */
export interface GanttModel {
  /** SVAR task 목록 */
  tasks: GanttTask[];
  /** 초기 viewport range */
  range: GanttViewportRange;
  /** 차트 통계 */
  stats: GanttTaskStats;
  /** task id -> 메타 맵 */
  taskMetaById: Map<string, GanttTaskMeta>;
}

interface DateRange {
  start: Date;
  end: Date;
}

function tryParseDateOnly(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  try {
    return parseDateOnly(value);
  } catch {
    return null;
  }
}

function toOwnRange(item: WbsItem): DateRange | null {
  const start = tryParseDateOnly(item.startDate);
  const end = tryParseDateOnly(item.endDate);
  if (!start || !end) {
    return null;
  }
  return { start, end };
}

function mergeRange(target: DateRange | null, source: DateRange | null): DateRange | null {
  if (!source) {
    return target;
  }
  if (!target) {
    return { start: source.start, end: source.end };
  }
  return {
    start: target.start.getTime() <= source.start.getTime() ? target.start : source.start,
    end: target.end.getTime() >= source.end.getTime() ? target.end : source.end,
  };
}

function resolveDescendantRange(
  itemId: number,
  childrenByParent: Map<ParentKey, WbsItem[]>,
  ownRangeById: Map<number, DateRange | null>,
  cache: Map<number, DateRange | null>,
): DateRange | null {
  if (cache.has(itemId)) {
    return cache.get(itemId) ?? null;
  }

  const children = childrenByParent.get(itemId) ?? [];
  let range: DateRange | null = null;

  children.forEach((child) => {
    const childOwnRange = ownRangeById.get(child.id) ?? null;
    const childRange =
      childOwnRange ?? resolveDescendantRange(child.id, childrenByParent, ownRangeById, cache);
    range = mergeRange(range, childRange);
  });

  cache.set(itemId, range);
  return range;
}

/**
 * WBS/마일스톤 목록을 간트 차트 모델로 변환한다.
 *
 * @param input 원본 WBS/마일스톤 목록
 * @returns SVAR task, 초기 range, 통계
 */
export function buildGanttModel(input: BuildGanttModelInput): GanttModel {
  const { wbsItems, milestones } = input;
  const childrenByParent = buildChildrenByParent(wbsItems);
  const orderedWbsItems = flattenTreeItems(childrenByParent, new Set<number>());
  const ownRangeById = new Map<number, DateRange | null>();
  const descendantRangeById = new Map<number, DateRange | null>();
  const tasks: GanttTask[] = [];
  const taskMetaById = new Map<string, GanttTaskMeta>();
  const stats: GanttTaskStats = {
    omittedItemCount: 0,
    datedTaskCount: 0,
    milestoneCount: 0,
  };

  let combinedRange: DateRange | null = null;

  orderedWbsItems.forEach((item) => {
    ownRangeById.set(item.id, toOwnRange(item));
  });

  orderedWbsItems.forEach((item) => {
    const ownRange = ownRangeById.get(item.id) ?? null;
    const parent = item.parentId ?? undefined;

    if (ownRange) {
      const task: GanttTask = {
        id: item.id,
        text: item.name,
        parent,
        start: ownRange.start,
        end: ownRange.end,
        duration: inclusiveDurationDays(ownRange.start, ownRange.end),
        progress: Math.min(Math.max(item.progressRate, 0), 100),
        type: 'task',
        kind: 'wbs',
        wbsId: item.id,
        original: item,
      };
      tasks.push(task);
      stats.datedTaskCount += 1;
      taskMetaById.set(String(task.id), {
        kind: 'wbs',
        wbsId: item.id,
        original: item,
      });
      combinedRange = mergeRange(combinedRange, ownRange);
      return;
    }

    const descendantRange = resolveDescendantRange(
      item.id,
      childrenByParent,
      ownRangeById,
      descendantRangeById,
    );

    if (descendantRange) {
      const task: GanttTask = {
        id: item.id,
        text: item.name,
        parent,
        start: descendantRange.start,
        end: descendantRange.end,
        duration: inclusiveDurationDays(descendantRange.start, descendantRange.end),
        type: 'summary',
        kind: 'summary',
        wbsId: item.id,
      };
      tasks.push(task);
      taskMetaById.set(String(task.id), {
        kind: 'summary',
        wbsId: item.id,
      });
      combinedRange = mergeRange(combinedRange, descendantRange);
      return;
    }

    stats.omittedItemCount += 1;
  });

  const orderedMilestones = [...milestones].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }
    return left.id - right.id;
  });

  orderedMilestones.forEach((milestone) => {
    const start = tryParseDateOnly(milestone.targetDate);
    if (!start) {
      return;
    }

    const taskId = `milestone:${milestone.id}`;
    const task: GanttTask = {
      id: taskId,
      text: milestone.name,
      start,
      type: 'milestone',
      kind: 'milestone',
      critical: milestone.isDelayed,
      milestoneId: milestone.id,
      isDelayed: milestone.isDelayed,
      linkedWbsItemCount: milestone.linkedWbsItemCount,
    };
    tasks.push(task);
    taskMetaById.set(taskId, {
      kind: 'milestone',
      milestoneId: milestone.id,
      isDelayed: milestone.isDelayed,
      linkedWbsItemCount: milestone.linkedWbsItemCount,
    });
    stats.milestoneCount += 1;
    combinedRange = mergeRange(combinedRange, { start, end: start });
  });

  const today = parseDateOnly(formatDateOnly(new Date()));
  const baseRange = combinedRange ?? { start: today, end: today };

  return {
    tasks,
    range: expandDateRange(baseRange.start, baseRange.end, 7),
    stats,
    taskMetaById,
  };
}
