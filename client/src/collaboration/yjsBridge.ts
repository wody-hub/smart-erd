import * as Y from 'yjs';
import { type Edge, type Node } from '@xyflow/react';
import type {
  Column,
  EdgeHandleMode,
  EdgeHandleSide,
  EdgeRoutingType,
  ERDEdgeData,
  RelationType,
  TableGroup,
  TableHeaderColor,
  TableHandleLayout,
  TableNodeData,
  Waypoint,
} from '../types/erd.js';

/**
 * Y.Doc에서 테이블 Y.Map을 반환한다.
 *
 * @param doc Y.Doc
 * @returns tables Y.Map
 */
export function getTablesMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap('tables') as Y.Map<Y.Map<unknown>>;
}

/**
 * Y.Doc에서 엣지 Y.Map을 반환한다.
 *
 * @param doc Y.Doc
 * @returns edges Y.Map
 */
export function getEdgesMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap('edges') as Y.Map<Y.Map<unknown>>;
}

/**
 * Y.Doc에서 그룹 Y.Map을 반환한다.
 *
 * @param doc Y.Doc
 * @returns groups Y.Map
 */
export function getGroupsMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap('groups') as Y.Map<Y.Map<unknown>>;
}

const TABLE_POSITION_X_KEY = 'positionX';
const TABLE_POSITION_Y_KEY = 'positionY';

function readNodePosition(
  rawPosition: unknown,
): { x: number; y: number } | null {
  if (rawPosition instanceof Y.Map) {
    if (!rawPosition.doc) {
      return null;
    }
    const x = rawPosition.get('x');
    const y = rawPosition.get('y');
    if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) {
      return { x, y };
    }
    return null;
  }

  if (!rawPosition || typeof rawPosition !== 'object') {
    return null;
  }

  const x = (rawPosition as { x?: unknown }).x;
  const y = (rawPosition as { y?: unknown }).y;
  if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) {
    return { x, y };
  }

  return null;
}

function readTablePosition(tableYMap: Y.Map<unknown>): { x: number; y: number } | null {
  const x = tableYMap.get(TABLE_POSITION_X_KEY);
  const y = tableYMap.get(TABLE_POSITION_Y_KEY);
  if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) {
    return { x, y };
  }
  return readNodePosition(tableYMap.get('position'));
}

function ensureLegacyPositionYMap(tableYMap: Y.Map<unknown>): Y.Map<unknown> | null {
  if (!tableYMap.doc) {
    return null;
  }

  const rawPosition = tableYMap.get('position');
  if (rawPosition instanceof Y.Map && rawPosition.doc) {
    return rawPosition;
  }

  const positionYMap = new Y.Map<unknown>();
  tableYMap.set('position', positionYMap);
  return positionYMap;
}

/**
 * Y.Map으로 표현된 테이블들을 React Flow Node 배열로 변환한다.
 *
 * @param tablesMap Y.Map<tableId, Y.Map>
 * @returns React Flow 노드 배열
 */
export function yTablesMapToNodes(tablesMap: Y.Map<Y.Map<unknown>>): Node<TableNodeData>[] {
  const nodes: Node<TableNodeData>[] = [];

  tablesMap.forEach((tableYMap, tableId) => {
    const position = readTablePosition(tableYMap);
    const columnsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;

    const columns: Column[] = [];
    if (columnsYArray) {
      columnsYArray.forEach((colYMap) => {
        columns.push({
          id: colYMap.get('id') as string,
          name: colYMap.get('name') as string,
          type: colYMap.get('type') as string,
          pk: (colYMap.get('pk') as boolean) ?? undefined,
          fk: (colYMap.get('fk') as boolean) ?? undefined,
          nullable: (colYMap.get('nullable') as boolean) ?? undefined,
          autoIncrement: (colYMap.get('autoIncrement') as boolean) ?? undefined,
          logicalName: (colYMap.get('logicalName') as string) ?? undefined,
          termId: (colYMap.get('termId') as number) ?? undefined,
          domainId: (colYMap.get('domainId') as number) ?? undefined,
        });
      });
    }

    nodes.push({
      id: tableId,
      type: 'table',
      position: position ?? { x: 100, y: 100 },
      data: {
        label: (tableYMap.get('label') as string) ?? 'Untitled',
        logicalTableName: (tableYMap.get('logicalTableName') as string) ?? undefined,
        tableTermId: (tableYMap.get('tableTermId') as number) ?? undefined,
        headerColor: (tableYMap.get('headerColor') as TableHeaderColor) ?? undefined,
        handleLayout: (tableYMap.get('handleLayout') as TableHandleLayout) ?? undefined,
        columns,
      },
    });
  });

  return nodes;
}

