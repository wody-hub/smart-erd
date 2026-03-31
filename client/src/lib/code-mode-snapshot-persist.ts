import { SHARED_SCHEMA_DRAFT_ORIGIN } from './shared-schema-draft.js';

/** preview 드래그 persisted 반영 origin 식별자 */
const PREVIEW_POSITION_PERSIST_ORIGIN_TYPE = 'canvas-user-drag';

/**
 * code 모드 snapshot 서버 저장 대상으로 볼 로컬 Y.Doc origin인지 판별한다.
 *
 * code 모드의 협업 원본은 shared schema draft이고, preview 그래프는 로컬 파생 상태다.
 * 따라서 서버 snapshot 영속도 "의미 있는 초안 변경"에 한정한다.
 *
 * 현재는 다음 두 경우만 snapshot 저장 대상으로 본다.
 * - shared schema draft snapshot 쓰기/clear
 * - preview에서 기존 persisted 테이블 위치를 직접 드래그한 결과
 *
 * @param origin Y.Doc update origin
 * @returns code 모드 snapshot 저장을 예약해야 하면 true
 */
export function shouldScheduleCodeModeSnapshotPersist(origin: unknown): boolean {
  return (
    origin === SHARED_SCHEMA_DRAFT_ORIGIN ||
    (typeof origin === 'object' &&
      origin !== null &&
      'type' in origin &&
      (origin as { type?: unknown }).type === PREVIEW_POSITION_PERSIST_ORIGIN_TYPE)
  );
}
