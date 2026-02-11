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

/** 용어 일괄 저장 행 데이터 */
export interface BulkTermRow {
  /** 논리명 */
  logicalName: string;
  /** 물리명 */
  physicalName: string;
  /** 도메인 논리명 (nullable) */
  domainLogicalName?: string | null;
  /** 설명 (선택) */
  description?: string;
}

/** 일괄 업로드 검증 응답 */
export interface BulkValidationResponse {
  /** 전체 행 수 */
  totalCount: number;
  /** 유효 행 수 */
  validCount: number;
  /** 에러 행 수 */
  errorCount: number;
  /** 행별 검증 결과 */
  rows: BulkValidationRow[];
}

/** 개별 행 검증 결과 */
export interface BulkValidationRow {
  /** 엑셀 원본 행 번호 */
  rowNumber: number;
  /** 유효 여부 */
  valid: boolean;
  /** 에러 메시지 목록 */
  errors: string[];
  /** 파싱된 데이터 (key-value) */
  data: Record<string, string>;
}

/** 일괄 저장 응답 */
export interface BulkSaveResponse {
  /** 저장 성공 건수 */
  savedCount: number;
  /** 저장 실패 건수 */
  failedCount: number;
}

/** 키워드 추천 요청 */
export interface SuggestRequest {
  /** 한글 키워드 */
  keyword: string;
}

/** 키워드 추천 응답 */
export interface SuggestResponse {
  /** 추천 물리명 */
  physicalName: string | null;
  /** 추천 도메인 ID */
  domainId: number | null;
  /** 추천 도메인 논리명 */
  domainLogicalName: string | null;
  /** 매칭 상세 */
  matches: SuggestMatch[];
}

/** 개별 매칭 정보 */
export interface SuggestMatch {
  /** 입력 토큰 */
  keyword: string;
  /** 매칭 성공 여부 */
  matched: boolean;
  /** 매칭된 물리명 */
  physicalName: string | null;
  /** 매칭 출처 설명 */
  source: string | null;
}
