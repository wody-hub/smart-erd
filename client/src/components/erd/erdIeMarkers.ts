/** 부모 끝 마커: 필수(||) / 선택(o|) */
export type IeParentMarker = 'mandatory' | 'optional';

/** 자식 끝 마커: 0..N (까마귀발 + o) / 0..1 (|o) */
export type IeChildMarker = 'zero-or-many' | 'zero-or-one';

/** Erwin IE 표기 마커 계산 결과 */
export interface IeMarkers {
  /** 부모 끝 마커 */
  parent: IeParentMarker;
  /** 자식 끝 마커 */
  child: IeChildMarker;
}

/**
 * 관계의 카디널리티 정보로 Erwin IE 표기 마커를 계산한다.
 *
 * FK 컬럼이 NULL 허용이면 부모 선택(o|), 아니면 부모 필수(||)다.
 * 자식 끝은 FK가 PK 전체를 이루면 0..1(|o), 그 외에는 0..N(까마귀발 + o)이다.
 *
 * @param cardinality.targetSymbol 자식 쪽 카디널리티 ('one' | 'many')
 * @param cardinality.optional     FK 컬럼 NULL 허용 여부
 * @returns 부모/자식 끝 마커
 */
export function computeIeMarkers(cardinality: {
  targetSymbol: 'one' | 'many';
  optional: boolean;
}): IeMarkers {
  return {
    parent: cardinality.optional ? 'optional' : 'mandatory',
    child: cardinality.targetSymbol === 'one' ? 'zero-or-one' : 'zero-or-many',
  };
}