/**
 * Y.Map으로 표현된 엣지들을 React Flow Edge 배열로 변환한다.
 *
 * @param edgesMap Y.Map<edgeId, Y.Map>
 * @returns React Flow 엣지 배열
 */
export function yEdgesMapToEdges(edgesMap: Y.Map<Y.Map<unknown>>): Edge<ERDEdgeData>[] {
  const edges: Edge<ERDEdgeData>[] = [];

  edgesMap.forEach((edgeYMap, edgeId) => {
    const waypoints = readWaypointsFromEdgeYMap(edgeYMap);
    edges.push({
      id: edgeId,
      source: edgeYMap.get('source') as string,
      target: edgeYMap.get('target') as string,
      sourceHandle: (edgeYMap.get('sourceHandle') as string) ?? undefined,
      targetHandle: (edgeYMap.get('targetHandle') as string) ?? undefined,
      type: 'erdRelation',
      data: {
        relationType: (edgeYMap.get('relationType') as RelationType) ?? 'non-identifying',
        routingType: (edgeYMap.get('routingType') as EdgeRoutingType) ?? 'smoothstep',
        handleMode: (edgeYMap.get('handleMode') as EdgeHandleMode) ?? 'auto',
        sourceSide: (edgeYMap.get('sourceSide') as EdgeHandleSide) ?? undefined,
        targetSide: (edgeYMap.get('targetSide') as EdgeHandleSide) ?? undefined,
        waypoints: waypoints.length > 0 ? waypoints : undefined,
      },
    });
  });

  return edges;
}

/**
 * Y.Map으로 표현된 그룹들을 논리적 그룹 배열로 변환한다.
 *
 * @param groupsMap Y.Map<groupId, Y.Map>
 * @returns 논리적 그룹 배열
 */
export function yGroupsMapToTableGroups(groupsMap: Y.Map<Y.Map<unknown>>): TableGroup[] {
  const groups: TableGroup[] = [];

  groupsMap.forEach((groupYMap, groupId) => {
    const tableIdsYArray = groupYMap.get('tableIds') as Y.Array<string> | undefined;

    // CRDT 동시 추가로 중복이 들어올 수 있으므로 읽기 시 deduplicate한다.
    const seen = new Set<string>();
    const tableIds: string[] = [];
    if (tableIdsYArray) {
      tableIdsYArray.forEach((tableId) => {
        if (!seen.has(tableId)) {
          seen.add(tableId);
          tableIds.push(tableId);
        }
      });
    }

    groups.push({
      id: groupId,
      label: (groupYMap.get('label') as string) ?? 'Group',
      color: (groupYMap.get('color') as TableHeaderColor) ?? undefined,
      tableIds,
    });
  });

  return groups;
}

/**
 * 기존 React Flow JSON (nodes + edges + groups)을 Y.Doc으로 마이그레이션한다.
 * content(JSON)은 있지만 ydocSnapshot이 없는 기존 다이어그램을 변환할 때 사용한다.
 *
 * @param doc  대상 Y.Doc
 * @param json 기존 React Flow JSON 문자열
 */
