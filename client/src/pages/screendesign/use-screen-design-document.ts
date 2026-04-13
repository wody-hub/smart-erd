import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';
import type { DocumentMutationSession } from '@/collaboration/core/session/document-mutation-session';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import {
  isScreenSpecCanvasInputAdapter,
  type ScreenSpecLayerMoveDirection,
} from '@/collaboration/plugins/screen-spec/screen-spec-document-plugin';
import {
  resolveScreenDesignFramePreset,
  type ScreenDesignFramePresetId,
} from './screen-design-frame-presets';
import {
  EMPTY_SCREEN_DESIGN_DOCUMENT,
  clampInstanceRect,
  createInstanceYMap,
  createInstanceMasterSnapshot,
  createInstanceMasterSnapshotYMap,
  createMasterYMap,
  createScreenYMap,
  ensureScreenDesignDocumentStructure,
  normalizeScreenDesignColor,
  readScreenDesignDocument,
  resolveLibraryItemById,
  type ScreenDesignLibraryCategoryId,
  type ScreenDesignDocumentSnapshot,
  type ScreenDesignInstance,
  type ScreenDesignMasterDefinition,
  type ScreenDesignScreen,
  type ScreenDesignMasterTier,
} from './screen-design-document';

const ROOT_KEY = 'screenSpec';
const SCREENS_KEY = 'screens';
const SCREEN_ORDER_KEY = 'screenOrder';
const INSTANCES_KEY = 'instances';
const LAYERS_KEY = 'layers';
const MASTERS_KEY = 'masters';
const INSTANCE_OVERRIDES_KEY = 'overrides';
const INSTANCE_MASTER_SNAPSHOT_KEY = 'masterSnapshot';

const LOCAL_ORIGIN = { source: 'local' as const, scope: 'screen-spec' };

interface AddInstanceParams {
  screenId: string;
  masterId: string;
  x: number;
  y: number;
}

interface UpdateInstanceParams {
  x?: number;
  y?: number;
  width?: number | null;
  height?: number | null;
  label?: string | null;
  accentColor?: string | null;
  masterId?: string;
}

interface AddMasterParams {
  name: string;
  categoryId?: ScreenDesignLibraryCategoryId;
  tier?: ScreenDesignMasterTier;
}

interface UpdateMasterParams {
  name?: string;
  categoryId?: ScreenDesignLibraryCategoryId;
  tier?: ScreenDesignMasterTier;
  width?: number;
  height?: number;
  accentColor?: string | null;
}

export interface UseScreenDesignDocumentResult {
  document: ScreenDesignDocumentSnapshot;
  selectedScreenId: string | null;
  selectedScreen: ScreenDesignScreen | null;
  setSelectedScreenId: (screenId: string | null) => void;
  addScreen: (
    name: string,
    presetId?: ScreenDesignFramePresetId,
    screenId?: string,
  ) => string | null;
  renameScreen: (screenId: string, name: string) => void;
  updateScreenPreset: (screenId: string, presetId: ScreenDesignFramePresetId) => void;
  moveScreen: (screenId: string, direction: 'up' | 'down') => void;
  deleteScreen: (screenId: string) => void;
  addMaster: (params: AddMasterParams) => string | null;
  updateMaster: (masterId: string, updates: UpdateMasterParams) => void;
  deleteMaster: (masterId: string) => void;
  addInstance: (params: AddInstanceParams) => string | null;
  updateInstance: (instanceId: string, updates: UpdateInstanceParams) => void;
  deleteInstance: (instanceId: string) => void;
  moveInstanceLayer: (
    screenId: string,
    instanceId: string,
    direction: 'forward' | 'backward' | 'front' | 'back',
  ) => void;
}

interface UseScreenDesignDocumentParams {
  sharedDocumentEngine: YjsSharedDocumentEngine | null;
  documentMutationSession: DocumentMutationSession | null;
  projectionVersion: number;
}

/**
 * 화면기획 문서의 Y.Doc 스냅샷과 로컬 편집 액션을 묶어 제공한다.
 *
 * @param params 화면기획 문서 편집 파라미터
 * @returns 화면기획 문서 스냅샷과 편집 액션
 */
