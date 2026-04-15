/** 마일스톤 응답 모델. */
export interface Milestone {
  /** 마일스톤 ID */
  id: number;
  /** 프로젝트 ID */
  projectId: number;
  /** 마일스톤 이름 */
  name: string;
  /** 목표일 (yyyy-MM-dd) */
  targetDate: string;
  /** 설명 */
  description: string | null;
  /** 정렬 순서 */
  sortOrder: number;
  /** 연결된 WBS 항목 수 */
  linkedWbsItemCount: number;
  /** 달성률 (0~100) */
  achievementRate: number;
  /** 지연 여부 */
  isDelayed: boolean;
  /** 생성 시각 (UTC, ISO-8601) */
  createdAt: string;
  /** 수정 시각 (UTC, ISO-8601) */
  updatedAt: string;
}

/** 마일스톤 생성 payload. */
export interface CreateMilestonePayload {
  /** 마일스톤 이름 */
  name: string;
  /** 목표일 (yyyy-MM-dd) */
  targetDate: string;
  /** 설명 */
  description: string | null;
}

/** 마일스톤 수정 payload. */
export interface UpdateMilestonePayload {
  /** 마일스톤 이름 */
  name: string;
  /** 목표일 (yyyy-MM-dd) */
  targetDate: string;
  /** 설명 */
  description: string | null;
}
