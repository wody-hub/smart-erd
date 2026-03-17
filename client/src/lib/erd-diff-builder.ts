import {
  buildDiffPlanSummary,
  type ColumnDiff,
  type CurrentColumnSnapshot,
  type CurrentEdgeSnapshot,
  type CurrentTableSnapshot,
  type DiffFallbackReason,
  type DiffParsedRelation,
  type DiffParsedTable,
  type DiffPlan,
  type DiffRelationType,
  type EdgeDiff,
  type RenameRejectReason,
  type TableDiff,
} from './erd-diff-plan.js';

/** 기본 rename 시그니처 유사도 임계치 */
const DEFAULT_RENAME_SIGNATURE_THRESHOLD = 0.9;

/** 테이블 디프 계산 입력 */
export interface BuildErdTableDiffInput {
  /** 현재 캔버스 테이블 스냅샷 */
  currentTables: CurrentTableSnapshot[];
  /** 현재 캔버스 관계 스냅샷 */
  currentEdges?: CurrentEdgeSnapshot[];
  /** 다음 파싱 테이블 스냅샷 */
  nextTables: DiffParsedTable[];
  /** 다음 파싱 관계 스냅샷 */
  nextRelations?: DiffParsedRelation[];
  /** 계획 생성 시각(ms) */
  now?: number;
}

/** 테이블 디프 계산 옵션 */
export interface BuildErdTableDiffOptions {
  /** rename 승격 최소 컬럼 시그니처 유사도 */
  renameSignatureThreshold?: number;
}

interface RenameCandidateEvaluation {
  current: CurrentTableSnapshot;
  eligible: boolean;
  rejectReason?: RenameRejectReason;
  potentialSafetyDelete: boolean;
}

/**
 * 현재/다음 테이블 스냅샷으로 DiffPlan을 계산한다.
 *
 * - P2-02: 테이블 매칭/추가/삭제/rename 승격
 * - P2-03: 매칭된 테이블의 컬럼/관계 diff 확장
 *
 * @param input 테이블 디프 계산 입력
 * @param options 계산 옵션
 * @returns 보수 정책 기반 DiffPlan
 */
export function buildErdTableDiffPlan(
  input: BuildErdTableDiffInput,
  options: BuildErdTableDiffOptions = {},
): DiffPlan {
  const threshold = options.renameSignatureThreshold ?? DEFAULT_RENAME_SIGNATURE_THRESHOLD;
  const { currentTables, currentEdges = [], nextTables, nextRelations = [] } = input;

  const tables: TableDiff[] = [];
  const matchedCurrentIds = new Set<string>();
  const matchedNextNames = new Set<string>();
  const deleteAddSafetyCurrentIds = new Set<string>();
  const fallbackReasons: DiffFallbackReason[] = [];

  const currentByName = indexCurrentTablesByName(currentTables);
  applyExactNameMatches({
    nextTables,
    currentByName,
    matchedCurrentIds,
    matchedNextNames,
    tables,
  });

  const unmatchedNext = nextTables.filter((next) => !matchedNextNames.has(next.name));
  const unmatchedCurrent = currentTables.filter((current) => !matchedCurrentIds.has(current.id));
  const parsedNeighbors = buildParsedNeighborIndex(nextRelations);
  // rename 후보 검증에는 exact-match 테이블까지 포함한 전체 관계 문맥을 사용한다.
  const currentNeighbors = buildCurrentNeighborIndex(currentTables, currentEdges);

  const renameCandidatesByNext = collectRenameCandidates({
    unmatchedNext,
    unmatchedCurrent,
    threshold,
    parsedNeighbors,
    currentNeighbors,
    deleteAddSafetyCurrentIds,
  });
  promoteRenameMatches({
    unmatchedNext,
    renameCandidatesByNext,
    matchedCurrentIds,
    matchedNextNames,
    tables,
  });
  appendAddDeleteDiffs({
    nextTables,
    currentTables,
    matchedNextNames,
    matchedCurrentIds,
    deleteAddSafetyCurrentIds,
    tables,
  });
  if (tables.some((diff) => diff.op === 'delete' && diff.reason === 'delete-add-safety')) {
    fallbackReasons.push('unsafe-match-detected');
  }

  const columnDiffs = sortColumnDiffs(buildColumnDiffs(tables));
  const edgeDiffs = sortEdgeDiffs(
    buildEdgeDiffs({
      tables,
      currentTables,
      currentEdges,
      nextRelations,
    }),
  );

  const sortedTables = sortTableDiffs(tables);
  const plan: DiffPlan = {
    meta: {
      createdAt: input.now ?? Date.now(),
      version: 'v1',
      fallbackRequired: fallbackReasons.length > 0,
      fallbackReasons,
    },
    tables: sortedTables,
    columns: columnDiffs,
    edges: edgeDiffs,
    summary: buildDiffPlanSummary({
      tables: sortedTables,
      columns: columnDiffs,
      edges: edgeDiffs,
    }),
  };

  return plan;
}

