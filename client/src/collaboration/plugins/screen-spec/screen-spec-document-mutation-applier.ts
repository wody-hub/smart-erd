import * as Y from 'yjs';
import type {
  DocumentMutation,
  DocumentMutationApplyResult,
} from '@/collaboration/core/contracts/document-read-executor';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import { readNumber, readPositiveNumber, readString } from '@/lib/yjs-read-utils';
import {
  createMasterDraft,
  ensureNestedMap,
  readScreenFromYMap,
  removeStringFromArray,
  resolveMasterLabel,
  sanitizeMasterDimension,
} from './screen-spec-yjs-helpers';
import {
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
  type ScreenDesignMasterTier,
} from '@/pages/screendesign/screen-design-document';
import { resolveScreenDesignFramePreset } from '@/pages/screendesign/screen-design-frame-presets';
import type {
  ScreenSpecLayerMoveDirection,
  ScreenSpecScreenMoveDirection,
} from './screen-spec-document-plugin';
import {
  SCREEN_SPEC_ROOT_KEY,
  SCREEN_SPEC_SCREENS_KEY,
  SCREEN_SPEC_SCREEN_ORDER_KEY,
  SCREEN_SPEC_INSTANCES_KEY,
  SCREEN_SPEC_LAYERS_KEY,
  SCREEN_SPEC_MASTERS_KEY,
  SCREEN_SPEC_INSTANCE_OVERRIDES_KEY,
  SCREEN_SPEC_INSTANCE_MASTER_SNAPSHOT_KEY,
} from '@/constants/screen-design';

const ROOT_KEY = SCREEN_SPEC_ROOT_KEY;
const SCREENS_KEY = SCREEN_SPEC_SCREENS_KEY;
const SCREEN_ORDER_KEY = SCREEN_SPEC_SCREEN_ORDER_KEY;
const INSTANCES_KEY = SCREEN_SPEC_INSTANCES_KEY;
const LAYERS_KEY = SCREEN_SPEC_LAYERS_KEY;
const MASTERS_KEY = SCREEN_SPEC_MASTERS_KEY;
const INSTANCE_OVERRIDES_KEY = SCREEN_SPEC_INSTANCE_OVERRIDES_KEY;
const INSTANCE_MASTER_SNAPSHOT_KEY = SCREEN_SPEC_INSTANCE_MASTER_SNAPSHOT_KEY;

interface ScreenSpecRootMaps {
  screens: Y.Map<Y.Map<unknown>>;
  screenOrder: Y.Array<string>;
  instances: Y.Map<Y.Map<unknown>>;
  layers: Y.Map<Y.Array<string>>;
  masters: Y.Map<Y.Map<unknown>>;
}

export class ScreenSpecDocumentMutationApplier {
  constructor(private readonly engine: YjsSharedDocumentEngine) {}

  /**
   * 화면기획 mutation을 실제 Y.Doc 변경으로 적용한다.
   *
   * @param mutation 적용할 문서 mutation
   * @returns 적용 결과와 선택적 반환값
   */
  apply<T = unknown>(mutation: DocumentMutation): DocumentMutationApplyResult<T> {
    switch (mutation.key) {
      case 'screen:add':
        return this.toApplyResult<T>(this.applyScreenAdd(mutation) as T | null);
      case 'screen:rename':
        return this.toApplyResult<T>(this.applyScreenRename(mutation) as T | null);
      case 'screen:update-frame':
        return this.toApplyResult<T>(this.applyScreenUpdateFrame(mutation) as T | null);
      case 'screen:move':
        return this.toApplyResult<T>(this.applyScreenMove(mutation) as T | null);
      case 'screen:delete':
        return this.toApplyResult<T>(this.applyScreenDelete(mutation) as T | null);
      case 'master:add':
        return this.toApplyResult<T>(this.applyMasterAdd(mutation) as T | null);
      case 'master:update':
        return this.toApplyResult<T>(this.applyMasterUpdate(mutation) as T | null);
      case 'master:delete':
        return this.toApplyResult<T>(this.applyMasterDelete(mutation) as T | null);
      case 'instance:add':
        return this.toApplyResult<T>(this.applyInstanceAdd(mutation) as T | null);
      case 'instance:update':
        return this.toApplyResult<T>(this.applyInstanceUpdate(mutation) as T | null);
      case 'instance:delete':
        return this.toApplyResult<T>(this.applyInstanceDelete(mutation) as T | null);
      case 'layer:move':
        return this.toApplyResult<T>(this.applyLayerMove(mutation) as T | null);
      default:
        return { applied: false };
    }
  }

