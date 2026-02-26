/** DiffPlan 스키마 버전 */
export type DiffPlanVersion = 'v1';

/** 공통 diff 연산 타입 */
export type DiffOperation = 'add' | 'update' | 'delete';

/** rename 판정 신뢰도 */
export type MatchConfidence = 'high' | 'medium' | 'low';

/** 테이블 매칭 전략 */
export type TableMatchStrategy = 'exact-name' | 'rename-promoted' | 'delete-add';

/** rename 승격 거절 사유 */
export type RenameRejectReason =
  | 'non-unique-candidate'
  | 'pk-mismatch'
  | 'signature-below-threshold'
  | 'relation-conflict';

/** Full Replace 폴백 필요 사유 */
export type DiffFallbackReason = 'diff-apply-error' | 'invariant-broken' | 'unsafe-match-detected';

/** 관계 유형 */
export type DiffRelationType = 'identifying' | 'non-identifying';

/** 비교 대상 파싱 컬럼 */
export interface DiffParsedColumn {
  name: string;
  type: string;
  pk: boolean;
  nullable: boolean;
  autoIncrement: boolean;
  logicalName?: string;
  termId?: number;
  domainId?: number;
}

/** 비교 대상 파싱 테이블 */
export interface DiffParsedTable {
  name: string;
  logicalTableName?: string;
  tableTermId?: number;
  columns: DiffParsedColumn[];
}

/** 비교 대상 파싱 관계 */
export interface DiffParsedRelation {
  childTable: string;
  childColumn: string;
  parentTable: string;
  parentColumn: string;
}

/** 현재 컬럼 스냅샷 */
export interface CurrentColumnSnapshot {
  id: string;
  name: string;
  type: string;
  pk?: boolean;
  fk?: boolean;
  autoIncrement?: boolean;
  nullable?: boolean;
  logicalName?: string;
  termId?: number;
  domainId?: number;
}

/** 현재 테이블 스냅샷 */
export interface CurrentTableSnapshot {
  /** 현재 테이블 ID */
  id: string;
  /** 현재 테이블 물리명 */
  name: string;
  /** 현재 테이블 논리명 */
  logicalTableName?: string;
  /** 현재 위치 */
  position: { x: number; y: number };
  /** 현재 컬럼 목록 */
  columns: CurrentColumnSnapshot[];
}

/** 현재 엣지 스냅샷 */
export interface CurrentEdgeSnapshot {
  /** 현재 엣지 ID */
  id: string;
  /** source 노드 ID */
  source: string;
  /** target 노드 ID */
  target: string;
  /** source handle */
  sourceHandle?: string;
  /** target handle */
  targetHandle?: string;
  /** 관계 유형 */
  relationType: DiffRelationType;
}

/** 매칭 판정 메타 */
export interface TableMatchMeta {
  /** 선택된 전략 */
  strategy: TableMatchStrategy;
  /** 판정 신뢰도 */
  confidence: MatchConfidence;
  /** 후보 개수 */
  candidateCount: number;
  /** rename 거절 사유 */
  renameRejectReason?: RenameRejectReason;
}

/** 테이블 add diff */
export interface TableDiffAdd {
  entity: 'table';
  op: 'add';
  next: DiffParsedTable;
}

/** 테이블 update diff */
export interface TableDiffUpdate {
  entity: 'table';
  op: 'update';
  tableId: string;
  current: CurrentTableSnapshot;
  next: DiffParsedTable;
  match: TableMatchMeta;
  rename?: {
    from: string;
    to: string;
  };
}

/** 테이블 delete diff */
export interface TableDiffDelete {
  entity: 'table';
  op: 'delete';
  tableId: string;
  current: CurrentTableSnapshot;
  reason: 'missing-in-next' | 'delete-add-safety';
}

/** 테이블 diff 연산 */
export type TableDiff = TableDiffAdd | TableDiffUpdate | TableDiffDelete;

/** 컬럼 add diff */
export interface ColumnDiffAdd {
  entity: 'column';
  op: 'add';
  tableId: string;
  next: DiffParsedColumn;
  nextIndex: number;
}

/** 컬럼 update diff */
export interface ColumnDiffUpdate {
  entity: 'column';
  op: 'update';
  tableId: string;
  columnId: string;
  current: CurrentColumnSnapshot;
  next: DiffParsedColumn;
}

/** 컬럼 delete diff */
export interface ColumnDiffDelete {
  entity: 'column';
  op: 'delete';
  tableId: string;
  columnId: string;
  current: CurrentColumnSnapshot;
}

/** 컬럼 diff 연산 */
export type ColumnDiff = ColumnDiffAdd | ColumnDiffUpdate | ColumnDiffDelete;

/** 관계 add diff */
export interface EdgeDiffAdd {
  entity: 'edge';
  op: 'add';
  next: DiffParsedRelation;
  relationType: DiffRelationType;
}

/** 관계 update diff (관계 유형 변경) */
export interface EdgeDiffUpdate {
  entity: 'edge';
  op: 'update';
  edgeId: string;
  current: CurrentEdgeSnapshot;
  nextRelationType: DiffRelationType;
}

