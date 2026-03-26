import type { Edge, Node } from '@xyflow/react';
import type { DocumentReadExecutor } from '@/collaboration/core/contracts/document-read-executor';
import type { DocumentReadContext } from '@/collaboration/core/contracts/document-read-executor';
import type {
  ERDEdge,
  ERDEdgeData,
  TableGroup,
  TableHeaderColor,
  TableHandleLayout,
  TableNode,
  TableNodeData,
} from '@/types/erd';
import type {
  Column,
  EdgeHandleMode,
  EdgeHandleSide,
  EdgeRoutingType,
  RelationType,
  Waypoint,
} from '@/types/erd';

export interface ErdDocumentGraphSnapshot {
  nodes: TableNode[];
  edges: ERDEdge[];
  groups: TableGroup[];
}

export interface ErdDocumentStructureSnapshot {
  nodes: TableNode[];
  edges: ERDEdge[];
}

function toColumn(value: Record<string, unknown>): Column {
  return {
    id: String(value.id ?? ''),
    name: String(value.name ?? ''),
    type: String(value.type ?? ''),
    pk: value.pk === true ? true : undefined,
    fk: value.fk === true ? true : undefined,
    nullable: typeof value.nullable === 'boolean' ? value.nullable : undefined,
    autoIncrement: typeof value.autoIncrement === 'boolean' ? value.autoIncrement : undefined,
    logicalName: typeof value.logicalName === 'string' ? value.logicalName : undefined,
    termId: typeof value.termId === 'number' ? value.termId : undefined,
    domainId: typeof value.domainId === 'number' ? value.domainId : undefined,
  };
}

function toTableNode(
  tableId: string,
  props: Record<string, unknown>,
  columns: Column[],
): TableNode {
  return {
    id: tableId,
    type: 'table',
    position: {
      x: typeof props.positionX === 'number' ? props.positionX : 100,
      y: typeof props.positionY === 'number' ? props.positionY : 100,
    },
    data: {
      label: typeof props.label === 'string' ? props.label : 'Untitled',
      logicalTableName:
        typeof props.logicalTableName === 'string' ? props.logicalTableName : undefined,
      tableTermId: typeof props.tableTermId === 'number' ? props.tableTermId : undefined,
      headerColor:
        typeof props.headerColor === 'string' ? (props.headerColor as TableHeaderColor) : undefined,
      handleLayout:
        typeof props.handleLayout === 'string'
          ? (props.handleLayout as TableHandleLayout)
          : undefined,
      columns,
    },
  };
}

function toEdge(edgeId: string, props: Record<string, unknown>): ERDEdge {
  return {
    id: edgeId,
    source: String(props.source ?? ''),
    target: String(props.target ?? ''),
    sourceHandle: typeof props.sourceHandle === 'string' ? props.sourceHandle : undefined,
    targetHandle: typeof props.targetHandle === 'string' ? props.targetHandle : undefined,
    type: 'erdRelation',
    data: {
      relationType:
        typeof props.relationType === 'string'
          ? (props.relationType as RelationType)
          : 'non-identifying',
      routingType:
        typeof props.routingType === 'string'
          ? (props.routingType as EdgeRoutingType)
          : 'smoothstep',
      handleMode:
        typeof props.handleMode === 'string' ? (props.handleMode as EdgeHandleMode) : 'auto',
      sourceSide:
        typeof props.sourceSide === 'string' ? (props.sourceSide as EdgeHandleSide) : undefined,
      targetSide:
        typeof props.targetSide === 'string' ? (props.targetSide as EdgeHandleSide) : undefined,
      waypoints: Array.isArray(props.waypoints) ? (props.waypoints as Waypoint[]) : undefined,
    } satisfies ERDEdgeData,
  };
}

function toGroup(groupId: string, props: Record<string, unknown>): TableGroup {
  return {
    id: groupId,
    label: typeof props.label === 'string' ? props.label : 'Group',
    color: typeof props.color === 'string' ? (props.color as TableHeaderColor) : undefined,
    tableIds: Array.isArray(props.tableIds)
      ? props.tableIds.filter((tableId): tableId is string => typeof tableId === 'string')
      : [],
  };
}

function readTableNodes(context: DocumentReadContext): TableNode[] {
  return context.findByKind('table').map((tableRef) => {
    const tableEntity = context.getEntity(tableRef);
    const columnRefs = context.listRelated(tableRef, 'columns');
    const columns = columnRefs
      .map((columnRef) => context.getEntity(columnRef)?.props)
      .filter((props): props is Record<string, unknown> => !!props)
      .map(toColumn);

    return toTableNode(
      tableRef.id,
      (tableEntity?.props ?? {}) as Record<string, unknown>,
      columns,
    );
  });
}

function readEdges(context: DocumentReadContext): ERDEdge[] {
  return context
    .findByKind('edge')
    .map((edgeRef) =>
      toEdge(edgeRef.id, (context.getEntity(edgeRef)?.props ?? {}) as Record<string, unknown>),
    );
}

function readGroups(context: DocumentReadContext): TableGroup[] {
  return context
    .findByKind('group')
    .map((groupRef) =>
      toGroup(groupRef.id, (context.getEntity(groupRef)?.props ?? {}) as Record<string, unknown>),
    );
}

export function readErdDocumentNodes(read: DocumentReadExecutor): TableNode[] {
  return read.execute({
    run: (context) => readTableNodes(context),
  });
}

export function readErdDocumentStructure(read: DocumentReadExecutor): ErdDocumentStructureSnapshot {
  return read.execute({
    run: (context) => ({
      nodes: readTableNodes(context),
      edges: readEdges(context),
    }),
  });
}

export function readErdDocumentGroups(read: DocumentReadExecutor): TableGroup[] {
  return read.execute({
    run: (context) => readGroups(context),
  });
}

export function readErdDocumentGraph(read: DocumentReadExecutor): ErdDocumentGraphSnapshot {
  return read.execute({
    run: (context) => ({
      nodes: readTableNodes(context),
      edges: readEdges(context),
      groups: readGroups(context),
    }),
  });
}

export function toLayoutNodes(nodes: TableNode[]): Node<TableNodeData>[] {
  return nodes as Node<TableNodeData>[];
}

export function toLayoutEdges(edges: ERDEdge[]): Edge[] {
  return edges as Edge[];
}