function indexCurrentTablesByName(
  currentTables: CurrentTableSnapshot[],
): Map<string, CurrentTableSnapshot[]> {
  const currentByName = new Map<string, CurrentTableSnapshot[]>();
  for (const table of currentTables) {
    const bucket = currentByName.get(table.name);
    if (bucket) {
      bucket.push(table);
      continue;
    }
    currentByName.set(table.name, [table]);
  }
  return currentByName;
}

function applyExactNameMatches(params: {
  nextTables: DiffParsedTable[];
  currentByName: Map<string, CurrentTableSnapshot[]>;
  matchedCurrentIds: Set<string>;
  matchedNextNames: Set<string>;
  tables: TableDiff[];
}): void {
  for (const next of params.nextTables) {
    const exactCandidates = (params.currentByName.get(next.name) ?? []).filter(
      (candidate) => !params.matchedCurrentIds.has(candidate.id),
    );
    // 이름 중복으로 후보가 2개 이상이면 exact 매칭을 승격하지 않고 보수 경로로 보낸다.
    if (exactCandidates.length !== 1) {
      continue;
    }
    const current = exactCandidates[0];
    params.matchedCurrentIds.add(current.id);
    params.matchedNextNames.add(next.name);
    params.tables.push({
      entity: 'table',
      op: 'update',
      tableId: current.id,
      current,
      next,
      match: {
        strategy: 'exact-name',
        confidence: 'high',
        candidateCount: 1,
      },
      rename: undefined,
    });
  }
}

function collectRenameCandidates(params: {
  unmatchedNext: DiffParsedTable[];
  unmatchedCurrent: CurrentTableSnapshot[];
  threshold: number;
  parsedNeighbors: Map<string, Set<string>>;
  currentNeighbors: Map<string, Set<string>>;
  deleteAddSafetyCurrentIds: Set<string>;
}): Map<string, CurrentTableSnapshot[]> {
  const renameCandidatesByNext = new Map<string, CurrentTableSnapshot[]>();
  for (const next of params.unmatchedNext) {
    const evaluations = params.unmatchedCurrent.map((current) =>
      evaluateRenameCandidate(next, current, {
        threshold: params.threshold,
        parsedNeighbors: params.parsedNeighbors,
        currentNeighbors: params.currentNeighbors,
      }),
    );

    const eligible = evaluations.filter((item) => item.eligible).map((item) => item.current);
    renameCandidatesByNext.set(next.name, eligible);

    for (const evalResult of evaluations) {
      if (evalResult.potentialSafetyDelete) {
        params.deleteAddSafetyCurrentIds.add(evalResult.current.id);
      }
    }
  }
  return renameCandidatesByNext;
}

