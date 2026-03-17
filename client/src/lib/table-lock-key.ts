import { djb2 } from './hash.js';
import type { TableNodeData } from '../types/erd.js';

/** 락 키 계산에 필요한 최소 컬럼 정보 */
export interface TableLockKeyColumn {
  /** 컬럼 물리명 */
  name: string;
  /** 데이터 타입 */
  type?: string;
  /** PK 여부 */
  pk?: boolean;
  /** FK 여부 */
  fk?: boolean;
}

/** 락 키 계산 입력 */
export interface TableLockKeyInput {
  /** 테이블 물리명 */
  physicalName: string;
  /** 테이블 논리명 */
  logicalName?: string;
  /** 컬럼 목록 */
  columns: TableLockKeyColumn[];
}

/** 문자열을 락 키 비교용으로 정규화한다. */
function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * 테이블 구조를 기반으로 결정적 소프트 락 키를 생성한다.
 *
 * 편집 중 컬럼이 수시로 변하므로 테이블명(논리/물리) 기준으로 안정 키를 만든다.
 */
export function buildTableLockKey(input: TableLockKeyInput): string {
  const raw = [normalize(input.logicalName), normalize(input.physicalName)].join('||');
  return `table-lock-${djb2(raw)}`;
}

/** TableNodeData에서 락 키를 만든다. */
export function buildTableLockKeyFromNodeData(data: TableNodeData): string {
  return buildTableLockKey({
    logicalName: data.logicalTableName,
    physicalName: data.label,
    columns: data.columns.map((column) => ({
      name: column.name,
      type: column.type,
      pk: column.pk,
      fk: column.fk,
    })),
  });
}
