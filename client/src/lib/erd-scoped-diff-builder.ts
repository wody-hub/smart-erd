import { extractColId } from './handle-id.js';
import {
  buildDiffPlanSummary,
  type ColumnDiff,
  type CurrentColumnSnapshot,
  type CurrentEdgeSnapshot,
  type CurrentTableSnapshot,
  type DiffParsedColumn,
  type DiffParsedRelation,
  type DiffParsedTable,
  type DiffPlan,
  type EdgeDiff,
  type TableDiff,
} from './erd-diff-plan.js';

/** scoped diff 계산 결과 */
export interface ScopedDiffBuildResult {
  /** 계산된 diff plan */
  plan: DiffPlan;
  /** scoped 경로를 안전하게 적용할 수 있는지 여부 */
  safe: boolean;
  /** 안전하지 않을 때의 사유 */
  unsafeReason?: 'duplicate-table-name' | 'mixed-add-delete';
}

interface CurrentRelationSnapshot {
  edge: CurrentEdgeSnapshot;
  relationType: CurrentEdgeSnapshot['relationType'];
  relation: DiffParsedRelation;
}

/**
 * 자동반영용 scoped diff plan 을 계산한다.
 *
 * exact-name 기준으로 변경된 테이블과, 그 테이블에 연결된 관계만 대상으로
 * 부분 diff를 만든다. rename 가능성이 큰 혼합 add/delete 케이스는 전체 diff로 fallback 한다.
 *
 * @param currentTables 현재 테이블 스냅샷
 * @param currentEdges 현재 엣지 스냅샷
 * @param nextTables 다음 파싱 테이블 스냅샷
 * @param nextRelations 다음 파싱 관계 스냅샷
 * @param now 계획 생성 시각
 * @returns scoped diff 결과
 */
export function buildScopedDiffPlan(
  currentTables: CurrentTableSnapshot[],
  currentEdges: CurrentEdgeSnapshot[],
  nextTables: DiffParsedTable[],
  nextRelations: DiffParsedRelation[],
  now = Date.now(),
): ScopedDiffBuildResult {
  const currentByName = buildUniqueTableMap(currentTables);
  const nextByName = buildUniqueParsedTableMap(nextTables);
  if (!currentByName || !nextByName) {
    return {
      plan: createEmptyDiffPlan(now),
      safe: false,
      unsafeReason: 'duplicate-table-name',
    };
  }

  const changedTableNames = collectChangedTableNames(currentByName, nextByName);
  const scopedTableNames = [
    ...new Set([
      ...changedTableNames,
      ...collectRelationChangedTableNames(currentTables, currentEdges, nextRelations),
    ]),
  ];
  const addedNames = changedTableNames.filter(
    (name) => !currentByName.has(name) && nextByName.has(name),
  );
  const deletedNames = changedTableNames.filter(
    (name) => currentByName.has(name) && !nextByName.has(name),
  );

  if (addedNames.length > 0 && deletedNames.length > 0) {
    return {
      plan: createEmptyDiffPlan(now),
      safe: false,
      unsafeReason: 'mixed-add-delete',
    };
  }

  const tables = buildScopedTableDiffs(changedTableNames, currentByName, nextByName);
  const columns = buildScopedColumnDiffs(tables);
  const edges = buildScopedEdgeDiffs({
    changedTableNames: scopedTableNames,
    currentTables,
    currentEdges,
    nextRelations,
  });

  return {
    plan: {
      meta: {
        createdAt: now,
        version: 'v1',
        fallbackRequired: false,
        fallbackReasons: [],
      },
      tables,
      columns,
      edges,
      summary: buildDiffPlanSummary({ tables, columns, edges }),
    },
    safe: true,
  };
}

/**
 * 테이블 이름 기준 유일 맵을 만든다.
 *
 * @param tables 현재 테이블 목록
 * @returns 유일 맵. 중복 이름이 있으면 null
 */
function buildUniqueTableMap(
  tables: CurrentTableSnapshot[],
): Map<string, CurrentTableSnapshot> | null {
  const map = new Map<string, CurrentTableSnapshot>();
  for (const table of tables) {
    if (map.has(table.name)) {
      return null;
    }
    map.set(table.name, table);
  }
  return map;
}

