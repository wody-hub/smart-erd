import * as Y from 'yjs';
import { CANVAS_HISTORY_ORIGIN } from '@/constants/canvas-history';
import type { EdgeHandleMode, EdgeHandleSide, EdgeRoutingType, Waypoint } from '../types/erd.js';
import type { DiffPlan, DiffParsedColumn, DiffRelationType } from './erd-diff-plan.js';
import {
  createWaypointsYArray,
  readWaypointsFromEdgeYMap,
  setTableYMapPosition,
  syncLegacyWaypointsInEdgeYMap,
} from '../collaboration/yjsBridge.js';
import { buildStableEdgeId, resolveEdgeHandlesFromPreference } from './edge-handles.js';
import { extractColId, extractHandleSide } from './handle-id.js';
import { resolvePreservedWaypoints } from './edge-presentation-restore.js';

/** DiffPlan 적용 결과 요약 */
export interface ApplyDiffResult {
  /** 트랜잭션 적용 여부 */
  applied: boolean;
  /** 실제 적용된 연산 수 */
  appliedOperations: number;
  /** 참조 불일치 등으로 건너뛴 연산 수 */
  skippedOperations: number;
  /** 그룹 재매핑 통계 */
  groupRemap: {
    keptCount: number;
    droppedCount: number;
    droppedByPolicy: number;
    droppedByMissing: number;
  };
}

interface DiffApplyCounters {
  appliedOperations: number;
  skippedOperations: number;
  droppedByPolicy: number;
  droppedByMissing: number;
}

interface DiffApplyContext {
  plan: DiffPlan;
  tablesMap: Y.Map<Y.Map<unknown>>;
  edgesMap: Y.Map<Y.Map<unknown>>;
  groupsMap: Y.Map<Y.Map<unknown>>;
  columnLookup: Map<string, Map<string, string>>;
  edgePresentationByBinding: Map<string, EdgePresentationSnapshot>;
  counters: DiffApplyCounters;
}

interface EdgePresentationSnapshot {
  routingType?: EdgeRoutingType;
  sourceHandle: string;
  targetHandle: string;
  waypoints?: Waypoint[];
  handleMode?: EdgeHandleMode;
  sourceSide?: EdgeHandleSide;
  targetSide?: EdgeHandleSide;
  resolvedSourceSide?: EdgeHandleSide;
  resolvedTargetSide?: EdgeHandleSide;
}

function readLegacyPositionAxis(rawPosition: unknown, axis: 'x' | 'y'): number | undefined {
  if (rawPosition instanceof Y.Map) {
    const value = rawPosition.get(axis);
    return typeof value === 'number' ? value : undefined;
  }
  if (!rawPosition || typeof rawPosition !== 'object') {
    return undefined;
  }
  const value = (rawPosition as Record<'x' | 'y', unknown>)[axis];
  return typeof value === 'number' ? value : undefined;
}

/**
 * DiffPlan을 Y.Doc에 원자 트랜잭션으로 증분 반영한다.
 *
 * 테이블/컬럼/관계 연산을 순차 적용하고, 마지막에 무결성 정리(깨진 엣지/그룹 참조 제거)를 수행한다.
 *
 * @param doc 대상 Y.Doc
 * @param plan 증분 반영 계획
 * @param origin Yjs transaction origin
 * @returns 적용 결과 요약
 */
