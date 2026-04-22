/** WBS 항목 응답 모델. */
export interface WbsItem {
  /** WBS 항목 ID */
  id: number;
  /** 부모 WBS 항목 ID */
  parentId: number | null;
  /** 항목명 */
  name: string;
  /** 트리 깊이 (0~2) */
  depth: number;
  /** 정렬 순서 */
  sortOrder: number;
  /** 담당자 사용자 ID */
  assigneeUserId: number | null;
  /** 담당자 이름 */
  assigneeName: string | null;
  /** 시작일 (yyyy-MM-dd) */
  startDate: string | null;
  /** 종료일 (yyyy-MM-dd) */
  endDate: string | null;
  /** 진척률 (0~100) */
  progressRate: number;
  /** 예상 투입 M/M */
  estimatedMm: number | null;
  /** 연결 마일스톤 ID */
  milestoneId: number | null;
  /** 연결 마일스톤 이름 */
  milestoneName: string | null;
  /** 생성 시각 (UTC, ISO-8601) */
  createdAt: string;
  /** 수정 시각 (UTC, ISO-8601) */
  updatedAt: string;
}

/** WBS 항목 생성 payload. */
export interface CreateWbsItemPayload {
  /** 항목명 */
  name: string;
  /** 부모 WBS 항목 ID */
  parentId: number | null;
  /** 담당자 사용자 ID */
  assigneeUserId: number | null;
  /** 시작일 (yyyy-MM-dd) */
  startDate: string | null;
  /** 종료일 (yyyy-MM-dd) */
  endDate: string | null;
  /** 진척률 (0~100) */
  progressRate: number | null;
  /** 예상 투입 M/M */
  estimatedMm: number | null;
  /** 연결 마일스톤 ID */
  milestoneId: number | null;
}

/** WBS 항목 수정 payload. */
export interface UpdateWbsItemPayload {
  /** 항목명 */
  name: string;
  /** 담당자 사용자 ID */
  assigneeUserId: number | null;
  /** 시작일 (yyyy-MM-dd) */
  startDate: string | null;
  /** 종료일 (yyyy-MM-dd) */
  endDate: string | null;
  /** 진척률 (0~100) */
  progressRate: number;
  /** 예상 투입 M/M */
  estimatedMm: number | null;
  /** 연결 마일스톤 ID */
  milestoneId: number | null;
}

/** WBS 재정렬 항목 payload. */
export interface ReorderWbsItem {
  /** 이동할 WBS 항목 ID */
  id: number;
  /** 이동 후 부모 WBS 항목 ID */
  parentId: number | null;
  /** 이동 후 정렬 순서 */
  sortOrder: number;
}

/** WBS 재정렬 요청 payload. */
export interface ReorderWbsPayload {
  /** 재정렬 대상 항목 목록 */
  items: ReorderWbsItem[];
}
