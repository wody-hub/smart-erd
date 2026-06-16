import * as Y from 'yjs';
import { readBoolean, readNumber, readPositiveNumber, readString } from '@/lib/yjs-read-utils';
import {
  SCREEN_SPEC_ROOT_KEY,
  SCREEN_SPEC_SCREENS_KEY,
  SCREEN_SPEC_SCREEN_ORDER_KEY,
  SCREEN_SPEC_INSTANCES_KEY,
  SCREEN_SPEC_LAYERS_KEY,
  SCREEN_SPEC_MASTERS_KEY,
  SCREEN_SPEC_INSTANCE_OVERRIDES_KEY,
  SCREEN_SPEC_INSTANCE_MASTER_SNAPSHOT_KEY,
  SCREEN_SPEC_SCHEMA_VERSION_KEY,
  SCREEN_SPEC_LIBRARY_SEED_VERSION_KEY,
} from '@/constants/screen-design';
import {
  DEFAULT_SCREEN_DESIGN_FRAME_PRESET_ID,
  resolveScreenDesignFramePreset,
} from './screen-design-frame-presets';
import { convertCssColorToHex } from './screen-design-canvas-palette';

const ROOT_KEY = SCREEN_SPEC_ROOT_KEY;
const SCHEMA_VERSION_KEY = SCREEN_SPEC_SCHEMA_VERSION_KEY;
export const SCREEN_DESIGN_DOCUMENT_SCHEMA_VERSION = 4;
const SCHEMA_VERSION = SCREEN_DESIGN_DOCUMENT_SCHEMA_VERSION;
const LIBRARY_SEED_VERSION_KEY = SCREEN_SPEC_LIBRARY_SEED_VERSION_KEY;
const LIBRARY_SEED_VERSION = 1;
const SCREENS_KEY = SCREEN_SPEC_SCREENS_KEY;
const SCREEN_ORDER_KEY = SCREEN_SPEC_SCREEN_ORDER_KEY;
const INSTANCES_KEY = SCREEN_SPEC_INSTANCES_KEY;
const LAYERS_KEY = SCREEN_SPEC_LAYERS_KEY;
const MASTERS_KEY = SCREEN_SPEC_MASTERS_KEY;
const INSTANCE_OVERRIDES_KEY = SCREEN_SPEC_INSTANCE_OVERRIDES_KEY;
const INSTANCE_MASTER_SNAPSHOT_KEY = SCREEN_SPEC_INSTANCE_MASTER_SNAPSHOT_KEY;

const BUILT_IN_LIBRARY_CATEGORY_IDS = [
  'layout',
  'table',
  'form',
  'input',
  'feedback',
  'button',
] as const;
const BUILT_IN_RENDER_KINDS = [
  'topBar',
  'sideRail',
  'bottomTabs',
  'formStack',
  'detailPane',
  'gnb',
  'lnb',
  'tabMenu',
  'breadcrumb',
  'dataTable',
  'simpleTable',
  'cardList',
  'loginForm',
  'searchBar',
  'filterPanel',
  'editForm',
  'textInput',
  'dropdown',
  'checkboxGroup',
  'radioGroup',
  'datePicker',
  'toast',
  'dialog',
  'spinner',
  'emptyState',
  'primaryButton',
  'iconButton',
  'buttonGroup',
  'generic',
] as const;

export const SCREEN_DESIGN_DOCUMENT_PADDING = 24;
export const SCREEN_DESIGN_MIN_INSTANCE_WIDTH = 72;
export const SCREEN_DESIGN_MIN_INSTANCE_HEIGHT = 56;
export const SCREEN_DESIGN_INITIAL_SCREEN_ID = 'screen-initial';

export type ScreenDesignLibraryCategoryId = (typeof BUILT_IN_LIBRARY_CATEGORY_IDS)[number];
export type ScreenDesignMasterTier = 'block' | 'widget';
export type ScreenDesignMasterRenderKind = (typeof BUILT_IN_RENDER_KINDS)[number];

/** CSS variable 이름 → category 매핑 */
const SCREEN_SPEC_CATEGORY_TOKENS: Record<ScreenDesignLibraryCategoryId | 'default', string> = {
  layout: '--screen-spec-category-layout',
  table: '--screen-spec-category-table',
  form: '--screen-spec-category-form',
  input: '--screen-spec-category-input',
  feedback: '--screen-spec-category-feedback',
  button: '--screen-spec-category-button',
  default: '--screen-spec-category-default',
};

/** import-safe category accent fallback HSL */
const SCREEN_SPEC_CATEGORY_FALLBACK_HSL: Record<ScreenDesignLibraryCategoryId | 'default', string> =
  {
    layout: '213 27% 84%',
    table: '213 97% 87%',
    form: '232 97% 89%',
    input: '141 79% 85%',
    feedback: '48 97% 77%',
    button: '326 88% 90%',
    default: '212 24% 89%',
  };

/** non-DOM runtime fallback hex */
const SCREEN_SPEC_CATEGORY_FALLBACK_HEX: Record<ScreenDesignLibraryCategoryId | 'default', string> =
  {
    layout: '#cbd5e1',
    table: '#bedbfe',
    form: '#c8cffe',
    input: '#bbf7d0',
    feedback: '#fde68b',
    button: '#fccfe8',
    default: '#dce3ea',
  };

export interface ScreenDesignScreen {
  id: string;
  name: string;
  width: number;
  height: number;
}

export interface ScreenDesignInstanceOverrideState {
  label: boolean;
  accentColor: boolean;
  width: boolean;
  height: boolean;
}

export interface ScreenDesignInstanceMasterSnapshot {
  label?: string;
  labelKey?: string;
  categoryId: ScreenDesignLibraryCategoryId;
  tier: ScreenDesignMasterTier;
  width: number;
  height: number;
  renderKind: ScreenDesignMasterRenderKind;
  accentColor: string | null;
  preset: boolean;
}

export interface ScreenDesignInstanceSeed {
  id: string;
  screenId: string;
  masterId: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  overrides?: Partial<Pick<ScreenDesignInstance, 'label' | 'accentColor' | 'width' | 'height'>>;
  masterSnapshot?: ScreenDesignInstanceMasterSnapshot | null;
}

export interface ScreenDesignInstance {
  id: string;
  screenId: string;
  masterId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  labelKey?: string;
  masterLabel: string;
  masterLabelKey?: string;
  renderKind: ScreenDesignMasterRenderKind;
  accentColor: string | null;
  masterAccentColor: string | null;
  isOrphan: boolean;
  overrideState: ScreenDesignInstanceOverrideState;
  masterSnapshot: ScreenDesignInstanceMasterSnapshot | null;
}

export interface ScreenDesignLibraryCategory {
  id: ScreenDesignLibraryCategoryId;
  labelKey: string;
  order: number;
}

export interface ScreenDesignMasterDefinition {
  name?: string;
  labelKey?: string;
  categoryId: ScreenDesignLibraryCategoryId;
  tier: ScreenDesignMasterTier;
  width: number;
  height: number;
  renderKind: ScreenDesignMasterRenderKind;
  accentColor?: string | null;
  preset?: boolean;
}

export interface ScreenDesignLibraryItem {
  id: string;
  tier: ScreenDesignMasterTier;
  width: number;
  height: number;
  renderKind: ScreenDesignMasterRenderKind;
  categoryId: ScreenDesignLibraryCategoryId;
  accentColor: string | null;
  category?: string;
  categoryKey?: string;
  label?: string;
  labelKey?: string;
  preset: boolean;
}

export interface ScreenDesignDocumentSnapshot {
  screens: ScreenDesignScreen[];
  instancesByScreenId: Record<string, ScreenDesignInstance[]>;
  libraryItems: ScreenDesignLibraryItem[];
  mastersById: Record<string, ScreenDesignLibraryItem>;
  mastersAvailable: boolean;
}

interface ReadScreenDesignDocumentOptions {
  ensureStructure?: boolean;
}

export const SCREEN_DESIGN_LIBRARY_CATEGORIES: ScreenDesignLibraryCategory[] = [
  {
    id: 'layout',
    labelKey: 'screenSpec.library.category.layout',
    order: 0,
  },
  {
    id: 'table',
    labelKey: 'screenSpec.library.category.table',
    order: 1,
  },
  {
    id: 'form',
    labelKey: 'screenSpec.library.category.form',
    order: 2,
  },
  {
    id: 'input',
    labelKey: 'screenSpec.library.category.input',
    order: 3,
  },
  {
    id: 'feedback',
    labelKey: 'screenSpec.library.category.feedback',
    order: 4,
  },
  {
    id: 'button',
    labelKey: 'screenSpec.library.category.button',
    order: 5,
  },
];