export function applyDiffToYDoc(doc: Y.Doc, plan: DiffPlan, origin?: unknown): ApplyDiffResult {
  const context: DiffApplyContext = {
    plan,
    tablesMap: doc.getMap('tables') as Y.Map<Y.Map<unknown>>,
    edgesMap: doc.getMap('edges') as Y.Map<Y.Map<unknown>>,
    groupsMap: doc.getMap('groups') as Y.Map<Y.Map<unknown>>,
    columnLookup: new Map<string, Map<string, string>>(),
    edgePresentationByBinding: new Map<string, EdgePresentationSnapshot>(),
    counters: {
      appliedOperations: 0,
      skippedOperations: 0,
      droppedByPolicy: 0,
      droppedByMissing: 0,
    },
  };

  doc.transact(() => {
    applyTableDeletes(context);
    applyTableUpdates(context);
    applyTableAdds(context);

    refreshColumnNameLookup(context.tablesMap, context.columnLookup);
    applyColumnDeletes(context);
    applyColumnUpdates(context);

    refreshColumnNameLookup(context.tablesMap, context.columnLookup);
    applyColumnAdds(context);

    captureExistingEdgePresentation(context);
    applyEdgeDeletesAndUpdates(context);

    refreshColumnNameLookup(context.tablesMap, context.columnLookup);
    applyEdgeAdds(context);

    cleanupInvalidEdges(context.tablesMap, context.edgesMap);
    normalizeForeignKeyFlags(context.tablesMap, context.edgesMap);
    context.counters.droppedByPolicy += applyConservativeGroupMembershipPolicy(
      context.groupsMap,
      context.plan,
    );
    context.counters.droppedByMissing += cleanupGroupTableReferences(
      context.groupsMap,
      context.tablesMap,
    );
  }, origin ?? CANVAS_HISTORY_ORIGIN.SYSTEM_CODE_SYNC);

  const { appliedOperations, skippedOperations, droppedByPolicy, droppedByMissing } =
    context.counters;
  const keptCount = countGroupTableRefs(context.groupsMap);
  return {
    applied: true,
    appliedOperations,
    skippedOperations,
    groupRemap: {
      keptCount,
      droppedCount: droppedByPolicy + droppedByMissing,
      droppedByPolicy,
      droppedByMissing,
    },
  };
}

/**
 * 테이블 delete diff를 적용한다.
 *
 * @param context diff 적용 컨텍스트
 * @returns 없음
 */
function applyTableDeletes(context: DiffApplyContext): void {
  for (const tableDiff of context.plan.tables) {
    if (tableDiff.op !== 'delete') {
      continue;
    }
    if (!context.tablesMap.has(tableDiff.tableId)) {
      context.counters.skippedOperations += 1;
      continue;
    }

    context.tablesMap.delete(tableDiff.tableId);
    context.counters.appliedOperations += 1;

    context.groupsMap.forEach((groupYMap) => {
      const tableIdsYArray = groupYMap.get('tableIds') as Y.Array<string> | undefined;
      if (!tableIdsYArray || tableIdsYArray.length === 0) {
        return;
      }
      for (let i = tableIdsYArray.length - 1; i >= 0; i -= 1) {
        if (tableIdsYArray.get(i) === tableDiff.tableId) {
          tableIdsYArray.delete(i, 1);
          context.counters.droppedByMissing += 1;
        }
      }
    });
  }
}

/**
 * 테이블 update diff를 적용한다.
 *
 * @param context diff 적용 컨텍스트
 * @returns 없음
 */
function applyTableUpdates(context: DiffApplyContext): void {
  for (const tableDiff of context.plan.tables) {
    if (tableDiff.op !== 'update') {
      continue;
    }
    const tableYMap = context.tablesMap.get(tableDiff.tableId);
    if (!tableYMap) {
      context.counters.skippedOperations += 1;
      continue;
    }

    tableYMap.set('label', tableDiff.next.name);
    if (tableDiff.next.logicalTableName) {
      tableYMap.set('logicalTableName', tableDiff.next.logicalTableName);
    } else {
      tableYMap.delete('logicalTableName');
    }
    if (tableDiff.next.tableTermId != null) {
      tableYMap.set('tableTermId', tableDiff.next.tableTermId);
    } else {
      tableYMap.delete('tableTermId');
    }
    context.counters.appliedOperations += 1;
  }
}

/**
 * 테이블 add diff를 적용한다.
 *
 * @param context diff 적용 컨텍스트
 * @returns 없음
 */
function applyTableAdds(context: DiffApplyContext): void {
  const nextPosition = computeNextTablePosition(context.tablesMap);
  for (const tableDiff of context.plan.tables) {
    if (tableDiff.op !== 'add') {
      continue;
    }

    const tableId = `table-${crypto.randomUUID()}`;
    const tableYMap = new Y.Map<unknown>();
    tableYMap.set('label', tableDiff.next.name);
    if (tableDiff.next.logicalTableName) {
      tableYMap.set('logicalTableName', tableDiff.next.logicalTableName);
    }
    if (tableDiff.next.tableTermId != null) {
      tableYMap.set('tableTermId', tableDiff.next.tableTermId);
    }

    setTableYMapPosition(tableYMap, nextPosition);
    nextPosition.x += 300;

    const columnsYArray = new Y.Array<Y.Map<unknown>>();
    for (const column of tableDiff.next.columns) {
      const colId = `col-${crypto.randomUUID()}`;
      columnsYArray.push([createColumnYMap({ id: colId, ...column })]);
    }
    tableYMap.set('columns', columnsYArray);

    context.tablesMap.set(tableId, tableYMap);
    context.counters.appliedOperations += 1;
  }
}

