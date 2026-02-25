import * as Y from 'yjs';
import type { Edge, Node, OnEdgesChange, OnNodesChange } from '@xyflow/react';
import type { DdlParseResult } from '@/lib/ddl-parser';
import type { Column, GroupNodeData, RelationType, TableNodeData } from '@/types/erd';

/** 드래그 중인 position 대기 큐 컨텍스트 */
export interface PositionQueueCtx {
  pending: Map<string, { x: number; y: number }>;
}

/**
 * 렌더링과 무관한 스토어 내부 상태.
 *
 * 이 객체의 필드들은 Zustand `set()`을 거치지 않고 직접 변이(mutate)한다.
 * 이는 의도적인 설계로, React 리렌더링을 트리거하지 않아야 하는 상태
 * (드래그 중 플래그, Observer 참조, 위치 대기 큐 등)를 Zustand 구독 범위 밖에서 관리한다.
 * Zustand DevTools에는 추적되지 않으므로 디버깅 시 유의한다.
 */
export interface InternalState {
  tablesObserver: ((events: Y.YEvent<Y.AbstractType<unknown>>[]) => void) | null;
  edgesObserver: (() => void) | null;
  groupsObserver: (() => void) | null;
  isNodeDragging: boolean;
  hasDeferredTableSync: boolean;
  groupNodeIds: Set<string>;
  tablePositionQueue: PositionQueueCtx;
  groupPositionQueue: PositionQueueCtx;
}

/**
 * ERD 캔버스 상태를 관리하는 Zustand 스토어의 상태 인터페이스.
 */
export interface CanvasState {
  nodes: Node<TableNodeData>[];
  groupNodes: Node<GroupNodeData>[];
  edges: Edge[];
  highlightedNodeIds: string[];
  highlightedEdgeId: string | null;
  /** 현재 편집 모드로 활성화된 노드 ID (null이면 모든 노드가 정적 뷰) */
  activeEditNodeId: string | null;
  /** 코드 에디터 기준 현재 편집 테이블 락 키 */
  codeEditingTableKey: string | null;
  /** 편집 모드 노드를 설정한다. */
  setActiveEditNodeId: (id: string | null) => void;
  /** 코드 에디터 편집 테이블 락 키를 설정한다. */
  setCodeEditingTableKey: (tableKey: string | null) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  setNodes: (nodes: Node<TableNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  lastBackupHash: string;
  markBackedUp: (hash: string) => void;
  prepareBackup: () => { content: string; hash: string } | null;
  addTable: (name?: string) => void;
  deleteTable: (nodeId: string) => void;
  renameTable: (nodeId: string, newName: string) => void;
  updateTableMeta: (
    nodeId: string,
    updates: Partial<
      Pick<TableNodeData, 'label' | 'logicalTableName' | 'tableTermId' | 'headerColor'>
    >,
  ) => void;
  addColumn: (nodeId: string) => void;
  deleteColumn: (nodeId: string, colId: string) => void;
  updateColumn: (nodeId: string, colId: string, updates: Partial<Column>) => void;
  moveColumn: (nodeId: string, fromIndex: number, toIndex: number) => void;
  setHighlightedNodes: (ids: string[]) => void;
  setHighlightedEdge: (id: string | null) => void;
  clearHighlights: () => void;
  removeEdge: (edgeId: string) => void;
  removeEdgeWithFkColumn: (edgeId: string) => void;
  applyLayout: (nodes: Node<TableNodeData>[]) => void;
  serialize: () => string;
  addFkRelation: (
    parentNodeId: string,
    childNodeId: string,
    pkColumns: Column[],
    parentLabel: string,
    existingNames: string[],
    relationType: RelationType,
  ) => number;
  connectWithRelationType: (
    source: string,
    target: string,
    sourceHandle: string | undefined,
    targetHandle: string | undefined,
    relationType: RelationType,
  ) => void;
  importDdl: (result: DdlParseResult) => void;
  replaceFromDdl: (result: DdlParseResult) => void;
  addGroup: (label?: string) => void;
  deleteGroup: (groupId: string) => void;
  renameGroup: (groupId: string, newName: string) => void;
  resizeGroup: (groupId: string, width: number, height: number) => void;
  updateGroupMeta: (groupId: string, updates: Partial<Pick<GroupNodeData, 'color'>>) => void;
  ydoc: Y.Doc | null;
  internal: InternalState;
  initYDoc: (ydoc: Y.Doc) => void;
  destroyYDoc: () => void;
}

/** Canvas 스토어 set 함수 타입 */
export type CanvasSetState = (
  partial: Partial<CanvasState> | ((state: CanvasState) => Partial<CanvasState>),
) => void;

/** Canvas 스토어 get 함수 타입 */
export type CanvasGetState = () => CanvasState;
