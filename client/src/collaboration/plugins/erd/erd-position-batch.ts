/** 위치 배치의 좌표와 낙관적 동시성 검증 기준. */
export interface PositionBatchEntry {
  tableId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  previewNodeId?: string;
}

/** 레이아웃·미리보기 위치를 한 번에 반영하는 문서 계약. */
export type PositionBatch = {
  version: 1;
  batchId: string;
  entries: PositionBatchEntry[];
};

/** 외부 payload의 구조와 일대일 대응을 쓰기 전에 검증한다. */
export function isPositionBatch(value: unknown): value is PositionBatch {
  if (!value || typeof value !== 'object') return false;
  const batch = value as PositionBatch;
  if (batch.version !== 1 || !isNonEmptyId(batch.batchId) || !Array.isArray(batch.entries)) {
    return false;
  }
  const tableIds = new Set<string>();
  const previewIds = new Set<string>();
  for (const entry of batch.entries) {
    if (
      !entry ||
      !isNonEmptyId(entry.tableId) ||
      !isFinitePosition(entry.from) ||
      !isFinitePosition(entry.to) ||
      tableIds.has(entry.tableId)
    )
      return false;
    tableIds.add(entry.tableId);
    if (entry.previewNodeId !== undefined) {
      if (!isNonEmptyId(entry.previewNodeId) || previewIds.has(entry.previewNodeId)) return false;
      previewIds.add(entry.previewNodeId);
    }
  }
  return true;
}

/** 공백뿐인 식별자를 거절한다. */
function isNonEmptyId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** 두 축 모두 유한한 숫자인지 확인한다. */
function isFinitePosition(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== 'object') return false;
  const position = value as { x: unknown; y: unknown };
  return (
    typeof position.x === 'number' &&
    Number.isFinite(position.x) &&
    typeof position.y === 'number' &&
    Number.isFinite(position.y)
  );
}
