import {
  ensureColumnStorage,
  getColumnYMap,
  insertColumnYMap,
  deleteTableColumn,
  moveTableColumn,
  patchColumnYMap,
} from '@/collaboration/yjs-columns';
import { CANVAS_HISTORY_ORIGIN } from '@/constants/canvas-history';
import { createColumnYMap, getEdgesMap, getTablesMap } from '@/collaboration/yjsBridge';
import type { CanvasGetState, CanvasState } from './canvasStoreTypes';

type CanvasTableActionKeys = 'addColumn' | 'deleteColumn' | 'updateColumn' | 'moveColumn';

/**
 * 캔버스 테이블/컬럼/관계 액션 팩토리.
 *
 * @param get Zustand get 함수
 * @returns 테이블/컬럼/관계 액션 맵
 */
export function createCanvasTableActions(
  get: CanvasGetState,
): Pick<CanvasState, CanvasTableActionKeys> {
  return {
    addColumn: (nodeId) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      const tableYMap = getTablesMap(ydoc).get(nodeId);
      if (!tableYMap) {
        return;
      }
      ensureColumnStorage(tableYMap);
      ydoc.transact(() => {
        const id = `col-${crypto.randomUUID()}`;
        insertColumnYMap(
          tableYMap,
          id,
          createColumnYMap({
            id,
            name: 'column',
            type: 'VARCHAR(255)',
            nullable: true,
          }),
        );
      }, CANVAS_HISTORY_ORIGIN.USER_COLUMN);
    },

    deleteColumn: (nodeId, colId) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      const table = getTablesMap(ydoc).get(nodeId);
      if (table) ensureColumnStorage(table);
      const handlePrefix = `${nodeId}-${colId}`;
      ydoc.transact(() => {
        const tableYMap = getTablesMap(ydoc).get(nodeId);
        if (tableYMap) {
          deleteTableColumn(tableYMap, colId);
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
      }, CANVAS_HISTORY_ORIGIN.USER_COLUMN);
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
      ensureColumnStorage(tableYMap);
      ydoc.transact(() => {
        if (!patchColumnYMap(tableYMap, colId, updates)) return;
        const colYMap = getColumnYMap(tableYMap, colId)!;
        if ('pk' in updates || 'fk' in updates) {
          const isPk = !!colYMap.get('pk');
          const isFk = !!colYMap.get('fk');
          getEdgesMap(ydoc).forEach((ey) => {
            const targetHandle = ey.get('targetHandle');
            if (
              ey.get('target') === nodeId &&
              typeof targetHandle === 'string' &&
              targetHandle.startsWith(`${nodeId}-${colId}-target`)
            ) {
              ey.set('relationType', isPk && isFk ? 'identifying' : 'non-identifying');
            }
          });
        }
      }, CANVAS_HISTORY_ORIGIN.USER_COLUMN);
    },

    moveColumn: (nodeId, fromIndex, toIndex) => {
      const { ydoc } = get();
      if (!ydoc || fromIndex === toIndex) {
        return;
      }
      const tableYMap = getTablesMap(ydoc).get(nodeId);
      if (tableYMap) {
        ensureColumnStorage(tableYMap);
        ydoc.transact(
          () => moveTableColumn(tableYMap, fromIndex, toIndex),
          CANVAS_HISTORY_ORIGIN.USER_COLUMN,
        );
      }
    },
  };
}
