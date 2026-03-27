import { useCallback, useMemo } from 'react';
import { useDocumentReadExecutor } from '@/collaboration/core/session/document-mutation-session';
import {
  readErdDocumentGroups,
  readErdDocumentNodes,
  readErdDocumentStructure,
} from '@/collaboration/plugins/erd/query/erd-document-graph-query';
import useCollaborationStore from '@/stores/erd/useCollaborationStore';
import { buildRevisionHash } from '@/lib/code-sync-revision';
import type { ERDEdge, TableNode } from '@/types/erd';
import type { TableGroup } from '@/types/erd';

export interface DiagramErdGraphSnapshot {
  nodes: TableNode[];
  edges: ERDEdge[];
  groups: TableGroup[];
}

export interface DiagramErdNodesSnapshot {
  currentNodes: TableNode[];
  hasNodes: boolean;
  readCurrentNodes: () => TableNode[];
}

type DiagramErdStructureGraphSnapshot = {
  nodes: TableNode[];
  edges: ERDEdge[];
};

export interface DiagramErdStructureSnapshot {
  currentNodes: TableNode[];
  currentEdges: ERDEdge[];
  hasNodes: boolean;
  currentRevisionHash: string;
  readCurrentStructure: () => DiagramErdStructureGraphSnapshot;
  readCurrentRevisionHash: () => string;
}

export interface DiagramErdGroupsReader {
  readCurrentGroups: () => TableGroup[];
}

const EMPTY_GRAPH_SNAPSHOT: DiagramErdGraphSnapshot = {
  nodes: [],
  edges: [],
  groups: [],
};

const EMPTY_STRUCTURE_SNAPSHOT: DiagramErdStructureGraphSnapshot = {
  nodes: [],
  edges: [],
};

function buildGraphRevisionHash(graph: DiagramErdStructureGraphSnapshot): string {
  return buildRevisionHash(
    graph.nodes.map((node) => ({
      id: node.id,
      type: node.type ?? 'table',
      parentId: node.parentId ?? null,
      data: node.data,
    })),
    graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
      type: edge.type ?? 'default',
      data: edge.data,
    })),
  );
}

export function useDiagramErdNodesSnapshot(): DiagramErdNodesSnapshot {
  const readExecutor = useDocumentReadExecutor();
  const documentRevision = useCollaborationStore((state) => state.lastDocumentChange?.revision);

  const currentNodes = useMemo(
    () => (readExecutor ? readErdDocumentNodes(readExecutor) : EMPTY_GRAPH_SNAPSHOT.nodes),
    [documentRevision, readExecutor],
  );
  const hasNodes = currentNodes.length > 0;

  const readCurrentNodes = useCallback((): TableNode[] => {
    return readExecutor ? readErdDocumentNodes(readExecutor) : EMPTY_GRAPH_SNAPSHOT.nodes;
  }, [readExecutor]);

  return useMemo(
    () => ({
      currentNodes,
      hasNodes,
      readCurrentNodes,
    }),
    [currentNodes, hasNodes, readCurrentNodes],
  );
}

export function useDiagramErdStructureSnapshot(): DiagramErdStructureSnapshot {
  const readExecutor = useDocumentReadExecutor();
  const documentRevision = useCollaborationStore((state) => state.lastDocumentChange?.revision);

  const currentStructure = useMemo(
    () => (readExecutor ? readErdDocumentStructure(readExecutor) : EMPTY_STRUCTURE_SNAPSHOT),
    [documentRevision, readExecutor],
  );
  const currentNodes = currentStructure.nodes;
  const currentEdges = currentStructure.edges;
  const hasNodes = currentNodes.length > 0;
  const currentRevisionHash = useMemo(
    () => buildGraphRevisionHash(currentStructure),
    [currentStructure],
  );

  const readCurrentStructure = useCallback(() => {
    return readExecutor ? readErdDocumentStructure(readExecutor) : EMPTY_STRUCTURE_SNAPSHOT;
  }, [readExecutor]);

  const readCurrentRevisionHash = useCallback((): string => {
    return buildGraphRevisionHash(readCurrentStructure());
  }, [readCurrentStructure]);

  return useMemo(
    () => ({
      currentNodes,
      currentEdges,
      hasNodes,
      currentRevisionHash,
      readCurrentStructure,
      readCurrentRevisionHash,
    }),
    [
      currentEdges,
      currentNodes,
      currentRevisionHash,
      hasNodes,
      readCurrentStructure,
      readCurrentRevisionHash,
    ],
  );
}

export function useDiagramErdGroupsReader(): DiagramErdGroupsReader {
  const readExecutor = useDocumentReadExecutor();

  const readCurrentGroups = useCallback((): TableGroup[] => {
    return readExecutor ? readErdDocumentGroups(readExecutor) : EMPTY_GRAPH_SNAPSHOT.groups;
  }, [readExecutor]);

  return useMemo(
    () => ({
      readCurrentGroups,
    }),
    [readCurrentGroups],
  );
}
