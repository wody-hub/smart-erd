import * as Y from 'yjs';
import type { Edge, Node } from '@xyflow/react';
import {
  buildFkPrefix,
  buildUniqueFkColumnName,
  buildUniqueName,
  findColumnYMap,
} from '@/lib/erd-yjs-utils';
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
import { extractColId, extractHandleSide } from '@/lib/handle-id';
import {
  buildRelationKey,
  buildStableEdgeId,
  getCurrentEdgeHandleSelectionValue,
  parseEdgeHandleSelectionValue,
  resolveEdgeHandlesFromPreference,
} from '@/lib/edge-handles';
import { resolvePreservedWaypoints } from '@/lib/edge-presentation-restore';

export { buildFkPrefix, buildUniqueFkColumnName, buildUniqueName, findColumnYMap };

export interface PopulateDdlOptions {
  resolveTableName: (original: string) => string;
  startY: number;
  edgePresentationByRelationKey?: Map<string, RestoredEdgePresentation>;
  tableMetaByPhysicalName?: Map<string, RestoredTableMeta>;
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
          (edge.data as { routingType?: EdgeRoutingType } | undefined)?.routingType ?? 'smoothstep',
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        waypoints: (edge.data as { waypoints?: Waypoint[] } | undefined)?.waypoints,
        resolvedSourceSide: extractHandleSide(edge.sourceHandle) ?? undefined,
        resolvedTargetSide: extractHandleSide(edge.targetHandle) ?? undefined,
        ...parseEdgeHandleSelectionValue(
          getCurrentEdgeHandleSelectionValue({
            handleMode: (edge.data as { handleMode?: EdgeHandleMode } | undefined)?.handleMode,
            sourceSide: (edge.data as { sourceSide?: EdgeHandleSide } | undefined)?.sourceSide,
            targetSide: (edge.data as { targetSide?: EdgeHandleSide } | undefined)?.targetSide,
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
  const restorePositions = !!tableMetaByPhysicalName || !!tableMetaByUniqueLogicalName;
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
