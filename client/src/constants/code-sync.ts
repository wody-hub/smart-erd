/** 코드 입력 idle 대기 시간 (ms) */
export const CODE_SYNC_IDLE_MS = 1200;

/** ERD 변경 후 코드 자동 갱신 대기 시간 (ms) */
export const ERD_SYNC_IDLE_MS = 600;

/** 원격 편집 락으로 보류된 자동 반영 최대 대기 시간 (ms) */
export const CODE_SYNC_MAX_QUEUE_WAIT_MS = 10000;

/** 코드 파싱 오류 중 마지막 편집 테이블 락을 유지하는 grace 시간 (ms) */
export const CODE_LOCK_GRACE_MS = 2000;
