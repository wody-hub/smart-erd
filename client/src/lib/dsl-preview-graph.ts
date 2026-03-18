import dagre from 'dagre';
import type { Node } from '@xyflow/react';
import type { DdlParseResult, ParsedRelation, ParsedTable } from './ddl-parser.js';
import type {
  ERDEdge,
  EdgeHandleMode,
  EdgeHandleSide,
  EdgeRoutingType,
  TableNodeData,
  Waypoint,
} from '../types/erd.js';
import type { Column } from '../types/erd.js';
import type { TableNode } from '../types/erd.js';
import { resolvePreservedWaypoints } from './edge-presentation-restore.js';
import {
  buildRelationKey,
  buildStableEdgeId,
  getCurrentEdgeHandleSelectionValue,
  parseEdgeHandleSelectionValue,
  resolveEdgeHandlesFromPreference,
} from './edge-handles.js';
import { extractColId, extractHandleSide } from './handle-id.js';

/** preview 테이블 노드 폭 (px) */
const PREVIEW_NODE_WIDTH = 420;
/** preview 테이블 헤더 높이 (px) */
const PREVIEW_HEADER_HEIGHT = 52;
/** preview 컬럼 행 높이 (px) */
const PREVIEW_ROW_HEIGHT = 30;
/** preview 레이아웃 노드 간 간격 (px) */
const PREVIEW_NODE_SEPARATION = 80;
/** preview 레이아웃 rank 간 간격 (px) */
const PREVIEW_RANK_SEPARATION = 120;
/** preview 레이아웃 바깥 여백 (px) */
const PREVIEW_LAYOUT_MARGIN = 40;
/** persisted preview source entry 접두사 */
const PREVIEW_LAYOUT_SOURCE_ENTRY = 'table';
/** persisted preview edge presentation source entry 접두사 */
const PREVIEW_EDGE_PRESENTATION_SOURCE_ENTRY = 'edge';
/** persisted preview source entry 구분자 */
const PREVIEW_LAYOUT_SOURCE_SEPARATOR = '\t';

/** DSL preview 캔버스 노드 타입 */
export type DslPreviewNode = Node<TableNodeData, 'previewTable'>;

/** DSL preview 캔버스 그래프 */
export interface DslPreviewGraph {
  /** read-only preview 노드 목록 */
  nodes: DslPreviewNode[];
  /** read-only preview 엣지 목록 */
  edges: ERDEdge[];
}

/** DSL preview 캔버스 상태 */
export interface DslPreviewCanvasState {
  /** 현재 preview 그래프 */
  graph: DslPreviewGraph | null;
  /** DSL 파싱 진행 여부 */
  parsing: boolean;
  /** blocking error 존재 여부 */
  hasBlockingErrors: boolean;
  /** 코드 입력 내용 존재 여부 */
  hasContent: boolean;
  /** published ERD fallback 표시 허용 여부 */
  allowPersistedFallback: boolean;
}

/** persisted preview 배치 source */
interface PreviewLayoutSource {
  logicalTableName: string | null;
  physicalTableName: string;
  position: { x: number; y: number };
  headerColor?: TableNodeData['headerColor'];
  handleLayout?: TableNodeData['handleLayout'];
}

/** persisted preview edge presentation source */
interface PreviewEdgePresentationSource {
  routingType: EdgeRoutingType;
  handleMode?: EdgeHandleMode;
  sourceSide?: EdgeHandleSide;
  targetSide?: EdgeHandleSide;
  sourceHandle?: string;
  targetHandle?: string;
  resolvedSourceSide?: EdgeHandleSide;
  resolvedTargetSide?: EdgeHandleSide;
  waypoints?: Waypoint[];
}

/**
 * preview 테이블 노드 높이를 계산한다.
 *
 * @param columnCount 컬럼 수
 * @returns preview 노드 높이
 */
function calculatePreviewNodeHeight(columnCount: number): number {
  return PREVIEW_HEADER_HEIGHT + columnCount * PREVIEW_ROW_HEIGHT;
}

/**
 * preview 테이블 노드 ID를 생성한다.
 *
 * @param tableName 테이블 물리명
 * @returns stable preview 노드 ID
 */
function buildPreviewTableNodeId(tableName: string): string {
  return `preview-table:${encodeURIComponent(tableName)}`;
}

