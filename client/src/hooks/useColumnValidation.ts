import { useMemo } from 'react';
import useCanvasStore from '@/stores/useCanvasStore';
import { useErdDictionary } from '@/components/erd/ErdDictionaryContext';

/** 컬럼 유효성 검사 상태 */
export type ValidationStatus =
  | 'matched'
  | 'name-mismatch'
  | 'type-mismatch'
  | 'unregistered'
  | 'unchecked';

/** 개별 컬럼 유효성 검사 결과 */
export interface ColumnValidationResult {
  /** 컬럼 ID */
  colId: string;
  /** 컬럼 논리명 */
  logicalName: string;
  /** 컬럼 물리명 */
  name: string;
  /** 검사 상태 */
  status: ValidationStatus;
  /** 기대 물리명 (불일치 시) */
  expectedName?: string;
  /** 기대 타입 (불일치 시) */
  expectedType?: string;
  /** 현재 타입 (불일치 시) */
  actualType?: string;
}

/** 테이블별 유효성 검사 결과 */
export interface TableValidation {
  /** 노드 ID */
  nodeId: string;
  /** 테이블 이름 */
  tableName: string;
  /** 컬럼별 검사 결과 */
  columns: ColumnValidationResult[];
}

/** 컬럼 경고 검사 결과 */
export interface ColumnWarning {
  /** 검사 상태 (null이면 문제 없음: matched 또는 unchecked) */
  status: ValidationStatus | null;
  /** 기대 물리명 (name-mismatch 시) */
  expectedName?: string;
  /** 기대 타입 (type-mismatch 시) */
  expectedType?: string;
  /** 현재 타입 (type-mismatch 시) */
  actualType?: string;
}

/**
 * 개별 컬럼의 사전 유효성 경고를 계산하는 순수 함수.
 *
 * TableNode(인라인 경고)와 useColumnValidation(패널 집계) 양쪽에서 공통으로 사용한다.
 *
 * @param col        컬럼 데이터
 * @param findTerm   Term 조회 함수
 * @param findDomain Domain 조회 함수
 * @returns 경고 결과 (status가 null이면 문제 없음)
 */
export function getColumnWarning(
  col: { logicalName?: string; name: string; type: string; termId?: number },
  findTerm: (id: number) => { physicalName: string; domainId: number | null } | undefined,
  findDomain: (id: number) => { physicalType: string } | undefined,
): ColumnWarning {
  if (!col.logicalName) {
    return { status: null };
  }
  if (!col.termId) {
    return { status: 'unregistered' };
  }

  const term = findTerm(col.termId);
  if (!term) {
    return { status: 'unregistered' };
  }

  if (col.name !== term.physicalName) {
    return { status: 'name-mismatch', expectedName: term.physicalName };
  }

  if (term.domainId) {
    const domain = findDomain(term.domainId);
    if (domain && col.type !== domain.physicalType) {
      return { status: 'type-mismatch', expectedType: domain.physicalType, actualType: col.type };
    }
  }

  return { status: null };
}

/**
 * 전체 컬럼의 사전 유효성 검사를 수행하는 훅.
 *
 * ErdDictionaryContext에서 사전 데이터를 주입받아 사용한다.
 * nodes, terms, domains 변경 시 자동 재계산된다.
 *
 * @returns tableValidations, matchedCount, totalCount, hasDictionary
 */
export function useColumnValidation() {
  const nodes = useCanvasStore((s) => s.nodes);
  const { terms, findTermById, findDomainById } = useErdDictionary();

  /** 사전 데이터 존재 여부 */
  const hasDictionary = terms.length > 0;

  const result = useMemo(() => {
    let matchedCount = 0;
    let totalCount = 0;

    const tableValidations: TableValidation[] = nodes.map((node) => {
      const columnResults = node.data.columns.map((col): ColumnValidationResult => {
        // unchecked(논리명 없음) 컬럼은 검사 대상에서 제외
        if (!col.logicalName) {
          return { colId: col.id, logicalName: '', name: col.name, status: 'unchecked' };
        }

        totalCount++;
        const warning = getColumnWarning(col, findTermById, findDomainById);

        if (warning.status) {
          return {
            colId: col.id,
            logicalName: col.logicalName,
            name: col.name,
            status: warning.status,
            expectedName: warning.expectedName,
            expectedType: warning.expectedType,
            actualType: warning.actualType,
          };
        }

        matchedCount++;
        return { colId: col.id, logicalName: col.logicalName, name: col.name, status: 'matched' };
      });

      return {
        nodeId: node.id,
        tableName: node.data.label,
        columns: columnResults,
      };
    });

    return { tableValidations, matchedCount, totalCount };
  }, [nodes, findTermById, findDomainById]);

  return { ...result, hasDictionary };
}
