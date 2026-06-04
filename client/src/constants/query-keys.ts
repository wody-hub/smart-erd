import type { ProjectIssueFilters } from '@/types/issues';

/**
 * React Query 캐시 키 상수.
 *
 * URL 경로와 동일한 계층 구조로 설계하여 부분 무효화를 지원한다.
 * 예: 팀 삭제 시 `['teams']`로 하위 키 전체 무효화 가능.
 */
export const queryKeys = {
  /** 팀 관련 쿼리 키 */
  teams: {
    /** 팀 목록 */
    all: ['teams'] as const,
    /** 팀 상세 */
    detail: (teamId: string) => ['teams', teamId] as const,
    /** 팀 멤버 목록 */
    members: (teamId: string) => ['teams', teamId, 'members'] as const,
    /** 내 팀 역할 */
    myRole: (teamId: string) => ['teams', teamId, 'myRole'] as const,
  },
  /** 프로젝트 관련 쿼리 키 */
  projects: {
    /** 팀별 프로젝트 목록 */
    byTeam: (teamId: string) => ['teams', teamId, 'projects'] as const,
    /** 프로젝트 상세 */
    detail: (teamId: string, projectId: string) =>
      ['teams', teamId, 'projects', projectId] as const,
    /**
     * 사업 개요 조회 캐시 키를 생성한다.
     *
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @returns 사업 개요 쿼리 키
     */
    businessOverview: (teamId: string, projectId: string) =>
      ['teams', teamId, 'projects', projectId, 'business-overview'] as const,
  },
  /** 프로젝트 TODO 관련 쿼리 키 */
  projectTodos: {
    /** 프로젝트 내 내 TODO 목록 */
    all: (teamId: string, projectId: string) =>
      ['teams', teamId, 'projects', projectId, 'todos'] as const,
    /** 특정 TODO 연결 문서 목록 */
    documents: (teamId: string, projectId: string, todoId: number | null) =>
      ['teams', teamId, 'projects', projectId, 'todos', todoId, 'documents'] as const,
  },
  /** 데이터 사전 관련 쿼리 키 */
  dictionary: {
    /** 팀별 사전 세트 목록 */
    sets: (teamId: string) => ['teams', teamId, 'dictionary-sets'] as const,
    /** 팀별 도메인 목록 */
    domains: (teamId: string, setId: string) =>
      ['teams', teamId, 'dictionary-sets', setId, 'domains'] as const,
    /** 팀별 단어 목록 */
    words: (teamId: string, setId: string) =>
      ['teams', teamId, 'dictionary-sets', setId, 'words'] as const,
    /** 팀별 도메인 페이지 */
    domainsPage: (teamId: string, setId: string, page: number, size: number, q: string) =>
      ['teams', teamId, 'dictionary-sets', setId, 'domains', { page, size, q }] as const,
    /** 팀별 단어 페이지 */
    wordsPage: (teamId: string, setId: string, page: number, size: number, q: string) =>
      ['teams', teamId, 'dictionary-sets', setId, 'words', { page, size, q }] as const,
    /** 팀별 용어 목록 */
    terms: (teamId: string, setId: string) =>
      ['teams', teamId, 'dictionary-sets', setId, 'terms'] as const,
    /** 팀별 용어 페이지 */
    termsPage: (teamId: string, setId: string, page: number, size: number, q: string) =>
      ['teams', teamId, 'dictionary-sets', setId, 'terms', { page, size, q }] as const,
    /** 키워드 추천 */
    suggest: (teamId: string, setId: string, keyword: string) =>
      ['teams', teamId, 'dictionary-sets', setId, 'dictionary', 'suggest', keyword] as const,
  },
  /** 사용자 설정 관련 쿼리 키 */
  settings: {
    /** 프로젝트 작업공간 탭 순서 */
    projectWorkspaceTabs: () => ['settings', 'project-workspace-tabs'] as const,
  },
  /** AI provider gateway 관련 쿼리 키 */
  aiProvider: {
    /** AI provider 상태 */
    status: () => ['ai-provider', 'status'] as const,
    /** AI 실행 상세 */
    execution: (executionId: string) => ['ai-provider', 'executions', executionId] as const,
  },
  /** AI chat 관련 쿼리/뮤테이션 키 */
  aiChat: {
    /** AI chat 전송 */
    send: () => ['ai-chat', 'send'] as const,
    /** AI chat 전송 부가 메타데이터 */
    metadata: (threadId: string) => ['ai-chat', 'metadata', threadId] as const,
    /** AI proposal 상세 */
    proposal: (proposalId: string) => ['ai-chat', 'proposal', proposalId] as const,
    /** AI proposal 승인 */
    proposalApprove: (proposalId: string) =>
      ['ai-chat', 'proposal', proposalId, 'approve'] as const,
    /** AI proposal 취소 */
    proposalCancel: (proposalId: string) => ['ai-chat', 'proposal', proposalId, 'cancel'] as const,
  },
  /** AI history 관련 쿼리 키 */
  aiHistory: {
    /** 프로젝트 AI history */
    project: (teamId: string, projectId: string, limit: number) =>
      ['teams', teamId, 'projects', projectId, 'ai-history', limit] as const,
  },
  /** 다이어그램 관련 쿼리 키 */
  diagrams: {
    /** 프로젝트별 다이어그램 목록 */
    byProject: (teamId: string, projectId: string) =>
      ['teams', teamId, 'projects', projectId, 'diagrams'] as const,
    /** 다이어그램 bootstrap */
    bootstrap: (teamId: string, projectId: string, diagramId: string) =>
      ['teams', teamId, 'projects', projectId, 'diagrams', diagramId, 'bootstrap'] as const,
    /** 다이어그램 상세 */
    detail: (teamId: string, projectId: string, diagramId: string) =>
      ['teams', teamId, 'projects', projectId, 'diagrams', diagramId] as const,
  },
  /** WBS 관련 쿼리 키 */
  wbs: {
    /** 프로젝트 WBS 전체 목록 */
    all: (teamId: string, projectId: string) =>
      ['teams', teamId, 'projects', projectId, 'wbs'] as const,
    /** 프로젝트 WBS 템플릿 목록 */
    templates: (teamId: string, projectId: string) =>
      ['teams', teamId, 'projects', projectId, 'wbs', 'templates'] as const,
    /** 프로젝트 WBS dependency 목록 */
    dependencies: (teamId: string, projectId: string) =>
      ['teams', teamId, 'projects', projectId, 'wbs', 'dependencies'] as const,
    /** WBS별 연결 문서 목록 */
    linkedDocuments: (teamId: string, projectId: string, wbsId: number | null) =>
      ['teams', teamId, 'projects', projectId, 'wbs', wbsId, 'linked-documents'] as const,
    /** WBS별 댓글 목록 */
    comments: (teamId: string, projectId: string, wbsId: number | null) =>
      ['teams', teamId, 'projects', projectId, 'wbs', wbsId, 'comments'] as const,
    /** WBS별 활동 로그 목록 */
    activities: (teamId: string, projectId: string, wbsId: number | null) =>
      ['teams', teamId, 'projects', projectId, 'wbs', wbsId, 'activities'] as const,
    /** WBS별 공유 TODO 요약 */
    sharedTodos: (teamId: string, projectId: string, wbsId: number | null) =>
      ['teams', teamId, 'projects', projectId, 'wbs', wbsId, 'todos'] as const,
    /** 프로젝트 태그 목록 */
    tags: (teamId: string, projectId: string) =>
      ['teams', teamId, 'projects', projectId, 'document-tags'] as const,
    /** 특정 태그의 문서 목록 */
    tagDocuments: (teamId: string, projectId: string, tag: string | null) =>
      ['teams', teamId, 'projects', projectId, 'document-tags', tag, 'documents'] as const,
  },
  /** 마일스톤 관련 쿼리 키 */
  milestones: {
    /** 프로젝트 마일스톤 전체 목록 */
    all: (teamId: string, projectId: string) =>
      ['teams', teamId, 'projects', projectId, 'milestones'] as const,
  },
  /** 인력 투입 관련 쿼리 키 */
  staffing: {
    /** 프로젝트 인력 투입 전체 조회 */
    all: (teamId: string, projectId: string) =>
      ['teams', teamId, 'projects', projectId, 'staffing'] as const,
  },
  /** 프로젝트 이슈 관련 쿼리 키 */
  issues: {
    /** 프로젝트 이슈 목록 조회 */
    all: (teamId: string, projectId: string, filters: ProjectIssueFilters = {}) =>
      ['teams', teamId, 'projects', projectId, 'issues', filters] as const,
  },
} as const;
