import { resolveEdgeHandlesFromPreference, type EdgeHandleResolution } from '@/lib/edge-handles';
import { extractColId } from '@/lib/handle-id';
import { getEdgesMap, getTablesMap } from '@/collaboration/yjsBridge';
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

export function normalizeEdgeHandlesInYDoc(params: { doc: Y.Doc; nodeIds?: string[] }): boolean {
  const { doc, nodeIds } = params;
  const tablesMap = getTablesMap(doc);
  const edgesMap = getEdgesMap(doc);
  const filterIds = nodeIds && nodeIds.length > 0 ? new Set(nodeIds) : null;
  let mutated = false;

  edgesMap.forEach((edgeYMap) => {
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

    edgeYMap.set('sourceHandle', resolution.sourceHandle);
    edgeYMap.set('targetHandle', resolution.targetHandle);
    syncEdgeHandlePreference(edgeYMap, resolution);
    if (readRoutingType(edgeYMap.get('routingType')) === 'straight' && handlesChanged) {
      edgeYMap.delete('waypoints');
    }
    mutated = true;
  });

  return mutated;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
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
  const positionX = tableYMap.get('positionX');
  const positionY = tableYMap.get('positionY');
  if (typeof positionX !== 'number' || typeof positionY !== 'number') {
    return null;
  }

  const handleLayout = tableYMap.get('handleLayout');
  return {
    id: tableId,
    position: { x: positionX, y: positionY },
    data: {
      handleLayout:
        handleLayout === 'split' || handleLayout === 'left' || handleLayout === 'right'
          ? handleLayout
          : undefined,
    },
  };
}