/**
 * 컬럼 delete diff를 적용한다.
 *
 * @param context diff 적용 컨텍스트
 * @returns 없음
 */
function applyColumnDeletes(context: DiffApplyContext): void {
  for (const columnDiff of context.plan.columns) {
    if (columnDiff.op !== 'delete') {
      continue;
    }
    const tableYMap = context.tablesMap.get(columnDiff.tableId);
    if (!tableYMap) {
      context.counters.skippedOperations += 1;
      continue;
    }
    const columnsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
    if (!columnsYArray) {
      context.counters.skippedOperations += 1;
      continue;
    }
    if (!deleteColumnById(columnsYArray, columnDiff.columnId)) {
      context.counters.skippedOperations += 1;
      continue;
    }
    context.counters.appliedOperations += 1;
  }
}

/**
 * 컬럼 update diff를 적용한다.
 *
 * @param context diff 적용 컨텍스트
 * @returns 없음
 */
function applyColumnUpdates(context: DiffApplyContext): void {
  for (const columnDiff of context.plan.columns) {
    if (columnDiff.op !== 'update') {
      continue;
    }
    const tableYMap = context.tablesMap.get(columnDiff.tableId);
    if (!tableYMap) {
      context.counters.skippedOperations += 1;
      continue;
    }
    const columnsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
    if (!columnsYArray) {
      context.counters.skippedOperations += 1;
      continue;
    }
    const colYMap = findColumnYMap(columnsYArray, columnDiff.columnId);
    if (!colYMap) {
      context.counters.skippedOperations += 1;
      continue;
    }
    applyColumnYMapUpdate(colYMap, columnDiff.next);
    context.counters.appliedOperations += 1;
  }
}

/**
 * 컬럼 add diff를 적용한다.
 *
 * @param context diff 적용 컨텍스트
 * @returns 없음
 */
function applyColumnAdds(context: DiffApplyContext): void {
  for (const columnDiff of context.plan.columns) {
    if (columnDiff.op !== 'add') {
      continue;
    }
    const tableYMap = context.tablesMap.get(columnDiff.tableId);
    if (!tableYMap) {
      context.counters.skippedOperations += 1;
      continue;
    }
    const columnsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
    if (!columnsYArray) {
      context.counters.skippedOperations += 1;
      continue;
    }
    if (findColumnByName(columnsYArray, columnDiff.next.name)) {
      context.counters.skippedOperations += 1;
      continue;
    }
    const colId = `col-${crypto.randomUUID()}`;
    const colYMap = createColumnYMap({ id: colId, ...columnDiff.next });
    const index = Math.min(Math.max(columnDiff.nextIndex, 0), columnsYArray.length);
    if (index === columnsYArray.length) {
      columnsYArray.push([colYMap]);
    } else {
      columnsYArray.insert(index, [colYMap]);
    }
    context.counters.appliedOperations += 1;
  }
}

/**
 * 엣지 delete/update diff를 적용한다.
 *
 * @param context diff 적용 컨텍스트
 * @returns 없음
 */
function applyEdgeDeletesAndUpdates(context: DiffApplyContext): void {
  for (const edgeDiff of context.plan.edges) {
    if (edgeDiff.op === 'delete') {
      if (context.edgesMap.has(edgeDiff.edgeId)) {
        context.edgesMap.delete(edgeDiff.edgeId);
        context.counters.appliedOperations += 1;
      } else {
        context.counters.skippedOperations += 1;
      }
      continue;
    }
    if (edgeDiff.op === 'update') {
      const edgeYMap = context.edgesMap.get(edgeDiff.edgeId);
      if (!edgeYMap) {
        context.counters.skippedOperations += 1;
        continue;
      }
      edgeYMap.set('relationType', edgeDiff.nextRelationType);
      context.counters.appliedOperations += 1;
    }
  }
}

