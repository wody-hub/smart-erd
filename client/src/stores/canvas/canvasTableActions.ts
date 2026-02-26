import * as Y from 'yjs';
import {
  buildFkPrefix,
  buildUniqueFkColumnName,
  buildUniqueName,
  findColumnYMap,
  populateFromDdl,
} from '@/stores/canvas/canvasStoreHelpers';
import { extractColId } from '@/lib/handle-id';
import {
  createColumnYMap,
  createEdgeYMap,
  createTableYMap,
  deleteColumnFromYArray,
  getEdgesMap,
  getGroupsMap,
  getTablesMap,
  moveColumnInYArray,
  removeTableIdFromYArray,
} from '@/collaboration/yjsBridge';
import type { CanvasGetState, CanvasSetState, CanvasState } from './canvasStoreTypes';

type CanvasTableActionKeys =
  | 'addTable'
  | 'deleteTable'
  | 'renameTable'
  | 'updateTableMeta'
  | 'addColumn'
  | 'deleteColumn'
  | 'updateColumn'
  | 'moveColumn'
  | 'addFkRelation'
  | 'connectWithRelationType'
  | 'importDdl'
  | 'replaceFromDdl';

/**
 * 캔버스 테이블/컬럼/관계 액션 팩토리.
 *
 * @param set Zustand set 함수
 * @param get Zustand get 함수
 * @returns 테이블/컬럼/관계 액션 맵
 */