export function migrateJsonToYDoc(doc: Y.Doc, json: string): void {
  try {
    const parsed = JSON.parse(json) as {
      nodes?: Node<TableNodeData>[];
      edges?: Edge<ERDEdgeData>[];
      groups?: unknown[];
    };

    const nodesArray = Array.isArray(parsed.nodes) ? parsed.nodes : [];
    const edgesArray = Array.isArray(parsed.edges) ? parsed.edges : [];
    const groupsArray = Array.isArray(parsed.groups) ? parsed.groups : [];

    doc.transact(() => {
      const tablesMap = getTablesMap(doc);
      const edgesMap = getEdgesMap(doc);
      const groupsMap = getGroupsMap(doc);

      for (const node of nodesArray) {
        const tableYMap = createTableYMap(
          node.data?.label ?? 'Untitled',
          { x: node.position?.x ?? 100, y: node.position?.y ?? 100 },
          node.data?.columns ?? [],
          {
            logicalTableName: node.data?.logicalTableName,
            tableTermId: node.data?.tableTermId,
            headerColor: node.data?.headerColor,
            handleLayout: node.data?.handleLayout,
          },
        );
        tablesMap.set(node.id, tableYMap);
      }

      for (const edge of edgesArray) {
        const edgeData = edge.data;
        const edgeYMap = createEdgeYMap(
          edge.source,
          edge.target,
          edge.sourceHandle ?? undefined,
          edge.targetHandle ?? undefined,
          edgeData?.relationType,
          edgeData?.routingType,
          edgeData?.waypoints,
          edgeData?.handleMode,
          edgeData?.sourceSide,
          edgeData?.targetSide,
        );
        edgesMap.set(edge.id, edgeYMap);
        syncLegacyWaypointsInEdgeYMap(edgeYMap);
      }

      for (const rawGroup of groupsArray) {
        const group = normalizeGroupFromJson(rawGroup, nodesArray);
        if (!group) {
          continue;
        }
        groupsMap.set(group.id, createGroupYMap(group.label, group.tableIds, group.color));
      }
    });
  } catch (err) {
    // JSON → Y.Doc 마이그레이션 실패: 기존 JSON이 유효하지 않은 경우 빈 Y.Doc으로 시작
    console.warn('[yjsBridge] migrateJsonToYDoc failed, starting with empty Y.Doc:', err);
  }
}

/**
 * JSON groups 엔트리를 논리적 그룹으로 정규화한다.
 *
 * @param raw 원본 그룹 데이터
 * @param tableNodes JSON 내 테이블 노드 목록
 * @returns 정규화된 그룹. 유효하지 않으면 null
 */
function normalizeGroupFromJson(
  raw: unknown,
  tableNodes: Node<TableNodeData>[],
): TableGroup | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const id = record.id;
  if (typeof id !== 'string' || id.trim() === '') {
    return null;
  }

  const logicalLabel = typeof record.label === 'string' ? record.label : null;
  const data = record.data;
  const legacyData = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const legacyLabel = legacyData && typeof legacyData.label === 'string' ? legacyData.label : null;

  const colorValue =
    typeof record.color === 'string'
      ? (record.color as TableHeaderColor)
      : legacyData && typeof legacyData.color === 'string'
        ? (legacyData.color as TableHeaderColor)
        : undefined;

  const hasExplicitTableIds = Object.prototype.hasOwnProperty.call(record, 'tableIds');
  const tableIdsRaw = record.tableIds;
  let tableIds = Array.isArray(tableIdsRaw)
    ? tableIdsRaw.filter((value): value is string => typeof value === 'string')
    : [];

  if (!hasExplicitTableIds && tableIds.length === 0) {
    tableIds = inferGroupTableIdsFromLegacyBounds(record, tableNodes);
  }

  return {
    id,
    label: logicalLabel ?? legacyLabel ?? 'Group',
    color: colorValue,
    tableIds,
  };
}

/**
 * 레거시 시각 그룹 영역(position/size) 기반으로 소속 테이블 ID를 추론한다.
 *
 * @param record 레거시 그룹 엔트리
 * @param tableNodes JSON 내 테이블 노드 목록
 * @returns 그룹 내부로 판정된 테이블 ID 목록
 */
function inferGroupTableIdsFromLegacyBounds(
  record: Record<string, unknown>,
  tableNodes: Node<TableNodeData>[],
): string[] {
  const position = record.position;
  const style = record.style;
  if (!position || typeof position !== 'object' || !style || typeof style !== 'object') {
    return [];
  }

  const positionRecord = position as Record<string, unknown>;
  const styleRecord = style as Record<string, unknown>;
  const x = parseNumberOrNull(positionRecord.x);
  const y = parseNumberOrNull(positionRecord.y);
  const width = parseNumberOrNull(styleRecord.width);
  const height = parseNumberOrNull(styleRecord.height);
  if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0) {
    return [];
  }

  const right = x + width;
  const bottom = y + height;
  const matched: string[] = [];
  for (const tableNode of tableNodes) {
    const nodeX = tableNode.position?.x;
    const nodeY = tableNode.position?.y;
    if (
      typeof nodeX === 'number' &&
      typeof nodeY === 'number' &&
      nodeX >= x &&
      nodeX <= right &&
      nodeY >= y &&
      nodeY <= bottom
    ) {
      matched.push(tableNode.id);
    }
  }
  return matched;
}