/**
 * 현재 persisted ERD 노드에서 preview 배치 source entry 목록을 만든다.
 *
 * selector에서 사용하기 위해 문자열 배열로 직렬화한다.
 * 같은 테이블의 논리명/물리명/위치/헤더 표현만 포함한다.
 *
 * @param nodes persisted ERD 테이블 노드 목록
 * @returns preview 배치 source entry 목록
 */
export function buildPreviewLayoutSourceEntries(nodes: TableNode[]): string[] {
  return nodes
    .filter((node) => node.type === 'table')
    .map((node) =>
      [
        PREVIEW_LAYOUT_SOURCE_ENTRY,
        node.data.logicalTableName?.trim() ?? '',
        node.data.label?.trim() ?? '',
        String(node.position.x),
        String(node.position.y),
        node.data.headerColor ?? '',
        node.data.handleLayout ?? '',
      ].join(PREVIEW_LAYOUT_SOURCE_SEPARATOR),
    );
}

/**
 * 현재 persisted ERD 엣지에서 preview 선 표현 source entry 목록을 만든다.
 *
 * relation key 기준으로 routing/manual handle/waypoint 정보를 직렬화한다.
 *
 * @param nodes persisted ERD 테이블 노드 목록
 * @param edges persisted ERD 엣지 목록
 * @returns preview 선 표현 source entry 목록
 */
export function buildPreviewEdgePresentationEntries(
  nodes: TableNode[],
  edges: ERDEdge[],
): string[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const entries: string[] = [];

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

    const relationKey = buildRelationKey({
      parentTable: sourceNode.data.label,
      parentColumn: sourceColumn.name,
      childTable: targetNode.data.label,
      childColumn: targetColumn.name,
    });
    const edgeData = (edge.data ?? {}) as Partial<NonNullable<ERDEdge['data']>>;
    const handleSelection = parseEdgeHandleSelectionValue(
      getCurrentEdgeHandleSelectionValue({
        handleMode: edgeData.handleMode,
        sourceSide: edgeData.sourceSide,
        targetSide: edgeData.targetSide,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      }),
    );

    entries.push(
      [
        PREVIEW_EDGE_PRESENTATION_SOURCE_ENTRY,
        relationKey,
        edgeData.routingType ?? 'smoothstep',
        handleSelection.handleMode,
        handleSelection.sourceSide ?? '',
        handleSelection.targetSide ?? '',
        edge.sourceHandle,
        edge.targetHandle,
        extractHandleSide(edge.sourceHandle) ?? '',
        extractHandleSide(edge.targetHandle) ?? '',
        JSON.stringify(edgeData.waypoints ?? []),
      ].join(PREVIEW_LAYOUT_SOURCE_SEPARATOR),
    );
  }

  return entries;
}

/**
 * source entry 목록에서 유일한 persisted preview 배치 맵을 추출한다.
 *
 * 논리명/물리명 key가 ambiguous 하면 해당 key는 제외한다.
 *
 * @param sourceEntries persisted preview source entry 목록
 * @returns 논리명/물리명 기준 유일 배치 맵
 */
