import type { Column, ERDEdge, TableNodeData } from '../types/erd.js';
import type { Domain, Term } from '../types/dictionary.js';

/** 함수·Y.Doc 없이 전달하는 사전 뷰. 추가 속성도 변경 감지에 사용한다. */
export interface ProjectionDictionary {
  terms: (Pick<Term, 'id' | 'logicalName'> & Partial<Term>)[];
  domains: (Pick<Domain, 'id' | 'logicalName'> & Partial<Domain>)[];
}

/** 위치·선택 상태에 의존하지 않는 동기 읽기 결과. 호출 중 입력을 변경하지 않는다. */
export interface ProjectionSnapshot {
  revision: string | number;
  nodes: { id: string; data: TableNodeData }[];
  edges: ERDEdge[];
  dictionary: ProjectionDictionary;
}

/** UTF-16 반열린 범위와 1부터 시작하는 행·열. 끝 위치는 범위 밖이다. */
export interface BlockRange {
  start: number;
  end: number;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

/** 컬럼 한 행의 범위. 개행은 제외한다. */
export interface BlockColumnRange extends BlockRange {
  columnId?: string;
  logicalName: string;
}

/** 텍스트가 표현하지 못하는 관계의 원본과 출력 여부. */
export interface BlockRelationMetadata {
  edge: ERDEdge;
  sourceColumnId?: string;
  targetColumnId?: string;
  emitted: boolean;
}

/**
 * 텍스트와 별도로 보존할 원본 식별자·물리명·관계 속성·사전 연결.
 * columns는 원본 순서이며 모든 컬럼 속성을 보존한다. relations는 자식 소유 관계다.
 * 복수 FK는 기존 생성기처럼 입력 순서상 마지막 유효 FK만 출력한다.
 * 생략·고아 관계는 unrepresentedRelationIds로 명시하며 원본 관계도 유지한다.
 * 기존 DSL 식별자의 구분 문자 이스케이프 한계도 유지하므로 텍스트만으로 원본을 복원하지 않는다.
 */
export interface BlockMetadata {
  tableId: string;
  tablePhysicalName: string;
  tableLogicalName?: string;
  tableTermId?: number;
  columnIds: string[];
  columns: Column[];
  relations: BlockRelationMetadata[];
  unrepresentedRelationIds: string[];
}

/** 블록이 참조하는 테이블과 사전 항목. ID는 로캘에 무관하게 정렬한다. */
export interface BlockDependencies {
  tableIds: string[];
  termIds: number[];
  domainIds: number[];
}

/** 단독 생성에서는 로컬 범위, 전체 투영에서는 전체 텍스트 기준 범위다. */
export interface TableBlock {
  tableId: string;
  text: string;
  tableRange: BlockRange;
  columnRanges: BlockColumnRange[];
  dependencies: BlockDependencies;
  metadata: BlockMetadata;
}

/** 이전 텍스트 기준 UTF-16 반열린 범위의 치환. */
export interface TextPatch {
  start: number;
  end: number;
  text: string;
}

/** 패치는 시작 위치 오름차순·비중첩이며, 적용 시 뒤에서부터 적용한다. */
export interface TextPatchBatch {
  baseRevision: ProjectionSnapshot['revision'];
  nextRevision: ProjectionSnapshot['revision'];
  patches: TextPatch[];
}

/** 날짜 헤더 없는 전체 투영. 블록 사이에는 LF 한 개가 추가된다. */
export interface DslProjection {
  revision: ProjectionSnapshot['revision'];
  text: string;
  blocks: TableBlock[];
}

/** 블록 밖 테이블의 표시명에 대응하는 물리명·컬럼 표시명 역조회. */
export interface DslExternalSymbol {
  physicalName: string;
  columns: ReadonlyMap<string, string>;
}

/** 표시명이 중복되면 호출자가 명시적으로 선택해야 하는 외부 심볼 뷰. */
export type DslExternalSymbols = ReadonlyMap<string, DslExternalSymbol>;
