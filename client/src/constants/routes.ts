/** 애플리케이션 라우트 경로 상수. 정적 경로와 파라미터 기반 동적 경로를 제공한다. */
export const ROUTES = {
  /** 로그인 페이지 */
  LOGIN: '/login',
  /** 회원가입 페이지 */
  SIGNUP: '/signup',
  /** 팀 목록 페이지 */
  TEAMS: '/teams',
  /** 프로젝트 목록 페이지 (라우트 패턴) */
  PROJECTS_PATTERN: '/teams/:teamId/projects',
  /** 데이터 사전 페이지 (라우트 패턴) */
  DICTIONARY_PATTERN: '/teams/:teamId/dictionary',
  /** 다이어그램 목록 페이지 (라우트 패턴) */
  DIAGRAMS_PATTERN: '/teams/:teamId/projects/:projectId/diagrams',
  /** 다이어그램 편집 페이지 (라우트 패턴) */
  DIAGRAM_PATTERN: '/teams/:teamId/projects/:projectId/diagrams/:diagramId',
  /** 프로젝트 목록 페이지 */
  PROJECTS: (teamId: string | number) => `/teams/${teamId}/projects`,
  /** 다이어그램 목록 페이지 */
  DIAGRAMS: (teamId: string | number, projectId: string | number) =>
    `/teams/${teamId}/projects/${projectId}/diagrams`,
  /** 다이어그램 편집 페이지 */
  DIAGRAM: (teamId: string | number, projectId: string | number, diagramId: string | number) =>
    `/teams/${teamId}/projects/${projectId}/diagrams/${diagramId}`,
  /** 데이터 사전 페이지 */
  DICTIONARY: (teamId: string | number) => `/teams/${teamId}/dictionary`,
} as const;
