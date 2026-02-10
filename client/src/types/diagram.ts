/** 다이어그램 목록 조회 시 반환되는 요약 정보. */
export interface DiagramSummary {
  /** 다이어그램 고유 ID */
  id: number;
  /** 다이어그램 이름 */
  name: string;
  /** 소속 프로젝트 ID */
  projectId: number;
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
}
