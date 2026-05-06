import type { WbsDependency } from './wbs-dependency';

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
  /** 실적 시작일 (yyyy-MM-dd) */
  actualStartDate: string | null;
  /** 실적 종료일 (yyyy-MM-dd) */
  actualEndDate: string | null;
  /** 진척률 (0~100) */
  progressRate: number;
  /** 기준일 기준 계획 진척률 (0~100) */
  plannedProgressRate: number | null;
  /** 실적 진척률 대비 계획 진척률 편차 */
  progressVarianceRate: number | null;
  /** 계획 시작일 대비 실적 시작일 편차 일수 */
  startVarianceDays: number | null;
  /** 계획 종료일 대비 실적 종료일 편차 일수 */
  endVarianceDays: number | null;
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

/** WBS 댓글 응답 모델. */
export interface WbsComment {
  /** 댓글 ID */
  id: number;
  /** 댓글 내용 */
  content: string;
  /** 작성자 로그인 ID */
  actorLoginId: string | null;
  /** 작성자 이름 */
  actorName: string | null;
  /** 생성 일시 */
  createdAt: string;
  /** 수정 일시 */
  updatedAt: string;
}

/** WBS 활동 로그 이벤트 타입. */
export type WbsActivityEventType = 'DOCUMENT_LINKED' | 'DOCUMENT_UNLINKED' | 'ISSUE_STATUS_CHANGED';

/** WBS 활동 로그 주체 타입. */
export type WbsActivitySubjectType = 'DOCUMENT' | 'STATUS';

/** WBS 활동 로그 응답 모델. */
export interface WbsActivity {
  /** 로그 ID */
  id: number;
  /** 이벤트 타입 */
  eventType: WbsActivityEventType;
  /** 보조 주체 타입 */
  subjectType: WbsActivitySubjectType | null;
  /** 보조 주체 ID */
  subjectId: number | null;
  /** 보조 주체 라벨 */
  subjectLabel: string | null;
  /** 이전 값 */
  previousValue: string | null;
  /** 현재 값 */
  currentValue: string | null;
  /** 상세 설명 */
  detail: string | null;
  /** 수행자 로그인 ID */
  actorLoginId: string | null;
  /** 수행자 이름 */
  actorName: string | null;
  /** 발생 시각 */
  occurredAt: string;
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
  /** 실적 시작일 (yyyy-MM-dd) */
  actualStartDate: string | null;
  /** 실적 종료일 (yyyy-MM-dd) */
  actualEndDate: string | null;
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
  /** 실적 시작일 (yyyy-MM-dd) */
  actualStartDate: string | null;
  /** 실적 종료일 (yyyy-MM-dd) */
  actualEndDate: string | null;
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

/** WBS 댓글 생성 payload. */
export interface CreateWbsCommentPayload {
  /** 댓글 내용 */
  content: string;
}

/** WBS 템플릿 요약 응답 모델. */
export interface WbsTemplateSummary {
  /** 템플릿 ID */
  id: number;
  /** 템플릿 이름 */
  name: string;
  /** 템플릿 설명 */
  description: string | null;
  /** 원본 루트 항목 이름 */
  rootName: string;
  /** 포함된 WBS 항목 수 */
  itemCount: number;
  /** 포함된 dependency 수 */
  dependencyCount: number;
  /** 생성 시각 */
  createdAt: string;
  /** 수정 시각 */
  updatedAt: string;
}

/** WBS 템플릿 저장 payload. */
export interface SaveWbsTemplatePayload {
  /** 스냅샷으로 저장할 subtree 루트 WBS ID */
  sourceWbsItemId: number;
  /** 템플릿 이름 */
  name: string;
  /** 템플릿 설명 */
  description: string | null;
}

/** WBS subtree/템플릿 생성 공통 payload. */
export interface WbsSubtreeInstantiationPayload {
  /** 생성 대상 부모 WBS ID */
  parentId: number | null;
  /** 담당자 초기화 여부 */
  resetAssignee: boolean;
  /** 일정 초기화 여부 */
  resetSchedule: boolean;
  /** 진척률 초기화 여부 */
  resetProgress: boolean;
  /** 마일스톤 초기화 여부 */
  resetMilestone: boolean;
  /** subtree 내부 dependency 포함 여부 */
  includeDependencies: boolean;
}

/** WBS subtree 생성/복제 응답 모델. */
export interface WbsSubtreeMutationResponse {
  /** 생성된 subtree 루트 WBS ID */
  rootItemId: number;
  /** 생성된 WBS 항목 목록 */
  items: WbsItem[];
  /** 생성된 dependency 목록 */
  dependencies: WbsDependency[];
}

/** WBS 대량 생성 단일 항목 payload. */
export interface BulkCreateWbsItemPayload {
  /** 요청 항목 고유 키 */
  clientKey: string;
  /** 이미 존재하는 부모 WBS ID */
  parentId: number | null;
  /** 같은 요청 안에서 생성된 부모 항목 키 */
  parentClientKey: string | null;
  /** 항목명 */
  name: string;
  /** 담당자 사용자 ID */
  assigneeUserId: number | null;
  /** 시작일 */
  startDate: string | null;
  /** 종료일 */
  endDate: string | null;
  /** 진척률 */
  progressRate: number | null;
  /** 예상 투입 M/M */
  estimatedMm: number | null;
  /** 연결 마일스톤 ID */
  milestoneId: number | null;
}

/** WBS 대량 생성 payload. */
export interface BulkCreateWbsItemsPayload {
  /** 생성할 항목 목록 */
  items: BulkCreateWbsItemPayload[];
}

/** WBS 대량 생성 결과 항목. */
export interface WbsCreatedItemMapping {
  /** 요청 clientKey */
  clientKey: string;
  /** 생성된 WBS 항목 */
  item: WbsItem;
}

/** WBS 대량 생성 응답 모델. */
export interface BulkCreateWbsItemsResponse {
  /** 생성 결과 목록 */
  items: WbsCreatedItemMapping[];
}

/** dependency shift anchor payload. */
export interface WbsDependencyShiftAnchorPayload {
  /** 직접 이동한 WBS ID */
  wbsItemId: number;
  /** 이동 후 시작일 */
  startDate: string | null;
  /** 이동 후 종료일 */
  endDate: string | null;
}

/** dependency shift preview/apply payload. */
export interface WbsDependencyShiftPayload {
  /** 직접 이동한 anchor 목록 */
  anchors: WbsDependencyShiftAnchorPayload[];
}

/** dependency shift preview/apply 변경 항목. */
export interface WbsDependencyShiftUpdate {
  /** 대상 WBS ID */
  wbsItemId: number;
  /** 변경 전 시작일 */
  originalStartDate: string | null;
  /** 변경 전 종료일 */
  originalEndDate: string | null;
  /** 변경 후 시작일 */
  startDate: string | null;
  /** 변경 후 종료일 */
  endDate: string | null;
  /** anchor 변경 여부 */
  anchor: boolean;
}

/** dependency shift 검증 이슈. */
export interface WbsDependencyShiftIssue {
  /** 관련 WBS ID */
  wbsItemId: number | null;
  /** 검증 코드 */
  code: string;
  /** 검증 메시지 */
  message: string;
}

/** dependency shift preview/apply 응답 모델. */
export interface WbsDependencyShiftResponse {
  /** dependency graph validation 통과 여부 */
  graphValid: boolean;
  /** 실제 반영 여부 */
  applied: boolean;
  /** 변경 제안/적용 목록 */
  updates: WbsDependencyShiftUpdate[];
  /** 검증 이슈 목록 */
  issues: WbsDependencyShiftIssue[];
}