/**
 * 숫자 혹은 숫자 문자열을 number로 변환한다.
 *
 * @param value 변환할 값
 * @returns 유효한 number 또는 null
 */
function parseNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

/**
 * Column 데이터를 Y.Map으로 변환한다.
 *
 * @param column 컬럼 데이터
 * @returns Y.Map 인스턴스
 */
export function createColumnYMap(column: Column): Y.Map<unknown> {
  const colYMap = new Y.Map<unknown>();
  colYMap.set('id', column.id);
  colYMap.set('name', column.name);
  colYMap.set('type', column.type);
  if (column.pk) colYMap.set('pk', true);
  if (column.fk) colYMap.set('fk', true);
  if (column.nullable !== undefined) colYMap.set('nullable', column.nullable);
  if (column.autoIncrement) colYMap.set('autoIncrement', true);
  if (column.logicalName) colYMap.set('logicalName', column.logicalName);
  if (column.termId) colYMap.set('termId', column.termId);
  if (column.domainId) colYMap.set('domainId', column.domainId);
  return colYMap;
}

/**
 * waypoint를 Y.Map으로 변환한다.
 *
 * @param waypoint flow 좌표 waypoint
 * @returns waypoint Y.Map
 */
export function createWaypointYMap(waypoint: Waypoint): Y.Map<unknown> {
  const waypointYMap = new Y.Map<unknown>();
  waypointYMap.set('x', waypoint.x);
  waypointYMap.set('y', waypoint.y);
  return waypointYMap;
}

/**
 * waypoint 배열을 Y.Array로 변환한다.
 *
 * @param waypoints flow 좌표 waypoint 배열
 * @returns waypoint Y.Array
 */
export function createWaypointsYArray(waypoints: Waypoint[]): Y.Array<Y.Map<unknown>> {
  const waypointsYArray = new Y.Array<Y.Map<unknown>>();
  for (const waypoint of waypoints) {
    waypointsYArray.push([createWaypointYMap(waypoint)]);
  }
  return waypointsYArray;
}

/**
 * edge Y.Map에서 waypoint 배열을 읽는다.
 *
 * @param edgeYMap edge Y.Map
 * @returns waypoint 배열
 */
export function readWaypointsFromEdgeYMap(edgeYMap: Y.Map<unknown>): Waypoint[] {
  const rawWaypoints = edgeYMap.get('waypoints');
  if (rawWaypoints instanceof Y.Array) {
    if (!rawWaypoints.doc || rawWaypoints.length === 0) {
      return [];
    }

    const waypoints: Waypoint[] = [];
    rawWaypoints.forEach((waypointYMap) => {
      if (!(waypointYMap instanceof Y.Map) || !waypointYMap.doc) {
        return;
      }
      const x = waypointYMap.get('x');
      const y = waypointYMap.get('y');
      if (typeof x === 'number' && typeof y === 'number') {
        waypoints.push({ x, y });
      }
    });
    return waypoints;
  }

  if (!Array.isArray(rawWaypoints) || rawWaypoints.length === 0) {
    return [];
  }

  const waypoints: Waypoint[] = [];
  for (const rawWaypoint of rawWaypoints) {
    if (!rawWaypoint || typeof rawWaypoint !== 'object') {
      continue;
    }
    const x = (rawWaypoint as { x?: unknown }).x;
    const y = (rawWaypoint as { y?: unknown }).y;
    if (typeof x === 'number' && typeof y === 'number') {
      waypoints.push({ x, y });
    }
  }
  return waypoints;
}

/**
 * attached edge Y.Map에 legacy waypoint Y.Array 표현을 함께 유지한다.
 *
 * 최신 클라이언트는 plain array도 읽지만, 혼합 버전 환경에서는 legacy Y.Array가 더 안전하다.
 * detached 생성 단계에서는 plain array를 유지하고, doc에 붙은 뒤에만 승격한다.
 *
 * @param edgeYMap 대상 edge Y.Map
 * @returns 없음
 */
export function syncLegacyWaypointsInEdgeYMap(edgeYMap: Y.Map<unknown>): void {
  if (!edgeYMap.doc) {
    return;
  }

  const rawWaypoints = edgeYMap.get('waypoints');
  if (rawWaypoints instanceof Y.Array) {
    return;
  }

  if (!Array.isArray(rawWaypoints) || rawWaypoints.length === 0) {
    return;
  }

  const waypoints = readWaypointsFromEdgeYMap(edgeYMap);
  if (waypoints.length === 0) {
    return;
  }

  edgeYMap.set('waypoints', createWaypointsYArray(waypoints));
}