  /**
   * nullable 값을 DocumentMutationApplyResult로 감싼다.
   *
   * @param value 적용 결과 값
   * @returns 적용 결과 래퍼
   */
  private toApplyResult<T = unknown>(value: T | null): DocumentMutationApplyResult<T> {
    return value === null ? { applied: false } : { applied: true, value };
  }

  /**
   * screen:add mutation을 적용한다.
   *
   * @param mutation 적용할 mutation
   * @returns 추가된 screen id 또는 null
   */
  private applyScreenAdd(mutation: DocumentMutation): string | null {
    const payload = mutation.payload;
    const screenId = readString(payload?.screenId);
    const name = readString(payload?.name);
    const width = readPositiveNumber(payload?.width);
    const height = readPositiveNumber(payload?.height);
    if (!screenId || !name || width === null || height === null) {
      return null;
    }

    return this.withTransaction(mutation.key, (maps) => {
      if (maps.screens.has(screenId)) {
        return null;
      }
      maps.screens.set(
        screenId,
        createScreenYMap(screenId, {
          name,
          width,
          height,
        }),
      );
      if (!maps.layers.has(screenId)) {
        maps.layers.set(screenId, new Y.Array<string>());
      }
      if (!maps.screenOrder.toArray().includes(screenId)) {
        maps.screenOrder.push([screenId]);
      }
      return screenId;
    });
  }

  /**
   * screen:rename mutation을 적용한다.
   *
   * @param mutation 적용할 mutation
   * @returns 적용 성공 여부 또는 null
   */
  private applyScreenRename(mutation: DocumentMutation): boolean | null {
    const payload = mutation.payload;
    const screenId = readString(payload?.screenId);
    const name = readString(payload?.name);
    if (!screenId || !name) {
      return null;
    }

    return this.withTransaction(mutation.key, (maps) => {
      const screenYMap = maps.screens.get(screenId);
      if (!(screenYMap instanceof Y.Map)) {
        return null;
      }
      screenYMap.set('name', name);
      return true;
    });
  }

  /**
   * screen:update-frame mutation을 적용한다.
   *
   * @param mutation 적용할 mutation
   * @returns 적용 성공 여부 또는 null
   */
  private applyScreenUpdateFrame(mutation: DocumentMutation): boolean | null {
    const payload = mutation.payload;
    const screenId = readString(payload?.screenId);
    const width = readPositiveNumber(payload?.width);
    const height = readPositiveNumber(payload?.height);
    if (!screenId || width === null || height === null) {
      return null;
    }

    return this.withTransaction(mutation.key, (maps) => {
      const screenYMap = maps.screens.get(screenId);
      if (!(screenYMap instanceof Y.Map)) {
        return null;
      }
      screenYMap.set('width', width);
      screenYMap.set('height', height);
      return true;
    });
  }

  /**
   * screen:move mutation을 적용한다.
   *
   * @param mutation 적용할 mutation
   * @returns 적용 성공 여부 또는 null
   */
  private applyScreenMove(mutation: DocumentMutation): boolean | null {
    const payload = mutation.payload;
    const screenId = readString(payload?.screenId);
    const direction = readScreenMoveDirection(payload?.direction);
    if (!screenId || !direction) {
      return null;
    }

    return this.withTransaction(mutation.key, (maps) => {
      const currentOrder = maps.screenOrder
        .toArray()
        .filter(
          (candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0,
        );
      const currentIndex = currentOrder.indexOf(screenId);
      if (currentIndex < 0) {
        return null;
      }
      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= currentOrder.length) {
        return true;
      }
      const nextOrder = [...currentOrder];
      const [movedScreenId] = nextOrder.splice(currentIndex, 1);
      maps.screenOrder.delete(0, maps.screenOrder.length);
      nextOrder.splice(nextIndex, 0, movedScreenId);
      maps.screenOrder.insert(0, nextOrder);
      return true;
    });
  }

