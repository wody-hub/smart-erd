import { create } from 'zustand';
import {
  type Edge,
  type Node,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  MarkerType,
} from '@xyflow/react';
import type { TableNodeData } from '../types/erd';

interface CanvasState {
  nodes: Node<TableNodeData>[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node<TableNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  serialize: () => string;
  deserialize: (json: string) => void;
}

const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) as Node<TableNodeData>[] });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    const edge: Edge = {
      ...connection,
      id: `e-${connection.sourceHandle}-${connection.targetHandle}`,
      type: 'step',
      markerEnd: { type: MarkerType.ArrowClosed },
    };
    set({ edges: addEdge(edge, get().edges) });
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  serialize: () => {
    const { nodes, edges } = get();
    return JSON.stringify({ nodes, edges });
  },

  deserialize: (json: string) => {
    const { nodes, edges } = JSON.parse(json);
    set({ nodes, edges });
  },
}));

export default useCanvasStore;
