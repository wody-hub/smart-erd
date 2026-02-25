import * as Y from 'yjs';
import type { DdlParseResult } from '@/lib/ddl-parser';
import { createEdgeYMap, createTableYMap } from '@/collaboration/yjsBridge';

/** DDL 파싱 결과를 Y.Map에 반영할 때의 옵션 */
export interface PopulateDdlOptions {
  /** 테이블 이름 변환 함수 (중복 회피 등) */
  resolveTableName: (original: string) => string;
  /** 테이블 배치 시작 Y 좌표 */
  startY: number;
}

/**
 * 컬럼 Y.Array에서 컬럼 ID와 일치하는 컬럼 Y.Map을 찾는다.
 *
 * @param colsYArray 컬럼 Y.Array
 * @param colId 찾을 컬럼 ID
 * @returns 일치하는 컬럼 Y.Map 또는 undefined
 */
export function findColumnYMap(
  colsYArray: Y.Array<Y.Map<unknown>>,
  colId: string,
): Y.Map<unknown> | undefined {
  for (let i = 0; i < colsYArray.length; i += 1) {
    const colYMap = colsYArray.get(i);
    if (colYMap.get('id') === colId) {
      return colYMap;
    }
  }
  return undefined;
}

function sanitizeTableName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export function buildUniqueName(base: string, existing: string[]): string {
  if (!existing.includes(base)) {
    return base;
  }
  let i = 1;
  while (existing.includes(`${base}_${i}`)) {
    i += 1;
  }
  return `${base}_${i}`;
}

/**
 * DDL 파싱 결과를 Y.Map(tablesMap, edgesMap)에 테이블/엣지로 반영한다.
 *
 * importDdl(APPEND)과 replaceFromDdl(REPLACE) 공통 로직.
 *
 * @param tablesMap Y.Map 테이블 맵
 * @param edgesMap  Y.Map 엣지 맵
 * @param result    DDL 파싱 결과
 * @param options   테이블 이름 변환 함수, 시작 Y 좌표
 */
export function populateFromDdl(
  tablesMap: Y.Map<Y.Map<unknown>>,
  edgesMap: Y.Map<Y.Map<unknown>>,
  result: DdlParseResult,
  options: PopulateDdlOptions,
) {
  const tableMap = new Map<string, { nodeId: string; colMap: Map<string, string> }>();
  const GRID_COLS = 4;
  const GRID_X = 300;
  const GRID_Y = 250;
  const START_X = 100;
  const { resolveTableName, startY } = options;

  result.tables.forEach((table, idx) => {
    const name = resolveTableName(table.name);
    const nodeId = `table-${crypto.randomUUID()}`;
    const colMap = new Map<string, string>();

    const columns = table.columns.map((col) => {
      const colId = `col-${crypto.randomUUID()}`;
      colMap.set(col.name, colId);
      return {
        id: colId,
        name: col.name,
        type: col.type,
        pk: col.pk || undefined,
        fk: undefined,
        nullable: col.nullable,
        autoIncrement: col.autoIncrement || undefined,
        logicalName: col.logicalName || col.comment || undefined,
        termId: col.termId,
        domainId: col.domainId,
      };
    });

    tablesMap.set(
      nodeId,
      createTableYMap(
        name,
        {
          x: START_X + (idx % GRID_COLS) * GRID_X,
          y: startY + Math.floor(idx / GRID_COLS) * GRID_Y,
        },
        columns,
        {
          logicalTableName: table.logicalTableName || table.comment || undefined,
          tableTermId: table.tableTermId,
        },
      ),
    );
    tableMap.set(table.name, { nodeId, colMap });
  });

  result.relations.forEach((relation) => {
    const parent = tableMap.get(relation.parentTable);
    const child = tableMap.get(relation.childTable);
    if (!parent || !child) {
      return;
    }

    const parentColId = parent.colMap.get(relation.parentColumn);
    const childColId = child.colMap.get(relation.childColumn);
    if (!parentColId || !childColId) {
      return;
    }

    const childTableYMap = tablesMap.get(child.nodeId);
    if (childTableYMap) {
      const colsYArray = childTableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
      if (colsYArray) {
        const childColYMap = findColumnYMap(colsYArray, childColId);
        if (childColYMap) {
          childColYMap.set('fk', true);
        }
      }
    }

    const sourceHandle = `${parent.nodeId}-${parentColId}-source`;
    const targetHandle = `${child.nodeId}-${childColId}-target`;
    edgesMap.set(
      `e-${sourceHandle}-${targetHandle}`,
      createEdgeYMap(parent.nodeId, child.nodeId, sourceHandle, targetHandle, 'non-identifying'),
    );
  });
}

/**
 * FK 컬럼 자동 생성용 부모 테이블 이름 접두사를 생성한다.
 *
 * @param parentLabel 부모 테이블 표시명
 * @returns 정규화된 접두사
 */
export function buildFkPrefix(parentLabel: string): string {
  return sanitizeTableName(parentLabel);
}

/**
 * FK 컬럼명 중복을 피한 고유 이름을 생성한다.
 *
 * @param baseName 기본 컬럼명
 * @param existingNames 기존 컬럼명 목록
 * @returns 고유 컬럼명
 */
export function buildUniqueFkColumnName(baseName: string, existingNames: string[]): string {
  return buildUniqueName(baseName, existingNames);
}