const BUILT_IN_LIBRARY_SEEDS: Array<ScreenDesignMasterDefinition & { id: string }> = [
  {
    id: 'layout-gnb',
    labelKey: 'screenSpec.library.item.gnb',
    categoryId: 'layout',
    tier: 'block',
    width: 1120,
    height: 76,
    renderKind: 'gnb',
    preset: true,
  },
  {
    id: 'layout-lnb',
    labelKey: 'screenSpec.library.item.lnb',
    categoryId: 'layout',
    tier: 'block',
    width: 240,
    height: 640,
    renderKind: 'lnb',
    preset: true,
  },
  {
    id: 'layout-tabs',
    labelKey: 'screenSpec.library.item.tabMenu',
    categoryId: 'layout',
    tier: 'block',
    width: 720,
    height: 120,
    renderKind: 'tabMenu',
    preset: true,
  },
  {
    id: 'layout-breadcrumb',
    labelKey: 'screenSpec.library.item.breadcrumb',
    categoryId: 'layout',
    tier: 'block',
    width: 540,
    height: 72,
    renderKind: 'breadcrumb',
    preset: true,
  },
  {
    id: 'table-data-table',
    labelKey: 'screenSpec.library.item.dataTable',
    categoryId: 'table',
    tier: 'widget',
    width: 960,
    height: 520,
    renderKind: 'dataTable',
    preset: true,
  },
  {
    id: 'table-simple-table',
    labelKey: 'screenSpec.library.item.simpleTable',
    categoryId: 'table',
    tier: 'widget',
    width: 820,
    height: 420,
    renderKind: 'simpleTable',
    preset: true,
  },
  {
    id: 'table-card-list',
    labelKey: 'screenSpec.library.item.cardList',
    categoryId: 'table',
    tier: 'widget',
    width: 820,
    height: 360,
    renderKind: 'cardList',
    preset: true,
  },
  {
    id: 'form-login',
    labelKey: 'screenSpec.library.item.loginForm',
    categoryId: 'form',
    tier: 'widget',
    width: 420,
    height: 420,
    renderKind: 'loginForm',
    preset: true,
  },
  {
    id: 'form-search-bar',
    labelKey: 'screenSpec.library.item.searchBar',
    categoryId: 'form',
    tier: 'widget',
    width: 680,
    height: 128,
    renderKind: 'searchBar',
    preset: true,
  },
  {
    id: 'form-filter-panel',
    labelKey: 'screenSpec.library.item.filterPanel',
    categoryId: 'form',
    tier: 'widget',
    width: 360,
    height: 520,
    renderKind: 'filterPanel',
    preset: true,
  },
  {
    id: 'form-edit-form',
    labelKey: 'screenSpec.library.item.editForm',
    categoryId: 'form',
    tier: 'widget',
    width: 620,
    height: 520,
    renderKind: 'editForm',
    preset: true,
  },
  {
    id: 'input-text',
    labelKey: 'screenSpec.library.item.textInput',
    categoryId: 'input',
    tier: 'widget',
    width: 340,
    height: 108,
    renderKind: 'textInput',
    preset: true,
  },
  {
    id: 'input-dropdown',
    labelKey: 'screenSpec.library.item.dropdown',
    categoryId: 'input',
    tier: 'widget',
    width: 340,
    height: 108,
    renderKind: 'dropdown',
    preset: true,
  },
  {
    id: 'input-checkbox-group',
    labelKey: 'screenSpec.library.item.checkboxGroup',
    categoryId: 'input',
    tier: 'widget',
    width: 340,
    height: 188,
    renderKind: 'checkboxGroup',
    preset: true,
  },
  {
    id: 'input-radio-group',
    labelKey: 'screenSpec.library.item.radioGroup',
    categoryId: 'input',
    tier: 'widget',
    width: 340,
    height: 188,
    renderKind: 'radioGroup',
    preset: true,
  },
  {
    id: 'input-date-picker',
    labelKey: 'screenSpec.library.item.datePicker',
    categoryId: 'input',
    tier: 'widget',
    width: 360,
    height: 220,
    renderKind: 'datePicker',
    preset: true,
  },
  {
    id: 'feedback-toast',
    labelKey: 'screenSpec.library.item.toast',
    categoryId: 'feedback',
    tier: 'widget',
    width: 420,
    height: 120,
    renderKind: 'toast',
    preset: true,
  },
  {
    id: 'feedback-dialog',
    labelKey: 'screenSpec.library.item.dialog',
    categoryId: 'feedback',
    tier: 'widget',
    width: 460,
    height: 280,
    renderKind: 'dialog',
    preset: true,
  },
  {
    id: 'feedback-spinner',
    labelKey: 'screenSpec.library.item.spinner',
    categoryId: 'feedback',
    tier: 'widget',
    width: 220,
    height: 220,
    renderKind: 'spinner',
    preset: true,
  },
  {
    id: 'feedback-empty-state',
    labelKey: 'screenSpec.library.item.emptyState',
    categoryId: 'feedback',
    tier: 'widget',
    width: 440,
    height: 320,
    renderKind: 'emptyState',
    preset: true,
  },
  {
    id: 'button-primary',
    labelKey: 'screenSpec.library.item.primaryButton',
    categoryId: 'button',
    tier: 'widget',
    width: 220,
    height: 76,
    renderKind: 'primaryButton',
    preset: true,
  },
  {
    id: 'button-icon',
    labelKey: 'screenSpec.library.item.iconButton',
    categoryId: 'button',
    tier: 'widget',
    width: 96,
    height: 96,
    renderKind: 'iconButton',
    preset: true,
  },
  {
    id: 'button-group',
    labelKey: 'screenSpec.library.item.buttonGroup',
    categoryId: 'button',
    tier: 'widget',
    width: 360,
    height: 84,
    renderKind: 'buttonGroup',
    preset: true,
  },
];

const BUILT_IN_LIBRARY_SEED_BY_ID = new Map(
  BUILT_IN_LIBRARY_SEEDS.map((seed, index) => [seed.id, { seed, index }]),
);

export const EMPTY_SCREEN_DESIGN_DOCUMENT: ScreenDesignDocumentSnapshot = {
  screens: [],
  instancesByScreenId: {},
  libraryItems: [],
  mastersById: {},
  mastersAvailable: false,
};

export const FALLBACK_SCREEN_DESIGN_LIBRARY: ScreenDesignLibraryItem[] = BUILT_IN_LIBRARY_SEEDS.map(
  ({ id, ...seed }) => {
    const category = resolveScreenDesignLibraryCategory(seed.categoryId);
    return {
      id,
      tier: seed.tier,
      width: seed.width,
      height: seed.height,
      renderKind: seed.renderKind,
      categoryId: seed.categoryId,
      accentColor: resolveScreenDesignAccentColor(seed.categoryId, seed.accentColor),
      category: seed.categoryId,
      categoryKey: category.labelKey,
      labelKey: seed.labelKey,
      preset: seed.preset ?? false,
    };
  },
);

/**
 * 라이브러리 카테고리 메타를 반환한다.
 *
 * @param categoryId 카테고리 식별자
 * @returns 매칭된 카테고리 메타
 */
export function resolveScreenDesignLibraryCategory(
  categoryId: string | null | undefined,
): ScreenDesignLibraryCategory {
  return (
    SCREEN_DESIGN_LIBRARY_CATEGORIES.find((category) => category.id === categoryId) ??
    SCREEN_DESIGN_LIBRARY_CATEGORIES[0]
  );
}

/**
 * 화면기획 shared document 기본 구조와 기본 마스터 세트를 보장한다.
 *
 * @param doc 대상 Y.Doc
 * @param origin bootstrap transaction origin
 */