export function createCanvasTableActions(
  set: CanvasSetState,
  get: CanvasGetState,
): Pick<CanvasState, CanvasTableActionKeys> {
  return {
    addTable: (name) => {
      const { ydoc, nodes } = get();
      if (!ydoc) {
        return;
      }
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
        tablesMap.set(
          tableId,
          createTableYMap(tableName, { x, y }, [
            {
              id: `col-${crypto.randomUUID()}`,
              name: 'id',
              type: 'BIGINT',
              pk: true,
              nullable: false,
            },
          ]),
        );
      });
    },

    deleteTable: (nodeId) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        const edgesMap = getEdgesMap(ydoc);
        tablesMap.delete(nodeId);
        const toDelete: string[] = [];
        edgesMap.forEach((ey, eid) => {
          if (ey.get('source') === nodeId || ey.get('target') === nodeId) {
            toDelete.push(eid);
          }
        });
        toDelete.forEach((eid) => edgesMap.delete(eid));

        // 삭제된 테이블이 포함된 그룹 참조를 함께 정리한다.
        const groupsMap = getGroupsMap(ydoc);
        groupsMap.forEach((groupYMap) => {
          const tableIdsYArray = groupYMap.get('tableIds') as Y.Array<string> | undefined;
          if (tableIdsYArray) {
            removeTableIdFromYArray(tableIdsYArray, nodeId);
          }
        });
      });

      if (get().activeEditNodeId === nodeId) {
        set({ activeEditNodeId: null });
      }
    },

    renameTable: (nodeId, newName) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      const tableYMap = getTablesMap(ydoc).get(nodeId);
      if (tableYMap) {
        tableYMap.set('label', newName);
      }
    },

    updateTableMeta: (nodeId, updates) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      const tableYMap = getTablesMap(ydoc).get(nodeId);
      if (!tableYMap) {
        return;
      }
      ydoc.transact(() => {
        for (const [key, value] of Object.entries(updates)) {
          if (value === undefined || value === null) {
            tableYMap.delete(key);
          } else if (key === 'headerColor' && value === 'default') {
            tableYMap.delete('headerColor');
          } else {
            tableYMap.set(key, value);
          }
        }
      });
    },

    addColumn: (nodeId) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      const tableYMap = getTablesMap(ydoc).get(nodeId);
      if (!tableYMap) {
        return;
      }
      const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
      if (colsYArray) {
        colsYArray.push([
          createColumnYMap({
            id: `col-${crypto.randomUUID()}`,
            name: 'column',
            type: 'VARCHAR(255)',
            nullable: true,
          }),
        ]);
      }
    },

    deleteColumn: (nodeId, colId) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      const handlePrefix = `${nodeId}-${colId}`;
      ydoc.transact(() => {
        const tableYMap = getTablesMap(ydoc).get(nodeId);
        if (tableYMap) {
          const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
          if (colsYArray) {
            deleteColumnFromYArray(colsYArray, colId);
          }
        }
        const edgesMap = getEdgesMap(ydoc);
        const toDelete: string[] = [];
        edgesMap.forEach((ey, eid) => {
          const sh = ey.get('sourceHandle') as string | undefined;
          const th = ey.get('targetHandle') as string | undefined;
          if (sh?.startsWith(handlePrefix) || th?.startsWith(handlePrefix)) {
            toDelete.push(eid);
          }
        });
        toDelete.forEach((eid) => edgesMap.delete(eid));
      });
    },

    updateColumn: (nodeId, colId, updates) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      const tableYMap = getTablesMap(ydoc).get(nodeId);
      if (!tableYMap) {
        return;
      }
      const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
      if (!colsYArray) {
        return;
      }
      const colYMap = findColumnYMap(colsYArray, colId);
      if (!colYMap) {
        return;
      }

      ydoc.transact(() => {
        for (const [key, value] of Object.entries(updates)) {
          if (value === undefined) {
            colYMap.delete(key);
          } else {
            colYMap.set(key, value);
          }
        }
        if ('pk' in updates || 'fk' in updates) {
          const isPk = !!colYMap.get('pk');
          const isFk = !!colYMap.get('fk');
          const thId = `${nodeId}-${colId}-target`;
          getEdgesMap(ydoc).forEach((ey) => {
            if (ey.get('targetHandle') === thId) {
              ey.set('relationType', isPk && isFk ? 'identifying' : 'non-identifying');
            }
          });
        }
      });
    },

    moveColumn: (nodeId, fromIndex, toIndex) => {
      const { ydoc } = get();
      if (!ydoc || fromIndex === toIndex) {
        return;
      }
      const tableYMap = getTablesMap(ydoc).get(nodeId);
      if (tableYMap) {
        const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
        if (colsYArray) {
          ydoc.transact(() => moveColumnInYArray(colsYArray, fromIndex, toIndex));
        }
      }
    },

    addFkRelation: (
      parentNodeId,
      childNodeId,
      pkColumns,
      parentLabel,
      existingNames,
      relationType,
    ) => {
      const { ydoc } = get();
      if (!ydoc) {
        return 0;
      }

      const prefix = buildFkPrefix(parentLabel);
      const names = [...existingNames];
      const isId = relationType === 'identifying';
      let count = 0;

      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        const childTableYMap = tablesMap.get(childNodeId);
        if (!childTableYMap) {
          return;
        }
        const colsYArray = childTableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
        if (!colsYArray) {
          return;
        }
        for (const pkCol of pkColumns) {
          const base = prefix ? `${prefix}_${pkCol.name}` : pkCol.name;
          const fkName = buildUniqueFkColumnName(base, names);
          names.push(fkName);
          const fkColId = `col-${crypto.randomUUID()}`;
          colsYArray.push([
            createColumnYMap({
              id: fkColId,
              name: fkName,
              type: pkCol.type,
              pk: isId ? true : undefined,
              fk: true,
              nullable: !isId,
              logicalName: pkCol.logicalName,
              domainId: pkCol.domainId,
            }),
          ]);

          const sourceHandle = `${parentNodeId}-${pkCol.id}-source`;
          const targetHandle = `${childNodeId}-${fkColId}-target`;
          getEdgesMap(ydoc).set(
            `e-${sourceHandle}-${targetHandle}`,
            createEdgeYMap(parentNodeId, childNodeId, sourceHandle, targetHandle, relationType),
          );
          count += 1;
        }
      });

      return count;
    },

    connectWithRelationType: (source, target, sourceHandle, targetHandle, relationType) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      const isId = relationType === 'identifying';
      ydoc.transact(() => {
        getEdgesMap(ydoc).set(
          `e-${sourceHandle}-${targetHandle}`,
          createEdgeYMap(source, target, sourceHandle, targetHandle, relationType),
        );
        if (targetHandle) {
          const colId = extractColId(targetHandle, target);
          const tableYMap = getTablesMap(ydoc).get(target);
          if (tableYMap) {
            const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
            if (colsYArray) {
              const colYMap = findColumnYMap(colsYArray, colId);
              if (colYMap) {
                colYMap.set('fk', true);
                if (isId) {
                  colYMap.set('pk', true);
                  colYMap.set('nullable', false);
                }
              }
            }
          }
        }
      });
    },

    importDdl: (result) => {
      const { ydoc, nodes } = get();
      if (!ydoc || result.tables.length === 0) {
        return;
      }
      const assigned = new Set(nodes.map((n) => n.data.label));
      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        const edgesMap = getEdgesMap(ydoc);
        const startY =
          nodes.length > 0 ? Math.max(...nodes.map((n) => n.position?.y ?? 0)) + 300 : 100;
        populateFromDdl(tablesMap, edgesMap, result, {
          resolveTableName: (name) => {
            const unique = buildUniqueName(name, [...assigned]);
            assigned.add(unique);
            return unique;
          },
          startY,
        });
      });
    },

    replaceFromDdl: (result) => {
      const { ydoc } = get();
      if (!ydoc || result.tables.length === 0) {
        return;
      }
      const assigned = new Set<string>();
      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        const edgesMap = getEdgesMap(ydoc);
        const groupsMap = getGroupsMap(ydoc);
        for (const key of [...tablesMap.keys()]) {
          tablesMap.delete(key);
        }
        for (const key of [...edgesMap.keys()]) {
          edgesMap.delete(key);
        }
        // 전체 스키마 교체 시 기존 테이블 ID 참조는 모두 무효이므로 그룹 연결을 초기화한다.
        groupsMap.forEach((groupYMap) => {
          const tableIdsYArray = groupYMap.get('tableIds') as Y.Array<string> | undefined;
          if (tableIdsYArray && tableIdsYArray.length > 0) {
            tableIdsYArray.delete(0, tableIdsYArray.length);
          }
        });
        populateFromDdl(tablesMap, edgesMap, result, {
          resolveTableName: (name) => {
            const unique = buildUniqueName(name, [...assigned]);
            assigned.add(unique);
            return unique;
          },
          startY: 100,
        });
      });
    },
  };
}
