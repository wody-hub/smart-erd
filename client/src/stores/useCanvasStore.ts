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