/**
 * 파싱 테이블 이름 기준 유일 맵을 만든다.
 *
 * @param tables 파싱 테이블 목록
 * @returns 유일 맵. 중복 이름이 있으면 null
 */
function buildUniqueParsedTableMap(tables: DiffParsedTable[]): Map<string, DiffParsedTable> | null {
  const map = new Map<string, DiffParsedTable>();
  for (const table of tables) {
    if (map.has(table.name)) {
      return null;
    }
    map.set(table.name, table);
  }
  return map;
}

/**
 * exact-name 기준으로 변경된 테이블 이름 집합을 계산한다.
 *
 * @param currentByName 현재 테이블 맵
 * @param nextByName 다음 테이블 맵
 * @returns 변경된 테이블명 목록
 */
function collectChangedTableNames(
  currentByName: Map<string, CurrentTableSnapshot>,
  nextByName: Map<string, DiffParsedTable>,
): string[] {
  const names = new Set<string>([...currentByName.keys(), ...nextByName.keys()]);
  return [...names].filter((name) => {
    const current = currentByName.get(name);
    const next = nextByName.get(name);
    if (!current || !next) {
      return true;
    }
    return !isTableEquivalent(current, next);
  });
}

/**
 * 관계 변경에 영향을 받는 테이블 이름 집합을 계산한다.
 *
 * 테이블 본문은 동일해도 FK 추가/삭제/관계 타입 변경이 있으면 양쪽 테이블을
 * scoped diff 대상으로 포함해야 한다.
 *
 * @param currentTables 현재 테이블 목록
 * @param currentEdges 현재 엣지 목록
 * @param nextRelations 다음 관계 목록
 * @returns 관계 변경에 영향을 받는 테이블명 목록
 */
function collectRelationChangedTableNames(
  currentTables: CurrentTableSnapshot[],
  currentEdges: CurrentEdgeSnapshot[],
  nextRelations: DiffParsedRelation[],
): string[] {
  const currentByKey = buildCurrentRelationMap(currentTables, currentEdges);
  const nextByKey = buildNextRelationMap(nextRelations);
  const changedNames = new Set<string>();
  const keys = new Set<string>([...currentByKey.keys(), ...nextByKey.keys()]);

  for (const key of keys) {
    const current = currentByKey.get(key);
    const next = nextByKey.get(key);
    if (!current || !next || current.relationType !== 'non-identifying') {
      const relation = next ?? current?.relation;
      if (!relation) {
        continue;
      }
      changedNames.add(relation.parentTable);
      changedNames.add(relation.childTable);
    }
  }

  return [...changedNames];
}

/**
 * scoped 테이블 diff를 계산한다.
 *
 * @param changedTableNames 변경된 테이블명 목록
 * @param currentByName 현재 테이블 맵
 * @param nextByName 다음 파싱 테이블 맵
 * @returns 테이블 diff 목록
 */
function buildScopedTableDiffs(
  changedTableNames: string[],
  currentByName: Map<string, CurrentTableSnapshot>,
  nextByName: Map<string, DiffParsedTable>,
): TableDiff[] {
  return changedTableNames.map((name) => {
    const current = currentByName.get(name);
    const next = nextByName.get(name);
    if (!current && next) {
      return {
        entity: 'table',
        op: 'add',
        next,
      };
    }
    if (current && !next) {
      return {
        entity: 'table',
        op: 'delete',
        tableId: current.id,
        current,
        reason: 'missing-in-next',
      };
    }
    return {
      entity: 'table',
      op: 'update',
      tableId: current!.id,
      current: current!,
      next: next!,
      match: {
        strategy: 'exact-name',
        confidence: 'high',
        candidateCount: 1,
      },
    };
  });
}

/**
 * scoped update 테이블에 대한 컬럼 diff를 계산한다.
 *
 * @param tables 테이블 diff 목록
 * @returns 컬럼 diff 목록
 */