function resolvePreviewLayoutSourceMaps(sourceEntries: readonly string[]): {
  byLogicalName: Map<string, PreviewLayoutSource>;
  byPhysicalName: Map<string, PreviewLayoutSource>;
} {
  const byLogicalName = new Map<string, PreviewLayoutSource>();
  const byPhysicalName = new Map<string, PreviewLayoutSource>();
  const ambiguousLogicalNames = new Set<string>();
  const ambiguousPhysicalNames = new Set<string>();

  for (const entry of sourceEntries) {
    const [
      kind,
      logicalTableNameRaw,
      physicalTableNameRaw,
      xRaw,
      yRaw,
      headerColorRaw,
      handleLayoutRaw,
    ] = entry.split(PREVIEW_LAYOUT_SOURCE_SEPARATOR);
    if (kind !== PREVIEW_LAYOUT_SOURCE_ENTRY) {
      continue;
    }

    const physicalTableName = physicalTableNameRaw?.trim();
    if (!physicalTableName) {
      continue;
    }

    const x = Number(xRaw);
    const y = Number(yRaw);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }

    const source: PreviewLayoutSource = {
      logicalTableName: logicalTableNameRaw?.trim() || null,
      physicalTableName,
      position: { x, y },
      headerColor: headerColorRaw?.trim()
        ? (headerColorRaw.trim() as TableNodeData['headerColor'])
        : undefined,
      handleLayout: handleLayoutRaw?.trim()
        ? (handleLayoutRaw.trim() as TableNodeData['handleLayout'])
        : undefined,
    };

    if (!ambiguousPhysicalNames.has(physicalTableName)) {
      const currentPhysical = byPhysicalName.get(physicalTableName);
      if (currentPhysical && currentPhysical.position.x !== x && currentPhysical.position.y !== y) {
        byPhysicalName.delete(physicalTableName);
        ambiguousPhysicalNames.add(physicalTableName);
      } else {
        byPhysicalName.set(physicalTableName, source);
      }
    }

    if (!source.logicalTableName || ambiguousLogicalNames.has(source.logicalTableName)) {
      continue;
    }

    const currentLogical = byLogicalName.get(source.logicalTableName);
    if (
      currentLogical &&
      (currentLogical.physicalTableName !== source.physicalTableName ||
        currentLogical.position.x !== x ||
        currentLogical.position.y !== y)
    ) {
      byLogicalName.delete(source.logicalTableName);
      ambiguousLogicalNames.add(source.logicalTableName);
      continue;
    }

    byLogicalName.set(source.logicalTableName, source);
  }

  return { byLogicalName, byPhysicalName };
}

/**
 * source entry 목록에서 relation key 기준 preview 선 표현 맵을 복원한다.
 *
 * @param sourceEntries persisted preview edge presentation source entry 목록
 * @returns relation key 기준 preview 선 표현 맵
 */
function resolvePreviewEdgePresentationSourceMap(
  sourceEntries: readonly string[],
): Map<string, PreviewEdgePresentationSource> {
  const edgePresentationByRelationKey = new Map<string, PreviewEdgePresentationSource>();

  for (const entry of sourceEntries) {
    const [
      kind,
      relationKey,
      routingTypeRaw,
      handleModeRaw,
      sourceSideRaw,
      targetSideRaw,
      sourceHandleRaw,
      targetHandleRaw,
      resolvedSourceSideRaw,
      resolvedTargetSideRaw,
      waypointsRaw,
    ] = entry.split(PREVIEW_LAYOUT_SOURCE_SEPARATOR);
    if (kind !== PREVIEW_EDGE_PRESENTATION_SOURCE_ENTRY || !relationKey) {
      continue;
    }

    let waypoints: PreviewEdgePresentationSource['waypoints'];
    try {
      const parsed = JSON.parse(waypointsRaw ?? '[]');
      if (
        Array.isArray(parsed) &&
        parsed.every(
          (waypoint) =>
            waypoint &&
            typeof waypoint.x === 'number' &&
            typeof waypoint.y === 'number',
        )
      ) {
        waypoints = parsed;
      }
    } catch {
      waypoints = undefined;
    }

    edgePresentationByRelationKey.set(relationKey, {
      routingType:
        routingTypeRaw === 'bezier' || routingTypeRaw === 'straight'
          ? routingTypeRaw
          : 'smoothstep',
      handleMode: handleModeRaw === 'manual' ? 'manual' : 'auto',
      sourceSide: sourceSideRaw === 'left' || sourceSideRaw === 'right' ? sourceSideRaw : undefined,
      targetSide: targetSideRaw === 'left' || targetSideRaw === 'right' ? targetSideRaw : undefined,
      sourceHandle: sourceHandleRaw || undefined,
      targetHandle: targetHandleRaw || undefined,
      resolvedSourceSide:
        resolvedSourceSideRaw === 'left' || resolvedSourceSideRaw === 'right'
          ? resolvedSourceSideRaw
          : undefined,
      resolvedTargetSide:
        resolvedTargetSideRaw === 'left' || resolvedTargetSideRaw === 'right'
          ? resolvedTargetSideRaw
          : undefined,
      waypoints,
    });
  }

  return edgePresentationByRelationKey;
}

/**
 * parsed table에 대응하는 persisted preview 배치 source를 찾는다.
 *
 * 논리명이 유일하게 매칭되면 논리명을 우선하고, 아니면 물리명으로 fallback 한다.
 *
 * @param table parsed table
 * @param sourceMaps persisted preview source maps
 * @returns 대응 배치 source 또는 null
 */
