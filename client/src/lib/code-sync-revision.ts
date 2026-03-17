import { djb2 } from './hash.js';
import { extractColId } from './handle-id.js';

/** ERD 리비전 해시 계산용 노드 스냅샷 — 구조 변경만 감지 (position 제외) */
export interface RevisionSnapshotNode {
  id: string;
  type: string;
  parentId: string | null;
  data: unknown;
}

/** ERD 리비전 해시 계산용 엣지 스냅샷 */
export interface RevisionSnapshotEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  type: string;
  data: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeColumnForRevision(column: unknown): unknown {
  if (!isRecord(column)) {
    return column;
  }

  return {
    id: column.id,
    name: column.name,
    type: column.type,
    pk: column.pk,
    fk: column.fk,
    autoIncrement: column.autoIncrement,
    nullable: column.nullable,
    logicalName: column.logicalName,
    termId: column.termId,
    domainId: column.domainId,
  };
}

function sanitizeNodeDataForRevision(data: unknown): unknown {
  if (!isRecord(data)) {
    return data;
  }

  return {
    label: data.label,
    logicalTableName: data.logicalTableName,
    tableTermId: data.tableTermId,
    columns: Array.isArray(data.columns)
      ? data.columns.map((column) => sanitizeColumnForRevision(column))
      : undefined,
  };
}

function extractRevisionColumnId(handleId: string | null, nodeId: string): string | null {
  if (!handleId) {
    return null;
  }

  return extractColId(handleId, nodeId);
}

function sanitizeEdgeDataForRevision(edge: RevisionSnapshotEdge): unknown {
  const edgeData = isRecord(edge.data) ? edge.data : null;

  return {
    relationType: edgeData?.relationType,
    sourceColumnId: extractRevisionColumnId(edge.sourceHandle, edge.source),
    targetColumnId: extractRevisionColumnId(edge.targetHandle, edge.target),
  };
}

/**
 * 객체 키를 정렬해 결정적 직렬화를 보장한다.
 *
 * @param value 정렬 대상 값
 * @returns 키 정렬이 적용된 값
 */
export function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return Object.fromEntries(entries.map(([key, val]) => [key, sortObjectKeys(val)]));
  }
  return value;
}

/**
 * nodes/edges 스냅샷으로 결정적 리비전 해시를 계산한다.
 *
 * @param nodes 노드 스냅샷 목록
 * @param edges 엣지 스냅샷 목록
 * @returns 결정적 리비전 해시
 */
export function buildRevisionHash(
  nodes: RevisionSnapshotNode[],
  edges: RevisionSnapshotEdge[],
): string {
  const payload = {
    nodes: [...nodes]
      .map((node) => ({
        id: node.id,
        type: node.type,
        parentId: node.parentId,
        data: sanitizeNodeDataForRevision(node.data),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...edges]
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        data: sanitizeEdgeDataForRevision(edge),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
  return djb2(JSON.stringify(sortObjectKeys(payload)));
}
