import { resolveEdgeHandlesFromPreference, type EdgeHandleResolution } from '@/lib/edge-handles';
import { extractColId } from '@/lib/handle-id';
import { readString } from '@/lib/yjs-read-utils';
import { getEdgesMap, getTablesMap, readTablePosition } from '@/collaboration/yjsBridge';
import type {
  EdgeHandleMode,
  EdgeHandleSide,
  EdgeRoutingType,
  TableHandleLayout,
} from '@/types/erd';
import * as Y from 'yjs';

export function syncEdgeHandlePreference(
  edgeYMap: Y.Map<unknown>,
  resolution: EdgeHandleResolution,
): void {
  if (resolution.handleMode === 'manual') {
    edgeYMap.set('handleMode', 'manual');
    edgeYMap.set('sourceSide', resolution.sourceSide);
    edgeYMap.set('targetSide', resolution.targetSide);
    return;
  }

  edgeYMap.delete('handleMode');
  edgeYMap.delete('sourceSide');
  edgeYMap.delete('targetSide');
}

/** 쓰기 전에 계산한 엣지 핸들 정규화 계획. */
export interface EdgeHandleNormalizationPatch {
  edgeId: string;
  edgeYMap: Y.Map<unknown>;
  resolution: EdgeHandleResolution;
  clearWaypoints: boolean;
}

/** 위치 배치의 최종 좌표를 기준으로 정규화 계획만 계산한다. */
export function planEdgeHandleNormalization(params: {
  doc: Y.Doc;
  nodeIds?: string[];
  positions?: ReadonlyMap<string, { x: number; y: number }>;
}): EdgeHandleNormalizationPatch[] {
  const { doc, nodeIds, positions } = params;
  const tablesMap = getTablesMap(doc);
  const edgesMap = getEdgesMap(doc);
  const filterIds = nodeIds && nodeIds.length > 0 ? new Set(nodeIds) : null;
  const patches: EdgeHandleNormalizationPatch[] = [];

  edgesMap.forEach((edgeYMap, edgeId) => {
    const sourceTableId = readString(edgeYMap.get('source'));
    const targetTableId = readString(edgeYMap.get('target'));
    const sourceHandle = readString(edgeYMap.get('sourceHandle'));
    const targetHandle = readString(edgeYMap.get('targetHandle'));
    if (!sourceTableId || !targetTableId || !sourceHandle || !targetHandle) {
      return;
    }
    if (filterIds && !filterIds.has(sourceTableId) && !filterIds.has(targetTableId)) {
      return;
    }

    const sourceTableYMap = tablesMap.get(sourceTableId);
    const targetTableYMap = tablesMap.get(targetTableId);
    if (!sourceTableYMap || !targetTableYMap) {
      return;
    }

    const sourceNode = readTableNodeLike(sourceTableId, sourceTableYMap);
    const targetNode = readTableNodeLike(targetTableId, targetTableYMap);
    if (!sourceNode || !targetNode) {
      return;
    }

    sourceNode.position = positions?.get(sourceTableId) ?? sourceNode.position;
    targetNode.position = positions?.get(targetTableId) ?? targetNode.position;
    const resolution = resolveEdgeHandlesFromPreference({
      sourceNode,
      targetNode,
      sourceColId: extractColId(sourceHandle, sourceTableId),
      targetColId: extractColId(targetHandle, targetTableId),
      handleMode: readHandleMode(edgeYMap.get('handleMode')),
      sourceSide: readHandleSide(edgeYMap.get('sourceSide')),
      targetSide: readHandleSide(edgeYMap.get('targetSide')),
    });

    const handlesChanged =
      edgeYMap.get('sourceHandle') !== resolution.sourceHandle ||
      edgeYMap.get('targetHandle') !== resolution.targetHandle;
    const manualChanged =
      resolution.handleMode === 'manual'
        ? edgeYMap.get('handleMode') !== 'manual' ||
          edgeYMap.get('sourceSide') !== resolution.sourceSide ||
          edgeYMap.get('targetSide') !== resolution.targetSide
        : edgeYMap.get('handleMode') === 'manual' ||
          edgeYMap.get('sourceSide') !== undefined ||
          edgeYMap.get('targetSide') !== undefined;

    if (!handlesChanged && !manualChanged) {
      return;
    }

    patches.push({
      edgeId,
      edgeYMap,
      resolution,
      clearWaypoints: readRoutingType(edgeYMap.get('routingType')) === 'straight' && handlesChanged,
    });
  });
  return patches;
}

/** 계산된 정규화 계획을 현재 transaction에 반영한다. */
export function applyEdgeHandleNormalizationPatches(patches: EdgeHandleNormalizationPatch[]): void {
  for (const { edgeYMap, resolution, clearWaypoints } of patches) {
    edgeYMap.set('sourceHandle', resolution.sourceHandle);
    edgeYMap.set('targetHandle', resolution.targetHandle);
    syncEdgeHandlePreference(edgeYMap, resolution);
    if (clearWaypoints) edgeYMap.delete('waypoints');
  }
}

/** 대상 노드에 연결된 엣지 핸들을 정규화한다. */
export function normalizeEdgeHandlesInYDoc(params: { doc: Y.Doc; nodeIds?: string[] }): boolean {
  const patches = planEdgeHandleNormalization(params);
  applyEdgeHandleNormalizationPatches(patches);
  return patches.length > 0;
}

function readHandleMode(value: unknown): EdgeHandleMode | undefined {
  return value === 'manual' || value === 'auto' ? value : undefined;
}

function readHandleSide(value: unknown): EdgeHandleSide | undefined {
  return value === 'left' || value === 'right' ? value : undefined;
}

function readRoutingType(value: unknown): EdgeRoutingType {
  return value === 'straight' || value === 'bezier' || value === 'smoothstep'
    ? value
    : 'smoothstep';
}

function readTableNodeLike(
  tableId: string,
  tableYMap: Y.Map<unknown>,
): {
  id: string;
  position: { x: number; y: number };
  data: { handleLayout?: TableHandleLayout };
} | null {
  const position = readTablePosition(tableYMap);
  if (!position) return null;

  const handleLayout = tableYMap.get('handleLayout');
  return {
    id: tableId,
    position,
    data: {
      handleLayout:
        handleLayout === 'split' || handleLayout === 'left' || handleLayout === 'right'
          ? handleLayout
          : undefined,
    },
  };
}
