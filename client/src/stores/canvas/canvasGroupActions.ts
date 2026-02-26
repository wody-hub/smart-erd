import * as Y from 'yjs';
import { createGroupYMap, getGroupsMap, removeTableIdFromYArray } from '@/collaboration/yjsBridge';
import type { CanvasGetState, CanvasState } from './canvasStoreTypes';

type CanvasGroupActionKeys =
  | 'addGroup'
  | 'deleteGroup'
  | 'renameGroup'
  | 'updateGroupColor'
  | 'addTableToGroup'
  | 'addTablesToGroup'
  | 'removeTableFromGroup'
  | 'removeTablesFromGroup'
  | 'updateGroupTables';

/**
 * 캔버스 논리적 그룹 액션 팩토리.
 *
 * @param get Zustand 상태 getter
 * @returns 논리적 그룹 액션 맵
 */
export function createCanvasGroupActions(
  get: CanvasGetState,
): Pick<CanvasState, CanvasGroupActionKeys> {
  return {
    addGroup: (label) => {
      const { ydoc, groups } = get();
      if (!ydoc) {
        return;
      }

      const groupId = `group-${crypto.randomUUID()}`;
      const groupLabel = label ?? `Group ${groups.length + 1}`;
      ydoc.transact(() => {
        getGroupsMap(ydoc).set(groupId, createGroupYMap(groupLabel));
      });
    },

    deleteGroup: (groupId) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      ydoc.transact(() => {
        getGroupsMap(ydoc).delete(groupId);
      });
    },

    renameGroup: (groupId, newName) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      const groupYMap = getGroupsMap(ydoc).get(groupId);
      if (!groupYMap) {
        return;
      }
      ydoc.transact(() => {
        groupYMap.set('label', newName);
      });
    },

    updateGroupColor: (groupId, color) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      const groupYMap = getGroupsMap(ydoc).get(groupId);
      if (!groupYMap) {
        return;
      }
      ydoc.transact(() => {
        if (color === 'default') {
          groupYMap.delete('color');
        } else {
          groupYMap.set('color', color);
        }
      });
    },

    addTableToGroup: (groupId, tableId) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      const groupYMap = getGroupsMap(ydoc).get(groupId);
      if (!groupYMap) {
        return;
      }
      const tableIdsYArray = groupYMap.get('tableIds') as Y.Array<string> | undefined;
      if (!tableIdsYArray) {
        return;
      }

      for (let i = 0; i < tableIdsYArray.length; i++) {
        if (tableIdsYArray.get(i) === tableId) {
          return;
        }
      }

      ydoc.transact(() => {
        tableIdsYArray.push([tableId]);
      });
    },

    addTablesToGroup: (groupId, tableIds) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      const groupYMap = getGroupsMap(ydoc).get(groupId);
      if (!groupYMap) {
        return;
      }
      const tableIdsYArray = groupYMap.get('tableIds') as Y.Array<string> | undefined;
      if (!tableIdsYArray) {
        return;
      }

      ydoc.transact(() => {
        const existing = new Set<string>();
        tableIdsYArray.forEach((id) => existing.add(id));
        const toInsert = tableIds.filter((id) => !existing.has(id));
        if (toInsert.length > 0) {
          tableIdsYArray.push(toInsert);
        }
      });
    },

    removeTableFromGroup: (groupId, tableId) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      const groupYMap = getGroupsMap(ydoc).get(groupId);
      if (!groupYMap) {
        return;
      }
      const tableIdsYArray = groupYMap.get('tableIds') as Y.Array<string> | undefined;
      if (!tableIdsYArray) {
        return;
      }

      ydoc.transact(() => {
        removeTableIdFromYArray(tableIdsYArray, tableId);
      });
    },

    removeTablesFromGroup: (groupId, tableIds) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      const groupYMap = getGroupsMap(ydoc).get(groupId);
      if (!groupYMap) {
        return;
      }
      const tableIdsYArray = groupYMap.get('tableIds') as Y.Array<string> | undefined;
      if (!tableIdsYArray) {
        return;
      }

      ydoc.transact(() => {
        for (const tableId of tableIds) {
          removeTableIdFromYArray(tableIdsYArray, tableId);
        }
      });
    },

    updateGroupTables: (groupId, toAdd, toRemove) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      const groupYMap = getGroupsMap(ydoc).get(groupId);
      if (!groupYMap) {
        return;
      }
      const tableIdsYArray = groupYMap.get('tableIds') as Y.Array<string> | undefined;
      if (!tableIdsYArray) {
        return;
      }

      ydoc.transact(() => {
        for (const tableId of toRemove) {
          removeTableIdFromYArray(tableIdsYArray, tableId);
        }

        const existing = new Set<string>();
        tableIdsYArray.forEach((id) => existing.add(id));
        const toInsert = toAdd.filter((id) => !existing.has(id));
        if (toInsert.length > 0) {
          tableIdsYArray.push(toInsert);
        }
      });
    },
  };
}