export function ensureScreenDesignDocumentStructure(
  doc: Y.Doc,
  origin: unknown = 'screen-spec-bootstrap',
): void {
  const root = doc.getMap(ROOT_KEY);
  const existingScreens = root.get(SCREENS_KEY);
  if (
    typeof root.get(SCHEMA_VERSION_KEY) === 'number' &&
    Number(root.get(SCHEMA_VERSION_KEY)) >= SCHEMA_VERSION &&
    existingScreens instanceof Y.Map &&
    root.get(SCREEN_ORDER_KEY) instanceof Y.Array &&
    root.get(INSTANCES_KEY) instanceof Y.Map &&
    root.get(LAYERS_KEY) instanceof Y.Map &&
    root.get(MASTERS_KEY) instanceof Y.Map &&
    typeof root.get(LIBRARY_SEED_VERSION_KEY) === 'number'
  ) {
    const screenOrder = root.get(SCREEN_ORDER_KEY);
    if (screenOrder instanceof Y.Array) {
      doc.transact(() => {
        normalizeScreenOrderYArray(existingScreens, screenOrder);
      }, origin);
    }
    return;
  }

  doc.transact(() => {
    let shouldNormalizeScreenOrder = true;
    let createdInstancesMap = false;
    let createdMastersMap = false;
    const currentSchemaVersion =
      typeof root.get(SCHEMA_VERSION_KEY) === 'number' ? Number(root.get(SCHEMA_VERSION_KEY)) : 0;
    if (currentSchemaVersion < SCHEMA_VERSION) {
      root.set(SCHEMA_VERSION_KEY, SCHEMA_VERSION);
    }

    const legacyScreens = root.get(SCREENS_KEY);
    if (legacyScreens instanceof Y.Array) {
      const migratedScreens: Array<{
        height: number;
        name: string;
        screenId: string;
        width: number;
      }> = [];
      const migratedScreenIds = new Set<string>();
      const screensMap = new Y.Map<Y.Map<unknown>>();
      const screenOrder = new Y.Array<string>();
      legacyScreens.forEach((entry) => {
        if (!(entry instanceof Y.Map)) {
          return;
        }
        const screenId = readString(entry.get('id')) ?? `screen-${crypto.randomUUID().slice(0, 8)}`;
        if (migratedScreenIds.has(screenId)) {
          return;
        }
        migratedScreenIds.add(screenId);
        migratedScreens.push({
          screenId,
          name: readString(entry.get('name')) ?? screenId,
          width: readNumber(entry.get('width')) ?? resolveScreenDesignFramePreset('desktop').width,
          height:
            readNumber(entry.get('height')) ?? resolveScreenDesignFramePreset('desktop').height,
        });
      });
      root.set(SCREENS_KEY, screensMap);
      root.set(SCREEN_ORDER_KEY, screenOrder);
      shouldNormalizeScreenOrder = false;
      migratedScreens.forEach((screen) => {
        screensMap.set(
          screen.screenId,
          createScreenYMap(screen.screenId, {
            name: screen.name,
            width: screen.width,
            height: screen.height,
          }),
        );
        screenOrder.push([screen.screenId]);
      });
    } else if (!(legacyScreens instanceof Y.Map)) {
      root.set(SCREENS_KEY, new Y.Map<Y.Map<unknown>>());
    }

    if (!(root.get(SCREEN_ORDER_KEY) instanceof Y.Array)) {
      root.set(SCREEN_ORDER_KEY, new Y.Array<string>());
      shouldNormalizeScreenOrder = false;
    }
    if (!(root.get(INSTANCES_KEY) instanceof Y.Map)) {
      root.set(INSTANCES_KEY, new Y.Map<Y.Map<unknown>>());
      createdInstancesMap = true;
    }
    if (!(root.get(LAYERS_KEY) instanceof Y.Map)) {
      root.set(LAYERS_KEY, new Y.Map<Y.Array<string>>());
    }

    let mastersMap = root.get(MASTERS_KEY);
    if (!(mastersMap instanceof Y.Map)) {
      mastersMap = new Y.Map<Y.Map<unknown>>();
      root.set(MASTERS_KEY, mastersMap);
      createdMastersMap = true;
    }
    const resolvedMastersMap = mastersMap as Y.Map<Y.Map<unknown>>;
    const instancesMap = root.get(INSTANCES_KEY);
    const resolvedInstancesMap =
      instancesMap instanceof Y.Map ? (instancesMap as Y.Map<Y.Map<unknown>>) : null;

    const librarySeedVersion =
      typeof root.get(LIBRARY_SEED_VERSION_KEY) === 'number'
        ? Number(root.get(LIBRARY_SEED_VERSION_KEY))
        : 0;
    if (librarySeedVersion < LIBRARY_SEED_VERSION) {
      seedBuiltInMasters(resolvedMastersMap);
      root.set(LIBRARY_SEED_VERSION_KEY, LIBRARY_SEED_VERSION);
    }

    if (
      currentSchemaVersion < SCHEMA_VERSION &&
      resolvedInstancesMap &&
      !createdInstancesMap &&
      !createdMastersMap
    ) {
      migrateInstancesForMasterOverrides(resolvedInstancesMap, resolvedMastersMap);
    }

    const screenOrder = root.get(SCREEN_ORDER_KEY);
    const screensMap = root.get(SCREENS_KEY);
    if (
      shouldNormalizeScreenOrder &&
      screenOrder instanceof Y.Array &&
      screensMap instanceof Y.Map
    ) {
      normalizeScreenOrderYArray(screensMap, screenOrder);
    }
  }, origin);
}

interface PersistedScreenDesignSeed {
  screens: ScreenDesignScreen[];
  screenOrder: string[];
  masters: Array<{
    id: string;
    name?: string;
    labelKey?: string;
    categoryId: ScreenDesignLibraryCategoryId;
    tier: ScreenDesignMasterTier;
    width: number;
    height: number;
    renderKind: ScreenDesignMasterRenderKind;
    accentColor?: string | null;
    preset?: boolean;
  }>;
  instances: Array<
    ScreenDesignInstanceSeed & {
      legacyWidth?: number;
      legacyHeight?: number;
    }
  >;
  layersByScreenId: Record<string, string[]>;
}

/**
 * persisted screen-spec content fallback을 현재 Y.Doc 구조로 복원한다.
 *
 * @param doc 대상 Y.Doc
 * @param content persisted JSON content
 * @param origin bootstrap transaction origin
 */
export function applyScreenDesignContentToDoc(
  doc: Y.Doc,
  content: string | null | undefined,
  origin: unknown = 'screen-spec-bootstrap',
): void {
  const persistedSeed = parsePersistedScreenDesignContent(content);
  if (!persistedSeed) {
    ensureScreenDesignDocumentStructure(doc, origin);
    return;
  }

  doc.transact(() => {
    const root = doc.getMap(ROOT_KEY);
    const screensMap = new Y.Map<Y.Map<unknown>>();
    const screenOrder = new Y.Array<string>();
    const instancesMap = new Y.Map<Y.Map<unknown>>();
    const layersMap = new Y.Map<Y.Array<string>>();
    const mastersMap = new Y.Map<Y.Map<unknown>>();

    root.set(SCHEMA_VERSION_KEY, 0);
    root.set(LIBRARY_SEED_VERSION_KEY, 0);
    root.set(SCREENS_KEY, screensMap);
    root.set(SCREEN_ORDER_KEY, screenOrder);
    root.set(INSTANCES_KEY, instancesMap);
    root.set(LAYERS_KEY, layersMap);
    root.set(MASTERS_KEY, mastersMap);

    persistedSeed.screens.forEach((screen) => {
      screensMap.set(
        screen.id,
        createScreenYMap(screen.id, {
          name: screen.name,
          width: screen.width,
          height: screen.height,
        }),
      );
      layersMap.set(screen.id, new Y.Array<string>());
    });

    if (persistedSeed.screenOrder.length > 0) {
      screenOrder.insert(0, persistedSeed.screenOrder);
    }

    persistedSeed.masters.forEach((master) => {
      mastersMap.set(
        master.id,
        createMasterYMap(master.id, {
          name: master.name,
          labelKey: master.labelKey,
          categoryId: master.categoryId,
          tier: master.tier,
          width: master.width,
          height: master.height,
          renderKind: master.renderKind,
          accentColor: master.accentColor,
          preset: master.preset,
        }),
      );
    });

    persistedSeed.instances.forEach((instance) => {
      const instanceYMap = createInstanceYMap({
        id: instance.id,
        screenId: instance.screenId,
        masterId: instance.masterId,
        x: instance.x,
        y: instance.y,
        overrides: instance.overrides,
        masterSnapshot: instance.masterSnapshot,
      });
      if (instance.legacyWidth !== undefined) {
        instanceYMap.set('width', instance.legacyWidth);
      }
      if (instance.legacyHeight !== undefined) {
        instanceYMap.set('height', instance.legacyHeight);
      }
      instancesMap.set(instance.id, instanceYMap);
    });

    Object.entries(persistedSeed.layersByScreenId).forEach(([screenId, instanceIds]) => {
      const layerYArray = layersMap.get(screenId);
      if (!(layerYArray instanceof Y.Array) || instanceIds.length === 0) {
        return;
      }
      layerYArray.insert(0, instanceIds);
    });
  }, origin);

  ensureScreenDesignDocumentStructure(doc, origin);
}

/**
 * Y.Doc에서 화면기획 스냅샷을 읽는다.
 *
 * @param doc 대상 Y.Doc
 * @param options 읽기 전 Y.Doc 구조 보정 여부
 * @returns 화면/인스턴스/라이브러리 스냅샷
 */
export function readScreenDesignDocument(
  doc: Y.Doc,
  options: ReadScreenDesignDocumentOptions = {},
): ScreenDesignDocumentSnapshot {
  if (options.ensureStructure !== false) {
    ensureScreenDesignDocumentStructure(doc);
  }

  const root = doc.getMap(ROOT_KEY);
  const screensMap = root.get(SCREENS_KEY);
  const screenOrder = root.get(SCREEN_ORDER_KEY);
  const instancesMap = root.get(INSTANCES_KEY);
  const layersMap = root.get(LAYERS_KEY);

  if (
    !(screensMap instanceof Y.Map) ||
    !(screenOrder instanceof Y.Array) ||
    !(instancesMap instanceof Y.Map) ||
    !(layersMap instanceof Y.Map)
  ) {
    return {
      ...EMPTY_SCREEN_DESIGN_DOCUMENT,
      libraryItems: FALLBACK_SCREEN_DESIGN_LIBRARY,
      mastersById: buildLibraryItemsById(FALLBACK_SCREEN_DESIGN_LIBRARY),
    };
  }

  const libraryItems = readLibraryItems(root);
  const mastersById = buildLibraryItemsById(libraryItems);
  const screens = readScreens(screensMap, screenOrder);
  const instancesByScreenId = readInstancesByScreenId(
    screens,
    instancesMap,
    layersMap,
    mastersById,
  );

  const masters = root.get(MASTERS_KEY);
  const mastersMap = masters instanceof Y.Map ? (masters as Y.Map<unknown>) : null;

  return {
    screens,
    instancesByScreenId,
    libraryItems,
    mastersById,
    mastersAvailable: mastersMap !== null && mastersMap.size > 0,
  };
}