function buildScopedColumnDiffs(tables: TableDiff[]): ColumnDiff[] {
  const diffs: ColumnDiff[] = [];

  for (const tableDiff of tables) {
    if (tableDiff.op !== 'update') {
      continue;
    }

    const currentByName = new Map<string, CurrentColumnSnapshot>();
    for (const column of tableDiff.current.columns) {
      currentByName.set(column.name, column);
    }

    const nextByName = new Map<string, DiffParsedColumn>();
    tableDiff.next.columns.forEach((column, index) => {
      nextByName.set(column.name, column);
      const current = currentByName.get(column.name);
      if (!current) {
        diffs.push({
          entity: 'column',
          op: 'add',
          tableId: tableDiff.tableId,
          next: column,
          nextIndex: index,
        });
        return;
      }
      if (!isColumnEquivalent(current, column)) {
        diffs.push({
          entity: 'column',
          op: 'update',
          tableId: tableDiff.tableId,
          columnId: current.id,
          current,
          next: column,
        });
      }
    });

    for (const current of tableDiff.current.columns) {
      if (!nextByName.has(current.name)) {
        diffs.push({
          entity: 'column',
          op: 'delete',
          tableId: tableDiff.tableId,
          columnId: current.id,
          current,
        });
      }
    }
  }

  return diffs;
}

/**
 * 변경 테이블과 연결된 관계만 대상으로 edge diff를 계산한다.
 *
 * @param input 계산 입력
 * @returns edge diff 목록
 */
function buildScopedEdgeDiffs(input: {
  changedTableNames: string[];
  currentTables: CurrentTableSnapshot[];
  currentEdges: CurrentEdgeSnapshot[];
  nextRelations: DiffParsedRelation[];
}): EdgeDiff[] {
  const changedNames = new Set(input.changedTableNames);
  const currentByKey = buildCurrentRelationMap(
    input.currentTables,
    input.currentEdges,
    changedNames,
  );
  const nextByKey = buildNextRelationMap(input.nextRelations, changedNames);
  const keys = new Set<string>([...currentByKey.keys(), ...nextByKey.keys()]);
  const diffs: EdgeDiff[] = [];

  for (const key of keys) {
    const current = currentByKey.get(key);
    const next = nextByKey.get(key);
    if (!current && next) {
      diffs.push({
        entity: 'edge',
        op: 'add',
        next,
        relationType: 'non-identifying',
        routingType: 'smoothstep',
      });
      continue;
    }
    if (current && !next) {
      diffs.push({
        entity: 'edge',
        op: 'delete',
        edgeId: current.edge.id,
        current: current.edge,
      });
      continue;
    }
    if (current && next && current.relationType !== 'non-identifying') {
      diffs.push({
        entity: 'edge',
        op: 'update',
        edgeId: current.edge.id,
        current: current.edge,
        nextRelationType: 'non-identifying',
      });
    }
  }

  return diffs;
}

/**
 * 현재 ERD edge를 relation key 기준 맵으로 변환한다.
 *
 * @param currentTables 현재 테이블 목록
 * @param currentEdges 현재 엣지 목록
 * @param changedNames 변경된 테이블명 집합
 * @returns relation key 맵
 */
function buildCurrentRelationMap(
  currentTables: CurrentTableSnapshot[],
  currentEdges: CurrentEdgeSnapshot[],
  changedNames?: Set<string>,
): Map<string, CurrentRelationSnapshot> {
  const currentTableById = new Map<string, CurrentTableSnapshot>(
    currentTables.map((table) => [table.id, table]),
  );
  const map = new Map<string, CurrentRelationSnapshot>();

  for (const edge of currentEdges) {
    const sourceTable = currentTableById.get(edge.source);
    const targetTable = currentTableById.get(edge.target);
    if (!sourceTable || !targetTable) {
      continue;
    }
    if (
      changedNames &&
      !changedNames.has(sourceTable.name) &&
      !changedNames.has(targetTable.name)
    ) {
      continue;
    }
    const parentColumn = resolveEdgeColumnName(
      edge.sourceHandle,
      edge.source,
      'source',
      sourceTable,
    );
    const childColumn = resolveEdgeColumnName(
      edge.targetHandle,
      edge.target,
      'target',
      targetTable,
    );
    if (!parentColumn || !childColumn) {
      continue;
    }
    map.set(
      buildRelationKey({
        parentTable: sourceTable.name,
        parentColumn,
        childTable: targetTable.name,
        childColumn,
      }),
      {
        edge,
        relationType: edge.relationType,
        relation: {
          parentTable: sourceTable.name,
          parentColumn,
          childTable: targetTable.name,
          childColumn,
        },
      },
    );
  }

  return map;
}

