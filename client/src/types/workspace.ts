/** workspace breadcrumb와 상위 쉘에서 공통으로 쓰는 섹션 식별자. */
export type WorkspaceSection =
  | 'teams'
  | 'projects'
  | 'documents'
  | 'dictionary'
  | 'members'
  | 'settings';

/** 문서 플랫폼 상위에서 구분하는 문서 타입. */
export type WorkspaceDocumentType = 'erd' | 'markdown' | 'screen-spec';

/** 팀/프로젝트/문서처럼 breadcrumb에 노출할 수 있는 최소 엔터티 정보. */
export interface WorkspaceEntityRef {
  /** 엔터티 ID. string/number 모두 허용한다. */
  id: string | number;
  /** UI에 표시할 이름. */
  name: string;
}

/** 현재 문서 컨텍스트. 문서 타입은 문서 자체에 있거나 상위에서 별도로 가질 수 있다. */
export interface WorkspaceDocumentRef extends WorkspaceEntityRef {
  /** 현재 문서 타입. */
  type?: WorkspaceDocumentType;
}

/** 상위 workspace 쉘이 해석하는 현재 화면 컨텍스트. */
export interface WorkspaceContext {
  /** 현재 팀 컨텍스트. */
  team?: WorkspaceEntityRef;
  /** 현재 프로젝트 컨텍스트. */
  project?: WorkspaceEntityRef;
  /** 현재 섹션. */
  section: WorkspaceSection;
  /** 현재 문서. Dictionary 같은 비문서 화면이면 비워둘 수 있다. */
  document?: WorkspaceDocumentRef;
  /** 현재 문서 타입. 목록 화면처럼 문서 자체가 없을 때도 쓸 수 있다. */
  documentType?: WorkspaceDocumentType;
}

/** Dictionary 페이지 이동 시 넘기는 route state 계약. */
export interface DictionaryWorkspaceRouteState {
  /** 편집기에서 고정할 사전 세트 ID */
  fixedSetId?: string;
  /** 편집기에서 고정할 사전 세트 라벨 */
  fixedSetLabel?: string | null;
}

/** 문서 허브 목록에서 쓰는 상태 톤. */
export type WorkspaceDocumentStatusTone = 'neutral' | 'success' | 'warning';

/** 문서 허브 row가 받는 미래 확장형 문서 요약 모델. */
export interface DocumentListItem {
  /** 문서 ID */
  id: string | number;
  /** 문서 제목 */
  name: string;
  /** 문서 타입 */
  type: WorkspaceDocumentType;
  /** 최종 수정 일시 */
  updatedAt: string;
  /** 연결된 사전 컨텍스트 이름 */
  dictionaryContextName?: string | null;
  /** 보조 상태 문구 */
  statusLabel?: string;
  /** 보조 상태 톤 */
  statusTone?: WorkspaceDocumentStatusTone;
}
