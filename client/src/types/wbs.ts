/** WBS 항목 응답 모델. */
export interface WbsItem {
  /** WBS 항목 ID */
  id: number;
  /** 부모 WBS 항목 ID */
  parentId: number | null;
  /** 항목명 */
  name: string;
  /** 트리 깊이 (0~8) */
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

/** WBS에 연결된 문서 요약 모델. */
export interface WbsLinkedDocument {
  /** 문서 ID */
  id: number;
  /** 문서 제목 */
  name: string;
  /** 문서 플러그인 ID */
  pluginId: string;
  /** markdown 템플릿 키 */
  templateKey: string | null;
  /** markdown/문서 요약 */
  summaryText: string | null;
  /** markdown 템플릿 라벨 */
  templateLabel: string | null;
  /** 문서 태그 */
  tags: string[];
  /** 연결 시각 */
  linkedAt: string | null;
  /** 생성 일시 */
  createdAt: string;
  /** 최종 수정 일시 */
  updatedAt: string;
}

/** 태그 목록 요약 모델. */
export interface ProjectDocumentTag {
  /** 태그 이름 */
  tag: string;
  /** 연결 문서 수 */
  documentCount: number;
}

/** 태그 기준 문서 목록 요약 모델. */
export interface TaggedDocument {
  /** 문서 ID */
  id: number;
  /** 문서 제목 */
  name: string;
  /** 문서 플러그인 ID */
  pluginId: string;
  /** markdown 템플릿 키 */
  templateKey: string | null;
  /** markdown/문서 요약 */
  summaryText: string | null;
  /** markdown 템플릿 라벨 */
  templateLabel: string | null;
  /** 문서 태그 */
  tags: string[];
  /** 연결 시각 */
  linkedAt: string | null;
  /** 생성 일시 */
  createdAt: string;
  /** 최종 수정 일시 */
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
