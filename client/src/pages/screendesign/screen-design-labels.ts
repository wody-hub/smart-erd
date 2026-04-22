import type { TFunction } from 'i18next';
import {
  resolveScreenDesignLibraryCategory,
  type ScreenDesignInstance,
  type ScreenDesignLibraryItem,
} from './screen-design-document';

/**
 * 라이브러리 항목의 사용자 표시 라벨을 해석한다.
 *
 * @param t i18n 번역 함수
 * @param item 라벨을 계산할 라이브러리 항목
 * @param fallbackId item이 없을 때 사용할 fallback ID
 * @returns 번역 또는 저장된 라벨 문자열
 */
export function resolveScreenDesignLibraryItemLabel(
  t: TFunction,
  item: ScreenDesignLibraryItem | undefined,
  fallbackId?: string,
): string {
  if (!item) {
    return fallbackId ?? '';
  }
  return item.labelKey ? (t(item.labelKey as never) as string) : (item.label ?? item.id);
}

/**
 * 인스턴스의 현재 표시 라벨을 해석한다.
 *
 * @param t i18n 번역 함수
 * @param instance 라벨을 계산할 인스턴스
 * @returns override가 반영된 라벨 문자열
 */
export function resolveScreenDesignInstanceLabel(
  t: TFunction,
  instance: ScreenDesignInstance,
): string {
  return instance.labelKey ? (t(instance.labelKey as never) as string) : instance.label;
}

/**
 * 인스턴스가 상속받는 마스터 기본 라벨을 해석한다.
 *
 * @param t i18n 번역 함수
 * @param instance 기준 인스턴스
 * @returns 마스터 snapshot 또는 기본 마스터 라벨
 */
export function resolveScreenDesignMasterDefaultLabel(
  t: TFunction,
  instance: ScreenDesignInstance,
): string {
  return instance.masterLabelKey
    ? (t(instance.masterLabelKey as never) as string)
    : instance.masterLabel;
}

/**
 * 라이브러리 카테고리 ID를 번역 가능한 라벨로 변환한다.
 *
 * @param t i18n 번역 함수
 * @param groupKey 카테고리 ID
 * @returns 카테고리 표시 라벨
 */
export function resolveScreenDesignLibraryCategoryLabel(t: TFunction, groupKey: string): string {
  return t(resolveScreenDesignLibraryCategory(groupKey).labelKey as never) as string;
}
