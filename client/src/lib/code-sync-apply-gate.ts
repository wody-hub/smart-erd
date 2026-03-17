import type { SyncStatus } from '../constants/sync-status.js';

/**
 * 코드 자동반영 시 적용 결과에 따른 동기화 상태를 결정한다.
 *
 * @param applied 자동반영 성공 여부
 * @returns 동기화 상태
 */
export function resolveCodeAutoApplyStatus(applied: boolean): SyncStatus {
  return applied ? 'synced' : 'hold-manual-confirm';
}

/**
 * 수동 Apply 시 확인 다이얼로그 표시 여부를 판정한다.
 *
 * @param existingNodeCount 현재 캔버스 노드 수
 * @param isLargeDiagram 대형 다이어그램 여부
 * @returns 확인 다이얼로그 표시 필요 여부
 */
export function shouldOpenApplyConfirm(
  existingNodeCount: number,
  isLargeDiagram: boolean,
): boolean {
  return existingNodeCount > 0 || isLargeDiagram;
}
