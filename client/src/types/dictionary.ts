/** 사전 세트 정보. 한 팀이 여러 개 보유할 수 있다. */
export interface DictionarySet {
  /** 세트 고유 ID */
  id: number;
  /** 세트 이름 */
  name: string;
  /** 설명 (nullable) */
  description: string | null;
  /** 소속 팀 ID */
  teamId: number;
  /** 기본 세트 여부 */
  isDefault: boolean;
  /** 생성 일시 (ISO 8601) */
  createdAt: string;
  /** 수정 일시 (ISO 8601) */
  updatedAt: string;
}

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
  /** 소속 사전 세트 ID */
  dictionarySetId: number | null;
  /** 생성 일시 (ISO 8601) */
  createdAt: string;
  /** 수정 일시 (ISO 8601) */
  updatedAt: string;
}

/** 단어(용어를 구성하는 기본 단위) 정보. */
export interface Word {
  id: number;
  logicalName: string;
  physicalName: string;
  description: string | null;
  teamId: number;
  dictionarySetId: number | null;
  createdAt: string;
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
  /** 소속 사전 세트 ID */
  dictionarySetId: number | null;
  /** 연결 도메인 ID (nullable) */
  domainId: number | null;
  /** 연결 도메인 논리명 (nullable) */
  domainLogicalName: string | null;
  /** 생성 일시 (ISO 8601) */
  createdAt: string;
  /** 수정 일시 (ISO 8601) */
  updatedAt: string;
}

/** 페이지네이션 응답 공통 타입 */
export interface PagedResponse<T> {
  /** 현재 페이지 데이터 */
  content: T[];
  /** 현재 페이지 번호 (0-base) */
  page: number;
  /** 페이지 크기 */
  size: number;
  /** 전체 데이터 건수 */
  totalElements: number;
  /** 전체 페이지 수 */
  totalPages: number;
  /** 첫 페이지 여부 */
  first: boolean;
  /** 마지막 페이지 여부 */
  last: boolean;
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

/** 단어 생성/수정 요청 페이로드 */
export interface WordFormData {
  logicalName: string;
  physicalName: string;
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
  /** 조합에 사용한 단어 ID 목록 (선택, 저장은 하지 않고 폼 조립용) */
  wordIds?: number[];
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
  /** 검증 세션 토큰 (저장 요청 시 사용) */
  validationToken: string;
  /** 전체 행 수 */
  totalCount: number;
  /** 유효 행 수 */
  validCount: number;
  /** 에러 행 수 */
  errorCount: number;
  /** 미리보기 일부 반환 여부 */
  previewTruncated: boolean;
  /** 미리보기 행별 검증 결과 */
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

/** 부분 분해의 개별 세그먼트 */
export interface DecomposedSegment {
  /** 논리명 텍스트 */
  text: string;
  /** 사전 매칭 여부 */
  matched: boolean;
  /** 매칭된 Term 정보 (matched=true일 때) */
  term?: { id: number; physicalName: string; domainId: number | null };
}

/** 부분 분해 결과 (일부만 매칭) */
export interface PartialDecomposition {
  /** 원본 입력값 */
  query: string;
  /** 분해된 세그먼트 목록 */
  segments: DecomposedSegment[];
}

/** 복합 용어 해석 결과 */
export interface CompoundResolution {
  /** 원본 입력값 (예: "사용자 아이디") */
  query: string;
  /** 해석된 물리명 (예: "user_id") */
  physicalName: string;
  /** 매칭된 기본 용어 목록 */
  baseTerms: CompoundBaseTerm[];
  /** 상속 도메인 ID (마지막 기본 용어 기준, ERwin class word) */
  domainId: number | null;
  /** 상속 도메인의 물리 타입 */
  physicalType?: string;
}

/** 복합 용어 분해에 사용된 개별 기본 용어 */
export interface CompoundBaseTerm {
  /** 기본 용어 논리명 */
  logicalName: string;
  /** 기본 용어 물리명 */
  physicalName: string;
  /** 기본 용어 Term ID */
  termId: number;
  /** 기본 용어에 연결된 도메인 ID (nullable) */
  domainId: number | null;
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
