import * as Y from 'yjs';
import { create } from 'zustand';
import {
  type Edge,
  type Node,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import type { Column, TableNodeData } from '@/types/erd';
import { djb2 } from '@/lib/hash';
import {
  yTablesMapToNodes,
  yEdgesMapToEdges,
  yDocToJson,
  createColumnYMap,
  createEdgeYMap,
  createTableYMap,
  deleteColumnFromYArray,
  getTablesMap,
  getEdgesMap,
} from '@/collaboration/yjsBridge';

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
 *
 * Y.Doc이 SSOT(Single Source of Truth)이며, Zustand은 읽기 캐시 역할을 한다.
 * 모든 변이는 Y.Doc을 직접 변경하고, observeDeep으로 자동 갱신된다.
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
  /** 마지막 백업 시점의 해시값 */
  lastBackupHash: string;
  /** 백업 완료 후 해시를 갱신한다. @param hash 백업된 콘텐츠의 해시 */
  markBackedUp: (hash: string) => void;
  /**
   * 백업이 필요한 경우 콘텐츠와 해시를 반환한다.
   * 변경이 없으면 null을 반환하여 불필요한 서버 호출을 방지한다.
   *
   * @returns { content, hash } 또는 null
   */
  prepareBackup: () => { content: string; hash: string } | null;
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
  /** 엣지만 삭제한다 (FK 컬럼 유지). @param edgeId 삭제할 엣지 ID */
  removeEdge: (edgeId: string) => void;
  /** 엣지와 FK 컬럼을 함께 삭제한다. @param edgeId 삭제할 엣지 ID */
  removeEdgeWithFkColumn: (edgeId: string) => void;
  /** 자동 배치 결과를 적용한다. @param nodes 배치된 노드 배열 */
  applyLayout: (nodes: Node<TableNodeData>[]) => void;
  /** 현재 노드·엣지 상태를 JSON 문자열로 직렬화한다. @returns 직렬화된 JSON */
  serialize: () => string;
  /**
   * FK 관계를 원자적으로 생성한다 (FK 컬럼 + 엣지).
   *
   * @param parentNodeId  부모 테이블 노드 ID
   * @param childNodeId   자식 테이블 노드 ID
   * @param pkColumns     부모 테이블의 PK 컬럼 배열
   * @param parentLabel   부모 테이블 이름 (FK 컬럼명 접두사)
   * @param existingNames 자식 테이블의 기존 컬럼명 배열 (중복 방지용)
   * @returns 생성된 FK 관계 수
   */
  addFkRelation: (
    parentNodeId: string,
    childNodeId: string,
    pkColumns: Column[],
    parentLabel: string,
    existingNames: string[],
  ) => number;
  /** Y.Doc 참조 (null이면 초기화 전) */
  ydoc: Y.Doc | null;
  /** Y.Doc을 초기화하고 observer를 등록한다. @param ydoc Y.Doc 인스턴스 */
  initYDoc: (ydoc: Y.Doc) => void;
  /** Y.Doc observer를 해제하고 상태를 초기화한다. */
  destroyYDoc: () => void;
}

/**
 * Y.Doc에서 테이블 Y.Map을 가져오는 헬퍼.
 *
 * @param ydoc    Y.Doc
 * @param tableId 테이블 ID
 * @returns 테이블 Y.Map 또는 undefined
 */
function getTableYMap(ydoc: Y.Doc, tableId: string): Y.Map<unknown> | undefined {
  const tablesMap = getTablesMap(ydoc);
  return tablesMap.get(tableId);
}

/**
 * 테이블명을 FK 컬럼명 접두사로 사용할 수 있도록 정규화한다.
 *
 * @param name 테이블명
 * @returns 정규화된 문자열
 */
function sanitizeTableName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * 기존 컬럼명 목록에서 중복되지 않는 고유한 이름을 생성한다.
 *
 * @param base     기본 컬럼명
 * @param existing 기존 컬럼명 배열
 * @returns 고유한 컬럼명
 */