export function useScreenDesignDocument(
  params: UseScreenDesignDocumentParams,
): UseScreenDesignDocumentResult {
  const { sharedDocumentEngine, documentMutationSession, projectionVersion } = params;
  const [document, setDocument] = useState<ScreenDesignDocumentSnapshot>(
    EMPTY_SCREEN_DESIGN_DOCUMENT,
  );
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
  const canvasInputAdapter = useMemo(
    () =>
      isScreenSpecCanvasInputAdapter(documentMutationSession?.inputAdapters?.canvas)
        ? documentMutationSession.inputAdapters.canvas
        : null,
    [documentMutationSession],
  );
  const syncSnapshot = useCallback(() => {
    if (!sharedDocumentEngine) {
      setDocument(EMPTY_SCREEN_DESIGN_DOCUMENT);
      setSelectedScreenId(null);
      return;
    }

    const doc = sharedDocumentEngine.getDocument();
    ensureScreenDesignDocumentStructure(doc);
    setDocument(readScreenDesignDocument(doc));
  }, [sharedDocumentEngine]);

  useEffect(() => {
    syncSnapshot();
  }, [projectionVersion, syncSnapshot]);

  useEffect(() => {
    if (document.screens.length === 0) {
      if (selectedScreenId !== null) {
        setSelectedScreenId(null);
      }
      return;
    }
    if (!selectedScreenId || !document.screens.some((screen) => screen.id === selectedScreenId)) {
      setSelectedScreenId(document.screens[0]?.id ?? null);
    }
  }, [document.screens, selectedScreenId]);

  const selectedScreen = useMemo(
    () => document.screens.find((screen) => screen.id === selectedScreenId) ?? null,
    [document.screens, selectedScreenId],
  );
  const resolveInstanceScreenId = useCallback(
    (instanceId: string) => findScreenIdForInstance(document, instanceId),
    [document],
  );

  const withRootMaps = useCallback(
    (
      callback: (rootMaps: {
        screens: Y.Map<Y.Map<unknown>>;
        screenOrder: Y.Array<string>;
        instances: Y.Map<Y.Map<unknown>>;
        layers: Y.Map<Y.Array<string>>;
        masters: Y.Map<Y.Map<unknown>>;
      }) => void,
    ) => {
      if (!sharedDocumentEngine) {
        return;
      }

      const doc = sharedDocumentEngine.getDocument();
      ensureScreenDesignDocumentStructure(doc);
      doc.transact(() => {
        const root = doc.getMap(ROOT_KEY);
        const screens = root.get(SCREENS_KEY);
        const screenOrder = root.get(SCREEN_ORDER_KEY);
        const instances = root.get(INSTANCES_KEY);
        const layers = root.get(LAYERS_KEY);
        const masters = root.get(MASTERS_KEY);
        if (
          !(screens instanceof Y.Map) ||
          !(screenOrder instanceof Y.Array) ||
          !(instances instanceof Y.Map) ||
          !(layers instanceof Y.Map) ||
          !(masters instanceof Y.Map)
        ) {
          return;
        }

        callback({
          screens,
          screenOrder,
          instances,
          layers,
          masters,
        });
      }, LOCAL_ORIGIN);
    },
    [sharedDocumentEngine],
  );

  const addScreen = useCallback(
    (
      name: string,
      presetId: ScreenDesignFramePresetId = 'desktop',
      screenId = `screen-${crypto.randomUUID()}`,
    ) => {
      if (!sharedDocumentEngine) {
        return null;
      }

      const preset = resolveScreenDesignFramePreset(presetId);
      const screenName = name.trim() || screenId;
      if (canvasInputAdapter && documentMutationSession) {
        const result = documentMutationSession.emitCommandWithResult(
          canvasInputAdapter.addScreen(screenId, screenName, preset.width, preset.height),
        );
        if (result.status === 'applied') {
          syncSnapshot();
        }
        return result.status === 'applied' ? screenId : null;
      }
      withRootMaps(({ screens, screenOrder, layers }) => {
        if (screens.has(screenId)) {
          return;
        }
        screens.set(
          screenId,
          createScreenYMap(screenId, {
            name: screenName,
            width: preset.width,
            height: preset.height,
          }),
        );
        screenOrder.push([screenId]);
        layers.set(screenId, new Y.Array<string>());
      });
      return screenId;
    },
    [canvasInputAdapter, documentMutationSession, sharedDocumentEngine, syncSnapshot, withRootMaps],
  );

  const renameScreen = useCallback(
    (screenId: string, name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return;
      }
      if (canvasInputAdapter && documentMutationSession) {
        const status = documentMutationSession.emitCommand(
          canvasInputAdapter.renameScreen(screenId, trimmedName),
        );
        if (status === 'applied') {
          syncSnapshot();
        }
        return;
      }
      withRootMaps(({ screens }) => {
        const screenYMap = screens.get(screenId);
        if (!(screenYMap instanceof Y.Map)) {
          return;
        }
        screenYMap.set('name', trimmedName);
      });
    },
    [canvasInputAdapter, documentMutationSession, syncSnapshot, withRootMaps],
  );

  const updateScreenPreset = useCallback(
    (screenId: string, presetId: ScreenDesignFramePresetId) => {
      const preset = resolveScreenDesignFramePreset(presetId);
      if (canvasInputAdapter && documentMutationSession) {
        const status = documentMutationSession.emitCommand(
          canvasInputAdapter.updateScreenFrame(screenId, preset.width, preset.height),
        );
        if (status === 'applied') {
          syncSnapshot();
        }
        return;
      }
      withRootMaps(({ screens }) => {
        const screenYMap = screens.get(screenId);
        if (!(screenYMap instanceof Y.Map)) {
          return;
        }
        screenYMap.set('width', preset.width);
        screenYMap.set('height', preset.height);
      });
    },
    [canvasInputAdapter, documentMutationSession, syncSnapshot, withRootMaps],
  );

  const moveScreen = useCallback(
    (screenId: string, direction: 'up' | 'down') => {
      if (canvasInputAdapter && documentMutationSession) {
        const status = documentMutationSession.emitCommand(
          canvasInputAdapter.moveScreen(screenId, direction),
        );
        if (status === 'applied') {
          syncSnapshot();
        }
        return;
      }
      withRootMaps(({ screenOrder }) => {
        const currentOrder = screenOrder
          .toArray()
          .filter(
            (candidate): candidate is string =>
              typeof candidate === 'string' && candidate.length > 0,
          );
        const currentIndex = currentOrder.indexOf(screenId);
        if (currentIndex < 0) {
          return;
        }
        const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (nextIndex < 0 || nextIndex >= currentOrder.length) {
          return;
        }
        const nextOrder = [...currentOrder];
        const [movedScreenId] = nextOrder.splice(currentIndex, 1);
        nextOrder.splice(nextIndex, 0, movedScreenId);
        screenOrder.delete(0, screenOrder.length);
        screenOrder.insert(0, nextOrder);
      });
    },
    [canvasInputAdapter, documentMutationSession, syncSnapshot, withRootMaps],
  );

  const deleteScreen = useCallback(
    (screenId: string) => {
      if (canvasInputAdapter && documentMutationSession) {
        const status = documentMutationSession.emitCommand(
          canvasInputAdapter.deleteScreen(screenId),
        );
        if (status === 'applied') {
          syncSnapshot();
        }
        return;
      }
      withRootMaps(({ screens, screenOrder, instances, layers }) => {
        if (!screens.has(screenId)) {
          return;
        }
        screens.delete(screenId);
        removeStringFromArray(screenOrder, screenId);
        layers.delete(screenId);

        const toDelete: string[] = [];
        instances.forEach((instanceYMap, instanceId) => {
          if (!(instanceYMap instanceof Y.Map)) {
            return;
          }
          if (instanceYMap.get('screenId') === screenId) {
            toDelete.push(instanceId);
          }
        });
        toDelete.forEach((instanceId) => instances.delete(instanceId));
      });
    },
    [canvasInputAdapter, documentMutationSession, syncSnapshot, withRootMaps],
  );

  const addMaster = useCallback(
    ({ name, categoryId = 'form', tier = 'widget' }: AddMasterParams) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return null;
      }

      const masterId = `master-${crypto.randomUUID()}`;
      if (canvasInputAdapter && documentMutationSession) {
        const result = documentMutationSession.emitCommandWithResult(
          canvasInputAdapter.addMaster(masterId, trimmedName, categoryId, tier),
        );
        if (result.status === 'applied') {
          syncSnapshot();
        }
        return result.status === 'applied' ? masterId : null;
      }
      withRootMaps(({ masters }) => {
        masters.set(
          masterId,
          createMasterYMap(masterId, createMasterDraft(trimmedName, categoryId, tier)),
        );
      });
      return masterId;
    },
    [canvasInputAdapter, documentMutationSession, syncSnapshot, withRootMaps],
  );

  const updateMaster = useCallback(
    (masterId: string, updates: UpdateMasterParams) => {
      if (canvasInputAdapter && documentMutationSession) {
        const status = documentMutationSession.emitCommand(
          canvasInputAdapter.updateMaster(masterId, updates),
        );
        if (status === 'applied') {
          syncSnapshot();
        }
        return;
      }
      withRootMaps(({ masters }) => {
        const masterYMap = masters.get(masterId);
        if (!(masterYMap instanceof Y.Map)) {
          return;
        }

        if (typeof updates.name === 'string') {
          const trimmedName = updates.name.trim();
          if (trimmedName) {
            masterYMap.set('name', trimmedName);
            masterYMap.delete('labelKey');
          }
        }
        if (updates.categoryId) {
          masterYMap.set('category', updates.categoryId);
        }
        if (updates.tier) {
          masterYMap.set('tier', updates.tier);
        }
        if (typeof updates.width === 'number' && Number.isFinite(updates.width)) {
          masterYMap.set('width', sanitizeMasterDimension(updates.width));
        }
        if (typeof updates.height === 'number' && Number.isFinite(updates.height)) {
          masterYMap.set('height', sanitizeMasterDimension(updates.height));
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'accentColor')) {
          const accentColor = normalizeScreenDesignColor(updates.accentColor);
          if (accentColor) {
            masterYMap.set('accentColor', accentColor);
          } else {
            masterYMap.delete('accentColor');
          }
        }
      });
    },
    [canvasInputAdapter, documentMutationSession, syncSnapshot, withRootMaps],
  );

  const deleteMaster = useCallback(
    (masterId: string) => {
      if (canvasInputAdapter && documentMutationSession) {
        const status = documentMutationSession.emitCommand(
          canvasInputAdapter.deleteMaster(masterId),
        );
        if (status === 'applied') {
          syncSnapshot();
        }
        return;
      }
      withRootMaps(({ masters, instances }) => {
        if (!masters.has(masterId)) {
          return;
        }

        const masterItem = resolveLibraryItemById(document.libraryItems, masterId);
        const masterSnapshot = masterItem ? createInstanceMasterSnapshot(masterItem) : null;
        if (masterSnapshot) {
          instances.forEach((instanceYMap) => {
            if (!(instanceYMap instanceof Y.Map) || instanceYMap.get('masterId') !== masterId) {
              return;
            }
            instanceYMap.set(
              INSTANCE_MASTER_SNAPSHOT_KEY,
              createInstanceMasterSnapshotYMap(masterSnapshot),
            );
          });
        }
        masters.delete(masterId);
      });
    },
    [
      canvasInputAdapter,
      document.libraryItems,
      documentMutationSession,
      syncSnapshot,
      withRootMaps,
    ],
  );

  const addInstance = useCallback(
    ({ screenId, masterId, x, y }: AddInstanceParams) => {
      const libraryItem = resolveLibraryItemById(document.libraryItems, masterId);
      if (!libraryItem) {
        return null;
      }

      let nextInstanceId: string | null = null;
      if (canvasInputAdapter && documentMutationSession) {
        const instanceId = `instance-${crypto.randomUUID()}`;
        const result = documentMutationSession.emitCommandWithResult(
          canvasInputAdapter.addInstance(instanceId, screenId, masterId, x, y),
        );
        if (result.status === 'applied') {
          syncSnapshot();
        }
        return result.status === 'applied' ? instanceId : null;
      }
      withRootMaps(({ screens, instances, layers }) => {
        const screenYMap = screens.get(screenId);
        const layerYArray = layers.get(screenId);
        if (!(screenYMap instanceof Y.Map) || !(layerYArray instanceof Y.Array)) {
          return;
        }
        const screen = readScreenFromYMap(screenId, screenYMap);
        if (!screen) {
          return;
        }
        const generatedInstanceId = `instance-${crypto.randomUUID()}`;
        nextInstanceId = generatedInstanceId;
        const masterSnapshot = createInstanceMasterSnapshot(libraryItem);
        const rect = clampInstanceRect(
          {
            x,
            y,
            width: masterSnapshot.width,
            height: masterSnapshot.height,
          },
          screen,
        );
        instances.set(
          generatedInstanceId,
          createInstanceYMap({
            id: generatedInstanceId,
            screenId,
            masterId,
            x: rect.x,
            y: rect.y,
            overrides: {
              ...(rect.width !== masterSnapshot.width ? { width: rect.width } : {}),
              ...(rect.height !== masterSnapshot.height ? { height: rect.height } : {}),
            },
            masterSnapshot,
          }),
        );
        layerYArray.push([generatedInstanceId]);
      });
      return nextInstanceId;
    },
    [
      canvasInputAdapter,
      document.libraryItems,
      documentMutationSession,
      syncSnapshot,
      withRootMaps,
    ],
  );

  const updateInstance = useCallback(
    (instanceId: string, updates: UpdateInstanceParams) => {
      const screenId = resolveInstanceScreenId(instanceId);
      if (canvasInputAdapter && documentMutationSession && screenId) {
        const status = documentMutationSession.emitCommand(
          canvasInputAdapter.updateInstance(instanceId, screenId, updates),
        );
        if (status === 'applied') {
          syncSnapshot();
        }
        return;
      }
      withRootMaps(({ screens, instances }) => {
        const instanceYMap = instances.get(instanceId);
        if (!(instanceYMap instanceof Y.Map)) {
          return;
        }
        const currentInstance = findInstanceById(document, instanceId);
        if (!currentInstance) {
          return;
        }
        const screenId =
          typeof instanceYMap.get('screenId') === 'string'
            ? String(instanceYMap.get('screenId'))
            : null;
        if (!screenId) {
          return;
        }
        const screenYMap = screens.get(screenId);
        if (!(screenYMap instanceof Y.Map)) {
          return;
        }
        const screen = readScreenFromYMap(screenId, screenYMap);
        if (!screen) {
          return;
        }

        const nextMasterId = updates.masterId ?? currentInstance.masterId;
        const nextMasterItem = resolveLibraryItemById(document.libraryItems, nextMasterId);
        const nextMasterSnapshot = nextMasterItem
          ? createInstanceMasterSnapshot(nextMasterItem)
          : currentInstance.masterSnapshot;
        if (!nextMasterSnapshot) {
          return;
        }
        const desiredWidth = Object.prototype.hasOwnProperty.call(updates, 'width')
          ? (updates.width ?? nextMasterSnapshot.width)
          : currentInstance.width;
        const desiredHeight = Object.prototype.hasOwnProperty.call(updates, 'height')
          ? (updates.height ?? nextMasterSnapshot.height)
          : currentInstance.height;
        const rect = clampInstanceRect(
          {
            x: updates.x ?? currentInstance.x,
            y: updates.y ?? currentInstance.y,
            width: desiredWidth,
            height: desiredHeight,
          },
          screen,
        );
        instanceYMap.set('x', rect.x);
        instanceYMap.set('y', rect.y);
        instanceYMap.set('masterId', nextMasterId);
        instanceYMap.set(
          INSTANCE_MASTER_SNAPSHOT_KEY,
          createInstanceMasterSnapshotYMap(nextMasterSnapshot),
        );

        const overrides = ensureNestedMap(instanceYMap, INSTANCE_OVERRIDES_KEY);
        if (Object.prototype.hasOwnProperty.call(updates, 'width')) {
          if (rect.width === nextMasterSnapshot.width) {
            overrides.delete('width');
          } else {
            overrides.set('width', rect.width);
          }
          instanceYMap.delete('width');
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'height')) {
          if (rect.height === nextMasterSnapshot.height) {
            overrides.delete('height');
          } else {
            overrides.set('height', rect.height);
          }
          instanceYMap.delete('height');
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'label')) {
          const label = updates.label?.trim();
          if (!label || label === resolveMasterLabel(nextMasterSnapshot, nextMasterId)) {
            overrides.delete('label');
          } else {
            overrides.set('label', label);
          }
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'accentColor')) {
          const accentColor = normalizeScreenDesignColor(updates.accentColor);
          if (
            !accentColor ||
            accentColor === normalizeScreenDesignColor(nextMasterSnapshot.accentColor)
          ) {
            overrides.delete('accentColor');
          } else {
            overrides.set('accentColor', accentColor);
          }
        }
      });
    },
    [
      canvasInputAdapter,
      document,
      documentMutationSession,
      resolveInstanceScreenId,
      syncSnapshot,
      withRootMaps,
    ],
  );

  const deleteInstance = useCallback(
    (instanceId: string) => {
      const screenId = resolveInstanceScreenId(instanceId);
      if (canvasInputAdapter && documentMutationSession && screenId) {
        const status = documentMutationSession.emitCommand(
          canvasInputAdapter.deleteInstance(instanceId, screenId),
        );
        if (status === 'applied') {
          syncSnapshot();
        }
        return;
      }
      withRootMaps(({ instances, layers }) => {
        const instanceYMap = instances.get(instanceId);
        if (!(instanceYMap instanceof Y.Map)) {
          return;
        }
        const screenId =
          typeof instanceYMap.get('screenId') === 'string'
            ? String(instanceYMap.get('screenId'))
            : null;
        if (!screenId) {
          return;
        }
        instances.delete(instanceId);
        const layerYArray = layers.get(screenId);
        if (layerYArray instanceof Y.Array) {
          removeStringFromArray(layerYArray, instanceId);
        }
      });
    },
    [
      canvasInputAdapter,
      documentMutationSession,
      resolveInstanceScreenId,
      syncSnapshot,
      withRootMaps,
    ],
  );

  const moveInstanceLayer = useCallback(
    (
      screenId: string,
      instanceId: string,
      direction: 'forward' | 'backward' | 'front' | 'back',
    ) => {
      if (canvasInputAdapter && documentMutationSession) {
        const status = documentMutationSession.emitCommand(
          canvasInputAdapter.moveInstanceLayer(
            screenId,
            instanceId,
            direction as ScreenSpecLayerMoveDirection,
          ),
        );
        if (status === 'applied') {
          syncSnapshot();
        }
        return;
      }
      withRootMaps(({ layers }) => {
        const layerYArray = layers.get(screenId);
        if (!(layerYArray instanceof Y.Array)) {
          return;
        }
        const currentOrder = layerYArray
          .toArray()
          .filter(
            (candidate): candidate is string =>
              typeof candidate === 'string' && candidate.length > 0,
          );
        const currentIndex = currentOrder.indexOf(instanceId);
        if (currentIndex < 0) {
          return;
        }

        let nextIndex = currentIndex;
        switch (direction) {
          case 'forward':
            nextIndex = Math.min(currentOrder.length - 1, currentIndex + 1);
            break;
          case 'backward':
            nextIndex = Math.max(0, currentIndex - 1);
            break;
          case 'front':
            nextIndex = currentOrder.length - 1;
            break;
          case 'back':
            nextIndex = 0;
            break;
        }

        if (nextIndex === currentIndex) {
          return;
        }

        const nextOrder = [...currentOrder];
        const [movedInstanceId] = nextOrder.splice(currentIndex, 1);
        nextOrder.splice(nextIndex, 0, movedInstanceId);
        layerYArray.delete(0, layerYArray.length);
        layerYArray.insert(0, nextOrder);
      });
    },
    [canvasInputAdapter, documentMutationSession, syncSnapshot, withRootMaps],
  );

  return {
    document,
    selectedScreenId,
    selectedScreen,
    setSelectedScreenId,
    addScreen,
    renameScreen,
    updateScreenPreset,
    moveScreen,
    deleteScreen,
    addMaster,
    updateMaster,
    deleteMaster,
    addInstance,
    updateInstance,
    deleteInstance,
    moveInstanceLayer,
  };
}

