import * as Y from 'yjs';
import {
  SCREEN_SPEC_MASTER_BLOCK_DEFAULT_HEIGHT,
  SCREEN_SPEC_MASTER_BLOCK_DEFAULT_WIDTH,
  SCREEN_SPEC_MASTER_ELEMENT_DEFAULT_HEIGHT,
  SCREEN_SPEC_MASTER_ELEMENT_DEFAULT_WIDTH,
} from '@/constants/screen-design';
import type {
  ScreenDesignLibraryCategoryId,
  ScreenDesignMasterDefinition,
  ScreenDesignMasterTier,
  ScreenDesignScreen,
} from '@/pages/screendesign/screen-design-document';

export interface ReadScreenFromYMapOptions {
  fallbackWidth?: number;
  fallbackHeight?: number;
}

/**
 * Y.Array에서 특정 문자열 항목을 한 번 제거한다.
 *
 * @param yArray 수정할 Y.Array
 * @param value 제거할 문자열 값
 * @returns 없음
 */
export function removeStringFromArray(yArray: Y.Array<string>, value: string): void {
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
export function ensureNestedMap(parent: Y.Map<unknown>, key: string): Y.Map<unknown> {
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
 * @param options width/height fallback 옵션
 * @returns 유효한 screen 객체 또는 null
 */
export function readScreenFromYMap(
  screenId: string,
  screenYMap: Y.Map<unknown> | undefined,
  options?: ReadScreenFromYMapOptions,
): ScreenDesignScreen | null {
  if (!(screenYMap instanceof Y.Map)) {
    return null;
  }

  const name =
    typeof screenYMap.get('name') === 'string' ? String(screenYMap.get('name')) : screenId;
  const width =
    typeof screenYMap.get('width') === 'number'
      ? Number(screenYMap.get('width'))
      : typeof options?.fallbackWidth === 'number'
        ? options.fallbackWidth
        : null;
  const height =
    typeof screenYMap.get('height') === 'number'
      ? Number(screenYMap.get('height'))
      : typeof options?.fallbackHeight === 'number'
        ? options.fallbackHeight
        : null;

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
 * 새 custom master에 사용할 기본 draft를 만든다.
 *
 * @param name master 이름
 * @param categoryId master 카테고리
 * @param tier master tier
 * @returns 기본 master draft
 */
export function createMasterDraft(
  name: string,
  categoryId: ScreenDesignLibraryCategoryId,
  tier: ScreenDesignMasterTier,
): ScreenDesignMasterDefinition {
  return {
    name,
    categoryId,
    tier,
    width:
      tier === 'block'
        ? SCREEN_SPEC_MASTER_BLOCK_DEFAULT_WIDTH
        : SCREEN_SPEC_MASTER_ELEMENT_DEFAULT_WIDTH,
    height:
      tier === 'block'
        ? SCREEN_SPEC_MASTER_BLOCK_DEFAULT_HEIGHT
        : SCREEN_SPEC_MASTER_ELEMENT_DEFAULT_HEIGHT,
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
export function sanitizeMasterDimension(value: number): number {
  return Math.max(48, Math.round(value));
}

/**
 * master snapshot에서 표시 라벨을 해상한다.
 *
 * @param masterSnapshot 표시 라벨을 읽을 master snapshot
 * @param fallbackMasterId fallback master id
 * @returns 표시용 master 라벨
 */
export function resolveMasterLabel(
  masterSnapshot: { label?: string },
  fallbackMasterId: string,
): string {
  return masterSnapshot.label ?? fallbackMasterId;
}
