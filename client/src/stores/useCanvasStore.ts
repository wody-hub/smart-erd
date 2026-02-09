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
 * Handle ID에서 컬럼 ID를 추출한다.
 *
 * @param handleId Handle ID (형식: `{nodeId}-{colId}-source/target`)
 * @param nodeId   노드 ID
 * @returns 컬럼 ID
 */
export function extractColId(handleId: string, nodeId: string): string {
  return handleId.replace(`${nodeId}-`, '').replace(/-(?:source|target)$/, '');
}

/**
 * ERD 캔버스 상태를 관리하는 Zustand 스토어의 상태 인터페이스.
 */
interface CanvasState {
  /** 캔버스에 표시되는 테이블 노드 목록 */
  nodes: Node<TableNodeData>[];
  /** 테이블 간 관계를 나타내는 엣지 목록 */
  edges: Edge[];
  /** 하이라이트할 노드 ID 배열 */
  highlightedNodeIds: string[];
  /** 하이라이트할 엣지 ID */
  highlightedEdgeId: string | null;
  /** 노드 변경(이동, 선택, 삭제 등) 이벤트 핸들러 */
  onNodesChange: OnNodesChange;
  /** 엣지 변경(선택 등) 이벤트 핸들러 — remove 타입은 필터링하여 커스텀 삭제만 허용 */
  onEdgesChange: OnEdgesChange;
  /** 노드 간 새로운 연결 생성 이벤트 핸들러 */
  onConnect: OnConnect;
  /** 노드 목록을 직접 설정한다. @param nodes 설정할 노드 배열 */
  setNodes: (nodes: Node<TableNodeData>[]) => void;
  /** 엣지 목록을 직접 설정한다. @param edges 설정할 엣지 배열 */
  setEdges: (edges: Edge[]) => void;
  /** 마지막 저장 이후 변경 여부 */
  isDirty: boolean;
  /** dirty 상태를 초기화한다 (저장 후 호출) */
  markClean: () => void;
  /** 새 테이블을 캔버스에 추가한다. @param name 테이블 이름 (미지정 시 자동 생성) */
  addTable: (name?: string) => void;
  /** 테이블을 캔버스에서 삭제한다 (관련 엣지도 제거). @param nodeId 삭제할 노드 ID */
  deleteTable: (nodeId: string) => void;
  /** 테이블 이름을 변경한다. @param nodeId 대상 노드 ID @param newName 새 이름 */
  renameTable: (nodeId: string, newName: string) => void;
  /** 테이블에 새 컬럼을 추가한다. @param nodeId 대상 노드 ID */
  addColumn: (nodeId: string) => void;
  /** 테이블에서 컬럼을 삭제한다. @param nodeId 대상 노드 ID @param colId 삭제할 컬럼 ID */
  deleteColumn: (nodeId: string, colId: string) => void;
  /** 컬럼 속성을 업데이트한다. @param nodeId 대상 노드 ID @param colId 대상 컬럼 ID @param updates 변경할 속성 */
  updateColumn: (nodeId: string, colId: string, updates: Partial<Column>) => void;
  /** 노드 하이라이트를 설정한다. @param ids 하이라이트할 노드 ID 배열 */
  setHighlightedNodes: (ids: string[]) => void;
  /** 엣지 하이라이트를 설정한다. @param id 하이라이트할 엣지 ID (null이면 해제) */
  setHighlightedEdge: (id: string | null) => void;
  /** 모든 하이라이트를 해제한다. */
  clearHighlights: () => void;
  /** 자식 테이블에 FK 컬럼을 추가한다. @param nodeId 대상 노드 ID @param column 추가할 컬럼 */
  addFkColumn: (nodeId: string, column: Column) => void;
  /** FK 관계 엣지를 추가한다. @param sourceNodeId 소스 노드 ID @param sourceHandle 소스 Handle ID @param targetNodeId 타겟 노드 ID @param targetHandle 타겟 Handle ID */
  addFkEdge: (
    sourceNodeId: string,
    sourceHandle: string,
    targetNodeId: string,
    targetHandle: string,
  ) => void;
  /** 엣지만 삭제한다 (FK 컬럼 유지). @param edgeId 삭제할 엣지 ID */
  removeEdge: (edgeId: string) => void;
  /** 엣지와 FK 컬럼을 함께 삭제한다. @param edgeId 삭제할 엣지 ID */
  removeEdgeWithFkColumn: (edgeId: string) => void;
  /** 자동 배치 결과를 적용한다. @param nodes 배치된 노드 배열 */
  applyLayout: (nodes: Node<TableNodeData>[]) => void;
  /** 현재 노드·엣지 상태를 JSON 문자열로 직렬화한다. @returns 직렬화된 JSON */
  serialize: () => string;
  /** JSON 문자열로부터 노드·엣지 상태를 복원한다. @param json 직렬화된 다이어그램 JSON */
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
  highlightedNodeIds: [],
  highlightedEdgeId: null,
  isDirty: false,

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as Node<TableNodeData>[],
      isDirty: true,
    });
  },

  onEdgesChange: (changes) => {
    const filtered = changes.filter((c) => c.type !== 'remove');
    set({ edges: applyEdgeChanges(filtered, get().edges), isDirty: true });
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

  setHighlightedNodes: (ids) => set({ highlightedNodeIds: ids }),
  setHighlightedEdge: (id) => set({ highlightedEdgeId: id }),
  clearHighlights: () => set({ highlightedNodeIds: [], highlightedEdgeId: null }),

  addFkColumn: (nodeId, column) => {
    set({
      nodes: get().nodes.map((n) => {
        if (n.id !== nodeId) return n;
        return { ...n, data: { ...n.data, columns: [...n.data.columns, column] } };
      }),
      isDirty: true,
    });
  },

  addFkEdge: (sourceNodeId, sourceHandle, targetNodeId, targetHandle) => {
    const edge: Edge = {
      id: `e-${sourceHandle}-${targetHandle}`,
      source: sourceNodeId,
      target: targetNodeId,
      sourceHandle,
      targetHandle,
      type: 'step',
      markerEnd: { type: MarkerType.ArrowClosed },
    };
    set({ edges: addEdge(edge, get().edges), isDirty: true });
  },

  removeEdge: (edgeId) => {
    set({
      edges: get().edges.filter((e) => e.id !== edgeId),
      highlightedEdgeId: null,
      highlightedNodeIds: [],
      isDirty: true,
    });
  },

  removeEdgeWithFkColumn: (edgeId) => {
    const { nodes, edges } = get();
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) return;

    const targetNodeId = edge.target;
    const targetHandle = edge.targetHandle;
    if (!targetHandle) {
      set({
        edges: edges.filter((e) => e.id !== edgeId),
        highlightedEdgeId: null,
        highlightedNodeIds: [],
        isDirty: true,
      });
      return;
    }

    const colId = extractColId(targetHandle, targetNodeId);

    set({
      nodes: nodes.map((n) => {
        if (n.id !== targetNodeId) return n;
        return {
          ...n,
          data: { ...n.data, columns: n.data.columns.filter((c) => c.id !== colId) },
        };
      }),
      edges: edges.filter((e) => e.id !== edgeId),
      highlightedEdgeId: null,
      highlightedNodeIds: [],
      isDirty: true,
    });
  },

  applyLayout: (nodes) => {
    set({ nodes, isDirty: true });
  },

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
