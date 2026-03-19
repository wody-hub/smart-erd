import * as Y from 'yjs';
import type { Edge, Node } from '@xyflow/react';
import type {
  EdgeHandleMode,
  EdgeHandleSide,
  EdgeRoutingType,
  TableHeaderColor,
  TableHandleLayout,
  TableNodeData,
  Waypoint,
} from '@/types/erd';
import type { DdlParseResult, ParsedColumn, ParsedRelation, ParsedTable } from '@/lib/ddl-parser';
import {
  createEdgeYMap,
  createTableYMap,
  syncLegacyWaypointsInEdgeYMap,
} from '@/collaboration/yjsBridge';
import { extractColId } from '@/lib/handle-id';
import { extractHandleSide } from '@/lib/handle-id';
import {
  getCurrentEdgeHandleSelectionValue,
  buildRelationKey,
  buildStableEdgeId,
  parseEdgeHandleSelectionValue,
  resolveEdgeHandlesFromPreference,
} from '@/lib/edge-handles';
import { resolvePreservedWaypoints } from '@/lib/edge-presentation-restore';

/** DDL 파싱 결과를 Y.Map에 반영할 때의 옵션 */
export interface PopulateDdlOptions {
  /** 테이블 이름 변환 함수 (중복 회피 등) */
  resolveTableName: (original: string) => string;
  /** 테이블 배치 시작 Y 좌표 */
  startY: number;
  /** 기존 relation key -> edge 표시 메타 복원 맵 */
  edgePresentationByRelationKey?: Map<string, RestoredEdgePresentation>;
  /** 기존 물리명 기준 table meta 복원 맵 */
  tableMetaByPhysicalName?: Map<string, RestoredTableMeta>;
  /** 기존 유일 논리명 기준 table meta 복원 맵 */
  tableMetaByUniqueLogicalName?: Map<string, RestoredTableMeta>;
}

interface RestoredTableMeta {
  headerColor?: TableHeaderColor;
  handleLayout?: TableHandleLayout;
  position?: { x: number; y: number };
}

interface RestoredEdgePresentation {
  routingType: EdgeRoutingType;
  handleMode?: EdgeHandleMode;
  sourceSide?: EdgeHandleSide;
  targetSide?: EdgeHandleSide;
  sourceHandle?: string;
  targetHandle?: string;
  waypoints?: Waypoint[];
  resolvedSourceSide?: EdgeHandleSide;
  resolvedTargetSide?: EdgeHandleSide;
}

export function buildEdgePresentationByRelationKey(
  nodes: Node<TableNodeData>[],
  edges: Edge[],
): Map<string, RestoredEdgePresentation> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edgePresentationByRelationKey = new Map<string, RestoredEdgePresentation>();

  for (const edge of edges) {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode || !edge.sourceHandle || !edge.targetHandle) {
      continue;
    }

    const sourceColumnId = extractColId(edge.sourceHandle, sourceNode.id);
    const targetColumnId = extractColId(edge.targetHandle, targetNode.id);
    const sourceColumn = sourceNode.data.columns.find((column) => column.id === sourceColumnId);
    const targetColumn = targetNode.data.columns.find((column) => column.id === targetColumnId);
    if (!sourceColumn || !targetColumn) {
      continue;
    }

    edgePresentationByRelationKey.set(
      buildRelationKey({
        parentTable: sourceNode.data.label,
        parentColumn: sourceColumn.name,
        childTable: targetNode.data.label,
        childColumn: targetColumn.name,
      }),
      {
        routingType:
          (edge.data as { routingType?: EdgeRoutingType } | undefined)?.routingType ??
          'smoothstep',
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        waypoints: (edge.data as { waypoints?: Waypoint[] } | undefined)?.waypoints,
        resolvedSourceSide: extractHandleSide(edge.sourceHandle) ?? undefined,
        resolvedTargetSide: extractHandleSide(edge.targetHandle) ?? undefined,
        ...parseEdgeHandleSelectionValue(
          getCurrentEdgeHandleSelectionValue({
            handleMode: (
              edge.data as { handleMode?: EdgeHandleMode } | undefined
            )?.handleMode,
            sourceSide: (
              edge.data as { sourceSide?: EdgeHandleSide } | undefined
            )?.sourceSide,
            targetSide: (
              edge.data as { targetSide?: EdgeHandleSide } | undefined
            )?.targetSide,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
          }),
        ),
      },
    );
  }

  return edgePresentationByRelationKey;
}

