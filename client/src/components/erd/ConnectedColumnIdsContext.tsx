import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
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

interface ConnectedColumnStore extends ConnectedColumnContextValue {
  listenersByNode: Map<string, Set<() => void>>;
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
  const storeRef = useRef<ConnectedColumnStore>({
    idsByNode: new Map(),
    directionsByNode: new Map(),
    listenersByNode: new Map(),
  });

  useLayoutEffect(() => {
    const next = buildConnectedColumnContext(edges);
    const store = storeRef.current;
    const nodeIds = new Set([
      ...store.idsByNode.keys(),
      ...next.idsByNode.keys(),
      ...store.directionsByNode.keys(),
      ...next.directionsByNode.keys(),
    ]);
    const changedNodeIds: string[] = [];
    for (const nodeId of nodeIds) {
      const previousIds = store.idsByNode.get(nodeId) ?? EMPTY_CONNECTED_COLUMN_IDS;
      const nextIds = next.idsByNode.get(nodeId) ?? EMPTY_CONNECTED_COLUMN_IDS;
      const previousDirections =
        store.directionsByNode.get(nodeId) ?? EMPTY_CONNECTED_COLUMN_DIRECTIONS;
      const nextDirections = next.directionsByNode.get(nodeId) ?? EMPTY_CONNECTED_COLUMN_DIRECTIONS;
      if (
        areSetsEqual(previousIds, nextIds) &&
        areDirectionsEqual(previousDirections, nextDirections)
      ) {
        next.idsByNode.set(nodeId, previousIds);
        next.directionsByNode.set(nodeId, previousDirections);
        continue;
      }
      changedNodeIds.push(nodeId);
    }
    store.idsByNode = next.idsByNode;
    store.directionsByNode = next.directionsByNode;
    for (const nodeId of changedNodeIds) {
      for (const listener of store.listenersByNode.get(nodeId) ?? []) listener();
    }
  }, [edges]);

  return (
    <ConnectedColumnIdsContext.Provider value={storeRef.current}>
      {children}
    </ConnectedColumnIdsContext.Provider>
  );
}

/**
 * 두 집합의 ID를 비교한다.
 * @param left 기준 ID 집합
 * @param right 비교 ID 집합
 * @returns 집합 내용이 같으면 true
 */
function areSetsEqual(left: Set<string>, right: Set<string>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

/**
 * 컬럼별 방향 상태를 비교한다.
 * @param left 기준 방향 맵
 * @param right 비교 방향 맵
 * @returns 컬럼 및 방향 값이 같으면 true
 */
function areDirectionsEqual(
  left: Map<string, ColumnConnectionDirections>,
  right: Map<string, ColumnConnectionDirections>,
): boolean {
  if (left.size !== right.size) return false;
  for (const [columnId, directions] of left) {
    const other = right.get(columnId);
    if (!other || directions.source !== other.source || directions.target !== other.target)
      return false;
  }
  return true;
}

export function useConnectedColumnIds(nodeId: string): Set<string> {
  const store = useContext(ConnectedColumnIdsContext);
  const subscribe = (listener: () => void) => subscribeNode(store, nodeId, listener);
  const getSnapshot = () => store?.idsByNode.get(nodeId) ?? EMPTY_CONNECTED_COLUMN_IDS;
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useConnectedColumnDirections(
  nodeId: string,
): Map<string, ColumnConnectionDirections> {
  const store = useContext(ConnectedColumnIdsContext);
  const subscribe = (listener: () => void) => subscribeNode(store, nodeId, listener);
  const getSnapshot = () =>
    store?.directionsByNode.get(nodeId) ?? EMPTY_CONNECTED_COLUMN_DIRECTIONS;
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * 특정 노드 연결 상태 변경을 구독한다.
 * @param store 연결 상태 저장소
 * @param nodeId 구독할 노드 ID
 * @param listener 변경 알림 콜백
 * @returns 구독 해제 함수
 */
function subscribeNode(
  store: ConnectedColumnContextValue | null,
  nodeId: string,
  listener: () => void,
): () => void {
  if (!store) return () => undefined;
  const connectedStore = store as ConnectedColumnStore;
  const listeners = connectedStore.listenersByNode.get(nodeId) ?? new Set<() => void>();
  listeners.add(listener);
  connectedStore.listenersByNode.set(nodeId, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) connectedStore.listenersByNode.delete(nodeId);
  };
}