function promoteRenameMatches(params: {
  unmatchedNext: DiffParsedTable[];
  renameCandidatesByNext: Map<string, CurrentTableSnapshot[]>;
  matchedCurrentIds: Set<string>;
  matchedNextNames: Set<string>;
  tables: TableDiff[];
}): void {
  const currentCandidateCount = new Map<string, number>();
  for (const candidates of params.renameCandidatesByNext.values()) {
    for (const candidate of candidates) {
      currentCandidateCount.set(candidate.id, (currentCandidateCount.get(candidate.id) ?? 0) + 1);
    }
  }

  for (const next of params.unmatchedNext) {
    const candidates = params.renameCandidatesByNext.get(next.name) ?? [];
    if (candidates.length !== 1) {
      continue;
    }
    const candidate = candidates[0];
    if ((currentCandidateCount.get(candidate.id) ?? 0) !== 1) {
      continue;
    }
    params.matchedCurrentIds.add(candidate.id);
    params.matchedNextNames.add(next.name);
    params.tables.push({
      entity: 'table',
      op: 'update',
      tableId: candidate.id,
      current: candidate,
      next,
      match: {
        strategy: 'rename-promoted',
        confidence: 'high',
        candidateCount: 1,
      },
      rename: {
        from: candidate.name,
        to: next.name,
      },
    });
  }
}

function appendAddDeleteDiffs(params: {
  nextTables: DiffParsedTable[];
  currentTables: CurrentTableSnapshot[];
  matchedNextNames: Set<string>;
  matchedCurrentIds: Set<string>;
  deleteAddSafetyCurrentIds: Set<string>;
  tables: TableDiff[];
}): void {
  for (const next of params.nextTables) {
    if (!params.matchedNextNames.has(next.name)) {
      params.tables.push({
        entity: 'table',
        op: 'add',
        next,
      });
    }
  }

  for (const current of params.currentTables) {
    if (!params.matchedCurrentIds.has(current.id)) {
      params.tables.push({
        entity: 'table',
        op: 'delete',
        tableId: current.id,
        current,
        reason: params.deleteAddSafetyCurrentIds.has(current.id)
          ? 'delete-add-safety'
          : 'missing-in-next',
      });
    }
  }
}

/**
 * 매칭된 테이블(update)에 대해 컬럼 단위 add/update/delete diff를 계산한다.
 *
 * @param tables 테이블 diff 배열
 * @returns 컬럼 diff 배열
 */