/**
 * 화면 엔티티용 Y.Map을 생성한다.
 *
 * @param screenId 화면 식별자
 * @param screen 화면 데이터
 * @returns Y.Map 형태의 화면
 */
export function createScreenYMap(
  screenId: string,
  screen: Pick<ScreenDesignScreen, 'name' | 'width' | 'height'>,
): Y.Map<unknown> {
  const screenYMap = new Y.Map<unknown>();
  screenYMap.set('id', screenId);
  screenYMap.set('name', screen.name);
  screenYMap.set('width', screen.width);
  screenYMap.set('height', screen.height);
  return screenYMap;
}

/**
 * 인스턴스 엔티티용 Y.Map을 생성한다.
 *
 * @param instance 인스턴스 데이터
 * @returns Y.Map 형태의 인스턴스
 */
export function createInstanceYMap(instance: ScreenDesignInstanceSeed): Y.Map<unknown> {
  const instanceYMap = new Y.Map<unknown>();
  instanceYMap.set('id', instance.id);
  instanceYMap.set('screenId', instance.screenId);
  instanceYMap.set('masterId', instance.masterId);
  instanceYMap.set('x', instance.x);
  instanceYMap.set('y', instance.y);
  if (typeof instance.width === 'number' && Number.isFinite(instance.width)) {
    instanceYMap.set('width', Math.round(instance.width));
  }
  if (typeof instance.height === 'number' && Number.isFinite(instance.height)) {
    instanceYMap.set('height', Math.round(instance.height));
  }
  instanceYMap.set(INSTANCE_OVERRIDES_KEY, createInstanceOverridesYMap(instance.overrides));
  instanceYMap.set(
    INSTANCE_MASTER_SNAPSHOT_KEY,
    createInstanceMasterSnapshotYMap(instance.masterSnapshot ?? null),
  );
  return instanceYMap;
}

/**
 * instance override 상태를 Y.Map으로 변환한다.
 *
 * @param overrides 직렬화할 instance override 상태
 * @returns Y.Map 형태의 override 상태
 */
export function createInstanceOverridesYMap(
  overrides?: Partial<
    Pick<ScreenDesignInstance, 'label' | 'accentColor' | 'width' | 'height'>
  > | null,
): Y.Map<unknown> {
  const overridesYMap = new Y.Map<unknown>();
  if (!overrides) {
    return overridesYMap;
  }
  const label = readString(overrides.label);
  if (label) {
    overridesYMap.set('label', label);
  }
  const accentColor = normalizeScreenDesignColor(overrides.accentColor);
  if (accentColor) {
    overridesYMap.set('accentColor', accentColor);
  }
  const width = readPositiveNumber(overrides.width);
  if (width !== null) {
    overridesYMap.set('width', width);
  }
  const height = readPositiveNumber(overrides.height);
  if (height !== null) {
    overridesYMap.set('height', height);
  }
  return overridesYMap;
}

/**
 * 라이브러리 item에서 instance용 master snapshot을 만든다.
 *
 * @param item snapshot으로 복사할 라이브러리 item
 * @returns instance에 저장할 master snapshot
 */
export function createInstanceMasterSnapshot(
  item: ScreenDesignLibraryItem,
): ScreenDesignInstanceMasterSnapshot {
  return {
    label: item.label,
    labelKey: item.labelKey,
    categoryId: item.categoryId,
    tier: item.tier,
    width: item.width,
    height: item.height,
    renderKind: item.renderKind,
    accentColor: normalizeScreenDesignColor(item.accentColor),
    preset: item.preset,
  };
}

/**
 * instance master snapshot을 Y.Map으로 변환한다.
 *
 * @param snapshot 직렬화할 master snapshot
 * @returns Y.Map 형태의 master snapshot
 */
export function createInstanceMasterSnapshotYMap(
  snapshot: ScreenDesignInstanceMasterSnapshot | null | undefined,
): Y.Map<unknown> {
  const snapshotYMap = new Y.Map<unknown>();
  if (!snapshot) {
    return snapshotYMap;
  }
  if (snapshot.label) {
    snapshotYMap.set('label', snapshot.label);
  }
  if (snapshot.labelKey) {
    snapshotYMap.set('labelKey', snapshot.labelKey);
  }
  snapshotYMap.set('category', snapshot.categoryId);
  snapshotYMap.set('tier', snapshot.tier);
  snapshotYMap.set('width', snapshot.width);
  snapshotYMap.set('height', snapshot.height);
  snapshotYMap.set('renderKind', snapshot.renderKind);
  const accentColor = normalizeScreenDesignColor(snapshot.accentColor);
  if (accentColor) {
    snapshotYMap.set('accentColor', accentColor);
  }
  snapshotYMap.set('preset', Boolean(snapshot.preset));
  return snapshotYMap;
}

/**
 * 마스터 컴포넌트 엔티티용 Y.Map을 생성한다.
 *
 * @param masterId 마스터 식별자
 * @param definition 마스터 정의
 * @returns Y.Map 형태의 마스터
 */
export function createMasterYMap(
  masterId: string,
  definition: ScreenDesignMasterDefinition,
): Y.Map<unknown> {
  const masterYMap = new Y.Map<unknown>();
  masterYMap.set('id', masterId);
  if (definition.name) {
    masterYMap.set('name', definition.name);
  }
  if (definition.labelKey) {
    masterYMap.set('labelKey', definition.labelKey);
  }
  masterYMap.set('category', definition.categoryId);
  masterYMap.set('tier', definition.tier);
  masterYMap.set('width', Math.max(SCREEN_DESIGN_MIN_INSTANCE_WIDTH, Math.round(definition.width)));
  masterYMap.set(
    'height',
    Math.max(SCREEN_DESIGN_MIN_INSTANCE_HEIGHT, Math.round(definition.height)),
  );
  masterYMap.set('renderKind', definition.renderKind);
  const accentColor = resolveScreenDesignAccentColor(definition.categoryId, definition.accentColor);
  if (accentColor) {
    masterYMap.set('accentColor', accentColor);
  }
  masterYMap.set('preset', Boolean(definition.preset));
  masterYMap.set('elements', new Y.Array<Y.Map<unknown>>());
  masterYMap.set('props', new Y.Array<Y.Map<unknown>>());
  return masterYMap;
}

/**
 * 인스턴스 사각형을 화면 경계와 최소 크기에 맞게 보정한다.
 *
 * @param nextRect 다음 사각형
 * @param screen 대상 화면 크기
 * @returns 보정된 사각형
 */
export function clampInstanceRect(
  nextRect: Pick<ScreenDesignInstance, 'x' | 'y' | 'width' | 'height'>,
  screen: Pick<ScreenDesignScreen, 'width' | 'height'>,
): Pick<ScreenDesignInstance, 'x' | 'y' | 'width' | 'height'> {
  const width = clamp(
    Math.round(nextRect.width),
    SCREEN_DESIGN_MIN_INSTANCE_WIDTH,
    Math.max(SCREEN_DESIGN_MIN_INSTANCE_WIDTH, screen.width - SCREEN_DESIGN_DOCUMENT_PADDING * 2),
  );
  const height = clamp(
    Math.round(nextRect.height),
    SCREEN_DESIGN_MIN_INSTANCE_HEIGHT,
    Math.max(SCREEN_DESIGN_MIN_INSTANCE_HEIGHT, screen.height - SCREEN_DESIGN_DOCUMENT_PADDING * 2),
  );
  const maxX = Math.max(
    SCREEN_DESIGN_DOCUMENT_PADDING,
    screen.width - width - SCREEN_DESIGN_DOCUMENT_PADDING,
  );
  const maxY = Math.max(
    SCREEN_DESIGN_DOCUMENT_PADDING,
    screen.height - height - SCREEN_DESIGN_DOCUMENT_PADDING,
  );
  return {
    x: clamp(Math.round(nextRect.x), SCREEN_DESIGN_DOCUMENT_PADDING, maxX),
    y: clamp(Math.round(nextRect.y), SCREEN_DESIGN_DOCUMENT_PADDING, maxY),
    width,
    height,
  };
}

/**
 * 라이브러리 ID로 마스터 메타를 조회한다.
 *
 * @param libraryItems 현재 라이브러리 스냅샷
 * @param masterId 마스터 식별자
 * @returns 일치하는 라이브러리 항목
 */
export function resolveLibraryItemById(
  libraryItems: ScreenDesignLibraryItem[],
  masterId: string,
): ScreenDesignLibraryItem | null {
  return (
    libraryItems.find((candidate) => candidate.id === masterId) ??
    FALLBACK_SCREEN_DESIGN_LIBRARY.find((candidate) => candidate.id === masterId) ??
    null
  );
}

