export type GuideEntrySource =
  | 'login'
  | 'signup'
  | 'teams'
  | 'projects'
  | 'documents'
  | 'overview'
  | 'wbs'
  | 'gantt'
  | 'staffing'
  | 'issues';

export interface GuideRouteOptions {
  source?: GuideEntrySource;
  teamId?: string | number;
  projectId?: string | number;
  hash?: string;
}

function buildGuideRoute(options: GuideRouteOptions = {}): string {
  const searchParams = new URLSearchParams();

  if (options.source) {
    searchParams.set('source', options.source);
  }
  if (options.teamId != null) {
    searchParams.set('teamId', String(options.teamId));
  }
  if (options.projectId != null) {
    searchParams.set('projectId', String(options.projectId));
  }

  const queryString = searchParams.toString();
  const hash = options.hash ? `#${options.hash.replace(/^#/, '')}` : '';

  return `/guide${queryString ? `?${queryString}` : ''}${hash}`;
}

/** 애플리케이션 라우트 경로 상수. 정적 경로와 파라미터 기반 동적 경로를 제공한다. */
export const ROUTES = {
  /** 제품 가이드 페이지 */
  GUIDE: '/guide',
  /** 제품 가이드 페이지 (진입 맥락/앵커 포함) */
  GUIDE_ENTRY: buildGuideRoute,
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
  /** 전용 WBS 작업공간 페이지 (라우트 패턴) */
  PROJECT_WBS_PATTERN: '/teams/:teamId/projects/:projectId/wbs',
  /** 다이어그램 편집 페이지 (라우트 패턴) */
  DIAGRAM_PATTERN: '/teams/:teamId/projects/:projectId/diagrams/:diagramId',
  /** 프로젝트 목록 페이지 */
  PROJECTS: (teamId: string | number) => `/teams/${teamId}/projects`,
  /** 다이어그램 목록 페이지 */
  DIAGRAMS: (teamId: string | number, projectId: string | number) =>
    `/teams/${teamId}/projects/${projectId}/diagrams`,
  /** 전용 WBS 작업공간 페이지 */
  PROJECT_WBS: (teamId: string | number, projectId: string | number) =>
    `/teams/${teamId}/projects/${projectId}/wbs`,
  /** 다이어그램 편집 페이지 */
  DIAGRAM: (teamId: string | number, projectId: string | number, diagramId: string | number) =>
    `/teams/${teamId}/projects/${projectId}/diagrams/${diagramId}`,
  /** 데이터 사전 페이지 */
  DICTIONARY: (teamId: string | number) => `/teams/${teamId}/dictionary`,
  /** 서버 설정 페이지 (Electron 전용) */
  SETTINGS: '/settings',
} as const;