function generateUniqueName(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;
  let i = 1;
  while (existing.includes(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

/**
 * ERD 캔버스 상태 관리 Zustand 스토어.
 *
 * Y.Doc이 SSOT이며, 모든 변이는 Y.Doc을 직접 변경한다.
 * observeDeep 콜백에서 Zustand 상태(nodes, edges)가 자동 갱신된다.
 *
 * @remarks
 * `applyNodeChanges()`는 제네릭 `Node[]`를 반환하므로 `Node<TableNodeData>[]`로 타입 단언이 필요하다.
 *
 * 엣지 ID 규칙: `e-{sourceHandle}-{targetHandle}`
 */
const useCanvasStore = create<CanvasState>((set, get) => {
  /**
   * observeDeep 콜백 참조 (cleanup용).
   * Zustand 외부 — 콜백 참조는 직렬화 불가하며, state 저장 시 불필요한 re-render를 유발하므로 클로저 스코프에 유지.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tablesObserver: ((events: Y.YEvent<any>[]) => void) | null = null;
  /**
   * observeDeep 콜백 참조 (cleanup용).
   * Zustand 외부 — 콜백 참조는 직렬화 불가하며, state 저장 시 불필요한 re-render를 유발하므로 클로저 스코프에 유지.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let edgesObserver: ((events: Y.YEvent<any>[]) => void) | null = null;
  /** 로컬 position 동기화 트랜잭션 origin 식별자 */
  const POSITION_SYNC_ORIGIN = 'local-position-sync';
  /**
   * 노드 드래그 중 여부 (드래그 중 observer 전체 재세팅 방지용).
   * Zustand 외부 — 드래그 중 매 mousemove마다 변경되므로 set() 시 과도한 re-render 발생. 클로저 스코프에서 플래그로만 사용.
   */
  let isNodeDragging = false;
  /**
   * 드래그 중 들어온 원격 테이블 변경의 지연 동기화 필요 여부.
   * Zustand 외부 — isNodeDragging과 동기적으로 판단하는 플래그로, re-render 없이 읽기/쓰기가 필요하므로 클로저 스코프에 유지.
   */
  let hasDeferredTableSync = false;
  /**
   * position 업데이트 throttle 타이머.
   * Zustand 외부 — setTimeout 반환값(타이머 ID)은 직렬화 불가하며 DevTools에 노출할 필요 없으므로 클로저 스코프에 유지.
   */
  let positionThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * throttle 중 누적된 position 변경.
   * Zustand 외부 — throttle 윈도우 내 고빈도 position 변경을 누적하며, 매 변경마다 set() 시 re-render 비용이 과도하므로 클로저 스코프에 유지.
   */
  let pendingPositionChanges: Map<string, { x: number; y: number }> = new Map();

  return {
    nodes: [],
    edges: [],
    highlightedNodeIds: [],
    highlightedEdgeId: null,
    lastBackupHash: '',
    ydoc: null,

    initYDoc: (ydoc) => {
      const tablesMap = getTablesMap(ydoc);
      const edgesMap = getEdgesMap(ydoc);

      // 초기 렌더링 + 초기 해시 설정
      set({
        nodes: yTablesMapToNodes(tablesMap),
        edges: yEdgesMapToEdges(edgesMap),
        ydoc,
        lastBackupHash: djb2(yDocToJson(ydoc)),
      });

      // observeDeep: Y.Doc 변경 시 자동으로 Zustand 상태 갱신
      tablesObserver = (events) => {
        const isLocalPositionSync =
          events.length > 0 &&
          events.every((event) => event.transaction.origin === POSITION_SYNC_ORIGIN);
        if (isLocalPositionSync) {
          return;
        }
        if (isNodeDragging) {
          hasDeferredTableSync = true;
          return;
        }
        set({ nodes: yTablesMapToNodes(tablesMap) });
      };
      edgesObserver = () => {
        set({ edges: yEdgesMapToEdges(edgesMap) });
      };
      tablesMap.observeDeep(tablesObserver);
      edgesMap.observeDeep(edgesObserver);
    },

    destroyYDoc: () => {
      const { ydoc } = get();

      // observer 해제
      if (ydoc) {
        const tablesMap = getTablesMap(ydoc);
        const edgesMap = getEdgesMap(ydoc);
        if (tablesObserver) tablesMap.unobserveDeep(tablesObserver);
        if (edgesObserver) edgesMap.unobserveDeep(edgesObserver);
        ydoc.destroy();
      }

      tablesObserver = null;
      edgesObserver = null;

      // throttle 타이머 정리
      if (positionThrottleTimer) {
        clearTimeout(positionThrottleTimer);
        positionThrottleTimer = null;
      }
      pendingPositionChanges = new Map();
      isNodeDragging = false;
      hasDeferredTableSync = false;

      set({ ydoc: null, nodes: [], edges: [], lastBackupHash: '' });
    },

    onNodesChange: (changes) => {
      const { ydoc } = get();

      for (const change of changes) {
        if (change.type === 'position' && 'dragging' in change) {
          if (change.dragging === true) {
            isNodeDragging = true;
          } else if (change.dragging === false) {
            isNodeDragging = false;
            const doc = get().ydoc;
            if (doc && hasDeferredTableSync) {
              hasDeferredTableSync = false;
              set({ nodes: yTablesMapToNodes(getTablesMap(doc)) });
            }
          }
        }
      }

      // position 변경은 throttle하여 Y.Doc에 반영 (드래그 성능)
      const positionChanges = changes.filter(
        (c) => c.type === 'position' && 'position' in c && c.position,
      );
      if (positionChanges.length > 0 && ydoc) {
        for (const change of positionChanges) {
          if (change.type === 'position' && 'position' in change && change.position) {
            pendingPositionChanges.set(change.id, change.position);
          }
        }

        if (!positionThrottleTimer) {
          positionThrottleTimer = setTimeout(() => {
            const doc = get().ydoc;
            if (doc && pendingPositionChanges.size > 0) {
              doc.transact(() => {
                const tablesMap = getTablesMap(doc);
                for (const [nodeId, pos] of pendingPositionChanges) {
                  const tableYMap = tablesMap.get(nodeId);
                  if (!tableYMap) continue;
                  const posYMap = tableYMap.get('position') as Y.Map<number> | undefined;
                  if (posYMap) {
                    posYMap.set('x', pos.x);
                    posYMap.set('y', pos.y);
                  }
                }
              }, POSITION_SYNC_ORIGIN);
              pendingPositionChanges = new Map();
            }
            positionThrottleTimer = null;
          }, 50);
        }
      }

      // select, dimensions 등 비-position 변경은 로컬만 반영
      set({
        nodes: applyNodeChanges(changes, get().nodes) as Node<TableNodeData>[],
      });
    },

    onEdgesChange: (changes) => {
      const filtered = changes.filter((c) => c.type !== 'remove');
      set({ edges: applyEdgeChanges(filtered, get().edges) });
    },

    onConnect: (connection) => {
      const { ydoc } = get();
      if (!ydoc) return;

      const edgeId = `e-${connection.sourceHandle}-${connection.targetHandle}`;
      ydoc.transact(() => {
        const edgesMap = getEdgesMap(ydoc);
        edgesMap.set(
          edgeId,
          createEdgeYMap(
            connection.source!,
            connection.target!,
            connection.sourceHandle ?? undefined,
            connection.targetHandle ?? undefined,
          ),
        );
      });
    },

    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),

    markBackedUp: (hash) => set({ lastBackupHash: hash }),
    prepareBackup: () => {
      const { ydoc, lastBackupHash } = get();
      if (!ydoc) {
        return null;
      }
      const content = yDocToJson(ydoc);
      const hash = djb2(content);
      if (hash === lastBackupHash) {
        return null;
      }
      return { content, hash };
    },

    setHighlightedNodes: (ids) => set({ highlightedNodeIds: ids }),
    setHighlightedEdge: (id) => set({ highlightedEdgeId: id }),
    clearHighlights: () => set({ highlightedNodeIds: [], highlightedEdgeId: null }),

    removeEdge: (edgeId) => {
      const { ydoc } = get();
      if (!ydoc) return;

      const edgesMap = getEdgesMap(ydoc);
      edgesMap.delete(edgeId);
      set({ highlightedEdgeId: null, highlightedNodeIds: [] });
    },

    removeEdgeWithFkColumn: (edgeId) => {
      const { ydoc, edges } = get();
      if (!ydoc) return;

      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;

      const targetNodeId = edge.target;
      const targetHandle = edge.targetHandle;

      ydoc.transact(() => {
        const edgesMap = getEdgesMap(ydoc);
        edgesMap.delete(edgeId);

        if (targetHandle) {
          const colId = extractColId(targetHandle, targetNodeId);
          const tableYMap = getTableYMap(ydoc, targetNodeId);
          if (tableYMap) {
            const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
            if (colsYArray) {
              deleteColumnFromYArray(colsYArray, colId);
            }
          }
        }
      });
      set({ highlightedEdgeId: null, highlightedNodeIds: [] });
    },

    applyLayout: (nodes) => {
      const { ydoc } = get();
      if (!ydoc) return;

      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        for (const node of nodes) {
          const tableYMap = tablesMap.get(node.id);
          if (!tableYMap) continue;
          const posYMap = tableYMap.get('position') as Y.Map<number> | undefined;
          if (posYMap) {
            posYMap.set('x', node.position.x);
            posYMap.set('y', node.position.y);
          }
        }
      });
    },

    addTable: (name) => {
      const { ydoc, nodes } = get();
      if (!ydoc) return;

      const tableId = `table-${crypto.randomUUID()}`;
      const tableName = name ?? `Table ${nodes.length + 1}`;

      let x = 100;
      let y = 100;
      if (nodes.length > 0) {
        const maxX = Math.max(...nodes.map((n) => (n.position?.x ?? 0) + 220));
        x = maxX + 40;
        y = nodes[0]?.position?.y ?? 100;
      }

      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        const tableYMap = createTableYMap(tableName, { x, y }, [
          {
            id: `col-${crypto.randomUUID()}`,
            name: 'id',
            type: 'BIGINT',
            pk: true,
            nullable: false,
          },
        ]);
        tablesMap.set(tableId, tableYMap);
      });
    },

    deleteTable: (nodeId) => {
      const { ydoc } = get();
      if (!ydoc) return;

      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        const edgesMap = getEdgesMap(ydoc);

        tablesMap.delete(nodeId);

        // 관련 엣지 삭제
        const edgeIdsToDelete: string[] = [];
        edgesMap.forEach((edgeYMap, edgeId) => {
          if (edgeYMap.get('source') === nodeId || edgeYMap.get('target') === nodeId) {
            edgeIdsToDelete.push(edgeId);
          }
        });
        for (const eid of edgeIdsToDelete) {
          edgesMap.delete(eid);
        }
      });
    },

    renameTable: (nodeId, newName) => {
      const { ydoc } = get();
      if (!ydoc) return;

      const tableYMap = getTableYMap(ydoc, nodeId);
      if (tableYMap) {
        tableYMap.set('label', newName);
      }
    },

    addColumn: (nodeId) => {
      const { ydoc } = get();
      if (!ydoc) return;

      const tableYMap = getTableYMap(ydoc, nodeId);
      if (!tableYMap) return;
      const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
      if (!colsYArray) return;

      colsYArray.push([
        createColumnYMap({
          id: `col-${crypto.randomUUID()}`,
          name: 'column',
          type: 'VARCHAR(255)',
          nullable: true,
        }),
      ]);
    },

    deleteColumn: (nodeId, colId) => {
      const { ydoc } = get();
      if (!ydoc) return;

      const handlePrefix = `${nodeId}-${colId}`;

      ydoc.transact(() => {
        const tableYMap = getTableYMap(ydoc, nodeId);
        if (tableYMap) {
          const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
          if (colsYArray) {
            deleteColumnFromYArray(colsYArray, colId);
          }
        }

        // 관련 엣지 삭제
        const edgesMap = getEdgesMap(ydoc);
        const edgeIdsToDelete: string[] = [];
        edgesMap.forEach((edgeYMap, edgeId) => {
          const sh = edgeYMap.get('sourceHandle') as string | undefined;
          const th = edgeYMap.get('targetHandle') as string | undefined;
          if (sh?.startsWith(handlePrefix) || th?.startsWith(handlePrefix)) {
            edgeIdsToDelete.push(edgeId);
          }
        });
        for (const eid of edgeIdsToDelete) {
          edgesMap.delete(eid);
        }
      });
    },

    updateColumn: (nodeId, colId, updates) => {
      const { ydoc } = get();
      if (!ydoc) return;

      const tableYMap = getTableYMap(ydoc, nodeId);
      if (!tableYMap) return;
      const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
      if (!colsYArray) return;

      for (let i = 0; i < colsYArray.length; i++) {
        const colYMap = colsYArray.get(i);
        if (colYMap.get('id') === colId) {
          ydoc.transact(() => {
            for (const [key, value] of Object.entries(updates)) {
              if (value === undefined) {
                colYMap.delete(key);
              } else {
                colYMap.set(key, value);
              }
            }
          });
          break;
        }
      }
    },

    serialize: () => {
      const { ydoc } = get();
      if (ydoc) {
        return yDocToJson(ydoc);
      }
      return JSON.stringify({ nodes: [], edges: [] });
    },

    addFkRelation: (parentNodeId, childNodeId, pkColumns, parentLabel, existingNames) => {
      const { ydoc } = get();
      if (!ydoc) return 0;

      const parentPrefix = sanitizeTableName(parentLabel);
      const names = [...existingNames];
      let createdCount = 0;

      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        const edgesMap = getEdgesMap(ydoc);
        const childTableYMap = tablesMap.get(childNodeId);
        if (!childTableYMap) return;
        const colsYArray = childTableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
        if (!colsYArray) return;

        for (const pkCol of pkColumns) {
          const baseName = parentPrefix
            ? `${parentPrefix}_${pkCol.name}`
            : pkCol.name;
          const fkName = generateUniqueName(baseName, names);
          names.push(fkName);

          const fkColId = `col-${crypto.randomUUID()}`;

          // FK 컬럼 추가 (논리명·도메인은 부모 PK에서 상속)
          colsYArray.push([
            createColumnYMap({
              id: fkColId,
              name: fkName,
              type: pkCol.type,
              fk: true,
              nullable: true,
              logicalName: pkCol.logicalName,
              domainId: pkCol.domainId,
            }),
          ]);

          // FK 엣지 추가
          const sourceHandle = `${parentNodeId}-${pkCol.id}-source`;
          const targetHandle = `${childNodeId}-${fkColId}-target`;
          const edgeId = `e-${sourceHandle}-${targetHandle}`;
          edgesMap.set(
            edgeId,
            createEdgeYMap(parentNodeId, childNodeId, sourceHandle, targetHandle),
          );

          createdCount++;
        }
      });

      return createdCount;
    },
  };
});

export default useCanvasStore;
