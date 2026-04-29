import type { ILink, ITask } from '@svar-ui/react-gantt';
import type { Milestone } from '@/types/milestone';
import type { WbsDependency, WbsDependencyType } from '@/types/wbs-dependency';
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
  /** dependency 선 수 */
  dependencyCount: number;
  /** dependency가 연결된 task 수 */
  dependencyTaskCount: number;
  /** milestone 수렴 연결 수 */
  milestoneFlowCount: number;
}

/** rolling-wave 요약용 마일스톤 스냅샷. */
export interface GanttWaveMilestoneSummary {
  /** 마일스톤 ID */
  id: number;
  /** 마일스톤명 */
  name: string;
  /** 목표일 */
  targetDate: string;
  /** 연결된 WBS 수 */
  linkedWbsItemCount: number;
  /** 달성률 */
  achievementRate: number;
  /** 지연 여부 */
  isDelayed: boolean;
}

/** rolling-wave 요약 모델. */
export interface GanttWaveSummary {
  /** 현재 운영 wave 기준 마일스톤 */
  focusMilestone: GanttWaveMilestoneSummary | null;
  /** 현재 wave에 연결된 WBS 수 */
  currentWaveTaskCount: number;
  /** 현재 wave에서 완료된 WBS 수 */
  currentWaveCompletedTaskCount: number;
  /** 후속 후보 마일스톤 수 */
  futureMilestoneCount: number;
  /** 후속 후보에 연결된 WBS 수 */
  futureTaskCount: number;
  /** 아직 마일스톤에 연결되지 않은 WBS 수 */
  unplannedTaskCount: number;
}

interface GanttConnectivityMeta {
  predecessorTaskIds: string[];
  successorTaskIds: string[];
  milestoneTaskId: string | null;
  inboundDependencyCount: number;
  outboundDependencyCount: number;
  hasDependencies: boolean;
}

/** WBS 메타 정보. */
export interface GanttWbsMeta extends GanttConnectivityMeta {
  kind: 'wbs';
  wbsId: number;
  original: WbsItem;
}

/** Summary 메타 정보. */
export interface GanttSummaryMeta extends GanttConnectivityMeta {
  kind: 'summary';
  wbsId: number;
}

/** Milestone 메타 정보. */
export interface GanttMilestoneMeta extends GanttConnectivityMeta {
  kind: 'milestone';
  milestoneId: number;
  isDelayed: boolean;
  linkedWbsItemCount: number;
  inboundMilestoneFlowCount: number;
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

/** 간트 링크 종류 메타 타입. */
export type GanttLinkKind = 'dependency' | 'milestone';

/** SVAR link 확장 모델. */
export interface GanttLink extends ILink {
  id: string;
  kind: GanttLinkKind;
  dependencyType?: WbsDependencyType;
  milestoneId?: number;
}

/** 간트 모델 빌드 입력값. */
export interface BuildGanttModelInput {
  /** WBS 목록 */
  wbsItems: WbsItem[];
  /** 마일스톤 목록 */
  milestones: Milestone[];
  /** dependency 목록 */
  dependencies: WbsDependency[];
}

/** 간트 모델 빌드 결과. */
export interface GanttModel {
  /** SVAR task 목록 */
  tasks: GanttTask[];
  /** SVAR link 목록 */
  links: GanttLink[];
  /** 초기 viewport range */
  range: GanttViewportRange;
  /** 차트 통계 */
  stats: GanttTaskStats;
  /** task id -> 메타 맵 */
  taskMetaById: Map<string, GanttTaskMeta>;
  /** rolling-wave 요약 */
  waveSummary: GanttWaveSummary;
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

function createConnectivityMeta(): GanttConnectivityMeta {
  return {
    predecessorTaskIds: [],
    successorTaskIds: [],
    milestoneTaskId: null,
    inboundDependencyCount: 0,
    outboundDependencyCount: 0,
    hasDependencies: false,
  };
}

function mapDependencyTypeToLinkType(type: WbsDependencyType): GanttLink['type'] {
  switch (type) {
    case 'SS':
      return 's2s';
    case 'FF':
      return 'e2e';
    case 'SF':
      return 's2e';
    case 'FS':
    default:
      return 'e2s';
  }
}

function toWaveMilestoneSummary(milestone: Milestone): GanttWaveMilestoneSummary {
  return {
    id: milestone.id,
    name: milestone.name,
    targetDate: milestone.targetDate,
    linkedWbsItemCount: milestone.linkedWbsItemCount,
    achievementRate: milestone.achievementRate,
    isDelayed: milestone.isDelayed,
  };
}

function buildWaveSummary(wbsItems: WbsItem[], orderedMilestones: Milestone[]): GanttWaveSummary {
  const linkedItemsByMilestone = new Map<number, WbsItem[]>();

  wbsItems.forEach((item) => {
    if (item.milestoneId == null) {
      return;
    }
    const current = linkedItemsByMilestone.get(item.milestoneId) ?? [];
    current.push(item);
    linkedItemsByMilestone.set(item.milestoneId, current);
  });

  const focusMilestoneIndex = orderedMilestones.findIndex((milestone) => {
    const linkedItems = linkedItemsByMilestone.get(milestone.id) ?? [];
    return milestone.isDelayed || linkedItems.some((item) => item.progressRate < 100);
  });

  const normalizedFocusIndex =
    focusMilestoneIndex >= 0 ? focusMilestoneIndex : orderedMilestones.length > 0 ? 0 : -1;
  const focusMilestone = normalizedFocusIndex >= 0 ? orderedMilestones[normalizedFocusIndex] : null;
  const currentWaveItems = focusMilestone
    ? (linkedItemsByMilestone.get(focusMilestone.id) ?? []).filter(
        (item) => item.startDate || item.endDate || item.progressRate > 0,
      )
    : [];
  const futureMilestones =
    normalizedFocusIndex >= 0 ? orderedMilestones.slice(normalizedFocusIndex + 1) : [];

  return {
    focusMilestone: focusMilestone ? toWaveMilestoneSummary(focusMilestone) : null,
    currentWaveTaskCount: currentWaveItems.length,
    currentWaveCompletedTaskCount: currentWaveItems.filter((item) => item.progressRate >= 100)
      .length,
    futureMilestoneCount: futureMilestones.length,
    futureTaskCount: futureMilestones.reduce(
      (count, milestone) => count + (linkedItemsByMilestone.get(milestone.id)?.length ?? 0),
      0,
    ),
    unplannedTaskCount: wbsItems.filter(
      (item) =>
        item.milestoneId == null &&
        (item.startDate != null || item.endDate != null || item.progressRate > 0),
    ).length,
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
  const { wbsItems, milestones, dependencies } = input;
  const childrenByParent = buildChildrenByParent(wbsItems);
  const orderedWbsItems = flattenTreeItems(childrenByParent, new Set<number>());
  const ownRangeById = new Map<number, DateRange | null>();
  const descendantRangeById = new Map<number, DateRange | null>();
  const tasks: GanttTask[] = [];
  const links: GanttLink[] = [];
  const taskMetaById = new Map<string, GanttTaskMeta>();
  const stats: GanttTaskStats = {
    omittedItemCount: 0,
    datedTaskCount: 0,
    milestoneCount: 0,
    dependencyCount: 0,
    dependencyTaskCount: 0,
    milestoneFlowCount: 0,
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
        ...createConnectivityMeta(),
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
        ...createConnectivityMeta(),
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
      inboundMilestoneFlowCount: 0,
      ...createConnectivityMeta(),
    });
    stats.milestoneCount += 1;
    combinedRange = mergeRange(combinedRange, { start, end: start });
  });

