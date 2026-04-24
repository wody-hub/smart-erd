/** 프로젝트 이슈 상태. */
export type ProjectIssueStatus = 'REGISTERED' | 'IN_PROGRESS' | 'DONE';

/** 프로젝트 이슈 우선순위. */
export type ProjectIssuePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** 프로젝트 이슈 행 응답. */
export interface ProjectIssue {
  /** 이슈 ID */
  id: number;
  /** 제목 */
  title: string;
  /** 설명 */
  description: string;
  /** 상태 */
  status: ProjectIssueStatus;
  /** 우선순위 */
  priority: ProjectIssuePriority;
  /** 담당자 사용자 ID */
  assigneeUserId: number | null;
  /** 담당자 이름 */
  assigneeName: string | null;
  /** 담당자 로그인 ID */
  assigneeLoginId: string | null;
  /** 생성 시각 */
  createdAt: string;
  /** 수정 시각 */
  updatedAt: string;
}

/** 프로젝트 이슈 목록 요약. */
export interface ProjectIssueSummary {
  /** 전체 이슈 수 */
  totalCount: number;
  /** 등록 상태 이슈 수 */
  registeredCount: number;
  /** 처리중 상태 이슈 수 */
  inProgressCount: number;
  /** 완료 상태 이슈 수 */
  doneCount: number;
}

/** 프로젝트 이슈 목록 응답. */
export interface ProjectIssueList {
  /** 이슈 목록 */
  items: ProjectIssue[];
  /** 상태 요약 */
  summary: ProjectIssueSummary;
}

/** 프로젝트 이슈 조회 필터. */
export interface ProjectIssueFilters {
  /** 상태 필터 */
  status?: ProjectIssueStatus;
  /** 우선순위 필터 */
  priority?: ProjectIssuePriority;
  /** 담당자 사용자 ID */
  assigneeUserId?: number;
  /** 미배정 이슈만 조회 여부 */
  unassignedOnly?: boolean;
}

/** 프로젝트 이슈 생성 payload. */
export interface CreateProjectIssuePayload {
  /** 제목 */
  title: string;
  /** 설명 */
  description: string;
  /** 우선순위 */
  priority: ProjectIssuePriority;
  /** 담당자 사용자 ID */
  assigneeUserId: number | null;
}

/** 프로젝트 이슈 수정 payload. */
export interface UpdateProjectIssuePayload {
  /** 제목 */
  title: string;
  /** 설명 */
  description: string;
  /** 우선순위 */
  priority: ProjectIssuePriority;
  /** 담당자 사용자 ID */
  assigneeUserId: number | null;
}

/** 프로젝트 이슈 상태 변경 payload. */
export interface UpdateProjectIssueStatusPayload {
  /** 다음 상태 */
  status: ProjectIssueStatus;
}
