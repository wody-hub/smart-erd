import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { extractColId } from '@/lib/handle-id';

type EdgeHandleLike = {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

const EMPTY_CONNECTED_COLUMN_IDS = new Set<string>();
const EMPTY_CONNECTED_COLUMN_DIRECTIONS = new Map<string, ColumnConnectionDirections>();

export interface ColumnConnectionDirections {
  source: boolean;
  target: boolean;
}

interface ConnectedColumnContextValue {
  idsByNode: Map<string, Set<string>>;
  directionsByNode: Map<string, Map<string, ColumnConnectionDirections>>;
}

const ConnectedColumnIdsContext = createContext<ConnectedColumnContextValue | null>(null);

function buildConnectedColumnContext(edges: EdgeHandleLike[]): ConnectedColumnContextValue {
  const idsByNode = new Map<string, Set<string>>();
  const directionsByNode = new Map<string, Map<string, ColumnConnectionDirections>>();

  const ensureDirection = (nodeId: string, columnId: string): ColumnConnectionDirections => {
    const nodeDirections =
      directionsByNode.get(nodeId) ?? new Map<string, ColumnConnectionDirections>();
    directionsByNode.set(nodeId, nodeDirections);
    const current = nodeDirections.get(columnId) ?? {
      source: false,
      target: false,
    };
    nodeDirections.set(columnId, current);
    return current;
  };

  const connectedByNode = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (edge.sourceHandle) {
      const sourceColId = extractColId(edge.sourceHandle, edge.source);
      const sourceSet = connectedByNode.get(edge.source) ?? new Set<string>();
      sourceSet.add(sourceColId);
      connectedByNode.set(edge.source, sourceSet);
      ensureDirection(edge.source, sourceColId).source = true;
    }

    if (edge.targetHandle) {
      const targetColId = extractColId(edge.targetHandle, edge.target);
      const targetSet = connectedByNode.get(edge.target) ?? new Set<string>();
      targetSet.add(targetColId);
      connectedByNode.set(edge.target, targetSet);
      ensureDirection(edge.target, targetColId).target = true;
    }
  }

  for (const [nodeId, ids] of connectedByNode.entries()) {
    idsByNode.set(nodeId, ids);
  }

  return { idsByNode, directionsByNode };
}

export function ConnectedColumnIdsProvider({
  edges,
  children,
}: {
  edges: EdgeHandleLike[];
  children: ReactNode;
}) {
  const connectedColumns = useMemo(() => buildConnectedColumnContext(edges), [edges]);

  return (
    <ConnectedColumnIdsContext.Provider value={connectedColumns}>
      {children}
    </ConnectedColumnIdsContext.Provider>
  );
}

export function useConnectedColumnIds(nodeId: string): Set<string> {
  const connectedByNode = useContext(ConnectedColumnIdsContext);
  return connectedByNode?.idsByNode.get(nodeId) ?? EMPTY_CONNECTED_COLUMN_IDS;
}

export function useConnectedColumnDirections(
  nodeId: string,
): Map<string, ColumnConnectionDirections> {
  const connectedByNode = useContext(ConnectedColumnIdsContext);
  return connectedByNode?.directionsByNode.get(nodeId) ?? EMPTY_CONNECTED_COLUMN_DIRECTIONS;
}