/**
 * instance id가 속한 screen id를 찾는다.
 *
 * @param document 현재 화면기획 문서 스냅샷
 * @param instanceId 찾을 instance id
 * @returns instance가 속한 screen id 또는 null
 */
function findScreenIdForInstance(
  document: ScreenDesignDocumentSnapshot,
  instanceId: string,
): string | null {
  for (const [screenId, instances] of Object.entries(document.instancesByScreenId)) {
    if (instances.some((instance) => instance.id === instanceId)) {
      return screenId;
    }
  }
  return null;
}

/**
 * 문서 전체 화면 목록에서 instance id를 찾는다.
 *
 * @param document 현재 화면기획 문서 스냅샷
 * @param instanceId 찾을 instance id
 * @returns 찾은 instance 또는 null
 */
function findInstanceById(
  document: ScreenDesignDocumentSnapshot,
  instanceId: string,
): ScreenDesignInstance | null {
  for (const instances of Object.values(document.instancesByScreenId)) {
    const matchedInstance = instances.find((instance) => instance.id === instanceId);
    if (matchedInstance) {
      return matchedInstance;
    }
  }
  return null;
}

/**
 * Y.Array에서 특정 문자열 항목을 한 번 제거한다.
 *
 * @param yArray 수정할 Y.Array
 * @param value 제거할 문자열 값
 * @returns 없음
 */
