import { useMemo } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { useDiagramErdApplyActions } from './use-diagram-erd-apply-actions';
import type { ERDEdge, TableGroup, TableNode, TableNodeData } from '@/types/erd';
import {
  useDiagramErdGroupsReader,
  useDiagramErdStructureSnapshot,
} from '@/collaboration/channel/diagram/use-diagram-erd-read-snapshot';
import {
  toLayoutEdges,
  toLayoutNodes,
} from '@/collaboration/plugins/erd/query/erd-document-graph-query';

export interface DiagramErdApplyBeforeState {
  nodes: TableNode[];
  edges: ERDEdge[];
  groups: TableGroup[];
  layoutNodes: Node<TableNodeData>[];
}

export interface DiagramErdApplyCurrentState {
  nodes: Node<TableNodeData>[];
  edges: Edge[];
}

export interface DiagramErdApplyRuntime {
  currentNodes: TableNode[];
  applyLayout: (
    nodes: Node<TableNodeData>[],
    fromNodes: readonly Node<TableNodeData>[],
  ) => 'applied' | 'rejected';
  captureBeforeState: () => DiagramErdApplyBeforeState;
  getCurrentNodes: () => TableNode[];
  getCurrentState: () => DiagramErdApplyCurrentState;
}

export function useDiagramErdApplyRuntime(): DiagramErdApplyRuntime {
  const diagramErdGroupsReader = useDiagramErdGroupsReader();
  const diagramErdStructureSnapshot = useDiagramErdStructureSnapshot();
  const { applyLayout } = useDiagramErdApplyActions();

  return useMemo(
    () => ({
      currentNodes: diagramErdStructureSnapshot.currentNodes,
      applyLayout,
      captureBeforeState: () => {
        const structure = diagramErdStructureSnapshot.readCurrentStructure();
        const groups = diagramErdGroupsReader.readCurrentGroups();
        return {
          nodes: structure.nodes,
          edges: structure.edges as ERDEdge[],
          groups: groups as TableGroup[],
          layoutNodes: toLayoutNodes(structure.nodes),
        };
      },
      getCurrentNodes: () => diagramErdStructureSnapshot.readCurrentStructure().nodes,
      getCurrentState: () => {
        const structure = diagramErdStructureSnapshot.readCurrentStructure();
        return {
          nodes: toLayoutNodes(structure.nodes) as Node<TableNodeData>[],
          edges: toLayoutEdges(structure.edges) as Edge[],
        };
      },
    }),
    [applyLayout, diagramErdGroupsReader, diagramErdStructureSnapshot],
  );
}
