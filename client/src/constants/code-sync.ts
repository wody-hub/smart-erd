/** 코드 입력 idle 대기 시간 (ms) */
export const CODE_SYNC_IDLE_MS = 1200;

/** 코드 입력 후 Code→ERD 자동반영 대기 시간 (ms) */
export const CODE_AUTO_APPLY_IDLE_MS = 1800;

/** code 모드 DSL draft localStorage 저장 대기 시간 (ms) */
export const CODE_DRAFT_PERSIST_IDLE_MS = 500;

/** code 모드 shared draft Y.Doc 동기화 대기 시간 (ms) */
export const CODE_SHARED_DRAFT_SYNC_IDLE_MS = 200;

/**
 * code 모드 shared draft Y.Doc snapshot 서버 영속화 대기 시간 (ms)
 *
 * TODO: 현재는 debounce 저장이라, 이 윈도우 안에 서버 재기동/장애가 나면
 * code 모드의 최신 draft가 세션 간 복원되지 못할 수 있다.
 * "최대한 빠른 서버 영속"이 필요해지면 구조 변경 감지 즉시 저장 또는 더 짧은
 * 저장 정책으로 재설계해야 한다.
 */
export const CODE_SHARED_DRAFT_SERVER_PERSIST_IDLE_MS = 1500;

/**
 * code 모드 shared draft의 첫 서버 영속화 대기 시간 (ms)
 *
 * 아직 서버에 한 번도 올라가지 않은 fresh draft는 close-time keepalive 실패에 더 취약하므로
 * 첫 checkpoint는 일반 debounce보다 더 빠르게 올린다.
 */
export const CODE_SHARED_DRAFT_INITIAL_SERVER_PERSIST_IDLE_MS = 250;

/** code 모드 remote shared draft bootstrap 대기 시간 (ms) */
export const CODE_SHARED_DRAFT_BOOTSTRAP_WAIT_MS = 300;

/** code 모드 preview graph 생성 대기 시간 (ms) */
export const CODE_PREVIEW_GRAPH_IDLE_MS = 300;

/** ERD 변경 후 코드 자동 갱신 대기 시간 (ms) */
export const ERD_SYNC_IDLE_MS = 600;

/** 원격 편집 락으로 보류된 자동 반영 최대 대기 시간 (ms) */
export const CODE_SYNC_MAX_QUEUE_WAIT_MS = 10000;

/** 코드 파싱 오류 중 마지막 편집 테이블 락을 유지하는 grace 시간 (ms) */
export const CODE_LOCK_GRACE_MS = 2000;

/** Code→ERD apply 직후 ERD 변경을 무시하는 suppress 윈도우 (ms) */
export const CODE_SYNC_SUPPRESS_WINDOW_MS = 200;