function removeStringFromArray(yArray: Y.Array<string>, value: string): void {
  const items = yArray.toArray();
  const index = items.indexOf(value);
  if (index >= 0) {
    yArray.delete(index, 1);
  }
}

/**
 * parent map에 key 이름의 nested Y.Map이 있도록 보장한다.
 *
 * @param parent 상위 Y.Map
 * @param key 보장할 nested map key
 * @returns 보장된 nested Y.Map
 */
function ensureNestedMap(parent: Y.Map<unknown>, key: string): Y.Map<unknown> {
  const current = parent.get(key);
  if (current instanceof Y.Map) {
    return current;
  }
  const nextMap = new Y.Map<unknown>();
  parent.set(key, nextMap);
  return nextMap;
}

/**
 * screen Y.Map을 plain screen 객체로 읽는다.
 *
 * @param screenId 읽을 screen id
 * @param screenYMap 원본 screen Y.Map
 * @returns 유효한 screen 객체 또는 null
 */
function readScreenFromYMap(
  screenId: string,
  screenYMap: Y.Map<unknown>,
): ScreenDesignScreen | null {
  const name =
    typeof screenYMap.get('name') === 'string' ? String(screenYMap.get('name')) : screenId;
  const width =
    typeof screenYMap.get('width') === 'number' ? Number(screenYMap.get('width')) : null;
  const height =
    typeof screenYMap.get('height') === 'number' ? Number(screenYMap.get('height')) : null;
  if (width === null || height === null) {
    return null;
  }
  return {
    id: screenId,
    name,
    width,
    height,
  };
}

/**
 * 새 custom master 생성에 사용할 기본 draft를 만든다.
 *
 * @param name master 이름
 * @param categoryId master 카테고리
 * @param tier master tier
 * @returns 기본 master draft
 */
function createMasterDraft(
  name: string,
  categoryId: ScreenDesignLibraryCategoryId,
  tier: ScreenDesignMasterTier,
): ScreenDesignMasterDefinition {
  return {
    name,
    categoryId,
    tier,
    width: tier === 'block' ? 960 : 360,
    height: tier === 'block' ? 160 : 240,
    renderKind: 'generic',
    preset: false,
  };
}

/**
 * master 크기 입력을 최소값 이상 정수로 보정한다.
 *
 * @param value 보정할 크기 값
 * @returns 보정된 크기 값
 */
function sanitizeMasterDimension(value: number): number {
  return Math.max(48, Math.round(value));
}

/**
 * master snapshot에서 표시 라벨을 해상한다.
 *
 * @param masterSnapshot master snapshot 정보
 * @param fallbackMasterId fallback으로 사용할 master id
 * @returns 표시용 master 라벨
 */
function resolveMasterLabel(masterSnapshot: { label?: string }, fallbackMasterId: string): string {
  return masterSnapshot.label ?? fallbackMasterId;
}
