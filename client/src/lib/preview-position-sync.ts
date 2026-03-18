import type { XYPosition } from '@xyflow/react';
import type { TableNode } from '../types/erd.js';
import type { DiagramPreviewPositionRecord } from './diagram-code-draft.js';
import type { DslPreviewNode } from './dsl-preview-graph.js';

/** persisted 반영 대상 preview 위치 변경 */
export interface PersistedPreviewPositionChange {
  /** preview 노드 ID */
  previewNodeId: string;
  /** persisted 테이블 노드 ID */
  nodeId: string;
  /** 반영할 위치 */
  position: XYPosition;
}

/**
 * persisted 테이블 노드의 유일 물리명/논리명 인덱스를 만든다.
 *
 * 중복 키는 ambiguous 로 간주하고 매칭 대상에서 제외한다.
 *
 * @param nodes persisted 테이블 노드 목록
 * @returns 물리명/논리명 인덱스
 */
function buildPersistedTableIndexes(nodes: readonly TableNode[]): {
  byPhysicalName: Map<string, TableNode>;
  byLogicalName: Map<string, TableNode>;
} {
  const byPhysicalName = new Map<string, TableNode>();
  const byLogicalName = new Map<string, TableNode>();
  const ambiguousPhysicalNames = new Set<string>();
  const ambiguousLogicalNames = new Set<string>();

  for (const node of nodes) {
    if (node.type !== 'table') {
      continue;
    }

    const physicalName = node.data.label?.trim();
    if (physicalName) {
      if (ambiguousPhysicalNames.has(physicalName)) {
        byPhysicalName.delete(physicalName);
      } else if (byPhysicalName.has(physicalName)) {
        ambiguousPhysicalNames.add(physicalName);
        byPhysicalName.delete(physicalName);
      } else {
        byPhysicalName.set(physicalName, node);
      }
    }

    const logicalName = node.data.logicalTableName?.trim();
    if (logicalName) {
      if (ambiguousLogicalNames.has(logicalName)) {
        byLogicalName.delete(logicalName);
      } else if (byLogicalName.has(logicalName)) {
        ambiguousLogicalNames.add(logicalName);
        byLogicalName.delete(logicalName);
      } else {
        byLogicalName.set(logicalName, node);
      }
    }
  }

  return { byPhysicalName, byLogicalName };
}

/**
 * preview 노드와 persisted 테이블 노드의 유일 매칭을 만든다.
 *
 * 물리명 우선, 논리명 fallback이며 ambiguous 키는 제외한다.
 *
 * @param previewNodes preview 노드 목록
 * @param persistedNodes persisted 테이블 노드 목록
 * @returns previewNodeId -> persistedNode 매칭 맵
 */
export function matchPreviewNodesToPersistedNodes(
  previewNodes: readonly DslPreviewNode[],
  persistedNodes: readonly TableNode[],
): Map<string, TableNode> {
  const { byPhysicalName, byLogicalName } = buildPersistedTableIndexes(persistedNodes);
  const matchedNodes = new Map<string, TableNode>();

  for (const previewNode of previewNodes) {
    const physicalName = previewNode.data.label?.trim();
    const logicalName = previewNode.data.logicalTableName?.trim();
    const persistedNode =
      (physicalName ? byPhysicalName.get(physicalName) : undefined) ??
      (logicalName ? byLogicalName.get(logicalName) : undefined);
    if (persistedNode) {
      matchedNodes.set(previewNode.id, persistedNode);
    }
  }

  return matchedNodes;
}

/**
 * preview 노드 위치 override를 persisted 테이블 위치 변경으로 변환한다.
 *
 * 물리명 우선, 논리명 fallback 으로 persisted 테이블을 매칭한다.
 * 중복으로 모호한 키는 안전하게 건너뛴다.
 *
 * @param previewNodes code 모드 preview 노드 목록
 * @param persistedNodes 현재 persisted 테이블 노드 목록
 * @param positionOverrides preview 위치 override 맵
 * @returns persisted 반영 대상 위치 변경 목록
 */
export function buildPersistedPreviewPositionChanges(
  previewNodes: readonly DslPreviewNode[],
  persistedNodes: readonly TableNode[],
  positionOverrides: DiagramPreviewPositionRecord,
): PersistedPreviewPositionChange[] {
  const matchedNodes = matchPreviewNodesToPersistedNodes(previewNodes, persistedNodes);
  const changes: PersistedPreviewPositionChange[] = [];

  for (const previewNode of previewNodes) {
    const override = positionOverrides[previewNode.id];
    if (!override) {
      continue;
    }

    const persistedNode = matchedNodes.get(previewNode.id);
    if (!persistedNode) {
      continue;
    }

    if (
      persistedNode.position.x === override.x &&
      persistedNode.position.y === override.y
    ) {
      continue;
    }

    changes.push({
      previewNodeId: previewNode.id,
      nodeId: persistedNode.id,
      position: override,
    });
  }

  return changes;
}