  /**
   * screen:delete mutation을 적용한다.
   *
   * @param mutation 적용할 mutation
   * @returns 적용 성공 여부 또는 null
   */
  private applyScreenDelete(mutation: DocumentMutation): boolean | null {
    const screenId = readString(mutation.payload?.screenId);
    if (!screenId) {
      return null;
    }

    return this.withTransaction(mutation.key, (maps) => {
      if (!maps.screens.has(screenId)) {
        return null;
      }
      maps.screens.delete(screenId);
      maps.layers.delete(screenId);
      removeStringFromArray(maps.screenOrder, screenId);

      const toDelete: string[] = [];
      maps.instances.forEach((instanceYMap, instanceId) => {
        if (!(instanceYMap instanceof Y.Map)) {
          return;
        }
        if (instanceYMap.get('screenId') === screenId) {
          toDelete.push(instanceId);
        }
      });
      toDelete.forEach((instanceId) => maps.instances.delete(instanceId));
      return true;
    });
  }

  /**
   * master:add mutation을 적용한다.
   *
   * @param mutation 적용할 mutation
   * @returns 추가된 master id 또는 null
   */
  private applyMasterAdd(mutation: DocumentMutation): string | null {
    const payload = mutation.payload;
    const masterId = readString(payload?.masterId);
    const name = readString(payload?.name);
    const categoryId = readCategoryId(payload?.categoryId);
    const tier = readTier(payload?.tier);
    if (!masterId || !name || !categoryId || !tier) {
      return null;
    }

    return this.withTransaction(mutation.key, (maps) => {
      if (maps.masters.has(masterId)) {
        return null;
      }
      maps.masters.set(
        masterId,
        createMasterYMap(masterId, createMasterDraft(name, categoryId, tier)),
      );
      return masterId;
    });
  }

  /**
   * master:update mutation을 적용한다.
   *
   * @param mutation 적용할 mutation
   * @returns 적용 성공 여부 또는 null
   */
  private applyMasterUpdate(mutation: DocumentMutation): boolean | null {
    const payload = mutation.payload;
    const masterId = readString(payload?.masterId);
    if (!masterId) {
      return null;
    }

    return this.withTransaction(mutation.key, (maps) => {
      const masterYMap = maps.masters.get(masterId);
      if (!(masterYMap instanceof Y.Map)) {
        return null;
      }

      const name = readString(payload?.name);
      if (name) {
        masterYMap.set('name', name);
        masterYMap.delete('labelKey');
      }

      const categoryId = readCategoryId(payload?.categoryId);
      if (categoryId) {
        masterYMap.set('category', categoryId);
      }

      const tier = readTier(payload?.tier);
      if (tier) {
        masterYMap.set('tier', tier);
      }

      const width = readPositiveNumber(payload?.width);
      if (width !== null) {
        masterYMap.set('width', sanitizeMasterDimension(width));
      }

      const height = readPositiveNumber(payload?.height);
      if (height !== null) {
        masterYMap.set('height', sanitizeMasterDimension(height));
      }

      if (hasOwn(payload, 'accentColor')) {
        const accentColor = normalizeScreenDesignColor(payload?.accentColor);
        if (accentColor) {
          masterYMap.set('accentColor', accentColor);
        } else {
          masterYMap.delete('accentColor');
        }
      }
      return true;
    });
  }

  /**
   * master:delete mutation을 적용한다.
   *
   * @param mutation 적용할 mutation
   * @returns 적용 성공 여부 또는 null
   */
  private applyMasterDelete(mutation: DocumentMutation): boolean | null {
    const masterId = readString(mutation.payload?.masterId);
    if (!masterId) {
      return null;
    }

    return this.withTransaction(mutation.key, (maps, doc) => {
      if (!maps.masters.has(masterId)) {
        return null;
      }
      const masterItem = resolveLibraryItemById(
        readScreenDesignDocument(doc).libraryItems,
        masterId,
      );
      if (masterItem) {
        const masterSnapshot = createInstanceMasterSnapshot(masterItem);
        maps.instances.forEach((instanceYMap) => {
          if (!(instanceYMap instanceof Y.Map) || instanceYMap.get('masterId') !== masterId) {
            return;
          }
          instanceYMap.set(
            INSTANCE_MASTER_SNAPSHOT_KEY,
            createInstanceMasterSnapshotYMap(masterSnapshot),
          );
        });
      }
      maps.masters.delete(masterId);
      return true;
    });
  }

