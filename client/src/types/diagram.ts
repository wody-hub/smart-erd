/** 다이어그램 목록 조회 시 반환되는 요약 정보. */
export interface DiagramSummary {
  /** 다이어그램 고유 ID */
  id: number;
  /** 다이어그램 이름 */
  name: string;
  /** 소속 프로젝트 ID */
  projectId: number;
  /** 적용 사전 세트 ID */
  dictionarySetId: number | null;
  /** 적용 사전 세트 이름 */
  dictionarySetName: string | null;
  /** 생성 일시 (ISO 8601) */
  createdAt: string;
  /** 최종 수정 일시 (ISO 8601) */
  updatedAt: string;
}

/** 다이어그램 상세 정보. 캔버스 콘텐츠(JSON)를 포함한다. */
export interface DiagramDetail extends DiagramSummary {
  /** 직렬화된 React Flow JSON (노드·엣지). 빈 다이어그램이면 null. */
  content: string | null;
  /** Y.Doc 스냅샷 존재 여부 (true면 JSON 마이그레이션 불필요) */
  hasYdocSnapshot: boolean;
  /** content 리비전 (long 문자열) */
  contentRevision: string;
  /** snapshot 리비전 (null이면 스냅샷 없음) */
  snapshotRevision: string | null;
  /** snapshot 저장 시각 (ISO 8601, null 가능) */
  snapshotUpdatedAt: string | null;
}

/** 다이어그램 동기화 상태 */
export type SyncStage =
  | 'boot'
  | 'api-preview'
  | 'api-preview-empty'
  | 'yjs-live'
  | 'yjs-timeout-degraded'
  | 'yjs-failed-readonly';

/** Yjs handoff 모드 */
export type HandoffMode = 'snapshot' | 'sync-only';

/** 다이어그램 사전 세트 변경 결과 */
export interface UpdateDiagramDictionarySetResult {
  /** 변경된 사전 세트 ID */
  dictionarySetId: number;
  /** 무효화된 term 바인딩 수 */
  invalidatedTermBindingCount: number;
  /** 무효화된 domain 바인딩 수 */
  invalidatedDomainBindingCount: number;
}
