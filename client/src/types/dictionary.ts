/** 도메인(데이터 타입 사전) 정보. 팀에 속하며 논리명-물리 타입 매핑을 정의한다. */
export interface Domain {
  /** 도메인 고유 ID */
  id: number;
  /** 논리명 (예: "금액") */
  logicalName: string;
  /** 물리 데이터 타입 (예: "DECIMAL(15,2)") */
  physicalType: string;
  /** 설명 (nullable) */
  description: string | null;
  /** 소속 팀 ID */
  teamId: number;
  /** 생성 일시 (ISO 8601) */
  createdAt: string;
  /** 수정 일시 (ISO 8601) */
  updatedAt: string;
}

/** 용어(이름 사전) 정보. 팀에 속하며 논리명-물리명 매핑을 정의한다. */
export interface Term {
  /** 용어 고유 ID */
  id: number;
  /** 논리명 (예: "사용자명") */
  logicalName: string;
  /** 물리명 (예: "user_name") */
  physicalName: string;
  /** 설명 (nullable) */
  description: string | null;
  /** 소속 팀 ID */
  teamId: number;
  /** 연결 도메인 ID (nullable) */
  domainId: number | null;
  /** 연결 도메인 논리명 (nullable) */
  domainLogicalName: string | null;
  /** 생성 일시 (ISO 8601) */
  createdAt: string;
  /** 수정 일시 (ISO 8601) */
  updatedAt: string;
}

/** 도메인 생성/수정 요청 페이로드 */
export interface DomainFormData {
  /** 논리명 */
  logicalName: string;
  /** 물리 데이터 타입 */
  physicalType: string;
  /** 설명 (선택) */
  description?: string;
}

/** 용어 생성/수정 요청 페이로드 */
export interface TermFormData {
  /** 논리명 */
  logicalName: string;
  /** 물리명 */
  physicalName: string;
  /** 연결 도메인 ID (선택) */
  domainId?: number | null;
  /** 설명 (선택) */
  description?: string;
}
