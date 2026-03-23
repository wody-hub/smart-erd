import type { CollaborationRuntimeState } from './collaboration-runtime-types.js';

export type PreviewSyncStatus = 'inactive' | 'syncing' | 'live' | 'degraded';

/**
 * 협업 런타임 상태를 기존 preview sync 상태 UI 의미로 변환한다.
 *
 * <p>Phase 5 이전 화면 계약을 유지하기 위해, runtime state를 footer/toast에서
 * 사용 중인 간단한 sync 상태로 축약한다.</p>
 *
 * @param runtimeState 현재 협업 런타임 상태
 * @param previewEnabled preview 선노출 경로 여부
 * @returns 화면용 preview sync 상태
 */
export function toPreviewSyncStatus(
  runtimeState: CollaborationRuntimeState,
  previewEnabled: boolean,
): PreviewSyncStatus {
  if (!previewEnabled) {
    return 'inactive';
  }

  switch (runtimeState) {
    case 'live':
      return 'live';
    case 'degraded':
      return 'degraded';
    case 'preview':
    case 'hydrating':
    case 'reconnecting':
    default:
      return 'syncing';
  }
}
