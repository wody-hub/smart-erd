import type { Edge, Node } from '@xyflow/react';

/**
 * ERD 테이블의 개별 컬럼 정보.
 */
export interface Column {
  /** 컬럼 고유 식별자 (Handle ID 구성에 사용: `{nodeId}-{colId}-{source|target}-{left|right}`) */
  id: string;
  /** 물리명 (예: "user_name") */
  name: string;
  /** 데이터 타입 (예: "VARCHAR(50)", "BIGINT") */
  type: string;
  /** Primary Key 여부 */
  pk?: boolean;
  /** Foreign Key 여부 */
  fk?: boolean;
  /** 자동증가 여부 (PK 컬럼에서만 유효) */
  autoIncrement?: boolean;
  /** NULL 허용 여부 */
  nullable?: boolean;
  /** 논리명 (예: "사용자명") — 데이터 사전 연동용 */
  logicalName?: string;
  /** 연결된 Term ID — 데이터 사전 연동용 */
  termId?: number;
  /** 연결된 Domain ID — 데이터 사전 연동용 */
  domainId?: number;
}

/**
 * 테이블/그룹 헤더 색상 프리셋.
 *
 * 새 디자인 시스템에서는 `default`, `supporting`, `attention`만 노출한다.
 * 나머지 값은 기존 저장 문서 호환용 legacy 색상 키다.
 */
export type TableHeaderColor =
  | 'default'
  | 'supporting'
  | 'attention'
  | 'red'
  | 'orange'
  | 'amber'
  | 'green'
  | 'teal'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'pink';

/** 테이블 핸들 레이아웃 */
export type TableHandleLayout = 'split' | 'left' | 'right';

/**
 * 테이블 노드의 데이터 구조.
 *
 * React Flow 커스텀 노드(`TableNode`)에서 사용되며,
 * 테이블 이름과 컬럼 목록을 포함한다.
 */
export interface TableNodeData extends Record<string, unknown> {
  /** 테이블 물리명 */
  label: string;
  /** 테이블 논리명 (Feature 1: 용어사전 연동) */
  logicalTableName?: string;
  /** 연결된 Term ID (Feature 1: 용어사전 연동) */
  tableTermId?: number;
  /** 헤더 색상 프리셋 (Feature 4a: 테이블 색상) */
  headerColor?: TableHeaderColor;
  /** 테이블 단위 핸들 레이아웃 */
  handleLayout?: TableHandleLayout;
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
 * 논리적 테이블 그룹.
 *
 * Yjs Y.Map에서 변환된 직렬화 후 인터페이스.
 * 하나의 테이블이 여러 그룹에 참여할 수 있다.
 */
export interface TableGroup {
  /** 그룹 고유 식별자 */
  id: string;
  /** 그룹 이름 */
  label: string;
  /** 그룹 색상 */
  color?: TableHeaderColor;
  /** 소속 테이블 ID 목록 */
  tableIds: string[];
}

/** 관계 유형: 식별(실선) / 비식별(점선) */
export type RelationType = 'identifying' | 'non-identifying';

/** 엣지 라우팅 유형 */
export type EdgeRoutingType = 'smoothstep' | 'bezier' | 'straight';

/** 엣지 연결 side */
export type EdgeHandleSide = 'left' | 'right';

/** 엣지 연결 side 모드 */
export type EdgeHandleMode = 'auto' | 'manual';

/** straight 엣지의 중간 경유점 */
export interface Waypoint {
  x: number;
  y: number;
}

/** ERD 엣지 데이터 */
export interface ERDEdgeData extends Record<string, unknown> {
  /** 관계 유형: 식별(실선) / 비식별(점선) */
  relationType: RelationType;
  /** 라우팅 유형 */
  routingType?: EdgeRoutingType;
  /** handle side 선택 모드 */
  handleMode?: EdgeHandleMode;
  /** manual 모드일 때 source side */
  sourceSide?: EdgeHandleSide;
  /** manual 모드일 때 target side */
  targetSide?: EdgeHandleSide;
  /** straight 라우팅 경유점 */
  waypoints?: Waypoint[];
}

/**
 * ERD 관계 엣지 타입.
 *
 * `ERDEdgeData`를 포함하여 관계 유형 정보를 전달한다.
 */
export type ERDEdge = Edge<ERDEdgeData>;

/** 지원 DBMS 타입 */
export type DbmsType = 'postgresql' | 'mysql' | 'oracle' | 'sqlserver' | 'ansi';