/**
 * 엣지 add diff를 적용한다.
 *
 * @param context diff 적용 컨텍스트
 * @returns 없음
 */
function applyEdgeAdds(context: DiffApplyContext): void {
  const tableIdByName = buildTableIdByName(context.tablesMap);
  for (const edgeDiff of context.plan.edges) {
    if (edgeDiff.op !== 'add') {
      continue;
    }
    const parentTableId = tableIdByName.get(edgeDiff.next.parentTable);
    const childTableId = tableIdByName.get(edgeDiff.next.childTable);
    if (!parentTableId || !childTableId) {
      context.counters.skippedOperations += 1;
      continue;
    }
    const parentColId = context.columnLookup.get(parentTableId)?.get(edgeDiff.next.parentColumn);
    const childColId = context.columnLookup.get(childTableId)?.get(edgeDiff.next.childColumn);
    if (!parentColId || !childColId) {
      context.counters.skippedOperations += 1;
      continue;
    }

    const sourceNode = buildTableNodeLike(context.tablesMap, parentTableId);
    const targetNode = buildTableNodeLike(context.tablesMap, childTableId);
    if (!sourceNode || !targetNode) {
      context.counters.skippedOperations += 1;
      continue;
    }
    const carriedPresentation =
      context.edgePresentationByBinding.get(
        buildEdgeBindingKey(parentTableId, parentColId, childTableId, childColId),
      ) ?? null;
    const resolution = resolveEdgeHandlesFromPreference({
      sourceNode,
      targetNode,
      sourceColId: parentColId,
      targetColId: childColId,
      handleMode: carriedPresentation?.handleMode ?? edgeDiff.handleMode,
      sourceSide: carriedPresentation?.sourceSide ?? edgeDiff.sourceSide,
      targetSide: carriedPresentation?.targetSide ?? edgeDiff.targetSide,
    });
    const { sourceHandle, targetHandle } = resolution;
    const edgeId = buildStableEdgeId({
      parentTable: edgeDiff.next.parentTable,
      parentColumn: edgeDiff.next.parentColumn,
      childTable: edgeDiff.next.childTable,
      childColumn: edgeDiff.next.childColumn,
    });
    const nextRoutingType =
      carriedPresentation?.routingType ?? edgeDiff.routingType ?? 'smoothstep';
    const preservedWaypoints =
      resolvePreservedWaypoints({
        routingType: nextRoutingType,
        previousSourceHandle: carriedPresentation?.sourceHandle,
        previousTargetHandle: carriedPresentation?.targetHandle,
        nextSourceHandle: sourceHandle,
        nextTargetHandle: targetHandle,
        previousSourceSide: carriedPresentation?.resolvedSourceSide,
        previousTargetSide: carriedPresentation?.resolvedTargetSide,
        nextSourceSide: resolution.sourceSide,
        nextTargetSide: resolution.targetSide,
        waypoints: carriedPresentation?.waypoints,
      }) ?? edgeDiff.waypoints;
    const edgeYMap = createEdgeYMap(
      parentTableId,
      childTableId,
      sourceHandle,
      targetHandle,
      edgeDiff.relationType,
      nextRoutingType,
      preservedWaypoints,
      resolution.handleMode,
      resolution.sourceSide,
      resolution.targetSide,
    );
    context.edgesMap.set(edgeId, edgeYMap);
    syncLegacyWaypointsInEdgeYMap(edgeYMap);
    context.counters.appliedOperations += 1;
  }
}

