import type { Milestone } from '@/types/milestone';
import type { WbsDependency } from '@/types/wbs-dependency';
import type { WbsItem } from '@/types/wbs';

/** dependency summary 입력값. */
interface BuildWbsDependencySummaryInput {
  /** 선택된 WBS 항목 */
  item: WbsItem;
  /** 프로젝트 WBS 전체 목록 */
  allItems: WbsItem[];
  /** 프로젝트 dependency 전체 목록 */
  dependencies: WbsDependency[];
  /** 프로젝트 milestone 전체 목록 */
  milestones: Milestone[];
}

/** dependency 기반 요약 결과. */
export interface WbsDependencySummary {
  /** 직접 predecessor 수 */
  predecessorCount: number;
  /** 직접 successor 수 */
  successorCount: number;
  /** 다음 milestone */
  nextMilestone: Milestone | null;
  /** 현재 wave 포함 여부 */
  isInCurrentWave: boolean;
  /** 다음 milestone까지의 대표 chain */
  blockingChain: WbsItem[];
}

function compareMilestones(left: Milestone, right: Milestone): number {
  if (left.targetDate !== right.targetDate) {
    return left.targetDate.localeCompare(right.targetDate);
  }
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }
  return left.id - right.id;
}

/**
 * 선택한 WBS를 기준으로 dependency/milestone 요약을 계산한다.
 *
 * current wave는 "선택 항목에서 successor chain을 따라 도달 가능한 가장 이른 milestone 경로에 포함되는지"
 * 기준으로 추론한다. 별도 백엔드 판정 필드가 생기면 그 값을 우선하도록 대체 가능하다.
 *
 * @param input 선택 항목/전체 WBS/dependency/milestone
 * @returns dependency 요약
 */
export function buildWbsDependencySummary(
  input: BuildWbsDependencySummaryInput,
): WbsDependencySummary {
  const { item, allItems, dependencies, milestones } = input;
  const itemById = new Map(allItems.map((entry) => [entry.id, entry]));
  const milestoneById = new Map(milestones.map((milestone) => [milestone.id, milestone]));
  const predecessorCount = dependencies.filter(
    (dependency) => dependency.successorWbsItemId === item.id,
  ).length;
  const successorCount = dependencies.filter(
    (dependency) => dependency.predecessorWbsItemId === item.id,
  ).length;

  const successorAdjacency = new Map<number, number[]>();
  dependencies.forEach((dependency) => {
    const current = successorAdjacency.get(dependency.predecessorWbsItemId) ?? [];
    current.push(dependency.successorWbsItemId);
    successorAdjacency.set(dependency.predecessorWbsItemId, current);
  });

  const queue: number[] = [item.id];
  const visited = new Set<number>([item.id]);
  const previousById = new Map<number, number | null>([[item.id, null]]);
  const reachableMilestones: Array<{ milestone: Milestone; itemId: number }> = [];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentItem = itemById.get(currentId);
    if (!currentItem) {
      continue;
    }

    if (currentItem.milestoneId != null) {
      const milestone = milestoneById.get(currentItem.milestoneId);
      if (milestone) {
        reachableMilestones.push({ milestone, itemId: currentId });
      }
    }

    (successorAdjacency.get(currentId) ?? []).forEach((nextId) => {
      if (visited.has(nextId)) {
        return;
      }
      visited.add(nextId);
      previousById.set(nextId, currentId);
      queue.push(nextId);
    });
  }

  const nextMilestoneEntry =
    reachableMilestones.length > 0
      ? [...reachableMilestones].sort((left, right) => {
          const byMilestone = compareMilestones(left.milestone, right.milestone);
          if (byMilestone !== 0) {
            return byMilestone;
          }
          return left.itemId - right.itemId;
        })[0]
      : null;

  const blockingChain: WbsItem[] = [];
  if (nextMilestoneEntry) {
    let cursor: number | null = nextMilestoneEntry.itemId;
    while (cursor != null) {
      const chainItem = itemById.get(cursor);
      if (chainItem) {
        blockingChain.push(chainItem);
      }
      cursor = previousById.get(cursor) ?? null;
    }
    blockingChain.reverse();
  }

  return {
    predecessorCount,
    successorCount,
    nextMilestone: nextMilestoneEntry?.milestone ?? null,
    isInCurrentWave: blockingChain.length > 0,
    blockingChain,
  };
}