/**
 * 내장 마스터 preset을 masters map에 시드한다.
 *
 * @param mastersMap 시드 대상 masters map
 * @returns 없음
 */
function seedBuiltInMasters(mastersMap: Y.Map<Y.Map<unknown>>): void {
  for (const seed of BUILT_IN_LIBRARY_SEEDS) {
    if (mastersMap.has(seed.id)) {
      continue;
    }
    mastersMap.set(seed.id, createMasterYMap(seed.id, seed));
  }
}

/**
 * screens map과 screenOrder를 기준으로 ordered screen 목록을 읽는다.
 *
 * @param screensMap screen 엔티티 map
 * @param screenOrder screen 정렬 순서 배열
 * @returns ordered screen 목록
 */
function readScreens(
  screensMap: Y.Map<Y.Map<unknown>>,
  screenOrder: Y.Array<string>,
): ScreenDesignScreen[] {
  const orderedIds = screenOrder
    .toArray()
    .filter((screenId): screenId is string => typeof screenId === 'string' && screenId.length > 0);
  const seen = new Set<string>();
  const screens: ScreenDesignScreen[] = [];

  for (const screenId of orderedIds) {
    if (seen.has(screenId)) {
      continue;
    }
    const screen = readScreen(screenId, screensMap.get(screenId));
    if (!screen) {
      continue;
    }
    seen.add(screenId);
    screens.push(screen);
  }

  screensMap.forEach((screenYMap, screenId) => {
    if (seen.has(screenId)) {
      return;
    }
    const screen = readScreen(screenId, screenYMap);
    if (screen) {
      screens.push(screen);
    }
  });

  return screens;
}

/**
 * screenOrder 배열을 중복/유령 항목 없이 정규화한다.
 *
 * @param screensMap 실제 screen 엔티티 map
 * @param screenOrder 정규화할 screen order 배열
 * @returns 없음
 */
function normalizeScreenOrderYArray(
  screensMap: Y.Map<Y.Map<unknown>>,
  screenOrder: Y.Array<string>,
): void {
  const existingOrder = screenOrder
    .toArray()
    .filter((screenId): screenId is string => typeof screenId === 'string' && screenId.length > 0);
  const seen = new Set<string>();
  const normalizedOrder: string[] = [];

  for (const screenId of existingOrder) {
    if (seen.has(screenId) || !screensMap.has(screenId)) {
      continue;
    }
    seen.add(screenId);
    normalizedOrder.push(screenId);
  }

  screensMap.forEach((_screen, screenId) => {
    if (seen.has(screenId)) {
      return;
    }
    seen.add(screenId);
    normalizedOrder.push(screenId);
  });

  if (
    normalizedOrder.length === existingOrder.length &&
    normalizedOrder.every((screenId, index) => screenId === existingOrder[index])
  ) {
    return;
  }

  screenOrder.delete(0, screenOrder.length);
  if (normalizedOrder.length > 0) {
    screenOrder.insert(0, normalizedOrder);
  }
}

/**
 * 단일 screen Y.Map을 plain screen 객체로 읽는다.
 *
 * @param screenId 읽을 screen id
 * @param screenYMap 원본 screen Y.Map
 * @returns 유효한 screen 객체 또는 null
 */
function readScreen(
  screenId: string,
  screenYMap: Y.Map<unknown> | undefined,
): ScreenDesignScreen | null {
  if (!(screenYMap instanceof Y.Map)) {
    return null;
  }
  const fallbackPreset = resolveScreenDesignFramePreset(DEFAULT_SCREEN_DESIGN_FRAME_PRESET_ID);
  return {
    id: screenId,
    name: readString(screenYMap.get('name')) ?? screenId,
    width: readNumber(screenYMap.get('width')) ?? fallbackPreset.width,
    height: readNumber(screenYMap.get('height')) ?? fallbackPreset.height,
  };
}

/**
 * 화면별 instance 목록을 layer 순서를 반영해 읽는다.
 *
 * @param screens 문서에 포함된 screen 목록
 * @param instancesMap instance 엔티티 map
 * @param layersMap screen별 layer 순서 map
 * @param mastersById master lookup
 * @returns screen id별 ordered instance 목록
 */
function readInstancesByScreenId(
  screens: ScreenDesignScreen[],
  instancesMap: Y.Map<Y.Map<unknown>>,
  layersMap: Y.Map<Y.Array<string>>,
  mastersById: Record<string, ScreenDesignLibraryItem>,
): Record<string, ScreenDesignInstance[]> {
  const instancesByScreenId: Record<string, ScreenDesignInstance[]> = {};
  const orphanBuckets = new Map<string, ScreenDesignInstance[]>();

  instancesMap.forEach((instanceYMap, instanceId) => {
    const instance = readInstance(instanceId, instanceYMap, mastersById);
    if (!instance) {
      return;
    }
    const currentBucket = orphanBuckets.get(instance.screenId) ?? [];
    currentBucket.push(instance);
    orphanBuckets.set(instance.screenId, currentBucket);
  });

  for (const screen of screens) {
    const orderedInstances: ScreenDesignInstance[] = [];
    const seen = new Set<string>();
    const layerIds = layersMap.get(screen.id);

    if (layerIds instanceof Y.Array) {
      layerIds.forEach((instanceId) => {
        if (typeof instanceId !== 'string' || seen.has(instanceId)) {
          return;
        }
        const instance = orphanBuckets
          .get(screen.id)
          ?.find((candidate) => candidate.id === instanceId);
        if (!instance) {
          return;
        }
        seen.add(instanceId);
        orderedInstances.push(instance);
      });
    }

    const remaining = orphanBuckets.get(screen.id) ?? [];
    remaining.forEach((instance) => {
      if (!seen.has(instance.id)) {
        orderedInstances.push(instance);
      }
    });

    instancesByScreenId[screen.id] = orderedInstances;
  }

  return instancesByScreenId;
}

/**
 * 단일 instance Y.Map을 plain instance 객체로 읽는다.
 *
 * @param instanceId 읽을 instance id
 * @param instanceYMap 원본 instance Y.Map
 * @param mastersById master lookup
 * @returns 유효한 instance 객체 또는 null
 */
function readInstance(
  instanceId: string,
  instanceYMap: Y.Map<unknown> | undefined,
  mastersById: Record<string, ScreenDesignLibraryItem>,
): ScreenDesignInstance | null {
  if (!(instanceYMap instanceof Y.Map)) {
    return null;
  }
  const screenId = readString(instanceYMap.get('screenId'));
  const masterId = readString(instanceYMap.get('masterId'));
  if (!screenId || !masterId) {
    return null;
  }
  const master =
    mastersById[masterId] ??
    readInstanceMasterSnapshot(instanceYMap.get(INSTANCE_MASTER_SNAPSHOT_KEY));
  const overrides = readInstanceOverrides(instanceYMap.get(INSTANCE_OVERRIDES_KEY));
  const masterWidth = master?.width ?? 240;
  const masterHeight = master?.height ?? 180;
  const width = readPositiveNumber(overrides.width) ?? masterWidth;
  const height = readPositiveNumber(overrides.height) ?? masterHeight;
  const masterLabel = master?.label ?? masterId;
  const masterLabelKey = master?.labelKey;
  const label = readString(overrides.label) ?? masterLabel;
  const accentColor =
    normalizeScreenDesignColor(overrides.accentColor) ??
    normalizeScreenDesignColor(master?.accentColor) ??
    null;
  return {
    id: instanceId,
    screenId,
    masterId,
    x: readNumber(instanceYMap.get('x')) ?? SCREEN_DESIGN_DOCUMENT_PADDING,
    y: readNumber(instanceYMap.get('y')) ?? SCREEN_DESIGN_DOCUMENT_PADDING,
    width,
    height,
    label,
    labelKey: overrides.label ? undefined : masterLabelKey,
    masterLabel,
    masterLabelKey,
    renderKind: master?.renderKind ?? 'generic',
    accentColor,
    masterAccentColor: normalizeScreenDesignColor(master?.accentColor) ?? null,
    isOrphan: !(masterId in mastersById),
    overrideState: {
      label: typeof overrides.label === 'string' && overrides.label.length > 0,
      accentColor: typeof overrides.accentColor === 'string' && overrides.accentColor.length > 0,
      width: typeof overrides.width === 'number',
      height: typeof overrides.height === 'number',
    },
    masterSnapshot: createInstanceMasterSnapshot(master ?? buildFallbackLibraryItem(masterId)),
  };
}

/**
 * root map에서 라이브러리 item 목록을 읽는다.
 *
 * @param root 화면기획 root Y.Map
 * @returns 정렬된 라이브러리 item 목록
 */
