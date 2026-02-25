/** 코드 동기화 상태 값 */
export type SyncStatus =
  | 'idle-wait'
  | 'hold-parse-error'
  | 'hold-remote-lock'
  | 'hold-queue-timeout'
  | 'dropped-stale'
  | 'synced'
  | null;
