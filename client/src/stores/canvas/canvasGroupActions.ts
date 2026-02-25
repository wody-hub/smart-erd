import { createGroupYMap, getGroupsMap } from '@/collaboration/yjsBridge';
import type { CanvasGetState, CanvasState } from './canvasStoreTypes';

type CanvasGroupActionKeys =
  | 'addGroup'
  | 'deleteGroup'
  | 'renameGroup'
  | 'resizeGroup'
  | 'updateGroupMeta';

/**
 * 캔버스 그룹 액션 팩토리.
 */
export function createCanvasGroupActions(
  get: CanvasGetState,
): Pick<CanvasState, CanvasGroupActionKeys> {
  return {
    addGroup: (label) => {
      const { ydoc, groupNodes } = get();
      if (!ydoc) {
        return;
      }
      const groupId = `group-${crypto.randomUUID()}`;
      const groupLabel = label ?? `Group ${groupNodes.length + 1}`;
      ydoc.transact(() =>
        getGroupsMap(ydoc).set(groupId, createGroupYMap(groupLabel, { x: 100, y: 100 }, 400, 300)),
      );
    },

    deleteGroup: (groupId) => {
      const { ydoc } = get();
      if (ydoc) {
        getGroupsMap(ydoc).delete(groupId);
      }
    },

    renameGroup: (groupId, newName) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      const groupYMap = getGroupsMap(ydoc).get(groupId);
      if (groupYMap) {
        groupYMap.set('label', newName);
      }
    },

    resizeGroup: (groupId, width, height) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      const groupYMap = getGroupsMap(ydoc).get(groupId);
      if (groupYMap) {
        ydoc.transact(() => {
          groupYMap.set('width', width);
          groupYMap.set('height', height);
        });
      }
    },

    updateGroupMeta: (groupId, updates) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      const groupYMap = getGroupsMap(ydoc).get(groupId);
      if (!groupYMap) {
        return;
      }
      ydoc.transact(() => {
        for (const [key, value] of Object.entries(updates)) {
          if (value === undefined || value === null || (key === 'color' && value === 'default')) {
            groupYMap.delete(key);
          } else {
            groupYMap.set(key, value);
          }
        }
      });
    },
  };
}