function readLibraryItems(root: Y.Map<unknown>): ScreenDesignLibraryItem[] {
  const masters = root.get(MASTERS_KEY);
  if (!(masters instanceof Y.Map)) {
    return FALLBACK_SCREEN_DESIGN_LIBRARY;
  }

  const items: ScreenDesignLibraryItem[] = [];
  masters.forEach((masterYMap, masterId) => {
    if (!(masterYMap instanceof Y.Map)) {
      return;
    }
    const fallback = BUILT_IN_LIBRARY_SEED_BY_ID.get(masterId)?.seed;
    const categoryId =
      readCategoryId(masterYMap.get('category')) ?? fallback?.categoryId ?? 'layout';
    const category = resolveScreenDesignLibraryCategory(categoryId);
    const name = readString(masterYMap.get('name'));
    items.push({
      id: masterId,
      tier: readTier(masterYMap.get('tier')),
      width: readNumber(masterYMap.get('width')) ?? fallback?.width ?? 280,
      height: readNumber(masterYMap.get('height')) ?? fallback?.height ?? 180,
      renderKind: readRenderKind(masterYMap.get('renderKind')) ?? fallback?.renderKind ?? 'generic',
      categoryId,
      accentColor: resolveScreenDesignAccentColor(
        categoryId,
        readString(masterYMap.get('accentColor')) ?? fallback?.accentColor,
      ),
      category: categoryId,
      categoryKey: category.labelKey,
      label: name ?? undefined,
      labelKey:
        name === null
          ? (readString(masterYMap.get('labelKey')) ?? fallback?.labelKey ?? undefined)
          : undefined,
      preset: readBoolean(masterYMap.get('preset')) ?? fallback?.preset ?? false,
    });
  });

  return items.sort(compareLibraryItems);
}

/**
 * 라이브러리 item 배열을 id lookup으로 변환한다.
 *
 * @param libraryItems lookup으로 만들 라이브러리 item 목록
 * @returns id 기준 라이브러리 item lookup
 */
function buildLibraryItemsById(
  libraryItems: ScreenDesignLibraryItem[],
): Record<string, ScreenDesignLibraryItem> {
  return Object.fromEntries(libraryItems.map((item) => [item.id, item]));
}

/**
 * master를 찾지 못했을 때 사용할 fallback 라이브러리 item을 만든다.
 *
 * @param masterId fallback 대상 master id
 * @returns fallback 라이브러리 item
 */
function buildFallbackLibraryItem(masterId: string): ScreenDesignLibraryItem {
  return (
    FALLBACK_SCREEN_DESIGN_LIBRARY.find((candidate) => candidate.id === masterId) ?? {
      id: masterId,
      tier: 'widget',
      width: 240,
      height: 180,
      renderKind: 'generic',
      categoryId: 'layout',
      accentColor: resolveScreenDesignAccentColor('layout'),
      category: 'layout',
      categoryKey: resolveScreenDesignLibraryCategory('layout').labelKey,
      label: masterId,
      preset: false,
    }
  );
}

/**
 * 레거시 instance width/height 필드를 override 구조로 마이그레이션한다.
 *
 * @param instancesMap 마이그레이션할 instances map
 * @param mastersMap 현재 masters map
 * @returns 없음
 */
function migrateInstancesForMasterOverrides(
  instancesMap: Y.Map<Y.Map<unknown>>,
  mastersMap: Y.Map<Y.Map<unknown>>,
): void {
  const masterLookup = readMastersLookup(mastersMap);
  instancesMap.forEach((instanceYMap) => {
    if (!(instanceYMap instanceof Y.Map)) {
      return;
    }
    const masterId = readString(instanceYMap.get('masterId'));
    const master = masterId ? (masterLookup[masterId] ?? null) : null;
    const legacyWidth = readPositiveNumber(instanceYMap.get('width'));
    const legacyHeight = readPositiveNumber(instanceYMap.get('height'));
    const overrides = ensureNestedMap(instanceYMap, INSTANCE_OVERRIDES_KEY);
    if (master && !(instanceYMap.get(INSTANCE_MASTER_SNAPSHOT_KEY) instanceof Y.Map)) {
      instanceYMap.set(
        INSTANCE_MASTER_SNAPSHOT_KEY,
        createInstanceMasterSnapshotYMap(createInstanceMasterSnapshot(master)),
      );
    }
    if (legacyWidth !== null && !overrides.has('width')) {
      if (!master || legacyWidth !== master.width) {
        overrides.set('width', legacyWidth);
      }
      instanceYMap.delete('width');
    }
    if (legacyHeight !== null && !overrides.has('height')) {
      if (!master || legacyHeight !== master.height) {
        overrides.set('height', legacyHeight);
      }
      instanceYMap.delete('height');
    }
  });
}

/**
 * masters map에서 plain master lookup을 만든다.
 *
 * @param mastersMap 변환할 masters map
 * @returns master id 기준 lookup
 */
function readMastersLookup(
  mastersMap: Y.Map<Y.Map<unknown>>,
): Record<string, ScreenDesignLibraryItem> {
  const root = new Y.Map<unknown>();
  root.set(MASTERS_KEY, mastersMap);
  return buildLibraryItemsById(readLibraryItems(root));
}

/**
 * instance overrides Y.Map을 plain override 객체로 읽는다.
 *
 * @param overridesValue 원본 overrides 값
 * @returns plain override 객체
 */
function readInstanceOverrides(
  overridesValue: unknown,
): Partial<Pick<ScreenDesignInstance, 'label' | 'accentColor' | 'width' | 'height'>> {
  const overridesYMap = overridesValue instanceof Y.Map ? overridesValue : new Y.Map<unknown>();
  return {
    label: readString(overridesYMap.get('label')) ?? undefined,
    accentColor: normalizeScreenDesignColor(overridesYMap.get('accentColor')) ?? undefined,
    width: readPositiveNumber(overridesYMap.get('width')) ?? undefined,
    height: readPositiveNumber(overridesYMap.get('height')) ?? undefined,
  };
}

/**
 * 저장된 master snapshot Y.Map을 라이브러리 item 형태로 읽는다.
 *
 * @param value 원본 snapshot 값
 * @returns snapshot을 반영한 라이브러리 item 또는 null
 */
function readInstanceMasterSnapshot(value: unknown): ScreenDesignLibraryItem | null {
  if (!(value instanceof Y.Map)) {
    return null;
  }
  const categoryId = readCategoryId(value.get('category')) ?? 'layout';
  const category = resolveScreenDesignLibraryCategory(categoryId);
  const label = readString(value.get('label'));
  const labelKey = readString(value.get('labelKey'));
  return {
    id: 'orphaned-master',
    tier: readTier(value.get('tier')),
    width: readPositiveNumber(value.get('width')) ?? 240,
    height: readPositiveNumber(value.get('height')) ?? 180,
    renderKind: readRenderKind(value.get('renderKind')) ?? 'generic',
    categoryId,
    accentColor: resolveScreenDesignAccentColor(categoryId, readString(value.get('accentColor'))),
    category: categoryId,
    categoryKey: category.labelKey,
    label: label ?? undefined,
    labelKey: label === null ? (labelKey ?? undefined) : undefined,
    preset: readBoolean(value.get('preset')) ?? false,
  };
}

/**
 * 라이브러리 item 정렬 순서를 비교한다.
 *
 * @param left 좌측 라이브러리 item
 * @param right 우측 라이브러리 item
 * @returns 정렬 비교 결과
 */
function compareLibraryItems(
  left: ScreenDesignLibraryItem,
  right: ScreenDesignLibraryItem,
): number {
  const leftCategory = resolveScreenDesignLibraryCategory(left.categoryId);
  const rightCategory = resolveScreenDesignLibraryCategory(right.categoryId);
  if (leftCategory.order !== rightCategory.order) {
    return leftCategory.order - rightCategory.order;
  }

  const leftPresetIndex =
    BUILT_IN_LIBRARY_SEED_BY_ID.get(left.id)?.index ?? Number.POSITIVE_INFINITY;
  const rightPresetIndex =
    BUILT_IN_LIBRARY_SEED_BY_ID.get(right.id)?.index ?? Number.POSITIVE_INFINITY;
  if (leftPresetIndex !== rightPresetIndex) {
    return leftPresetIndex - rightPresetIndex;
  }

  if (left.tier !== right.tier) {
    return left.tier === 'block' ? -1 : 1;
  }

  return resolveLibraryItemSortLabel(left).localeCompare(resolveLibraryItemSortLabel(right));
}

/**
 * 라이브러리 item 정렬용 라벨을 해상한다.
 *
 * @param item 정렬 라벨을 구할 라이브러리 item
 * @returns 정렬 기준 문자열
 */