function captureExistingEdgePresentation(context: DiffApplyContext): void {
  context.edgePresentationByBinding.clear();
  context.edgesMap.forEach((edgeYMap) => {
    const source = edgeYMap.get('source');
    const target = edgeYMap.get('target');
    const sourceHandle = edgeYMap.get('sourceHandle');
    const targetHandle = edgeYMap.get('targetHandle');
    if (
      typeof source !== 'string' ||
      typeof target !== 'string' ||
      typeof sourceHandle !== 'string' ||
      typeof targetHandle !== 'string'
    ) {
      return;
    }
    const sourceColId = extractColId(sourceHandle, source);
    const targetColId = extractColId(targetHandle, target);
    context.edgePresentationByBinding.set(
      buildEdgeBindingKey(source, sourceColId, target, targetColId),
      {
        routingType: (edgeYMap.get('routingType') as EdgeRoutingType | undefined) ?? 'smoothstep',
        sourceHandle,
        targetHandle,
        waypoints: readWaypointsFromEdgeYMap(edgeYMap),
        handleMode: (edgeYMap.get('handleMode') as EdgeHandleMode | undefined) ?? undefined,
        sourceSide: (edgeYMap.get('sourceSide') as EdgeHandleSide | undefined) ?? undefined,
        targetSide: (edgeYMap.get('targetSide') as EdgeHandleSide | undefined) ?? undefined,
        resolvedSourceSide: extractHandleSide(sourceHandle) ?? undefined,
        resolvedTargetSide: extractHandleSide(targetHandle) ?? undefined,
      },
    );
  });
}

function buildEdgeBindingKey(
  sourceTableId: string,
  sourceColId: string,
  targetTableId: string,
  targetColId: string,
): string {
  return `${sourceTableId}:${sourceColId}->${targetTableId}:${targetColId}`;
}

/**
 * 다음 테이블 기본 배치 좌표를 계산한다.
 *
 * @param tablesMap 테이블 Y.Map
 * @returns 신규 테이블 기본 좌표
 */
function computeNextTablePosition(tablesMap: Y.Map<Y.Map<unknown>>): { x: number; y: number } {
  let maxX = 100;
  let baseY = 100;
  tablesMap.forEach((tableYMap) => {
    const topLevelX = tableYMap.get('positionX');
    const topLevelY = tableYMap.get('positionY');
    const rawPosition = tableYMap.get('position');
    const x = typeof topLevelX === 'number' ? topLevelX : readLegacyPositionAxis(rawPosition, 'x');
    const y = typeof topLevelY === 'number' ? topLevelY : readLegacyPositionAxis(rawPosition, 'y');
    if (typeof x === 'number' && x > maxX) {
      maxX = x;
      if (typeof y === 'number') {
        baseY = y;
      }
    }
  });
  return { x: maxX + 300, y: baseY };
}

/**
 * 테이블 라벨 기준 tableId 인덱스를 생성한다.
 *
 * @param tablesMap 테이블 Y.Map
 * @returns 라벨->tableId 맵
 */
function buildTableIdByName(tablesMap: Y.Map<Y.Map<unknown>>): Map<string, string> {
  const index = new Map<string, string>();
  tablesMap.forEach((tableYMap, tableId) => {
    const label = tableYMap.get('label');
    if (typeof label === 'string' && !index.has(label)) {
      index.set(label, tableId);
    }
  });
  return index;
}

function buildTableNodeLike(
  tablesMap: Y.Map<Y.Map<unknown>>,
  tableId: string,
): {
  id: string;
  position: { x: number; y: number };
  width?: number;
  data: { handleLayout?: 'split' | 'left' | 'right' };
} | null {
  const tableYMap = tablesMap.get(tableId);
  if (!tableYMap) {
    return null;
  }
  const topLevelX = tableYMap.get('positionX');
  const topLevelY = tableYMap.get('positionY');
  const rawPosition = tableYMap.get('position');
  return {
    id: tableId,
    position: {
      x:
        (typeof topLevelX === 'number' ? topLevelX : undefined) ??
        readLegacyPositionAxis(rawPosition, 'x') ??
        100,
      y:
        (typeof topLevelY === 'number' ? topLevelY : undefined) ??
        readLegacyPositionAxis(rawPosition, 'y') ??
        100,
    },
    data: {
      handleLayout:
        (tableYMap.get('handleLayout') as 'split' | 'left' | 'right' | undefined) ?? 'split',
    },
  };
}

/**
 * 컬럼 이름 조회 인덱스를 갱신한다.
 *
 * @param tablesMap 테이블 Y.Map
 * @param out 결과 저장 맵
 * @returns 없음
 */