/**
 * 엣지 데이터를 Y.Map으로 변환한다.
 *
 * @param source       소스 노드 ID
 * @param target       타겟 노드 ID
 * @param sourceHandle 소스 Handle ID (옵션)
 * @param targetHandle 타겟 Handle ID (옵션)
 * @param relationType 관계 유형 (옵션)
 * @returns Y.Map 인스턴스
 */
export function createEdgeYMap(
  source: string,
  target: string,
  sourceHandle?: string,
  targetHandle?: string,
  relationType: RelationType = 'non-identifying',
  routingType: EdgeRoutingType = 'smoothstep',
  waypoints?: Waypoint[],
  handleMode?: EdgeHandleMode,
  sourceSide?: EdgeHandleSide,
  targetSide?: EdgeHandleSide,
): Y.Map<unknown> {
  const edgeYMap = new Y.Map<unknown>();
  edgeYMap.set('source', source);
  edgeYMap.set('target', target);
  if (sourceHandle) edgeYMap.set('sourceHandle', sourceHandle);
  if (targetHandle) edgeYMap.set('targetHandle', targetHandle);
  edgeYMap.set('relationType', relationType);
  edgeYMap.set('routingType', routingType);
  if (handleMode === 'manual' && sourceSide && targetSide) {
    edgeYMap.set('handleMode', handleMode);
    edgeYMap.set('sourceSide', sourceSide);
    edgeYMap.set('targetSide', targetSide);
  }
  if (Array.isArray(waypoints) && waypoints.length > 0) {
    edgeYMap.set(
      'waypoints',
      waypoints.map((waypoint) => ({ x: waypoint.x, y: waypoint.y })),
    );
  }
  return edgeYMap;
}

/** 테이블 Y.Map 생성 옵션 */
interface CreateTableOptions {
  /** 테이블 논리명 */
  logicalTableName?: string;
  /** 연결된 Term ID */
  tableTermId?: number;
  /** 헤더 색상 프리셋 */
  headerColor?: TableHeaderColor;
  /** 핸들 레이아웃 */
  handleLayout?: TableHandleLayout;
}

/**
 * 테이블 데이터를 Y.Map으로 변환한다.
 *
 * @param label    테이블 이름 (물리명)
 * @param position 위치 좌표
 * @param columns  컬럼 배열
 * @param options  추가 옵션 (논리명, termId, 색상)
 * @returns Y.Map 인스턴스
 */
export function createTableYMap(
  label: string,
  position: { x: number; y: number },
  columns: Column[],
  options?: CreateTableOptions,
): Y.Map<unknown> {
  const tableYMap = new Y.Map<unknown>();
  tableYMap.set('label', label);
  setTableYMapPosition(tableYMap, position);

  const colsYArray = new Y.Array<Y.Map<unknown>>();
  for (const col of columns) {
    colsYArray.push([createColumnYMap(col)]);
  }
  tableYMap.set('columns', colsYArray);

  if (options?.logicalTableName) tableYMap.set('logicalTableName', options.logicalTableName);
  if (options?.tableTermId != null) tableYMap.set('tableTermId', options.tableTermId);
  if (options?.headerColor && options.headerColor !== 'default') {
    tableYMap.set('headerColor', options.headerColor);
  }
  if (options?.handleLayout && options.handleLayout !== 'split') {
    tableYMap.set('handleLayout', options.handleLayout);
  }

  return tableYMap;
}

/**
 * 테이블 Y.Map의 position 필드를 nested Y.Map 형태로 안전하게 갱신한다.
 *
 * 기존 값이 plain object여도 nested Y.Map으로 승격한 뒤 x/y를 쓴다.
 * nested Y.Map은 먼저 attach한 다음 x/y를 기록해서 원격 observe 시점에도
 * 좌표가 비지 않도록 한다.
 *
 * @param tableYMap 대상 테이블 Y.Map
 * @param position 저장할 좌표
 * @returns 없음
 */
export function setTableYMapPosition(
  tableYMap: Y.Map<unknown>,
  position: { x: number; y: number },
): void {
  tableYMap.set(TABLE_POSITION_X_KEY, position.x);
  tableYMap.set(TABLE_POSITION_Y_KEY, position.y);

  const legacyPositionYMap = ensureLegacyPositionYMap(tableYMap);
  if (!legacyPositionYMap) {
    return;
  }

  legacyPositionYMap.set('x', position.x);
  legacyPositionYMap.set('y', position.y);
}