function resolvePreviewLayoutSource(
  table: ParsedTable,
  sourceMaps: ReturnType<typeof resolvePreviewLayoutSourceMaps>,
): PreviewLayoutSource | null {
  return resolvePreviewLayoutSourceByNames(
    table.name,
    table.logicalTableName?.trim() || table.comment?.trim() || null,
    sourceMaps,
  );
}

/**
 * 물리명/논리명으로 persisted preview 배치 source를 찾는다.
 *
 * @param physicalTableName 테이블 물리명
 * @param logicalTableName 테이블 논리명
 * @param sourceMaps persisted preview source maps
 * @returns 대응 배치 source 또는 null
 */
function resolvePreviewLayoutSourceByNames(
  physicalTableName: string,
  logicalTableName: string | null,
  sourceMaps: ReturnType<typeof resolvePreviewLayoutSourceMaps>,
): PreviewLayoutSource | null {
  if (logicalTableName) {
    const matchedByLogicalName = sourceMaps.byLogicalName.get(logicalTableName);
    if (matchedByLogicalName) {
      return matchedByLogicalName;
    }
  }

  return sourceMaps.byPhysicalName.get(physicalTableName) ?? null;
}

/**
 * preview 컬럼 ID를 생성한다.
 *
 * @param tableName 테이블 물리명
 * @param columnName 컬럼 물리명
 * @returns stable preview 컬럼 ID
 */
function buildPreviewColumnId(tableName: string, columnName: string): string {
  return `preview-col:${encodeURIComponent(tableName)}:${encodeURIComponent(columnName)}`;
}

/**
 * FK 관계 기준 자식 컬럼 집합 인덱스를 만든다.
 *
 * @param relations parsed relation 목록
 * @returns `childTable -> childColumn set` 맵
 */
function buildFkColumnIndex(relations: ParsedRelation[]): Map<string, Set<string>> {
  const fkColumnIndex = new Map<string, Set<string>>();
  for (const relation of relations) {
    if (!fkColumnIndex.has(relation.childTable)) {
      fkColumnIndex.set(relation.childTable, new Set());
    }
    fkColumnIndex.get(relation.childTable)?.add(relation.childColumn);
  }
  return fkColumnIndex;
}

/**
 * parsed table 목록을 preview 노드로 변환한다.
 *
 * @param tables parsed table 목록
 * @param relations parsed relation 목록
 * @returns preview 노드 목록
 */
function buildPreviewNodes(
  tables: ParsedTable[],
  relations: ParsedRelation[],
  sourceMaps: ReturnType<typeof resolvePreviewLayoutSourceMaps>,
): DslPreviewNode[] {
  const fkColumnIndex = buildFkColumnIndex(relations);

  return tables.map((table) => {
    const layoutSource = resolvePreviewLayoutSource(table, sourceMaps);

    return {
      id: buildPreviewTableNodeId(table.name),
      type: 'previewTable',
      position: layoutSource?.position ?? { x: 0, y: 0 },
      width: PREVIEW_NODE_WIDTH,
      data: {
        label: table.name,
        logicalTableName: table.logicalTableName || table.comment,
        tableTermId: table.tableTermId,
        headerColor: layoutSource?.headerColor,
        handleLayout: layoutSource?.handleLayout ?? 'split',
        columns: table.columns.map((column) => ({
          id: buildPreviewColumnId(table.name, column.name),
          name: column.name,
          type: column.type,
          pk: column.pk || undefined,
          fk: fkColumnIndex.get(table.name)?.has(column.name) || undefined,
          autoIncrement: column.autoIncrement || undefined,
          nullable: column.nullable,
          logicalName: column.logicalName || column.comment,
          termId: column.termId,
          domainId: column.domainId,
        })),
      },
    };
  });
}

/**
 * dagre로 preview 노드 위치를 계산한다.
 *
 * @param nodes preview 노드 목록
 * @param relations parsed relation 목록
 * @returns 위치가 반영된 preview 노드 목록
 */