function refreshColumnNameLookup(
  tablesMap: Y.Map<Y.Map<unknown>>,
  out: Map<string, Map<string, string>>,
): void {
  out.clear();
  tablesMap.forEach((tableYMap, tableId) => {
    const columnsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
    if (!columnsYArray) {
      return;
    }
    const byName = new Map<string, string>();
    columnsYArray.forEach((colYMap) => {
      const name = colYMap.get('name');
      const id = colYMap.get('id');
      if (typeof name === 'string' && typeof id === 'string') {
        byName.set(name, id);
      }
    });
    out.set(tableId, byName);
  });
}

/**
 * 컬럼 Y.Array에서 ID 기준으로 컬럼을 삭제한다.
 *
 * @param columnsYArray 컬럼 Y.Array
 * @param columnId 컬럼 ID
 * @returns 삭제 성공 여부
 */
function deleteColumnById(columnsYArray: Y.Array<Y.Map<unknown>>, columnId: string): boolean {
  for (let i = columnsYArray.length - 1; i >= 0; i -= 1) {
    const colYMap = columnsYArray.get(i);
    if (colYMap.get('id') === columnId) {
      columnsYArray.delete(i, 1);
      return true;
    }
  }
  return false;
}

/**
 * 컬럼 Y.Array에서 이름 기준으로 컬럼을 찾는다.
 *
 * @param columnsYArray 컬럼 Y.Array
 * @param name 컬럼명
 * @returns 컬럼 Y.Map 또는 undefined
 */
function findColumnByName(
  columnsYArray: Y.Array<Y.Map<unknown>>,
  name: string,
): Y.Map<unknown> | undefined {
  for (let i = 0; i < columnsYArray.length; i += 1) {
    const colYMap = columnsYArray.get(i);
    if (colYMap.get('name') === name) {
      return colYMap;
    }
  }
  return undefined;
}

/**
 * 컬럼 ID로 컬럼 Y.Map을 찾는다.
 *
 * @param columnsYArray 컬럼 Y.Array
 * @param columnId 컬럼 ID
 * @returns 컬럼 Y.Map 또는 undefined
 */
function findColumnYMap(
  columnsYArray: Y.Array<Y.Map<unknown>>,
  columnId: string,
): Y.Map<unknown> | undefined {
  for (let i = 0; i < columnsYArray.length; i += 1) {
    const colYMap = columnsYArray.get(i);
    if (colYMap.get('id') === columnId) {
      return colYMap;
    }
  }
  return undefined;
}

/**
 * 파싱 컬럼 스냅샷을 컬럼 Y.Map에 반영한다.
 *
 * @param colYMap 대상 컬럼 Y.Map
 * @param next 다음 컬럼 스냅샷
 * @returns 없음
 */
function applyColumnYMapUpdate(colYMap: Y.Map<unknown>, next: DiffParsedColumn): void {
  colYMap.set('name', next.name);
  colYMap.set('type', next.type);
  setBooleanFlag(colYMap, 'pk', next.pk);
  setBooleanFlag(colYMap, 'autoIncrement', next.autoIncrement);
  colYMap.set('nullable', next.nullable);
  if (next.logicalName) {
    colYMap.set('logicalName', next.logicalName);
  } else {
    colYMap.delete('logicalName');
  }
  if (next.termId != null) {
    colYMap.set('termId', next.termId);
  } else {
    colYMap.delete('termId');
  }
  if (next.domainId != null) {
    colYMap.set('domainId', next.domainId);
  } else {
    colYMap.delete('domainId');
  }
}

/**
 * boolean flag 필드를 true면 set, false면 delete로 정규화한다.
 *
 * @param yMap 대상 Y.Map
 * @param key 필드 키
 * @param value 값
 * @returns 없음
 */
function setBooleanFlag(yMap: Y.Map<unknown>, key: string, value: boolean): void {
  if (value) {
    yMap.set(key, true);
  } else {
    yMap.delete(key);
  }
}

/**
 * 컬럼 스냅샷으로 컬럼 Y.Map을 생성한다.
 *
 * @param column 컬럼 스냅샷
 * @returns 컬럼 Y.Map
 */
function createColumnYMap(column: DiffParsedColumn & { id: string }): Y.Map<unknown> {
  const colYMap = new Y.Map<unknown>();
  colYMap.set('id', column.id);
  colYMap.set('name', column.name);
  colYMap.set('type', column.type);
  setBooleanFlag(colYMap, 'pk', column.pk);
  setBooleanFlag(colYMap, 'autoIncrement', column.autoIncrement);
  colYMap.set('nullable', column.nullable);
  if (column.logicalName) {
    colYMap.set('logicalName', column.logicalName);
  }
  if (column.termId != null) {
    colYMap.set('termId', column.termId);
  }
  if (column.domainId != null) {
    colYMap.set('domainId', column.domainId);
  }
  return colYMap;
}

