import type {
  CollaborationRuntimeEvent,
  CollaborationRuntimeState,
} from '../core/collaboration-runtime-types.js';

/**
 * 채널별 preview/fallback/live 의미를 판정하는 정책 포트.
 *
 * @typeParam TBootstrap bootstrap 데이터 타입
 */
export interface CollaborationPreviewPolicy<TBootstrap> {
  /**
   * bootstrap 기준으로 preview를 먼저 노출해야 하는지 판단한다.
   *
   * @param bootstrap 채널 bootstrap 데이터
   * @returns preview 선노출 여부
   */
  shouldStartInPreview(bootstrap: TBootstrap): boolean;

  /**
   * 현재 상태와 이벤트를 기준으로 다음 상태를 결정한다.
   *
   * @param currentState 현재 협업 런타임 상태
   * @param event        상태 전이 이벤트
   * @returns 다음 협업 런타임 상태
   */
  transition(
    currentState: CollaborationRuntimeState,
    event: CollaborationRuntimeEvent,
  ): CollaborationRuntimeState;
}