function buildColumnDiffs(tables: TableDiff[]): ColumnDiff[] {
  const diffs: ColumnDiff[] = [];

  for (const tableDiff of tables) {
    if (tableDiff.op !== 'update') {
      continue;
    }
    const currentByName = new Map<string, CurrentColumnSnapshot>();
    for (const column of tableDiff.current.columns) {
      currentByName.set(column.name, column);
    }
    const nextByName = new Map<string, DiffParsedTable['columns'][number]>();
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
 * 현재/다음 관계를 비교해 관계 단위 add/update/delete diff를 계산한다.
 *
 * @param input 관계 diff 계산 입력
 * @returns 관계 diff 배열
 */
function buildEdgeDiffs(input: {
  tables: TableDiff[];
  currentTables: CurrentTableSnapshot[];
  currentEdges: CurrentEdgeSnapshot[];
  nextRelations: DiffParsedRelation[];
}): EdgeDiff[] {
  const currentTableById = new Map<string, CurrentTableSnapshot>(
    input.currentTables.map((table) => [table.id, table]),
  );
  const renamedTableName = new Map<string, string>();
  for (const tableDiff of input.tables) {
    if (tableDiff.op !== 'update') {
      continue;
    }
    renamedTableName.set(tableDiff.current.name, tableDiff.next.name);
  }

  const currentByKey = new Map<
    string,
    { edge: CurrentEdgeSnapshot; relationType: DiffRelationType }
  >();
  for (const edge of input.currentEdges) {
    const sourceTable = currentTableById.get(edge.source);
    const targetTable = currentTableById.get(edge.target);
    if (!sourceTable || !targetTable) {
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
    const parentTable = renamedTableName.get(sourceTable.name) ?? sourceTable.name;
    const childTable = renamedTableName.get(targetTable.name) ?? targetTable.name;
    currentByKey.set(buildRelationKey({ parentTable, parentColumn, childTable, childColumn }), {
      edge,
      relationType: edge.relationType,
    });
  }

  const nextByKey = new Map<string, DiffParsedRelation>();
  for (const relation of input.nextRelations) {
    nextByKey.set(buildRelationKey(relation), relation);
  }

  const diffs: EdgeDiff[] = [];
  for (const [key, relation] of nextByKey) {
    const current = currentByKey.get(key);
    if (!current) {
      diffs.push({
        entity: 'edge',
        op: 'add',
        next: relation,
        relationType: 'non-identifying',
        routingType: 'smoothstep',
      });
      continue;
    }
    if (current.relationType !== 'non-identifying') {
      diffs.push({
        entity: 'edge',
        op: 'update',
        edgeId: current.edge.id,
        current: current.edge,
        nextRelationType: 'non-identifying',
      });
    }
  }

  for (const [key, current] of currentByKey) {
    if (!nextByKey.has(key)) {
      diffs.push({
        entity: 'edge',
        op: 'delete',
        edgeId: current.edge.id,
        current: current.edge,
      });
    }
  }

  return diffs;
}

/**
 * 현재 컬럼과 파싱 컬럼이 동일한 스키마인지 비교한다.
 *
 * @param current 현재 컬럼
 * @param next 다음 컬럼
 * @returns 동일 여부
 */
function isColumnEquivalent(
  current: CurrentColumnSnapshot,
  next: DiffParsedTable['columns'][number],
): boolean {
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
 * ParsedTable/CurrentTable의 rename 후보 적합 여부를 평가한다.
 *
 * @param next 다음 파싱 테이블
 * @param current 현재 캔버스 테이블
 * @param ctx 평가 컨텍스트
 * @returns 후보 평가 결과
 */
function evaluateRenameCandidate(
  next: DiffParsedTable,
  current: CurrentTableSnapshot,
  ctx: {
    threshold: number;
    parsedNeighbors: Map<string, Set<string>>;
    currentNeighbors: Map<string, Set<string>>;
  },
): RenameCandidateEvaluation {
  const nextPk = buildParsedPkSet(next);
  const currentPk = buildCurrentPkSet(current);
  if (!isSameStringSet(nextPk, currentPk) || nextPk.size === 0) {
    return {
      current,
      eligible: false,
      rejectReason: 'pk-mismatch',
      potentialSafetyDelete: false,
    };
  }

  const similarity = calcColumnSignatureSimilarity(next, current);
  if (similarity < ctx.threshold) {
    return {
      current,
      eligible: false,
      rejectReason: 'signature-below-threshold',
      potentialSafetyDelete: true,
    };
  }

  const relationCompatible = hasCompatibleNeighborSignature(
    next.name,
    current.name,
    ctx.parsedNeighbors,
    ctx.currentNeighbors,
  );
  if (!relationCompatible) {
    return {
      current,
      eligible: false,
      rejectReason: 'relation-conflict',
      potentialSafetyDelete: true,
    };
  }

  return {
    current,
    eligible: true,
    potentialSafetyDelete: true,
  };
}

/**
 * ParsedTable의 PK 컬럼 이름 집합을 계산한다.
 *
 * @param table 파싱 테이블
 * @returns PK 컬럼 이름 집합(소문자)
 */
function buildParsedPkSet(table: DiffParsedTable): Set<string> {
  return new Set(
    table.columns
      .filter((column) => column.pk)
      .map((column) => column.name.trim().toLowerCase())
      .filter((name) => name.length > 0),
  );
}

/**
 * CurrentTable의 PK 컬럼 이름 집합을 계산한다.
 *
 * @param table 현재 테이블
 * @returns PK 컬럼 이름 집합(소문자)
 */
function buildCurrentPkSet(table: CurrentTableSnapshot): Set<string> {
  return new Set(
    table.columns
      .filter((column) => Boolean(column.pk))
      .map((column) => column.name.trim().toLowerCase())
      .filter((name) => name.length > 0),
  );
}

/**
 * 컬럼 시그니처 기반 Jaccard 유사도를 계산한다.
 *
 * @param next 파싱 테이블
 * @param current 현재 테이블
 * @returns 0~1 범위 유사도
 */
function calcColumnSignatureSimilarity(
  next: DiffParsedTable,
  current: CurrentTableSnapshot,
): number {
  const nextSignature = new Set(
    next.columns
      .map((column) => `${column.name.trim().toLowerCase()}:${column.type.trim().toLowerCase()}`)
      .filter((value) => value.length > 1),
  );
  const currentSignature = new Set(
    current.columns
      .map((column) => `${column.name.trim().toLowerCase()}:${column.type.trim().toLowerCase()}`)
      .filter((value) => value.length > 1),
  );

  if (nextSignature.size === 0 && currentSignature.size === 0) {
    return 1;
  }
  let intersection = 0;
  for (const value of nextSignature) {
    if (currentSignature.has(value)) {
      intersection += 1;
    }
  }
  const union = nextSignature.size + currentSignature.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * 두 문자열 집합이 동일한지 검사한다.
 *
 * @param left 좌측 집합
 * @param right 우측 집합
 * @returns 완전 일치 여부
 */
function isSameStringSet(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
}

/**
 * 파싱 관계 배열에서 테이블별 이웃 테이블 집합을 계산한다.
 *
 * @param relations 파싱 관계 배열
 * @returns 테이블별 이웃 인덱스
 */
function buildParsedNeighborIndex(relations: DiffParsedRelation[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const relation of relations) {
    addNeighbor(index, relation.parentTable, relation.childTable);
    addNeighbor(index, relation.childTable, relation.parentTable);
  }
  return index;
}

/**
 * 현재 관계 배열에서 테이블별 이웃 테이블 집합을 계산한다.
 *
 * @param tables 현재 테이블 목록
 * @param edges 현재 관계 목록
 * @returns 테이블별 이웃 인덱스
 */
function buildCurrentNeighborIndex(
  tables: CurrentTableSnapshot[],
  edges: CurrentEdgeSnapshot[],
): Map<string, Set<string>> {
  const tableNameById = new Map<string, string>(tables.map((table) => [table.id, table.name]));
  const index = new Map<string, Set<string>>();

  for (const edge of edges) {
    const sourceName = tableNameById.get(edge.source);
    const targetName = tableNameById.get(edge.target);
    if (!sourceName || !targetName) {
      continue;
    }
    addNeighbor(index, sourceName, targetName);
    addNeighbor(index, targetName, sourceName);
  }
  return index;
}

/**
 * rename 후보 테이블의 관계 이웃 시그니처가 모순되지 않는지 확인한다.
 *
 * @param nextName 다음 테이블명
 * @param currentName 현재 테이블명
 * @param parsedNeighbors 다음 관계 인덱스
 * @param currentNeighbors 현재 관계 인덱스
 * @returns 관계 시그니처 모순 여부
 */
function hasCompatibleNeighborSignature(
  nextName: string,
  currentName: string,
  parsedNeighbors: Map<string, Set<string>>,
  currentNeighbors: Map<string, Set<string>>,
): boolean {
  const next = parsedNeighbors.get(nextName);
  const current = currentNeighbors.get(currentName);
  if (!next || !current) {
    return true;
  }
  if (next.size === 0 || current.size === 0) {
    return true;
  }
  let overlap = 0;
  for (const name of next) {
    if (current.has(name)) {
      overlap += 1;
    }
  }
  return overlap > 0;
}

/**
 * 이웃 테이블 인덱스에 단방향 연결을 추가한다.
 *
 * @param index 이웃 인덱스 맵
 * @param from 기준 테이블명
 * @param to 이웃 테이블명
 * @returns 없음
 */
function addNeighbor(index: Map<string, Set<string>>, from: string, to: string): void {
  if (!index.has(from)) {
    index.set(from, new Set());
  }
  index.get(from)?.add(to);
}

/**
 * 관계 정보를 비교용 키 문자열로 정규화한다.
 *
 * @param relation 관계 정보
 * @returns 비교용 키
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
 * Edge handle 문자열에서 컬럼명을 복원한다.
 *
 * @param handle handle 문자열
 * @param tableId 테이블 ID
 * @param side source/target 구분
 * @param table 테이블 스냅샷
 * @returns 컬럼명. 복원 실패 시 null
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
 * Edge handle에서 컬럼 ID를 추출한다.
 *
 * handle 포맷: `${tableId}-${columnId}-${source|target}` 또는
 * `${tableId}-${columnId}-${source|target}-${left|right}`
 *
 * @param handle handle 문자열
 * @param tableId 테이블 ID
 * @param side source/target 구분
 * @returns 컬럼 ID. 파싱 실패 시 null
 */
function extractColumnIdFromHandle(
  handle: string | undefined,
  tableId: string,
  side: 'source' | 'target',
): string | null {
  if (!handle) {
    return null;
  }
  const match = handle.match(new RegExp(`-(?:${side})(?:-(left|right))?$`));
  if (!match) {
    return null;
  }
  const noSuffix = handle.slice(0, -match[0].length);
  const prefix = `${tableId}-`;
  if (!noSuffix.startsWith(prefix)) {
    return null;
  }
  const columnId = noSuffix.slice(prefix.length);
  return columnId.length > 0 ? columnId : null;
}

/**
 * 컬럼 diff 배열을 연산/컬럼명 기준으로 안정 정렬한다.
 *
 * @param columns 컬럼 diff 배열
 * @returns 정렬된 컬럼 diff 배열
 */
function sortColumnDiffs(columns: ColumnDiff[]): ColumnDiff[] {
  const order = new Map<string, number>([
    ['update', 0],
    ['add', 1],
    ['delete', 2],
  ]);
  return [...columns].sort((left, right) => {
    const opDiff = (order.get(left.op) ?? 99) - (order.get(right.op) ?? 99);
    if (opDiff !== 0) {
      return opDiff;
    }
    const leftName = left.op === 'delete' ? left.current.name : left.next.name;
    const rightName = right.op === 'delete' ? right.current.name : right.next.name;
    const nameDiff = leftName.localeCompare(rightName);
    if (nameDiff !== 0) {
      return nameDiff;
    }
    return left.tableId.localeCompare(right.tableId);
  });
}

/**
 * 관계 diff 배열을 연산/키 기준으로 안정 정렬한다.
 *
 * @param edges 관계 diff 배열
 * @returns 정렬된 관계 diff 배열
 */
function sortEdgeDiffs(edges: EdgeDiff[]): EdgeDiff[] {
  const order = new Map<string, number>([
    ['update', 0],
    ['add', 1],
    ['delete', 2],
  ]);
  return [...edges].sort((left, right) => {
    const opDiff = (order.get(left.op) ?? 99) - (order.get(right.op) ?? 99);
    if (opDiff !== 0) {
      return opDiff;
    }
    const leftKey =
      left.op === 'add'
        ? buildRelationKey(left.next)
        : buildRelationKey({
            parentTable: left.current.source,
            parentColumn: left.current.sourceHandle ?? '',
            childTable: left.current.target,
            childColumn: left.current.targetHandle ?? '',
          });
    const rightKey =
      right.op === 'add'
        ? buildRelationKey(right.next)
        : buildRelationKey({
            parentTable: right.current.source,
            parentColumn: right.current.sourceHandle ?? '',
            childTable: right.current.target,
            childColumn: right.current.targetHandle ?? '',
          });
    return leftKey.localeCompare(rightKey);
  });
}

/**
 * 테이블 diff 배열을 연산/이름 기준으로 안정 정렬한다.
 *
 * @param tables 테이블 diff 배열
 * @returns 정렬된 테이블 diff 배열
 */
function sortTableDiffs(tables: TableDiff[]): TableDiff[] {
  const order = new Map<string, number>([
    ['update', 0],
    ['add', 1],
    ['delete', 2],
  ]);
  return [...tables].sort((left, right) => {
    const opDiff = (order.get(left.op) ?? 99) - (order.get(right.op) ?? 99);
    if (opDiff !== 0) {
      return opDiff;
    }
    const leftName = left.op === 'delete' ? left.current.name : left.next.name;
    const rightName = right.op === 'delete' ? right.current.name : right.next.name;
    return leftName.localeCompare(rightName);
  });
}