/**
 * 엣지 정보를 Y.Map으로 생성한다.
 *
 * @param source source tableId
 * @param target target tableId
 * @param sourceHandle source handle
 * @param targetHandle target handle
 * @param relationType 관계 유형
 * @returns 엣지 Y.Map
 */
function createEdgeYMap(
  source: string,
  target: string,
  sourceHandle: string,
  targetHandle: string,
  relationType: DiffRelationType,
  routingType: EdgeRoutingType = 'smoothstep',
  waypoints?: Waypoint[],
  handleMode?: EdgeHandleMode,
  sourceSide?: EdgeHandleSide,
  targetSide?: EdgeHandleSide,
): Y.Map<unknown> {
  const edgeYMap = new Y.Map<unknown>();
  edgeYMap.set('source', source);
  edgeYMap.set('target', target);
  edgeYMap.set('sourceHandle', sourceHandle);
  edgeYMap.set('targetHandle', targetHandle);
  edgeYMap.set('relationType', relationType);
  edgeYMap.set('routingType', routingType);
  if (Array.isArray(waypoints) && waypoints.length > 0) {
    edgeYMap.set('waypoints', createWaypointsYArray(waypoints));
  }
  if (handleMode === 'manual' && sourceSide && targetSide) {
    edgeYMap.set('handleMode', handleMode);
    edgeYMap.set('sourceSide', sourceSide);
    edgeYMap.set('targetSide', targetSide);
  }
  return edgeYMap;
}

/**
 * 엣지 참조가 유효하지 않은 항목을 제거한다.
 *
 * @param tablesMap 테이블 Y.Map
 * @param edgesMap 엣지 Y.Map
 * @returns 없음
 */
function cleanupInvalidEdges(
  tablesMap: Y.Map<Y.Map<unknown>>,
  edgesMap: Y.Map<Y.Map<unknown>>,
): void {
  const deleteIds: string[] = [];
  edgesMap.forEach((edgeYMap, edgeId) => {
    const source = edgeYMap.get('source');
    const target = edgeYMap.get('target');
    const sourceHandle = edgeYMap.get('sourceHandle');
    const targetHandle = edgeYMap.get('targetHandle');
    if (
      typeof source !== 'string' ||
      typeof target !== 'string' ||
      typeof sourceHandle !== 'string' ||
      typeof targetHandle !== 'string'
    ) {
      deleteIds.push(edgeId);
      return;
    }
    const sourceTable = tablesMap.get(source);
    const targetTable = tablesMap.get(target);
    if (!sourceTable || !targetTable) {
      deleteIds.push(edgeId);
      return;
    }
    const sourceColumnId = extractColumnIdFromHandle(sourceHandle, source, 'source');
    const targetColumnId = extractColumnIdFromHandle(targetHandle, target, 'target');
    if (!sourceColumnId || !targetColumnId) {
      deleteIds.push(edgeId);
      return;
    }
    const sourceColumns = sourceTable.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
    const targetColumns = targetTable.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
    if (!sourceColumns || !targetColumns) {
      deleteIds.push(edgeId);
      return;
    }
    if (
      !findColumnYMap(sourceColumns, sourceColumnId) ||
      !findColumnYMap(targetColumns, targetColumnId)
    ) {
      deleteIds.push(edgeId);
    }
  });

  for (const edgeId of deleteIds) {
    edgesMap.delete(edgeId);
  }
}

/**
 * 현재 엣지 기준으로 FK 플래그를 재계산한다.
 *
 * @param tablesMap 테이블 Y.Map
 * @param edgesMap 엣지 Y.Map
 * @returns 없음
 */
