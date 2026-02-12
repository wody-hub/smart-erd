import * as Y from 'yjs';
import { type Edge, type Node } from '@xyflow/react';
import type {
  Column,
  ERDEdgeData,
  GroupNodeData,
  RelationType,
  TableHeaderColor,
  TableNodeData,
} from '@/types/erd';

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

/**
 * Y.Map으로 표현된 테이블들을 React Flow Node 배열로 변환한다.
 *
 * @param tablesMap Y.Map<tableId, Y.Map>
 * @returns React Flow 노드 배열
 */
export function yTablesMapToNodes(tablesMap: Y.Map<Y.Map<unknown>>): Node<TableNodeData>[] {
  const nodes: Node<TableNodeData>[] = [];

  tablesMap.forEach((tableYMap, tableId) => {
    const positionYMap = tableYMap.get('position') as Y.Map<number> | undefined;
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
      position: {
        x: positionYMap?.get('x') ?? 100,
        y: positionYMap?.get('y') ?? 100,
      },
      data: {
        label: (tableYMap.get('label') as string) ?? 'Untitled',
        logicalTableName: (tableYMap.get('logicalTableName') as string) ?? undefined,
        tableTermId: (tableYMap.get('tableTermId') as number) ?? undefined,
        headerColor: (tableYMap.get('headerColor') as TableHeaderColor) ?? undefined,
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
    edges.push({
      id: edgeId,
      source: edgeYMap.get('source') as string,
      target: edgeYMap.get('target') as string,
      sourceHandle: (edgeYMap.get('sourceHandle') as string) ?? undefined,
      targetHandle: (edgeYMap.get('targetHandle') as string) ?? undefined,
      type: 'erdRelation',
      data: {
        relationType: (edgeYMap.get('relationType') as RelationType) ?? 'non-identifying',
      },
    });
  });

  return edges;
}

/**
 * Y.Map으로 표현된 그룹들을 React Flow Node 배열로 변환한다.
 *
 * @param groupsMap Y.Map<groupId, Y.Map>
 * @returns React Flow 그룹 노드 배열
 */
export function yGroupsMapToNodes(groupsMap: Y.Map<Y.Map<unknown>>): Node<GroupNodeData>[] {
  const nodes: Node<GroupNodeData>[] = [];

  groupsMap.forEach((groupYMap, groupId) => {
    const positionYMap = groupYMap.get('position') as Y.Map<number> | undefined;

    nodes.push({
      id: groupId,
      type: 'group',
      position: {
        x: positionYMap?.get('x') ?? 100,
        y: positionYMap?.get('y') ?? 100,
      },
      style: {
        width: (groupYMap.get('width') as number) ?? 400,
        height: (groupYMap.get('height') as number) ?? 300,
      },
      data: {
        label: (groupYMap.get('label') as string) ?? 'Group',
        color: (groupYMap.get('color') as TableHeaderColor) ?? undefined,
      },
    });
  });

  return nodes;
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
      edges?: Edge[];
      groups?: Node<GroupNodeData>[];
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
          },
        );
        tablesMap.set(node.id, tableYMap);
      }

      for (const edge of edgesArray) {
        edgesMap.set(
          edge.id,
          createEdgeYMap(
            edge.source,
            edge.target,
            edge.sourceHandle ?? undefined,
            edge.targetHandle ?? undefined,
          ),
        );
      }

      for (const group of groupsArray) {
        const groupYMap = createGroupYMap(
          group.data?.label ?? 'Group',
          { x: group.position?.x ?? 100, y: group.position?.y ?? 100 },
          (group.style?.width as number) ?? 400,
          (group.style?.height as number) ?? 300,
          group.data?.color,
        );
        groupsMap.set(group.id, groupYMap);
      }
    });
  } catch (err) {
    // JSON → Y.Doc 마이그레이션 실패: 기존 JSON이 유효하지 않은 경우 빈 Y.Doc으로 시작
    console.warn('[yjsBridge] migrateJsonToYDoc failed, starting with empty Y.Doc:', err);
  }
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
  relationType?: RelationType,
): Y.Map<unknown> {
  const edgeYMap = new Y.Map<unknown>();
  edgeYMap.set('source', source);
  edgeYMap.set('target', target);
  if (sourceHandle) edgeYMap.set('sourceHandle', sourceHandle);
  if (targetHandle) edgeYMap.set('targetHandle', targetHandle);
  if (relationType) edgeYMap.set('relationType', relationType);
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

  const posYMap = new Y.Map<number>();
  posYMap.set('x', position.x);
  posYMap.set('y', position.y);
  tableYMap.set('position', posYMap);

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

  return tableYMap;
}

/**
 * 그룹 데이터를 Y.Map으로 변환한다.
 *
 * @param label    그룹 이름
 * @param position 위치 좌표
 * @param width    너비
 * @param height   높이
 * @param color    색상 (옵션)
 * @returns Y.Map 인스턴스
 */
export function createGroupYMap(
  label: string,
  position: { x: number; y: number },
  width: number,
  height: number,
  color?: TableHeaderColor,
): Y.Map<unknown> {
  const groupYMap = new Y.Map<unknown>();
  groupYMap.set('label', label);

  const posYMap = new Y.Map<number>();
  posYMap.set('x', position.x);
  posYMap.set('y', position.y);
  groupYMap.set('position', posYMap);

  groupYMap.set('width', width);
  groupYMap.set('height', height);
  if (color && color !== 'default') groupYMap.set('color', color);

  return groupYMap;
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
  const groups = yGroupsMapToNodes(groupsMap);

  return JSON.stringify({ nodes, edges, groups });
}
