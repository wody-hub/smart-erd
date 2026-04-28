/** 개인 TODO 상태. */
export type ProjectTodoStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

/** 개인 TODO 우선순위. */
export type ProjectTodoPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** TODO 문서 공개 범위. */
export type TodoDocumentVisibility = 'PRIVATE' | 'PROJECT_SHARED';

/** 개인 TODO 응답 모델. */
export interface ProjectTodo {
  /** TODO ID */
  id: number;
  /** 제목 */
  title: string;
  /** 설명 */
  description: string | null;
  /** 상태 */
  status: ProjectTodoStatus;
  /** 우선순위 */
  priority: ProjectTodoPriority;
  /** 목표일 */
  targetDate: string | null;
  /** 진척률 */
  progressRate: number;
  /** 연결된 WBS 항목 ID */
  linkedWbsItemId: number | null;
  /** 연결된 WBS 항목명 */
  linkedWbsItemName: string | null;
  /** 생성 시각 */
  createdAt: string;
  /** 수정 시각 */
  updatedAt: string;
}

/** TODO 연결 문서 모델. */
export interface TodoDocument {
  /** 문서 ID */
  id: number;
  /** 문서 이름 */
  name: string;
  /** 문서 플러그인 ID */
  pluginId: string;
  /** markdown 템플릿 키 */
  templateKey: string | null;
  /** markdown 템플릿 라벨 */
  templateLabel: string | null;
  /** 문서 요약 */
  summaryText: string | null;
  /** 문서 태그 */
  tags: string[];
  /** 공개 범위 */
  visibility: TodoDocumentVisibility;
  /** TODO 연결 시각 */
  linkedAt: string | null;
  /** 생성 시각 */
  createdAt: string;
  /** 수정 시각 */
  updatedAt: string;
}

/** WBS 측에서 보이는 공유 TODO 요약. */
export interface SharedTodoSummary {
  /** TODO ID */
  id: number;
  /** 제목 */
  title: string;
  /** 상태 */
  status: ProjectTodoStatus;
  /** 우선순위 */
  priority: ProjectTodoPriority;
  /** 목표일 */
  targetDate: string | null;
  /** 진척률 */
  progressRate: number;
  /** 소유자 사용자 ID */
  ownerUserId: number;
  /** 소유자 이름 */
  ownerName: string;
  /** 공유 문서 목록 */
  sharedDocuments: TodoDocument[];
}

/** 개인 TODO 생성 payload. */
export interface CreateProjectTodoPayload {
  /** 제목 */
  title: string;
  /** 설명 */
  description: string | null;
  /** 상태 */
  status: ProjectTodoStatus | null;
  /** 우선순위 */
  priority: ProjectTodoPriority | null;
  /** 목표일 */
  targetDate: string | null;
  /** 진척률 */
  progressRate: number | null;
  /** 초기 연결 WBS 항목 ID */
  linkedWbsItemId: number | null;
}

/** 개인 TODO 수정 payload. */
export interface UpdateProjectTodoPayload {
  /** 제목 */
  title: string;
  /** 설명 */
  description: string | null;
  /** 상태 */
  status: ProjectTodoStatus;
  /** 우선순위 */
  priority: ProjectTodoPriority;
  /** 목표일 */
  targetDate: string | null;
  /** 진척률 */
  progressRate: number;
}

/** TODO 문서 링크/가시성 payload. */
export interface UpdateTodoDocumentVisibilityPayload {
  /** 공개 범위 */
  visibility: TodoDocumentVisibility;
}