/**
 * 다음 관계에서 변경 테이블과 연결된 relation key 맵을 만든다.
 *
 * @param nextRelations 다음 관계 목록
 * @param changedNames 변경된 테이블명 집합
 * @returns relation key 맵
 */
function buildNextRelationMap(
  nextRelations: DiffParsedRelation[],
  changedNames?: Set<string>,
): Map<string, DiffParsedRelation> {
  const map = new Map<string, DiffParsedRelation>();
  for (const relation of nextRelations) {
    if (
      changedNames &&
      !changedNames.has(relation.parentTable) &&
      !changedNames.has(relation.childTable)
    ) {
      continue;
    }
    map.set(buildRelationKey(relation), relation);
  }
  return map;
}

/**
 * 현재 테이블과 다음 파싱 테이블이 동일 스키마인지 비교한다.
 *
 * @param current 현재 테이블
 * @param next 다음 파싱 테이블
 * @returns 동일 여부
 */
function isTableEquivalent(current: CurrentTableSnapshot, next: DiffParsedTable): boolean {
  if ((current.logicalTableName ?? null) !== (next.logicalTableName ?? null)) {
    return false;
  }
  if (current.columns.length !== next.columns.length) {
    return false;
  }

  const currentByName = new Map(current.columns.map((column) => [column.name, column]));
  for (const column of next.columns) {
    const currentColumn = currentByName.get(column.name);
    if (!currentColumn || !isColumnEquivalent(currentColumn, column)) {
      return false;
    }
  }
  return true;
}

/**
 * 현재 컬럼과 파싱 컬럼이 동일한 스키마인지 비교한다.
 *
 * @param current 현재 컬럼
 * @param next 다음 컬럼
 * @returns 동일 여부
 */
function isColumnEquivalent(current: CurrentColumnSnapshot, next: DiffParsedColumn): boolean {
  return (
    current.name === next.name &&
    current.type === next.type &&
    Boolean(current.pk) === next.pk &&
    Boolean(current.nullable) === next.nullable &&
    Boolean(current.autoIncrement) === next.autoIncrement &&
    (current.logicalName ?? null) === (next.logicalName ?? null) &&
    (current.termId ?? null) === (next.termId ?? null) &&
    (current.domainId ?? null) === (next.domainId ?? null)
  );
}

/**
 * relation 정보를 비교용 key 문자열로 직렬화한다.
 *
 * @param relation 관계 정보
 * @returns relation key
 */
function buildRelationKey(relation: {
  parentTable: string;
  parentColumn: string;
  childTable: string;
  childColumn: string;
}): string {
  return `${relation.parentTable}.${relation.parentColumn}->${relation.childTable}.${relation.childColumn}`;
}

/**
 * edge handle에서 컬럼명을 복원한다.
 *
 * @param handle handle 문자열
 * @param tableId 테이블 ID
 * @param side handle 방향
 * @param table 현재 테이블
 * @returns 컬럼명 또는 null
 */
function resolveEdgeColumnName(
  handle: string | undefined,
  tableId: string,
  side: 'source' | 'target',
  table: CurrentTableSnapshot,
): string | null {
  const columnId = extractColumnIdFromHandle(handle, tableId, side);
  if (!columnId) {
    return null;
  }
  const column = table.columns.find((item) => item.id === columnId);
  return column?.name ?? null;
}

/**
 * edge handle에서 컬럼 ID를 추출한다.
 *
 * @param handle handle 문자열
 * @param tableId 테이블 ID
 * @param side source/target 구분
 * @returns 컬럼 ID 또는 null
 */
function extractColumnIdFromHandle(
  handle: string | undefined,
  tableId: string,
  _side: 'source' | 'target',
): string | null {
  if (!handle) {
    return null;
  }
  return extractColId(handle, tableId);
}

/**
 * 빈 diff plan을 만든다.
 *
 * @param now 생성 시각
 * @returns 빈 계획
 */
function createEmptyDiffPlan(now: number): DiffPlan {
  return {
    meta: {
      createdAt: now,
      version: 'v1',
      fallbackRequired: false,
      fallbackReasons: [],
    },
    tables: [],
    columns: [],
    edges: [],
    summary: buildDiffPlanSummary({
      tables: [],
      columns: [],
      edges: [],
    }),
  };
}