  const renderedTaskIds = new Set(tasks.map((task) => String(task.id)));

  dependencies
    .slice()
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }
      return left.id - right.id;
    })
    .forEach((dependency) => {
      const predecessorTaskId = String(dependency.predecessorWbsItemId);
      const successorTaskId = String(dependency.successorWbsItemId);
      if (
        predecessorTaskId === successorTaskId ||
        !renderedTaskIds.has(predecessorTaskId) ||
        !renderedTaskIds.has(successorTaskId)
      ) {
        return;
      }

      links.push({
        id: `dependency:${dependency.id}`,
        kind: 'dependency',
        dependencyType: dependency.dependencyType,
        type: mapDependencyTypeToLinkType(dependency.dependencyType),
        source: dependency.predecessorWbsItemId,
        target: dependency.successorWbsItemId,
      });
      stats.dependencyCount += 1;

      const predecessorMeta = taskMetaById.get(predecessorTaskId);
      if (predecessorMeta && !predecessorMeta.successorTaskIds.includes(successorTaskId)) {
        predecessorMeta.successorTaskIds.push(successorTaskId);
        predecessorMeta.outboundDependencyCount += 1;
        predecessorMeta.hasDependencies = true;
      }

      const successorMeta = taskMetaById.get(successorTaskId);
      if (successorMeta && !successorMeta.predecessorTaskIds.includes(predecessorTaskId)) {
        successorMeta.predecessorTaskIds.push(predecessorTaskId);
        successorMeta.inboundDependencyCount += 1;
        successorMeta.hasDependencies = true;
      }
    });

  wbsItems.forEach((item) => {
    if (item.milestoneId == null) {
      return;
    }

    const taskId = String(item.id);
    const milestoneTaskId = `milestone:${item.milestoneId}`;
    const taskMeta = taskMetaById.get(taskId);
    const milestoneMeta = taskMetaById.get(milestoneTaskId);
    if (!taskMeta || !milestoneMeta || !renderedTaskIds.has(taskId)) {
      return;
    }

    links.push({
      id: `milestone-flow:${item.id}:${item.milestoneId}`,
      kind: 'milestone',
      milestoneId: item.milestoneId,
      type: 'e2s',
      source: item.id,
      target: milestoneTaskId,
    });
    taskMeta.milestoneTaskId = milestoneTaskId;
    if (milestoneMeta.kind === 'milestone') {
      milestoneMeta.inboundMilestoneFlowCount += 1;
    }
    stats.milestoneFlowCount += 1;
  });

  stats.dependencyTaskCount = [...taskMetaById.values()].filter(
    (meta) => meta.hasDependencies,
  ).length;

  const today = parseDateOnly(formatDateOnly(new Date()));
  const baseRange = combinedRange ?? { start: today, end: today };

  return {
    tasks,
    links,
    range: expandDateRange(baseRange.start, baseRange.end, 7),
    stats,
    taskMetaById,
    waveSummary: buildWaveSummary(wbsItems, orderedMilestones),
  };
}
