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
  /** 다이어그램 관련 쿼리 키 */
  diagrams: {
    /** 프로젝트별 다이어그램 목록 */
    byProject: (teamId: string, projectId: string) =>
      ['teams', teamId, 'projects', projectId, 'diagrams'] as const,
    /** 다이어그램 상세 */
    detail: (teamId: string, projectId: string, diagramId: string) =>
      ['teams', teamId, 'projects', projectId, 'diagrams', diagramId] as const,
  },
} as const;
