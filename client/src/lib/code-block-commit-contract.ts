/**
 * S4-a 블록 커밋 계약. 통합 편집 패널(DSL)에서 한 블록(테이블)의 사용자 편집을 공유 문서에
 * "필드 단위 base→next 패치"로 원자 적용하기 위한 파서·적용기 공통 타입이다.
 * 이번 조각은 기존 엔티티의 필드 편집만 지원한다(추가·삭제·이동·FK·사전 연결 변경은 후속).
 */

/** 커밋 명령 종류 식별자(`diff:apply-plan`의 strict variant). */
export const CODE_BLOCK_COMMIT_KIND = 'code-block-v1' as const;

/** 테이블에서 편집할 수 있는 필드. */
export type CodeBlockTableField = 'label' | 'logicalTableName';

/** 컬럼에서 편집할 수 있는 필드(물리명, 논리명, 타입, PK, NOT NULL). */
export type CodeBlockColumnField = 'name' | 'logicalName' | 'type' | 'pk' | 'nullable';

/** 패치 값. 문자열 필드는 string|null(논리명 제거), 불리언 필드는 boolean. */
export type CodeBlockFieldValue = string | boolean | null;

/** 테이블 필드 하나의 base→next 패치. */
export interface CodeBlockTablePatch {
  target: 'table';
  /** 대상 테이블 ID. */
  tableId: string;
  field: CodeBlockTableField;
  /** 사용자가 편집을 시작할 때 관측한 값. */
  baseValue: CodeBlockFieldValue;
  /** 사용자가 커밋하려는 값. */
  nextValue: CodeBlockFieldValue;
}

/** 컬럼 필드 하나의 base→next 패치. */
export interface CodeBlockColumnPatch {
  target: 'column';
  tableId: string;
  /** 대상 컬럼 ID(안정 ID, 이름 기반 매칭 금지). */
  columnId: string;
  field: CodeBlockColumnField;
  baseValue: CodeBlockFieldValue;
  nextValue: CodeBlockFieldValue;
}

/** 블록 커밋의 필드 패치. */
export type CodeBlockFieldPatch = CodeBlockTablePatch | CodeBlockColumnPatch;

/** 한 블록(테이블)에 대한 사용자 커밋 1건. 문서 명령 1건 = 트랜잭션 1건 = undo 1단계. */
export interface CodeBlockCommit {
  kind: typeof CODE_BLOCK_COMMIT_KIND;
  /** 멱등성·echo 식별용 커밋 ID(UUID). */
  commitId: string;
  /** 대상 테이블 ID. 모든 패치의 tableId와 같아야 한다. */
  tableId: string;
  /** 커밋 시점에 사용한 사전 지문. 현재 사전과 다르면 적용기가 거절한다. */
  dictionaryFingerprint: string;
  patches: CodeBlockFieldPatch[];
}

/** 적용기가 거절하는 사유. */
export type CodeBlockRejectReason =
  | 'invalid'
  | 'missing-target'
  | 'duplicate-name'
  | 'conflict'
  | 'dictionary-linked'
  | 'dictionary-changed'
  | 'not-ready';

/** 충돌 필드 하나(현재 문서 값이 base도 next도 아닌 경우). */
export interface CodeBlockConflict {
  patchIndex: number;
  baseValue: CodeBlockFieldValue;
  currentValue: CodeBlockFieldValue;
  nextValue: CodeBlockFieldValue;
}

/** 커밋 적용 결과. 거절이면 문서에는 아무 변경도 없다. */
export type CodeBlockCommitResult =
  | { status: 'applied'; commitId: string; changedFields: number; noop: boolean }
  | {
      status: 'rejected';
      commitId: string;
      reason: CodeBlockRejectReason;
      patchIndex?: number;
      conflicts?: CodeBlockConflict[];
    };
