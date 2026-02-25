import { create } from 'zustand';
import { createCanvasGroupActions } from '@/stores/canvas/canvasGroupActions';
import { createCanvasSyncActions } from '@/stores/canvas/canvasSyncActions';
import { createCanvasTableActions } from '@/stores/canvas/canvasTableActions';
import type { CanvasState } from '@/stores/canvas/canvasStoreTypes';

const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  groupNodes: [],
  edges: [],
  highlightedNodeIds: [],
  highlightedEdgeId: null,
  activeEditNodeId: null,
  codeEditingTableKey: null,
  setActiveEditNodeId: (id) => set({ activeEditNodeId: id }),
  setCodeEditingTableKey: (tableKey) => set({ codeEditingTableKey: tableKey }),
  lastBackupHash: '',
  ydoc: null,
  internal: {
    tablesObserver: null,
    edgesObserver: null,
    groupsObserver: null,
    isNodeDragging: false,
    hasDeferredTableSync: false,
    groupNodeIds: new Set(),
    tablePositionQueue: { pending: new Map() },
    groupPositionQueue: { pending: new Map() },
  },
  ...createCanvasSyncActions(set, get),
  ...createCanvasTableActions(set, get),
  ...createCanvasGroupActions(get),
}));

export default useCanvasStore;