function normalizeForeignKeyFlags(
  tablesMap: Y.Map<Y.Map<unknown>>,
  edgesMap: Y.Map<Y.Map<unknown>>,
): void {
  // 1) 모두 초기화
  tablesMap.forEach((tableYMap) => {
    const columnsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
    if (!columnsYArray) {
      return;
    }
    columnsYArray.forEach((colYMap) => {
      colYMap.delete('fk');
    });
  });

  // 2) edge target 기준 fk=true 재설정
  edgesMap.forEach((edgeYMap) => {
    const target = edgeYMap.get('target');
    const targetHandle = edgeYMap.get('targetHandle');
    if (typeof target !== 'string' || typeof targetHandle !== 'string') {
      return;
    }
    const tableYMap = tablesMap.get(target);
    if (!tableYMap) {
      return;
    }
    const columnId = extractColumnIdFromHandle(targetHandle, target, 'target');
    if (!columnId) {
      return;
    }
    const columnsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
    if (!columnsYArray) {
      return;
    }
    const colYMap = findColumnYMap(columnsYArray, columnId);
    if (colYMap) {
      colYMap.set('fk', true);
    }
  });
}

/**
 * 그룹 tableIds에서 존재하지 않는 테이블 참조를 제거한다.
 *
 * @param groupsMap 그룹 Y.Map
 * @param tablesMap 테이블 Y.Map
 * @returns 없음
 */
function cleanupGroupTableReferences(
  groupsMap: Y.Map<Y.Map<unknown>>,
  tablesMap: Y.Map<Y.Map<unknown>>,
): number {
  let removed = 0;
  groupsMap.forEach((groupYMap) => {
    const tableIdsYArray = groupYMap.get('tableIds') as Y.Array<string> | undefined;
    if (!tableIdsYArray || tableIdsYArray.length === 0) {
      return;
    }
    for (let i = tableIdsYArray.length - 1; i >= 0; i -= 1) {
      const tableId = tableIdsYArray.get(i);
      if (!tablesMap.has(tableId)) {
        tableIdsYArray.delete(i, 1);
        removed += 1;
      }
    }
  });
  return removed;
}

/**
 * 보수 그룹 정책을 적용해 불확실 매칭 테이블 멤버십을 제거한다.
 *
 * 정책:
 * - update + confidence=high 만 그룹 멤버십 유지
 * - update + confidence!=high 는 멤버십 제거
 *
 * @param groupsMap 그룹 Y.Map
 * @param plan diff 계획
 * @returns 정책으로 제거된 멤버십 수
 */
function applyConservativeGroupMembershipPolicy(
  groupsMap: Y.Map<Y.Map<unknown>>,
  plan: DiffPlan,
): number {
  const uncertainTableIds = new Set(
    plan.tables
      .filter(
        (diff): diff is Extract<(typeof plan.tables)[number], { op: 'update' }> =>
          diff.op === 'update' && diff.match.confidence !== 'high',
      )
      .map((diff) => diff.tableId),
  );
  if (uncertainTableIds.size === 0) {
    return 0;
  }

  let removed = 0;
  groupsMap.forEach((groupYMap) => {
    const tableIdsYArray = groupYMap.get('tableIds') as Y.Array<string> | undefined;
    if (!tableIdsYArray || tableIdsYArray.length === 0) {
      return;
    }
    for (let i = tableIdsYArray.length - 1; i >= 0; i -= 1) {
      if (uncertainTableIds.has(tableIdsYArray.get(i))) {
        tableIdsYArray.delete(i, 1);
        removed += 1;
      }
    }
  });
  return removed;
}

/**
 * 전체 그룹 tableIds 레퍼런스 개수를 계산한다.
 *
 * @param groupsMap 그룹 Y.Map
 * @returns tableIds 총 개수
 */
function countGroupTableRefs(groupsMap: Y.Map<Y.Map<unknown>>): number {
  let count = 0;
  groupsMap.forEach((groupYMap) => {
    const tableIdsYArray = groupYMap.get('tableIds') as Y.Array<string> | undefined;
    if (!tableIdsYArray) {
      return;
    }
    count += tableIdsYArray.length;
  });
  return count;
}

/**
 * handle 문자열에서 컬럼 ID를 추출한다.
 *
 * @param handle handle 문자열
 * @param tableId 테이블 ID
 * @param side source/target
 * @returns 컬럼 ID 또는 null
 */
function extractColumnIdFromHandle(
  handle: string,
  tableId: string,
  side: 'source' | 'target',
): string | null {
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