/**
 * 그룹 데이터를 Y.Map으로 변환한다.
 *
 * @param label    그룹 이름
 * @param tableIds 소속 테이블 ID 배열
 * @param color    색상 (옵션)
 * @returns Y.Map 인스턴스
 */
export function createGroupYMap(
  label: string,
  tableIds: string[] = [],
  color?: TableHeaderColor,
): Y.Map<unknown> {
  const groupYMap = new Y.Map<unknown>();
  groupYMap.set('label', label);

  const tableIdsYArray = new Y.Array<string>();
  if (tableIds.length > 0) {
    tableIdsYArray.push(tableIds);
  }
  groupYMap.set('tableIds', tableIdsYArray);

  if (color && color !== 'default') {
    groupYMap.set('color', color);
  }

  return groupYMap;
}

/**
 * 그룹 tableIds Y.Array에서 특정 테이블 ID를 제거한다.
 *
 * @param tableIdsYArray tableIds Y.Array
 * @param tableId        제거할 테이블 ID
 * @returns 제거 성공 여부
 */
export function removeTableIdFromYArray(tableIdsYArray: Y.Array<string>, tableId: string): boolean {
  let removed = false;

  // CRDT 동시 추가로 중복이 들어올 수 있으므로 모든 매치를 제거한다.
  for (let i = tableIdsYArray.length - 1; i >= 0; i--) {
    if (tableIdsYArray.get(i) === tableId) {
      tableIdsYArray.delete(i, 1);
      removed = true;
    }
  }

  return removed;
}

/**
 * Y.Array<Y.Map>에서 지정된 컬럼 ID를 가진 항목을 삭제한다.
 *
 * @param colsYArray 컬럼 Y.Array
 * @param colId      삭제할 컬럼 ID
 * @returns 삭제 성공 여부
 */
export function deleteColumnFromYArray(
  colsYArray: Y.Array<Y.Map<unknown>>,
  colId: string,
): boolean {
  for (let i = colsYArray.length - 1; i >= 0; i--) {
    const colYMap = colsYArray.get(i);
    if (colYMap.get('id') === colId) {
      colsYArray.delete(i, 1);
      return true;
    }
  }
  return false;
}

/**
 * Y.Map의 모든 primitive 값을 새 Y.Map으로 복제한다.
 * Shallow clone — primitive values only.
 *
 * @param source 원본 Y.Map
 * @returns 복제된 Y.Map
 */
export function cloneYMap(source: Y.Map<unknown>): Y.Map<unknown> {
  const clone = new Y.Map<unknown>();
  source.forEach((value, key) => clone.set(key, value));
  return clone;
}

/**
 * Y.Array 내 컬럼 위치를 이동한다.
 * Y.Map은 한 번 detach된 후 다시 attach할 수 없으므로 새 Y.Map을 복제하여 삽입한다.
 *
 * @param colsYArray 컬럼 Y.Array
 * @param fromIndex  이동 전 인덱스
 * @param toIndex    이동 후 인덱스
 */
export function moveColumnInYArray(
  colsYArray: Y.Array<Y.Map<unknown>>,
  fromIndex: number,
  toIndex: number,
): void {
  if (fromIndex === toIndex) return;
  const sourceMap = colsYArray.get(fromIndex);
  const cloned = cloneYMap(sourceMap);
  colsYArray.delete(fromIndex, 1);
  const insertAt = Math.max(0, Math.min(toIndex, colsYArray.length));
  colsYArray.insert(insertAt, [cloned]);
}

/**
 * Y.Doc의 현재 상태를 React Flow JSON 문자열로 직렬화한다.
 * 기존 REST API 호환을 위한 백업/내보내기 용도.
 *
 * @param doc Y.Doc
 * @returns JSON 문자열
 */
export function yDocToJson(doc: Y.Doc): string {
  const tablesMap = getTablesMap(doc);
  const edgesMap = getEdgesMap(doc);
  const groupsMap = getGroupsMap(doc);

  const nodes = yTablesMapToNodes(tablesMap);
  const edges = yEdgesMapToEdges(edgesMap);
  const groups = yGroupsMapToTableGroups(groupsMap);

  return JSON.stringify({ nodes, edges, groups });
}
