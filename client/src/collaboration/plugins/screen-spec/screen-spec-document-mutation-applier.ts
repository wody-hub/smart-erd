import * as Y from 'yjs';
import type {
  DocumentMutation,
  DocumentMutationApplyResult,
} from '@/collaboration/core/contracts/document-read-executor';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
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
  type ScreenDesignMasterDefinition,
  type ScreenDesignMasterTier,
  type ScreenDesignScreen,
} from '@/pages/screendesign/screen-design-document';
import { resolveScreenDesignFramePreset } from '@/pages/screendesign/screen-design-frame-presets';
import type {
  ScreenSpecLayerMoveDirection,
  ScreenSpecScreenMoveDirection,
} from './screen-spec-document-plugin';

const ROOT_KEY = 'screenSpec';
const SCREENS_KEY = 'screens';
const SCREEN_ORDER_KEY = 'screenOrder';
const INSTANCES_KEY = 'instances';
const LAYERS_KEY = 'layers';
const MASTERS_KEY = 'masters';
const INSTANCE_OVERRIDES_KEY = 'overrides';
const INSTANCE_MASTER_SNAPSHOT_KEY = 'masterSnapshot';

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
      const screen = readScreenRecord(screenId, maps.screens.get(screenId));
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

      const screen = readScreenRecord(screenId, maps.screens.get(screenId));
      if (!screen) {
        return null;
      }

      const desiredWidth = hasOwn(payload, 'width')
        ? (readPositiveNumber(payload?.width) ?? nextMasterSnapshot.width)
        : currentInstance.width;
      const desiredHeight = hasOwn(payload, 'height')
        ? (readPositiveNumber(payload?.height) ?? nextMasterSnapshot.height)
        : currentInstance.height;

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

      const overrides = ensureNestedMap(instanceYMap, INSTANCE_OVERRIDES_KEY);
      if (hasOwn(payload, 'width')) {
        if (rect.width === nextMasterSnapshot.width) {
          overrides.delete('width');
        } else {
          overrides.set('width', rect.width);
        }
        instanceYMap.delete('width');
      }
      if (hasOwn(payload, 'height')) {
        if (rect.height === nextMasterSnapshot.height) {
          overrides.delete('height');
        } else {
          overrides.set('height', rect.height);
        }
        instanceYMap.delete('height');
      }
      if (hasOwn(payload, 'label')) {
        const label = readString(payload?.label);
        if (!label || label === resolveMasterLabel(nextMasterSnapshot, nextMasterId)) {
          overrides.delete('label');
        } else {
          overrides.set('label', label);
        }
      }
      if (hasOwn(payload, 'accentColor')) {
        const accentColor = normalizeScreenDesignColor(payload?.accentColor);
        if (
          !accentColor ||
          accentColor === normalizeScreenDesignColor(nextMasterSnapshot.accentColor)
        ) {
          overrides.delete('accentColor');
        } else {
          overrides.set('accentColor', accentColor);
        }
      }
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
 * screen Y.Map을 plain screen 레코드로 읽는다.
 *
 * @param screenId 읽을 screen id
 * @param screenYMap 원본 screen Y.Map
 * @returns plain screen 레코드 또는 null
 */
function readScreenRecord(
  screenId: string,
  screenYMap: Y.Map<unknown> | undefined,
): ScreenDesignScreen | null {
  if (!(screenYMap instanceof Y.Map)) {
    return null;
  }
  const fallbackPreset = resolveScreenDesignFramePreset('desktop');
  return {
    id: screenId,
    name: readString(screenYMap.get('name')) ?? screenId,
    width: readPositiveNumber(screenYMap.get('width')) ?? fallbackPreset.width,
    height: readPositiveNumber(screenYMap.get('height')) ?? fallbackPreset.height,
  };
}

/**
 * Y.Array에서 특정 문자열 항목을 한 번 제거한다.
 *
 * @param yArray 수정할 Y.Array
 * @param value 제거할 문자열 값
 * @returns 없음
 */
function removeStringFromArray(yArray: Y.Array<string>, value: string): void {
  const current = yArray.toArray();
  const index = current.indexOf(value);
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
 * master snapshot에서 표시 라벨을 해상한다.
 *
 * @param masterSnapshot 표시 라벨을 읽을 master snapshot
 * @param fallbackMasterId fallback master id
 * @returns 표시용 master 라벨
 */
function resolveMasterLabel(
  masterSnapshot: ReturnType<typeof createInstanceMasterSnapshot>,
  fallbackMasterId: string,
): string {
  return masterSnapshot.label ?? fallbackMasterId;
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
 * 새 custom master에 사용할 기본 draft를 만든다.
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
 * master 크기 값을 최소값 이상 정수로 보정한다.
 *
 * @param value 보정할 크기 값
 * @returns 보정된 크기 값
 */
function sanitizeMasterDimension(value: number): number {
  return Math.max(48, Math.round(value));
}

/**
 * 저장값에서 비어 있지 않은 문자열을 읽는다.
 *
 * @param value 해석할 저장값
 * @returns trim된 문자열 또는 null
 */
function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * 저장값에서 유한한 숫자를 읽는다.
 *
 * @param value 해석할 저장값
 * @returns 유효한 숫자 또는 null
 */
function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * 저장값에서 양수 정수를 읽는다.
 *
 * @param value 해석할 저장값
 * @returns 양수 정수 또는 null
 */
function readPositiveNumber(value: unknown): number | null {
  const parsed = readNumber(value);
  return parsed !== null && parsed > 0 ? Math.round(parsed) : null;
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
