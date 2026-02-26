import type { TableDiff } from './erd-diff-plan.js';

/** 폴백 그룹 재매핑 입력 그룹 */
export interface FallbackGroup {
  id: string;
  tableIds: string[];
}

/** 폴백 그룹 재매핑 입력 노드 */
export interface FallbackNode {
  id: string;
  data: {
    label: string;
  };
}

/** 폴백 그룹 재매핑 결과 */
export interface FallbackGroupAssignment {
  groupId: string;
  tableIds: string[];
  droppedCount: number;
}

/**
 * Full Replace 폴백 이후 그룹 멤버십을 보수 정책으로 재매핑한다.
 *
 * 정책:
 * - `table.update + confidence=high` 로 확정된 테이블만 재매핑 유지
 * - 불확실 매칭/삭제 항목은 그룹에서 제외
 *
 * @param groups 폴백 직전 그룹 스냅샷
 * @param tableDiffs diff 테이블 연산
 * @param nextNodes 폴백 적용 후 노드 스냅샷
 * @returns 그룹별 최종 tableIds와 제거 건수
 */
export function buildFallbackGroupAssignments(
  groups: FallbackGroup[],
  tableDiffs: TableDiff[],
  nextNodes: FallbackNode[],
): FallbackGroupAssignment[] {
  const nextTableNameByPreviousId = new Map<string, string>();
  for (const diff of tableDiffs) {
    if (diff.op !== 'update') {
      continue;
    }
    if (diff.match.confidence !== 'high') {
      continue;
    }
    nextTableNameByPreviousId.set(diff.tableId, diff.next.name);
  }

  const nextNodeIdsByLabel = new Map<string, string[]>();
  for (const node of nextNodes) {
    const bucket = nextNodeIdsByLabel.get(node.data.label);
    if (bucket) {
      bucket.push(node.id);
      continue;
    }
    nextNodeIdsByLabel.set(node.data.label, [node.id]);
  }

  const nextTableIdByPreviousId = new Map<string, string>();
  const consumedByLabel = new Map<string, number>();
  for (const [previousTableId, nextName] of nextTableNameByPreviousId) {
    const nodeIds = nextNodeIdsByLabel.get(nextName);
    if (!nodeIds || nodeIds.length === 0) {
      continue;
    }
    const cursor = consumedByLabel.get(nextName) ?? 0;
    if (cursor >= nodeIds.length) {
      continue;
    }
    nextTableIdByPreviousId.set(previousTableId, nodeIds[cursor]);
    consumedByLabel.set(nextName, cursor + 1);
  }

  return groups.map((group) => {
    const nextTableIds: string[] = [];
    let droppedCount = 0;

    for (const previousTableId of group.tableIds) {
      const nextName = nextTableNameByPreviousId.get(previousTableId);
      if (!nextName) {
        droppedCount += 1;
        continue;
      }
      const nextId = nextTableIdByPreviousId.get(previousTableId);
      if (!nextId) {
        droppedCount += 1;
        continue;
      }
      nextTableIds.push(nextId);
    }

    const deduped = [...new Set(nextTableIds)];
    return {
      groupId: group.id,
      tableIds: deduped,
      droppedCount,
    };
  });
}