function applyPreviewDagreLayout(
  nodes: DslPreviewNode[],
  relations: ParsedRelation[],
): DslPreviewNode[] {
  if (nodes.length === 0) {
    return nodes;
  }

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: 'LR',
    nodesep: PREVIEW_NODE_SEPARATION,
    ranksep: PREVIEW_RANK_SEPARATION,
    marginx: PREVIEW_LAYOUT_MARGIN,
    marginy: PREVIEW_LAYOUT_MARGIN,
  });

  for (const node of nodes) {
    graph.setNode(node.id, {
      width: PREVIEW_NODE_WIDTH,
      height: calculatePreviewNodeHeight(node.data.columns.length),
    });
  }

  for (const relation of relations) {
    graph.setEdge(
      buildPreviewTableNodeId(relation.parentTable),
      buildPreviewTableNodeId(relation.childTable),
    );
  }

  dagre.layout(graph);

  return nodes.map((node) => {
    const dagreNode = graph.node(node.id);
    const height = calculatePreviewNodeHeight(node.data.columns.length);
    return {
      ...node,
      position: {
        x: dagreNode.x - PREVIEW_NODE_WIDTH / 2,
        y: dagreNode.y - height / 2,
      },
    };
  });
}

/**
 * persisted 위치가 없는 preview 노드만 바깥쪽에 추가 배치한다.
 *
 * 기존 persisted 테이블은 사용자가 정리한 좌표를 유지하고,
 * 새 테이블만 현재 배치의 오른쪽에 수직 스택으로 붙인다.
 *
 * @param nodes preview 노드 목록
 * @param persistedNodeIds persisted 배치가 있는 노드 ID 집합
 * @returns 위치가 확정된 preview 노드 목록
 */
function applyPreviewPersistedLayout(
  nodes: DslPreviewNode[],
  persistedNodeIds: ReadonlySet<string>,
): DslPreviewNode[] {
  if (nodes.length === 0) {
    return nodes;
  }

  const persistedNodes = nodes.filter((node) => persistedNodeIds.has(node.id));
  if (persistedNodes.length === 0) {
    return nodes;
  }

  const nextNodes = nodes.map((node) => ({ ...node }));
  const maxPersistedRight = Math.max(
    ...persistedNodes.map((node) => node.position.x + PREVIEW_NODE_WIDTH),
  );
  let nextX = maxPersistedRight + PREVIEW_NODE_SEPARATION;
  let nextY = PREVIEW_LAYOUT_MARGIN;

  for (const node of nextNodes) {
    if (persistedNodeIds.has(node.id)) {
      continue;
    }

    const nodeHeight = calculatePreviewNodeHeight(node.data.columns.length);
    node.position = { x: nextX, y: nextY };
    nextY += nodeHeight + PREVIEW_NODE_SEPARATION;
  }

  return nextNodes;
}

/**
 * layout 완료된 preview 노드와 parsed relation으로 preview 엣지를 만든다.
 *
 * @param nodes layout 완료된 preview 노드 목록
 * @param relations parsed relation 목록
 * @returns preview 엣지 목록
 */