export function buildTableMetaRestoreMaps(nodes: Node<TableNodeData>[]): {
  tableMetaByPhysicalName: Map<string, RestoredTableMeta>;
  tableMetaByUniqueLogicalName: Map<string, RestoredTableMeta>;
} {
  const tableMetaByPhysicalName = new Map<string, RestoredTableMeta>();
  const logicalNameCounts = new Map<string, number>();

  for (const node of nodes) {
    const logicalName = node.data.logicalTableName?.trim();
    if (logicalName) {
      logicalNameCounts.set(logicalName, (logicalNameCounts.get(logicalName) ?? 0) + 1);
    }
    tableMetaByPhysicalName.set(node.data.label, {
      headerColor: node.data.headerColor,
      handleLayout: node.data.handleLayout,
      position: { x: node.position.x, y: node.position.y },
    });
  }

  const tableMetaByUniqueLogicalName = new Map<string, RestoredTableMeta>();
  for (const node of nodes) {
    const logicalName = node.data.logicalTableName?.trim();
    if (!logicalName || logicalNameCounts.get(logicalName) !== 1) {
      continue;
    }
    tableMetaByUniqueLogicalName.set(logicalName, {
      headerColor: node.data.headerColor,
      handleLayout: node.data.handleLayout,
      position: { x: node.position.x, y: node.position.y },
    });
  }

  return { tableMetaByPhysicalName, tableMetaByUniqueLogicalName };
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
  const tableMap = new Map<
    string,
    {
      nodeId: string;
      colMap: Map<string, string>;
      node: Node<TableNodeData>;
    }
  >();
  const GRID_COLS = 4;
  const GRID_X = 300;
  const GRID_Y = 250;
  const START_X = 100;
  const {
    edgePresentationByRelationKey,
    resolveTableName,
    startY,
    tableMetaByPhysicalName,
    tableMetaByUniqueLogicalName,
  } = options;
  const restorePositions =
    !!tableMetaByPhysicalName || !!tableMetaByUniqueLogicalName;
  const placedPositions: Array<{ x: number; y: number }> = [];

  result.tables.forEach((table: ParsedTable, idx: number) => {
    const name = resolveTableName(table.name);
    const nodeId = `table-${crypto.randomUUID()}`;
    const colMap = new Map<string, string>();

    const columns = table.columns.map((col: ParsedColumn) => {
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

    const restoredTableMeta =
      tableMetaByPhysicalName?.get(table.name) ??
      (table.logicalTableName || table.comment
        ? tableMetaByUniqueLogicalName?.get((table.logicalTableName || table.comment)!.trim())
        : undefined);

    const position =
      restoredTableMeta?.position ??
      (restorePositions
        ? computeNextRestoredTablePosition(placedPositions, startY)
        : {
            x: START_X + (idx % GRID_COLS) * GRID_X,
            y: startY + Math.floor(idx / GRID_COLS) * GRID_Y,
          });
    const nodeData: TableNodeData = {
      label: name,
      columns,
      logicalTableName: table.logicalTableName || table.comment || undefined,
      tableTermId: table.tableTermId,
      headerColor: restoredTableMeta?.headerColor,
      handleLayout: restoredTableMeta?.handleLayout,
    };

    tablesMap.set(nodeId, createTableYMap(name, position, columns, nodeData));
    placedPositions.push(position);
    tableMap.set(table.name, {
      nodeId,
      colMap,
      node: {
        id: nodeId,
        position,
        data: nodeData,
        type: 'table',
      } as Node<TableNodeData>,
    });
  });

  result.relations.forEach((relation: ParsedRelation) => {
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

    const relationKey = buildRelationKey({
      parentTable: relation.parentTable,
      parentColumn: relation.parentColumn,
      childTable: relation.childTable,
      childColumn: relation.childColumn,
    });
    const restoredEdgePresentation = edgePresentationByRelationKey?.get(relationKey);
    const { sourceHandle, targetHandle, handleMode, sourceSide, targetSide } =
      resolveEdgeHandlesFromPreference({
        sourceNode: parent.node,
        targetNode: child.node,
        sourceColId: parentColId,
        targetColId: childColId,
        handleMode: restoredEdgePresentation?.handleMode,
        sourceSide: restoredEdgePresentation?.sourceSide,
        targetSide: restoredEdgePresentation?.targetSide,
      });
    const routingType = restoredEdgePresentation?.routingType ?? 'smoothstep';
    const preservedWaypoints = resolvePreservedWaypoints({
      routingType,
      previousSourceHandle: restoredEdgePresentation?.sourceHandle,
      previousTargetHandle: restoredEdgePresentation?.targetHandle,
      nextSourceHandle: sourceHandle,
      nextTargetHandle: targetHandle,
      previousSourceSide: restoredEdgePresentation?.resolvedSourceSide,
      previousTargetSide: restoredEdgePresentation?.resolvedTargetSide,
      nextSourceSide: sourceSide,
      nextTargetSide: targetSide,
      waypoints: restoredEdgePresentation?.waypoints,
    });
    const edgeYMap = createEdgeYMap(
      parent.nodeId,
      child.nodeId,
      sourceHandle,
      targetHandle,
      'non-identifying',
      routingType,
      preservedWaypoints,
      handleMode,
      sourceSide,
      targetSide,
    );
    edgesMap.set(
      buildStableEdgeId({
        parentTable: relation.parentTable,
        parentColumn: relation.parentColumn,
        childTable: relation.childTable,
        childColumn: relation.childColumn,
      }),
      edgeYMap,
    );
    syncLegacyWaypointsInEdgeYMap(edgeYMap);
  });
}

function computeNextRestoredTablePosition(
  positions: Array<{ x: number; y: number }>,
  startY: number,
): { x: number; y: number } {
  if (positions.length === 0) {
    return { x: 100, y: startY };
  }

  let rightMost = positions[0];
  for (const position of positions) {
    if (position.x > rightMost.x) {
      rightMost = position;
    }
  }

  return {
    x: rightMost.x + 300,
    y: rightMost.y,
  };
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
