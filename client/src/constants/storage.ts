/** localStorage에 저장하는 키 상수. 인증 정보를 영속화하는 데 사용한다. */
export const STORAGE_KEYS = {
  /** JWT Access Token */
  ACCESS_TOKEN: 'accessToken',
  /** UUID Refresh Token */
  REFRESH_TOKEN: 'refreshToken',
  /** 사용자 로그인 ID */
  LOGIN_ID: 'loginId',
  /** 사용자 표시 이름 */
  NAME: 'name',
  /** i18next 언어 설정 */
  LANGUAGE: 'i18nextLng',
  /** DDL 코드 에디터 DBMS 설정 */
  DDL_DBMS: 'smart-erd-ddl-dbms',
  /** 다이어그램 단위 코드 동기화 정책 prefix */
  ERD_SYNC_POLICY_PREFIX: 'smart-erd-sync-policy',
  /** 다이어그램 단위 작업 모드 prefix */
  DIAGRAM_WORK_MODE_PREFIX: 'smart-erd-work-mode',
  /** 다이어그램 단위 DSL draft prefix */
  DIAGRAM_DSL_DRAFT_PREFIX: 'smart-erd-dsl-draft',
  /** Diff Apply rollout 강제 모드 override */
  ERD_DIFF_APPLY_FORCE_MODE: 'smart-erd-diff-apply-force-mode',
  /** Internal rollout 로컬 opt-in 토글 */
  ERD_DIFF_APPLY_INTERNAL_OPT_IN: 'smart-erd-diff-apply-internal-opt-in',
} as const;
