import type { Node, Edge } from '@xyflow/react';

/**
 * ERD 테이블의 개별 컬럼 정보.
 */
export interface Column {
  /** 컬럼 고유 식별자 (Handle ID 구성에 사용: `{nodeId}-{colId}-source/target`) */
  id: string;
  /** 컬럼 이름 */
  name: string;
  /** 데이터 타입 (예: "VARCHAR(50)", "BIGINT") */
  type: string;
  /** Primary Key 여부 */
  pk?: boolean;
  /** Foreign Key 여부 */
  fk?: boolean;
  /** NULL 허용 여부 */
  nullable?: boolean;
}

/**
 * 테이블 노드의 데이터 구조.
 *
 * React Flow 커스텀 노드(`TableNode`)에서 사용되며,
 * 테이블 이름과 컬럼 목록을 포함한다.
 */
export interface TableNodeData extends Record<string, unknown> {
  /** 테이블 표시 이름 */
  label: string;
  /** 테이블 컬럼 목록 */
  columns: Column[];
}

/**
 * ERD 테이블 노드 타입.
 *
 * React Flow `Node`에 `TableNodeData`를 바인딩하고 노드 타입을 `'table'`로 지정한다.
 */
export type TableNode = Node<TableNodeData, 'table'>;

/**
 * ERD 관계 엣지 타입.
 *
 * React Flow의 기본 `Edge` 타입을 그대로 사용한다.
 */
export type ERDEdge = Edge;
