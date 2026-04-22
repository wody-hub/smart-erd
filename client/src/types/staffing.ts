/** 인력 투입에서 사용하는 등급 타입. */
export type StaffingGrade = 'JUNIOR' | 'MIDDLE' | 'SENIOR' | 'EXPERT';

/** 월별 인력 투입량 응답. */
export interface ProjectStaffingMonthlyAllocation {
  /** 월 (YYYY-MM) */
  month: string;
  /** 계획 M/M */
  plannedMm: number;
  /** 실적 M/M(없으면 null) */
  actualMm: number | null;
  /** 계획-실적 차이(없으면 null) */
  deltaMm: number | null;
}

/** 프로젝트 인력 투입 행 응답. */
export interface ProjectStaffingResource {
  /** 인력 투입 ID */
  id: number;
  /** 팀 멤버 사용자 ID */
  userId: number;
  /** 팀 멤버 이름 */
  memberName: string;
  /** 팀 멤버 로그인 ID */
  memberLoginId: string | null;
  /** 등급 */
  grade: StaffingGrade;
  /** 월 단가(원) */
  monthlyRate: number;
  /** 계획 시작일 */
  plannedStartDate: string;
  /** 계획 종료일 */
  plannedEndDate: string;
  /** 계획 참여율 */
  plannedParticipationRate: number;
  /** 계획 M/M */
  plannedMm: number;
  /** 계획 인건비 */
  plannedCost: number;
  /** 실적 시작일 */
  actualStartDate: string | null;
  /** 실적 종료일 */
  actualEndDate: string | null;
  /** 실적 참여율 */
  actualParticipationRate: number | null;
  /** 실적 M/M */
  actualMm: number | null;
  /** 실적 인건비 */
  actualCost: number | null;
  /** M/M 차이 */
  deltaMm: number | null;
  /** 월별 배정 */
  monthlyAllocations: ProjectStaffingMonthlyAllocation[];
  /** 생성 시각 */
  createdAt: string;
  /** 수정 시각 */
  updatedAt: string;
}

/** 프로젝트 인력 투입 조회 결과 */
export interface ProjectStaffingList {
  /** 리소스 목록 */
  resources: ProjectStaffingResource[];
  /** 프로젝트 요약 */
  summary: ProjectStaffingSummary;
  /** 표시 대상 월 목록 */
  months: string[];
}

/** 프로젝트 인력 투입 집계 */
export interface ProjectStaffingSummary {
  /** 계획 M/M */
  plannedMm: number;
  /** 실적 M/M */
  actualMm: number;
  /** M/M 차이 */
  deltaMm: number;
  /** 계획 인건비 */
  plannedCost: number;
  /** 실적 인건비 */
  actualCost: number;
}

/** 인력 투입 생성 payload. */
export interface CreateProjectStaffingPayload {
  /** 대상 멤버 사용자 ID */
  userId: number;
  /** 등급 */
  grade: StaffingGrade;
  /** 월 단가(원) */
  monthlyRate: number;
  /** 계획 시작일 */
  plannedStartDate: string;
  /** 계획 종료일 */
  plannedEndDate: string;
  /** 계획 참여율 */
  plannedParticipationRate: number;
  /** 실적 시작일 */
  actualStartDate: string | null;
  /** 실적 종료일 */
  actualEndDate: string | null;
  /** 실적 참여율 */
  actualParticipationRate: number | null;
}

/** 인력 투입 수정 payload. */
export interface UpdateProjectStaffingPayload {
  /** 등급 */
  grade: StaffingGrade;
  /** 월 단가(원) */
  monthlyRate: number;
  /** 계획 시작일 */
  plannedStartDate: string;
  /** 계획 종료일 */
  plannedEndDate: string;
  /** 계획 참여율 */
  plannedParticipationRate: number;
  /** 실적 시작일 */
  actualStartDate: string | null;
  /** 실적 종료일 */
  actualEndDate: string | null;
  /** 실적 참여율 */
  actualParticipationRate: number | null;
}