/** 관계 delete diff */
export interface EdgeDiffDelete {
  entity: 'edge';
  op: 'delete';
  edgeId: string;
  current: CurrentEdgeSnapshot;
}

/** 관계 diff 연산 */
export type EdgeDiff = EdgeDiffAdd | EdgeDiffUpdate | EdgeDiffDelete;

/** diff 계획 집계 */
export interface DiffPlanSummary {
  tableAdds: number;
  tableUpdates: number;
  tableDeletes: number;
  columnAdds: number;
  columnUpdates: number;
  columnDeletes: number;
  edgeAdds: number;
  edgeUpdates: number;
  edgeDeletes: number;
  totalOperations: number;
}

/** diff 계획 메타 */
export interface DiffPlanMeta {
  /** 생성 시각(epoch ms) */
  createdAt: number;
  /** 스키마 버전 */
  version: DiffPlanVersion;
  /** 폴백 필요 여부 */
  fallbackRequired: boolean;
  /** 폴백 사유 */
  fallbackReasons: DiffFallbackReason[];
}

/** Phase 2 증분 반영 계획 */
export interface DiffPlan {
  /** 메타 정보 */
  meta: DiffPlanMeta;
  /** 테이블 단위 변경 */
  tables: TableDiff[];
  /** 컬럼 단위 변경 */
  columns: ColumnDiff[];
  /** 관계 단위 변경 */
  edges: EdgeDiff[];
  /** 집계 */
  summary: DiffPlanSummary;
}

/** DiffPlan 요약 계산 입력 */
type DiffPlanSummaryInput = Pick<DiffPlan, 'tables' | 'columns' | 'edges'>;

/**
 * 테이블/컬럼/관계 diff 연산을 집계해 요약 정보를 계산한다.
 *
 * @param input diff 연산 입력
 * @returns 연산별 카운트와 총 변경 수
 */
export function buildDiffPlanSummary(input: DiffPlanSummaryInput): DiffPlanSummary {
  const tableAdds = input.tables.filter((item) => item.op === 'add').length;
  const tableUpdates = input.tables.filter((item) => item.op === 'update').length;
  const tableDeletes = input.tables.filter((item) => item.op === 'delete').length;

  const columnAdds = input.columns.filter((item) => item.op === 'add').length;
  const columnUpdates = input.columns.filter((item) => item.op === 'update').length;
  const columnDeletes = input.columns.filter((item) => item.op === 'delete').length;

  const edgeAdds = input.edges.filter((item) => item.op === 'add').length;
  const edgeUpdates = input.edges.filter((item) => item.op === 'update').length;
  const edgeDeletes = input.edges.filter((item) => item.op === 'delete').length;

  return {
    tableAdds,
    tableUpdates,
    tableDeletes,
    columnAdds,
    columnUpdates,
    columnDeletes,
    edgeAdds,
    edgeUpdates,
    edgeDeletes,
    totalOperations:
      tableAdds +
      tableUpdates +
      tableDeletes +
      columnAdds +
      columnUpdates +
      columnDeletes +
      edgeAdds +
      edgeUpdates +
      edgeDeletes,
  };
}

/**
 * DiffPlan에 실질적인 변경 연산이 있는지 판정한다.
 *
 * @param input diff 연산 입력
 * @returns 변경 연산이 1건 이상이면 true
 */
export function hasDiffChanges(input: DiffPlanSummaryInput): boolean {
  return buildDiffPlanSummary(input).totalOperations > 0;
}

/**
 * 현재 캔버스 상태를 DiffPlan 비교용 스냅샷으로 정규화한다.
 *
 * @param nodes 현재 캔버스 노드
 * @param edges 현재 캔버스 엣지
 * @returns 테이블/관계 현재 스냅샷
 */
export function createCurrentSnapshots(
  nodes: DiffSourceNode[],
  edges: DiffSourceEdge[],
): {
  tables: CurrentTableSnapshot[];
  edgeById: Record<string, CurrentEdgeSnapshot>;
} {
  const tables: CurrentTableSnapshot[] = nodes.map((node) => ({
    id: node.id,
    name: node.data.label,
    logicalTableName: node.data.logicalTableName,
    position: { x: node.position.x, y: node.position.y },
    columns: node.data.columns.map(
      (column): CurrentColumnSnapshot => ({
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
      }),
    ),
  }));

  const edgeById = Object.fromEntries(
    edges.map((edge) => [
      edge.id,
      {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        relationType: edge.data?.relationType ?? 'non-identifying',
      },
    ]),
  ) as Record<string, CurrentEdgeSnapshot>;

  return { tables, edgeById };
}

/** 캔버스 비교용 컬럼 입력 */
export interface DiffSourceColumn {
  id: string;
  name: string;
  type: string;
  pk?: boolean;
  fk?: boolean;
  autoIncrement?: boolean;
  nullable?: boolean;
  logicalName?: string;
  termId?: number;
  domainId?: number;
}

/** 캔버스 비교용 노드 입력 */
export interface DiffSourceNode {
  id: string;
  position: { x: number; y: number };
  data: {
    label: string;
    logicalTableName?: string;
    columns: DiffSourceColumn[];
  };
}

/** 캔버스 비교용 엣지 입력 */
export interface DiffSourceEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: {
    relationType?: DiffRelationType;
  };
}
