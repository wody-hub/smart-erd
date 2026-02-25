import { djb2 } from './hash.js';

/** ERD 리비전 해시 계산용 노드 스냅샷 */
export interface RevisionSnapshotNode {
  id: string;
  type: string;
  parentId: string | null;
  position: { x: number; y: number };
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

/** 객체 키를 정렬해 결정적 직렬화를 보장한다. */
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

/** nodes/edges/groupNodes 스냅샷으로 결정적 리비전 해시를 계산한다. */
export function buildRevisionHash(
  nodes: RevisionSnapshotNode[],
  edges: RevisionSnapshotEdge[],
  groupNodes: RevisionSnapshotNode[],
): string {
  const payload = {
    nodes: [...nodes].sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...edges].sort((a, b) => a.id.localeCompare(b.id)),
    groups: [...groupNodes].sort((a, b) => a.id.localeCompare(b.id)),
  };
  return djb2(JSON.stringify(sortObjectKeys(payload)));
}
