/** 프로젝트 정보. 팀에 속하며 다이어그램을 포함한다. */
export interface Project {
  /** 프로젝트 고유 ID */
  id: number;
  /** 프로젝트 이름 */
  name: string;
  /** 프로젝트 설명 (nullable) */
  description: string | null;
  /** 소속 팀 ID */
  teamId: number;
  /** 프로젝트 생성 일시 (ISO 8601) */
  createdAt: string;
}

/** 사업 개요 조회 응답. BE 응답 11개 필드를 1:1로 매핑한다. */
export interface BusinessOverviewResponse {
  /** 프로젝트 ID */
  projectId: number;
  /** 프로젝트명 */
  projectName: string;
  /** 발주사명 */
  clientCompany: string | null;
  /** 수주사명 */
  contractorCompany: string | null;
  /** 계약 금액 (원화 단위 정수) */
  contractAmount: number | null;
  /** 프로젝트 시작일 (ISO 8601) */
  projectStartDate: string | null;
  /** 프로젝트 종료일 (ISO 8601) */
  projectEndDate: string | null;
  /** 프로젝트 범위/목적 */
  projectScope: string | null;
  /** 팀 참여 인원 수 */
  memberCount: number;
  /** 프로젝트 문서 총 수 */
  documentCount: number;
  /** 진행률 (0~100, 미집계 시 null) */
  progressRate: number | null;
}

/** 사업 개요 수정 요청 payload. 6개 필드를 명시적으로 전송한다. */
export interface UpdateBusinessOverviewPayload {
  /** 발주사명 */
  clientCompany: string | null;
  /** 수주사명 */
  contractorCompany: string | null;
  /** 계약 금액 (원화 단위 정수) */
  contractAmount: number | null;
  /** 프로젝트 시작일 (ISO 8601) */
  projectStartDate: string | null;
  /** 프로젝트 종료일 (ISO 8601) */
  projectEndDate: string | null;
  /** 프로젝트 범위/목적 */
  projectScope: string | null;
}