  /**
   * instance:add mutation을 적용한다.
   *
   * @param mutation 적용할 mutation
   * @returns 추가된 instance id 또는 null
   */
  private applyInstanceAdd(mutation: DocumentMutation): string | null {
    const payload = mutation.payload;
    const instanceId = readString(payload?.instanceId);
    const screenId = readString(payload?.screenId);
    const masterId = readString(payload?.masterId);
    const x = readNumber(payload?.x);
    const y = readNumber(payload?.y);
    if (!instanceId || !screenId || !masterId || x === null || y === null) {
      return null;
    }

    return this.withTransaction(mutation.key, (maps, doc) => {
      const fallbackPreset = resolveScreenDesignFramePreset('desktop');
      const screen = readScreenFromYMap(screenId, maps.screens.get(screenId), {
        fallbackWidth: fallbackPreset.width,
        fallbackHeight: fallbackPreset.height,
      });
      const layerYArray = maps.layers.get(screenId);
      if (!screen || !(layerYArray instanceof Y.Array)) {
        return null;
      }

      const libraryItem = resolveLibraryItemById(
        readScreenDesignDocument(doc).libraryItems,
        masterId,
      );
      if (!libraryItem) {
        return null;
      }

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
      const overrides: Record<string, unknown> = {};
      if (rect.width !== masterSnapshot.width) {
        overrides.width = rect.width;
      }
      if (rect.height !== masterSnapshot.height) {
        overrides.height = rect.height;
      }

      maps.instances.set(
        instanceId,
        createInstanceYMap({
          id: instanceId,
          screenId,
          masterId,
          x: rect.x,
          y: rect.y,
          overrides,
          masterSnapshot,
        }),
      );
      if (!layerYArray.toArray().includes(instanceId)) {
        layerYArray.push([instanceId]);
      }
      return instanceId;
    });
  }

