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
import type { Column, TableNodeData } from '../types/erd';

/**
 * ERD 캔버스 상태를 관리하는 Zustand 스토어의 상태 인터페이스.
 */
interface CanvasState {
  /** 캔버스에 표시되는 테이블 노드 목록 */
  nodes: Node<TableNodeData>[];
  /** 테이블 간 관계를 나타내는 엣지 목록 */
  edges: Edge[];
  /** 노드 변경(이동, 선택, 삭제 등) 이벤트 핸들러 */
  onNodesChange: OnNodesChange;
  /** 엣지 변경(선택, 삭제 등) 이벤트 핸들러 */
  onEdgesChange: OnEdgesChange;
  /** 노드 간 새로운 연결 생성 이벤트 핸들러 */
  onConnect: OnConnect;
  /** 노드 목록을 직접 설정한다 */
  setNodes: (nodes: Node<TableNodeData>[]) => void;
  /** 엣지 목록을 직접 설정한다 */
  setEdges: (edges: Edge[]) => void;
  /** 마지막 저장 이후 변경 여부 */
  isDirty: boolean;
  /** dirty 상태를 초기화한다 (저장 후 호출) */
  markClean: () => void;
  /** 새 테이블을 캔버스에 추가한다 */
  addTable: (name?: string) => void;
  /** 테이블을 캔버스에서 삭제한다 (관련 엣지도 제거) */
  deleteTable: (nodeId: string) => void;
  /** 테이블 이름을 변경한다 */
  renameTable: (nodeId: string, newName: string) => void;
  /** 테이블에 새 컬럼을 추가한다 */
  addColumn: (nodeId: string) => void;
  /** 테이블에서 컬럼을 삭제한다 */
  deleteColumn: (nodeId: string, colId: string) => void;
  /** 컬럼 속성을 업데이트한다 */
  updateColumn: (nodeId: string, colId: string, updates: Partial<Column>) => void;
  /** 현재 노드·엣지 상태를 JSON 문자열로 직렬화한다 */
  serialize: () => string;
  /** JSON 문자열로부터 노드·엣지 상태를 복원한다 */
  deserialize: (json: string) => void;
}

/**
 * ERD 캔버스 상태 관리 Zustand 스토어.
 *
 * React Flow의 노드·엣지 상태와 변경 핸들러를 관리하며,
 * `serialize()`/`deserialize()`를 통해 다이어그램을 JSON으로 영속화한다.
 *
 * @remarks
 * `applyNodeChanges()`는 제네릭 `Node[]`를 반환하므로 `Node<TableNodeData>[]`로 타입 단언이 필요하다.
 *
 * 엣지 ID 규칙: `e-{sourceHandle}-{targetHandle}`
 */
const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  isDirty: false,

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as Node<TableNodeData>[],
      isDirty: true,
    });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges), isDirty: true });
  },

  onConnect: (connection) => {
    const edge: Edge = {
      ...connection,
      id: `e-${connection.sourceHandle}-${connection.targetHandle}`,
      type: 'step',
      markerEnd: { type: MarkerType.ArrowClosed },
    };
    set({ edges: addEdge(edge, get().edges), isDirty: true });
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  markClean: () => set({ isDirty: false }),

  addTable: (name) => {
    const nodes = get().nodes;
    const tableId = `table-${crypto.randomUUID()}`;
    const tableName = name ?? `Table ${nodes.length + 1}`;

    // Place new table to the right of existing nodes
    let x = 100;
    let y = 100;
    if (nodes.length > 0) {
      const maxX = Math.max(...nodes.map((n) => (n.position?.x ?? 0) + 220));
      x = maxX + 40;
      y = nodes[0]?.position?.y ?? 100;
    }

    const newNode: Node<TableNodeData> = {
      id: tableId,
      type: 'table',
      position: { x, y },
      data: {
        label: tableName,
        columns: [
          {
            id: `col-${crypto.randomUUID()}`,
            name: 'id',
            type: 'BIGINT',
            pk: true,
            nullable: false,
          },
        ],
      },
    };

    set({ nodes: [...nodes, newNode], isDirty: true });
  },

  deleteTable: (nodeId) => {
    const { nodes, edges } = get();
    set({
      nodes: nodes.filter((n) => n.id !== nodeId),
      edges: edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      isDirty: true,
    });
  },

  renameTable: (nodeId, newName) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, label: newName } } : n,
      ),
      isDirty: true,
    });
  },

  addColumn: (nodeId) => {
    set({
      nodes: get().nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const newCol: Column = {
          id: `col-${crypto.randomUUID()}`,
          name: 'column',
          type: 'VARCHAR(255)',
          nullable: true,
        };
        return { ...n, data: { ...n.data, columns: [...n.data.columns, newCol] } };
      }),
      isDirty: true,
    });
  },

  deleteColumn: (nodeId, colId) => {
    const { nodes, edges } = get();
    const handlePrefix = `${nodeId}-${colId}`;
    set({
      nodes: nodes.map((n) => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          data: { ...n.data, columns: n.data.columns.filter((c) => c.id !== colId) },
        };
      }),
      edges: edges.filter(
        (e) =>
          !e.sourceHandle?.startsWith(handlePrefix) && !e.targetHandle?.startsWith(handlePrefix),
      ),
      isDirty: true,
    });
  },

  updateColumn: (nodeId, colId, updates) => {
    set({
      nodes: get().nodes.map((n) => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          data: {
            ...n.data,
            columns: n.data.columns.map((c) => (c.id === colId ? { ...c, ...updates } : c)),
          },
        };
      }),
      isDirty: true,
    });
  },

  serialize: () => {
    const { nodes, edges } = get();
    return JSON.stringify({ nodes, edges });
  },

  deserialize: (json: string) => {
    try {
      const parsed = JSON.parse(json);
      const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
      const edges = Array.isArray(parsed.edges) ? parsed.edges : [];
      set({ nodes, edges });
    } catch {
      console.error('Failed to deserialize diagram JSON');
    }
  },
}));

export default useCanvasStore;