function resolveLibraryItemSortLabel(item: ScreenDesignLibraryItem): string {
  return item.label?.toLocaleLowerCase() ?? item.labelKey ?? item.id;
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
 * 저장값에서 master tier를 읽는다.
 *
 * @param value 해석할 저장값
 * @returns 해석된 master tier
 */
function readTier(value: unknown): ScreenDesignMasterTier {
  return value === 'block' ? 'block' : 'widget';
}

/**
 * 저장값에서 라이브러리 category id를 읽는다.
 *
 * @param value 해석할 저장값
 * @returns 유효한 category id 또는 null
 */
function readCategoryId(value: unknown): ScreenDesignLibraryCategoryId | null {
  return BUILT_IN_LIBRARY_CATEGORY_IDS.includes(value as ScreenDesignLibraryCategoryId)
    ? (value as ScreenDesignLibraryCategoryId)
    : null;
}

/**
 * 저장값에서 master render kind를 읽는다.
 *
 * @param value 해석할 저장값
 * @returns 유효한 render kind 또는 null
 */
function readRenderKind(value: unknown): ScreenDesignMasterRenderKind | null {
  return BUILT_IN_RENDER_KINDS.includes(value as ScreenDesignMasterRenderKind)
    ? (value as ScreenDesignMasterRenderKind)
    : null;
}

/**
 * unknown 값이 JSON object 형태인지 판별한다.
 *
 * @param value 판별할 값
 * @returns plain record이면 true
 */
function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * legacy content JSON에서 화면기획 seed를 복원한다.
 *
 * @param content 저장된 content 문자열
 * @returns 복원 가능한 화면기획 seed 또는 null
 */
function parsePersistedScreenDesignContent(
  content: string | null | undefined,
): PersistedScreenDesignSeed | null {
  if (typeof content !== 'string' || content.trim().length === 0) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  if (!isJsonRecord(parsed)) {
    return null;
  }

  const candidate = isJsonRecord(parsed.screenSpec) ? parsed.screenSpec : parsed;
  if (
    ![
      'screens',
      'screenOrder',
      'instancesByScreenId',
      'instances',
      'layers',
      'libraryItems',
      'mastersById',
      'masters',
    ].some((key) => key in candidate)
  ) {
    return null;
  }

  const screenMap = new Map<string, ScreenDesignScreen>();
  readPersistedScreens(candidate.screens).forEach((screen) => {
    screenMap.set(screen.id, screen);
  });

  const explicitScreenOrder = normalizeStringArray(candidate.screenOrder);
  const masters = readPersistedMasters(candidate);
  const bucketInstances = readPersistedInstanceBuckets(candidate.instancesByScreenId);
  const collectionInstances = readPersistedInstanceCollection(candidate.instances);
  const instancesById = new Map<string, PersistedScreenDesignSeed['instances'][number]>();

  [...bucketInstances.instances, ...collectionInstances.instances].forEach((instance) => {
    if (!instancesById.has(instance.id)) {
      instancesById.set(instance.id, instance);
    }
  });

  const explicitLayers = readPersistedLayers(candidate.layers);
  const mergedLayerIds = new Set<string>([
    ...Object.keys(explicitLayers),
    ...Object.keys(bucketInstances.layersByScreenId),
    ...Object.keys(collectionInstances.layersByScreenId),
  ]);
  const fallbackPreset = resolveScreenDesignFramePreset(DEFAULT_SCREEN_DESIGN_FRAME_PRESET_ID);

  mergedLayerIds.forEach((screenId) => {
    if (!screenMap.has(screenId)) {
      screenMap.set(screenId, {
        id: screenId,
        name: screenId,
        width: fallbackPreset.width,
        height: fallbackPreset.height,
      });
    }
  });

  instancesById.forEach((instance) => {
    if (!screenMap.has(instance.screenId)) {
      screenMap.set(instance.screenId, {
        id: instance.screenId,
        name: instance.screenId,
        width: fallbackPreset.width,
        height: fallbackPreset.height,
      });
    }
  });

  const screenIds = dedupeOrderedStrings([
    ...explicitScreenOrder,
    ...Array.from(screenMap.keys()),
    ...mergedLayerIds,
  ]);
  const layersByScreenId = Object.fromEntries(
    screenIds.map((screenId) => [
      screenId,
      mergeExplicitAndDerivedIds(
        explicitLayers[screenId] ?? [],
        bucketInstances.layersByScreenId[screenId] ?? [],
        collectionInstances.layersByScreenId[screenId] ?? [],
      ),
    ]),
  );

  return {
    screens: screenIds
      .map((screenId) => screenMap.get(screenId))
      .filter((screen): screen is ScreenDesignScreen => screen !== undefined),
    screenOrder: screenIds,
    masters,
    instances: Array.from(instancesById.values()),
    layersByScreenId,
  };
}

/**
 * persisted 화면 목록을 배열/맵 양쪽 포맷에서 읽는다.
 *
 * @param value persisted screens 값
 * @returns 복원된 화면 목록
 */
function readPersistedScreens(value: unknown): ScreenDesignScreen[] {
  if (Array.isArray(value)) {
    return value
      .map((entry, index) =>
        isJsonRecord(entry) ? readPersistedScreen(entry, `screen-${index + 1}`) : null,
      )
      .filter((screen): screen is ScreenDesignScreen => screen !== null);
  }
  if (isJsonRecord(value)) {
    return Object.entries(value)
      .map(([screenId, entry]) =>
        isJsonRecord(entry) ? readPersistedScreen(entry, screenId) : null,
      )
      .filter((screen): screen is ScreenDesignScreen => screen !== null);
  }
  return [];
}

/**
 * persisted 화면 엔트리 하나를 읽는다.
 *
 * @param value 화면 저장 record
 * @param fallbackId id 누락 시 사용할 식별자
 * @returns 복원된 화면 또는 null
 */
function readPersistedScreen(
  value: Record<string, unknown>,
  fallbackId: string,
): ScreenDesignScreen | null {
  const screenId = readString(value.id) ?? fallbackId;
  if (!screenId) {
    return null;
  }
  const fallbackPreset = resolveScreenDesignFramePreset(DEFAULT_SCREEN_DESIGN_FRAME_PRESET_ID);
  return {
    id: screenId,
    name: readString(value.name) ?? screenId,
    width: readPositiveNumber(value.width) ?? fallbackPreset.width,
    height: readPositiveNumber(value.height) ?? fallbackPreset.height,
  };
}

/**
 * persisted master 후보들을 여러 legacy source에서 병합해 읽는다.
 *
 * @param candidate 화면기획 persisted root 후보
 * @returns 복원된 master seed 목록
 */
function readPersistedMasters(
  candidate: Record<string, unknown>,
): PersistedScreenDesignSeed['masters'] {
  const masterMap = new Map<string, PersistedScreenDesignSeed['masters'][number]>();
  const sources = [candidate.libraryItems, candidate.mastersById, candidate.masters];

  sources.forEach((source) => {
    if (Array.isArray(source)) {
      source.forEach((entry, index) => {
        if (!isJsonRecord(entry)) {
          return;
        }
        const master = readPersistedMaster(entry, `master-${index + 1}`);
        if (master) {
          masterMap.set(master.id, master);
        }
      });
      return;
    }
    if (!isJsonRecord(source)) {
      return;
    }
    Object.entries(source).forEach(([masterId, entry]) => {
      if (!isJsonRecord(entry)) {
        return;
      }
      const master = readPersistedMaster(entry, masterId);
      if (master) {
        masterMap.set(master.id, master);
      }
    });
  });

  return Array.from(masterMap.values());
}

/**
 * persisted master 엔트리 하나를 읽는다.
 *
 * @param value master 저장 record
 * @param fallbackId id 누락 시 사용할 식별자
 * @returns 복원된 master seed 또는 null
 */
function readPersistedMaster(
  value: Record<string, unknown>,
  fallbackId: string,
): PersistedScreenDesignSeed['masters'][number] | null {
  const masterId = readString(value.id) ?? fallbackId;
  if (!masterId) {
    return null;
  }
  const categoryId = readCategoryId(value.categoryId ?? value.category) ?? 'layout';
  const label = readString(value.label) ?? readString(value.name);
  return {
    id: masterId,
    name: label ?? undefined,
    labelKey: label ? undefined : (readString(value.labelKey) ?? undefined),
    categoryId,
    tier: readTier(value.tier),
    width: readPositiveNumber(value.width) ?? 280,
    height: readPositiveNumber(value.height) ?? 180,
    renderKind: readRenderKind(value.renderKind) ?? 'generic',
    accentColor: normalizeScreenDesignColor(value.accentColor),
    preset: readBoolean(value.preset) ?? false,
  };
}

/**
 * screenId별 bucket 구조의 persisted instance를 읽는다.
 *
 * @param value instancesByScreenId 저장값
 * @returns instance seed와 화면별 layer 순서
 */
function readPersistedInstanceBuckets(value: unknown): {
  instances: PersistedScreenDesignSeed['instances'];
  layersByScreenId: Record<string, string[]>;
} {
  if (!isJsonRecord(value)) {
    return {
      instances: [],
      layersByScreenId: {},
    };
  }

  const instances: PersistedScreenDesignSeed['instances'] = [];
  const layersByScreenId: Record<string, string[]> = {};

  Object.entries(value).forEach(([screenId, bucket]) => {
    if (!Array.isArray(bucket)) {
      return;
    }
    const layerIds: string[] = [];
    bucket.forEach((entry) => {
      if (!isJsonRecord(entry)) {
        return;
      }
      const instance = readPersistedInstance(entry, screenId);
      if (!instance) {
        return;
      }
      instances.push(instance);
      layerIds.push(instance.id);
    });
    layersByScreenId[screenId] = dedupeOrderedStrings(layerIds);
  });

  return {
    instances,
    layersByScreenId,
  };
}

/**
 * flat collection 구조의 persisted instance를 읽는다.
 *
 * @param value instances 저장값
 * @returns instance seed와 화면별 layer 순서
 */
function readPersistedInstanceCollection(value: unknown): {
  instances: PersistedScreenDesignSeed['instances'];
  layersByScreenId: Record<string, string[]>;
} {
  const instances: PersistedScreenDesignSeed['instances'] = [];
  const layersByScreenId: Record<string, string[]> = {};

  /**
   * instance record를 seed 목록과 layer bucket에 추가한다.
   *
   * @param entry instance 저장 record
   * @param fallbackId id 누락 시 사용할 식별자
   * @returns 없음
   */
  const pushInstance = (entry: Record<string, unknown>, fallbackId: string) => {
    const instance = readPersistedInstance(entry, null, fallbackId);
    if (!instance) {
      return;
    }
    instances.push(instance);
    const currentIds = layersByScreenId[instance.screenId] ?? [];
    currentIds.push(instance.id);
    layersByScreenId[instance.screenId] = currentIds;
  };

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      if (isJsonRecord(entry)) {
        pushInstance(entry, `instance-${index + 1}`);
      }
    });
    return {
      instances,
      layersByScreenId: Object.fromEntries(
        Object.entries(layersByScreenId).map(([screenId, instanceIds]) => [
          screenId,
          dedupeOrderedStrings(instanceIds),
        ]),
      ),
    };
  }

  if (isJsonRecord(value)) {
    Object.entries(value).forEach(([instanceId, entry]) => {
      if (isJsonRecord(entry)) {
        pushInstance(entry, instanceId);
      }
    });
  }

  return {
    instances,
    layersByScreenId: Object.fromEntries(
      Object.entries(layersByScreenId).map(([screenId, instanceIds]) => [
        screenId,
        dedupeOrderedStrings(instanceIds),
      ]),
    ),
  };
}