function buildPreviewEdges(
  nodes: DslPreviewNode[],
  relations: ParsedRelation[],
  edgePresentationByRelationKey: ReadonlyMap<string, PreviewEdgePresentationSource>,
): ERDEdge[] {
  const nodeByTableName = new Map(nodes.map((node) => [node.data.label, node]));

  return relations.flatMap((relation) => {
    const sourceNode = nodeByTableName.get(relation.parentTable);
    const targetNode = nodeByTableName.get(relation.childTable);
    if (!sourceNode || !targetNode) {
      return [];
    }

    const sourceColumn = sourceNode.data.columns.find(
      (column: Column) => column.name === relation.parentColumn,
    );
    const targetColumn = targetNode.data.columns.find(
      (column: Column) => column.name === relation.childColumn,
    );
    if (!sourceColumn || !targetColumn) {
      return [];
    }

    const relationKey = buildRelationKey({
      parentTable: relation.parentTable,
      parentColumn: relation.parentColumn,
      childTable: relation.childTable,
      childColumn: relation.childColumn,
    });
    const restoredEdgePresentation = edgePresentationByRelationKey.get(relationKey);
    const handleResolution = resolveEdgeHandlesFromPreference({
      sourceNode,
      targetNode,
      sourceColId: sourceColumn.id,
      targetColId: targetColumn.id,
      handleMode: restoredEdgePresentation?.handleMode,
      sourceSide: restoredEdgePresentation?.sourceSide,
      targetSide: restoredEdgePresentation?.targetSide,
    });
    const routingType = restoredEdgePresentation?.routingType ?? 'smoothstep';
    const preservedWaypoints = resolvePreservedWaypoints({
      routingType,
      previousSourceHandle: restoredEdgePresentation?.sourceHandle,
      previousTargetHandle: restoredEdgePresentation?.targetHandle,
      nextSourceHandle: handleResolution.sourceHandle,
      nextTargetHandle: handleResolution.targetHandle,
      previousSourceSide: restoredEdgePresentation?.resolvedSourceSide,
      previousTargetSide: restoredEdgePresentation?.resolvedTargetSide,
      nextSourceSide: handleResolution.sourceSide,
      nextTargetSide: handleResolution.targetSide,
      waypoints: restoredEdgePresentation?.waypoints,
    });

    return [
      {
        id: buildStableEdgeId({
          parentTable: relation.parentTable,
          parentColumn: relation.parentColumn,
          childTable: relation.childTable,
          childColumn: relation.childColumn,
        }),
        type: 'erdRelation',
        source: sourceNode.id,
        target: targetNode.id,
        sourceHandle: handleResolution.sourceHandle,
        targetHandle: handleResolution.targetHandle,
        data: {
          relationType: 'non-identifying',
          routingType,
          handleMode: handleResolution.handleMode,
          sourceSide:
            handleResolution.handleMode === 'manual' ? handleResolution.sourceSide : undefined,
          targetSide:
            handleResolution.handleMode === 'manual' ? handleResolution.targetSide : undefined,
          waypoints: preservedWaypoints,
        },
      },
    ];
  });
}

/**
 * DSL parsed schema를 code 모드 read-only preview graph로 변환한다.
 *
 * @param parsedSchema DSL 파싱 결과의 schema 부분
 * @returns preview canvas에서 사용할 nodes/edges
 */
export function buildPreviewGraphFromDslParsedSchema(
  parsedSchema: DdlParseResult,
  previewLayoutSourceEntries: readonly string[] = [],
  previewEdgePresentationEntries: readonly string[] = [],
): DslPreviewGraph {
  const sourceMaps = resolvePreviewLayoutSourceMaps(previewLayoutSourceEntries);
  const edgePresentationByRelationKey =
    resolvePreviewEdgePresentationSourceMap(previewEdgePresentationEntries);
  const baseNodes = buildPreviewNodes(parsedSchema.tables, parsedSchema.relations, sourceMaps);
  const persistedNodeIds = new Set(
    parsedSchema.tables
      .filter((table) => resolvePreviewLayoutSource(table, sourceMaps))
      .map((table) => buildPreviewTableNodeId(table.name)),
  );
  const nodes =
    persistedNodeIds.size > 0
      ? applyPreviewPersistedLayout(baseNodes, persistedNodeIds)
      : applyPreviewDagreLayout(baseNodes, parsedSchema.relations);
  const edges = buildPreviewEdges(nodes, parsedSchema.relations, edgePresentationByRelationKey);

  return { nodes, edges };
}

/**
 * 마지막 성공 preview graph에 최신 persisted 좌표/선 표현을 다시 입힌다.
 *
 * DSL 오류로 graph 재생성이 멈춰도 협업/타 모드에서 바뀐 persisted 표현은 계속 반영한다.
 *
 * @param graph 현재 preview graph
 * @param previewLayoutSourceEntries persisted preview 배치 source entry 목록
 * @param previewEdgePresentationEntries persisted preview edge presentation source entry 목록
 * @returns 최신 persisted 표현이 반영된 preview graph
 */
