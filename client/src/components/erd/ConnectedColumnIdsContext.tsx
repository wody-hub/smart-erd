import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { extractColId } from '@/lib/handle-id';

type EdgeHandleLike = {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

const EMPTY_CONNECTED_COLUMN_IDS = new Set<string>();

const ConnectedColumnIdsContext = createContext<Map<string, Set<string>> | null>(null);

function buildConnectedColumnIdsByNode(edges: EdgeHandleLike[]): Map<string, Set<string>> {
  const connectedByNode = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (edge.sourceHandle) {
      const sourceSet = connectedByNode.get(edge.source) ?? new Set<string>();
      sourceSet.add(extractColId(edge.sourceHandle, edge.source));
      connectedByNode.set(edge.source, sourceSet);
    }

    if (edge.targetHandle) {
      const targetSet = connectedByNode.get(edge.target) ?? new Set<string>();
      targetSet.add(extractColId(edge.targetHandle, edge.target));
      connectedByNode.set(edge.target, targetSet);
    }
  }

  return connectedByNode;
}

export function ConnectedColumnIdsProvider({
  edges,
  children,
}: {
  edges: EdgeHandleLike[];
  children: ReactNode;
}) {
  const connectedByNode = useMemo(() => buildConnectedColumnIdsByNode(edges), [edges]);

  return (
    <ConnectedColumnIdsContext.Provider value={connectedByNode}>
      {children}
    </ConnectedColumnIdsContext.Provider>
  );
}

export function useConnectedColumnIds(nodeId: string): Set<string> {
  const connectedByNode = useContext(ConnectedColumnIdsContext);
  return connectedByNode?.get(nodeId) ?? EMPTY_CONNECTED_COLUMN_IDS;
}