/**
 * persisted instance 엔트리 하나를 읽는다.
 *
 * @param value instance 저장 record
 * @param fallbackScreenId screenId 누락 시 사용할 화면 식별자
 * @param fallbackId id 누락 시 사용할 식별자
 * @returns 복원된 instance seed 또는 null
 */
function readPersistedInstance(
  value: Record<string, unknown>,
  fallbackScreenId: string | null,
  fallbackId = 'instance-restored',
): PersistedScreenDesignSeed['instances'][number] | null {
  const instanceId = readString(value.id) ?? fallbackId;
  const screenId = readString(value.screenId) ?? fallbackScreenId;
  const masterId = readString(value.masterId);
  if (!instanceId || !screenId || !masterId) {
    return null;
  }

  const overrideSource = isJsonRecord(value.overrides) ? value.overrides : null;
  const overrideState = isJsonRecord(value.overrideState) ? value.overrideState : null;
  const hasOverrideMetadata = overrideSource !== null || overrideState !== null;
  const labelOverride =
    readString(overrideSource?.label) ??
    (overrideState?.label === true ? (readString(value.label) ?? undefined) : undefined);
  const accentOverride =
    normalizeScreenDesignColor(overrideSource?.accentColor) ??
    (overrideState?.accentColor === true
      ? (normalizeScreenDesignColor(value.accentColor) ?? undefined)
      : undefined);
  const widthOverride =
    readPositiveNumber(overrideSource?.width) ??
    (overrideState?.width === true ? (readPositiveNumber(value.width) ?? undefined) : undefined);
  const heightOverride =
    readPositiveNumber(overrideSource?.height) ??
    (overrideState?.height === true ? (readPositiveNumber(value.height) ?? undefined) : undefined);
  const overrides = {
    ...(labelOverride ? { label: labelOverride } : {}),
    ...(accentOverride ? { accentColor: accentOverride } : {}),
    ...(typeof widthOverride === 'number' ? { width: widthOverride } : {}),
    ...(typeof heightOverride === 'number' ? { height: heightOverride } : {}),
  };
  const legacyWidth =
    hasOverrideMetadata || widthOverride !== undefined
      ? undefined
      : readPositiveNumber(value.width);
  const legacyHeight =
    hasOverrideMetadata || heightOverride !== undefined
      ? undefined
      : readPositiveNumber(value.height);

  return {
    id: instanceId,
    screenId,
    masterId,
    x: readNumber(value.x) ?? SCREEN_DESIGN_DOCUMENT_PADDING,
    y: readNumber(value.y) ?? SCREEN_DESIGN_DOCUMENT_PADDING,
    overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    masterSnapshot: readPersistedInstanceMasterSnapshot(value.masterSnapshot),
    legacyWidth: legacyWidth ?? undefined,
    legacyHeight: legacyHeight ?? undefined,
  };
}

/**
 * persisted instance master snapshot을 읽는다.
 *
 * @param value master snapshot 저장값
 * @returns 복원된 master snapshot 또는 null
 */
function readPersistedInstanceMasterSnapshot(
  value: unknown,
): ScreenDesignInstanceMasterSnapshot | null {
  if (!isJsonRecord(value)) {
    return null;
  }
  const categoryId = readCategoryId(value.categoryId ?? value.category) ?? 'layout';
  return {
    label: readString(value.label) ?? undefined,
    labelKey: readString(value.labelKey) ?? undefined,
    categoryId,
    tier: readTier(value.tier),
    width: readPositiveNumber(value.width) ?? 240,
    height: readPositiveNumber(value.height) ?? 180,
    renderKind: readRenderKind(value.renderKind) ?? 'generic',
    accentColor: normalizeScreenDesignColor(value.accentColor),
    preset: readBoolean(value.preset) ?? false,
  };
}

/**
 * persisted layer 순서를 배열/맵 양쪽 포맷에서 읽는다.
 *
 * @param value persisted layers 값
 * @returns 화면별 instance id 순서
 */
function readPersistedLayers(value: unknown): Record<string, string[]> {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value.flatMap((entry) => {
        if (!isJsonRecord(entry)) {
          return [];
        }
        const screenId = readString(entry.screenId) ?? readString(entry.id);
        if (!screenId) {
          return [];
        }
        return [[screenId, normalizeStringArray(entry.instanceIds)]];
      }),
    );
  }
  if (isJsonRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([screenId, instanceIds]) => [
        screenId,
        normalizeStringArray(instanceIds),
      ]),
    );
  }
  return {};
}

/**
 * 문자열 배열 저장값을 중복 없는 문자열 배열로 정규화한다.
 *
 * @param value 정규화할 값
 * @returns 정규화된 문자열 배열
 */
function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return dedupeOrderedStrings(
    value.map((entry) => readString(entry)).filter((entry): entry is string => entry !== null),
  );
}

/**
 * 문자열 목록의 최초 등장 순서를 유지하며 중복을 제거한다.
 *
 * @param values 중복 제거할 문자열 목록
 * @returns 중복 제거된 문자열 목록
 */
function dedupeOrderedStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  values.forEach((value) => {
    if (seen.has(value)) {
      return;
    }
    seen.add(value);
    ordered.push(value);
  });
  return ordered;
}

/**
 * 명시된 id와 파생 id 목록을 하나의 ordered set으로 합친다.
 *
 * @param sources 병합할 id 목록들
 * @returns 중복 제거된 id 목록
 */
function mergeExplicitAndDerivedIds(...sources: string[][]): string[] {
  return dedupeOrderedStrings(sources.flat());
}

/**
 * 화면기획 accent color 값을 canonical hex 형식으로 정규화한다.
 *
 * @param value 정규화할 색상 값
 * @returns 유효한 hex 색상 또는 null
 */
export function normalizeScreenDesignColor(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : null;
}

/**
 * category별 기본 accent color를 CSS variable 토큰에서 해석하여 hex로 반환한다.
 *
 * @param categoryId 기준 라이브러리 category id
 * @param value 선택적 사용자 지정 색상 값
 * @returns 최종 accent color (`#rrggbb` 형태)
 */
function resolveScreenDesignAccentColor(
  categoryId: ScreenDesignLibraryCategoryId,
  value?: string | null,
): string {
  const normalized = normalizeScreenDesignColor(value);
  if (normalized) {
    return normalized;
  }
  const tokenName = SCREEN_SPEC_CATEGORY_TOKENS[categoryId] ?? SCREEN_SPEC_CATEGORY_TOKENS.default;
  if (
    typeof document !== 'undefined' &&
    typeof getComputedStyle === 'function' &&
    document.documentElement
  ) {
    const styles = getComputedStyle(document.documentElement);
    const hsl = styles.getPropertyValue(tokenName).trim();
    if (hsl) {
      return convertCssColorToHex(`hsl(${hsl})`);
    }
    const fallbackHsl =
      styles.getPropertyValue(SCREEN_SPEC_CATEGORY_TOKENS.default).trim() ||
      SCREEN_SPEC_CATEGORY_FALLBACK_HSL.default;
    return convertCssColorToHex(`hsl(${fallbackHsl})`);
  }

  return SCREEN_SPEC_CATEGORY_FALLBACK_HEX[categoryId];
}

/**
 * 숫자 값을 최소/최대 범위로 제한한다.
 *
 * @param value 제한할 값
 * @param min 최소값
 * @param max 최대값
 * @returns 제한된 값
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