export function refreshPreviewGraphFromPersistedSources(
  graph: DslPreviewGraph,
  previewLayoutSourceEntries: readonly string[] = [],
  previewEdgePresentationEntries: readonly string[] = [],
): DslPreviewGraph {
  const sourceMaps = resolvePreviewLayoutSourceMaps(previewLayoutSourceEntries);
  const edgePresentationByRelationKey =
    resolvePreviewEdgePresentationSourceMap(previewEdgePresentationEntries);

  let nodesChanged = false;
  const nextNodes = graph.nodes.map((node) => {
    const layoutSource = resolvePreviewLayoutSourceByNames(
      node.data.label,
      node.data.logicalTableName?.trim() || null,
      sourceMaps,
    );
    if (!layoutSource) {
      return node;
    }

    const nextHeaderColor = layoutSource.headerColor;
    const nextHandleLayout = layoutSource.handleLayout ?? node.data.handleLayout ?? 'split';
    const positionChanged =
      node.position.x !== layoutSource.position.x || node.position.y !== layoutSource.position.y;
    const presentationChanged =
      node.data.headerColor !== nextHeaderColor || node.data.handleLayout !== nextHandleLayout;

    if (!positionChanged && !presentationChanged) {
      return node;
    }

    nodesChanged = true;
    return {
      ...node,
      position: layoutSource.position,
      data: {
        ...node.data,
        headerColor: nextHeaderColor,
        handleLayout: nextHandleLayout,
      },
    };
  });

  const nodeById = new Map(nextNodes.map((node) => [node.id, node]));
  let edgesChanged = false;
  const nextEdges = graph.edges.map((edge) => {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode || !edge.sourceHandle || !edge.targetHandle) {
      return edge;
    }

    const sourceColumnId = extractColId(edge.sourceHandle, sourceNode.id);
    const targetColumnId = extractColId(edge.targetHandle, targetNode.id);
    const sourceColumn = sourceNode.data.columns.find((column) => column.id === sourceColumnId);
    const targetColumn = targetNode.data.columns.find((column) => column.id === targetColumnId);
    if (!sourceColumn || !targetColumn) {
      return edge;
    }

    const relationKey = buildRelationKey({
      parentTable: sourceNode.data.label,
      parentColumn: sourceColumn.name,
      childTable: targetNode.data.label,
      childColumn: targetColumn.name,
    });
    const restoredEdgePresentation = edgePresentationByRelationKey.get(relationKey);
    if (!restoredEdgePresentation) {
      return edge;
    }

    const handleResolution = resolveEdgeHandlesFromPreference({
      sourceNode,
      targetNode,
      sourceColId: sourceColumn.id,
      targetColId: targetColumn.id,
      handleMode: restoredEdgePresentation.handleMode,
      sourceSide: restoredEdgePresentation.sourceSide,
      targetSide: restoredEdgePresentation.targetSide,
    });
    const routingType = restoredEdgePresentation.routingType;
    const preservedWaypoints = resolvePreservedWaypoints({
      routingType,
      previousSourceHandle: restoredEdgePresentation.sourceHandle,
      previousTargetHandle: restoredEdgePresentation.targetHandle,
      nextSourceHandle: handleResolution.sourceHandle,
      nextTargetHandle: handleResolution.targetHandle,
      previousSourceSide: restoredEdgePresentation.resolvedSourceSide,
      previousTargetSide: restoredEdgePresentation.resolvedTargetSide,
      nextSourceSide: handleResolution.sourceSide,
      nextTargetSide: handleResolution.targetSide,
      waypoints: restoredEdgePresentation.waypoints,
    });

    const edgeData = edge.data ?? { relationType: 'non-identifying' as const };
    const changed =
      edge.sourceHandle !== handleResolution.sourceHandle ||
      edge.targetHandle !== handleResolution.targetHandle ||
      edgeData.routingType !== routingType ||
      edgeData.handleMode !== handleResolution.handleMode ||
      edgeData.sourceSide !==
        (handleResolution.handleMode === 'manual' ? handleResolution.sourceSide : undefined) ||
      edgeData.targetSide !==
        (handleResolution.handleMode === 'manual' ? handleResolution.targetSide : undefined) ||
      JSON.stringify(edgeData.waypoints ?? []) !== JSON.stringify(preservedWaypoints ?? []);

    if (!changed) {
      return edge;
    }

    edgesChanged = true;
    return {
      ...edge,
      sourceHandle: handleResolution.sourceHandle,
      targetHandle: handleResolution.targetHandle,
      data: {
        ...edgeData,
        routingType,
        handleMode: handleResolution.handleMode,
        sourceSide:
          handleResolution.handleMode === 'manual' ? handleResolution.sourceSide : undefined,
        targetSide:
          handleResolution.handleMode === 'manual' ? handleResolution.targetSide : undefined,
        waypoints: preservedWaypoints,
      },
    };
  });

  if (!nodesChanged && !edgesChanged) {
    return graph;
  }

  return {
    nodes: nextNodes,
    edges: nextEdges,
  };
}