  /**
   * instance:update mutation을 적용한다.
   *
   * @param mutation 적용할 mutation
   * @returns 적용 성공 여부 또는 null
   */
  private applyInstanceUpdate(mutation: DocumentMutation): boolean | null {
    const payload = mutation.payload;
    const instanceId = readString(payload?.instanceId);
    if (!instanceId) {
      return null;
    }

    return this.withTransaction(mutation.key, (maps, doc) => {
      const instanceYMap = maps.instances.get(instanceId);
      if (!(instanceYMap instanceof Y.Map)) {
        return null;
      }

      const snapshot = readScreenDesignDocument(doc);
      const currentInstance = findInstanceSnapshot(snapshot, instanceId);
      if (!currentInstance) {
        return null;
      }

      const nextMasterId = readString(payload?.masterId) ?? currentInstance.masterId;
      const nextMasterItem = resolveLibraryItemById(snapshot.libraryItems, nextMasterId);
      const nextMasterSnapshot = nextMasterItem
        ? createInstanceMasterSnapshot(nextMasterItem)
        : currentInstance.masterSnapshot;
      if (!nextMasterSnapshot) {
        return null;
      }

      const screenId = readString(payload?.screenId) ?? readString(instanceYMap.get('screenId'));
      if (!screenId) {
        return null;
      }

      const fallbackPreset = resolveScreenDesignFramePreset('desktop');
      const screen = readScreenFromYMap(screenId, maps.screens.get(screenId), {
        fallbackWidth: fallbackPreset.width,
        fallbackHeight: fallbackPreset.height,
      });
      if (!screen) {
        return null;
      }

      const masterChanged = nextMasterId !== currentInstance.masterId;
      const desiredWidth = hasOwn(payload, 'width')
        ? (readPositiveNumber(payload?.width) ?? nextMasterSnapshot.width)
        : masterChanged && !currentInstance.overrideState.width
          ? nextMasterSnapshot.width
          : currentInstance.width;
      const desiredHeight = hasOwn(payload, 'height')
        ? (readPositiveNumber(payload?.height) ?? nextMasterSnapshot.height)
        : masterChanged && !currentInstance.overrideState.height
          ? nextMasterSnapshot.height
          : currentInstance.height;
      const desiredLabel = hasOwn(payload, 'label')
        ? readString(payload?.label)
        : currentInstance.overrideState.label
          ? currentInstance.label
          : null;
      const desiredAccentColor = hasOwn(payload, 'accentColor')
        ? normalizeScreenDesignColor(payload?.accentColor)
        : currentInstance.overrideState.accentColor
          ? normalizeScreenDesignColor(currentInstance.accentColor)
          : null;

      const rect = clampInstanceRect(
        {
          x: readNumber(payload?.x) ?? currentInstance.x,
          y: readNumber(payload?.y) ?? currentInstance.y,
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

      applyInstanceOverrides({
        instanceYMap,
        syncWidth: hasOwn(payload, 'width') || masterChanged,
        syncHeight: hasOwn(payload, 'height') || masterChanged,
        syncLabel: hasOwn(payload, 'label') || masterChanged,
        syncAccentColor: hasOwn(payload, 'accentColor') || masterChanged,
        width: rect.width,
        height: rect.height,
        label: desiredLabel,
        accentColor: desiredAccentColor,
        masterSnapshot: nextMasterSnapshot,
        masterId: nextMasterId,
      });
      return true;
    });
  }

  /**
   * instance:delete mutation을 적용한다.
   *
   * @param mutation 적용할 mutation
   * @returns 적용 성공 여부 또는 null
   */
  private applyInstanceDelete(mutation: DocumentMutation): boolean | null {
    const payload = mutation.payload;
    const instanceId = readString(payload?.instanceId);
    if (!instanceId) {
      return null;
    }

    return this.withTransaction(mutation.key, (maps) => {
      const instanceYMap = maps.instances.get(instanceId);
      if (!(instanceYMap instanceof Y.Map)) {
        return null;
      }
      const screenId = readString(payload?.screenId) ?? readString(instanceYMap.get('screenId'));
      if (!screenId) {
        return null;
      }
      maps.instances.delete(instanceId);
      const layerYArray = maps.layers.get(screenId);
      if (layerYArray instanceof Y.Array) {
        removeStringFromArray(layerYArray, instanceId);
      }
      return true;
    });
  }

  /**
   * layer:move mutation을 적용한다.
   *
   * @param mutation 적용할 mutation
   * @returns 적용 성공 여부 또는 null
   */
  private applyLayerMove(mutation: DocumentMutation): boolean | null {
    const payload = mutation.payload;
    const screenId = readString(payload?.screenId);
    const instanceId = readString(payload?.instanceId);
    const direction = readLayerMoveDirection(payload?.direction);
    if (!screenId || !instanceId || !direction) {
      return null;
    }

    return this.withTransaction(mutation.key, (maps) => {
      const layerYArray = maps.layers.get(screenId);
      if (!(layerYArray instanceof Y.Array)) {
        return null;
      }

      const currentOrder = layerYArray
        .toArray()
        .filter(
          (candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0,
        );
      const currentIndex = currentOrder.indexOf(instanceId);
      if (currentIndex < 0) {
        return null;
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
        return true;
      }

      const nextOrder = [...currentOrder];
      const [movedInstanceId] = nextOrder.splice(currentIndex, 1);
      nextOrder.splice(nextIndex, 0, movedInstanceId);
      layerYArray.delete(0, layerYArray.length);
      layerYArray.insert(0, nextOrder);
      return true;
    });
  }

  /**
   * 공통 transaction 래퍼 안에서 mutation 로직을 실행한다.
   *
   * @param origin transaction origin
   * @param callback root map과 doc를 받는 mutation 콜백
   * @returns 콜백 반환값 또는 null
   */
  private withTransaction<T>(
    origin: unknown,
    callback: (maps: ScreenSpecRootMaps, doc: Y.Doc) => T | null,
  ): T | null {
    const doc = this.engine.getDocument();
    ensureScreenDesignDocumentStructure(doc);

    let result: T | null = null;
    doc.transact(() => {
      result = callback(readRootMaps(doc), doc);
    }, origin);
    return result;
  }
}

/**
 * 화면기획 root map에서 자주 쓰는 하위 map들을 읽는다.
 *
 * @param doc 대상 Y.Doc
 * @returns 화면기획 root map 묶음
 */
function readRootMaps(doc: Y.Doc): ScreenSpecRootMaps {
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
    throw new Error('Screen spec document structure is not initialized');
  }

  return {
    screens,
    screenOrder,
    instances,
    layers,
    masters,
  };
}

/**
 * 문서 스냅샷에서 instance id에 해당하는 instance를 찾는다.
 *
 * @param snapshot 현재 화면기획 문서 스냅샷
 * @param instanceId 찾을 instance id
 * @returns 찾은 instance 또는 undefined
 */
function findInstanceSnapshot(
  snapshot: ReturnType<typeof readScreenDesignDocument>,
  instanceId: string,
) {
  return Object.values(snapshot.instancesByScreenId)
    .flat()
    .find((instance) => instance.id === instanceId);
}

/**
 * 객체가 특정 own/in 상속 프로퍼티를 가지는지 검사한다.
 *
 * @param value 검사할 값
 * @param key 찾을 프로퍼티 키
 * @returns 해당 키가 존재하면 true
 */
function hasOwn(value: unknown, key: string): boolean {
  return typeof value === 'object' && value !== null && key in value;
}

/**
 * 인스턴스의 override 필드를 마스터 스냅샷 기준으로 병합한다.
 *
 * 마스터 기본값과 동일하면 override를 제거하고, 다르면 override에 기록한다.
 *
 * @param params override 동기화 파라미터
 */
function applyInstanceOverrides(params: {
  instanceYMap: Y.Map<unknown>;
  syncWidth: boolean;
  syncHeight: boolean;
  syncLabel: boolean;
  syncAccentColor: boolean;
  width: number;
  height: number;
  label: string | null;
  accentColor: string | null;
  masterSnapshot: {
    label?: string;
    width: number;
    height: number;
    accentColor?: string | null;
  };
  masterId: string;
}): void {
  const {
    instanceYMap,
    syncWidth,
    syncHeight,
    syncLabel,
    syncAccentColor,
    width,
    height,
    label,
    accentColor,
    masterSnapshot,
    masterId,
  } = params;
  const overrides = ensureNestedMap(instanceYMap, INSTANCE_OVERRIDES_KEY);
  if (syncWidth) {
    if (width === masterSnapshot.width) {
      overrides.delete('width');
    } else {
      overrides.set('width', width);
    }
    instanceYMap.delete('width');
  }
  if (syncHeight) {
    if (height === masterSnapshot.height) {
      overrides.delete('height');
    } else {
      overrides.set('height', height);
    }
    instanceYMap.delete('height');
  }
  if (syncLabel) {
    if (!label || label === resolveMasterLabel(masterSnapshot, masterId)) {
      overrides.delete('label');
    } else {
      overrides.set('label', label);
    }
  }
  if (syncAccentColor) {
    if (!accentColor || accentColor === normalizeScreenDesignColor(masterSnapshot.accentColor)) {
      overrides.delete('accentColor');
    } else {
      overrides.set('accentColor', accentColor);
    }
  }
}

/**
 * 저장값에서 master category id를 읽는다.
 *
 * @param value 해석할 저장값
 * @returns 유효한 category id 또는 null
 */
function readCategoryId(value: unknown): ScreenDesignLibraryCategoryId | null {
  return value === 'layout' ||
    value === 'table' ||
    value === 'form' ||
    value === 'input' ||
    value === 'feedback' ||
    value === 'button'
    ? value
    : null;
}

/**
 * 저장값에서 master tier를 읽는다.
 *
 * @param value 해석할 저장값
 * @returns 유효한 tier 또는 null
 */
function readTier(value: unknown): ScreenDesignMasterTier | null {
  return value === 'block' || value === 'widget' ? value : null;
}

/**
 * 저장값에서 screen 이동 방향을 읽는다.
 *
 * @param value 해석할 저장값
 * @returns 유효한 screen 이동 방향 또는 null
 */
function readScreenMoveDirection(value: unknown): ScreenSpecScreenMoveDirection | null {
  return value === 'up' || value === 'down' ? value : null;
}

/**
 * 저장값에서 layer 이동 방향을 읽는다.
 *
 * @param value 해석할 저장값
 * @returns 유효한 layer 이동 방향 또는 null
 */
function readLayerMoveDirection(value: unknown): ScreenSpecLayerMoveDirection | null {
  return value === 'forward' || value === 'backward' || value === 'front' || value === 'back'
    ? value
    : null;
}
